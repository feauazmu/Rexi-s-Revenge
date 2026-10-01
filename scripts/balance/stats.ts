/** Summaries of many bot Runs for the balance pass (pure; see `simulate.ts`). */
import type { RunReport } from './bot.ts';

export interface Spread {
  readonly median: number;
  readonly p25: number;
  readonly p75: number;
  readonly mean: number;
}

export interface Summary {
  readonly runs: number;
  /** Runs that were still going at the time cap. */
  readonly capped: number;
  readonly seconds: Spread;
  readonly score: Spread;
  readonly enemiesDestroyed: Spread;
  /** Share of dropped Crates the bot picked up. */
  readonly crateRate: number;
  readonly quipsPerMinute: number;
  /** Share of Run time spent in Hit-stop. */
  readonly hitStopShare: number;
  /** Share of all damage taken, by source. */
  readonly damageShare: Readonly<Record<string, number>>;
}

/** Linear-interpolated quantile `q` (0..1) of `values`. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const at = (sorted.length - 1) * q;
  const lo = Math.floor(at);
  const hi = Math.ceil(at);
  return (sorted[lo] ?? 0) + ((sorted[hi] ?? 0) - (sorted[lo] ?? 0)) * (at - lo);
}

export function spread(values: readonly number[]): Spread {
  return {
    median: quantile(values, 0.5),
    p25: quantile(values, 0.25),
    p75: quantile(values, 0.75),
    mean: values.reduce((sum, v) => sum + v, 0) / values.length,
  };
}

export function summarize(reports: readonly RunReport[]): Summary {
  const total = (pick: (r: RunReport) => number) => reports.reduce((sum, r) => sum + pick(r), 0);
  const seconds = total((r) => r.seconds);
  const crates = total((r) => r.cratesPicked + r.cratesExpired);
  const damage: Record<string, number> = {};
  for (const r of reports) {
    for (const [source, amount] of Object.entries(r.damageBy)) {
      damage[source] = (damage[source] ?? 0) + amount;
    }
  }
  const damageTotal = Object.values(damage).reduce((sum, v) => sum + v, 0) || 1;
  return {
    runs: reports.length,
    capped: reports.filter((r) => r.capped).length,
    seconds: spread(reports.map((r) => r.seconds)),
    score: spread(reports.map((r) => r.score)),
    enemiesDestroyed: spread(reports.map((r) => r.enemiesDestroyed)),
    crateRate: crates === 0 ? 0 : total((r) => r.cratesPicked) / crates,
    quipsPerMinute: seconds === 0 ? 0 : total((r) => r.quips) / (seconds / 60),
    hitStopShare: seconds === 0 ? 0 : total((r) => r.hitStopSeconds) / seconds,
    damageShare: Object.fromEntries(
      Object.entries(damage)
        .sort(([, a], [, b]) => b - a)
        .map(([source, amount]) => [source, amount / damageTotal]),
    ),
  };
}

const clock = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const pct = (share: number) => `${Math.round(share * 100)}%`;

export function formatSummary(name: string, s: Summary): string {
  const damage = Object.entries(s.damageShare)
    .map(([source, share]) => `${source} ${pct(share)}`)
    .join(', ');
  return [
    `${name} (${s.runs} Runs${s.capped ? `, ${s.capped} hit the time cap` : ''})`,
    `  survival  median ${clock(s.seconds.median)}  (p25 ${clock(s.seconds.p25)}, p75 ${clock(s.seconds.p75)}, mean ${clock(s.seconds.mean)})`,
    `  score     median ${Math.round(s.score.median)}  (p25 ${Math.round(s.score.p25)}, p75 ${Math.round(s.score.p75)})`,
    `  kills     median ${Math.round(s.enemiesDestroyed.median)}`,
    `  crates    ${pct(s.crateRate)} picked up; quips ${s.quipsPerMinute.toFixed(1)}/min; hit-stop ${pct(s.hitStopShare)} of Run time`,
    `  damage    ${damage}`,
  ].join('\n');
}
