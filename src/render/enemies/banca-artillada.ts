import type { EnemyView, RunView } from '../../core';
import { sprites as art } from '../art/generated/enemies';
import type { DrawContext } from '../draw-context';
import { fillDisc, ramp } from '../effects/burst';
import { masterPalette as P } from '../palette';
import type { SpriteDef } from '../sprite';
import type { Color, Surface } from '../surface';
import { placeBody } from './placement';

/**
 * The pipeline sprite, facing right (art/sheets.json `enemy_banca_v3`, scripts/art/enemies.py):
 * the red bench on its black frame, the barbell loaded with plates on the rack, the gym bro in
 * the canopy, a rocket pod under each end and the engine under the middle.
 */
const BODY = art['banca/body'];

/** Rotor hubs: the left of each mast's two middle columns (symmetric, so both facings). */
const HUBS = [23, 76] as const;
/** Pod centers in the right-facing sprite (the core fires from the hitbox center ± its pod offset). */
const PODS = [
  { x: 16, y: 39 },
  { x: 85, y: 39 },
] as const;
/** Engine grille row and span in the right-facing sprite. */
const GRILLE = { x: 62, y: 34, w: 11 } as const;
/** Where the damage smoke rises from, in the right-facing sprite. */
const ENGINE = { x: 66, y: 30 } as const;

const RING: Color = P.night;
const BLADE: Color = P.red3;
const BLADE_SHADE: Color = P.red2;
const HUB: Color = P.grey1;
const GRILLE_HOT: Color = P.sunYellow;
const GRILLE_WARM: Color = P.skyOrange;
const FLASH: readonly Color[] = [P.white, P.light, P.sunYellow];
/** Pod glow while winding up a volley, coolest first. */
const GLOW: readonly Color[] = [P.skyOrange, P.skyPeach, P.light, P.white];
const SMOKE: readonly Color[] = [P.robe, P.robeMid, P.robeSheen];

/**
 * Banca Artillada: a red bench press turned gunship. A barbell loaded with iron plates rests
 * on the rack, whose two uprights carry rotors; a gym bro in a headband flies it from a glass
 * canopy on the bench, and a rocket pod hangs under each end. It faces Rexi, its pods glow up
 * before a volley (the telegraph) and flash as rockets leave them, and it trails smoke once
 * badly damaged.
 */
export function drawBancaArtillada(dc: DrawContext, enemy: EnemyView, run: RunView): void {
  const { surface, sprites } = dc;
  const right = run.rexi.x + run.rexi.w / 2 >= enemy.x + enemy.w / 2;
  const { sprite, left, top, column } = placeBody('banca', BODY, enemy, right);

  for (const hub of HUBS) drawRotor(surface, left + hub, top - 1, enemy.age);
  surface.drawBitmap(sprites.get(sprite), left, top);

  // The engine grille glows and flickers.
  const hot = Math.floor(enemy.age / 3) % 2 === 0;
  for (let i = 0; i < GRILLE.w; i++) {
    const lit = (i + (hot ? 0 : 1)) % 2 === 0;
    surface.fillRect(column(GRILLE.x + i), top + GRILLE.y, 1, 1, lit ? GRILLE_HOT : GRILLE_WARM);
  }

  const pods = PODS.map((pod) => ({ x: column(pod.x), y: top + pod.y }));
  if (enemy.pose.attack === 'windup') drawPodGlow(surface, enemy, pods);
  drawMuzzleFlashes(surface, run, pods);
  if (enemy.health <= enemy.maxHealth * 0.4) {
    drawDamageSmoke(surface, enemy, column(ENGINE.x), top + ENGINE.y);
  }
}

/**
 * A two-blade rotor seen from slightly above: a thin elliptical ring with the red blades
 * sweeping round it (4 frames), around a dark hub. `c` is the left of the hub's two middle
 * columns (the mast's center line runs between `c` and `c + 1`), `cy` the ring's middle row.
 */
function drawRotor(surface: Surface, c: number, cy: number, age: number): void {
  /** A run of pixels from column `c + from` to `c + to` on row `y`. */
  const span = (from: number, to: number, y: number, color: Color) => {
    surface.fillRect(c + from, y, to - from + 1, 1, color);
  };
  const pair = (inner: number, outer: number, y: number) => {
    span(-outer, -inner, y, RING);
    span(1 + inner, 1 + outer, y, RING);
  };
  span(-13, 14, cy - 2, RING);
  pair(14, 18, cy - 1);
  pair(19, 21, cy);
  pair(14, 18, cy + 1);
  span(-13, 14, cy + 2, RING);

  switch (Math.floor(age / 2) % 4) {
    case 0: // side on: one long blade across
      span(-20, 21, cy, BLADE);
      break;
    case 1: // turning toward the viewer
      span(-16, -6, cy - 1, BLADE_SHADE);
      span(-5, 6, cy, BLADE);
      span(7, 17, cy + 1, BLADE);
      break;
    case 2: // end on: short and foreshortened
      span(0, 1, cy - 2, BLADE_SHADE);
      span(0, 1, cy - 1, BLADE_SHADE);
      span(-4, 5, cy, BLADE);
      span(0, 1, cy + 1, BLADE);
      span(0, 1, cy + 2, BLADE);
      break;
    default: // turning away
      span(7, 17, cy - 1, BLADE_SHADE);
      span(-5, 6, cy, BLADE);
      span(-16, -6, cy + 1, BLADE);
  }
  surface.fillRect(c - 1, cy - 1, 4, 2, P.outline);
  surface.fillRect(c, cy - 1, 2, 1, HUB);
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * The volley telegraph: both pods glow up as the windup runs, from a dim ember to a white-hot
 * disc, blinking faster toward the end.
 */
function drawPodGlow(surface: Surface, enemy: EnemyView, pods: readonly Point[]): void {
  const { windup } = enemy.pose;
  const blinkEvery = windup < 0.6 ? 4 : 2;
  if (Math.floor(enemy.age / blinkEvery) % 2 === 1 && windup < 0.9) return;
  const color = ramp(GLOW, windup);
  const r = 2 + Math.round(windup * 3);
  for (const pod of pods) fillDisc(surface, pod.x, pod.y, r, color);
}

/** A star-shaped flash on a pod for the first ticks after a rocket leaves it. */
function drawMuzzleFlashes(surface: Surface, run: RunView, pods: readonly Point[]): void {
  for (const rocket of run.projectiles) {
    if (rocket.kind !== 'rocket' || rocket.owner !== 'enemy' || rocket.age > 4) continue;
    const rx = rocket.x + rocket.w / 2;
    const ry = rocket.y + rocket.h / 2;
    for (const pod of pods) {
      if (Math.abs(rx - pod.x) > 18 || Math.abs(ry - pod.y) > 18) continue;
      const color = FLASH[Math.min(FLASH.length - 1, rocket.age)] ?? P.white;
      const r = rocket.age < 2 ? 5 : 4;
      fillDisc(surface, pod.x, pod.y, r, color);
      surface.fillRect(pod.x - r - 3, pod.y, 2 * r + 6, 1, color);
      surface.fillRect(pod.x, pod.y - r - 3, 1, 2 * r + 6, color);
    }
  }
}

/** Badly damaged: dark puffs rise from the engine and drift back, cycling with its age. */
function drawDamageSmoke(surface: Surface, enemy: EnemyView, x: number, y: number): void {
  const period = 36;
  for (let i = 0; i < 3; i++) {
    const t = ((enemy.age + i * (period / 3)) % period) / period;
    const px = x + Math.round(Math.sin((enemy.age / 9 + i) * 1.7) * 4);
    const py = y - Math.round(t * 30);
    const color = ramp(SMOKE, t);
    fillDisc(surface, px, py, 2 + Math.round(t * 3), color);
  }
}

/** Chunks it breaks into: a plate, a rotor motor, the canopy and pilot, a pod, pad, a foot. */
export const bancaArtilladaDebris: readonly SpriteDef[] = [
  art['banca/debris_0_plate'],
  art['banca/debris_1_motor'],
  art['banca/debris_2_canopy'],
  art['banca/debris_3_pod'],
  art['banca/debris_4_pad'],
  art['banca/debris_5_foot'],
];
