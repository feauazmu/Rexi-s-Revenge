/** Explosion presets, from a light Lawyer Craft pop to a heavy Gym Craft blast. */
export const EXPLOSION_SIZES = ['small', 'large'] as const;
export type ExplosionSize = (typeof EXPLOSION_SIZES)[number];

/** One explosion preset: what a single blast throws out, and how hard it shakes the view. */
export interface ExplosionTuning {
  /** Radius of the opening white flash, px. */
  readonly flashRadius: number;
  /** Fireballs scattered around the center. */
  readonly fireballs: number;
  /** Largest fireball radius, px. */
  readonly fireRadius: number;
  /** How far fireballs and smoke start from the center, px. */
  readonly spread: number;
  readonly smokePuffs: number;
  /** Largest smoke puff radius, px. */
  readonly smokeRadius: number;
  readonly sparks: number;
  /** Spark launch speed range, px/s. */
  readonly sparkSpeedMin: number;
  readonly sparkSpeedMax: number;
  /** Screen-shake trauma added (0..1); see `ShakeTuning`. */
  readonly trauma: number;
}

/**
 * Screen shake driven by "trauma" (Eiserloh, GDC 2016): events add trauma, which decays
 * linearly; the offset is `maxOffset * trauma² * noise(t)`, so small hits barely move the
 * view and big ones are violent.
 */
export interface ShakeTuning {
  /** Largest offset at full trauma, px. */
  readonly maxOffset: number;
  /** Trauma lost per second. */
  readonly traumaDecay: number;
  /** How fast the shake noise wanders, cycles per second. */
  readonly frequency: number;
  /** Multiplies every offset; 0 disables screen shake (accessibility). */
  readonly scale: number;
}

export interface HitFlashTuning {
  /** How long a hit Enemy is drawn as a white silhouette, seconds. */
  readonly duration: number;
  /** Minimum time between flash starts, so rapid fire still shows the sprite, seconds. */
  readonly minInterval: number;
}

/** Chunks an Enemy breaks into when destroyed. */
export interface DebrisTuning {
  readonly gravity: number;
  /** Horizontal launch speed range (either direction), px/s. */
  readonly speedXMin: number;
  readonly speedXMax: number;
  /** Upward launch speed range, px/s. */
  readonly speedUpMin: number;
  readonly speedUpMax: number;
  /** Fraction of vertical speed kept when bouncing off the ground. */
  readonly restitution: number;
  /** Fraction of horizontal speed kept per bounce. */
  readonly friction: number;
  /** Spin while airborne, quarter turns per second (either direction). */
  readonly spin: number;
  /** Seconds between smoke puffs trailing a falling chunk. */
  readonly smokeInterval: number;
  /** Seconds a chunk lies on the ground before it starts blinking. */
  readonly restTime: number;
  /** Seconds a chunk blinks before it disappears. */
  readonly blinkTime: number;
}

/** Short-lived explosion particles. Lifetimes are ranges, seconds. */
export interface ParticleTuning {
  readonly flashLife: number;
  readonly fireLifeMin: number;
  readonly fireLifeMax: number;
  readonly smokeLifeMin: number;
  readonly smokeLifeMax: number;
  /** Smoke rise speed, px/s. */
  readonly smokeRise: number;
  readonly sparkLifeMin: number;
  readonly sparkLifeMax: number;
  readonly sparkGravity: number;
}

export interface EffectsTuning {
  /** Most particles alive at once; the oldest are dropped first. 0 disables particles. */
  readonly maxParticles: number;
  readonly hitFlash: HitFlashTuning;
  readonly shake: ShakeTuning;
  readonly particles: ParticleTuning;
  readonly debris: DebrisTuning;
  readonly explosions: Readonly<Record<ExplosionSize, ExplosionTuning>>;
}

export const effectsTuning: EffectsTuning = {
  maxParticles: 256,
  hitFlash: { duration: 0.05, minInterval: 0.067 },
  shake: { maxOffset: 6, traumaDecay: 1.5, frequency: 20, scale: 1 },
  particles: {
    flashLife: 0.05,
    fireLifeMin: 0.2,
    fireLifeMax: 0.42,
    smokeLifeMin: 0.35,
    smokeLifeMax: 0.7,
    smokeRise: 20,
    sparkLifeMin: 0.25,
    sparkLifeMax: 0.5,
    sparkGravity: 400,
  },
  debris: {
    gravity: 600,
    speedXMin: 40,
    speedXMax: 120,
    speedUpMin: 80,
    speedUpMax: 200,
    restitution: 0.3,
    friction: 0.6,
    spin: 10,
    smokeInterval: 0.067,
    restTime: 1,
    blinkTime: 0.33,
  },
  explosions: {
    small: {
      flashRadius: 10,
      fireballs: 7,
      fireRadius: 7,
      spread: 7,
      smokePuffs: 5,
      smokeRadius: 6,
      sparks: 8,
      sparkSpeedMin: 120,
      sparkSpeedMax: 220,
      trauma: 0.3,
    },
    large: {
      flashRadius: 16,
      fireballs: 9,
      fireRadius: 10,
      spread: 14,
      smokePuffs: 9,
      smokeRadius: 9,
      sparks: 14,
      sparkSpeedMin: 140,
      sparkSpeedMax: 260,
      trauma: 0.65,
    },
  },
};
