import React, { useEffect, useState } from "react";
import { RefreshCw, Tv } from "lucide-react";
import {
  fetchLichessGamePgn,
  fetchLichessTvChannels,
  type LichessTvChannel,
} from "../services/lichess-client";

interface WatchViewProps {
  onLoadPgn: (pgn: string) => void;
}

export const WatchView: React.FC<WatchViewProps> = ({ onLoadPgn }) => {
  const [channels, setChannels] = useState<LichessTvChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingGameId, setLoadingGameId] = useState<string | null>(null);

  const loadChannels = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const list = await fetchLichessTvChannels();
      setChannels(list.slice(0, 8));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not load Lichess TV channels."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
  }, []);

  const handleOpenGame = async (gameId: string) => {
    setLoadingGameId(gameId);
    try {
      const pgn = await fetchLichessGamePgn(gameId);
      onLoadPgn(pgn);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not fetch game PGN.");
    } finally {
      setLoadingGameId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-3.5 animate-view-enter">
      <div className="liquid-glass rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#5AC8FA]" />
            <span>Lichess TV</span>
          </h1>
          <p className="text-xs text-slate-300/80 mt-0.5">
            Inspect featured live Lichess games in WHATIF.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadChannels()}
          className="p-2 rounded-xl liquid-glass-subtle hover:bg-white/15 text-slate-200 transition-colors"
          aria-label="Refresh Lichess TV"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {errorMsg && (
        <div className="liquid-glass rounded-xl p-3 text-xs text-amber-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {channels.map((ch) => (
          <div
            key={ch.channel}
            className="liquid-glass rounded-2xl p-3.5 flex flex-col justify-between gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/25"
          >
            <div className="space-y-0.5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#5AC8FA]">
                {ch.channel}
              </div>
              <div className="text-sm font-bold text-white truncate">
                {ch.user.title ? `${ch.user.title} ` : ""}
                {ch.user.name}
              </div>
              <div className="font-mono text-[11px] text-slate-300 tabular-nums">
                {ch.rating} Elo
              </div>
            </div>

            <button
              type="button"
              disabled={loadingGameId === ch.gameId}
              onClick={() => void handleOpenGame(ch.gameId)}
              className="w-full py-2 rounded-xl liquid-glass-subtle hover:bg-white/15 text-[11px] font-semibold text-white transition-all"
            >
              {loadingGameId === ch.gameId ? "Loading..." : "Inspect Game"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
