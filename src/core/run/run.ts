import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../constants';
import type { GameEvent } from '../events';
import type { InputFrame } from '../input';
import type { ScriptedSpawn } from '../options';
import { createQuipDirector, type QuipDirector } from '../quips/director';
import type { Rng } from '../rng';
import type { Tuning } from '../tuning';
import type { RunView } from '../view';
import type { RunContext } from './context';
import { createDirector } from './director';
import { createEffects, isHitFlashing, stepEffects, viewEffects } from './effects';
import { firstCrateDrop, stepCrates, viewCrate } from './crates/system';
import { enemyCatalog } from './enemies/index';
import { stepEnemies } from './enemies/system';
import { viewPowerUps } from './power-ups/active';
import { stepPowerUps } from './power-ups/system';
import { stepProjectiles } from './projectiles';
import { aimDirectionOf, createRexi, muzzleOf, shoulderOf, stepRexi } from './rexi';
import { advanceRampClock } from './ramp';
import { sortSpawns, stepSpawning } from './spawning';
import type { RunState } from './state';
import { viewInventory } from './weapons/inventory';
import { stepWeapons } from './weapons/system';

export interface RunDeps {
  readonly tuning: Tuning;
  readonly rng: Rng;
  /** Seed of the cosmetic effects' own random stream (kept apart from `rng`). */
  readonly effectsSeed: number;
  /**
   * Separate stream for Quip rolls and shuffle-bags, so whether Rexi talks never changes the
   * gameplay randomness (spawns, Enemy behavior) of a seeded Run.
   */
  readonly quipRng: Rng;
  readonly nextId: () => number;
  /** Scripted spawns, or null for automatic spawning. */
  readonly spawns: readonly ScriptedSpawn[] | null;
}

/** One Run: owns its simulation state and advances it one tick at a time. */
export interface Run {
  /** Advances the simulation one tick and returns the events it produced. */
  step(input: InputFrame): GameEvent[];
  view(): RunView;
  /** True once Rexi has been defeated; `step` then does nothing. */
  readonly ended: boolean;
}

export function createRun(deps: RunDeps): Run {
  const state: RunState = {
    tick: 0,
    rampTicks: 0,
    rexi: createRexi(deps.tuning),
    enemies: [],
    projectiles: [],
    effects: createEffects(deps.effectsSeed),
    crates: [],
    stats: { score: 0, enemiesDestroyed: 0 },
    ended: false,
    scriptedSpawns: deps.spawns === null ? null : sortSpawns(deps.spawns),
    nextCrateDrop: deps.spawns === null ? firstCrateDrop(deps.tuning) : null,
    director: createDirector(deps.tuning),
  };
  let events: GameEvent[] = [];
  const ctx: RunContext = {
    tuning: deps.tuning,
    rng: deps.rng,
    state,
    emit: (event) => events.push(event),
    nextId: deps.nextId,
  };

  const quips = createQuipDirector({
    tuning: deps.tuning.quips,
    rng: deps.quipRng,
    emit: (event) => {
      ctx.emit(event);
    },
  });
  const frozenInput = createFrozenInputBuffer();

  /**
   * One tick of Run simulation: the single notion of "the Run is advancing". Anything that
   * freezes the Run (pause, Hit-stop) skips this whole call, so effects, Crate timers, the
   * Director and the ramp clock all stay where they were.
   */
  const simulate = (input: InputFrame): void => {
    stepEffects(ctx);
    stepPowerUps(ctx);
    stepSpawning(ctx);
    stepRexi(ctx, input);
    stepCrates(ctx);
    stepWeapons(ctx, input);
    stepEnemies(ctx);
    stepProjectiles(ctx);
    state.tick += 1;
    advanceRampClock(state);
  };

  return {
    step(input) {
      events = [];
      if (state.ended) return events;
      // The Dialogue Box runs on every tick; the simulation sits out a Hit-stop.
      if (quips.advance()) {
        frozenInput.hold(input);
        return events;
      }
      simulate(frozenInput.release(input));
      if (state.rexi.health <= 0) {
        // No Quip (and no Hit-stop) for kills in the fatal tick: the Run is over.
        endRun(ctx);
        return events;
      }
      for (const event of [...events]) {
        if (event.type !== 'enemy-destroyed') continue;
        quips.enemyDestroyed({
          enemyId: event.enemyId,
          craft: event.craft,
          alwaysQuip: deps.tuning.enemies[event.kind].alwaysQuip ?? false,
        });
      }
      return events;
    },
    view: () => viewRun(state, deps.tuning, quips),
    get ended() {
      return state.ended;
    },
  };
}

function endRun(ctx: RunContext): void {
  const { state } = ctx;
  state.ended = true;
  ctx.emit({
    type: 'run-ended',
    score: state.stats.score,
    enemiesDestroyed: state.stats.enemiesDestroyed,
    ticksSurvived: state.tick,
  });
}

/**
 * Presses made while the Run is frozen (jump, Weapon switches) are kept and applied on the
 * first live tick, so a Hit-stop never swallows a tap.
 */
function createFrozenInputBuffer(): {
  hold(input: InputFrame): void;
  release(input: InputFrame): InputFrame;
} {
  let pending: Pick<InputFrame, 'jump' | 'weaponNext' | 'weaponPrevious' | 'weaponSlot'> | null =
    null;
  return {
    hold(input) {
      pending = {
        jump: (pending?.jump ?? false) || input.jump,
        weaponNext: (pending?.weaponNext ?? false) || input.weaponNext,
        weaponPrevious: (pending?.weaponPrevious ?? false) || input.weaponPrevious,
        weaponSlot: input.weaponSlot ?? pending?.weaponSlot ?? null,
      };
    },
    release(input) {
      if (!pending) return input;
      const held = pending;
      pending = null;
      return {
        ...input,
        jump: input.jump || held.jump,
        weaponNext: input.weaponNext || held.weaponNext,
        weaponPrevious: input.weaponPrevious || held.weaponPrevious,
        weaponSlot: input.weaponSlot ?? held.weaponSlot,
      };
    },
  };
}

function viewRun(state: Readonly<RunState>, tuning: Tuning, quips: QuipDirector): RunView {
  const { rexi } = state;
  return {
    tick: state.tick,
    rampTicks: state.rampTicks,
    arena: {
      width: SCREEN_WIDTH,
      height: SCREEN_HEIGHT,
      groundY: tuning.arena.groundY,
      platforms: tuning.arena.platforms,
    },
    rexi: {
      x: rexi.x,
      y: rexi.y,
      w: rexi.w,
      h: rexi.h,
      vx: rexi.vx,
      vy: rexi.vy,
      grounded: rexi.grounded,
      flying: rexi.flying,
      health: rexi.health,
      maxHealth: rexi.maxHealth,
      facing: rexi.facing,
      aim: rexi.aim,
      shoulder: shoulderOf(rexi, tuning),
      muzzle: muzzleOf(rexi, tuning),
      aimDirection: aimDirectionOf(rexi, tuning),
      shotAge: rexi.shotAge,
      hurtTicks: rexi.hurtTicks,
      invulnerableTicks: rexi.invulnerableTicks,
      ...viewInventory(rexi.inventory),
      powerUps: viewPowerUps(rexi),
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
    crates: state.crates.map((crate) => viewCrate(crate, tuning)),
    stats: {
      score: state.stats.score,
      enemiesDestroyed: state.stats.enemiesDestroyed,
      ticksSurvived: state.tick,
    },
    ended: state.ended,
    hitStop: quips.hitStop,
    dialogue: quips.view(),
  };
}
