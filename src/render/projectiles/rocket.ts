import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { fillDisc } from '../effects/burst';
import { defineSprite, rotateSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';

const colors = {
  k: '#141018', // outline
  K: '#34343e', // body
  n: '#6a6a78', // body, lit
  R: '#ec3b3b', // nose
  r: '#a01824', // fins
} as const satisfies Record<string, Color>;

/** Pointing right: red fins at the tail, dark body, red warhead. */
const STRAIGHT = defineSprite(colors, [
  'kk.......',
  'krkkkkk..',
  'kKnnnnRRk',
  'kKKKKKRRk',
  'krkkkkk..',
  'kk.......',
]);

/** Pointing down and to the right. */
const DIAGONAL = defineSprite(colors, [
  'kkk....',
  'krkk...',
  'kkKnk..',
  '.kKKnk.',
  '..kKRRk',
  '...kRRk',
  '....kk.',
]);

/** Eight headings, clockwise from pointing right (y points down). */
const HEADINGS: readonly SpriteDef[] = [0, 1, 2, 3].flatMap((turns) => [
  rotateSprite(STRAIGHT, turns),
  rotateSprite(DIAGONAL, turns),
]);

const FLAME: readonly Color[] = ['#fff4c0', '#ffd040', '#ff8a20'];
const SMOKE: readonly Color[] = ['#b8b0c0', '#8c8496', '#6a6274'];

/**
 * A Banca Artillada rocket: points along its velocity (8 headings), with a flickering
 * exhaust flame and a short smoke trail behind it that grows as it gets going.
 */
export function drawRocket(dc: DrawContext, projectile: ProjectileView): void {
  const { surface } = dc;
  const cx = projectile.x + projectile.w / 2;
  const cy = projectile.y + projectile.h / 2;
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const back = { x: -projectile.vx / speed, y: -projectile.vy / speed };

  // Smoke trail: puffs further back are older, larger and darker.
  const puffs = Math.min(3, Math.floor(projectile.age / 3));
  for (let i = puffs; i >= 1; i--) {
    const wobble = ((projectile.age + i) % 2) * 2 - 1;
    const distance = 5 + i * 4;
    fillDisc(
      surface,
      cx + back.x * distance - back.y * wobble,
      cy + back.y * distance + back.x * wobble,
      1 + Math.ceil(i / 2),
      SMOKE[i - 1] ?? '#8c8496',
    );
  }
  // Exhaust flame, flickering between a long and a short tongue.
  const long = projectile.age % 4 < 2;
  const flame = FLAME[projectile.age % FLAME.length] ?? '#ffd040';
  fillDisc(surface, cx + back.x * 5, cy + back.y * 5, long ? 2 : 1, flame);

  const octant = Math.round(Math.atan2(projectile.vy, projectile.vx) / (Math.PI / 4));
  const sprite = HEADINGS[((octant % 8) + 8) % 8] ?? STRAIGHT;
  drawSpriteCentered(dc, sprite, cx, cy);
}
