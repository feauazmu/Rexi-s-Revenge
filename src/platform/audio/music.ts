import type { MusicPlug } from './engine';

/**
 * The music player: one looping buffer source on the engine's music bus, started once audio is
 * unlocked and never stopped, so the soundtrack runs on across Title, Run and Veredicto. Mute is
 * the engine's job (it fades the music bus).
 *
 * The file is a loop body padded on both sides with its own wrap-around audio
 * (`scripts/music-loop/make-music-loop.ts`); `loopStart`/`loopEnd` mark the body. A buffer source
 * loops sample-accurately in every engine, unlike `<audio loop>`.
 */

export interface MusicTrack {
  /** Path of the MP3 relative to the site base (`public/`). */
  readonly file: string;
  /** Loop points in seconds of the decoded buffer. */
  readonly loopStart: number;
  readonly loopEnd: number;
}

export type MusicState = 'loading' | 'playing' | 'failed';

export interface MusicPlayerOptions {
  readonly track: MusicTrack;
  /** Fetches the encoded file. */
  readonly load: (file: string) => Promise<ArrayBuffer>;
  readonly onStateChange?: (state: MusicState) => void;
}

/**
 * Starts loading the track right away (so it is ready by the first gesture) and returns the plug
 * for `AudioEngine.connectMusic`, which decodes it and starts the loop.
 */
export function createMusicPlug(options: MusicPlayerOptions): MusicPlug {
  const { track } = options;
  if (!(track.loopEnd > track.loopStart && track.loopStart >= 0)) {
    // loopEnd <= loopStart would silently loop the whole buffer, padding included.
    throw new Error(`Invalid music loop: loopEnd ${track.loopEnd} <= loopStart ${track.loopStart}`);
  }
  options.onStateChange?.('loading');
  const bytes = options.load(track.file);
  // A failed load is reported when the plug runs; don't leave the rejection unhandled meanwhile.
  bytes.catch(() => undefined);
  let started = false;

  return (context, musicBus) => {
    if (started) return;
    started = true;
    bytes
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = track.loopStart;
        source.loopEnd = Math.min(track.loopEnd, buffer.duration);
        source.connect(musicBus);
        source.start(0, track.loopStart);
        options.onStateChange?.('playing');
      })
      .catch(() => {
        options.onStateChange?.('failed');
      });
  };
}
