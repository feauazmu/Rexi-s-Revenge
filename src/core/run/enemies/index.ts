import type { EnemyKind } from '../../ids';
import { caminadoraAReaccion } from './caminadora-a-reaccion';
import { maletinCoptero } from './maletin-coptero';
import type { EnemyDef } from './types';

/** Enemy behavior catalog: one file per Enemy, one line per entry here. */
export const enemyCatalog: Readonly<Record<EnemyKind, EnemyDef>> = {
  'maletin-coptero': maletinCoptero,
  'caminadora-a-reaccion': caminadoraAReaccion,
};
