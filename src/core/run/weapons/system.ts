import { secondsToTicks } from '../../constants';
import type { InputFrame } from '../../input';
import type { RunContext } from '../context';
import { aimDirectionOf, muzzleOf } from '../rexi';
import { weaponCatalog } from './index';
import { applySwitchInput, spendAmmo } from './inventory';

/**
 * Rexi's Weapons for one tick: switching, per-Weapon cooldowns, firing the selected Weapon,
 * the weapon-fired event and spending ammo (one per trigger pull).
 */
export function stepWeapons(ctx: RunContext, input: InputFrame): void {
  const { rexi } = ctx.state;
  const { cooldowns } = rexi.inventory;
  for (const [id, ticks] of cooldowns) if (ticks > 0) cooldowns.set(id, ticks - 1);

  applySwitchInput(ctx, input);
  const id = rexi.inventory.selected;
  if (!input.fire || (cooldowns.get(id) ?? 0) > 0) return;

  weaponCatalog[id].fire(
    { origin: muzzleOf(rexi, ctx.tuning), direction: aimDirectionOf(rexi, ctx.tuning) },
    ctx,
  );
  rexi.shotAge = 0;
  cooldowns.set(id, Math.max(1, secondsToTicks(ctx.tuning.weapons[id].fireInterval)));
  ctx.emit({ type: 'weapon-fired', weapon: id });
  spendAmmo(ctx);
}
