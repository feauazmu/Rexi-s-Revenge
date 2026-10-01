import { spawnProjectile } from '../projectiles';
import type { WeaponDef } from './types';

/**
 * Citaciones Teledirigidas: a subpoena that leaves along the aim and then steers toward the
 * nearest Enemy, retargeting whenever another one becomes nearer (or its target is destroyed).
 * With no Enemy around it flies straight.
 */
export const citacionesTeledirigidas: WeaponDef = {
  id: 'citaciones-teledirigidas',
  fire({ origin, direction }, ctx) {
    const t = ctx.tuning.weapons['citaciones-teledirigidas'];
    spawnProjectile(ctx, {
      kind: 'subpoena',
      owner: 'rexi',
      center: origin,
      size: t.projectileSize,
      velocity: { x: direction.x * t.projectileSpeed, y: direction.y * t.projectileSpeed },
      damage: t.damage,
      lifetime: t.projectileLifetime,
      homing: { turnRate: t.turnRate },
    });
  },
};
