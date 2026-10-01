/** Text: the code-drawn bitmap fonts, their metrics and the one function that draws text. */
import { createBitmapFont, scaleFont, type BitmapFont } from './font';
import { BASELINE, regularGlyphRows } from './glyphs';

export {
  createBitmapFont,
  scaleFont,
  type BitmapFont,
  type FontDefinition,
  type Glyph,
} from './font';
export { drawText, type TextAlign, type TextStyle, type TextTarget } from './draw-text';
export { formatElapsed } from './format';

const regular = createBitmapFont({
  glyphs: regularGlyphRows(),
  lineHeight: 13,
  baseline: BASELINE,
  letterSpacing: 1,
});

/**
 * The game's fonts. `regular` (12 px cells, 7 px capitals) is for the HUD and the Dialogue
 * Box; `large` is the same design at 2× for headings.
 */
export const fonts: { readonly regular: BitmapFont; readonly large: BitmapFont } = {
  regular,
  large: scaleFont(regular, 2),
};
