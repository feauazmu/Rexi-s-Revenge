import { describe, expect, it } from 'vitest';
import {
  patchDuration,
  renderPatch,
  type SynthLayer,
  type SynthPatch,
} from '../../../src/platform/audio/synth';
import { brightness, peak, rms, slice, zeroCrossingsPerSecond } from '../../support/signal';

const SR = 48_000;

/** `actual` is within `tolerance` (a fraction) of `expected`. */
function expectNear(actual: number, expected: number, tolerance = 0.03) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(expected * tolerance);
}

/** A one-layer patch with a flat envelope, so measurements see the raw oscillator. */
function tone(layer: Partial<SynthLayer>, seconds = 0.5): SynthPatch {
  return {
    peak: 0.5,
    layers: [{ wave: 'square', freq: 440, env: { hold: seconds, decay: 0.001 }, ...layer }],
  };
}

describe('renderPatch', () => {
  it('lasts as long as its longest layer, delay included', () => {
    const patch: SynthPatch = {
      peak: 0.5,
      layers: [
        { wave: 'sine', freq: 200, env: { attack: 0.01, hold: 0.05, decay: 0.1 } },
        { wave: 'noise', freq: SR, delay: 0.2, env: { decay: 0.15 } },
      ],
    };
    expect(patchDuration(patch)).toBeCloseTo(0.35, 6);
    expect(renderPatch(patch, SR)).toHaveLength(Math.ceil(0.35 * SR));
  });

  it('normalizes the loudest sample to the patch peak', () => {
    const quiet = renderPatch({ ...tone({ gain: 0.1 }), peak: 0.4 }, SR);
    const loud = renderPatch({ ...tone({ gain: 3 }), peak: 0.4 }, SR);
    expect(peak(quiet)).toBeCloseTo(0.4, 5);
    expect(peak(loud)).toBeCloseTo(0.4, 5);
  });

  it('starts and ends silent, so sounds never click', () => {
    const samples = renderPatch(tone({ env: { decay: 0.1 } }), SR);
    expect(samples[0]).toBe(0);
    expect(Math.abs(samples.at(-1) ?? 1)).toBeLessThan(0.01);
  });

  it('is deterministic, noise included', () => {
    const patch = tone({ wave: 'noise', freq: SR });
    expect(renderPatch(patch, SR)).toEqual(renderPatch(patch, SR));
    expect(renderPatch(patch, SR, 2)).not.toEqual(renderPatch(patch, SR, 1));
  });

  it('plays the oscillator at its frequency', () => {
    const samples = renderPatch(tone({ freq: 440 }), SR);
    expectNear(zeroCrossingsPerSecond(slice(samples, SR, 0.05, 0.45), SR), 880);
  });

  it('slides the pitch exponentially from freq to freqEnd', () => {
    const samples = renderPatch(tone({ wave: 'sine', freq: 800, freqEnd: 200 }), SR);
    const early = zeroCrossingsPerSecond(slice(samples, SR, 0, 0.05), SR);
    const middle = zeroCrossingsPerSecond(slice(samples, SR, 0.225, 0.275), SR);
    const late = zeroCrossingsPerSecond(slice(samples, SR, 0.45, 0.5), SR);
    expect(early).toBeGreaterThan(1300);
    expectNear(middle, 800); // geometric mean of 800 and 200 is 400 Hz
    expect(late).toBeLessThan(500);
  });

  it('holds freqEnd after a slide shorter than the layer', () => {
    const samples = renderPatch(tone({ wave: 'sine', freq: 800, freqEnd: 200, slide: 0.1 }), SR);
    expectNear(zeroCrossingsPerSecond(slice(samples, SR, 0.2, 0.45), SR), 400);
  });

  it('restarts the slide every `repeat` seconds', () => {
    const samples = renderPatch(
      tone({ wave: 'sine', freq: 300, freqEnd: 1200, slide: 0.1, repeat: 0.1 }),
      SR,
    );
    const first = zeroCrossingsPerSecond(slice(samples, SR, 0.0, 0.03), SR);
    const second = zeroCrossingsPerSecond(slice(samples, SR, 0.1, 0.13), SR);
    const third = zeroCrossingsPerSecond(slice(samples, SR, 0.2, 0.23), SR);
    expectNear(second, first, 0.1);
    expectNear(third, first, 0.1);
    expect(zeroCrossingsPerSecond(slice(samples, SR, 0.07, 0.1), SR)).toBeGreaterThan(first * 2);
  });

  it('steps the pitch at the given times (arpeggio)', () => {
    const samples = renderPatch(
      tone({ wave: 'square', freq: 400, steps: [{ at: 0.25, ratio: 1.5 }] }),
      SR,
    );
    expectNear(zeroCrossingsPerSecond(slice(samples, SR, 0.05, 0.2), SR), 800);
    expectNear(zeroCrossingsPerSecond(slice(samples, SR, 0.3, 0.45), SR), 1200);
  });

  it('shapes the volume with attack, hold and decay', () => {
    const samples = renderPatch(
      tone({ wave: 'sine', freq: 1000, env: { attack: 0.1, hold: 0.1, decay: 0.2 } }),
      SR,
    );
    const rising = rms(slice(samples, SR, 0.0, 0.05));
    const held = rms(slice(samples, SR, 0.12, 0.18));
    const decaying = rms(slice(samples, SR, 0.3, 0.35));
    expect(rising).toBeLessThan(held);
    expect(decaying).toBeLessThan(held);
    expect(held).toBeCloseTo(0.5 / Math.SQRT2, 2);
  });

  it('punches the start of the hold louder', () => {
    const samples = renderPatch(
      tone({ wave: 'sine', freq: 1000, env: { hold: 0.2, punch: 1, decay: 0.01 } }),
      SR,
    );
    expect(rms(slice(samples, SR, 0, 0.03))).toBeGreaterThan(
      1.5 * rms(slice(samples, SR, 0.17, 0.2)),
    );
  });

  it('starts a delayed layer silent until its delay', () => {
    const samples = renderPatch(
      { peak: 0.5, layers: [{ wave: 'square', freq: 300, delay: 0.1, env: { decay: 0.1 } }] },
      SR,
    );
    expect(peak(slice(samples, SR, 0, 0.099))).toBe(0);
    expect(peak(slice(samples, SR, 0.1, 0.15))).toBeGreaterThan(0.1);
  });

  it('darkens with a lowpass filter and brightens with a highpass filter', () => {
    const noise = { wave: 'noise', freq: SR } as const;
    const raw = brightness(renderPatch(tone(noise), SR));
    const low = brightness(
      renderPatch(tone({ ...noise, filter: { type: 'lowpass', cutoff: 500 } }), SR),
    );
    const high = brightness(
      renderPatch(tone({ ...noise, filter: { type: 'highpass', cutoff: 6000 } }), SR),
    );
    expect(low).toBeLessThan(raw * 0.3);
    expect(high).toBeGreaterThan(raw);
  });

  it('sweeps a filter cutoff from cutoff to cutoffEnd', () => {
    const samples = renderPatch(
      tone({ wave: 'noise', freq: SR, filter: { type: 'lowpass', cutoff: 8000, cutoffEnd: 300 } }),
      SR,
    );
    expect(brightness(slice(samples, SR, 0.4, 0.5))).toBeLessThan(
      brightness(slice(samples, SR, 0.0, 0.1)) * 0.5,
    );
  });

  it('a bandpass filter rings at its cutoff', () => {
    const samples = renderPatch(
      tone({ wave: 'noise', freq: SR, filter: { type: 'bandpass', cutoff: 2000, q: 12 } }),
      SR,
    );
    expectNear(zeroCrossingsPerSecond(slice(samples, SR, 0.05, 0.45), SR), 4000, 0.2);
  });

  it('wobbles the pitch with vibrato only after its delay', () => {
    const steady = renderPatch(tone({ wave: 'sine', freq: 500 }), SR);
    const vibrato = renderPatch(
      tone({ wave: 'sine', freq: 500, vibrato: { rate: 6, depth: 0.2, delay: 0.25 } }),
      SR,
    );
    expect(slice(vibrato, SR, 0, 0.24)).toEqual(slice(steady, SR, 0, 0.24));
    expect(slice(vibrato, SR, 0.3, 0.45)).not.toEqual(slice(steady, SR, 0.3, 0.45));
  });

  it('soft-clips with drive, fattening the sound without exceeding the peak', () => {
    const clean = renderPatch(tone({ wave: 'sine', freq: 300 }), SR);
    const driven = renderPatch({ ...tone({ wave: 'sine', freq: 300 }), drive: 4 }, SR);
    expect(peak(driven)).toBeCloseTo(0.5, 5);
    expect(rms(driven)).toBeGreaterThan(rms(clean) * 1.1);
  });

  it('renders an empty patch as silence', () => {
    expect(renderPatch({ peak: 0.5, layers: [] }, SR)).toHaveLength(0);
  });
});
