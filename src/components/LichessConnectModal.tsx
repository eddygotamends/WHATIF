import React, { useState } from "react";
import { ExternalLink, KeyRound, LogOut, UserCheck, X } from "lucide-react";
import type { LichessProfile } from "../services/lichess-client";

interface LichessConnectModalProps {
  isOpen: boolean;
  profile: LichessProfile | null;
  hasToken: boolean;
  onClose: () => void;
  onOAuthLogin: () => Promise<void>;
  onTokenLogin: (token: string) => Promise<void>;
  onLookupUsername: (username: string) => Promise<void>;
  onDisconnect: () => void;
}

export const LichessConnectModal: React.FC<LichessConnectModalProps> = ({
  isOpen,
  profile,
  hasToken,
  onClose,
  onOAuthLogin,
  onTokenLogin,
  onLookupUsername,
  onDisconnect,
}) => {
  const [tokenInput, setTokenInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAction = async (fn: () => Promise<void>) => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await fn();
      setTokenInput("");
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Lichess Account Connection"
    >
      <div className="w-full max-w-sm liquid-glass rounded-2xl p-4 sm:p-5 space-y-3.5 animate-sheet-up">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Lichess Account</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Lichess connection modal"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {profile ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-white/[0.06] border border-white/12 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0A84FF] flex items-center justify-center text-xs text-white font-bold">
                  {profile.username.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">
                    {profile.username}
                  </div>
                  <div className="text-[11px] text-slate-300/80">
                    {hasToken
                      ? "Full API access (live play & recent games)"
                      : "Public read-only profile"}
                  </div>
                </div>
              </div>
              <UserCheck className="w-4 h-4 text-emerald-400" />
            </div>

            <button
              type="button"
              onClick={() => {
                onDisconnect();
                onClose();
              }}
              className="w-full py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/35 text-xs font-semibold text-rose-200 flex items-center justify-center gap-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Disconnect Account</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleAction(onOAuthLogin)}
              className="w-full py-2.5 px-4 rounded-xl apple-blue-btn text-xs font-semibold text-white flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{loading ? "Connecting..." : "Sign in with Lichess OAuth"}</span>
            </button>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <KeyRound className="w-3.5 h-3.5 text-[#5AC8FA]" />
                  <span>Or paste Lichess API Token</span>
                </span>
                <a
                  href="https://lichess.org/account/oauth/token/create?scopes[]=board:play&scopes[]=challenge:write&scopes[]=challenge:read&scopes[]=preference:read&description=WHATIF+Studio"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#5AC8FA] hover:underline"
                >
                  Create token
                </a>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="lip_..."
                  className="flex-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0A84FF]"
                />
                <button
                  type="button"
                  disabled={loading || !tokenInput.trim()}
                  onClick={() => void handleAction(() => onTokenLogin(tokenInput.trim()))}
                  className="px-4 py-2 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Connect
                </button>
              </div>
            </div>

            <hr className="border-white/10" />

            <div className="space-y-2">
              <span className="text-xs text-slate-300 font-medium block">
                Or sync public ratings & recent games by username
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="e.g. eddygotamends"
                  className="flex-1 px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0A84FF]"
                />
                <button
                  type="button"
                  disabled={loading || !usernameInput.trim()}
                  onClick={() =>
                    void handleAction(() => onLookupUsername(usernameInput.trim()))
                  }
                  className="px-4 py-2 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Sync
                </button>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/30 rounded-xl p-2.5">
                {errorMsg}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
