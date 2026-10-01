/**
 * Test driver for the Game core. Scenarios are built only from public options (seed, tuning
 * overrides, scripted spawns) and input frames, never by touching internals.
 */
import {
  createGame,
  defaultTuning,
  inputFrame,
  TICKS_PER_SECOND,
  type GameEvent,
  type GameEventOf,
  type GameEventType,
  type GameOptions,
  type GameView,
  type InputFramePatch,
  type ScriptedCrateSpawn,
  type SpecialWeaponId,
  type Vec2,
} from '../../src/core';

export interface Driver {
  readonly view: GameView;
  /** Every event emitted since the driver was created, in order. */
  readonly log: readonly GameEvent[];
  /** Advances `ticks` ticks holding the given input; returns the events of those ticks. */
  ticks(count: number, input?: InputFramePatch): GameEvent[];
  /** Advances `seconds` of simulated time holding the given input. */
  seconds(seconds: number, input?: InputFramePatch): GameEvent[];
  /** Holds fire aimed at `target` for `seconds` (plus any extra input). */
  holdFireToward(target: Vec2, seconds: number, input?: InputFramePatch): GameEvent[];
}

export function drive(options: Partial<GameOptions> = {}): Driver {
  const game = createGame({ seed: 1, ...options });
  const log: GameEvent[] = [];

  const ticks = (count: number, input: InputFramePatch = {}): GameEvent[] => {
    const frame = inputFrame(input);
    const emitted: GameEvent[] = [];
    for (let i = 0; i < count; i++) emitted.push(...game.tick(frame));
    log.push(...emitted);
    return emitted;
  };

  const seconds = (s: number, input?: InputFramePatch): GameEvent[] =>
    ticks(Math.round(s * TICKS_PER_SECOND), input);

  return {
    get view() {
      return game.view;
    },
    log,
    ticks,
    seconds,
    holdFireToward: (target, s, input = {}) => seconds(s, { ...input, aim: target, fire: true }),
  };
}

/** A game with no Enemies unless spawns are given: the default for focused tests. */
export function driveEmptyArena(options: Partial<GameOptions> = {}): Driver {
  return drive({ ...options, overrides: { spawns: [], ...options.overrides } });
}

export function eventsOf<T extends GameEventType>(
  events: readonly GameEvent[],
  type: T,
): GameEventOf<T>[] {
  return events.filter((e): e is GameEventOf<T> => e.type === type);
}

/** A scripted Crate carrying ammo for `weapon`, dropped at `x` (`y` default: above the top). */
export function weaponCrate(
  weapon: SpecialWeaponId,
  x: number,
  options: { readonly y?: number; readonly atTick?: number } = {},
): ScriptedCrateSpawn {
  return { kind: 'crate', contents: { kind: 'weapon', weapon }, x, ...options };
}

/** A Crate position overlapping Rexi at his spawn point: it is picked up on the first tick. */
export const ON_REXI = {
  x: defaultTuning.rexi.spawnX,
  y: defaultTuning.arena.groundY - defaultTuning.rexi.height - 4,
} as const;

/** The Run view, asserting that a Run exists. */
export function runOf(view: GameView): NonNullable<GameView['run']> {
  if (!view.run) throw new Error(`Expected a Run, but the screen is "${view.screen}"`);
  return view.run;
}
