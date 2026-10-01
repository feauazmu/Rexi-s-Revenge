/**
 * Public interface of the headless Game core. Code outside src/core imports only from here.
 * Everything under src/core/run is private and may be refactored freely.
 */
export { createGame, type Game } from './game';
export { DT, SCREEN_HEIGHT, SCREEN_WIDTH, TICKS_PER_SECOND, secondsToTicks } from './constants';
export {
  inputFrame,
  NEUTRAL_INPUT,
  type InputFrame,
  type InputFramePatch,
  type MenuInput,
} from './input';
export type * from './events';
export type * from './view';
export type { DeviceKind, GameOptions, GameOverrides, ScriptedSpawn } from './options';
export { memoryStorage, type StoragePort } from './storage';
export {
  defaultTuning,
  EXPLOSION_SIZES,
  resolveTuning,
  type DeepPartial,
  type ExplosionSize,
  type Tuning,
  type TuningOverrides,
} from './tuning';
export {
  ENEMY_KINDS,
  PARTICLE_KINDS,
  PROJECTILE_KINDS,
  WEAPON_IDS,
  type Craft,
  type EnemyKind,
  type ParticleKind,
  type ProjectileKind,
  type WeaponId,
} from './ids';
export type { Box, Vec2 } from './math';
