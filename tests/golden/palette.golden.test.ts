/** Golden swatch sheet of the master palette, so palette changes show up in review. */
import { describe, it } from 'vitest';
import { masterPalette } from '../../src/render/palette';
import { drawPaletteSheet, expectOnPalette } from '../support/palette';
import { renderPart } from '../support/render-node';
import { expectGolden } from './golden';

describe('Palette goldens', () => {
  it('palette-swatches: every master-palette color, named, with its hex', async () => {
    const image = renderPart(masterPalette.night, drawPaletteSheet);
    expectOnPalette('palette-swatches', image);
    await expectGolden('palette-swatches', image);
  });
});
