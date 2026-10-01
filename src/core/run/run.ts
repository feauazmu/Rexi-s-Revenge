import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants';
import type { GameEvent } from '../events';
import type { InputFrame } from '../input';
import type { ScriptedSpawn } from '../options';
import type { Rng } from '../rng';
import type { Tuning } from '../tuning';
import type { RunView } from '../view';
import type { RunContext } from './context';
import { createEffects, isHitFlashing, stepEffects, viewEffects } from './effects';
import { enemyCatalog } from './enemies/index';
import { stepEnemies } from './enemies/system';
import { stepProjectiles } from './projectiles';
import { aimDirectionOf, createRexi, muzzleOf, stepRexi } from './rexi';
import { sortSpawns, stepSpawning } from './spawning';
import type { RunState } from './state';
import { stepWeapons } from './weapons/system';

export interface RunDeps {
  readonly tuning: Tuning;
  readonly rng: Rng;
  /** Seed of the cosmetic effects' own random stream (kept apart from `rng`). */
  readonly effectsSeed: number;
  readonly nextId: () => number;
  /** Scripted spawns, or null for automatic spawning. */
  readonly spawns: readonly ScriptedSpawn[] | null;
}

/** One Run: owns its simulation state and advances it one tick at a time. */
export interface Run {
  /** Advances the simulation one tick and returns the events it produced. */
  step(input: InputFrame): GameEvent[];
  view(): RunView;
}

export function createRun(deps: RunDeps): Run {
  const state: RunState = {
    tick: 0,
    rexi: createRexi(deps.tuning),
    enemies: [],
    projectiles: [],
    effects: createEffects(deps.effectsSeed),
    stats: { score: 0, enemiesDestroyed: 0 },
    scriptedSpawns: deps.spawns === null ? null : sortSpawns(deps.spawns),
  };
  let events: GameEvent[] = [];
  const ctx: RunContext = {
    tuning: deps.tuning,
    rng: deps.rng,
    state,
    emit: (event) => events.push(event),
    nextId: deps.nextId,
  };

  return {
    step(input) {
      events = [];
      stepEffects(ctx);
      stepSpawning(ctx);
      stepRexi(ctx, input);
      stepWeapons(ctx, input);
      stepEnemies(ctx);
      stepProjectiles(ctx);
      state.tick += 1;
      return events;
    },
    view: () => viewRun(state, deps.tuning),
  };
}

function viewRun(state: Readonly<RunState>, tuning: Tuning): RunView {
  const { rexi } = state;
  return {
    tick: state.tick,
    arena: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, groundY: tuning.arena.groundY },
    rexi: {
      x: rexi.x,
      y: rexi.y,
      w: rexi.w,
      h: rexi.h,
      vx: rexi.vx,
      vy: rexi.vy,
      grounded: rexi.grounded,
      facing: rexi.facing,
      aim: rexi.aim,
      muzzle: muzzleOf(rexi, tuning),
      aimDirection: aimDirectionOf(rexi, tuning),
      weapon: { id: rexi.weapon, ammo: null },
    },
    enemies: state.enemies.map((e) => ({
      id: e.id,
      kind: e.kind,
      craft: enemyCatalog[e.kind].craft,
      x: e.x,
      y: e.y,
      w: e.w,
      h: e.h,
      health: e.health,
      maxHealth: e.maxHealth,
      age: e.age,
      hitFlash: isHitFlashing(e, state.tick, tuning),
    })),
    projectiles: state.projectiles.map((p) => ({
      id: p.id,
      kind: p.kind,
      owner: p.owner,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      vx: p.vx,
      vy: p.vy,
      age: p.age,
    })),
    effects: viewEffects(state.effects, tuning, state.tick),
    stats: {
      score: state.stats.score,
      enemiesDestroyed: state.stats.enemiesDestroyed,
      ticksSurvived: state.tick,
    },
  };
}
