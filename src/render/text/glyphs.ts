/**
 * Glyph data of the regular bitmap font, drawn in code (ADR 0001). `#` is ink, `.` is empty.
 *
 * Cell layout (12 rows, every glyph is padded to it):
 *
 * ```
 *  row 0-1   accents over capitals (Á Ñ Ü)
 *  row 2     gap
 *  row 3-9   capitals and digits (7 rows); lowercase x-height is rows 5-9
 *            (accents over lowercase sit on rows 2-3, gap on row 4)
 *  row 10-11 descenders (g j p q y ¿ ¡ , ;)
 * ```
 *
 * Base glyphs below are written from the cap top (row 3) down; trailing empty rows may be
 * omitted. Accented letters are composed from a base glyph plus a mark, so they always match.
 */

/** Rows above the cap top: room for accents over capitals. */
export const ACCENT_ROWS = 3;
/** Rows from the cap top to the bottom of the descenders. */
const BASE_ROWS = 9;
export const CELL_ROWS = ACCENT_ROWS + BASE_ROWS;
/** Distance from the cell top to the baseline (capitals sit on it), px. */
export const BASELINE = ACCENT_ROWS + 7;

type Rows = readonly string[];

const BASE: Readonly<Record<string, Rows>> = {
  // Capitals: 7 rows.
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['####', '#...', '#...', '###.', '#...', '#...', '####'],
  F: ['####', '#...', '#...', '###.', '#...', '#...', '#...'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '....#', '....#', '....#', '#...#', '#...#', '.###.'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#...', '#...', '#...', '#...', '#...', '#...', '####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.###.', '#...#', '#....', '.###.', '....#', '#...#', '.###.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

  // Lowercase: x-height rows 2-6 of the base, ascenders from row 0, descenders rows 7-8.
  a: ['....', '....', '.##.', '...#', '.###', '#..#', '.###'],
  b: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '###.'],
  c: ['....', '....', '.###', '#...', '#...', '#...', '.###'],
  d: ['...#', '...#', '.###', '#..#', '#..#', '#..#', '.###'],
  e: ['....', '....', '.##.', '#..#', '####', '#...', '.###'],
  f: ['.##', '#..', '###', '#..', '#..', '#..', '#..'],
  g: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  h: ['#...', '#...', '###.', '#..#', '#..#', '#..#', '#..#'],
  i: ['#', '.', '#', '#', '#', '#', '#'],
  j: ['.#', '..', '.#', '.#', '.#', '.#', '.#', '.#', '#.'],
  k: ['#...', '#...', '#..#', '#.#.', '##..', '#.#.', '#..#'],
  l: ['#.', '#.', '#.', '#.', '#.', '#.', '.#'],
  m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  n: ['....', '....', '###.', '#..#', '#..#', '#..#', '#..#'],
  o: ['....', '....', '.##.', '#..#', '#..#', '#..#', '.##.'],
  p: ['....', '....', '###.', '#..#', '#..#', '#..#', '###.', '#...', '#...'],
  q: ['....', '....', '.###', '#..#', '#..#', '#..#', '.###', '...#', '...#'],
  r: ['...', '...', '#.#', '##.', '#..', '#..', '#..'],
  s: ['....', '....', '.###', '#...', '.##.', '...#', '###.'],
  t: ['.#.', '.#.', '###', '.#.', '.#.', '.#.', '..#'],
  u: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###'],
  v: ['.....', '.....', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  x: ['....', '....', '#..#', '#..#', '.##.', '#..#', '#..#'],
  y: ['....', '....', '#..#', '#..#', '#..#', '#..#', '.###', '...#', '.##.'],
  z: ['....', '....', '####', '...#', '.##.', '#...', '####'],
  /** Dotless i: base for í. */
  ı: ['.', '.', '#', '#', '#', '#', '#'],

  // Digits: all 4 wide, so numbers keep their width as they change.
  '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '#..#', '.##.'],
  '1': ['..#.', '.##.', '..#.', '..#.', '..#.', '..#.', '.###'],
  '2': ['.##.', '#..#', '...#', '..#.', '.#..', '#...', '####'],
  '3': ['###.', '...#', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['#..#', '#..#', '#..#', '####', '...#', '...#', '...#'],
  '5': ['####', '#...', '#...', '###.', '...#', '...#', '###.'],
  '6': ['.##.', '#...', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '...#', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '...#', '.##.'],

  // Punctuation and symbols.
  ' ': ['...'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['..', '..', '..', '..', '..', '..', '.#', '#.'],
  ':': ['.', '.', '.', '#', '.', '.', '#'],
  ';': ['..', '..', '..', '.#', '..', '..', '.#', '#.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '¡': ['.', '.', '#', '.', '#', '#', '#', '#', '#'],
  '?': ['.##.', '#..#', '...#', '..#.', '.#..', '....', '.#..'],
  '¿': ['....', '....', '..#.', '....', '..#.', '.#..', '#...', '#..#', '.##.'],
  "'": ['#', '#'],
  '"': ['#.#', '#.#'],
  '-': ['...', '...', '...', '...', '###'],
  '—': ['......', '......', '......', '......', '######'],
  _: ['....', '....', '....', '....', '....', '....', '....', '####'],
  '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
  '/': ['..#', '..#', '.#.', '.#.', '.#.', '#..', '#..'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '.#.##', '#..##'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '+': ['...', '...', '...', '.#.', '###', '.#.'],
  '=': ['...', '...', '...', '###', '...', '###'],
  '*': ['...', '#.#', '.#.', '#.#'],
  '#': ['.....', '.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
  '×': ['...', '...', '...', '#.#', '.#.', '#.#'],
  '∞': ['.........', '.........', '.##...##.', '#..#.#..#', '#...#...#', '#..#.#..#', '.##...##.'],
};

/** Diacritic marks, one shape for capitals and one for lowercase. */
const MARKS = {
  acute: { upper: ['.#', '#.'], lower: ['.#', '#.'] },
  tilde: { upper: ['.##.#', '#..#.'], lower: ['.#.#', '#.#.'] },
  diaeresis: { upper: ['#.#'], lower: ['#..#'] },
} as const satisfies Record<string, { upper: Rows; lower: Rows }>;

type Mark = keyof typeof MARKS;

/** Composed glyphs: [base glyph, mark]. Capital bases get the mark in the accent rows. */
const COMPOSED: Readonly<Record<string, readonly [base: string, mark: Mark]>> = {
  á: ['a', 'acute'],
  é: ['e', 'acute'],
  í: ['ı', 'acute'],
  ó: ['o', 'acute'],
  ú: ['u', 'acute'],
  ü: ['u', 'diaeresis'],
  ñ: ['n', 'tilde'],
  Á: ['A', 'acute'],
  É: ['E', 'acute'],
  Í: ['I', 'acute'],
  Ó: ['O', 'acute'],
  Ú: ['U', 'acute'],
  Ü: ['U', 'diaeresis'],
  Ñ: ['N', 'tilde'],
};

/** Pads a base glyph to the full cell: empty accent rows above, empty rows below. */
function toCell(rows: Rows): string[] {
  const width = rows[0]?.length ?? 0;
  const empty = '.'.repeat(width);
  const cell = [...Array<string>(ACCENT_ROWS).fill(empty), ...rows];
  while (cell.length < CELL_ROWS) cell.push(empty);
  return cell;
}

function compose(baseRows: Rows, mark: Mark, upper: boolean): string[] {
  const markRows: Rows = upper ? MARKS[mark].upper : MARKS[mark].lower;
  const baseWidth = baseRows[0]?.length ?? 0;
  const markWidth = markRows[0]?.length ?? 0;
  const width = Math.max(baseWidth, markWidth);
  const pad = (row: string, left: number) =>
    row.padStart(left + row.length, '.').padEnd(width, '.');

  const baseLeft = Math.floor((width - baseWidth) / 2);
  const cell = toCell(baseRows.map((row) => pad(row, baseLeft)));
  // Marks end one empty row above the letter: above the cap top for capitals, above the
  // x-height (base row 2) for lowercase.
  const markBottom = upper ? ACCENT_ROWS - 2 : ACCENT_ROWS;
  const markLeft = Math.floor((width - markWidth) / 2);
  markRows.forEach((row, i) => {
    cell[markBottom - markRows.length + 1 + i] = pad(row, markLeft);
  });
  return cell;
}

/** Every glyph of the regular font as full cells (CELL_ROWS rows of equal width). */
export function regularGlyphRows(): Map<string, readonly string[]> {
  const glyphs = new Map<string, readonly string[]>();
  for (const [char, rows] of Object.entries(BASE)) glyphs.set(char, toCell(rows));
  for (const [char, [base, mark]] of Object.entries(COMPOSED)) {
    const baseRows = BASE[base];
    if (!baseRows) throw new Error(`Composed glyph "${char}" uses missing base "${base}"`);
    glyphs.set(char, compose(baseRows, mark, base === base.toUpperCase()));
  }
  return glyphs;
}
