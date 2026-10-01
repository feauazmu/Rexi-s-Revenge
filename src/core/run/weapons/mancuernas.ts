import { spawnProjectile } from '../projectiles';
import type { WeaponDef } from './types';

/**
 * Mancuernas: a dumbbell lobbed on an arc. It bounces once off the ground or a platform and
 * explodes when it lands again, on the first Enemy it touches, or when its fuse runs out.
 */
export const mancuernas: WeaponDef = {
  id: 'mancuernas',
  fire({ origin, direction }, ctx) {
    const t = ctx.tuning.weapons.mancuernas;
    spawnProjectile(ctx, {
      kind: 'dumbbell',
      owner: 'rexi',
      center: origin,
      size: t.projectileSize,
      velocity: { x: direction.x * t.launchSpeed, y: direction.y * t.launchSpeed },
      gravity: t.gravity,
      damage: t.damage,
      lifetime: t.fuse,
      bounce: { count: t.bounces, restitution: t.restitution },
      blast: {
        weapon: 'mancuernas',
        splashDamage: t.splashDamage,
        splashRadius: t.splashRadius,
        splashEdge: t.splashEdge,
        explosion: t.explosion,
      },
    });
  },
};
