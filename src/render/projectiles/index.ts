import type { ProjectileKind, ProjectileView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { drawGavel } from './gavel';

export type ProjectileDrawer = (dc: DrawContext, projectile: ProjectileView) => void;

/** One drawer per projectile kind (one file per kind, one line per entry here). */
const projectileDrawers: Readonly<Record<ProjectileKind, ProjectileDrawer>> = {
  gavel: drawGavel,
};

export function drawProjectiles(dc: DrawContext, run: RunView): void {
  for (const projectile of run.projectiles) projectileDrawers[projectile.kind](dc, projectile);
}
