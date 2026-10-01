import { TICKS_PER_SECOND } from '../core';

export interface FixedStepperOptions {
  /** Length of one tick, ms. Default: 1000 / 60. */
  readonly stepMs?: number;
  /** Most ticks run for one frame; time beyond that is dropped (no spiral of death). */
  readonly maxStepsPerFrame?: number;
  /**
   * A frame this close to a whole tick still runs it, borrowing the remainder from the next
   * frame. Absorbs requestAnimationFrame jitter at 60 Hz without changing average speed.
   */
  readonly toleranceMs?: number;
}

/**
 * Fixed-timestep accumulator: converts variable frame times into whole game ticks, so the
 * game runs at the same speed on 60 Hz, 120 Hz or 144 Hz displays.
 */
export interface FixedStepper {
  /** Adds a frame's elapsed real time and returns how many ticks to run now. */
  advance(elapsedMs: number): number;
}

export function createFixedStepper(options: FixedStepperOptions = {}): FixedStepper {
  const stepMs = options.stepMs ?? 1000 / TICKS_PER_SECOND;
  const maxSteps = options.maxStepsPerFrame ?? 5;
  const tolerance = options.toleranceMs ?? 1;
  let accumulator = 0;

  return {
    advance(elapsedMs) {
      if (!(elapsedMs > 0)) return 0;
      accumulator = Math.min(accumulator + elapsedMs, maxSteps * stepMs);
      let steps = 0;
      while (steps < maxSteps && accumulator >= stepMs - tolerance) {
        accumulator -= stepMs;
        steps += 1;
      }
      return steps;
    },
  };
}
