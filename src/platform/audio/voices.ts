/**
 * Voice limiting: decides which sounds may play so dense fights stay clear instead of clipping
 * into mush. Pure bookkeeping over an injected clock (seconds); the engine does the actual
 * starting and stopping.
 */

export interface VoiceRule {
  /** Most voices of this sound playing at once. A new one steals the oldest. */
  readonly maxVoices: number;
  /** Who wins when all voices are busy: higher steals from lower, ties steal the oldest. */
  readonly priority: number;
  /** A repeat sooner than this after the last start of the same sound is dropped, seconds. */
  readonly minGap: number;
}

export interface VoiceGrant {
  /** Id of the new voice. */
  readonly id: number;
  /** Ids of playing voices the caller must stop to make room. */
  readonly steal: readonly number[];
}

export interface VoiceLimiter<S extends string> {
  /**
   * Asks to start `sound` at `now` for `duration` seconds. Returns the voice to start (and the
   * voices to stop first), or null when the sound should be skipped.
   */
  request(sound: S, now: number, duration: number): VoiceGrant | null;
  /** Number of voices still playing at `now`. */
  active(now: number): number;
}

interface Voice<S> {
  readonly id: number;
  readonly sound: S;
  readonly start: number;
  readonly end: number;
  readonly priority: number;
}

export function createVoiceLimiter<S extends string>(
  ruleFor: (sound: S) => VoiceRule,
  maxVoices: number,
): VoiceLimiter<S> {
  /** Playing voices, oldest first. */
  let voices: Voice<S>[] = [];
  const lastStart = new Map<S, number>();
  let lastId = 0;

  const expire = (now: number) => {
    voices = voices.filter((voice) => voice.end > now);
  };

  return {
    request(sound, now, duration) {
      expire(now);
      const rule = ruleFor(sound);
      const last = lastStart.get(sound);
      if (last !== undefined && now - last < rule.minGap) return null;

      let victim: Voice<S> | undefined;
      const same = voices.filter((voice) => voice.sound === sound);
      if (same.length >= rule.maxVoices) victim = same[0];
      else if (voices.length >= maxVoices) {
        const lowest = Math.min(...voices.map((voice) => voice.priority));
        if (lowest > rule.priority) return null;
        victim = voices.find((voice) => voice.priority === lowest);
      }
      const steal = victim ? [victim.id] : [];
      voices = voices.filter((voice) => voice !== victim);

      const id = ++lastId;
      voices.push({ id, sound, start: now, end: now + duration, priority: rule.priority });
      lastStart.set(sound, now);
      return { id, steal };
    },

    active(now) {
      expire(now);
      return voices.length;
    },
  };
}
