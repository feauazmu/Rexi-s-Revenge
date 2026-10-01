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
  /**
   * Pivot of the aiming arm (the shoulder), from the top-left of the hitbox, for facing right
   * (mirrored when facing left). Aim directions are measured from here.
   */
  readonly shoulderOffsetX: number;
  readonly shoulderOffsetY: number;
  /** Distance from the shoulder to the muzzle (arm plus held Weapon), px. */
  readonly muzzleReach: number;
  /** After a hit, Rexi ignores further hits for this long, seconds. */
  readonly invulnerability: number;
  /** How long the hurt reaction (pose, flash) lasts after a hit, seconds. */
  readonly hurtDuration: number;
}

export const rexiTuning: RexiTuning = {
  width: 22,
  height: 60,
  maxHealth: 100,
  spawnX: 160,
  runSpeed: 160,
  jumpSpeed: 453,
  jumpCutFactor: 0.45,
  shoulderOffsetX: 21.5,
  shoulderOffsetY: 10.5,
  muzzleReach: 38,
  invulnerability: 1,
  hurtDuration: 0.3,
};
