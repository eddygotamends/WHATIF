import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Dumbbell,
  GraduationCap,
  MapPin,
} from "lucide-react";
import { Chess } from "chess.js";
import { soundEngine } from "../audio/sound-engine";
import type { BoardFinish } from "./ChessPieceSvg";
import { ChessBoard, type BoardThemeId } from "./ChessBoard";
import type { MoveRecord } from "../core/types";

interface LearnViewProps {
  boardTheme: BoardThemeId;
  boardFinish: BoardFinish;
  showCoordinates: boolean;
  showLegalHints: boolean;
  onOpenInAnalysis: (pgnOrFen: string, isFen?: boolean) => void;
}

type LearnSubView = "menu" | "basics" | "practice" | "coordinates";

interface StudyItem {
  id: string;
  emoji: string;
  title: string;
  likes: number;
  author: string;
  age: string;
  pgn: string;
}

const STUDIES: StudyItem[] = [
  {
    id: "london",
    emoji: "♟",
    title: "London System (Core Setup & Plans)",
    likes: 3067,
    author: "GiftyOliver",
    age: "7 days ago",
    pgn: `[Event "London System Study"]
[White "Study"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "1750"]
[BlackElo "1700"]

1. d4 d5 2. Bf4 Nf6 3. e3 c5 4. c3 Nc6 5. Nd2 e6 6. Ngf3 Bd6 7. Bg3 O-O 8. Bd3 1-0`,
  },
  {
    id: "opening-guide",
    emoji: "🐢",
    title: "Italian Game: Classical Center Control",
    likes: 5012,
    author: "mohnish1234",
    age: "6 days ago",
    pgn: `[Event "Italian Game Study"]
[White "Study"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "1650"]
[BlackElo "1620"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4 exd4 6. cxd4 Bb4+ 7. Bd2 Bxd2+ 8. Nbxd2 d5 1-0`,
  },
  {
    id: "bishop-endgame",
    emoji: "🧙",
    title: "Bishop Endgames 101: Passed Pawn Break",
    likes: 186,
    author: "IM HSGM",
    age: "4 days ago",
    pgn: `[Event "Bishop Endgame"]
[White "Study"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "2100"]
[BlackElo "2050"]
[FEN "8/5pk1/3p2p1/2pP3p/1pP1KP2/1P2B1P1/8/3b4 w - - 0 1"]
[SetUp "1"]

1. Kd3 Bxb3 2. Bc1 Kf6 3. Bb2+ Kf5 1-0`,
  },
  {
    id: "queens-gambit",
    emoji: "🌀",
    title: "Queen's Gambit: Minority Attack Plan",
    likes: 231,
    author: "Gorensteyn",
    age: "7 days ago",
    pgn: `[Event "Minority Attack"]
[White "Study"]
[Black "Opponent"]
[Result "1-0"]
[WhiteElo "1850"]
[BlackElo "1800"]

1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5 5. Bg5 c6 6. e3 Be7 7. Bd3 Nbd7 8. Qc2 O-O 1-0`,
  },
];

const DRILLS = [
  {
    title: "Queen & King Checkmate",
    desc: "Force checkmate against the lone king using your queen.",
    fen: "6k1/8/6K1/8/8/8/3Q4/8 w - - 0 1",
  },
  {
    title: "Rook & King Box Method",
    desc: "Cut off the opponent king and deliver back-rank mate.",
    fen: "4k3/8/8/8/8/8/4K3/R7 w - - 0 1",
  },
  {
    title: "Scholar's Counter-Defense",
    desc: "Refute early queen aggression from Black's side.",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
  },
];

const BASICS_LESSONS = [
  {
    title: "Royal Fork (Knight Tactic)",
    prompt: "Find the knight fork attacking both the King and Queen.",
    fen: "r3k3/8/8/3N4/8/8/8/4K2q w - - 0 1",
    answerUci: "d5c7",
  },
  {
    title: "Back-Rank Mate",
    prompt: "Deliver checkmate along the 8th rank with your rook.",
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    answerUci: "a1a8",
  },
];

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

function randomCoord(): string {
  return `${FILES[Math.floor(Math.random() * 8)]}${RANKS[Math.floor(Math.random() * 8)]}`;
}

export const LearnView: React.FC<LearnViewProps> = ({
  boardTheme,
  boardFinish,
  showCoordinates,
  showLegalHints,
  onOpenInAnalysis,
}) => {
  const [subView, setSubView] = useState<LearnSubView>("menu");
  const [lessonIdx, setLessonIdx] = useState(0);
  const [lessonSolved, setLessonSolved] = useState(false);
  const [lessonStatus, setLessonStatus] = useState<string | null>(null);

  // Coordinate trainer state
  const [targetCoord, setTargetCoord] = useState<string>(randomCoord);
  const [coordScore, setCoordScore] = useState(0);
  const [coordAttempts, setCoordAttempts] = useState(0);
  const [coordFeedback, setCoordFeedback] = useState<"hit" | "miss" | null>(null);
  const [coordTimeLeft, setCoordTimeLeft] = useState(30);
  const [coordRunning, setCoordRunning] = useState(false);

  useEffect(() => {
    if (!coordRunning) return;
    if (coordTimeLeft <= 0) {
      setCoordRunning(false);
      return;
    }
    const t = setTimeout(() => setCoordTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [coordRunning, coordTimeLeft]);

  const currentLesson = BASICS_LESSONS[lessonIdx];
  const lessonChess = new Chess(currentLesson.fen);
  const lessonLegalMoves: MoveRecord[] = lessonChess
    .moves({ verbose: true })
    .map((m) => ({
      ply: 1,
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

  if (subView === "basics") {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-view-enter">
        <button
          type="button"
          onClick={() => setSubView("menu")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Learn</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <ChessBoard
              boardMatrix={lessonChess.board()}
              flipped={false}
              theme={boardTheme}
              finish={boardFinish}
              turn={lessonChess.turn()}
              isCheck={lessonChess.inCheck()}
              legalMoves={lessonSolved ? [] : lessonLegalMoves}
              lastMove={null}
              showCoordinates={showCoordinates}
              showLegalHints={showLegalHints}
              onPlayMove={(uci) => {
                if (uci === currentLesson.answerUci) {
                  soundEngine.play("game-over");
                  setLessonSolved(true);
                  setLessonStatus("Correct! Tactical pattern completed.");
                } else {
                  soundEngine.play("illegal");
                  setLessonStatus("Try another move to complete the pattern.");
                }
              }}
            />
          </div>

          <div className="lg:col-span-5 liquid-glass rounded-[28px] p-6 space-y-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5AC8FA]">
              Chess Basics · Lesson {lessonIdx + 1}/{BASICS_LESSONS.length}
            </div>
            <h2 className="text-xl font-bold text-white">{currentLesson.title}</h2>
            <p className="text-sm text-slate-300">{currentLesson.prompt}</p>
            {lessonStatus && (
              <div
                className={`p-3 rounded-2xl border text-xs font-medium ${
                  lessonSolved
                    ? "bg-emerald-500/15 border-emerald-400/35 text-emerald-200"
                    : "bg-amber-500/15 border-amber-400/35 text-amber-200"
                }`}
              >
                {lessonStatus}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setLessonIdx((i) => (i + 1) % BASICS_LESSONS.length);
                setLessonSolved(false);
                setLessonStatus(null);
              }}
              className="w-full py-3 rounded-2xl apple-blue-btn text-xs font-semibold text-white"
            >
              Next Lesson
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subView === "practice") {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-view-enter">
        <button
          type="button"
          onClick={() => setSubView("menu")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Learn</span>
        </button>

        <div className="liquid-glass rounded-[28px] p-6 space-y-4">
          <h2 className="text-xl font-bold text-white">Practice Drills</h2>
          <p className="text-xs text-slate-300">
            Launch any drill directly against the calibrated engine on the interactive board.
          </p>
          <div className="divide-y divide-white/10">
            {DRILLS.map((drill) => (
              <button
                key={drill.title}
                type="button"
                onClick={() => onOpenInAnalysis(drill.fen, true)}
                className="w-full py-4 px-2 flex items-center justify-between gap-4 text-left hover:bg-white/[0.05] rounded-xl transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-white">{drill.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{drill.desc}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subView === "coordinates") {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-view-enter">
        <button
          type="button"
          onClick={() => setSubView("menu")}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Learn</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7">
            <div className="liquid-glass p-3 rounded-[28px] max-w-[540px] mx-auto">
              <div className="relative aspect-square w-full rounded-[18px] overflow-hidden grid grid-cols-8 grid-rows-8">
                {RANKS.map((rank, r) =>
                  FILES.map((file, c) => {
                    const sq = `${file}${rank}`;
                    const isLight = (r + c) % 2 === 0;
                    return (
                      <button
                        key={sq}
                        type="button"
                        onClick={() => {
                          if (!coordRunning) {
                            setCoordRunning(true);
                            setCoordTimeLeft(30);
                            setCoordScore(0);
                            setCoordAttempts(0);
                          }
                          setCoordAttempts((a) => a + 1);
                          if (sq === targetCoord) {
                            soundEngine.play("move");
                            setCoordScore((s) => s + 1);
                            setCoordFeedback("hit");
                            setTargetCoord(randomCoord());
                          } else {
                            soundEngine.play("illegal");
                            setCoordFeedback("miss");
                          }
                          setTimeout(() => setCoordFeedback(null), 220);
                        }}
                        style={{
                          backgroundColor: isLight ? "#F0D9B5" : "#8A5838",
                        }}
                        className="relative flex items-center justify-center hover:brightness-110 transition-all"
                        aria-label={`Square ${sq}`}
                      />
                    );
                  })
                )}

                {coordRunning && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className={`px-6 py-3 rounded-2xl liquid-glass text-3xl font-mono font-bold tracking-wider transition-transform ${
                        coordFeedback === "hit"
                          ? "scale-110 text-emerald-300"
                          : coordFeedback === "miss"
                          ? "scale-95 text-rose-300"
                          : "text-white"
                      }`}
                    >
                      {targetCoord}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 liquid-glass rounded-[28px] p-6 space-y-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#5AC8FA]">
                Coordinate Training
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {coordRunning ? `Tap ${targetCoord}` : "30s Speed Drill"}
              </h2>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/10">
                <div className="text-[11px] text-slate-400">Time</div>
                <div className="font-mono text-lg font-bold text-white tabular-nums">
                  {coordTimeLeft}s
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/10">
                <div className="text-[11px] text-slate-400">Score</div>
                <div className="font-mono text-lg font-bold text-emerald-300 tabular-nums">
                  {coordScore}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/[0.06] border border-white/10">
                <div className="text-[11px] text-slate-400">Accuracy</div>
                <div className="font-mono text-lg font-bold text-white tabular-nums">
                  {coordAttempts > 0
                    ? `${Math.round((coordScore / coordAttempts) * 100)}%`
                    : "—"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCoordScore(0);
                setCoordAttempts(0);
                setCoordTimeLeft(30);
                setTargetCoord(randomCoord());
                setCoordRunning(true);
              }}
              className="w-full py-3 rounded-2xl apple-blue-btn text-xs font-semibold text-white"
            >
              {coordRunning ? "Restart 30s Drill" : "Start Coordinate Drill"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-view-enter">
      <div className="flex items-center gap-2 px-1">
        <GraduationCap className="w-5 h-5 text-[#5AC8FA]" />
        <h1 className="text-lg font-bold text-white tracking-tight">Learn</h1>
      </div>

      {/* Top Grouped Card */}
      <section className="liquid-glass rounded-2xl divide-y divide-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => setSubView("basics")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <span className="text-[13px] font-medium text-white">Chess basics</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => setSubView("practice")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Dumbbell className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <span className="text-[13px] font-medium text-white">Practice</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => setSubView("coordinates")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <span className="text-[13px] font-medium text-white">
              Coordinate training
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </section>

      {/* Study Section */}
      <section className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-bold text-white">Study</h2>
          <a
            href="https://lichess.org/study"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-semibold text-[#5AC8FA] hover:text-white inline-flex items-center gap-0.5"
          >
            <span>More</span>
            <ChevronRight className="w-3 h-3" />
          </a>
        </div>

        <div className="liquid-glass rounded-2xl divide-y divide-white/10 overflow-hidden">
          {STUDIES.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => onOpenInAnalysis(st.pgn, false)}
              className="w-full px-3.5 py-2.5 flex items-center gap-3 hover:bg-white/[0.06] transition-colors text-left"
            >
              <span
                className="w-7 h-7 rounded-xl bg-white/[0.08] border border-white/12 flex items-center justify-center text-sm shrink-0"
                aria-hidden="true"
              >
                {st.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-white truncate">
                  {st.title}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                  ♥ {st.likes} · {st.author} · {st.age}
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
