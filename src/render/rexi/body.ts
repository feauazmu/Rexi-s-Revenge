import { defineSprite, mirrorSprite, type SpriteDef } from '../sprite';
import { composeRows, flareRows, recolorRows, shearRows, type Layer, type Rows } from './grid';
import { rexiFlashPalette, rexiPalette } from './palette';

/**
 * Rexi's body, drawn in code after reference/rexi-character-sheet.png (ADR 0001): a very
 * muscular judge in a sleeveless (torn-off) black robe over a white tank top, grey trousers,
 * brown boots and light-brown hair. Parts are drawn facing right and composed per pose.
 *
 * Coordinates: every part is placed on a 32×38 canvas. Canvas column 16 is the hitbox's
 * center line and the bottom row stands on the hitbox's bottom edge.
 */

export const BODY_WIDTH = 32;
export const BODY_HEIGHT = 38;
/** Canvas column of the hitbox center (facing right). */
export const BODY_ANCHOR_X = 16;

/** Shoulder pivot of the aiming arm on the canvas (facing right, before upper-body offsets). */
export const ARM_PIVOT = { x: 24, y: 14 } as const;

// prettier-ignore
const HEAD: Rows = [
  '..kkkkkk....',
  '.khhhhhhk...',
  'khhhHHHHHk..',
  'kHHHHHHHHHk.',
  'kdHHHslllsk.',
  'kdHmsesssek.',
  'kdHmsssssssk',
  'kdmssnttttk.',
  '.kmssnnnnsk.',
  '..kmmsssmk..',
];

/** Hurt: eyes squeezed shut, mouth open in an "oof". */
// prettier-ignore
const HEAD_HURT: Rows = [
  '..kkkkkk....',
  '.khhhhhhk...',
  'khhhHHHHHk..',
  'kHHHHHHHHHk.',
  'kdHHHsmmmsk.',
  'kdHmseesseek',
  'kdHmsssssssk',
  'kdmsskeeek..',
  '.kmsskeeek..',
  '..kmmskkkk..',
];

/** Neck, robe shoulders and the tank top over a big chest. */
// prettier-ignore
const TORSO: Rows = [
  '......kmmsk.....',
  '...kkkrkmmkrkkk.',
  '..krrRrksmmskRrk',
  '.krRrrwwwwwwrRrk',
  '.krRrwwwwwwwwrRk',
  '.krRrWwwWWwwWrRk',
  '.krRrwwwwwwwwrRk',
  '.krRrwwwWwwwwrRk',
  '.krRrwwwwwwwwrRk',
  '.krRrWwwwwwwWrRk',
  '.krRrWWWWWWWWrRk',
  '.krRrppPPPPpprRk',
  // Overlaps the robe skirt so a bobbing upper body never opens a gap at the waist.
  '.krRrrpPPPPprrRk',
];

/** The far (non-aiming) arm hanging by his side: torn sleeve, big deltoid, bicep, fist. */
// prettier-ignore
const BACK_ARM: Rows = [
  '...kkkkkk.',
  '..krRrrrrk',
  '.krqrkrqrk',
  '.kslkslsmk',
  'klssssssmk',
  'klsssssmnk',
  'kmlssssmk.',
  'klsslssmk.',
  'klssssmnk.',
  '.kmssmnk..',
  '.klssmnk..',
  'klsssmnk..',
  'klsssmnk..',
  'kmmsmnnk..',
  'klllsmk...',
  'ksslssmk..',
  'kmnmnmnk..',
  '.kkkkkk...',
];

/** Deltoid cap of the aiming arm, drawn over the arm's root so every direction joins cleanly. */
// prettier-ignore
const FRONT_CAP: Rows = [
  '..kkkkk..',
  '.krRrrrk.',
  'krqrkrqrk',
  'kslkslssk',
  'klsssssmk',
  'klsssssmk',
  '.ksssssmk',
  '..kssmmk.',
];

/** Lion head next to a columned courthouse, in sepia ink, on the left arm. */
// prettier-ignore
const TATTOO: Rows = [
  'aa.iii',
  'ai.i.i',
  'aa.iii',
];

/** Long robe skirt; the gap in the middle shows the trousers. */
// prettier-ignore
const ROBE: Rows = [
  '...krRrrr......rRrk...',
  '...krRrrr......rRrrk..',
  '..krRrrrr......rrRrk..',
  '..krRrrrr......rrRrk..',
  '..krRrrrk......krrRrk.',
  '.krRrrrrk......krrRrk.',
  '.krRrrrrk......krrrRrk',
  '.krRrrrrk......krrrRrk',
  '.kqrqrqrk......kqrqrqk',
  '..kkkkkkk......kkkkkk.',
];

/** The robe with two rows taken out above the hem. */
const SHORT_ROBE: Rows = [...ROBE.slice(0, 6), ...ROBE.slice(8)];

/** Thighs, hidden by the robe except through its opening. Shared by every leg frame. */
// prettier-ignore
const THIGHS: Rows = [
  '.........pPPPpp.......',
  '.........pPPPpp.......',
  '.........pPkPPp.......',
  '.........pPkPPp.......',
  '........kpPkpPPk......',
  '........kpPkpPPk......',
  '........kpPkpPPk......',
  '........kpPkpPPk......',
];

/** Shins and boots under the hem (rows 8–14 of the legs grid): `p`/`b` near leg, `P`/`B` far. */
// prettier-ignore
const SHINS = {
  stand: [
    '........kpPkpPPk......',
    '........kpPkpPPk......',
    '........kpPkpPPk......',
    '........kpPkpPPk......',
    '.......kcbbkcbbBk.....',
    '......kcbbBkcbbbBk....',
    '......kkkkkkkkkkkk....',
  ],
  // Run, first step: contact, down, passing. The second step swaps the legs.
  contact: [
    '........kPPkkppk......',
    '.......kPPk..kppk.....',
    '......kPPk....kppk....',
    '.....kPPk......kppk...',
    '....kBBk.......kcbbk..',
    '...kBBBk.......kcbbbbk',
    '...kkkk........kkkkkkk',
  ],
  down: [
    '........kPPkpppk......',
    '........kPPkkppk......',
    '.......kPPk.kppk......',
    '......kPPk..kppk......',
    '.....kBBBk.kcbbk......',
    '.....kkkk..kcbbbbk....',
    '...........kkkkkkk....',
  ],
  passing: [
    '.......kPPPkppk.......',
    '......kPPPk.kppk......',
    '.....kPPk...kppk......',
    '.....kBBk...kppk......',
    '....kBBBk...kcbbk.....',
    '....kkkk....kcbbbbk...',
    '............kkkkkkk...',
  ],
  // Rising: knees tucked under the robe.
  jump: [
    '.......kPPPkpppk......',
    '......kPPPk.kppppk....',
    '.....kBBBk...kcbbbk...',
    '.....kkkk....kkkkkk...',
    '......................',
    '......................',
    '......................',
  ],
  // Falling: legs reaching for the ground.
  fall: [
    '.......kPPk.kppk......',
    '.......kPPk..kppk.....',
    '......kPPk...kppk.....',
    '......kPPk....kppk....',
    '......kBBk....kcbbk...',
    '.....kBBBk....kcbbbk..',
    '.....kkkkk....kkkkkk..',
  ],
} satisfies Record<string, Rows>;

const SWAP_LEGS = { p: 'P', P: 'p', b: 'B', B: 'b', c: 'B' } as const;

const legs = (shins: Rows): Rows => [...THIGHS, ...shins];

/** Leg frames: `stand`, the six-frame run cycle, `jump` and `fall`. */
export const LEG_FRAMES = {
  stand: legs(SHINS.stand),
  run: [
    legs(SHINS.contact),
    legs(SHINS.down),
    legs(SHINS.passing),
    legs(recolorRows(SHINS.contact, SWAP_LEGS)),
    legs(recolorRows(SHINS.down, SWAP_LEGS)),
    legs(recolorRows(SHINS.passing, SWAP_LEGS)),
  ],
  jump: legs(SHINS.jump),
  fall: legs(SHINS.fall),
} as const;

export type LegFrame = Rows;

/** Robe skirt variants: hanging, two wind-blown run frames, flared on the rise, lifted falling. */
export const ROBE_FRAMES = {
  stand: ROBE,
  // Running, the hem rides up and trails behind so the striding legs show.
  runA: shearRows(SHORT_ROBE, (y) => (y >= 6 ? -2 : y >= 4 ? -1 : 0)),
  runB: shearRows(SHORT_ROBE, (y) => (y >= 5 ? -1 : 0)),
  jump: flareRows(ROBE, (y) => (y >= 8 ? 2 : y >= 5 ? 1 : 0)),
  fall: flareRows(ROBE.slice(0, 8), (y) => (y >= 6 ? 2 : y >= 4 ? 1 : 0)),
} as const;

export type RobeFrame = keyof typeof ROBE_FRAMES;

/** Far-arm swings, derived from the hanging arm by bending its lower half. */
export const BACK_ARM_FRAMES = {
  hang: BACK_ARM,
  forward: shearRows(BACK_ARM, (y) => (y >= 12 ? 2 : y >= 9 ? 1 : 0)),
  back: shearRows(BACK_ARM, (y) => (y >= 12 ? -2 : y >= 9 ? -1 : 0)),
  flung: shearRows(BACK_ARM, (y) => (y >= 13 ? -3 : y >= 10 ? -2 : y >= 7 ? -1 : 0)),
} as const;

export type BackArmFrame = keyof typeof BACK_ARM_FRAMES;

/** Everything that selects one composed body image. */
export interface BodyPose {
  readonly legs: LegFrame;
  readonly robe: RobeFrame;
  readonly backArm: BackArmFrame;
  readonly hurt: boolean;
  /** Offset of the upper body (torso, head, arms) relative to the legs, px. */
  readonly upperX: number;
  readonly upperY: number;
  /** Extra head offset on top of the upper body's (a lagging bob or a recoil), px. */
  readonly headX: number;
  readonly headY: number;
}

/** Canvas positions of each part (facing right) before offsets. */
const AT = {
  legs: { x: 5, y: 23 },
  backArm: { x: 2, y: 12 },
  torso: { x: 8, y: 11 },
  head: { x: 11, y: 2 },
  cap: { x: 20, y: 11 },
  tattooFront: { x: 21, y: 15 },
  tattooBack: { x: 3, y: 16 },
} as const;

function bodyRows(pose: BodyPose): string[] {
  const ux = pose.upperX;
  const uy = pose.upperY;
  const layers: Layer[] = [
    { rows: pose.legs, ...AT.legs },
    { rows: ROBE_FRAMES[pose.robe], ...AT.legs },
    { rows: BACK_ARM_FRAMES[pose.backArm], x: AT.backArm.x + ux, y: AT.backArm.y + uy },
    { rows: TORSO, x: AT.torso.x + ux, y: AT.torso.y + uy },
    {
      rows: pose.hurt ? HEAD_HURT : HEAD,
      x: AT.head.x + ux + pose.headX,
      y: AT.head.y + uy + pose.headY,
    },
  ];
  return composeRows(BODY_WIDTH, BODY_HEIGHT, layers);
}

interface BodySprites {
  readonly right: SpriteDef;
  readonly left: SpriteDef;
}

const bodyCache = new Map<string, BodySprites>();
const legIds = new Map<LegFrame, number>();

function legId(frame: LegFrame): number {
  let id = legIds.get(frame);
  if (id === undefined) {
    id = legIds.size;
    legIds.set(frame, id);
  }
  return id;
}

/**
 * The composed body for a pose and facing, built and cached on first use (the renderer's
 * SpriteBank then rasterizes it once). `flash` gives the hurt-blink colors.
 */
export function bodySprite(pose: BodyPose, facing: 1 | -1, flash: boolean): SpriteDef {
  const key = [
    legId(pose.legs),
    pose.robe,
    pose.backArm,
    pose.hurt ? 1 : 0,
    pose.upperX,
    pose.upperY,
    pose.headX,
    pose.headY,
    flash ? 1 : 0,
  ].join(':');
  let sprites = bodyCache.get(key);
  if (!sprites) {
    const right = defineSprite(flash ? rexiFlashPalette : rexiPalette, bodyRows(pose));
    sprites = { right, left: mirrorSprite(right) };
    bodyCache.set(key, sprites);
  }
  return facing === 1 ? sprites.right : sprites.left;
}

const capRight = defineSprite(rexiPalette, FRONT_CAP);
const capLeft = mirrorSprite(capRight);
const capFlashRight = defineSprite(rexiFlashPalette, FRONT_CAP);
const capFlashLeft = mirrorSprite(capFlashRight);
const tattoo = defineSprite(rexiPalette, TATTOO);

/** Deltoid cap over the aiming arm's root, and its canvas position (facing applied). */
export function capSprite(
  facing: 1 | -1,
  flash: boolean,
): { sprite: SpriteDef; x: number; y: number } {
  const sprite = flash
    ? facing === 1
      ? capFlashRight
      : capFlashLeft
    : facing === 1
      ? capRight
      : capLeft;
  const x = facing === 1 ? AT.cap.x : BODY_WIDTH - AT.cap.x - sprite.width;
  return { sprite, x, y: AT.cap.y };
}

/**
 * The tattoo is on Rexi's left arm. Facing right that is the aiming arm (on its deltoid cap);
 * facing left it is the far arm. Never mirrored, so the lion always sits left of the courthouse.
 */
export function tattooSprite(facing: 1 | -1): { sprite: SpriteDef; x: number; y: number } {
  const x = facing === 1 ? AT.tattooFront.x : BODY_WIDTH - AT.tattooBack.x - tattoo.width;
  const y = facing === 1 ? AT.tattooFront.y : AT.tattooBack.y;
  return { sprite: tattoo, x, y };
}
