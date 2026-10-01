import type { GameEvent } from '../events';
import type { Rng } from '../rng';
import type { Tuning } from '../tuning';
import type { RunState } from './state';

/** Services shared by every Run subsystem during a tick. */
export interface RunContext {
  readonly tuning: Tuning;
  readonly rng: Rng;
  readonly state: RunState;
  /** Records an event to be returned from the current `Game.tick`. */
  emit(event: GameEvent): void;
  /** Next unique entity id (deterministic counter shared by all entities). */
  nextId(): number;
}
