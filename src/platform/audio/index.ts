/** Sound: synthesized effects reacting to Game events, the mix and the looping soundtrack. */
export {
  createAudioEngine,
  listenForAudioUnlock,
  MUSIC_LEVEL,
  type AudioEngine,
  type AudioEngineOptions,
  type AudioState,
  type AudioStatus,
  type MusicPlug,
} from './engine';
export {
  createMusicPlug,
  type MusicPlayerOptions,
  type MusicState,
  type MusicTrack,
} from './music';
export { MUSIC_TRACK } from './music-track';
export { SOUND_PRESETS, type SoundId } from './presets';
export { soundForEvent, type SoundCue } from './sound-map';
