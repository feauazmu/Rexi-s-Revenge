import type { EnemyKind } from '../ids';
import type { ExplosionSize } from './effects';

/** Numbers every Enemy has, whatever its behavior. */
export interface EnemyTuningBase {
  /** Hitbox size, px. */
  readonly width: number;
  readonly height: number;
  readonly health: number;
  /** Score awarded when destroyed. Heavier Enemies are worth more. */
  readonly points: number;
  /** Explosion preset played when destroyed (see `tuning.effects.explosions`). */
  readonly explosion: ExplosionSize;
  /** Chunks of debris it breaks into when destroyed (the renderer draws each chunk). */
  readonly debrisPieces: number;
}

export interface MaletinCopteroTuning extends EnemyTuningBase {
  /** Top speed while drifting toward its current target point, px/s. */
  readonly driftSpeed: number;
  /** It slows down within this distance of its target, px, so it settles into a hover. */
  readonly arriveDistance: number;
  /** Time before picking a new target point, seconds: drawn uniformly from [min, max]. */
  readonly retargetMin: number;
  readonly retargetMax: number;
  /** Roaming area for target points: this far from the side edges, px. */
  readonly roamMarginX: number;
  /** Roaming area for target points: altitude band of the hitbox top, px. */
  readonly roamMinY: number;
  readonly roamMaxY: number;
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
    explosion: 'small',
    debrisPieces: 4,
    driftSpeed: 50,
    arriveDistance: 24,
    retargetMin: 1.5,
    retargetMax: 3,
    roamMarginX: 16,
    roamMinY: 30,
    roamMaxY: 140,
    hoverAmplitude: 3,
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
