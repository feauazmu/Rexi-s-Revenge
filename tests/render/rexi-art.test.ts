import { describe, expect, it } from 'vitest';
import { defaultTuning, secondsToTicks, WEAPON_IDS, type RexiView } from '../../src/core';
import { rexiArt, sprites as rexiSprites } from '../../src/render/art/generated/rexi';
import { sprites as portraitSprites } from '../../src/render/art/generated/rexi-portrait';
import { masterPalette } from '../../src/render/palette';
import { findOffPaletteSpriteColors, formatOffPaletteReport } from '../../src/render/palette-audit';
import { armAngleIndex, MAX_AIM_STEP } from '../../src/render/rexi/arm';
import { armSprite, bodySprite, flashSprite, type BodyFrame } from '../../src/render/rexi/art';
import { heldWeapons } from '../../src/render/rexi/held-weapons';
import { rexiPose } from '../../src/render/rexi/pose';
import { mirrorSprite, type SpriteDef } from '../../src/render/sprite';

const INK = new Set<string>([masterPalette.leather1, masterPalette.leather2]);

/** Pixels of the sleeve's ink colors in the left `fraction` of a sprite. */
function inkPixels(sprite: SpriteDef, fraction = 1): number {
  let n = 0;
  for (const row of sprite.rows) {
    for (let x = 0; x < Math.round(row.length * fraction); x++) {
      const color = sprite.palette[row.charAt(x)];
      if (color && INK.has(color)) n += 1;
    }
  }
  return n;
}

function rexi(patch: Partial<RexiView>): RexiView {
  return {
    x: 100,
    y: 100,
    w: 22,
    h: 60,
    vx: 0,
    vy: 0,
    grounded: true,
    flying: false,
    health: 100,
    maxHealth: 100,
    facing: 1,
    aim: { x: 300, y: 110 },
    shoulder: { x: 121.5, y: 110.5 },
    muzzle: { x: 160, y: 110 },
    aimDirection: { x: 1, y: 0 },
    shotAge: 600,
    landedTicks: 600,
    hurtTicks: 0,
    invulnerableTicks: 0,
    weapon: { id: 'mazo-automatico', ammo: null },
    inventory: [],
    powerUps: [],
    ...patch,
  };
}

describe("Rexi's pipeline art", () => {
  it('uses only master-palette colors, in every frame, arm, the cap and the portrait', () => {
    const all = [...Object.values(rexiSprites), ...Object.values(portraitSprites)];
    const off = findOffPaletteSpriteColors([...all, ...all.map(flashSprite)]);
    expect(off, formatOffPaletteReport('Rexi', off)).toEqual([]);
  });

  it('wears the sleeve on his right arm in both facings', () => {
    // Facing right his right arm is the near arm, in the body frame (the left part of it).
    for (const frame of Object.keys(rexiArt.frames) as BodyFrame[]) {
      const right = inkPixels(bodySprite(frame, 1, false), 0.55);
      const left = bodySprite(frame, -1, false);
      // Facing left the near arm (his left arm, now on the canvas's right) is bare...
      const mirroredNear = inkPixels(mirrorSprite(left), 0.55);
      expect(right, frame).toBeGreaterThan(mirroredNear + 30);
    }
    // ...and the aiming arm, his right arm, wears it.
    for (const art of Object.values(heldWeapons)) {
      for (let step = -MAX_AIM_STEP; step <= MAX_AIM_STEP; step++) {
        const i = armAngleIndex(step);
        const left = inkPixels(armSprite(art, i, -1, false).sprite);
        const right = inkPixels(armSprite(art, i, 1, false).sprite);
        expect(left, `${art} ${step}`).toBeGreaterThan(right + 15);
      }
    }
  });

  it('holds every Weapon in all 16 directions', () => {
    for (const id of WEAPON_IDS) {
      for (let step = -MAX_AIM_STEP; step <= MAX_AIM_STEP; step++) {
        for (const facing of [1, -1] as const) {
          expect(
            armSprite(heldWeapons[id], armAngleIndex(step), facing, false).sprite.width,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it('runs an eight-frame cycle with no pose used twice', () => {
    const run = rexiArt.anims.run.frames;
    expect(run).toHaveLength(8);
    const pixels = new Set(run.map((f) => bodySprite(f, 1, false).rows.join('\n')));
    expect(pixels.size).toBe(8);
    expect(rexiArt.anims['run-back'].frames).toEqual([...run].reverse());
  });

  it("plays the shot's recoil and flash once per Mazo Automático shot", () => {
    const { fps, frames } = rexiArt.anims.shoot;
    expect(frames.length / fps).toBeCloseTo(
      defaultTuning.weapons['mazo-automatico'].fireInterval,
      6,
    );
    expect(rexiPose(rexi({ shotAge: 0 }), 0)).toMatchObject({ recoil: 2, muzzleFlash: 2 });
    const interval = secondsToTicks(defaultTuning.weapons['mazo-automatico'].fireInterval);
    expect(rexiPose(rexi({ shotAge: interval }), 0)).toMatchObject({ recoil: 0, muzzleFlash: 0 });
  });

  it('picks rise, apex, fall and the landing squat', () => {
    const [rise, apex, fall, land] = rexiArt.anims.jump.frames;
    expect(rexiPose(rexi({ grounded: false, vy: -300 }), 0).frame).toBe(rise);
    expect(rexiPose(rexi({ grounded: false, vy: 0 }), 0).frame).toBe(apex);
    expect(rexiPose(rexi({ grounded: false, vy: 300 }), 0).frame).toBe(fall);
    expect(rexiPose(rexi({ landedTicks: 0 }), 0).frame).toBe(land);
    expect(rexiPose(rexi({ grounded: false, flying: true, vy: -300 }), 0).frame).toBe(apex);
  });

  it('plays the hurt frames within the hurt reaction, blinking red', () => {
    const ticks = secondsToTicks(defaultTuning.rexi.hurtDuration);
    const seen = new Set<string>();
    for (let left = ticks; left > 0; left--) seen.add(rexiPose(rexi({ hurtTicks: left }), 0).frame);
    expect([...seen].sort()).toEqual(['hurt_0', 'hurt_1']);
    expect(rexiPose(rexi({ invulnerableTicks: 3 }), 0).flash).toBe(true);
  });

  it('maps every arm step onto a pre-rotated angle', () => {
    for (let step = -MAX_AIM_STEP; step <= MAX_AIM_STEP; step++) {
      expect(rexiArt.angles[armAngleIndex(step)]).toBe(step * 22.5);
    }
  });
});
