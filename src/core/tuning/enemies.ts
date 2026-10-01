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
  /**
   * When true, destroying this Enemy always triggers a Quip, ignoring chance and cooldown and
   * replacing a Dialogue Box that is already showing. Absent means false.
   */
  readonly alwaysQuip?: boolean;
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

export interface CaminadoraAReaccionTuning extends EnemyTuningBase {
  /** Horizontal speed while strafing, px/s. */
  readonly strafeSpeed: number;
  /** It turns around this far from the side edges, px. */
  readonly strafeMarginX: number;
  /** Altitude band of the hitbox top, px: each pass picks a new altitude inside it. */
  readonly strafeMinY: number;
  readonly strafeMaxY: number;
  /** Vertical speed while changing altitude between passes, px/s. */
  readonly climbSpeed: number;
  /** Time between bursts, seconds: each wait is drawn uniformly from [min, max]. */
  readonly fireIntervalMin: number;
  readonly fireIntervalMax: number;
  /** It stops this long before each burst (the telegraph), seconds. */
  readonly windup: number;
  /** Bullets per burst, all aimed where Rexi was when the burst started. */
  readonly burstCount: number;
  /** Time between the bullets of a burst, seconds. */
  readonly burstSpacing: number;
  /** Bullet speed, px/s. */
  readonly bulletSpeed: number;
  /** Damage a bullet does to Rexi. */
  readonly bulletDamage: number;
  /** Bullet hitbox size, px. */
  readonly bulletSize: number;
  /** Bullet lifetime, seconds. */
  readonly bulletLifetime: number;
}

/** One entry per Enemy (keyed by EnemyKind). */
export interface EnemiesTuning {
  readonly 'maletin-coptero': MaletinCopteroTuning;
  readonly 'caminadora-a-reaccion': CaminadoraAReaccionTuning;
}

export const enemiesTuning = {
  'maletin-coptero': {
    width: 24,
    height: 18,
    health: 12,
    points: 100,
    explosion: 'small',
    debrisPieces: 4,
    alwaysQuip: false,
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
  'caminadora-a-reaccion': {
    width: 32,
    height: 14,
    health: 36,
    points: 400,
    explosion: 'large',
    debrisPieces: 6,
    alwaysQuip: false,
    strafeSpeed: 110,
    strafeMarginX: 8,
    strafeMinY: 70,
    strafeMaxY: 130,
    climbSpeed: 40,
    fireIntervalMin: 2.6,
    fireIntervalMax: 3.4,
    windup: 1 / 3,
    burstCount: 5,
    burstSpacing: 1 / 12,
    bulletSpeed: 170,
    bulletDamage: 5,
    bulletSize: 4,
    bulletLifetime: 4,
  },
} as const satisfies EnemiesTuning & Record<EnemyKind, EnemyTuningBase>;
