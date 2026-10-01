import { INITIALS_ALPHABET, INITIALS_LENGTH, type HighScoreEntry } from './high-scores';
import type { GameEvent } from './events';
import type { InputFrame, MenuInput } from './input';
import { moveSelection } from './pause-menu';
import type { RunStats } from './stats';
import type { InitialsEntryView, VerdictView } from './view';

/**
 * The Veredicto of one ended Run and, when it made the top 10, its arcade-style initials
 * entry driven by menu navigation (so keyboard and touch work the same way): up/down change
 * the letter (wrapping A–Z), left/right and back move between letters, and confirm moves on
 * or, on the last letter, signs.
 */
export interface Verdict {
  /** True while the initials are still to be signed. */
  readonly signing: boolean;
  /** Applies one tick of menu input; returns the new entry on the tick the player signs. */
  input(menu: MenuInput): HighScoreEntry | null;
  view(): VerdictView;
}

/**
 * `rank` is the place the Run earned (null: no initials entry); `initials` are the letters the
 * entry starts from.
 */
export function createVerdict(stats: RunStats, rank: number | null, initials: string): Verdict {
  const letters = Array.from(initials, (char) => Math.max(0, INITIALS_ALPHABET.indexOf(char)));
  let cursor = 0;
  let recorded = false;
  let cached: VerdictView | null = null;

  const spelled = (): string => letters.map((i) => INITIALS_ALPHABET.charAt(i)).join('');

  return {
    get signing() {
      return rank !== null && !recorded;
    },

    input(menu) {
      if (rank === null || recorded) return null;
      cached = null;
      // A fast "change, then confirm" can land in one tick: change first, then confirm.
      if (menu.up !== menu.down) {
        letters[cursor] = moveSelection(
          letters[cursor] ?? 0,
          menu.up ? 1 : -1,
          INITIALS_ALPHABET.length,
        );
      }
      if (menu.left || menu.back) cursor = Math.max(0, cursor - 1);
      else if (menu.right) cursor = Math.min(INITIALS_LENGTH - 1, cursor + 1);
      if (!menu.confirm) return null;
      if (cursor < INITIALS_LENGTH - 1) {
        cursor += 1;
        return null;
      }
      recorded = true;
      return { initials: spelled(), ...stats };
    },

    view() {
      const entry: InitialsEntryView | null = rank === null ? null : { letters: spelled(), cursor };
      cached ??= { stats, rank, initials: entry, recorded };
      return cached;
    },
  };
}

/** What one Veredicto tick needs from the Game. */
export interface VerdictStepDeps {
  /** True when `start` may leave the Veredicto now (see `GameView.startReady`). */
  readonly startReady: boolean;
  emit(event: GameEvent): void;
  /** Saves the signed entry into the top 10. Called once, on the tick the player signs. */
  record(entry: HighScoreEntry): void;
}

/**
 * One tick of the Veredicto screen once its input guard has passed: initials entry while the
 * Run still signs (emitting `menu-moved` on every change and `high-score-recorded` on signing),
 * then `start` to leave. Returns true on the tick the player leaves it.
 */
export function stepVerdict(verdict: Verdict, input: InputFrame, deps: VerdictStepDeps): boolean {
  if (!verdict.signing) return input.start && deps.startReady;
  const before = verdict.view().initials;
  const entry = verdict.input(input.menu);
  // Only a Run with a rank signs, so `rank` is set whenever an entry comes back.
  const { rank, initials } = verdict.view();
  if (
    !entry &&
    initials &&
    (initials.letters !== before?.letters || initials.cursor !== before.cursor)
  ) {
    deps.emit({ type: 'menu-moved', selected: initials.cursor });
  }
  if (!entry || rank === null) return false;
  deps.record(entry);
  deps.emit({ type: 'high-score-recorded', initials: entry.initials, score: entry.score, rank });
  return false;
}
