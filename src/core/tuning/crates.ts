import type { PowerUpId, SpecialWeaponId } from '../ids';

export interface CratesTuning {
  /** Run time of the first automatic drop, seconds. */
  readonly firstDrop: number;
  /** Average time between automatic drops, seconds. */
  readonly dropInterval: number;
  /** Each interval is `dropInterval` ± up to this much (seeded), seconds. */
  readonly dropIntervalJitter: number;
  /** Minimum distance between a dropped Crate and the Arena's side edges, px. */
  readonly spawnMargin: number;
  /** Side of the square Crate hitbox, px. */
  readonly size: number;
  /** Parachute falling speed, px/s. */
  readonly fallSpeed: number;
  /** How long a Crate stays after landing before it expires, seconds. */
  readonly lifetime: number;
  /** The Crate blinks during this last part of its lifetime, seconds. */
  readonly blinkTime: number;
  /**
   * Relative chance of each content when a Crate drops. Every special Weapon and every
   * Power-up must have an entry (0 keeps it out of Crates).
   */
  readonly weights: {
    readonly weapons: Readonly<Record<SpecialWeaponId, number>>;
    readonly powerUps: Readonly<Record<PowerUpId, number>>;
  };
  /**
   * Anti-frustration: while Rexi's health is at most `belowHealth` (share of max health),
   * Receso's weight is multiplied by `weightMultiplier` for new drops.
   */
  readonly recesoBoost: {
    readonly belowHealth: number;
    readonly weightMultiplier: number;
  };
}

export const cratesTuning: CratesTuning = {
  firstDrop: 8,
  dropInterval: 10,
  dropIntervalJitter: 3,
  spawnMargin: 24,
  size: 18,
  fallSpeed: 60,
  lifetime: 10,
  blinkTime: 3,
  weights: {
    weapons: {
      'lluvia-de-sellos': 17,
      'citaciones-teledirigidas': 14,
      'sentencia-firme': 10,
      mancuernas: 14,
      'codigo-penal': 10,
    },
    // About 38 % of drops (Weapons about 62 %); Receso the most common Power-up.
    powerUps: {
      receso: 12,
      'inmunidad-judicial': 6,
      creatina: 8,
      'pre-entreno': 7,
      'dia-de-pierna': 7,
    },
  },
  recesoBoost: { belowHealth: 0.4, weightMultiplier: 2 },
};
