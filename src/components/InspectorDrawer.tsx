import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  GitBranch,
  Sparkles,
} from "lucide-react";
import type { ColorSide, ContinueResult, MoveRecord, SessionState } from "../core/types";

export type InspectorTab = "moves" | "engine" | "export";

interface InspectorDrawerProps {
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  state: SessionState;
  exportedPgn: string;
  lastReplyInfo: ContinueResult | null;
  fairPlayAlert: string | null;
  onJumpToPly: (ply: number) => void;
  onSetPlayerSide: (side: ColorSide | null) => void;
  onSetOpponentElo: (elo: number | null) => void;
  onOpenMore: () => void;
}

interface MoveRow {
  moveNumber: number;
  white?: { rec: MoveRecord; isFuture: boolean };
  black?: { rec: MoveRecord; isFuture: boolean };
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  activeTab,
  onTabChange,
  state,
  exportedPgn,
  lastReplyInfo,
  fairPlayAlert,
  onJumpToPly,
  onSetPlayerSide,
  onSetOpponentElo,
  onOpenMore,
}) => {
  const [copiedPgn, setCopiedPgn] = useState(false);
  const [copiedFen, setCopiedFen] = useState(false);
  const [eloDraft, setEloDraft] = useState<string>(
    state.metadata.opponentElo !== null ? String(state.metadata.opponentElo) : ""
  );
  const activePlyRef = useRef<HTMLButtonElement | null>(null);
  const moveListRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEloDraft(
      state.metadata.opponentElo !== null ? String(state.metadata.opponentElo) : ""
    );
  }, [state.metadata.opponentElo]);

  useEffect(() => {
    const container = moveListRef.current;
    const row = activePlyRef.current;
    if (activeTab !== "moves" || !container || !row) return;
    const cRect = container.getBoundingClientRect();
    const rRect = row.getBoundingClientRect();
    const offsetAbove = rRect.top - cRect.top;
    const offsetBelow = rRect.bottom - cRect.bottom;
    if (offsetAbove < 0) {
      container.scrollTop += offsetAbove - 8;
    } else if (offsetBelow > 0) {
      container.scrollTop += offsetBelow + 8;
    }
  }, [state.ply, activeTab]);

  const fullTimeline = useMemo(() => {
    return [
      ...state.history.map((rec) => ({ rec, isFuture: false })),
      ...state.redoStack.map((rec) => ({ rec, isFuture: true })),
    ];
  }, [state.history, state.redoStack]);

  const moveRows = useMemo(() => {
    const rows: MoveRow[] = [];
    for (const item of fullTimeline) {
      if (item.rec.color === "w") {
        rows.push({
          moveNumber: Math.ceil(item.rec.ply / 2),
          white: item,
        });
      } else {
        const last = rows[rows.length - 1];
        if (last && !last.black) {
          last.black = item;
        } else {
          rows.push({
            moveNumber: Math.ceil(item.rec.ply / 2),
            black: item,
          });
        }
      }
    }
    return rows;
  }, [fullTimeline]);

  const handleCopy = async (text: string, kind: "pgn" | "fen") => {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "pgn") {
        setCopiedPgn(true);
        setTimeout(() => setCopiedPgn(false), 1800);
      } else {
        setCopiedFen(true);
        setTimeout(() => setCopiedFen(false), 1800);
      }
    } catch {
      // Clipboard blocked in restricted iframe
    }
  };

  const handleDownloadPgn = () => {
    const blob = new Blob([exportedPgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "whatif-continuation.pgn";
    a.click();
    URL.revokeObjectURL(url);
  };

  const commitEloDraft = () => {
    const trimmed = eloDraft.trim();
    if (!trimmed) {
      onSetOpponentElo(null);
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) {
      onSetOpponentElo(Math.max(400, Math.min(3500, parsed)));
    }
  };

  const { metadata } = state;
  const eventTitle = metadata.headers.Event || "WHATIF Continuation";
  const whiteName = metadata.headers.White || "White";
  const blackName = metadata.headers.Black || "Black";

  return (
    <aside className="flex flex-col liquid-glass rounded-2xl overflow-hidden h-full min-h-[420px] max-h-[560px]">
      <div className="p-2.5 border-b border-white/10">
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-black/30 border border-white/10">
          {(
            [
              { id: "moves", label: "Moves" },
              { id: "engine", label: "Calibration" },
              { id: "export", label: "Export" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`py-1.5 px-2.5 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? "bg-white/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                  : "text-slate-300/75 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {fairPlayAlert && (
        <div className="mx-3 mt-2.5 p-2.5 rounded-xl bg-amber-500/15 border border-amber-400/35 flex items-start gap-2 text-[11px] text-amber-100">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
          <p className="leading-snug">{fairPlayAlert}</p>
        </div>
      )}

      {activeTab === "moves" && (
        <div className="flex flex-col flex-1 min-h-0">
          <div className="px-4 py-3 border-b border-white/10 space-y-0.5">
            <h2 className="text-[13px] font-semibold text-white truncate">
              {eventTitle}
            </h2>
            <p className="text-[11px] text-slate-300/80 truncate">
              <span>{whiteName}</span>
              <span className="mx-1 text-white/30" aria-hidden="true">
                vs
              </span>
              <span>{blackName}</span>
              {metadata.result && (
                <>
                  <span className="mx-1 text-white/30" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono text-slate-200 tabular-nums">
                    {metadata.result}
                  </span>
                </>
              )}
            </p>
            {metadata.opening && (
              <p className="text-[10px] text-slate-400 truncate">
                {metadata.opening}
              </p>
            )}
            <div className="pt-2 flex items-center gap-2.5">
              <input
                type="range"
                min={0}
                max={state.totalPlies}
                value={state.ply}
                onChange={(e) => onJumpToPly(Number(e.target.value))}
                aria-label="Scrub game ply"
                className="flex-1 accent-[#0A84FF] cursor-pointer h-1 bg-white/15 rounded-lg"
              />
              <span className="font-mono text-[11px] text-slate-300 tabular-nums whitespace-nowrap shrink-0">
                Ply {state.ply}/{state.totalPlies}
              </span>
            </div>
          </div>

          {state.branchedAtPly !== null && (
            <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-white/8 border border-white/12 flex items-center gap-2 text-[11px] text-slate-200">
              <GitBranch className="w-3 h-3 text-[#5AC8FA] shrink-0" />
              <span>
                Branch from ply{" "}
                <span className="font-mono tabular-nums text-[#5AC8FA] font-semibold">
                  {state.branchedAtPly}
                </span>
              </span>
            </div>
          )}

          {state.status.outcomeText && (
            <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-[11px] font-medium text-emerald-200">
              {state.status.outcomeText}
            </div>
          )}

          <div ref={moveListRef} className="flex-1 overflow-y-auto px-2.5 py-2">
            {moveRows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
                <p className="text-xs text-slate-200">
                  No moves played from this position yet.
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Make a move on the board to explore a line.
                </p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {moveRows.map((row) => (
                    <tr
                      key={row.moveNumber}
                      className="border-b border-white/[0.06] last:border-0"
                    >
                      <td className="w-8 py-1 pl-1.5 font-mono text-[11px] text-slate-400 tabular-nums select-none">
                        {row.moveNumber}.
                      </td>
                      <td className="py-0.5 px-0.5">
                        {row.white ? (
                          <button
                            ref={row.white.rec.ply === state.ply ? activePlyRef : null}
                            type="button"
                            onClick={() => onJumpToPly(row.white!.rec.ply)}
                            className={`w-full text-left px-2 py-1 rounded-lg font-mono text-[11px] tabular-nums transition-colors ${
                              row.white.rec.ply === state.ply
                                ? "bg-[#0A84FF] text-white font-semibold shadow-sm"
                                : row.white.isFuture
                                ? "text-slate-400 hover:text-white hover:bg-white/10"
                                : "text-slate-100 hover:bg-white/10"
                            }`}
                          >
                            {row.white.rec.san}
                          </button>
                        ) : (
                          <span className="px-2 text-slate-500 font-mono text-[11px]">
                            …
                          </span>
                        )}
                      </td>
                      <td className="py-0.5 px-0.5">
                        {row.black ? (
                          <button
                            ref={row.black.rec.ply === state.ply ? activePlyRef : null}
                            type="button"
                            onClick={() => onJumpToPly(row.black!.rec.ply)}
                            className={`w-full text-left px-2 py-1 rounded-lg font-mono text-[11px] tabular-nums transition-colors ${
                              row.black.rec.ply === state.ply
                                ? "bg-[#0A84FF] text-white font-semibold shadow-sm"
                                : row.black.isFuture
                                ? "text-slate-400 hover:text-white hover:bg-white/10"
                                : "text-slate-100 hover:bg-white/10"
                            }`}
                          >
                            {row.black.rec.san}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "engine" && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-3 rounded-xl bg-white/[0.05] border border-white/12 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#5AC8FA]" />
                <span>Auto Detection</span>
              </span>
              <span className="font-mono text-slate-300">
                {metadata.eloSource ? `Elo from ${metadata.eloSource}` : "No Elo"}
              </span>
            </div>
            <p className="text-[11px] text-slate-300/80">
              {metadata.sideInferenceReason || "Select which side you played below."}
            </p>
          </div>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">Your Side</h3>
              <span className="text-xs text-slate-300 capitalize">
                {metadata.playerSide || "Unselected"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-black/30 rounded-2xl border border-white/10">
              <button
                type="button"
                onClick={() => onSetPlayerSide(null)}
                className={`py-2 px-2 text-xs font-medium rounded-xl transition-colors ${
                  metadata.playerSide === metadata.inferredPlayerSide &&
                  metadata.inferredPlayerSide !== null
                    ? "bg-white/18 text-white"
                    : metadata.playerSide === null
                    ? "bg-white/18 text-white"
                    : "text-slate-300/75 hover:text-white"
                }`}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => onSetPlayerSide("white")}
                className={`py-2 px-2 text-xs font-medium rounded-xl transition-colors ${
                  metadata.playerSide === "white"
                    ? "bg-[#0A84FF] text-white font-semibold"
                    : "text-slate-300/75 hover:text-white"
                }`}
              >
                White
              </button>
              <button
                type="button"
                onClick={() => onSetPlayerSide("black")}
                className={`py-2 px-2 text-xs font-medium rounded-xl transition-colors ${
                  metadata.playerSide === "black"
                    ? "bg-[#0A84FF] text-white font-semibold"
                    : "text-slate-300/75 hover:text-white"
                }`}
              >
                Black
              </button>
            </div>
          </section>

          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">
                Opponent Calibration
              </h3>
              {metadata.inferredOpponentElo !== null &&
                metadata.opponentElo !== metadata.inferredOpponentElo && (
                  <button
                    type="button"
                    onClick={() => onSetOpponentElo(null)}
                    className="text-xs text-[#5AC8FA] hover:text-white transition-colors"
                  >
                    Reset ({metadata.inferredOpponentElo})
                  </button>
                )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={600}
                max={2600}
                step={25}
                value={metadata.opponentElo ?? 1500}
                onChange={(e) => onSetOpponentElo(Number(e.target.value))}
                aria-label="Opponent Elo slider"
                className="flex-1 accent-[#0A84FF] cursor-pointer h-1.5 bg-white/15 rounded-lg"
              />
              <input
                type="number"
                min={400}
                max={3500}
                value={eloDraft}
                onChange={(e) => setEloDraft(e.target.value)}
                onBlur={commitEloDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEloDraft();
                }}
                placeholder="Elo"
                aria-label="Opponent Elo rating"
                className="w-20 px-2.5 py-1.5 rounded-xl bg-black/35 border border-white/15 font-mono text-xs text-white tabular-nums focus:outline-none focus:border-[#0A84FF]"
              />
            </div>

            {lastReplyInfo?.warning && (
              <p className="text-xs text-amber-200 bg-amber-500/15 border border-amber-400/25 rounded-xl px-3 py-2">
                {lastReplyInfo.warning}
              </p>
            )}
          </section>

          <hr className="border-white/10" />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Active Engine</span>
              <span className="font-mono text-white">
                {state.engineName || "Practice Engine"}
              </span>
            </div>
            <button
              type="button"
              onClick={onOpenMore}
              className="w-full py-2.5 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white transition-all"
            >
              Board, Audio & Stockfish Settings in More
            </button>
          </div>
        </div>
      )}

      {activeTab === "export" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">
                Continuation PGN
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(exportedPgn, "pgn")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-glass-subtle text-xs text-white transition-colors hover:bg-white/15"
                >
                  {copiedPgn ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedPgn ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPgn}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl apple-blue-btn text-xs font-semibold text-white transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.pgn</span>
                </button>
              </div>
            </div>

            <textarea
              readOnly
              value={exportedPgn}
              rows={11}
              aria-label="Exported PGN text"
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/12 font-mono text-xs text-slate-200 leading-relaxed resize-none focus:outline-none"
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">Current FEN</h3>
              <button
                type="button"
                onClick={() => handleCopy(state.fen, "fen")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-glass-subtle text-xs text-white transition-colors hover:bg-white/15"
              >
                {copiedFen ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedFen ? "Copied" : "Copy FEN"}</span>
              </button>
            </div>
            <div className="p-3 rounded-2xl bg-black/40 border border-white/12 font-mono text-[11px] text-slate-300 break-all">
              {state.fen}
            </div>
          </section>
        </div>
      )}
    </aside>
  );
};
