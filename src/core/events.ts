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
  | EnemyFiredEvent
  | RexiHitEvent
  | RunEndedEvent;

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
