import type { EnemyView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { fillDisc } from '../effects/burst';
import { defineSprite, mirrorSprite } from '../sprite';
import type { Color, Surface } from '../surface';

const COLORS = {
  k: '#141018', // outline
  L: '#ff8a7a', // upholstery sheen
  R: '#ec3b3b', // red, lit
  r: '#c0202a', // red
  d: '#7a1020', // red, shade
  K: '#2c2c36', // black steel
  N: '#4a4a58', // steel
  n: '#7a7a8a', // steel, lit
  s: '#e4e8f0', // chrome bar
  S: '#a0a6b6', // chrome collar
  P: '#24242e', // iron plate
  p: '#444452', // plate rim
  l: '#8a8a9a', // plate lettering
  w: '#7cc4ee', // canopy glass
  W: '#e8f8ff', // glass glint
  b: '#3c6e9c', // glass, shade
  t: '#3a2418', // the pilot's hair
  x: '#f0c090', // the pilot's skin
  e: '#1a1a24', // the pilot's eye
  u: '#2a2a34', // the pilot's tank top
  h: '#0a0a0e', // rocket tube
  G: '#ff6a20', // engine glow
  g: '#ffb040', // engine glow, hot
} as const satisfies Record<string, Color>;

/**
 * The body facing left (cockpit toward the left), drawn from the hitbox top. It sticks out
 * `OVERHANG` px past each side of the hitbox (the barbell sleeves and plates).
 * Rotor motors top the two masts; rocket pods hang under each end of the bench, centered
 * `podOffsetX` px either side of the hitbox middle and `podOffsetY` px below it.
 */
const BODY_LEFT = defineSprite(COLORS, [
  '..kkkk..........kkkk....................................kkkk..........kkkk..',
  '.kpPPPk........kRRRRk..................................kRRRRk........kPPPpk.',
  '.kpPPPk.......kRRRRrrk................................krrRRRRk.......kPPPpk.',
  '.kpPPPkkk.....kRrrrrdk................................kdrrrrRk.....kkkPPPpk.',
  '.kpPPPkpPk....kddddddk................................kddddddk....kPpkPPPpk.',
  '.kpPPPkpPk.....kkkkkk..................................kkkkkk.....kPpkPPPpk.',
  '.kpPPPkpPk......kRrk....................................krRk......kPpkPPPpk.',
  '.kpPPPkpPk......kRrk....................................krRk......kPpkPPPpk.',
  '.kplPPkpPkkk....kRrk.......kkkkkk.......................krRk....kkkPpkPPlpk.',
  'kkplPPkpPkkSkkkkkkkkkkkkkkkWWwwwwkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkSkkPpkPPlpkk',
  'kkpPlPkpPkkSsssssssssssskWWwttttwwbkssssssssssssssssssssssssssssSkkPpkPlPpkk',
  'kkpPlPkpPkkSSSSSSSSSSSSkWwwRRRRtwwbbkSSSSSSSSSSSSSSSSSSSSSSSSSSSSkkPpkPlPpkk',
  'kkplPPkpPkkSkkkkkkkkkkkkwwexxxxwwwbbkkkkkkkkkkkkkkkkkkkkkkkkkkkkSkkPpkPPlpkk',
  '.kplPPkpPkkk....kNnk..kwwwxxxxxwwbbbbk..................knNk....kkkPpkPPlpk.',
  '.kpPPPkpPk......kNnk..kwwwuuuuuuwbbbbk..................knNk......kPpkPPPpk.',
  '.kpPPPkpPkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkPpkPPPpk.',
  '.kpPPPkPPkRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLRRLkPPkPPPpk.',
  '.kpPPPkkkkRRRRrRRRRRRRrRRRRRRRrRRRRRRRrRRRRRRRrRRRRRRRrRRRRRRRrRRRkkkkPPPpk.',
  '.kpPPPk..krrrrdrrrrrrrdrrrrrrrdrrrrrrrdrrrrrrrdrrrrrrrdrrrrrrrdrrrk..kPPPpk.',
  '.kpPPPk..krrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrk..kPPPpk.',
  '.kPPPPk..kddddddddddddddddddddddddddddddddddddddddddddddddddddddddk..kPPPPk.',
  '..kkkk....kkkkkkkkkKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKkkkkkkkkk....kkkk..',
  '...........kk..kkkkKkkkkkkkkkkkKKKkrRRRRRRRRRRRRRRRRRRrKKkkkk..kk...........',
  '...........kk.....kKknknknknnkkKKKkrrrrrrrrrrrrrrrrrrrrKNk.....kk...........',
  '.........kkkkkk...kKknknknknnkkKKKkrrrrrrrrrrrrrrrrrrrrKNk...kkkkkk.........',
  '........kRRRRRRk..kKkGgGgGgGgkkKKKkddddddddddddddddddddKNk..kRRRRRRk........',
  '.......kRhhRRhhrk.kKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKk.krhhRRhhRk.......',
  '.......kRhhrrhhrk..kkkkkkkkkNkkkkkkkkkkkkkkkkkkNkkkkkkkkk..krhhrrhhRk.......',
  '.......kRrrkkrrdk..........kNk................kNk..........kdrrkkrrRk.......',
  '.......kRrrkkrrdk..........kNk................kNk..........kdrrkkrrRk.......',
  '.......kRhhrrhhdk..........kNk................kNk..........kdhhrrhhRk.......',
  '.......kRhhrrhhdk..........kNk................kNk..........kdhhrrhhRk.......',
  '........kdrrrrdk.......kkkkkkkkkkk........kkkkkkkkkkk.......kdrrrrdk........',
  '.........kkkkkk.......kNnnnnnnnnnNk......kNnnnnnnnnnNk.......kkkkkk.........',
  '.......................kkkkkkkkkkk........kkkkkkkkkkk.......................',
]);
const BODY_RIGHT = mirrorSprite(BODY_LEFT);

const OVERHANG = 4;
/** Rotor hubs: the left of each mast's two middle columns (symmetric, so both facings). */
const HUBS = [17, 57] as const;
/** Pod centers in the sprite. */
const PODS = [
  { x: 12, y: 29 },
  { x: 64, y: 29 },
] as const;
/** Engine grille row and span in the left-facing sprite. */
const GRILLE = { x: 21, y: 25, w: 8 } as const;

const RING: Color = '#20202a';
const BLADE: Color = '#e02a2a';
const BLADE_SHADE: Color = '#8a1420';
const FLASH: readonly Color[] = ['#ffffff', '#fff4c0', '#ffd040'];
const SMOKE: readonly Color[] = ['#3a3440', '#5a5262', '#7a7284'];

/**
 * Banca Artillada: a red bench press turned gunship. A barbell loaded with iron plates rests
 * on the rack, whose two uprights carry rotors; a gym bro in a headband flies it from a glass
 * canopy on the bench, and a rocket pod hangs under each end. It faces Rexi, its pods flash
 * as rockets leave them, and it trails smoke once badly damaged.
 */
export function drawBancaArtillada(dc: DrawContext, enemy: EnemyView, run: RunView): void {
  const { surface, sprites } = dc;
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  const facingLeft = run.rexi.x + run.rexi.w / 2 < enemy.x + enemy.w / 2;
  const left = x - OVERHANG;

  for (const hub of HUBS) drawRotor(surface, left + hub, y - 1, enemy.age);
  surface.drawBitmap(sprites.get(facingLeft ? BODY_LEFT : BODY_RIGHT), left, y);

  // The engine grille glows and flickers.
  const grilleX = facingLeft ? GRILLE.x : BODY_LEFT.width - GRILLE.x - GRILLE.w;
  const hot = Math.floor(enemy.age / 3) % 2 === 0;
  for (let i = 0; i < GRILLE.w; i++) {
    const lit = (i + (hot ? 0 : 1)) % 2 === 0;
    surface.fillRect(left + grilleX + i, y + GRILLE.y, 1, 1, lit ? COLORS.g : COLORS.G);
  }

  drawMuzzleFlashes(surface, run, left, y);
  if (enemy.health <= enemy.maxHealth * 0.4) drawDamageSmoke(surface, enemy, left, y);
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
  span(-10, 11, cy - 2, RING);
  pair(11, 14, cy - 1);
  pair(15, 16, cy);
  pair(11, 14, cy + 1);
  span(-10, 11, cy + 2, RING);

  switch (Math.floor(age / 2) % 4) {
    case 0: // side on: one long blade across
      span(-15, 16, cy, BLADE);
      break;
    case 1: // turning toward the viewer
      span(-12, -5, cy - 1, BLADE_SHADE);
      span(-4, 5, cy, BLADE);
      span(6, 13, cy + 1, BLADE);
      break;
    case 2: // end on: short and foreshortened
      span(0, 0, cy - 2, BLADE_SHADE);
      span(0, 0, cy - 1, BLADE_SHADE);
      span(-3, 4, cy, BLADE);
      span(1, 1, cy + 1, BLADE);
      span(1, 1, cy + 2, BLADE);
      break;
    default: // turning away
      span(6, 13, cy - 1, BLADE_SHADE);
      span(-4, 5, cy, BLADE);
      span(-12, -5, cy + 1, BLADE);
  }
  surface.fillRect(c - 1, cy - 1, 4, 2, COLORS.k);
  surface.fillRect(c, cy - 1, 2, 1, COLORS.N);
}

/** A star-shaped flash on a pod for the first ticks after a rocket leaves it. */
function drawMuzzleFlashes(surface: Surface, run: RunView, left: number, top: number): void {
  for (const rocket of run.projectiles) {
    if (rocket.kind !== 'rocket' || rocket.owner !== 'enemy' || rocket.age > 4) continue;
    const rx = rocket.x + rocket.w / 2;
    const ry = rocket.y + rocket.h / 2;
    for (const pod of PODS) {
      const px = left + pod.x;
      const py = top + pod.y;
      if (Math.abs(rx - px) > 14 || Math.abs(ry - py) > 14) continue;
      const color = FLASH[Math.min(FLASH.length - 1, rocket.age)] ?? '#ffffff';
      const r = rocket.age < 2 ? 4 : 3;
      fillDisc(surface, px, py, r, color);
      surface.fillRect(px - r - 2, py, 2 * r + 4, 1, color);
      surface.fillRect(px, py - r - 2, 1, 2 * r + 4, color);
    }
  }
}

/** Badly damaged: dark puffs rise from the engine and drift back, cycling with its age. */
function drawDamageSmoke(surface: Surface, enemy: EnemyView, left: number, top: number): void {
  const period = 36;
  for (let i = 0; i < 3; i++) {
    const t = ((enemy.age + i * (period / 3)) % period) / period;
    const px = left + 38 + Math.round(Math.sin((enemy.age / 9 + i) * 1.7) * 3);
    const py = top + 20 - Math.round(t * 22);
    const color = SMOKE[Math.min(SMOKE.length - 1, Math.floor(t * SMOKE.length))] ?? '#5a5262';
    fillDisc(surface, px, py, 2 + Math.round(t * 2), color);
  }
}

/** Chunks it breaks into: a plate, a rotor motor, the canopy and pilot, a pod, pad, a foot. */
export const bancaArtilladaDebris = [
  defineSprite(COLORS, ['.kkk.', 'kpPPk', 'kpPPk', 'kplPk', 'kplPk', 'kpPPk', 'kPPPk', '.kkk.']),
  defineSprite(COLORS, ['kkkkkkkkk', '....k....', '..kRRrk..', '..kRrdk..', '...kdk...']),
  defineSprite(COLORS, [
    '...kkkkk..',
    '..kWWtwbk.',
    '.kWtxxRwbk',
    'kwwxexwbbk',
    'kwuuuuwbbk',
    'kkkkkkkkkk',
  ]),
  defineSprite(COLORS, ['.kkkk.', 'kRRRRk', 'kRhhrk', 'kRhhdk', '.kddk.', '..kk..']),
  defineSprite(COLORS, ['kkkkkkkkkk', 'kRRRRRRRRk', 'krrrrrrrrk', 'kddddddddk', 'kkkkkkkkkk']),
  defineSprite(COLORS, ['..kNk..', '..kNk..', 'kkkkkkk', 'kNnnnNk', 'kkkkkkk']),
] as const;
