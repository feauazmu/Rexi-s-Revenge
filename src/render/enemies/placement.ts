import type { BoxView } from '../../core';
import { layout } from '../art/generated/enemies';
import { mirroredSprite, type SpriteDef } from '../sprite';

/** An Enemy kind's entry in the exported art layout (scripts/art/enemies.py, LAYOUT). */
export type EnemyArt = keyof typeof layout;

/** Where an Enemy's right-facing body is drawn on screen this frame, for the chosen facing. */
export interface Placement {
  /** The body sprite, mirrored when facing left. */
  readonly sprite: SpriteDef;
  readonly right: boolean;
  /** Screen position of the sprite's top-left pixel. */
  readonly left: number;
  readonly top: number;
  /** Screen x of column `c` of the right-facing body, for the current facing. */
  readonly column: (c: number) => number;
}

/**
 * Places `body` (drawn facing right) so the kind's hitbox offset from the art layout lands on
 * the Enemy's hitbox. Facing left mirrors the body around the hitbox. `dy` shifts it vertically
 * (an engine bob).
 */
export function placeBody(
  art: EnemyArt,
  body: SpriteDef,
  enemy: BoxView,
  right: boolean,
  dy = 0,
): Placement {
  const [hx = 0, hy = 0] = layout[art].hitbox;
  const x = Math.round(enemy.x);
  const left = right ? x - hx : x + enemy.w + hx - body.width;
  return {
    sprite: right ? body : mirroredSprite(body),
    right,
    left,
    top: Math.round(enemy.y) - hy + dy,
    column: (c) => (right ? left + c : left + body.width - 1 - c),
  };
}
