import { devices, expect, test, type Page } from '@playwright/test';

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
