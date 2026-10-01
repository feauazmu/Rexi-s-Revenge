import type { EnemyView, RunView } from '../../core';
import { sprites as art } from '../art/generated/enemies';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import { mirroredSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';

/** The pipeline sprite, facing right (art/sheets.json `enemy_maletin`, scripts/art/enemies.py). */
const BODY = art['maletin/body'];

/** Where the 32×24 hitbox sits in BODY: the briefcase and cockpit fill it. */
const HITBOX = { x: 7, y: 1 } as const;
/** Rotor mast: the left of its two middle columns. The disc spins one row above the sprite. */
const MAST_X = 20;
const ROTOR_HALF_WIDTH = 17;
/** Tail rotor: the column it spins on and the row of its hub, at the tip of the tail boom. */
const TAIL = { x: 1, hub: 16, half: 6 } as const;

/** Rotor blur and the darker blade sweeping through it (the brass ramp). */
const BLUR: Color = P.gold;
const BLUR_TIP: Color = P.brass;
const BLADE: Color = P.leather3;
const HUB: Color = P.light;

/**
 * Maletín-cóptero: a leather briefcase with a glass bubble cockpit, a tiny slick-haired lawyer
 * pilot, brass clasps, a tail boom and a paper gun under the nose. It always faces Rexi.
 */
export function drawMaletinCoptero(dc: DrawContext, enemy: EnemyView, run: RunView): void {
  const { surface, sprites } = dc;
  const right = run.rexi.x + run.rexi.w / 2 >= enemy.x + enemy.w / 2;
  const top = Math.round(enemy.y) - HITBOX.y;
  const left = right
    ? Math.round(enemy.x) - HITBOX.x
    : Math.round(enemy.x) + enemy.w + HITBOX.x - BODY.width;
  /** Screen x of BODY column `c` for the current facing. */
  const column = (c: number) => (right ? left + c : left + BODY.width - 1 - c);
  const frame = Math.floor(enemy.age / 2) % 3;

  // Tail rotor, behind the boom: a vertical blur with a blade sweeping down it.
  const tail = column(TAIL.x);
  const tailTop = top + TAIL.hub - TAIL.half;
  surface.fillRect(tail, tailTop, 1, TAIL.half * 2 + 1, BLUR);
  surface.fillRect(tail, tailTop + frame * 4, 1, 4, BLADE);

  surface.drawBitmap(sprites.get(right ? BODY : mirroredSprite(BODY)), left, top);

  // Main rotor: a flat blur disc over the mast with a blade sweeping across it (3 frames).
  const mast = right ? column(MAST_X) : column(MAST_X + 1);
  const disc = top - 1;
  surface.fillRect(mast - ROTOR_HALF_WIDTH, disc, ROTOR_HALF_WIDTH * 2 + 2, 1, BLUR);
  surface.fillRect(mast - ROTOR_HALF_WIDTH, disc, 2, 1, BLUR_TIP);
  surface.fillRect(mast + ROTOR_HALF_WIDTH, disc, 2, 1, BLUR_TIP);
  surface.fillRect(mast - ROTOR_HALF_WIDTH + 2 + frame * 10, disc, 12, 1, BLADE);
  surface.fillRect(mast, disc, 2, 1, HUB);
}

/** Chunks it breaks into when destroyed: rotor mast, cockpit and pilot, briefcase, tail. */
export const maletinCopteroDebris: readonly SpriteDef[] = [
  art['maletin/debris_0_mast'],
  art['maletin/debris_1_cockpit'],
  art['maletin/debris_2_case'],
  art['maletin/debris_3_tail'],
];
