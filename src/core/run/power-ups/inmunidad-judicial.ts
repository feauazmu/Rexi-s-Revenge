import type { RexiState } from '../state';
import { isPowerUpActive } from './active';
import type { TimedPowerUpDef } from './types';

/** Inmunidad Judicial: Rexi takes no damage while it lasts. */
export const inmunidadJudicial: TimedPowerUpDef<'inmunidad-judicial'> = {
  id: 'inmunidad-judicial',
  kind: 'timed',
};

/** Effect hook, read by Rexi's damage rule (`canHurtRexi`): true while all damage is blocked. */
export function hasInmunidadJudicial(rexi: Readonly<RexiState>): boolean {
  return isPowerUpActive(rexi, 'inmunidad-judicial');
}
