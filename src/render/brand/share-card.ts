/**
 * The link preview card (Open Graph / Twitter image): the Title's composition as a still, at
 * game resolution. The title illustration with Rexi on the right, the logo in the sky with its
 * twinkle, and the Spanish tagline under it on a dark plate. `scripts/share-preview/` scales it
 * by 2 with nearest-neighbor sampling to the 1200×630 `public/og-image.png`.
 */
import { drawPlate } from '../frame';
import { masterPalette } from '../palette';
import type { SpriteBank } from '../sprite';
import { strings } from '../strings';
import type { Bitmap, Color, Surface } from '../surface';
import { fonts, type BitmapFont, type TextTarget } from '../text';
import { COLUMN_CENTER_X as TITLE_COLUMN_CENTER_X } from '../screens/title';
import { drawOutlinedText } from '../screens/ui';
import { drawLogo, LOGO_HEIGHT, LOGO_SPARKLE_TICK, LOGO_WIDTH } from './logo';

/**
 * The card is 1200×630 at a whole 2×: a 600×315 window of the 640×360 illustration, trimmed a
 * little at the sides (Rexi's gavel stays in) and mostly from the plaza at the bottom.
 */
export const SHARE_CARD_WIDTH = 600;
export const SHARE_CARD_HEIGHT = 315;

/** Columns of the illustration cut from the left (the rest is cut from the right). */
const CROP_LEFT = 14;

/** Rows of the illustration cut from the top (the rest is cut from the plaza at the bottom). */
const CROP_TOP = 6;

const COLUMN_CENTER_X = TITLE_COLUMN_CENTER_X - CROP_LEFT;
const LOGO_X = COLUMN_CENTER_X - LOGO_WIDTH / 2;
const LOGO_Y = 14;

const ink = {
  outline: masterPalette.outline,
  tagline: masterPalette.gold,
  blurb: masterPalette.marble,
} as const satisfies Record<string, Color>;

/** Draws the card with its top-left corner at (0, 0), SHARE_CARD_WIDTH × SHARE_CARD_HEIGHT. */
export function drawShareCard(
  target: { readonly surface: Surface; readonly sprites: SpriteBank },
  illustration: Bitmap,
): void {
  const { surface, sprites } = target;
  surface.drawBitmap(illustration, -CROP_LEFT, -CROP_TOP);
  drawLogo(surface, sprites, LOGO_X, LOGO_Y, LOGO_SPARKLE_TICK);

  // Tagline (large capitals, one line each) and blurb on one plate, centered under the logo.
  // Positions are cap tops; the fonts' cells start above them (room for accents).
  const { large, regular } = fonts;
  const lines = strings.share.tagline.split('\n');
  const { blurb } = strings.share;
  const top = LOGO_Y + LOGO_HEIGHT + 16;
  const blurbTop = top + (lines.length - 1) * TAGLINE_PITCH + LARGE_CAP + BLURB_GAP;
  const width = Math.max(...lines.map((line) => large.measure(line)), regular.measure(blurb));
  const plateTop = top - PLATE_PAD;
  drawPlate(
    surface,
    Math.round(COLUMN_CENTER_X - (width + PLATE_PAD * 4) / 2),
    plateTop,
    width + PLATE_PAD * 4,
    blurbTop + REGULAR_CAP + PLATE_PAD + 1 - plateTop,
  );
  lines.forEach((line, i) => {
    const capTop = top + i * TAGLINE_PITCH;
    outlined(target, large, line, capTop - (large.baseline - LARGE_CAP), ink.tagline);
  });
  outlined(target, regular, blurb, blurbTop - (regular.baseline - REGULAR_CAP), ink.blurb);
}

/** Cap heights of the two fonts, and the tagline's spacing, px. */
const LARGE_CAP = 14;
const REGULAR_CAP = 7;
const TAGLINE_PITCH = 20;
const BLURB_GAP = 8;
const PLATE_PAD = 6;

function outlined(target: TextTarget, font: BitmapFont, text: string, y: number, color: Color) {
  drawOutlinedText(target, font, text, COLUMN_CENTER_X, y, color, {
    align: 'center',
    outline: ink.outline,
  });
}
