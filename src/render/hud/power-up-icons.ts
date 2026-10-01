import type { PowerUpId } from '../../core';
import type { SpriteDef } from '../sprite';

/**
 * HUD icon of each Power-up, also shown on Crates (at most 12×12 to fit a Crate's label).
 * A new Power-up fails to typecheck until it gets an icon here.
 */
// Empty until the first Power-up lands; drop this comment then.
// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type
export const powerUpIcons: Readonly<Record<PowerUpId, SpriteDef>> = {};
