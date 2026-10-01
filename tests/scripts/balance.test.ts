import { describe, expect, it } from 'vitest';
import { playRun, PROFILES } from '../../scripts/balance/bot';
import { quantile, summarize } from '../../scripts/balance/stats';

describe('balance bot', () => {
  it('replays a seed exactly', () => {
    const run = () => playRun({ seed: 7, profile: PROFILES.decent, maxSeconds: 60 });
    expect(run()).toEqual(run());
  });

  it('plays a real Run: fights, collects Crates and takes damage', () => {
    // Loose bounds on purpose: the balance pass may move the numbers, not the behavior.
    const report = playRun({ seed: 1, profile: PROFILES.decent, maxSeconds: 120 });
    expect(report.seconds).toBeGreaterThan(30);
    expect(report.enemiesDestroyed).toBeGreaterThan(5);
    expect(report.cratesPicked).toBeGreaterThan(0);
    expect(Object.values(report.damageBy).reduce((sum, d) => sum + d, 0)).toBeGreaterThan(0);
  });

  it('stops at the time cap', () => {
    const report = playRun({ seed: 1, profile: PROFILES.expert, maxSeconds: 20 });
    expect(report).toMatchObject({ capped: true, seconds: 20 });
  });

  it('plays the Run its tuning overrides describe', () => {
    const options = { seed: 1, profile: PROFILES.decent, maxSeconds: 120 };
    const fragile = playRun({ ...options, tuning: { rexi: { maxHealth: 5 } } });
    expect(fragile.capped).toBe(false);
    expect(fragile.seconds).toBeLessThan(playRun(options).seconds);
  });
});

describe('balance stats', () => {
  it('interpolates quantiles', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantile([], 0.5)).toBeNaN();
  });

  it('summarizes Runs into spreads and shares', () => {
    const base = { score: 0, enemiesDestroyed: 0, capped: false, quips: 0, hitStopSeconds: 0 };
    const summary = summarize([
      { ...base, seed: 1, seconds: 60, cratesPicked: 1, cratesExpired: 1, damageBy: { paper: 30 } },
      {
        ...base,
        seed: 2,
        seconds: 180,
        cratesPicked: 2,
        cratesExpired: 0,
        damageBy: { rocket: 90 },
      },
    ]);
    expect(summary.seconds.median).toBe(120);
    expect(summary.crateRate).toBe(0.75);
    expect(summary.damageShare).toEqual({ rocket: 0.75, paper: 0.25 });
  });
});
