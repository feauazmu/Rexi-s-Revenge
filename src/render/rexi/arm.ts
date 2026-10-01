import type { Vec2 } from '../../core';
import { defineSprite, mirrorSprite, type SpriteDef } from '../sprite';
import type { HeldWeapon } from './held-weapons';
import { rexiFlashPalette, rexiPalette, type RexiInk } from './palette';

/**
 * Rexi's aiming arm and held Weapon in 16 discrete directions (ADR 0001: drawn in code). Each
 * direction is rasterized once from simple shapes (a bulging upper arm, forearm, fist and the
 * Weapon), so rotation stays crisp instead of resampling a bitmap.
 */

/** Number of discrete aim directions around the full circle. */
export const AIM_DIRECTIONS = 16;
const STEP = (2 * Math.PI) / AIM_DIRECTIONS;
/** Facing right covers steps -4 (straight down) … 4 (straight up); facing left mirrors them. */
export const MAX_AIM_STEP = AIM_DIRECTIONS / 4;

/** Arm geometry along the aim, px from the shoulder pivot. */
const ELBOW = 5.5;
const WRIST = 10;
const FIST = 11.3;
/** Distance from the shoulder pivot to the fist center, px; held Weapons start there. */
export const FIST_REACH = FIST;
const FIST_RADIUS = 2.6;

/** Unit vector toward the light (upper left), screen coordinates. */
const LIGHT: Vec2 = { x: -0.55, y: -0.83 };

/**
 * The discrete arm step that points at `aim` from `shoulder`, for the given facing: the
 * angle above the horizontal (toward the facing side) rounded to the nearest 22.5°, clamped to
 * straight up/down when the aim is slightly behind the shoulder.
 */
export function aimStep(shoulder: Vec2, aim: Vec2, facing: 1 | -1): number {
  const dx = (aim.x - shoulder.x) * facing;
  const dy = shoulder.y - aim.y;
  if (dx === 0 && dy === 0) return 0;
  let angle = Math.atan2(dy, dx);
  if (angle > Math.PI / 2) angle = Math.PI / 2;
  if (angle < -Math.PI / 2) angle = -Math.PI / 2;
  return Math.max(-MAX_AIM_STEP, Math.min(MAX_AIM_STEP, Math.round(angle / STEP)));
}

/** Screen-space unit vector of an arm step (facing right; mirror x for facing left). */
export function stepDirection(step: number): Vec2 {
  const angle = step * STEP;
  return { x: Math.cos(angle), y: -Math.sin(angle) };
}

export interface ArmSprite {
  readonly sprite: SpriteDef;
  /** The shoulder pivot's pixel inside the sprite. */
  readonly pivotX: number;
  readonly pivotY: number;
}

/**
 * Sleeve tattoo over the upper arm (Rexi's right arm): the lion's golden mane near the shoulder
 * flowing into the courthouse's columns toward the elbow, shaded with the limb. `u` runs along
 * the arm from the shoulder, `v` across it.
 */
function sleeveTone(brightness: number, u: number, v: number): RexiInk {
  if (brightness < -0.45) return 'i';
  if (u < ELBOW * 0.5) {
    // Mane: golden locks and ink curls.
    const curl = (Math.floor(u * 1.4) + Math.floor(v + 8)) % 3 === 0;
    if (brightness > 0.2) return curl ? 'a' : 'j';
    return curl ? 's' : 'j';
  }
  // The courthouse's steps: an ink band at the elbow where the sleeve ends.
  if (u > ELBOW - 1) return 'i';
  // Columns: ink stripes with skin showing between them.
  return Math.floor(v + 8) % 2 === 0 ? 'j' : skinTone(brightness);
}

function skinTone(brightness: number): RexiInk {
  if (brightness > 0.36) return 'l';
  if (brightness > -0.18) return 's';
  if (brightness > -0.5) return 'm';
  return 'n';
}

type Part = 'fist' | 'weapon' | 'fore' | 'upper';

interface Cell {
  readonly ink: RexiInk;
  readonly part: Part;
}

/** What covers the point (u along the arm, v across it); front-most part first. */
function armCell(
  u: number,
  v: number,
  lit: number,
  weapon: HeldWeapon,
  inked: boolean,
): Cell | null {
  // Fist: a ball at the end of the forearm.
  const fu = u - FIST;
  const fistDistance = Math.hypot(fu, v);
  if (fistDistance <= FIST_RADIUS) {
    const brightness = (lit * v - 0.3 * fu) / FIST_RADIUS;
    const knuckle = fu > 1.1 && Math.abs(v) < 1.6;
    return { ink: knuckle ? 'm' : skinTone(brightness), part: 'fist' };
  }

  const ink = weapon.paint(u - FIST, v);
  if (ink) return { ink, part: 'weapon' };

  if (u >= ELBOW - 0.5 && u <= WRIST) {
    const t = (u - ELBOW) / (WRIST - ELBOW);
    const radius = 2.8 - 0.7 * t + 0.5 * Math.sin(Math.PI * Math.min(1, t * 1.6));
    if (Math.abs(v) <= radius) {
      // The sleeve reaches the elbow, where the forearm's root overlaps the upper arm.
      if (inked && u <= ELBOW) return { ink: sleeveTone((lit * v) / radius, u, v), part: 'fore' };
      if (u < ELBOW + 0.6 && v > 0.6) return { ink: 'n', part: 'fore' };
      return { ink: skinTone((lit * v) / radius), part: 'fore' };
    }
  }

  if (u >= -2 && u <= ELBOW + 0.5) {
    const t = Math.max(0, u) / ELBOW;
    const radius = 3 + 1.1 * Math.sin(Math.PI * t);
    if (Math.abs(v) <= radius) {
      const brightness = (lit * v) / radius + 0.1;
      // The sleeve stops at the elbow, where the forearm takes over.
      const ink = inked && u <= ELBOW ? sleeveTone(brightness, u, v) : skinTone(brightness);
      return { ink, part: 'upper' };
    }
  }
  return null;
}

/**
 * Rasterizes the arm for one step (facing right), cropped, with an outline. `inked` draws the
 * sleeve tattoo on the upper arm.
 */
function buildArm(step: number, weapon: HeldWeapon, inked: boolean): ArmSprite {
  const dir = stepDirection(step);
  // Across-axis unit vector pointing at the arm's underside.
  const side: Vec2 = { x: -dir.y, y: dir.x };
  // Brightness of a point is (side · light) × v / radius: the lit side of a round limb.
  const lit = side.x * LIGHT.x + side.y * LIGHT.y;
  const reach = FIST + weapon.length + 6;

  // Fill a generous square around the pivot, then crop.
  const size = Math.ceil(reach) * 2 + 3;
  const center = Math.floor(size / 2);
  const cells: (Cell | null)[][] = [];
  for (let gy = 0; gy < size; gy++) {
    const row: (Cell | null)[] = [];
    for (let gx = 0; gx < size; gx++) {
      const px = gx - center;
      const py = gy - center;
      const u = px * dir.x + py * dir.y;
      const v = px * side.x + py * side.y;
      row.push(armCell(u, v, lit, weapon, inked));
    }
    cells.push(row);
  }

  const filled = (x: number, y: number): boolean => cells[y]?.[x] != null;
  const isFist = (x: number, y: number): boolean => cells[y]?.[x]?.part === 'fist';
  const inks: string[][] = cells.map((row, y) =>
    row.map((cell, x) => {
      if (cell) {
        // A dark wrist line separates the fist from the forearm.
        const nextToFist =
          isFist(x - 1, y) || isFist(x + 1, y) || isFist(x, y - 1) || isFist(x, y + 1);
        return cell.part === 'fore' && nextToFist ? 'k' : cell.ink;
      }
      const edge = filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1);
      return edge ? 'k' : '.';
    }),
  );

  let minX = size;
  let maxX = -1;
  let minY = size;
  let maxY = -1;
  inks.forEach((row, y) => {
    row.forEach((ink, x) => {
      if (ink === '.') return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });
  const rows = inks.slice(minY, maxY + 1).map((row) => row.slice(minX, maxX + 1).join(''));
  return { sprite: defineSprite(rexiPalette, rows), pivotX: center - minX, pivotY: center - minY };
}

function mirrorArm(arm: ArmSprite): ArmSprite {
  return {
    sprite: mirrorSprite(arm.sprite),
    pivotX: arm.sprite.width - 1 - arm.pivotX,
    pivotY: arm.pivotY,
  };
}

const cache = new WeakMap<HeldWeapon, Map<string, ArmSprite>>();

function flashArm(arm: ArmSprite): ArmSprite {
  return { ...arm, sprite: defineSprite(rexiFlashPalette, arm.sprite.rows) };
}

/**
 * The arm sprite for `step` and facing, holding `weapon` (`flash`: hurt-blink colors). Built
 * once, then cached. Facing right the aiming arm is Rexi's left arm (a plain arm); facing left
 * it is his right arm and wears the sleeve tattoo (mirrored).
 */
export function armSprite(
  weapon: HeldWeapon,
  step: number,
  facing: 1 | -1,
  flash = false,
): ArmSprite {
  let arms = cache.get(weapon);
  if (!arms) {
    arms = new Map();
    cache.set(weapon, arms);
  }
  const key = `${step}:${facing}:${flash ? 1 : 0}`;
  let arm = arms.get(key);
  if (!arm) {
    if (flash) arm = flashArm(armSprite(weapon, step, facing));
    else if (facing === -1) arm = mirrorArm(buildArm(step, weapon, true));
    else arm = buildArm(step, weapon, false);
    arms.set(key, arm);
  }
  return arm;
}
