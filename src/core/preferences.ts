import type { StoragePort } from './storage';

/** Player preferences the core persists through the storage port. */
export interface Preferences {
  /** "Cómo jugar" has been seen: later Runs go straight from the Title into the Arena. */
  readonly howToPlaySeen: boolean;
  /** The player muted the music from the pause menu. */
  readonly musicMuted: boolean;
}

/** Storage keys and their encoding. The core owns them; adapters only move strings. */
const KEYS: Readonly<Record<keyof Preferences, string>> = {
  howToPlaySeen: 'how-to-play-seen',
  musicMuted: 'music-muted',
};
const TRUE = '1';
const FALSE = '0';

/** Reads the preferences; anything missing or unrecognized reads as `false`. */
export function loadPreferences(storage: StoragePort): Preferences {
  return {
    howToPlaySeen: storage.get(KEYS.howToPlaySeen) === TRUE,
    musicMuted: storage.get(KEYS.musicMuted) === TRUE,
  };
}

export function savePreference(storage: StoragePort, key: keyof Preferences, value: boolean): void {
  storage.set(KEYS[key], value ? TRUE : FALSE);
}
