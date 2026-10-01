/**
 * Bitmap fonts drawn in code, with the text metrics that layout code and content checks rely
 * on (`measure`, `wrap`). All metrics are in game pixels and exactly match what `drawText`
 * puts on screen.
 */

/** One character's pixels: a full font cell, `#` for ink and `.` for empty. */
export interface Glyph {
  readonly char: string;
  /** Advance width without letter spacing, px. */
  readonly width: number;
  /** `glyphHeight` rows of `width` characters each. */
  readonly rows: readonly string[];
}

export interface BitmapFont {
  /** Height of every glyph cell, px. Text drawn at `y` covers rows `y … y + glyphHeight - 1`. */
  readonly glyphHeight: number;
  /** Distance from the top of one line to the top of the next, px. */
  readonly lineHeight: number;
  /** Distance from the cell top to the baseline capitals sit on, px. */
  readonly baseline: number;
  /** Empty columns between consecutive glyphs, px. */
  readonly letterSpacing: number;
  /** Every character the font can draw. */
  readonly chars: readonly string[];

  /** True when the font has a glyph for `char`. */
  has(char: string): boolean;
  /** The glyph for `char`; throws when the font lacks it. */
  glyph(char: string): Glyph;
  /** Characters of `text` the font cannot draw, unique, in order of appearance (`\n` is fine). */
  missing(text: string): string[];
  /**
   * Width of `text` in px: the sum of glyph widths plus letter spacing between them. For
   * multi-line text (`\n`), the width of the widest line. Throws on missing glyphs.
   */
  measure(text: string): number;
  /** Height in px of a block of `lines` lines (no trailing line gap). */
  blockHeight(lines: number): number;
  /**
   * Greedy word wrap: splits `text` into lines no wider than `maxWidth`. Breaks at spaces,
   * keeps explicit `\n` breaks, collapses runs of spaces, and splits a word only when it is
   * wider than `maxWidth` on its own. Empty text gives one empty line.
   */
  wrap(text: string, maxWidth: number): string[];
}

export interface FontDefinition {
  /** Glyph rows per character; every glyph must have the same number of rows. */
  readonly glyphs: ReadonlyMap<string, readonly string[]>;
  readonly lineHeight: number;
  readonly baseline: number;
  readonly letterSpacing: number;
}

const INK = '#';
const EMPTY = '.';

/** Builds a font from glyph rows, validating that every glyph is a well-formed cell. */
export function createBitmapFont(definition: FontDefinition): BitmapFont {
  const glyphs = new Map<string, Glyph>();
  let glyphHeight: number | undefined;
  for (const [char, rows] of definition.glyphs) {
    if (Array.from(char).length !== 1) throw new Error(`Glyph key "${char}" is not one character`);
    glyphHeight ??= rows.length;
    if (rows.length !== glyphHeight) {
      throw new Error(`Glyph "${char}" has ${rows.length} rows, expected ${glyphHeight}`);
    }
    const width = rows[0]?.length ?? 0;
    for (const row of rows) {
      if (row.length !== width) throw new Error(`Glyph "${char}" has rows of different widths`);
      if (!/^[#.]*$/.test(row))
        throw new Error(`Glyph "${char}" may only use "${INK}" and "${EMPTY}"`);
    }
    glyphs.set(char, { char, width, rows });
  }
  if (glyphHeight === undefined) throw new Error('A font needs at least one glyph');
  const height = glyphHeight;
  const { lineHeight, baseline, letterSpacing } = definition;

  const glyph = (char: string): Glyph => {
    const found = glyphs.get(char);
    if (!found) throw new Error(`The font has no glyph for "${char}" (U+${codePoint(char)})`);
    return found;
  };

  const lineWidth = (line: string): number => {
    let width = 0;
    let count = 0;
    for (const char of line) {
      width += glyph(char).width;
      count += 1;
    }
    return count === 0 ? 0 : width + letterSpacing * (count - 1);
  };

  const font: BitmapFont = {
    glyphHeight: height,
    lineHeight,
    baseline,
    letterSpacing,
    chars: [...glyphs.keys()],
    has: (char) => glyphs.has(char),
    glyph,
    missing(text) {
      const missing = new Set<string>();
      for (const char of text) if (char !== '\n' && !glyphs.has(char)) missing.add(char);
      return [...missing];
    },
    measure: (text) => Math.max(...text.split('\n').map(lineWidth)),
    blockHeight: (lines) => (lines <= 0 ? 0 : (lines - 1) * lineHeight + height),
    wrap: (text, maxWidth) =>
      text.split('\n').flatMap((p) => wrapParagraph(p, maxWidth, lineWidth)),
  };
  return font;
}

function wrapParagraph(
  paragraph: string,
  maxWidth: number,
  lineWidth: (line: string) => number,
): string[] {
  const words = paragraph.split(' ').filter((word) => word !== '');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (lineWidth(candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line !== '') lines.push(line);
    line = '';
    // A word too wide for any line is split by characters.
    for (const char of word) {
      if (line !== '' && lineWidth(line + char) > maxWidth) {
        lines.push(line);
        line = '';
      }
      line += char;
    }
  }
  lines.push(line);
  return lines;
}

/** The same font with every pixel, metric and gap scaled up by a whole `factor`. */
export function scaleFont(font: BitmapFont, factor: number): BitmapFont {
  if (!Number.isInteger(factor) || factor < 1)
    throw new Error('Scale factor must be a whole number ≥ 1');
  const glyphs = new Map<string, readonly string[]>();
  for (const char of font.chars) {
    const rows = font
      .glyph(char)
      .rows.map((row) => Array.from(row, (pixel) => pixel.repeat(factor)).join(''));
    glyphs.set(
      char,
      rows.flatMap((row) => Array<string>(factor).fill(row)),
    );
  }
  return createBitmapFont({
    glyphs,
    lineHeight: font.lineHeight * factor,
    baseline: font.baseline * factor,
    letterSpacing: font.letterSpacing * factor,
  });
}

function codePoint(char: string): string {
  return (char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0');
}
