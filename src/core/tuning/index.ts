import { arenaTuning, type ArenaTuning } from './arena';
import { enemiesTuning, type EnemiesTuning } from './enemies';
import { quipsTuning, type QuipsTuning } from './quips';
import { rexiTuning, type RexiTuning } from './rexi';
import { weaponsTuning, type WeaponsTuning } from './weapons';

export type * from './arena';
export type * from './enemies';
export type * from './quips';
export type * from './rexi';
export type * from './weapons';

/**
 * The tuning catalog: every balance number in the game, grouped by area (one file per area).
 * Times are in seconds, distances in pixels, speeds in px/s. The Game core converts to ticks.
 */
export interface Tuning {
  readonly arena: ArenaTuning;
  readonly rexi: RexiTuning;
  readonly weapons: WeaponsTuning;
  readonly enemies: EnemiesTuning;
  readonly quips: QuipsTuning;
}

export const defaultTuning: Tuning = {
  arena: arenaTuning,
  rexi: rexiTuning,
  weapons: weaponsTuning,
  enemies: enemiesTuning,
  quips: quipsTuning,
};

/** Recursively optional version of T, used for tuning overrides. Arrays are replaced whole. */
export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { readonly [K in keyof T]?: DeepPartial<T[K]> }
    : T;

export type TuningOverrides = DeepPartial<Tuning>;

/** Returns the default catalog with `overrides` deep-merged on top. */
export function resolveTuning(overrides: TuningOverrides = {}): Tuning {
  return deepMerge<Tuning>(defaultTuning, overrides);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
  if (patch === undefined) return base;
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch as T;
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (!(key in base)) throw new Error(`Unknown tuning key: ${key}`);
    result[key] = deepMerge(base[key], value);
  }
  return result as T;
}
