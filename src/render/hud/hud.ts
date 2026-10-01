import { SCREEN_WIDTH, type RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { palette } from '../palette';
import { defineSprite } from '../sprite';
import { strings } from '../strings';
import type { Color } from '../surface';
import { drawText, fonts, formatElapsed, type TextAlign } from '../text';
import { weaponIcons } from './weapon-icons';

const MARGIN = 6;
/** Top of the first HUD text row: capitals then line up with the health bar. */
const TEXT_TOP = 3;
const LABEL_GAP = 4;

const LABEL: Color = '#ffd88a';
const VALUE: Color = palette.white;
const SHADOW: Color = palette.outline;

const BAR = { x: MARGIN + 10, y: 6, w: 82, h: 7 } as const;
const BAR_EMPTY: Color = '#4a1426';
const BAR_FILL: Color = '#e8433a';
const BAR_SHINE: Color = '#ff9a7a';

const HEART = defineSprite({ k: palette.outline, r: '#e8433a', R: '#ff9a7a' }, [
  '.kk.kk.',
  'kRrkrrk',
  'krrrrrk',
  'krrrrrk',
  '.krrrk.',
  '..krk..',
  '...k...',
]);

const WEAPON_ROW_Y = 16;

/**
 * HUD: health bar (top left), current Weapon icon and ammo (below it), elapsed time (top
 * center) and score (top right). All text goes through the bitmap font.
 */
export function drawHud(dc: DrawContext, run: RunView): void {
  drawHealth(dc, run.rexi.health, run.rexi.maxHealth);
  drawWeapon(dc, run);
  drawLabeled(
    dc,
    strings.hud.time,
    formatElapsed(run.stats.ticksSurvived),
    SCREEN_WIDTH / 2,
    'center',
  );
  drawLabeled(dc, strings.hud.score, String(run.stats.score), SCREEN_WIDTH - MARGIN, 'right');
}

function drawHealth(dc: DrawContext, health: number, maxHealth: number): void {
  const { surface } = dc;
  surface.drawBitmap(dc.sprites.get(HEART), MARGIN, BAR.y);
  surface.fillRect(BAR.x, BAR.y, BAR.w, BAR.h, SHADOW);
  const inner = { x: BAR.x + 1, y: BAR.y + 1, w: BAR.w - 2, h: BAR.h - 2 };
  surface.fillRect(inner.x, inner.y, inner.w, inner.h, BAR_EMPTY);
  const share = maxHealth > 0 ? Math.min(1, Math.max(0, health / maxHealth)) : 0;
  // Never show an empty bar while Rexi still has health left.
  const fill = health > 0 ? Math.max(1, Math.round(inner.w * share)) : 0;
  if (fill > 0) {
    surface.fillRect(inner.x, inner.y, fill, inner.h, BAR_FILL);
    surface.fillRect(inner.x, inner.y, fill, 1, BAR_SHINE);
  }
}

function drawWeapon(dc: DrawContext, run: RunView): void {
  const { weapon } = run.rexi;
  const icon = weaponIcons[weapon.id];
  dc.surface.drawBitmap(dc.sprites.get(icon), MARGIN, WEAPON_ROW_Y);
  const ammo = weapon.ammo === null ? strings.hud.unlimitedAmmo : String(weapon.ammo);
  const font = fonts.regular;
  // Center the capitals on the icon.
  const capCenter = font.baseline - 4;
  const y = WEAPON_ROW_Y + Math.floor(icon.height / 2) - capCenter;
  drawText(dc, font, ammo, MARGIN + icon.width + LABEL_GAP, y, { color: VALUE, shadow: SHADOW });
}

/** "LABEL value" on the top text row, anchored at `x` as a whole. */
function drawLabeled(
  dc: DrawContext,
  label: string,
  value: string,
  x: number,
  align: TextAlign,
): void {
  const font = fonts.regular;
  const labelWidth = font.measure(label);
  const width = labelWidth + LABEL_GAP + font.measure(value);
  const left = align === 'left' ? x : align === 'center' ? x - Math.floor(width / 2) : x - width;
  drawText(dc, font, label, left, TEXT_TOP, { color: LABEL, shadow: SHADOW });
  drawText(dc, font, value, left + labelWidth + LABEL_GAP, TEXT_TOP, {
    color: VALUE,
    shadow: SHADOW,
  });
}
