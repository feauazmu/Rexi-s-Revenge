/**
 * Golden images of the brand art: the logo (still, mid shine sweep, twinkle), the site icons
 * and the link preview card. The logo and icons must use master-palette colors only.
 */
import { describe, expect, it } from 'vitest';
import {
  appIconArt,
  favicon,
  FAVICON_SIZES,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
} from '../../src/render';
import { drawShareCard } from '../../src/render/brand/share-card';
import {
  drawLogo,
  LOGO,
  LOGO_HEIGHT,
  LOGO_SPARKLE_TICK,
  LOGO_WIDTH,
  SHINE_PERIOD,
} from '../../src/render/brand/logo';
import { masterPalette } from '../../src/render/palette';
import { findOffPaletteSpriteColors } from '../../src/render/palette-audit';
import { expectOnPalette } from '../support/palette';
import { loadTitleIllustration, renderPart } from '../support/render-node';
import { expectGolden } from './golden';

describe('Brand goldens', () => {
  it('logo-sheet: the logo still, mid shine, with its twinkle, and the site icons', async () => {
    const gap = 4;
    const image = renderPart(masterPalette.skyPurple, ({ surface, sprites }) => {
      drawLogo(surface, sprites, gap, gap, SHINE_PERIOD - 1); // still: no shine
      drawLogo(surface, sprites, LOGO_WIDTH + gap * 2, gap, 12); // the band mid-sweep
      drawLogo(surface, sprites, gap, LOGO_HEIGHT + gap * 2, LOGO_SPARKLE_TICK);
      let x = LOGO_WIDTH + gap * 2;
      const y = LOGO_HEIGHT + gap * 2;
      for (const size of FAVICON_SIZES) {
        surface.drawBitmap(sprites.get(favicon(size)), x, y);
        x += size + gap;
      }
      surface.drawBitmap(sprites.get(appIconArt()), x, y);
    });
    expectOnPalette('logo-sheet', image);
    await expectGolden('logo-sheet', image);
  });

  it('share-card: the link preview at game resolution (public/og-image.png is it at 2.5×)', async () => {
    const illustration = await loadTitleIllustration();
    const image = renderPart(
      masterPalette.outline,
      (target) => {
        drawShareCard(target, illustration);
      },
      { width: SHARE_CARD_WIDTH, height: SHARE_CARD_HEIGHT },
    );
    await expectGolden('share-card', image);
  });

  it('draws the logo and icons with master-palette colors only', () => {
    const sprites = [LOGO, appIconArt(), ...FAVICON_SIZES.map((size) => favicon(size))];
    expect(findOffPaletteSpriteColors(sprites)).toEqual([]);
  });
});
