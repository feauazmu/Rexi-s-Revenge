/** Helpers shared by the smoke tests. */
import type { Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions for the whole test. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Steps of a whole-Run sweep, and the fake-clock time each one lasts. */
export const SWEEP_STEPS = 240;
export const SWEEP_STEP_MS = 500;

/**
 * Aim angle for sweep step `i`, radians above the horizon (0.1π to 0.9π): a scrambled sweep
 * across the sky, so held fire eventually meets Enemies wherever they fly.
 */
export function sweepAngle(i: number): number {
  return Math.PI * (0.1 + 0.8 * ((i * 0.37) % 1));
}

/** The persisted top 10, as the core stores it (the storage adapter's prefix included). */
export async function readHighScores(
  page: Page,
): Promise<{ version?: number; entries?: { initials: string; score: number }[] }> {
  const table = await page.evaluate(() => localStorage.getItem('rexis-revenge:high-scores'));
  return JSON.parse(table ?? '{}') as {
    version?: number;
    entries?: { initials: string; score: number }[];
  };
}

/** What {@link spyOnFullscreen} counted: fullscreen requests and landscape orientation locks. */
export interface FullscreenCalls {
  requests: number;
  locks: string[];
}

/**
 * Before the page loads, replaces `requestFullscreen` and `screen.orientation.lock` with
 * counters that resolve without entering fullscreen. Read the counts with
 * {@link readFullscreenCalls}.
 */
export async function spyOnFullscreen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const calls = { requests: 0, locks: [] as string[] };
    (window as unknown as { __fullscreenCalls: typeof calls }).__fullscreenCalls = calls;
    Element.prototype.requestFullscreen = function () {
      calls.requests += 1;
      return Promise.resolve();
    };
    screen.orientation.lock = (orientation) => {
      calls.locks.push(orientation);
      return Promise.resolve();
    };
  });
}

/** The calls {@link spyOnFullscreen} has counted so far. */
export function readFullscreenCalls(page: Page): Promise<FullscreenCalls> {
  return page.evaluate(
    () => (window as unknown as { __fullscreenCalls: FullscreenCalls }).__fullscreenCalls,
  );
}
