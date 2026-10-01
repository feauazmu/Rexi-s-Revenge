/** Golden specimen of the bitmap fonts: every glyph, both sizes, and wrapped text. */
import { describe, it } from 'vitest';
import { drawText, fonts } from '../../src/render';
import { masterPalette } from '../../src/render/palette';
import { renderPart } from '../support/render-node';
import { expectGolden } from './golden';

const BACKGROUND = masterPalette.robe;
const INK = masterPalette.white;
const ACCENT = masterPalette.gold;
const SHADOW = masterPalette.night;

describe('Text goldens', () => {
  it('font-specimen: regular and large fonts, alignment and wrapping', async () => {
    const { regular, large } = fonts;
    const image = renderPart(BACKGROUND, (target) => {
      // Every glyph of the font, in rows that fit the screen.
      const rows = regular.wrap(regular.chars.join(' '), 468);
      drawText(target, regular, rows.join('\n'), 6, 4, { color: INK });

      let y = 4 + regular.blockHeight(rows.length) + 6;
      drawText(target, large, "Rexi's Revenge", 6, y, { color: ACCENT, shadow: SHADOW });
      drawText(target, large, '¿Cómo jugar?', 474, y, { color: INK, align: 'right' });
      y += large.lineHeight + 4;
      drawText(target, large, '¡AÑO ÚNICO, PEDIGÜEÑO!', 240, y, { color: INK, align: 'center' });
      y += large.lineHeight + 6;

      const quip =
        'Yo conozco uno gratis... ¿de qué hablan, Marlene? Jueves 2 por 1: ¡la cunclilla de la limpieza!';
      const width = 220;
      const lines = regular.wrap(quip, width);
      target.surface.fillRect(6, y - 2, width, regular.blockHeight(lines.length) + 4, SHADOW);
      drawText(target, regular, lines.join('\n'), 6, y, { color: INK });
      drawText(target, regular, 'PUNTOS 12345  TIEMPO 75:03  ∞', 474, y, {
        color: ACCENT,
        shadow: SHADOW,
        align: 'right',
      });
    });
    await expectGolden('font-specimen', image);
  });
});
