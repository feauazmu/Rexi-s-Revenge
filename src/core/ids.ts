/**
 * Identifier registries. Adding an Enemy, Weapon or projectile starts by adding its id here
 * (one entry per line). `Record<Id, ...>` catalogs elsewhere (tuning, behaviors, renderer
 * drawers) then fail to typecheck until the new id is handled everywhere it must be.
 */

export const WEAPON_IDS = [
  'mazo-automatico', // Mazo Automático
] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export const ENEMY_KINDS = [
  'maletin-coptero', // Maletín-cóptero (Lawyer Craft)
] as const;
export type EnemyKind = (typeof ENEMY_KINDS)[number];

/** Projectile kinds select a projectile's look in the renderer and its hit rules. */
export const PROJECTILE_KINDS = [
  'gavel', // Mazo Automático
] as const;
export type ProjectileKind = (typeof PROJECTILE_KINDS)[number];

/** Every Enemy belongs to one side of Bufete & Pesas S.A. */
export type Craft = 'lawyer' | 'gym';
