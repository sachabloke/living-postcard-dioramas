// Guided survival path for the empty-start forest (state.start === 'empty'). Pure logic, no three.js.
// The child is dropped in the middle of the woods and walked through the order a real survivor works in: look around, water, materials, shelter, warmth, food, a tool, home.
// How much help they get depends on age and on how their own answers are going (support level), never on a timer or a penalty. Nothing here grants resources or skill xp, and
// nothing is lost: every gather and build still goes through the normal maths question. Steps are sticky once seen, so trimming the answer log can never undo progress.
import { COSTS, LABELS } from './rules.js';

export const LEVELS = ['guided', 'steady', 'free'];
export const LEVEL_NAME = { guided: 'Guided: every step explained, a beam and arrow to the next thing', steady: 'Steady: short hints, an arrow to the next thing', free: 'Free: just the goal, find your own way' };
const WINDOW = 12, MIN_FOR_MOVE = 8;

/** Starting support from age (year group, else the band); then one step up or down from the last answers. 'guided' is the floor, nobody is left without help they ask for. */
export function baseLevel(profile = {}) {
  const y = profile.year; if (y) return y <= 5 ? 0 : y <= 7 ? 1 : 2;
  return profile.band === 'y56' ? 0 : 1;
}
export function recentAccuracy(state) {
  const l = (state.log || []).filter(e => !e.practice && !e.helped).slice(-WINDOW);
  return { n: l.length, acc: l.length ? l.filter(e => e.ok).length / l.length : null };
}
export function levelOf(state) {
  const g = state.guide || {}; if (g.force != null && LEVELS.includes(g.force)) return g.force;
  let i = baseLevel(state.profile), { n, acc } = recentAccuracy(state);
  if (n >= MIN_FOR_MOVE) { if (acc >= 0.85) i += 1; else if (acc < 0.5) i -= 1; }
  return LEVELS[Math.max(0, Math.min(2, i))];
}

const count = (state, kind) => (state.log || []).filter(e => e.ok && !e.practice && e.kind === kind).length;
const placed = (state, what) => (state.placed || []).some(p => p.what === what);
const forage = (state) => state.forage || {};

/** Each step: what it says at each support level, what to point at, and how to tell it is done. `need` names the thing to build so missing materials can redirect the pointer. */
export const STEPS = [
  { id: 'look', chapter: 'Arrive', target: null, done: (s) => !!(s.guide && s.guide.walked),
    say: { guided: 'You are in the middle of the forest. Walk around a little: W A S D, or the stick. Look at the trees, the stones and the river.', steady: 'Walk around and look at what is nearby.', free: 'Look around.' },
    why: 'First, stay calm and look. Water, warmth, food and shelter are what matter, in that order.' },
  { id: 'water', chapter: 'Water', target: 'water', done: (s) => !!(s.adv && s.adv.water),
    say: { guided: 'Find the river. Follow the beam and the arrow. A camp near fresh water is a good camp.', steady: 'Find the river.', free: 'Find water.' },
    why: 'People need water more than food, so a camp is never far from it.' },
  { id: 'wood', chapter: 'Materials', target: 'tree', done: (s) => count(s, 'tree') > 0,
    say: { guided: 'Walk up to a tree and press E (or Act). Answer the question, and your swing gathers wood.', steady: 'Gather wood from a tree.', free: 'Gather wood.' },
    why: 'Wood makes shelters, fires and tools.' },
  { id: 'stone', chapter: 'Materials', target: 'rock', done: (s) => count(s, 'rock') > 0,
    say: { guided: 'Find a grey rock and press E to gather stone. Stone makes tools that last.', steady: 'Gather stone from a rock.', free: 'Gather stone.' },
    why: 'Stone is hard, so it makes the first tools.' },
  { id: 'sticks', chapter: 'Materials', target: 'stick', done: (s) => count(s, 'stick') > 0,
    say: { guided: 'Pick up a fallen branch for sticks. They bind and hold a shelter together.', steady: 'Pick up sticks from fallen branches.', free: 'Collect sticks.' },
    why: 'Fallen sticks are dry and easy to carry.' },
  { id: 'shelter', chapter: 'Shelter', target: 'home', need: 'shelter', done: (s) => placed(s, 'shelter'),
    say: { guided: 'Stand in an open space away from trees and rocks, press E (Act) to open the build menu, pick Quick shelter, and place it where you like.', steady: 'Build a Quick shelter in a clearing you choose.', free: 'Build a shelter.' },
    why: 'A shelter keeps wind and rain off. Choose flat ground away from the river bank.' },
  { id: 'fire', chapter: 'Warmth', target: 'home', need: 'quickfire', done: (s) => placed(s, 'quickfire') || (s.fires || []).length > 0,
    say: { guided: 'Press E (Act) in the open to build a Quick fire next to your shelter. Fire is for light, warmth and cooking.', steady: 'Build a Quick fire near the shelter.', free: 'Make a fire.' },
    why: 'A fire is for warmth and cooking. In the game we only build it where it is safe and clear.' },
  { id: 'berries', chapter: 'Food', target: 'bush', done: (s) => count(s, 'bush') > 0,
    say: { guided: 'Find a berry bush and gather from it.', steady: 'Gather berries from a bush.', free: 'Find food.' },
    why: 'Berries in the game are stylised. Real wild food always needs a grown-up who knows the plants.' },
  { id: 'fish', chapter: 'Food', target: 'water', done: (s) => !!(s.adv && (s.adv.fish || 0) > 0),
    say: { guided: 'Walk to the river bank and press E to cast your line. Answer the question and the fish bites.', steady: 'Cast a line at the river and catch a fish.', free: 'Catch a fish.' },
    why: 'Fish is good food, and the river is where it lives.' },
  { id: 'axe', chapter: 'Tools', target: 'home', need: 'axe', done: (s) => !!(s.built && s.built.axe),
    say: { guided: 'Press E (Act) in the open to craft a Stone axe. With it every tree gives double wood.', steady: 'Craft a Stone axe.', free: 'Make an axe.' },
    why: 'A good tool saves effort.' },
  { id: 'pickaxe', chapter: 'Tools', target: 'home', need: 'pickaxe', ks3: true, done: (s) => !!(s.built && s.built.pickaxe),
    say: { guided: 'Press E (Act) in the open to craft a Stone pickaxe for rocks.', steady: 'Craft a Stone pickaxe.', free: 'Craft a pickaxe.' },
    why: 'Each tool has one job.' },
  { id: 'know', chapter: 'Plants', target: 'plant', forage: true, done: (s) => Object.keys(forage(s).ident || {}).length > 0,
    say: { guided: 'Look for a plant near the woods and press E. Read its clues, then say which plant it is.', steady: 'Identify a plant from its clues.', free: 'Identify a plant.' },
    why: 'Knowing a plant means checking its clues, not guessing.' },
  { id: 'cook', chapter: 'Cooking', target: 'home', forage: true, done: (s) => Object.keys(forage(s).made || {}).length > 0,
    say: { guided: 'Make something simple at your fire from what you gathered.', steady: 'Cook something from what you gathered.', free: 'Cook a meal.' },
    why: 'Cooked food is warm and tastes better.' },
  { id: 'home', chapter: 'Home', target: 'home', done: (s) => !!(s.adv && s.adv.done),
    say: { guided: 'Walk away from camp for a bit, then walk back home to finish.', steady: 'Explore a little, then walk home.', free: 'Walk home.' },
    why: 'Knowing your way back is part of staying safe.' },
];

/** Steps that apply to this player: KS3-only extras and the foraging steps are dropped when they do not apply. */
export function stepsFor(state, ctx = {}) {
  const ks3 = (state.profile || {}).band === 'ks3';
  return STEPS.filter(s => (!s.ks3 || ks3) && (!s.forage || ctx.forage));
}
export function checklist(state, ctx = {}) {
  const g = (state.guide ||= { v: 1, done: {} }); g.done ||= {};
  return stepsFor(state, ctx).map(s => { if (!g.done[s.id] && s.done(state)) g.done[s.id] = true; return { ...s, isDone: !!g.done[s.id] }; });
}
export const progress = (state, ctx) => { const l = checklist(state, ctx); return { done: l.filter(s => s.isDone).length, total: l.length }; };

/** Materials still missing for what a build step needs, as { res: n }. Empty when nothing is needed or the player already has it. */
export function missingFor(state, what) { if (!what || !COSTS[what]) return {}; return Object.fromEntries(Object.entries(COSTS[what]).map(([k, v]) => [k, Math.max(0, v - ((state.inv || {})[k] || 0))]).filter(([, n]) => n > 0)); }
const GATHER = { wood: 'tree', stone: 'rock', sticks: 'stick', berries: 'bush' };

/** What to do next: the first unfinished step, with its text for this support level, and what to point at. A build step short of materials points at the missing material instead. */
export function next(state, ctx = {}) {
  const l = checklist(state, ctx), step = l.find(s => !s.isDone); const level = levelOf(state);
  if (!step) return { done: true, level, text: 'You have done everything on the list. Explore as you like.', target: null, why: '', step: null, total: l.length, index: l.length };
  let target = step.target, text = step.say[level], note = '';
  const miss = step.need ? missingFor(state, step.need) : {}, short = Object.keys(miss);
  if (short.length) {
    const r = short.find(k => GATHER[k]); target = r ? GATHER[r] : target;
    note = `${LABELS[step.need]} needs ${Object.entries(COSTS[step.need]).map(([k, v]) => `${v} ${k}`).join(', ')}. Still missing: ${short.map(k => `${miss[k]} ${k}`).join(', ')}.`;
    if (level !== 'free') text = `${text} (${note})`;
  }
  if (step.target === 'home' && !short.length && !homeKnown(state)) target = null;
  return { done: false, level, text, target, why: level === 'guided' ? step.why : '', note, step, total: l.length, index: l.indexOf(step) };
}
export const homeKnown = (state) => (state.placed || []).some(p => p.what === 'shelter');

/** How much pointing this level gets: guided = beam + arrow, steady = arrow, free = none (the journal still lists the goals). */
export const pointing = (level) => ({ beam: level === 'guided', arrow: level !== 'free' });

/** Nearest node of a kind (not depleted) to (x,z), from a list of world nodes; null if none. `isDepleted(node)` is supplied by the caller. */
export function nearestNode(nodes, kind, x, z, isDepleted = () => false) {
  let best = null, bd = Infinity;
  for (const n of nodes) { if (n.node !== kind && n.kind !== kind) continue; if (isDepleted(n)) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } }
  return best ? { x: best.x, z: best.z, d: bd, node: best } : null;
}

/** Marks the first real walk away from the arrival point (counts once the player has moved 12 m). Returns true the moment it flips. */
export function noteWalk(state, px, pz) {
  const g = (state.guide ||= { v: 1, done: {} }); if (g.walked) return false;
  if (!g.start) { g.start = { x: px, z: pz }; return false; }
  if (Math.hypot(px - g.start.x, pz - g.start.z) > 12) { g.walked = true; return true; }
  return false;
}
