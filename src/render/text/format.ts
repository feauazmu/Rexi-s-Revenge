import { TICKS_PER_SECOND } from '../../core';

/** Elapsed Run time as `m:ss`; minutes keep counting past 59 (`75:03`), partial seconds drop. */
export function formatElapsed(ticks: number): string {
  const totalSeconds = Math.floor(Math.max(0, ticks) / TICKS_PER_SECOND);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
