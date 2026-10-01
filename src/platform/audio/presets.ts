import type { SynthLayer, SynthPatch } from './synth';
import type { VoiceRule } from './voices';

/**
 * The sound catalog: every sound effect in the game, synthesized from code (see `synth.ts`).
 * Each preset is a synth patch plus how it plays: voice rules for the limiter, random pitch
 * per play and how many noise variants to pre-render so rapid repeats don't sound identical.
 *
 * Mix levels (`patch.peak`): frequent sounds (shots, hits, blips) sit low, big moments
 * (explosions, Sentencia Firme, the Run ending) high. Priorities: 0 hits, 1 shots, 2 blasts,
 * 3 Rexi and UI, which must always be heard.
 *
 * Presets marked "(future)" are ready for events that later tickets add: map the new event to
 * them in `sound-map.ts`.
 */
export interface SoundPreset extends VoiceRule {
  readonly patch: SynthPatch;
  /** Random playback-rate spread per play, as a fraction (0.06 = ±6 %). */
  readonly pitchJitter: number;
  /** Renders with different noise seeds; each play picks one at random. */
  readonly variants: number;
}

/** A noise `freq` above any sample rate: a fresh random value every sample (white noise). */
const WHITE = 1_000_000;

/** A wooden gavel knock: noise click, wood-block ring, square body and a low thump. */
function gavelKnock(delay = 0, pitch = 1, weight = 1): SynthLayer[] {
  return [
    {
      wave: 'noise',
      freq: WHITE,
      delay,
      env: { decay: 0.012 },
      filter: { type: 'bandpass', cutoff: 3200 * pitch, q: 1.5 },
      gain: 0.8,
    },
    {
      wave: 'sine',
      freq: 1150 * pitch,
      freqEnd: 820 * pitch,
      slide: 0.04,
      delay,
      env: { decay: 0.045 },
      gain: 0.55,
    },
    {
      wave: 'square',
      duty: 0.35,
      freq: 420 * pitch,
      freqEnd: 150 * pitch,
      delay,
      env: { hold: 0.005, decay: 0.065 },
      filter: { type: 'lowpass', cutoff: 2400, cutoffEnd: 500 },
      gain: 0.4,
    },
    {
      wave: 'sine',
      freq: 130 * pitch,
      freqEnd: 55 * pitch,
      delay,
      env: { decay: 0.08 + 0.06 * (weight - 1) },
      gain: 0.7 * weight,
    },
  ];
}

/** Two-note chiptune chime, for menus. `ratio` > 1 rises, < 1 falls. */
function chime(freq: number, ratio: number, wave: 'square' | 'triangle' = 'square'): SynthPatch {
  return {
    peak: 0.28,
    layers: [
      {
        wave,
        duty: 0.5,
        freq,
        steps: [{ at: 0.055, ratio }],
        env: { hold: 0.09, punch: 0.3, decay: 0.08 },
        filter: { type: 'lowpass', cutoff: 5000 },
      },
      {
        wave: 'noise',
        freq: WHITE,
        env: { decay: 0.008 },
        filter: { type: 'highpass', cutoff: 4000 },
        gain: 0.3,
      },
    ],
  };
}

/** One note of the sad trombone: a muted saw whose filter opens like a plunger mute ("wah"). */
function trombone(delay: number, freq: number, hold: number, last = false): SynthLayer {
  return {
    wave: 'saw',
    freq,
    ...(last ? { freqEnd: freq * 0.94, vibrato: { rate: 5.5, depth: 0.03, delay: 0.25 } } : {}),
    delay,
    env: { attack: 0.03, hold, decay: last ? 0.35 : 0.06 },
    filter: { type: 'lowpass', cutoff: 450, cutoffEnd: last ? 700 : 1600, q: 2.5 },
  };
}

/** UI and Rexi sounds share these rules: always heard, never piled up. */
const UI = { priority: 3, pitchJitter: 0, variants: 1 } as const;

export const SOUND_PRESETS = {
  // ── Weapons ────────────────────────────────────────────────────────────────────────────
  /** Mazo Automático: a dry wooden "tok!" with a low thump; varied so rapid fire stays lively. */
  'gavel-thwack': {
    patch: { peak: 0.42, drive: 1.5, layers: gavelKnock() },
    maxVoices: 4,
    priority: 1,
    minGap: 0.03,
    pitchJitter: 0.06,
    variants: 3,
  },
  /** Lluvia de Sellos: a rubber stamp's soft "thunk" with an inky squish. */
  'stamp-thunk': {
    patch: {
      peak: 0.45,
      drive: 1.8,
      layers: [
        { wave: 'sine', freq: 170, freqEnd: 58, env: { hold: 0.01, punch: 0.5, decay: 0.11 } },
        {
          wave: 'triangle',
          freq: 260,
          freqEnd: 120,
          env: { decay: 0.07 },
          filter: { type: 'lowpass', cutoff: 900 },
          gain: 0.5,
        },
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.06 },
          filter: { type: 'lowpass', cutoff: 2200, cutoffEnd: 400 },
          gain: 0.6,
        },
        {
          wave: 'noise',
          freq: 3000,
          delay: 0.015,
          env: { decay: 0.05 },
          filter: { type: 'bandpass', cutoff: 1200, q: 3 },
          gain: 0.25,
        },
      ],
    },
    maxVoices: 4,
    priority: 1,
    minGap: 0.03,
    pitchJitter: 0.08,
    variants: 3,
  },
  /** Mancuernas: iron plates clanging (inharmonic bar partials, two plates beating). */
  'dumbbell-clang': {
    patch: {
      peak: 0.45,
      drive: 1.2,
      layers: [
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.015 },
          filter: { type: 'bandpass', cutoff: 2500, q: 1 },
          gain: 0.8,
        },
        { wave: 'sine', freq: 220, env: { decay: 0.55 }, gain: 0.6 },
        { wave: 'sine', freq: 223.5, env: { decay: 0.5 }, gain: 0.4 },
        { wave: 'sine', freq: 607, env: { decay: 0.35 }, gain: 0.45 },
        { wave: 'sine', freq: 1188, env: { decay: 0.2 }, gain: 0.3 },
        { wave: 'sine', freq: 1965, env: { decay: 0.12 }, gain: 0.2 },
        { wave: 'sine', freq: 110, freqEnd: 50, env: { decay: 0.12 }, gain: 0.7 },
      ],
    },
    maxVoices: 3,
    priority: 1,
    minGap: 0.05,
    pitchJitter: 0.05,
    variants: 1,
  },
  /** Código Penal: a heavy book "whump" and its pages riffling. */
  'book-slam': {
    patch: {
      peak: 0.5,
      drive: 2,
      layers: [
        { wave: 'sine', freq: 95, freqEnd: 40, env: { hold: 0.02, punch: 0.6, decay: 0.2 } },
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.08 },
          filter: { type: 'lowpass', cutoff: 3000, cutoffEnd: 600 },
          gain: 0.7,
        },
        {
          wave: 'noise',
          freq: WHITE,
          delay: 0.02,
          tremolo: { rate: 38, depth: 0.9 },
          env: { attack: 0.02, hold: 0.08, decay: 0.12 },
          filter: { type: 'bandpass', cutoff: 3500, q: 1.2 },
          gain: 0.35,
        },
      ],
    },
    maxVoices: 3,
    priority: 1,
    minGap: 0.05,
    pitchJitter: 0.05,
    variants: 2,
  },
  /** Citaciones Teledirigidas: a summons whistling off on its homing path. */
  'citation-whistle': {
    patch: {
      peak: 0.32,
      layers: [
        {
          wave: 'square',
          duty: 0.25,
          freq: 600,
          freqEnd: 1500,
          slide: 0.18,
          vibrato: { rate: 14, depth: 0.03 },
          env: { attack: 0.01, hold: 0.08, decay: 0.12 },
          filter: { type: 'lowpass', cutoff: 4000 },
          gain: 0.5,
        },
        {
          wave: 'noise',
          freq: WHITE,
          env: { attack: 0.02, decay: 0.15 },
          filter: { type: 'highpass', cutoff: 5000 },
          gain: 0.3,
        },
        { wave: 'sine', freq: 300, freqEnd: 120, env: { decay: 0.04 }, gain: 0.6 },
      ],
    },
    maxVoices: 3,
    priority: 1,
    minGap: 0.05,
    pitchJitter: 0.05,
    variants: 1,
  },
  /** Sentencia Firme: a verdict zap that lands as a huge gavel slam. */
  'verdict-boom': {
    patch: {
      peak: 0.65,
      drive: 2.5,
      layers: [
        {
          wave: 'saw',
          freq: 1400,
          freqEnd: 70,
          slide: 0.35,
          env: { hold: 0.05, decay: 0.3 },
          filter: { type: 'lowpass', cutoff: 6000, cutoffEnd: 800 },
          gain: 0.6,
        },
        ...gavelKnock(0, 0.8, 1.5),
        { wave: 'sine', freq: 70, freqEnd: 28, env: { hold: 0.05, punch: 0.8, decay: 0.5 } },
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.5 },
          filter: { type: 'lowpass', cutoff: 600, cutoffEnd: 120 },
          gain: 0.5,
        },
      ],
    },
    maxVoices: 2,
    priority: 2,
    minGap: 0.1,
    pitchJitter: 0.03,
    variants: 2,
  },

  // ── Enemies ────────────────────────────────────────────────────────────────────────────
  /** A projectile hits an Enemy: a small metallic "tink" on the briefcase. */
  'enemy-tink': {
    patch: {
      peak: 0.22,
      layers: [
        {
          wave: 'square',
          freq: 1400,
          freqEnd: 900,
          slide: 0.03,
          env: { decay: 0.04 },
          filter: { type: 'lowpass', cutoff: 5000 },
          gain: 0.4,
        },
        { wave: 'sine', freq: 2600, env: { decay: 0.055 }, gain: 0.25 },
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.01 },
          filter: { type: 'highpass', cutoff: 3000 },
          gain: 0.5,
        },
      ],
    },
    maxVoices: 3,
    priority: 0,
    minGap: 0.035,
    pitchJitter: 0.12,
    variants: 2,
  },
  /** Maletín-cóptero flings a paper: a papery "fwip". */
  'paper-fwip': {
    patch: {
      peak: 0.2,
      layers: [
        {
          wave: 'noise',
          freq: WHITE,
          env: { attack: 0.015, decay: 0.08 },
          filter: { type: 'bandpass', cutoff: 1200, cutoffEnd: 4200, q: 2 },
        },
        {
          wave: 'noise',
          freq: 400,
          tremolo: { rate: 45, depth: 0.8 },
          env: { decay: 0.07 },
          filter: { type: 'lowpass', cutoff: 2000 },
          gain: 0.3,
        },
      ],
    },
    maxVoices: 2,
    priority: 1,
    minGap: 0.05,
    pitchJitter: 0.1,
    variants: 2,
  },
  /** Caminadora a Reacción's gatling: a short, dry "tat" per bullet of the burst. */
  'gatling-tat': {
    patch: {
      peak: 0.18,
      layers: [
        {
          wave: 'square',
          duty: 0.3,
          freq: 520,
          freqEnd: 180,
          env: { decay: 0.04 },
          filter: { type: 'lowpass', cutoff: 2600, cutoffEnd: 700 },
          gain: 0.6,
        },
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.035 },
          filter: { type: 'bandpass', cutoff: 2200, q: 1.2 },
          gain: 0.7,
        },
      ],
    },
    maxVoices: 3,
    priority: 1,
    minGap: 0.04,
    pitchJitter: 0.1,
    variants: 2,
  },
  /** Heavier Enemy guns: a stubby "pomp" (Archivador Artillado; future: Banca Artillada). */
  'cannon-pomp': {
    patch: {
      peak: 0.3,
      drive: 1.5,
      layers: [
        {
          wave: 'square',
          freq: 200,
          freqEnd: 70,
          env: { decay: 0.12 },
          filter: { type: 'lowpass', cutoff: 1200, cutoffEnd: 300 },
          gain: 0.7,
        },
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.1 },
          filter: { type: 'lowpass', cutoff: 1500, cutoffEnd: 300 },
          gain: 0.6,
        },
        { wave: 'sine', freq: 90, freqEnd: 45, env: { decay: 0.12 }, gain: 0.7 },
      ],
    },
    maxVoices: 3,
    priority: 1,
    minGap: 0.05,
    pitchJitter: 0.08,
    variants: 2,
  },
  /** An Enemy blows up (light craft): crack, rolling noise body, crackle and a sub drop. */
  'explosion-small': {
    patch: {
      peak: 0.55,
      drive: 2.2,
      layers: [
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.05 },
          filter: { type: 'lowpass', cutoff: 7000, cutoffEnd: 1500 },
          gain: 0.8,
        },
        {
          wave: 'noise',
          freq: WHITE,
          env: { hold: 0.03, punch: 0.6, decay: 0.4 },
          filter: { type: 'lowpass', cutoff: 2500, cutoffEnd: 180 },
        },
        {
          wave: 'noise',
          freq: 1400,
          delay: 0.03,
          env: { decay: 0.25 },
          filter: { type: 'bandpass', cutoff: 1500, q: 0.8 },
          gain: 0.35,
        },
        { wave: 'sine', freq: 95, freqEnd: 32, env: { hold: 0.02, decay: 0.3 }, gain: 0.9 },
      ],
    },
    maxVoices: 3,
    priority: 2,
    minGap: 0.06,
    pitchJitter: 0.1,
    variants: 3,
  },
  /** A heavy Enemy blows up: longer, darker, with a second blast and a deep sub. */
  'explosion-large': {
    patch: {
      peak: 0.7,
      drive: 2.6,
      layers: [
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.07 },
          filter: { type: 'lowpass', cutoff: 8000, cutoffEnd: 1200 },
          gain: 0.7,
        },
        {
          wave: 'noise',
          freq: WHITE,
          env: { hold: 0.06, punch: 0.8, decay: 0.85 },
          filter: { type: 'lowpass', cutoff: 1800, cutoffEnd: 90 },
        },
        {
          wave: 'noise',
          freq: WHITE,
          delay: 0.09,
          env: { decay: 0.6 },
          filter: { type: 'lowpass', cutoff: 1200, cutoffEnd: 100 },
          gain: 0.6,
        },
        {
          wave: 'noise',
          freq: 900,
          delay: 0.05,
          env: { attack: 0.02, decay: 0.6 },
          filter: { type: 'bandpass', cutoff: 1100, q: 0.7 },
          gain: 0.3,
        },
        { wave: 'sine', freq: 70, freqEnd: 24, env: { hold: 0.05, decay: 0.7 }, gain: 1.2 },
      ],
    },
    maxVoices: 2,
    priority: 2,
    minGap: 0.1,
    pitchJitter: 0.06,
    variants: 2,
  },

  // ── Rexi and the Run ───────────────────────────────────────────────────────────────────
  /** Rexi gets hit: a growled "¡uf!" (formant-filtered saw) over a body thud. */
  'rexi-oof': {
    patch: {
      peak: 0.5,
      drive: 1.8,
      layers: [
        {
          wave: 'saw',
          freq: 210,
          freqEnd: 95,
          slide: 0.16,
          vibrato: { rate: 28, depth: 0.08 },
          env: { attack: 0.005, hold: 0.04, decay: 0.14 },
          filter: { type: 'bandpass', cutoff: 700, q: 1.5 },
        },
        {
          wave: 'square',
          duty: 0.4,
          freq: 210,
          freqEnd: 95,
          slide: 0.16,
          env: { attack: 0.005, hold: 0.04, decay: 0.14 },
          filter: { type: 'bandpass', cutoff: 1200, q: 3 },
          gain: 0.35,
        },
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.05 },
          filter: { type: 'lowpass', cutoff: 1800 },
          gain: 0.7,
        },
        { wave: 'sine', freq: 140, freqEnd: 60, env: { decay: 0.1 }, gain: 0.8 },
      ],
    },
    maxVoices: 1,
    minGap: 0.1,
    ...UI,
  },
  /** A Run starts: "¡Orden en la sala!", three gavel knocks, the last one heavier. */
  'order-in-court': {
    patch: {
      peak: 0.5,
      drive: 1.5,
      layers: [...gavelKnock(0), ...gavelKnock(0.16), ...gavelKnock(0.34, 0.85, 1.6)],
    },
    maxVoices: 1,
    minGap: 0.5,
    ...UI,
  },
  /** The Run ends: a sad trombone, "wah, wah, wah, waaah". */
  'sad-trombone': {
    patch: {
      peak: 0.45,
      drive: 1.3,
      layers: [
        trombone(0, 311, 0.2),
        trombone(0.32, 294, 0.2),
        trombone(0.64, 277, 0.2),
        trombone(0.96, 262, 0.75, true),
      ],
    },
    maxVoices: 1,
    minGap: 1,
    ...UI,
  },

  // ── Crates, Power-ups and the Dialogue Box ────────────────────────────────────────────
  /** A Crate is picked up: a bright three-step coin arpeggio over a box thump. */
  'crate-pickup': {
    patch: {
      peak: 0.32,
      layers: [
        {
          wave: 'square',
          freq: 880,
          steps: [
            { at: 0.06, ratio: 1.5 },
            { at: 0.12, ratio: 4 / 3 },
          ],
          env: { hold: 0.14, punch: 0.4, decay: 0.14 },
          filter: { type: 'lowpass', cutoff: 6000 },
        },
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.04 },
          filter: { type: 'lowpass', cutoff: 900 },
          gain: 0.4,
        },
      ],
    },
    maxVoices: 2,
    minGap: 0.05,
    ...UI,
  },
  /** A Power-up kicks in: a rising, stair-stepped "power" slide. */
  'power-up-start': {
    patch: {
      peak: 0.32,
      layers: [
        {
          wave: 'square',
          freq: 330,
          freqEnd: 990,
          slide: 0.1,
          repeat: 0.1,
          vibrato: { rate: 8, depth: 0.02 },
          env: { hold: 0.4, decay: 0.15 },
          filter: { type: 'lowpass', cutoff: 5000 },
        },
        {
          wave: 'sine',
          freq: 110,
          freqEnd: 220,
          env: { hold: 0.4, decay: 0.15 },
          gain: 0.3,
        },
      ],
    },
    maxVoices: 1,
    minGap: 0.2,
    ...UI,
  },
  /** A Power-up wears off: the same stairs, falling. */
  'power-up-end': {
    patch: {
      peak: 0.28,
      layers: [
        {
          wave: 'square',
          freq: 900,
          freqEnd: 300,
          slide: 0.08,
          repeat: 0.08,
          env: { hold: 0.3, decay: 0.1 },
          filter: { type: 'lowpass', cutoff: 4000 },
        },
      ],
    },
    maxVoices: 1,
    minGap: 0.2,
    ...UI,
  },
  /** One typewriter character in the Dialogue Box: a short narrow-square beep. */
  'dialogue-blip': {
    patch: {
      peak: 0.16,
      layers: [
        {
          wave: 'square',
          duty: 0.25,
          freq: 760,
          env: { attack: 0.002, hold: 0.02, decay: 0.015 },
          filter: { type: 'lowpass', cutoff: 3500 },
        },
      ],
    },
    maxVoices: 1,
    minGap: 0,
    priority: 3,
    pitchJitter: 0.05,
    variants: 1,
  },

  // ── Menus ──────────────────────────────────────────────────────────────────────────────
  /** Menu selection moves: a typewriter key tick. */
  'menu-move': {
    patch: {
      peak: 0.22,
      layers: [
        {
          wave: 'noise',
          freq: WHITE,
          env: { decay: 0.012 },
          filter: { type: 'bandpass', cutoff: 4500, q: 2 },
          gain: 0.8,
        },
        {
          wave: 'square',
          duty: 0.25,
          freq: 1300,
          env: { decay: 0.025 },
          filter: { type: 'lowpass', cutoff: 6000 },
          gain: 0.3,
        },
      ],
    },
    maxVoices: 2,
    minGap: 0.03,
    ...UI,
  },
  /** A menu choice is confirmed: rising chime. */
  'menu-confirm': { patch: chime(660, 1.5), maxVoices: 2, minGap: 0.05, ...UI },
  /** Leaving a menu for the Title: falling chime. */
  'menu-back': { patch: chime(880, 2 / 3), maxVoices: 2, minGap: 0.05, ...UI },
  /** The pause menu opens: a soft falling triangle chime. */
  pause: { patch: chime(988, 2 / 3, 'triangle'), maxVoices: 1, minGap: 0.05, ...UI },
  /** Back into the Run: a soft rising triangle chime. */
  resume: { patch: chime(659, 1.5, 'triangle'), maxVoices: 1, minGap: 0.05, ...UI },
} as const satisfies Record<string, SoundPreset>;

export type SoundId = keyof typeof SOUND_PRESETS;
