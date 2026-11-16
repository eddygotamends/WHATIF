# W.H.A.T.I.F. Engine

**Web History Alternative Timeline Interactive Framework** — **v0.2.0**

> *Turn post-game chess regret into calibrated practice.* Load any completed game PGN, rewind to the critical ply before things went wrong, and play out your alternative line against Stockfish throttled to your original opponent's rating.

W.H.A.T.I.F. is a **UI-agnostic, 100% offline TypeScript chess continuation engine** paired with a polished reference workbench. It has zero network dependencies, zero site scraping, and programmatic fair-play guardrails designed specifically for completed-game analysis.

---

## Why W.H.A.T.I.F.?

Most chess analysis tools either hand you top-engine evaluation lines (teaching you to memorize engine moves rather than play out positions yourself) or pair you against an uncalibrated full-strength engine. W.H.A.T.I.F. bridges the gap:

1. **Load a finished game** (`1-0`, `0-1`, or `1/2-1/2`) via PGN.
2. **Automatic game intelligence** infers which side you played from the `Result` header and reads your opponent's rating from `WhiteElo` / `BlackElo`.
3. **Scrub to any ply** before the blunder or turning point.
4. **Play on against a calibrated opponent** — Stockfish runs **only on the opponent's turn** with `UCI_LimitStrength` and `UCI_Elo` tuned (and safely clamped) to match the opponent you actually faced.

---

## Key Capabilities

### Core Continuation Engine (`@whatif/engine`)
- **Continue From Any Ply**: Load standard-chess PGNs, FENs, or UCI move lists; step backward and forward (`undo`, `redo`, `rewind`, `jumpToPly`, `restart`); branch cleanly; and export the resulting line via `exportPgn()`.
- **Automatic Side & Elo Detection**:
  - `1-0` → infers player as **Black**, opponent as **White** (`WhiteElo`).
  - `0-1` → infers player as **White**, opponent as **Black** (`BlackElo`).
  - `1/2-1/2` → prompts for explicit side selection before opponent continuation.
  - Real-time overrides via `setPlayerSide()` and `setOpponentElo()` without resetting board history.
- **Non-Destructive Engine Attachment (`setEngine()`)**: Attach or swap `StockfishUciEngine` (or any custom `MoveEngine`) after a PGN is already loaded without losing your position, move history, redo future, or overrides.
- **UI-Framework Agnostic**: Pure TypeScript ESM with `subscribe()` state snapshots—drop it into React, Vue, Svelte, Electron, Tauri, Node.js, or vanilla TypeScript.

### Built-In Fair-Play & Legal Protections
- **`FairPlayError` Guard (`allowUnfinishedGame` defaults to `false`)**: `continueAsOpponent()` refuses to run on PGNs with `Result "*"`, missing `Result` headers, or standalone `loadFen()` / `loadMoves()` positions unless `{ allowUnfinishedGame: true }` is explicitly supplied for offline study.
- **Opponent-Turn-Only Enforcement**: Refuses to generate or play moves on the user's turn (`FairPlayError` with `code: "NOT_OPPONENT_TURN"`).
- **Mandatory Elo Resolution & Clamping**: Requires a header-derived or manually overridden opponent Elo (`MISSING_ELO`), clamps ratings outside the engine's advertised `UCI_Elo` range (e.g., `< 1320`), and returns structured `{ requestedElo, effectiveElo, eloClamped, warning }` feedback.
- **Zero Network & Zero Scraping**: No `fetch`, `WebSocket`, DOM scraping, browser extension manifests, or platform API calls.

### Reference Demo Workbench (`examples/demo/`)
- **Tactile Board Experience**: Smoked-glass dark interface, crisp vector Staunton SVG pieces, pointer drag-and-drop + click-to-move, king-in-check highlight, interactive promotion picker (`Q/R/B/N`), board flip, and captured-material strips.
- **Procedural Web Audio Sound Engine**: Zero-asset Web Audio API synthesizer for wooden move taps, captures, castling, checks, promotions, game-over chords, and illegal-move thuds.
- **Power-User Study Flow**: Sample completed games selector, local `.pgn` file upload/download, two-column clickable move table with branch-divergence indicator, auto-reply toggle, keyboard shortcuts (`←`, `→`, `Home`, `End`, `F`, `M`), and an optional MIT-licensed **Practice Engine** fallback for instant testing before supplying Stockfish WASM binaries.

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Host Application / Reference Demo UI (examples/demo/)                │
│ Drag-and-Drop Board · Move Table · Web Audio FX · Side/Elo Overrides │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ WhatIfCore API + subscribe()
┌─────────────────────────────────▼────────────────────────────────────┐
│ W.H.A.T.I.F. Core (v0.2.0)                                           │
│ • ChessSession: chess.js rules, timeline, PGN metadata & overrides   │
│ • Fair-Play Guard: finished-game check, opponent-turn & Elo bounds   │
│ • Non-destructive setEngine() attachment and replacement             │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ MoveEngine interface
┌─────────────────────────────────▼────────────────────────────────────┐
│ Engine Adapter (Pluggable)                                           │
│ StockfishUciEngine (UCI_LimitStrength + UCI_Elo) or Custom Engine    │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │ UciTransport
┌─────────────────────────────────▼────────────────────────────────────┐
│ Local Runtime Transport                                              │
│ Browser Web Worker (user-supplied Stockfish WASM) · Node · Mock      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

**Requirements**: Node.js `20+` and npm.

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Open the local Vite dev server URL (port `3000`) to launch the interactive workbench.

### Library Usage (TypeScript)

```ts
import { WhatIfCore, StockfishUciEngine, FairPlayError } from "@whatif/engine";
import { BrowserWorkerTransport, createStockfishWorker } from "@whatif/engine/browser";

const core = new WhatIfCore();

// 1. Load a completed PGN and rewind to ply 10 before the decisive mistake
core.loadPgn(completedGamePgn, { ply: 10 });
const { metadata } = core.getState();
console.log(metadata.playerSide, metadata.opponentElo);

// 2. Initialize Stockfish later without resetting the loaded game or ply
const worker = createStockfishWorker("/vendor/stockfish-19.js");
const stockfish = new StockfishUciEngine(new BrowserWorkerTransport(worker));
core.setEngine(stockfish);
await core.initialize();

// 3. Play your alternative move, then let Stockfish reply at your opponent's Elo
core.playMove("d7d5");

try {
  const reply = await core.continueAsOpponent({ depth: 12, moveTimeMs: 800 });
  if (reply.warning) console.warn(reply.warning);
  console.log("Opponent played:", reply.move?.san);
} catch (error) {
  if (error instanceof FairPlayError) {
    console.error(`[${error.code}] ${error.message}`);
  }
}
```

### Custom `MoveEngine` Integration

```ts
import { WhatIfCore, type MoveEngine, type SearchLimits } from "@whatif/engine";

class CustomEngine implements MoveEngine {
  async bestMove(fen: string, _limits?: SearchLimits): Promise<string | null> {
    // Return a legal UCI coordinate move (e.g., "e7e5") or null.
    return "e7e5";
  }
}

const core = new WhatIfCore({ engine: new CustomEngine() });
```

---

## API Reference (`WhatIfCore`)

| Method | Purpose |
|---|---|
| `setEngine(engine, { disposePrevious? })` | Attach or swap a `MoveEngine` without resetting session state. |
| `hasEngine()` | Return `true` if a move engine is currently attached. |
| `initialize()` | Initialize the attached engine, if it implements `initialize()`. |
| `subscribe(listener)` | Subscribe to `SessionState` updates; returns an unsubscribe function. |
| `getState()` | Read `fen`, `ply`, `history`, `legalMoves`, `canUndo`, `canRedo`, `status`, and `metadata`. |
| `getGameMetadata()` | Read parsed PGN headers, inferred/overridden sides, Elo, and requirement flags. |
| `setPlayerSide(side)` | Manually override (`"white"` \| `"black"`) or clear (`null`) the user's side. |
| `setOpponentElo(elo)` | Manually override or clear (`null`) the opponent's Elo rating. |
| `loadPgn(pgn, { ply? })` | Load a PGN and optionally jump to a specific ply. |
| `loadFen(fen)` | Load a six-field FEN position (`metadata.isFinished` becomes `false`). |
| `loadMoves(uciMoves, { startFen?, ply? })` | Load a validated UCI move line. |
| `playMove(uci)` / `playSan(san)` | Play a legal move in UCI coordinate or SAN notation. |
| `undo()` / `redo()` | Step backward or forward while preserving future imported moves. |
| `rewind(plies)` / `jumpToPly(ply)` / `restart()` | Jump to any ply or return to the loaded root position. |
| `continueAsOpponent(options?)` | Fair-play-guarded, Elo-throttled opponent-turn-only continuation. |
| `suggestMove(limits?)` / `playEngineMove(limits?)` | Low-level engine query helpers for custom integrations. |
| `exportPgn()` | Export the current continuation branch as a valid PGN string. |
| `stopEngine()` / `dispose()` | Abort an active search or clean up listeners and engine transport. |

---

## Supplying Stockfish WASM Binaries (GPLv3 Separation)

To preserve strict license boundaries, Stockfish JS/WASM binaries are **not** bundled in this repository, npm package, or GitHub Release ZIP. To run real Stockfish locally in the browser:

1. Obtain a GPLv3-compliant Stockfish WebAssembly build (`stockfish-19.js` and `stockfish-19.wasm`) along with its upstream license notice and corresponding source reference.
2. Place both files in `public/vendor/`:
   - `public/vendor/stockfish-19.js`
   - `public/vendor/stockfish-19.wasm`
3. Ensure your host sends cross-origin isolation headers for `SharedArrayBuffer` (already configured in `vite.config.ts`):
   - `Cross-Origin-Opener-Policy: same-origin`
   - `Cross-Origin-Embedder-Policy: require-corp`

All `public/vendor/stockfish-*.js` and `public/vendor/*.wasm` files are ignored by `.gitignore` and stripped by `make-zip.sh` so GPLv3 binaries are never accidentally committed to an MIT repo.

---

## Commands & GitHub Release Packaging

```bash
npm run dev        # Start the Vite demo server on port 3000 with COOP/COEP headers
npm run typecheck  # Run strict TypeScript validation (strict: true)
npm test           # Run the Vitest unit test suite
npm run build      # Compile library (dist/) and static demo site (site/)
./make-zip.sh      # Build collective GitHub Release archive: whatif-engine-0.2.0.zip
```

Running `./make-zip.sh` produces a self-contained GitHub Releases archive containing source (`src/`), tests (`tests/`), demo (`examples/demo/`), compiled library (`dist/`), built demo (`site/`), docs, legal files, and `public/vendor/README.md`—with `node_modules/` and Stockfish binaries cleanly excluded.

---

## Repository Structure

```text
WHATIF-engine/
├── src/
│   ├── core/            # ChessSession, WhatIfCore facade, FairPlayError & types
│   ├── engine/          # UciTransport contract & StockfishUciEngine client
│   ├── platform/        # Optional BrowserWorkerTransport adapter
│   ├── index.ts         # Main UI-agnostic package entry point
│   └── browser.ts       # Browser Worker transport entry point
├── examples/demo/       # Interactive reference workbench (board, Web Audio, practice bot)
├── tests/               # Vitest unit suites (23 tests)
├── public/vendor/       # Drop-in folder for user-supplied Stockfish JS/WASM
├── FAIR_PLAY.md         # Fair-play policy, Lichess/Chess.com ToS risks & guardrails
├── REVIEW.md            # Full ethical, licensing, trademark, and privacy audit report
├── THIRD_PARTY_NOTICES.md
├── ARCHITECTURE.md
├── SPEC.md
├── CHANGELOG.md
├── make-zip.sh
└── LICENSE
```

---

## Documentation, Fair Play & Licensing

- **Fair-Play Policy**: [FAIR_PLAY.md](FAIR_PLAY.md) details online platform Terms of Service risks and the technical guardrails built into `@whatif/engine`.
- **Ethical & Legal Audit**: [REVIEW.md](REVIEW.md) contains the file-by-file audit across licensing, fair-play, trademark attribution, and privacy.
- **License**: W.H.A.T.I.F. Engine's own source code is licensed under the **MIT License** ([LICENSE](LICENSE)). `chess.js` is BSD-2-Clause; user-supplied Stockfish binaries remain GPLv3. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- **Non-Affiliation Disclaimer**: W.H.A.T.I.F. Engine is an independent open-source project and is **not affiliated with, endorsed by, or connected to Lichess, Chess.com, LLC, or Stockfish**.
