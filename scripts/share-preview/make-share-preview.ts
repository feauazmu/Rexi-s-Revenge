/**
 * Writes the share preview images to `public/` (issue #24): favicons (16/32/48 px PNGs and
 * `favicon.ico`), the Apple touch icon (180 px), the web manifest icons (192/512 px) and the
 * 1200×630 Open Graph / Twitter image composed from the title illustration and the code-drawn
 * logo. Everything is rendered by the game's renderer, so re-run this after changing the logo,
 * the icons, the share card or `public/title.png`:
 *
 *   npm run share-preview
 *
 * `tests/content/share-preview.test.ts` fails when the committed files are out of date.
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runnerImport } from 'vite';
import type * as ShareImages from './share-images.ts';

const root = resolve(import.meta.dirname, '../..');
const publicDir = join(root, 'public');

// The renderer's sources use extensionless imports, so load them through Vite's module runner.
const { module: images } = await runnerImport<typeof ShareImages>(
  join(import.meta.dirname, 'share-images.ts'),
  { root, configFile: false, logLevel: 'error' },
);

const illustration = await images.decodeIllustration(join(publicDir, 'title.png'));
for (const [file, image] of images.shareImages(illustration)) {
  writeFileSync(join(publicDir, file), await images.encodePng(image));
  console.log(`public/${file}  ${image.width}×${image.height}`);
}
writeFileSync(join(publicDir, images.SHARE_FILES.faviconIco), await images.faviconIco());
console.log(`public/${images.SHARE_FILES.faviconIco}`);
