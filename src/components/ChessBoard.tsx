import React, { useMemo, useRef, useState } from "react";
import type { MoveRecord } from "../core/types";
import {
  ChessPieceSvg,
  type BoardFinish,
  type PieceColor,
  type PieceType,
} from "./ChessPieceSvg";

export type BoardThemeId =
  | "natural-walnut"
  | "emerald-felt"
  | "silver-slate"
  | "graphite";

export const BOARD_THEMES: Record<
  BoardThemeId,
  {
    name: string;
    light: string;
    dark: string;
    coordLight: string;
    coordDark: string;
  }
> = {
  "natural-walnut": {
    name: "Walnut",
    light: "#F0D9B5",
    dark: "#8A5838",
    coordLight: "#6B4226",
    coordDark: "#F6E8D0",
  },
  "emerald-felt": {
    name: "Emerald",
    light: "#EEEED2",
    dark: "#4E7A44",
    coordLight: "#3E6336",
    coordDark: "#F4F4DF",
  },
  "silver-slate": {
    name: "Slate",
    light: "#E7EDF5",
    dark: "#4A627D",
    coordLight: "#354960",
    coordDark: "#F0F5FA",
  },
  graphite: {
    name: "Graphite",
    light: "#CFD8E3",
    dark: "#2C3442",
    coordLight: "#1F2631",
    coordDark: "#E2E8F0",
  },
};

export interface BoardSquarePiece {
  square: string;
  type: PieceType;
  color: PieceColor;
}

interface ChessBoardProps {
  boardMatrix: (BoardSquarePiece | null)[][];
  flipped: boolean;
  theme: BoardThemeId;
  finish?: BoardFinish;
  turn: "w" | "b";
  isCheck: boolean;
  legalMoves: MoveRecord[];
  lastMove: MoveRecord | null;
  disabled?: boolean;
  showCoordinates?: boolean;
  showLegalHints?: boolean;
  onPlayMove: (uci: string) => void;
  onIllegalMove?: () => void;
}

interface PendingPromotion {
  from: string;
  to: string;
  color: PieceColor;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

export const ChessBoard: React.FC<ChessBoardProps> = ({
  boardMatrix,
  flipped,
  theme,
  finish = "gloss",
  turn,
  isCheck,
  legalMoves,
  lastMove,
  disabled = false,
  showCoordinates = true,
  showLegalHints = true,
  onPlayMove,
  onIllegalMove,
}) => {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [dragState, setDragState] = useState<{
    from: string;
    piece: BoardSquarePiece;
    x: number;
    y: number;
    hoverSquare: string | null;
  } | null>(null);

  const palette = BOARD_THEMES[theme];
  const isGloss = finish === "gloss";

  const legalMovesByFrom = useMemo(() => {
    const map = new Map<string, MoveRecord[]>();
    for (const move of legalMoves) {
      const existing = map.get(move.from);
      if (existing) {
        existing.push(move);
      } else {
        map.set(move.from, [move]);
      }
    }
    return map;
  }, [legalMoves]);

  const activeSourceSquare = dragState?.from ?? selectedSquare;
  const activeTargets = useMemo(() => {
    if (!activeSourceSquare) return new Map<string, MoveRecord[]>();
    const map = new Map<string, MoveRecord[]>();
    const moves = legalMovesByFrom.get(activeSourceSquare) ?? [];
    for (const m of moves) {
      const list = map.get(m.to);
      if (list) list.push(m);
      else map.set(m.to, [m]);
    }
    return map;
  }, [activeSourceSquare, legalMovesByFrom]);

  const checkedKingSquare = useMemo(() => {
    if (!isCheck) return null;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = boardMatrix[r]?.[c];
        if (piece && piece.type === "k" && piece.color === turn) {
          return `${FILES[c]}${RANKS[r]}`;
        }
      }
    }
    return null;
  }, [boardMatrix, isCheck, turn]);

  const getSquareFromPoint = (clientX: number, clientY: number): string | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }
    const colIdx = Math.floor(((clientX - rect.left) / rect.width) * 8);
    const rowIdx = Math.floor(((clientY - rect.top) / rect.height) * 8);
    if (colIdx < 0 || colIdx > 7 || rowIdx < 0 || rowIdx > 7) return null;
    const file = flipped ? FILES[7 - colIdx] : FILES[colIdx];
    const rank = flipped ? RANKS[7 - rowIdx] : RANKS[rowIdx];
    return `${file}${rank}`;
  };

  const attemptMove = (from: string, to: string): boolean => {
    const candidates = (legalMovesByFrom.get(from) ?? []).filter((m) => m.to === to);
    if (candidates.length === 0) {
      return false;
    }

    const promoMoves = candidates.filter((m) => Boolean(m.promotion));
    if (promoMoves.length > 0) {
      setPendingPromotion({ from, to, color: turn });
      setSelectedSquare(null);
      return true;
    }

    setSelectedSquare(null);
    onPlayMove(candidates[0].uci);
    return true;
  };

  const handleSquareClick = (square: string, piece: BoardSquarePiece | null) => {
    if (disabled || pendingPromotion) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        return;
      }

      if (attemptMove(selectedSquare, square)) {
        return;
      }

      if (piece && piece.color === turn) {
        setSelectedSquare(square);
        return;
      }

      setSelectedSquare(null);
      onIllegalMove?.();
      return;
    }

    if (piece && piece.color === turn) {
      setSelectedSquare(square);
    }
  };

  const handlePointerDown = (
    e: React.PointerEvent,
    square: string,
    piece: BoardSquarePiece | null
  ) => {
    if (disabled || pendingPromotion || e.button !== 0) return;
    if (!piece || piece.color !== turn) return;

    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    setDragState({
      from: square,
      piece,
      x: e.clientX,
      y: e.clientY,
      hoverSquare: square,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState) return;
    const hoverSquare = getSquareFromPoint(e.clientX, e.clientY);
    setDragState((prev) =>
      prev
        ? {
            ...prev,
            x: e.clientX,
            y: e.clientY,
            hoverSquare,
          }
        : null
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState) return;
    const targetSquare = getSquareFromPoint(e.clientX, e.clientY);
    const sourceSquare = dragState.from;
    setDragState(null);

    if (!targetSquare || targetSquare === sourceSquare) {
      setSelectedSquare((prev) => (prev === sourceSquare ? null : sourceSquare));
      return;
    }

    const ok = attemptMove(sourceSquare, targetSquare);
    if (!ok) {
      setSelectedSquare(null);
      onIllegalMove?.();
    }
  };

  const displayRows = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];
  const displayCols = flipped ? [...Array(8).keys()].reverse() : [...Array(8).keys()];

  return (
    <div className="relative select-none w-full max-w-[480px] mx-auto liquid-glass p-1.5 sm:p-2 rounded-[20px] transition-all duration-300">
      <div
        ref={boardRef}
        className={`relative aspect-square w-full rounded-[12px] overflow-hidden touch-none ${
          isGloss
            ? "ring-1 ring-white/30 shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
            : "ring-1 ring-white/12 shadow-[0_8px_24px_rgba(0,0,0,0.42)]"
        }`}
      >
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {displayRows.map((r, visualRowIdx) =>
            displayCols.map((c, visualColIdx) => {
              const square = `${FILES[c]}${RANKS[r]}`;
              const isLight = (r + c) % 2 === 0;
              const rawPiece = boardMatrix[r]?.[c] ?? null;
              const piece: BoardSquarePiece | null = rawPiece
                ? { square, type: rawPiece.type, color: rawPiece.color }
                : null;

              const isSelected = activeSourceSquare === square;
              const isLastMove =
                lastMove !== null &&
                (lastMove.from === square || lastMove.to === square);
              const isLandedTarget = lastMove !== null && lastMove.to === square;
              const isCheckedKing = checkedKingSquare === square;
              const targetMoves = activeTargets.get(square);
              const isLegalTarget = Boolean(targetMoves && targetMoves.length > 0);
              const isHoverTarget =
                dragState?.hoverSquare === square && isLegalTarget;

              const isBeingDragged = dragState?.from === square;

              const showRankCoord = visualColIdx === 0;
              const showFileCoord = visualRowIdx === 7;
              const coordColor = isLight ? palette.coordLight : palette.coordDark;

              return (
                <button
                  key={square}
                  type="button"
                  onClick={() => handleSquareClick(square, piece)}
                  onPointerDown={(e) => handlePointerDown(e, square, piece)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  aria-label={`Square ${square}${
                    piece ? `, ${piece.color === "w" ? "White" : "Black"} ${piece.type}` : ""
                  }`}
                  style={{
                    backgroundColor: isLight ? palette.light : palette.dark,
                    boxShadow: isGloss
                      ? "inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -1px 0 rgba(0,0,0,0.1)"
                      : undefined,
                  }}
                  className="relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A84FF]"
                >
                  {isLastMove && (
                    <span
                      className="absolute inset-0 bg-[#F59E0B]/34 pointer-events-none transition-opacity duration-200"
                      aria-hidden="true"
                    />
                  )}

                  {isSelected && (
                    <span
                      className="absolute inset-0 bg-[#0A84FF]/38 pointer-events-none"
                      aria-hidden="true"
                    />
                  )}

                  {isCheckedKing && (
                    <span
                      className="absolute inset-0 pointer-events-none animate-pulse"
                      style={{
                        background:
                          "radial-gradient(circle, rgba(239,68,68,0.92) 0%, rgba(239,68,68,0.32) 68%, transparent 100%)",
                      }}
                      aria-hidden="true"
                    />
                  )}

                  {isHoverTarget && (
                    <span
                      className="absolute inset-0 ring-3 ring-inset ring-[#0A84FF] pointer-events-none"
                      aria-hidden="true"
                    />
                  )}

                  {showCoordinates && showRankCoord && (
                    <span
                      style={{ color: coordColor }}
                      className="absolute top-0.5 left-1 text-[10px] font-mono font-bold leading-none pointer-events-none opacity-90"
                    >
                      {RANKS[r]}
                    </span>
                  )}
                  {showCoordinates && showFileCoord && (
                    <span
                      style={{ color: coordColor }}
                      className="absolute bottom-0.5 right-1 text-[10px] font-mono font-bold leading-none pointer-events-none opacity-90"
                    >
                      {FILES[c]}
                    </span>
                  )}

                  {piece && !isBeingDragged && (
                    <div
                      key={isLandedTarget ? `${square}-${lastMove?.ply}` : square}
                      className={`w-[84%] h-[84%] pointer-events-none z-10 transition-transform duration-150 ${
                        isSelected ? "scale-110 -translate-y-0.5" : ""
                      } ${isLandedTarget ? "animate-piece-land" : ""}`}
                    >
                      <ChessPieceSvg
                        type={piece.type}
                        color={piece.color}
                        finish={finish}
                      />
                    </div>
                  )}

                  {showLegalHints && isLegalTarget && (
                    <span
                      className={`pointer-events-none z-20 transition-transform duration-150 ${
                        piece
                          ? "absolute inset-1 rounded-full border-[3.5px] border-black/40"
                          : "w-[28%] h-[28%] rounded-full bg-black/30"
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Gloss or Matte Board Surface Overlay */}
        <div
          className={`absolute inset-0 pointer-events-none z-20 ${
            isGloss ? "board-gloss-sheen" : "board-matte-grain"
          }`}
          aria-hidden="true"
        />

        {dragState && (
          <div
            className="fixed z-50 pointer-events-none w-16 h-16 -translate-x-1/2 -translate-y-1/2 scale-110"
            style={{ left: dragState.x, top: dragState.y }}
          >
            <ChessPieceSvg
              type={dragState.piece.type}
              color={dragState.piece.color}
              finish={finish}
            />
          </div>
        )}

        {pendingPromotion && (
          <div
            className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-view-enter"
            role="dialog"
            aria-label="Choose promotion piece"
          >
            <div className="liquid-glass rounded-2xl p-4 max-w-xs w-full">
              <p className="text-xs font-medium text-slate-200 text-center mb-3">
                Promote pawn on {pendingPromotion.to}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(["q", "r", "b", "n"] as PieceType[]).map((promo) => (
                  <button
                    key={promo}
                    type="button"
                    onClick={() => {
                      const uci = `${pendingPromotion.from}${pendingPromotion.to}${promo}`;
                      setPendingPromotion(null);
                      onPlayMove(uci);
                    }}
                    className="aspect-square rounded-xl bg-white/10 hover:bg-[#0A84FF]/30 border border-white/15 p-2 transition-colors flex items-center justify-center"
                    aria-label={`Promote to ${promo.toUpperCase()}`}
                  >
                    <ChessPieceSvg
                      type={promo}
                      color={pendingPromotion.color}
                      finish={finish}
                    />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPendingPromotion(null)}
                className="mt-3 w-full py-1.5 text-xs text-slate-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
