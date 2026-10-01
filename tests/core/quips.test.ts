/**
 * Quips through the Game core: when Rexi talks, the Hit-stop that freezes the Run, and the
 * Dialogue Box's typewriter and timing. Trigger and shuffle-bag edge cases are covered on the
 * Quip director itself (quip-director.test.ts).
 */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  QUIPS,
  type GameEvent,
  type QuipsTuning,
  type ScriptedSpawn,
  type TuningOverrides,
} from '../../src/core';
import { drive, eventsOf, runOf, weaponCrate, type Driver } from '../support/driver';

const SPOT = { x: 300, y: 150 };
/** Aim at the middle of a Maletín-cóptero parked at SPOT. */
const AIM = { x: SPOT.x + 12, y: SPOT.y + 9 };

const maletin = (atTick = 0): ScriptedSpawn => ({ kind: 'maletin-coptero', ...SPOT, atTick });

/** Dialogue pacing that gets out of the way, for tests about triggering. */
const SNAPPY: Partial<QuipsTuning> = {
  hitStop: 0,
  revealRate: 6000,
  clausePause: 0,
  sentencePause: 0,
  linger: 0,
  boxTransition: 0,
};

interface Setup {
  readonly quips?: Partial<QuipsTuning>;
  readonly alwaysQuip?: boolean;
  readonly spawns?: readonly ScriptedSpawn[];
}

/** A Run with one-shot Maletín-cópteros (health 1) at SPOT. */
function quipGame({ quips = {}, alwaysQuip, spawns = [maletin()] }: Setup = {}): Driver {
  const tuning: TuningOverrides = {
    quips,
    enemies: {
      'maletin-coptero': { health: 1, ...(alwaysQuip === undefined ? {} : { alwaysQuip }) },
    },
  };
  return drive({ seed: 7, overrides: { tuning, spawns } });
}

/** Fires at SPOT one tick at a time until an Enemy is destroyed; returns that tick's events. */
function killOne(game: Driver): GameEvent[] {
  for (let i = 0; i < 600; i++) {
    const events = game.ticks(1, { aim: AIM, fire: true });
    if (eventsOf(events, 'enemy-destroyed').length > 0) return events;
  }
  throw new Error('No Enemy was destroyed');
}

/** Advances until `done` holds for the view, returning how many ticks it took. */
function ticksUntil(game: Driver, done: () => boolean, limit = 2000): number {
  for (let i = 1; i <= limit; i++) {
    game.ticks(1);
    if (done()) return i;
  }
  throw new Error('Condition never held');
}

const dialogueOf = (game: Driver) => runOf(game.view).dialogue;
const legalIds = new Set(QUIPS.filter((q) => q.theme === 'legal').map((q) => q.id));

describe('Quip triggering', () => {
  it('destroying Lawyer Craft can start a legal Quip in the Dialogue Box', () => {
    const game = quipGame({ quips: { chance: 1 } });
    const events = killOne(game);

    const [started] = eventsOf(events, 'quip-started');
    expect(started?.theme).toBe('legal');
    expect(legalIds.has(started?.quipId ?? '')).toBe(true);
    expect(started?.enemyId).toBe(eventsOf(events, 'enemy-destroyed')[0]?.enemyId);

    const dialogue = dialogueOf(game);
    expect(dialogue?.quipId).toBe(started?.quipId);
    expect(dialogue?.text).toBe(QUIPS.find((q) => q.id === started?.quipId)?.text);
    expect(dialogue?.revealed).toBe(0);
  });

  it('never triggers when the chance is 0', () => {
    const game = quipGame({ quips: { chance: 0 }, spawns: [1, 2, 3, 4, 5].map(() => maletin()) });
    const events = game.holdFireToward(AIM, 3);
    expect(eventsOf(events, 'enemy-destroyed')).toHaveLength(5);
    expect(eventsOf(events, 'quip-started')).toHaveLength(0);
    expect(dialogueOf(game)).toBeNull();
  });

  it('does not start a second Quip while the Dialogue Box is showing', () => {
    const game = quipGame({ quips: { chance: 1, cooldown: 0 }, spawns: [maletin(), maletin()] });
    const events = game.holdFireToward(AIM, 2);
    expect(eventsOf(events, 'enemy-destroyed')).toHaveLength(2);
    expect(eventsOf(events, 'quip-started')).toHaveLength(1);
  });

  it('waits for the cooldown after a Dialogue Box closes', () => {
    const spawns = [maletin(0), maletin(60)];
    const quiet = quipGame({ quips: { ...SNAPPY, chance: 1, cooldown: 4 }, spawns });
    const ready = quipGame({ quips: { ...SNAPPY, chance: 1, cooldown: 0.2 }, spawns });

    for (const game of [quiet, ready]) game.holdFireToward(AIM, 3);

    expect(eventsOf(quiet.log, 'enemy-destroyed')).toHaveLength(2);
    expect(eventsOf(quiet.log, 'quip-started')).toHaveLength(1);
    expect(eventsOf(ready.log, 'enemy-destroyed')).toHaveLength(2);
    expect(eventsOf(ready.log, 'quip-started')).toHaveLength(2);
  });

  it('always triggers for an Enemy flagged always-Quip, replacing the showing box', () => {
    const game = quipGame({
      quips: { chance: 0, cooldown: 60, hitStop: 0 },
      alwaysQuip: true,
      spawns: [maletin(), maletin(), maletin()],
    });
    const events = game.holdFireToward(AIM, 1);

    const started = eventsOf(events, 'quip-started');
    expect(eventsOf(events, 'enemy-destroyed')).toHaveLength(3);
    expect(started).toHaveLength(3);
    expect(new Set(started.map((s) => s.quipId)).size).toBe(3);
    expect(dialogueOf(game)?.quipId).toBe(started[2]?.quipId);
    // The box was never closed in between: it was replaced.
    expect(eventsOf(events, 'dialogue-closed')).toHaveLength(0);
  });

  it('is off for the Maletín-cóptero by default (the flag lives in the Enemy catalog)', () => {
    expect(defaultTuning.enemies['maletin-coptero'].alwaysQuip).toBe(false);
  });

  it('does not change gameplay randomness: talking or not, Enemies behave the same', () => {
    const spawns = [maletin(), { kind: 'maletin-coptero', x: 100, y: 40 } as const];
    const talk = quipGame({ quips: { ...SNAPPY, chance: 1 }, spawns });
    const silent = quipGame({ quips: { ...SNAPPY, chance: 0 }, spawns });
    for (const game of [talk, silent]) game.holdFireToward(AIM, 2);

    expect(eventsOf(talk.log, 'quip-started')).toHaveLength(1);
    expect(runOf(talk.view).enemies).toEqual(runOf(silent.view).enemies);
  });
});

describe('Hit-stop', () => {
  const hitStopTicks = Math.round(defaultTuning.quips.hitStop * 60);

  it('freezes the Run for the tuned time while the Dialogue Box keeps animating', () => {
    const game = quipGame({ quips: { chance: 1 } });
    const [started] = eventsOf(killOne(game), 'quip-started');
    expect(started?.hitStopTicks).toBe(hitStopTicks);

    const before = runOf(game.view);
    const gameTick = game.view.tick;
    const frozen = game.ticks(hitStopTicks, { move: 1, aim: AIM, fire: true });

    const during = runOf(game.view);
    expect(game.view.tick).toBe(gameTick + hitStopTicks);
    expect(during.tick).toBe(before.tick);
    expect(during.rexi).toEqual(before.rexi);
    expect(during.projectiles).toEqual(before.projectiles);
    expect(eventsOf(frozen, 'weapon-fired')).toHaveLength(0);
    expect(during.hitStop).toBe(0);
    // The box slid in and typed during the freeze.
    expect(during.dialogue?.openness).toBe(1);
    expect(during.dialogue?.revealed).toBeGreaterThan(5);
    expect(eventsOf(frozen, 'quip-character').length).toBeGreaterThan(5);

    game.ticks(1, { move: 1, aim: AIM });
    const after = runOf(game.view);
    expect(after.tick).toBe(before.tick + 1);
    expect(after.rexi.x).toBeGreaterThan(before.rexi.x);
  });

  it('counts down in the view while it lasts', () => {
    const game = quipGame({ quips: { chance: 1 } });
    killOne(game);
    expect(runOf(game.view).hitStop).toBe(hitStopTicks);
    game.ticks(10);
    expect(runOf(game.view).hitStop).toBe(hitStopTicks - 10);
  });

  it('is excluded from the Run clock that drives the ramp and the time survived', () => {
    const talk = quipGame({ quips: { chance: 1 } });
    const silent = quipGame({ quips: { chance: 0 } });
    // Game ticks spent on the Title before Run tick 0.
    const [talkStart, silentStart] = [talk.view.tick, silent.view.tick];
    for (const game of [talk, silent]) {
      killOne(game);
      game.seconds(5);
    }
    expect(silent.view.tick).toBe(talk.view.tick);
    expect(runOf(silent.view).tick).toBe(silent.view.tick - silentStart);
    expect(runOf(talk.view).tick).toBe(talk.view.tick - talkStart - hitStopTicks);
    expect(runOf(talk.view).stats.ticksSurvived).toBe(runOf(talk.view).tick);
  });

  it('keeps a jump tapped during the freeze for the first live tick', () => {
    const game = quipGame({ quips: { chance: 1 } });
    killOne(game);
    game.ticks(5);
    game.ticks(1, { jump: true });
    game.ticks(hitStopTicks - 6);
    expect(runOf(game.view).rexi.grounded).toBe(true);

    game.ticks(1);
    expect(runOf(game.view).rexi.grounded).toBe(false);
    expect(runOf(game.view).rexi.vy).toBeLessThan(0);
  });
});

describe('Hit-stop and the rest of the Run', () => {
  const hitStopTicks = Math.round(defaultTuning.quips.hitStop * 60);

  it('freezes Crate timers too', () => {
    const game = quipGame({
      quips: { chance: 1 },
      spawns: [weaponCrate('lluvia-de-sellos', 420), maletin(120)],
    });
    ticksUntil(game, () => runOf(game.view).crates[0]?.landed === true);
    killOne(game);
    const before = runOf(game.view).crates;
    game.ticks(hitStopTicks);
    expect(runOf(game.view).crates).toEqual(before);
    game.ticks(1);
    expect(runOf(game.view).crates[0]?.ticksLeft).toBe((before[0]?.ticksLeft ?? 0) - 1);
  });

  it('pausing during a Hit-stop freezes the Run and the Dialogue Box, then resumes cleanly', () => {
    const paused = quipGame({ quips: { chance: 1 } });
    const straight = quipGame({ quips: { chance: 1 } });
    for (const game of [paused, straight]) {
      killOne(game);
      game.ticks(5);
    }

    paused.pause();
    expect(paused.view.screen).toBe('paused');
    const frozen = runOf(paused.view);
    const events = paused.ticks(121, { move: 1, aim: AIM, fire: true });
    expect(runOf(paused.view)).toEqual(frozen);
    expect(eventsOf(events, 'quip-character')).toHaveLength(0);
    expect(frozen.hitStop).toBeGreaterThan(0);

    paused.ticks(1, { pause: true });
    expect(paused.view.screen).toBe('run');
    // From here the paused game plays out exactly like one that was never paused.
    paused.ticks(hitStopTicks + 120);
    straight.ticks(hitStopTicks + 120);
    expect(runOf(paused.view)).toEqual(runOf(straight.view));
  });

  it('a Run that ends while the Dialogue Box shows still ends and returns to the Title', () => {
    const tuning: TuningOverrides = {
      quips: { chance: 1, hitStop: 0, revealRate: 1 },
      enemies: { 'maletin-coptero': { health: 1 } },
      rexi: { maxHealth: 1, spawnX: SPOT.x },
    };
    const game = drive({
      seed: 7,
      overrides: {
        tuning,
        spawns: [maletin(), { kind: 'maletin-coptero', x: 60, y: 40, atTick: 1 }],
      },
    });
    killOne(game);
    expect(dialogueOf(game)).not.toBeNull();

    const events = game.seconds(30);
    const [ended] = eventsOf(events, 'run-ended');
    expect(ended).toBeDefined();
    expect(eventsOf(events, 'run-ended')).toHaveLength(1);
    expect(game.view.screen).toBe('title');
  });
});

describe('Dialogue Box', () => {
  it('slides in over the tuned transition before typing', () => {
    const game = quipGame({ quips: { chance: 1, boxTransition: 4 / 60 } });
    killOne(game);
    const openness: number[] = [dialogueOf(game)?.openness ?? -1];
    for (let i = 0; i < 4; i++) {
      game.ticks(1);
      openness.push(dialogueOf(game)?.openness ?? -1);
    }
    expect(openness).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(dialogueOf(game)?.revealed).toBe(0);
  });

  it('reveals the Quip at the tuned rate, one blip event per visible character', () => {
    const game = quipGame({
      quips: { chance: 1, revealRate: 40, clausePause: 0, sentencePause: 0, boxTransition: 0 },
    });
    killOne(game);
    const typed = game.seconds(1);

    const dialogue = dialogueOf(game);
    expect(dialogue?.revealed).toBeGreaterThanOrEqual(39);
    expect(dialogue?.revealed).toBeLessThanOrEqual(40);

    const shown = (dialogue?.text ?? '').slice(0, dialogue?.revealed);
    const blips = eventsOf(typed, 'quip-character');
    expect(blips.map((b) => b.char).join('')).toBe(shown.replaceAll(' ', ''));
    expect(blips.every((b) => b.quipId === dialogue?.quipId)).toBe(true);
    expect(blips.map((b) => shown[b.index])).toEqual(blips.map((b) => b.char));
  });

  it('lingers for the tuned time after the full reveal, then closes by itself', () => {
    const { linger, boxTransition } = defaultTuning.quips;
    const game = quipGame({ quips: { chance: 1 } });
    killOne(game);

    ticksUntil(game, () => dialogueOf(game)?.complete === true);
    const quipId = dialogueOf(game)?.quipId;
    const start = game.log.length;
    const lingered = ticksUntil(game, () => dialogueOf(game) === null);

    const expected = Math.round(linger * 60) + Math.round(boxTransition * 60);
    expect(lingered).toBe(expected);
    expect(eventsOf(game.log.slice(start), 'dialogue-closed')).toEqual([
      { type: 'dialogue-closed', quipId },
    ]);
  });

  it('never blocks play: Rexi runs and fires while Rexi talks', () => {
    const game = quipGame({ quips: { chance: 1 } });
    killOne(game);
    game.seconds(0.6);
    const x = runOf(game.view).rexi.x;
    const events = game.seconds(0.5, { move: -1, aim: { x: 40, y: 40 }, fire: true });
    expect(dialogueOf(game)).not.toBeNull();
    expect(runOf(game.view).rexi.x).toBeLessThan(x);
    expect(eventsOf(events, 'weapon-fired').length).toBeGreaterThan(0);
  });
});
