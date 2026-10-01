import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStorage } from '../../src/platform/storage';

/** A minimal localStorage stand-in backed by a Map. */
function fakeLocalStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => {
      data.clear();
    },
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    key: (i) => [...data.keys()][i] ?? null,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browserStorage', () => {
  it('reads and writes localStorage under a prefix', () => {
    const local = fakeLocalStorage();
    vi.stubGlobal('window', { localStorage: local });
    const storage = browserStorage('test:');
    storage.set('music-muted', '1');
    expect(local.getItem('test:music-muted')).toBe('1');
    expect(browserStorage('test:').get('music-muted')).toBe('1');
  });

  it('falls back to memory when accessing localStorage throws', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });
    const storage = browserStorage();
    expect(storage.get('how-to-play-seen')).toBeNull();
    storage.set('how-to-play-seen', '1');
    expect(storage.get('how-to-play-seen')).toBe('1');
  });

  it('keeps working in memory when writes throw (quota exceeded)', () => {
    const local = fakeLocalStorage();
    local.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    vi.stubGlobal('window', { localStorage: local });
    const storage = browserStorage();
    storage.set('music-muted', '1');
    expect(storage.get('music-muted')).toBe('1');
  });
});
