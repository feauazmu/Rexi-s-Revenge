import { defineEnemy } from './types';

interface MaletinMemory {
  readonly baseY: number;
  /** Starting phase of the hover cycle, 0..1. */
  readonly phase: number;
  /** Seconds of Enemy time elapsed. */
  time: number;
}

/** Maletín-cóptero: a briefcase with a rotor. For now it only hovers in place. */
export const maletinCoptero = defineEnemy<MaletinMemory>({
  kind: 'maletin-coptero',
  craft: 'lawyer',

  init: (enemy, ctx) => ({ baseY: enemy.y, phase: ctx.rng.next(), time: 0 }),

  update(enemy, memory, ctx, dt) {
    const { hoverAmplitude, hoverPeriod } = ctx.tuning.enemies['maletin-coptero'];
    memory.time += dt;
    const cycle = memory.time / hoverPeriod + memory.phase;
    enemy.y = memory.baseY + Math.sin(cycle * 2 * Math.PI) * hoverAmplitude;
  },
});
