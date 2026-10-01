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

/**
 * Banca Artillada: the heavy Gym Craft gunship (after HA3's "Big Gun" attack heli). It keeps
 * a standoff distance beside Rexi and fires volleys of rockets that accelerate and home on
 * him for a moment.
 */
export interface BancaArtilladaTuning extends EnemyTuningBase {
  /** Top speed while repositioning, px/s. Deliberately slow: it is a flying weight bench. */
  readonly driftSpeed: number;
  /** It slows down within this distance of where it wants to be, px. */
  readonly arriveDistance: number;
  /** Horizontal distance it keeps between its center and Rexi's, px. */
  readonly standoff: number;
  /** It never flies closer than this to the side edges once inside the Arena, px. */
  readonly marginX: number;
  /** Altitude band of the hitbox top, px. */
  readonly minY: number;
  readonly maxY: number;
  /** Time before picking a new cruising altitude, seconds: drawn uniformly from [min, max]. */
  readonly altitudeChangeMin: number;
  readonly altitudeChangeMax: number;
  /** Vertical hover amplitude, px. */
  readonly hoverAmplitude: number;
  /** Duration of one hover cycle, seconds. */
  readonly hoverPeriod: number;
  /** Time from spawning to its first volley, seconds. */
  readonly firstVolleyDelay: number;
  /** Time from the start of one volley to the start of the next, seconds. */
  readonly volleyInterval: number;
  /** Rockets per volley. */
  readonly volleySize: number;
  /** Time between the rockets of one volley, seconds. */
  readonly volleySpacing: number;
  /** A volley fans out over this many degrees around a perfect aim at Rexi. */
  readonly volleySpread: number;
  /** Rocket pods: offset of each pod's muzzle from the hitbox center, px (one pod per side). */
  readonly podOffsetX: number;
  readonly podOffsetY: number;
  /** Rocket speed when launched, px/s. */
  readonly rocketLaunchSpeed: number;
  /** Rocket thrust, px/s², up to `rocketMaxSpeed`. */
  readonly rocketAcceleration: number;
  readonly rocketMaxSpeed: number;
  /** How fast a rocket turns toward Rexi while homing, degrees per second. */
  readonly rocketTurnRate: number;
  /** How long a rocket homes after launch, seconds; it then flies straight. */
  readonly rocketHomingTime: number;
  /** Damage a rocket does to Rexi. */
  readonly rocketDamage: number;
  /** Rocket hitbox size, px. */
  readonly rocketSize: number;
  /** Rocket lifetime, seconds. */
  readonly rocketLifetime: number;
}

/** One entry per Enemy (keyed by EnemyKind). */
export interface EnemiesTuning {
  readonly 'maletin-coptero': MaletinCopteroTuning;
  readonly 'banca-artillada': BancaArtilladaTuning;
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
  // HA3's Big Gun has 12x a drone's health; this is about 13x a Maletín-cóptero (some 20 s
  // of Mazo fire), with points to match. A rocket does three papers' worth of damage.
  'banca-artillada': {
    width: 68,
    height: 34,
    health: 160,
    points: 1500,
    explosion: 'large',
    debrisPieces: 6,
    alwaysQuip: true,
    driftSpeed: 30,
    arriveDistance: 40,
    standoff: 150,
    marginX: 8,
    minY: 36,
    maxY: 90,
    altitudeChangeMin: 4,
    altitudeChangeMax: 7,
    hoverAmplitude: 2,
    hoverPeriod: 2.4,
    firstVolleyDelay: 3,
    volleyInterval: 5,
    volleySize: 4,
    volleySpacing: 1 / 6,
    volleySpread: 30,
    podOffsetX: 26,
    podOffsetY: 12,
    rocketLaunchSpeed: 100,
    rocketAcceleration: 150,
    rocketMaxSpeed: 200,
    rocketTurnRate: 45,
    rocketHomingTime: 1,
    rocketDamage: 15,
    rocketSize: 6,
    rocketLifetime: 5,
  },
} as const satisfies EnemiesTuning & Record<EnemyKind, EnemyTuningBase>;
