import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  ENEMY_KINDS,
  EXPLOSION_SIZES,
  WEAPON_IDS,
  type GameEvent,
  type GameEventType,
} from '../../../src/core';
import { SOUND_PRESETS } from '../../../src/platform/audio/presets';
import {
  ENEMY_FIRE_SOUNDS,
  EXPLOSION_SOUNDS,
  soundForEvent,
  WEAPON_SOUNDS,
} from '../../../src/platform/audio/sound-map';

/**
 * One sample of every event kind with the sound it should make (null = deliberately silent).
 * The `Record` makes this table fail to typecheck when a new event kind is added, so every
 * new event gets a decision here and in the sound map.
 */
const TABLE: Record<GameEventType, readonly [GameEvent, string | null][]> = {
  'screen-changed': [
    [{ type: 'screen-changed', from: null, to: 'title' }, null],
    [{ type: 'screen-changed', from: 'title', to: 'how-to-play' }, 'menu-confirm'],
    [{ type: 'screen-changed', from: 'title', to: 'run' }, null], // run-started sounds instead
    [{ type: 'screen-changed', from: 'how-to-play', to: 'run' }, null],
    [{ type: 'screen-changed', from: 'run', to: 'paused' }, 'pause'],
    [{ type: 'screen-changed', from: 'paused', to: 'run' }, 'resume'],
    [{ type: 'screen-changed', from: 'paused', to: 'title' }, 'menu-back'],
    [{ type: 'screen-changed', from: 'run', to: 'title' }, null],
  ],
  'run-started': [[{ type: 'run-started' }, 'order-in-court']],
  'weapon-fired': [[{ type: 'weapon-fired', weapon: 'mazo-automatico' }, 'gavel-thwack']],
  'enemy-spawned': [[{ type: 'enemy-spawned', enemyId: 1, kind: 'maletin-coptero' }, null]],
  'enemy-hit': [
    [{ type: 'enemy-hit', enemyId: 1, kind: 'maletin-coptero', damage: 1 }, 'enemy-tink'],
  ],
  'enemy-destroyed': [
    [
      {
        type: 'enemy-destroyed',
        enemyId: 1,
        kind: 'maletin-coptero',
        craft: 'lawyer',
        points: 100,
        x: 240,
        y: 100,
      },
      'explosion-small',
    ],
  ],
  'enemy-fired': [[{ type: 'enemy-fired', enemyId: 1, kind: 'maletin-coptero' }, 'paper-fwip']],
  'rexi-hit': [[{ type: 'rexi-hit', damage: 5, health: 95 }, 'rexi-oof']],
  'run-ended': [
    [{ type: 'run-ended', score: 0, enemiesDestroyed: 0, ticksSurvived: 60 }, 'sad-trombone'],
  ],
  'menu-moved': [[{ type: 'menu-moved', selected: 1 }, 'menu-move']],
  'mute-toggled': [
    [{ type: 'mute-toggled', muted: true }, 'menu-confirm'],
    [{ type: 'mute-toggled', muted: false }, 'menu-confirm'],
  ],
};

describe('soundForEvent', () => {
  const rows = Object.values(TABLE).flat();

  it.each(rows.map(([event, sound]) => [JSON.stringify(event), event, sound] as const))(
    '%s → its sound',
    (_name, event, sound) => {
      expect(soundForEvent(event)?.sound ?? null).toBe(sound);
    },
  );

  it('only names sounds that exist', () => {
    for (const [event] of rows) {
      const cue = soundForEvent(event);
      if (cue) expect(SOUND_PRESETS).toHaveProperty(cue.sound);
    }
  });

  it('pans an explosion toward the side of the screen it happened on', () => {
    const destroyedAt = (x: number): GameEvent => ({
      type: 'enemy-destroyed',
      enemyId: 1,
      kind: 'maletin-coptero',
      craft: 'lawyer',
      points: 100,
      x,
      y: 100,
    });
    const left = soundForEvent(destroyedAt(0))?.pan ?? 0;
    const center = soundForEvent(destroyedAt(240))?.pan ?? 1;
    const right = soundForEvent(destroyedAt(480))?.pan ?? 0;
    expect(left).toBeLessThan(-0.3);
    expect(center).toBeCloseTo(0, 5);
    expect(right).toBeGreaterThan(0.3);
    expect(Math.abs(left)).toBeLessThan(1); // never hard-panned: both ears hear every blast
  });
});

describe('sound catalogs', () => {
  it('every Weapon has a firing sound', () => {
    for (const weapon of WEAPON_IDS) expect(SOUND_PRESETS).toHaveProperty(WEAPON_SOUNDS[weapon]);
  });

  it('every Enemy has a firing sound and explodes with its tuned explosion size', () => {
    for (const kind of ENEMY_KINDS) {
      expect(SOUND_PRESETS).toHaveProperty(ENEMY_FIRE_SOUNDS[kind]);
      const cue = soundForEvent({
        type: 'enemy-destroyed',
        enemyId: 1,
        kind,
        craft: 'lawyer',
        points: 1,
        x: 0,
        y: 0,
      });
      expect(cue?.sound).toBe(EXPLOSION_SOUNDS[defaultTuning.enemies[kind].explosion]);
    }
  });

  it('every explosion size has a sound', () => {
    for (const size of EXPLOSION_SIZES)
      expect(SOUND_PRESETS).toHaveProperty(EXPLOSION_SOUNDS[size]);
  });
});
