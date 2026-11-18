import React from "react";
import { ChessPieceSvg, type BoardFinish, type PieceColor, type PieceType } from "./ChessPieceSvg";

interface MaterialStripProps {
  side: "white" | "black";
  label: string;
  elo: number | null;
  roleLabel: string;
  isTurn: boolean;
  isThinking?: boolean;
  capturedPieces: PieceType[];
  materialAdvantage: number;
  finish?: BoardFinish;
}

export const MaterialStrip: React.FC<MaterialStripProps> = ({
  side,
  label,
  elo,
  roleLabel,
  isTurn,
  isThinking = false,
  capturedPieces,
  materialAdvantage,
  finish = "gloss",
}) => {
  const capturedColor: PieceColor = side === "white" ? "b" : "w";

  return (
    <div
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl transition-all duration-200 liquid-glass ${
        isTurn ? "ring-1 ring-[#0A84FF]/60" : ""
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border shadow-inner ${
            side === "white"
              ? "bg-[#F7F4EC] border-white/60 text-slate-900"
              : "bg-[#151820] border-white/20 text-slate-100"
          }`}
          aria-hidden="true"
        >
          <span className="text-[11px] font-bold">{side === "white" ? "W" : "B"}</span>
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white truncate">
            <span className="truncate">{label}</span>
            {elo !== null && (
              <>
                <span className="text-white/30" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-[11px] text-slate-200 tabular-nums shrink-0">
                  {elo} Elo
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300/80">
            <span>{roleLabel}</span>
            {capturedPieces.length > 0 && (
              <>
                <span className="text-white/25" aria-hidden="true">
                  ·
                </span>
                <div className="flex items-center -space-x-1" aria-label="Captured pieces">
                  {capturedPieces.map((piece, idx) => (
                    <span key={`${piece}-${idx}`} className="w-3.5 h-3.5 inline-block">
                      <ChessPieceSvg type={piece} color={capturedColor} finish={finish} />
                    </span>
                  ))}
                </div>
              </>
            )}
            {materialAdvantage > 0 && (
              <span className="font-mono text-[11px] text-sky-300 tabular-nums font-medium">
                +{materialAdvantage}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0">
        {isThinking ? (
          <span className="text-[11px] font-semibold text-amber-300 whitespace-nowrap">
            Thinking...
          </span>
        ) : isTurn ? (
          <span className="text-[11px] font-semibold text-[#5AC8FA] whitespace-nowrap">
            Your move
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 whitespace-nowrap">Waiting</span>
        )}
      </div>
    </div>
  );
};
