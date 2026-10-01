import type { Craft, EnemyKind, WeaponId } from './ids';
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
  | EnemySpawnedEvent
  | EnemyHitEvent
  | EnemyDestroyedEvent
  | MuteToggledEvent;

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

/** "Silenciar música" was chosen in the pause menu. The choice is already persisted. */
export interface MuteToggledEvent {
  readonly type: 'mute-toggled';
  /** The new state: true when the music is now muted. */
  readonly muted: boolean;
}
