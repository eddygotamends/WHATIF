import type { UciTransport } from "../engine/uci-transport";

export function createStockfishWorker(scriptPath = "/vendor/stockfish-19.js"): Worker {
  return new Worker(scriptPath);
}

export class BrowserWorkerTransport implements UciTransport {
  private readonly worker: Worker;
  private readonly lineListeners = new Set<(line: string) => void>();
  private readonly errorListeners = new Set<(err: Error) => void>();

  constructor(worker: Worker) {
    this.worker = worker;

    this.worker.onmessage = (event: MessageEvent) => {
      const payload = typeof event.data === "string" ? event.data : String(event.data ?? "");
      for (const line of payload.split(/\r?\n/)) {
        if (line.trim().length > 0) {
          for (const listener of this.lineListeners) {
            listener(line);
          }
        }
      }
    };

    this.worker.onerror = (event: ErrorEvent) => {
      const message =
        event.message ||
        "Failed to load Stockfish worker. Ensure stockfish-19.js and stockfish-19.wasm are placed in public/vendor/.";
      const err = new Error(message);
      for (const listener of this.errorListeners) {
        listener(err);
      }
    };
  }

  public send(command: string): void {
    this.worker.postMessage(command);
  }

  public onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener);
    return () => {
      this.lineListeners.delete(listener);
    };
  }

  public onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  public dispose(): void {
    this.lineListeners.clear();
    this.errorListeners.clear();
    this.worker.terminate();
  }
}
