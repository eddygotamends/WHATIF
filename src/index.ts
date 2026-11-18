export { WhatIfCore, type WhatIfCoreOptions } from "./core/whatif-core";
export { ChessSession } from "./core/chess-session";
export { StockfishUciEngine } from "./engine/stockfish-uci-engine";
export { PracticeEngine } from "./engine/practice-engine";
export type { UciTransport } from "./engine/uci-transport";
export {
  FairPlayError,
  type ColorSide,
  type ContinueOptions,
  type ContinueResult,
  type EngineSearchRequest,
  type FairPlayErrorCode,
  type GameMetadata,
  type GameStatus,
  type MoveEngine,
  type MoveRecord,
  type SearchLimits,
  type SessionState,
} from "./core/types";
