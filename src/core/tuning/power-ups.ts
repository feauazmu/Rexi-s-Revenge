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

/** One entry per Power-up (keyed by PowerUpId). Timed ones extend `TimedPowerUpTuning`. */
export interface PowerUpsTuning {
  readonly receso: RecesoTuning;
  /** Blocks all damage to Rexi. */
  readonly 'inmunidad-judicial': TimedPowerUpTuning;
  readonly creatina: CreatinaTuning;
}

/** The Power-ups whose tuning has a duration: they run on a timer shown in the HUD. */
export type TimedPowerUpId = {
  [K in PowerUpId]: PowerUpsTuning[K] extends TimedPowerUpTuning ? K : never;
}[PowerUpId];

export const powerUpsTuning = {
  receso: { healShare: 0.3 },
  'inmunidad-judicial': { duration: 8 },
  creatina: { duration: 10, damageMultiplier: 3 },
} as const satisfies PowerUpsTuning & Record<PowerUpId, object>;
