/** Sound: synthesized effects reacting to Game events, the mix and the music bus. */
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
export { SOUND_PRESETS, type SoundId } from './presets';
export { soundForEvent, type SoundCue } from './sound-map';
