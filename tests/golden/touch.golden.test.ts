/**
 * Golden images of the touch controls. The Run is driven through the real touch controller:
 * fingers in, input frames into the Game core, then the view and the controller's overlay are
 * rendered together, as the shell does on a phone.
 */
import { describe, expect, it } from 'vitest';
import { createTouchController, type TouchController } from '../../src/platform/touch/controller';
import { TOUCH_LAYOUT } from '../../src/render';
import { drive, type Driver } from '../support/driver';
import { renderRotatePrompt, renderView } from '../support/render-node';
import { expectGolden } from './golden';

/**
 * Advances `count` ticks feeding the controller's frames, then presents (asks for the
 * overlay, which is what the next fingers are hit-tested against), like the shell's loop.
 */
function play(game: Driver, touch: TouchController, count: number): void {
  for (let i = 0; i < count; i++) game.ticks(1, touch.sample(game.view));
  touch.overlay(game.view);
}

describe('Touch goldens', () => {
  it('run-touch-idle: the controls at rest over the Run', async () => {
    const game = drive({ seed: 1, device: 'touch', overrides: { spawns: [] } });
    const touch = createTouchController();
    play(game, touch, 30);
    await expectGolden('run-touch-idle', renderView(game.view, touch.overlay(game.view)));
  });

  it('run-touch-overlay: moving right, aiming up-right and firing, jump held', async () => {
    const game = drive({
      seed: 1,
      device: 'touch',
      overrides: { spawns: [{ kind: 'maletin-coptero', x: 320, y: 70 }] },
    });
    const touch = createTouchController();
    play(game, touch, 1);
    touch.down(1, { x: 70, y: 200 });
    touch.move(1, { x: 86, y: 196 });
    touch.down(2, { x: 410, y: 170 });
    touch.move(2, { x: 424, y: 156 });
    play(game, touch, 20);
    touch.down(3, { x: TOUCH_LAYOUT.jump.x, y: TOUCH_LAYOUT.jump.y });
    play(game, touch, 6);
    expect(game.view.run?.rexi.grounded).toBe(false);
    await expectGolden('run-touch-overlay', renderView(game.view, touch.overlay(game.view)));
  });

  it('pause-menu-touch: d-pad, confirm and back over the pause menu', async () => {
    const game = drive({ seed: 1, device: 'touch', overrides: { spawns: [] } });
    const touch = createTouchController();
    play(game, touch, 10);
    touch.down(1, { x: TOUCH_LAYOUT.pause.x, y: TOUCH_LAYOUT.pause.y });
    touch.up(1, { x: TOUCH_LAYOUT.pause.x, y: TOUCH_LAYOUT.pause.y });
    play(game, touch, 1);
    expect(game.view.screen).toBe('paused');
    const { dpad } = TOUCH_LAYOUT;
    touch.down(2, { x: dpad.x, y: dpad.y + dpad.arm });
    play(game, touch, 1);
    while (game.view.tick % 60 !== 5) play(game, touch, 1);
    expect(game.view.pauseMenu?.selected).toBe(1);
    await expectGolden('pause-menu-touch', renderView(game.view, touch.overlay(game.view)));
  });

  it('rotate-prompt: upright phone with the turn arrow', async () => {
    await expectGolden('rotate-prompt', renderRotatePrompt(10));
  });

  it('rotate-prompt-sideways: the phone turned', async () => {
    await expectGolden('rotate-prompt-sideways', renderRotatePrompt(70));
  });
});
