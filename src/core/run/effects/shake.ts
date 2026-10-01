import { DT } from '../../constants';
import { clamp, type Vec2 } from '../../math';
import { hash32 } from '../../rng';
import type { ShakeTuning } from '../../tuning';

/** Screen-shake memory: current trauma plus the per-Run noise seeds of each axis. */
export interface ShakeState {
  /** 0..1; decays linearly every tick. */
  trauma: number;
  readonly seedX: number;
  readonly seedY: number;
}

export function createShake(seedX: number, seedY: number): ShakeState {
  return { trauma: 0, seedX, seedY };
}

export function addTrauma(shake: ShakeState, amount: number): void {
  shake.trauma = clamp(shake.trauma + amount, 0, 1);
}

export function stepShake(shake: ShakeState, tuning: ShakeTuning): void {
  shake.trauma = Math.max(0, shake.trauma - tuning.traumaDecay * DT);
}

/** Whole-pixel offset for Run tick `tick`: `maxOffset * scale * trauma² * noise(t)` per axis. */
export function shakeOffset(shake: Readonly<ShakeState>, tuning: ShakeTuning, tick: number): Vec2 {
  const amplitude = tuning.maxOffset * tuning.scale * shake.trauma * shake.trauma;
  if (amplitude === 0) return { x: 0, y: 0 };
  const t = tick * DT * tuning.frequency;
  // `+ 0` turns -0 into 0, so a still view always equals { x: 0, y: 0 }.
  return {
    x: Math.round(amplitude * valueNoise(t, shake.seedX)) + 0,
    y: Math.round(amplitude * valueNoise(t, shake.seedY)) + 0,
  };
}

/** Smooth 1D value noise in [-1, 1]: hashed lattice values blended with smoothstep. */
export function valueNoise(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = latticeValue(seed, i);
  const b = latticeValue(seed, i + 1);
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}

function latticeValue(seed: number, i: number): number {
  return (hash32(seed, i) / 4294967296) * 2 - 1;
}
