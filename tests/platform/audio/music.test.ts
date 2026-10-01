import { describe, expect, it } from 'vitest';
import {
  createMusicPlug,
  type MusicState,
  type MusicTrack,
} from '../../../src/platform/audio/music';
import { MUSIC_TRACK } from '../../../src/platform/audio/music-track';

// ── A minimal fake of the Web Audio pieces the music player touches. ──

class FakeNode {
  readonly outputs: unknown[] = [];
  connect(node: unknown) {
    this.outputs.push(node);
    return node;
  }
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  started: [number, number] | null = null;
  start(when: number, offset: number) {
    this.started = [when, offset];
  }
}

class FakeContext {
  readonly sources: FakeSource[] = [];
  readonly decoded: ArrayBuffer[] = [];
  decodeResult: Promise<unknown> = Promise.resolve({ duration: 30 });
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData(bytes: ArrayBuffer) {
    this.decoded.push(bytes);
    return this.decodeResult;
  }
}

const track: MusicTrack = { file: 'music/theme.mp3', loopStart: 0.5, loopEnd: 27.93 };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(load?: () => Promise<ArrayBuffer>) {
  const bytes = new ArrayBuffer(8);
  const loads: string[] = [];
  const states: MusicState[] = [];
  const plug = createMusicPlug({
    track,
    load:
      load ??
      ((file) => {
        loads.push(file);
        return Promise.resolve(bytes);
      }),
    onStateChange: (state) => states.push(state),
  });
  const context = new FakeContext();
  const bus = new FakeNode();
  const connect = () => {
    plug(context as unknown as AudioContext, bus as unknown as AudioNode);
  };
  return { bytes, loads, states, context, bus, connect };
}

describe('createMusicPlug', () => {
  it('starts loading the track right away, before audio is unlocked', () => {
    const { loads, states } = setup();
    expect(loads).toEqual(['music/theme.mp3']);
    expect(states).toEqual(['loading']);
  });

  it('decodes the track and loops it on the music bus with explicit loop points', async () => {
    const { bytes, context, bus, connect, states } = setup();
    connect();
    await flush();
    expect(context.decoded).toEqual([bytes]);
    const [source] = context.sources;
    expect(context.sources).toHaveLength(1);
    expect(source?.buffer).toEqual({ duration: 30 });
    expect(source?.loop).toBe(true);
    expect(source?.loopStart).toBe(0.5);
    expect(source?.loopEnd).toBe(27.93);
    expect(source?.outputs).toEqual([bus]);
    // Starts inside the loop: the padding before loopStart is only there for the seam.
    expect(source?.started).toEqual([0, 0.5]);
    expect(states.at(-1)).toBe('playing');
  });

  it('plays a single looping source however often it is plugged in (it never restarts)', async () => {
    const { context, connect } = setup();
    connect();
    connect();
    await flush();
    connect();
    await flush();
    expect(context.sources).toHaveLength(1);
  });

  it('reports a failed load or decode instead of throwing, and plays nothing', async () => {
    const failedLoad = setup(() => Promise.reject(new Error('404')));
    failedLoad.connect();
    await flush();
    expect(failedLoad.context.sources).toHaveLength(0);
    expect(failedLoad.states.at(-1)).toBe('failed');

    const failedDecode = setup();
    failedDecode.context.decodeResult = Promise.reject(new Error('bad mp3'));
    failedDecode.connect();
    await flush();
    expect(failedDecode.context.sources).toHaveLength(0);
    expect(failedDecode.states.at(-1)).toBe('failed');
  });

  it('refuses loop points that would make the source loop the whole buffer', () => {
    expect(() =>
      createMusicPlug({
        track: { ...track, loopEnd: 0.5 },
        load: () => Promise.resolve(new ArrayBuffer(0)),
      }),
    ).toThrow(/loopEnd/);
  });
});

describe('MUSIC_TRACK', () => {
  it('is a bar-aligned loop with padding on both sides', () => {
    expect(MUSIC_TRACK.file).toMatch(/^music\/.+\.mp3$/);
    expect(MUSIC_TRACK.loopStart).toBeGreaterThan(0.2);
    // 16 bars of 4/4 at 140 BPM, within a few milliseconds of generator tempo drift.
    expect(MUSIC_TRACK.loopEnd - MUSIC_TRACK.loopStart).toBeCloseTo((16 * 4 * 60) / 140, 2);
  });
});
