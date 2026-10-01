import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  ENEMY_KINDS,
  EXPLOSION_SIZES,
  POWER_UP_IDS,
  WEAPON_IDS,
  type GameEvent,
  type ExplosionSize,
  type GameEventType,
} from '../../../src/core';
import { SOUND_PRESETS } from '../../../src/platform/audio/presets';
import {
  ENEMY_FIRE_SOUNDS,
  EXPLOSION_SOUNDS,
  POWER_UP_START_SOUNDS,
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
    [{ type: 'screen-changed', from: 'run', to: 'verdict' }, null], // the defeat beat sounded
    [{ type: 'screen-changed', from: 'verdict', to: 'title' }, 'menu-confirm'],
  ],
  'run-started': [[{ type: 'run-started' }, 'order-in-court']],
  'weapon-fired': [
    [{ type: 'weapon-fired', weapon: 'mazo-automatico' }, 'gavel-thwack'],
    [{ type: 'weapon-fired', weapon: 'lluvia-de-sellos' }, 'stamp-thunk'],
    [{ type: 'weapon-fired', weapon: 'citaciones-teledirigidas' }, 'citation-whistle'],
    [{ type: 'weapon-fired', weapon: 'sentencia-firme' }, 'verdict-boom'],
    [{ type: 'weapon-fired', weapon: 'mancuernas' }, 'dumbbell-clang'],
    [{ type: 'weapon-fired', weapon: 'codigo-penal' }, 'book-slam'],
  ],
  'weapon-switched': [
    [{ type: 'weapon-switched', from: 'mazo-automatico', to: 'sentencia-firme' }, 'menu-move'],
  ],
  'weapon-collected': [
    [{ type: 'weapon-collected', weapon: 'lluvia-de-sellos', ammo: 30, added: true }, null],
  ],
  'weapon-depleted': [[{ type: 'weapon-depleted', weapon: 'lluvia-de-sellos' }, 'menu-back']],
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
  explosion: [
    [
      {
        type: 'explosion',
        owner: 'rexi',
        kind: 'dumbbell',
        size: 'small',
        x: 240,
        y: 200,
        radius: 28,
      },
      'explosion-small',
    ],
    [
      {
        type: 'explosion',
        owner: 'rexi',
        kind: 'law-book',
        size: 'large',
        x: 240,
        y: 200,
        radius: 48,
      },
      'explosion-large',
    ],
    [
      {
        type: 'explosion',
        owner: 'enemy',
        kind: 'drawer',
        size: 'small',
        x: 240,
        y: 200,
        radius: 16,
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
  'high-score-recorded': [
    [{ type: 'high-score-recorded', initials: 'REX', score: 1200, rank: 1 }, 'crate-pickup'],
  ],
  'mute-toggled': [
    [{ type: 'mute-toggled', muted: true }, 'menu-confirm'],
    [{ type: 'mute-toggled', muted: false }, 'menu-confirm'],
  ],
  'crate-spawned': [
    [
      {
        type: 'crate-spawned',
        crateId: 1,
        contents: { kind: 'weapon', weapon: 'sentencia-firme' },
        x: 100,
      },
      null,
    ],
  ],
  'crate-landed': [[{ type: 'crate-landed', crateId: 1 }, null]],
  'crate-picked': [
    [
      { type: 'crate-picked', crateId: 1, contents: { kind: 'weapon', weapon: 'sentencia-firme' } },
      'crate-pickup',
    ],
  ],
  'crate-expired': [[{ type: 'crate-expired', crateId: 1 }, null]],
  'quip-started': [
    [
      { type: 'quip-started', quipId: 'legal-x', theme: 'legal', enemyId: 1, hitStopTicks: 6 },
      null,
    ],
  ],
  'quip-character': [
    [{ type: 'quip-character', quipId: 'legal-x', char: 'O', index: 0 }, 'dialogue-blip'],
    [{ type: 'quip-character', quipId: 'legal-x', char: 'b', index: 1 }, null],
    [{ type: 'quip-character', quipId: 'legal-x', char: 'j', index: 2 }, 'dialogue-blip'],
  ],
  'power-up-started': [
    [
      { type: 'power-up-started', powerUp: 'creatina', ticks: 600, refreshed: false },
      'power-up-start',
    ],
    [
      { type: 'power-up-started', powerUp: 'inmunidad-judicial', ticks: 480, refreshed: true },
      'power-up-start',
    ],
    [
      { type: 'power-up-started', powerUp: 'pre-entreno', ticks: 480, refreshed: false },
      'slow-motion',
    ],
    [
      { type: 'power-up-started', powerUp: 'dia-de-pierna', ticks: 360, refreshed: false },
      'jet-ignite',
    ],
  ],
  'power-up-ended': [
    [{ type: 'power-up-ended', powerUp: 'creatina' }, 'power-up-end'],
    [{ type: 'power-up-ended', powerUp: 'dia-de-pierna' }, 'power-up-end'],
  ],
  'rexi-healed': [[{ type: 'rexi-healed', amount: 30, health: 80 }, 'power-up-start']],
  'dialogue-closed': [[{ type: 'dialogue-closed', quipId: 'legal-x' }, null]],
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
    const center = soundForEvent(destroyedAt(320))?.pan ?? 1;
    const right = soundForEvent(destroyedAt(640))?.pan ?? 0;
    expect(left).toBeLessThan(-0.3);
    expect(center).toBeCloseTo(0, 5);
    expect(right).toBeGreaterThan(0.3);
    expect(Math.abs(left)).toBeLessThan(1); // never hard-panned: both ears hear every blast
  });

  it('pans a Weapon blast with its x', () => {
    const blastAt = (x: number): GameEvent => ({
      type: 'explosion',
      owner: 'rexi',
      kind: 'law-book',
      size: 'large',
      x,
      y: 200,
      radius: 48,
    });
    expect(soundForEvent(blastAt(0))?.pan).toBeLessThan(-0.3);
    expect(soundForEvent(blastAt(320))?.pan).toBeCloseTo(0, 5);
    expect(soundForEvent(blastAt(640))?.pan).toBeGreaterThan(0.3);
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

  it('an explosive Weapon blast sounds like its tuned explosion preset', () => {
    for (const weapon of WEAPON_IDS) {
      const tuning: object = defaultTuning.weapons[weapon];
      if (!('explosion' in tuning && 'splashRadius' in tuning)) continue;
      const { explosion: size, splashRadius: radius } = tuning as {
        explosion: ExplosionSize;
        splashRadius: number;
      };
      const cue = soundForEvent({
        type: 'explosion',
        owner: 'rexi',
        kind: 'dumbbell',
        size,
        x: 240,
        y: 200,
        radius,
      });
      expect(cue?.sound).toBe(EXPLOSION_SOUNDS[size]);
    }
  });

  it('every timed Power-up has a sound as it kicks in (instant ones sound through their event)', () => {
    const timed = POWER_UP_IDS.filter((id) => 'duration' in defaultTuning.powerUps[id]);
    expect(Object.keys(POWER_UP_START_SOUNDS).sort()).toEqual([...timed].sort());
    for (const sound of Object.values(POWER_UP_START_SOUNDS))
      expect(SOUND_PRESETS).toHaveProperty(sound);
  });

  it('every explosion size has a sound', () => {
    for (const size of EXPLOSION_SIZES)
      expect(SOUND_PRESETS).toHaveProperty(EXPLOSION_SOUNDS[size]);
  });
});
