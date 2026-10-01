import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../../src/core';
import {
  createAudioEngine,
  MUSIC_LEVEL,
  type AudioEngineOptions,
  type AudioStatus,
} from '../../../src/platform/audio/engine';
import { SOUND_PRESETS } from '../../../src/platform/audio/presets';
import { patchDuration } from '../../../src/platform/audio/synth';

// ── A minimal fake of the Web Audio API: just what the engine touches, recording calls. ──

class FakeParam {
  constructor(public value: number) {}
  setTargetAtTime(target: number) {
    this.value = target;
    return this;
  }
  setValueAtTime(value: number) {
    this.value = value;
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

class FakeNode {
  readonly outputs: FakeNode[] = [];
  connect<T extends FakeNode>(node: T): T {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.outputs.length = 0;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0);
}

class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0.003);
  readonly release = new FakeParam(0.25);
}

class FakeBuffer {
  readonly data: Float32Array;
  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = new Float32Array(length);
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData() {
    return this.data;
  }
}

class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  readonly playbackRate = new FakeParam(1);
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  onended: (() => void) | null = null;
  start(when = 0) {
    this.startedAt = when;
  }
  stop(when = 0) {
    this.stoppedAt = when;
  }
}

class FakeContext {
  state: AudioContextState = 'suspended';
  currentTime = 0;
  readonly sampleRate = 8000; // low rate keeps preset rendering fast in tests
  readonly destination = new FakeNode();
  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  onstatechange: (() => void) | null = null;
  resumeCalls = 0;

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createStereoPanner() {
    return new FakePanner();
  }
  createDynamicsCompressor() {
    return new FakeCompressor();
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    return new FakeBuffer(channels, length, sampleRate);
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  resume() {
    this.resumeCalls++;
    this.state = 'running';
    this.onstatechange?.();
    return Promise.resolve();
  }
}

/** Follows the first output of each node until the destination: the node path of `from`. */
function pathFrom(from: FakeNode, context: FakeContext): FakeNode[] {
  const path = [from];
  let node = from;
  while (node !== context.destination) {
    const next = node.outputs[0];
    if (!next) break;
    path.push(next);
    node = next;
  }
  return path;
}

function setup(options: Partial<AudioEngineOptions> = {}) {
  const context = new FakeContext();
  const statuses: AudioStatus[] = [];
  let created = 0;
  const engine = createAudioEngine({
    createContext: () => {
      created++;
      return context as unknown as AudioContext;
    },
    random: () => 0.5,
    onStatusChange: (status) => statuses.push(status),
    ...options,
  });
  return { engine, context, statuses, created: () => created };
}

const fired: GameEvent = { type: 'weapon-fired', weapon: 'mazo-automatico' };
const destroyedAt = (x: number): GameEvent => ({
  type: 'enemy-destroyed',
  enemyId: 1,
  kind: 'maletin-coptero',
  craft: 'lawyer',
  points: 100,
  x,
  y: 100,
});
function firstSource(context: FakeContext): FakeSource {
  const [source] = context.sources;
  if (!source) throw new Error('No sound was played');
  return source;
}
const playing = (context: FakeContext) => context.sources.filter((s) => s.stoppedAt === null);

describe('createAudioEngine', () => {
  it('stays silent and creates nothing until the first user gesture unlocks it', () => {
    const { engine, created, statuses } = setup();
    engine.handleEvents([fired]);
    expect(created()).toBe(0);
    expect(engine.status.state).toBe('locked');
    expect(statuses.at(-1)?.state).toBe('locked');
  });

  it('creates and resumes the audio context on unlock, once', () => {
    const { engine, context, created, statuses } = setup();
    engine.unlock();
    engine.unlock();
    expect(created()).toBe(1);
    expect(context.resumeCalls).toBe(1);
    expect(engine.status.state).toBe('running');
    expect(statuses.at(-1)?.state).toBe('running');
  });

  it('resumes again on a later gesture if the browser suspended the context', () => {
    const { engine, context } = setup();
    engine.unlock();
    context.state = 'suspended';
    context.onstatechange?.();
    expect(engine.status.state).toBe('suspended');
    engine.unlock();
    expect(context.resumeCalls).toBe(2);
    expect(engine.status.state).toBe('running');
  });

  it('reports audio as unavailable when the context cannot be created', () => {
    const { engine } = setup({
      createContext: () => {
        throw new Error('no audio here');
      },
    });
    engine.unlock();
    engine.handleEvents([fired]);
    expect(engine.status.state).toBe('unavailable');
  });

  it('plays the event’s preset through the effects bus into the destination', () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.handleEvents([fired]);
    const source = firstSource(context);
    expect(source.startedAt).toBe(0);
    expect(source.buffer?.duration).toBeCloseTo(
      patchDuration(SOUND_PRESETS['gavel-thwack'].patch),
      3,
    );
    expect(pathFrom(source, context).at(-1)).toBe(context.destination);
  });

  it('ignores silent events', () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.handleEvents([{ type: 'enemy-spawned', enemyId: 1, kind: 'maletin-coptero' }]);
    expect(context.sources).toEqual([]);
  });

  it('limits voices: a chain of explosions steals the oldest instead of piling up', () => {
    const { engine, context } = setup();
    engine.unlock();
    for (let i = 0; i < 6; i++) {
      context.currentTime = i * 0.07; // faster than each blast rings out
      engine.handleEvents([destroyedAt(240)]);
    }
    const { maxVoices } = SOUND_PRESETS['explosion-small'];
    expect(context.sources).toHaveLength(6);
    expect(playing(context)).toHaveLength(maxVoices);
    expect(context.sources.slice(0, 6 - maxVoices).every((s) => s.stoppedAt !== null)).toBe(true);
  });

  it('drops duplicates of a sound within one tick', () => {
    const { engine, context } = setup();
    engine.unlock();
    const hit: GameEvent = { type: 'enemy-hit', enemyId: 1, kind: 'maletin-coptero', damage: 1 };
    engine.handleEvents([hit, hit, hit]);
    expect(context.sources).toHaveLength(1);
  });

  it('starts with the persisted mute applied to the music bus, and follows mute-toggled', () => {
    const { engine } = setup();
    engine.setMusicMuted(true);
    engine.unlock();
    const buses: FakeGain[] = [];
    engine.connectMusic((_context, musicBus) => {
      buses.push(musicBus as unknown as FakeGain);
    });
    const level = () => buses[0]?.gain.value;
    expect(level()).toBe(0);
    engine.handleEvents([{ type: 'mute-toggled', muted: false }]);
    expect(level()).toBe(MUSIC_LEVEL);
    expect(engine.status.musicMuted).toBe(false);
    engine.handleEvents([{ type: 'mute-toggled', muted: true }]);
    expect(level()).toBe(0);
  });

  it('mute leaves sound effects alone', () => {
    const { engine, context } = setup();
    engine.setMusicMuted(true);
    engine.unlock();
    engine.handleEvents([fired]);
    const path = pathFrom(firstSource(context), context);
    expect(path.every((node) => !(node instanceof FakeGain) || node.gain.value > 0)).toBe(true);
  });

  it('hands the music bus to the music player once audio is unlocked', () => {
    const { engine, context } = setup();
    const plugged: unknown[] = [];
    engine.connectMusic((ctx, bus) => plugged.push(ctx, bus));
    expect(plugged).toEqual([]);
    engine.unlock();
    expect(plugged[0]).toBe(context);
    expect(pathFrom(plugged[1] as FakeNode, context).at(-1)).toBe(context.destination);
  });

  it('pans positional sounds', () => {
    const { engine, context } = setup();
    engine.unlock();
    engine.handleEvents([destroyedAt(0)]);
    const path = pathFrom(firstSource(context), context);
    const panner = path.find((node) => node instanceof FakePanner);
    expect(panner?.pan.value).toBeLessThan(0);
  });
});
