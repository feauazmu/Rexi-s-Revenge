import { describe, expect, it } from 'vitest';
import { allStrings, createBitmapFont, fonts, formatElapsed, strings } from '../../src/render';

const { regular, large } = fonts;

const SPANISH_LETTERS = 'áéíóúüñÁÉÍÓÚÜÑ¿¡';
const BASIC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?\'"-()/%&+…×∞';

/** A tiny two-glyph font with easy numbers: "I" is 1 px wide, "W" is 3 px, space 2 px. */
const tiny = createBitmapFont({
  glyphs: new Map([
    ['I', ['#', '#']],
    ['W', ['#.#', '###']],
    [' ', ['..', '..']],
  ]),
  lineHeight: 3,
  baseline: 2,
  letterSpacing: 1,
});

describe('bitmap font coverage', () => {
  it.each([
    ['regular', regular],
    ['large', large],
  ])('the %s font covers Spanish letters, digits and basic punctuation', (_, font) => {
    expect(font.missing(SPANISH_LETTERS + BASIC)).toEqual([]);
  });

  it('has every glyph used in the UI strings catalog', () => {
    const text = allStrings(strings).join('\n');
    expect(text).toContain('á'); // the walk really reaches nested strings
    expect(regular.missing(text)).toEqual([]);
    expect(large.missing(text)).toEqual([]);
  });

  it('can draw every elapsed-time format', () => {
    expect(
      regular.missing([0, 59, 600, 3599, 360000].map((s) => formatElapsed(s * 60)).join()),
    ).toEqual([]);
  });

  it('reports missing characters once each, in order, ignoring line breaks', () => {
    expect(regular.missing('€uro\n€ ¥')).toEqual(['€', '¥']);
    expect(regular.has('ñ')).toBe(true);
    expect(regular.has('€')).toBe(false);
  });

  it('draws accents on capitals above the cap height, inside the cell', () => {
    const inkRows = (char: string) =>
      regular.glyph(char).rows.flatMap((row, y) => (row.includes('#') ? [y] : []));
    const capTop = Math.min(...inkRows('A'));
    expect(Math.min(...inkRows('Á'))).toBeLessThan(capTop);
    expect(Math.min(...inkRows('Á'))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...inkRows('A'))).toBe(regular.baseline - 1);
    expect(Math.max(...inkRows('g'))).toBeGreaterThan(regular.baseline - 1);
  });
});

describe('createBitmapFont', () => {
  it('rejects glyphs with uneven rows or heights', () => {
    const define = (glyphs: [string, string[]][]) =>
      createBitmapFont({ glyphs: new Map(glyphs), lineHeight: 3, baseline: 2, letterSpacing: 1 });
    expect(() => define([['a', ['#', '##']]])).toThrow(/widths/);
    expect(() =>
      define([
        ['a', ['#']],
        ['b', ['#', '#']],
      ]),
    ).toThrow(/rows/);
    expect(() => define([['a', ['x']]])).toThrow(/only use/);
  });
});

describe('text metrics: measure', () => {
  it('sums glyph widths plus letter spacing between glyphs', () => {
    expect(tiny.measure('')).toBe(0);
    expect(tiny.measure('I')).toBe(1);
    expect(tiny.measure('W')).toBe(3);
    expect(tiny.measure('IW')).toBe(1 + 1 + 3);
    expect(tiny.measure('I I')).toBe(1 + 1 + 2 + 1 + 1);
  });

  it('measures multi-line text by its widest line', () => {
    expect(tiny.measure('I\nWW\nI')).toBe(7);
  });

  it('throws on characters the font cannot draw', () => {
    expect(() => regular.measure('Precio: 5€')).toThrow(/€/);
  });

  it('matches the regular font design', () => {
    expect(regular.measure('A')).toBe(5);
    expect(regular.measure('Hola')).toBe(5 + 4 + 2 + 4 + 3);
    expect(regular.measure('1234567890')).toBe(10 * 4 + 9);
  });

  it('makes the large font exactly twice the regular one', () => {
    for (const text of ['Cómo jugar', "Rexi's Revenge", '¡Ñandú!']) {
      expect(large.measure(text)).toBe(2 * regular.measure(text));
    }
    expect(large.glyphHeight).toBe(2 * regular.glyphHeight);
    expect(large.lineHeight).toBe(2 * regular.lineHeight);
    expect(large.baseline).toBe(2 * regular.baseline);
  });

  it('gives the height of a block of lines', () => {
    expect(tiny.blockHeight(0)).toBe(0);
    expect(tiny.blockHeight(1)).toBe(2);
    expect(tiny.blockHeight(3)).toBe(3 + 3 + 2);
  });
});

describe('text metrics: wrap', () => {
  it('keeps text that fits on one line', () => {
    expect(tiny.wrap('I W I', 100)).toEqual(['I W I']);
  });

  it('breaks greedily at spaces so every line fits', () => {
    // "WW" = 7 px, "WW I" = 7+1+2+1+1 = 12 px.
    expect(tiny.wrap('WW I WW I', 12)).toEqual(['WW I', 'WW I']);
    expect(tiny.wrap('WW I WW I', 11)).toEqual(['WW', 'I', 'WW', 'I']);
  });

  it('allows a line exactly as wide as the limit', () => {
    expect(tiny.wrap('IW IW', tiny.measure('IW IW'))).toEqual(['IW IW']);
    expect(tiny.wrap('IW IW', tiny.measure('IW IW') - 1)).toEqual(['IW', 'IW']);
  });

  it('keeps explicit line breaks, including empty lines', () => {
    expect(tiny.wrap('I\n\nW', 100)).toEqual(['I', '', 'W']);
  });

  it('collapses runs of spaces and trims line ends', () => {
    expect(tiny.wrap('  I   W  ', 100)).toEqual(['I W']);
  });

  it('splits a word only when it is wider than a whole line', () => {
    expect(tiny.wrap('I WWWW', 7)).toEqual(['I', 'WW', 'WW']);
  });

  it('gives one empty line for empty text', () => {
    expect(tiny.wrap('', 10)).toEqual(['']);
  });

  it('wraps real Spanish text within the width, keeping every word in order', () => {
    const text = '¿De qué hablan, Marlene? Yo conozco uno gratis, pero los jueves 2 por 1.';
    const lines = regular.wrap(text, 120);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(regular.measure(line)).toBeLessThanOrEqual(120);
    expect(lines.join(' ')).toBe(text);
  });
});

describe('formatElapsed', () => {
  it.each([
    [0, '0:00'],
    [59, '0:00'],
    [60, '0:01'],
    [60 * 59, '0:59'],
    [60 * 60, '1:00'],
    [60 * 75 * 60 + 60 * 3, '75:03'],
  ])('%i ticks reads %s', (ticks, text) => {
    expect(formatElapsed(ticks)).toBe(text);
  });
});
