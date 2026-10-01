import type {
  Craft,
  CrateContents,
  EnemyKind,
  ParticleKind,
  ProjectileKind,
  WeaponId,
} from './ids';
import type { Vec2 } from './math';
import type { DeviceKind } from './options';
import type { PauseMenuItem } from './pause-menu';
import type { QuipTheme } from './quips/catalog';

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
  /**
   * The ramp clock, in ticks: Run time that counts toward the spawn Director's difficulty
   * ramp. Excludes pause and Hit-stop.
   */
  readonly rampTicks: number;
  readonly arena: ArenaView;
  readonly rexi: RexiView;
  readonly enemies: readonly EnemyView[];
  readonly projectiles: readonly ProjectileView[];
  readonly effects: EffectsView;
  readonly crates: readonly CrateView[];
  readonly stats: RunStatsView;
  /** True once Rexi has been defeated: the Run is over and no longer advances. */
  readonly ended: boolean;
  /** Ticks of Hit-stop left: while above 0 the Run is frozen (the Dialogue Box is not). */
  readonly hitStop: number;
  /** The Dialogue Box, or null when Rexi is not talking. */
  readonly dialogue: DialogueView | null;
}

/** The Dialogue Box showing one Quip with typewriter text. It never blocks play. */
export interface DialogueView {
  readonly quipId: string;
  readonly theme: QuipTheme;
  /** The whole Quip; draw only its first `revealed` characters. */
  readonly text: string;
  /** Characters of `text` revealed so far by the typewriter. */
  readonly revealed: number;
  /** True once every character is revealed (the box lingers, then closes). */
  readonly complete: boolean;
  /** How far the box has slid in: 0 hidden below the screen, 1 fully open. */
  readonly openness: number;
  /** Ticks since the box opened (animation phase, e.g. the blinking cursor). */
  readonly age: number;
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
  /** Ticks left of the hurt reaction after a hit (0 = not hurt). Drives the hurt animation. */
  readonly hurtTicks: number;
  /** Ticks left during which hits are ignored (0 = vulnerable). Drives the flicker. */
  readonly invulnerableTicks: number;
  /** The selected Weapon. */
  readonly weapon: WeaponView;
  /** Every Weapon Rexi carries, in slot order (the Mazo Automático is always first). */
  readonly inventory: readonly WeaponView[];
}

export interface WeaponView {
  readonly id: WeaponId;
  /** Remaining ammo, or null for unlimited (Mazo Automático). */
  readonly ammo: number | null;
}

export interface CrateView extends BoxView {
  readonly id: number;
  readonly contents: CrateContents;
  /** False while it falls under its parachute. */
  readonly landed: boolean;
  /** Ticks until it expires once landed; null while falling. */
  readonly ticksLeft: number | null;
  /** True during the last part of its lifetime (the renderer picks the blink cadence). */
  readonly blinking: boolean;
  /** Ticks since it was dropped (animation phase). */
  readonly age: number;
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
  /** Fading traces of beam shots (Sentencia Firme), oldest first. */
  readonly beams: readonly BeamView[];
}

/** The trace of a beam shot, from the muzzle to where it left the screen or met the ground. */
export interface BeamView {
  readonly from: Vec2;
  readonly to: Vec2;
  /** Ticks since it was fired. */
  readonly age: number;
  /** 1 at full strength, falling toward 0 as it fades out. */
  readonly intensity: number;
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
