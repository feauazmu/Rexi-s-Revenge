import { describe, expect, it } from 'vitest';
import {
  barsToSamples,
  crossfadeSeam,
  estimateBpm,
  findLoop,
  layoutLoop,
  normalizedCrossCorrelation,
  peakGainFor,
  rmsDb,
} from '../../scripts/music-loop/loop-math.ts';

const SR = 1000;

/** A deterministic pseudo-random signal (no repetition of its own). */
function noise(length: number, seed = 1): Float32Array {
  const out = new Float32Array(length);
  let s = seed >>> 0;
  for (let i = 0; i < length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = s / 2 ** 31 - 1;
  }
  return out;
}

/** `pattern` repeated until `length`, after `intro` samples of unrelated noise. */
function repeating(pattern: Float32Array, length: number, intro = 0): Float32Array {
  const out = noise(length, 99);
  for (let i = intro; i < length; i++) out[i] = pattern[(i - intro) % pattern.length] ?? 0;
  return out;
}

describe('barsToSamples', () => {
  it('converts a bar count at a tempo into whole samples', () => {
    // 8 bars of 4/4 at 120 BPM = 32 beats of 0.5 s = 16 s.
    expect(barsToSamples(8, 120, 44100)).toBe(16 * 44100);
    // 4 bars at 140 BPM = 16 * 60 / 140 s = 6.857142… s, rounded to a sample.
    expect(barsToSamples(4, 140, 44100)).toBe(Math.round((16 * 60 * 44100) / 140));
    expect(barsToSamples(2, 90, 1000, 3)).toBe(4000);
  });
});

describe('normalizedCrossCorrelation', () => {
  it('is 1 for identical windows, -1 for inverted ones and ~0 for unrelated noise', () => {
    const a = noise(500);
    const signal = new Float32Array(1500);
    signal.set(a, 0);
    signal.set(a, 500);
    signal.set(
      a.map((v) => -v),
      1000,
    );
    expect(normalizedCrossCorrelation(signal, 0, 500, 500)).toBeCloseTo(1, 6);
    expect(normalizedCrossCorrelation(signal, 0, 1000, 500)).toBeCloseTo(-1, 6);
    const other = noise(1000, 7);
    const mixed = new Float32Array(1000);
    mixed.set(a, 0);
    mixed.set(other.subarray(0, 500), 500);
    expect(Math.abs(normalizedCrossCorrelation(mixed, 0, 500, 500))).toBeLessThan(0.15);
  });

  it('is 0 (not NaN) for silence', () => {
    expect(normalizedCrossCorrelation(new Float32Array(100), 0, 50, 50)).toBe(0);
  });
});

describe('findLoop', () => {
  it('finds the musical period and the start where the material starts repeating', () => {
    // 1 bar of 4/4 at 120 BPM = 2 s = 2000 samples; the pattern is 2 bars long, after 1.3 s of intro.
    const pattern = noise(4000, 3);
    const signal = repeating(pattern, 13000, 1300);
    const loop = findLoop(signal, SR, {
      bpm: 120,
      bars: [2, 4],
      searchFrom: 0.5,
      searchTo: 3,
      startStep: 0.01,
      window: 0.3,
    });
    // The longest bar count that repeats wins: 4 bars (two passes of the pattern).
    expect(loop.bars).toBe(4);
    expect(loop.length).toBe(8000);
    expect(loop.start).toBeGreaterThanOrEqual(1300);
    expect(loop.score).toBeGreaterThan(0.99);
  });

  it('refines the length by a few samples to absorb tempo drift', () => {
    const pattern = noise(2003, 5); // a "1 bar at 120 BPM" pass that drifted 3 samples long
    const signal = repeating(pattern, 9000, 0);
    const loop = findLoop(signal, SR, {
      bpm: 120,
      bars: [1],
      searchFrom: 0.5,
      searchTo: 1,
      startStep: 0.05,
      window: 0.3,
      refine: 0.01,
    });
    expect(loop.length).toBe(2003);
    expect(loop.score).toBeGreaterThan(0.99);
  });

  it('prefers fewer bars when the longer loop does not repeat (score below minScore)', () => {
    const pattern = noise(2000, 8);
    const signal = repeating(pattern, 7000, 0);
    // Break the repetition 4 bars later only: after 6000 samples, unrelated noise.
    signal.set(noise(1000, 11), 6000);
    const loop = findLoop(signal, SR, {
      bpm: 120,
      bars: [1, 3],
      searchFrom: 0.5,
      searchTo: 1,
      startStep: 0.05,
      window: 0.3,
    });
    expect(loop.bars).toBe(1);
  });

  it('throws when no loop fits in the clip', () => {
    expect(() =>
      findLoop(noise(3000), SR, { bpm: 120, bars: [4], searchFrom: 0.5, searchTo: 1 }),
    ).toThrow(/too short/);
  });
});

describe('crossfadeSeam', () => {
  it('returns the loop body with its tail faded into the audio just before the start', () => {
    const channel = Float32Array.from({ length: 100 }, (_, i) => i);
    const body = crossfadeSeam(channel, 20, 50, 10);
    expect(body).toHaveLength(50);
    // Untouched before the fade.
    expect(Array.from(body.subarray(0, 40))).toEqual(Array.from(channel.subarray(20, 60)));
    // Equal-power weights (cos/sin of the same angle) from the body's own tail (60…69) to the
    // audio just before the start (10…19); at the end the latter dominates, so body[49] -> body[0]
    // continues like channel[19] -> channel[20].
    const mix = (i: number) => {
      const angle = (((i + 0.5) / 10) * Math.PI) / 2;
      return (60 + i) * Math.cos(angle) + (10 + i) * Math.sin(angle);
    };
    expect(body[40]).toBeCloseTo(mix(0), 4);
    expect(body[49]).toBeCloseTo(mix(9), 4);
  });

  it('never fades longer than the audio available before the start', () => {
    const channel = Float32Array.from({ length: 100 }, (_, i) => i);
    const body = crossfadeSeam(channel, 3, 50, 10);
    expect(body[46]).toBe(49);
    // A 3-sample fade from 50…52 into channel[0…2].
    const angle = ((2.5 / 3) * Math.PI) / 2;
    expect(body[49]).toBeCloseTo(52 * Math.cos(angle) + 2 * Math.sin(angle), 4);
  });
});

describe('layoutLoop', () => {
  it('pads the body with its own wrap-around audio and reports the loop points', () => {
    const body = Float32Array.from({ length: 10 }, (_, i) => i + 1);
    const { samples, loopStart, loopEnd } = layoutLoop(body, 3);
    expect(Array.from(samples)).toEqual([8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3]);
    expect(loopStart).toBe(3);
    expect(loopEnd).toBe(13);
  });

  it('keeps the audio around both loop points identical, so a constant decoder offset stays seamless', () => {
    const { samples, loopStart, loopEnd } = layoutLoop(noise(200), 20);
    for (let d = -20; d < 20; d++) expect(samples[loopStart + d]).toBe(samples[loopEnd + d]);
  });
});

describe('peakGainFor', () => {
  it('returns the gain that brings the loudest sample to the target peak', () => {
    const left = Float32Array.from([0.1, -0.5, 0.2]);
    const right = Float32Array.from([0.25, 0.3, -0.1]);
    expect(peakGainFor([left, right], 0.4)).toBeCloseTo(0.8, 6);
    expect(peakGainFor([new Float32Array(4)], 0.9)).toBe(1);
  });
});

describe('estimateBpm', () => {
  it('finds the tempo of a click track', () => {
    const sr = 8000;
    const signal = new Float32Array(sr * 12);
    const beat = (60 / 140) * sr;
    for (let t = 0; t + 200 < signal.length; t += beat) {
      for (let i = 0; i < 200; i++) signal[Math.round(t) + i] = Math.sin(i) * (1 - i / 200);
    }
    expect(estimateBpm(signal, sr, 90, 180)).toBeCloseTo(140, 0);
  });
});

describe('rmsDb', () => {
  it('measures loudness in dBFS', () => {
    expect(rmsDb([Float32Array.from([0.5, -0.5, 0.5, -0.5])])).toBeCloseTo(-6.02, 2);
    expect(rmsDb([new Float32Array(10)])).toBe(-Infinity);
  });
});
