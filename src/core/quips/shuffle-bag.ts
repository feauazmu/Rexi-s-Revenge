import type { Rng } from '../rng';

/**
 * Draws items in a random order without repeats until every item has been drawn, then refills.
 * The first draw after a refill is never the item drawn just before it (when there are two or
 * more items), so nothing ever plays twice in a row.
 */
export interface ShuffleBag<T> {
  draw(): T;
}

export function createShuffleBag<T>(items: readonly T[], rng: Rng): ShuffleBag<T> {
  if (items.length === 0) throw new Error('A shuffle-bag needs at least one item');
  let remaining: T[] = [];
  let last: T | undefined;

  return {
    draw() {
      if (remaining.length === 0) remaining = [...items];
      let index = rng.int(0, remaining.length - 1);
      if (remaining[index] === last && remaining.length > 1) {
        // Only possible right after a refill: take any other item instead.
        index = (index + rng.int(1, remaining.length - 1)) % remaining.length;
      }
      const [item] = remaining.splice(index, 1) as [T];
      last = item;
      return item;
    },
  };
}
