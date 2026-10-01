export interface RexiTuning {
  /** Hitbox size in pixels. */
  readonly width: number;
  readonly height: number;
  /** Health at the start of a Run (one life: the Run ends when it reaches zero). */
  readonly maxHealth: number;
  /** Spawn position (left edge of the hitbox); Rexi starts standing on the ground. */
  readonly spawnX: number;
  /** Horizontal running speed, px/s. */
  readonly runSpeed: number;
  /** Initial upward speed of a jump, px/s. */
  readonly jumpSpeed: number;
  /**
   * Releasing jump while rising multiplies the upward speed by this (HA3: hold jump to jump
   * higher). 1 disables variable jump height.
   */
  readonly jumpCutFactor: number;
  /** Muzzle offset from the top-left of the hitbox (for facing right; mirrored when left). */
  readonly muzzleOffsetX: number;
  readonly muzzleOffsetY: number;
  /** After a hit, Rexi ignores further hits for this long, seconds. */
  readonly invulnerability: number;
  /** How long the hurt reaction (pose, flash) lasts after a hit, seconds. */
  readonly hurtDuration: number;
}

export const rexiTuning: RexiTuning = {
  width: 14,
  height: 28,
  maxHealth: 100,
  spawnX: 120,
  runSpeed: 120,
  jumpSpeed: 340,
  jumpCutFactor: 0.45,
  muzzleOffsetX: 10,
  muzzleOffsetY: 9,
  invulnerability: 1,
  hurtDuration: 0.3,
};
