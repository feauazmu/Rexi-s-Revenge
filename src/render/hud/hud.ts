import { SCREEN_WIDTH, TICKS_PER_SECOND, type ActivePowerUpView, type RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import { fillCutRect } from '../frame';
import { drawOutlinedText } from '../screens/ui';
import { defineSprite, type SpriteDef } from '../sprite';
import { strings } from '../strings';
import type { Color, Surface } from '../surface';
import { fonts, formatElapsed, type TextAlign } from '../text';
import { powerUpIcons } from './power-up-icons';
import { ICON_SIZE, weaponIcons } from './weapon-icons';

/**
 * HUD colors (master palette): gold labels, warm-white values, red health on a night plate.
 * Every text has a 1 px ink outline so it reads over any part of the Arena.
 */
const ink = {
  outline: P.outline,
  label: P.gold,
  value: P.white,
  plate: P.night,
  plateEdge: P.robeSheen,
  slot: P.robe,
  slotLight: P.robeMid,
  barEmpty: P.red1,
  barEmptyLine: P.night,
  barTick: P.night,
  bar: P.red3,
  barShine: P.redLight,
  barGlint: P.coral,
  barShade: P.red2,
  timer: P.gold,
  timerShade: P.brass,
  timerEmpty: P.robe,
} as const satisfies Record<string, Color>;

const MARGIN = 6;
const LABEL_GAP = 4;
/** Capitals start this far below a regular text cell's top (the rows above hold accents). */
const CAP = fonts.regular.baseline - 7;

/** The health plate (top left): heart, then the bar, on a dark plate. */
const PLATE = { x: MARGIN - 2, y: 4, w: 152, h: 15 } as const;
const BAR = { x: PLATE.x + 15, y: PLATE.y + 4, w: 132, h: 7 } as const;
/** The bar is cut into this many segments by dark ticks. */
const BAR_SEGMENTS = 10;

const HEART = defineSprite(
  { k: P.outline, t: P.coral, v: P.redLight, s: P.red3, q: P.red2, w: P.white },
  [
    '.kkk.kkk.',
    'kwtvkvssk',
    'kttssssqk',
    'kvsssssqk',
    '.ksssqqk.',
    '..ksqqk..',
    '...kqk...',
    '....k....',
  ],
);

/** Icon rows in the left column: the current Weapon, then one per active timed Power-up. */
const SLOT = 20;
const WEAPON_ROW_Y = 24;
const ICON_ROW_PITCH = 23;
/** Seconds-left bar under a Power-up's timer. */
const TIMER_BAR = { w: 24, h: 3 } as const;

/**
 * The HUD Weapon slot (the framed icon): the touch overlay brackets it as the tap-to-cycle
 * button.
 */
export const HUD_WEAPON_ICON = { x: MARGIN, y: WEAPON_ROW_Y, w: SLOT, h: SLOT } as const;
/** A Power-up's icon blinks during its last seconds, toggling every few ticks. */
const EXPIRY_WARNING_TICKS = 2 * TICKS_PER_SECOND;
const EXPIRY_BLINK_TICKS = 6;

/**
 * HUD: health plate (top left), the current Weapon in a framed slot with its ammo (below it),
 * one row per active timed Power-up with its seconds left and a draining bar (below that),
 * elapsed time (top center) and score (top right). All text goes through the bitmap font.
 */
export function drawHud(dc: DrawContext, run: RunView): void {
  drawHealth(dc, run.rexi.health, run.rexi.maxHealth);
  drawWeapon(dc, run);
  run.rexi.powerUps.forEach((powerUp, i) => {
    drawPowerUpTimer(dc, powerUp, WEAPON_ROW_Y + (i + 1) * ICON_ROW_PITCH);
  });
  drawLabeled(
    dc,
    strings.hud.time,
    formatElapsed(run.stats.ticksSurvived),
    SCREEN_WIDTH / 2,
    'center',
  );
  drawLabeled(dc, strings.hud.score, String(run.stats.score), SCREEN_WIDTH - MARGIN, 'right');
}

/** A dark rectangle with cut corners and a lit top edge (behind HUD readouts). */
function drawPlate(surface: Surface, x: number, y: number, w: number, h: number): void {
  fillCutRect(surface, x, y, w, h, ink.outline);
  surface.fillRect(x + 1, y + 1, w - 2, h - 2, ink.plate);
  surface.fillRect(x + 2, y + 1, w - 4, 1, ink.plateEdge);
}

function drawHealth(dc: DrawContext, health: number, maxHealth: number): void {
  const { surface } = dc;
  const share = maxHealth > 0 ? Math.min(1, Math.max(0, health / maxHealth)) : 0;

  drawPlate(surface, PLATE.x, PLATE.y, PLATE.w, PLATE.h);
  surface.drawBitmap(dc.sprites.get(HEART), PLATE.x + 3, PLATE.y + 3);

  surface.fillRect(BAR.x, BAR.y, BAR.w, BAR.h, ink.outline);
  const inner = { x: BAR.x + 1, y: BAR.y + 1, w: BAR.w - 2, h: BAR.h - 2 };
  surface.fillRect(inner.x, inner.y, inner.w, inner.h, ink.barEmpty);
  surface.fillRect(inner.x, inner.y + inner.h - 1, inner.w, 1, ink.barEmptyLine);
  // Never show an empty bar while Rexi still has health left.
  const fill = health > 0 ? Math.max(1, Math.round(inner.w * share)) : 0;
  if (fill > 0) {
    surface.fillRect(inner.x, inner.y, fill, inner.h, ink.bar);
    surface.fillRect(inner.x, inner.y, fill, 1, ink.barShine);
    surface.fillRect(inner.x, inner.y + inner.h - 1, fill, 1, ink.barShade);
    surface.fillRect(inner.x, inner.y, Math.min(fill, 2), 1, ink.barGlint);
  }
  // Segment ticks: dark notches on the top and bottom rows.
  for (let i = 1; i < BAR_SEGMENTS; i++) {
    const tx = inner.x + Math.round((inner.w * i) / BAR_SEGMENTS);
    surface.fillRect(tx, inner.y, 1, 1, ink.barTick);
    surface.fillRect(tx, inner.y + inner.h - 1, 1, 1, ink.barTick);
  }
}

/** A framed square holding an icon: outline with cut corners, bevelled fill. */
function drawSlot(dc: DrawContext, icon: SpriteDef | null, x: number, y: number): void {
  const { surface } = dc;
  fillCutRect(surface, x, y, SLOT, SLOT, ink.outline);
  surface.fillRect(x + 1, y + 1, SLOT - 2, SLOT - 2, ink.slot);
  surface.fillRect(x + 2, y + 1, SLOT - 4, 1, ink.slotLight);
  surface.fillRect(x + 1, y + 2, 1, SLOT - 4, ink.slotLight);
  if (icon) {
    const inset = (SLOT - ICON_SIZE) / 2;
    surface.drawBitmap(dc.sprites.get(icon), x + inset, y + inset);
  }
}

function drawWeapon(dc: DrawContext, run: RunView): void {
  const { weapon } = run.rexi;
  drawSlot(dc, weaponIcons[weapon.id], MARGIN, WEAPON_ROW_Y);
  const ammo = weapon.ammo === null ? strings.hud.unlimitedAmmo : String(weapon.ammo);
  // Capitals centered on the slot.
  const textY = WEAPON_ROW_Y + SLOT / 2 - 4 - CAP;
  drawOutlinedText(dc, fonts.regular, ammo, MARGIN + SLOT + LABEL_GAP, textY, ink.value);
}

function drawPowerUpTimer(dc: DrawContext, powerUp: ActivePowerUpView, y: number): void {
  const { ticksLeft, totalTicks } = powerUp;
  const blinkOff =
    ticksLeft <= EXPIRY_WARNING_TICKS && Math.floor(ticksLeft / EXPIRY_BLINK_TICKS) % 2 === 1;
  drawSlot(dc, blinkOff ? null : powerUpIcons[powerUp.id], MARGIN, y);

  const x = MARGIN + SLOT + LABEL_GAP;
  const seconds = String(Math.ceil(ticksLeft / TICKS_PER_SECOND));
  drawOutlinedText(dc, fonts.regular, seconds, x, y + 3 - CAP, ink.value);

  // The bar drains with the time left.
  const { surface } = dc;
  const barY = y + SLOT - TIMER_BAR.h - 3;
  surface.fillRect(x - 1, barY - 1, TIMER_BAR.w + 2, TIMER_BAR.h + 2, ink.outline);
  surface.fillRect(x, barY, TIMER_BAR.w, TIMER_BAR.h, ink.timerEmpty);
  const share = totalTicks > 0 ? Math.min(1, ticksLeft / totalTicks) : 0;
  const fill = ticksLeft > 0 ? Math.max(1, Math.round(TIMER_BAR.w * share)) : 0;
  if (fill > 0) {
    surface.fillRect(x, barY, fill, TIMER_BAR.h, ink.timer);
    surface.fillRect(x, barY + TIMER_BAR.h - 1, fill, 1, ink.timerShade);
  }
}

/** "LABEL value" on the top text row, anchored at `x` as a whole, capitals level with the bar. */
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
  const top = BAR.y - CAP;
  drawOutlinedText(dc, font, label, left, top, ink.label);
  drawOutlinedText(dc, font, value, left + labelWidth + LABEL_GAP, top, ink.value);
}
