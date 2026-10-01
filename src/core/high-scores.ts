import type { StoragePort } from './storage';

/**
 * The local top-10 high-score table. The core owns its rules and its stored format; the
 * storage port only moves the string.
 *
 * Rules: sorted by score, highest first; ties keep the earlier entry above; at most
 * {@link HIGH_SCORE_LIMIT} entries; a Run that scored nothing is never recorded.
 */

/** Entries kept in the table. */
export const HIGH_SCORE_LIMIT = 10;
/** Letters the player signs with, A–Z. */
export const INITIALS_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const INITIALS_LENGTH = 3;

/** Storage key of the table. */
export const HIGH_SCORES_STORAGE_KEY = 'high-scores';
/** Version of the stored schema. Any other version reads as an empty table. */
const SCHEMA_VERSION = 1;

export interface HighScoreEntry {
  /** Exactly {@link INITIALS_LENGTH} capital letters A–Z. */
  readonly initials: string;
  readonly score: number;
  /** Enemies destroyed ("demandas desestimadas" in the UI). */
  readonly enemiesDestroyed: number;
  /** Run ticks survived. */
  readonly ticksSurvived: number;
}

export type HighScoreTable = readonly HighScoreEntry[];

/**
 * The 1-based place a new `score` would take in `table` (below any equal scores), or null
 * when it does not qualify: it scored nothing, or the table is full and it does not beat the
 * last entry.
 */
export function highScoreRank(table: HighScoreTable, score: number): number | null {
  if (score <= 0) return null;
  const below = table.findIndex((entry) => entry.score < score);
  const index = below === -1 ? table.length : below;
  return index < HIGH_SCORE_LIMIT ? index + 1 : null;
}

/** A new table with `entry` inserted in its place and truncated to the top 10. */
export function insertHighScore(table: HighScoreTable, entry: HighScoreEntry): HighScoreTable {
  const below = table.findIndex((e) => e.score < entry.score);
  const index = below === -1 ? table.length : below;
  return [...table.slice(0, index), entry, ...table.slice(index)].slice(0, HIGH_SCORE_LIMIT);
}

/** Reads the table. Missing, corrupted or unknown-version data reads as an empty table. */
export function loadHighScores(storage: StoragePort): HighScoreTable {
  let raw: string | null;
  try {
    raw = storage.get(HIGH_SCORES_STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!isRecord(data) || data.version !== SCHEMA_VERSION || !Array.isArray(data.entries)) {
    return [];
  }
  const entries: unknown[] = data.entries;
  if (!entries.every(isEntry)) return [];
  // A hand-edited table may be out of order or too long; a stable sort keeps tie order.
  return entries
    .map(({ initials, score, enemiesDestroyed, ticksSurvived }) => ({
      initials,
      score,
      enemiesDestroyed,
      ticksSurvived,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, HIGH_SCORE_LIMIT);
}

/** Persists the table. Storage failures only lose persistence. */
export function saveHighScores(storage: StoragePort, table: HighScoreTable): void {
  const data = { version: SCHEMA_VERSION, entries: table };
  try {
    storage.set(HIGH_SCORES_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // The caller keeps the table in memory for this session.
  }
}

const INITIALS_PATTERN = new RegExp(`^[${INITIALS_ALPHABET}]{${INITIALS_LENGTH}}$`);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isCount = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0;

function isEntry(value: unknown): value is HighScoreEntry {
  return (
    isRecord(value) &&
    typeof value.initials === 'string' &&
    INITIALS_PATTERN.test(value.initials) &&
    isCount(value.score) &&
    isCount(value.enemiesDestroyed) &&
    isCount(value.ticksSurvived)
  );
}
