import { describe, expect, it } from 'vitest';
import { defineSprite, rotateSprite, silhouetteSprite } from '../../src/render/sprite';

const arrow = defineSprite({ a: '#ff0000', b: '#00ff00' }, ['ab.', 'a..']);

describe('sprite transforms', () => {
  it('rotates clockwise by quarter turns', () => {
    expect(rotateSprite(arrow, 1).rows).toEqual(['aa', '.b', '..']);
    expect(rotateSprite(arrow, 2).rows).toEqual(['..a', '.ba']);
    expect(rotateSprite(arrow, 3).rows).toEqual(['..', 'b.', 'aa']);
    expect(rotateSprite(arrow, 4)).toBe(arrow);
    expect(rotateSprite(arrow, -1)).toBe(rotateSprite(arrow, 3));
  });

  it('fills a silhouette with one color, keeping transparency', () => {
    const white = silhouetteSprite(arrow, '#ffffff');
    expect(white.rows).toEqual(arrow.rows);
    expect(new Set(Object.values(white.palette))).toEqual(new Set(['#ffffff']));
  });

  it('memoizes transforms so each is rasterized once', () => {
    expect(silhouetteSprite(arrow, '#ffffff')).toBe(silhouetteSprite(arrow, '#ffffff'));
    expect(rotateSprite(arrow, 1)).toBe(rotateSprite(arrow, 1));
  });
});
