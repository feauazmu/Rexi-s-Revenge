/**
 * Quips: when Rexi talks, the Hit-stop that announces it and the Dialogue Box's pacing.
 * Which Enemies always draw a Quip is a per-Enemy flag (`enemies[kind].alwaysQuip`).
 */
export interface QuipsTuning {
  /** Probability (0..1) that destroying an Enemy triggers a Quip, when one may trigger. */
  readonly chance: number;
  /** Quiet time after a Dialogue Box closes before a chance-based Quip may trigger, seconds. */
  readonly cooldown: number;
  /** How long the Run freezes when a Quip triggers, seconds. The Dialogue Box keeps going. */
  readonly hitStop: number;
  /**
   * Typewriter speed between punctuation pauses, characters per second. With the pauses, the
   * Quip catalog reveals at about 40 chars/s on average (the spec's rate; a test checks it).
   */
  readonly revealRate: number;
  /** Extra beat after `,`, `:` or `;` followed by a space, seconds. */
  readonly clausePause: number;
  /** Extra beat after `.`, `!`, `?` or `…` followed by a space, seconds. */
  readonly sentencePause: number;
  /** How long the fully revealed Quip stays on screen before the box closes, seconds. */
  readonly linger: number;
  /** Duration of the box sliding in (and out), seconds. */
  readonly boxTransition: number;
}

export const quipsTuning: QuipsTuning = {
  chance: 0.25,
  cooldown: 4,
  hitStop: 0.5,
  revealRate: 51,
  clausePause: 0.1,
  sentencePause: 0.2,
  linger: 2.5,
  boxTransition: 0.07,
};
