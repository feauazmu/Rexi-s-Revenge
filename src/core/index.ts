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
export type {
  DeviceKind,
  GameOptions,
  GameOverrides,
  ScriptedCrateSpawn,
  ScriptedEnemySpawn,
  ScriptedSpawn,
} from './options';
export { memoryStorage, type StoragePort } from './storage';
export { PAUSE_MENU_ITEMS, type PauseMenuItem } from './pause-menu';
export {
  defaultTuning,
  EXPLOSION_SIZES,
  resolveTuning,
  type DeepPartial,
  type ExplosionSize,
  type TimedPowerUpId,
  type Tuning,
  type TuningOverrides,
} from './tuning';
export {
  DEFAULT_WEAPON,
  ENEMY_KINDS,
  PARTICLE_KINDS,
  POWER_UP_IDS,
  PROJECTILE_KINDS,
  SPECIAL_WEAPON_IDS,
  WEAPON_IDS,
  type Craft,
  type CrateContents,
  type EnemyKind,
  type ParticleKind,
  type PowerUpId,
  type ProjectileKind,
  type SpecialWeaponId,
  type WeaponId,
} from './ids';
export type { Box, Vec2 } from './math';
