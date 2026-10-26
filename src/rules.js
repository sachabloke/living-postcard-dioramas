// Learning + reward rules engine. Pure (no DOM, no three.js): clock and rng are injected so tests are exact.
// Rule source: Forest Maths constitution + Grok rules handover (20 Oct 2026). Items marked VERIFY come from the
// handover only and have not been checked against the old source by this build.
import { BANKS, topicsOf, makeQuestion, weightOf } from './questions.js';

export const REST_MS = 300_000;          // wrong harvest -> that one resource rests ~5 min (constitution rule 1)
export const GATE_COOLDOWN_MS = 60_000;  // VERIFY: handover gateWait default 60 s
export const TIERS = { easy: { mult: 1, level: 1 }, normal: { mult: 2, level: 2 }, hard: { mult: 4, level: 3 } };
export const WEAK = 0.60;                // parent decision D7: weak = estimate under 60%
export const MIN_N = 3;                  // fewer independent answers than this => "not enough data"
export const BASE_YIELD = { tree: ['wood', 1], rock: ['stone', 1], bush: ['berries', 2], stick: ['sticks', 1] }; // VERIFY (handover sec. 4)
// Hut stages (handover: Floor 4 wood | Walls 6 wood + 2 stone | Roof 6 wood | Door 3 wood | Campfire 3 wood + 3 stone) and recipes. VERIFY.
export const COSTS = {
  hut1: { wood: 4 }, hut2: { wood: 6, stone: 2 }, hut3: { wood: 6 }, hut4: { wood: 3 }, campfire: { wood: 3, stone: 3 },
  quickfire: { wood: 2, stone: 1 }, fence: { wood: 2 }, shelter: { wood: 6, sticks: 4 },   // PLACEHOLDER prototype costs for place-and-build items; the handover gives none
  axe: { wood: 3, stone: 2, sticks: 2 }, pickaxe: { wood: 3, stone: 3, sticks: 2 }, workbench: { wood: 6, stone: 2 }, spit: { sticks: 4, stone: 2 },
};
// prerequisites: stages in order; pickaxe/workbench need the axe; the spit needs the axe and a built campfire
export const REQUIRES = { hut2: ['hut1'], hut3: ['hut2'], hut4: ['hut3'], campfire: ['hut4'], pickaxe: ['axe'], workbench: ['axe'], spit: ['axe', 'campfire'] };
export const LABELS = { quickfire: 'Quick fire', fence: 'Fence piece', shelter: 'Quick shelter', hut1: 'Hut floor', hut2: 'Hut walls', hut3: 'Hut roof', hut4: 'Hut door', campfire: 'Campfire', axe: 'Stone axe', pickaxe: 'Stone pickaxe', workbench: 'Workbench', spit: 'Cooking spit' };

// ---------- Neolithic England: land-specific finds and crafts (free roaming; no quest, just what each land offers) ----------
/** Which kind of land a point is in, from terrain.regionAt's weights. 'home' = the hand-built clearing. */
export function landOf(rg) {
  if (!rg || !(rg.far > 0)) return 'home';
  const w = { downs: rg.downs || 0, marsh: rg.marsh || 0, high: (rg.hill || 0) + (rg.moor || 0) + (rg.mount || 0) + (rg.snow || 0), fields: (rg.blossom || 0) + (rg.gold || 0), coast: rg.sea || 0 };
  const [k, v] = Object.entries(w).sort((a, b) => b[1] - a[1])[0]; return v > 0.25 ? k : 'wood';
}
/** Each land adds ONE guaranteed local find on top of the normal yield (rule 12: random which, never whether). */
export const LOCAL = {
  wood: { tree: 'hazel', stick: 'bark', bush: 'nuts' }, downs: { rock: 'flint', bush: 'grain', stick: 'straw' },
  marsh: { rock: 'clay', bush: 'reed', stick: 'willow', tree: 'willow' }, high: { rock: 'hardstone' },
  fields: { bush: 'apples', stick: 'flax', tree: 'honey' }, coast: { rock: 'shell', bush: 'salt' },
};
export const localFor = (kind, land) => (LOCAL[land] || {})[kind] || null;
export const RES_LABEL = { fish: 'fish', wood: 'wood', stone: 'stone', berries: 'berries', sticks: 'sticks', resin: 'resin', flint: 'flint', hazel: 'hazel rods', bark: 'lime bark', nuts: 'hazelnuts', grain: 'emmer grain', straw: 'straw', clay: 'clay', reed: 'reed', willow: 'willow', hardstone: 'hard stone', apples: 'apples', flax: 'flax', honey: 'honey', shell: 'shell', salt: 'salt' };
export const RES_ICON = { hazel: '🌿', bark: '🪢', nuts: '🌰', grain: '🌾', straw: '🌾', clay: '🟤', reed: '🎋', willow: '🌿', hardstone: '⛰', apples: '🍎', flax: '🌸', honey: '🍯', shell: '🐚', salt: '🧂' };
/** Crafts: [id, label, cost, requires, repeatable, hint topic for [ks3, y56]] */
export const NEO = [
  ['flintblade', 'Flint blade', { flint: 2, sticks: 1 }, [], false, ['angles', 'perimeterArea']],
  ['digstick', 'Digging stick', { hazel: 2, flint: 1 }, [], false, ['sequences', 'multiply']],
  ['polaxe', 'Polished stone axe', { hardstone: 2, wood: 2, sticks: 1 }, ['axe'], false, ['angles', 'perimeterArea']],
  ['cord', 'Lime-bark cord (inferred)', { bark: 3 }, [], true, ['ratio', 'multiply']],
  ['wattle', 'Wattle panel', { hazel: 4, bark: 1 }, [], true, ['areaTriangle', 'perimeterArea']],
  ['daub', 'Wattle-and-daub wall (inferred)', { clay: 3, straw: 2, hazel: 3 }, ['hut2'], false, ['ratio', 'perimeterArea']],
  ['basket', 'Willow basket (inferred)', { willow: 4, reed: 2 }, [], true, ['sequences', 'multiply']],
  ['pot', 'Coil pot', { clay: 3, sticks: 2 }, ['campfire'], true, ['areaTriangle', 'volume']],
  ['porridge', 'Grain porridge (inferred)', { grain: 3, apples: 1 }, ['campfire'], true, ['ratio', 'fractionOfAmount']],
  ['linen', 'Linen cloth (inferred)', { flax: 4 }, [], true, ['meanMedian', 'units']],
];
export const NEO_IDS = NEO.map(c => c[0]), REPEAT = new Set(NEO.filter(c => c[4]).map(c => c[0]));
for (const [id, label, cost, req] of NEO) { COSTS[id] = cost; LABELS[id] = label; if (req.length) REQUIRES[id] = req; }
const HINT_OF = Object.fromEntries(NEO.map(c => [c[0], c[5]]));
const RES_HINT = { flint: ['angles', 'perimeterArea'], hazel: ['sequences', 'multiply'], bark: ['ratio', 'multiply'], nuts: ['fdp', 'fractionOfAmount'], grain: ['ratio', 'fractionOfAmount'], straw: ['ratio', 'divide'], clay: ['ratio', 'volume'], reed: ['meanMedian', 'units'], willow: ['sequences', 'multiply'], hardstone: ['angles', 'perimeterArea'], apples: ['fdp', 'fractionOfAmount'], flax: ['meanMedian', 'units'], honey: ['percentOf', 'roundDecimals'], shell: ['sequences', 'placeValue'], salt: ['ratio', 'fractionOfAmount'] };
/** the maths topic a craft or local find leans on, for this band (the question mixer still adapts to mastery) */
export const hintFor = (what, band) => { const h = HINT_OF[what] || RES_HINT[what]; return h ? h[band === 'ks3' ? 0 : 1] : null; };

export const HUT_STAGES = ['hut1', 'hut2', 'hut3', 'hut4', 'campfire'];
export const TOOL_MULT = { tree: ['axe', 2], rock: ['pickaxe', 2] };               // x2 with the stone tool
export const HARD_FIND_BONUS = 0.15;                                                // hard tier adds 15 percentage points to lucky-find rolls
export const MAX_LOG = 300;

export function newState(profile) {
  return { v: 1, profile: { id: profile.id, name: profile.name, band: profile.band, synthetic: !!profile.synthetic, year: profile.year || null },
    topicLevel: {}, place: profile.synthetic ? null : { n: 0, done: false },   // placement: first answers per topic find a starting level (real profiles only)
    inv: { wood: 0, stone: 0, berries: 0, sticks: 0, resin: 0, flint: 0 }, streak: 0, best: 0, asked: 0, right: 0, wrongRun: 0,
    rest: {}, nodes: {}, built: {}, placed: [], finds: 0, mastery: {}, learn: {}, avoidQ: null, gateCD: {}, crossed: false,
    log: [],        // one entry per answered question (evidence)
    explainers: [], // {ts, topic}
    settings: { dailyTarget: 10, chests: true, finds: true, quiet: false }, shield: { week: '', used: 0 }, chests: 0, today: { day: '', start: {} },
    play: { sec: 0, days: {} }, pos: null, area: 'clearing', serial: 0, sinceReview: 0 };
}

// ---------- mastery (handover sec. 2) ----------
export function masteryOf(state, topic, now = Date.now()) {
  const e = state.mastery[topic]; if (!e) return { m: 0.5, n: 0 };
  const days = Math.max(0, (now - e.t) / 86400000), pull = Math.min(0.6, 0.6 * (days / 21));
  return { m: Math.round((e.m + (0.5 - e.m) * pull) * 1000) / 1000, n: e.n };
}
function updateMastery(state, topic, ok, level, now) {
  const cur = masteryOf(state, topic, now), w = ok ? Math.min(1, 0.6 + 0.2 * level) : 0;
  const m = Math.min(1, Math.max(0, cur.m * 0.75 + w * 0.25));
  state.mastery[topic] = { m, n: cur.n + 1, t: now };
}
export const suggestTier = (m) => (m < 0.5 ? 'easy' : m <= 0.8 ? 'normal' : 'hard');

// ---------- topic choice (handover sec. 2) ----------
export function chooseTopic(state, rng, now = Date.now(), hint = null) {
  const band = state.profile.band, all = topicsOf(band);
  const due = Object.entries(state.learn).filter(([, l]) => l.dueIn !== undefined && l.dueIn <= 0).map(([t]) => t);
  if (due.length && rng() < 0.3) return due[0];
  if (hint && all.includes(hint) && rng() < 0.5) return hint;
  const weak = all.filter(t => { const x = masteryOf(state, t, now); return x.n > 0 && x.m < WEAK; });
  if (weak.length && rng() < 0.7) { const ws = weak.map(t => 1 - masteryOf(state, t, now).m); let r = rng() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < weak.length; i++) { r -= ws[i]; if (r <= 0) return weak[i]; } return weak[0]; }
  const ws = all.map(t => weightOf(band, t) * (1.6 - masteryOf(state, t, now).m)); let r = rng() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < all.length; i++) { r -= ws[i]; if (r <= 0) return all[i]; } return all[0];
}

// ---------- placement + per-topic level (family profiles) ----------
const clampL = (v) => Math.max(1, Math.min(3, v));
export const placementTarget = (band) => Math.ceil(topicsOf(band).length * 1.5);
const placementTopic = (state) => { const all = topicsOf(state.profile.band); return all[state.place.n % all.length]; };
function adaptLevel(state, topic, ok, independent) {
  const tl = (state.topicLevel ||= {}), cur = tl[topic] ?? 2;
  if (state.place && !state.place.done) {                       // placement: move straight away
    tl[topic] = clampL(cur + (ok ? (independent ? 1 : 0) : -1)); state.place.n++; if (state.place.n >= placementTarget(state.profile.band)) state.place.done = true; return;
  }
  if (!independent) return;
  const r = (state.learn[topic]?.r || []);
  if (ok && r.slice(-2).length === 2 && r.slice(-2).every(x => x === 1)) tl[topic] = clampL(cur + 1);
  else if (!ok && r.slice(-3).filter(x => x === 0).length >= 2) tl[topic] = clampL(cur - 1);
}

// ---------- session = one open question ----------
// ctx: {kind:'tree'|'rock'|'bush'|'build'|'gate', nodeId, tier, what, practice, topicHint}
export function startQuestion(state, ctx, rng, now = Date.now()) {
  const band = state.profile.band;
  if (!ctx.topicHint) { const h = hintFor(ctx.kind === 'build' ? ctx.what : localFor(ctx.kind, ctx.land), band); if (h) ctx = { ...ctx, topicHint: h }; }
  const placing = !!state.place && !state.place.done && !ctx.practice, topic = placing ? placementTopic(state) : (ctx.practice && ctx.topicHint ? ctx.topicHint : chooseTopic(state, rng, now, ctx.topicHint));
  const tier = ctx.tier || 'normal';
  const baseLevel = ctx.kind === 'build' || ctx.kind === 'gate' ? TIERS[suggestTier(masteryOf(state, topic, now).m)].level : TIERS[tier].level;
  const tl = state.topicLevel || {}, level = placing ? (tl[topic] ?? 2) : (topic in tl ? clampL(baseLevel + tl[topic] - 2) : baseLevel);
  let q = null;
  for (let i = 0; i < 8; i++) { q = makeQuestion(band, topic, level, rng, ++state.serial); if (q.id !== state.avoidQ) break; }
  return { q, ctx: { ...ctx, tier }, startedAt: now, activeMs: 0, hintUsed: false, jotterUsed: false, done: false };
}
// Active timing: caller reports intervals that count (visible, not paused, not in explainer).
export const addActive = (s, ms) => { if (!s.done) s.activeMs += Math.max(0, Math.min(ms, 60_000)); };
export function useHint(s) { s.hintUsed = true; return s.q.hint; }
export function useJotter(s) { s.jotterUsed = true; }

export function yieldFor(kind, tier, streak, toolMult = 1) {
  const [res, base] = BASE_YIELD[kind]; const t = TIERS[tier].mult;
  let n = base * t + (streak >= 3 ? 1 : 0); n *= toolMult; return { res, n };
}


// ---------- education layer (constitution rules 11-15): pips, titles, chest, shields, daily target, session summary ----------
export const SHIELDS_PER_WEEK = 2, CHEST_EVERY = 5;
export const PIP_TITLES = ['New', 'Seedling', 'Tracker', 'Ranger', 'Pathfinder', 'Master'];
export const pipsOf = (state, topic, now = Date.now()) => { const m = masteryOf(state, topic, now); return m.n < MIN_N ? 0 : Math.min(5, Math.floor(m.m * 5.0001)); };
export const titleOf = (pips) => PIP_TITLES[Math.max(0, Math.min(5, pips))];
export const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
export const weekKey = (now) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const settingsOf = (state) => (state.settings ||= { dailyTarget: 10, chests: true, finds: true, quiet: false });
export function shieldsLeft(state, now = Date.now()) { const sh = (state.shield ||= { week: '', used: 0 }); return sh.week === weekKey(now) ? Math.max(0, SHIELDS_PER_WEEK - sh.used) : SHIELDS_PER_WEEK; }
function useShield(state, now) {
  const st = settingsOf(state); if (st.quiet) return true;               // quiet week / holiday freeze: the streak never breaks
  const sh = (state.shield ||= { week: '', used: 0 }); if (sh.week !== weekKey(now)) { sh.week = weekKey(now); sh.used = 0; }
  if (sh.used >= SHIELDS_PER_WEEK) return false; sh.used++; return true;
}
// remember each topic's pips at the start of the day so the summary can say what went up
function rollDay(state, now) {
  const t = (state.today ||= { day: '', start: {} }), d = dayKey(now);
  if (t.day !== d) { t.day = d; t.start = {}; for (const k of Object.keys(state.mastery)) t.start[k] = pipsOf(state, k, now); }
}
export function todayProgress(state, now = Date.now()) {
  const d = dayKey(now), e = state.log.filter(x => !x.practice && dayKey(x.ts) === d), target = settingsOf(state).dailyTarget;
  return { answered: e.length, right: e.filter(x => x.ok).length, target, met: !settingsOf(state).quiet && target > 0 && e.length >= target };
}
export function summaryOf(state, now = Date.now()) {
  rollDay(state, now);
  const d = dayKey(now), e = state.log.filter(x => !x.practice && dayKey(x.ts) === d), by = {};
  for (const x of e) { const t = (by[x.topic] ||= { topic: x.topic, n: 0, right: 0 }); t.n++; if (x.ok) t.right++; }
  const topics = Object.values(by).map(t => ({ ...t, pips: pipsOf(state, t.topic, now), was: state.today.start[t.topic] ?? 0 }));
  const up = topics.filter(t => t.pips > t.was), best = [...topics].filter(t => t.n >= 2).sort((a, b) => b.right / b.n - a.right / a.n || b.n - a.n)[0] || null;
  const weak = Object.keys(state.mastery).map(k => ({ k, m: masteryOf(state, k, now).m })).sort((a, b) => a.m - b.m)[0];
  const prog = todayProgress(state, now), left = Math.max(0, prog.target - prog.answered);
  const goal = !e.length ? 'Answer a few questions tomorrow and collect your first pip.' : weak && weak.m < WEAK ? `Next small goal: one more pip in ${weak.k}.` : left > 0 && !settingsOf(state).quiet ? `Next small goal: ${left} more question${left === 1 ? '' : 's'} to reach today's target.` : 'Next small goal: try a harder swing on a topic you know well.';
  return { answered: e.length, right: e.filter(x => x.ok).length, minutes: Math.round(((state.play.days || {})[d] || 0) / 6) / 10, topics, up, best, streak: state.streak, bestStreak: state.best, chests: state.chests || 0, goal, target: prog };
}
export function rulesInWords(state) {
  const st = settingsOf(state);
  return ['A right answer always earns what you gathered. A wrong answer never takes anything. It just needs a short rest and shows you how.',
    `Every ${CHEST_EVERY} right answers in a row opens a chest${st.chests ? '' : ' (your parent has switched chests off for now)'}.`,
    `Your streak has ${SHIELDS_PER_WEEK} free shields every week, so one slip does not end it.`,
    'Pips show how well you know each topic. They go up with good, independent answers and never reset.',
    'Harder swings pay more, and you choose them yourself.', 'Nothing is timed, bought or ranked against anyone.'];
}

export function submitAnswer(state, s, choiceIndex, now = Date.now(), opts = {}) {
  if (s.done) throw new Error('question already answered');
  s.done = true;
  const { q, ctx } = s, ok = choiceIndex === q.correctIndex, sec = Math.min(300, Math.round(s.activeMs / 100) / 10);
  const independent = !s.hintUsed;                       // evidence rule (D5, decided here): first attempt, no maths hint
  const rec = { ts: now, topic: q.topic, level: q.level, strand: q.strand, ok, sec, tier: ctx.tier, kind: ctx.kind,
    practice: !!ctx.practice, helped: !independent, hint: s.hintUsed, jotter: s.jotterUsed, firstTry: true, q: q.q.slice(0, 90),
    ...(ok ? {} : { a: q.answer, c: q.choices[choiceIndex] }), area: state.area, test: !!opts.test || state.profile.synthetic };
  rollDay(state, now);
  const out = { ok, evidence: rec, worked: q.worked, answer: q.answer, gained: null, spent: null, rested: false, message: '' };
  if (ctx.practice) { state.log.push(rec); trim(state); out.message = ok ? 'Good practice. Nothing earned or lost.' : 'Practice only. Nothing changes.'; return out; }
  state.asked++; state.sinceReview++;
  state.log.push(rec); trim(state);
  if (independent) updateMastery(state, q.topic, ok, q.level, now);   // helped answers never move mastery
  const L = (state.learn[q.topic] ||= { r: [], dueIn: undefined, iv: 3 });
  L.r = [...L.r, ok ? 1 : 0].slice(-8);
  if (!state.profile.synthetic || state.place) adaptLevel(state, q.topic, ok, independent);
  if (!ok) { L.dueIn = 3; L.iv = 3; } else if (L.dueIn !== undefined) { L.iv *= 2; L.dueIn = L.iv > 24 ? undefined : L.iv; }
  for (const l of Object.values(state.learn)) if (l.dueIn !== undefined && l !== L) l.dueIn--;
  if (ok) {
    state.right++; state.streak++; state.best = Math.max(state.best, state.streak); state.wrongRun = 0;
    if (BASE_YIELD[ctx.kind]) {
      const tm = TOOL_MULT[ctx.kind], mult = ctx.kind === 'tree' && state.built.polaxe ? 3 : tm && state.built[tm[0]] ? tm[1] : 1;
      const y = yieldFor(ctx.kind, ctx.tier, state.streak - 1, mult);
      state.inv[y.res] = (state.inv[y.res] || 0) + y.n; out.gained = y; out.message = `+${y.n} ${y.res}`;
      const lres = localFor(ctx.kind, ctx.land); if (lres) { const ln = ctx.tier === 'hard' ? 2 : 1; state.inv[lres] = (state.inv[lres] || 0) + ln; (state.seen ||= {})[lres] = 1; out.local = { res: lres, n: ln }; out.message += `, ${ln} ${RES_LABEL[lres]}`; }
      // lucky finds come ON TOP of the guaranteed yield and are never the only route to anything (rule 12)
      const r = opts.rng || Math.random, hb = ctx.tier === 'hard' ? HARD_FIND_BONUS : 0, finds = [], luck = settingsOf(state).finds;
      if (luck && ctx.kind === 'tree' && state.built.axe && r() < 0.4 + hb) finds.push(['resin', 1]);
      if (luck && ctx.kind === 'rock' && state.built.pickaxe && r() < 0.6 + hb) finds.push(['flint', 1]);
      for (const [res, n] of finds) { state.inv[res] = (state.inv[res] || 0) + n; state.finds++; out.message += `, lucky find: +${n} ${res}`; }
      out.finds = finds;
      const nd = (state.nodes[ctx.nodeId] ||= { hits: 0 }); nd.hits++;
      if (settingsOf(state).chests && !ctx.practice && state.streak % CHEST_EVERY === 0) { const pick = [['wood', 2], ['stone', 2], ['berries', 3], ['sticks', 2]][Math.floor((opts.rng || Math.random)() * 4)]; state.inv[pick[0]] += pick[1]; state.chests = (state.chests || 0) + 1; out.chest = { res: pick[0], n: pick[1] }; out.message += `, chest! +${pick[1]} ${pick[0]}`; }
    } else if (ctx.kind === 'build') {
      const cost = COSTS[ctx.what]; for (const [k, v] of Object.entries(cost)) state.inv[k] -= v;
      state.built[ctx.what] = ctx.where || true; out.spent = cost; out.message = `${LABELS[ctx.what] || ctx.what} built`;
      if (NEO_IDS.includes(ctx.what)) { (state.made ||= {})[ctx.what] = (state.made[ctx.what] || 0) + 1; out.message = `${LABELS[ctx.what]} made`; if (REPEAT.has(ctx.what)) delete state.built[ctx.what]; }
      if (HUT_STAGES.includes(ctx.what) && ctx.what !== 'campfire') { state.inv.wood += 1; out.message += ' (+1 wood bonus)'; }   // handover: correct hut-stage build also gives +1 wood
    } else if (ctx.kind === 'place') {                                       // place-and-build: cost is spent ONLY now (confirmed, valid, correct); cancelled/invalid/wrong spend nothing
      const cost = COSTS[ctx.what]; for (const [k, v] of Object.entries(cost)) state.inv[k] -= v; (state.placed ||= []).push({ what: ctx.what, ...ctx.where, ts: now }); out.spent = cost; out.message = `${LABELS[ctx.what]} placed`;
    } else if (ctx.kind === 'gate') { state.crossed = true; out.message = 'Optional challenge done: a bonus find!'; }
    else if (ctx.kind === 'forage') { out.message = 'Well done! You may gather it carefully.'; }   // the foraging module gives the yield (src/foraging.js)
    else if (ctx.kind === 'fish') { state.inv.fish = (state.inv.fish || 0) + 1; out.message = 'You caught a fish! (+1 fish)'; }   // first-adventure fishing: one fish per correct answer, nothing else changes
  } else {
    if (state.streak > 0 && useShield(state, now)) out.shielded = true; else state.streak = 0;
    state.wrongRun++; state.avoidQ = q.id;
    if (BASE_YIELD[ctx.kind] || ctx.kind === 'fish' || ctx.kind === 'forage') { state.rest[ctx.nodeId] = now + REST_MS; out.rested = true; out.message = ctx.kind === 'forage' ? 'Nothing was picked. This plant needs about 5 minutes. Try another!' : ctx.kind === 'fish' ? 'The fish slipped away. This spot needs about 5 minutes. Try another!' : 'That one needs a rest for about 5 minutes. Try another!'; }
    else if (ctx.kind === 'gate') { state.gateCD[ctx.nodeId || 'gate'] = now + GATE_COOLDOWN_MS; out.message = 'Come back later. Nothing is lost.'; }
    else out.message = 'Your materials are safe. Have a look at how it works.';
    if (out.shielded) out.message += ' A free shield kept your streak.';
  }
  return out;
}
const trim = (st) => { if (st.log.length > MAX_LOG) st.log.splice(0, st.log.length - MAX_LOG); };
export function noteExplainer(state, s, now = Date.now()) { state.explainers.push({ ts: now, topic: s.q.topic }); if (state.explainers.length > 60) state.explainers.shift(); }

export const isResting = (state, id, now = Date.now()) => (state.rest[id] || 0) > now;
export const restLeftMs = (state, id, now = Date.now()) => Math.max(0, (state.rest[id] || 0) - now);
export const gateReady = (state, id, now = Date.now()) => (state.gateCD[id] || 0) <= now;
export function canAfford(state, what) { return Object.entries(COSTS[what]).every(([k, v]) => (state.inv[k] || 0) >= v); }
export function missingRequirements(state, what) { return (REQUIRES[what] || []).filter(r => !state.built[r]); }
/** {ok, reason}: already built / prerequisites / materials. Free (parent) mode bypasses this entirely. */
export function canBuild(state, what) {
  if (state.built[what]) return { ok: false, reason: 'already built' };
  const miss = missingRequirements(state, what); if (miss.length) return { ok: false, reason: 'needs ' + miss.map(m => LABELS[m]).join(' + ') + ' first' };
  if (!canAfford(state, what)) return { ok: false, reason: 'missing ' + Object.entries(shortfall(state, what)).map(([k, v]) => `${v} ${k}`).join(', ') };
  return { ok: true, reason: '' };
}
export function shortfall(state, what) { return Object.fromEntries(Object.entries(COSTS[what]).map(([k, v]) => [k, Math.max(0, v - (state.inv[k] || 0))]).filter(([, v]) => v > 0)); }

// Parent-only build (Daddy mode): no question, no cost; the caller still runs the real placement + animation.
export function parentFreeBuild(state, what, where) { state.built[what] = where || true; return { free: true, what }; }

// ---------- parent report ----------
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function report(state, now = Date.now()) {
  const learn = state.log.filter(e => !e.practice), per = {};
  for (const e of learn) {
    const t = (per[e.topic] ||= { topic: e.topic, strand: e.strand, indep: { n: 0, right: 0 }, helped: { n: 0, right: 0 }, secs: [], hesitations: 0, jotter: 0 });
    const bucket = e.helped ? t.helped : t.indep; bucket.n++; if (e.ok) bucket.right++;
    if (!e.helped) t.secs.push(e.sec); if (e.jotter) t.jotter++;
  }
  const topics = Object.values(per).map(t => {
    const med = median(t.secs), m = masteryOf(state, t.topic, now);
    t.hesitations = learn.filter(e => e.topic === t.topic && !e.helped && (e.sec >= Math.max(25, 2 * (med || 0)) || (!e.ok && e.sec >= 15))).length;
    const enough = t.indep.n >= MIN_N;
    const pips = pipsOf(state, t.topic, now);
    return { ...t, pips, title: titleOf(pips), level: (state.topicLevel || {})[t.topic] ?? null, medianSec: med, estimate: Math.round(m.m * 100), estimateIsModelled: true, indepAccuracy: enough ? Math.round(100 * t.indep.right / t.indep.n) : null,
      status: !enough ? 'not enough data' : (m.m < WEAK ? 'needs practice' : 'secure'), verdict: !enough ? 'not enough data' :
        (t.indep.right / t.indep.n >= 0.9 && med < 12) ? 'too easy' : (t.indep.right / t.indep.n < 0.55 || med > 45) ? 'struggling' : 'about right' };
  }).sort((a, b) => a.topic.localeCompare(b.topic));
  const dayMap = {}; for (const e of learn) { const d = (dayMap[dayKey(e.ts)] ||= { day: dayKey(e.ts), n: 0, right: 0, secs: [] }); d.n++; if (e.ok) d.right++; if (!e.helped) d.secs.push(e.sec); }
  const trend = Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day)).slice(-14).map(d => ({ day: d.day, answered: d.n, accuracy: Math.round(100 * d.right / d.n), medianSec: median(d.secs) }));
  const wrongs = learn.filter(e => !e.ok).slice(-10).map(({ topic, q, a, c, ts }) => ({ topic, q, correct: a, chosen: c, ts }));
  const test = state.profile.synthetic;
  return { profile: { name: state.profile.name, band: state.profile.band, year: state.profile.year || null, synthetic: test }, generatedAt: now,
    totals: { answered: learn.length, independent: learn.filter(e => !e.helped).length, helped: learn.filter(e => e.helped).length,
      practice: state.log.length - learn.length, explainers: state.explainers.length, coldCollapses: (state.events || []).filter(e => e.type === 'cold_collapse').length, bestStreak: state.best, playMinutes: Math.round(state.play.sec / 6) / 10 },
    topics, trend, today: todayProgress(state, now), settings: { ...settingsOf(state) }, shieldsLeft: shieldsLeft(state, now), chests: state.chests || 0, recentMistakes: wrongs, needsPractice: topics.filter(t => t.status === 'needs practice').map(t => t.topic),
    placement: state.place ? { done: state.place.done, answered: state.place.n, target: placementTarget(state.profile.band) } : null,
    note: 'Mastery is a modelled estimate, not observed accuracy. Helped answers (hint used) are counted separately and do not move mastery. Question timing counts active time only.',
    nextStep: topics.find(t => t.status === 'needs practice')?.topic ? `Practise ${topics.find(t => t.status === 'needs practice').topic}` : 'Keep exploring; no weak topic yet.' };
}
export { topicsOf };

/** CSV of every answered question (parent export). Columns are plain text; quotes doubled. */
export function exportCSV(state) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`, head = ['when', 'topic', 'level', 'strand', 'result', 'helped', 'hint_used', 'seconds', 'question', 'correct_answer', 'chosen_answer', 'practice'];
  const rows = state.log.map(e => [new Date(e.ts).toISOString(), e.topic, e.level, e.strand, e.ok ? 'right' : 'wrong', e.helped ? 'yes' : 'no', e.hint ? 'yes' : 'no', e.sec, e.q, e.ok ? '' : e.a, e.ok ? '' : e.c, e.practice ? 'yes' : 'no'].map(q).join(','));
  return [head.join(','), ...rows].join('\n');
}
