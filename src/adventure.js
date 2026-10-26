// The first woodland adventure for an empty-start world (state.start === 'empty'). Pure logic, no three.js.
// It is a checklist the player can ignore or do in any order: find the river, gather for a shelter, build it in a clearing of their choice, cast a line, walk home.
// Nothing here grants resources or skill xp: gathering, building and fishing all still go through the normal maths question.
import { depthAt, BRIDGE } from './terrain.js';
export const STEPS = [
  { id: 'water', text: 'Find the river' },
  { id: 'gather', text: 'Gather wood and sticks for a shelter' },
  { id: 'home', text: 'Choose a clearing and build a Quick shelter' },
  { id: 'fish', text: 'Cast a line at the river and catch a fish' },
  { id: 'return', text: 'Walk home' },
];
export const newAdv = () => ({ v: 1, water: false, done: false, doneAt: null, fish: 0 });
/** The first shelter the player placed, or null. */
export const homeOf = (state) => { const p = (state.placed || []).find(x => x.what === 'shelter'); return p ? { x: p.x, z: p.z } : null; };
/** True when the player stands on dry ground with deep-ish water within r metres. */
export function nearWater(x, z, r = 3.5) {
  if (depthAt(x, z) > 0.05) return false;
  for (let a = 0; a < 6.283; a += 0.5) for (const d of [1.2, 2.4, r]) if (depthAt(x + Math.cos(a) * d, z + Math.sin(a) * d) > 0.25) return true;
  return false;
}
/** A shore point (dry, with deep water just beyond) reachable by walking from (sx,sz), nearest first, not within 14 m of the bridge so the first view is of natural water. */
export function findWaterTarget(sx, sz) {
  let best = null;
  for (let a = 0; a < 6.283; a += 0.2) for (let d = 3; d < 70; d += 1) {
    const x = sx + Math.cos(a) * d, z = sz + Math.sin(a) * d;
    if (depthAt(x, z) > 0.3) { const bx = sx + Math.cos(a) * (d - 1.5), bz = sz + Math.sin(a) * (d - 1.5); if (depthAt(bx, bz) > 0.05 || Math.hypot(bx - BRIDGE.x, bz - BRIDGE.z) < 14) break; if (!best || d < best.d) best = { x: bx, z: bz, d, wx: x, wz: z }; break; }
  }
  return best;
}
/** The checklist with done flags, from what has actually happened (inventory, placed things, caught fish, journal flags). */
export function checklist(state) {
  const a = state.adv || newAdv(), inv = state.inv || {}, home = homeOf(state);
  const done = { water: !!a.water, gather: !!home || ((inv.wood || 0) >= 6 && (inv.sticks || 0) >= 4), home: !!home, fish: (a.fish || 0) > 0, return: !!a.done };
  return STEPS.map(s => ({ ...s, done: done[s.id] }));
}
/** What to point at next: 'water', 'home', or null (nothing to point at: explore, gather). */
export function target(state) {
  const l = checklist(state), a = state.adv || newAdv(), home = homeOf(state);
  if (a.done) return null;
  if (!a.water) return 'water';
  if (home && (a.fish || 0) > 0) return 'home';
  if (home && !((a.fish || 0) > 0)) return 'water';
  if (!l[1].done) return null;
  return null;
}
/** Short hint for the pill. */
export function hint(state) {
  const l = checklist(state), next = l.find(s => !s.done); if (!next) return 'All done. Explore as you like.';
  return next.text;
}
/** Everything the completion card may say, drawn only from the real state. */
export function summary(state) {
  const log = (state.log || []).filter(e => e.ok && !e.practice), by = (k) => log.filter(e => e.kind === k).length, a = state.adv || newAdv();
  return { trees: by('tree'), rocks: by('rock'), sticks: by('stick'), berries: by('bush'), fish: a.fish || 0, shelter: !!homeOf(state), correct: log.length };
}
/** Once a shelter and a fish exist, note that the player has actually been away from home (more than 10 m), so "walked home" is only ever said after a real walk back. */
export function noteAway(state, px, pz) { const a = state.adv, h = homeOf(state); if (a && h && (a.fish || 0) > 0 && !a.away && Math.hypot(px - h.x, pz - h.z) > 10) { a.away = true; return true; } return false; }
/** Complete when a shelter and a fish exist, the player has been away, and is back within 7 m of home. */
export function shouldComplete(state, px, pz) {
  const a = state.adv; if (!a || a.done || !a.away) return false; const h = homeOf(state); return !!h && (a.fish || 0) > 0 && Math.hypot(px - h.x, pz - h.z) < 7;
}
