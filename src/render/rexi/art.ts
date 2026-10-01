import { rexiArt, sprites } from '../art/generated/rexi';
import { masterPalette, type PaletteColorName } from '../palette';
import { defineSprite, mirrorSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';

/**
 * Rexi's pipeline art (ADR 0002): the body frames, the lapel cap and the aiming arms exported by
 * `scripts/art/characters/rexi.py` into `../art/generated/rexi.ts`, with the lookups the renderer
 * needs. Everything is drawn facing right except the facing-left body frames, which are their
 * own sprites: Rexi's sleeve is on his right arm, the near arm facing right and the aiming arm
 * facing left, so mirroring alone would move it to the wrong arm.
 */

export type BodyFrame = keyof typeof rexiArt.frames;
export type Facing = 1 | -1;

/** Size of every body frame's canvas. */
export const BODY_WIDTH = rexiArt.canvas[0];
export const BODY_HEIGHT = rexiArt.canvas[1];
/** The body canvas column on the hitbox's center line and the row of the soles (facing right). */
export const BODY_ANCHOR_X = rexiArt.anchor[0];
export const BODY_SOLES_Y = rexiArt.anchor[1];

/** The top-left of a body frame for a hitbox (soles on its bottom row, centered on it). */
export function bodyOrigin(
  box: { x: number; y: number; w: number; h: number },
  facing: Facing,
): { x: number; y: number } {
  const center = Math.round(box.x + box.w / 2);
  // A mirrored canvas keeps the anchor column on the same side of the center line.
  const anchor = facing === 1 ? BODY_ANCHOR_X : BODY_WIDTH - BODY_ANCHOR_X;
  return { x: center - anchor, y: Math.round(box.y + box.h) - BODY_SOLES_Y - 1 };
}

/** A point given on the facing-right body canvas, for the frame drawn with `facing`. */
export function bodyPoint(x: number, y: number, facing: Facing): { x: number; y: number } {
  return { x: facing === 1 ? x : BODY_WIDTH - 1 - x, y };
}

function spriteAt(key: string): SpriteDef {
  const sprite = (sprites as Record<string, SpriteDef>)[key];
  if (!sprite) throw new Error(`Rexi art has no sprite "${key}"`);
  return sprite;
}

// ── Hurt blink ─────────────────────────────────────────────────────────────────────────────

/** The hurt blink's ramp, dark to light: every color moves to the step of its brightness. */
const FLASH_RAMP: readonly PaletteColorName[] = ['red1', 'red2', 'red3', 'redLight', 'coral'];

function luminance(color: Color): number {
  const channel = (i: number) => parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  return (0.299 * channel(0) + 0.587 * channel(1) + 0.114 * channel(2)) / 255;
}

/** The flash color of `color`: outline stays, the rest maps onto the red ramp (on the palette). */
function flashColor(color: Color): Color {
  if (color === masterPalette.outline) return color;
  const step = Math.min(FLASH_RAMP.length - 1, Math.floor(luminance(color) * FLASH_RAMP.length));
  return masterPalette[FLASH_RAMP[step] ?? 'red3'];
}

const flashed = new WeakMap<SpriteDef, SpriteDef>();

/** The sprite in the hurt blink's reds. Memoized, so each is rasterized once. */
export function flashSprite(sprite: SpriteDef): SpriteDef {
  let out = flashed.get(sprite);
  if (!out) {
    const palette = Object.fromEntries(
      Object.entries(sprite.palette).map(([key, color]) => [key, flashColor(color)]),
    );
    out = defineSprite(palette, sprite.rows);
    flashed.set(sprite, out);
  }
  return out;
}

// ── Body ───────────────────────────────────────────────────────────────────────────────────

/** A body frame for the facing (`flash`: the hurt blink). */
export function bodySprite(frame: BodyFrame, facing: Facing, flash: boolean): SpriteDef {
  const sprite = spriteAt(`body/${facing === 1 ? 'right' : 'left'}/${frame}`);
  return flash ? flashSprite(sprite) : sprite;
}

const capRight = spriteAt('cap');
const capLeft = mirrorSprite(capRight);

/** The robe's lapel drawn over the aiming arm's root, and where it goes on the body canvas. */
export function capSprite(
  frame: BodyFrame,
  facing: Facing,
  flash: boolean,
): { sprite: SpriteDef; x: number; y: number } {
  const [x, y] = rexiArt.frames[frame].cap;
  const sprite = facing === 1 ? capRight : capLeft;
  return {
    sprite: flash ? flashSprite(sprite) : sprite,
    x: facing === 1 ? x : BODY_WIDTH - x - capRight.width,
    y,
  };
}

/** The aiming arm's shoulder pivot on the body canvas, as a pixel center (facing right). */
export function shoulderOf(frame: BodyFrame): { x: number; y: number } {
  const [x, y] = rexiArt.frames[frame].shoulder;
  return { x, y };
}

/** Where the soles of each boot are on the body canvas (facing right): the jets' anchors. */
export function bootsOf(frame: BodyFrame): readonly (readonly [number, number])[] {
  return rexiArt.frames[frame].boots;
}

// ── Aiming arm ─────────────────────────────────────────────────────────────────────────────

export type ArmArt = keyof typeof rexiArt.arms;

export interface ArmSprite {
  readonly sprite: SpriteDef;
  /** The shoulder pivot's pixel center inside the sprite. */
  readonly pivotX: number;
  readonly pivotY: number;
}

const ANGLE_KEYS = rexiArt.angles.map(
  (a) => (a < 0 ? '-' : '+') + Math.abs(a).toFixed(1).padStart(5, '0'),
);

/** The pre-rotated angles, -90..90 in steps of 22.5 degrees (facing right). */
export const ARM_ANGLES: readonly number[] = rexiArt.angles;

const arms = new Map<string, ArmSprite>();

/**
 * The aiming arm holding `art` at `angleIndex` (into {@link ARM_ANGLES}), for the facing.
 * Facing right it is his left arm, plain; facing left it is his right arm, inked, mirrored.
 */
export function armSprite(
  art: ArmArt,
  angleIndex: number,
  facing: Facing,
  flash: boolean,
): ArmSprite {
  const id = `${art}:${angleIndex}:${facing}:${flash ? 1 : 0}`;
  let arm = arms.get(id);
  if (!arm) {
    const angle = ANGLE_KEYS[angleIndex];
    if (angle === undefined) throw new Error(`No arm angle ${angleIndex}`);
    const ink = facing === 1 ? 'plain' : 'inked';
    const base = spriteAt(`arm/${art}/${ink}/${angle}`);
    const [px, py] =
      rexiArt.arms[art].pivots[ink][
        angle as keyof (typeof rexiArt.arms)[ArmArt]['pivots']['plain']
      ];
    const sprite = facing === 1 ? base : mirrorSprite(base);
    arm = {
      sprite: flash ? flashSprite(sprite) : sprite,
      pivotX: facing === 1 ? px : base.width - 1 - px,
      pivotY: py,
    };
    arms.set(id, arm);
  }
  return arm;
}

/** Distance from the shoulder to the held Weapon's muzzle, px. */
export function armReach(art: ArmArt): number {
  return rexiArt.arms[art].reach;
}
