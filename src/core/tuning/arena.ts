/**
 * A one-way platform: Rexi jumps up through it from below, lands on its top surface and can
 * drop down through it. Only the top edge collides.
 */
export interface PlatformTuning {
  /** Left edge, in pixels. */
  readonly x: number;
  /** Y of the walkable top surface, in pixels. */
  readonly y: number;
  /** Width, in pixels. */
  readonly w: number;
}

export interface ArenaTuning {
  /** Y of the top of the ground floor, in pixels. */
  readonly groundY: number;
  /** Downward acceleration for Rexi and other falling bodies, px/s². */
  readonly gravity: number;
  /** Terminal falling speed, px/s. */
  readonly maxFallSpeed: number;
  /**
   * The Arena's one-way platforms (HA3-style vertical play). Each one sits less than a full
   * jump (about 59 px with the default jump and gravity) above the ground or a lower platform.
   * Rexi's spawn point stays clear, so a standing jump there lands back on the ground.
   */
  readonly platforms: readonly PlatformTuning[];
}

export const arenaTuning: ArenaTuning = {
  groundY: 238,
  gravity: 980,
  maxFallSpeed: 520,
  platforms: [
    // Low ledges at both sides, 50 px above the ground.
    { x: 22, y: 188, w: 76 },
    { x: 382, y: 188, w: 76 },
    // High ledge in the middle, 50 px above the low ones.
    { x: 186, y: 138, w: 108 },
  ],
};
