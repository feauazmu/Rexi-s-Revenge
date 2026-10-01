import './style.css';
import { createAudioEngine, listenForAudioUnlock } from './platform/audio';
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
listenForAudioUnlock(window, audio);
