# GEMINI.md — WHATIF Engine & Lichess Client Blueprint

This file gives Gemini (or any AI coding assistant / engineer) a complete, structured map of **WHATIF** so you can inspect, extend, style, or upgrade the application immediately in future chats.

---

## 1. Product Identity & Purpose

- **Name**: **WHATIF Engine & Studio** (`eddygotamends/WHATIF`)
- **Core Idea**: Dual-purpose chess app combining:
  1. **Offline WHATIF Continuation Engine**: Load any completed chess game (PGN, FEN, or synced Lichess game), rewind to a critical ply, and play alternative "what if" lines against an Elo-calibrated opponent (`PracticeEngine` built-in or user-imported `Stockfish .js + .wasm` running locally in a Web Worker).
  2. **Lichess Online Client**: Full Apple Studio Liquid Glass Lichess experience — OAuth PKCE & Personal Token sign-in, live Lichess Board API gameplay (Lobby Seek, Challenge Friend, Lichess AI), Puzzles (Daily + Storm + Personal Dashboard), Learn (Chess Basics, Practice, Community Studies), and Watch (Lichess TV live PGN exploration).
- **Fair-Play Invariant**: Live games run cleanly via Lichess Board API (`live-lichess` mode) with zero engine assistance. WHATIF engine analysis/continuation is restricted to finished games, offline games, or explicit analysis sessions (`FAIR_PLAY.md`).

---

## 2. Tech Stack & Commands

- **Runtime / Bundler**: React `19.1.0`, TypeScript `5.8.3` (`strict: true`, `noUnusedLocals`, `noUnusedParameters`), Vite `6.3.5` (dev server port `3000`).
- **Styling**: Tailwind CSS `4.1.5` (`@tailwindcss/vite`, imported via `@import "tailwindcss";` in `src/index.css`). Avoid external CSS frameworks or bloated component libraries.
- **Chess Logic**: `chess.js` `^1.4.0`.
- **Icons**: `lucide-react` `^0.511.0`.
- **Mobile Packaging**: Capacitor (`capacitor.config.json`) + GitHub Actions APK pipeline (`.github/workflows/build-apk.yml`).

### Scripts (`package.json`)
```bash
npm run dev       # Starts Vite on http://0.0.0.0:3000
npm run lint      # Runs tsc --noEmit (must pass with 0 errors)
npm run build     # Production Vite bundle -> dist/
npm run preview   # Preview production dist/
```

---

## 3. Repository & Module Map

```text
├── GEMINI.md                         # This architecture & upgrade guide
├── FAIR_PLAY.md                      # Engine restriction policy for fair play
├── capacitor.config.json             # Capacitor Android WebView wrapper (webDir: "dist")
├── .github/workflows/build-apk.yml   # CI workflow that compiles dist/ -> WHATIF-debug.apk
├── public/
│   ├── WL.png                        # App icon / logo
│   └── auth/lichess/callback/index.html  # Popup target for Lichess OAuth PKCE callback
├── src/
│   ├── index.ts                      # Public core/engine exports
│   ├── browser.ts                    # BrowserWorkerTransport wrapper export
│   ├── index.css                     # Tailwind v4 + Apple Studio Liquid Glass & Gloss/Matte classes
│   ├── main.tsx                      # React 19 entry point
│   ├── App.tsx                       # Root shell, navigation, Lichess polling/streams, Arena wiring
│   ├── audio/
│   │   └── sound-engine.ts           # Web Audio synthesized move/capture/check/illegal cues
│   ├── core/
│   │   ├── types.ts                  # SessionState, MoveRecord, GameMetadata, FairPlayError, MoveEngine
│   │   ├── chess-session.ts          # PGN/FEN parser, smart Elo & player-side auto-detection
│   │   └── whatif-core.ts            # Stateful controller enforcing fair-play & Elo clamping
│   ├── engine/
│   │   ├── practice-engine.ts        # Built-in pure-TS Elo-calibrated tactical search fallback
│   │   ├── stockfish-uci-engine.ts   # UCI protocol driver (UCI_LimitStrength / UCI_Elo)
│   │   ├── stockfish-importer.ts     # IndexedDB + Blob Worker bootstrapper for user .js/.wasm files
│   │   └── uci-transport.ts          # Abstract transport interface
│   ├── platform/
│   │   └── browser-worker.ts         # Web Worker UCI transport implementation
│   ├── services/
│   │   └── lichess-client.ts         # Lichess OAuth PKCE, REST & NDJSON stream client
│   ├── data/
│   │   └── sample-games.ts           # Offline sample PGNs with recommended critical plies
│   └── components/
│       ├── ChessBoard.tsx            # Gloss/Matte SVG interactive board, legal dots, drag/tap/promo
│       ├── ChessPieceSvg.tsx         # Crisp vector chess pieces with specular Gloss & soft Matte finishes
│       ├── MaterialStrip.tsx         # Compact capture diff & advantage strip above/below board
│       ├── InspectorDrawer.tsx       # 3-tab drawer: Continuation | Game Info | Engine & Output
│       ├── PlaySheetModal.tsx        # Floating Play action sheet (Lobby, Friend, Lichess AI, Bot, OTB)
│       ├── PuzzlesView.tsx           # Lichess Daily Puzzle interactive trainer + Themes + Storm + Dashboard
│       ├── LearnView.tsx             # Interactive Practice drills & Live Lichess Community Studies
│       ├── WatchView.tsx             # Live Lichess TV channels + Master Games explorer
│       ├── MoreView.tsx              # Unified hub: Customization, Stockfish Importer, Tools, GitHub ZIP
│       ├── MinimalSwitch.tsx         # Sleek iOS-style toggle row used in Settings
│       ├── ImportModal.tsx           # Slide-over PGN / FEN / Stockfish binary uploader
│       ├── LichessConnectModal.tsx   # OAuth PKCE popup login, API token paste, or username sync
│       └── FairPlayModal.tsx         # Fair Play policy & About info modal
```

---

## 4. UI & Design System (Sleek Apple Studio Liquid Glass)

### Visual Grammar (`src/index.css`)
- **Background**: Deep charcoal `#06080D` paired with 4 blurred CSS radial aurora blobs (`.animate-aurora-a` / `.animate-aurora-b`) creating an Apple Studio Rainbow Mesh behind glass cards.
- **Glass Surfaces**:
  - `.liquid-glass`: Dark translucent gradient (`blur(36px) saturate(165%)`), hairline `1px solid rgba(255,255,255,0.14)`, top specular inset border `inset 0 1px 0 rgba(255,255,255,0.18)`.
  - `.liquid-glass-subtle`: Secondary buttons & toggles (`rgba(255,255,255,0.075)`, `blur(24px)`).
  - `.liquid-glass-dock`: Floating bottom 5-tab pill dock (`blur(42px) saturate(185%)`).
  - `.apple-blue-btn`: Apple Blue gradient (`#1b8eff -> #0070e0`) reserved strictly for primary CTAs (`Play`, `Continue Session`, `Connect Lichess`, `Play opponent's move`).
- **Motion**: Crisp micro-animations with `prefers-reduced-motion` support:
  - `.animate-view-enter` (`view-enter 220ms`) on tab/arena transitions
  - `.animate-sheet-up` (`sheet-up 240ms`) on modals/sheets
  - `.animate-piece-land` (`piece-land 200ms`) on newly moved chess pieces
- **Compact / Sleek Density Rules** (IMPORTANT when upgrading UI):
  - **Do NOT make cards chubby or padded out.** Keep containers centered (`max-w-2xl` on list views, `max-w-[1160px]` on arena), card radius `rounded-2xl`, card padding `p-4 sm:p-5` (or `p-3.5` for sub-cards), list rows `py-2.5 px-3.5 text-[13px]`.
  - Keep switches minimal (`MinimalSwitch`: `h-5 w-9` pill, single-line caption) and place **all customization & engine management inside `More > Settings`** — never clutter the Play arena or Home screen with extra toggles or debug widgets.
  - Primary navigation stays a **5-tab bottom dock** (`Home`, `Puzzles`, `Learn`, `Watch`, `More`) plus a single **floating Play pawn button** (`bottom-[68px] right-4`).
  - **Board Aesthetics (`ChessBoard.tsx` & `ChessPieceSvg.tsx`)**:
    - Supports 6 themes (`natural-walnut`, `emerald-club`, `obsidian-glass`, `ocean-slate`, `classic-maple`, `midnight-violet`) plus a real-time **Finish toggle (`gloss` vs `matte`)**.
    - `.board-gloss-sheen` adds an angled studio specular reflection over squares and glossy SVG gradients on pieces; `.board-matte-grain` adds micro-grain tactile texture and diffuse piece lighting.

---

## 5. Key Logic Systems & Invariants

### A. Smart Auto-Elo & Side Inference (`src/core/chess-session.ts`)
- Parses PGN headers (`White`, `Black`, `WhiteElo`, `BlackElo`, `Result`, `Termination`, `FEN`, `SetUp`, `Opening`, `TimeControl`).
- Infers player side (`white` | `black`) automatically using:
  1. Connected Lichess username(s) (`knownPlayerNames`) matched against PGN `White`/`Black` tags (case-insensitive).
  2. Heuristic `Opponent_<ELO>` placeholder detection (often exported by training tools).
  3. Winner/loser fallback when explicit side tags exist.
- Automatically picks `opponentElo` from the opposing player's header Elo or numeric suffix in `Opponent_<ELO>` names, allowing manual override in `InspectorDrawer`.

### B. Fair-Play Gatekeeper (`src/core/whatif-core.ts`)
- `WhatIfCore.continueGame(...)` throws `FairPlayError` if:
  - Game appears unfinished (`*` result or `isFinished === false`) unless `allowUnfinishedGame` override is explicitly toggled on by the user in Settings.
  - Current board turn does not belong to `opponentSide`.
  - `opponentElo` is unset (`MISSING_ELO`).
  - Engine is missing (`NO_ENGINE`) or game is already over (`GAME_OVER`).

### C. Local Stockfish `.js` + `.wasm` Importer (`src/engine/stockfish-importer.ts`)
- Lets users upload local `stockfish.js` (single-file) or paired `stockfish.js + stockfish.wasm` in the browser without rebuilding the app.
- Persists `ArrayBuffer`s in IndexedDB (`whatif-stockfish-db` / `active-stockfish-bundle`) so imported Stockfish stays active across reloads.
- `createWorkerFromBundle()` creates Blob URLs for JS and WASM, injects a worker bootstrap shim overriding `Module.locateFile` and `self.fetch` for `.wasm` URLs, calls `importScripts(jsUrl)`, and passes `Worker` to `BrowserWorkerTransport` -> `StockfishUciEngine`.

### D. Lichess Online Integration (`src/services/lichess-client.ts`)
- **Auth**: Supports OAuth2 PKCE popup flow (`/auth/lichess/callback/index.html` posts `{ type: "LICHESS_OAUTH_CALLBACK", code, state }` back to `window.opener`), personal access token (`lip_...`), or public username lookup.
- **Endpoints Used**:
  - Account & Social: `GET /api/account`, `GET /api/user/{username}`, `GET /api/challenge`, `GET /api/games/user/{username}`
  - Live Gameplay: `POST /api/board/seek`, `POST /api/challenge/{username}`, `POST /api/challenge/ai`, `GET /api/stream/event`, `GET /api/board/game/stream/{id}`, `POST /api/board/game/{id}/move/{uci}`, `abort`, `resign`
  - Puzzles, Learn & Watch: `GET /api/puzzle/daily`, `GET /api/study/all.pgn` (or hot studies), `GET /api/tv/channels`

---

## 6. Android APK Packaging

This project is Capacitor-ready:
- **`capacitor.config.json`**: Configures `appId: "app.whatif.studio"`, `appName: "WHATIF"`, and `webDir: "dist"`.
- **Automated Cloud Build (`.github/workflows/build-apk.yml`)**: Pushing to GitHub on `main`/`master` (or manually triggering **Run workflow** in GitHub Actions) installs Node 20 + JDK 21, runs `npm run build`, attaches `@capacitor/android`, syncs `dist/`, builds `app-debug.apk` via Gradle, and uploads **`WHATIF-debug-apk`** as a downloadable build artifact.
- **Compiled Binary**: Ready-to-install `WHATIF.apk` is also served at `/WHATIF.apk` (under **More → Download Android APK (.apk)**).
- **Local Build**:
  ```bash
  npm install
  npm run build
  npx cap add android   # first time only
  npx cap sync android
  cd android && ./gradlew assembleDebug
  # Output: android/app/build/outputs/apk/debug/app-debug.apk
  ```

---

## 7. Checklist When Upgrading WHATIF in Future Chats

1. Keep TypeScript clean (`npm run lint` must exit `0` with `noUnusedLocals` / `noUnusedParameters`).
2. Keep `ChessBoard.tsx` and `ChessPieceSvg.tsx` high-contrast and gloss/matte-aware — never regress into washed-out or flat squares.
3. Preserve compact/sleek mobile density (`rounded-2xl`, `p-4`, tight dock, minimal clutter).
4. Never connect an engine to `live-lichess` mode (`App.tsx` intentionally separates `arenaMode === "live-lichess"` from `"whatif"`).
5. Regenerate `/public/WHATIF-github-export.zip` (excluding `node_modules`, `dist`, `.git`) if shipping an updated downloadable archive inside `MoreView.tsx`.
