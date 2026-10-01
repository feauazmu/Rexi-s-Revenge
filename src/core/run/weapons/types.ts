import type { WeaponId } from '../../ids';
import type { Vec2 } from '../../math';
import type { RunContext } from '../context';

/** Where and in which direction one trigger pull leaves Rexi's Weapon. */
export interface Shot {
  readonly origin: Vec2;
  /** Unit vector toward the aim point. */
  readonly direction: Vec2;
}

/**
 * Behavior of one Weapon. Numbers (fire interval, damage, speeds, ammo) live in the tuning
 * catalog under `tuning.weapons[id]`; this object holds only logic. The Weapon system handles
 * the trigger, cooldown and events; `fire` only creates the shot's projectiles or effects.
 */
export interface WeaponDef {
  readonly id: WeaponId;
  fire(shot: Shot, ctx: RunContext): void;
}
