import type { EnemyKind, ProjectileKind, WeaponId } from '../ids';
import type { Box, Vec2 } from '../math';
import type { ScriptedSpawn } from '../options';
import type { EffectsState } from './effects';

/** Mutable simulation state of one Run. Private to src/core/run; exposed only via RunView. */
export interface RunState {
  /** Simulated Run ticks. */
  tick: number;
  rexi: RexiState;
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  /** Cosmetic effects (particles, screen shake); never read by gameplay. */
  effects: EffectsState;
  stats: RunStats;
  /** True once Rexi's health reached zero; the Run no longer advances. */
  ended: boolean;
  /** Scripted spawns not yet released, sorted by tick. Null when spawning is automatic. */
  scriptedSpawns: ScriptedSpawn[] | null;
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
  /** Ticks until the current Weapon may fire again. */
  fireCooldown: number;
  /** Ticks since the last shot (capped), for recoil animation. */
  shotAge: number;
  weapon: WeaponId;
  /** Ticks left during which hits are ignored (0 = can be hurt). */
  invulnerableTicks: number;
  /** Ticks left of the hurt reaction (0 = not hurt). */
  hurtTicks: number;
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
  readonly damage: number;
  /** Ticks left before the projectile disappears. */
  ttl: number;
  /** Ticks since fired. */
  age: number;
}

export interface RunStats {
  score: number;
  enemiesDestroyed: number;
}
