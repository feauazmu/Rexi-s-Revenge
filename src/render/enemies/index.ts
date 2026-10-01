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

/** Draws every Enemy; a hit Enemy is drawn as a white silhouette (hit flash). */
export function drawEnemies(dc: DrawContext, run: RunView): void {
  const flashing = silhouetteContext(dc, palette.white);
  for (const enemy of run.enemies) {
    enemyDrawers[enemy.kind](enemy.hitFlash ? flashing : dc, enemy, run);
  }
}
