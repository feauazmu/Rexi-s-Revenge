import { TICKS_PER_SECOND, type PlatformView, type RunView } from '../../core';
import { sprites as art } from '../art/generated/arena';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import { defineSprite, type SpriteDef } from '../sprite';
import type { Surface } from '../surface';
import { arenaSigns, type PlacedSprite } from './arena-signs';

export const ARENA_WIDTH = 640;

/**
 * The Arena (#28): the plaza at sunset between the courthouse and the Bufete & Pesas S.A.
 * tower, with the Boissons cocktail bar, drawn from the art pipeline's layers (ADR 0002,
 * `art/sheets.json` → `scripts/art/scenes/arena.py`), back to front:
 *
 * sky → drifting clouds → far skyline → buildings → plaza → lettering, neon and billboard
 * bulbs → one-way platforms.
 *
 * Every animation phase comes from the Run tick, so the scene is deterministic and freezes
 * while paused. The HUD band (top) is flat dark sky and the Dialogue Box band (bottom) is flat
 * pavement, so both stay calm.
 */
export function drawArena(dc: DrawContext, run: RunView): void {
  const { surface, sprites } = dc;
  const draw = (sprite: SpriteDef, x: number, y: number) => {
    surface.drawBitmap(sprites.get(sprite), x, y);
  };
  const place = ({ sprite, x, y }: PlacedSprite) => {
    draw(sprite, x, y);
  };

  draw(art['layers/sky'], 0, 0);
  const t = run.tick / TICKS_PER_SECOND;
  for (const cloud of CLOUDS) draw(cloud.sprite, cloudX(cloud, t), cloud.y);
  draw(art['layers/far'], 0, 0);
  draw(art['layers/buildings'], 0, 0);
  draw(art['layers/plaza'], 0, 0);

  const signs = arenaSigns();
  signs.lettering.forEach(place);
  place(signs.neon[neonState(run.tick)]);
  drawBillboardBulbs(surface, run.tick);

  for (const platform of run.arena.platforms) drawPlatform(dc, platform);
}

// ---------------------------------------------------------------------------------------------
// Clouds
// ---------------------------------------------------------------------------------------------

interface Cloud {
  readonly sprite: SpriteDef;
  /** Starting x and fixed y of the top-left corner. */
  readonly x: number;
  readonly y: number;
  /** Drift to the right, px/s. */
  readonly speed: number;
}

/**
 * The pipeline's five clouds, kept between the HUD band and the skyline (whose top edge is
 * ~150): they pass behind the billboard, the tower and the courthouse.
 */
const CLOUDS: readonly Cloud[] = [
  { sprite: art.cloud_c, x: 20, y: 44, speed: 2 },
  { sprite: art.cloud_a, x: 250, y: 58, speed: 3.5 },
  { sprite: art.cloud_b, x: 440, y: 78, speed: 2.75 },
  { sprite: art.cloud_d, x: 150, y: 100, speed: 2.25 },
  { sprite: art.cloud_e, x: 520, y: 122, speed: 4 },
];

/** A cloud's x at time t: it leaves on the right and comes back in from the left. */
function cloudX({ sprite, x, speed }: Cloud, t: number): number {
  const span = ARENA_WIDTH + sprite.width;
  return (((Math.floor(x + speed * t + sprite.width) % span) + span) % span) - sprite.width;
}

// ---------------------------------------------------------------------------------------------
// Neon and bulbs
// ---------------------------------------------------------------------------------------------

/** The neon sign's flicker loop, ticks. */
const NEON_CYCLE_TICKS = 7 * TICKS_PER_SECOND;
/** [first tick, last tick + 1, state] within the loop; the sign is lit the rest of the time. */
const NEON_FLICKERS: readonly (readonly [number, number, 'unlit' | 'nameOut'])[] = [
  [200, 203, 'unlit'],
  [206, 208, 'unlit'],
  [212, 232, 'nameOut'],
  [236, 239, 'nameOut'],
  [330, 332, 'nameOut'],
];

export function neonState(tick: number): 'lit' | 'unlit' | 'nameOut' {
  const phase = tick % NEON_CYCLE_TICKS;
  return NEON_FLICKERS.find(([from, to]) => phase >= from && phase < to)?.[2] ?? 'lit';
}

/** Centres of the five lamps over the billboard (their hoods are part of the backdrop). */
const BILLBOARD_LAMPS: readonly number[] = [496, 524, 552, 580, 608];
/** Row of the lamps' glass, under their hoods. */
const BULB_Y = 31;
/** Top row of the billboard's face, where a lit lamp throws its light. */
const BOARD_TOP = 40;
/** The bulbs chase in pairs, switching this often (ticks). */
const BULB_STEP_TICKS = 24;

function drawBillboardBulbs(surface: Surface, tick: number): void {
  const phase = Math.floor(tick / BULB_STEP_TICKS) % 2;
  BILLBOARD_LAMPS.forEach((x, i) => {
    if (i % 2 === phase) {
      surface.fillRect(x - 2, BULB_Y, 5, 2, P.sunYellow);
      surface.fillRect(x - 1, BULB_Y, 3, 1, P.light);
      // A dithered pool of light on the board's top edge.
      for (let dx = -4; dx <= 4; dx += 2) surface.fillRect(x + dx, BOARD_TOP, 1, 1, P.light);
    } else {
      surface.fillRect(x - 2, BULB_Y, 5, 2, P.leather3);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Platforms
// ---------------------------------------------------------------------------------------------

/** The pipeline's stone ledges, by width; the walkable top is their second row. */
const LEDGES: readonly SpriteDef[] = [art.ledge_102, art.ledge_144];

function slice(sprite: SpriteDef, x0: number, x1: number): SpriteDef {
  return defineSprite(
    sprite.palette,
    sprite.rows.map((row) => row.slice(x0, x1)),
  );
}

/**
 * Pieces of the 102 px ledge for any other width: the left end with its corbel (up to the
 * second block joint), one 18 px block to repeat, and the right end with its corbel.
 */
const LEDGE_LEFT = slice(art.ledge_102, 0, 30);
const LEDGE_BLOCK = slice(art.ledge_102, 30, 48);
const LEDGE_RIGHT = slice(art.ledge_102, 84, 102);

function drawPlatform(dc: DrawContext, { x, y, w }: PlatformView): void {
  const draw = (sprite: SpriteDef, px: number) => {
    dc.surface.drawBitmap(dc.sprites.get(sprite), px, y - 1);
  };
  const exact = LEDGES.find((ledge) => ledge.width === w);
  if (exact) {
    draw(exact, x);
    return;
  }
  draw(LEDGE_LEFT, x);
  for (let px = x + LEDGE_LEFT.width; px < x + w - LEDGE_RIGHT.width; px += LEDGE_BLOCK.width) {
    draw(LEDGE_BLOCK, px);
  }
  draw(LEDGE_RIGHT, x + w - LEDGE_RIGHT.width);
}
