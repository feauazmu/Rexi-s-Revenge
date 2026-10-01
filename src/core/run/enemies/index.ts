import type { EnemyKind } from '../../ids';
import { archivadorArtillado } from './archivador-artillado';
import { caminadoraAReaccion } from './caminadora-a-reaccion';
import { bancaArtillada } from './banca-artillada';
import { maletinCoptero } from './maletin-coptero';
import type { EnemyDef } from './types';

/** Enemy behavior catalog: one file per Enemy, one line per entry here. */
export const enemyCatalog: Readonly<Record<EnemyKind, EnemyDef>> = {
  'maletin-coptero': maletinCoptero,
  'archivador-artillado': archivadorArtillado,
  'caminadora-a-reaccion': caminadoraAReaccion,
  'banca-artillada': bancaArtillada,
};
