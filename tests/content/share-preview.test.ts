/**
 * The page's share preview: `index.html` has the Spanish title, description, icons, manifest
 * and Open Graph / Twitter card tags; every file they reference exists in `public/`; and the
 * generated images there are up to date with the renderer (`npm run share-preview`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { decodeIco } from '../../scripts/share-preview/pixels';
import {
  decodeIllustration,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  SHARE_FILES,
  shareImages,
} from '../../scripts/share-preview/share-images';
import { FAVICON_SIZES } from '../../src/render';
import { compareImages, decodePng } from '../golden/golden';

const root = fileURLToPath(new URL('../..', import.meta.url));
const publicDir = join(root, 'public');
const SITE_URL = 'https://feauazmu.github.io/Rexi-s-Revenge/';
const html = readFileSync(join(root, 'index.html'), 'utf8');

/** Attributes of every `<tag …>` in the page (enough for this hand-written, flat HTML). */
function tags(name: string): Partial<Record<string, string>>[] {
  return [...html.matchAll(new RegExp(`<${name}\\b([^>]*)>`, 'g'))].map((tag) => {
    const attrs: Partial<Record<string, string>> = {};
    for (const [, key, value] of (tag[1] ?? '').matchAll(/([\w:-]+)="([^"]*)"/g)) {
      if (key !== undefined) attrs[key] = value ?? '';
    }
    return attrs;
  });
}

/** The `content` of the meta tag with this `name` or `property`. */
function meta(key: string): string | undefined {
  return tags('meta').find((m) => m.name === key || m.property === key)?.content;
}

/** A root-absolute page URL (Vite prepends the base) as a path in `public/`. */
function publicPath(href: string): string {
  if (href.startsWith(SITE_URL)) return join(publicDir, href.slice(SITE_URL.length));
  expect(href, `${href} should be root-absolute`).toMatch(/^\/[^/]/);
  return join(publicDir, href.slice(1));
}

async function pngAt(path: string) {
  return decodePng(readFileSync(path));
}

describe('index.html', () => {
  it('is in Spanish, titled "Rexi\'s Revenge", with a Spanish description', () => {
    expect(html).toMatch(/<html lang="es">/);
    expect(html).toContain("<title>Rexi's Revenge</title>");
    const description = meta('description') ?? '';
    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThanOrEqual(200);
    expect(description).toMatch(/juez/);
    expect(meta('theme-color')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('has Open Graph and Twitter card tags with an absolute image URL', () => {
    expect(meta('og:type')).toBe('website');
    expect(meta('og:title')).toBe("Rexi's Revenge");
    expect(meta('og:description')).toBeTruthy();
    expect(meta('og:url')).toBe(SITE_URL);
    expect(meta('og:image')).toBe(`${SITE_URL}${SHARE_FILES.ogImage}`);
    expect(meta('og:image:width')).toBe(String(OG_IMAGE_WIDTH));
    expect(meta('og:image:height')).toBe(String(OG_IMAGE_HEIGHT));
    expect(meta('og:image:alt')).toBeTruthy();
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:title')).toBe("Rexi's Revenge");
    expect(meta('twitter:description')).toBeTruthy();
    expect(meta('twitter:image')).toBe(meta('og:image'));
  });

  it('links a favicon, an Apple touch icon and the web manifest', () => {
    const rels = tags('link').map((link) => link.rel);
    expect(rels).toEqual(expect.arrayContaining(['icon', 'apple-touch-icon', 'manifest']));
  });

  it('references only files that exist in public/, at their declared sizes', async () => {
    for (const link of tags('link')) {
      const href = link.href ?? '';
      expect(existsSync(publicPath(href)), href).toBe(true);
      const size = /^(\d+)x\1$/.exec(link.sizes ?? '')?.[1];
      if (size && href.endsWith('.png')) {
        const image = await pngAt(publicPath(href));
        expect([image.width, image.height], href).toEqual([Number(size), Number(size)]);
      }
    }
    const og = await pngAt(publicPath(meta('og:image') ?? ''));
    expect([og.width, og.height]).toEqual([OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT]);
  });
});

describe('web manifest', () => {
  const manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8')) as {
    name?: string;
    short_name?: string;
    lang?: string;
    theme_color?: string;
    background_color?: string;
    icons?: { src: string; sizes: string; type: string }[];
  };

  it('names the game and sets its colors', () => {
    expect(manifest.name).toBe("Rexi's Revenge");
    expect(manifest.short_name).toBeTruthy();
    expect((manifest.short_name ?? '').length).toBeLessThanOrEqual(15);
    expect(manifest.lang).toBe('es');
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('lists 192 and 512 px icons that exist at those sizes', async () => {
    const icons = manifest.icons ?? [];
    expect(icons.map((icon) => icon.sizes).sort()).toEqual(['192x192', '512x512']);
    for (const icon of icons) {
      const image = await pngAt(join(publicDir, icon.src));
      expect(`${image.width}x${image.height}`).toBe(icon.sizes);
      expect(icon.type).toBe('image/png');
    }
  });
});

describe('generated share images', () => {
  it('match what the renderer draws now (else run: npm run share-preview)', async () => {
    const illustration = await decodeIllustration(join(publicDir, 'title.png'));
    for (const [file, expected] of shareImages(illustration)) {
      const actual = await pngAt(join(publicDir, file));
      expect(compareImages(actual, expected).mismatchedPixels, file).toBe(0);
    }
  });

  it('pack the 16, 32 and 48 px favicons into favicon.ico', async () => {
    const entries = decodeIco(readFileSync(join(publicDir, SHARE_FILES.faviconIco)));
    expect(entries.map((entry) => entry.size)).toEqual([...FAVICON_SIZES]);
    for (const { size, png } of entries) {
      const fromIco = await decodePng(Buffer.from(png));
      const file = await pngAt(join(publicDir, SHARE_FILES.favicons[size] ?? ''));
      expect(compareImages(fromIco, file).mismatchedPixels, `${size} px`).toBe(0);
    }
  });
});
