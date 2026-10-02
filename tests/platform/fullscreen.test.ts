import { describe, expect, it } from 'vitest';
import { chooseFullscreenSupport } from '../../src/platform/fullscreen';

describe('chooseFullscreenSupport', () => {
  it.each([
    // api, installed, ios → support
    [true, false, false, 'toggle'],
    [true, true, false, 'none'],
    [false, false, false, 'none'],
    [false, true, false, 'none'],
    // iPhone browsers (all WebKit) have no Fullscreen API: hint at installing instead.
    [false, false, true, 'install-hint'],
    [false, true, true, 'none'],
    // iPadOS Safari has the Fullscreen API, so it gets the toggle like any other browser.
    [true, false, true, 'toggle'],
    [true, true, true, 'none'],
  ] as const)('with api=%s, installed=%s, ios=%s offers %s', (api, installed, ios, support) => {
    expect(chooseFullscreenSupport(null, { api, installed, ios })).toBe(support);
  });

  it('lets ?fullscreen= override detection, ignoring unknown values', () => {
    const facts = { api: false, installed: true, ios: false };
    expect(chooseFullscreenSupport('toggle', facts)).toBe('toggle');
    expect(chooseFullscreenSupport('install-hint', facts)).toBe('install-hint');
    const browser = { api: true, installed: false, ios: false };
    expect(chooseFullscreenSupport('none', browser)).toBe('none');
    expect(chooseFullscreenSupport('yes', browser)).toBe('toggle');
  });
});
