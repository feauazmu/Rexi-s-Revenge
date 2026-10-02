import { describe, expect, it } from 'vitest';
import { chooseFullscreenBehavior, chooseFullscreenSupport } from '../../src/platform/fullscreen';

describe('chooseFullscreenSupport', () => {
  it('offers the toggle when the Fullscreen API is available and the game is not installed', () => {
    expect(chooseFullscreenSupport(null, { api: true, installed: false })).toBe('toggle');
  });

  it('offers nothing once installed, or without the Fullscreen API', () => {
    expect(chooseFullscreenSupport(null, { api: true, installed: true })).toBe('none');
    expect(chooseFullscreenSupport(null, { api: false, installed: false })).toBe('none');
    expect(chooseFullscreenSupport(null, { api: false, installed: true })).toBe('none');
  });

  it('lets ?fullscreen= override detection, ignoring unknown values', () => {
    const facts = { api: false, installed: true };
    expect(chooseFullscreenSupport('toggle', facts)).toBe('toggle');
    expect(chooseFullscreenSupport('install-hint', facts)).toBe('install-hint');
    expect(chooseFullscreenSupport('none', { api: true, installed: false })).toBe('none');
    expect(chooseFullscreenSupport('yes', { api: true, installed: false })).toBe('toggle');
  });
});

describe('chooseFullscreenBehavior', () => {
  it('a touch device with the toggle enters fullscreen on the first touch and locks landscape', () => {
    expect(chooseFullscreenBehavior('touch', 'toggle')).toEqual({
      onFirstTouch: true,
      lockLandscape: true,
    });
  });

  it('desktop enters fullscreen only through the pause menu, without a lock', () => {
    expect(chooseFullscreenBehavior('desktop', 'toggle')).toEqual({
      onFirstTouch: false,
      lockLandscape: false,
    });
  });

  it('without the toggle, a touch device never enters fullscreen on its own', () => {
    expect(chooseFullscreenBehavior('touch', 'install-hint').onFirstTouch).toBe(false);
    expect(chooseFullscreenBehavior('touch', 'none').onFirstTouch).toBe(false);
  });
});
