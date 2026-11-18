export interface UciTransport {
  send(command: string): void;
  onLine(listener: (line: string) => void): () => void;
  onError(listener: (error: Error) => void): () => void;
  dispose(): void;
}
