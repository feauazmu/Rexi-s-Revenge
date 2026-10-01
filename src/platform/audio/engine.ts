import type { GameEvent } from '../../core';
import { SOUND_PRESETS, type SoundId } from './presets';
import { soundForEvent, type SoundCue } from './sound-map';
import { renderPatch } from './synth';
import { createVoiceLimiter, type VoiceLimiter } from './voices';

/**
 * The Web Audio engine. It turns Game events into sound effects and owns the mix:
 *
 *   voices ─► effects bus ─┐
 *                          ├─► master ─► compressor ─► speakers
 *   music  ─► music bus  ──┘   (mute "Silenciar música" only touches the music bus)
 *
 * Browsers only allow audio after a user gesture, so nothing is created until `unlock` is
 * called from one (see `listenForAudioUnlock`). Every preset is then rendered once into an
 * AudioBuffer; playing a sound is one buffer source through a gain (and panner).
 */

export type AudioState = 'locked' | 'running' | 'suspended' | 'unavailable';

export interface AudioStatus {
  readonly state: AudioState;
  readonly musicMuted: boolean;
}

export interface AudioEngineOptions {
  /** Default: a new `AudioContext`. */
  readonly createContext?: () => AudioContext;
  /** Randomness for pitch jitter and variant choice. Default: `Math.random`. */
  readonly random?: () => number;
  /** Called with the new status whenever the context state or the mute changes. */
  readonly onStatusChange?: (status: AudioStatus) => void;
}

/** Plugs a music player into the music bus (see `AudioEngine.connectMusic`). */
export type MusicPlug = (context: AudioContext, musicBus: AudioNode) => void;

export interface AudioEngine {
  /** Creates or resumes the audio context. Call it from a user gesture handler. */
  unlock(): void;
  /** Plays the sounds for one tick's events and applies `mute-toggled`. */
  handleEvents(events: readonly GameEvent[]): void;
  setMusicMuted(muted: boolean): void;
  /**
   * Calls `plug` with the context and the music bus once audio is unlocked (right away if it
   * already is). The music player connects its looping source to the bus; mute is handled here.
   */
  connectMusic(plug: MusicPlug): void;
  readonly status: AudioStatus;
}

/** Music bus level when not muted. */
export const MUSIC_LEVEL = 0.55;
/** Sound effects never exceed this many voices together. */
const MAX_VOICES = 14;
/** Time constant of mute fades, seconds (about 0.1 s to silence, no click). */
const MUTE_FADE = 0.025;
/** Fade applied to a voice stolen by the limiter, seconds. */
const STEAL_FADE = 0.004;

interface Graph {
  readonly context: AudioContext;
  readonly effects: GainNode;
  readonly music: GainNode;
  readonly buffers: ReadonlyMap<SoundId, readonly AudioBuffer[]>;
  readonly limiter: VoiceLimiter<SoundId>;
  readonly voices: Map<number, { source: AudioBufferSourceNode; gain: GainNode }>;
}

export function createAudioEngine(options: AudioEngineOptions = {}): AudioEngine {
  const random = options.random ?? Math.random;
  let musicMuted = false;
  let graph: Graph | null = null;
  let unavailable = false;
  let pendingMusic: MusicPlug[] = [];

  const state = (): AudioState => {
    if (unavailable) return 'unavailable';
    if (!graph) return 'locked';
    return graph.context.state === 'running' ? 'running' : 'suspended';
  };
  const status = (): AudioStatus => ({ state: state(), musicMuted });
  const notify = () => options.onStatusChange?.(status());

  const build = (): Graph | null => {
    let context: AudioContext;
    try {
      context = options.createContext ? options.createContext() : new AudioContext();
    } catch {
      unavailable = true;
      return null;
    }
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.knee.value = 6;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.15;
    compressor.connect(context.destination);
    const master = context.createGain();
    master.gain.value = 0.9;
    master.connect(compressor);
    const effects = context.createGain();
    effects.connect(master);
    const music = context.createGain();
    music.gain.value = musicMuted ? 0 : MUSIC_LEVEL;
    music.connect(master);
    context.onstatechange = notify;
    return {
      context,
      effects,
      music,
      buffers: renderBuffers(context),
      limiter: createVoiceLimiter((sound) => SOUND_PRESETS[sound], MAX_VOICES),
      voices: new Map(),
    };
  };

  const play = (g: Graph, cue: SoundCue) => {
    const preset = SOUND_PRESETS[cue.sound];
    const variants = g.buffers.get(cue.sound) ?? [];
    const buffer = variants[Math.floor(random() * variants.length)];
    if (!buffer) return;
    const rate = 1 + (random() * 2 - 1) * preset.pitchJitter;
    const now = g.context.currentTime;
    const grant = g.limiter.request(cue.sound, now, buffer.duration / rate);
    if (!grant) return;
    for (const id of grant.steal) {
      const voice = g.voices.get(id);
      if (!voice) continue;
      voice.gain.gain.setTargetAtTime(0, now, STEAL_FADE);
      voice.source.stop(now + STEAL_FADE * 5);
      g.voices.delete(id);
    }

    const source = g.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = g.context.createGain();
    source.connect(gain);
    let output: AudioNode = gain;
    if (cue.pan) {
      const panner = g.context.createStereoPanner();
      panner.pan.value = cue.pan;
      output = gain.connect(panner);
    }
    output.connect(g.effects);
    source.onended = () => {
      source.disconnect();
      output.disconnect();
      if (g.voices.get(grant.id)?.source === source) g.voices.delete(grant.id);
    };
    g.voices.set(grant.id, { source, gain });
    source.start(now);
  };

  const setMusicMuted = (muted: boolean) => {
    if (muted === musicMuted) return;
    musicMuted = muted;
    if (graph) {
      const { music, context } = graph;
      music.gain.cancelScheduledValues(context.currentTime);
      music.gain.setTargetAtTime(musicMuted ? 0 : MUSIC_LEVEL, context.currentTime, MUTE_FADE);
    }
    notify();
  };

  notify();
  return {
    unlock() {
      if (unavailable) return;
      if (!graph) {
        graph = build();
        if (!graph) {
          notify();
          return;
        }
        const plugs = pendingMusic;
        pendingMusic = [];
        for (const plug of plugs) plug(graph.context, graph.music);
      }
      if (graph.context.state !== 'running') {
        // A rejected resume (no gesture yet) is retried on the next gesture.
        graph.context.resume().then(notify, () => undefined);
      }
      notify();
    },

    handleEvents(events) {
      for (const event of events) {
        if (event.type === 'mute-toggled') setMusicMuted(event.muted);
        if (!graph) continue;
        const cue = soundForEvent(event);
        if (cue) play(graph, cue);
      }
    },

    setMusicMuted,

    connectMusic(plug) {
      if (graph) plug(graph.context, graph.music);
      else pendingMusic.push(plug);
    },

    get status() {
      return status();
    },
  };
}

/** Renders every preset's variants into AudioBuffers at the context's sample rate. */
function renderBuffers(context: AudioContext): Map<SoundId, AudioBuffer[]> {
  const buffers = new Map<SoundId, AudioBuffer[]>();
  for (const id of Object.keys(SOUND_PRESETS) as SoundId[]) {
    const preset = SOUND_PRESETS[id];
    const variants: AudioBuffer[] = [];
    for (let seed = 1; seed <= preset.variants; seed++) {
      const samples = renderPatch(preset.patch, context.sampleRate, seed);
      const buffer = context.createBuffer(1, Math.max(1, samples.length), context.sampleRate);
      buffer.getChannelData(0).set(samples);
      variants.push(buffer);
    }
    buffers.set(id, variants);
  }
  return buffers;
}

/**
 * Unlocks audio on the user's gestures. It keeps listening after the first one, because
 * browsers can suspend the context later (iOS interruptions) and only a gesture resumes it.
 * Returns a function that stops listening.
 */
export function listenForAudioUnlock(target: Window, engine: AudioEngine): () => void {
  const gestures = ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click'] as const;
  const onGesture = () => {
    if (engine.status.state === 'running') return;
    // Only events that grant user activation may start audio; others would only log warnings.
    if ('userActivation' in navigator && !navigator.userActivation.isActive) return;
    engine.unlock();
  };
  for (const type of gestures) target.addEventListener(type, onGesture, { capture: true });
  return () => {
    for (const type of gestures) target.removeEventListener(type, onGesture, { capture: true });
  };
}
