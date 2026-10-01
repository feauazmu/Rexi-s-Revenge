import { SCREEN_WIDTH } from '../../constants';
import type { Box, Vec2 } from '../../math';
import type { RunContext } from '../context';
import { traceBeam } from '../effects';
import { damageEnemy } from '../enemies/system';
import type { EnemyState } from '../state';
import type { WeaponDef } from './types';

/**
 * Sentencia Firme: an instant beam from the muzzle to the edge of the screen (or the ground)
 * that damages every Enemy along its line in the tick it is fired, nearest first.
 */
export const sentenciaFirme: WeaponDef = {
  id: 'sentencia-firme',
  fire({ origin, direction }, ctx) {
    const t = ctx.tuning.weapons['sentencia-firme'];
    const length = beamLength(ctx, origin, direction);
    const end = { x: origin.x + direction.x * length, y: origin.y + direction.y * length };

    const struck: { readonly enemy: EnemyState; readonly at: number }[] = [];
    for (const enemy of ctx.state.enemies) {
      if (enemy.health <= 0) continue;
      const at = rayEntry(origin, direction, length, grown(enemy, t.beamWidth / 2));
      if (at !== null) struck.push({ enemy, at });
    }
    struck.sort((a, b) => a.at - b.at);
    for (const { enemy } of struck) damageEnemy(ctx, enemy, t.damage);

    traceBeam(ctx, origin, end);
  },
};

/** Distance along the ray until it leaves the screen sideways or upward, or meets the ground. */
function beamLength(ctx: RunContext, origin: Vec2, d: Vec2): number {
  const groundY = ctx.tuning.arena.groundY;
  const toSide = d.x > 0 ? (SCREEN_WIDTH - origin.x) / d.x : d.x < 0 ? -origin.x / d.x : Infinity;
  const toTopOrGround = d.y > 0 ? (groundY - origin.y) / d.y : d.y < 0 ? -origin.y / d.y : Infinity;
  return Math.max(0, Math.min(toSide, toTopOrGround));
}

function grown(box: Readonly<Box>, by: number): Box {
  return { x: box.x - by, y: box.y - by, w: box.w + 2 * by, h: box.h + 2 * by };
}

/**
 * Distance along the ray `origin + s·d` (0 ≤ s ≤ length) where it first touches `box`, or
 * null if it misses (slab method).
 */
function rayEntry(origin: Vec2, d: Vec2, length: number, box: Readonly<Box>): number | null {
  let enter = 0;
  let exit = length;
  const slabs = [
    [origin.x, d.x, box.x, box.x + box.w],
    [origin.y, d.y, box.y, box.y + box.h],
  ] as const;
  for (const [o, dir, min, max] of slabs) {
    if (Math.abs(dir) < 1e-12) {
      if (o < min || o > max) return null;
      continue;
    }
    const a = (min - o) / dir;
    const b = (max - o) / dir;
    enter = Math.max(enter, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (enter > exit) return null;
  }
  return enter;
}
