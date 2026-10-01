import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { palette } from '../palette';
import { rotatedShapeSprites, type ShapePaint } from './rotated-shape';

/** A red, gold-stamped law book with cream pages and a rocket flame. */
const colors = {
  k: palette.outline,
  r: '#c42a2a',
  R: '#7a1414',
  l: '#e8584a',
  w: '#f4ecd8',
  y: '#f0c040',
  Y: '#fff2a0',
  o: '#ff8a2a',
  O: '#e04a1a',
} as const;

/** Half the book's length along its flight and half its thickness, px. */
const HALF_LENGTH = 5;
const HALF_THICKNESS = 3.4;

/** Código Penal in flight, `u` toward its heading; `flame` is the exhaust length, px. */
function paintLawBook(flame: number): ShapePaint {
  return (u, v) => {
    if (Math.abs(u) <= HALF_LENGTH && Math.abs(v) <= HALF_THICKNESS) {
      if (v > HALF_THICKNESS - 1.4) return 'w'; // page edges underneath
      if (u < -HALF_LENGTH + 1.2) return 'R'; // spine at the back
      if (Math.abs(u - 0.6) <= 1.3 && Math.abs(v + 0.4) <= 1.1) return 'y'; // scales emblem
      return v < -HALF_THICKNESS + 1.1 ? 'l' : 'r';
    }
    // Exhaust out of the back, tapering away from the book.
    const behind = -HALF_LENGTH - u;
    if (behind > 0 && behind <= flame) {
      const halfWidth = 2.4 * (1 - behind / (flame + 0.5));
      if (Math.abs(v) > halfWidth) return null;
      if (behind < flame * 0.35 && Math.abs(v) < halfWidth * 0.6) return 'Y';
      return behind < flame * 0.7 ? 'o' : 'O';
    }
    return null;
  };
}

/** Two flicker frames of the flame, 16 headings each. */
const FRAMES = [4, 6].map((flame) =>
  rotatedShapeSprites(
    { palette: colors, paint: paintLawBook(flame), radius: HALF_LENGTH + flame, upright: true },
    16,
  ),
);

/** Ticks per flame flicker frame. */
const FLICKER_TICKS = 2;

/** The law book points along its velocity, its flame trailing behind. */
export function drawLawBook(dc: DrawContext, projectile: ProjectileView): void {
  const frame = FRAMES[Math.floor(projectile.age / FLICKER_TICKS) % FRAMES.length] ?? FRAMES[0];
  if (!frame) return;
  const angle = Math.atan2(projectile.vy, projectile.vx);
  drawSpriteCentered(
    dc,
    frame(angle),
    projectile.x + projectile.w / 2,
    projectile.y + projectile.h / 2,
  );
}
