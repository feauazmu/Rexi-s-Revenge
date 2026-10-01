import { describe, expect, it } from 'vitest';
import {
  aimTarget,
  followFinger,
  readStick,
  stickToMove,
  wantsDrop,
  type StickConfig,
} from '../../src/platform/touch/stick';

const config: StickConfig = { radius: 20, deadZone: 0.25 };
const origin = { x: 100, y: 100 };
const at = (dx: number, dy: number) => readStick(origin, { x: 100 + dx, y: 100 + dy }, config);

describe('readStick: finger offset to a stick vector', () => {
  it('is zero at the origin and anywhere inside the dead zone', () => {
    expect(at(0, 0)).toEqual({ x: 0, y: 0 });
    expect(at(4, 0)).toEqual({ x: 0, y: 0 });
    expect(at(-3, 3)).toEqual({ x: 0, y: 0 }); // 4.2 px < 5 px dead zone
  });

  it('rescales from the dead-zone edge, so output starts at 0 instead of jumping', () => {
    expect(at(5, 0).x).toBeCloseTo(0);
    expect(at(12.5, 0).x).toBeCloseTo(0.5);
    expect(at(-12.5, 0).x).toBeCloseTo(-0.5);
  });

  it('reaches 1 at the radius and clamps beyond it', () => {
    expect(at(20, 0)).toEqual({ x: 1, y: 0 });
    expect(at(0, 60)).toEqual({ x: 0, y: 1 });
  });

  it('keeps the direction of the finger (a radial, not per-axis, dead zone)', () => {
    const v = at(30, -30);
    expect(v.x).toBeCloseTo(Math.SQRT1_2);
    expect(v.y).toBeCloseTo(-Math.SQRT1_2);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
  });
});

describe('followFinger: a floating stick drags its base along', () => {
  it('keeps the origin while the finger stays within the radius', () => {
    expect(followFinger(origin, { x: 115, y: 100 }, 20)).toEqual(origin);
  });

  it('moves the origin so the finger sits exactly on the rim', () => {
    expect(followFinger(origin, { x: 150, y: 100 }, 20)).toEqual({ x: 130, y: 100 });
    const moved = followFinger(origin, { x: 100, y: 40 }, 20);
    expect(moved.x).toBeCloseTo(100);
    expect(moved.y).toBeCloseTo(60);
  });
});

describe('stickToMove: horizontal movement', () => {
  it('saturates before the rim so full speed does not need a full push', () => {
    expect(stickToMove({ x: 0.7, y: 0 })).toBe(1);
    expect(stickToMove({ x: -1, y: 0.2 })).toBe(-1);
  });

  it('is analog below saturation and ignores the vertical axis', () => {
    expect(stickToMove({ x: 0.3, y: 0.9 })).toBeCloseTo(0.5);
    expect(stickToMove({ x: 0, y: -1 })).toBe(0);
  });
});

describe('wantsDrop: pulling the move stick down', () => {
  it('drops when pulled down past the threshold, within 45° of straight down', () => {
    expect(wantsDrop({ x: 0, y: 0.8 })).toBe(true);
    expect(wantsDrop({ x: 0.5, y: 0.7 })).toBe(true);
  });

  it('does not drop for a shallow pull, an upward push or a mostly sideways push', () => {
    expect(wantsDrop({ x: 0, y: 0.4 })).toBe(false);
    expect(wantsDrop({ x: 0, y: -1 })).toBe(false);
    expect(wantsDrop({ x: 0.8, y: 0.6 })).toBe(false);
  });
});

describe('aimTarget: aim stick direction to a point in game coordinates', () => {
  it('projects the direction from the shoulder by the aim distance', () => {
    expect(aimTarget({ x: 200, y: 150 }, { x: 1, y: 0 }, 80)).toEqual({ x: 280, y: 150 });
    const up = aimTarget({ x: 200, y: 150 }, { x: 0, y: -0.5 }, 80);
    expect(up).toEqual({ x: 200, y: 70 }); // normalized: only the direction matters
  });
});
