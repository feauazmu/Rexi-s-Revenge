/**
 * Golden images of Rexi's sprite and animations. Every pose comes from driving the real Game
 * core; multi-pose sheets are crops of rendered frames laid side by side.
 */
import { describe, expect, it } from 'vitest';
import { type InputFramePatch, type ScriptedSpawn, type Vec2 } from '../../src/core';
import { driveEmptyArena, eventsOf, runOf, type Driver } from '../support/driver';
import { renderView } from '../support/render-node';
import { cropImage, tileImages } from '../support/sheet';
import { expectGolden } from './golden';

const TILE = 112;
const ahead = { x: 533, y: 267 };

/** A square crop of the current frame centered on Rexi. */
function rexiTile(game: Driver) {
  const { rexi } = runOf(game.view);
  return cropImage(
    renderView(game.view),
    { cx: rexi.x + rexi.w / 2, cy: rexi.y + rexi.h / 2 - 8 },
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

  it('rexi-running: the eight-frame run cycle, forward then backpedaling', async () => {
    const game = driveEmptyArena();
    const tiles = [];
    game.ticks(2, { move: 1, aim: ahead });
    for (let frame = 0; frame < 8; frame++) {
      tiles.push(rexiTile(game));
      game.ticks(4, { move: 1, aim: ahead });
    }
    for (let frame = 0; frame < 8; frame++) {
      tiles.push(rexiTile(game));
      game.ticks(4, { move: -1, aim: ahead });
    }
    await expectGolden('rexi-running', tileImages(tiles, 8));
  });

  it('rexi-running-frame: running right while firing', async () => {
    const game = driveEmptyArena();
    game.seconds(0.4, { move: 1, aim: { x: 613, y: 200 } });
    game.ticks(1, { move: 1, aim: { x: 613, y: 200 }, fire: true });
    await expectGolden('rexi-running-frame', renderView(game.view));
  });

  it('rexi-jumping: rising, apex, falling and the landing squat', async () => {
    const game = driveEmptyArena();
    const jump: InputFramePatch = { jump: true, aim: ahead };
    game.ticks(6, jump);
    const rising = rexiTile(game);
    game.ticks(14, jump);
    const apex = rexiTile(game);
    game.ticks(14, { aim: ahead });
    const falling = rexiTile(game);
    for (let t = 0; t < 120 && !runOf(game.view).rexi.grounded; t++) game.ticks(1, { aim: ahead });
    expect(runOf(game.view).rexi.landedTicks).toBe(0);
    await expectGolden('rexi-jumping', tileImages([rising, apex, falling, rexiTile(game)], 4));
  });

  it('rexi-hurt: hurt reaction after an Enemy paper hits him, normal and blink frames', async () => {
    // A Maletín-cóptero firing perfectly aimed papers at Rexi.
    const shooter: ScriptedSpawn = { kind: 'maletin-coptero', x: 400, y: 80 };
    const game = driveEmptyArena({
      overrides: {
        spawns: [shooter],
        tuning: {
          enemies: { 'maletin-coptero': { fireIntervalMin: 1, fireIntervalMax: 1, aimError: 0 } },
        },
      },
    });
    for (let t = 0; t < 300 && !eventsOf(game.ticks(1, { aim: ahead }), 'rexi-hit').length; t++);
    expect(runOf(game.view).rexi.hurtTicks).toBeGreaterThan(0);
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
      const center: Vec2 = { x: rexi.x + rexi.w / 2, y: rexi.shoulder.y };
      const aim = { x: center.x + Math.cos(angle) * 30, y: center.y - Math.sin(angle) * 30 };
      game.ticks(8, { aim });
      tiles.push(rexiTile(game));
    }
    await expectGolden('rexi-aim', tileImages(tiles, 8));
  });
});
