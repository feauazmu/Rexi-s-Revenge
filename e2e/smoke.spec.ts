import { expect, test, type Page } from '@playwright/test';

/** Collects console errors and uncaught exceptions for the whole test. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Number of distinct colors in the game canvas (1 means blank). */
function distinctCanvasColors(page: Page): Promise<number> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return 0;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const colors = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      colors.add(((data[i] ?? 0) << 16) | ((data[i + 1] ?? 0) << 8) | (data[i + 2] ?? 0));
    }
    return colors.size;
  });
}

/** The screen the game shows, as exposed by the shell on the app root. */
function screenOf(page: Page): Promise<string | null> {
  return page.locator('#app').getAttribute('data-screen');
}

/** Marks "Cómo jugar" as seen, as a returning player would have it. */
async function asReturningPlayer(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('rexis-revenge:how-to-play-seen', '1');
  });
}

test('boots the production build on the Title without errors and draws it', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('');

  const canvas = page.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('width', '480');
  await expect(canvas).toHaveAttribute('height', '270');

  await expect.poll(() => screenOf(page)).toBe('title');
  await expect.poll(() => distinctCanvasColors(page)).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});

test('the Title is drawn over the title illustration', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('');
  await expect(page.locator('#app')).toHaveAttribute('data-title-illustration', 'loaded');
  await expect.poll(() => screenOf(page)).toBe('title');
  // The painted illustration has far more colors than the code-drawn backdrop.
  await expect.poll(() => distinctCanvasColors(page)).toBeGreaterThan(500);
  expect(errors).toEqual([]);
});

test('serves the icons, manifest and link preview image the page references', async ({
  page,
  request,
}) => {
  await page.goto('');
  const hrefs = await page.evaluate(() => [
    ...Array.from(
      document.querySelectorAll('link[rel]'),
      (link) => link.getAttribute('href') ?? '',
    ),
    document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
  ]);
  for (const href of hrefs.filter((h) => !h.includes('/assets/'))) {
    // The og:image is the deployed absolute URL; check the same file on this server.
    const path = href.replace('https://feauazmu.github.io', '');
    const response = await request.get(new URL(path, page.url()).href);
    expect(response.status(), path).toBe(200);
  }
});

test('a key press moves from the Title into the Run, and the Run plays', async ({ page }) => {
  const errors = trackErrors(page);
  await asReturningPlayer(page);
  await page.goto('');
  await expect.poll(() => screenOf(page)).toBe('title');

  await page.waitForTimeout(600); // the Title ignores input for its first half second
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('run');

  // Play a little: run, jump and fire.
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no layout box');
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3);
  await page.keyboard.down('KeyD');
  await page.mouse.down();
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  await page.mouse.up();
  await page.keyboard.up('KeyD');

  expect(await distinctCanvasColors(page)).toBeGreaterThan(8);
  expect(errors).toEqual([]);
});

test('a first-time player sees Cómo jugar once, then goes straight in', async ({ page }) => {
  await page.goto('');
  await expect.poll(() => screenOf(page)).toBe('title');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('how-to-play');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('run');

  await page.reload();
  await expect.poll(() => screenOf(page)).toBe('title');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('run');
});

test('pauses with Esc, auto-pauses when the tab is hidden, and Salir returns to the Title', async ({
  page,
}) => {
  await asReturningPlayer(page);
  await page.goto('');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('run');

  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('paused');
  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('run');

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => screenOf(page)).toBe('paused');

  await page.keyboard.press('ArrowUp'); // wraps from Continuar to Salir
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('title');
});

test('audio stays off until the first interaction, then starts without autoplay errors', async ({
  page,
}) => {
  const errors = trackErrors(page);
  const audioWarnings: string[] = [];
  page.on('console', (msg) => {
    if (/audio/i.test(msg.text())) audioWarnings.push(msg.text());
  });
  await asReturningPlayer(page);
  await page.goto('');
  await expect.poll(() => screenOf(page)).toBe('title');
  await page.waitForTimeout(600);
  expect(await page.locator('#app').getAttribute('data-audio')).toBe('locked');

  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('run');
  await expect.poll(() => page.locator('#app').getAttribute('data-audio')).toBe('running');
  // The soundtrack (public/music) is fetched with the site base, decoded and looping.
  await expect
    .poll(() => page.locator('#app').getAttribute('data-music-track'), { timeout: 10_000 })
    .toBe('playing');
  await page.mouse.down(); // fire a few shots: sounds play through the running engine
  await page.waitForTimeout(400);
  await page.mouse.up();

  expect(errors).toEqual([]);
  expect(audioWarnings).toEqual([]);
});

test('muting the music from the pause menu persists across reloads', async ({ page }) => {
  const music = () => page.locator('#app').getAttribute('data-music');
  await asReturningPlayer(page);
  await page.goto('');
  await expect.poll(music).toBe('on');
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  await expect.poll(() => screenOf(page)).toBe('run');

  await page.keyboard.press('Escape');
  await expect.poll(() => screenOf(page)).toBe('paused');
  await page.keyboard.press('ArrowDown'); // Silenciar música
  await page.keyboard.press('Enter');
  await expect.poll(music).toBe('muted');

  await page.reload();
  await expect.poll(() => screenOf(page)).toBe('title');
  expect(await music()).toBe('muted');
});

test('scales the canvas by a whole number with letterboxing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('');
  const box = await page.locator('canvas').boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width).toBe(960);
  expect(box?.height).toBe(540);
  expect(box?.x).toBe(160);
  expect(box?.y).toBe(130);
});
