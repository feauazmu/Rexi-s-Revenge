/**
 * Pure loop-point math for `make-music-loop.ts`: find a bar-aligned loop in a generated clip,
 * crossfade its seam and lay it out with padding for a looping `AudioBufferSourceNode`.
 * Everything works on plain Float32Array channels; no I/O.
 */

/** Whole samples in `bars` bars at `bpm` (default 4/4). */
export function barsToSamples(bars: number, bpm: number, sampleRate: number, beatsPerBar = 4) {
  return Math.round((bars * beatsPerBar * 60 * sampleRate) / bpm);
}

/**
 * Normalized cross-correlation of `signal[a…a+window)` and `signal[b…b+window)`, reading every
 * `step`th sample: 1 = identical shape, 0 = unrelated (or silent), -1 = inverted.
 */
export function normalizedCrossCorrelation(
  signal: Float32Array,
  a: number,
  b: number,
  window: number,
  step = 1,
): number {
  let ab = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < window; i += step) {
    const x = signal[a + i] ?? 0;
    const y = signal[b + i] ?? 0;
    ab += x * y;
    aa += x * x;
    bb += y * y;
  }
  const norm = Math.sqrt(aa * bb);
  return norm > 1e-12 ? ab / norm : 0;
}

export interface FindLoopOptions {
  /** Tempo of the clip (the prompt asked for it; check it against the clip). */
  readonly bpm: number;
  /** Candidate loop lengths in bars; the longest one that repeats wins. */
  readonly bars: readonly number[];
  readonly beatsPerBar?: number;
  /** Range of loop starts to try, seconds (skip the generator's intro). */
  readonly searchFrom: number;
  readonly searchTo: number;
  /** Start grid, seconds. Default 0.005. */
  readonly startStep?: number;
  /** Comparison window centred on the seam, seconds. Default 0.5. */
  readonly window?: number;
  /** The length is refined by up to ± this many seconds (generated tempo drifts). Default 0.015. */
  readonly refine?: number;
  /** A bar count "repeats" when its best seam scores at least this. Default 0.8. */
  readonly minScore?: number;
  /** Read every `decimate`th sample in the coarse start scan. Default 4. */
  readonly decimate?: number;
}

export interface Loop {
  /** First sample of the loop body. */
  readonly start: number;
  /** Body length in samples. */
  readonly length: number;
  readonly bars: number;
  /** Normalized cross-correlation around the seam (1 = the two passes are identical there). */
  readonly score: number;
}

/**
 * Finds the loop to cut from `mono`. For each bar count it scans the starts and compares the
 * audio around the start with the audio one loop later (a window centred on the seam, since the
 * crossfade blends exactly those two places), then refines the length sample by sample. The
 * longest bar count scoring at least `minScore` wins; failing that, the best score.
 */
export function findLoop(mono: Float32Array, sampleRate: number, options: FindLoopOptions): Loop {
  const half = Math.round(((options.window ?? 0.5) * sampleRate) / 2);
  const window = half * 2;
  const step = Math.max(1, Math.round((options.startStep ?? 0.005) * sampleRate));
  const refine = Math.round((options.refine ?? 0.015) * sampleRate);
  const decimate = options.decimate ?? 4;
  const minScore = options.minScore ?? 0.8;
  const first = Math.max(half, Math.round(options.searchFrom * sampleRate));
  const last = Math.round(options.searchTo * sampleRate);

  const found: Loop[] = [];
  for (const bars of options.bars) {
    const nominal = barsToSamples(bars, options.bpm, sampleRate, options.beatsPerBar);
    const fits = (start: number, length: number) => start + length + half <= mono.length;
    let best: Loop | null = null;
    for (let start = first; start <= last && fits(start, nominal + refine); start += step) {
      const score = normalizedCrossCorrelation(
        mono,
        start - half,
        start - half + nominal,
        window,
        decimate,
      );
      if (!best || score > best.score) best = { start, length: nominal, bars, score };
    }
    if (!best) continue;
    let refined = best;
    for (let length = nominal - refine; length <= nominal + refine; length++) {
      const score = normalizedCrossCorrelation(
        mono,
        best.start - half,
        best.start - half + length,
        window,
      );
      if (score > refined.score || (length === nominal && refined === best)) {
        refined = { ...best, length, score };
      }
    }
    found.push(refined);
  }
  if (found.length === 0) throw new Error('Clip too short for any of these loop lengths');
  const repeating = found.filter((loop) => loop.score >= minScore);
  if (repeating.length > 0) {
    return repeating.reduce((a, b) => (b.bars > a.bars ? b : a));
  }
  return found.reduce((a, b) => (b.score > a.score ? b : a));
}

/**
 * The loop body `channel[start…start+length)` with an equal-power crossfade over its last
 * `fade` samples into the audio just before `start`, so the jump from the body's last sample
 * back to its first continues the clip as it was recorded.
 */
export function crossfadeSeam(
  channel: Float32Array,
  start: number,
  length: number,
  fade: number,
): Float32Array {
  const body = channel.slice(start, start + length);
  const f = Math.min(fade, start, length);
  for (let i = 0; i < f; i++) {
    const t = (i + 0.5) / f;
    const k = length - f + i;
    const before = channel[start - f + i] ?? 0;
    body[k] = (body[k] ?? 0) * Math.cos((t * Math.PI) / 2) + before * Math.sin((t * Math.PI) / 2);
  }
  return body;
}

/**
 * Lays the body out as `[last pad samples][body][first pad samples]` and returns the loop points
 * in samples. The audio around both loop points is identical for ±pad, so a constant offset the
 * decoder adds (MP3 encoder delay, resampling) keeps the loop seamless.
 */
export function layoutLoop(body: Float32Array, pad: number) {
  const length = body.length;
  const samples = new Float32Array(pad + length + pad);
  samples.set(body.subarray(length - pad), 0);
  samples.set(body, pad);
  samples.set(body.subarray(0, pad), pad + length);
  return { samples, loopStart: pad, loopEnd: pad + length };
}

/** Loudness of `channels` as RMS in dBFS (a full-scale square wave is 0 dB). */
export function rmsDb(channels: readonly Float32Array[]): number {
  let sum = 0;
  let count = 0;
  for (const channel of channels) {
    for (const v of channel) sum += v * v;
    count += channel.length;
  }
  return count > 0 && sum > 0 ? 10 * Math.log10(sum / count) : -Infinity;
}

/**
 * Estimates the tempo between `minBpm` and `maxBpm`: autocorrelation of the onset envelope
 * (positive changes of log energy in 5 ms hops), with a parabolic peak fit.
 */
export function estimateBpm(mono: Float32Array, sampleRate: number, minBpm = 80, maxBpm = 180) {
  const hop = Math.max(1, Math.round(sampleRate * 0.005));
  const onsets: number[] = [];
  let previous = 0;
  for (let s = 0; s + hop <= mono.length; s += hop) {
    let energy = 0;
    for (let i = s; i < s + hop; i++) energy += (mono[i] ?? 0) ** 2;
    const level = Math.log(energy + 1e-9);
    onsets.push(Math.max(0, level - previous));
    previous = level;
  }
  const hopsPerSecond = sampleRate / hop;
  const lagFor = (bpm: number) => (60 * hopsPerSecond) / bpm;
  const correlation = (lag: number) => {
    let sum = 0;
    for (let i = 0; i + lag < onsets.length; i++) sum += (onsets[i] ?? 0) * (onsets[i + lag] ?? 0);
    return sum / (onsets.length - lag);
  };
  let bestLag = 0;
  let best = -Infinity;
  for (let lag = Math.floor(lagFor(maxBpm)); lag <= Math.ceil(lagFor(minBpm)); lag++) {
    const value = correlation(lag);
    if (value > best) {
      best = value;
      bestLag = lag;
    }
  }
  const left = correlation(bestLag - 1);
  const right = correlation(bestLag + 1);
  const curvature = left - 2 * best + right;
  const offset = curvature < 0 ? (0.5 * (left - right)) / curvature : 0;
  return (60 * hopsPerSecond) / (bestLag + offset);
}

/** The gain that brings the loudest sample of `channels` to `targetPeak` (1 for silence). */
export function peakGainFor(channels: readonly Float32Array[], targetPeak: number): number {
  let peak = 0;
  for (const channel of channels) for (const v of channel) peak = Math.max(peak, Math.abs(v));
  return peak > 0 ? targetPeak / peak : 1;
}
