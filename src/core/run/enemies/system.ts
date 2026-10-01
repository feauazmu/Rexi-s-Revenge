import { DT } from '../../constants';
import type { EnemyKind } from '../../ids';
import { center } from '../../math';
import type { RunContext } from '../context';
import { flashEnemy, shatterEnemy } from '../effects';
import { rexiDamageMultiplier } from '../power-ups/creatina';
import { enemyTimeScale } from '../power-ups/pre-entreno';
import type { EnemyState } from '../state';
import type { Tuning } from '../../tuning';
import type { EnemyPose } from '../../view';
import { enemyCatalog } from './index';
import { NEUTRAL_POSE } from './types';

export function spawnEnemy(ctx: RunContext, kind: EnemyKind, x: number, y: number): EnemyState {
  const { width, height, health } = ctx.tuning.enemies[kind];
  const enemy: EnemyState = {
    id: ctx.nextId(),
    kind,
    x,
    y,
    w: width,
    h: height,
    health,
    maxHealth: health,
    age: 0,
    hitFlashTick: null,
    memory: undefined,
  };
  enemy.memory = enemyCatalog[kind].init(enemy, ctx);
  ctx.state.enemies.push(enemy);
  ctx.emit({ type: 'enemy-spawned', enemyId: enemy.id, kind });
  return enemy;
}

/** What the Enemy's behavior shows the renderer (see `EnemyDef.pose`). */
export function poseOf(enemy: Readonly<EnemyState>, tuning: Tuning): EnemyPose {
  return enemyCatalog[enemy.kind].pose?.(enemy.memory, tuning) ?? NEUTRAL_POSE;
}

/**
 * Runs every Enemy's behavior for one tick, on Enemy time: a tick's worth of seconds, scaled
 * down while Pre-entreno slows Enemies. (`age` counts ticks, for animation.)
 */
export function stepEnemies(ctx: RunContext): void {
  const dt = DT * enemyTimeScale(ctx);
  for (const enemy of ctx.state.enemies) {
    enemy.age += 1;
    enemyCatalog[enemy.kind].update(enemy, enemy.memory, ctx, dt);
  }
}

/**
 * Applies a hit from Rexi (all damage to Enemies is his), scaled by his active Power-ups;
 * destroys the Enemy (score, events, removal) when its health runs out.
 */
export function damageEnemy(ctx: RunContext, enemy: EnemyState, baseDamage: number): void {
  if (enemy.health <= 0) return;
  const damage = baseDamage * rexiDamageMultiplier(ctx);
  enemy.health = Math.max(0, enemy.health - damage);
  ctx.emit({ type: 'enemy-hit', enemyId: enemy.id, kind: enemy.kind, damage });
  flashEnemy(ctx, enemy);
  if (enemy.health > 0) return;

  const { points } = ctx.tuning.enemies[enemy.kind];
  const { x, y } = center(enemy);
  ctx.state.stats.score += points;
  ctx.state.stats.enemiesDestroyed += 1;
  ctx.state.enemies = ctx.state.enemies.filter((e) => e !== enemy);
  shatterEnemy(ctx, enemy);
  ctx.emit({
    type: 'enemy-destroyed',
    enemyId: enemy.id,
    kind: enemy.kind,
    craft: enemyCatalog[enemy.kind].craft,
    points,
    x,
    y,
  });
}
