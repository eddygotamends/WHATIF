export type ColorSide = "white" | "black";

export type FairPlayErrorCode =
  | "UNFINISHED_GAME"
  | "NOT_OPPONENT_TURN"
  | "MISSING_ELO"
  | "NO_ENGINE"
  | "GAME_OVER";

export class FairPlayError extends Error {
  public readonly code: FairPlayErrorCode;

  constructor(code: FairPlayErrorCode, message: string) {
    super(message);
    this.name = "FairPlayError";
    this.code = code;
  }
}

export interface MoveRecord {
  ply: number;
  san: string;
  uci: string;
  from: string;
  to: string;
  promotion?: string;
  color: "w" | "b";
  fen: string;
  captured?: string;
  flags: string;
}

export interface GameMetadata {
  headers: Record<string, string>;
  result: string | null;
  isFinished: boolean;
  sourceType: "pgn" | "fen" | "moves";
  inferredPlayerSide: ColorSide | null;
  sideInferenceReason: string | null;
  playerSide: ColorSide | null;
  opponentSide: ColorSide | null;
  whiteElo: number | null;
  blackElo: number | null;
  whiteRatingDiff: string | null;
  blackRatingDiff: string | null;
  opening: string | null;
  timeControl: string | null;
  inferredOpponentElo: number | null;
  opponentElo: number | null;
  eloSource: "header" | "name" | "override" | null;
  needsSideSelection: boolean;
  needsEloInput: boolean;
}

export interface GameStatus {
  turn: "w" | "b";
  isCheck: boolean;
  isCheckmate: boolean;
  isStalemate: boolean;
  isDraw: boolean;
  isGameOver: boolean;
  outcomeText: string | null;
}

export interface SessionState {
  fen: string;
  ply: number;
  totalPlies: number;
  originalTotalPlies: number;
  branchedAtPly: number | null;
  history: MoveRecord[];
  redoStack: MoveRecord[];
  legalMoves: MoveRecord[];
  canUndo: boolean;
  canRedo: boolean;
  status: GameStatus;
  metadata: GameMetadata;
  engineReady: boolean;
  engineName: string | null;
  isThinking: boolean;
}

export interface SearchLimits {
  depth?: number;
  moveTimeMs?: number;
}

export interface EngineSearchRequest extends SearchLimits {
  targetElo?: number;
}

export interface ContinueOptions extends SearchLimits {
  allowUnfinishedGame?: boolean;
}

export interface ContinueResult {
  move: MoveRecord | null;
  requestedElo: number | null;
  effectiveElo: number | null;
  eloClamped: boolean;
  warning: string | null;
  engineName: string;
}

export interface MoveEngine {
  readonly name: string;
  readonly minElo?: number;
  readonly maxElo?: number;
  initialize?(): Promise<void>;
  bestMove(fen: string, limits?: EngineSearchRequest): Promise<string | null>;
  stop?(): void;
  dispose?(): void;
}
