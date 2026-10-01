import type { EnemyKind, EnemyView, RunView } from '../../core';
import { silhouetteContext, type DrawContext } from '../draw-context';
import { palette } from '../palette';
import type { SpriteDef } from '../sprite';
import { drawMaletinCoptero, maletinCopteroDebris } from './maletin-coptero';

export type EnemyDrawer = (dc: DrawContext, enemy: EnemyView) => void;

/** One drawer per Enemy kind (one file per Enemy, one line per entry here). */
const enemyDrawers: Readonly<Record<EnemyKind, EnemyDrawer>> = {
  'maletin-coptero': drawMaletinCoptero,
};

/**
 * The chunks each Enemy kind breaks into when destroyed, indexed by debris `piece` (wrapping
 * around if the core asks for more pieces than there are chunks).
 */
export const enemyDebris: Readonly<Record<EnemyKind, readonly SpriteDef[]>> = {
  'maletin-coptero': maletinCopteroDebris,
};

/** Draws every Enemy; a hit Enemy is drawn as a white silhouette (hit flash). */
export function drawEnemies(dc: DrawContext, run: RunView): void {
  const flashing = silhouetteContext(dc, palette.white);
  for (const enemy of run.enemies) {
    enemyDrawers[enemy.kind](enemy.hitFlash ? flashing : dc, enemy);
  }
}
