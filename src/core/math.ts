export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Axis-aligned box; `x`/`y` is the top-left corner in game coordinates. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function overlaps(a: Readonly<Box>, b: Readonly<Box>): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function center(box: Readonly<Box>): Vec2 {
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 };
}

/** `v` rotated by `radians` (positive turns clockwise on screen, where y points down). */
export function rotate(v: Vec2, radians: number): Vec2 {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** Unit vector from `from` toward `to`, or `fallback` when the points coincide. */
export function directionTo(from: Vec2, to: Vec2, fallback: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  return length < 1e-6 ? fallback : { x: dx / length, y: dy / length };
}
