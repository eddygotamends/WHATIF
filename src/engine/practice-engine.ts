import { Chess, Move, PieceSymbol } from "chess.js";
import type { EngineSearchRequest, MoveEngine } from "../core/types";

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Piece-square bonus tables from White's perspective (rank 8 at index 0 to rank 1 at index 7)
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 27, 27, 10, 5, 5],
  [0, 0, 0, 24, 24, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -22, -22, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 12, 16, 16, 12, 0, -30],
  [-30, 5, 16, 22, 22, 16, 5, -30],
  [-30, 0, 16, 22, 22, 16, 0, -30],
  [-30, 5, 12, 16, 16, 12, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const BISHOP_PST = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 8, 12, 12, 8, 0, -10],
  [-10, 6, 6, 12, 12, 6, 6, -10],
  [-10, 0, 12, 12, 12, 12, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 6, 0, 0, 0, 0, 6, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20],
];

const ROOK_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [8, 14, 14, 14, 14, 14, 14, 8],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 6, 6, 0, 0, 0],
];

const QUEEN_PST = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20],
];

const KING_MID_PST = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20],
];

function getPstValue(type: PieceSymbol, r: number, c: number, color: "w" | "b"): number {
  const row = color === "w" ? r : 7 - r;
  switch (type) {
    case "p":
      return PAWN_PST[row][c];
    case "n":
      return KNIGHT_PST[row][c];
    case "b":
      return BISHOP_PST[row][c];
    case "r":
      return ROOK_PST[row][c];
    case "q":
      return QUEEN_PST[row][c];
    case "k":
      return KING_MID_PST[row][c];
  }
}

function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === "w" ? -100000 : 100000;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  const board = chess.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const val = PIECE_VALUES[sq.type] + getPstValue(sq.type, r, c, sq.color);
      score += sq.color === "w" ? val : -val;
    }
  }

  return score;
}

function scoreMoveOrder(move: Move): number {
  let score = 0;
  if (move.captured) {
    score += 10 * PIECE_VALUES[move.captured] - PIECE_VALUES[move.piece];
  }
  if (move.promotion) {
    score += PIECE_VALUES[move.promotion];
  }
  if (move.san.includes("+")) {
    score += 45;
  }
  return score;
}

export class PracticeEngine implements MoveEngine {
  public readonly name = "Practice Engine (MIT)";
  public readonly minElo = 600;
  public readonly maxElo = 2400;

  private aborted = false;
  private activeTimer: ReturnType<typeof setTimeout> | null = null;

  public async bestMove(
    fen: string,
    limits?: EngineSearchRequest
  ): Promise<string | null> {
    this.aborted = false;

    // Brief realistic thinking delay so moves read naturally
    const delayMs = Math.min(550, Math.max(260, limits?.moveTimeMs ?? 420));
    await new Promise<void>((resolve) => {
      this.activeTimer = setTimeout(() => {
        this.activeTimer = null;
        resolve();
      }, delayMs);
    });

    if (this.aborted) return null;

    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) return null;

    const targetElo = limits?.targetElo ?? 1500;
    const clampedElo = Math.max(this.minElo, Math.min(this.maxElo, targetElo));

    // Calibrate depth & inaccuracy noise to Elo
    const searchDepth = clampedElo >= 1750 ? 3 : clampedElo >= 1150 ? 2 : 1;
    const maximizing = chess.turn() === "w";

    const ordered = [...legalMoves].sort(
      (a, b) => scoreMoveOrder(b) - scoreMoveOrder(a)
    );

    const scoredMoves: Array<{ move: Move; score: number }> = [];

    for (const move of ordered) {
      if (this.aborted) return null;
      chess.move(move);
      const val = this.alphabeta(
        chess,
        searchDepth - 1,
        -Infinity,
        Infinity,
        !maximizing
      );
      chess.undo();
      // Normalize from the moving side's perspective (higher = better)
      const normalized = maximizing ? val : -val;
      scoredMoves.push({ move, score: normalized });
    }

    scoredMoves.sort((a, b) => b.score - a.score);

    // At high Elo (>= 2000), pick top move directly; lower Elo introduces calibrated noise
    const chosen = this.pickCalibratedMove(scoredMoves, clampedElo);
    return `${chosen.from}${chosen.to}${chosen.promotion ?? ""}`;
  }

  private pickCalibratedMove(
    scoredMoves: Array<{ move: Move; score: number }>,
    elo: number
  ): Move {
    if (scoredMoves.length === 1 || elo >= 2050) {
      return scoredMoves[0].move;
    }

    // Never throw away an immediate forced mate
    if (scoredMoves[0].score > 50000) {
      return scoredMoves[0].move;
    }

    // Elo 600 -> temperature ~240 cp, Elo 1500 -> ~65 cp, Elo 1950 -> ~14 cp
    const normalizedSkill = (elo - this.minElo) / (2050 - this.minElo);
    const temperature = Math.max(12, 240 * Math.pow(1 - normalizedSkill, 1.8));

    const candidates = scoredMoves.slice(0, Math.min(6, scoredMoves.length));
    const bestScore = candidates[0].score;

    const weights = candidates.map((c) => {
      const diff = Math.max(-600, c.score - bestScore);
      return Math.exp(diff / temperature);
    });

    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) {
        return candidates[i].move;
      }
    }

    return candidates[0].move;
  }

  private alphabeta(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    maximizing: boolean
  ): number {
    if (depth === 0 || chess.isGameOver()) {
      const base = evaluateBoard(chess);
      if (chess.isCheckmate()) {
        // Prefer faster mates
        return maximizing ? base - depth * 10 : base + depth * 10;
      }
      return base;
    }

    const moves = chess.moves({ verbose: true });
    moves.sort((a, b) => scoreMoveOrder(b) - scoreMoveOrder(a));

    if (maximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        chess.move(move);
        const ev = this.alphabeta(chess, depth - 1, alpha, beta, false);
        chess.undo();
        if (ev > maxEval) maxEval = ev;
        if (ev > alpha) alpha = ev;
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        chess.move(move);
        const ev = this.alphabeta(chess, depth - 1, alpha, beta, true);
        chess.undo();
        if (ev < minEval) minEval = ev;
        if (ev < beta) beta = ev;
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  public stop(): void {
    this.aborted = true;
    if (this.activeTimer !== null) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
  }

  public dispose(): void {
    this.stop();
  }
}
