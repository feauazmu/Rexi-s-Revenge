import type { PowerUpId } from '../ids';

/** Numbers every timed Power-up has. */
export interface TimedPowerUpTuning {
  /** How long the effect lasts after pickup, seconds. Picking it up again restarts it. */
  readonly duration: number;
}

export interface RecesoTuning {
  /** Share of max health restored at once (never above max health). */
  readonly healShare: number;
}

export interface CreatinaTuning extends TimedPowerUpTuning {
  /** Every hit Rexi lands on an Enemy does this many times its damage. */
  readonly damageMultiplier: number;
}

export interface PreEntrenoTuning extends TimedPowerUpTuning {
  /**
   * Enemies and Enemy projectiles run on this fraction of normal time (0..1): movement,
   * attack cooldowns and projectile flight and lifetime. Rexi and his shots are not slowed.
   */
  readonly enemyTimeScale: number;
}

export interface DiaDePiernaTuning extends TimedPowerUpTuning {
  /**
   * Upward acceleration while jump is held, px/s². Gravity still pulls, so it must exceed
   * `arena.gravity` for Rexi to climb.
   */
  readonly thrust: number;
  /** Fastest climb under thrust, px/s (a jump's initial kick may start faster, then eases to it). */
  readonly riseSpeed: number;
  /** The highest Rexi can fly: the top of his hitbox stops here, px from the top of the screen. */
  readonly ceiling: number;
}

/** One entry per Power-up (keyed by PowerUpId). Timed ones extend `TimedPowerUpTuning`. */
export interface PowerUpsTuning {
  readonly receso: RecesoTuning;
  /** Blocks all damage to Rexi. */
  readonly 'inmunidad-judicial': TimedPowerUpTuning;
  readonly creatina: CreatinaTuning;
  readonly 'pre-entreno': PreEntrenoTuning;
  /** Jetpack-like flight while jump is held. */
  readonly 'dia-de-pierna': DiaDePiernaTuning;
}

/** The Power-ups whose tuning has a duration: they run on a timer shown in the HUD. */
export type TimedPowerUpId = {
  [K in PowerUpId]: PowerUpsTuning[K] extends TimedPowerUpTuning ? K : never;
}[PowerUpId];

export const powerUpsTuning = {
  receso: { healShare: 0.3 },
  'inmunidad-judicial': { duration: 8 },
  creatina: { duration: 10, damageMultiplier: 3 },
  'pre-entreno': { duration: 8, enemyTimeScale: 0.4 },
  'dia-de-pierna': { duration: 6, thrust: 2667, riseSpeed: 227, ceiling: 8 },
} as const satisfies PowerUpsTuning & Record<PowerUpId, object>;
