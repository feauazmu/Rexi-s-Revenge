import type { ProjectileKind, ProjectileView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { drawDumbbell } from './dumbbell';
import { drawDrawer } from './drawer';
import { drawGavel } from './gavel';
import { drawLawBook } from './law-book';
import { drawPaper } from './paper';
import { drawStamp } from './stamp';
import { drawSubpoena } from './subpoena';

export type ProjectileDrawer = (dc: DrawContext, projectile: ProjectileView) => void;

/** One drawer per projectile kind (one file per kind, one line per entry here). */
const projectileDrawers: Readonly<Record<ProjectileKind, ProjectileDrawer>> = {
  gavel: drawGavel,
  paper: drawPaper,
  stamp: drawStamp,
  subpoena: drawSubpoena,
  dumbbell: drawDumbbell,
  'law-book': drawLawBook,
  drawer: drawDrawer,
};

export function drawProjectiles(dc: DrawContext, run: RunView): void {
  for (const projectile of run.projectiles) projectileDrawers[projectile.kind](dc, projectile);
}
