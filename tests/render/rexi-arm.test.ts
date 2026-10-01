import { describe, expect, it } from 'vitest';
import { AIM_DIRECTIONS, aimStep, MAX_AIM_STEP, stepDirection } from '../../src/render/rexi/arm';

const STEP = (2 * Math.PI) / AIM_DIRECTIONS;
const shoulder = { x: 200, y: 150 };

function angleBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dot = (a.x * b.x + a.y * b.y) / (Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y));
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

describe("Rexi's arm direction", () => {
  it('points within one direction step of the aim point, in both facings', () => {
    for (let degrees = -90; degrees <= 90; degrees += 1) {
      for (const facing of [1, -1] as const) {
        const angle = (degrees * Math.PI) / 180;
        const toAim = { x: Math.cos(angle) * 80 * facing, y: -Math.sin(angle) * 80 };
        const aim = { x: shoulder.x + toAim.x, y: shoulder.y + toAim.y };
        const step = aimStep(shoulder, aim, facing);
        const drawn = stepDirection(step);
        const onScreen = { x: drawn.x * facing, y: drawn.y };
        // Rounded to the nearest of 16 directions: never more than half a step off.
        expect(angleBetween(onScreen, toAim)).toBeLessThanOrEqual(STEP / 2 + 1e-9);
      }
    }
  });

  it('uses 16 distinct directions across both facings', () => {
    const directions = new Set<string>();
    for (let step = -MAX_AIM_STEP; step <= MAX_AIM_STEP; step++) {
      for (const facing of [1, -1] as const) {
        const d = stepDirection(step);
        directions.add(`${(d.x * facing).toFixed(3)},${d.y.toFixed(3)}`.replace('-0.000', '0.000'));
      }
    }
    expect(directions.size).toBe(AIM_DIRECTIONS);
  });

  it('clamps to straight up or down when aiming just behind the shoulder', () => {
    expect(aimStep(shoulder, { x: shoulder.x - 2, y: shoulder.y - 40 }, 1)).toBe(MAX_AIM_STEP);
    expect(aimStep(shoulder, { x: shoulder.x - 2, y: shoulder.y + 40 }, 1)).toBe(-MAX_AIM_STEP);
  });
});
