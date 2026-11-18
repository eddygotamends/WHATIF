import React, { useEffect, useState } from "react";
import { Chess } from "chess.js";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Compass,
  Cpu,
  Download,
  Edit3,
  FileCode2,
  FileUp,
  Info,
  Mail,
  Microscope,
  Palette,
  Search,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import {
  acceptLichessChallenge,
  declineLichessChallenge,
  fetchLichessChallenges,
  fetchLichessFollowing,
  fetchLichessOpeningExplorer,
  fetchPublicLichessUser,
  type LichessChallengeItem,
  type LichessFriendUser,
  type LichessProfile,
  type OpeningExplorerResponse,
} from "../services/lichess-client";
import type { StoredStockfishBundle } from "../engine/stockfish-importer";
import { BOARD_THEMES, type BoardThemeId } from "./ChessBoard";
import { ChessPieceSvg, type BoardFinish, type PieceColor, type PieceType } from "./ChessPieceSvg";
import { MinimalSwitch } from "./MinimalSwitch";

interface MoreViewProps {
  profile: LichessProfile | null;
  lichessToken: string | null;
  currentFen: string;
  onOpenLichessConnect: () => void;
  onDisconnectLichess: () => void;
  onOpenImportModal: () => void;
  onOpenAnalysisBoard: () => void;
  onLoadFenToAnalysis: (fen: string) => void;
  onChallengeUsername: (username: string) => Promise<void>;
  engineMode: "practice" | "stockfish";
  savedStockfish: StoredStockfishBundle | null;
  stockfishError: string | null;
  onImportStockfishFiles: (jsFile: File, wasmFile?: File | null) => Promise<void>;
  onActivatePracticeEngine: () => void;
  onActivateImportedStockfish: () => Promise<void>;
  onClearStockfishBundle: () => Promise<void>;
  boardTheme: BoardThemeId;
  onBoardThemeChange: (theme: BoardThemeId) => void;
  boardFinish: BoardFinish;
  onBoardFinishChange: (finish: BoardFinish) => void;
  showCoordinates: boolean;
  onShowCoordinatesChange: (next: boolean) => void;
  showLegalHints: boolean;
  onShowLegalHintsChange: (next: boolean) => void;
  autoFlip: boolean;
  onAutoFlipChange: (next: boolean) => void;
  muted: boolean;
  onToggleMute: (next: boolean) => void;
  autoReply: boolean;
  onAutoReplyChange: (next: boolean) => void;
  allowUnfinishedGame: boolean;
  onAllowUnfinishedChange: (next: boolean) => void;
  onOpenModal: (mode: "fair-play" | "shortcuts") => void;
}

type MoreSubView =
  | "menu"
  | "explorer"
  | "editor"
  | "clock"
  | "players"
  | "friends"
  | "profile"
  | "inbox"
  | "settings";

export const MoreView: React.FC<MoreViewProps> = ({
  profile,
  lichessToken,
  currentFen,
  onOpenLichessConnect,
  onDisconnectLichess,
  onOpenImportModal,
  onOpenAnalysisBoard,
  onLoadFenToAnalysis,
  onChallengeUsername,
  engineMode,
  savedStockfish,
  stockfishError,
  onImportStockfishFiles,
  onActivatePracticeEngine,
  onActivateImportedStockfish,
  onClearStockfishBundle,
  boardTheme,
  onBoardThemeChange,
  boardFinish,
  onBoardFinishChange,
  showCoordinates,
  onShowCoordinatesChange,
  showLegalHints,
  onShowLegalHintsChange,
  autoFlip,
  onAutoFlipChange,
  muted,
  onToggleMute,
  autoReply,
  onAutoReplyChange,
  allowUnfinishedGame,
  onAllowUnfinishedChange,
  onOpenModal,
}) => {
  const [subView, setSubView] = useState<MoreSubView>("menu");
  const [downloadStatus, setDownloadStatus] = useState<{
    target: "apk" | "zip" | null;
    progress: number | null;
    message: string | null;
    error: string | null;
  }>({ target: null, progress: null, message: null, error: null });

  const handleBinaryDownload = async (
    target: "apk" | "zip",
    url: string,
    filename: string,
    mimeType: string
  ) => {
    setDownloadStatus({
      target,
      progress: 0,
      message: `Preparing ${filename}...`,
      error: null,
    });

    try {
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const contentType = (response.headers.get("content-type") || "").toLowerCase();
      if (contentType.includes("text/html")) {
        throw new Error(
          "Preview proxy returned an HTML page instead of the binary file. Open the app directly in a browser tab or download via GitHub Releases."
        );
      }

      const total = Number(response.headers.get("content-length") || "0");
      let buffer: Uint8Array;

      if (response.body) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (total > 0) {
              const pct = Math.min(99, Math.round((received / total) * 100));
              setDownloadStatus({
                target,
                progress: pct,
                message: `Downloading ${filename} (${pct}%)...`,
                error: null,
              });
            }
          }
        }

        buffer = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          buffer.set(chunk, offset);
          offset += chunk.length;
        }
      } else {
        buffer = new Uint8Array(await response.arrayBuffer());
      }

      // Both .zip and .apk files are PK archives starting with 0x50 0x4B ("PK")
      if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
        throw new Error(
          "Downloaded payload was not a valid ZIP/APK binary (received non-archive response)."
        );
      }

      const blob = new Blob([buffer.buffer as ArrayBuffer], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 15_000);

      const mb = (buffer.length / (1024 * 1024)).toFixed(2);
      setDownloadStatus({
        target: null,
        progress: 100,
        message: `Saved ${filename} (${mb} MB)`,
        error: null,
      });
    } catch (err) {
      setDownloadStatus({
        target: null,
        progress: null,
        message: null,
        error:
          err instanceof Error ? err.message : `Failed to download ${filename}.`,
      });
    }
  };

  // Opening explorer state
  const [explorerFen, setExplorerFen] = useState(currentFen);
  const [explorerData, setExplorerData] = useState<OpeningExplorerResponse | null>(null);
  const [explorerLoading, setExplorerLoading] = useState(false);

  // Board editor state
  const [editorChess, setEditorChess] = useState(() => new Chess());
  const [editorBrush, setEditorBrush] = useState<
    { type: PieceType; color: PieceColor } | "erase"
  >({ type: "q", color: "w" });

  // OTB Clock state
  const [clockBaseMin, setClockBaseMin] = useState(5);
  const [clockIncSec, setClockIncSec] = useState(3);
  const [whiteMs, setWhiteMs] = useState(300000);
  const [blackMs, setBlackMs] = useState(300000);
  const [clockActive, setClockActive] = useState<"w" | "b" | null>(null);

  // Community / Account state
  const [playerQuery, setPlayerQuery] = useState("");
  const [foundPlayer, setFoundPlayer] = useState<LichessProfile | null>(null);
  const [playerErr, setPlayerErr] = useState<string | null>(null);
  const [friends, setFriends] = useState<LichessFriendUser[]>([]);
  const [challenges, setChallenges] = useState<LichessChallengeItem[]>([]);
  const [inboxCount, setInboxCount] = useState(0);

  // Stockfish importer state
  const [jsFile, setJsFile] = useState<File | null>(null);
  const [wasmFile, setWasmFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Fetch inbox count if connected
  useEffect(() => {
    if (!lichessToken) {
      setInboxCount(0);
      setChallenges([]);
      return;
    }
    void fetchLichessChallenges(lichessToken)
      .then((res) => {
        setChallenges(res.in);
        setInboxCount(res.in.length);
      })
      .catch(() => {});
  }, [lichessToken]);

  // Opening explorer loader
  useEffect(() => {
    if (subView !== "explorer") return;
    setExplorerLoading(true);
    void fetchLichessOpeningExplorer(explorerFen)
      .then((res) => setExplorerData(res))
      .catch(() => setExplorerData(null))
      .finally(() => setExplorerLoading(false));
  }, [subView, explorerFen]);

  // Clock ticker
  useEffect(() => {
    if (subView !== "clock" || !clockActive) return;
    const interval = setInterval(() => {
      if (clockActive === "w") {
        setWhiteMs((ms) => Math.max(0, ms - 100));
      } else {
        setBlackMs((ms) => Math.max(0, ms - 100));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [subView, clockActive]);

  // Friends loader
  useEffect(() => {
    if (subView !== "friends" || !lichessToken) return;
    void fetchLichessFollowing(lichessToken)
      .then(setFriends)
      .catch(() => {});
  }, [subView, lichessToken]);

  const BackHeader = ({ title }: { title: string }) => (
    <div className="flex items-center justify-between gap-3 mb-4">
      <button
        type="button"
        onClick={() => setSubView("menu")}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to More</span>
      </button>
      <h2 className="text-base font-bold text-white">{title}</h2>
    </div>
  );

  // SUBVIEW: OPENING EXPLORER
  if (subView === "explorer") {
    const expChess = new Chess(explorerFen);
    const totalGames =
      (explorerData?.white ?? 0) +
      (explorerData?.draws ?? 0) +
      (explorerData?.black ?? 0);

    return (
      <div className="max-w-4xl mx-auto animate-view-enter">
        <BackHeader title="Opening Explorer" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-6 liquid-glass p-3 rounded-[28px]">
            <div className="aspect-square w-full rounded-[18px] overflow-hidden grid grid-cols-8 grid-rows-8">
              {expChess.board().map((row, r) =>
                row.map((sq, c) => (
                  <div
                    key={`${r}-${c}`}
                    style={{
                      backgroundColor: (r + c) % 2 === 0 ? "#F0D9B5" : "#8A5838",
                    }}
                    className="flex items-center justify-center"
                  >
                    {sq && (
                      <div className="w-[84%] h-[84%]">
                        <ChessPieceSvg
                          type={sq.type}
                          color={sq.color}
                          finish={boardFinish}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-6 liquid-glass rounded-[28px] p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs text-[#5AC8FA] font-semibold">
                  Lichess Database
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {explorerData?.opening?.name || "Starting Position"}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setExplorerFen(
                    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
                  )
                }
                className="px-3 py-1.5 rounded-xl liquid-glass-subtle text-xs text-white"
              >
                Reset
              </button>
            </div>

            {explorerLoading ? (
              <p className="text-xs text-slate-300 py-4">Querying Lichess explorer...</p>
            ) : (
              <div className="divide-y divide-white/10">
                {(explorerData?.moves ?? []).map((m) => {
                  const sum = m.white + m.draws + m.black || 1;
                  const wPct = Math.round((m.white / sum) * 100);
                  const dPct = Math.round((m.draws / sum) * 100);
                  const bPct = 100 - wPct - dPct;
                  return (
                    <button
                      key={m.uci}
                      type="button"
                      onClick={() => {
                        const next = new Chess(explorerFen);
                        next.move({
                          from: m.uci.slice(0, 2),
                          to: m.uci.slice(2, 4),
                          promotion: m.uci.length > 4 ? m.uci[4] : undefined,
                        });
                        setExplorerFen(next.fen());
                      }}
                      className="w-full py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-white/[0.05] rounded-xl text-left"
                    >
                      <span className="font-mono text-sm font-bold text-white w-14">
                        {m.san}
                      </span>
                      <div className="flex-1 h-2.5 rounded-full overflow-hidden flex bg-white/10">
                        <div style={{ width: `${wPct}%` }} className="bg-slate-100" />
                        <div style={{ width: `${dPct}%` }} className="bg-slate-500" />
                        <div style={{ width: `${bPct}%` }} className="bg-slate-900" />
                      </div>
                      <span className="font-mono text-[11px] text-slate-300 tabular-nums w-16 text-right">
                        {totalGames > 0 ? sum.toLocaleString() : "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => onLoadFenToAnalysis(explorerFen)}
              className="w-full py-2.5 rounded-2xl apple-blue-btn text-xs font-semibold text-white"
            >
              Open Position in WHATIF Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SUBVIEW: BOARD EDITOR
  if (subView === "editor") {
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
    const ranks = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
    const matrix = editorChess.board();

    return (
      <div className="max-w-4xl mx-auto animate-view-enter">
        <BackHeader title="Board Editor" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 liquid-glass p-3 rounded-[28px]">
            <div className="aspect-square w-full rounded-[18px] overflow-hidden grid grid-cols-8 grid-rows-8">
              {ranks.map((rank, r) =>
                files.map((file, c) => {
                  const sq = `${file}${rank}` as Parameters<Chess["get"]>[0];
                  const piece = matrix[r]?.[c];
                  return (
                    <button
                      key={sq}
                      type="button"
                      onClick={() => {
                        const next = new Chess(editorChess.fen(), {
                          skipValidation: true,
                        });
                        if (editorBrush === "erase") {
                          next.remove(sq);
                        } else {
                          next.put(editorBrush, sq);
                        }
                        setEditorChess(next);
                      }}
                      style={{
                        backgroundColor: (r + c) % 2 === 0 ? "#F0D9B5" : "#8A5838",
                      }}
                      className="flex items-center justify-center hover:brightness-110"
                    >
                      {piece && (
                        <div className="w-[82%] h-[82%]">
                          <ChessPieceSvg
                            type={piece.type}
                            color={piece.color}
                            finish={boardFinish}
                          />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-5 liquid-glass rounded-[28px] p-5 space-y-4">
            <div className="text-xs font-semibold text-white">Piece Palette</div>
            {(["w", "b"] as PieceColor[]).map((color) => (
              <div key={color} className="grid grid-cols-6 gap-1.5">
                {(["k", "q", "r", "b", "n", "p"] as PieceType[]).map((type) => {
                  const active =
                    editorBrush !== "erase" &&
                    editorBrush.color === color &&
                    editorBrush.type === type;
                  return (
                    <button
                      key={`${color}-${type}`}
                      type="button"
                      onClick={() => setEditorBrush({ color, type })}
                      className={`aspect-square rounded-xl p-1.5 border transition-all ${
                        active
                          ? "bg-[#0A84FF]/25 border-[#0A84FF]"
                          : "bg-white/[0.06] border-white/10 hover:bg-white/12"
                      }`}
                    >
                      <ChessPieceSvg type={type} color={color} finish={boardFinish} />
                    </button>
                  );
                })}
              </div>
            ))}

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEditorBrush("erase")}
                className={`py-2 rounded-xl text-xs font-semibold border ${
                  editorBrush === "erase"
                    ? "bg-rose-500/25 border-rose-400 text-rose-100"
                    : "bg-white/[0.06] border-white/12 text-slate-200"
                }`}
              >
                Erase
              </button>
              <button
                type="button"
                onClick={() => setEditorChess(new Chess())}
                className="py-2 rounded-xl liquid-glass-subtle text-xs font-semibold text-white"
              >
                Startpos
              </button>
              <button
                type="button"
                onClick={() => {
                  const empty = new Chess();
                  empty.clear();
                  setEditorChess(empty);
                }}
                className="py-2 rounded-xl liquid-glass-subtle text-xs font-semibold text-white"
              >
                Clear
              </button>
            </div>

            <button
              type="button"
              onClick={() => onLoadFenToAnalysis(editorChess.fen())}
              className="w-full py-3 rounded-2xl apple-blue-btn text-xs font-semibold text-white"
            >
              Continue in WHATIF Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  // SUBVIEW: OTB CHESS CLOCK
  if (subView === "clock") {
    const fmt = (ms: number) => {
      const total = Math.ceil(ms / 1000);
      const m = Math.floor(total / 60);
      const s = total % 60;
      return `${m}:${String(s).padStart(2, "0")}`;
    };

    return (
      <div className="max-w-xl mx-auto space-y-4 animate-view-enter">
        <BackHeader title="Chess Clock" />
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              if (clockActive === "b") setBlackMs((m) => m + clockIncSec * 1000);
              setClockActive("w");
            }}
            className={`w-full py-12 rounded-[28px] liquid-glass font-mono text-5xl font-bold tabular-nums transition-all rotate-180 ${
              clockActive === "b"
                ? "ring-2 ring-[#0A84FF] text-white"
                : "text-slate-300"
            }`}
          >
            {fmt(blackMs)}
          </button>

          <div className="flex items-center justify-between gap-2 px-2">
            {[
              { min: 1, inc: 0, label: "1+0" },
              { min: 3, inc: 2, label: "3+2" },
              { min: 5, inc: 3, label: "5+3" },
              { min: 10, inc: 0, label: "10+0" },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setClockActive(null);
                  setClockBaseMin(p.min);
                  setClockIncSec(p.inc);
                  setWhiteMs(p.min * 60000);
                  setBlackMs(p.min * 60000);
                }}
                className={`flex-1 py-2 rounded-xl font-mono text-xs font-semibold border ${
                  clockBaseMin === p.min && clockIncSec === p.inc
                    ? "bg-[#0A84FF]/25 border-[#0A84FF] text-white"
                    : "liquid-glass-subtle text-slate-300"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setClockActive(null)}
              className="px-4 py-2 rounded-xl liquid-glass-subtle text-xs font-semibold text-white"
            >
              Pause
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (clockActive === "w") setWhiteMs((m) => m + clockIncSec * 1000);
              setClockActive("b");
            }}
            className={`w-full py-12 rounded-[28px] liquid-glass font-mono text-5xl font-bold tabular-nums transition-all ${
              clockActive === "w"
                ? "ring-2 ring-[#0A84FF] text-white"
                : "text-slate-300"
            }`}
          >
            {fmt(whiteMs)}
          </button>
        </div>
      </div>
    );
  }

  // SUBVIEW: PLAYERS SEARCH
  if (subView === "players") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-view-enter">
        <BackHeader title="Lichess Players" />
        <div className="liquid-glass rounded-[28px] p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={playerQuery}
              onChange={(e) => setPlayerQuery(e.target.value)}
              placeholder="Search Lichess username..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-black/40 border border-white/15 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0A84FF]"
            />
            <button
              type="button"
              onClick={() => {
                setPlayerErr(null);
                void fetchPublicLichessUser(playerQuery)
                  .then(setFoundPlayer)
                  .catch((err) =>
                    setPlayerErr(err instanceof Error ? err.message : "Not found")
                  );
              }}
              className="px-4 py-2.5 rounded-2xl apple-blue-btn text-xs font-semibold text-white inline-flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Lookup</span>
            </button>
          </div>

          {playerErr && <p className="text-xs text-rose-300">{playerErr}</p>}

          {foundPlayer && (
            <div className="p-4 rounded-2xl bg-white/[0.06] border border-white/12 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-base font-bold text-white">
                  {foundPlayer.username}
                </div>
                {lichessToken && (
                  <button
                    type="button"
                    onClick={() => void onChallengeUsername(foundPlayer.username)}
                    className="px-3 py-1.5 rounded-xl apple-blue-btn text-xs font-semibold text-white"
                  >
                    Challenge
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="p-2 rounded-xl bg-black/30">
                  Rapid: {foundPlayer.perfs.rapid?.rating ?? "—"}
                </div>
                <div className="p-2 rounded-xl bg-black/30">
                  Blitz: {foundPlayer.perfs.blitz?.rating ?? "—"}
                </div>
                <div className="p-2 rounded-xl bg-black/30">
                  Bullet: {foundPlayer.perfs.bullet?.rating ?? "—"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // SUBVIEW: FRIENDS
  if (subView === "friends") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-view-enter">
        <BackHeader title="Friends" />
        <div className="liquid-glass rounded-[28px] p-6 space-y-3">
          {!lichessToken ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-slate-300">
                Connect your Lichess account to see followed friends and challenge them.
              </p>
              <button
                type="button"
                onClick={onOpenLichessConnect}
                className="px-5 py-2.5 rounded-2xl apple-blue-btn text-xs font-semibold text-white"
              >
                Connect Lichess
              </button>
            </div>
          ) : friends.length === 0 ? (
            <p className="text-sm text-slate-400">No followed friends found.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {f.username}
                    </div>
                    <div className="text-xs text-slate-400">
                      {f.online ? "Online" : "Offline"}
                      {f.perfs?.rapid ? ` · Rapid ${f.perfs.rapid.rating}` : ""}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onChallengeUsername(f.username)}
                    className="px-3.5 py-1.5 rounded-xl apple-blue-btn text-xs font-semibold text-white"
                  >
                    Challenge
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // SUBVIEW: INBOX
  if (subView === "inbox") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-view-enter">
        <BackHeader title="Challenges Inbox" />
        <div className="liquid-glass rounded-[28px] p-6 space-y-3">
          {!lichessToken ? (
            <p className="text-sm text-slate-300">
              Sign in with Lichess to receive live game challenges.
            </p>
          ) : challenges.length === 0 ? (
            <p className="text-sm text-slate-400">No incoming challenges.</p>
          ) : (
            <div className="divide-y divide-white/10">
              {challenges.map((ch) => (
                <div
                  key={ch.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {ch.challenger.name}{" "}
                      {ch.challenger.rating ? `(${ch.challenger.rating})` : ""}
                    </div>
                    <div className="text-xs text-slate-400">
                      {ch.timeControl.show || ch.speed} ·{" "}
                      {ch.rated ? "Rated" : "Casual"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void acceptLichessChallenge(lichessToken, ch.id).then(() =>
                          setChallenges((list) => list.filter((x) => x.id !== ch.id))
                        )
                      }
                      className="p-2 rounded-xl bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/35"
                      aria-label="Accept challenge"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void declineLichessChallenge(lichessToken, ch.id).then(() =>
                          setChallenges((list) => list.filter((x) => x.id !== ch.id))
                        )
                      }
                      className="p-2 rounded-xl bg-rose-500/25 text-rose-200 hover:bg-rose-500/35"
                      aria-label="Decline challenge"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // SUBVIEW: PROFILE
  if (subView === "profile") {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-view-enter">
        <BackHeader title="Profile" />
        <div className="liquid-glass rounded-[28px] p-6 space-y-5">
          {profile ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#0A84FF] flex items-center justify-center text-lg font-bold text-white">
                    {profile.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {profile.username}
                    </div>
                    <div className="text-xs text-slate-400">
                      {profile.count ? `${profile.count.all} games played` : "Lichess Member"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onDisconnectLichess}
                  className="px-4 py-2 rounded-xl bg-rose-500/20 text-xs font-semibold text-rose-200"
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-slate-300">Not connected to Lichess yet.</p>
              <button
                type="button"
                onClick={onOpenLichessConnect}
                className="px-5 py-2.5 rounded-2xl apple-blue-btn text-xs font-semibold text-white"
              >
                Connect Lichess
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // SUBVIEW: SETTINGS (ALL CUSTOMIZATION: GLOSS/MATTE, THEMES, STOCKFISH IMPORTER, MINIMAL SWITCHES)
  if (subView === "settings") {
    const handleImportSubmit = async () => {
      if (!jsFile) {
        setImportMsg("Select a Stockfish .js loader file first.");
        return;
      }
      setImporting(true);
      setImportMsg(null);
      try {
        await onImportStockfishFiles(jsFile, wasmFile);
        setJsFile(null);
        setWasmFile(null);
        setImportMsg("Stockfish WASM imported and activated.");
      } catch (err) {
        setImportMsg(err instanceof Error ? err.message : "Failed to import Stockfish.");
      } finally {
        setImporting(false);
      }
    };

    return (
      <div className="max-w-2xl mx-auto space-y-3.5 animate-view-enter">
        <BackHeader title="Settings & Customization" />

        {/* Board Surface Finish (Gloss vs Matte) & Themes */}
        <section className="liquid-glass rounded-2xl p-4 space-y-3.5">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#5AC8FA]" />
            <h3 className="text-sm font-bold text-white">
              Board Finish & Theme
            </h3>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-300 block">
              Surface Finish
            </span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/35 border border-white/10">
              {(["gloss", "matte"] as const).map((finish) => (
                <button
                  key={finish}
                  type="button"
                  onClick={() => onBoardFinishChange(finish)}
                  className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    boardFinish === finish
                      ? "bg-[#0A84FF] text-white shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {finish} Finish
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-300 block">
              Board Palette
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(Object.keys(BOARD_THEMES) as BoardThemeId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onBoardThemeChange(id)}
                  className={`p-2 rounded-xl border flex items-center gap-2 transition-all ${
                    boardTheme === id
                      ? "bg-[#0A84FF]/20 border-[#0A84FF] text-white"
                      : "bg-white/[0.05] border-white/12 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  <span className="w-4 h-4 rounded overflow-hidden grid grid-cols-2 shrink-0 ring-1 ring-white/20">
                    <span style={{ backgroundColor: BOARD_THEMES[id].light }} />
                    <span style={{ backgroundColor: BOARD_THEMES[id].dark }} />
                    <span style={{ backgroundColor: BOARD_THEMES[id].dark }} />
                    <span style={{ backgroundColor: BOARD_THEMES[id].light }} />
                  </span>
                  <span className="text-[11px] font-semibold truncate">
                    {BOARD_THEMES[id].name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-white/8 pt-0.5">
            <MinimalSwitch
              checked={showCoordinates}
              onChange={onShowCoordinatesChange}
              label="Board coordinates"
              description="Display rank and file labels along board edges."
            />
            <MinimalSwitch
              checked={showLegalHints}
              onChange={onShowLegalHintsChange}
              label="Legal move indicators"
              description="Show destination dots and capture rings."
            />
            <MinimalSwitch
              checked={autoFlip}
              onChange={onAutoFlipChange}
              label="Auto-flip to player side"
              description="Orient board automatically from loaded game metadata."
            />
          </div>
        </section>

        {/* Audio, Gameplay & Fair-Play */}
        <section className="liquid-glass rounded-2xl p-4 space-y-1 divide-y divide-white/8">
          <MinimalSwitch
            checked={!muted}
            onChange={(on) => onToggleMute(!on)}
            label="Piece & capture audio"
            description="Synthesized Web Audio wooden tap and check cues."
          />
          <MinimalSwitch
            checked={autoReply}
            onChange={onAutoReplyChange}
            label="Auto-reply in WHATIF mode"
            description="Calibrated opponent replies automatically after your move."
          />
          <MinimalSwitch
            checked={allowUnfinishedGame}
            onChange={onAllowUnfinishedChange}
            label="Offline FEN / unfinished study"
            description="Allow continuation on positions without a finished Result header."
          />
        </section>

        {/* Stockfish .js & .wasm Importer */}
        <section className="liquid-glass rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#5AC8FA]" />
              <h3 className="text-sm font-bold text-white">
                Stockfish .js & .wasm Importer
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-300">
              {engineMode === "stockfish" ? "Stockfish Active" : "Practice Bot"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="p-2.5 rounded-xl border border-dashed border-white/20 bg-white/[0.04] hover:border-[#0A84FF]/60 cursor-pointer flex items-center gap-2">
              <FileCode2 className="w-3.5 h-3.5 text-[#5AC8FA] shrink-0" />
              <span className="text-[11px] text-slate-200 truncate">
                {jsFile ? jsFile.name : "Select stockfish.js"}
              </span>
              <input
                type="file"
                accept=".js,.mjs"
                className="sr-only"
                onChange={(e) => setJsFile(e.target.files?.[0] ?? null)}
              />
            </label>

            <label className="p-2.5 rounded-xl border border-dashed border-white/20 bg-white/[0.04] hover:border-[#0A84FF]/60 cursor-pointer flex items-center gap-2">
              <Upload className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-slate-200 truncate">
                {wasmFile ? wasmFile.name : "Select .wasm (optional)"}
              </span>
              <input
                type="file"
                accept=".wasm"
                className="sr-only"
                onChange={(e) => setWasmFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <button
            type="button"
            disabled={importing || !jsFile}
            onClick={() => void handleImportSubmit()}
            className="w-full py-2 rounded-xl apple-blue-btn text-xs font-semibold text-white disabled:opacity-40"
          >
            {importing ? "Importing & Initializing..." : "Import & Activate Stockfish"}
          </button>

          {savedStockfish && (
            <div className="p-2.5 rounded-xl bg-white/[0.06] border border-white/12 flex items-center justify-between gap-2 text-[11px]">
              <span className="text-white truncate">
                Saved: {savedStockfish.jsName}
                {savedStockfish.wasmName ? ` + ${savedStockfish.wasmName}` : ""}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {engineMode !== "stockfish" && (
                  <button
                    type="button"
                    onClick={() => void onActivateImportedStockfish()}
                    className="px-2 py-0.5 rounded-lg bg-[#0A84FF] text-white font-semibold"
                  >
                    Use
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onClearStockfishBundle()}
                  aria-label="Remove saved Stockfish"
                  className="p-1 text-slate-400 hover:text-rose-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {engineMode === "stockfish" && (
            <button
              type="button"
              onClick={onActivatePracticeEngine}
              className="w-full py-1.5 rounded-xl liquid-glass-subtle text-[11px] font-medium text-slate-200"
            >
              Switch back to Practice Engine (MIT)
            </button>
          )}

          {(importMsg || stockfishError) && (
            <p className="text-[11px] text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-xl p-2">
              {importMsg || stockfishError}
            </p>
          )}
        </section>
      </div>
    );
  }

  // MAIN MORE MENU
  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-view-enter">
      {/* Tools Section */}
      <section className="space-y-1.5">
        <h2 className="text-xs font-semibold text-slate-300/80 px-1">Tools</h2>
        <div className="liquid-glass rounded-2xl divide-y divide-white/10 overflow-hidden">
          <button
            type="button"
            onClick={onOpenImportModal}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <FileUp className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">Import PGN</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={onOpenAnalysisBoard}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Microscope className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">
                Analysis board
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => setSubView("explorer")}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Compass className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">
                Opening explorer
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => setSubView("editor")}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Edit3 className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">
                Board editor
              </span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => setSubView("clock")}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">Clock</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </section>

      {/* Community Section */}
      <section className="space-y-1.5">
        <h2 className="text-xs font-semibold text-slate-300/80 px-1">
          Community
        </h2>
        <div className="liquid-glass rounded-2xl divide-y divide-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setSubView("players")}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">Players</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => setSubView("friends")}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">Friends</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </section>

      {/* Account & Settings Section */}
      <section className="space-y-1.5">
        <h2 className="text-xs font-semibold text-slate-300/80 px-1">
          {profile ? profile.username : "Account & Customization"}
        </h2>
        <div className="liquid-glass rounded-2xl divide-y divide-white/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setSubView("profile")}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">Profile</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => setSubView("inbox")}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#5AC8FA]" />
              <span className="text-[13px] font-medium text-white">Inbox</span>
            </div>
            <div className="flex items-center gap-2">
              {inboxCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-[10px] font-bold text-white tabular-nums">
                  {inboxCount}
                </span>
              )}
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSubView("settings")}
            className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4 text-[#5AC8FA]" />
              <div>
                <div className="text-[13px] font-medium text-white">Settings</div>
                <div className="text-[11px] text-slate-400">
                  Gloss/matte, themes, Stockfish importer & guardrails
                </div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        </div>
      </section>

      {/* About, Export & Fair Play */}
      {downloadStatus.error && (
        <p className="text-[11px] text-rose-200 bg-rose-500/15 border border-rose-400/30 rounded-xl px-3 py-2">
          {downloadStatus.error}
        </p>
      )}
      {!downloadStatus.error && downloadStatus.message && downloadStatus.target === null && (
        <p className="text-[11px] text-emerald-200 bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-3 py-2">
          {downloadStatus.message}
        </p>
      )}
      <section className="liquid-glass rounded-2xl divide-y divide-white/10 overflow-hidden">
        <button
          type="button"
          onClick={() => onOpenModal("fair-play")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[13px] font-medium text-white">
              Fair-Play Guardrails
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={() => onOpenModal("shortcuts")}
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Info className="w-4 h-4 text-[#5AC8FA]" />
            <span className="text-[13px] font-medium text-white">
              Keyboard Shortcuts & About
            </span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </button>

        <button
          type="button"
          disabled={downloadStatus.target !== null}
          onClick={() =>
            void handleBinaryDownload(
              "apk",
              "/WHATIF.apk",
              "WHATIF.apk",
              "application/vnd.android.package-archive"
            )
          }
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] disabled:opacity-60 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white truncate">
                {downloadStatus.target === "apk" && downloadStatus.message
                  ? downloadStatus.message
                  : "Download Android APK (.apk)"}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Compiled Capacitor Android build (14.3 MB · WHATIF.apk)
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>

        <button
          type="button"
          disabled={downloadStatus.target !== null}
          onClick={() =>
            void handleBinaryDownload(
              "zip",
              "/WHATIF-github-export.zip",
              "WHATIF-github-export.zip",
              "application/zip"
            )
          }
          className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.06] disabled:opacity-60 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Download className="w-4 h-4 text-[#5AC8FA] shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-white truncate">
                {downloadStatus.target === "zip" && downloadStatus.message
                  ? downloadStatus.message
                  : "Download GitHub Source (.zip)"}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                Includes GEMINI.md, README.md & Android APK GitHub workflow
              </div>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </section>

      <p className="text-[11px] text-slate-400/80 px-2 pb-2 leading-relaxed">
        WHATIF is an independent open-source chess continuation client and is not affiliated with Lichess, Chess.com, LLC, or Stockfish.
      </p>
    </div>
  );
};
