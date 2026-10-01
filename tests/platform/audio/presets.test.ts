import { describe, expect, it } from 'vitest';
import { SOUND_PRESETS, type SoundId } from '../../../src/platform/audio/presets';
import { patchDuration, renderPatch } from '../../../src/platform/audio/synth';
import { audibleSeconds, brightness, peak, rms } from '../../support/signal';

const SR = 48_000;
const ids = Object.keys(SOUND_PRESETS) as SoundId[];
const render = (id: SoundId) => renderPatch(SOUND_PRESETS[id].patch, SR);

describe('sound presets', () => {
  it.each(ids)('%s renders a clean, bounded, click-free sound', (id) => {
    const preset = SOUND_PRESETS[id];
    const samples = render(id);
    expect(samples.length).toBeGreaterThan(0);
    expect(samples.every(Number.isFinite)).toBe(true);
    expect(preset.patch.peak).toBeLessThanOrEqual(0.8); // headroom for overlapping voices
    expect(peak(samples)).toBeCloseTo(preset.patch.peak, 5);
    expect(samples[0]).toBe(0);
    expect(Math.abs(samples.at(-1) ?? 1)).toBeLessThan(0.01);
  });

  it.each(ids)('%s has sane voice rules', (id) => {
    const { maxVoices, priority, minGap, pitchJitter, variants } = SOUND_PRESETS[id];
    expect(Number.isInteger(maxVoices) && maxVoices >= 1).toBe(true);
    expect(priority).toBeGreaterThanOrEqual(0);
    expect(minGap).toBeGreaterThanOrEqual(0);
    expect(pitchJitter).toBeGreaterThanOrEqual(0);
    expect(pitchJitter).toBeLessThan(0.2);
    expect(Number.isInteger(variants) && variants >= 1).toBe(true);
  });

  it('automatic Weapon shots and hits are short enough not to smear at full fire rate', () => {
    // Mazo Automático fires every 0.12 s.
    expect(audibleSeconds(render('gavel-thwack'), SR)).toBeLessThan(0.12);
    expect(audibleSeconds(render('enemy-tink'), SR)).toBeLessThan(0.08);
  });

  it('frequent sounds sit below the big moments in the mix', () => {
    const level = (id: SoundId) => SOUND_PRESETS[id].patch.peak;
    expect(level('enemy-tink')).toBeLessThan(level('gavel-thwack'));
    expect(level('gavel-thwack')).toBeLessThan(level('explosion-small'));
    expect(level('explosion-small')).toBeLessThan(level('explosion-large'));
    expect(level('dialogue-blip')).toBeLessThan(level('menu-confirm'));
  });

  it('a large explosion is longer, darker and heavier than a small one', () => {
    const small = render('explosion-small');
    const large = render('explosion-large');
    expect(audibleSeconds(large, SR)).toBeGreaterThan(audibleSeconds(small, SR) * 1.4);
    expect(brightness(large)).toBeLessThan(brightness(small));
    expect(rms(large)).toBeGreaterThan(rms(small));
  });

  it('explosions have weight: most of their energy is low-frequency', () => {
    expect(brightness(render('explosion-large'))).toBeLessThan(
      brightness(render('enemy-tink')) / 4,
    );
  });

  it('the Dialogue blip is a short, tight beep that cuts the previous one', () => {
    const blip = SOUND_PRESETS['dialogue-blip'];
    expect(patchDuration(blip.patch)).toBeLessThan(0.06);
    expect(blip.maxVoices).toBe(1);
    expect(blip.minGap).toBe(0);
  });

  it('getting hurt and menu feedback always win a voice over combat noise', () => {
    for (const important of ['rexi-oof', 'menu-move', 'menu-confirm'] as const) {
      for (const noise of ['gavel-thwack', 'enemy-tink', 'paper-fwip'] as const) {
        expect(SOUND_PRESETS[important].priority).toBeGreaterThan(SOUND_PRESETS[noise].priority);
      }
    }
  });

  it('the sad trombone descends: wah, wah, wah, waaah', () => {
    const layers = SOUND_PRESETS['sad-trombone'].patch.layers;
    const notes = layers.filter((layer) => layer.wave === 'saw').map((layer) => layer.freq);
    expect(notes.length).toBe(4);
    expect([...notes].sort((a, b) => b - a)).toEqual(notes);
  });
});
