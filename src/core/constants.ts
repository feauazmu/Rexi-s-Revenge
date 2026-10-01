/** The Game core advances in fixed steps: exactly this many ticks per simulated second. */
export const TICKS_PER_SECOND = 60;

/** Simulated seconds per tick. */
export const DT = 1 / TICKS_PER_SECOND;

/** Logical resolution of the game in pixels. All game coordinates live in this space. */
export const SCREEN_WIDTH = 640;
export const SCREEN_HEIGHT = 360;

/** How far outside the screen projectiles and particles may travel before they are culled, px. */
export const OFFSCREEN_MARGIN = 43;

/** Converts a duration in seconds (as written in the tuning catalog) to whole ticks. */
export function secondsToTicks(seconds: number): number {
  return Math.max(0, Math.round(seconds * TICKS_PER_SECOND));
}
