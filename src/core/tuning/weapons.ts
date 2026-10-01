import type { SpecialWeaponId, WeaponId } from '../ids';

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

/** Archetype: a straight projectile that steers toward the nearest Enemy. */
export interface HomingShotTuning extends StraightShotTuning {
  /** Fastest the projectile turns toward its target, degrees per second. */
  readonly turnRate: number;
}

/** Archetype: an instant beam that hits every Enemy along its line, up to the screen edge. */
export interface PiercingBeamTuning extends WeaponTuningBase {
  /** Thickness of the beam's hit line, px: Enemies it grazes count as on the line. */
  readonly beamWidth: number;
}

/**
 * One entry per Weapon (keyed by WeaponId); each Weapon picks its archetype's tuning shape.
 * Special Weapons (all but the Mazo Automático) add {@link AmmoTuning}.
 */
export interface WeaponsTuning {
  readonly 'mazo-automatico': StraightShotTuning;
  readonly 'lluvia-de-sellos': SpreadShotTuning & AmmoTuning;
  readonly 'citaciones-teledirigidas': HomingShotTuning & AmmoTuning;
  readonly 'sentencia-firme': PiercingBeamTuning & AmmoTuning;
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
  // After HA3's Seeker Launcher, lighter and quicker: one subpoena settles a Maletín-cóptero.
  'citaciones-teledirigidas': {
    fireInterval: 0.9,
    damage: 12,
    projectileSpeed: 200,
    turnRate: 240,
    projectileLifetime: 3,
    projectileSize: 7,
    pickupAmmo: 8,
    maxAmmo: 16,
  },
  // After HA3's Rail Gun: slow, rare and devastating along its whole line.
  'sentencia-firme': {
    fireInterval: 2,
    damage: 30,
    beamWidth: 4,
    pickupAmmo: 6,
    maxAmmo: 12,
  },
} as const satisfies WeaponsTuning &
  Record<WeaponId, WeaponTuningBase> &
  Record<SpecialWeaponId, AmmoTuning>;
