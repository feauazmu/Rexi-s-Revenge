import type { CrateContents, CrateView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { powerUpIcons } from '../hud/power-up-icons';
import { weaponIcons } from '../hud/weapon-icons';
import { masterPalette as P } from '../palette';
import { drawCornerBrackets, fillCutRect } from '../frame';
import { defineSprite, type SpriteDef } from '../sprite';
import type { Color, Surface } from '../surface';

/** One Crate family's materials, each a ramp step from the master palette. */
interface CrateStyle {
  /** Frame boards: lit top/left edge, face, shaded bottom/right edge, plank seams. */
  readonly light: Color;
  readonly face: Color;
  readonly shade: Color;
  readonly seam: Color;
  /** Corner brackets and their rivets. */
  readonly bracket: Color;
  readonly bracketLight: Color;
  /** The label the contents' icon sits on, and its inner shadow. */
  readonly label: Color;
  readonly labelShade: Color;
}

/**
 * Color-coded by family (as in Heli Attack 2): wooden Weapon Crates with steel brackets, blue
 * steel Power-up Crates with brass brackets.
 */
const STYLES: Readonly<Record<CrateContents['kind'], CrateStyle>> = {
  weapon: {
    light: P.leather4,
    face: P.leather3,
    shade: P.leather2,
    seam: P.leather1,
    bracket: P.grey1,
    bracketLight: P.grey3,
    label: P.stoneLight,
    labelShade: P.stone2,
  },
  'power-up': {
    light: P.steel3,
    face: P.steel2,
    shade: P.steel1,
    seam: P.night,
    bracket: P.brass,
    bracketLight: P.light,
    label: P.glass3,
    labelShade: P.glass2,
  },
};

/** Blink "off" frames flash the Crate white instead of hiding it, so it stays readable. */
const FLASH: Color = P.white;
const FLASH_EDGE: Color = P.light;
/** Blink cadence in ticks: steady, then faster during the last second. */
const BLINK_PERIOD = 6;
const FAST_BLINK_PERIOD = 3;
const FAST_BLINK_TICKS = 60;

/** Frame width between the outline and the label, px: icons up to `size - 2 × (1 + FRAME)` fit. */
const FRAME = 3;

// ---------------------------------------------------------------------------------------------
// Parachute: a red-and-white striped canopy whose strings meet the Crate's top corners.

const CANOPY_W = 32;
const CANOPY_H = 11;
const STRINGS_H = 7;
const PANELS = 5;

/**
 * Built once from shapes (a 32×18 dome and strings; as pixel text it would be a block of noise to
 * review). UI chrome like this is hand-authored palette data, not pipeline art (#29).
 */
function parachuteRows(): string[] {
  const rows: string[][] = [];
  const cx = (CANOPY_W - 1) / 2;
  const inside = (x: number, y: number) => {
    if (y < 0 || y >= CANOPY_H) return false;
    const dy = (CANOPY_H - y - 0.5) / CANOPY_H;
    return Math.abs(x - cx) <= (CANOPY_W / 2) * Math.sqrt(Math.max(0, 1 - dy * dy)) - 0.3;
  };
  for (let y = 0; y < CANOPY_H; y++) {
    const row: string[] = [];
    for (let x = 0; x < CANOPY_W; x++) {
      if (!inside(x, y)) {
        row.push('.');
        continue;
      }
      const edge =
        !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || y === CANOPY_H - 1;
      if (edge) {
        row.push('k');
        continue;
      }
      const red = Math.floor((x * PANELS) / CANOPY_W) % 2 === 0;
      // Lit from the upper left: the left third light, the right third shaded, one row of
      // sheen along the top.
      const tone =
        x < CANOPY_W / 3 || y <= 2 ? 0 : x >= (CANOPY_W * 2) / 3 || y >= CANOPY_H - 3 ? 2 : 1;
      row.push((red ? ['v', 's', 'q'] : ['w', 'm', '3'])[tone] ?? 's');
    }
    rows.push(row);
  }
  // Strings from four points on the canopy's rim to the Crate's top corners.
  const left = (CANOPY_W - 24) / 2;
  const right = CANOPY_W - 1 - left;
  const strings: readonly (readonly [number, number])[] = [
    [2, left],
    [10, left],
    [CANOPY_W - 11, right],
    [CANOPY_W - 3, right],
  ];
  for (let y = 0; y < STRINGS_H; y++) {
    const row = Array.from({ length: CANOPY_W }, () => '.');
    const t = (y + 1) / STRINGS_H;
    for (const [from, to] of strings) row[Math.round(from + (to - from) * t)] = 'T';
    rows.push(row);
  }
  return rows.map((row) => row.join(''));
}

const PARACHUTE = defineSprite(
  {
    k: P.outline,
    v: P.redLight,
    s: P.red3,
    q: P.red2,
    w: P.white,
    m: P.marble,
    '3': P.grey3,
    T: P.stone2,
  },
  parachuteRows(),
);

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
  fillCutRect(surface, x, y, w, h, P.outline);

  if (isFlashing(crate)) {
    surface.fillRect(x + 1, y + 1, w - 2, h - 2, FLASH);
    surface.fillRect(x + 1, y + h - 2, w - 2, 1, FLASH_EDGE);
    surface.fillRect(x + w - 2, y + 1, 1, h - 2, FLASH_EDGE);
    return;
  }

  const style = STYLES[crate.contents.kind];
  drawFrame(surface, style, x, y, w, h);

  const icon = iconOf(crate.contents);
  const label = { x: x + 1 + FRAME, y: y + 1 + FRAME, w: w - 2 - 2 * FRAME, h: h - 2 - 2 * FRAME };
  surface.drawBitmap(
    dc.sprites.get(icon),
    label.x + Math.floor((label.w - icon.width) / 2),
    label.y + Math.floor((label.h - icon.height) / 2),
  );
}

/** Boards lit from the upper left, plank seams, corner brackets and the inset label. */
function drawFrame(
  surface: Surface,
  style: CrateStyle,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const ix = x + 1;
  const iy = y + 1;
  const iw = w - 2;
  const ih = h - 2;
  surface.fillRect(ix, iy, iw, ih, style.face);
  surface.fillRect(ix, iy, iw, 1, style.light);
  surface.fillRect(ix, iy, 1, ih, style.light);
  surface.fillRect(ix, iy + ih - 1, iw, 1, style.shade);
  surface.fillRect(ix + iw - 1, iy, 1, ih, style.shade);
  // Seams between the frame boards and the label's recess.
  surface.fillRect(
    ix + FRAME - 1,
    iy + FRAME - 1,
    iw - 2 * FRAME + 2,
    ih - 2 * FRAME + 2,
    style.seam,
  );
  surface.fillRect(ix + FRAME, iy + FRAME, iw - 2 * FRAME, ih - 2 * FRAME, style.label);
  surface.fillRect(ix + FRAME, iy + FRAME, iw - 2 * FRAME, 1, style.labelShade);
  surface.fillRect(ix + FRAME, iy + FRAME, 1, ih - 2 * FRAME, style.labelShade);
  // L-shaped brackets on the four corners, each with a lit rivet.
  drawCornerBrackets(surface, { x: ix, y: iy, w: iw, h: ih }, 4, style.bracket, style.bracketLight);
}
