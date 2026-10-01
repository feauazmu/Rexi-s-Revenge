import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { palette } from '../palette';
import { defineSprite } from '../sprite';

/** Bright paper with a dark outline so it reads against the sky and the buildings. */
const colors = { k: palette.outline, w: '#ffffff', l: '#8a94b0', c: '#d8deec' } as const;

/** A tumbling legal paper (a "demanda"): upright, tilted, sideways, tilted back. */
const FRAMES = [
  defineSprite(colors, [
    'kkkkkk.',
    'kwwwwck',
    'kwllllk',
    'kwwwwwk',
    'kwllllk',
    'kwwwwwk',
    'kwlllwk',
    'kkkkkkk',
  ]),
  defineSprite(colors, [
    '...kk...',
    '..kwwk..',
    '.kwllwk.',
    'kwwwwlwk',
    'kwlwwwwk',
    '.kwllwk.',
    '..kwwk..',
    '...kk...',
  ]),
  defineSprite(colors, ['kkkkkkkk', 'kwlwlwlk', 'kwlwlwlk', 'kwlwlwwk', 'cwwwwwwk', 'kkkkkkkk']),
  defineSprite(colors, [
    '...kk...',
    '..kwwk..',
    '.kwllwk.',
    'kwlwwwwk',
    'kwwwwlwk',
    '.kwllwk.',
    '..kwwk..',
    '...kk...',
  ]),
];

/** Ticks each tumble frame is shown. */
const FRAME_TICKS = 6;

export function drawPaper(dc: DrawContext, projectile: ProjectileView): void {
  const frame = FRAMES[Math.floor(projectile.age / FRAME_TICKS) % FRAMES.length] ?? FRAMES[0];
  if (!frame) return;
  drawSpriteCentered(dc, frame, projectile.x + projectile.w / 2, projectile.y + projectile.h / 2);
}
