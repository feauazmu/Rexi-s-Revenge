import type { Craft, CrateContents, EnemyKind, SpecialWeaponId, WeaponId } from './ids';
import type { ScreenKind } from './view';

/**
 * Everything observable that happened during one tick. Adapters (renderer effects, audio)
 * react to events instead of reaching into game logic.
 *
 * Discriminated by `type`. Add new variants as new interfaces plus one line in the union.
 */
export type GameEvent =
  | ScreenChangedEvent
  | RunStartedEvent
  | WeaponFiredEvent
  | WeaponSwitchedEvent
  | WeaponCollectedEvent
  | WeaponDepletedEvent
  | EnemySpawnedEvent
  | EnemyHitEvent
  | EnemyDestroyedEvent
  | CrateSpawnedEvent
  | CrateLandedEvent
  | CratePickedEvent
  | CrateExpiredEvent;

export type GameEventType = GameEvent['type'];

/** Narrows the union to one event type: `GameEventOf<'enemy-destroyed'>`. */
export type GameEventOf<T extends GameEventType> = Extract<GameEvent, { type: T }>;

export interface ScreenChangedEvent {
  readonly type: 'screen-changed';
  readonly from: ScreenKind | null;
  readonly to: ScreenKind;
}

export interface RunStartedEvent {
  readonly type: 'run-started';
}

export interface WeaponFiredEvent {
  readonly type: 'weapon-fired';
  readonly weapon: WeaponId;
}

/** The selected Weapon changed (by the player, a new pickup or running out of ammo). */
export interface WeaponSwitchedEvent {
  readonly type: 'weapon-switched';
  readonly from: WeaponId;
  readonly to: WeaponId;
}

/** Rexi got ammo for a special Weapon from a Crate. */
export interface WeaponCollectedEvent {
  readonly type: 'weapon-collected';
  readonly weapon: SpecialWeaponId;
  /** Ammo after collecting. */
  readonly ammo: number;
  /** True when the Weapon was new to the inventory, false when an owned one was topped up. */
  readonly added: boolean;
}

/** A special Weapon ran out of ammo and left the inventory. */
export interface WeaponDepletedEvent {
  readonly type: 'weapon-depleted';
  readonly weapon: SpecialWeaponId;
}

export interface CrateSpawnedEvent {
  readonly type: 'crate-spawned';
  readonly crateId: number;
  readonly contents: CrateContents;
  /** Left edge of the Crate. */
  readonly x: number;
}

export interface CrateLandedEvent {
  readonly type: 'crate-landed';
  readonly crateId: number;
}

/** Rexi touched a Crate and collected its contents. */
export interface CratePickedEvent {
  readonly type: 'crate-picked';
  readonly crateId: number;
  readonly contents: CrateContents;
}

/** A Crate's lifetime ran out before Rexi picked it up. */
export interface CrateExpiredEvent {
  readonly type: 'crate-expired';
  readonly crateId: number;
}

export interface EnemySpawnedEvent {
  readonly type: 'enemy-spawned';
  readonly enemyId: number;
  readonly kind: EnemyKind;
}

export interface EnemyHitEvent {
  readonly type: 'enemy-hit';
  readonly enemyId: number;
  readonly kind: EnemyKind;
  readonly damage: number;
}

export interface EnemyDestroyedEvent {
  readonly type: 'enemy-destroyed';
  readonly enemyId: number;
  readonly kind: EnemyKind;
  readonly craft: Craft;
  readonly points: number;
  /** Center of the Enemy when it was destroyed, in game coordinates. */
  readonly x: number;
  readonly y: number;
}
