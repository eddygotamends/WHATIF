import React, { useState } from "react";
import {
  Cpu,
  GitBranch,
  Send,
  User,
  Users,
  X,
} from "lucide-react";

export interface LobbySeekConfig {
  timeMinutes: number;
  incrementSeconds: number;
  rated: boolean;
  ratingRange: string;
}

interface PlaySheetModalProps {
  isOpen: boolean;
  isLichessConnected: boolean;
  isSeeking: boolean;
  seekError: string | null;
  onClose: () => void;
  onCreateLichessLobby: (config: LobbySeekConfig) => void;
  onCancelSeek: () => void;
  onChallengeFriend: (username: string, config: LobbySeekConfig) => Promise<void>;
  onChallengeLichessAi: (level: number, config: LobbySeekConfig) => Promise<void>;
  onPlayLocalBot: (elo: number) => void;
  onPlayOverTheBoard: () => void;
  onResumeWhatIf: () => void;
  onOpenLichessConnect: () => void;
}

const TIME_PRESETS = [
  { label: "1+0", min: 1, inc: 0 },
  { label: "3+0", min: 3, inc: 0 },
  { label: "3+2", min: 3, inc: 2 },
  { label: "5+0", min: 5, inc: 0 },
  { label: "5+3", min: 5, inc: 3 },
  { label: "10+0", min: 10, inc: 0 },
  { label: "15+10", min: 15, inc: 10 },
];

const RATING_RANGES = [
  { label: "-500 / +500", value: "-500/+500" },
  { label: "-250 / +250", value: "-250/+250" },
  { label: "Any rating", value: "" },
];

export const PlaySheetModal: React.FC<PlaySheetModalProps> = ({
  isOpen,
  isLichessConnected,
  isSeeking,
  seekError,
  onClose,
  onCreateLichessLobby,
  onCancelSeek,
  onChallengeFriend,
  onChallengeLichessAi,
  onPlayLocalBot,
  onPlayOverTheBoard,
  onResumeWhatIf,
  onOpenLichessConnect,
}) => {
  const [timeIdx, setTimeIdx] = useState(5); // 10+0 default matching screenshot
  const [rated, setRated] = useState(true);
  const [rangeIdx, setRangeIdx] = useState(0);
  const [subPanel, setSubPanel] = useState<"main" | "friend" | "computer">("main");
  const [friendUsername, setFriendUsername] = useState("");
  const [aiLevel, setAiLevel] = useState(3);
  const [localBotElo, setLocalBotElo] = useState(1400);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPreset = TIME_PRESETS[timeIdx];
  const currentRange = RATING_RANGES[rangeIdx];
  const config: LobbySeekConfig = {
    timeMinutes: currentPreset.min,
    incrementSeconds: currentPreset.inc,
    rated: isLichessConnected ? rated : false,
    ratingRange: currentRange.value,
  };

  const handleFriendSubmit = async () => {
    setLocalError(null);
    if (!friendUsername.trim()) {
      setLocalError("Enter your friend's Lichess username.");
      return;
    }
    setSubmitting(true);
    try {
      await onChallengeFriend(friendUsername.trim(), config);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Challenge failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLichessAiSubmit = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      await onChallengeLichessAi(aiLevel, config);
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "AI challenge failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Play Chess"
    >
      <div className="w-full max-w-sm liquid-glass rounded-t-2xl sm:rounded-2xl p-4 sm:p-5 space-y-4 max-h-[88vh] overflow-y-auto animate-sheet-up">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            {subPanel === "main"
              ? "Play Chess"
              : subPanel === "friend"
              ? "Challenge a Friend"
              : "Play Against Computer"}
          </h2>
          <button
            type="button"
            onClick={() => {
              if (subPanel !== "main") {
                setSubPanel("main");
                setLocalError(null);
              } else {
                onClose();
              }
            }}
            aria-label="Close play sheet"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {subPanel === "main" && (
          <>
            {/* Time control, Variant, Rated, Rating filter grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <span className="text-[11px] text-slate-300/80 block">Time control</span>
                <button
                  type="button"
                  onClick={() => setTimeIdx((i) => (i + 1) % TIME_PRESETS.length)}
                  className="w-full py-2 px-3 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white transition-all font-mono tabular-nums"
                >
                  {currentPreset.label}
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-300/80 block">Variant</span>
                <div className="w-full py-2 px-3 rounded-xl liquid-glass-subtle text-xs font-semibold text-white text-center">
                  Standard
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-300/80 block">Game mode</span>
                <button
                  type="button"
                  onClick={() => setRated((r) => !r)}
                  className="w-full py-2 px-3 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white transition-all"
                >
                  {rated ? "Rated" : "Casual"}
                </button>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-300/80 block">Rating filter</span>
                <button
                  type="button"
                  onClick={() => setRangeIdx((i) => (i + 1) % RATING_RANGES.length)}
                  className="w-full py-2 px-3 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white transition-all tabular-nums"
                >
                  {currentRange.label}
                </button>
              </div>
            </div>

            {seekError && (
              <p className="text-[11px] text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-xl p-2.5">
                {seekError}
              </p>
            )}

            {/* Primary Create Lobby Game CTA */}
            {isLichessConnected ? (
              isSeeking ? (
                <button
                  type="button"
                  onClick={onCancelSeek}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-500/85 hover:bg-rose-500 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
                >
                  <span>Searching Lichess lobby ({currentPreset.label}) — Cancel</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onCreateLichessLobby(config)}
                  className="w-full py-2.5 px-4 rounded-xl apple-blue-btn text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Create lobby game</span>
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLichessConnect();
                }}
                className="w-full py-2.5 px-4 rounded-xl apple-blue-btn text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Connect Lichess to create lobby game</span>
              </button>
            )}

            {/* Secondary Lichess-style action list */}
            <div className="rounded-xl bg-black/25 border border-white/10 divide-y divide-white/8 overflow-hidden">
              <button
                type="button"
                onClick={() => setSubPanel("friend")}
                className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left text-xs font-medium text-white hover:bg-white/8 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span>Challenge a friend</span>
              </button>
              <button
                type="button"
                onClick={() => setSubPanel("computer")}
                className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left text-xs font-medium text-white hover:bg-white/8 transition-colors"
              >
                <Cpu className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span>Play against computer</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onPlayOverTheBoard();
                  onClose();
                }}
                className="w-full px-3.5 py-2.5 flex items-center gap-3 text-left text-xs font-medium text-white hover:bg-white/8 transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                <span>Over the board (local 2-player)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onResumeWhatIf();
                  onClose();
                }}
                className="w-full px-4 py-3.5 flex items-center gap-3.5 text-left text-sm font-medium text-[#5AC8FA] hover:bg-white/8 transition-colors"
              >
                <GitBranch className="w-4 h-4 shrink-0" />
                <span>Continue active WHATIF post-mortem</span>
              </button>
            </div>
          </>
        )}

        {subPanel === "friend" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300/85">
              Send a live {currentPreset.label} ({rated ? "Rated" : "Casual"}) challenge to any Lichess player.
            </p>
            <input
              type="text"
              value={friendUsername}
              onChange={(e) => setFriendUsername(e.target.value)}
              placeholder="Opponent Lichess username"
              className="w-full px-4 py-3 rounded-2xl bg-black/40 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0A84FF]"
            />
            {localError && (
              <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/30 rounded-xl p-2.5">
                {localError}
              </p>
            )}
            {isLichessConnected ? (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleFriendSubmit()}
                className="w-full py-3 rounded-2xl apple-blue-btn text-sm font-semibold text-white flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? "Sending challenge..." : "Send Challenge"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLichessConnect();
                }}
                className="w-full py-3 rounded-2xl apple-blue-btn text-sm font-semibold text-white"
              >
                Connect Lichess Account First
              </button>
            )}
          </div>
        )}

        {subPanel === "computer" && (
          <div className="space-y-5">
            {/* Local Calibrated Bot (works offline with Practice Engine or Imported Stockfish) */}
            <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/12 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">
                  Local Calibrated Engine
                </span>
                <span className="font-mono text-xs text-[#5AC8FA] tabular-nums">
                  {localBotElo} Elo
                </span>
              </div>
              <input
                type="range"
                min={600}
                max={2600}
                step={50}
                value={localBotElo}
                onChange={(e) => setLocalBotElo(Number(e.target.value))}
                className="w-full accent-[#0A84FF]"
              />
              <button
                type="button"
                onClick={() => {
                  onPlayLocalBot(localBotElo);
                  onClose();
                }}
                className="w-full py-2.5 rounded-xl apple-blue-btn text-xs font-semibold text-white"
              >
                Start Local Game vs {localBotElo} Elo
              </button>
            </div>

            {/* Online Lichess Stockfish AI (Level 1-8) */}
            <div className="p-4 rounded-2xl bg-white/[0.05] border border-white/12 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white">
                  Lichess Online Stockfish AI
                </span>
                <span className="font-mono text-xs text-slate-300 tabular-nums">
                  Level {aiLevel}
                </span>
              </div>
              <div className="grid grid-cols-8 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAiLevel(lvl)}
                    className={`py-1.5 rounded-lg font-mono text-xs font-semibold transition-colors ${
                      aiLevel === lvl
                        ? "bg-[#0A84FF] text-white"
                        : "bg-white/8 text-slate-300 hover:bg-white/15"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              {localError && (
                <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/30 rounded-xl p-2">
                  {localError}
                </p>
              )}
              {isLichessConnected ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleLichessAiSubmit()}
                  className="w-full py-2.5 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
                >
                  {submitting
                    ? "Starting Lichess AI..."
                    : `Play Online vs Lichess AI (Level ${aiLevel})`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLichessConnect();
                  }}
                  className="w-full py-2.5 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-slate-200"
                >
                  Connect Lichess to play online AI
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
