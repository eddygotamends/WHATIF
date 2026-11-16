# Ethical, Licensing & Legal Review Report (`WHATIF-engine` v0.1.0 → v0.2.0)

This report documents the full audit of every file in the `WHATIF-engine` v0.1.0 bundle (`src/`, `examples/demo/`, `tests/`, `package.json`, `vite.config.ts`, `tsconfig*.json`, `.gitignore`, `LICENSE`, `README.md`, `ARCHITECTURE.md`, `SPEC.md`, `CHANGELOG.md`, `THIRD_PARTY_NOTICES.md`) and the concrete remediations applied in **v0.2.0**.

---

## Summary of Findings & Applied Fixes

| ID | Category | Severity | Scope | Status in v0.2.0 |
|---|---|---|---|---|
| F1 | Licensing | **Blocking** | Bundled Stockfish GPLv3 JS/WASM binaries & `.gitignore` | **Fixed** |
| F2 | Fair-Play | **High** | Unchecked engine invocation on unfinished games (`Result "*"`) | **Fixed** |
| F3 | Fair-Play | **High** | Unrestricted turn play & unthrottled default demo action | **Fixed** |
| F4 | Fair-Play | **Medium** | Demo default PGN used `[Result "*"]` | **Fixed** |
| F5 | Trademark | **Medium** | Unqualified references to Chess.com and Lichess | **Fixed** |
| F6 | Licensing | **Low** | Incomplete license disclosure for `chess.js` | **Fixed** |
| F7 | Data / Privacy | **Low** | Offline-only audit, clipboard call, and session reset bug on init | **Fixed** |

---

## Detailed Findings

### 1. Licensing Issues

#### [F1 — BLOCKING] GPLv3 Binary Redistribution & Source-Correspondence Risk
- **Files inspected**: `README.md`, `SPEC.md`, `THIRD_PARTY_NOTICES.md`, `examples/demo/main.ts`, `.gitignore`, `package.json`.
- **Risk**: v0.1.0 documentation referenced `public/vendor/stockfish-19.js` and `public/vendor/stockfish-19.wasm` (GPLv3, identifying as `"Stockfish.js 19, Copyright 2026 Chess.com, LLC"`) while stating that exact source-code correspondence had not been verified. Redistributing compiled GPLv3 JS/WASM binaries without matching source code, build instructions, and NNUE/network assets violates GPLv3 §6 and contaminates an MIT release archive. Furthermore, `.gitignore` did not exclude `public/vendor/stockfish-*`.
- **Concrete Fix Applied**:
  - Excluded all Stockfish binaries from the repository, `.gitignore` (`public/vendor/stockfish-*.js`, `public/vendor/stockfish-*.wasm`, `public/vendor/*.wasm`), `package.json`, and `make-zip.sh`.
  - Documented user-supplied binary placement in `public/vendor/README.md`, `README.md`, `SPEC.md`, and `THIRD_PARTY_NOTICES.md`, keeping WHATIF's MIT codebase cleanly separated from user-supplied GPLv3 binaries.

#### [F6 — LOW] Incomplete Third-Party Attribution for `chess.js`
- **Files inspected**: `THIRD_PARTY_NOTICES.md`, `package.json`.
- **Risk**: `THIRD_PARTY_NOTICES.md` named `chess.js` without specifying its exact license (`BSD-2-Clause`).
- **Concrete Fix Applied**: Updated `THIRD_PARTY_NOTICES.md` to explicitly record `chess.js` (`^1.4.0`) under BSD-2-Clause.

---

### 2. Fair-Play & Cheating Risk

#### [F2 — HIGH] Missing Runtime Guard on Unfinished Games (`Result "*"` / FEN)
- **Files inspected**: `src/core/whatif-core.ts`, `src/core/chess-session.ts`.
- **Risk**: Policy text alone does not prevent callers from feeding an active online game (`Result "*"` or live FEN) into the engine.
- **Concrete Fix Applied**:
  - Implemented `WhatIfCore.continueAsOpponent()` with a strict fair-play guard (`FairPlayError`) that inspects parsed PGN headers and source origin and refuses to run when `Result` is `"*"`, missing, or loaded via `loadFen()` / `loadMoves()`, unless `{ allowUnfinishedGame: true }` is explicitly passed.
  - Added `FAIR_PLAY.md` documenting this guard and online platform risks (Lichess/Chess.com ToS bans).

#### [F3 — HIGH] Unrestricted Turn Play & Unthrottled Strength Mode
- **Files inspected**: `src/core/whatif-core.ts`, `src/engine/stockfish-uci-engine.ts`, `examples/demo/main.ts`.
- **Risk**: `playEngineMove()` and the v0.1.0 demo button `"Ask Stockfish to move"` operated on *either* side's turn at unthrottled strength (`depth 14`, `UCI_LimitStrength` unset), closely resembling a real-time move advisor. Additionally, `StockfishUciEngine` left `UCI_LimitStrength` enabled across subsequent unthrottled calls.
- **Concrete Fix Applied**:
  - `continueAsOpponent()` enforces opponent-turn-only execution (`NOT_OPPONENT_TURN` error on the player's turn), requires an opponent Elo from `WhiteElo`/`BlackElo` or manual override (`MISSING_ELO`), configures `UCI_LimitStrength` + `UCI_Elo`, clamps out-of-range ratings with a warning, and returns structured metadata.
  - Updated `StockfishUciEngine.bestMove()` to explicitly set `UCI_LimitStrength value false` when unthrottled searches follow throttled searches.
  - Updated `examples/demo/` to expose `"Play opponent's move"` gated to the opponent's turn alongside player side, opponent Elo, and manual overrides.

#### [F4 — MEDIUM] Demo Default PGN Used `[Result "*"]`
- **Files inspected**: `examples/demo/index.html`.
- **Risk**: Out-of-the-box demo preloaded an unfinished game (`Result "*"`), encouraging live-position testing instead of completed-game analysis.
- **Concrete Fix Applied**: Replaced the default demo PGN with a completed `[Result "1-0"]` game containing `WhiteElo` and `BlackElo` headers.

---

### 3. Trademark & Attribution

#### [F5 — MEDIUM] Unqualified References to Chess.com and Lichess
- **Files inspected**: `THIRD_PARTY_NOTICES.md`, `README.md`, `SPEC.md`, `ARCHITECTURE.md`.
- **Risk**: Mentioning `"Chess.com"` (from the Stockfish.js 19 loader banner) and `"Lichess"` without a clear non-affiliation disclaimer risks implying endorsement or partnership.
- **Concrete Fix Applied**: Added explicit trademark and non-affiliation disclaimers in `THIRD_PARTY_NOTICES.md`, `README.md`, `FAIR_PLAY.md`, and the demo footer clarifying that WHATIF is independent and not affiliated with or endorsed by Lichess, Chess.com, LLC, or Stockfish.

---

### 4. Data, Privacy & Runtime Hygiene

#### [F7 — LOW] Offline Privacy Verification & Non-Destructive Engine Init
- **Files inspected**: All files in `src/`, `examples/demo/`, `tests/`, and `vite.config.ts`.
- **Findings**:
  - **Network / Scraping / Telemetry**: Zero `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, DOM scraping, analytics, or cookies exist anywhere in the codebase. Browser side-effects are strictly local and user-initiated: `navigator.clipboard.writeText(...)` on copy actions, a single `localStorage` key (`whatif-board-theme`) for board finish preference, and Vite `COOP`/`COEP` headers for local `SharedArrayBuffer` execution.
  - **Session Reset Bug Identified**: In v0.1.0 `examples/demo/main.ts`, clicking `"Initialize Stockfish"` disposed and recreated `WhatIfCore`, wiping any previously loaded PGN or position.
- **Concrete Fix Applied**:
  - Added `WhatIfCore.setEngine()` and updated `examples/demo/main.ts` so initializing Stockfish preserves the loaded PGN, ply, history, and manual overrides.
