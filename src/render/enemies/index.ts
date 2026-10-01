import type { EnemyKind, EnemyView, RunView } from '../../core';
import { silhouetteContext, type DrawContext } from '../draw-context';
import { palette } from '../palette';
import type { SpriteDef } from '../sprite';
import { archivadorArtilladoDebris, drawArchivadorArtillado } from './archivador-artillado';
import { caminadoraAReaccionDebris, drawCaminadoraAReaccion } from './caminadora-a-reaccion';
import { bancaArtilladaDebris, drawBancaArtillada } from './banca-artillada';
import { drawMaletinCoptero, maletinCopteroDebris } from './maletin-coptero';

/** Draws one Enemy. `run` gives context such as where Rexi is (e.g. to face him). */
export type EnemyDrawer = (dc: DrawContext, enemy: EnemyView, run: RunView) => void;

/** One drawer per Enemy kind (one file per Enemy, one line per entry here). */
const enemyDrawers: Readonly<Record<EnemyKind, EnemyDrawer>> = {
  'maletin-coptero': drawMaletinCoptero,
  'archivador-artillado': drawArchivadorArtillado,
  'caminadora-a-reaccion': drawCaminadoraAReaccion,
  'banca-artillada': drawBancaArtillada,
};

/**
 * The chunks each Enemy kind breaks into when destroyed, indexed by debris `piece` (wrapping
 * around if the core asks for more pieces than there are chunks).
 */
export const enemyDebris: Readonly<Record<EnemyKind, readonly SpriteDef[]>> = {
  'maletin-coptero': maletinCopteroDebris,
  'archivador-artillado': archivadorArtilladoDebris,
  'caminadora-a-reaccion': caminadoraAReaccionDebris,
  'banca-artillada': bancaArtilladaDebris,
};

/**
 * The hitbox each Enemy's art was drawn around (its size at the old 480×270 resolution). The
 * tuning scaled the hitboxes by 4/3 for 640×360, but the sprites keep their pixel size until
 * the art pass redraws them larger, so each drawer gets a box of this size centered on the
 * real hitbox. Remove an entry when its Enemy's art is redrawn for its real hitbox.
 */
const ART_BOX: Readonly<Record<EnemyKind, { readonly w: number; readonly h: number }>> = {
  'maletin-coptero': { w: 24, h: 18 },
  'archivador-artillado': { w: 20, h: 26 },
  'caminadora-a-reaccion': { w: 32, h: 14 },
  'banca-artillada': { w: 68, h: 34 },
};

/** `enemy` with its box shrunk to the size its art was drawn for, around the same center. */
function artView(enemy: EnemyView): EnemyView {
  const { w, h } = ART_BOX[enemy.kind];
  return { ...enemy, x: enemy.x + (enemy.w - w) / 2, y: enemy.y + (enemy.h - h) / 2, w, h };
}

/** Draws every Enemy; a hit Enemy is drawn as a white silhouette (hit flash). */
export function drawEnemies(dc: DrawContext, run: RunView): void {
  const flashing = silhouetteContext(dc, palette.white);
  for (const enemy of run.enemies) {
    enemyDrawers[enemy.kind](enemy.hitFlash ? flashing : dc, artView(enemy), run);
  }
}
