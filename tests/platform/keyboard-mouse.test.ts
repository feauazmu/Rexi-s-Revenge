import { describe, expect, it } from 'vitest';
import { NEUTRAL_INPUT } from '../../src/core';
import { toInputFrame, type KeyboardMouseSnapshot } from '../../src/platform/keyboard-mouse';
import { computeViewport } from '../../src/platform/viewport';

const viewport = computeViewport(1366, 768, 1); // 2×, letterbox offset (43, 24)

function snapshot(patch: Partial<KeyboardMouseSnapshot> = {}): KeyboardMouseSnapshot {
  return {
    held: new Set(),
    pressed: new Set(),
    pointer: null,
    primaryHeld: false,
    primaryPressed: false,
    wheel: 0,
    ...patch,
  };
}

const frame = (patch: Partial<KeyboardMouseSnapshot>) => toInputFrame(snapshot(patch), viewport);

describe('keyboard + mouse to input frame', () => {
  it('produces a neutral frame when nothing is pressed', () => {
    expect(frame({})).toEqual(NEUTRAL_INPUT);
  });

  it.each([
    [['KeyD'], 1],
    [['ArrowRight'], 1],
    [['KeyA'], -1],
    [['ArrowLeft'], -1],
    [['KeyA', 'KeyD'], 0],
  ])('maps held %j to move %i', (keys, move) => {
    expect(frame({ held: new Set(keys) }).move).toBe(move);
  });

  it.each(['KeyW', 'ArrowUp', 'Space'])('holds jump with %s', (key) => {
    expect(frame({ held: new Set([key]) }).jump).toBe(true);
  });

  it.each(['KeyS', 'ArrowDown'])('holds drop (down through platforms) with %s', (key) => {
    expect(frame({ held: new Set([key]) }).drop).toBe(true);
  });

  it('aims at the pointer, mapped through the viewport', () => {
    expect(frame({ pointer: { x: 43 + 100, y: 24 + 50 } }).aim).toEqual({ x: 50, y: 25 });
  });

  it('fires while the primary button is held', () => {
    expect(frame({ primaryHeld: true }).fire).toBe(true);
  });

  it('switches Weapons with Q/E, the wheel and number keys', () => {
    expect(frame({ pressed: new Set(['KeyE']) }).weaponNext).toBe(true);
    expect(frame({ pressed: new Set(['KeyQ']) }).weaponPrevious).toBe(true);
    expect(frame({ wheel: 120 }).weaponNext).toBe(true);
    expect(frame({ wheel: -3 }).weaponPrevious).toBe(true);
    expect(frame({ pressed: new Set(['Digit3']) }).weaponSlot).toBe(3);
    expect(frame({ held: new Set(['Digit3']) }).weaponSlot).toBeNull();
  });

  it('treats Esc and P as pause presses', () => {
    expect(frame({ pressed: new Set(['Escape']) }).pause).toBe(true);
    expect(frame({ pressed: new Set(['KeyP']) }).pause).toBe(true);
    expect(frame({ held: new Set(['KeyP']) }).pause).toBe(false);
  });

  it('maps menu navigation edges', () => {
    const menu = frame({ pressed: new Set(['ArrowDown', 'Enter']) }).menu;
    expect(menu).toEqual({
      up: false,
      down: true,
      left: false,
      right: false,
      confirm: true,
      back: false,
    });
  });

  it('counts any key or click as a start input', () => {
    expect(frame({ pressed: new Set(['KeyZ']) }).start).toBe(true);
    expect(frame({ primaryPressed: true }).start).toBe(true);
    expect(frame({ held: new Set(['KeyZ']) }).start).toBe(false);
  });
});
