import type {
  Craft,
  CrateContents,
  EnemyKind,
  ProjectileKind,
  ProjectileOwner,
  SpecialWeaponId,
  WeaponId,
} from './ids';
import type { QuipTheme } from './quips/catalog';
import type { RunStats } from './stats';
import type { ExplosionSize, TimedPowerUpId } from './tuning';
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
  | ExplosionEvent
  | RexiHitEvent
  | RunEndedEvent
  | MenuMovedEvent
  | MuteToggledEvent
  | FullscreenToggleRequestedEvent
  | HighScoreRecordedEvent
  | CrateSpawnedEvent
  | CrateLandedEvent
  | CratePickedEvent
  | CrateExpiredEvent
  | QuipStartedEvent
  | HitStopStartedEvent
  | HitStopEndedEvent
  | QuipCharacterEvent
  | DialogueClosedEvent
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

/**
 * An explosive projectile detonated: on its target, on the ground or a platform, or burning out
 * (Mancuernas, Código Penal, an Archivador Artillado's drawer, a Banca Artillada's rocket). Its
 * splash damage is applied in the same tick, as `enemy-hit` / `rexi-hit` events after this one.
 */
export interface ExplosionEvent {
  readonly type: 'explosion';
  /** Who fired it: Rexi's blasts hurt Enemies, Enemy blasts hurt Rexi. */
  readonly owner: ProjectileOwner;
  readonly kind: ProjectileKind;
  /** Explosion preset played (see `tuning.effects.explosions`). */
  readonly size: ExplosionSize;
  /** Center of the blast, in game coordinates. */
  readonly x: number;
  readonly y: number;
  /** Splash radius, px. */
  readonly radius: number;
}

/** An Enemy projectile hurt Rexi. Not emitted while he is invulnerable. */
export interface RexiHitEvent {
  readonly type: 'rexi-hit';
  readonly damage: number;
  /** Rexi's health after the hit. */
  readonly health: number;
}

/** Rexi's health reached zero: the Run is over. Emitted once, in the tick of the fatal hit. */
export interface RunEndedEvent extends RunStats {
  readonly type: 'run-ended';
}

/**
 * The selection of an on-screen menu moved: the pause menu, or the Veredicto initials entry
 * (a letter changed or the cursor moved).
 */
export interface MenuMovedEvent {
  readonly type: 'menu-moved';
  /** Index of the newly selected entry (for initials: the cursor's position). */
  readonly selected: number;
}

/** The player signed a top-10 entry on the Veredicto. The table is already persisted. */
export interface HighScoreRecordedEvent {
  readonly type: 'high-score-recorded';
  readonly initials: string;
  readonly score: number;
  /** 1-based place in the top 10. */
  readonly rank: number;
}

/** "Silenciar música" was chosen in the pause menu. The choice is already persisted. */
export interface MuteToggledEvent {
  readonly type: 'mute-toggled';
  /** The new state: true when the music is now muted. */
  readonly muted: boolean;
}

/**
 * "Pantalla completa" was chosen in the pause menu: the platform should enter or leave
 * fullscreen. The Game's `fullscreen` view flag changes only once the platform reports the
 * browser's new state (`Game.reportFullscreen`), and never if the browser refuses.
 */
export interface FullscreenToggleRequestedEvent {
  readonly type: 'fullscreen-toggle-requested';
  /** The desired state: true to enter fullscreen, false to leave it. */
  readonly fullscreen: boolean;
}

/** A Quip triggered: the Dialogue Box opens with this Quip (its Hit-stop follows as `hit-stop-started`). */
export interface QuipStartedEvent {
  readonly type: 'quip-started';
  readonly quipId: string;
  readonly theme: QuipTheme;
  /** The destroyed Enemy that drew the Quip. */
  readonly enemyId: number;
}

/**
 * A Hit-stop began: emitted right after `quip-started`. The Run stays frozen for the next
 * `ticks` ticks while the Dialogue Box keeps animating.
 */
export interface HitStopStartedEvent {
  readonly type: 'hit-stop-started';
  /** Ticks the Run stays frozen, starting with the next tick. */
  readonly ticks: number;
}

/**
 * The Hit-stop is over: on its last frozen tick (the Run steps again from the next tick), when a
 * new Quip restarts it, or when the Run is abandoned during it (Salir from the pause menu).
 */
export interface HitStopEndedEvent {
  readonly type: 'hit-stop-ended';
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
