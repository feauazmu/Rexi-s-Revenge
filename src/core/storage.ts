/**
 * Minimal persistence port. The Game core owns what is stored (high scores, flags) and in
 * which format; adapters only move strings. Implementations must never throw.
 */
export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** In-memory storage: the default for tests and the fallback when the browser blocks storage. */
export function memoryStorage(initial: Readonly<Record<string, string>> = {}): StoragePort {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
    },
  };
}

/**
 * Wraps a port so the core never crashes on storage errors, even from a misbehaving adapter:
 * every write is also kept in memory, and reads that throw fall back to that memory.
 */
export function resilientStorage(port: StoragePort): StoragePort {
  const memory = memoryStorage();
  return {
    get(key) {
      try {
        return port.get(key) ?? memory.get(key);
      } catch {
        return memory.get(key);
      }
    },
    set(key, value) {
      memory.set(key, value);
      try {
        port.set(key, value);
      } catch {
        // The in-memory copy keeps the session consistent.
      }
    },
  };
}
