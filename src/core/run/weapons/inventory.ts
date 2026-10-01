import { DEFAULT_WEAPON, WEAPON_IDS, type SpecialWeaponId, type WeaponId } from '../../ids';
import type { InputFrame } from '../../input';
import type { WeaponView } from '../../view';
import type { RunContext } from '../context';
import type { InventoryState } from '../state';

/**
 * HA3 inventory rules. The Mazo Automático is always carried with unlimited ammo. A collected
 * special Weapon is added with its pickup ammo (and selected) or, if already carried, topped up
 * to at most its maximum. A Weapon that runs out of ammo leaves the inventory and the Mazo is
 * selected. Slots and cycling follow the order of WEAPON_IDS.
 */
export function createInventory(): InventoryState {
  return { selected: DEFAULT_WEAPON, ammo: new Map(), cooldowns: new Map() };
}

function isCarried(inventory: Readonly<InventoryState>, id: WeaponId): boolean {
  return id === DEFAULT_WEAPON || inventory.ammo.has(id);
}

/** Carried Weapons in slot order. */
function carried(inventory: Readonly<InventoryState>): WeaponId[] {
  return WEAPON_IDS.filter((id) => isCarried(inventory, id));
}

function weaponView(inventory: Readonly<InventoryState>, id: WeaponId): WeaponView {
  return { id, ammo: id === DEFAULT_WEAPON ? null : (inventory.ammo.get(id) ?? 0) };
}

export function viewInventory(inventory: Readonly<InventoryState>): {
  readonly weapon: WeaponView;
  readonly inventory: readonly WeaponView[];
} {
  return {
    weapon: weaponView(inventory, inventory.selected),
    inventory: carried(inventory).map((id) => weaponView(inventory, id)),
  };
}

function select(ctx: RunContext, id: WeaponId): void {
  const { inventory } = ctx.state.rexi;
  if (inventory.selected === id) return;
  const from = inventory.selected;
  inventory.selected = id;
  ctx.emit({ type: 'weapon-switched', from, to: id });
}

/** Adds a special Weapon with its pickup ammo, or tops up the carried one. */
export function collectWeapon(ctx: RunContext, weapon: SpecialWeaponId): void {
  const { inventory } = ctx.state.rexi;
  const { pickupAmmo, maxAmmo } = ctx.tuning.weapons[weapon];
  const current = inventory.ammo.get(weapon);
  const added = current === undefined;
  const ammo = Math.min(maxAmmo, (current ?? 0) + pickupAmmo);
  inventory.ammo.set(weapon, ammo);
  ctx.emit({ type: 'weapon-collected', weapon, ammo, added });
  if (added) select(ctx, weapon);
}

/** Applies the switch inputs of one frame. A direct slot wins over next/previous. */
export function applySwitchInput(ctx: RunContext, input: InputFrame): void {
  const { inventory } = ctx.state.rexi;
  if (input.weaponSlot !== null) {
    const id = WEAPON_IDS[input.weaponSlot - 1];
    if (id !== undefined && isCarried(inventory, id)) select(ctx, id);
    return;
  }
  const step = (input.weaponNext ? 1 : 0) - (input.weaponPrevious ? 1 : 0);
  if (step === 0) return;
  const list = carried(inventory);
  const index = list.indexOf(inventory.selected);
  const next = list[(index + step + list.length) % list.length];
  if (next !== undefined) select(ctx, next);
}

/** Spends one ammo of the selected Weapon; an emptied Weapon falls back to the Mazo. */
export function spendAmmo(ctx: RunContext): void {
  const { inventory } = ctx.state.rexi;
  const id = inventory.selected;
  if (id === DEFAULT_WEAPON) return;
  const left = (inventory.ammo.get(id) ?? 0) - 1;
  if (left > 0) {
    inventory.ammo.set(id, left);
    return;
  }
  inventory.ammo.delete(id);
  ctx.emit({ type: 'weapon-depleted', weapon: id });
  select(ctx, DEFAULT_WEAPON);
}
