import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** CREDITS.md is the art pipeline's source of truth for money spent (scripts/art/ledger.py). */
const credits = readFileSync(new URL('../../CREDITS.md', import.meta.url), 'utf8');

describe('CREDITS.md budget', () => {
  const budget = credits.slice(credits.indexOf('## Budget'));
  const rows = budget
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  const total = /\*\*([0-9.]+) of ([0-9.]+)\*\*/.exec(budget);

  it('has a running total that is the sum of its line items and stays under the cap', () => {
    expect(total).not.toBeNull();
    const items = rows
      .slice(2)
      .filter(([item]) => !item?.includes('Running total'))
      .reduce((sum, [, cost]) => sum + Number(cost), 0);
    expect(Number(total?.[1])).toBeCloseTo(items, 4);
    expect(Number(total?.[1])).toBeLessThanOrEqual(Number(total?.[2]));
    expect(Number(total?.[2])).toBe(10);
  });
});
