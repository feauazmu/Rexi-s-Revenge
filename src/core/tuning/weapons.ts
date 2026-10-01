import type { WeaponId } from '../ids';

/** Numbers every Weapon has, whatever its archetype. */
export interface WeaponTuningBase {
  /** Minimum time between shots while fire is held, seconds. */
  readonly fireInterval: number;
  /** Damage per hit. */
  readonly damage: number;
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

/** One entry per Weapon (keyed by WeaponId); each Weapon picks its archetype's tuning shape. */
export interface WeaponsTuning {
  readonly 'mazo-automatico': StraightShotTuning;
}

export const weaponsTuning = {
  'mazo-automatico': {
    fireInterval: 0.12,
    damage: 1,
    projectileSpeed: 380,
    projectileLifetime: 1.4,
    projectileSize: 5,
  },
} as const satisfies WeaponsTuning & Record<WeaponId, WeaponTuningBase>;
