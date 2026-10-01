import type { ScriptedSpawn } from '../options';
import type { RunContext } from './context';
import { spawnCrate } from './crates/system';
import { spawnEnemy } from './enemies/system';

/**
 * Releases Enemies (and scripted Crates) for the current Run tick: scripted spawns if given,
 * otherwise automatic. Automatic Crate drops run in the Crate system.
 */
export function stepSpawning(ctx: RunContext): void {
  const { state } = ctx;
  if (state.scriptedSpawns === null) {
    stepAutomaticSpawning(ctx);
    return;
  }
  let next = state.scriptedSpawns[0];
  while (next && (next.atTick ?? 0) <= state.tick) {
    state.scriptedSpawns.shift();
    if (next.kind === 'crate') spawnCrate(ctx, next.contents, next.x, next.y);
    else spawnEnemy(ctx, next.kind, next.x, next.y);
    next = state.scriptedSpawns[0];
  }
}

/**
 * Automatic spawning used when no scripted spawns are given. Placeholder until the spawn
 * Director (time-based ramp, ticket #11) replaces it: a single hovering Maletín-cóptero.
 */
function stepAutomaticSpawning(ctx: RunContext): void {
  if (ctx.state.tick === 0) spawnEnemy(ctx, 'maletin-coptero', 320, 70);
}

/** Copies and orders scripted spawns by tick (stable for equal ticks). */
export function sortSpawns(spawns: readonly ScriptedSpawn[]): ScriptedSpawn[] {
  return [...spawns].sort((a, b) => (a.atTick ?? 0) - (b.atTick ?? 0));
}
