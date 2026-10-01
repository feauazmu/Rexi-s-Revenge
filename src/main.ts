import './style.css';
import {
  createAudioEngine,
  createMusicPlug,
  listenForAudioUnlock,
  MUSIC_TRACK,
} from './platform/audio';
import { startShell } from './platform/shell';

const root = document.getElementById('app');
if (!root) throw new Error('Missing #app element');

// The audio state is mirrored on the app root like the screen (smoke tests, debugging).
const audio = createAudioEngine({
  onStatusChange: ({ state, musicMuted }) => {
    root.dataset.audio = state;
    root.dataset.music = musicMuted ? 'muted' : 'on';
  },
});
const shell = startShell(root, {
  onEvents: (events) => {
    audio.handleEvents(events);
  },
});
audio.setMusicMuted(shell.view.musicMuted);
// The soundtrack loads now and starts looping on the music bus at the first gesture. It is never
// stopped, so it carries on across screens; mute only fades the bus.
audio.connectMusic(
  createMusicPlug({
    track: MUSIC_TRACK,
    load: async (file) => {
      const response = await fetch(`${import.meta.env.BASE_URL}${file}`);
      if (!response.ok) throw new Error(`Music ${file}: HTTP ${response.status}`);
      return response.arrayBuffer();
    },
    onStateChange: (state) => {
      root.dataset.musicTrack = state;
    },
  }),
);
listenForAudioUnlock(window, audio);
