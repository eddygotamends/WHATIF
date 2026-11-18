import type { EngineSearchRequest, MoveEngine } from "../core/types";
import type { UciTransport } from "./uci-transport";

export class StockfishUciEngine implements MoveEngine {
  public readonly name = "Stockfish WASM (UCI)";
  public readonly minElo = 1320;
  public readonly maxElo = 3190;

  private readonly transport: UciTransport;
  private initialized = false;
  private pendingBestMove: ((move: string | null) => void) | null = null;
  private pendingReject: ((err: Error) => void) | null = null;
  private lastLimitStrength: boolean | null = null;
  private lastElo: number | null = null;

  constructor(transport: UciTransport) {
    this.transport = transport;
    this.transport.onLine((line) => this.handleLine(line));
    this.transport.onError((err) => {
      if (this.pendingReject) {
        const reject = this.pendingReject;
        this.pendingBestMove = null;
        this.pendingReject = null;
        reject(err);
      }
    });
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.waitForLine("uciok", () => {
      this.transport.send("uci");
    }, 6000);

    await this.waitForLine("readyok", () => {
      this.transport.send("isready");
    }, 6000);

    this.initialized = true;
  }

  public async bestMove(
    fen: string,
    limits?: EngineSearchRequest
  ): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (limits?.targetElo !== undefined) {
      const clampedElo = Math.max(this.minElo, Math.min(this.maxElo, Math.round(limits.targetElo)));
      if (this.lastLimitStrength !== true) {
        this.transport.send("setoption name UCI_LimitStrength value true");
        this.lastLimitStrength = true;
      }
      if (this.lastElo !== clampedElo) {
        this.transport.send(`setoption name UCI_Elo value ${clampedElo}`);
        this.lastElo = clampedElo;
      }
    } else if (this.lastLimitStrength !== false) {
      // Explicitly reset UCI_LimitStrength when unthrottled searches follow throttled calls
      this.transport.send("setoption name UCI_LimitStrength value false");
      this.lastLimitStrength = false;
    }

    this.transport.send(`position fen ${fen}`);

    const goParts = ["go"];
    if (limits?.depth) goParts.push(`depth ${limits.depth}`);
    if (limits?.moveTimeMs) goParts.push(`movetime ${limits.moveTimeMs}`);
    if (!limits?.depth && !limits?.moveTimeMs) goParts.push("movetime 650");

    return new Promise<string | null>((resolve, reject) => {
      this.pendingBestMove = resolve;
      this.pendingReject = reject;
      this.transport.send(goParts.join(" "));
    });
  }

  public stop(): void {
    this.transport.send("stop");
    if (this.pendingBestMove) {
      const resolve = this.pendingBestMove;
      this.pendingBestMove = null;
      this.pendingReject = null;
      resolve(null);
    }
  }

  public dispose(): void {
    this.stop();
    this.transport.dispose();
  }

  private handleLine(rawLine: string): void {
    const line = rawLine.trim();
    if (line.startsWith("bestmove ")) {
      const token = line.split(/\s+/)[1];
      const resolve = this.pendingBestMove;
      this.pendingBestMove = null;
      this.pendingReject = null;
      if (resolve) {
        resolve(!token || token === "(none)" ? null : token);
      }
    }
  }

  private waitForLine(
    expectedPrefix: string,
    trigger: () => void,
    timeoutMs: number
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        unsubLine();
        unsubError();
        reject(new Error(`Timed out waiting for "${expectedPrefix}" from Stockfish worker.`));
      }, timeoutMs);

      const unsubLine = this.transport.onLine((line) => {
        if (!settled && line.trim().startsWith(expectedPrefix)) {
          settled = true;
          clearTimeout(timer);
          unsubLine();
          unsubError();
          resolve();
        }
      });

      const unsubError = this.transport.onError((err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          unsubLine();
          unsubError();
          reject(err);
        }
      });

      trigger();
    });
  }
}
