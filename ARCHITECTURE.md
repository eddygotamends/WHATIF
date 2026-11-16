# W.H.A.T.I.F. — Architecture

> **Project:** W.H.A.T.I.F. — Chess Resume  
> **Platform:** Chrome Extension, Manifest V3  
> **Current site integration:** Lichess  
> **Chess rules:** `chess.js`  
> **Engine:** locally bundled Stockfish.js 19

## 1. Overview

W.H.A.T.I.F. is a post-game chess continuation tool. It recognises an eligible completed Lichess game, imports its PGN, reconstructs the position from the move history, and opens an extension-owned board where the player can continue against a locally running Stockfish engine.

The extension does not read chess pieces from the Lichess board, alter the Lichess game, or provide help during an active game. The continuation happens on a separate extension page.

## 2. High-level component diagram

```text
                   LICHESS GAME PAGE
                           |
                           v
                Content script (Lichess)
                - Reads game ID from URL
                - Gets signed-in account
                - Requests the game's PGN
                - Does not inspect board squares
                           |
                           v
                    LichessAdapter
                - Parses PGN headers and moves
                - Identifies player colour
                - Classifies supported end reason
                           |
                           v
                  Chrome runtime messaging
                           |
                           v
                 Manifest V3 service worker
                - Re-checks eligibility
                - Stores pending game locally
                - Opens extension page
                           |
                           v
                EXTENSION-OWNED REACT PAGE
                - Loads pending game from storage
                - Replays UCI moves with chess.js
                - Displays board and move history
                - Handles rewind and continuation
                           |
              +------------+-------------+
              |                          |
              v                          v
       chess.js rules              StockfishClient
       and position state           UCI controller
                                         |
                                         v
                                  Dedicated Worker
                                  local Stockfish.js
                                  + Stockfish WASM
```

## 3. Runtime responsibilities

### Lichess content script

**Location:** `src/content/lichess.content.ts`

The content script runs on matching Lichess pages. It:

1. Reads the game ID from the page URL.
2. Retrieves the signed-in username through the Lichess account API.
3. asks `LichessAdapter` to fetch and parse the game's PGN using the user's authenticated browser session.
4. Sends a normalized game record to the extension service worker.
5. Adds a **Continue in What If?** button only after the background confirms that the game passed the eligibility check.

It does not read piece locations, move lists, or board state from the page's rendered board. The move history comes from the PGN export.

### Site adapter

**Locations:**

- `src/adapters/site-adapter.ts`
- `src/adapters/lichess/lichess.adapter.ts`
- `src/adapters/lichess/lichess-pgn.ts`

The adapter is responsible for site-specific retrieval and parsing. It normalizes the game into the shared `NormalizedGame` model, including:

- site and game ID;
- UCI move list;
- the current user's colour;
- opponent name, rating, and provisional-rating flag;
- time-control category;
- supported end reason;
- finished-game and player-participation flags;
- standard-chess variant marker.

The adapter must fail closed when it cannot establish the player's identity, participation, supported variant, move history, or an eligible end reason.

### Manifest V3 service worker

**Location:** `src/background.ts`

The service worker handles extension messages. It re-checks incoming game data with `isEligibleGame`, stores an accepted game under `pendingContinuation` in `chrome.storage.local`, and opens the extension page when requested.

The service worker does not run the chess engine. It is event-driven and is not used as a long-running engine process.

### Extension UI

**Location:** `src/ui/main.tsx`

The React page owns the continuation experience. It:

- loads a pending game from local extension storage;
- reconstructs positions by replaying UCI moves from the standard initial position;
- uses `chess.js` for legal moves, check, checkmate, stalemate, and draw state;
- preserves the user's original colour and assigns the opposite colour to Stockfish;
- allows navigation through the original game's ply history;
- supports promotion selection;
- starts, pauses, and resumes the local engine session;
- exports the selected original line plus continuation as a PGN file.

The board is extension-owned. The extension does not click, move, or otherwise control the Lichess board.

### Chess domain

**Locations:**

- `src/domain/types.ts`
- `src/domain/eligibility.ts`
- `src/domain/position.ts`
- `src/domain/strength.ts`

The domain layer contains site-independent models and rules:

- normalized game and engine types;
- supported-game eligibility checks;
- legal replay of UCI histories;
- stalemate rewind selection;
- continuation FEN handling;
- opponent-rating-to-engine-strength mapping.

No DOM or Lichess-specific parsing belongs in this layer.

### Engine subsystem

**Locations:**

- `src/engine/engine-client.ts`
- `src/engine/uci.ts`
- `public/vendor/stockfish-19.js`
- `public/vendor/stockfish-19.wasm`

`StockfishClient` creates a dedicated Web Worker for the locally bundled Stockfish.js build and communicates with it through UCI commands. The engine files are loaded from the extension package; they are not fetched from a CDN.

The supplied WASM build requires cross-origin isolation support. The extension manifest configures COOP (`same-origin`) and COEP (`require-corp`), and the UI checks `crossOriginIsolated` and `SharedArrayBuffer` before starting the engine. The UCI controller sets the engine's search thread count to one. This is a multi-thread-capable WASM build configured for one search thread, not a claim that the binary itself is a single-threaded build.

## 4. Data flow

1. A user visits a Lichess game page.
2. The content script extracts the game ID and obtains the signed-in username.
3. The adapter requests the PGN from Lichess using the browser's authenticated session.
4. The PGN parser verifies that the account is one of the players, replays the PGN with `chess.js`, and classifies the supported termination.
5. The content script sends the normalized record to the service worker.
6. The service worker applies the shared eligibility gate and stores an accepted record locally.
7. The user opens W.H.A.T.I.F.; the UI reads the pending record and validates/replays its UCI history.
8. The UI creates a separate continuation session. Stockfish is loaded only when the user starts the engine session.
9. The UI can export the selected original moves and the new continuation as PGN.

## 5. Message and storage boundary

The current runtime messages are:

- `STORE_FINISHED_GAME` — submit a normalized game for eligibility validation and local storage.
- `OPEN_CONTINUATION` — request that the service worker opens the extension page.

The temporary hand-off key in `chrome.storage.local` is `pendingContinuation`. The UI removes the key after successfully loading the imported game.

Do not put engine execution, board rendering, or long-running computation in the service worker.

## 6. Adding another chess site

A future site integration should:

1. implement the `SiteAdapter` contract;
2. retrieve game data through a documented/allowed source;
3. verify that the signed-in user participated and that the game is finished;
4. convert the move history to UCI and populate `NormalizedGame`;
5. fail closed for unsupported variants, missing identity, or uncertain termination;
6. add the required host permission and content-script match in `manifest.json`;
7. add parser and eligibility tests.

Do not add live-game assistance, DOM board scraping, or site-board manipulation as part of an adapter.

## 7. Repository map

```text
.
├── manifest.json
├── index.html
├── package.json
├── vite.config.ts
├── scripts/
│   └── build.mjs
├── src/
│   ├── adapters/
│   │   ├── site-adapter.ts
│   │   ├── lichess/
│   │   └── chesscom/       # future integration notes only
│   ├── content/
│   ├── domain/
│   ├── engine/
│   ├── ui/
│   └── background.ts
├── public/vendor/
│   ├── stockfish-19.js
│   ├── stockfish-19.wasm
│   └── third-party notices and licence text
└── tests/
```

## 8. Security, privacy, and fair-play boundaries

- The tool is for completed games only.
- There are no live-game evaluations, hints, or move recommendations.
- The extension operates on a separate board and never manipulates the site's board.
- The engine runs locally from packaged files.
- The PGN is requested from Lichess directly; game data is not sent to a third-party analysis service by this design.
- No analytics, telemetry, or remote game storage are part of the current architecture.
- Host access is limited to Lichess in the current manifest.
- No remotely hosted executable code or CDN-loaded engine is required.

## 9. Build and verification

The project uses Vite for the extension page and service worker, and a separate build step to produce a classic-script Lichess content script. The extension output is written to `dist/`.

Useful commands:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Load the generated `dist/` directory through `chrome://extensions` with Developer mode enabled. A successful typecheck or unit test run does not replace an end-to-end browser test of Lichess import, extension-page isolation, and Stockfish startup.
