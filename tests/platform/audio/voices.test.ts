import { describe, expect, it } from 'vitest';
import { createVoiceLimiter, type VoiceRule } from '../../../src/platform/audio/voices';

type Sound = 'shot' | 'boom' | 'blip' | 'ui';

const RULES: Record<Sound, VoiceRule> = {
  shot: { maxVoices: 3, priority: 1, minGap: 0.02 },
  boom: { maxVoices: 2, priority: 2, minGap: 0.02 },
  blip: { maxVoices: 1, priority: 3, minGap: 0 },
  ui: { maxVoices: 2, priority: 3, minGap: 0 },
};

const limiter = (maxVoices = 6) => createVoiceLimiter<Sound>((sound) => RULES[sound], maxVoices);

describe('createVoiceLimiter', () => {
  it('admits voices while there is room', () => {
    const voices = limiter();
    const a = voices.request('shot', 0, 0.1);
    const b = voices.request('boom', 0, 0.5);
    expect(a).toEqual({ id: expect.any(Number) as number, steal: [] });
    expect(b?.id).not.toBe(a?.id);
    expect(voices.active(0)).toBe(2);
  });

  it('frees a voice when its sound has finished', () => {
    const voices = limiter();
    voices.request('shot', 0, 0.1);
    expect(voices.active(0.05)).toBe(1);
    expect(voices.active(0.1)).toBe(0);
  });

  it('caps each sound at its own voice count by stealing its oldest voice', () => {
    const voices = limiter();
    const first = voices.request('shot', 0.0, 1);
    voices.request('shot', 0.1, 1);
    voices.request('shot', 0.2, 1);
    const fourth = voices.request('shot', 0.3, 1);
    expect(fourth?.steal).toEqual([first?.id]);
    expect(voices.active(0.3)).toBe(3);
  });

  it('drops a repeat of the same sound that comes too soon after the last one', () => {
    const voices = limiter();
    expect(voices.request('shot', 1.0, 0.1)).not.toBeNull();
    expect(voices.request('shot', 1.0, 0.1)).toBeNull(); // two hits in the same tick
    expect(voices.request('shot', 1.019, 0.1)).toBeNull();
    expect(voices.request('shot', 1.02, 0.1)).not.toBeNull();
  });

  it('a sound with one voice cuts its previous voice (a new blip replaces the last)', () => {
    const voices = limiter();
    const first = voices.request('blip', 0, 0.05);
    const second = voices.request('blip', 0.01, 0.05);
    expect(second?.steal).toEqual([first?.id]);
  });

  it('caps all voices together, stealing the oldest voice of the lowest priority', () => {
    const voices = limiter(4);
    const shot = voices.request('shot', 0.0, 2);
    voices.request('boom', 0.1, 2);
    voices.request('boom', 0.2, 2);
    voices.request('ui', 0.3, 2);
    const blip = voices.request('blip', 0.4, 2);
    expect(blip?.steal).toEqual([shot?.id]);
    expect(voices.active(0.4)).toBe(4);
  });

  it('drops a new voice when every playing voice matters more', () => {
    const voices = limiter(2);
    voices.request('ui', 0.0, 2);
    voices.request('blip', 0.1, 2);
    expect(voices.request('shot', 0.2, 2)).toBeNull();
    expect(voices.active(0.2)).toBe(2);
  });

  it('prefers stealing its own oldest voice to stealing another sound', () => {
    const voices = limiter(3);
    voices.request('shot', 0.0, 2);
    const oldBoom = voices.request('boom', 0.1, 2);
    voices.request('boom', 0.2, 2);
    expect(voices.request('boom', 0.3, 2)?.steal).toEqual([oldBoom?.id]);
  });

  it('never holds more voices than its caps, however dense the fight', () => {
    const voices = limiter(6);
    const sounds: Sound[] = ['shot', 'boom', 'blip', 'ui'];
    const playing = new Set<number>();
    const ends = new Map<number, number>();
    for (let i = 0; i < 2000; i++) {
      const now = i * 0.004;
      for (const [id, end] of ends) if (end <= now) playing.delete(id);
      const sound = sounds[i % sounds.length] ?? 'shot';
      const voice = voices.request(sound, now, 0.05 + (i % 7) * 0.05);
      if (!voice) continue;
      for (const id of voice.steal) playing.delete(id);
      playing.add(voice.id);
      ends.set(voice.id, now + 0.05 + (i % 7) * 0.05);
      expect(playing.size).toBeLessThanOrEqual(6);
      expect(voices.active(now)).toBe(playing.size);
    }
  });
});
