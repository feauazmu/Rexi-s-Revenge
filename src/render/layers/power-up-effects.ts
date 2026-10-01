import { SCREEN_HEIGHT, SCREEN_WIDTH, type ActivePowerUpView, type RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { BODY_ANCHOR_X, BODY_HEIGHT, BODY_WIDTH } from '../rexi/body';
import { defineSprite } from '../sprite';
import type { Color } from '../surface';

/**
 * Looks of timed Power-ups that are not on the HUD (Inmunidad Judicial's glow lives with Rexi's
 * figure). Each reads `run.rexi.powerUps` and animates from `run.tick`, never a clock.
 */

/** During its last seconds an effect flickers, warning that it is about to end. */
const WARNING_TICKS = 120;
const WARNING_FLICKER_TICKS = 4;

/** The active Power-up `id`, or undefined when it is off or in a flicker-off beat of its warning. */
function shownPowerUp(run: RunView, id: ActivePowerUpView['id']): ActivePowerUpView | undefined {
  const active = run.rexi.powerUps.find((p) => p.id === id);
  if (!active) return undefined;
  const flickerOff =
    active.ticksLeft <= WARNING_TICKS &&
    Math.floor(active.ticksLeft / WARNING_FLICKER_TICKS) % 2 === 1;
  return flickerOff ? undefined : active;
}

// ── Pre-entreno ──────────────────────────────────────────────────────────────────────────

/** The slowed world's cool tint: a sparse dot dither (one pixel in sixteen; no alpha blending). */
const SLOW_TINT = defineSprite({ c: '#6cc4f0' }, [
  'c.......'.repeat(SCREEN_WIDTH / 8),
  '........'.repeat(SCREEN_WIDTH / 8),
  '....c...'.repeat(SCREEN_WIDTH / 8),
  '........'.repeat(SCREEN_WIDTH / 8),
]);

/**
 * World layer, drawn over the Arena, Crates, Enemies and projectiles but under Rexi: while
 * Pre-entreno slows them, the world takes a cool tint and Rexi stands out untinted.
 */
export function drawSlowMotionTint(dc: DrawContext, run: RunView): void {
  if (!shownPowerUp(run, 'pre-entreno')) return;
  const bitmap = dc.sprites.get(SLOW_TINT);
  for (let y = 0; y < SCREEN_HEIGHT; y += SLOW_TINT.height) dc.surface.drawBitmap(bitmap, 0, y);
}

/** Speed lines trailing a running Rexi: height above his feet, length, phase offset. */
const SPEED_LINES = [
  { up: 26, length: 9, phase: 0 },
  { up: 19, length: 13, phase: 3 },
  { up: 12, length: 7, phase: 1 },
  { up: 5, length: 11, phase: 4 },
] as const;
const SPEED_LINE_COLORS: readonly Color[] = ['#ffffff', '#bfe8ff'];
/** Gap between Rexi's trailing edge and the nearest line, px. */
const SPEED_LINE_GAP = 3;
/** The lines stream back over this many pixels before wrapping, px. */
const SPEED_LINE_TRAVEL = 6;

/** Pre-entreno: Rexi keeps his full speed, so streaks trail him while he runs. */
function drawSpeedLines(dc: DrawContext, run: RunView): void {
  const { rexi } = run;
  if (rexi.vx === 0 || !shownPowerUp(run, 'pre-entreno')) return;
  const behind = rexi.vx > 0 ? -1 : 1;
  const trailingEdge = Math.round(behind < 0 ? rexi.x : rexi.x + rexi.w);
  const feet = Math.round(rexi.y + rexi.h);
  SPEED_LINES.forEach((line, i) => {
    const drift = (run.tick + line.phase) % SPEED_LINE_TRAVEL;
    const near = trailingEdge + behind * (SPEED_LINE_GAP + drift);
    const x = behind < 0 ? near - line.length : near;
    const color = SPEED_LINE_COLORS[i % SPEED_LINE_COLORS.length] ?? '#ffffff';
    dc.surface.fillRect(x, feet - line.up, line.length, 1, color);
  });
}

// ── Día de Pierna ────────────────────────────────────────────────────────────────────────

const FLAME_PALETTE = { W: '#fff8e0', Y: '#ffd84a', R: '#f06a2a', r: '#a83a1a' } as const;
/** A jet flame under one boot: two flickering frames, 3 px wide. */
// prettier-ignore
const JET_FLAME = [
  defineSprite(FLAME_PALETTE, ['WYW', 'YWY', 'RYR', 'RYR', '.R.', '.R.', '.r.']),
  defineSprite(FLAME_PALETTE, ['WYW', 'RWR', 'RYR', '.Y.', '.R.', '.r.', '...']),
] as const;
const JET_FLAME_TICKS = 2;
/**
 * Where the flames fire from on Rexi's 32×38 body canvas (facing right): the center column of
 * each boot and the row just under the soles of the tucked `jump` legs (src/render/rexi/body.ts),
 * the pose he flies in.
 */
const SOLE_COLUMNS = [12, 21] as const;
const BELOW_SOLES_ROW = 35;
/** Exhaust puffs streaming down from each flame: offset across, size, color. */
const EXHAUST = [
  { dx: 0, size: 2, color: '#e0d8d0' },
  { dx: 1, size: 2, color: '#b8b0a8' },
  { dx: 0, size: 1, color: '#8a8480' },
] as const satisfies readonly { dx: number; size: number; color: Color }[];
/** Puffs travel this far below the flame before wrapping, px. */
const EXHAUST_TRAVEL = 15;

/** Día de Pierna: jet flames and exhaust from his boots while the thrust pushes him. */
function drawJetTrail(dc: DrawContext, run: RunView): void {
  const { rexi } = run;
  if (!rexi.flying) return;
  const left = Math.round(rexi.x + rexi.w / 2) - BODY_ANCHOR_X;
  const top = Math.round(rexi.y + rexi.h) - BODY_HEIGHT + BELOW_SOLES_ROW;
  SOLE_COLUMNS.forEach((column, boot) => {
    const x = left + (rexi.facing === 1 ? column : BODY_WIDTH - 1 - column) - 1;
    // The boots flicker out of step, so the pair never pulses as one.
    const frame = Math.floor(run.tick / JET_FLAME_TICKS + boot) % JET_FLAME.length;
    const flame = JET_FLAME[frame] ?? JET_FLAME[0];
    dc.surface.drawBitmap(dc.sprites.get(flame), x, top);
    EXHAUST.forEach((puff, i) => {
      const fall = (run.tick + boot * 5 + i * (EXHAUST_TRAVEL / EXHAUST.length)) % EXHAUST_TRAVEL;
      dc.surface.fillRect(x + puff.dx, top + flame.height + fall, puff.size, puff.size, puff.color);
    });
  });
}

/** Drawn behind Rexi's figure: the trails his Power-ups leave as he moves. */
export function drawRexiTrails(dc: DrawContext, run: RunView): void {
  drawSpeedLines(dc, run);
  drawJetTrail(dc, run);
}
