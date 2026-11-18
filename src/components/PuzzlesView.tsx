import React, { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Calendar,
  ChevronRight,
  Flame,
  HelpCircle,
  History,
  RefreshCw,
  RotateCcw,
  Zap,
} from "lucide-react";
import { soundEngine } from "../audio/sound-engine";
import {
  fetchLichessDailyPuzzle,
  fetchLichessNextPuzzle,
  type LichessDailyPuzzle,
  type LichessProfile,
} from "../services/lichess-client";
import { ChessBoard, type BoardThemeId } from "./ChessBoard";
import { ChessPieceSvg, type BoardFinish } from "./ChessPieceSvg";
import type { MoveRecord } from "../core/types";

interface PuzzlesViewProps {
  boardTheme: BoardThemeId;
  boardFinish: BoardFinish;
  showCoordinates: boolean;
  showLegalHints: boolean;
  lichessToken: string | null;
  profile: LichessProfile | null;
  onAnalyzeInWhatIf: (pgn: string, ply: number) => void;
}

type PuzzleMode = "menu" | "solver" | "themes" | "dashboard" | "history";

interface PuzzleHistoryItem {
  id: string;
  rating: number;
  solved: boolean;
  pgn: string;
  initialPly: number;
}

const PUZZLE_THEMES = [
  { id: "mix", label: "Healthy mix" },
  { id: "mateIn2", label: "Mate in 2" },
  { id: "fork", label: "Fork" },
  { id: "pin", label: "Pin" },
  { id: "endgame", label: "Endgame" },
  { id: "opening", label: "Opening" },
];

const MiniBoardThumbnail: React.FC<{ fen: string }> = ({ fen }) => {
  const board = new Chess(fen).board();
  return (
    <div className="w-16 h-16 rounded-lg overflow-hidden grid grid-cols-8 grid-rows-8 shrink-0 ring-1 ring-white/20 shadow-sm">
      {board.map((row, r) =>
        row.map((sq, c) => {
          const isLight = (r + c) % 2 === 0;
          return (
            <div
              key={`${r}-${c}`}
              style={{ backgroundColor: isLight ? "#E7EDF5" : "#4A627D" }}
              className="flex items-center justify-center"
            >
              {sq && <ChessPieceSvg type={sq.type} color={sq.color} finish="matte" />}
            </div>
          );
        })
      )}
    </div>
  );
};

export const PuzzlesView: React.FC<PuzzlesViewProps> = ({
  boardTheme,
  boardFinish,
  showCoordinates,
  showLegalHints,
  lichessToken,
  profile,
  onAnalyzeInWhatIf,
}) => {
  const [mode, setMode] = useState<PuzzleMode>("menu");
  const [solverKind, setSolverKind] = useState<"daily" | "streak" | "storm" | "theme">("daily");
  const [selectedTheme, setSelectedTheme] = useState<string>("mix");
  const [dailyPreview, setDailyPreview] = useState<LichessDailyPuzzle | null>(null);
  const [activePuzzle, setActivePuzzle] = useState<LichessDailyPuzzle | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [statusMsg, setStatusMsg] = useState("Find the best move");
  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [solved, setSolved] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  const [stormScore, setStormScore] = useState(0);
  const [stormSeconds, setStormSeconds] = useState(180);
  const [history, setHistory] = useState<PuzzleHistoryItem[]>([]);

  useEffect(() => {
    void fetchLichessDailyPuzzle()
      .then((d) => setDailyPreview(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (mode !== "solver" || solverKind !== "storm" || stormSeconds <= 0) return;
    const t = setTimeout(() => setStormSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [mode, solverKind, stormSeconds]);

  const startPuzzle = async (
    kind: "daily" | "streak" | "storm" | "theme",
    themeAngle?: string
  ) => {
    setSolverKind(kind);
    if (kind === "storm") {
      setStormSeconds(180);
      setStormScore(0);
    }
    setMode("solver");
    setLoading(true);
    setErrorMsg(null);
    setSolved(false);
    setHintSquare(null);
    setStepIdx(0);
    setStatusMsg("Find the best move");

    try {
      const data =
        kind === "daily"
          ? dailyPreview || (await fetchLichessDailyPuzzle())
          : await fetchLichessNextPuzzle(themeAngle, lichessToken);
      setActivePuzzle(data);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not load Lichess puzzle."
      );
    } finally {
      setLoading(false);
    }
  };

  const dailyPreviewFen = useMemo(() => {
    if (!dailyPreview) return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const c = new Chess();
    c.loadPgn(dailyPreview.game.pgn);
    const hist = c.history({ verbose: true });
    const s = new Chess();
    const stop = Math.min(dailyPreview.puzzle.initialPly + 1, hist.length);
    for (let i = 0; i < stop; i++) {
      s.move({ from: hist[i].from, to: hist[i].to, promotion: hist[i].promotion });
    }
    return s.fen();
  }, [dailyPreview]);

  const puzzleState = useMemo(() => {
    if (!activePuzzle) return null;
    const chess = new Chess();
    chess.loadPgn(activePuzzle.game.pgn);
    const hist = chess.history({ verbose: true });

    const start = new Chess();
    const targetPly = Math.min(activePuzzle.puzzle.initialPly + 1, hist.length);
    let lastMove: MoveRecord | null = null;
    for (let i = 0; i < targetPly; i++) {
      const m = hist[i];
      const exec = start.move({
        from: m.from,
        to: m.to,
        promotion: m.promotion,
      });
      lastMove = {
        ply: i + 1,
        san: exec.san,
        uci: `${exec.from}${exec.to}${exec.promotion ?? ""}`,
        from: exec.from,
        to: exec.to,
        promotion: exec.promotion,
        color: exec.color,
        fen: start.fen(),
        captured: exec.captured,
        flags: exec.flags,
      };
    }

    const playerColor = start.turn();
    for (let s = 0; s < stepIdx; s++) {
      const uci = activePuzzle.puzzle.solution[s];
      if (!uci) break;
      const exec = start.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      lastMove = {
        ply: targetPly + s + 1,
        san: exec.san,
        uci,
        from: exec.from,
        to: exec.to,
        promotion: exec.promotion,
        color: exec.color,
        fen: start.fen(),
        captured: exec.captured,
        flags: exec.flags,
      };
    }

    const legalMoves: MoveRecord[] = start.moves({ verbose: true }).map((m) => ({
      ply: 0,
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

    return {
      boardMatrix: start.board(),
      turn: start.turn(),
      playerColor,
      isCheck: start.inCheck(),
      legalMoves,
      lastMove,
    };
  }, [activePuzzle, stepIdx]);

  const recordOutcome = (wasSolved: boolean) => {
    if (!activePuzzle) return;
    setHistory((prev) => [
      {
        id: activePuzzle.puzzle.id,
        rating: activePuzzle.puzzle.rating,
        solved: wasSolved,
        pgn: activePuzzle.game.pgn,
        initialPly: activePuzzle.puzzle.initialPly + 1,
      },
      ...prev.slice(0, 19),
    ]);
  };

  const handleMove = (uci: string) => {
    if (!activePuzzle || !puzzleState || solved) return;
    const expected = activePuzzle.puzzle.solution[stepIdx];
    if (uci !== expected) {
      soundEngine.play("illegal");
      setStatusMsg("Not quite — try another continuation.");
      if (solverKind === "streak") setStreakCount(0);
      return;
    }

    soundEngine.play("move");
    setHintSquare(null);
    const nextStep = stepIdx + 1;
    if (nextStep >= activePuzzle.puzzle.solution.length) {
      setStepIdx(nextStep);
      setSolved(true);
      setStatusMsg("Puzzle solved!");
      soundEngine.play("game-over");
      recordOutcome(true);
      if (solverKind === "streak") setStreakCount((c) => c + 1);
      if (solverKind === "storm") setStormScore((c) => c + 1);
      return;
    }

    setStepIdx(nextStep);
    setStatusMsg("Good move! Opponent replying...");
    setTimeout(() => {
      const replyStep = nextStep + 1;
      setStepIdx(replyStep);
      soundEngine.play("move");
      if (replyStep >= activePuzzle.puzzle.solution.length) {
        setSolved(true);
        setStatusMsg("Puzzle solved!");
        soundEngine.play("game-over");
        recordOutcome(true);
        if (solverKind === "streak") setStreakCount((c) => c + 1);
        if (solverKind === "storm") setStormScore((c) => c + 1);
      } else {
        setStatusMsg("Your turn — keep going!");
      }
    }, 340);
  };

  if (mode === "themes") {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-view-enter">
        <button
          type="button"
          onClick={() => setMode("menu")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Puzzles</span>
        </button>

        <div className="liquid-glass rounded-[28px] p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Puzzle Themes</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PUZZLE_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedTheme(t.id);
                  void startPuzzle("theme", t.id === "mix" ? undefined : t.id);
                }}
                className="p-4 rounded-2xl bg-white/[0.06] hover:bg-[#0A84FF]/20 border border-white/12 hover:border-[#0A84FF]/60 text-left transition-all"
              >
                <div className="text-sm font-semibold text-white">{t.label}</div>
                <div className="text-xs text-slate-400 mt-1">Start training</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "dashboard") {
    const solvedCount = history.filter((h) => h.solved).length;
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-view-enter">
        <button
          type="button"
          onClick={() => setMode("menu")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Puzzles</span>
        </button>

        <div className="liquid-glass rounded-[28px] p-6 space-y-5">
          <h2 className="text-xl font-bold text-white">Puzzle Dashboard</h2>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/12">
              <div className="text-xs text-slate-400">Lichess Rating</div>
              <div className="font-mono text-2xl font-bold text-white mt-1 tabular-nums">
                {profile?.perfs.puzzle?.rating ?? "—"}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/12">
              <div className="text-xs text-slate-400">Session Solved</div>
              <div className="font-mono text-2xl font-bold text-emerald-300 mt-1 tabular-nums">
                {solvedCount}
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/12">
              <div className="text-xs text-slate-400">Best Streak</div>
              <div className="font-mono text-2xl font-bold text-[#5AC8FA] mt-1 tabular-nums">
                {streakCount}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "history") {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-view-enter">
        <button
          type="button"
          onClick={() => setMode("menu")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Puzzles</span>
        </button>

        <div className="liquid-glass rounded-[28px] p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Puzzle History</h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">
              Solve a puzzle to review it here or explore alternatives in WHATIF.
            </p>
          ) : (
            <div className="divide-y divide-white/10">
              {history.map((item, idx) => (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  onClick={() => onAnalyzeInWhatIf(item.pgn, item.initialPly)}
                  className="w-full py-3.5 px-2 flex items-center justify-between gap-4 hover:bg-white/[0.05] rounded-xl text-left"
                >
                  <div>
                    <div className="text-sm font-semibold text-white font-mono">
                      Puzzle #{item.id} · {item.rating} Elo
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Tap to open position in WHATIF analysis
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      item.solved ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {item.solved ? "Solved" : "Missed"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === "solver") {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-view-enter">
        <button
          type="button"
          onClick={() => setMode("menu")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Puzzles</span>
        </button>

        {loading ? (
          <div className="liquid-glass rounded-[28px] p-10 text-center text-sm text-slate-300">
            Loading Lichess puzzle...
          </div>
        ) : errorMsg || !activePuzzle || !puzzleState ? (
          <div className="liquid-glass rounded-[28px] p-8 text-center space-y-4">
            <p className="text-sm text-amber-200">{errorMsg || "Puzzle unavailable."}</p>
            <button
              type="button"
              onClick={() => void startPuzzle(solverKind, selectedTheme)}
              className="px-5 py-2.5 rounded-2xl apple-blue-btn text-xs font-semibold text-white"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7">
              <ChessBoard
                boardMatrix={puzzleState.boardMatrix}
                flipped={puzzleState.playerColor === "b"}
                theme={boardTheme}
                finish={boardFinish}
                turn={puzzleState.turn}
                isCheck={puzzleState.isCheck}
                legalMoves={puzzleState.legalMoves}
                lastMove={puzzleState.lastMove}
                disabled={solved || (solverKind === "storm" && stormSeconds <= 0)}
                showCoordinates={showCoordinates}
                showLegalHints={showLegalHints}
                onPlayMove={handleMove}
                onIllegalMove={() => soundEngine.play("illegal")}
              />
            </div>

            <div className="lg:col-span-5 liquid-glass rounded-[28px] p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5AC8FA]">
                    {solverKind === "daily"
                      ? "Puzzle of the day"
                      : solverKind === "streak"
                      ? `Puzzle Streak · ${streakCount}`
                      : solverKind === "storm"
                      ? `Puzzle Storm · ${stormScore}`
                      : `Theme: ${selectedTheme}`}
                  </div>
                  <h2 className="text-xl font-bold text-white mt-1">
                    {puzzleState.playerColor === "w"
                      ? "White to play"
                      : "Black to play"}
                  </h2>
                  <p className="text-xs text-slate-300/80 mt-0.5 tabular-nums">
                    Rating {activePuzzle.puzzle.rating} · {activePuzzle.game.perf.name}
                  </p>
                </div>

                {solverKind === "storm" && (
                  <div className="font-mono text-xl font-bold text-amber-300 tabular-nums">
                    {Math.floor(stormSeconds / 60)}:
                    {String(stormSeconds % 60).padStart(2, "0")}
                  </div>
                )}
              </div>

              <div
                className={`p-3.5 rounded-2xl border text-xs font-medium ${
                  solved
                    ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-200"
                    : "bg-white/[0.06] border-white/12 text-slate-100"
                }`}
              >
                {statusMsg}
              </div>

              {hintSquare && (
                <div className="p-3 rounded-2xl bg-[#0A84FF]/15 border border-[#0A84FF]/40 text-xs text-sky-200">
                  Hint: Examine the piece on{" "}
                  <span className="font-mono font-bold text-white">{hintSquare}</span>.
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={solved}
                  onClick={() => {
                    const nextUci = activePuzzle.puzzle.solution[stepIdx];
                    if (nextUci) setHintSquare(nextUci.slice(0, 2));
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#5AC8FA]" />
                  <span>Hint</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStepIdx(0);
                    setSolved(false);
                    setHintSquare(null);
                    setStatusMsg("Find the best move");
                  }}
                  className="flex-1 py-2.5 px-3 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void startPuzzle(
                      solverKind === "daily" ? "theme" : solverKind,
                      selectedTheme === "mix" ? undefined : selectedTheme
                    )
                  }
                  aria-label="Next puzzle"
                  className="p-2.5 rounded-xl apple-blue-btn text-white"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {solved && (
                <button
                  type="button"
                  onClick={() =>
                    onAnalyzeInWhatIf(
                      activePuzzle.game.pgn,
                      activePuzzle.puzzle.initialPly + 1
                    )
                  }
                  className="w-full py-2.5 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-[#5AC8FA]"
                >
                  Analyze in WHATIF
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-view-enter">
      <h1 className="text-lg font-bold text-white tracking-tight px-1">Puzzles</h1>

      {/* Compact Grouped Menu Card */}
      <section className="liquid-glass rounded-2xl divide-y divide-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setMode("themes")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <BookOpen className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white">Puzzle Themes</div>
              <div className="text-[11px] text-slate-400">
                Train openings or tactical motifs.
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => void startPuzzle("streak")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Flame className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white">Puzzle Streak</div>
              <div className="text-[11px] text-slate-400">
                Solve progressively harder puzzles in a row.
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => void startPuzzle("storm")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Zap className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white">Puzzle Storm</div>
              <div className="text-[11px] text-slate-400">
                Solve as many puzzles as possible in 3 minutes.
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setMode("dashboard")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <BarChart3 className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white">Puzzle Dashboard</div>
              <div className="text-[11px] text-slate-400">
                Train, analyse, improve.
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => setMode("history")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <History className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white">Puzzle history</div>
              <div className="text-[11px] text-slate-400">
                Review your past puzzle attempts.
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </section>

      {/* Chess tactics trainer section */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-bold text-white px-1">
          Chess tactics trainer
        </h2>

        <button
          type="button"
          onClick={() => void startPuzzle("daily")}
          className="w-full liquid-glass rounded-2xl p-3 flex items-center gap-3.5 hover:bg-white/[0.08] transition-all text-left"
        >
          <MiniBoardThumbnail fen={dailyPreviewFen} />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[13px] font-bold text-white">
              Puzzle of the day
            </div>
            <div className="text-[11px] text-slate-300/80 tabular-nums">
              {dailyPreview
                ? `Played ${dailyPreview.puzzle.plays.toLocaleString()} times · ${dailyPreview.puzzle.rating} Elo`
                : "Loading daily puzzle..."}
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-amber-300 font-medium">
              <Calendar className="w-3 h-3" />
              <span>
                {new Chess(dailyPreviewFen).turn() === "w"
                  ? "White to play"
                  : "Black to play"}
              </span>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          onClick={() => void startPuzzle("theme")}
          className="w-full liquid-glass rounded-2xl p-3 flex items-center gap-3.5 hover:bg-white/[0.08] transition-all text-left"
        >
          <MiniBoardThumbnail fen="r2q1rk1/pp2bppp/2n1bn2/3pp3/4P3/1NN1BP2/PPPQ2PP/2KR1B1R w - - 4 10" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-[13px] font-bold text-white">Healthy mix</div>
            <div className="text-[11px] text-slate-300/80 leading-snug">
              A mix of everything — test pattern recognition across motifs.
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </section>
    </div>
  );
};
