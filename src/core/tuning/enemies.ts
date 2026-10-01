import type { EnemyKind } from '../ids';

/** Numbers every Enemy has, whatever its behavior. */
export interface EnemyTuningBase {
  /** Hitbox size, px. */
  readonly width: number;
  readonly height: number;
  readonly health: number;
  /** Score awarded when destroyed. Heavier Enemies are worth more. */
  readonly points: number;
}

export interface MaletinCopteroTuning extends EnemyTuningBase {
  /** Vertical hover amplitude, px. */
  readonly hoverAmplitude: number;
  /** Duration of one hover cycle, seconds. */
  readonly hoverPeriod: number;
  /** Time between papers, seconds: each wait is drawn uniformly from [min, max]. */
  readonly fireIntervalMin: number;
  readonly fireIntervalMax: number;
  /** Papers deviate from a perfect aim at Rexi by up to this many degrees either way. */
  readonly aimError: number;
  /** Paper speed, px/s. Slow enough to read and dodge. */
  readonly paperSpeed: number;
  /** Damage a paper does to Rexi. */
  readonly paperDamage: number;
  /** Paper hitbox size, px. */
  readonly paperSize: number;
  /** Paper lifetime, seconds. */
  readonly paperLifetime: number;
}

/** One entry per Enemy (keyed by EnemyKind). */
export interface EnemiesTuning {
  readonly 'maletin-coptero': MaletinCopteroTuning;
}

export const enemiesTuning = {
  'maletin-coptero': {
    width: 24,
    height: 18,
    health: 12,
    points: 100,
    hoverAmplitude: 6,
    hoverPeriod: 2,
    fireIntervalMin: 2.5,
    fireIntervalMax: 3.5,
    aimError: 10,
    paperSpeed: 110,
    paperDamage: 5,
    paperSize: 6,
    paperLifetime: 6,
  },
} as const satisfies EnemiesTuning & Record<EnemyKind, EnemyTuningBase>;
