# W.H.A.T.I.F. — Product Specification

> **Product:** W.H.A.T.I.F. — Chess Resume  
> **Document status:** Product and implementation specification  
> **Current target:** Chrome Manifest V3  
> **Current site adapter:** Lichess  
> **Current project version in package metadata:** `0.2.0`

## 1. Product summary

W.H.A.T.I.F. is a post-game chess continuation tool. It lets a player take an eligible completed standard-chess game, return to its final or an earlier original position, and play a new continuation against a locally bundled Stockfish engine.

The player keeps the colour they had in the original game. Stockfish plays the opposing colour. The continuation takes place on a separate board owned by the extension, not on the chess site's board.

**Product principle:** explore alternate outcomes after the original game has ended. W.H.A.T.I.F. is not a live-game assistant.

## 2. Goals

- Import supported completed games from Lichess.
- Reconstruct the position from the original move history rather than reading the site's board.
- Preserve the user's original colour.
- Let the user rewind through the original game's positions and start a continuation.
- Play the opponent's side with a locally packaged Stockfish engine.
- Adjust engine strength relative to the original opponent's rating where possible.
- Export the original move line up to the selected position plus the new continuation as PGN.
- Keep engine execution and continuation state local to the browser.

## 3. Non-goals

The current project does not aim to:

- provide analysis, hints, or move suggestions during a live game;
- interact with, click, or manipulate the site's chessboard;
- support watched games or games the signed-in account did not play;
- support chess variants or Chess960;
- resume ordinary decisive wins/losses such as checkmate, resignation, or timeout;
- upload games to a remote analysis service;
- provide a cloud account, analytics, or cross-device sync;
- implement Chess.com integration in the current release.

## 4. Supported platform and technology

| Area | Current choice |
|---|---|
| Browser | Chrome |
| Extension format | Manifest V3 |
| Language | TypeScript |
| UI | React |
| Build | Vite plus `scripts/build.mjs` |
| Chess rules and move validation | `chess.js` |
| First site adapter | Lichess |
| Engine protocol | UCI |
| Engine | Local Stockfish.js 19 JavaScript + WASM files |
| Local hand-off | `chrome.storage.local` |

The Stockfish WASM build requires cross-origin isolation. The manifest sets COOP to `same-origin` and COEP to `require-corp`; the app checks for `crossOriginIsolated` and `SharedArrayBuffer` before loading the engine. The UCI layer configures one search thread.

## 5. Eligibility rules

A game can be imported only when the extension can verify all of the following:

- the site is the supported Lichess integration;
- the signed-in account is listed as White or Black in the PGN;
- the PGN can be parsed and its move history can be legally replayed;
- the game is standard chess;
- the game record is marked finished by the adapter's parsed termination/result checks;
- the end reason is one of the supported categories below.

### Supported end reasons

| End reason | Import rule |
|---|---|
| Aborted | PGN termination indicates an abort and the result is `*`. |
| Opponent left | PGN termination indicates abandonment, leaving, or disconnection, and the result shows that the current user won. |
| Draw | PGN result is a draw (`1/2-1/2`). |
| Stalemate | The replayed final position is stalemate and the PGN result is a draw. |

### Excluded games

Live or unverified games, games played by someone else, watched games, unsupported variants, Chess960, checkmate, resignation, decisive timeout/flag results, and other ordinary decisive finishes are not eligible.

If the adapter cannot confidently classify the end reason, it must reject the game rather than guess.

## 6. Import and continuation flow

1. The user opens a Lichess game page while signed in.
2. The content script reads the game ID from the URL and obtains the signed-in account name.
3. The Lichess adapter requests the PGN using the browser's authenticated session.
4. The PGN parser identifies the user's colour, opponent metadata, time control, move history, and supported end reason.
5. The content script submits the normalized game to the service worker.
6. The service worker applies the eligibility gate and stores the accepted game locally.
7. The user opens the extension's own page using the **Continue in What If?** button or extension action.
8. The extension replays the UCI moves and displays the position on its own board.
9. The user chooses a position in the original game and starts a session against Stockfish.
10. The user can pause the session, navigate the original history, and export the resulting PGN.

## 7. Position and history rules

- The move history is replayed from the standard initial chess position using `chess.js`.
- UCI moves must be syntactically valid and legal. An invalid history must not be loaded as a trusted position.
- Castling, en passant, promotions, and move counters are reconstructed by replaying the complete move list.
- The board is oriented so the user's original colour is at the bottom.
- The user keeps their original colour; Stockfish takes the opposite colour.
- The original-game history slider selects a ply from the starting position through the imported final position.
- Rewinding or moving forward in the original history clears any continuation moves from the previously selected branch.

### Stalemate handling

A stalemate has no legal move. The default import position is therefore rewound by one ply to the nearest prior playable position. The helper searches backward if necessary until it finds a position with at least one legal move.

### Draw handling

When continuing from the final position of an imported draw, the app starts the continuation with the FEN halfmove clock reset to zero. The board placement, side to move, castling rights, en-passant field, and fullmove number are retained. The UI explains that the draw continuation uses a fresh halfmove clock.

### Abort handling

An aborted game may have no moves. Its reconstructed position is the standard starting position, and the user can start a continuation from there.

## 8. Engine strength

The app queries the engine's UCI options instead of assuming every Stockfish build supports identical controls.

Strength mapping follows these rules:

1. Use the opponent's rating when it is available and not provisional.
2. Use a disclosed fallback rating of **1450** when the rating is missing or provisional.
3. Apply the user's strength adjustment (currently a slider from `-600` to `+600`, in steps of `50`).
4. When `UCI_LimitStrength` and `UCI_Elo` are available and the target is at least the advertised minimum, set the requested Elo within the engine's advertised range.
5. Below the advertised Elo minimum, use `Skill Level` when available and apply conservative depth, node, and time limits. If `Skill Level` is unavailable, use conservative search limits and explain the fallback.
6. The UCI controller sets `Threads` to `1` for this build.

The displayed target is an estimate. Engine Elo and ratings from online chess sites are not directly equivalent, so the mapping should not be represented as an exact rating guarantee. Site and time-control offsets are currently initialized to zero.

## 9. User interface requirements

The extension page provides:

- an extension-owned interactive chessboard;
- a clear indicator for whose turn it is and whether the engine is thinking;
- original move-history navigation (restart, rewind, forward, and position slider);
- promotion selection;
- a Start/Pause session control;
- an estimated engine strength and adjustment control;
- game details including site, opponent, original rating, user's colour, and time-control category;
- a PGN export control;
- status messages for loading, import, engine startup, and errors.

The UI must not imply that an example/demo position is an imported game. It must clearly identify whether the current game is an example or imported.

## 10. PGN export

The exported PGN contains:

- the original game moves up to the selected ply;
- the moves played in the continuation;
- basic event/site/player headers;
- a result of `1-0` or `0-1` when the continuation ends in checkmate, otherwise `*`.

The export is generated locally as a `.pgn` download. It does not overwrite the source game on Lichess.

## 11. Privacy and fair play

- Engine files are bundled with the extension and run locally.
- The original PGN is fetched directly from Lichess using the user's authenticated browser session.
- The extension does not submit game data to a third-party engine or analysis service.
- No analytics, telemetry, remote game storage, or cross-device sync are part of the current scope.
- The extension does not provide live-game evaluation, hints, or move recommendations.
- The content script does not read the site's board squares or manipulate the site's board.
- Host permissions are limited to the supported site(s); the current manifest grants Lichess access only.

## 12. Current implementation status and known limitations

The current source includes the Chrome MV3 manifest, Lichess PGN import path, normalized game model, eligibility gate, UCI position replay, extension-owned React board, local Stockfish worker client, strength mapping, and PGN export.

Known limitations to keep visible:

- Lichess is the only implemented site adapter. The Chess.com directory contains future-integration notes, not a working adapter.
- Private or otherwise inaccessible Lichess PGN exports may fail to import; the extension should fail closed.
- Browser-level testing is still required for the full Lichess import and Stockfish startup flow.
- The supplied Stockfish.js/WASM files need complete matching source/build provenance before public redistribution. See `THIRD_PARTY_NOTICES.md`; including the GPL licence text by itself does not satisfy source-code obligations.
- The strength-to-rating mapping is approximate and needs calibration with real games.

## 13. Acceptance checklist

- [ ] An eligible completed Lichess game played by the signed-in user can be imported.
- [ ] A live, watched, unsupported-variant, or ordinary decisive game is rejected.
- [ ] Original moves replay legally to the correct final position.
- [ ] User colour is preserved and board orientation is correct.
- [ ] Stalemate import rewinds to a playable position.
- [ ] Draw continuation uses a fresh halfmove clock at the final drawn position.
- [ ] User can navigate the original history and start a new continuation from a selected ply.
- [ ] Stockfish loads only from local packaged files and responds through UCI.
- [ ] Engine moves are legal and the configured strength settings are applied when supported.
- [ ] PGN export contains the selected original line and all continuation moves.
- [ ] No live-game hints, site-board manipulation, third-party analysis upload, or telemetry are present.
- [ ] GPL source and build-provenance requirements are satisfied before distributing the bundled engine.

## 14. Local development commands

```bash
npm install
npm run typecheck
npm test
npm run build
```

After the build succeeds, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the generated `dist/` directory.
