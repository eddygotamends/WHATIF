import React from "react";
import { Keyboard, ShieldCheck, X } from "lucide-react";

interface FairPlayModalProps {
  mode: "fair-play" | "shortcuts" | null;
  onClose: () => void;
}

export const FairPlayModal: React.FC<FairPlayModalProps> = ({ mode, onClose }) => {
  if (!mode) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === "fair-play" ? "Fair-Play Guardrails" : "Keyboard Shortcuts"}
    >
      <div className="w-full max-w-md liquid-glass rounded-[26px] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/12">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            {mode === "fair-play" ? (
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            ) : (
              <Keyboard className="w-4 h-4 text-[#5AC8FA]" />
            )}
            <span>
              {mode === "fair-play"
                ? "Fair-Play Guardrails & Policy"
                : "Keyboard Shortcuts"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 text-xs text-slate-200 space-y-3 leading-relaxed">
          {mode === "fair-play" ? (
            <>
              <p>
                WHATIF Engine is built exclusively for offline post-game analysis of completed chess games. Never use any engine during an active online match.
              </p>
              <ul className="space-y-2 text-slate-300/85 list-disc pl-4">
                <li>
                  <strong className="text-white">Completed-Game Guard:</strong>{" "}
                  Refuses continuation on PGNs with <span className="font-mono">Result "*"</span> or raw FENs unless offline study mode is explicitly enabled.
                </li>
                <li>
                  <strong className="text-white">Opponent-Turn-Only:</strong>{" "}
                  Engine continuation is blocked on your own turn (<span className="font-mono">NOT_OPPONENT_TURN</span>).
                </li>
                <li>
                  <strong className="text-white">Elo Calibration & Clamping:</strong>{" "}
                  Requires a resolved opponent Elo (<span className="font-mono">WhiteElo</span> / <span className="font-mono">BlackElo</span> or manual override) and throttles strength accordingly.
                </li>
                <li>
                  <strong className="text-white">100% Offline:</strong>{" "}
                  Zero network calls, zero scraping, and zero platform integrations.
                </li>
              </ul>
            </>
          ) : (
            <div className="divide-y divide-white/10">
              {[
                { key: "← / →", desc: "Step backward / forward one ply" },
                { key: "Home / End", desc: "Jump to start or end of line" },
                { key: "F", desc: "Flip chessboard perspective" },
                { key: "M", desc: "Mute / unmute Web Audio move sounds" },
                { key: "I", desc: "Open Import Game & Engine drawer" },
              ].map((item) => (
                <div
                  key={item.key}
                  className="py-2.5 flex items-center justify-between gap-4"
                >
                  <span className="text-slate-200">{item.desc}</span>
                  <kbd className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 font-mono text-[11px] text-[#5AC8FA] whitespace-nowrap">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
