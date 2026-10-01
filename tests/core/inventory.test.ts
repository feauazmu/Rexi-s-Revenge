/**
 * The HA3-style Weapon inventory: the Mazo Automático is always there with unlimited ammo,
 * picked Weapons are added or topped up (capped), empty Weapons fall back to the Mazo, and
 * Rexi switches with next/previous or by slot (1–6, the order of WEAPON_IDS).
 */
import { describe, expect, it } from 'vitest';
import { defaultTuning, WEAPON_IDS, type InputFramePatch } from '../../src/core';
import { driveEmptyArena, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';

const sellos = defaultTuning.weapons['lluvia-de-sellos'];
const MAZO = { id: 'mazo-automatico', ammo: null } as const;

/** Sellos Crates that land on Rexi one after another, `gap` ticks apart. */
const sellosCratesOnRexi = (count: number, gap = 2) =>
  Array.from({ length: count }, (_, i) =>
    weaponCrate('lluvia-de-sellos', ON_REXI.x, { y: ON_REXI.y, atTick: i * gap }),
  );

const withSellos = (count = 1, tuning: Parameters<typeof driveEmptyArena>[0] = {}) =>
  driveEmptyArena({
    ...tuning,
    overrides: { ...tuning.overrides, spawns: sellosCratesOnRexi(count) },
  });

/** One trigger pull, then enough idle ticks for any Weapon's cooldown to pass. */
const pull = (game: ReturnType<typeof driveEmptyArena>, input: InputFramePatch = {}) => {
  const events = game.ticks(1, { ...input, fire: true, aim: { x: 533, y: 133 } });
  game.seconds(1.5);
  return events;
};

const weaponOf = (game: ReturnType<typeof driveEmptyArena>) => runOf(game.view).rexi.weapon;
const inventoryOf = (game: ReturnType<typeof driveEmptyArena>) => runOf(game.view).rexi.inventory;

describe('Inventory at the start of a Run', () => {
  it('holds only the Mazo Automático, with unlimited ammo, selected', () => {
    const game = driveEmptyArena();
    expect(weaponOf(game)).toEqual(MAZO);
    expect(inventoryOf(game)).toEqual([MAZO]);
  });
});

describe('Collecting a Weapon', () => {
  it('adds a new Weapon with its pickup ammo and selects it', () => {
    const game = withSellos(1);
    const events = game.ticks(1);
    const sellosView = { id: 'lluvia-de-sellos', ammo: sellos.pickupAmmo };
    expect(weaponOf(game)).toEqual(sellosView);
    expect(inventoryOf(game)).toEqual([MAZO, sellosView]);
    expect(eventsOf(events, 'weapon-collected')).toEqual([
      {
        type: 'weapon-collected',
        weapon: 'lluvia-de-sellos',
        ammo: sellos.pickupAmmo,
        added: true,
      },
    ]);
    expect(eventsOf(events, 'weapon-switched')).toEqual([
      { type: 'weapon-switched', from: 'mazo-automatico', to: 'lluvia-de-sellos' },
    ]);
  });

  it('tops up an owned Weapon, capped at its maximum ammo', () => {
    const game = withSellos(3, {
      overrides: { tuning: { weapons: { 'lluvia-de-sellos': { pickupAmmo: 15, maxAmmo: 40 } } } },
    });
    const events = game.seconds(0.5);
    expect(eventsOf(events, 'weapon-collected').map((e) => [e.ammo, e.added])).toEqual([
      [15, true],
      [30, false],
      [40, false],
    ]);
    expect(inventoryOf(game)).toEqual([MAZO, { id: 'lluvia-de-sellos', ammo: 40 }]);
  });

  it('keeps the current selection when topping up', () => {
    const game = driveEmptyArena({
      overrides: {
        spawns: [
          weaponCrate('lluvia-de-sellos', ON_REXI.x, { y: ON_REXI.y }),
          weaponCrate('lluvia-de-sellos', ON_REXI.x, { y: ON_REXI.y, atTick: 10 }),
        ],
      },
    });
    game.ticks(1);
    game.ticks(1, { weaponSlot: 1 });
    expect(weaponOf(game).id).toBe('mazo-automatico');

    const events = game.ticks(20);
    expect(eventsOf(events, 'weapon-collected')).toHaveLength(1);
    expect(eventsOf(events, 'weapon-switched')).toHaveLength(0);
    expect(weaponOf(game).id).toBe('mazo-automatico');
  });
});

describe('Spending ammo', () => {
  it('spends one ammo per trigger pull, however many projectiles it fires', () => {
    const game = withSellos(1);
    game.ticks(1);
    const events = pull(game);
    expect(eventsOf(events, 'weapon-fired')).toEqual([
      { type: 'weapon-fired', weapon: 'lluvia-de-sellos' },
    ]);
    expect(weaponOf(game).ammo).toBe(sellos.pickupAmmo - 1);
  });

  it('removes an empty Weapon and falls back to the Mazo Automático', () => {
    const game = withSellos(1, {
      overrides: { tuning: { weapons: { 'lluvia-de-sellos': { pickupAmmo: 2 } } } },
    });
    game.ticks(1);
    pull(game);
    expect(weaponOf(game)).toEqual({ id: 'lluvia-de-sellos', ammo: 1 });

    const events = pull(game);
    expect(eventsOf(events, 'weapon-depleted')).toEqual([
      { type: 'weapon-depleted', weapon: 'lluvia-de-sellos' },
    ]);
    expect(eventsOf(events, 'weapon-switched')).toEqual([
      { type: 'weapon-switched', from: 'lluvia-de-sellos', to: 'mazo-automatico' },
    ]);
    expect(weaponOf(game)).toEqual(MAZO);
    expect(inventoryOf(game)).toEqual([MAZO]);

    expect(eventsOf(pull(game), 'weapon-fired')).toEqual([
      { type: 'weapon-fired', weapon: 'mazo-automatico' },
    ]);
  });

  it('lets the Mazo fire right away after the fallback (cooldowns are per Weapon)', () => {
    const game = withSellos(1, {
      overrides: { tuning: { weapons: { 'lluvia-de-sellos': { pickupAmmo: 1 } } } },
    });
    game.ticks(1);
    const events = game.ticks(2, { fire: true });
    expect(eventsOf(events, 'weapon-fired').map((e) => e.weapon)).toEqual([
      'lluvia-de-sellos',
      'mazo-automatico',
    ]);
  });

  it('cannot skip a Weapon cooldown by switching away and back', () => {
    const game = withSellos(1);
    game.ticks(1);
    game.ticks(1, { fire: true });
    game.ticks(1, { weaponPrevious: true });
    game.ticks(1, { weaponNext: true });
    expect(eventsOf(game.ticks(1, { fire: true }), 'weapon-fired')).toHaveLength(0);
  });
});

describe('Switching Weapons', () => {
  it('ignores next/previous with only the Mazo Automático', () => {
    const game = driveEmptyArena();
    const events = [
      ...game.ticks(1, { weaponNext: true }),
      ...game.ticks(1, { weaponPrevious: true }),
    ];
    expect(eventsOf(events, 'weapon-switched')).toHaveLength(0);
    expect(weaponOf(game)).toEqual(MAZO);
  });

  it('cycles through owned Weapons in slot order, wrapping around', () => {
    const game = withSellos(1);
    game.ticks(1);
    expect(weaponOf(game).id).toBe('lluvia-de-sellos');

    game.ticks(1, { weaponNext: true });
    expect(weaponOf(game).id).toBe('mazo-automatico');
    game.ticks(1, { weaponNext: true });
    expect(weaponOf(game).id).toBe('lluvia-de-sellos');
    game.ticks(1, { weaponPrevious: true });
    expect(weaponOf(game).id).toBe('mazo-automatico');
    const events = game.ticks(1, { weaponPrevious: true });
    expect(weaponOf(game).id).toBe('lluvia-de-sellos');
    expect(eventsOf(events, 'weapon-switched')).toEqual([
      { type: 'weapon-switched', from: 'mazo-automatico', to: 'lluvia-de-sellos' },
    ]);
  });

  it('selects a Weapon directly by its slot (position in WEAPON_IDS)', () => {
    expect(WEAPON_IDS.slice(0, 2)).toEqual(['mazo-automatico', 'lluvia-de-sellos']);
    const game = withSellos(1);
    game.ticks(1);

    game.ticks(1, { weaponSlot: 1 });
    expect(weaponOf(game).id).toBe('mazo-automatico');
    game.ticks(1, { weaponSlot: 2 });
    expect(weaponOf(game).id).toBe('lluvia-de-sellos');
  });

  it('ignores slots of Weapons Rexi does not have, and the current slot', () => {
    const game = withSellos(1);
    game.ticks(1);
    const events = [
      ...game.ticks(1, { weaponSlot: 2 }),
      ...game.ticks(1, { weaponSlot: 6 }),
      ...game.ticks(1, { weaponSlot: 9 }),
    ];
    expect(eventsOf(events, 'weapon-switched')).toHaveLength(0);
    expect(weaponOf(game).id).toBe('lluvia-de-sellos');
  });

  it('can be selected and fired in the same tick', () => {
    const game = withSellos(1);
    game.ticks(1, { weaponSlot: 1 });
    const events = game.ticks(1, { weaponSlot: 2, fire: true });
    expect(eventsOf(events, 'weapon-fired')).toEqual([
      { type: 'weapon-fired', weapon: 'lluvia-de-sellos' },
    ]);
  });
});
