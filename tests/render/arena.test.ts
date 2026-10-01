import { describe, expect, it } from 'vitest';
import type { RunView } from '../../src/core';
import { sprites as art } from '../../src/render/art/generated/arena';
import type { DrawContext } from '../../src/render/draw-context';
import { drawArena, neonState } from '../../src/render/layers/arena';
import { arenaSigns } from '../../src/render/layers/arena-signs';
import { findOffPaletteSpriteColors, isPaletteColor } from '../../src/render/palette-audit';
import type { SpriteDef } from '../../src/render/sprite';
import type { Bitmap } from '../../src/render/surface';
import { drive } from '../support/driver';

type Op =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: string }
  | { kind: 'bitmap'; sprite: SpriteDef; x: number; y: number };

/** Draws the Arena into a list of operations (the sprite bank hands back the SpriteDef). */
function record(run: RunView): Op[] {
  const ops: Op[] = [];
  const dc = {
    surface: {
      fillRect: (x: number, y: number, w: number, h: number, color: string) => {
        ops.push({ kind: 'rect', x, y, w, h, color });
      },
      drawBitmap: (bitmap: Bitmap, x: number, y: number) => {
        ops.push({ kind: 'bitmap', sprite: bitmap as unknown as SpriteDef, x, y });
      },
    },
    sprites: { get: (sprite: SpriteDef) => sprite as unknown as Bitmap },
  } as unknown as DrawContext;
  drawArena(dc, run);
  return ops;
}

function runAt(seconds: number, platforms?: { x: number; y: number; w: number }[]): RunView {
  const game = drive({
    seed: 1,
    overrides: { spawns: [], ...(platforms ? { tuning: { arena: { platforms } } } : {}) },
  });
  game.seconds(seconds);
  return game.view.run ?? expect.unreachable('no Run');
}

describe('Arena', () => {
  it('uses only master-palette colors', () => {
    const signs = arenaSigns();
    const all = [
      ...Object.values(art),
      ...signs.lettering.map((s) => s.sprite),
      signs.neon.lit.sprite,
      signs.neon.unlit.sprite,
      signs.neon.nameOut.sprite,
    ];
    expect(findOffPaletteSpriteColors(all)).toEqual([]);
    for (const op of record(runAt(1))) {
      if (op.kind === 'rect') expect(isPaletteColor(op.color), op.color).toBe(true);
    }
  });

  it('animates deterministically from the Run tick', () => {
    expect(record(runAt(2.5))).toEqual(record(runAt(2.5)));
    expect(record(runAt(2.5))).not.toEqual(record(runAt(5)));
  });

  it('keeps the neon mostly lit, with short deterministic flickers', () => {
    const states = Array.from({ length: 7 * 60 }, (_, tick) => neonState(tick));
    const lit = states.filter((s) => s === 'lit').length;
    expect(lit / states.length).toBeGreaterThan(0.9);
    expect(new Set(states)).toEqual(new Set(['lit', 'unlit', 'nameOut']));
    expect(neonState(7 * 60 + 210)).toBe(neonState(210));
  });

  it('draws a ledge of any width from end pieces and repeated blocks', () => {
    for (const w of [60, 102, 120, 144, 200]) {
      const x = 100;
      const ops = record(runAt(0.1, [{ x, y: 200, w }]));
      const ledges = ops.filter(
        (op): op is Extract<Op, { kind: 'bitmap' }> => op.kind === 'bitmap' && op.y === 199,
      );
      const left = Math.min(...ledges.map((op) => op.x));
      const right = Math.max(...ledges.map((op) => op.x + op.sprite.width));
      expect([left, right], `w=${w}`).toEqual([x, x + w]);
    }
  });
});
