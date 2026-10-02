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
export type { RunStats } from './stats';
export type {
  DeviceKind,
  FullscreenSupport,
  GameOptions,
  GameOverrides,
  ScriptedCrateSpawn,
  ScriptedEnemySpawn,
  ScriptedSpawn,
} from './options';
export { memoryStorage, type StoragePort } from './storage';
export {
  HIGH_SCORE_LIMIT,
  HIGH_SCORES_STORAGE_KEY,
  highScoreRank,
  INITIALS_ALPHABET,
  INITIALS_LENGTH,
  insertHighScore,
  loadHighScores,
  saveHighScores,
  type HighScoreEntry,
  type HighScoreTable,
} from './high-scores';
export { pauseMenuItems, type PauseMenuItem } from './pause-menu';
export {
  defaultTuning,
  EXPLOSION_SIZES,
  rampAt,
  resolveTuning,
  type DeepPartial,
  type ExplosionSize,
  type QuipsTuning,
  type RampValues,
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
  type ProjectileOwner,
  type SpecialWeaponId,
  type WeaponId,
} from './ids';
export type { Box, Vec2 } from './math';
export { createRng, deriveSeed, type Rng } from './rng';
export { QUIPS, type Quip, type QuipTheme } from './quips/catalog';
export {
  createQuipDirector,
  THEME_OF_CRAFT,
  type DestroyedEnemy,
  type QuipDirector,
  type QuipDirectorDeps,
} from './quips/director';
