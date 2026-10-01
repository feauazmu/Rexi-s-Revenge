import type { PowerUpId, WeaponId } from '../core';

/**
 * The Spanish UI strings catalog: every player-facing string lives here (neutral Latin
 * American Spanish). The title "Rexi's Revenge" stays in English. Quips live in their own
 * catalog. Every character used here must exist in the bitmap font (a test enforces it).
 *
 * Values are plain strings; numbers are formatted by the code that draws them.
 */
export const strings = {
  title: "Rexi's Revenge",

  hud: {
    score: 'PUNTOS',
    time: 'TIEMPO',
    /** Ammo shown for a Weapon with unlimited ammo (Mazo Automático). */
    unlimitedAmmo: '∞',
  },

  weapons: {
    'mazo-automatico': 'Mazo Automático',
    'lluvia-de-sellos': 'Lluvia de Sellos',
  } satisfies Record<WeaponId, string>,

  powerUps: {
    receso: 'Receso',
    'inmunidad-judicial': 'Inmunidad Judicial',
    creatina: 'Creatina',
  } satisfies Record<PowerUpId, string>,

  titleScreen: {
    pressAnyKey: 'Presiona cualquier tecla',
    tapToStart: 'Toca para empezar',
    credits: 'Un juego de Fili — Música generada con IA',
  },

  howToPlay: {
    title: 'Cómo jugar',
    goal: '¡Sobrevive a las demandas de Bufete & Pesas S.A.!',
    move: 'Moverse',
    jump: 'Saltar',
    aim: 'Apuntar',
    fire: 'Disparar',
    switchWeapon: 'Cambiar de arma',
    pause: 'Pausa',
    /** Joins alternative key sets: "A D o ← →". */
    or: 'o',
    keys: {
      space: 'Espacio',
      escape: 'Esc',
    },
    touch: {
      aimFire: 'Apuntar y disparar',
      switchWeapon: 'Toca el arma para cambiarla',
    },
    /** Shown once the screen accepts input, by device kind. */
    continueDesktop: 'Presiona cualquier tecla para empezar',
    continueTouch: 'Toca para empezar',
  },

  pause: {
    title: 'Pausa',
    resume: 'Continuar',
    muteMusic: 'Silenciar música',
    quit: 'Salir',
  },

  verdict: {
    title: 'Veredicto',
    score: 'Puntos',
    enemiesDestroyed: 'Demandas desestimadas',
    timeSurvived: 'Tiempo sobrevivido',
  },

  rotateDevice: 'Gira tu teléfono',

  dialogue: {
    speaker: 'REXI',
  },
} as const;

/** Every string in a (nested) strings catalog, for content checks. */
export function allStrings(catalog: object): string[] {
  return Object.values(catalog).flatMap((value: unknown) => {
    if (typeof value === 'string') return [value];
    if (typeof value === 'object' && value !== null) return allStrings(value);
    return [];
  });
}
