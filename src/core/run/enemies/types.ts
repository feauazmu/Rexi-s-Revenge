import type { Craft, EnemyKind } from '../../ids';
import type { EnemyPose } from '../../view';
import type { RunContext } from '../context';
import type { EnemyState } from '../state';

/**
 * Behavior of one Enemy kind. Numbers (health, size, speeds, points) live in the tuning
 * catalog under `tuning.enemies[kind]`; this object holds only logic.
 *
 * `M` is the kind's private behavior memory (timers, targets, phase), created at spawn.
 */
export interface EnemyDef<M = unknown> {
  readonly kind: EnemyKind;
  readonly craft: Craft;
  /** Creates this Enemy's behavior memory when it spawns. */
  init(enemy: Readonly<EnemyState>, ctx: RunContext): M;
  /**
   * Advances behavior (movement, firing) by `dt` seconds. Always use `dt`, never the global
   * timestep: Power-ups such as Pre-entreno scale Enemy time.
   */
  update(enemy: EnemyState, memory: M, ctx: RunContext, dt: number): void;
  /** What the renderer should show of the behavior (facing, attack phase). Optional. */
  pose?(memory: M): EnemyPose;
}

/** The pose of an Enemy whose behavior does not report one. */
export const NEUTRAL_POSE: EnemyPose = { facing: null, attack: 'idle' };

/** Declares an Enemy behavior with its memory type inferred. */
export function defineEnemy<M>(def: EnemyDef<M>): EnemyDef<M> {
  return def;
}
