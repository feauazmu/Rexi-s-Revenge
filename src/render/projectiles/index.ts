import type { ProjectileKind, ProjectileView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { drawDrawer } from './drawer';
import { drawGavel } from './gavel';
import { drawPaper } from './paper';
import { drawStamp } from './stamp';

export type ProjectileDrawer = (dc: DrawContext, projectile: ProjectileView) => void;

/** One drawer per projectile kind (one file per kind, one line per entry here). */
const projectileDrawers: Readonly<Record<ProjectileKind, ProjectileDrawer>> = {
  gavel: drawGavel,
  paper: drawPaper,
  stamp: drawStamp,
  drawer: drawDrawer,
};

export function drawProjectiles(dc: DrawContext, run: RunView): void {
  for (const projectile of run.projectiles) projectileDrawers[projectile.kind](dc, projectile);
}
