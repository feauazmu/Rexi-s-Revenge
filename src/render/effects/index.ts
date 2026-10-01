import type { ParticleView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { drawFire, drawFlash, drawSmoke, drawSpark } from './burst';
import { drawDebris } from './debris';

/** Explosions, sparks and debris, oldest first (newer bursts draw on top). */
export function drawEffects(dc: DrawContext, run: RunView): void {
  for (const particle of run.effects.particles) drawParticle(dc, particle);
}

/** One drawer per particle kind (one case per entry of PARTICLE_KINDS). */
function drawParticle(dc: DrawContext, particle: ParticleView): void {
  switch (particle.kind) {
    case 'flash':
      drawFlash(dc, particle);
      return;
    case 'fire':
      drawFire(dc, particle);
      return;
    case 'smoke':
      drawSmoke(dc, particle);
      return;
    case 'spark':
      drawSpark(dc, particle);
      return;
    case 'debris':
      drawDebris(dc, particle);
      return;
  }
}
