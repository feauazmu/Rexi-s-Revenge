import { describe, expect, it } from 'vitest';
import { chooseFullscreenSupport } from '../../src/platform/fullscreen';

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
