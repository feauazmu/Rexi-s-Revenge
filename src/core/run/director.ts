/**
 * The spawn Director: sends Enemies continuously, escalating with the ramp clock as the ramp
 * table in `tuning.director` says. Scripted spawns replace it (see `stepSpawning`).
 */
import { SCREEN_WIDTH, secondsToTicks } from '../constants';
import { ENEMY_KINDS, type EnemyKind } from '../ids';
import type { RosterEntry, Tuning } from '../tuning';
import type { RunContext } from './context';
import { spawnEnemy } from './enemies/system';
import { rampAt } from '../tuning';
import { rampSeconds } from './ramp';

/** The Director's own state inside a Run. */
export interface DirectorState {
  /** Ramp-clock tick at which the next spawn is due. */
  nextSpawnTick: number;
}

export function createDirector(tuning: Tuning): DirectorState {
  return { nextSpawnTick: secondsToTicks(tuning.director.firstSpawnDelay) };
}

/**
 * Releases Director spawns for this tick: when a spawn is due and the Arena is under the
 * on-screen cap, sends one Enemy picked by weight from the kinds the roster allows now.
 * A due spawn waits while no kind is allowed yet, and is skipped while at the cap.
 */
export function stepDirector(ctx: RunContext): void {
  const { state, tuning } = ctx;
  const { director } = state;
  if (state.rampTicks < director.nextSpawnTick) return;

  const seconds = rampSeconds(ctx);
  const ramp = rampAt(tuning.director, seconds);
  if (state.enemies.length < ramp.onScreenCap) {
    const kinds = allowedKinds(ctx, seconds);
    if (kinds.length === 0) return;
    const kind = ctx.rng.weighted(kinds);
    const entry = tuning.director.roster[kind];
    const { x, y } = entryPoint(ctx, kind, entry);
    spawnEnemy(ctx, kind, x, y);
  }
  director.nextSpawnTick = state.rampTicks + Math.max(1, secondsToTicks(ramp.spawnInterval));
}

function allowedKinds(ctx: RunContext, seconds: number): [EnemyKind, number][] {
  const { roster } = ctx.tuning.director;
  const onScreen = new Map<EnemyKind, number>();
  for (const { kind } of ctx.state.enemies) onScreen.set(kind, (onScreen.get(kind) ?? 0) + 1);
  return ENEMY_KINDS.flatMap((kind): [EnemyKind, number][] => {
    const entry: RosterEntry = roster[kind];
    if (entry.from > seconds || entry.weight <= 0) return [];
    if (entry.maxOnScreen !== null && (onScreen.get(kind) ?? 0) >= entry.maxOnScreen) return [];
    return [[kind, entry.weight]];
  });
}

/** Top-left of a new Enemy just outside the chosen Arena edge. */
function entryPoint(ctx: RunContext, kind: EnemyKind, entry: RosterEntry) {
  const { width, height } = ctx.tuning.enemies[kind];
  const edge = ctx.rng.pick(entry.edges);
  if (edge === 'top') return { x: ctx.rng.range(0, SCREEN_WIDTH - width), y: -height };
  const y = ctx.rng.range(entry.minY, entry.maxY);
  return { x: edge === 'left' ? -width : SCREEN_WIDTH, y };
}
