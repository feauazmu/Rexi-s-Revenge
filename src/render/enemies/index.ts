import type { EnemyKind, EnemyView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { drawMaletinCoptero } from './maletin-coptero';

export type EnemyDrawer = (dc: DrawContext, enemy: EnemyView) => void;

/** One drawer per Enemy kind (one file per Enemy, one line per entry here). */
const enemyDrawers: Readonly<Record<EnemyKind, EnemyDrawer>> = {
  'maletin-coptero': drawMaletinCoptero,
};

export function drawEnemies(dc: DrawContext, run: RunView): void {
  for (const enemy of run.enemies) enemyDrawers[enemy.kind](dc, enemy);
}
