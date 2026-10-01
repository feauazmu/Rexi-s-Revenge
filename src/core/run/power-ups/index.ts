import type { PowerUpId } from '../../ids';
import { creatina } from './creatina';
import { inmunidadJudicial } from './inmunidad-judicial';
import { receso } from './receso';
import type { PowerUpDefFor } from './types';

/** Power-up behavior catalog: one file per Power-up, one line per entry here. */
export const powerUpCatalog: { readonly [Id in PowerUpId]: PowerUpDefFor<Id> } = {
  receso,
  'inmunidad-judicial': inmunidadJudicial,
  creatina,
};
