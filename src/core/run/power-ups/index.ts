import type { PowerUpId } from '../../ids';
import type { PowerUpDef } from './types';

/** Power-up behavior catalog: one file per Power-up, one line per entry here. */
// Empty until the first Power-up lands; drop this comment then.
// eslint-disable-next-line @typescript-eslint/no-generated-empty-object-type
export const powerUpCatalog: Readonly<Record<PowerUpId, PowerUpDef>> = {};
