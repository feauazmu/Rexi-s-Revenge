import { describe, expect, it } from 'vitest';
import { chooseFullscreenBehavior, chooseFullscreenSupport } from '../../src/platform/fullscreen';

describe('chooseFullscreenSupport', () => {
  it.each([
    // fullscreenApi, installed, ios → support
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
  ] as const)(
    'with fullscreenApi=%s, installed=%s, ios=%s offers %s',
    (fullscreenApi, installed, ios, support) => {
      expect(chooseFullscreenSupport(null, { fullscreenApi, installed, ios })).toBe(support);
    },
  );

  it('lets ?fullscreen= override detection, ignoring unknown values', () => {
    const facts = { fullscreenApi: false, installed: true, ios: false };
    expect(chooseFullscreenSupport('toggle', facts)).toBe('toggle');
    expect(chooseFullscreenSupport('install-hint', facts)).toBe('install-hint');
    const browser = { fullscreenApi: true, installed: false, ios: false };
    expect(chooseFullscreenSupport('none', browser)).toBe('none');
    expect(chooseFullscreenSupport('yes', browser)).toBe('toggle');
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
