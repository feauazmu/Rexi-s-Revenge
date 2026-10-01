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

export interface ArchivadorArtilladoTuning extends EnemyTuningBase {
  /** Horizontal patrol speed, px/s. It turns back at the patrol margins. */
  readonly patrolSpeed: number;
  /** Patrol turning points: this far from the side edges, px. */
  readonly patrolMarginX: number;
  /** Altitude band of the hitbox top, px: it cruises at its entry height, clamped to this band. */
  readonly patrolMinY: number;
  readonly patrolMaxY: number;
  /** Vertical speed while climbing or sinking back into its band, px/s. */
  readonly climbSpeed: number;
  /** Vertical hover amplitude, px. */
  readonly hoverAmplitude: number;
  /** Duration of one hover cycle, seconds. */
  readonly hoverPeriod: number;
  /** It starts a drop when Rexi's center is less than this far to either side of its own, px. */
  readonly dropRange: number;
  /** Telegraph before each drop: it stops and lowers the drawer from its bomb bay, seconds. */
  readonly dropWindup: number;
  /** Time from one drop until it may start the next windup, seconds (sped up by the ramp). */
  readonly dropCooldown: number;
  /** Time after spawning before its first windup, seconds (sped up by the ramp). */
  readonly firstDropDelay: number;
  /** Downward acceleration of a falling drawer, px/s². */
  readonly drawerGravity: number;
  /** Damage a drawer does to Rexi, by a direct hit or its blast. */
  readonly drawerDamage: number;
  /** Drawer hitbox size, px. */
  readonly drawerSize: number;
  /** A drawer blows up on the ground or a platform, hurting Rexi within this radius, px. */
  readonly drawerBlastRadius: number;
  /** Explosion preset of a drawer blowing up (see `tuning.effects.explosions`). */
  readonly drawerExplosion: ExplosionSize;
  /** Drawer lifetime, seconds (long enough to reach the ground from the top of the screen). */
  readonly drawerLifetime: number;
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
  /** Time from the start of one volley's windup to the start of the next, seconds. */
  readonly volleyInterval: number;
  /** Telegraph before each volley: the pods glow brighter and brighter, seconds. */
  readonly volleyWindup: number;
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
  /** Damage a rocket does to Rexi (a direct hit; its burst is harmless). */
  readonly rocketDamage: number;
  /** Explosion preset where a rocket ends: on Rexi, the ground, a platform or burning out. */
  readonly rocketExplosion: ExplosionSize;
  /** Rocket hitbox size, px. */
  readonly rocketSize: number;
  /** Rocket lifetime, seconds. */
  readonly rocketLifetime: number;
}

/** One entry per Enemy (keyed by EnemyKind). */
export interface EnemiesTuning {
  readonly 'maletin-coptero': MaletinCopteroTuning;
  readonly 'archivador-artillado': ArchivadorArtilladoTuning;
  readonly 'caminadora-a-reaccion': CaminadoraAReaccionTuning;
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
  'archivador-artillado': {
    width: 20,
    height: 26,
    // Three times a Maletín-cóptero: a Bomber-heli analogue (HA3 450 HP vs. the Heli's 300).
    health: 36,
    points: 300,
    explosion: 'small',
    debrisPieces: 5,
    alwaysQuip: false,
    patrolSpeed: 45,
    patrolMarginX: 8,
    patrolMinY: 24,
    patrolMaxY: 60,
    climbSpeed: 40,
    hoverAmplitude: 1.5,
    hoverPeriod: 1.4,
    dropRange: 24,
    dropWindup: 0.35,
    dropCooldown: 2,
    firstDropDelay: 1,
    drawerGravity: 500,
    // A bomber bomb is two bullets' worth in HA3 (2 vs. 1); a paper does 5 here.
    drawerDamage: 10,
    drawerSize: 10,
    drawerBlastRadius: 16,
    drawerExplosion: 'small',
    drawerLifetime: 4,
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
    volleyWindup: 0.5,
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
    rocketExplosion: 'small',
    rocketSize: 6,
    rocketLifetime: 5,
  },
} as const satisfies EnemiesTuning & Record<EnemyKind, EnemyTuningBase>;
