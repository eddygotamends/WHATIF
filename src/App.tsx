import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Flag,
  FlipVertical2,
  GraduationCap,
  Home,
  Menu,
  Play,
  Puzzle,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Tv,
  Volume2,
  VolumeX,
} from "lucide-react";
import { soundEngine } from "./audio/sound-engine";
import { ChessBoard, type BoardThemeId } from "./components/ChessBoard";
import type { BoardFinish, PieceType } from "./components/ChessPieceSvg";
import { FairPlayModal } from "./components/FairPlayModal";
import { ImportModal } from "./components/ImportModal";
import {
  InspectorDrawer,
  type InspectorTab,
} from "./components/InspectorDrawer";
import { LearnView } from "./components/LearnView";
import { LichessConnectModal } from "./components/LichessConnectModal";
import { MaterialStrip } from "./components/MaterialStrip";
import { MoreView } from "./components/MoreView";
import {
  PlaySheetModal,
  type LobbySeekConfig,
} from "./components/PlaySheetModal";
import { PuzzlesView } from "./components/PuzzlesView";
import { WatchView } from "./components/WatchView";
import {
  FairPlayError,
  PracticeEngine,
  StockfishUciEngine,
  WhatIfCore,
  type ColorSide,
  type ContinueResult,
  type MoveRecord,
  type SessionState,
} from "./index";
import { BrowserWorkerTransport } from "./browser";
import { SAMPLE_GAMES } from "./data/sample-games";
import {
  clearSavedStockfishBundle,
  createWorkerFromBundle,
  loadSavedStockfishBundle,
  saveStockfishBundle,
  type StoredStockfishBundle,
} from "./engine/stockfish-importer";
import {
  abortLichessBoardGame,
  challengeLichessAi,
  challengeLichessUser,
  createLichessSeek,
  fetchLichessAccount,
  fetchLichessChallenges,
  fetchLichessRecentGames,
  fetchPublicLichessUser,
  getSavedLichessToken,
  getSavedLichessUsername,
  loginWithLichessOAuth,
  resignLichessBoardGame,
  saveLichessToken,
  saveLichessUsername,
  sendLichessBoardMove,
  streamLichessAccountEvents,
  streamLichessBoardGame,
  type LichessLiveGameInfo,
  type LichessProfile,
  type LichessRecentGame,
} from "./services/lichess-client";

type DockTab = "home" | "puzzles" | "learn" | "watch" | "more";
type ArenaMode = "whatif" | "live-lichess" | "otb" | null;

const PREFS_KEY = "whatif-studio-prefs-v2";
const PIECE_WEIGHT: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

interface StoredPrefs {
  boardTheme: BoardThemeId;
  boardFinish: BoardFinish;
  showCoordinates: boolean;
  showLegalHints: boolean;
  autoFlip: boolean;
  muted: boolean;
  autoReply: boolean;
}

function readPrefs(): StoredPrefs {
  const fallback: StoredPrefs = {
    boardTheme: "natural-walnut",
    boardFinish: "gloss",
    showCoordinates: true,
    showLegalHints: true,
    autoFlip: true,
    muted: false,
    autoReply: true,
  };
  try {
    const raw =
      localStorage.getItem(PREFS_KEY) ||
      localStorage.getItem("whatif-studio-prefs-v1");
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredPrefs>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

function savePrefs(prefs: StoredPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

function playMoveSound(move: MoveRecord, inCheck: boolean, isGameOver: boolean): void {
  if (isGameOver) {
    soundEngine.play("game-over");
  } else if (inCheck) {
    soundEngine.play("check");
  } else if (move.promotion) {
    soundEngine.play("promote");
  } else if (move.flags.includes("k") || move.flags.includes("q")) {
    soundEngine.play("castle");
  } else if (move.captured) {
    soundEngine.play("capture");
  } else {
    soundEngine.play("move");
  }
}

function formatTimeAgo(timestampMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 60) return "just now";
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function App() {
  const coreRef = useRef<WhatIfCore | null>(null);
  if (!coreRef.current) {
    const core = new WhatIfCore({ engine: new PracticeEngine() });
    const defaultGame = SAMPLE_GAMES[0];
    core.loadPgn(defaultGame.pgn, { ply: defaultGame.recommendedPly });
    coreRef.current = core;
  }
  const core = coreRef.current;

  const initialPrefs = useMemo(readPrefs, []);
  const [prefs, setPrefs] = useState<StoredPrefs>(initialPrefs);
  const [state, setState] = useState<SessionState>(() => core.getState());
  const [dockTab, setDockTab] = useState<DockTab>("home");
  const [arenaMode, setArenaMode] = useState<ArenaMode>(null);

  const [flipped, setFlipped] = useState<boolean>(
    () => core.getState().metadata.playerSide === "black"
  );
  const [allowUnfinishedGame, setAllowUnfinishedGame] = useState<boolean>(false);
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("moves");

  // Modals
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [playSheetOpen, setPlaySheetOpen] = useState<boolean>(false);
  const [lichessModalOpen, setLichessModalOpen] = useState<boolean>(false);
  const [infoModal, setInfoModal] = useState<"fair-play" | "shortcuts" | null>(null);

  // Engine & Stockfish Importer state
  const [engineMode, setEngineMode] = useState<"practice" | "stockfish">("practice");
  const [savedStockfish, setSavedStockfish] = useState<StoredStockfishBundle | null>(null);
  const [stockfishError, setStockfishError] = useState<string | null>(null);
  const workerCleanupRef = useRef<(() => void) | null>(null);
  const [lastReplyInfo, setLastReplyInfo] = useState<ContinueResult | null>(null);
  const [fairPlayAlert, setFairPlayAlert] = useState<string | null>(null);

  // Lichess Account & Online Play state
  const [lichessToken, setLichessToken] = useState<string | null>(getSavedLichessToken);
  const [lichessProfile, setLichessProfile] = useState<LichessProfile | null>(null);
  const [recentGames, setRecentGames] = useState<LichessRecentGame[]>([]);
  const [inboxCount, setInboxCount] = useState<number>(0);
  const [loadingGames, setLoadingGames] = useState<boolean>(false);
  const [quickUsername, setQuickUsername] = useState<string>("");
  const [quickSyncError, setQuickSyncError] = useState<string | null>(null);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [seekError, setSeekError] = useState<string | null>(null);
  const seekAbortRef = useRef<AbortController | null>(null);
  const [liveGame, setLiveGame] = useState<LichessLiveGameInfo | null>(null);

  const updatePref = <K extends keyof StoredPrefs>(key: K, value: StoredPrefs[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      savePrefs(next);
      return next;
    });
  };

  useEffect(() => {
    soundEngine.setMuted(prefs.muted);
  }, [prefs.muted]);

  useEffect(() => {
    if (!core.hasEngine()) {
      core.setEngine(new PracticeEngine());
    }
    const unsub = core.subscribe((next) => setState(next));
    return () => {
      unsub();
      core.stopEngine();
    };
  }, [core]);

  const attachWorkerBundle = useCallback(
    async (bundle: StoredStockfishBundle) => {
      setStockfishError(null);
      workerCleanupRef.current?.();
      const handle = createWorkerFromBundle(bundle);
      workerCleanupRef.current = handle.revokeUrls;

      const stockfish = new StockfishUciEngine(
        new BrowserWorkerTransport(handle.worker)
      );
      core.setEngine(stockfish);
      try {
        await core.initialize();
        setEngineMode("stockfish");
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to initialize Stockfish worker.";
        setStockfishError(msg);
        core.setEngine(new PracticeEngine());
        setEngineMode("practice");
        throw err;
      }
    },
    [core]
  );

  // Restore saved Stockfish bundle from IndexedDB on mount
  useEffect(() => {
    void loadSavedStockfishBundle()
      .then((bundle) => {
        if (bundle) {
          setSavedStockfish(bundle);
          return attachWorkerBundle(bundle).catch(() => {
            // Keep practice engine active if saved worker fails
          });
        }
        return undefined;
      })
      .catch(() => {});
  }, [attachWorkerBundle]);

  const syncLichessGames = useCallback(
    async (username: string, token?: string | null) => {
      setLoadingGames(true);
      try {
        const list = await fetchLichessRecentGames(username, 12, token);
        setRecentGames(list);
      } catch {
        // Ignore transient network errors
      } finally {
        setLoadingGames(false);
      }
    },
    []
  );

  const syncInboxCount = useCallback(async (token: string | null) => {
    if (!token) {
      setInboxCount(0);
      return;
    }
    try {
      const res = await fetchLichessChallenges(token);
      setInboxCount(res.in.length);
    } catch {
      // ignore transient errors
    }
  }, []);

  // Restore Lichess session on mount
  useEffect(() => {
    const token = getSavedLichessToken();
    const savedUser = getSavedLichessUsername();
    if (token) {
      void fetchLichessAccount(token)
        .then((prof) => {
          setLichessProfile(prof);
          saveLichessUsername(prof.username);
          core.setKnownPlayerNames([prof.username]);
          void syncInboxCount(token);
          return syncLichessGames(prof.username, token);
        })
        .catch(() => {
          saveLichessToken(null);
          setLichessToken(null);
        });
    } else if (savedUser) {
      void fetchPublicLichessUser(savedUser)
        .then((prof) => {
          setLichessProfile(prof);
          core.setKnownPlayerNames([prof.username]);
          return syncLichessGames(prof.username, null);
        })
        .catch(() => {});
    }
  }, [core, syncInboxCount, syncLichessGames]);

  // Listen for Lichess account events (gameStart & challenges) when connected with token
  useEffect(() => {
    if (!lichessToken) return;
    const ac = new AbortController();

    void streamLichessAccountEvents(
      lichessToken,
      (ev) => {
        if (ev.type === "challenge" || ev.type === "challengeCanceled" || ev.type === "challengeDeclined") {
          void syncInboxCount(lichessToken);
        }
        if (ev.type === "gameStart") {
          const gameObj = ev.game as
            | {
                gameId?: string;
                id?: string;
                color?: "white" | "black";
                opponent?: { username?: string; rating?: number };
                speed?: string;
                rated?: boolean;
              }
            | undefined;
          const gameId = gameObj?.gameId || gameObj?.id;
          if (!gameId) return;

          setIsSeeking(false);
          seekAbortRef.current?.abort();
          setPlaySheetOpen(false);
          setArenaMode("live-lichess");
          setFlipped(gameObj?.color === "black");
          setLiveGame({
            gameId,
            myColor: gameObj?.color || "white",
            opponentName: gameObj?.opponent?.username || "Lichess Opponent",
            opponentRating: gameObj?.opponent?.rating ?? null,
            speed: gameObj?.speed || "rapid",
            rated: Boolean(gameObj?.rated),
            initialFen: "startpos",
            moves: "",
            wtime: 600000,
            btime: 600000,
            status: "started",
          });
        }
      },
      ac.signal
    ).catch(() => {});

    return () => ac.abort();
  }, [lichessToken, syncInboxCount]);

  // Stream active Lichess Board game moves
  const activeLiveGameId = arenaMode === "live-lichess" ? liveGame?.gameId ?? null : null;
  useEffect(() => {
    if (!lichessToken || !activeLiveGameId) return;
    const ac = new AbortController();

    void streamLichessBoardGame(
      lichessToken,
      activeLiveGameId,
      (ev) => {
        if (ev.type === "gameFull") {
          const white = ev.white as { name?: string; id?: string; rating?: number } | undefined;
          const black = ev.black as { name?: string; id?: string; rating?: number } | undefined;
          const myUsername = lichessProfile?.username.toLowerCase();
          const myColor: "white" | "black" =
            black?.id?.toLowerCase() === myUsername ||
            black?.name?.toLowerCase() === myUsername
              ? "black"
              : "white";
          const opp = myColor === "white" ? black : white;
          const stateObj = ev.state as
            | { moves?: string; wtime?: number; btime?: number; status?: string; winner?: "white" | "black" }
            | undefined;
          const initialFen = (ev.initialFen as string) || "startpos";

          setFlipped(myColor === "black");
          setLiveGame((prev) => ({
            gameId: activeLiveGameId,
            myColor,
            opponentName: opp?.name || prev?.opponentName || "Opponent",
            opponentRating: opp?.rating ?? prev?.opponentRating ?? null,
            speed: (ev.speed as string) || prev?.speed || "rapid",
            rated: Boolean(ev.rated),
            initialFen,
            moves: stateObj?.moves || "",
            wtime: stateObj?.wtime ?? 600000,
            btime: stateObj?.btime ?? 600000,
            status: stateObj?.status || "started",
            winner: stateObj?.winner,
          }));
        } else if (ev.type === "gameState") {
          setLiveGame((prev) =>
            prev
              ? {
                  ...prev,
                  moves: (ev.moves as string) ?? prev.moves,
                  wtime: (ev.wtime as number) ?? prev.wtime,
                  btime: (ev.btime as number) ?? prev.btime,
                  status: (ev.status as string) ?? prev.status,
                  winner: (ev.winner as "white" | "black" | undefined) ?? prev.winner,
                }
              : null
          );
          soundEngine.play("move");
        }
      },
      ac.signal
    ).catch(() => {});

    return () => ac.abort();
  }, [activeLiveGameId, lichessProfile?.username, lichessToken]);

  const handleImportStockfishFiles = useCallback(
    async (jsFile: File, wasmFile?: File | null) => {
      const jsBuffer = await jsFile.arrayBuffer();
      const wasmBuffer = wasmFile ? await wasmFile.arrayBuffer() : undefined;
      const bundle: StoredStockfishBundle = {
        jsName: jsFile.name,
        jsBuffer,
        wasmName: wasmFile?.name,
        wasmBuffer,
        savedAt: Date.now(),
      };
      await attachWorkerBundle(bundle);
      await saveStockfishBundle(bundle);
      setSavedStockfish(bundle);
    },
    [attachWorkerBundle]
  );

  const handleUsePracticeEngine = useCallback(() => {
    setStockfishError(null);
    setFairPlayAlert(null);
    workerCleanupRef.current?.();
    workerCleanupRef.current = null;
    core.setEngine(new PracticeEngine());
    setEngineMode("practice");
  }, [core]);

  const handleClearStockfish = useCallback(async () => {
    await clearSavedStockfishBundle();
    setSavedStockfish(null);
    handleUsePracticeEngine();
  }, [handleUsePracticeEngine]);

  const triggerOpponentContinue = useCallback(async () => {
    setFairPlayAlert(null);
    try {
      const result = await core.continueAsOpponent({
        depth: 12,
        moveTimeMs: 650,
        allowUnfinishedGame,
      });
      setLastReplyInfo(result);
      if (result.move) {
        const after = core.getState();
        playMoveSound(result.move, after.status.isCheck, after.status.isGameOver);
      }
    } catch (err) {
      if (err instanceof FairPlayError) {
        setFairPlayAlert(err.message);
        if (err.code === "MISSING_ELO" || err.code === "NOT_OPPONENT_TURN") {
          setActiveInspectorTab("engine");
        }
      } else if (err instanceof Error) {
        setFairPlayAlert(err.message);
      }
    }
  }, [allowUnfinishedGame, core]);

  const handleWhatIfMove = useCallback(
    (uci: string) => {
      setFairPlayAlert(null);
      try {
        const played = core.playMove(uci);
        const after = core.getState();
        playMoveSound(played, after.status.isCheck, after.status.isGameOver);

        if (arenaMode === "otb") return;

        const opponentTurnChar =
          after.metadata.opponentSide === "white"
            ? "w"
            : after.metadata.opponentSide === "black"
            ? "b"
            : null;

        const canAutoReply =
          prefs.autoReply &&
          !after.status.isGameOver &&
          opponentTurnChar !== null &&
          after.status.turn === opponentTurnChar &&
          after.metadata.opponentElo !== null &&
          (after.metadata.isFinished || allowUnfinishedGame);

        if (canAutoReply) {
          void triggerOpponentContinue();
        }
      } catch {
        soundEngine.play("illegal");
      }
    },
    [allowUnfinishedGame, arenaMode, core, prefs.autoReply, triggerOpponentContinue]
  );

  const handleLoadPgnIntoArena = useCallback(
    (pgn: string, ply?: number) => {
      setFairPlayAlert(null);
      setLastReplyInfo(null);
      core.loadPgn(pgn, { ply });
      const loaded = core.getState();
      if (prefs.autoFlip && loaded.metadata.playerSide) {
        setFlipped(loaded.metadata.playerSide === "black");
      }
      setArenaMode("whatif");
    },
    [core, prefs.autoFlip]
  );

  const handleLoadFenIntoArena = useCallback(
    (fen: string) => {
      setFairPlayAlert(null);
      setLastReplyInfo(null);
      core.loadFen(fen);
      setAllowUnfinishedGame(true);
      setArenaMode("whatif");
    },
    [core]
  );

  const handlePlayLocalBot = useCallback(
    (elo: number) => {
      setFairPlayAlert(null);
      setLastReplyInfo(null);
      core.loadFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
      core.setPlayerSide("white");
      core.setOpponentElo(elo);
      setAllowUnfinishedGame(true);
      setFlipped(false);
      setArenaMode("whatif");
    },
    [core]
  );

  const handlePlayOtb = useCallback(() => {
    setFairPlayAlert(null);
    core.loadFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    setFlipped(false);
    setArenaMode("otb");
  }, [core]);

  const handleCreateLichessLobby = useCallback(
    (config: LobbySeekConfig) => {
      if (!lichessToken) return;
      setSeekError(null);
      setIsSeeking(true);
      const ac = new AbortController();
      seekAbortRef.current = ac;

      void createLichessSeek(
        lichessToken,
        {
          timeMinutes: config.timeMinutes,
          incrementSeconds: config.incrementSeconds,
          rated: config.rated,
          ratingRange: config.ratingRange || undefined,
        },
        ac.signal
      )
        .catch((err) => {
          if (!ac.signal.aborted) {
            setSeekError(err instanceof Error ? err.message : "Seek ended.");
            setIsSeeking(false);
          }
        })
        .finally(() => {
          if (!ac.signal.aborted) setIsSeeking(false);
        });
    },
    [lichessToken]
  );

  const handleChallengeFriend = useCallback(
    async (username: string, config: LobbySeekConfig) => {
      if (!lichessToken) return;
      await challengeLichessUser(lichessToken, username, {
        timeMinutes: config.timeMinutes,
        incrementSeconds: config.incrementSeconds,
        rated: config.rated,
      });
    },
    [lichessToken]
  );

  const handleChallengeLichessAi = useCallback(
    async (level: number, config: LobbySeekConfig) => {
      if (!lichessToken) return;
      const gameId = await challengeLichessAi(lichessToken, {
        level,
        timeMinutes: config.timeMinutes,
        incrementSeconds: config.incrementSeconds,
      });
      if (gameId) {
        setArenaMode("live-lichess");
        setLiveGame({
          gameId,
          myColor: "white",
          opponentName: `Stockfish Level ${level}`,
          opponentRating: null,
          speed: "rapid",
          rated: false,
          initialFen: "startpos",
          moves: "",
          wtime: config.timeMinutes * 60000,
          btime: config.timeMinutes * 60000,
          status: "started",
        });
      }
    },
    [lichessToken]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (arenaMode === "whatif" || arenaMode === "otb") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          core.undo();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          core.redo();
        } else if (e.key === "Home") {
          e.preventDefault();
          core.restart();
        } else if (e.key === "End") {
          e.preventDefault();
          core.jumpToPly(core.getState().totalPlies);
        }
      }

      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFlipped((v) => !v);
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        updatePref("muted", !prefs.muted);
      } else if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        setImportOpen((v) => !v);
      } else if (e.key === "Escape") {
        setImportOpen(false);
        setPlaySheetOpen(false);
        setLichessModalOpen(false);
        setInfoModal(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [arenaMode, core, prefs.muted]);

  // Derived board matrix for WHATIF/OTB vs Live Lichess
  const liveBoardState = useMemo(() => {
    if (!liveGame) return null;
    const chess =
      liveGame.initialFen && liveGame.initialFen !== "startpos"
        ? new Chess(liveGame.initialFen)
        : new Chess();
    let last: MoveRecord | null = null;
    const moveList = liveGame.moves.trim() ? liveGame.moves.trim().split(/\s+/) : [];
    for (let i = 0; i < moveList.length; i++) {
      const uci = moveList[i];
      try {
        const exec = chess.move({
          from: uci.slice(0, 2),
          to: uci.slice(2, 4),
          promotion: uci.length > 4 ? uci[4] : undefined,
        });
        last = {
          ply: i + 1,
          san: exec.san,
          uci,
          from: exec.from,
          to: exec.to,
          promotion: exec.promotion,
          color: exec.color,
          fen: chess.fen(),
          captured: exec.captured,
          flags: exec.flags,
        };
      } catch {
        break;
      }
    }

    const legalMoves: MoveRecord[] = chess.moves({ verbose: true }).map((m) => ({
      ply: moveList.length + 1,
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
      boardMatrix: chess.board(),
      turn: chess.turn(),
      isCheck: chess.inCheck(),
      isGameOver:
        chess.isGameOver() ||
        (liveGame.status !== "started" && liveGame.status !== "created"),
      legalMoves,
      lastMove: last,
      pgn: chess.pgn(),
    };
  }, [liveGame]);

  const boardMatrix = useMemo(() => {
    void state.fen;
    return core.getBoardMatrix();
  }, [core, state.fen]);

  const materialStats = useMemo(() => {
    const startCounts: Record<"w" | "b", Record<PieceType, number>> = {
      w: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
      b: { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 },
    };
    const currentCounts: Record<"w" | "b", Record<PieceType, number>> = {
      w: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
      b: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 },
    };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = boardMatrix[r]?.[c];
        if (sq) {
          currentCounts[sq.color][sq.type]++;
        }
      }
    }

    const order: PieceType[] = ["q", "r", "b", "n", "p"];
    const whiteCaptured: PieceType[] = [];
    const blackCaptured: PieceType[] = [];
    let whiteScore = 0;
    let blackScore = 0;

    for (const t of order) {
      whiteScore += currentCounts.w[t] * PIECE_WEIGHT[t];
      blackScore += currentCounts.b[t] * PIECE_WEIGHT[t];

      const missingBlack = Math.max(0, startCounts.b[t] - currentCounts.b[t]);
      for (let i = 0; i < missingBlack; i++) whiteCaptured.push(t);

      const missingWhite = Math.max(0, startCounts.w[t] - currentCounts.w[t]);
      for (let i = 0; i < missingWhite; i++) blackCaptured.push(t);
    }

    return {
      whiteCaptured,
      blackCaptured,
      whiteLead: Math.max(0, whiteScore - blackScore),
      blackLead: Math.max(0, blackScore - whiteScore),
    };
  }, [boardMatrix]);

  const lastMove =
    state.history.length > 0 ? state.history[state.history.length - 1] : null;

  const topSide: ColorSide = flipped ? "white" : "black";
  const bottomSide: ColorSide = flipped ? "black" : "white";

  const describeSide = (side: ColorSide) => {
    const isPlayer = state.metadata.playerSide === side;
    const isOpponent = state.metadata.opponentSide === side;
    const headerName =
      side === "white"
        ? state.metadata.headers.White || "White"
        : state.metadata.headers.Black || "Black";
    const elo = isOpponent
      ? state.metadata.opponentElo
      : side === "white"
      ? state.metadata.whiteElo
      : state.metadata.blackElo;

    const roleLabel =
      arenaMode === "otb"
        ? "Over the board"
        : isPlayer
        ? "Your side"
        : isOpponent
        ? `Opponent (${engineMode === "stockfish" ? "Stockfish" : "Practice Bot"})`
        : "Select side in Calibration";

    const isTurn =
      !state.status.isGameOver &&
      state.status.turn === (side === "white" ? "w" : "b");

    return {
      side,
      label: headerName,
      elo,
      roleLabel,
      isTurn,
      isThinking: isOpponent && state.isThinking,
      capturedPieces:
        side === "white"
          ? materialStats.whiteCaptured
          : materialStats.blackCaptured,
      materialAdvantage:
        side === "white" ? materialStats.whiteLead : materialStats.blackLead,
      finish: prefs.boardFinish,
    };
  };

  const topStrip = describeSide(topSide);
  const bottomStrip = describeSide(bottomSide);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [arenaMode, dockTab]);

  const isOpponentTurn =
    arenaMode === "whatif" &&
    !state.status.isGameOver &&
    state.metadata.opponentSide !== null &&
    state.status.turn === (state.metadata.opponentSide === "white" ? "w" : "b");

  const exportedPgn = useMemo(() => {
    void state.fen;
    void state.history.length;
    return core.exportPgn();
  }, [core, state.fen, state.history.length]);

  const ratingCards = useMemo(() => {
    if (!lichessProfile) return [];
    const list: Array<{ name: string; rating: number; prog: number }> = [];
    const { perfs } = lichessProfile;
    if (perfs.rapid) list.push({ name: "Rapid", rating: perfs.rapid.rating, prog: perfs.rapid.prog });
    if (perfs.blitz) list.push({ name: "Blitz", rating: perfs.blitz.rating, prog: perfs.blitz.prog });
    if (perfs.bullet) list.push({ name: "Bullet", rating: perfs.bullet.rating, prog: perfs.bullet.prog });
    if (perfs.puzzle) list.push({ name: "Puzzles", rating: perfs.puzzle.rating, prog: perfs.puzzle.prog });
    return list;
  }, [lichessProfile]);

  const headerTitle = "WHATIF";

  const handleQuickSyncHomeUser = async () => {
    const trimmed = quickUsername.trim();
    if (!trimmed) return;
    setQuickSyncError(null);
    setLoadingGames(true);
    try {
      const prof = await fetchPublicLichessUser(trimmed);
      saveLichessUsername(prof.username);
      setLichessProfile(prof);
      core.setKnownPlayerNames([prof.username]);
      await syncLichessGames(prof.username, null);
      setQuickUsername("");
    } catch (err) {
      setQuickSyncError(
        err instanceof Error ? err.message : `Could not sync "${trimmed}".`
      );
      setLoadingGames(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full max-w-full flex flex-col bg-[#05070B] text-slate-100 overflow-x-clip">
      {/* Apple Studio Vibrant Rainbow Aurora Mesh Backdrop */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden z-0"
        aria-hidden="true"
      >
        <div
          className="absolute -top-28 -left-24 w-[480px] h-[440px] rounded-full opacity-75 blur-[110px] animate-aurora-a"
          style={{
            background:
              "radial-gradient(circle, rgba(217,70,239,0.78) 0%, rgba(168,85,247,0.52) 48%, transparent 76%)",
          }}
        />
        <div
          className="absolute -top-16 right-[-80px] w-[520px] h-[480px] rounded-full opacity-75 blur-[115px] animate-aurora-b"
          style={{
            background:
              "radial-gradient(circle, rgba(163,230,53,0.62) 0%, rgba(16,185,129,0.68) 48%, transparent 76%)",
          }}
        />
        <div
          className="absolute top-[22%] -left-28 w-[520px] h-[520px] rounded-full opacity-75 blur-[120px] animate-aurora-b"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.78) 0%, rgba(6,182,212,0.55) 50%, transparent 78%)",
          }}
        />
        <div
          className="absolute top-[28%] right-[-100px] w-[540px] h-[540px] rounded-full opacity-70 blur-[125px] animate-aurora-a"
          style={{
            background:
              "radial-gradient(circle, rgba(109,40,217,0.72) 0%, rgba(59,130,246,0.56) 52%, transparent 78%)",
          }}
        />
        <div
          className="absolute -bottom-28 -left-16 w-[520px] h-[460px] rounded-full opacity-80 blur-[115px] animate-aurora-a"
          style={{
            background:
              "radial-gradient(circle, rgba(236,72,153,0.82) 0%, rgba(244,63,94,0.58) 50%, transparent 78%)",
          }}
        />
        <div
          className="absolute -bottom-28 right-[-80px] w-[520px] h-[460px] rounded-full opacity-75 blur-[120px] animate-aurora-b"
          style={{
            background:
              "radial-gradient(circle, rgba(168,85,247,0.78) 0%, rgba(16,185,129,0.45) 54%, transparent 78%)",
          }}
        />
      </div>

      {/* Minimalist Frosted Liquid Glass Top Header */}
      <header className="sticky top-0 z-30 w-full max-w-full border-b border-white/14 bg-black/35 backdrop-blur-2xl pt-[env(safe-area-inset-top)]">
        <div className="w-full max-w-[1160px] mx-auto px-3 sm:px-5 h-12 flex items-center justify-between gap-2 box-border">
          <button
            type="button"
            onClick={() => {
              setArenaMode(null);
              setDockTab("home");
            }}
            className="flex items-center gap-2 text-left min-w-0 focus:outline-none group"
          >
            <span className="w-7 h-7 rounded-lg overflow-hidden bg-[#0D0E12] shadow-md shrink-0 inline-flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
              <img
                src="/WL.png"
                alt="WHATIF Logo"
                className="w-full h-full object-contain scale-[1.05]"
              />
            </span>
            <span className="text-sm font-bold tracking-tight text-white truncate">
              {headerTitle}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLichessModalOpen(true)}
            aria-label="Lichess Account"
            className="relative flex items-center gap-1.5 rounded-full transition-all shrink-0 active:scale-95"
          >
            {lichessProfile ? (
              <>
                <span className="w-7 h-7 rounded-full bg-[#0A84FF] border border-white/25 flex items-center justify-center text-xs font-bold text-white shadow-md">
                  {lichessProfile.username.slice(0, 1).toUpperCase()}
                </span>
                {inboxCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-rose-500 border border-[#06080D] text-[9px] font-bold text-white flex items-center justify-center tabular-nums">
                    {inboxCount}
                  </span>
                )}
              </>
            ) : (
              <span className="px-3 py-1 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white whitespace-nowrap">
                Sign in
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-[1160px] w-full mx-auto px-3 sm:px-5 pt-4 pb-24">
        {/* ACTIVE CHESSBOARD ARENA (WHATIF / LIVE LICHESS / OTB) */}
        {arenaMode !== null && (
          <div className="space-y-3 animate-view-enter">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setArenaMode(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl liquid-glass-subtle hover:bg-white/15 text-[11px] font-semibold text-white transition-all"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to {dockTab}</span>
              </button>

              <span className="text-[11px] font-mono text-slate-300">
                {arenaMode === "live-lichess"
                  ? `Live Lichess · ${liveGame?.speed ?? "rapid"}`
                  : arenaMode === "otb"
                  ? "Over the board"
                  : `WHATIF · ${state.engineName || "Practice Engine"}`}
              </span>
            </div>

            {arenaMode === "live-lichess" && liveGame && liveBoardState ? (
              <div className="max-w-2xl mx-auto space-y-2.5">
                {/* Top Opponent Clock Bar */}
                <div className="liquid-glass rounded-xl px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {liveGame.opponentName}
                    </div>
                    {liveGame.opponentRating && (
                      <div className="font-mono text-[11px] text-slate-300 tabular-nums">
                        {liveGame.opponentRating} Elo
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-base font-bold text-white tabular-nums">
                    {formatClock(
                      liveGame.myColor === "white" ? liveGame.btime : liveGame.wtime
                    )}
                  </div>
                </div>

                <ChessBoard
                  boardMatrix={liveBoardState.boardMatrix}
                  flipped={flipped}
                  theme={prefs.boardTheme}
                  finish={prefs.boardFinish}
                  turn={liveBoardState.turn}
                  isCheck={liveBoardState.isCheck}
                  legalMoves={
                    liveBoardState.turn === (liveGame.myColor === "white" ? "w" : "b") &&
                    !liveBoardState.isGameOver
                      ? liveBoardState.legalMoves
                      : []
                  }
                  lastMove={liveBoardState.lastMove}
                  disabled={liveBoardState.isGameOver}
                  showCoordinates={prefs.showCoordinates}
                  showLegalHints={prefs.showLegalHints}
                  onPlayMove={(uci) => {
                    if (!lichessToken) return;
                    soundEngine.play("move");
                    void sendLichessBoardMove(lichessToken, liveGame.gameId, uci).catch(
                      () => soundEngine.play("illegal")
                    );
                  }}
                />

                {/* Bottom Player Clock Bar */}
                <div className="liquid-glass rounded-xl px-3 py-2 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {lichessProfile?.username || "You"} ({liveGame.myColor})
                    </div>
                    <div className="text-[11px] text-[#5AC8FA]">
                      {liveBoardState.isGameOver
                        ? `Game finished (${liveGame.status})`
                        : liveBoardState.turn === (liveGame.myColor === "white" ? "w" : "b")
                        ? "Your turn"
                        : "Opponent's turn"}
                    </div>
                  </div>
                  <div className="font-mono text-base font-bold text-white tabular-nums">
                    {formatClock(
                      liveGame.myColor === "white" ? liveGame.wtime : liveGame.btime
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setFlipped((f) => !f)}
                    className="px-3 py-1.5 rounded-xl liquid-glass-subtle hover:bg-white/15 text-[11px] font-semibold text-white inline-flex items-center gap-1.5 transition-all"
                  >
                    <FlipVertical2 className="w-3.5 h-3.5" />
                    <span>Flip</span>
                  </button>

                  {!liveBoardState.isGameOver ? (
                    <div className="flex items-center gap-2">
                      {liveGame.moves.trim().split(/\s+/).filter(Boolean).length < 2 ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (lichessToken) {
                              void abortLichessBoardGame(lichessToken, liveGame.gameId);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl liquid-glass-subtle hover:bg-white/15 text-[11px] font-semibold text-slate-200 transition-all"
                        >
                          Abort
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (lichessToken) {
                              void resignLichessBoardGame(lichessToken, liveGame.gameId);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/35 text-[11px] font-semibold text-rose-200 inline-flex items-center gap-1.5 transition-all"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Resign</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        handleLoadPgnIntoArena(liveBoardState.pgn);
                      }}
                      className="px-4 py-1.5 rounded-xl apple-blue-btn text-[11px] font-semibold text-white transition-all"
                    >
                      Explore in WHATIF
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* WHATIF CONTINUATION OR OTB ARENA */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                <section className="lg:col-span-7 flex flex-col gap-2">
                  <MaterialStrip {...topStrip} />

                  <ChessBoard
                    boardMatrix={boardMatrix}
                    flipped={flipped}
                    theme={prefs.boardTheme}
                    finish={prefs.boardFinish}
                    turn={state.status.turn}
                    isCheck={state.status.isCheck}
                    legalMoves={state.legalMoves}
                    lastMove={lastMove}
                    disabled={state.isThinking || state.status.isGameOver}
                    showCoordinates={prefs.showCoordinates}
                    showLegalHints={prefs.showLegalHints}
                    onPlayMove={handleWhatIfMove}
                    onIllegalMove={() => soundEngine.play("illegal")}
                  />

                  <MaterialStrip {...bottomStrip} />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => core.restart()}
                        disabled={!state.canUndo}
                        title="Restart to ply 0 (Home)"
                        aria-label="Restart to start"
                        className="p-2 rounded-xl liquid-glass-subtle text-slate-200 hover:text-white hover:bg-white/15 disabled:opacity-35 disabled:pointer-events-none transition-all active:scale-95"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => core.undo()}
                        disabled={!state.canUndo}
                        title="Previous ply (←)"
                        aria-label="Previous ply"
                        className="p-2 rounded-xl liquid-glass-subtle text-slate-200 hover:text-white hover:bg-white/15 disabled:opacity-35 disabled:pointer-events-none transition-all active:scale-95"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => core.redo()}
                        disabled={!state.canRedo}
                        title="Next ply (→)"
                        aria-label="Next ply"
                        className="p-2 rounded-xl liquid-glass-subtle text-slate-200 hover:text-white hover:bg-white/15 disabled:opacity-35 disabled:pointer-events-none transition-all active:scale-95"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlipped((f) => !f)}
                        title="Flip board (F)"
                        aria-label="Flip board"
                        className="p-2 rounded-xl liquid-glass-subtle text-slate-200 hover:text-white hover:bg-white/15 transition-all active:scale-95"
                      >
                        <FlipVertical2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updatePref("muted", !prefs.muted)}
                        title="Toggle audio (M)"
                        aria-label={prefs.muted ? "Unmute sound" : "Mute sound"}
                        className="p-2 rounded-xl liquid-glass-subtle text-slate-200 hover:text-white hover:bg-white/15 transition-all active:scale-95"
                      >
                        {prefs.muted ? (
                          <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {arenaMode === "whatif" && (
                      <button
                        type="button"
                        onClick={() => void triggerOpponentContinue()}
                        disabled={state.isThinking || state.status.isGameOver}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 active:scale-95 ${
                          isOpponentTurn
                            ? "apple-blue-btn text-white"
                            : "liquid-glass-subtle text-slate-200 hover:bg-white/15"
                        } disabled:opacity-45 disabled:pointer-events-none`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>
                          {state.isThinking
                            ? "Opponent thinking..."
                            : "Play opponent's move"}
                        </span>
                      </button>
                    )}
                  </div>
                </section>

                <section className="lg:col-span-5 w-full">
                  <InspectorDrawer
                    activeTab={activeInspectorTab}
                    onTabChange={setActiveInspectorTab}
                    state={state}
                    exportedPgn={exportedPgn}
                    lastReplyInfo={lastReplyInfo}
                    fairPlayAlert={fairPlayAlert}
                    onJumpToPly={(ply) => core.jumpToPly(ply)}
                    onSetPlayerSide={(side) => {
                      core.setPlayerSide(side);
                      if (side && prefs.autoFlip) setFlipped(side === "black");
                      setFairPlayAlert(null);
                    }}
                    onSetOpponentElo={(elo) => {
                      core.setOpponentElo(elo);
                      setFairPlayAlert(null);
                    }}
                    onOpenMore={() => {
                      setArenaMode(null);
                      setDockTab("more");
                    }}
                  />
                </section>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: HOME (Lichess Account + Ratings + Active WHATIF Session + Recent Games) */}
        {arenaMode === null && dockTab === "home" && (
          <div className="max-w-2xl mx-auto space-y-3.5 animate-view-enter">
            {/* Greeting + Lichess Rating Cards */}
            <section className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {lichessProfile
                      ? `Good day, ${lichessProfile.username}`
                      : getGreeting()}
                  </h1>
                  <p className="text-xs text-slate-300/80 mt-0.5">
                    {lichessProfile
                      ? "Tap any recent game below to explore WHATIF lines, or hit Play."
                      : "Sign in to Lichess to sync your ratings, play online, or explore offline PGNs."}
                  </p>
                </div>

                {!lichessProfile && (
                  <button
                    type="button"
                    onClick={() => setLichessModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl apple-blue-btn text-[11px] font-semibold text-white whitespace-nowrap shrink-0 transition-transform active:scale-95"
                  >
                    Connect Lichess
                  </button>
                )}
              </div>

              {ratingCards.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ratingCards.map((card) => (
                    <div
                      key={card.name}
                      className="p-2.5 rounded-xl bg-white/[0.06] border border-white/12 space-y-0.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25"
                    >
                      <div className="text-[11px] text-slate-300/80">{card.name}</div>
                      <div className="flex items-baseline gap-1 font-mono tabular-nums">
                        <span className="text-base font-bold text-white">
                          {card.rating}
                        </span>
                        {card.prog !== 0 && (
                          <span
                            className={`text-[11px] font-semibold inline-flex items-center gap-0.5 ${
                              card.prog > 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            <TrendingUp className="w-2.5 h-2.5" />
                            {card.prog > 0 ? `+${card.prog}` : card.prog}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active WHATIF Session Card */}
            <section className="liquid-glass rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-semibold tracking-wider uppercase text-[#5AC8FA]">
                  Active WHATIF Session
                </div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  Opponent_{state.metadata.opponentElo ?? "Unset"} vs You · Ply{" "}
                  {state.ply}
                </h2>
                <p className="text-xs text-slate-300/80">
                  {state.metadata.isFinished
                    ? `Completed game (${state.metadata.result}) · ${
                        state.metadata.sideInferenceReason || "Ready for continuation"
                      }`
                    : "Position ready for offline analysis."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setArenaMode("whatif")}
                className="px-4 py-2 rounded-xl apple-blue-btn text-[11px] font-semibold text-white whitespace-nowrap shrink-0 transition-transform active:scale-95"
              >
                Continue Session
              </button>
            </section>

            {/* Recent Games */}
            <section className="liquid-glass rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">Recent games</h2>
                  {lichessProfile && recentGames.length > 0 && (
                    <span className="font-mono text-[10px] text-slate-300 bg-white/10 px-1.5 py-0.5 rounded-full tabular-nums">
                      {recentGames.length}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {lichessProfile && (
                    <button
                      type="button"
                      onClick={() =>
                        void syncLichessGames(lichessProfile.username, lichessToken)
                      }
                      disabled={loadingGames}
                      aria-label="Refresh recent games"
                      className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${loadingGames ? "animate-spin" : ""}`}
                      />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="text-[11px] font-semibold text-[#5AC8FA] hover:text-white inline-flex items-center gap-0.5 transition-colors"
                  >
                    <span>Import PGN</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {!lichessProfile && (
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={quickUsername}
                      onChange={(e) => setQuickUsername(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleQuickSyncHomeUser();
                      }}
                      placeholder="Sync your Lichess games by username..."
                      className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-black/35 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#0A84FF]"
                    />
                    <button
                      type="button"
                      disabled={loadingGames || !quickUsername.trim()}
                      onClick={() => void handleQuickSyncHomeUser()}
                      className="px-3 py-1.5 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white shrink-0 disabled:opacity-40 transition-colors"
                    >
                      Sync
                    </button>
                  </div>
                  {quickSyncError && (
                    <p className="text-[11px] text-rose-300">{quickSyncError}</p>
                  )}
                </div>
              )}

              {loadingGames ? (
                <p className="text-xs text-slate-300/75 py-3">
                  Syncing recent games from Lichess...
                </p>
              ) : recentGames.length > 0 && lichessProfile ? (
                <div className="divide-y divide-white/8">
                  {recentGames.map((g) => {
                    const me = lichessProfile.username.toLowerCase();
                    const amWhite =
                      g.players.white.user?.name.toLowerCase() === me;
                    const opp = amWhite ? g.players.black : g.players.white;
                    const oppName =
                      opp.user?.name || (opp.aiLevel ? `Stockfish L${opp.aiLevel}` : "Anonymous");
                    const won =
                      (amWhite && g.winner === "white") ||
                      (!amWhite && g.winner === "black");
                    const lost =
                      (amWhite && g.winner === "black") ||
                      (!amWhite && g.winner === "white");

                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          if (g.pgn) {
                            handleLoadPgnIntoArena(g.pgn);
                          }
                        }}
                        className="w-full py-2.5 px-2 flex items-center justify-between gap-3 text-left hover:bg-white/[0.06] rounded-lg transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                amWhite ? "bg-white" : "bg-slate-600 ring-1 ring-white/40"
                              }`}
                            />
                            <span className="truncate">{oppName}</span>
                            {opp.rating && (
                              <span className="font-mono text-[11px] text-slate-300 tabular-nums shrink-0">
                                {opp.rating}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            <span className="capitalize">{g.speed}</span>
                            <span className="mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span>{formatTimeAgo(g.lastMoveAt)}</span>
                            {g.opening?.name && (
                              <>
                                <span className="mx-1.5" aria-hidden="true">
                                  ·
                                </span>
                                <span className="truncate">{g.opening.name}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span
                            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              won
                                ? "text-emerald-300 bg-emerald-500/15"
                                : lost
                                ? "text-rose-300 bg-rose-500/15"
                                : "text-slate-300 bg-white/8"
                            }`}
                          >
                            {won ? "Win" : lost ? "Loss" : "Draw"}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="divide-y divide-white/8">
                  {SAMPLE_GAMES.map((sample) => {
                    const whiteMatch = sample.pgn.match(/\[White\s+"([^"]+)"\]/);
                    const blackMatch = sample.pgn.match(/\[Black\s+"([^"]+)"\]/);
                    const whiteElo = sample.pgn.match(/\[WhiteElo\s+"([^"]+)"\]/)?.[1];
                    const blackElo = sample.pgn.match(/\[BlackElo\s+"([^"]+)"\]/)?.[1];
                    const result = sample.pgn.match(/\[Result\s+"([^"]+)"\]/)?.[1] ?? "*";
                    const whiteName = whiteMatch?.[1] ?? "White";
                    const blackName = blackMatch?.[1] ?? "Black";
                    const oppLabel =
                      whiteName === "You"
                        ? `${blackName}${blackElo ? ` · ${blackElo}` : ""}`
                        : blackName === "You"
                        ? `${whiteName}${whiteElo ? ` · ${whiteElo}` : ""}`
                        : `${whiteName} vs ${blackName}`;
                    const outcomeLabel =
                      result === "1/2-1/2"
                        ? "Draw"
                        : (whiteName === "You" && result === "1-0") ||
                          (blackName === "You" && result === "0-1")
                        ? "Win"
                        : result === "1-0" || result === "0-1"
                        ? "Loss"
                        : result;

                    return (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() =>
                          handleLoadPgnIntoArena(sample.pgn, sample.recommendedPly)
                        }
                        className="w-full py-2.5 px-2 flex items-center justify-between gap-3 text-left hover:bg-white/[0.06] rounded-lg transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white truncate">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                whiteName === "You"
                                  ? "bg-white"
                                  : "bg-slate-600 ring-1 ring-white/40"
                              }`}
                            />
                            <span className="truncate">{oppLabel}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                            {sample.title} · Ply {sample.recommendedPly}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span
                            className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                              outcomeLabel === "Win"
                                ? "text-emerald-300 bg-emerald-500/15"
                                : outcomeLabel === "Loss"
                                ? "text-rose-300 bg-rose-500/15"
                                : "text-slate-300 bg-white/8"
                            }`}
                          >
                            {outcomeLabel}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: PUZZLES */}
        {arenaMode === null && dockTab === "puzzles" && (
          <PuzzlesView
            boardTheme={prefs.boardTheme}
            boardFinish={prefs.boardFinish}
            showCoordinates={prefs.showCoordinates}
            showLegalHints={prefs.showLegalHints}
            lichessToken={lichessToken}
            profile={lichessProfile}
            onAnalyzeInWhatIf={(pgn, ply) => handleLoadPgnIntoArena(pgn, ply)}
          />
        )}

        {/* TAB 3: LEARN */}
        {arenaMode === null && dockTab === "learn" && (
          <LearnView
            boardTheme={prefs.boardTheme}
            boardFinish={prefs.boardFinish}
            showCoordinates={prefs.showCoordinates}
            showLegalHints={prefs.showLegalHints}
            onOpenInAnalysis={(pgnOrFen, isFen) => {
              if (isFen) {
                handleLoadFenIntoArena(pgnOrFen);
              } else {
                handleLoadPgnIntoArena(pgnOrFen);
              }
            }}
          />
        )}

        {/* TAB 4: WATCH */}
        {arenaMode === null && dockTab === "watch" && (
          <WatchView
            onLoadPgn={(pgn) => {
              handleLoadPgnIntoArena(pgn);
            }}
          />
        )}

        {/* TAB 5: MORE (Tools, Community, Account, All Customization & Settings) */}
        {arenaMode === null && dockTab === "more" && (
          <MoreView
            profile={lichessProfile}
            lichessToken={lichessToken}
            currentFen={state.fen}
            onOpenLichessConnect={() => setLichessModalOpen(true)}
            onDisconnectLichess={() => {
              saveLichessToken(null);
              saveLichessUsername(null);
              setLichessToken(null);
              setLichessProfile(null);
              setRecentGames([]);
              setInboxCount(0);
              core.setKnownPlayerNames([]);
            }}
            onOpenImportModal={() => setImportOpen(true)}
            onOpenAnalysisBoard={() => setArenaMode("whatif")}
            onLoadFenToAnalysis={handleLoadFenIntoArena}
            onChallengeUsername={async (username) =>
              handleChallengeFriend(username, {
                timeMinutes: 10,
                incrementSeconds: 0,
                rated: Boolean(lichessToken),
                ratingRange: "",
              })
            }
            engineMode={engineMode}
            savedStockfish={savedStockfish}
            stockfishError={stockfishError}
            onImportStockfishFiles={handleImportStockfishFiles}
            onActivatePracticeEngine={handleUsePracticeEngine}
            onActivateImportedStockfish={async () => {
              if (savedStockfish) await attachWorkerBundle(savedStockfish);
            }}
            onClearStockfishBundle={handleClearStockfish}
            boardTheme={prefs.boardTheme}
            onBoardThemeChange={(theme) => updatePref("boardTheme", theme)}
            boardFinish={prefs.boardFinish}
            onBoardFinishChange={(finish) => updatePref("boardFinish", finish)}
            showCoordinates={prefs.showCoordinates}
            onShowCoordinatesChange={(v) => updatePref("showCoordinates", v)}
            showLegalHints={prefs.showLegalHints}
            onShowLegalHintsChange={(v) => updatePref("showLegalHints", v)}
            autoFlip={prefs.autoFlip}
            onAutoFlipChange={(v) => updatePref("autoFlip", v)}
            muted={prefs.muted}
            onToggleMute={(v) => updatePref("muted", v)}
            autoReply={prefs.autoReply}
            onAutoReplyChange={(v) => updatePref("autoReply", v)}
            allowUnfinishedGame={allowUnfinishedGame}
            onAllowUnfinishedChange={setAllowUnfinishedGame}
            onOpenModal={setInfoModal}
          />
        )}
      </main>

      {/* Lichess-style Floating Play Button */}
      {arenaMode === null && dockTab !== "more" && (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 sm:right-6 z-40">
          <button
            type="button"
            onClick={() => setPlaySheetOpen(true)}
            aria-label="Play chess"
            className="apple-blue-btn px-5 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center gap-2.5 transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5 fill-current"
              aria-hidden="true"
            >
              <path d="M12 2.5a3.2 3.2 0 0 0-3.2 3.2c0 1.07.53 2.01 1.34 2.6-.77.45-1.62 1.24-1.62 2.45 0 .74.36 1.39.9 1.82-.95 1.34-2.16 3.5-2.66 5.93H5.5v2h13v-2h-1.26c-.5-2.43-1.71-4.59-2.66-5.93.54-.43.9-1.08.9-1.82 0-1.21-.85-2-1.62-2.45.81-.59 1.34-1.53 1.34-2.6A3.2 3.2 0 0 0 12 2.5Z" />
            </svg>
            <span>Play</span>
          </button>
        </div>
      )}

      {/* Floating Liquid Glass 5-Tab Bottom Dock (Home · Puzzles · Learn · Watch · More) */}
      <div className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] inset-x-0 z-40 flex justify-center px-3 pointer-events-none">
        <nav
          aria-label="Primary navigation"
          className="pointer-events-auto liquid-glass-dock rounded-full p-1 grid grid-cols-5 gap-0.5 w-full max-w-sm"
        >
          {(
            [
              { id: "home", label: "Home", Icon: Home },
              { id: "puzzles", label: "Puzzles", Icon: Puzzle },
              { id: "learn", label: "Learn", Icon: GraduationCap },
              { id: "watch", label: "Watch", Icon: Tv },
              { id: "more", label: "More", Icon: Menu },
            ] as const
          ).map(({ id, label, Icon }) => {
            const isActive = arenaMode === null && dockTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setArenaMode(null);
                  setDockTab(id);
                }}
                className={`py-1.5 px-1 rounded-full text-[10px] font-semibold transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
                  isActive
                    ? "bg-white/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
                    : "text-slate-300/75 hover:text-white"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <PlaySheetModal
        isOpen={playSheetOpen}
        isLichessConnected={Boolean(lichessToken)}
        isSeeking={isSeeking}
        seekError={seekError}
        onClose={() => setPlaySheetOpen(false)}
        onCreateLichessLobby={handleCreateLichessLobby}
        onCancelSeek={() => {
          seekAbortRef.current?.abort();
          setIsSeeking(false);
        }}
        onChallengeFriend={handleChallengeFriend}
        onChallengeLichessAi={handleChallengeLichessAi}
        onPlayLocalBot={handlePlayLocalBot}
        onPlayOverTheBoard={handlePlayOtb}
        onResumeWhatIf={() => setArenaMode("whatif")}
        onOpenLichessConnect={() => setLichessModalOpen(true)}
      />

      <LichessConnectModal
        isOpen={lichessModalOpen}
        profile={lichessProfile}
        hasToken={Boolean(lichessToken)}
        onClose={() => setLichessModalOpen(false)}
        onOAuthLogin={async () => {
          const { token, profile } = await loginWithLichessOAuth();
          setLichessToken(token);
          setLichessProfile(profile);
          core.setKnownPlayerNames([profile.username]);
          void syncInboxCount(token);
          await syncLichessGames(profile.username, token);
        }}
        onTokenLogin={async (token) => {
          const profile = await fetchLichessAccount(token);
          saveLichessToken(token);
          saveLichessUsername(profile.username);
          setLichessToken(token);
          setLichessProfile(profile);
          core.setKnownPlayerNames([profile.username]);
          void syncInboxCount(token);
          await syncLichessGames(profile.username, token);
        }}
        onLookupUsername={async (username) => {
          const profile = await fetchPublicLichessUser(username);
          saveLichessUsername(profile.username);
          setLichessProfile(profile);
          core.setKnownPlayerNames([profile.username]);
          await syncLichessGames(profile.username, null);
        }}
        onDisconnect={() => {
          saveLichessToken(null);
          saveLichessUsername(null);
          setLichessToken(null);
          setLichessProfile(null);
          setRecentGames([]);
          setInboxCount(0);
          core.setKnownPlayerNames([]);
        }}
      />

      <ImportModal
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onLoadPgn={(pgn, ply) => handleLoadPgnIntoArena(pgn, ply)}
        onLoadFen={(fen) => handleLoadFenIntoArena(fen)}
        onImportStockfishFiles={handleImportStockfishFiles}
        engineMode={engineMode}
        stockfishError={stockfishError}
      />

      <FairPlayModal mode={infoModal} onClose={() => setInfoModal(null)} />
    </div>
  );
}

export default App;
