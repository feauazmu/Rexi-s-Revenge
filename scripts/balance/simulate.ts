/**
 * The balance pass's simulated play (#30): the scripted player in `bot.ts` plays many seeded
 * Runs of the shipped tuning, and this prints how long they last and what they score.
 *
 *   npm run balance                          # 40 seeds, every profile
 *   npm run balance -- --seeds 100 --profile decent
 *   npm run balance -- --json                # one JSON line per profile, for comparisons
 *   npm run balance -- --tuning '{"quips":{"chance":0.3}}'   # try overrides before editing
 *   npm run balance -- --tuning overrides.json                # the same, from a file
 *
 * Same seeds + same tuning = same numbers, so a change to the tuning catalog shows its effect
 * directly. The target ("Balance" in docs/architecture.md) is a median Run of a few minutes
 * for the "decent" profile.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { runnerImport } from 'vite';
import type * as Bot from './bot.ts';
import type * as Stats from './stats.ts';

const root = resolve(import.meta.dirname, '../..');
// The core's sources use extensionless imports, so load them through Vite's module runner.
const load = async <T>(file: string) =>
  (
    await runnerImport<T>(resolve(import.meta.dirname, file), {
      root,
      configFile: false,
      logLevel: 'error',
    })
  ).module;
const bot = await load<typeof Bot>('bot.ts');
const stats = await load<typeof Stats>('stats.ts');

const { values } = parseArgs({
  options: {
    seeds: { type: 'string', default: '40' },
    first: { type: 'string', default: '1' },
    profile: { type: 'string', multiple: true },
    'max-seconds': { type: 'string', default: '900' },
    json: { type: 'boolean', default: false },
    tuning: { type: 'string' },
  },
});

function positiveInteger(option: string, value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    throw new Error(`--${option} must be a positive integer, got "${value}"`);
  return n;
}
const seeds = positiveInteger('seeds', values.seeds);
const first = positiveInteger('first', values.first);
const maxSeconds = positiveInteger('max-seconds', values['max-seconds']);
const isProfile = (name: string): name is Bot.ProfileName => Object.hasOwn(bot.PROFILES, name);
const names = values.profile ?? Object.keys(bot.PROFILES);
const unknown = names.filter((name) => !isProfile(name));
if (unknown.length > 0) {
  throw new Error(
    `Unknown --profile ${unknown.join(', ')}; one of ${Object.keys(bot.PROFILES).join(', ')}`,
  );
}
const tuningArg = values.tuning?.trim();
const tuning = tuningArg
  ? (JSON.parse(
      tuningArg.startsWith('{') ? tuningArg : readFileSync(tuningArg, 'utf8'),
    ) as Bot.PlayOptions['tuning'])
  : undefined;

for (const name of names.filter(isProfile)) {
  const profile = bot.PROFILES[name];
  const reports = Array.from({ length: seeds }, (_, i) =>
    bot.playRun({ seed: first + i, profile, maxSeconds, ...(tuning ? { tuning } : {}) }),
  );
  const summary = stats.summarize(reports);
  if (values.json) console.log(JSON.stringify({ profile: name, ...summary }));
  else console.log(stats.formatSummary(name, summary));
}
