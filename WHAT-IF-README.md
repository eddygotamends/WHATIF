# W.H.A.T.I.F.

**Web History Alternative Timeline Interactive Framework**

> **Continue the game after the game is over.**

W.H.A.T.I.F. is an experimental Chrome extension that lets you revisit an eligible, completed standard-chess game, rewind to an earlier position, and explore an alternate continuation against a locally bundled Stockfish engine.

The idea is simple: a finished game does not have to be the end of the story. Choose a position, keep your original colour, and see what might have happened next.

## What it does

- **Revisit completed games.** The first site integration targets Lichess and uses game data/PGN rather than reading piece positions from the website's board interface.
- **Rewind the position.** Return to an earlier point in the recorded move sequence and continue from there.
- **Keep your colour.** You play the same colour you played in the original game; Stockfish takes the other side.
- **Adjust the engine strength.** The app queries the bundled engine's UCI options and uses the options it actually supports, with search limits as a fallback.
- **Export the continuation.** Save the original game moves together with the new continuation as a PGN.
- **Run locally.** Stockfish runs in a Worker from files bundled with the extension. The project is not designed to send games to a separate What If? server.

## Project status

**This is an early prototype, not a release-ready extension.** The repository contains the extension scaffold, an extension-owned playable board, a local Stockfish.js 19 integration, an initial Lichess PGN/import path, and basic PGN export.

The following still need verification or further work:

- Full dependency installation, production build, and automated test run.
- Loading and exercising the extension in Chrome.
- End-to-end testing against real completed Lichess games and their termination metadata.
- Broader PGN compatibility and additional edge-case tests.
- A Chess.com adapter; it is not implemented yet.

The engine's UCI startup and a sample search were smoke-tested under Node, but that does **not** replace a full Chrome/browser test. Do not treat the prototype as verified until the outstanding checks are completed.

## Fair-play boundary

W.H.A.T.I.F. is intended for **completed games only**. It is not a live-game assistant and must not provide analysis, hints, or move suggestions while a game is in progress.

The project is designed not to interact with the chess site's live board or scrape piece positions from its UI. It reconstructs positions from the recorded move history. When the site, game status, player identity, variant, or ending reason cannot be verified confidently, the extension should not offer a continuation.

Live-game assistance, watched games, chess variants, Chess960, and ordinary decisive finishes such as checkmate or resignation are outside the current scope.

## Technology

- Chrome Extension Manifest V3
- TypeScript, React, and Vite
- `chess.js` for chess rules and position handling
- Stockfish.js 19 compiled to WebAssembly (WASM), running in a dedicated Worker
- Lichess as the first planned/implemented site adapter

## Getting started

### Requirements

- Node.js 20 or newer
- npm
- Google Chrome or a Chromium-based browser

### Install dependencies

```bash
git clone https://github.com/YOUR-USERNAME/what-if-chess-resume.git
cd what-if-chess-resume
npm install
```

Replace `YOUR-USERNAME` with the GitHub account or organisation that hosts the repository.

### Available commands

```bash
npm run dev       # Start the Vite development server
npm test           # Run the automated tests once
npm run test:watch # Run tests in watch mode
npm run typecheck  # Run the TypeScript type check
npm run build      # Type-check and create the extension build
```

### Load the built extension in Chrome

1. Install dependencies and create the build by running `npm install` and `npm run build`.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the generated `dist/` directory.

The extension's browser behaviour and the local engine setup still require end-to-end validation. The build command is documented here, but a successful production build has not yet been verified in the development environment used to prepare this prototype.

## Privacy approach

The intended design has no analytics, telemetry, user account system, remote storage, or cloud sync. The chess engine runs locally in the browser. A site adapter may retrieve game information from the supported chess site, but W.H.A.T.I.F. is not designed to upload that information to a separate application server.

Only the minimum browser and site permissions needed for the integration should be requested. Remote executable code and tracking are out of scope.

## Licensing

The project's own code is intended to be licensed under the MIT License. Stockfish is a separate component distributed under **GNU GPLv3**; the project's MIT license does not replace or override the engine's license.

Before redistributing a release containing the supplied Stockfish.js/WASM build, obtain and include the exact corresponding source code or another GPL-compliant source offer, and verify that the required notices and source materials accompany the binary. The matching source for the supplied engine build has not yet been verified, so this prototype should not be treated as ready for redistribution. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and the included license materials.

## Roadmap

- [ ] Verify Lichess completed-game detection and PGN import against real games.
- [ ] Confirm game identity, player colour, variant, result, and ending reason before enabling continuation.
- [ ] Validate the extension and multithreaded WASM engine in Chrome.
- [ ] Expand tests for stalemate rewind, draws, and other eligible endings.
- [ ] Improve PGN compatibility and export coverage.
- [ ] Investigate a Chess.com integration only when a reliable and permitted data source is available.
- [ ] Complete the Stockfish source and licensing checks before redistributing a release.

## Contributing

Bug reports, testing notes, and contributions are welcome. Please preserve the completed-game-only fair-play boundary. Do not add live-game assistance, hidden engine analysis, board scraping, or undocumented site endpoints.

Before submitting a change, run:

```bash
npm test
npm run typecheck
npm run build
```

In your pull request, state which commands you ran and include relevant output, especially for browser or engine changes.

## Project files

- [`SPEC.md`](SPEC.md) — product requirements and scope
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture overview
- [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) — third-party licensing notes
- [`LICENSE`](LICENSE) — project license

## Disclaimer

W.H.A.T.I.F. is an independent experimental project and is not affiliated with, endorsed by, or sponsored by Lichess, Chess.com, or the Stockfish project. Product and site names are used only to identify intended integrations. Follow each chess site's terms and policies when using or developing an adapter.
