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
    let shake = { x: 0, y: 0 };
    for (let t = 0; t < 240 && Math.abs(shake.x) <= ARENA_BLEED; t++) {
      game.ticks(1, {
        aim: { x: 335, y: 132 },
        fire: eventsOf(game.log, 'enemy-destroyed').length === 0,
      });
      shake = game.view.run?.effects.shake ?? shake;
    }
    expect(Math.abs(shake.x)).toBeGreaterThan(ARENA_BLEED);
    const { width, data } = renderView(game.view);
    // The uncovered strip (letterbox black without the bleed) is on the side the world moved.
    const strip = shake.x > 0 ? [0, ARENA_BLEED] : [SCREEN_WIDTH - ARENA_BLEED, SCREEN_WIDTH];
    let black = 0;
    let total = 0;
    for (let y = 40; y < SCREEN_HEIGHT - 60; y++) {
      for (let x = strip[0] ?? 0; x < (strip[1] ?? 0); x++) {
        const i = (y * width + x) * 4;
        total++;
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) black++;
      }
    }
    expect(black / total).toBeLessThan(0.2);
  });
});
