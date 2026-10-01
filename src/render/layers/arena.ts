import { TICKS_PER_SECOND, type PlatformView, type RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import type { Surface, Color } from '../surface';
import { ARENA_WIDTH, arenaBackdrop, BILLBOARD_BULB_Y, BILLBOARD_LAMPS } from './arena-backdrop';

const BULB_ON: Color = '#fff6c8';
const BULB_GLOW: Color = '#fde68e';
const BULB_OFF: Color = '#9a7c4a';
/** Billboard bulbs chase in pairs, switching this often (ticks). */
const BULB_STEP_TICKS = 24;

/**
 * The Arena: painted sunset backdrop (sky, drifting clouds, skyline, courthouse, the Bufete &
 * Pesas S.A. tower and plaza), blinking billboard bulbs, and the one-way platforms.
 * Animation phase comes from the Run tick, so the scene freezes while paused.
 */
export function drawArena(dc: DrawContext, run: RunView): void {
  const { surface, sprites } = dc;
  const { sky, clouds, scenery } = arenaBackdrop();
  const t = run.tick / TICKS_PER_SECOND;

  surface.drawBitmap(sprites.get(sky), 0, 0);
  for (const cloud of clouds) {
    // Wrap around: leave on the right, come back in from the left.
    const { width } = cloud.sprite;
    const span = ARENA_WIDTH + width;
    const x = (((Math.floor(cloud.x + cloud.speed * t + width) % span) + span) % span) - width;
    surface.drawBitmap(sprites.get(cloud.sprite), x, cloud.y);
  }
  surface.drawBitmap(sprites.get(scenery), 0, 0);

  const phase = Math.floor(run.tick / BULB_STEP_TICKS) % 2;
  BILLBOARD_LAMPS.forEach((x, i) => {
    const on = i % 2 === phase;
    surface.fillRect(x - 1, BILLBOARD_BULB_Y, 3, 1, on ? BULB_ON : BULB_OFF);
    if (on) surface.fillRect(x - 2, BILLBOARD_BULB_Y + 3, 5, 1, BULB_GLOW);
  });

  for (const platform of run.arena.platforms) drawPlatform(surface, platform);
}

const LEDGE = {
  top: '#f2dfc2',
  lip: '#cfb5a2',
  stone: '#9c8494',
  seam: '#776176',
  under: '#67536b',
  outline: '#33243f',
} as const satisfies Record<string, Color>;

/** Depth of a platform's stone slab below its walkable top, in pixels (art only). */
const LEDGE_DEPTH = 8;

/** A stone ledge: sunlit top edge, block seams, dark underside and corbels at both ends. */
function drawPlatform(surface: Surface, { x, y, w }: PlatformView): void {
  surface.fillRect(x, y - 1, w, LEDGE_DEPTH + 1, LEDGE.outline);
  surface.fillRect(x + 1, y, w - 2, 1, LEDGE.top);
  surface.fillRect(x + 1, y + 1, w - 2, 1, LEDGE.lip);
  surface.fillRect(x + 1, y + 2, w - 2, 4, LEDGE.stone);
  surface.fillRect(x + 1, y + 6, w - 2, 1, LEDGE.under);
  for (let sx = x + 10; sx < x + w - 4; sx += 14) {
    surface.fillRect(sx, y + 2, 1, 4, LEDGE.seam);
    surface.fillRect(sx + 1, y + 2, 1, 1, LEDGE.lip);
  }
  // Rounded top corners.
  surface.fillRect(x, y - 1, 1, 1, LEDGE.under);
  surface.fillRect(x + w - 1, y - 1, 1, 1, LEDGE.under);

  // Corbels: stepped brackets under each end.
  for (const [cx, dir] of [
    [x + 5, 1],
    [x + w - 6, -1],
  ] as const) {
    for (let i = 0; i < 4; i++) {
      const width = 5 - i;
      const left = dir === 1 ? cx : cx - width + 1;
      surface.fillRect(left - 1, y + LEDGE_DEPTH + i, width + 2, 1, LEDGE.outline);
      surface.fillRect(left, y + LEDGE_DEPTH + i, width, 1, i === 0 ? LEDGE.stone : LEDGE.under);
    }
  }
}
