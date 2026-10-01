import { describe, expect, it } from 'vitest';
import { createFixedStepper } from '../../src/platform/fixed-step';

/** Simulates `seconds` of frames at `hz` (with optional jitter) and returns ticks per frame. */
function simulate(hz: number, seconds: number, jitterMs = 0): number[] {
  const stepper = createFixedStepper();
  const frameMs = 1000 / hz;
  const frames = Math.round(seconds * hz);
  const ticks: number[] = [];
  for (let i = 0; i < frames; i++) {
    const jitter = jitterMs * Math.sin(i * 1.7); // deterministic pseudo-jitter, zero mean
    ticks.push(stepper.advance(frameMs + jitter));
  }
  return ticks;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('fixed-timestep loop', () => {
  it.each([30, 60, 75, 90, 120, 144, 165, 240])(
    'runs 60 ticks per second on a %i Hz display',
    (hz) => {
      expect(Math.abs(sum(simulate(hz, 10)) - 600)).toBeLessThanOrEqual(1);
    },
  );

  it('runs exactly one tick per frame at 60 Hz despite frame jitter', () => {
    const ticks = simulate(60, 5, 0.8);
    expect(ticks.every((t) => t === 1)).toBe(true);
  });

  it('keeps the same average speed with jitter on high-refresh displays', () => {
    expect(Math.abs(sum(simulate(144, 10, 1.5)) - 600)).toBeLessThanOrEqual(1);
  });

  it('clamps long stalls instead of fast-forwarding (no spiral of death)', () => {
    const stepper = createFixedStepper({ maxStepsPerFrame: 5 });
    expect(stepper.advance(2000)).toBe(5);
    // The dropped time is not paid back afterwards.
    expect(stepper.advance(1000 / 60)).toBe(1);
  });

  it('ignores zero, negative and invalid frame times', () => {
    const stepper = createFixedStepper();
    expect(stepper.advance(0)).toBe(0);
    expect(stepper.advance(-50)).toBe(0);
    expect(stepper.advance(Number.NaN)).toBe(0);
  });
});
