export interface RexiTuning {
  /** Hitbox size in pixels. */
  readonly width: number;
  readonly height: number;
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
  /** Length of the hurt reaction after Rexi is hit, seconds. He cannot be hit again meanwhile. */
  readonly hurtDuration: number;
}

export const rexiTuning: RexiTuning = {
  width: 14,
  height: 30,
  spawnX: 120,
  runSpeed: 120,
  jumpSpeed: 340,
  jumpCutFactor: 0.45,
  shoulderOffsetX: 15.5,
  shoulderOffsetY: 6.5,
  muzzleReach: 19,
  hurtDuration: 0.5,
};
