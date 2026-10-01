import type { WeaponId } from '../core';

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
    'citaciones-teledirigidas': 'Citaciones Teledirigidas',
    'sentencia-firme': 'Sentencia Firme',
  } satisfies Record<WeaponId, string>,

  titleScreen: {
    pressAnyKey: 'Presiona cualquier tecla',
    tapToStart: 'Toca para empezar',
    credits: 'Un juego de Fili — Música generada con IA',
    /** Heading of the local top 10 ("case law": the precedents to beat). */
    highScores: 'Jurisprudencia',
    /** Shown instead of the top 10 while it is empty ("no criminal record"). */
    noHighScores: 'Sin antecedentes',
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
    caseName: 'Rexi contra Bufete & Pesas S.A.',
    score: 'Puntos',
    enemiesDestroyed: 'Demandas desestimadas',
    timeSurvived: 'Tiempo sobrevivido',
    /** The stamp on the record, by outcome. */
    stamp: {
      record: '¡RÉCORD!',
      ranked: 'PRECEDENTE',
      closed: 'CASO CERRADO',
    },
    /** The court's ruling under the stamp, by outcome. */
    ruling: {
      record: 'La corte se pone de pie: ¡nuevo récord!',
      ranked: 'Tu caso sienta jurisprudencia.',
      closed: 'Se te condena a 50 sentadillas y a intentarlo de nuevo.',
    },
    sign: 'Firma el acta con tus iniciales',
    /** Followed by the place earned: "Acta firmada — Puesto 3". */
    signed: 'Acta firmada — Puesto',
    hints: {
      letter: 'Letra',
      move: 'Mover',
      sign: 'Firmar',
      enter: 'Enter',
    },
    /** Without a top-10 Run: "Récord vigente: REX — 128450". */
    recordToBeat: 'Récord vigente:',
    continueDesktop: 'Presiona cualquier tecla',
    continueTouch: 'Toca para continuar',
  },

  /** The banner over the defeat beat, before the Veredicto ("court is adjourned"). */
  defeat: '¡Se levanta la sesión!',

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
