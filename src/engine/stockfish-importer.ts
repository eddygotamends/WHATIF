const DB_NAME = "whatif-stockfish-db";
const STORE_NAME = "binaries";
const RECORD_KEY = "active-stockfish-bundle";

export interface StoredStockfishBundle {
  jsName: string;
  jsBuffer: ArrayBuffer;
  wasmName?: string;
  wasmBuffer?: ArrayBuffer;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB unavailable"));
  });
}

export async function saveStockfishBundle(
  bundle: StoredStockfishBundle
): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(bundle, RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to save Stockfish bundle"));
    });
  } finally {
    db.close();
  }
}

export async function loadSavedStockfishBundle(): Promise<StoredStockfishBundle | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  try {
    return await new Promise<StoredStockfishBundle | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(RECORD_KEY);
      req.onsuccess = () => resolve((req.result as StoredStockfishBundle | undefined) ?? null);
      req.onerror = () => reject(req.error ?? new Error("Failed to read Stockfish bundle"));
    });
  } finally {
    db.close();
  }
}

export async function clearSavedStockfishBundle(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Failed to clear Stockfish bundle"));
    });
  } finally {
    db.close();
  }
}

export interface CreatedWorkerHandle {
  worker: Worker;
  revokeUrls: () => void;
}

export function createWorkerFromBundle(
  bundle: StoredStockfishBundle
): CreatedWorkerHandle {
  const urlsToRevoke: string[] = [];

  const jsBlob = new Blob([bundle.jsBuffer], { type: "application/javascript" });
  const jsUrl = URL.createObjectURL(jsBlob);
  urlsToRevoke.push(jsUrl);

  let wasmUrl: string | null = null;
  if (bundle.wasmBuffer) {
    const wasmBlob = new Blob([bundle.wasmBuffer], { type: "application/wasm" });
    wasmUrl = URL.createObjectURL(wasmBlob);
    urlsToRevoke.push(wasmUrl);
  }

  // Bootstrap worker configures Emscripten/Stockfish locateFile + wasmBinary before loading the JS
  const bootstrapCode = wasmUrl
    ? `
      self.Module = self.Module || {};
      self.Module.locateFile = function (path) {
        if (path && path.endsWith(".wasm")) return ${JSON.stringify(wasmUrl)};
        return path;
      };
      // Some stockfish.js builds read wasm URL from location.hash
      try {
        if (!self.location.hash) {
          // fallback handled by locateFile and fetch intercept below
        }
      } catch (e) {}
      var origFetch = self.fetch;
      self.fetch = function (input, init) {
        var url = typeof input === "string" ? input : (input && input.url ? input.url : "");
        if (url && url.indexOf(".wasm") !== -1) {
          return origFetch(${JSON.stringify(wasmUrl)}, init);
        }
        return origFetch(input, init);
      };
      importScripts(${JSON.stringify(jsUrl)});
    `
    : `
      importScripts(${JSON.stringify(jsUrl)});
    `;

  const bootstrapBlob = new Blob([bootstrapCode], {
    type: "application/javascript",
  });
  const bootstrapUrl = URL.createObjectURL(bootstrapBlob);
  urlsToRevoke.push(bootstrapUrl);

  const worker = new Worker(bootstrapUrl);

  return {
    worker,
    revokeUrls: () => {
      for (const u of urlsToRevoke) {
        URL.revokeObjectURL(u);
      }
    },
  };
}
