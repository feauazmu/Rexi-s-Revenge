import { secondsToTicks, TICKS_PER_SECOND } from '../constants';
import type { GameEvent } from '../events';
import type { Craft } from '../ids';
import type { Rng } from '../rng';
import type { QuipsTuning } from '../tuning';
import type { DialogueView } from '../view';
import { QUIPS, type Quip, type QuipTheme } from './catalog';
import { createShuffleBag, type ShuffleBag } from './shuffle-bag';

/** What the Quip director needs to know about a destroyed Enemy. */
export interface DestroyedEnemy {
  readonly enemyId: number;
  readonly craft: Craft;
  /** The Enemy's catalog flag: it always draws a Quip (see `EnemyTuningBase.alwaysQuip`). */
  readonly alwaysQuip: boolean;
}

export interface QuipDirectorDeps {
  readonly tuning: QuipsTuning;
  /** Randomness for the trigger roll and the shuffle-bags. */
  readonly rng: Rng;
  readonly emit: (event: GameEvent) => void;
  /** The Quips to draw from. Default: the game's catalog. */
  readonly quips?: readonly Quip[];
}

/**
 * Decides when Rexi talks and runs the Dialogue Box: the trigger rules, the per-theme
 * shuffle-bags, the Hit-stop timer and the typewriter.
 *
 * Its clock is `advance()`, called once per game tick even while the Run is frozen, so the
 * Dialogue Box keeps animating during a Hit-stop.
 */
export interface QuipDirector {
  /**
   * Reports a destroyed Enemy. A Quip triggers when the Enemy is flagged always-Quip (it then
   * replaces any showing box), or when no box is showing, the cooldown has elapsed and the
   * chance roll succeeds.
   */
  enemyDestroyed(enemy: DestroyedEnemy): void;
  /**
   * Advances one tick: consumes one tick of Hit-stop and animates the Dialogue Box. Returns
   * true when the Run must stay frozen this tick.
   */
  advance(): boolean;
  /** Ticks of Hit-stop left. */
  readonly hitStop: number;
  view(): DialogueView | null;
}

/** Which Quips each Craft draws. */
export const THEME_OF_CRAFT: Readonly<Record<Craft, QuipTheme>> = { lawyer: 'legal', gym: 'gym' };

type Phase = 'opening' | 'typing' | 'lingering' | 'closing';

interface Box {
  readonly quip: Quip;
  phase: Phase;
  /** Ticks spent in the current phase. */
  phaseAge: number;
  age: number;
  revealed: number;
  /** Fractional characters owed to the typewriter. */
  carry: number;
  /** Ticks left in a punctuation pause. */
  pause: number;
}

const CLAUSE_MARKS = new Set([',', ';', ':']);
const SENTENCE_MARKS = new Set(['.', '!', '?', '…']);

export function createQuipDirector(deps: QuipDirectorDeps): QuipDirector {
  const { tuning, rng, emit } = deps;
  const quips = deps.quips ?? QUIPS;
  const ticks = {
    cooldown: secondsToTicks(tuning.cooldown),
    hitStop: secondsToTicks(tuning.hitStop),
    clausePause: secondsToTicks(tuning.clausePause),
    sentencePause: secondsToTicks(tuning.sentencePause),
    linger: secondsToTicks(tuning.linger),
    transition: secondsToTicks(tuning.boxTransition),
  };
  const charsPerTick = tuning.revealRate / TICKS_PER_SECOND;

  const bags = new Map<QuipTheme, ShuffleBag<Quip>>();
  const drawQuip = (theme: QuipTheme): Quip => {
    let bag = bags.get(theme);
    if (!bag) {
      bag = createShuffleBag(
        quips.filter((q) => q.theme === theme),
        rng,
      );
      bags.set(theme, bag);
    }
    return bag.draw();
  };

  let box: Box | null = null;
  let hitStop = 0;
  let cooldown = 0;

  const enter = (b: Box, phase: Phase): void => {
    b.phase = phase;
    b.phaseAge = 0;
  };

  const pauseAfter = (text: string, index: number): number => {
    if (text.charAt(index + 1) !== ' ') return 0;
    const char = text.charAt(index);
    if (CLAUSE_MARKS.has(char)) return ticks.clausePause;
    if (SENTENCE_MARKS.has(char)) return ticks.sentencePause;
    return 0;
  };

  const type = (b: Box): void => {
    if (b.pause > 0) {
      b.pause -= 1;
      return;
    }
    const { text } = b.quip;
    b.carry += charsPerTick;
    while (b.carry >= 1 && b.revealed < text.length) {
      b.carry -= 1;
      const index = b.revealed;
      const char = text.charAt(index);
      b.revealed += 1;
      if (char !== ' ') emit({ type: 'quip-character', quipId: b.quip.id, char, index });
      const pause = pauseAfter(text, index);
      if (pause > 0) {
        b.pause = pause;
        b.carry = 0;
        break;
      }
    }
  };

  const animate = (b: Box): void => {
    b.age += 1;
    b.phaseAge += 1;
    switch (b.phase) {
      case 'opening':
        if (b.phaseAge >= ticks.transition) enter(b, 'typing');
        return;
      case 'typing':
        type(b);
        if (b.revealed >= b.quip.text.length) enter(b, 'lingering');
        return;
      case 'lingering':
        if (b.phaseAge >= ticks.linger) enter(b, 'closing');
        return;
      case 'closing':
        if (b.phaseAge >= ticks.transition) {
          box = null;
          cooldown = ticks.cooldown;
          emit({ type: 'dialogue-closed', quipId: b.quip.id });
        }
        return;
    }
  };

  const start = (enemy: DestroyedEnemy): void => {
    const theme = THEME_OF_CRAFT[enemy.craft];
    const quip = drawQuip(theme);
    // A replacement keeps the open box and goes straight to typing.
    const open = box !== null || ticks.transition === 0;
    // A replacement during a Hit-stop (several kills in one tick) closes the running one first,
    // so every `hit-stop-started` gets its `hit-stop-ended`.
    if (hitStop > 0) emit({ type: 'hit-stop-ended' });
    box = {
      quip,
      phase: open ? 'typing' : 'opening',
      phaseAge: 0,
      age: 0,
      revealed: 0,
      carry: 0,
      pause: 0,
    };
    hitStop = ticks.hitStop;
    emit({
      type: 'quip-started',
      quipId: quip.id,
      theme,
      enemyId: enemy.enemyId,
    });
    if (hitStop > 0) emit({ type: 'hit-stop-started', ticks: hitStop });
  };

  const openness = (b: Box): number => {
    if (ticks.transition === 0) return 1;
    if (b.phase === 'opening') return b.phaseAge / ticks.transition;
    if (b.phase === 'closing') return 1 - b.phaseAge / ticks.transition;
    return 1;
  };

  return {
    enemyDestroyed(enemy) {
      if (!enemy.alwaysQuip) {
        if (box !== null || cooldown > 0) return;
        if (!rng.chance(tuning.chance)) return;
      }
      start(enemy);
    },

    advance() {
      const frozen = hitStop > 0;
      if (frozen) {
        hitStop -= 1;
        if (hitStop === 0) emit({ type: 'hit-stop-ended' });
      }
      if (box) animate(box);
      else if (cooldown > 0) cooldown -= 1;
      return frozen;
    },

    get hitStop() {
      return hitStop;
    },

    view() {
      if (!box) return null;
      return {
        quipId: box.quip.id,
        theme: box.quip.theme,
        text: box.quip.text,
        revealed: box.revealed,
        complete: box.revealed >= box.quip.text.length,
        openness: openness(box),
        age: box.age,
      };
    },
  };
}
