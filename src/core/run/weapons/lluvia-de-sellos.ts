import { rotate } from '../../math';
import { spawnProjectile } from '../projectiles';
import type { WeaponDef } from './types';

/** Lluvia de Sellos: a short-range fan of rubber stamps, evenly spread around the aim. */
export const lluviaDeSellos: WeaponDef = {
  id: 'lluvia-de-sellos',
  fire({ origin, direction }, ctx) {
    const t = ctx.tuning.weapons['lluvia-de-sellos'];
    const spread = (t.spreadAngle * Math.PI) / 180;
    for (let i = 0; i < t.pellets; i++) {
      const offset = t.pellets === 1 ? 0 : -spread / 2 + (spread * i) / (t.pellets - 1);
      const heading = rotate(direction, offset);
      spawnProjectile(ctx, {
        kind: 'stamp',
        owner: 'rexi',
        center: origin,
        size: t.projectileSize,
        velocity: { x: heading.x * t.projectileSpeed, y: heading.y * t.projectileSpeed },
        damage: t.damage,
        lifetime: t.projectileLifetime,
      });
    }
  },
};
