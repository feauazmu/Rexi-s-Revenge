import type { Color } from './surface';

/**
 * The master palette: the only colors the game may put on screen (see "Palette" in
 * docs/architecture.md). 40 colors in hue-shifted ramps: shadows lean toward purple/blue,
 * highlights toward warm yellow. Several colors are shared between ramps on purpose
 * (e.g. `coral` is both the gym-red highlight and a sunset band), so pick by ramp
 * from {@link paletteRamps}, not by eyeballing hex values.
 *
 * The existing art is not remapped yet: the art pass will move every sprite and drawer onto
 * these names and enable the palette test in tests/render/palette.test.ts.
 */
export const masterPalette = {
  // Outline and robe blacks (purple-blue sheen).
  outline: '#000000',
  night: '#1e1834',
  robe: '#2c2844',
  robeSheen: '#4a4a74',

  // Cool greys toward warm white: steel, trousers, smoke, marble, tank top.
  grey1: '#6a6c86',
  grey2: '#9496aa',
  grey3: '#c2c2cc',
  marble: '#e2ded8',
  white: '#fffaf0',

  // Warm mauve stone (plaza paving, ledges, courthouse shade); lights continue into grey3/marble.
  stone1: '#6c5a6a',
  stone2: '#a28e92',

  // Skin (Rexi's tan and the lawyer pilots).
  skin1: '#6a2e36',
  skin2: '#a04a40',
  skin3: '#d07a52',
  skin4: '#eeac78',
  skin5: '#fcdcae',

  // Brown leather (boots, briefcase, benches, gavel); light-brown hair is leather3 → leather4 → hairLight.
  leather1: '#3a1a22',
  leather2: '#62302a',
  leather3: '#8e5232',
  leather4: '#bc8240',
  hairLight: '#dcb460',

  // Gym red (treadmill, bench, rockets).
  red1: '#4c1234',
  red2: '#8c1c30',
  red3: '#d42c2c',
  coral: '#f4664c',

  // Brass and gold (UI, labels, handles, muzzle flash, sun).
  brass: '#c88a2c',
  gold: '#f8c43c',
  light: '#fff4b0',

  // Sunset sky (night → skyIndigo → skyPurple → skyMagenta → skyRose → coral → skyOrange → gold → light).
  skyIndigo: '#34215e',
  skyPurple: '#56298a',
  skyMagenta: '#8c3a8c',
  skyRose: '#c8467a',
  skyOrange: '#f07e3a',

  // Glass and neon (Bufete & Pesas tower, Boissons storefront).
  glass1: '#1c3062',
  glass2: '#3462a6',
  glass3: '#66a6dc',
  neonCyan: '#a4f4f0',
  neonPink: '#ff5aa8',

  // Foliage.
  leafShadow: '#26584a',
  leaf: '#6ea040',
} as const satisfies Record<string, Color>;

export type PaletteColorName = keyof typeof masterPalette;

/**
 * Named ramps, dark to light, as lists of {@link masterPalette} names. Shade a material by
 * stepping along its ramp; never darken or lighten a color by hand.
 */
export const paletteRamps = {
  robe: ['outline', 'night', 'robe', 'robeSheen'],
  grey: ['robe', 'robeSheen', 'grey1', 'grey2', 'grey3', 'marble', 'white'],
  skin: ['skin1', 'skin2', 'skin3', 'skin4', 'skin5'],
  hair: ['leather2', 'leather3', 'leather4', 'hairLight'],
  leather: ['leather1', 'leather2', 'leather3', 'leather4', 'hairLight'],
  red: ['red1', 'red2', 'red3', 'coral'],
  brass: ['leather2', 'leather3', 'brass', 'gold', 'light'],
  stone: ['night', 'robeSheen', 'stone1', 'stone2', 'grey3', 'marble'],
  sky: [
    'night',
    'skyIndigo',
    'skyPurple',
    'skyMagenta',
    'skyRose',
    'coral',
    'skyOrange',
    'gold',
    'light',
  ],
  glass: ['night', 'glass1', 'glass2', 'glass3', 'neonCyan', 'white'],
  neonPink: ['red1', 'skyMagenta', 'skyRose', 'neonPink', 'light'],
  fire: ['red2', 'red3', 'skyOrange', 'gold', 'light', 'white'],
  foliage: ['night', 'leafShadow', 'leaf', 'hairLight'],
} as const satisfies Record<string, readonly PaletteColorName[]>;

/** Shared colors. Sprite-specific colors live next to their sprite (until the art pass). */
export const palette = {
  letterbox: '#000000',
  outline: '#1a1020',
  white: '#ffffff',
  crosshair: '#fff4c0',
} as const satisfies Record<string, Color>;
