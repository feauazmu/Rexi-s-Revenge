import type { PowerUpId } from '../../ids';
import { creatina } from './creatina';
import { diaDePierna } from './dia-de-pierna';
import { inmunidadJudicial } from './inmunidad-judicial';
import { preEntreno } from './pre-entreno';
import { receso } from './receso';
import type { PowerUpDefFor } from './types';

/** Power-up behavior catalog: one file per Power-up, one line per entry here. */
export const powerUpCatalog: { readonly [Id in PowerUpId]: PowerUpDefFor<Id> } = {
  receso,
  'inmunidad-judicial': inmunidadJudicial,
  creatina,
  'pre-entreno': preEntreno,
  'dia-de-pierna': diaDePierna,
};
