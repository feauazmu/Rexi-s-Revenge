import type { Craft, EnemyKind, ProjectileKind, WeaponId } from './ids';
import type { Vec2 } from './math';
import type { DeviceKind } from './options';

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
  /** The current Run, or null when no Run exists (e.g. on the Title screen). */
  readonly run: RunView | null;
}

/** Screens of the flow state machine. Title, Cómo jugar, pause and Veredicto arrive later. */
export type ScreenKind = 'run';

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
  /** 1 when facing right, -1 when facing left. Rexi faces the side he aims at. */
  readonly facing: 1 | -1;
  /** Aim target in game coordinates. */
  readonly aim: Vec2;
  /** Pivot of the aiming arm; the arm and held Weapon rotate around it. */
  readonly shoulder: Vec2;
  /** Where shots leave from: the tip of the held Weapon. */
  readonly muzzle: Vec2;
  /** Unit vector from the shoulder toward the aim target (shots fly along it). */
  readonly aimDirection: Vec2;
  /** Ticks since the last shot (capped at a few seconds), for recoil animation. */
  readonly shotAge: number;
  /** Ticks left in the hurt reaction; 0 when Rexi is not hurt. */
  readonly hurtTicks: number;
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
