import { describe, expect, it } from 'vitest';
import {
  HIGH_SCORE_LIMIT,
  HIGH_SCORES_STORAGE_KEY,
  highScoreRank,
  insertHighScore,
  loadHighScores,
  memoryStorage,
  saveHighScores,
  type HighScoreEntry,
  type StoragePort,
} from '../../src/core';

const entry = (initials: string, score: number, extra: Partial<HighScoreEntry> = {}) => ({
  initials,
  score,
  enemiesDestroyed: Math.floor(score / 100),
  ticksSurvived: score * 2,
  ...extra,
});

/** A full table: ten entries scoring 1000, 900, …, 100. */
const fullTable = (): HighScoreEntry[] =>
  Array.from({ length: HIGH_SCORE_LIMIT }, (_, i) =>
    entry(`A${String.fromCharCode(65 + i)}A`, 1000 - i * 100),
  );

const throwingStorage = (): StoragePort => ({
  get: () => {
    throw new Error('SecurityError');
  },
  set: () => {
    throw new Error('QuotaExceededError');
  },
});

describe('High-score table: insertion', () => {
  it('keeps entries sorted by score, highest first', () => {
    let table = insertHighScore([], entry('BBB', 200));
    table = insertHighScore(table, entry('AAA', 500));
    table = insertHighScore(table, entry('CCC', 50));
    table = insertHighScore(table, entry('DDD', 300));
    expect(table.map((e) => e.initials)).toEqual(['AAA', 'DDD', 'BBB', 'CCC']);
  });

  it('breaks ties in favor of the earlier entry', () => {
    let table = insertHighScore([], entry('OLD', 400));
    table = insertHighScore(table, entry('NEW', 400));
    table = insertHighScore(table, entry('TOP', 900));
    table = insertHighScore(table, entry('NEW', 400, { enemiesDestroyed: 99 }));
    expect(table.map((e) => [e.initials, e.score])).toEqual([
      ['TOP', 900],
      ['OLD', 400],
      ['NEW', 400],
      ['NEW', 400],
    ]);
    expect(table[3]?.enemiesDestroyed).toBe(99);
  });

  it('truncates the table to the top 10', () => {
    const table = insertHighScore(fullTable(), entry('ZED', 550));
    expect(table).toHaveLength(HIGH_SCORE_LIMIT);
    expect(table[5]?.initials).toBe('ZED');
    expect(table.at(-1)?.score).toBe(200);
  });

  it('does not change the table it was given', () => {
    const table = fullTable();
    const copy = structuredClone(table);
    insertHighScore(table, entry('ZED', 5000));
    expect(table).toEqual(copy);
  });
});

describe('High-score table: qualification', () => {
  it('gives the place a score would take, 1-based', () => {
    const table = fullTable();
    expect(highScoreRank(table, 5000)).toBe(1);
    expect(highScoreRank(table, 950)).toBe(2);
    expect(highScoreRank(table, 101)).toBe(10);
  });

  it('places a tie below the entries already there', () => {
    expect(highScoreRank(fullTable(), 900)).toBe(3);
  });

  it('rejects scores that would not make a full top 10, including a tie with the last', () => {
    expect(highScoreRank(fullTable(), 100)).toBeNull();
    expect(highScoreRank(fullTable(), 99)).toBeNull();
  });

  it('accepts any positive score while the table has room', () => {
    expect(highScoreRank([], 1)).toBe(1);
    expect(highScoreRank(fullTable().slice(0, 9), 1)).toBe(10);
  });

  it('never records a Run that scored nothing', () => {
    expect(highScoreRank([], 0)).toBeNull();
  });
});

describe('High-score table: persistence', () => {
  it('round-trips through the storage port', () => {
    const storage = memoryStorage();
    const table = insertHighScore(fullTable(), entry('REX', 777));
    saveHighScores(storage, table);
    expect(loadHighScores(storage)).toEqual(table);
  });

  it('stores a versioned schema under its own key', () => {
    const storage = memoryStorage();
    saveHighScores(storage, [entry('REX', 10)]);
    const raw = JSON.parse(storage.get(HIGH_SCORES_STORAGE_KEY) ?? 'null') as unknown;
    expect(raw).toMatchObject({ version: 1, entries: [{ initials: 'REX', score: 10 }] });
  });

  it('reads an empty table when nothing was saved yet', () => {
    expect(loadHighScores(memoryStorage())).toEqual([]);
  });

  it.each([
    ['not JSON', '{oops'],
    ['JSON null', 'null'],
    ['a bare array', '[]'],
    ['an unknown version', JSON.stringify({ version: 2, entries: [entry('REX', 10)] })],
    ['a missing version', JSON.stringify({ entries: [entry('REX', 10)] })],
    ['entries that are not a list', JSON.stringify({ version: 1, entries: {} })],
    ['lowercase initials', JSON.stringify({ version: 1, entries: [entry('rex', 10)] })],
    ['too many initials', JSON.stringify({ version: 1, entries: [entry('REXI', 10)] })],
    ['a negative score', JSON.stringify({ version: 1, entries: [entry('REX', -5)] })],
    [
      'a fractional count',
      JSON.stringify({ version: 1, entries: [entry('REX', 10, { enemiesDestroyed: 1.5 })] }),
    ],
    ['a missing field', JSON.stringify({ version: 1, entries: [{ initials: 'REX', score: 10 }] })],
    [
      'a string score',
      JSON.stringify({ version: 1, entries: [{ ...entry('REX', 10), score: '10' }] }),
    ],
  ])('treats %s as an empty table', (_, raw) => {
    const storage = memoryStorage({ [HIGH_SCORES_STORAGE_KEY]: raw });
    expect(loadHighScores(storage)).toEqual([]);
  });

  it('re-sorts and truncates a hand-edited table instead of trusting it', () => {
    const entries = [...fullTable(), entry('LOW', 5), entry('BIG', 2000)];
    const storage = memoryStorage({
      [HIGH_SCORES_STORAGE_KEY]: JSON.stringify({ version: 1, entries }),
    });
    const table = loadHighScores(storage);
    expect(table).toHaveLength(HIGH_SCORE_LIMIT);
    expect(table[0]?.initials).toBe('BIG');
    expect(table.some((e) => e.initials === 'LOW')).toBe(false);
  });
});

describe('High-score table: throwing storage', () => {
  it('reads as empty and saving does not throw', () => {
    // The Game core wraps every port with resilientStorage; through it, nothing throws.
    const storage = throwingStorage();
    expect(() => loadHighScores(storage)).not.toThrow();
    expect(loadHighScores(storage)).toEqual([]);
    expect(() => {
      saveHighScores(storage, [entry('REX', 10)]);
    }).not.toThrow();
  });
});
