import { describe, expect, it } from 'vitest';
import { computeViewport, screenToGame, screenToGameUnclamped } from '../../src/platform/viewport';

describe('computeViewport', () => {
  it.each([
    // container w, h, dpr -> scale, offsets (CSS px)
    { w: 480, h: 270, dpr: 1, scale: 1, x: 0, y: 0 },
    { w: 1920, h: 1080, dpr: 1, scale: 4, x: 0, y: 0 },
    { w: 1280, h: 720, dpr: 1, scale: 2, x: 160, y: 90 },
    { w: 1000, h: 1000, dpr: 1, scale: 2, x: 20, y: 230 }, // pillarbox + letterbox
    { w: 2560, h: 1080, dpr: 1, scale: 4, x: 320, y: 0 }, // ultrawide
    { w: 300, h: 200, dpr: 1, scale: 1, x: -90, y: -35 }, // too small: never below 1
  ])('fits $w×$h @$dpr at integer scale $scale', ({ w, h, dpr, scale, x, y }) => {
    const vp = computeViewport(w, h, dpr);
    expect(vp.scale).toBe(scale);
    expect(vp.offsetX).toBe(x);
    expect(vp.offsetY).toBe(y);
    expect(vp.width).toBe(480 * vp.cssScale);
    expect(vp.height).toBe(270 * vp.cssScale);
  });

  it('fits other image sizes too (the portrait rotate prompt)', () => {
    const vp = computeViewport(390, 844, 3, { width: 144, height: 256 }); // phone portrait
    expect(vp.scale).toBe(8); // 1170 / 144 = 8.1, 2532 / 256 = 9.9
    expect(vp.width).toBeCloseTo(384);
    expect(vp.height).toBeCloseTo((256 * 8) / 3);
  });

  it('scales in whole device pixels on high-DPI screens', () => {
    const vp = computeViewport(844, 390, 3); // phone landscape
    expect(vp.scale).toBe(4); // 2532×1170 device px fit 4× (1920×1080)
    expect(vp.cssScale).toBeCloseTo(4 / 3);
    expect(vp.width).toBeCloseTo(640);
    // Offsets land on device pixel boundaries.
    expect(Number.isInteger(Math.round(vp.offsetX * 3 * 1e6) / 1e6)).toBe(true);
    expect(Number.isInteger(Math.round(vp.offsetY * 3 * 1e6) / 1e6)).toBe(true);
  });
});

describe('screenToGame', () => {
  it.each([
    { w: 480, h: 270, dpr: 1 },
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
      [240, 135],
      [479.5, 269.5],
      [12.25, 200.75],
    ] as const) {
      const game = screenToGame(toScreen(gx, gy), vp);
      expect(game.x).toBeCloseTo(gx, 6);
      expect(game.y).toBeCloseTo(gy, 6);
    }
  });

  it('accounts for the letterbox offset', () => {
    const vp = computeViewport(1280, 720, 1); // 2×, offset (160, 90)
    expect(screenToGame({ x: 160, y: 90 }, vp)).toEqual({ x: 0, y: 0 });
    expect(screenToGame({ x: 640, y: 360 }, vp)).toEqual({ x: 240, y: 135 });
  });

  it('clamps points in the letterbox bars to the screen edges', () => {
    const vp = computeViewport(1280, 720, 1);
    expect(screenToGame({ x: 10, y: 5 }, vp)).toEqual({ x: 0, y: 0 });
    expect(screenToGame({ x: 1275, y: 719 }, vp)).toEqual({ x: 480, y: 270 });
  });
});

describe('screenToGameUnclamped', () => {
  it('maps points over the letterbox bars outside the screen instead of clamping', () => {
    const vp = computeViewport(1280, 720, 1); // 2×, offset (160, 90)
    expect(screenToGameUnclamped({ x: 100, y: 60 }, vp)).toEqual({ x: -30, y: -15 });
    expect(screenToGame({ x: 100, y: 60 }, vp)).toEqual({ x: 0, y: 0 });
  });
});
