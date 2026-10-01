import { INITIALS_ALPHABET, INITIALS_LENGTH, type HighScoreEntry } from './high-scores';
import type { MenuInput } from './input';
import { moveSelection } from './pause-menu';
import type { InitialsEntryView, RunStatsView, VerdictView } from './view';

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
export function createVerdict(stats: RunStatsView, rank: number | null, initials: string): Verdict {
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
