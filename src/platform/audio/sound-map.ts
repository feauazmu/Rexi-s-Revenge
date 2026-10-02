import {
  defaultTuning,
  SCREEN_WIDTH,
  type EnemyKind,
  type ExplosionSize,
  type GameEvent,
  type GameEventOf,
  type GameEventType,
  type TimedPowerUpId,
  type WeaponId,
} from '../../core';
import type { SoundId } from './presets';

/**
 * Which sound each Game event makes. Adding a sound to new content is one entry:
 * - a Weapon: its firing sound in `WEAPON_SOUNDS`;
 * - an Enemy: its firing sound in `ENEMY_FIRE_SOUNDS` (its explosion follows its tuned
 *   `explosion` size automatically);
 * - an explosive projectile (Weapon or Enemy): nothing; its blast's sound follows its preset size;
 * - a timed Power-up: its start sound in `POWER_UP_START_SOUNDS` (instant ones sound through
 *   their own event, e.g. Receso's `rexi-healed`);
 * - an event kind: its rule in `EVENT_SOUNDS` (return null to keep it silent).
 * The `Record`s fail to typecheck until the new id or event kind has its entry.
 */

/** A sound to play, optionally panned (-1 left … 1 right). */
export interface SoundCue {
  readonly sound: SoundId;
  readonly pan?: number;
}

export const WEAPON_SOUNDS: Readonly<Record<WeaponId, SoundId>> = {
  'mazo-automatico': 'gavel-thwack',
  'lluvia-de-sellos': 'stamp-thunk',
  'citaciones-teledirigidas': 'citation-whistle',
  'sentencia-firme': 'verdict-boom',
  mancuernas: 'dumbbell-clang',
  'codigo-penal': 'book-slam',
};

export const ENEMY_FIRE_SOUNDS: Readonly<Record<EnemyKind, SoundId>> = {
  'maletin-coptero': 'paper-fwip',
  'archivador-artillado': 'cannon-pomp', // the bomb bay lets a drawer go
  'caminadora-a-reaccion': 'gatling-tat',
  'banca-artillada': 'cannon-pomp', // each rocket leaving a pod
};

/** The sound each timed Power-up makes as it kicks in (and when picked up again). */
export const POWER_UP_START_SOUNDS: Readonly<Record<TimedPowerUpId, SoundId>> = {
  'inmunidad-judicial': 'power-up-start',
  creatina: 'power-up-start',
  'pre-entreno': 'slow-motion',
  'dia-de-pierna': 'jet-ignite',
};

export const EXPLOSION_SOUNDS: Readonly<Record<ExplosionSize, SoundId>> = {
  small: 'explosion-small',
  large: 'explosion-large',
};

/** How far toward the speakers positional sounds pan at the screen edges. */
const PAN_WIDTH = 0.6;

/** Pan for a game x coordinate: centered in the middle, never hard left or right. */
const panAt = (x: number): number =>
  PAN_WIDTH * Math.max(-1, Math.min(1, (x / SCREEN_WIDTH) * 2 - 1));

type Rule<T extends GameEventType> = (event: GameEventOf<T>) => SoundCue | SoundId | null;

const EVENT_SOUNDS: { readonly [T in GameEventType]: Rule<T> } = {
  'screen-changed': ({ from, to }) => {
    if (to === 'paused') return 'pause';
    if (from === 'paused') return to === 'run' ? 'resume' : 'menu-back';
    if (to === 'how-to-play') return 'menu-confirm';
    if (from === 'verdict') return 'menu-confirm'; // the player left the Veredicto
    return null; // Title and Veredicto appearing, and Runs starting (run-started has its own)
  },
  'run-started': () => 'order-in-court',
  'weapon-fired': ({ weapon }) => WEAPON_SOUNDS[weapon],
  'weapon-switched': () => 'menu-move',
  'weapon-collected': () => null, // crate-picked sounds instead
  'weapon-depleted': () => 'menu-back',
  'enemy-spawned': () => null,
  'enemy-hit': () => 'enemy-tink',
  'enemy-destroyed': ({ kind, x }) => ({
    sound: EXPLOSION_SOUNDS[defaultTuning.enemies[kind].explosion],
    pan: panAt(x),
  }),
  'enemy-fired': ({ kind }) => ENEMY_FIRE_SOUNDS[kind],
  explosion: ({ size, x }) => ({ sound: EXPLOSION_SOUNDS[size], pan: panAt(x) }),
  'rexi-hit': () => 'rexi-oof',
  'run-ended': () => 'sad-trombone',
  'menu-moved': () => 'menu-move',
  'mute-toggled': () => 'menu-confirm',
  'fullscreen-toggle-requested': () => 'menu-confirm',
  'high-score-recorded': () => 'crate-pickup', // the coin arpeggio: a reward for signing
  'crate-spawned': () => null,
  'crate-landed': () => null,
  'crate-picked': () => 'crate-pickup',
  'crate-expired': () => null,
  'quip-started': () => null, // its first character blips
  'hit-stop-started': () => null, // the freeze is felt, not heard
  'hit-stop-ended': () => null,
  // Every second character, so fast typing stays a chatter instead of a buzz.
  'quip-character': ({ index }) => (index % 2 === 0 ? 'dialogue-blip' : null),
  'dialogue-closed': () => null,
  'power-up-started': ({ powerUp }) => POWER_UP_START_SOUNDS[powerUp],
  'power-up-ended': () => 'power-up-end',
  'rexi-healed': () => 'power-up-start', // Receso: the instant Power-up kicks in
};

/** The sound an event makes, or null when it is silent. */
export function soundForEvent(event: GameEvent): SoundCue | null {
  const rule = EVENT_SOUNDS[event.type] as Rule<typeof event.type>;
  const cue = rule(event);
  return typeof cue === 'string' ? { sound: cue } : cue;
}
