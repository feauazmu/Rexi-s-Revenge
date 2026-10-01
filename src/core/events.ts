import type { Craft, EnemyKind, WeaponId } from './ids';
import type { QuipTheme } from './quips/catalog';
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
  | QuipStartedEvent
  | QuipCharacterEvent
  | DialogueClosedEvent;

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

/** A Quip triggered: the Hit-stop starts and the Dialogue Box opens with this Quip. */
export interface QuipStartedEvent {
  readonly type: 'quip-started';
  readonly quipId: string;
  readonly theme: QuipTheme;
  /** The destroyed Enemy that drew the Quip. */
  readonly enemyId: number;
  /** Ticks of Hit-stop that follow this tick (the Run stays frozen for that many ticks). */
  readonly hitStopTicks: number;
}

/** The typewriter revealed one visible character (never a space): the text blip. */
export interface QuipCharacterEvent {
  readonly type: 'quip-character';
  readonly quipId: string;
  readonly char: string;
  /** Index of the character in the Quip's text. */
  readonly index: number;
}

/** The Dialogue Box finished closing (it is no longer in the view). */
export interface DialogueClosedEvent {
  readonly type: 'dialogue-closed';
  readonly quipId: string;
}
