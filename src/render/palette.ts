import type { Color } from './surface';

/**
 * The master palette: the only colors the game may put on screen (see "Palette" in
 * docs/architecture.md and ADR 0002). 56 colors in hue-shifted ramps: shadows lean toward purple/blue,
 * highlights toward warm yellow. Several colors are shared between ramps on purpose
 * (e.g. `coral` is both the gym-red highlight and a sunset band), so pick by ramp
 * from {@link paletteRamps}, not by eyeballing hex values.
 *
 * Every sprite, drawer and the title illustration use only these colors;
 * tests/render/palette.test.ts checks every exported sprite and every golden frame.
 */
export const masterPalette = {
  // Outline and robe blacks (purple-blue sheen; robeMid is the fold step between robe and robeSheen).
  outline: '#000000',
  night: '#1e1834',
  robe: '#2c2844',
  robeMid: '#3a3658',
  robeSheen: '#4a4a74',

  // Cool greys toward warm white: trousers, smoke, marble, tank top (steel has its own ramp below).
  grey1: '#6a6c86',
  grey2: '#9496aa',
  grey3: '#c2c2cc',
  marble: '#e2ded8',
  white: '#fffaf0',

  // Blue steel (guns, rotors, engine casings, filing cabinets); highlights continue into white.
  steel1: '#2c4466',
  steel2: '#6684aa',
  steel3: '#a2c0dc',

  // Warm mauve stone (plaza paving, courthouse); stoneLight is the sunlit stone before marble.
  stone1: '#6c5a6a',
  stone2: '#a28e92',
  stoneLight: '#c4aca8',

  // Skin (Rexi's tan and the lawyer pilots); skinWarm is the muscle midtone between skin3 and skin4.
  skin1: '#6a2e36',
  skin2: '#a04a40',
  skin3: '#d07a52',
  skinWarm: '#e0915e',
  skin4: '#eeac78',
  skin5: '#fcdcae',

  // Brown leather (boots, briefcase, benches, gavel, the Ledges' mahogany); light-brown hair is leather3 → leather4 → hairLight.
  leather1: '#3a1a22',
  leather2: '#62302a',
  leather3: '#8e5232',
  leather4: '#bc8240',
  hairLight: '#dcb460',

  // Gym red (treadmill, bench, rockets); redLight is also the fire's ember step.
  red1: '#4c1234',
  red2: '#8c1c30',
  red3: '#d42c2c',
  redLight: '#ec4a3c',
  coral: '#f4664c',

  // Brass and gold (UI, labels, handles, the Ledges' lip and fittings, muzzle flash, sun).
  brass: '#c88a2c',
  gold: '#f8c43c',
  light: '#fff4b0',

  // Sunset sky (night → skyIndigo → skyPurple → skyViolet → skyMagenta → skyRose → coral →
  // skyOrange → skyPeach → gold → sunYellow → light). skyPeach and sunYellow are also fire.
  skyIndigo: '#34215e',
  skyPurple: '#56298a',
  skyViolet: '#76308e',
  skyMagenta: '#8c3a8c',
  skyRose: '#c8467a',
  skyOrange: '#f07e3a',
  skyPeach: '#f8a24a',
  sunYellow: '#ffe070',

  // Glass and neon (Bufete & Pesas tower, Boissons storefront and its cocktail sign).
  glass1: '#1c3062',
  glass2: '#3462a6',
  glass3: '#66a6dc',
  neonCyan: '#a4f4f0',
  neonTeal: '#30c8d4',
  neonPink: '#ff5aa8',
  neonBlush: '#ffb0d8',
  neonLime: '#c8f05a',

  // Foliage.
  leafDeep: '#1c3a3c',
  leafShadow: '#26584a',
  leafMid: '#3e7c44',
  leaf: '#6ea040',
  leafLight: '#94b444',
} as const satisfies Record<string, Color>;

export type PaletteColorName = keyof typeof masterPalette;

/**
 * Named ramps, dark to light, as lists of {@link masterPalette} names. Shade a material by
 * stepping along its ramp; never darken or lighten a color by hand.
 */
export const paletteRamps = {
  robe: ['outline', 'night', 'robe', 'robeMid', 'robeSheen'],
  grey: ['robe', 'robeSheen', 'grey1', 'grey2', 'grey3', 'marble', 'white'],
  skin: ['skin1', 'skin2', 'skin3', 'skinWarm', 'skin4', 'skin5'],
  hair: ['leather2', 'leather3', 'leather4', 'hairLight'],
  leather: ['leather1', 'leather2', 'leather3', 'leather4', 'hairLight'],
  red: ['red1', 'red2', 'red3', 'redLight', 'coral'],
  brass: ['leather2', 'leather3', 'brass', 'gold', 'light'],
  stone: ['night', 'robeSheen', 'stone1', 'stone2', 'stoneLight', 'grey3', 'marble'],
  steel: ['night', 'steel1', 'grey1', 'steel2', 'steel3', 'white'],
  sky: [
    'night',
    'skyIndigo',
    'skyPurple',
    'skyViolet',
    'skyMagenta',
    'skyRose',
    'coral',
    'skyOrange',
    'skyPeach',
    'gold',
    'sunYellow',
    'light',
  ],
  glass: ['night', 'glass1', 'glass2', 'glass3', 'neonCyan', 'white'],
  neonCyan: ['glass1', 'glass2', 'neonTeal', 'neonCyan', 'white'],
  neonPink: ['red1', 'skyMagenta', 'skyRose', 'neonPink', 'neonBlush', 'light'],
  neonLime: ['leafMid', 'leaf', 'neonLime', 'light'],
  fire: [
    'red2',
    'red3',
    'redLight',
    'skyOrange',
    'skyPeach',
    'gold',
    'sunYellow',
    'light',
    'white',
  ],
  foliage: ['night', 'leafDeep', 'leafShadow', 'leafMid', 'leaf', 'leafLight', 'hairLight'],
} as const satisfies Record<string, readonly PaletteColorName[]>;

/** Shared colors. Sprite-specific colors live next to their sprite (until the art pass). */
export const palette = {
  letterbox: '#000000',
  outline: '#1a1020',
  white: '#ffffff',
  crosshair: '#fff4c0',
} as const satisfies Record<string, Color>;
