import type { ScriptedSpawn } from '../options';
import type { RunContext } from './context';
import { stepDirector } from './director';
import { spawnEnemy } from './enemies/system';

/**
 * Releases Enemies for the current Run tick: the scripted spawns if the Game was given any
 * (they replace the Director entirely), otherwise the spawn Director's.
 */
export function stepSpawning(ctx: RunContext): void {
  const { state } = ctx;
  if (state.scriptedSpawns === null) {
    stepDirector(ctx);
    return;
  }
  let next = state.scriptedSpawns[0];
  while (next && (next.atTick ?? 0) <= state.tick) {
    state.scriptedSpawns.shift();
    spawnEnemy(ctx, next.kind, next.x, next.y);
    next = state.scriptedSpawns[0];
  }
}

/** Copies and orders scripted spawns by tick (stable for equal ticks). */
export function sortSpawns(spawns: readonly ScriptedSpawn[]): ScriptedSpawn[] {
  return [...spawns].sort((a, b) => (a.atTick ?? 0) - (b.atTick ?? 0));
}
