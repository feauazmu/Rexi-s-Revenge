/**
 * The UI layers redrawn in the art pass (#29) put only master-palette colors on screen. Each
 * layer is drawn alone over a palette color, so the older Arena, Rexi and Enemy art (which
 * #26–#28 remap) cannot hide or cause a failure.
 */
import { describe, expect, it } from 'vitest';
import type { GameView } from '../../src/core';
import { drawDialogueBox } from '../../src/render/dialogue/dialogue-box';
import type { DrawContext } from '../../src/render/draw-context';
import { drawHud } from '../../src/render/hud/hud';
import { drawCrates } from '../../src/render/layers/crates';
import { drawCrosshair } from '../../src/render/layers/crosshair';
import { masterPalette } from '../../src/render/palette';
import { drawPauseMenu } from '../../src/render/screens/pause-menu';
import { drawDefeatBanner, drawVerdict } from '../../src/render/screens/verdict';
import { drawTouchOverlay } from '../../src/render/touch/overlay';
import { drive, ON_REXI, powerUpCrate, runOf, weaponCrate } from '../support/driver';
import { holdStill } from '../support/fixtures';
import { expectOnPalette } from '../support/palette';
import { renderPart } from '../support/render-node';
import { driveToRunEnd } from '../support/run-end';

/** Where the Dialogue Box draws the 40×40 portrait, fully open. */
const PORTRAIT = { x: 98, y: 316, size: 40 } as const;

function renderLayers(view: GameView, paint: (dc: DrawContext) => void) {
  return renderPart(masterPalette.night, (target) => {
    paint({ ...target, view });
  });
}

describe('UI palette (#29)', () => {
  it('HUD, Crates (both families, falling and blinking), Dialogue Box, crosshair, touch overlay', () => {
    const game = drive({
      seed: 1,
      overrides: {
        tuning: holdStill(),
        spawns: [
          powerUpCrate('creatina', ON_REXI.x, { y: ON_REXI.y }),
          powerUpCrate('receso', 120, { y: 60 }),
          weaponCrate('mancuernas', 220, { y: 60 }),
          weaponCrate('codigo-penal', 320),
        ],
      },
    });
    game.ticks(10);
    const run = runOf(game.view);
    expect(run.rexi.powerUps).toHaveLength(1);
    const dialogue = {
      quipId: 'test',
      theme: 'legal',
      text: '¡Objeción denegada!',
      revealed: 8,
      complete: true,
      openness: 1,
      age: 0,
    } as const;
    for (const blinking of [false, true]) {
      const crates = run.crates.map((crate) => ({
        ...crate,
        landed: blinking,
        blinking,
        ticksLeft: blinking ? 7 : null,
      }));
      const image = renderLayers(game.view, (dc) => {
        const shown = { ...run, crates, dialogue };
        drawCrates(dc, shown);
        drawHud(dc, shown);
        drawDialogueBox(dc, shown);
        // The portrait inside the frame is Rexi's art (#26 redraws it): cover it.
        dc.surface.fillRect(
          PORTRAIT.x,
          PORTRAIT.y,
          PORTRAIT.size,
          PORTRAIT.size,
          masterPalette.night,
        );
        drawCrosshair(dc, shown);
        drawTouchOverlay(dc, { mode: 'play', moveStick: null, aimStick: null, pressed: ['jump'] });
      });
      expectOnPalette(`run UI (blinking: ${String(blinking)})`, image);
    }
  });

  it('pause menu and the menu touch controls', () => {
    const game = drive({ seed: 1, device: 'touch', overrides: { spawns: [] } });
    game.ticks(5);
    game.ticks(1, { pause: true });
    const menu = game.view.pauseMenu;
    expect(menu).not.toBeNull();
    const image = renderLayers(game.view, (dc) => {
      if (menu) drawPauseMenu(dc, menu);
      drawTouchOverlay(dc, { mode: 'menu', moveStick: null, aimStick: null, pressed: ['up'] });
    });
    expectOnPalette('pause menu', image);
  });

  it('defeat banner and the Veredicto with its stamp, signature and wax seal', () => {
    const game = driveToRunEnd({ kills: 1 });
    game.ticks(60);
    const banner = renderLayers(game.view, (dc) => {
      drawDefeatBanner(dc, 60);
    });
    expectOnPalette('defeat banner', banner);
    while (game.view.screen !== 'verdict') game.ticks(1);
    game.seconds(2);
    const { verdict } = game.view;
    expect(verdict).not.toBeNull();
    const image = renderLayers(game.view, (dc) => {
      if (verdict) drawVerdict(dc, verdict);
    });
    expectOnPalette('Veredicto', image);
  });
});
