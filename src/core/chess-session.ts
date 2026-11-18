import { Chess, DEFAULT_POSITION, Move, validateFen } from "chess.js";
import type { ColorSide, GameMetadata, GameStatus, MoveRecord } from "./types";

function toMoveRecord(move: Move, ply: number, afterFen: string): MoveRecord {
  return {
    ply,
    san: move.san,
    uci: `${move.from}${move.to}${move.promotion ?? ""}`,
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    color: move.color,
    fen: afterFen,
    captured: move.captured,
    flags: move.flags,
  };
}

function parseNumericElo(value: string | undefined): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{3,4}\??$/.test(trimmed)) {
    const match = trimmed.match(/\b(\d{3,4})\b/);
    if (!match) return null;
    const parsed = Number.parseInt(match[1], 10);
    return parsed >= 300 && parsed <= 3800 ? parsed : null;
  }
  const parsed = Number.parseInt(trimmed.replace("?", ""), 10);
  if (!Number.isFinite(parsed) || parsed < 300 || parsed > 3800) return null;
  return parsed;
}

function extractEloFromHeaders(
  headers: Record<string, string>,
  color: ColorSide
): { elo: number | null; source: "header" | "name" | null } {
  const keys =
    color === "white"
      ? ["WhiteElo", "WhiteRating", "WhiteUSCF", "WhiteFideElo"]
      : ["BlackElo", "BlackRating", "BlackUSCF", "BlackFideElo"];

  for (const key of keys) {
    const val = parseNumericElo(headers[key]);
    if (val !== null) {
      return { elo: val, source: "header" };
    }
  }

  // Fallback: extract rating embedded in player name (e.g. "Opponent_1540", "Magnus (2830)")
  const nameVal = color === "white" ? headers.White : headers.Black;
  if (nameVal) {
    const nameMatch = nameVal.match(/(?:_|\(|\[|\s)(\d{3,4})(?:\)|\]|\b)/);
    if (nameMatch) {
      const parsed = Number.parseInt(nameMatch[1], 10);
      if (parsed >= 300 && parsed <= 3800) {
        return { elo: parsed, source: "name" };
      }
    }
  }

  return { elo: null, source: null };
}

export class ChessSession {
  private chess: Chess;
  private rootFen: string = DEFAULT_POSITION;
  private headers: Record<string, string> = {};
  private sourceType: "pgn" | "fen" | "moves" = "pgn";
  private historyRecords: MoveRecord[] = [];
  private redoRecords: MoveRecord[] = [];
  private originalTotalPlies = 0;
  private branchedAtPly: number | null = null;
  private playerSideOverride: ColorSide | null = null;
  private opponentEloOverride: number | null = null;
  private knownPlayerNames: string[] = ["you", "me", "player"];

  constructor() {
    this.chess = new Chess();
  }

  public setKnownPlayerNames(names: string[]): void {
    const normalized = names
      .map((n) => n.trim().toLowerCase())
      .filter((n) => n.length > 0);
    this.knownPlayerNames = Array.from(
      new Set(["you", "me", "player", ...normalized])
    );
  }

  public loadPgn(pgn: string, options?: { ply?: number }): void {
    const trimmed = pgn.trim();
    if (!trimmed) {
      throw new Error("PGN input is empty.");
    }

    const parser = new Chess();
    parser.loadPgn(trimmed);

    const parsedHeaders = { ...parser.getHeaders() };
    const rootFen = parsedHeaders.FEN?.trim() || DEFAULT_POSITION;
    const moves = parser.history({ verbose: true });

    const replay = new Chess(rootFen);
    const fullTimeline: MoveRecord[] = [];

    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      const executed = replay.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion,
      });
      fullTimeline.push(toMoveRecord(executed, i + 1, replay.fen()));
    }

    const targetPly =
      options?.ply !== undefined
        ? Math.max(0, Math.min(options.ply, fullTimeline.length))
        : fullTimeline.length;

    this.rootFen = rootFen;
    this.headers = parsedHeaders;
    this.sourceType = "pgn";
    this.originalTotalPlies = fullTimeline.length;
    this.branchedAtPly = null;
    this.playerSideOverride = null;
    this.opponentEloOverride = null;

    this.applyTimelineAtPly(fullTimeline, targetPly);
  }

  public loadFen(fen: string): void {
    const trimmed = fen.trim();
    const check = validateFen(trimmed);
    if (!check.ok) {
      throw new Error(check.error || "Invalid FEN string.");
    }

    this.chess = new Chess(trimmed);
    this.rootFen = trimmed;
    this.headers = { FEN: trimmed, SetUp: "1" };
    this.sourceType = "fen";
    this.historyRecords = [];
    this.redoRecords = [];
    this.originalTotalPlies = 0;
    this.branchedAtPly = null;
    this.playerSideOverride = null;
    this.opponentEloOverride = null;
  }

  public loadMoves(uciMoves: string[], options?: { startFen?: string; ply?: number }): void {
    const startFen = options?.startFen?.trim() || DEFAULT_POSITION;
    const check = validateFen(startFen);
    if (!check.ok) {
      throw new Error(check.error || "Invalid starting FEN.");
    }

    const replay = new Chess(startFen);
    const fullTimeline: MoveRecord[] = [];

    for (let i = 0; i < uciMoves.length; i++) {
      const uci = uciMoves[i].trim().toLowerCase();
      if (uci.length < 4) {
        throw new Error(`Invalid UCI move "${uciMoves[i]}" at index ${i}.`);
      }
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length > 4 ? uci[4] : undefined;
      const executed = replay.move({ from, to, promotion });
      fullTimeline.push(toMoveRecord(executed, i + 1, replay.fen()));
    }

    const targetPly =
      options?.ply !== undefined
        ? Math.max(0, Math.min(options.ply, fullTimeline.length))
        : fullTimeline.length;

    this.rootFen = startFen;
    this.headers = startFen === DEFAULT_POSITION ? {} : { FEN: startFen, SetUp: "1" };
    this.sourceType = "moves";
    this.originalTotalPlies = fullTimeline.length;
    this.branchedAtPly = null;
    this.playerSideOverride = null;
    this.opponentEloOverride = null;

    this.applyTimelineAtPly(fullTimeline, targetPly);
  }

  private applyTimelineAtPly(fullTimeline: MoveRecord[], targetPly: number): void {
    const active = new Chess(this.rootFen);
    for (let i = 0; i < targetPly; i++) {
      const rec = fullTimeline[i];
      active.move({
        from: rec.from,
        to: rec.to,
        promotion: rec.promotion,
      });
    }
    this.chess = active;
    this.historyRecords = fullTimeline.slice(0, targetPly);
    this.redoRecords = fullTimeline.slice(targetPly);
  }

  public playMove(uci: string): MoveRecord {
    const normalized = uci.trim().toLowerCase();
    if (normalized.length < 4) {
      throw new Error(`Invalid UCI move "${uci}".`);
    }
    const from = normalized.slice(0, 2);
    const to = normalized.slice(2, 4);
    const promotion = normalized.length > 4 ? normalized[4] : undefined;

    const executed = this.chess.move({ from, to, promotion });
    return this.commitExecutedMove(executed);
  }

  public playSan(san: string): MoveRecord {
    const executed = this.chess.move(san.trim());
    return this.commitExecutedMove(executed);
  }

  private commitExecutedMove(executed: Move): MoveRecord {
    const nextPly = this.historyRecords.length + 1;
    const record = toMoveRecord(executed, nextPly, this.chess.fen());

    if (this.redoRecords.length > 0 && this.redoRecords[0].uci === record.uci) {
      this.historyRecords = [...this.historyRecords, this.redoRecords[0]];
      this.redoRecords = this.redoRecords.slice(1);
    } else {
      if (this.redoRecords.length > 0 && this.branchedAtPly === null) {
        this.branchedAtPly = this.historyRecords.length;
      }
      this.historyRecords = [...this.historyRecords, record];
      this.redoRecords = [];
    }

    return record;
  }

  public undo(): MoveRecord | null {
    if (this.historyRecords.length === 0) return null;
    const undone = this.chess.undo();
    if (!undone) return null;

    const last = this.historyRecords[this.historyRecords.length - 1];
    this.historyRecords = this.historyRecords.slice(0, -1);
    this.redoRecords = [last, ...this.redoRecords];
    return last;
  }

  public redo(): MoveRecord | null {
    if (this.redoRecords.length === 0) return null;
    const next = this.redoRecords[0];
    this.chess.move({
      from: next.from,
      to: next.to,
      promotion: next.promotion,
    });
    this.historyRecords = [...this.historyRecords, next];
    this.redoRecords = this.redoRecords.slice(1);
    return next;
  }

  public rewind(plies: number): void {
    const target = Math.max(0, this.historyRecords.length - Math.max(0, plies));
    this.jumpToPly(target);
  }

  public jumpToPly(ply: number): void {
    const fullTimeline = [...this.historyRecords, ...this.redoRecords];
    const clamped = Math.max(0, Math.min(ply, fullTimeline.length));
    if (clamped === this.historyRecords.length) return;
    this.applyTimelineAtPly(fullTimeline, clamped);
  }

  public restart(): void {
    this.jumpToPly(0);
  }

  public setPlayerSide(side: ColorSide | null): void {
    this.playerSideOverride = side;
  }

  public setOpponentElo(elo: number | null): void {
    if (elo === null || !Number.isFinite(elo)) {
      this.opponentEloOverride = null;
      return;
    }
    this.opponentEloOverride = Math.round(elo);
  }

  public getFen(): string {
    return this.chess.fen();
  }

  public getPly(): number {
    return this.historyRecords.length;
  }

  public getTotalPlies(): number {
    return this.historyRecords.length + this.redoRecords.length;
  }

  public getOriginalTotalPlies(): number {
    return this.originalTotalPlies;
  }

  public getBranchedAtPly(): number | null {
    return this.branchedAtPly;
  }

  public getHistory(): MoveRecord[] {
    return [...this.historyRecords];
  }

  public getRedoStack(): MoveRecord[] {
    return [...this.redoRecords];
  }

  public getLegalMoves(): MoveRecord[] {
    const verbose = this.chess.moves({ verbose: true });
    const nextPly = this.historyRecords.length + 1;
    return verbose.map((m) => ({
      ply: nextPly,
      san: m.san,
      uci: `${m.from}${m.to}${m.promotion ?? ""}`,
      from: m.from,
      to: m.to,
      promotion: m.promotion,
      color: m.color,
      fen: m.after,
      captured: m.captured,
      flags: m.flags,
    }));
  }

  public canUndo(): boolean {
    return this.historyRecords.length > 0;
  }

  public canRedo(): boolean {
    return this.redoRecords.length > 0;
  }

  public getStatus(): GameStatus {
    const turn = this.chess.turn();
    const isCheck = this.chess.inCheck();
    const isCheckmate = this.chess.isCheckmate();
    const isStalemate = this.chess.isStalemate();
    const isDraw = this.chess.isDraw();
    const isGameOver = this.chess.isGameOver();

    let outcomeText: string | null = null;
    if (isCheckmate) {
      outcomeText = turn === "w" ? "0-1 · Checkmate (Black wins)" : "1-0 · Checkmate (White wins)";
    } else if (isStalemate) {
      outcomeText = "1/2-1/2 · Draw by stalemate";
    } else if (this.chess.isInsufficientMaterial()) {
      outcomeText = "1/2-1/2 · Draw by insufficient material";
    } else if (this.chess.isThreefoldRepetition()) {
      outcomeText = "1/2-1/2 · Draw by threefold repetition";
    } else if (this.chess.isDrawByFiftyMoves()) {
      outcomeText = "1/2-1/2 · Draw by 50-move rule";
    } else if (isDraw) {
      outcomeText = "1/2-1/2 · Draw";
    }

    return {
      turn,
      isCheck,
      isCheckmate,
      isStalemate,
      isDraw,
      isGameOver,
      outcomeText,
    };
  }

  public getGameMetadata(): GameMetadata {
    const rawResult = this.headers.Result?.trim() || null;
    const isFinished =
      this.sourceType === "pgn" &&
      (rawResult === "1-0" || rawResult === "0-1" || rawResult === "1/2-1/2");

    const whiteName = this.headers.White?.trim().toLowerCase() || "";
    const blackName = this.headers.Black?.trim().toLowerCase() || "";

    let inferredPlayerSide: ColorSide | null = null;
    let sideInferenceReason: string | null = null;

    if (whiteName && this.knownPlayerNames.includes(whiteName)) {
      inferredPlayerSide = "white";
      sideInferenceReason = `Matched White player "${this.headers.White}"`;
    } else if (blackName && this.knownPlayerNames.includes(blackName)) {
      inferredPlayerSide = "black";
      sideInferenceReason = `Matched Black player "${this.headers.Black}"`;
    } else if (rawResult === "1-0") {
      inferredPlayerSide = "black";
      sideInferenceReason = "Inferred from Result 1-0 (reviewing loss as Black)";
    } else if (rawResult === "0-1") {
      inferredPlayerSide = "white";
      sideInferenceReason = "Inferred from Result 0-1 (reviewing loss as White)";
    }

    const playerSide = this.playerSideOverride ?? inferredPlayerSide;
    if (this.playerSideOverride) {
      sideInferenceReason = `Manual selection (${this.playerSideOverride})`;
    }

    const opponentSide: ColorSide | null =
      playerSide === "white" ? "black" : playerSide === "black" ? "white" : null;

    const whiteParsed = extractEloFromHeaders(this.headers, "white");
    const blackParsed = extractEloFromHeaders(this.headers, "black");

    let inferredOpponentElo: number | null = null;
    let eloSource: "header" | "name" | "override" | null = null;

    if (opponentSide === "white") {
      inferredOpponentElo = whiteParsed.elo;
      eloSource = whiteParsed.source;
    } else if (opponentSide === "black") {
      inferredOpponentElo = blackParsed.elo;
      eloSource = blackParsed.source;
    }

    const opponentElo = this.opponentEloOverride ?? inferredOpponentElo;
    if (this.opponentEloOverride !== null) {
      eloSource = "override";
    }

    return {
      headers: { ...this.headers },
      result: rawResult,
      isFinished,
      sourceType: this.sourceType,
      inferredPlayerSide,
      sideInferenceReason,
      playerSide,
      opponentSide,
      whiteElo: whiteParsed.elo,
      blackElo: blackParsed.elo,
      whiteRatingDiff: this.headers.WhiteRatingDiff || null,
      blackRatingDiff: this.headers.BlackRatingDiff || null,
      opening: this.headers.Opening || this.headers.ECO || null,
      timeControl: this.headers.TimeControl || null,
      inferredOpponentElo,
      opponentElo,
      eloSource,
      needsSideSelection: playerSide === null,
      needsEloInput: opponentElo === null,
    };
  }

  public exportPgn(): string {
    const exporter = new Chess(this.rootFen);
    for (const [key, value] of Object.entries(this.headers)) {
      if (value !== undefined && value !== null) {
        exporter.setHeader(key, value);
      }
    }

    for (const rec of this.historyRecords) {
      exporter.move({
        from: rec.from,
        to: rec.to,
        promotion: rec.promotion,
      });
    }

    const status = this.getStatus();
    if (status.isCheckmate) {
      exporter.setHeader("Result", status.turn === "w" ? "0-1" : "1-0");
    } else if (status.isDraw) {
      exporter.setHeader("Result", "1/2-1/2");
    } else if (this.branchedAtPly !== null) {
      exporter.setHeader("Result", "*");
    }

    return exporter.pgn();
  }

  public getBoardMatrix(): ({
    square: string;
    type: "p" | "n" | "b" | "r" | "q" | "k";
    color: "w" | "b";
  } | null)[][] {
    return this.chess.board();
  }
}
