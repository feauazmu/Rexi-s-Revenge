import type { CrateContents, EnemyKind, ProjectileKind, SpecialWeaponId, WeaponId } from '../ids';
import type { Box, Vec2 } from '../math';
import type { ScriptedSpawn } from '../options';
import type { DirectorState } from './director';
import type { ExplosionSize, TimedPowerUpId } from '../tuning';
import type { EffectsState } from './effects';

/** Mutable simulation state of one Run. Private to src/core/run; exposed only via RunView. */
export interface RunState {
  /** Simulated Run ticks. */
  tick: number;
  /**
   * The ramp clock: Run ticks that count toward the Director's difficulty ramp. It advances
   * only with the simulation (`advanceRampClock`), so pause and Hit-stop never move it.
   */
  rampTicks: number;
  rexi: RexiState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  /** Cosmetic effects (particles, screen shake); never read by gameplay. */
  effects: EffectsState;
  crates: CrateState[];
  stats: RunStats;
  /** True once Rexi's health reached zero; the Run no longer advances. */
  ended: boolean;
  /** Scripted spawns not yet released, sorted by tick. Null when the Director spawns. */
  scriptedSpawns: ScriptedSpawn[] | null;
  /** Run tick of the next automatic Crate drop; null when spawning is scripted. */
  nextCrateDrop: number | null;
  director: DirectorState;
}

export interface Body extends Box {
  vx: number;
  vy: number;
  grounded: boolean;
}

export interface RexiState extends Body {
  /** True from a jump's take-off until it is cut short or starts falling. */
  rising: boolean;
  health: number;
  readonly maxHealth: number;
  facing: 1 | -1;
  aim: Vec2;
  /** Ticks since the last shot (capped), for recoil animation. */
  shotAge: number;
  /** Ticks left during which hits are ignored (0 = can be hurt). */
  invulnerableTicks: number;
  /** Ticks left of the hurt reaction (0 = not hurt). */
  hurtTicks: number;
  inventory: InventoryState;
  /** Active timed Power-ups, in pickup order. */
  readonly powerUps: Map<TimedPowerUpId, ActivePowerUpState>;
}

export interface ActivePowerUpState {
  /** Ticks left, counting the current one; it ends when this reaches 0. */
  ticksLeft: number;
  /** The full duration it started (or restarted) with, ticks. */
  readonly totalTicks: number;
}

/** HA3-style Weapon inventory. The Mazo Automático is always carried and has no ammo entry. */
export interface InventoryState {
  selected: WeaponId;
  /** Ammo of each special Weapon carried; a special Weapon is carried while it has an entry. */
  readonly ammo: Map<SpecialWeaponId, number>;
  /** Ticks until each Weapon may fire again (missing or 0: ready). */
  readonly cooldowns: Map<WeaponId, number>;
}

export interface CrateState extends Body {
  readonly id: number;
  readonly contents: CrateContents;
  /** Ticks left before it expires; null until it lands. */
  ttl: number | null;
  /** Ticks since it was dropped. */
  age: number;
}

export interface EnemyState extends Box {
  readonly id: number;
  readonly kind: EnemyKind;
  health: number;
  readonly maxHealth: number;
  /** Ticks since spawn. */
  age: number;
  /** Run tick of the latest hit-flash start, or null if never hit. */
  hitFlashTick: number | null;
  /** Progress of an attack telegraph, 0..1 (0 when not winding up). Set by its behavior. */
  attackWindup: number;
  /** Per-kind behavior memory, created by the Enemy's `init` and only read by its `update`. */
  memory: unknown;
}

export interface ProjectileState extends Box {
  readonly id: number;
  readonly kind: ProjectileKind;
  readonly owner: 'rexi' | 'enemy';
  vx: number;
  vy: number;
  /** Downward acceleration, px/s² (0 for straight shots). */
  readonly gravity: number;
  /** Homing turn rate toward the nearest target, radians per second (0 = flies straight). */
  readonly turnRate: number;
  readonly damage: number;
  /** Ticks left before the projectile disappears. */
  ttl: number;
  /** Ticks since fired. */
  age: number;
  /** Bounces off the ground and platforms; null when it does not bounce. */
  bounce: ProjectileBounce | null;
  /** Acceleration along its heading (rockets); null for constant speed. */
  readonly thrust: ProjectileThrust | null;
  /** Splash damage on detonation (explosive Weapons); null when it does not explode. */
  readonly blast: Blast | null;
  /** Ticks between the puffs of its smoke trail (cosmetic); null for no trail. */
  readonly trailInterval: number | null;
}

export interface ProjectileBounce {
  /** Bounces left; landing with none left ends the projectile. */
  left: number;
  /** Fraction of the vertical speed kept by a bounce. */
  readonly restitution: number;
}

export interface ProjectileThrust {
  /** Acceleration along the heading, px/s². */
  readonly acceleration: number;
  /** Top speed, px/s. */
  readonly maxSpeed: number;
}

/**
 * What an explosive projectile does when it detonates (see `detonate`). Its splash hurts what
 * its owner fights: Enemies for Rexi's projectiles, Rexi for Enemy ones.
 */
export interface Blast {
  /** Reach, from the blast center to the nearest point of a target's hitbox, px. */
  readonly radius: number;
  /** Splash damage at the center; 0 for a harmless (cosmetic) explosion. */
  readonly damage: number;
  /** Fraction of `damage` dealt at the edge of the radius (0..1). */
  readonly edge: number;
  /** Explosion preset played (see `tuning.effects.explosions`). */
  readonly explosion: ExplosionSize;
}

export interface RunStats {
  score: number;
  enemiesDestroyed: number;
}
