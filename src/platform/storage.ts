import { memoryStorage, type StoragePort } from '../core';

/**
 * localStorage-backed StoragePort. Falls back to memory when the browser blocks storage
 * (private mode, disabled cookies) so the game still runs, just without persistence.
 */
export function browserStorage(prefix = 'rexis-revenge:'): StoragePort {
  const fallback = memoryStorage();
  const local = (): Storage | null => {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        return local()?.getItem(prefix + key) ?? fallback.get(key);
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      fallback.set(key, value);
      try {
        local()?.setItem(prefix + key, value);
      } catch {
        // Storage full or blocked: the in-memory copy keeps the session working.
      }
    },
  };
}
