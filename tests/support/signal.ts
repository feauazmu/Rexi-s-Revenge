/** Measurements on rendered sample buffers, for audio tests. */

/** The samples between `from` and `to` seconds. */
export function slice(samples: Float32Array, sampleRate: number, from: number, to: number) {
  return samples.slice(Math.round(from * sampleRate), Math.round(to * sampleRate));
}

/** Largest absolute sample value. */
export function peak(samples: Float32Array): number {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  return max;
}

/** Root mean square level. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

/** Sign changes per second: about twice the frequency of a periodic signal. */
export function zeroCrossingsPerSecond(samples: Float32Array, sampleRate: number): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] ?? 0;
    const b = samples[i] ?? 0;
    if ((a < 0 && b >= 0) || (a >= 0 && b < 0)) crossings++;
  }
  return (crossings * sampleRate) / samples.length;
}

/**
 * Share of the signal's energy in its sample-to-sample changes: a cheap proxy for how much
 * high-frequency content it has (0 for DC, 2 for alternating ±1 at Nyquist).
 */
export function brightness(samples: Float32Array): number {
  let energy = 0;
  let change = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] ?? 0;
    const b = samples[i] ?? 0;
    energy += b * b;
    change += (b - a) * (b - a);
  }
  return energy === 0 ? 0 : change / energy;
}

/** Duration in seconds of the part of the sound louder than `threshold` × its peak. */
export function audibleSeconds(samples: Float32Array, sampleRate: number, threshold = 0.05) {
  const limit = peak(samples) * threshold;
  let last = 0;
  for (let i = 0; i < samples.length; i++) if (Math.abs(samples[i] ?? 0) > limit) last = i;
  return last / sampleRate;
}
