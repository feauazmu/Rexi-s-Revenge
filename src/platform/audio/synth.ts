/**
 * A tiny sfxr-style synthesizer. A sound is a `SynthPatch`: a few layers (oscillator or noise,
 * pitch slide, envelope, filter) mixed and normalized. `renderPatch` turns it into samples
 * offline, in plain TypeScript, so presets are cheap to play (one AudioBuffer each), sound the
 * same in every browser and can be tested in Node.
 *
 * Units: seconds, Hz, linear gain.
 */

export type Waveform = 'square' | 'saw' | 'triangle' | 'sine' | 'noise';

export interface Envelope {
  /** Linear fade-in, seconds. Default 0 (a 1 ms de-click ramp is always applied). */
  readonly attack?: number;
  /** Time at full level after the attack, seconds. Default 0. */
  readonly hold?: number;
  /** Extra level at the start of the hold, fading linearly to 0 by its end (sfxr "punch"). */
  readonly punch?: number;
  /** Fade-out to silence, seconds. Quadratic, so percussive sounds die naturally. */
  readonly decay: number;
}

export interface Filter {
  readonly type: 'lowpass' | 'highpass' | 'bandpass';
  /** Cutoff (or center) frequency at the start of the layer, Hz. */
  readonly cutoff: number;
  /** Cutoff at the end of the layer: the cutoff sweeps exponentially. Default: no sweep. */
  readonly cutoffEnd?: number;
  /** Resonance. Default 0.707 (no peak). */
  readonly q?: number;
}

export interface SynthLayer {
  readonly wave: Waveform;
  /**
   * Start frequency, Hz. For noise, how often a new random value is drawn: the sample rate
   * gives white noise, a few hundred Hz a gritty crackle.
   */
  readonly freq: number;
  /** End frequency of an exponential pitch slide. Default: no slide. */
  readonly freqEnd?: number;
  /** Duration of the slide, seconds. Default: the whole layer. */
  readonly slide?: number;
  /** Restart the slide and steps every this many seconds (sfxr "repeat"). */
  readonly repeat?: number;
  /** Pitch jumps (arpeggio): from `at` seconds the frequency is multiplied by `ratio`. */
  readonly steps?: readonly { readonly at: number; readonly ratio: number }[];
  /** Square wave duty cycle, 0..1. Default 0.5. Narrow duties sound thin and nasal. */
  readonly duty?: number;
  /** Pitch wobble: `depth` is a fraction of the frequency (0.05 = ±5 %). */
  readonly vibrato?: { readonly rate: number; readonly depth: number; readonly delay?: number };
  /** Volume wobble: `depth` 0..1. */
  readonly tremolo?: { readonly rate: number; readonly depth: number };
  readonly env: Envelope;
  /** Mix level relative to the other layers. Default 1. */
  readonly gain?: number;
  /** Start time within the sound, seconds. Default 0. */
  readonly delay?: number;
  readonly filter?: Filter;
}

export interface SynthPatch {
  readonly layers: readonly SynthLayer[];
  /** Absolute level of the loudest sample after mixing, 0..1. */
  readonly peak: number;
  /** Soft-clipping amount applied to the mix (tanh); 0 or absent = clean. */
  readonly drive?: number;
}

const DECLICK_SECONDS = 0.001;

/** Length of one layer, delay included, seconds. */
export function layerDuration(layer: SynthLayer): number {
  const { attack = 0, hold = 0, decay } = layer.env;
  return (layer.delay ?? 0) + attack + hold + decay;
}

/** Length of the whole sound, seconds. */
export function patchDuration(patch: SynthPatch): number {
  return patch.layers.reduce((longest, layer) => Math.max(longest, layerDuration(layer)), 0);
}

/**
 * Renders a patch to mono samples. Deterministic: the same patch, rate and seed always give
 * the same samples (`seed` only changes the noise).
 */
export function renderPatch(patch: SynthPatch, sampleRate: number, seed = 1): Float32Array {
  const out = new Float32Array(Math.ceil(patchDuration(patch) * sampleRate));
  patch.layers.forEach((layer, index) => {
    renderLayer(layer, sampleRate, seed * 7919 + index, out);
  });

  const drive = patch.drive ?? 0;
  if (drive > 0) for (let i = 0; i < out.length; i++) out[i] = Math.tanh((out[i] ?? 0) * drive);

  let max = 0;
  for (const s of out) max = Math.max(max, Math.abs(s));
  if (max > 0) {
    const scale = patch.peak / max;
    for (let i = 0; i < out.length; i++) out[i] = (out[i] ?? 0) * scale;
  }
  return out;
}

/** Adds one layer into `out`. */
function renderLayer(layer: SynthLayer, sampleRate: number, seed: number, out: Float32Array) {
  const start = Math.round((layer.delay ?? 0) * sampleRate);
  const length = Math.min(
    out.length - start,
    Math.ceil((layerDuration(layer) - (layer.delay ?? 0)) * sampleRate),
  );
  const lifetime = length / sampleRate;
  const gain = layer.gain ?? 1;
  const random = noiseSource(seed);
  const filter = layer.filter ? createFilter(layer.filter, lifetime, sampleRate) : null;

  let phase = 0;
  let noiseValue = random();
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const freq = frequencyAt(layer, t);
    phase += freq / sampleRate;
    if (phase >= 1) {
      phase -= Math.floor(phase);
      noiseValue = random();
    }
    let sample = layer.wave === 'noise' ? noiseValue : oscillator(layer, phase);
    if (filter) sample = filter(sample, t);
    let level = envelopeAt(layer.env, t) * Math.min(1, t / DECLICK_SECONDS);
    if (layer.tremolo) {
      const { rate, depth } = layer.tremolo;
      level *= 1 - depth * 0.5 * (1 - Math.cos(2 * Math.PI * rate * t));
    }
    const index = start + i;
    out[index] = (out[index] ?? 0) + sample * level * gain;
  }
}

function oscillator(layer: SynthLayer, phase: number): number {
  switch (layer.wave) {
    case 'square':
      return phase < (layer.duty ?? 0.5) ? 1 : -1;
    case 'saw':
      return 2 * phase - 1;
    case 'triangle':
      return phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
    case 'sine':
    case 'noise':
      return Math.sin(2 * Math.PI * phase);
  }
}

function frequencyAt(layer: SynthLayer, t: number): number {
  const local = layer.repeat ? t % layer.repeat : t;
  let freq = layer.freq;
  if (layer.freqEnd !== undefined) {
    const slide = layer.slide ?? layerDuration(layer) - (layer.delay ?? 0);
    const progress = slide > 0 ? Math.min(1, local / slide) : 1;
    freq = layer.freq * Math.pow(layer.freqEnd / layer.freq, progress);
  }
  for (const step of layer.steps ?? []) if (local >= step.at) freq *= step.ratio;
  if (layer.vibrato) {
    const { rate, depth, delay = 0 } = layer.vibrato;
    if (t >= delay) freq *= 1 + depth * Math.sin(2 * Math.PI * rate * (t - delay));
  }
  return freq;
}

function envelopeAt(env: Envelope, t: number): number {
  const { attack = 0, hold = 0, punch = 0, decay } = env;
  if (t < attack) return t / attack;
  const inHold = t - attack;
  if (inHold < hold) return 1 + punch * (1 - inHold / hold);
  const inDecay = inHold - hold;
  if (decay <= 0 || inDecay >= decay) return 0;
  const left = 1 - inDecay / decay;
  return left * left;
}

/** Seeded white noise in [-1, 1) (mulberry32). */
function noiseSource(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/**
 * A state-variable filter in its zero-delay (trapezoidal) form: stable at any cutoff and
 * resonance, even while the cutoff sweeps.
 */
function createFilter(filter: Filter, lifetime: number, sampleRate: number) {
  const nyquistGuard = sampleRate * 0.49;
  const k = 1 / (filter.q ?? Math.SQRT1_2);
  const end = filter.cutoffEnd ?? filter.cutoff;
  let ic1 = 0;
  let ic2 = 0;
  return (input: number, t: number): number => {
    const progress = lifetime > 0 ? Math.min(1, t / lifetime) : 0;
    const cutoff = Math.min(nyquistGuard, filter.cutoff * Math.pow(end / filter.cutoff, progress));
    const g = Math.tan((Math.PI * cutoff) / sampleRate);
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;
    const v3 = input - ic2;
    const v1 = a1 * ic1 + a2 * v3;
    const v2 = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * v1 - ic1;
    ic2 = 2 * v2 - ic2;
    switch (filter.type) {
      case 'lowpass':
        return v2;
      case 'bandpass':
        return v1;
      case 'highpass':
        return input - k * v1 - v2;
    }
  };
}
