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

describe('computeViewport in fit mode', () => {
  it.each([
    // iPhone landscape with browser bars: less than 360 CSS px of height
    { w: 844, h: 340, dpr: 3 },
    { w: 932, h: 330, dpr: 3 },
    { w: 812, h: 300, dpr: 3 },
  ])('fills the height of a $w×$h @$dpr phone landscape', ({ w, h, dpr }) => {
    const vp = computeViewport(w, h, dpr, undefined, 'fit');
    expect(vp.height).toBeCloseTo(h, 6);
    expect(vp.width).toBeCloseTo((h * 16) / 9, 6);
    expect(vp.offsetY).toBe(0);
  });

  it('pillarboxes a wide phone, centered, with offsets on device pixels', () => {
    // 844×340 @3: 1020 / 360 = 2.833 device px per game px, image 604.44 CSS px wide,
    // side bars of 119.78 CSS px = 359.33 device px, snapped to 359.
    const vp = computeViewport(844, 340, 3, undefined, 'fit');
    expect(vp.scale).toBeCloseTo(1020 / 360, 9);
    expect(vp.width).toBeCloseTo(604.444, 3);
    expect(vp.offsetX).toBeCloseTo(359 / 3, 9);
    expect(vp.offsetX + vp.width / 2).toBeCloseTo(422, 0); // centered within a device px
  });

  it.each([
    { w: 844, h: 340, dpr: 3 },
    { w: 932, h: 330, dpr: 3 },
    { w: 915, h: 380, dpr: 2.625 }, // Pixel 7 landscape: letterboxed top and bottom
    { w: 1000, h: 1000, dpr: 2 },
    { w: 1366, h: 768, dpr: 1 },
  ])('keeps offsets on device-pixel boundaries at $w×$h @$dpr', ({ w, h, dpr }) => {
    const vp = computeViewport(w, h, dpr, undefined, 'fit');
    const onDevicePixel = (cssPx: number) => Math.abs(cssPx * dpr - Math.round(cssPx * dpr));
    expect(onDevicePixel(vp.offsetX)).toBeLessThan(1e-9);
    expect(onDevicePixel(vp.offsetY)).toBeLessThan(1e-9);
    // The image fills one dimension and fits within the other.
    expect(vp.width <= w + 1e-9 && vp.height <= h + 1e-9).toBe(true);
    expect(Math.max(vp.width / w, vp.height / h)).toBeCloseTo(1, 9);
  });

  it('scales up past whole factors on large screens', () => {
    const vp = computeViewport(1366, 768, 1, undefined, 'fit');
    expect(vp.scale).toBeCloseTo(768 / 360, 9); // 2.133, where integer mode gives 2
    expect(vp.width).toBeCloseTo(1365.333, 3);
    expect(vp.offsetX).toBe(0); // 0.33 px bars round to 0
    expect(vp.offsetY).toBe(0);
  });

  it('fits the rotate prompt too', () => {
    const vp = computeViewport(390, 844, 3, { width: 192, height: 340 }, 'fit');
    expect(vp.width).toBeCloseTo(390, 6); // 1170 / 192 = 6.09 < 2532 / 340 = 7.45
    expect(vp.height).toBeCloseTo((390 * 340) / 192, 6);
  });

  it.each([
    { w: 844, h: 340, dpr: 3 },
    { w: 932, h: 330, dpr: 3 },
    { w: 915, h: 380, dpr: 2.625 },
  ])('maps screen points back to game coordinates at $w×$h @$dpr', ({ w, h, dpr }) => {
    const vp = computeViewport(w, h, dpr, undefined, 'fit');
    for (const [gx, gy] of [
      [0, 0],
      [320, 180],
      [639.5, 359.5],
      [12.25, 267.75],
    ] as const) {
      const screen = { x: vp.offsetX + gx * vp.cssScale, y: vp.offsetY + gy * vp.cssScale };
      const game = screenToGame(screen, vp);
      expect(game.x).toBeCloseTo(gx, 6);
      expect(game.y).toBeCloseTo(gy, 6);
    }
  });
});
