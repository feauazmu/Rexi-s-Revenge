import { describe, expect, it } from 'vitest';
import { chooseDevice, isPortrait } from '../../src/platform/device';

describe('chooseDevice', () => {
  it('uses touch controls for a coarse primary pointer, keyboard + mouse otherwise', () => {
    expect(chooseDevice(null, true)).toBe('touch');
    expect(chooseDevice(null, false)).toBe('desktop');
  });

  it('lets ?device= override detection, ignoring unknown values', () => {
    expect(chooseDevice('touch', false)).toBe('touch');
    expect(chooseDevice('desktop', true)).toBe('desktop');
    expect(chooseDevice('phone', true)).toBe('touch');
  });
});

describe('isPortrait', () => {
  it('is true only when taller than wide', () => {
    expect(isPortrait(390, 844)).toBe(true);
    expect(isPortrait(844, 390)).toBe(false);
    expect(isPortrait(500, 500)).toBe(false);
  });
});
