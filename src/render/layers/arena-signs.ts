/**
 * The Arena's lettering, drawn in code over the pipeline backdrop (docs/architecture.md, "Art
 * pipeline": the Arena). The image model cannot letter at 1:1, so the tile edits left every
 * sign face blank and the words are set here. The signs are in-world art, not UI copy, so they
 * use two tiny sign-painter fonts of their own (3×5 and 5×7, smaller and blockier than the UI
 * fonts in `src/render/text/`) and their Spanish text lives here rather than in `strings.ts`:
 *
 * - the Bufete & Pesas S.A. gym billboard on the tower roof: "¡INSCRÍBETE!", the firm's name
 *   and its motto (CONTEXT.md: the billboard is the gym's; the 2×1 promo is not on it);
 * - the firm's name plate over the tower's facade;
 * - the Boissons neon sign (a cocktail glass and "BOISSONS"), lit, dead, or with the name out,
 *   so it can flicker;
 * - Boissons' chalkboard on the plaza: "JUEVES 2×1" with a chalk cocktail (the bar's promo).
 *
 * Positions are the blank faces of the backdrop (`art/sprites/arena/layers/buildings.png`).
 */
import { masterPalette as P } from '../palette';
import { createPixelGrid, type PixelGrid } from '../pixel-grid';
import type { SpriteDef } from '../sprite';

type Font = Readonly<Record<string, readonly string[]>>;

/** 3×5 capitals (4 wide for "&"). */
const SMALL_FONT: Font = {
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  L: ['#..', '#..', '#..', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '×': ['...', '#.#', '.#.', '#.#', '...'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  E: ['###', '#..', '##.', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  '&': ['.#..', '#.#.', '.#..', '#.##', '.##.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  '.': ['.', '.', '.', '.', '#'],
  ' ': ['.', '.', '.', '.', '.'],
};

/** 5×7 capitals for the billboard's call to action and the neon sign. */
const BIG_FONT: Font = {
  '¡': ['#', '.', '#', '#', '#', '#', '#'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  // Í: an I whose accent sits above the line (see `letter`).
  Í: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#.#.#', '#..##', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
};

/** The neon cocktail glass: a martini glass with an olive. */
const GLASS = ['#######', '.#...#.', '..#.#..', '...#...', '...#...', '...#...', '..###..'];

function textWidth(font: Font, text: string): number {
  let w = 0;
  for (const ch of text) w += (font[ch]?.[0]?.length ?? 0) + 1;
  return w - 1;
}

/** Letters `text` into `g` with its top-left at (x, y); returns nothing. */
function letter<K extends string>(
  g: PixelGrid<K>,
  font: Font,
  text: string,
  x: number,
  y: number,
  color: K,
): void {
  let cx = x;
  for (const ch of text) {
    const glyph = font[ch];
    if (!glyph) throw new Error(`No glyph for "${ch}"`);
    if (ch === 'Í') {
      g.px(cx + 2, y - 3, color);
      g.px(cx + 1, y - 2, color);
    }
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++)
        if (row.charAt(gx) === '#') g.px(cx + gx, y + gy, color);
    });
    cx += (glyph[0]?.length ?? 0) + 1;
  }
}

/** A sprite placed on the backdrop: draw it at (x, y). */
export interface PlacedSprite {
  readonly sprite: SpriteDef;
  readonly x: number;
  readonly y: number;
}

/** The billboard's blank yellow field, right of its painted dumbbell and gavel. */
const BILLBOARD_FIELD = { x: 545, y: 40, w: 75, h: 35 } as const;

function billboardCopy(): PlacedSprite {
  const { w, h } = BILLBOARD_FIELD;
  const g = createPixelGrid(w, h, { ink: P.robe, red: P.red2, shade: P.brass });
  const lines = [
    { font: BIG_FONT, text: '¡INSCRÍBETE!', y: 5, color: 'ink' },
    { font: SMALL_FONT, text: 'BUFETE & PESAS', y: 16, color: 'ink' },
    { font: SMALL_FONT, text: 'PESAS Y PLEITOS', y: 24, color: 'red' },
  ] as const;
  for (const { font, text, y, color } of lines) {
    const x = Math.floor((w - textWidth(font, text)) / 2);
    // A one-pixel drop shadow in the board's own shade, then the letters.
    letter(g, font, text, x + 1, y + 1, 'shade');
    letter(g, font, text, x, y, color);
  }
  return { sprite: g.toSprite(), x: BILLBOARD_FIELD.x, y: BILLBOARD_FIELD.y };
}

/** The dark name plate overhanging the tower's facade. */
const NAME_PLATE = { x: 500, y: 202, w: 80, h: 9 } as const;

function namePlate(): PlacedSprite {
  const { w, h } = NAME_PLATE;
  const text = 'BUFETE & PESAS S.A.';
  const g = createPixelGrid(w, h, { text: P.marble });
  letter(g, SMALL_FONT, text, Math.floor((w - textWidth(SMALL_FONT, text)) / 2), 2, 'text');
  return { sprite: g.toSprite(), x: NAME_PLATE.x, y: NAME_PLATE.y };
}

/** Boissons' dark sign board above the awning. */
const NEON_BOARD = { x: 380, y: 225, w: 82, h: 14 } as const;

/** The neon sign's states: all lit, all dead, or the glass lit and the name out. */
export interface NeonSign {
  readonly lit: PlacedSprite;
  readonly unlit: PlacedSprite;
  readonly nameOut: PlacedSprite;
}

/** One of the neon sign's states. */
export type NeonState = keyof NeonSign;

function neonSign(): NeonSign {
  const { w, h } = NEON_BOARD;
  const name = 'BOISSONS';
  const glassW = GLASS[0]?.length ?? 0;
  const x0 = Math.floor((w - (glassW + 4 + textWidth(BIG_FONT, name))) / 2);
  const y0 = Math.floor((h - GLASS.length) / 2);
  const textX = x0 + glassW + 4;
  const colors = {
    pinkHalo: P.skyMagenta,
    pink: P.neonPink,
    pinkCore: P.neonBlush,
    cyanHalo: P.glass2,
    cyan: P.neonCyan,
    olive: P.neonLime,
    deadPink: P.red1,
    deadCyan: P.glass1,
  };
  type Neon = keyof typeof colors;
  const glassFont: Font = { Y: GLASS };
  const halo = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const;

  const paintGlass = (g: PixelGrid<Neon>, on: boolean) => {
    if (on) for (const [dx, dy] of halo) letter(g, glassFont, 'Y', x0 + dx, y0 + dy, 'cyanHalo');
    letter(g, glassFont, 'Y', x0, y0, on ? 'cyan' : 'deadCyan');
    if (on) g.px(x0 + 3, y0 + 1, 'olive');
  };
  const paintName = (g: PixelGrid<Neon>, on: boolean) => {
    if (!on) {
      letter(g, BIG_FONT, name, textX, y0, 'deadPink');
      return;
    }
    for (const [dx, dy] of halo) letter(g, BIG_FONT, name, textX + dx, y0 + dy, 'pinkHalo');
    letter(g, BIG_FONT, name, textX, y0, 'pink');
    // A brighter core along the tubes' top row gives the glass some sheen.
    for (let x = textX; x < textX + textWidth(BIG_FONT, name); x += 2) {
      if (g.get(x, y0) === 'pink') g.px(x, y0, 'pinkCore');
    }
  };
  const state = (glassOn: boolean, nameOn: boolean): PlacedSprite => {
    const g = createPixelGrid(w, h, colors);
    paintGlass(g, glassOn);
    paintName(g, nameOn);
    return { sprite: g.toSprite(), x: NEON_BOARD.x, y: NEON_BOARD.y };
  };
  return { lit: state(true, true), unlit: state(false, false), nameOut: state(true, false) };
}

/** The face of Boissons' chalkboard A-frame on the plaza. */
const CHALKBOARD = { x: 380, y: 272, w: 25, h: 17 } as const;

function chalkboard(): PlacedSprite {
  const { w } = CHALKBOARD;
  const g = createPixelGrid(w, CHALKBOARD.h, { chalk: P.marble, dust: P.grey2 });
  const day = 'JUEVES';
  letter(g, SMALL_FONT, day, Math.floor((w - textWidth(SMALL_FONT, day)) / 2), 2, 'chalk');
  const deal = '2×1';
  const dealX = Math.floor((w - (textWidth(SMALL_FONT, deal) + 2 + 5)) / 2);
  letter(g, SMALL_FONT, deal, dealX, 10, 'chalk');
  // A tiny chalk cocktail next to the deal, and a smudge of chalk dust under it all.
  const tx = dealX + textWidth(SMALL_FONT, deal) + 2;
  g.rect(tx, 10, 5, 1, 'chalk');
  g.rect(tx + 1, 11, 3, 1, 'chalk');
  g.rect(tx + 2, 12, 1, 2, 'chalk');
  g.rect(tx + 1, 14, 3, 1, 'chalk');
  g.checker(3, 16, w - 6, 1, 'dust');
  return { sprite: g.toSprite(), x: CHALKBOARD.x, y: CHALKBOARD.y };
}

export interface ArenaSigns {
  /** Static lettering: billboard copy, name plate and chalkboard. */
  readonly lettering: readonly PlacedSprite[];
  readonly neon: NeonSign;
}

let signs: ArenaSigns | null = null;

/** The Arena's signs, built once. */
export function arenaSigns(): ArenaSigns {
  signs ??= { lettering: [billboardCopy(), namePlate(), chalkboard()], neon: neonSign() };
  return signs;
}
