import { secondsToTicks } from '../../constants';
import type { InputFrame } from '../../input';
import type { RunContext } from '../context';
import { aimDirectionOf, muzzleOf } from '../rexi';
import { weaponCatalog } from './index';

/**
 * Trigger handling for Rexi's current Weapon: cooldown, firing and the weapon-fired event.
 * (The HA3 inventory, ammo and switching arrive with the Crates ticket.)
 */
export function stepWeapons(ctx: RunContext, input: InputFrame): void {
  const { rexi } = ctx.state;
  if (rexi.fireCooldown > 0) rexi.fireCooldown -= 1;
  if (!input.fire || rexi.fireCooldown > 0) return;

  const weapon = weaponCatalog[rexi.weapon];
  weapon.fire(
    { origin: muzzleOf(rexi, ctx.tuning), direction: aimDirectionOf(rexi, ctx.tuning) },
    ctx,
  );
  rexi.shotAge = 0;
  rexi.fireCooldown = Math.max(1, secondsToTicks(ctx.tuning.weapons[rexi.weapon].fireInterval));
  ctx.emit({ type: 'weapon-fired', weapon: rexi.weapon });
}
