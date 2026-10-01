import { describe, expect, it } from 'vitest';
import { computeViewport, screenToGame, screenToGameUnclamped } from '../../src/platform/viewport';

describe('computeViewport', () => {
  it.each([
    // container w, h, dpr -> scale, offsets (CSS px)
    { w: 640, h: 360, dpr: 1, scale: 1, x: 0, y: 0 },
    { w: 1920, h: 1080, dpr: 1, scale: 3, x: 0, y: 0 }, // 1080p
    { w: 1280, h: 720, dpr: 1, scale: 2, x: 0, y: 0 }, // 720p
    { w: 1366, h: 768, dpr: 1, scale: 2, x: 43, y: 24 },
    { w: 1000, h: 1000, dpr: 1, scale: 1, x: 180, y: 320 }, // pillarbox + letterbox
    { w: 2560, h: 1080, dpr: 1, scale: 3, x: 320, y: 0 }, // ultrawide
    { w: 2560, h: 1440, dpr: 1, scale: 4, x: 0, y: 0 }, // 1440p
    { w: 400, h: 300, dpr: 1, scale: 1, x: -120, y: -30 }, // too small: never below 1
  ])('fits $w×$h @$dpr at integer scale $scale', ({ w, h, dpr, scale, x, y }) => {
    const vp = computeViewport(w, h, dpr);
    expect(vp.scale).toBe(scale);
    expect(vp.offsetX).toBe(x);
    expect(vp.offsetY).toBe(y);
    expect(vp.width).toBe(640 * vp.cssScale);
    expect(vp.height).toBe(360 * vp.cssScale);
  });

  it('fits other image sizes too (the portrait rotate prompt)', () => {
    const vp = computeViewport(390, 844, 3, { width: 192, height: 340 }); // phone portrait
    expect(vp.scale).toBe(6); // 1170 / 192 = 6.1, 2532 / 340 = 7.4
    expect(vp.width).toBeCloseTo(384);
    expect(vp.height).toBeCloseTo(680);
  });

  it('scales in whole device pixels on high-DPI screens', () => {
    const vp = computeViewport(844, 390, 3); // phone landscape
    expect(vp.scale).toBe(3); // 2532×1170 device px fit 3× (1920×1080)
    expect(vp.cssScale).toBeCloseTo(1);
    expect(vp.width).toBeCloseTo(640);
    // Offsets land on device pixel boundaries.
    expect(Number.isInteger(Math.round(vp.offsetX * 3 * 1e6) / 1e6)).toBe(true);
    expect(Number.isInteger(Math.round(vp.offsetY * 3 * 1e6) / 1e6)).toBe(true);
  });
});

describe('screenToGame', () => {
  it.each([
    { w: 640, h: 360, dpr: 1 },
    { w: 1280, h: 720, dpr: 1 },
    { w: 1000, h: 1000, dpr: 1 },
    { w: 2560, h: 1080, dpr: 1 },
    { w: 1440, h: 900, dpr: 2 },
    { w: 844, h: 390, dpr: 3 },
  ])('maps container points back to game coordinates at $w×$h @$dpr', ({ w, h, dpr }) => {
    const vp = computeViewport(w, h, dpr);
    const toScreen = (gx: number, gy: number) => ({
      x: vp.offsetX + gx * vp.cssScale,
      y: vp.offsetY + gy * vp.cssScale,
    });
    for (const [gx, gy] of [
      [0, 0],
      [320, 180],
      [639.5, 359.5],
      [12.25, 267.75],
    ] as const) {
      const game = screenToGame(toScreen(gx, gy), vp);
      expect(game.x).toBeCloseTo(gx, 6);
      expect(game.y).toBeCloseTo(gy, 6);
    }
  });

  it('accounts for the letterbox offset', () => {
    const vp = computeViewport(1366, 768, 1); // 2×, offset (43, 24)
    expect(screenToGame({ x: 43, y: 24 }, vp)).toEqual({ x: 0, y: 0 });
    expect(screenToGame({ x: 683, y: 384 }, vp)).toEqual({ x: 320, y: 180 });
  });

  it('clamps points in the letterbox bars to the screen edges', () => {
    const vp = computeViewport(1366, 768, 1);
    expect(screenToGame({ x: 10, y: 5 }, vp)).toEqual({ x: 0, y: 0 });
    expect(screenToGame({ x: 1360, y: 767 }, vp)).toEqual({ x: 640, y: 360 });
  });
});

describe('screenToGameUnclamped', () => {
  it('maps points over the letterbox bars outside the screen instead of clamping', () => {
    const vp = computeViewport(1366, 768, 1); // 2×, offset (43, 24)
    expect(screenToGameUnclamped({ x: 3, y: 4 }, vp)).toEqual({ x: -20, y: -10 });
    expect(screenToGame({ x: 3, y: 4 }, vp)).toEqual({ x: 0, y: 0 });
  });
});
