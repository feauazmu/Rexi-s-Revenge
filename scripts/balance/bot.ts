/**
 * A scripted player for the balance pass (#30): it plays real Runs through the Game core's
 * public interface (input frames in, views out), so its numbers measure the shipped tuning.
 *
 * The bot plays like a person with limits, set by a {@link BotProfile}:
 *
 * - **Perception lags.** It sees Enemies and Enemy projectiles as they were `reactionTicks` ago
 *   and extrapolates them to now, so a shot fired within the last reaction window is invisible
 *   to it. Each Enemy projectile is noticed at all only with chance `awareness`.
 * - **It decides in beats.** Every `decisionTicks` it scores six plans (left / stay / right,
 *   each with or without a jump) by simulating Rexi's rough kinematics against the predicted
 *   projectile paths over `horizon` seconds, and commits to the cheapest: threats first, then
 *   reaching its goal (a Crate, or away from an Archivador's drop line).
 * - **It aims like a hand on a mouse.** It keeps a target until another Enemy is clearly
 *   closer, leads it by `lead` of the shot's flight time, and misses by a wandering offset of
 *   up to `aimError` px.
 * - **Weapon sense** (`switchesWeapons`): heavy hitters for the Banca Artillada, the Lluvia de
 *   Sellos up close, otherwise its best ranged Weapon. With `focusesBanca` it turns on a Banca
 *   Artillada as soon as one shows up, whatever is closer.
 *
 * Everything random comes from a seeded `Rng`, so a seed + profile replays exactly.
 */
import {
  createGame,
  createRng,
  inputFrame,
  resolveTuning,
  TICKS_PER_SECOND,
  WEAPON_IDS,
  type EnemyView,
  type GameEvent,
  type GameView,
  type InputFramePatch,
  type ProjectileKind,
  type ProjectileView,
  type Rng,
  type RunView,
  type Tuning,
  type TuningOverrides,
  type Vec2,
  type WeaponId,
} from '../../src/core';

export interface BotProfile {
  readonly name: string;
  /** How old the bot's picture of Enemies and their shots is, ticks. */
  readonly reactionTicks: number;
  /** Ticks between decisions (the bot commits to a plan in between). */
  readonly decisionTicks: number;
  /** Chance of noticing any given Enemy projectile at all. */
  readonly awareness: number;
  /** How far ahead it predicts threats, seconds. */
  readonly horizon: number;
  /** Largest aim miss, px (a wandering offset, re-rolled every half second). */
  readonly aimError: number;
  /** Share of the shot's flight time it leads a moving target by (0 = aims at it). */
  readonly lead: number;
  /** Whether it picks Weapons for the situation, or keeps whatever is selected. */
  readonly switchesWeapons: boolean;
  /** Whether it makes a Banca Artillada its target as soon as one is on screen. */
  readonly focusesBanca: boolean;
}

/** Three reference players. "decent" is the one the balance targets. */
export const PROFILES = {
  casual: {
    name: 'casual',
    reactionTicks: 18,
    decisionTicks: 10,
    awareness: 0.6,
    horizon: 0.6,
    aimError: 22,
    lead: 0,
    switchesWeapons: false,
    focusesBanca: false,
  },
  decent: {
    name: 'decent',
    reactionTicks: 14,
    decisionTicks: 7,
    awareness: 0.78,
    horizon: 0.8,
    aimError: 12,
    lead: 0.5,
    switchesWeapons: true,
    focusesBanca: false,
  },
  expert: {
    name: 'expert',
    reactionTicks: 9,
    decisionTicks: 3,
    awareness: 0.95,
    horizon: 1,
    aimError: 5,
    lead: 0.9,
    switchesWeapons: true,
    focusesBanca: true,
  },
} as const satisfies Record<string, BotProfile>;

export type ProfileName = keyof typeof PROFILES;

/** What one Run tells the balance pass. */
export interface RunReport {
  readonly seed: number;
  readonly seconds: number;
  readonly score: number;
  readonly enemiesDestroyed: number;
  /** True when the Run hit the time cap instead of ending. */
  readonly capped: boolean;
  readonly cratesPicked: number;
  readonly cratesExpired: number;
  readonly quips: number;
  readonly hitStopSeconds: number;
  /** Damage taken, by what dealt it (projectile kind, or 'blast' for splash). */
  readonly damageBy: Readonly<Partial<Record<ProjectileKind | 'blast', number>>>;
}

export interface PlayOptions {
  readonly seed: number;
  readonly profile: BotProfile;
  readonly tuning?: TuningOverrides;
  /** Stop a Run that is still going after this long, seconds of Run time. */
  readonly maxSeconds?: number;
}

/** Plays one Run from the Title to its end (or the time cap) and reports on it. */
export function playRun({ seed, profile, tuning, maxSeconds = 900 }: PlayOptions): RunReport {
  const game = createGame({ seed, ...(tuning ? { overrides: { tuning } } : {}) });
  for (let i = 0; i < 20 * TICKS_PER_SECOND && game.view.screen !== 'run'; i++) {
    game.tick(inputFrame({ start: game.view.startReady }));
  }
  if (game.view.screen !== 'run') throw new Error('The bot could not start a Run');

  const bot = createBot(profile, seed, resolveTuning(tuning));
  const damageBy: Partial<Record<ProjectileKind | 'blast', number>> = {};
  let cratesPicked = 0;
  let cratesExpired = 0;
  let quips = 0;
  let hitStopTicks = 0;
  const maxTicks = maxSeconds * TICKS_PER_SECOND;

  for (;;) {
    const before = game.view.run;
    if (!before || before.ended || before.tick >= maxTicks) break;
    const events: readonly GameEvent[] = game.tick(inputFrame(bot.decide(game.view)));
    for (const event of events) {
      if (event.type === 'rexi-hit') {
        const source = hitSource(before);
        damageBy[source] = (damageBy[source] ?? 0) + event.damage;
      } else if (event.type === 'crate-picked') cratesPicked++;
      else if (event.type === 'crate-expired') cratesExpired++;
      else if (event.type === 'quip-started') {
        quips++;
        hitStopTicks += event.hitStopTicks;
      }
    }
  }
  const run = game.view.run;
  if (!run) throw new Error('The Run vanished');
  return {
    seed,
    seconds: run.stats.ticksSurvived / TICKS_PER_SECOND,
    score: run.stats.score,
    enemiesDestroyed: run.stats.enemiesDestroyed,
    capped: !run.ended,
    cratesPicked,
    cratesExpired,
    quips,
    hitStopSeconds: hitStopTicks / TICKS_PER_SECOND,
    damageBy,
  };
}

/** Which Enemy projectile (or splash) most likely dealt a hit, from the tick before it. */
function hitSource(run: RunView): ProjectileKind | 'blast' {
  const { rexi } = run;
  const near = run.projectiles.find(
    (p) =>
      p.owner === 'enemy' &&
      p.x < rexi.x + rexi.w + 12 &&
      p.x + p.w > rexi.x - 12 &&
      p.y < rexi.y + rexi.h + 12 &&
      p.y + p.h > rexi.y - 12,
  );
  return near?.kind ?? 'blast';
}

interface Plan {
  readonly move: -1 | 0 | 1;
  readonly jump: boolean;
}

const MOVES = [-1, 0, 1] as const;
const PLANS: readonly Plan[] = MOVES.flatMap((move) =>
  [false, true].map((jump) => ({ move, jump })),
);

/** How long the bot holds jump for a planned jump, ticks (a full jump). */
const JUMP_HOLD_TICKS = 14;
/** Extra margin around Rexi when testing a predicted shot against him, px. */
const DODGE_MARGIN = 6;
/** Prediction step, ticks. */
const STEP_TICKS = 2;

interface Bot {
  decide(view: GameView): InputFramePatch;
}

/**
 * A bot for one Run. `tuning` is the Run's resolved tuning: the bot knows the game's numbers
 * (run speed, jump, gravity, shot speeds) the way a practiced player does.
 */
export function createBot(profile: BotProfile, seed: number, tuning: Tuning): Bot {
  const rng: Rng = createRng((seed * 2654435761) ^ 0x5eed);
  const history: RunView[] = [];
  const noticed = new Map<number, boolean>();
  let plan: Plan = { move: 0, jump: false };
  let jumpHeld = 0;
  let sinceDecision = Infinity;
  let targetId: number | null = null;
  let aimOffset = { x: 0, y: 0 };
  let aimOffsetAge = Infinity;

  const perceived = (now: RunView): RunView => {
    history.push(now);
    if (history.length > profile.reactionTicks + 1) history.shift();
    return history[0] ?? now;
  };

  return {
    decide(view) {
      const run = view.run;
      if (!run || run.ended) return {};
      const seen = perceived(run);
      const lag = (run.tick - seen.tick) / TICKS_PER_SECOND;

      const threats = seen.projectiles.filter((p) => {
        if (p.owner !== 'enemy') return false;
        let isNoticed = noticed.get(p.id);
        if (isNoticed === undefined) {
          isNoticed = rng.chance(profile.awareness);
          noticed.set(p.id, isNoticed);
        }
        return isNoticed;
      });

      sinceDecision++;
      if (sinceDecision >= profile.decisionTicks) {
        sinceDecision = 0;
        plan = choosePlan(run, threats, lag, profile, tuning, plan);
        if (plan.jump && run.rexi.grounded) jumpHeld = JUMP_HOLD_TICKS;
      }
      const jump = jumpHeld > 0;
      if (jumpHeld > 0) jumpHeld--;

      // Aim: keep the target until another Enemy is clearly closer.
      const enemies = seen.enemies.filter((e) => e.x + e.w > 0 && e.x < run.arena.width);
      const shoulder = run.rexi.shoulder;
      const distance = (e: EnemyView) =>
        Math.hypot(e.x + e.w / 2 - shoulder.x, e.y + e.h / 2 - shoulder.y);
      const current = enemies.find((e) => e.id === targetId);
      const nearest = enemies.reduce<EnemyView | null>(
        (best, e) => (best === null || distance(e) < distance(best) ? e : best),
        null,
      );
      const banca = profile.focusesBanca
        ? enemies.find((e) => e.kind === 'banca-artillada')
        : undefined;
      const target =
        banca ??
        (current && (!nearest || distance(nearest) > 0.7 * distance(current)) ? current : nearest);
      targetId = target?.id ?? null;

      aimOffsetAge++;
      if (aimOffsetAge > TICKS_PER_SECOND / 2) {
        aimOffsetAge = 0;
        const angle = rng.range(0, 2 * Math.PI);
        const radius = rng.range(0, profile.aimError);
        aimOffset = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      }

      let aim = run.rexi.aim;
      let weaponSlot: number | null = null;
      if (target) {
        // Its velocity over the newest few ticks of the (lagged) picture.
        const span = Math.min(4, history.length - 1);
        const later = history[span]?.enemies.find((e) => e.id === target.id);
        const vx = later && span > 0 ? ((later.x - target.x) * TICKS_PER_SECOND) / span : 0;
        const vy = later && span > 0 ? ((later.y - target.y) * TICKS_PER_SECOND) / span : 0;
        const weapon = profile.switchesWeapons
          ? pickWeapon(run, target, distance(target))
          : run.rexi.weapon.id;
        const flight = distance(target) / shotSpeed(weapon, tuning);
        const point = {
          x: target.x + target.w / 2 + vx * (lag + profile.lead * flight) + aimOffset.x,
          y: target.y + target.h / 2 + vy * (lag + profile.lead * flight) + aimOffset.y,
        };
        aim =
          weapon === 'mancuernas'
            ? lobAim(run.rexi.muzzle, point, tuning.weapons.mancuernas)
            : point;
        if (weapon !== run.rexi.weapon.id) weaponSlot = WEAPON_IDS.indexOf(weapon) + 1;
      }

      return {
        move: plan.move,
        jump,
        aim,
        fire: target !== null,
        weaponSlot,
      };
    },
  };
}

/**
 * Where to point a lobbed Weapon so its low arc passes through `target`: the classic
 * launch-angle solution for speed `launchSpeed` under `gravity`. Out of reach, it aims 45°
 * up toward the target, the farthest throw.
 */
function lobAim(
  from: Vec2,
  target: Vec2,
  { launchSpeed: v, gravity: g }: { readonly launchSpeed: number; readonly gravity: number },
): Vec2 {
  const dx = target.x - from.x;
  const up = from.y - target.y;
  const reach = Math.abs(dx) || 1;
  const disc = v ** 4 - g * (g * reach * reach + 2 * up * v * v);
  const angle = disc < 0 ? Math.PI / 4 : Math.atan((v * v - Math.sqrt(disc)) / (g * reach));
  return {
    x: from.x + Math.sign(dx || 1) * Math.cos(angle) * 100,
    y: from.y - Math.sin(angle) * 100,
  };
}

/** Rough shot speed for leading, px/s (instant Weapons count as very fast). */
function shotSpeed(weapon: WeaponId, tuning: Tuning): number {
  const w = tuning.weapons[weapon];
  if ('projectileSpeed' in w) return w.projectileSpeed;
  if ('maxSpeed' in w) return (w.launchSpeed + w.maxSpeed) / 2;
  if ('launchSpeed' in w) return w.launchSpeed;
  return 1e6;
}

/** The Weapon a sensible player would hold against `target`. */
function pickWeapon(run: RunView, target: EnemyView, distance: number): WeaponId {
  const owned = new Set(run.rexi.inventory.map((w) => w.id));
  const first = (...ids: WeaponId[]) => ids.find((id) => owned.has(id)) ?? 'mazo-automatico';
  if (target.kind === 'banca-artillada' || target.kind === 'caminadora-a-reaccion') {
    return first('sentencia-firme', 'codigo-penal', 'citaciones-teledirigidas', 'mancuernas');
  }
  if (distance < 150 && owned.has('lluvia-de-sellos')) return 'lluvia-de-sellos';
  return first('citaciones-teledirigidas', 'mazo-automatico');
}

/** A threat's predicted motion: position at `t` seconds after the bot's (lagged) picture. */
interface Path {
  readonly at: (t: number) => { readonly x: number; readonly y: number };
  readonly w: number;
  readonly h: number;
  /** Extra clearance it needs, px (a drawer's blast reaches past its box). */
  readonly margin: number;
}

/**
 * How the bot expects each threat to move: straight on, except that drawers fall. (A Banca
 * Artillada's rocket turns only gently while it homes, so straight on is a fair guess; it
 * re-plans every few ticks anyway.)
 */
function predictPath(p: ProjectileView, tuning: Tuning): Path {
  const base = { w: p.w, h: p.h };
  if (p.kind === 'drawer') {
    const { drawerGravity, drawerBlastRadius } = tuning.enemies['archivador-artillado'];
    return {
      ...base,
      margin: DODGE_MARGIN + drawerBlastRadius / 2,
      at: (t) => ({ x: p.x + p.vx * t, y: p.y + p.vy * t + 0.5 * drawerGravity * t * t }),
    };
  }
  return { ...base, margin: DODGE_MARGIN, at: (t) => ({ x: p.x + p.vx * t, y: p.y + p.vy * t }) };
}

/**
 * Scores the six plans by simulating Rexi's rough kinematics (run speed, jump, gravity, the
 * floor he stands on) against every predicted threat; lowest wins. A threat that would hit
 * costs more the sooner it hits; reaching the goal, not jumping for nothing and not
 * flip-flopping break ties.
 */
function choosePlan(
  run: RunView,
  threats: readonly ProjectileView[],
  lag: number,
  profile: BotProfile,
  tuning: Tuning,
  previous: Plan,
): Plan {
  const goal = goalX(run);
  const { rexi } = run;
  const { runSpeed, jumpSpeed } = tuning.rexi;
  const { gravity, groundY } = tuning.arena;
  const paths = threats.map((p) => predictPath(p, tuning));
  const steps = Math.round((profile.horizon * TICKS_PER_SECOND) / STEP_TICKS);
  const dt = STEP_TICKS / TICKS_PER_SECOND;
  const floorY = rexi.grounded ? rexi.y : groundY - rexi.h;
  let best = previous;
  let bestCost = Infinity;
  for (const candidate of PLANS) {
    let cost = 0;
    let x = rexi.x;
    let y = rexi.y;
    let vy = candidate.jump && rexi.grounded ? -jumpSpeed : rexi.vy;
    const hit = new Set<Path>();
    for (let s = 1; s <= steps; s++) {
      x = Math.max(0, Math.min(run.arena.width - rexi.w, x + candidate.move * runSpeed * dt));
      vy += gravity * dt;
      y = Math.min(floorY, y + vy * dt);
      for (const path of paths) {
        if (hit.has(path)) continue;
        const at = path.at(s * dt + lag);
        const m = path.margin;
        if (
          at.x < x + rexi.w + m &&
          at.x + path.w > x - m &&
          at.y < y + rexi.h + m &&
          at.y + path.h > y - m
        ) {
          hit.add(path);
          cost += 10 + 10 * (1 - s / steps);
        }
      }
    }
    cost += Math.abs(x - goal) / run.arena.width;
    if (candidate.jump) cost += 0.15;
    if (candidate.move !== previous.move) cost += 0.05;
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  }
  return best;
}

/** Where the bot wants to be when nothing threatens it: a Crate, else clear of drop lines. */
function goalX(run: RunView): number {
  const { rexi } = run;
  const center = rexi.x + rexi.w / 2;
  const crate = run.crates.reduce<(typeof run.crates)[number] | null>(
    (best, c) => (best === null || Math.abs(c.x - center) < Math.abs(best.x - center) ? c : best),
    null,
  );
  if (crate) return crate.x + crate.w / 2 - rexi.w / 2;
  let goal = Math.max(80, Math.min(run.arena.width - 80, center));
  for (const e of run.enemies) {
    if (e.kind !== 'archivador-artillado') continue;
    const ex = e.x + e.w / 2;
    if (Math.abs(ex - goal) < 60) goal = ex < run.arena.width / 2 ? ex + 120 : ex - 120;
  }
  return goal - rexi.w / 2;
}
