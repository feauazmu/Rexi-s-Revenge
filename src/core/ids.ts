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
