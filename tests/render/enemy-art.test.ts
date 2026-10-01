/**
 * The Enemies, projectiles, debris and explosions (#27) draw only master-palette colors, from the
 * ramps an Enemy may use (ADR 0002: no sky or foliage), in every pose the core shows.
 */
import { describe, expect, it } from 'vitest';
import { PROJECTILE_KINDS, type ProjectileView } from '../../src/core';
import { sprites as enemySprites } from '../../src/render/art/generated/enemies';
import { sprites as projectileSprites } from '../../src/render/art/generated/projectiles';
import type { DrawContext } from '../../src/render/draw-context';
import { drawEffects } from '../../src/render/effects';
import { drawEnemies } from '../../src/render/enemies';
import { masterPalette, paletteRamps, type PaletteColorName } from '../../src/render/palette';
import { drawProjectiles } from '../../src/render/projectiles';
import type { SpriteDef } from '../../src/render/sprite';
import type { Color } from '../../src/render/surface';
import { drive, runOf } from '../support/driver';
import { holdStill } from '../support/fixtures';

/** The colors an Enemy may use: every ramp but the sky's and the foliage's. */
const ENEMY_COLORS = new Set<Color>(
  Object.entries(paletteRamps)
    .filter(([ramp]) => ramp !== 'sky' && ramp !== 'foliage')
    .flatMap(([, names]) => names.map((name: PaletteColorName) => masterPalette[name])),
);

/** A DrawContext that records every fill color and every sprite instead of drawing. */
function recorder(view: DrawContext['view']) {
  const fills = new Set<Color>();
  const sprites = new Set<SpriteDef>();
  const dc: DrawContext = {
    view,
    surface: {
      fillRect: (_x, _y, _w, _h, color) => {
        fills.add(color);
      },
      drawBitmap: () => undefined,
    },
    sprites: {
      get: (sprite) => {
        sprites.add(sprite);
        return { width: sprite.width, height: sprite.height };
      },
    },
  };
  return { dc, fills, sprites };
}

function colorsOf(sprites: Iterable<SpriteDef>): Set<Color> {
  const out = new Set<Color>();
  for (const sprite of sprites) {
    for (const row of sprite.rows) {
      for (const key of row) {
        const color = sprite.palette[key];
        if (color !== undefined) out.add(color);
      }
    }
  }
  return out;
}

function offClass(colors: Iterable<Color>): Color[] {
  return [...colors].filter((color) => !ENEMY_COLORS.has(color));
}

describe('Enemy art palette', () => {
  it('exports only colors from the Enemy ramps', () => {
    const all = [...Object.values(enemySprites), ...Object.values(projectileSprites)];
    expect(offClass(colorsOf(all))).toEqual([]);
  });

  it('draws Enemies, their shots, debris and explosions in Enemy colors in every pose', () => {
    const game = drive({
      seed: 4,
      overrides: {
        spawns: [
          { kind: 'maletin-coptero', x: 80, y: 120 },
          { kind: 'archivador-artillado', x: 200, y: 50 },
          { kind: 'caminadora-a-reaccion', x: 330, y: 120 },
          { kind: 'banca-artillada', x: 420, y: 60 },
        ],
        tuning: holdStill({
          rexi: { maxHealth: 1_000_000 },
          enemies: {
            'archivador-artillado': { dropRange: 480, firstDropDelay: 0.2 },
            'banca-artillada': { firstVolleyDelay: 0.5, health: 40 },
          },
        }),
      },
    });
    const seen = { fills: new Set<Color>(), sprites: new Set<SpriteDef>() };
    const poses = new Set<string>();
    for (let tick = 0; tick < 6 * 60; tick++) {
      // Fire at each Enemy in turn, so they flash, smoke, explode and break apart.
      const enemies = runOf(game.view).enemies;
      const target = enemies[Math.floor(tick / 90) % Math.max(1, enemies.length)];
      game.ticks(1, {
        fire: target !== undefined,
        aim: target ? { x: target.x + target.w / 2, y: target.y + target.h / 2 } : { x: 320, y: 0 },
      });
      const run = runOf(game.view);
      for (const enemy of run.enemies) poses.add(`${enemy.kind}:${enemy.pose.attack}`);
      const { dc, fills, sprites } = recorder(game.view);
      drawEnemies(dc, run);
      drawProjectiles(dc, run);
      drawEffects(dc, run);
      fills.forEach((color) => seen.fills.add(color));
      sprites.forEach((sprite) => seen.sprites.add(sprite));
    }
    expect(poses).toContain('archivador-artillado:windup');
    expect(poses).toContain('caminadora-a-reaccion:firing');
    expect(poses).toContain('banca-artillada:windup');
    const debris = Object.entries(enemySprites).filter(([key]) => key.includes('/debris_'));
    expect(debris.some(([, chunk]) => seen.sprites.has(chunk))).toBe(true);
    expect(seen.fills).toContain(masterPalette.sunYellow); // fireballs
    expect(offClass(seen.fills)).toEqual([]);
    expect(offClass(colorsOf(seen.sprites))).toEqual([]);
  });

  it('draws every projectile kind in Enemy colors at every heading and spin', () => {
    const { view } = drive();
    const { dc, fills, sprites } = recorder(view);
    const run = runOf(view);
    let id = 0;
    for (const kind of PROJECTILE_KINDS) {
      for (let degrees = 0; degrees < 360; degrees += 15) {
        for (const age of [0, 1, 2, 5, 9, 17]) {
          const angle = (degrees * Math.PI) / 180;
          const projectile: ProjectileView = {
            id: id++,
            kind,
            owner: 'rexi',
            x: 300,
            y: 150,
            w: 8,
            h: 8,
            vx: Math.cos(angle) * 200,
            vy: Math.sin(angle) * 200,
            age,
          };
          drawProjectiles(dc, { ...run, projectiles: [projectile] });
        }
      }
    }
    expect(offClass(fills)).toEqual([]);
    expect(offClass(colorsOf(sprites))).toEqual([]);
  });
});
