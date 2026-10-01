/** Content rules for the Quip catalog (see src/core/quips/catalog.ts). */
import { describe, expect, it } from 'vitest';
import { QUIPS } from '../../src/core';
import { DIALOGUE_MAX_LINES, DIALOGUE_TEXT_WIDTH, fonts } from '../../src/render';

const FRAGMENTS = [
  'yo conozco uno gratis',
  'de qué hablan marlene',
  'la cunclilla de la limpieza',
  'jueves 2 por 1',
];

/** Lowercase, punctuation removed, single spaces: fragments match words and spelling only. */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/ +/g, ' ')
    .trim();

const containsFragment = (text: string, fragment: string): boolean =>
  ` ${normalize(text)} `.includes(` ${fragment} `);

describe('Quip catalog', () => {
  it('has about 40 Quips', () => {
    expect(QUIPS.length).toBeGreaterThanOrEqual(36);
    expect(QUIPS.length).toBeLessThanOrEqual(44);
  });

  it('is split about evenly between legal and gym Quips', () => {
    const legal = QUIPS.filter((q) => q.theme === 'legal').length;
    const gym = QUIPS.filter((q) => q.theme === 'gym').length;
    expect(legal + gym).toBe(QUIPS.length);
    expect(Math.abs(legal - gym)).toBeLessThanOrEqual(2);
  });

  it('has unique ids prefixed with their theme', () => {
    expect(new Set(QUIPS.map((q) => q.id)).size).toBe(QUIPS.length);
    for (const quip of QUIPS) expect(quip.id.startsWith(`${quip.theme}-`)).toBe(true);
  });

  it('only uses characters the bitmap font can draw', () => {
    for (const quip of QUIPS) expect(fonts.regular.missing(quip.text), quip.id).toEqual([]);
  });

  it('fits every Quip on two Dialogue Box lines', () => {
    for (const quip of QUIPS) {
      const lines = fonts.regular.wrap(quip.text, DIALOGUE_TEXT_WIDTH);
      expect(lines.length, `${quip.id}: ${lines.join(' / ')}`).toBeLessThanOrEqual(
        DIALOGUE_MAX_LINES,
      );
    }
  });

  it('keeps Quips to one clean line of text (no line breaks or doubled spaces)', () => {
    for (const quip of QUIPS) {
      expect(quip.text, quip.id).toBe(quip.text.trim());
      expect(quip.text, quip.id).not.toMatch(/\n| {2}/);
    }
  });

  it.each(FRAGMENTS)('uses "%s" at least three times, word for word', (fragment) => {
    const uses = QUIPS.filter((q) => containsFragment(q.text, fragment));
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });

  it('puts a running gag in at least a third of the Quips', () => {
    const withFragment = QUIPS.filter((q) => FRAGMENTS.some((f) => containsFragment(q.text, f)));
    expect(withFragment.length * 3).toBeGreaterThanOrEqual(QUIPS.length);
  });

  it('matches fragments on words, not on punctuation or case', () => {
    expect(containsFragment('¿De qué hablan, Marlene?', 'de qué hablan marlene')).toBe(true);
    expect(containsFragment('¡Jueves 2 por 1!', 'jueves 2 por 1')).toBe(true);
    expect(containsFragment('jueves 2 por 10', 'jueves 2 por 1')).toBe(false);
    expect(containsFragment('la cuclilla de la limpieza', 'la cunclilla de la limpieza')).toBe(
      false,
    );
  });
});
