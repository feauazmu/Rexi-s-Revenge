import type { Craft, EnemyKind, ParticleKind, ProjectileKind, WeaponId } from './ids';
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
  readonly effects: EffectsView;
  readonly stats: RunStatsView;
  /** True once Rexi has been defeated: the Run is over and no longer advances. */
  readonly ended: boolean;
}

export interface ArenaView {
  readonly width: number;
  readonly height: number;
  /** Y of the top of the ground floor. */
  readonly groundY: number;
  /** One-way platforms; only their top surface collides. */
  readonly platforms: readonly PlatformView[];
}

export interface PlatformView {
  readonly x: number;
  /** Y of the walkable top surface. */
  readonly y: number;
  readonly w: number;
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
  /** Pivot of the aiming arm; the arm and held Weapon rotate around it. */
  readonly shoulder: Vec2;
  /** Where shots leave from: the tip of the held Weapon. */
  readonly muzzle: Vec2;
  /** Unit vector from the shoulder toward the aim target (shots fly along it). */
  readonly aimDirection: Vec2;
  /** Ticks since the last shot (capped at a few seconds), for recoil animation. */
  readonly shotAge: number;
  readonly weapon: WeaponView;
  /** Ticks left of the hurt reaction after a hit (0 = not hurt). Drives the hurt animation. */
  readonly hurtTicks: number;
  /** Ticks left during which hits are ignored (0 = vulnerable). Drives the flicker. */
  readonly invulnerableTicks: number;
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
  /** True for the few ticks after a hit: draw the Enemy as a white silhouette. */
  readonly hitFlash: boolean;
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

/** Combat feedback simulated by the core: particles and the screen-shake offset. */
export interface EffectsView {
  /** Live particles, oldest first (draw in this order). */
  readonly particles: readonly ParticleView[];
  /**
   * Whole-pixel offset to draw the world with this frame (screen shake). Screen-fixed layers
   * (crosshair, HUD, Dialogue Box) ignore it.
   */
  readonly shake: Vec2;
}

export type ParticleView = BurstParticleView | DebrisParticleView;

interface ParticleViewBase {
  readonly kind: ParticleKind;
  /** Center, game coordinates. */
  readonly x: number;
  readonly y: number;
  /** Radius for round particles, edge length for sparks and debris, px. */
  readonly size: number;
  /** Ticks since spawn, and total ticks it lives: animate on `age / life`. */
  readonly age: number;
  readonly life: number;
  /** Deterministic per-particle number in [0, 1) for look variations (shade, shape). */
  readonly variant: number;
}

/** Explosion particles: their look comes from `kind` and their age alone. */
export interface BurstParticleView extends ParticleViewBase {
  readonly kind: Exclude<ParticleKind, 'debris'>;
}

/** A chunk of a destroyed Enemy. */
export interface DebrisParticleView extends ParticleViewBase {
  readonly kind: 'debris';
  readonly enemyKind: EnemyKind;
  /** Which chunk of that Enemy (0-based). */
  readonly piece: number;
  /** Rotation in quarter turns, 0..3. */
  readonly quarterTurns: number;
  /** True while it should be hidden by the blink-out at the end of its life. */
  readonly hidden: boolean;
}
