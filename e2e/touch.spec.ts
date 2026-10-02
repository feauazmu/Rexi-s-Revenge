import { devices, expect, test, type Page } from '@playwright/test';
import {
  readFullscreenCalls,
  readHighScores,
  spyOnFullscreen,
  SWEEP_STEP_MS,
  SWEEP_STEPS,
  sweepAngle,
  trackErrors,
} from './support';

// Emulated phones: a coarse touch pointer, so the shell picks the touch controls.
// `defaultBrowserType` cannot be set inside a describe block; the project's browser is used.
function phone(name: 'Pixel 7' | 'Pixel 7 landscape') {
  const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } = devices[name];
  return { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent };
}
const phoneLandscape = phone('Pixel 7 landscape');
const phonePortrait = phone('Pixel 7');

function app(page: Page) {
  return page.locator('#app');
}

/** Taps the point (x, y) given in game coordinates (640×360). */
async function tapGame(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('.game-canvas').boundingBox();
  if (!box) throw new Error('game canvas has no layout box');
  await page.touchscreen.tap(box.x + (x * box.width) / 640, box.y + (y * box.height) / 360);
}

/** Number of distinct colors in a canvas (1 means blank). */
function distinctColors(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const canvas = document.querySelector<HTMLCanvasElement>(sel);
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      colors.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0));
    }
    return colors.size;
  }, selector);
}

test.describe('phone in landscape', () => {
  test.use(phoneLandscape);

  test('the game canvas fills the viewport height', async ({ page }) => {
    const canvasHeight = async () =>
      (await page.locator('.game-canvas').boundingBox())?.height ?? 0;
    await page.goto('');
    await expect(page.locator('.game-canvas')).toBeVisible();
    // 863×360 at DPR 2.625: a whole-number scale would drop to 2 device px (274 CSS px tall).
    await expect.poll(canvasHeight).toBeCloseTo(360, 0);
    // Browser bars leaving less than 360 CSS px: the game still fills the height.
    await page.setViewportSize({ width: 863, height: 320 });
    await expect.poll(canvasHeight).toBeCloseTo(320, 0);
  });

  test('shows the touch controls and plays with touch only', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('');

    await expect(app(page)).toHaveAttribute('data-device', 'touch');
    await expect(app(page)).toHaveAttribute('data-orientation', 'landscape');
    await expect(page.locator('.game-canvas')).toBeVisible();
    await expect(page.locator('.rotate-canvas')).toBeHidden();
    await expect(app(page)).toHaveAttribute('data-screen', 'title');

    // Title and Cómo jugar: a tap anywhere starts.
    await page.waitForTimeout(600);
    await tapGame(page, 320, 180);
    await expect(app(page)).toHaveAttribute('data-screen', 'how-to-play');
    await page.waitForTimeout(600);
    await tapGame(page, 320, 180);
    await expect(app(page)).toHaveAttribute('data-screen', 'run');
    await expect(app(page)).toHaveAttribute('data-touch-controls', 'play');

    // Pause button (top right), then the menu's back button resumes.
    await tapGame(page, 621, 39);
    await expect(app(page)).toHaveAttribute('data-screen', 'paused');
    await expect(app(page)).toHaveAttribute('data-touch-controls', 'menu');
    await tapGame(page, 528, 315);
    await expect(app(page)).toHaveAttribute('data-screen', 'run');

    // Pause again; d-pad up wraps to Salir, confirm returns to the Title.
    await tapGame(page, 621, 39);
    await expect(app(page)).toHaveAttribute('data-screen', 'paused');
    await tapGame(page, 69, 285 - 23);
    await tapGame(page, 576, 280);
    await expect(app(page)).toHaveAttribute('data-screen', 'title');

    expect(await distinctColors(page, '.game-canvas')).toBeGreaterThan(8);
    expect(errors).toEqual([]);
  });
});

test.describe('phone in landscape, fullscreen', () => {
  test.use(phoneLandscape);

  test('the first Title tap requests fullscreen and locks landscape, later taps do not', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await spyOnFullscreen(page);
    await page.goto('');
    await expect(app(page)).toHaveAttribute('data-screen', 'title');
    expect(await readFullscreenCalls(page)).toEqual({ requests: 0, locks: [] });

    await tapGame(page, 320, 180);
    await expect
      .poll(() => readFullscreenCalls(page))
      .toEqual({
        requests: 1,
        locks: ['landscape'],
      });

    // The stub never enters fullscreen, so a second request would show up in the count.
    await page.waitForTimeout(600);
    await tapGame(page, 320, 180);
    await expect(app(page)).not.toHaveAttribute('data-screen', 'title');
    await page.waitForTimeout(600);
    await tapGame(page, 320, 180);
    await expect(app(page)).toHaveAttribute('data-screen', 'run');
    expect(await readFullscreenCalls(page)).toEqual({ requests: 1, locks: ['landscape'] });
    expect(errors).toEqual([]);
  });

  test('Pantalla completa in the pause menu also locks landscape', async ({ page }) => {
    await spyOnFullscreen(page);
    await page.goto('');
    await page.waitForTimeout(600);
    await tapGame(page, 320, 180);
    await page.waitForTimeout(600);
    await tapGame(page, 320, 180);
    await expect(app(page)).toHaveAttribute('data-screen', 'run');

    // Pause; d-pad up twice wraps to Salir, then Pantalla completa; confirm.
    await tapGame(page, 621, 39);
    await expect(app(page)).toHaveAttribute('data-screen', 'paused');
    await tapGame(page, 69, 285 - 23);
    await tapGame(page, 69, 285 - 23);
    await tapGame(page, 576, 280);
    await expect
      .poll(() => readFullscreenCalls(page))
      .toEqual({
        requests: 2,
        locks: ['landscape', 'landscape'],
      });
  });

  test('a refused fullscreen request or orientation lock does not affect the game', async ({
    page,
  }) => {
    const errors = trackErrors(page);
    await page.addInitScript(() => {
      Element.prototype.requestFullscreen = () => Promise.reject(new TypeError('refused'));
      screen.orientation.lock = () =>
        Promise.reject(new DOMException('not supported', 'NotSupportedError'));
    });
    await page.goto('');
    await page.waitForTimeout(600);
    await tapGame(page, 320, 180);
    await expect(app(page)).not.toHaveAttribute('data-screen', 'title');
    expect(errors).toEqual([]);
  });
});

test.describe('phone in landscape, a whole Run', () => {
  test.use(phoneLandscape);

  test('fires with the aim stick until Rexi falls, then signs the Veredicto with ✓', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    // A fake clock drives requestAnimationFrame (a minute of play runs as fast as it renders);
    // the fixed seed makes the Run the same every time.
    await page.clock.install({ time: 0 });
    await page.goto('?seed=1');
    await expect(app(page)).toHaveAttribute('data-screen', 'title');
    for (const next of ['how-to-play', 'run']) {
      await page.clock.runFor(700);
      await tapGame(page, 320, 180);
      await page.clock.runFor(100);
      await expect(app(page)).toHaveAttribute('data-screen', next);
    }

    // A real touch drag (through CDP, so the browser makes pointer events with capture): hold
    // the right-hand aim stick and sweep it across the sky.
    const box = await page.locator('.game-canvas').boundingBox();
    if (!box) throw new Error('game canvas has no layout box');
    const client = (x: number, y: number) => ({
      x: box.x + (x * box.width) / 640,
      y: box.y + (y * box.height) / 360,
    });
    const cdp = await page.context().newCDPSession(page);
    const origin = { x: 500, y: 250 };
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ ...client(origin.x, origin.y), id: 1 }],
    });
    for (
      let i = 0;
      i < SWEEP_STEPS && (await app(page).getAttribute('data-screen')) === 'run';
      i++
    ) {
      const angle = sweepAngle(i);
      const point = client(origin.x + 40 * Math.cos(angle), origin.y - 40 * Math.sin(angle));
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ ...point, id: 1 }],
      });
      await page.clock.runFor(SWEEP_STEP_MS);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(app(page)).toHaveAttribute('data-screen', 'verdict');
    await expect(app(page)).toHaveAttribute('data-touch-controls', 'menu');

    // After the read-out, ✓ signs the default initials letter by letter.
    await page.clock.runFor(1500);
    for (let letter = 0; letter < 3; letter++) {
      await tapGame(page, 576, 280);
      await page.clock.runFor(100);
    }
    const { entries } = await readHighScores(page);
    expect(entries?.map(({ initials }) => initials)).toEqual(['AAA']);
    expect(entries?.[0]?.score).toBeGreaterThan(0);

    await page.clock.runFor(600);
    await tapGame(page, 320, 180);
    await page.clock.runFor(100);
    await expect(app(page)).toHaveAttribute('data-screen', 'title');
    expect(errors).toEqual([]);
  });
});

test.describe('phone in portrait', () => {
  test.use(phonePortrait);

  test('shows the rotate prompt instead of the game', async ({ page }) => {
    await page.goto('');
    await expect(app(page)).toHaveAttribute('data-device', 'touch');
    await expect(app(page)).toHaveAttribute('data-orientation', 'portrait');
    await expect(page.locator('.rotate-canvas')).toBeVisible();
    await expect(page.locator('.game-canvas')).toBeHidden();
    await expect.poll(() => distinctColors(page, '.rotate-canvas')).toBeGreaterThan(4);
  });

  test('turning the phone upright mid-Run pauses it', async ({ page }) => {
    // Out of fullscreen (a browser without the lock, e.g. iOS): the first tap must not enter it.
    await spyOnFullscreen(page);
    await page.addInitScript(() => {
      localStorage.setItem('rexis-revenge:how-to-play-seen', '1');
    });
    await page.setViewportSize({ width: 839, height: 412 });
    await page.goto('');
    await page.waitForTimeout(600);
    await tapGame(page, 320, 180);
    await expect(app(page)).toHaveAttribute('data-screen', 'run');

    await page.setViewportSize({ width: 412, height: 839 });
    await expect(page.locator('.rotate-canvas')).toBeVisible();
    await expect(app(page)).toHaveAttribute('data-screen', 'paused');

    await page.setViewportSize({ width: 839, height: 412 });
    await expect(page.locator('.game-canvas')).toBeVisible();
    await expect(app(page)).toHaveAttribute('data-screen', 'paused');
  });
});
