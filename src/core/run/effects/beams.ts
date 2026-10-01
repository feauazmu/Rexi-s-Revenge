import { secondsToTicks } from '../../constants';
import type { Vec2 } from '../../math';
import type { BeamTuning } from '../../tuning';
import type { BeamView } from '../../view';

/** The fading trace of a beam shot. Cosmetic: the beam's hits are resolved when it fires. */
export interface BeamState {
  readonly from: Vec2;
  readonly to: Vec2;
  /** Ticks since it was fired. */
  age: number;
}

export function spawnBeam(beams: BeamState[], from: Vec2, to: Vec2): void {
  beams.push({ from, to, age: 0 });
}

/** Ages every beam and drops the ones that have faded out. */
export function stepBeams(beams: BeamState[], tuning: BeamTuning): void {
  const life = beamLife(tuning);
  for (const beam of beams) beam.age += 1;
  for (let i = beams.length - 1; i >= 0; i--) {
    if ((beams[i]?.age ?? life) >= life) beams.splice(i, 1);
  }
}

export function viewBeam(beam: Readonly<BeamState>, tuning: BeamTuning): BeamView {
  const full = secondsToTicks(tuning.duration);
  const fade = secondsToTicks(tuning.fade);
  const intensity = beam.age < full ? 1 : (full + fade - beam.age) / (fade + 1);
  return { from: beam.from, to: beam.to, age: beam.age, intensity };
}

function beamLife(tuning: BeamTuning): number {
  return secondsToTicks(tuning.duration) + secondsToTicks(tuning.fade);
}
