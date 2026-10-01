import { DT } from '../../constants';
import type { EnemyKind } from '../../ids';
import { center } from '../../math';
import type { RunContext } from '../context';
import { flashEnemy, shatterEnemy } from '../effects';
import { rexiDamageMultiplier } from '../power-ups/creatina';
import type { EnemyState } from '../state';
import { enemyCatalog } from './index';

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

/** Runs every Enemy's behavior for one tick. */
export function stepEnemies(ctx: RunContext): void {
  for (const enemy of ctx.state.enemies) {
    enemy.age += 1;
    enemyCatalog[enemy.kind].update(enemy, enemy.memory, ctx, DT);
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
