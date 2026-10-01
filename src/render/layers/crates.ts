import type { CrateContents, CrateView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { powerUpIcons } from '../hud/power-up-icons';
import { weaponIcons } from '../hud/weapon-icons';
import { palette } from '../palette';
import { defineSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';

interface CrateStyle {
  readonly frame: Color;
  readonly frameShade: Color;
  readonly nail: Color;
  readonly label: Color;
  readonly labelShade: Color;
}

/** Color-coded by family (as in Heli Attack 2): wooden Weapon Crates, steel Power-up Crates. */
const STYLES: Readonly<Record<CrateContents['kind'], CrateStyle>> = {
  weapon: {
    frame: '#b0703c',
    frameShade: '#7a4524',
    nail: '#e8c050',
    label: '#f0e0b0',
    labelShade: '#c8a878',
  },
  'power-up': {
    frame: '#3a6ab0',
    frameShade: '#24406a',
    nail: '#c0d8f0',
    label: '#f4f4f4',
    labelShade: '#b8c4d0',
  },
};

/** Blink "off" frames flash the Crate white instead of hiding it, so it stays readable. */
const FLASH: Color = '#fff8e0';
/** Blink cadence in ticks: steady, then faster during the last second. */
const BLINK_PERIOD = 6;
const FAST_BLINK_PERIOD = 3;
const FAST_BLINK_TICKS = 60;

/** Parachute drawn above a falling Crate; its strings meet the Crate's top corners. */
const PARACHUTE = defineSprite({ k: palette.outline, R: '#e8433a', W: '#f2f2f2', s: '#d8d0b0' }, [
  '......kkkkkkkkkk......',
  '....kkRRWWRRWWRRkk....',
  '..kkRRRWWWRRWWWRRRkk..',
  '.kRRRRWWWWRRWWWWRRRRk.',
  'kkkkkkkkkkkkkkkkkkkkkk',
  '.s..................s.',
  '.s..................s.',
  '..s................s..',
  '..s................s..',
]);

/** Label area inside the frame: icons up to this size fit. */
const LABEL_INSET = 3;

function iconOf(contents: CrateContents): SpriteDef {
  return contents.kind === 'weapon' ? weaponIcons[contents.weapon] : powerUpIcons[contents.powerUp];
}

function isFlashing(crate: CrateView): boolean {
  if (!crate.blinking || crate.ticksLeft === null) return false;
  const period = crate.ticksLeft <= FAST_BLINK_TICKS ? FAST_BLINK_PERIOD : BLINK_PERIOD;
  return Math.floor(crate.ticksLeft / period) % 2 === 1;
}

/** Crates: a framed box showing its contents' icon, under a parachute while falling. */
export function drawCrates(dc: DrawContext, run: RunView): void {
  for (const crate of run.crates) drawCrate(dc, crate);
}

function drawCrate(dc: DrawContext, crate: CrateView): void {
  const { surface } = dc;
  // Snap once so every part of the Crate moves together.
  const x = Math.round(crate.x);
  const y = Math.round(crate.y);
  const { w, h } = crate;

  if (!crate.landed) {
    surface.drawBitmap(
      dc.sprites.get(PARACHUTE),
      x + Math.floor((w - PARACHUTE.width) / 2),
      y - PARACHUTE.height,
    );
  }

  // Outline with clipped corners.
  surface.fillRect(x + 1, y, w - 2, h, palette.outline);
  surface.fillRect(x, y + 1, w, h - 2, palette.outline);

  if (isFlashing(crate)) {
    surface.fillRect(x + 1, y + 1, w - 2, h - 2, FLASH);
    return;
  }

  const style = STYLES[crate.contents.kind];
  surface.fillRect(x + 1, y + 1, w - 2, h - 2, style.frame);
  surface.fillRect(x + 1, y + h - 2, w - 2, 1, style.frameShade);
  surface.fillRect(x + w - 2, y + 1, 1, h - 2, style.frameShade);
  for (const [nx, ny] of [
    [x + 2, y + 2],
    [x + w - 3, y + 2],
    [x + 2, y + h - 3],
    [x + w - 3, y + h - 3],
  ] as const) {
    surface.fillRect(nx, ny, 1, 1, style.nail);
  }

  const label = {
    x: x + LABEL_INSET,
    y: y + LABEL_INSET,
    w: w - 2 * LABEL_INSET,
    h: h - 2 * LABEL_INSET,
  };
  surface.fillRect(label.x, label.y, label.w, label.h, style.label);
  surface.fillRect(label.x, label.y, label.w, 1, style.labelShade);

  const icon = iconOf(crate.contents);
  surface.drawBitmap(
    dc.sprites.get(icon),
    label.x + Math.floor((label.w - icon.width) / 2),
    label.y + Math.floor((label.h - icon.height) / 2),
  );
}
