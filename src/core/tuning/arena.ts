export interface ArenaTuning {
  /** Y of the top of the ground floor, in pixels. */
  readonly groundY: number;
  /** Downward acceleration for Rexi and other falling bodies, px/s². */
  readonly gravity: number;
  /** Terminal falling speed, px/s. */
  readonly maxFallSpeed: number;
}

export const arenaTuning: ArenaTuning = {
  groundY: 238,
  gravity: 980,
  maxFallSpeed: 520,
};
