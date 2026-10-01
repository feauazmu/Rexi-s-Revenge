/**
 * Seeded pseudo-random generator (mulberry32). It is the only source of randomness in the
 * Game core, so a seed plus an input sequence always reproduces the same Run.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** True with the given probability (0..1). */
  chance(probability: number): boolean;
  /** Uniformly chosen element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /**
   * An item chosen with probability proportional to its weight. Items with weight ≤ 0 are
   * never chosen; throws when no item has a positive weight.
   */
  weighted<T>(entries: readonly (readonly [item: T, weight: number])[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    chance: (probability) => next() < probability,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('Rng.pick needs a non-empty list');
      return items[Math.floor(next() * items.length)] as T;
    },
    weighted: <T>(entries: readonly (readonly [T, number])[]): T => {
      const positive = entries.filter(([, weight]) => weight > 0);
      const total = positive.reduce((sum, [, weight]) => sum + weight, 0);
      let roll = next() * total;
      // Floating-point leftovers land on the last entry.
      const chosen = positive.find(([, weight]) => (roll -= weight) < 0) ?? positive.at(-1);
      if (chosen === undefined) {
        throw new Error('Rng.weighted needs an entry with a positive weight');
      }
      return chosen[0];
    },
  };
}

/**
 * Derives the seed of a separate random stream (e.g. cosmetic effects), so drawing from that
 * stream never shifts the gameplay sequence of the main `Rng`.
 */
export function deriveSeed(seed: number, stream: number): number {
  return hash32(seed, stream);
}

/** Integer hash of a list of integers (murmur3-style mixing), as an unsigned 32-bit int. */
export function hash32(...values: readonly number[]): number {
  let h = 0x9e3779b9;
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 0x85ebca6b);
    h = (h << 13) | (h >>> 19);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}
