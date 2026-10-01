import type { BurstParticleView } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import type { Color, Surface } from '../surface';

/** Hot to cool, down the palette's fire ramp: pale core, yellow, orange, ember red. */
const FIRE: readonly Color[] = [P.light, P.sunYellow, P.skyPeach, P.skyOrange, P.redLight, P.red3];
/** Smoke down the robe and grey ramps: purple-blue shadow, lighter cap. */
const SMOKE_DARK: Color = P.robeMid;
const SMOKE_MID: Color = P.robeSheen;
const SMOKE_LIGHT: Color = P.grey1;
const FLASH: readonly Color[] = [P.white, P.light, P.sunYellow];
const SPARK: readonly Color[] = [P.white, P.sunYellow, P.skyPeach, P.skyOrange];

/** How far through its life a particle is, 0..1. */
const progress = (p: BurstParticleView): number => Math.min(1, p.age / Math.max(1, p.life));

/** Picks the color for `t` (0..1) from a ramp, first to last. */
export function ramp(colors: readonly Color[], t: number): Color {
  const i = Math.min(colors.length - 1, Math.floor(t * colors.length));
  return colors[i] ?? P.white;
}

/**
 * A filled pixel-art disc of radius `r` centered on the pixel grid near (cx, cy), drawn as
 * one rectangle per row (the renderer may only fill rectangles).
 */
export function fillDisc(surface: Surface, cx: number, cy: number, r: number, color: Color): void {
  const radius = Math.round(r);
  if (radius <= 0) return;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (let row = -radius; row < radius; row++) {
    const mid = row + 0.5;
    const half = Math.round(Math.sqrt(radius * radius - mid * mid));
    if (half > 0) surface.fillRect(x0 - half, y0 + row, half * 2, 1, color);
  }
}

/** The opening white disc of an explosion, cooling and shrinking over a few ticks. */
export function drawFlash(dc: DrawContext, p: BurstParticleView): void {
  const t = progress(p);
  fillDisc(dc.surface, p.x, p.y, p.size * (1 - 0.3 * t), ramp(FLASH, t));
}

/** A fireball: a cooling outer disc around a hotter core, shrinking as it burns out. */
export function drawFire(dc: DrawContext, p: BurstParticleView): void {
  const t = progress(p);
  const r = p.size * (1 - 0.6 * t);
  fillDisc(dc.surface, p.x, p.y, r, ramp(FIRE.slice(1), t));
  if (t < 0.6) fillDisc(dc.surface, p.x, p.y, r * 0.55, ramp(FIRE, t));
}

/** A smoke puff: swells as it rises, then thins out. */
export function drawSmoke(dc: DrawContext, p: BurstParticleView): void {
  const t = progress(p);
  const r = t < 0.7 ? p.size * (0.6 + 0.6 * t) : p.size * 1.02 * ((1 - t) / 0.3);
  const body = t > 0.6 ? SMOKE_LIGHT : p.variant < 0.5 ? SMOKE_DARK : SMOKE_MID;
  fillDisc(dc.surface, p.x, p.y, r, body);
  // A lighter cap gives the puff some volume.
  if (r >= 3) fillDisc(dc.surface, p.x - r * 0.25, p.y - r * 0.3, r * 0.5, SMOKE_LIGHT);
}

/** A tiny ember: white-hot, cooling to orange. */
export function drawSpark(dc: DrawContext, p: BurstParticleView): void {
  const size = Math.max(1, Math.round(p.size));
  dc.surface.fillRect(
    Math.round(p.x - size / 2),
    Math.round(p.y - size / 2),
    size,
    size,
    ramp(SPARK, progress(p)),
  );
}
