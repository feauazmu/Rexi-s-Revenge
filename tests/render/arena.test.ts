import { describe, expect, it } from 'vitest';
import { defaultTuning, SCREEN_HEIGHT, SCREEN_WIDTH, type RunView } from '../../src/core';
import { sprites as art } from '../../src/render/art/generated/arena';
import type { DrawContext } from '../../src/render/draw-context';
import { ARENA_BLEED, drawArena, ledgeSprite, neonState } from '../../src/render/layers/arena';
import { arenaSigns } from '../../src/render/layers/arena-signs';
import { findOffPaletteSpriteColors, isPaletteColor } from '../../src/render/palette-audit';
import type { SpriteDef } from '../../src/render/sprite';
import type { Bitmap } from '../../src/render/surface';
import { drive, eventsOf } from '../support/driver';
import { holdStill } from '../support/fixtures';
import { renderView } from '../support/render-node';
import type { RgbaImage } from '../golden/golden';

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

  it('draws each platform as one ledge exactly its width, outlined at both ends', () => {
    const ops = record(runAt(0.1, [{ x: 100, y: 200, w: 120 }]));
    expect(ops).toContainEqual({ kind: 'bitmap', sprite: ledgeSprite(120), x: 100, y: 199 });
    expect(ledgeSprite(102)).toBe(art.ledge_102);
    expect(ledgeSprite(144)).toBe(art.ledge_144);
    expect(ledgeSprite(208)).toBe(art.ledge_208);
    for (const w of [8, 31, 47, 48, 60, 101, 120, 200]) {
      const ledge = ledgeSprite(w);
      expect(ledge.width, `w=${w}`).toBe(w);
      const outline = ledge.rows[0]?.charAt(0) ?? '';
      for (const row of ledge.rows.slice(0, 11)) {
        expect([row.charAt(0), row.charAt(w - 1)], `w=${w}`).toEqual([outline, outline]);
      }
    }
  });

  it('bleeds past every screen edge by more than the default screen shake can move it', () => {
    const { maxOffset, scale } = defaultTuning.effects.shake;
    expect(maxOffset * scale).toBeLessThanOrEqual(ARENA_BLEED);
    const layers = record(runAt(1)).filter(
      (op) => op.kind === 'bitmap' && op.sprite.width > SCREEN_WIDTH,
    );
    expect(layers).toHaveLength(4);
    for (const op of layers) {
      expect(op).toMatchObject({ x: -ARENA_BLEED, y: -ARENA_BLEED });
      if (op.kind !== 'bitmap') continue;
      expect([op.sprite.width, op.sprite.height]).toEqual([
        SCREEN_WIDTH + 2 * ARENA_BLEED,
        SCREEN_HEIGHT + 2 * ARENA_BLEED,
      ]);
    }
  });

  it('never shows the letterbox at the edges of a shaken frame, even past the bleed', () => {
    // Full trauma and four times the shake, so the offset passes the bleed and the renderer
    // has to clamp it.
    const game = drive({
      seed: 3,
      overrides: {
        spawns: [{ kind: 'maletin-coptero', x: 320, y: 120 }],
        tuning: holdStill({
          effects: { shake: { scale: 4 }, explosions: { large: { trauma: 1 } } },
          weapons: { 'mazo-automatico': { damage: 999 } },
          enemies: { 'maletin-coptero': { explosion: 'large' } },
        }),
      },
    });
    // A frame shaken past the bleed on each axis; the strip the world moved away from would
    // be letterbox black without the bleed.
    const frames: { x?: RgbaImage; y?: RgbaImage } = {};
    const shakes = { x: 0, y: 0 };
    for (let t = 0; t < 240 && !(frames.x && frames.y); t++) {
      game.ticks(1, {
        aim: { x: 335, y: 132 },
        fire: eventsOf(game.log, 'enemy-destroyed').length === 0,
      });
      const shake = game.view.run?.effects.shake ?? { x: 0, y: 0 };
      for (const axis of ['x', 'y'] as const) {
        if (!frames[axis] && Math.abs(shake[axis]) > ARENA_BLEED) {
          frames[axis] = renderView(game.view);
          shakes[axis] = shake[axis];
        }
      }
    }
    if (!frames.x || !frames.y) throw new Error('the shake never passed the bleed on both axes');
    const B = ARENA_BLEED;
    const columns = shakes.x > 0 ? [0, B] : [SCREEN_WIDTH - B, SCREEN_WIDTH];
    const rows = shakes.y > 0 ? [0, B] : [SCREEN_HEIGHT - B, SCREEN_HEIGHT];
    // Rows clear of the HUD corners and the Dialogue Box; columns clear of the HUD corners.
    expect(blackShare(frames.x, columns, [40, SCREEN_HEIGHT - 60])).toBeLessThan(0.2);
    expect(blackShare(frames.y, [160, SCREEN_WIDTH - 160], rows)).toBeLessThan(0.2);
  });
});

/** Share of pure-black pixels in the box [x0, x1) × [y0, y1) of `image`. */
function blackShare(
  image: RgbaImage,
  [x0 = 0, x1 = 0]: number[],
  [y0 = 0, y1 = 0]: number[],
): number {
  let black = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4;
      if (image.data[i] === 0 && image.data[i + 1] === 0 && image.data[i + 2] === 0) black++;
    }
  }
  return black / ((x1 - x0) * (y1 - y0));
}
