/**
 * The projectiles' pipeline art (ADR 0002, art/sheets.json `projectiles_v2`, hand pass in
 * scripts/art/enemies.py): one sprite per projectile, plus the RotSprite turns of those that spin
 * or point along their flight (art/sheets.json `parts`).
 */
import {
  bulletPivots,
  dumbbellPivots,
  gavelPivots,
  lawBookPivots,
  rocketPivots,
  sprites,
  stampPivots,
} from '../art/generated/projectiles';
import { turnSprites, type TumbleTurns, type Turns } from './turned';

export const projectileArt = sprites;

/** Full circle in 45° steps (-135..180): tumbling gavels and stamps. */
export const gavelTurns: TumbleTurns = {
  sprites: turnSprites(sprites, 'gavel'),
  set: gavelPivots,
  step: 45,
  period: 360,
};
export const stampTurns: TumbleTurns = {
  sprites: turnSprites(sprites, 'stamp'),
  set: stampPivots,
  step: 45,
  period: 360,
};
/** Half circle in 22.5° steps (0..157.5): a dumbbell looks the same turned 180°. */
export const dumbbellTurns: TumbleTurns = {
  sprites: turnSprites(sprites, 'dumbbell'),
  set: dumbbellPivots,
  step: 22.5,
  period: 180,
};
/** -90..90 in 22.5° steps, mirrored for the left half: things that point where they fly. */
export const lawBookTurns: Turns = {
  sprites: turnSprites(sprites, 'law_book'),
  set: lawBookPivots,
};
export const rocketTurns: Turns = { sprites: turnSprites(sprites, 'rocket'), set: rocketPivots };
export const bulletTurns: Turns = { sprites: turnSprites(sprites, 'bullet'), set: bulletPivots };
