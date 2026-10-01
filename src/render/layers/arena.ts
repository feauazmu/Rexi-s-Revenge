import { SCREEN_WIDTH, TICKS_PER_SECOND, type RunView } from '../../core';
import { sprites as art } from '../art/generated/arena';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import { defineSprite, type SpriteDef } from '../sprite';
import type { Surface } from '../surface';
import { arenaSigns, type NeonState } from './arena-signs';

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

  draw(art['layers/sky'], 0, 0);
  const t = run.tick / TICKS_PER_SECOND;
  for (const cloud of CLOUDS) draw(cloud.sprite, cloudX(cloud, t), cloud.y);
  draw(art['layers/far'], 0, 0);
  draw(art['layers/buildings'], 0, 0);
  draw(art['layers/plaza'], 0, 0);

  const signs = arenaSigns();
  const neon = signs.neon[neonState(run.tick)];
  for (const { sprite, x, y } of [...signs.lettering, neon]) draw(sprite, x, y);
  drawBillboardBulbs(surface, run.tick);

  for (const { x, y, w } of run.arena.platforms) draw(ledgeSprite(w), x, y - 1);
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
 * The pipeline's five clouds, kept clear of the HUD band (top ~32 rows) and above the skyline
 * (whose top edge is ~150): they pass behind the billboard, the tower and the courthouse.
 */
const CLOUDS: readonly Cloud[] = [
  { sprite: art.cloud_c, x: 20, y: 52, speed: 2 },
  { sprite: art.cloud_a, x: 250, y: 64, speed: 3.5 },
  { sprite: art.cloud_b, x: 440, y: 84, speed: 2.75 },
  { sprite: art.cloud_d, x: 150, y: 102, speed: 2.25 },
  { sprite: art.cloud_e, x: 520, y: 124, speed: 4 },
];

/** A cloud's x at time t: it leaves on the right and comes back in from the left. */
function cloudX({ sprite, x, speed }: Cloud, t: number): number {
  const span = SCREEN_WIDTH + sprite.width;
  return (((Math.floor(x + speed * t + sprite.width) % span) + span) % span) - sprite.width;
}

// ---------------------------------------------------------------------------------------------
// Neon and bulbs
// ---------------------------------------------------------------------------------------------

/** The neon sign's flicker loop, ticks. */
const NEON_CYCLE_TICKS = 7 * TICKS_PER_SECOND;
/** [first tick, last tick + 1, state] within the loop; the sign is lit the rest of the time. */
const NEON_FLICKERS: readonly (readonly [number, number, NeonState])[] = [
  [200, 203, 'unlit'],
  [206, 208, 'unlit'],
  [212, 232, 'nameOut'],
  [236, 239, 'nameOut'],
  [330, 332, 'nameOut'],
];

export function neonState(tick: number): NeonState {
  const phase = tick % NEON_CYCLE_TICKS;
  return NEON_FLICKERS.find(([from, to]) => phase >= from && phase < to)?.[2] ?? 'lit';
}

/** Centres of the five lamps over the billboard (their hoods are part of the backdrop). */
const BILLBOARD_LAMPS: readonly number[] = [496, 524, 552, 580, 608];
/** Row of the lamps' glass, under their hoods. */
const BULB_Y = 31;
/** Top row of the billboard's face, where a lit lamp throws its light. */
const BOARD_TOP = 40;
/** The bulbs chase in pairs, switching this often (ticks): slow, so the HUD corner stays calm. */
const BULB_STEP_TICKS = 40;

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
/**
 * Columns of the 102 px ledge used for other widths: the left end with its corbel runs up to
 * the second block joint, then 18 px blocks repeat, then the right end with its corbel.
 */
const LEDGE_BLOCK = { from: 30, to: 48 } as const;
const LEDGE_RIGHT_FROM = 84;

const ledgeCache = new Map<number, SpriteDef>();

/**
 * A stone ledge exactly `w` px wide: the pipeline's own ledge when one has that width, else
 * the 102 px ledge's ends around as many of its blocks as fit (the last one cut short). A
 * ledge narrower than both ends keeps the outer part of each end.
 */
export function ledgeSprite(w: number): SpriteDef {
  const exact = LEDGES.find((ledge) => ledge.width === w);
  if (exact) return exact;
  let sprite = ledgeCache.get(w);
  if (!sprite) {
    const source = art.ledge_102;
    const rightW = source.width - LEDGE_RIGHT_FROM;
    const rows = source.rows.map((row) => {
      const left = row.slice(0, LEDGE_BLOCK.from);
      const right = row.slice(LEDGE_RIGHT_FROM);
      if (w < left.length + rightW) {
        const leftW = Math.max(w - rightW, Math.ceil(w / 2));
        return left.slice(0, leftW) + right.slice(right.length - (w - leftW));
      }
      const block = row.slice(LEDGE_BLOCK.from, LEDGE_BLOCK.to);
      const middle = w - left.length - rightW;
      return left + block.repeat(Math.ceil(middle / block.length)).slice(0, middle) + right;
    });
    sprite = defineSprite(source.palette, rows);
    ledgeCache.set(w, sprite);
  }
  return sprite;
}
