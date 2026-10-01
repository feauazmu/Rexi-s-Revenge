import { describe, expect, it } from 'vitest';
import {
  rasterizeRotatedShape,
  rotatedShapeSprites,
  type RotatedShapeOptions,
} from '../../src/render/projectiles/rotated-shape';
import { mirrorSprite, rotateSprite } from '../../src/render/sprite';

/** An arrow-ish test shape: a bar along `u` with a dark notch on its underside at the front. */
const shape: RotatedShapeOptions = {
  palette: { k: '#000000', a: '#ff0000', b: '#0000ff' },
  radius: 4,
  paint: (u, v) => {
    if (Math.abs(u) > 4 || Math.abs(v) > 1.5) return null;
    return u > 2 && v > 0 ? 'b' : 'a';
  },
};

describe('rasterizeRotatedShape', () => {
  it('draws the shape centered in an odd square with a one-pixel outline', () => {
    const sprite = rasterizeRotatedShape(shape, 0);
    expect(sprite.width).toBe(sprite.height);
    expect(sprite.width % 2).toBe(1);
    const mid = (sprite.width - 1) / 2;
    expect(sprite.rows[mid]?.charAt(mid)).toBe('a');
    expect(sprite.rows[mid]).toBe('kaaaaaaaaak');
    expect(sprite.rows[mid - 2]?.charAt(mid)).toBe('k');
  });

  it('turns with the angle, like a quarter-turned sprite', () => {
    const right = rasterizeRotatedShape(shape, 0);
    expect(rasterizeRotatedShape(shape, Math.PI / 2).rows).toEqual(rotateSprite(right, 1).rows);
  });

  it('keeps an upright shape the right way up when heading left', () => {
    const upright = { ...shape, upright: true };
    const right = rasterizeRotatedShape(upright, 0);
    expect(rasterizeRotatedShape(upright, Math.PI).rows).toEqual(mirrorSprite(right).rows);
    expect(rasterizeRotatedShape(shape, Math.PI).rows).toEqual(rotateSprite(right, 2).rows);
  });

  it('snaps to discrete steps and reuses each sprite', () => {
    const spriteAt = rotatedShapeSprites(shape, 16);
    expect(spriteAt(0.05)).toBe(spriteAt(0));
    expect(spriteAt(2 * Math.PI)).toBe(spriteAt(0));
    expect(spriteAt(-Math.PI / 8)).toBe(spriteAt((15 * Math.PI) / 8));
  });
});
