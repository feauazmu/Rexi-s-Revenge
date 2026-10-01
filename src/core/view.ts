import type { Craft, EnemyKind, ProjectileKind, WeaponId } from './ids';
import type { Vec2 } from './math';
import type { DeviceKind } from './options';
import type { PauseMenuItem } from './pause-menu';

/**
 * Read-only snapshot of everything needed to draw one frame. The renderer is a pure function
 * of this view; it must never need the Game core's internals or a clock.
 *
 * All positions are game coordinates (480×270). Boxes use their top-left corner.
 */
export interface GameView {
  /** Ticks since the Game was created. Drives animation phase for every screen. */
  readonly tick: number;
  readonly device: DeviceKind;
  readonly screen: ScreenKind;
  /** Ticks since the current screen was entered (entry animations, blinking prompts). */
  readonly screenAge: number;
  /** True when a start input would be accepted now (Title and Cómo jugar, after a short guard). */
  readonly startReady: boolean;
  /**
   * The current Run, or null when no Run exists (Title, Cómo jugar). While paused it is the
   * frozen Run under the pause menu.
   */
  readonly run: RunView | null;
  /** The pause menu, only on the `paused` screen. */
  readonly pauseMenu: PauseMenuView | null;
  /** The persisted "Silenciar música" choice. */
  readonly musicMuted: boolean;
}

/**
 * Screens of the flow state machine:
 * Title → Cómo jugar (first time only) → Run ⇄ Paused → Title (Salir).
 * Veredicto arrives with the Run-end ticket.
 */
export type ScreenKind = 'title' | 'how-to-play' | 'run' | 'paused';

export interface PauseMenuView {
  readonly items: readonly PauseMenuItem[];
  /** Index into `items` of the highlighted entry. */
  readonly selected: number;
}

export interface BoxView {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface RunView {
  /** Simulated Run ticks (frozen while paused). */
  readonly tick: number;
  readonly arena: ArenaView;
  readonly rexi: RexiView;
  readonly enemies: readonly EnemyView[];
  readonly projectiles: readonly ProjectileView[];
  readonly stats: RunStatsView;
}

export interface ArenaView {
  readonly width: number;
  readonly height: number;
  /** Y of the top of the ground floor. */
  readonly groundY: number;
}

export interface RexiView extends BoxView {
  readonly vx: number;
  readonly vy: number;
  readonly grounded: boolean;
  /** Current health, 0..maxHealth (the HUD health bar). */
  readonly health: number;
  readonly maxHealth: number;
  /** 1 when facing right, -1 when facing left. Rexi faces the side he aims at. */
  readonly facing: 1 | -1;
  /** Aim target in game coordinates. */
  readonly aim: Vec2;
  /** Where shots leave from. */
  readonly muzzle: Vec2;
  /** Unit vector from the muzzle toward the aim target. */
  readonly aimDirection: Vec2;
  readonly weapon: WeaponView;
}

export interface WeaponView {
  readonly id: WeaponId;
  /** Remaining ammo, or null for unlimited (Mazo Automático). */
  readonly ammo: number | null;
}

export interface EnemyView extends BoxView {
  readonly id: number;
  readonly kind: EnemyKind;
  readonly craft: Craft;
  readonly health: number;
  readonly maxHealth: number;
  /** Ticks since this Enemy spawned (animation phase). */
  readonly age: number;
}

export interface ProjectileView extends BoxView {
  readonly id: number;
  readonly kind: ProjectileKind;
  readonly owner: 'rexi' | 'enemy';
  readonly vx: number;
  readonly vy: number;
  /** Ticks since this projectile was fired (animation phase). */
  readonly age: number;
}

export interface RunStatsView {
  readonly score: number;
  /** Enemies destroyed ("demandas desestimadas" in the UI). */
  readonly enemiesDestroyed: number;
  /** Run ticks survived. */
  readonly ticksSurvived: number;
}
