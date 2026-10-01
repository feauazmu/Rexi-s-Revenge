import type { EnemyKind } from '../../ids';
import { bancaArtillada } from './banca-artillada';
import { maletinCoptero } from './maletin-coptero';
import type { EnemyDef } from './types';

/** Enemy behavior catalog: one file per Enemy, one line per entry here. */
export const enemyCatalog: Readonly<Record<EnemyKind, EnemyDef>> = {
  'maletin-coptero': maletinCoptero,
  'banca-artillada': bancaArtillada,
};
