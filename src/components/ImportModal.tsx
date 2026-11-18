import React, { useState } from "react";
import { Cpu, FileCode2, FileText, Upload, X } from "lucide-react";
import { SAMPLE_GAMES, type SampleGame } from "../data/sample-games";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadPgn: (pgn: string, ply?: number) => void;
  onLoadFen: (fen: string) => void;
  onImportStockfishFiles: (jsFile: File, wasmFile?: File | null) => Promise<void>;
  engineMode: "practice" | "stockfish";
  stockfishError: string | null;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onLoadPgn,
  onLoadFen,
  onImportStockfishFiles,
  engineMode,
  stockfishError,
}) => {
  const [rawInput, setRawInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [jsFile, setJsFile] = useState<File | null>(null);
  const [wasmFile, setWasmFile] = useState<File | null>(null);
  const [sfStatus, setSfStatus] = useState<string | null>(null);
  const [importingSf, setImportingSf] = useState(false);

  if (!isOpen) return null;

  const handleLoadSample = (sample: SampleGame) => {
    setErrorMsg(null);
    onLoadPgn(sample.pgn, sample.recommendedPly);
    onClose();
  };

  const handleParseRaw = (mode: "pgn" | "fen") => {
    setErrorMsg(null);
    const trimmed = rawInput.trim();
    if (!trimmed) {
      setErrorMsg("Paste a PGN or FEN string first.");
      return;
    }
    try {
      if (mode === "pgn") {
        onLoadPgn(trimmed);
      } else {
        onLoadFen(trimmed);
      }
      setRawInput("");
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to parse input.");
    }
  };

  const handleFile = async (file: File) => {
    setErrorMsg(null);
    try {
      const content = await file.text();
      onLoadPgn(content);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to read PGN file.");
    }
  };

  const handleSfImport = async () => {
    if (!jsFile) {
      setSfStatus("Select a Stockfish .js file first.");
      return;
    }
    setImportingSf(true);
    setSfStatus(null);
    try {
      await onImportStockfishFiles(jsFile, wasmFile);
      setJsFile(null);
      setWasmFile(null);
      setSfStatus("Stockfish WASM imported and active!");
    } catch (err) {
      setSfStatus(err instanceof Error ? err.message : "Stockfish import failed.");
    } finally {
      setImportingSf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Import Game and Stockfish Binaries"
    >
      <div className="w-full max-w-lg liquid-glass h-full flex flex-col rounded-none sm:rounded-l-[28px]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/12">
          <div>
            <h2 className="text-base font-semibold text-white">
              Import PGN & Stockfish WASM
            </h2>
            <p className="text-xs text-slate-300/80 mt-0.5">
              Load a completed PGN or import your local Stockfish .js / .wasm files.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import drawer"
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-200">
              Sample Completed Games
            </h3>
            <div className="space-y-2.5">
              {SAMPLE_GAMES.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => handleLoadSample(sample)}
                  className="w-full text-left p-4 rounded-2xl bg-white/[0.06] hover:bg-white/[0.11] border border-white/12 hover:border-[#0A84FF]/60 transition-all"
                >
                  <div className="text-sm font-semibold text-white">
                    {sample.title}
                  </div>
                  <div className="text-xs text-slate-300/80 mt-1">
                    {sample.subtitle}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-200">
              Upload .pgn File
            </h3>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
              className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border border-dashed cursor-pointer transition-colors ${
                isDragging
                  ? "border-[#0A84FF] bg-[#0A84FF]/15"
                  : "border-white/20 bg-white/[0.04] hover:border-white/35"
              }`}
            >
              <Upload className="w-5 h-5 text-slate-300" />
              <span className="text-xs text-slate-200">
                Drop a <span className="font-mono">.pgn</span> file here or click to browse
              </span>
              <input
                type="file"
                accept=".pgn,.txt"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </label>
          </section>

          <section className="space-y-2.5">
            <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Paste Raw PGN or FEN</span>
            </h3>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              rows={4}
              placeholder='Paste PGN (with [Result "1-0"] / [WhiteElo "..."]) or a 6-field FEN string...'
              className="w-full p-3.5 rounded-2xl bg-black/40 border border-white/15 font-mono text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#0A84FF]"
            />
            {errorMsg && (
              <p className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/30 rounded-xl px-3 py-2">
                {errorMsg}
              </p>
            )}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleParseRaw("pgn")}
                className="flex-1 py-2.5 px-4 rounded-xl apple-blue-btn text-xs font-semibold text-white transition-all"
              >
                Load PGN
              </button>
              <button
                type="button"
                onClick={() => handleParseRaw("fen")}
                className="py-2.5 px-4 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-medium text-white transition-colors"
              >
                Load FEN
              </button>
            </div>
          </section>

          <hr className="border-white/12" />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#5AC8FA]" />
                <span>Stockfish .js & .wasm Importer</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {engineMode === "stockfish" ? "Active" : "Practice Bot"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="p-3 rounded-xl border border-dashed border-white/20 bg-white/[0.04] hover:border-[#0A84FF]/60 cursor-pointer flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-[#5AC8FA] shrink-0" />
                <span className="text-xs text-slate-200 truncate">
                  {jsFile ? jsFile.name : "stockfish.js"}
                </span>
                <input
                  type="file"
                  accept=".js,.mjs"
                  className="sr-only"
                  onChange={(e) => setJsFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <label className="p-3 rounded-xl border border-dashed border-white/20 bg-white/[0.04] hover:border-[#0A84FF]/60 cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-slate-200 truncate">
                  {wasmFile ? wasmFile.name : "stockfish.wasm"}
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
              disabled={importingSf || !jsFile}
              onClick={() => void handleSfImport()}
              className="w-full py-2.5 px-4 rounded-xl liquid-glass-subtle hover:bg-white/15 text-xs font-semibold text-white disabled:opacity-40"
            >
              {importingSf ? "Attaching Stockfish..." : "Import & Attach Stockfish"}
            </button>

            {(sfStatus || stockfishError) && (
              <p className="text-xs text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-xl p-2.5">
                {sfStatus || stockfishError}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
