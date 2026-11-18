import { ChessSession } from "./chess-session";
import {
  FairPlayError,
  type ColorSide,
  type ContinueOptions,
  type ContinueResult,
  type GameMetadata,
  type MoveEngine,
  type MoveRecord,
  type SearchLimits,
  type SessionState,
} from "./types";

export interface WhatIfCoreOptions {
  engine?: MoveEngine | null;
}

export class WhatIfCore {
  private readonly session = new ChessSession();
  private engine: MoveEngine | null = null;
  private engineReady = false;
  private isThinking = false;
  private readonly listeners = new Set<(state: SessionState) => void>();

  constructor(options?: WhatIfCoreOptions) {
    if (options?.engine) {
      this.engine = options.engine;
      this.engineReady = typeof options.engine.initialize !== "function";
    }
  }

  public setEngine(
    engine: MoveEngine | null,
    options?: { disposePrevious?: boolean }
  ): void {
    const shouldDispose = options?.disposePrevious ?? true;
    if (shouldDispose && this.engine && this.engine !== engine) {
      this.engine.stop?.();
      this.engine.dispose?.();
    }

    this.engine = engine;
    this.isThinking = false;
    this.engineReady = engine ? typeof engine.initialize !== "function" : false;
    this.emit();
  }

  public hasEngine(): boolean {
    return this.engine !== null;
  }

  public async initialize(): Promise<void> {
    if (!this.engine) {
      throw new FairPlayError("NO_ENGINE", "No move engine is attached.");
    }
    if (this.engine.initialize) {
      await this.engine.initialize();
    }
    this.engineReady = true;
    this.emit();
  }

  public subscribe(listener: (state: SessionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): SessionState {
    return {
      fen: this.session.getFen(),
      ply: this.session.getPly(),
      totalPlies: this.session.getTotalPlies(),
      originalTotalPlies: this.session.getOriginalTotalPlies(),
      branchedAtPly: this.session.getBranchedAtPly(),
      history: this.session.getHistory(),
      redoStack: this.session.getRedoStack(),
      legalMoves: this.session.getLegalMoves(),
      canUndo: this.session.canUndo(),
      canRedo: this.session.canRedo(),
      status: this.session.getStatus(),
      metadata: this.session.getGameMetadata(),
      engineReady: this.engineReady,
      engineName: this.engine?.name ?? null,
      isThinking: this.isThinking,
    };
  }

  public getGameMetadata(): GameMetadata {
    return this.session.getGameMetadata();
  }

  public setKnownPlayerNames(names: string[]): void {
    this.session.setKnownPlayerNames(names);
    this.emit();
  }

  public setPlayerSide(side: ColorSide | null): void {
    this.session.setPlayerSide(side);
    this.emit();
  }

  public setOpponentElo(elo: number | null): void {
    this.session.setOpponentElo(elo);
    this.emit();
  }

  public loadPgn(pgn: string, options?: { ply?: number }): void {
    this.stopEngine();
    this.session.loadPgn(pgn, options);
    this.emit();
  }

  public loadFen(fen: string): void {
    this.stopEngine();
    this.session.loadFen(fen);
    this.emit();
  }

  public loadMoves(
    uciMoves: string[],
    options?: { startFen?: string; ply?: number }
  ): void {
    this.stopEngine();
    this.session.loadMoves(uciMoves, options);
    this.emit();
  }

  public playMove(uci: string): MoveRecord {
    const move = this.session.playMove(uci);
    this.emit();
    return move;
  }

  public playSan(san: string): MoveRecord {
    const move = this.session.playSan(san);
    this.emit();
    return move;
  }

  public undo(): MoveRecord | null {
    const undone = this.session.undo();
    if (undone) this.emit();
    return undone;
  }

  public redo(): MoveRecord | null {
    const redone = this.session.redo();
    if (redone) this.emit();
    return redone;
  }

  public rewind(plies: number): void {
    this.session.rewind(plies);
    this.emit();
  }

  public jumpToPly(ply: number): void {
    this.session.jumpToPly(ply);
    this.emit();
  }

  public restart(): void {
    this.session.restart();
    this.emit();
  }

  public async continueAsOpponent(
    options?: ContinueOptions
  ): Promise<ContinueResult> {
    if (!this.engine) {
      throw new FairPlayError(
        "NO_ENGINE",
        "Attach and initialize a move engine before requesting an opponent move."
      );
    }

    const status = this.session.getStatus();
    if (status.isGameOver) {
      throw new FairPlayError(
        "GAME_OVER",
        "The current position is already game over."
      );
    }

    const metadata = this.session.getGameMetadata();
    if (!metadata.isFinished && !options?.allowUnfinishedGame) {
      throw new FairPlayError(
        "UNFINISHED_GAME",
        "Fair-play guard blocked continuation: only completed PGN games (1-0, 0-1, 1/2-1/2) may run without explicit offline study consent."
      );
    }

    if (!metadata.playerSide || !metadata.opponentSide) {
      throw new FairPlayError(
        "NOT_OPPONENT_TURN",
        "Select which side you played before asking the opponent engine to reply."
      );
    }

    const opponentTurnChar = metadata.opponentSide === "white" ? "w" : "b";
    if (status.turn !== opponentTurnChar) {
      throw new FairPlayError(
        "NOT_OPPONENT_TURN",
        `It is currently your turn (${metadata.playerSide}). Opponent continuation only runs on ${metadata.opponentSide}'s turn.`
      );
    }

    if (metadata.opponentElo === null) {
      throw new FairPlayError(
        "MISSING_ELO",
        "Opponent Elo is missing from headers. Enter an opponent Elo rating to calibrate strength."
      );
    }

    const requestedElo = metadata.opponentElo;
    const minElo = this.engine.minElo ?? 600;
    const maxElo = this.engine.maxElo ?? 3190;
    const effectiveElo = Math.max(minElo, Math.min(maxElo, requestedElo));
    const eloClamped = effectiveElo !== requestedElo;
    const warning = eloClamped
      ? `Opponent Elo ${requestedElo} was clamped to ${effectiveElo} (supported range ${minElo}–${maxElo} for ${this.engine.name}).`
      : null;

    if (!this.engineReady && this.engine.initialize) {
      await this.engine.initialize();
      this.engineReady = true;
    }

    const requestFen = this.session.getFen();
    this.isThinking = true;
    this.emit();

    try {
      const uci = await this.engine.bestMove(requestFen, {
        depth: options?.depth,
        moveTimeMs: options?.moveTimeMs,
        targetElo: effectiveElo,
      });

      if (!uci || this.session.getFen() !== requestFen) {
        return {
          move: null,
          requestedElo,
          effectiveElo,
          eloClamped,
          warning,
          engineName: this.engine.name,
        };
      }

      const played = this.session.playMove(uci);
      return {
        move: played,
        requestedElo,
        effectiveElo,
        eloClamped,
        warning,
        engineName: this.engine.name,
      };
    } finally {
      this.isThinking = false;
      this.emit();
    }
  }

  public async suggestMove(limits?: SearchLimits): Promise<string | null> {
    if (!this.engine) {
      throw new FairPlayError("NO_ENGINE", "No move engine is attached.");
    }
    if (!this.engineReady && this.engine.initialize) {
      await this.engine.initialize();
      this.engineReady = true;
    }
    return this.engine.bestMove(this.session.getFen(), limits);
  }

  public async playEngineMove(limits?: SearchLimits): Promise<MoveRecord | null> {
    const uci = await this.suggestMove(limits);
    if (!uci) return null;
    return this.playMove(uci);
  }

  public exportPgn(): string {
    return this.session.exportPgn();
  }

  public getBoardMatrix() {
    return this.session.getBoardMatrix();
  }

  public stopEngine(): void {
    this.engine?.stop?.();
    if (this.isThinking) {
      this.isThinking = false;
      this.emit();
    }
  }

  public dispose(): void {
    this.stopEngine();
    this.engine?.dispose?.();
    this.engine = null;
    this.listeners.clear();
  }

  private emit(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
