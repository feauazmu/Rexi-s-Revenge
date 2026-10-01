/**
 * The projectiles' pipeline art (ADR 0002, art/sheets.json `projectiles_v2`, hand pass in
 * scripts/art/enemies.py): one sprite per projectile, plus the RotSprite turns of those that spin
 * or point along their flight.
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
import { turnSprites, type TurnSet, type TurnSprites } from './turned';

export const projectileArt = sprites;

interface Turns {
  readonly sprites: TurnSprites;
  readonly set: TurnSet;
}

/** Full circle in 45° steps (-135..180): tumbling gavels and stamps. */
export const gavelTurns: Turns = { sprites: turnSprites(sprites, 'gavel'), set: gavelPivots };
export const stampTurns: Turns = { sprites: turnSprites(sprites, 'stamp'), set: stampPivots };
/** Half circle in 22.5° steps (0..157.5): a dumbbell looks the same turned 180°. */
export const dumbbellTurns: Turns = {
  sprites: turnSprites(sprites, 'dumbbell'),
  set: dumbbellPivots,
};
/** -90..90 in 22.5° steps, mirrored for the left half: things that point where they fly. */
export const lawBookTurns: Turns = {
  sprites: turnSprites(sprites, 'law_book'),
  set: lawBookPivots,
};
export const rocketTurns: Turns = { sprites: turnSprites(sprites, 'rocket'), set: rocketPivots };
export const bulletTurns: Turns = { sprites: turnSprites(sprites, 'bullet'), set: bulletPivots };
