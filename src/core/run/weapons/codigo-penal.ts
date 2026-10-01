import { spawnProjectile } from '../projectiles';
import type { WeaponDef } from './types';

/**
 * Código Penal: a law book fired as a rocket. It leaves slowly, accelerates in a straight line
 * trailing smoke, and explodes on the first Enemy it hits or on the ground.
 */
export const codigoPenal: WeaponDef = {
  id: 'codigo-penal',
  fire({ origin, direction }, ctx) {
    const t = ctx.tuning.weapons['codigo-penal'];
    spawnProjectile(ctx, {
      kind: 'law-book',
      owner: 'rexi',
      center: origin,
      size: t.projectileSize,
      velocity: { x: direction.x * t.launchSpeed, y: direction.y * t.launchSpeed },
      damage: t.damage,
      lifetime: t.projectileLifetime,
      thrust: { acceleration: t.acceleration, maxSpeed: t.maxSpeed },
      trailInterval: t.trailInterval,
      blast: {
        weapon: 'codigo-penal',
        splashDamage: t.splashDamage,
        splashRadius: t.splashRadius,
        splashEdge: t.splashEdge,
        explosion: t.explosion,
      },
    });
  },
};
