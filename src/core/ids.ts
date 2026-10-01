/**
 * Identifier registries. Adding an Enemy, Weapon or projectile starts by adding its id here
 * (one entry per line). `Record<Id, ...>` catalogs elsewhere (tuning, behaviors, renderer
 * drawers) then fail to typecheck until the new id is handled everywhere it must be.
 */

/** Every Weapon, in inventory slot order: slot N (number key N) is entry N - 1. */
export const WEAPON_IDS = [
  'mazo-automatico', // Mazo Automático
  'lluvia-de-sellos', // Lluvia de Sellos
] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

/**
 * The Weapon Rexi always carries: unlimited ammo, never found in a Crate, and the fallback
 * when another Weapon runs out of ammo.
 */
export const DEFAULT_WEAPON = 'mazo-automatico' satisfies WeaponId;

/** Weapons with limited ammo, which come in Crates. */
export type SpecialWeaponId = Exclude<WeaponId, typeof DEFAULT_WEAPON>;
export const SPECIAL_WEAPON_IDS: readonly SpecialWeaponId[] = WEAPON_IDS.filter(
  (id): id is SpecialWeaponId => id !== DEFAULT_WEAPON,
);

/** Every Power-up. Empty until the Power-up tickets add them (one entry per line). */
export const POWER_UP_IDS = [] as const;
export type PowerUpId = (typeof POWER_UP_IDS)[number];

/** What a Crate carries: ammo for one special Weapon, or one Power-up. */
export type CrateContents =
  | { readonly kind: 'weapon'; readonly weapon: SpecialWeaponId }
  | { readonly kind: 'power-up'; readonly powerUp: PowerUpId };

export const ENEMY_KINDS = [
  'maletin-coptero', // Maletín-cóptero (Lawyer Craft)
  'banca-artillada', // Banca Artillada (Gym Craft)
] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

/** Projectile kinds select a projectile's look in the renderer and its hit rules. */
export const PROJECTILE_KINDS = [
  'gavel', // Mazo Automático
  'paper', // Maletín-cóptero
  'stamp', // Lluvia de Sellos
  'rocket', // Banca Artillada
] as const;
export type ProjectileKind = (typeof PROJECTILE_KINDS)[number];

/** Particle kinds select a particle's look in the renderer (see src/core/run/effects). */
export const PARTICLE_KINDS = [
  'flash', // opening white disc of an explosion
  'fire', // fireball
  'smoke', // rising puff
  'spark', // tiny fast ember
  'debris', // chunk of a destroyed Enemy
] as const;
export type ParticleKind = (typeof PARTICLE_KINDS)[number];

/** Every Enemy belongs to one side of Bufete & Pesas S.A. */
export type Craft = 'lawyer' | 'gym';
