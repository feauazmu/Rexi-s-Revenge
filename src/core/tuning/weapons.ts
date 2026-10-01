import type { SpecialWeaponId, WeaponId } from '../ids';
import type { ExplosionSize } from './effects';

/** Numbers every Weapon has, whatever its archetype. */
export interface WeaponTuningBase {
  /** Minimum time between shots while fire is held, seconds. */
  readonly fireInterval: number;
  /** Damage per hit. */
  readonly damage: number;
}

/** Ammo of a special Weapon (every Weapon except the Mazo Automático, which is unlimited). */
export interface AmmoTuning {
  /** Ammo a Crate gives. A new Weapon starts with this much; an owned one is topped up by it. */
  readonly pickupAmmo: number;
  /** Most ammo the Weapon can hold; top-ups beyond it are lost. */
  readonly maxAmmo: number;
}

/** Archetype: rapid straight projectile. */
export interface StraightShotTuning extends WeaponTuningBase {
  /** Projectile speed, px/s. */
  readonly projectileSpeed: number;
  /** Projectile lifetime, seconds. */
  readonly projectileLifetime: number;
  /** Projectile hitbox size, px. */
  readonly projectileSize: number;
}

/** Archetype: a fan of straight projectiles per trigger pull (one ammo per pull). */
export interface SpreadShotTuning extends StraightShotTuning {
  /** Projectiles per shot, evenly spaced across the fan. */
  readonly pellets: number;
  /** Angle between the outermost projectiles, degrees. */
  readonly spreadAngle: number;
}

/**
 * Splash damage of an explosive projectile. When it detonates, every Enemy within
 * `splashRadius` of the blast takes splash damage on top of any impact damage: the full amount
 * at the center, falling off linearly to `splashEdge` × the full amount at the radius. Splash
 * never hurts Rexi.
 */
export interface SplashTuning {
  /** Splash damage at the center of the blast. */
  readonly splashDamage: number;
  /** Reach of the blast, from its center to the nearest point of an Enemy, px. */
  readonly splashRadius: number;
  /** Fraction of `splashDamage` dealt at the edge of the radius (0..1). */
  readonly splashEdge: number;
  /** Explosion preset played on detonation (see `tuning.effects.explosions`). */
  readonly explosion: ExplosionSize;
}

/**
 * Archetype: a lobbed explosive. It flies on an arc under its own gravity, bounces off the
 * ground and platforms, and explodes on an Enemy, when it lands after its last bounce, or when
 * its fuse runs out. `damage` is the impact damage of a direct hit.
 */
export interface LobbedExplosiveTuning extends WeaponTuningBase, SplashTuning {
  /** Launch speed along the aim, px/s. */
  readonly launchSpeed: number;
  /** Downward acceleration of the projectile, px/s². */
  readonly gravity: number;
  /** Bounces before it explodes on landing. */
  readonly bounces: number;
  /** Fraction of the vertical speed kept by a bounce. */
  readonly restitution: number;
  /** Explodes after this long if nothing else set it off, seconds. */
  readonly fuse: number;
  /** Projectile hitbox size, px. */
  readonly projectileSize: number;
}

/**
 * Archetype: a straight rocket with splash damage. It leaves slowly, accelerates along the aim
 * to its top speed, and explodes on an Enemy, on the ground or when its lifetime runs out.
 * `damage` is the impact damage of a direct hit.
 */
export interface SplashRocketTuning extends WeaponTuningBase, SplashTuning {
  /** Speed when it leaves the muzzle, px/s. */
  readonly launchSpeed: number;
  /** Acceleration along its heading, px/s². */
  readonly acceleration: number;
  /** Top speed, px/s. */
  readonly maxSpeed: number;
  /** Projectile lifetime, seconds. */
  readonly projectileLifetime: number;
  /** Projectile hitbox size, px. */
  readonly projectileSize: number;
  /** Time between the puffs of its smoke trail, seconds (cosmetic). */
  readonly trailInterval: number;
}

/**
 * One entry per Weapon (keyed by WeaponId); each Weapon picks its archetype's tuning shape.
 * Special Weapons (all but the Mazo Automático) add {@link AmmoTuning}.
 */
export interface WeaponsTuning {
  readonly 'mazo-automatico': StraightShotTuning;
  readonly 'lluvia-de-sellos': SpreadShotTuning & AmmoTuning;
  readonly mancuernas: LobbedExplosiveTuning & AmmoTuning;
  readonly 'codigo-penal': SplashRocketTuning & AmmoTuning;
}

export const weaponsTuning = {
  'mazo-automatico': {
    fireInterval: 0.12,
    damage: 1,
    projectileSpeed: 380,
    projectileLifetime: 1.4,
    projectileSize: 5,
  },
  'lluvia-de-sellos': {
    fireInterval: 0.75,
    damage: 3,
    pellets: 5,
    spreadAngle: 36,
    projectileSpeed: 360,
    // About 120 px of range: heavy damage up close, nothing far away.
    projectileLifetime: 0.33,
    projectileSize: 6,
    pickupAmmo: 20,
    maxAmmo: 40,
  },
  // After HA3's Grenade Launcher (75 + 35 splash against a 10-damage Pistol), on our scale.
  mancuernas: {
    fireInterval: 0.9375,
    damage: 8,
    splashDamage: 4,
    splashRadius: 28,
    splashEdge: 0.5,
    explosion: 'small',
    launchSpeed: 300,
    gravity: 600,
    bounces: 1,
    restitution: 0.55,
    fuse: 2.5,
    projectileSize: 7,
    pickupAmmo: 15,
    maxAmmo: 30,
  },
  // After HA3's Rocket Launcher (100 + 35 splash), with the RPG's slow start.
  'codigo-penal': {
    fireInterval: 1.25,
    damage: 10,
    splashDamage: 4,
    splashRadius: 36,
    splashEdge: 0.5,
    explosion: 'large',
    launchSpeed: 120,
    acceleration: 600,
    maxSpeed: 420,
    projectileLifetime: 2.5,
    projectileSize: 8,
    trailInterval: 0.05,
    pickupAmmo: 11,
    maxAmmo: 22,
  },
} as const satisfies WeaponsTuning &
  Record<WeaponId, WeaponTuningBase> &
  Record<SpecialWeaponId, AmmoTuning>;
