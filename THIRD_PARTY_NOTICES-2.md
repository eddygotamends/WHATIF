# Third-party notices

- React, React DOM, Vite, TypeScript, Vitest, and chess.js are distributed under their respective upstream licenses. Review package notices before redistribution.
- `public/vendor/stockfish-19.js` and `public/vendor/stockfish-19.wasm` are the locally bundled Stockfish.js 19 browser build supplied for this project. The JavaScript loader identifies itself as © 2026 Chess.com, LLC and states GPLv3; the accompanying `public/vendor/Copying.txt` contains the GNU GPL version 3 license text. The supplied upstream README is preserved at `public/vendor/README-Stockfish.md`.

## Source-code compliance is still a release blocker

The supplied files do not include the complete corresponding source for this exact Stockfish.js/WASM build or enough build metadata to prove a source-to-binary match. Before redistributing a release, obtain and include the corresponding source (or provide a GPL-compliant written source offer), preserve required notices, and verify the exact build provenance. Do not treat the presence of `Copying.txt` alone as completing the GPL source obligations.
