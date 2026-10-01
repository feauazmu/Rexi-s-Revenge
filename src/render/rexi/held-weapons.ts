import type { WeaponId } from '../../core';
import type { RexiInk } from './palette';

/**
 * How a Weapon looks in Rexi's fist. Drawn procedurally in Weapon space so the same shape is
 * rasterized crisply for every arm direction: `u` runs from the fist center toward the aim and
 * `v` runs across it (positive = the Weapon's underside).
 */
export interface HeldWeapon {
  /** Distance from the fist center to the muzzle along the aim, px. */
  readonly length: number;
  /** Ink at Weapon-space point (u, v), or null where the Weapon is not. */
  paint(u: number, v: number): RexiInk | null;
}

/** Shades a round barrel: light on top, dark underneath. */
function barrel(v: number, radius: number, light: RexiInk, mid: RexiInk, dark: RexiInk): RexiInk {
  if (v < -radius * 0.45) return light;
  if (v > radius * 0.45) return dark;
  return mid;
}

/** Mazo Automático: a gavel head used as the barrel, with brass rings and the handle as grip. */
const mazoAutomatico: HeldWeapon = {
  length: 8,
  paint(u, v) {
    const head = 2.3;
    if (u >= -1 && u <= 8 && Math.abs(v) <= head) {
      if (u >= 7) return barrel(v, head, 'y', 'y', 'Y');
      if (u >= 2.2 && u < 3.2) return barrel(v, head, 'y', 'Y', 'Y');
      if (u < 0) return barrel(v, head, 'o', 'G', 'G');
      return barrel(v, head, 'g', 'o', 'G');
    }
    // Handle hanging below the head, gripped by the fist.
    if (u >= 0.4 && u <= 2.2 && v > head && v <= 5.6) return v > 4.6 ? 'G' : 'o';
    return null;
  },
};

/** Lluvia de Sellos: a rubber stamp held by its wooden handle, inked face toward the aim. */
const lluviaDeSellos: HeldWeapon = {
  length: 8,
  paint(u, v) {
    const block = 2.8;
    if (u >= 3.5 && u <= 8 && Math.abs(v) <= block) {
      if (u >= 7) return 'u';
      return barrel(v, block, 'x', 'z', 'Z');
    }
    // Wooden handle and knob, gripped by the fist.
    if (u >= -1.5 && u < 3.5 && Math.abs(v) <= (u < -0.2 ? 1.8 : 1.1)) {
      return barrel(v, 1.8, 'g', 'o', 'G');
    }
    return null;
  },
};

/** Citaciones Teledirigidas: a fat manila envelope held edge-on, red wax seal near the front. */
const citacionesTeledirigidas: HeldWeapon = {
  length: 8,
  paint(u, v) {
    const half = 2.6;
    if (u < -1 || u > 8 || Math.abs(v) > half) return null;
    if (u >= 4.8 && u <= 6.8 && Math.abs(v) <= 1.3) return '4';
    if (u >= 7.2) return barrel(v, half, '2', '2', '3');
    return barrel(v, half, '1', '1', '3');
  },
};

/** Sentencia Firme: a rolled parchment held like a rail gun, its tip glowing gold. */
const sentenciaFirme: HeldWeapon = {
  length: 8,
  paint(u, v) {
    const roll = 2;
    if (u < -1.5 || u > 8 || Math.abs(v) > roll) return null;
    if (u >= 7) return Math.abs(v) <= 0.8 ? '8' : '7';
    if (u >= 6) return '7';
    // A red ribbon tied around the roll.
    if (u >= 2.4 && u < 3.4) return barrel(v, roll, '4', '4', 'Z');
    return barrel(v, roll, '5', '6', '6');
  },
};

/** Mancuernas: a dumbbell gripped in the fist by its bar, plates sticking out on both sides. */
const mancuernas: HeldWeapon = {
  length: 8,
  paint(u, v) {
    const across = Math.abs(v);
    if (across >= 3.4 && across <= 6.4 && Math.abs(u) <= 2.9) {
      if (across > 5.5) return 'P';
      return u < -0.9 ? 'W' : 'p';
    }
    if (across < 3.4 && Math.abs(u) <= 1) return 'W';
    return null;
  },
};

/** Código Penal: the red law book held by its spine, cover toward the aim, pages underneath. */
const codigoPenal: HeldWeapon = {
  length: 8,
  paint(u, v) {
    const half = 3.4;
    if (u < -2 || u > 8 || Math.abs(v) > half) return null;
    if (v > half - 1.3) return 'w'; // page edges
    if (u < -0.8) return 'Z'; // spine
    if (u >= 3 && u <= 5.4 && Math.abs(v + 0.3) <= 1.1) return 'y'; // gold scales emblem
    return barrel(v, half, 'x', 'z', 'Z');
  },
};

/** One held look per Weapon (one line per entry). */
export const heldWeapons: Readonly<Record<WeaponId, HeldWeapon>> = {
  'mazo-automatico': mazoAutomatico,
  'lluvia-de-sellos': lluviaDeSellos,
  'citaciones-teledirigidas': citacionesTeledirigidas,
  'sentencia-firme': sentenciaFirme,
  mancuernas,
  'codigo-penal': codigoPenal,
};
