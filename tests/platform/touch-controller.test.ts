import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT, type GameView, type Vec2 } from '../../src/core';
import { createTouchController, AIM_DISTANCE } from '../../src/platform/touch/controller';
import { TOUCH_LAYOUT } from '../../src/render/touch/layout';
import { drive, driveFromTitle } from '../support/driver';

const L = TOUCH_LAYOUT;
const R = L.stick.radius;

function runView(): GameView {
  return drive({ device: 'touch' }).view;
}

function pausedView(): GameView {
  const game = drive({ device: 'touch' });
  game.ticks(1, { pause: true });
  return game.view;
}

function titleView(): GameView {
  const game = driveFromTitle({ device: 'touch' });
  game.ticks(1);
  return game.view;
}

/** A controller that has seen `view` once, so fingers are read in that screen's mode. */
function controllerOn(view: GameView) {
  const touch = createTouchController();
  touch.sample(view);
  return touch;
}

const offset = (p: Vec2, dx: number, dy: number): Vec2 => ({ x: p.x + dx, y: p.y + dy });

describe('touch controller: playing a Run', () => {
  const view = runView();
  const shoulder = view.run?.rexi.shoulder ?? { x: 0, y: 0 };

  it('samples a neutral frame (aiming ahead of Rexi) with no fingers down', () => {
    const frame = controllerOn(view).sample(view);
    expect({ ...frame, aim: NEUTRAL_INPUT.aim }).toEqual(NEUTRAL_INPUT);
    expect(frame.aim).toEqual({ x: shoulder.x + AIM_DISTANCE, y: shoulder.y });
  });

  it('moves with a floating stick on the left half, wherever the thumb lands', () => {
    const touch = controllerOn(view);
    const start = { x: 120, y: 180 };
    touch.down(1, start);
    expect(touch.sample(view).move).toBe(0);
    touch.move(1, offset(start, R, 0));
    expect(touch.sample(view).move).toBe(1);
    touch.move(1, offset(start, -R * 3, 0)); // drags the base along...
    expect(touch.sample(view).move).toBe(-1);
    touch.move(1, offset(start, -R * 2 + 10, 0)); // ...so reversing responds at once
    expect(touch.sample(view).move).toBeGreaterThan(0);
    touch.up(1, start);
    expect(touch.sample(view).move).toBe(0);
  });

  it('drops through platforms when the move stick is pulled down', () => {
    const touch = controllerOn(view);
    touch.down(1, { x: 100, y: 150 });
    touch.move(1, { x: 100, y: 150 + R });
    const frame = touch.sample(view);
    expect(frame.drop).toBe(true);
    expect(frame.move).toBe(0);
    expect(frame.jump).toBe(false);
  });

  it('aims along the right stick and fires while it is pushed', () => {
    const touch = controllerOn(view);
    const start = { x: 400, y: 150 };
    touch.down(2, start);
    expect(touch.sample(view).fire).toBe(false); // resting inside the dead zone
    touch.move(2, offset(start, 0, -R));
    const frame = touch.sample(view);
    expect(frame.fire).toBe(true);
    expect(frame.aim.x).toBeCloseTo(shoulder.x);
    expect(frame.aim.y).toBeCloseTo(shoulder.y - AIM_DISTANCE);

    touch.up(2, offset(start, 0, -R));
    const released = touch.sample(view);
    expect(released.fire).toBe(false);
    expect(released.aim.y).toBeCloseTo(shoulder.y - AIM_DISTANCE); // keeps the last aim
  });

  it('faces where Rexi walks while the aim stick is idle', () => {
    const touch = controllerOn(view);
    touch.down(1, { x: 100, y: 150 });
    touch.move(1, { x: 100 - R, y: 150 });
    expect(touch.sample(view).aim).toEqual({ x: shoulder.x - AIM_DISTANCE, y: shoulder.y });
  });

  it('handles move, aim and jump fingers at the same time (multi-touch)', () => {
    const touch = controllerOn(view);
    touch.down(1, { x: 100, y: 150 });
    touch.move(1, { x: 100 + R, y: 150 });
    touch.down(2, { x: 420, y: 120 });
    touch.move(2, { x: 420 + R, y: 120 });
    touch.down(3, { x: L.jump.x, y: L.jump.y });
    const frame = touch.sample(view);
    expect(frame).toMatchObject({ move: 1, fire: true, jump: true });
    touch.up(3, { x: L.jump.x, y: L.jump.y });
    expect(touch.sample(view)).toMatchObject({ move: 1, fire: true, jump: false });
  });

  it('ignores a second finger on a half whose stick is already held', () => {
    const touch = controllerOn(view);
    touch.down(1, { x: 100, y: 150 });
    touch.move(1, { x: 100 + R, y: 150 });
    touch.down(4, { x: 60, y: 150 });
    touch.move(4, { x: 60 - R, y: 150 });
    expect(touch.sample(view).move).toBe(1);
  });

  it('holds jump while a finger stays on the jump button', () => {
    const touch = controllerOn(view);
    touch.down(3, { x: L.jump.x + 5, y: L.jump.y - 5 });
    expect(touch.sample(view).jump).toBe(true);
    expect(touch.sample(view).jump).toBe(true);
    touch.up(3, { x: 0, y: 0 });
    expect(touch.sample(view).jump).toBe(false);
  });

  it('cycles Weapons with a tap on the HUD Weapon icon, as a one-tick edge', () => {
    const touch = controllerOn(view);
    touch.down(5, { x: 10, y: 20 });
    expect(touch.sample(view).weaponNext).toBe(true);
    expect(touch.sample(view).weaponNext).toBe(false);
    expect(touch.sample(view).fire).toBe(false);
  });

  it('pauses with the pause button', () => {
    const touch = controllerOn(view);
    touch.down(6, { x: L.pause.x, y: L.pause.y });
    expect(touch.sample(view).pause).toBe(true);
    expect(touch.sample(view).pause).toBe(false);
  });

  it('a cancelled pointer (system gesture) releases its control', () => {
    const touch = controllerOn(view);
    touch.down(2, { x: 400, y: 150 });
    touch.move(2, { x: 400 + R, y: 150 });
    touch.cancel(2);
    expect(touch.sample(view).fire).toBe(false);
  });

  it('describes the overlay: held sticks and pressed buttons', () => {
    const touch = controllerOn(view);
    expect(touch.overlay(view)).toEqual({
      mode: 'play',
      moveStick: null,
      aimStick: null,
      pressed: [],
    });
    touch.down(1, { x: 100, y: 150 });
    touch.move(1, { x: 110, y: 150 });
    touch.down(3, { x: L.jump.x, y: L.jump.y });
    expect(touch.overlay(view)).toEqual({
      mode: 'play',
      moveStick: { origin: { x: 100, y: 150 }, knob: { x: 110, y: 150 } },
      aimStick: null,
      pressed: ['jump'],
    });
  });
});

describe('touch controller: Title and Cómo jugar', () => {
  it('turns any touch into a start input and shows no controls', () => {
    const view = titleView();
    const touch = controllerOn(view);
    touch.down(1, { x: 300, y: 100 });
    expect(touch.sample(view).start).toBe(true);
    expect(touch.sample(view).start).toBe(false);
    expect(touch.overlay(view)).toBeNull();
  });
});

describe('touch controller: menus (pause menu, initials entry)', () => {
  const view = pausedView();
  const d = L.dpad;

  it.each([
    ['up', { x: d.x, y: d.y - d.arm }],
    ['down', { x: d.x, y: d.y + d.arm }],
    ['left', { x: d.x - d.arm, y: d.y }],
    ['right', { x: d.x + d.arm, y: d.y }],
  ] as const)('the d-pad presses %s', (direction, point) => {
    const touch = controllerOn(view);
    touch.down(1, point);
    expect(touch.sample(view).menu).toMatchObject({ [direction]: true });
    expect(touch.sample(view).menu[direction]).toBe(false);
  });

  it('confirms and goes back with their buttons', () => {
    const touch = controllerOn(view);
    touch.down(1, { x: L.confirm.x, y: L.confirm.y });
    expect(touch.sample(view).menu.confirm).toBe(true);
    touch.down(2, { x: L.back.x, y: L.back.y });
    expect(touch.sample(view).menu).toMatchObject({ confirm: false, back: true });
  });

  it.each([
    ['up', 0, -40],
    ['down', 0, 40],
    ['left', -40, 5],
    ['right', 40, -5],
  ] as const)('a swipe anywhere else navigates %s', (direction, dx, dy) => {
    const touch = controllerOn(view);
    const start = { x: 240, y: 120 };
    touch.down(1, start);
    touch.move(1, offset(start, dx / 2, dy / 2));
    expect(touch.sample(view).menu[direction]).toBe(false); // fires on release
    touch.up(1, offset(start, dx, dy));
    expect(touch.sample(view).menu[direction]).toBe(true);
  });

  it('a short tap outside the buttons does nothing', () => {
    const touch = controllerOn(view);
    touch.down(1, { x: 240, y: 120 });
    touch.up(1, { x: 243, y: 121 });
    const { menu } = touch.sample(view);
    expect(Object.values(menu).some(Boolean)).toBe(false);
  });

  it('draws the menu controls with the pressed button lit, and no sticks', () => {
    const touch = controllerOn(view);
    touch.down(1, { x: L.confirm.x, y: L.confirm.y });
    expect(touch.overlay(view)).toEqual({
      mode: 'menu',
      moveStick: null,
      aimStick: null,
      pressed: ['confirm'],
    });
  });

  it('does not move Rexi from a stick finger still held while paused', () => {
    const run = runView();
    const touch = controllerOn(run);
    touch.down(1, { x: 100, y: 150 });
    touch.move(1, { x: 100 + R, y: 150 });
    expect(touch.sample(view).move).toBe(0);
    expect(touch.sample(run).move).toBe(1); // and resumes when the Run does
  });
});
