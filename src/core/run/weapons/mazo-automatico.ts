import { spawnProjectile } from '../projectiles';
import type { WeaponDef } from './types';

/** Mazo Automático: rapid-fire gavels in a straight line. Unlimited ammo. */
export const mazoAutomatico: WeaponDef = {
  id: 'mazo-automatico',
  fire({ origin, direction }, ctx) {
    const t = ctx.tuning.weapons['mazo-automatico'];
    spawnProjectile(ctx, {
      kind: 'gavel',
      owner: 'rexi',
      center: origin,
      size: t.projectileSize,
      velocity: { x: direction.x * t.projectileSpeed, y: direction.y * t.projectileSpeed },
      damage: t.damage,
      lifetime: t.projectileLifetime,
    });
  },
};
