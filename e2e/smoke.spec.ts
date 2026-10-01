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

test('boots the production build without errors and draws the game', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('');

  const canvas = page.locator('canvas');
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute('width', '480');
  await expect(canvas).toHaveAttribute('height', '270');

  await expect.poll(() => distinctCanvasColors(page)).toBeGreaterThan(8);

  // Play a little: run, jump and fire at the Maletín-cóptero.
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
