/**
 * Golden images of Rexi's sprite and animations. Every pose comes from driving the real Game
 * core; multi-pose sheets are crops of rendered frames laid side by side.
 */
import { describe, it } from 'vitest';
import { defaultTuning, type InputFramePatch, type ScriptedSpawn, type Vec2 } from '../../src/core';
import { driveEmptyArena, runOf, type Driver } from '../support/driver';
import { renderView } from '../support/render-node';
import { cropImage, tileImages } from '../support/sheet';
import { expectGolden } from './golden';

const TILE = 72;
const ahead = { x: 400, y: 200 };

/** A square crop of the current frame centered on Rexi. */
function rexiTile(game: Driver) {
  const { rexi } = runOf(game.view);
  return cropImage(
    renderView(game.view),
    { cx: rexi.x + rexi.w / 2, cy: rexi.y + rexi.h / 2 - 4 },
    TILE,
  );
}

describe('Rexi goldens', () => {
  it('rexi-idle: standing, mid-breath, aiming ahead', async () => {
    const game = driveEmptyArena();
    game.ticks(30, { aim: ahead });
    await expectGolden('rexi-idle', renderView(game.view));
  });

  it('rexi-idle-breath: exhaled and inhaled', async () => {
    const game = driveEmptyArena();
    game.ticks(10, { aim: ahead });
    const exhaled = rexiTile(game);
    game.ticks(30, { aim: ahead });
    await expectGolden('rexi-idle-breath', tileImages([exhaled, rexiTile(game)], 2));
  });

  it('rexi-running: the six-frame run cycle, forward then backpedaling', async () => {
    const game = driveEmptyArena();
    const tiles = [];
    game.ticks(2, { move: 1, aim: ahead });
    for (let frame = 0; frame < 6; frame++) {
      tiles.push(rexiTile(game));
      game.ticks(4, { move: 1, aim: ahead });
    }
    for (let frame = 0; frame < 6; frame++) {
      tiles.push(rexiTile(game));
      game.ticks(4, { move: -1, aim: ahead });
    }
    await expectGolden('rexi-running', tileImages(tiles, 6));
  });

  it('rexi-running-frame: running right while firing', async () => {
    const game = driveEmptyArena();
    game.seconds(0.4, { move: 1, aim: { x: 460, y: 150 } });
    game.ticks(1, { move: 1, aim: { x: 460, y: 150 }, fire: true });
    await expectGolden('rexi-running-frame', renderView(game.view));
  });

  it('rexi-jumping: rising, apex and falling', async () => {
    const game = driveEmptyArena();
    const jump: InputFramePatch = { jump: true, aim: ahead };
    game.ticks(6, jump);
    const rising = rexiTile(game);
    game.ticks(14, jump);
    const apex = rexiTile(game);
    game.ticks(14, { aim: ahead });
    await expectGolden('rexi-jumping', tileImages([rising, apex, rexiTile(game)], 3));
  });

  it('rexi-hurt: hurt reaction after touching an Enemy, normal and blink frames', async () => {
    const { width, height } = defaultTuning.enemies['maletin-coptero'];
    // A Maletín-cóptero low behind Rexi, just touching his back.
    const bump: ScriptedSpawn = {
      kind: 'maletin-coptero',
      x: defaultTuning.rexi.spawnX - width + 2,
      y: defaultTuning.arena.groundY - height - 2,
    };
    const game = driveEmptyArena({ overrides: { spawns: [bump] } });
    game.ticks(2, { aim: ahead });
    const steady = rexiTile(game);
    game.ticks(3, { aim: ahead });
    const blink = rexiTile(game);
    await expectGolden('rexi-hurt', tileImages([steady, blink], 2));
  });

  it('rexi-aim: the arm and Mazo point at the crosshair in 16 directions, both facings', async () => {
    const tiles = [];
    for (let k = 0; k < 16; k++) {
      const game = driveEmptyArena();
      const angle = (k * Math.PI) / 8;
      const { rexi } = runOf(game.view);
      const center: Vec2 = { x: rexi.x + rexi.w / 2, y: rexi.y + 6.5 };
      const aim = { x: center.x + Math.cos(angle) * 30, y: center.y - Math.sin(angle) * 30 };
      game.ticks(8, { aim });
      tiles.push(rexiTile(game));
    }
    await expectGolden('rexi-aim', tileImages(tiles, 8));
  });
});
