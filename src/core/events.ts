import type { Craft, CrateContents, EnemyKind, SpecialWeaponId, WeaponId } from './ids';
import type { TimedPowerUpId } from './tuning';
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
  | EnemyFiredEvent
  | RexiHitEvent
  | RunEndedEvent
  | MuteToggledEvent
  | CrateSpawnedEvent
  | CrateLandedEvent
  | CratePickedEvent
  | CrateExpiredEvent
  | PowerUpStartedEvent
  | PowerUpEndedEvent
  | RexiHealedEvent;

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

/**
 * A timed Power-up took effect on pickup, or restarted at full duration when picked up again
 * while active. Instant Power-ups (Receso) emit their own effect event instead.
 */
export interface PowerUpStartedEvent {
  readonly type: 'power-up-started';
  readonly powerUp: TimedPowerUpId;
  /** How long it lasts from this tick, ticks. */
  readonly ticks: number;
  /** True when it was already active and was restarted. */
  readonly refreshed: boolean;
}

/** A timed Power-up ran out. */
export interface PowerUpEndedEvent {
  readonly type: 'power-up-ended';
  readonly powerUp: TimedPowerUpId;
}

/** Rexi regained health (Receso). */
export interface RexiHealedEvent {
  readonly type: 'rexi-healed';
  /** Health actually restored (0 at full health). */
  readonly amount: number;
  /** Rexi's health after healing. */
  readonly health: number;
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

export interface EnemyFiredEvent {
  readonly type: 'enemy-fired';
  readonly enemyId: number;
  readonly kind: EnemyKind;
}

/** An Enemy projectile hurt Rexi. Not emitted while he is invulnerable. */
export interface RexiHitEvent {
  readonly type: 'rexi-hit';
  readonly damage: number;
  /** Rexi's health after the hit. */
  readonly health: number;
}

/** Rexi's health reached zero: the Run is over. Emitted once, in the tick of the fatal hit. */
export interface RunEndedEvent {
  readonly type: 'run-ended';
  readonly score: number;
  /** Enemies destroyed ("demandas desestimadas" in the UI). */
  readonly enemiesDestroyed: number;
  /** Run ticks survived, including the tick of the fatal hit. */
  readonly ticksSurvived: number;
}

/** "Silenciar música" was chosen in the pause menu. The choice is already persisted. */
export interface MuteToggledEvent {
  readonly type: 'mute-toggled';
  /** The new state: true when the music is now muted. */
  readonly muted: boolean;
}
