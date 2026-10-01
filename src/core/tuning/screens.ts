/**
 * Screen-flow timing that shapes how the game feels around a Run. The renderer's own entry
 * animations are cosmetic and stay with their drawers.
 */
export interface ScreensTuning {
  /** How long the ended Run stays on screen (the defeat beat) before the Veredicto, seconds. */
  readonly defeatBeat: number;
  /**
   * Title and Cómo jugar (and the Veredicto after signing) ignore `start` for this long, so the
   * press that opened a screen (or a hurried double press) does not skip the next one, seconds.
   */
  readonly startGuard: number;
  /**
   * The Veredicto ignores input while its stats are read out, so a trigger still held or mashed
   * from the Run does not skip it or type initials, seconds.
   */
  readonly verdictGuard: number;
}

export const screensTuning: ScreensTuning = {
  defeatBeat: 1.5,
  startGuard: 0.5,
  verdictGuard: 1,
};
