import type { DrawContext } from '../draw-context';
import { defineSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';
import type { BitmapFont } from './font';

export type TextAlign = 'left' | 'center' | 'right';

export interface TextStyle {
  readonly color: Color;
  /** Drop shadow one pixel down and right, for legibility over busy backgrounds. */
  readonly shadow?: Color;
  /** How `x` anchors each line: its left edge (default), its center or its right edge. */
  readonly align?: TextAlign;
}

/** The parts of a DrawContext that text drawing needs. */
export type TextTarget = Pick<DrawContext, 'surface' | 'sprites'>;

/**
 * Draws `text` with a bitmap font: the only way the renderer draws text (no canvas text).
 * `y` is the top of the first line's cell; `\n` starts a new line `font.lineHeight` lower.
 * Text is not wrapped here: wrap it first with `font.wrap`. Throws on missing glyphs.
 */
export function drawText(
  dc: TextTarget,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  style: TextStyle,
): void {
  if (style.shadow) drawLines(dc, font, text, x + 1, y + 1, style.shadow, style.align);
  drawLines(dc, font, text, x, y, style.color, style.align);
}

function drawLines(
  dc: TextTarget,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  color: Color,
  align: TextAlign = 'left',
): void {
  text.split('\n').forEach((line, i) => {
    const width = font.measure(line);
    const left = align === 'left' ? x : align === 'center' ? x - Math.floor(width / 2) : x - width;
    let penX = Math.round(left);
    const top = Math.round(y + i * font.lineHeight);
    for (const char of line) {
      const glyph = font.glyph(char);
      if (glyph.rows.some((row) => row.includes('#'))) {
        dc.surface.drawBitmap(dc.sprites.get(glyphSprite(font, char, color)), penX, top);
      }
      penX += glyph.width + font.letterSpacing;
    }
  });
}

/** One sprite per (font, character, color), created on first use and reused afterwards. */
const glyphSprites = new WeakMap<BitmapFont, Map<string, SpriteDef>>();

function glyphSprite(font: BitmapFont, char: string, color: Color): SpriteDef {
  let byKey = glyphSprites.get(font);
  if (!byKey) {
    byKey = new Map();
    glyphSprites.set(font, byKey);
  }
  const key = `${color}${char}`;
  let sprite = byKey.get(key);
  if (!sprite) {
    sprite = defineSprite({ '#': color }, font.glyph(char).rows);
    byKey.set(key, sprite);
  }
  return sprite;
}
