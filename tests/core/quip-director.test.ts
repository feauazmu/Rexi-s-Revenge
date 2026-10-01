/**
 * The Quip director on its own: trigger rules, themes and shuffle-bags, and typewriter pacing,
 * including Crafts that no Enemy uses yet.
 */
import { describe, expect, it } from 'vitest';
import {
  createQuipDirector,
  createRng,
  defaultTuning,
  QUIPS,
  type Craft,
  type GameEvent,
  type Quip,
  type QuipDirector,
  type QuipsTuning,
  TICKS_PER_SECOND,
} from '../../src/core';
import { eventsOf } from '../support/driver';

/** Pacing that closes a box within two ticks, so triggers can be tested back to back. */
const SNAPPY: QuipsTuning = {
  ...defaultTuning.quips,
  hitStop: 0,
  revealRate: 6000,
  clausePause: 0,
  sentencePause: 0,
  linger: 0,
  boxTransition: 0,
};

interface Harness {
  readonly director: QuipDirector;
  readonly events: GameEvent[];
  kill(craft?: Craft, alwaysQuip?: boolean): void;
  /** Advances until the Dialogue Box is gone. */
  settle(): void;
}

function harness(tuning: Partial<QuipsTuning> = {}, quips?: readonly Quip[], seed = 3): Harness {
  const events: GameEvent[] = [];
  const director = createQuipDirector({
    tuning: { ...SNAPPY, ...tuning },
    rng: createRng(seed),
    emit: (e) => events.push(e),
    ...(quips ? { quips } : {}),
  });
  let nextEnemy = 0;
  return {
    director,
    events,
    kill: (craft = 'lawyer', alwaysQuip = false) => {
      director.enemyDestroyed({ enemyId: ++nextEnemy, craft, alwaysQuip });
    },
    settle: () => {
      for (let i = 0; i < 10_000 && director.view(); i++) director.advance();
      if (director.view()) throw new Error('The Dialogue Box never closed');
    },
  };
}

const started = (events: readonly GameEvent[]) => eventsOf(events, 'quip-started');
const themeOf = (id: string) => QUIPS.find((q) => q.id === id)?.theme;
const countOf = (theme: string) => QUIPS.filter((q) => q.theme === theme).length;

describe('Quip director: triggering', () => {
  it('triggers with the tuned chance when nothing blocks it', () => {
    const h = harness({ chance: 0.25, cooldown: 0 });
    const kills = 4000;
    for (let i = 0; i < kills; i++) {
      h.kill();
      h.settle();
    }
    const rate = started(h.events).length / kills;
    expect(rate).toBeGreaterThan(0.22);
    expect(rate).toBeLessThan(0.28);
  });

  it('starts the cooldown when the box closes and triggers again exactly when it ends', () => {
    const h = harness({ chance: 1, cooldown: 1 });
    h.kill();
    h.settle();
    let waited = 0;
    while (started(h.events).length === 1 && waited < 200) {
      h.director.advance();
      waited += 1;
      h.kill();
    }
    expect(waited).toBe(60);
  });

  it('ignores kills while a box is showing, until it closes', () => {
    const h = harness({ chance: 1, cooldown: 0, linger: 1 });
    h.kill();
    for (let i = 0; i < 30; i++) {
      h.director.advance();
      h.kill();
    }
    expect(started(h.events)).toHaveLength(1);
    h.settle();
    h.kill();
    expect(started(h.events)).toHaveLength(2);
  });

  it('always triggers for always-Quip Enemies, ignoring chance, cooldown and the showing box', () => {
    const h = harness({ chance: 0, cooldown: 100, linger: 5 });
    h.kill('gym', true);
    h.director.advance();
    h.kill('gym', true);
    expect(started(h.events)).toHaveLength(2);
    h.kill('gym', false);
    expect(started(h.events)).toHaveLength(2);
  });

  it('starts the Hit-stop on every trigger and reports it frozen tick by tick', () => {
    const h = harness({ chance: 1, hitStop: 0.1 });
    h.kill();
    expect(eventsOf(h.events, 'hit-stop-started')[0]?.ticks).toBe(6);
    const frozen = Array.from({ length: 8 }, () => h.director.advance());
    expect(frozen).toEqual([true, true, true, true, true, true, false, false]);
  });

  it('pairs every Hit-stop start with an end when Quips replace each other mid-freeze', () => {
    const h = harness({ chance: 1, hitStop: 0.1 });
    // Two always-Quip kills in the same tick: the second replaces the first box.
    h.kill('gym', true);
    h.kill('gym', true);
    for (let i = 0; i < 10; i++) h.director.advance();
    const hitStops = h.events.filter((e) => e.type.startsWith('hit-stop')).map((e) => e.type);
    expect(hitStops).toEqual([
      'hit-stop-started',
      'hit-stop-ended',
      'hit-stop-started',
      'hit-stop-ended',
    ]);
    expect(h.director.hitStop).toBe(0);
  });
});

describe('Quip director: themes and shuffle-bags', () => {
  it.each([
    ['lawyer', 'legal'],
    ['gym', 'gym'],
  ] as const)('%s Craft draws %s Quips', (craft, theme) => {
    const h = harness();
    for (let i = 0; i < 30; i++) h.kill(craft, true);
    const ids = started(h.events).map((s) => s.quipId);
    expect(ids).toHaveLength(30);
    expect(ids.every((id) => themeOf(id) === theme)).toBe(true);
    expect(started(h.events).every((s) => s.theme === theme)).toBe(true);
  });

  it('never repeats a Quip until its theme is exhausted, nor right after a refill', () => {
    const h = harness();
    const size = countOf('legal');
    const rounds = 25;
    for (let i = 0; i < size * rounds; i++) h.kill('lawyer', true);
    const ids = started(h.events).map((s) => s.quipId);

    for (let round = 0; round < rounds; round++) {
      const bagful = ids.slice(round * size, (round + 1) * size);
      expect(new Set(bagful).size).toBe(size);
    }
    for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
  });

  it('keeps one bag per theme: gym kills do not use up legal Quips', () => {
    const h = harness();
    const size = countOf('legal');
    for (let i = 0; i < size; i++) {
      h.kill('lawyer', true);
      h.kill('gym', true);
    }
    const legal = started(h.events).filter((s) => s.theme === 'legal');
    expect(new Set(legal.map((s) => s.quipId)).size).toBe(size);
  });

  it('alternates when a theme has only two Quips', () => {
    const quips: Quip[] = [
      { id: 'legal-a', theme: 'legal', text: 'A.' },
      { id: 'legal-b', theme: 'legal', text: 'B.' },
    ];
    for (const seed of [1, 2, 3, 4, 5]) {
      const h = harness({}, quips, seed);
      for (let i = 0; i < 40; i++) h.kill('lawyer', true);
      const ids = started(h.events).map((s) => s.quipId);
      for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    }
  });
});

describe('Quip director: typewriter', () => {
  const quips: Quip[] = [{ id: 'legal-x', theme: 'legal', text: 'Ab, cd. Ef' }];

  const revealedEachTick = (tuning: Partial<QuipsTuning>, ticks: number): number[] => {
    const h = harness({ chance: 1, linger: 10, ...tuning }, quips);
    h.kill();
    return Array.from({ length: ticks }, () => {
      h.director.advance();
      return h.director.view()?.revealed ?? -1;
    });
  };

  it('reveals one character per tick at 60 chars/s', () => {
    expect(revealedEachTick({ revealRate: 60 }, 11)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10]);
  });

  it('pauses after a comma and after a sentence end followed by a space', () => {
    const revealed = revealedEachTick(
      { revealRate: 60, clausePause: 2 / 60, sentencePause: 3 / 60 },
      15,
    );
    // "Ab," then 2 ticks of pause; " cd." then 3 ticks of pause; " Ef".
    expect(revealed).toEqual([1, 2, 3, 3, 3, 4, 5, 6, 7, 7, 7, 7, 8, 9, 10]);
  });

  it('reveals the catalog at about 40 chars/s on average, punctuation pauses included', () => {
    // Default pacing, with the box already open so only the typewriter is timed.
    const typingTicks = (quip: Quip): number => {
      const h = harness({ ...defaultTuning.quips, chance: 1, boxTransition: 0 }, [quip]);
      h.kill(quip.theme === 'legal' ? 'lawyer' : 'gym');
      for (let tick = 1; tick <= 10_000; tick++) {
        h.director.advance();
        if (h.director.view()?.complete) return tick;
      }
      throw new Error(`${quip.id} never finished typing`);
    };
    const rates = QUIPS.map((quip) => quip.text.length / (typingTicks(quip) / TICKS_PER_SECOND));
    const average = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    expect(average).toBeGreaterThan(39);
    expect(average).toBeLessThan(41);
  });

  it('reports the box complete once every character is shown', () => {
    const h = harness({ chance: 1, linger: 10, revealRate: 60 }, quips);
    h.kill();
    for (let i = 0; i < 9; i++) h.director.advance();
    expect(h.director.view()?.complete).toBe(false);
    h.director.advance();
    expect(h.director.view()?.complete).toBe(true);
  });
});
