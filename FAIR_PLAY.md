# Fair-Play Policy & Usage Boundaries

WHATIF Engine is built **exclusively for offline post-game analysis** of completed chess games. It must never be used as a live-game assistant or connected to an active online match.

## Technical Guardrails Built Into `@whatif/engine`

1. **Completed-Game Guard (`allowUnfinishedGame` defaults to `false`)**:
   - `WhatIfCore.continueAsOpponent()` inspects the loaded game's PGN `Result` header.
   - If `Result` is `"*"`, missing, or the position came from a raw `loadFen()` / `loadMoves()` call without a completed game result, `continueAsOpponent()` throws `FairPlayError` (`code: "UNFINISHED_GAME"`).
   - Passing `{ allowUnfinishedGame: true }` is strictly for explicit offline position study and must never be enabled for active online games.
2. **Opponent-Turn-Only Enforcement**:
   - `continueAsOpponent()` verifies the active turn matches the inferred or overridden opponent color and throws `FairPlayError` (`code: "NOT_OPPONENT_TURN"`) if called on the user's turn.
3. **Elo-Throttled Opponent Emulation**:
   - `continueAsOpponent()` requires a resolved opponent rating (`WhiteElo`/`BlackElo` header or manual override) and configures Stockfish with `UCI_LimitStrength = true` and `UCI_Elo` clamped to the engine's supported bounds.
4. **Zero Network & Zero Scraping Guarantee**:
   - This library makes **zero** HTTP/WebSocket calls, contains **no** DOM scrapers, **no** browser extension scripts, and **no** Lichess or Chess.com account/API integration.

## Risks of Misuse With Online Platforms (Lichess / Chess.com)

- **Fair-Play / Cheating Bans**: Using any chess engine—even an Elo-throttled build—to evaluate positions or suggest moves during an ongoing rated or casual online game violates Lichess and Chess.com Fair Play Policies and results in permanent account closure.
- **API / Automation Violations**: Automated scraping of live game boards or unauthorized bot play violates platform Terms of Service.
- **Safe Workflow**: Wait until a game has officially concluded (`1-0`, `0-1`, or `1/2-1/2`), manually export the finished PGN, and load that completed PGN into WHATIF offline to explore alternative lines.
