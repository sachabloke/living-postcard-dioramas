// Which props can be hopped on or over. Colliders carry an optional height `h`; without one (trees, walls, fences, the well, dock posts) they stay solid.
import { GROK } from './grok_props.js';
import { HOP_MAX } from './movement.js';
const FIXED = { stump: 0.45, bench: 0.5, log: 0.65 };   // metres, from the hand-placed models in world.js (Cut_Stump, Log_Bench, Hollow_Log)
/** Height of a prop's top for hop purposes, or undefined when it cannot be hopped (too tall or not a low prop). */
export function propHopHeight(p) {
  if (!p) return undefined; let h;
  if (FIXED[p.kind]) h = FIXED[p.kind] * (p.kind === 'stump' ? 1 : 1);
  else if (p.kind === 'rock') h = (p.r || 0.6) * 0.8;
  else if (p.kind === 'grock' && GROK[p.model]) h = GROK[p.model].h * (p.scale || 1);
  return h !== undefined && h > 0.12 && h <= HOP_MAX ? h : undefined;
}
/** Give each collider of a freshly built tile its hop height (colliders are named `${propId}c…`). */
export const CLIMB_MAX = 1.35;   // metres: the climb-up clip is for a ledge about this high; taller props stay solid
const CLIMBABLE = /boulder|cairn|stone_circle|waymarker/;   // natural stone only: never bushes, signs, tents or racks
/** Height of a prop's top for climbing (above HOP_MAX, up to CLIMB_MAX), or undefined. */
export function propClimbHeight(p) {
  if (!p) return undefined; let h;
  if (p.kind === 'rock') h = (p.r || 0.6) * 0.8;
  else if (p.kind === 'grock' && GROK[p.model] && CLIMBABLE.test(p.model)) h = GROK[p.model].h * (p.scale || 1);
  return h !== undefined && h > HOP_MAX && h <= CLIMB_MAX ? h : undefined;
}
export function annotateHops(colliders, props) {
  const byId = new Map(props.map(p => [p.id, p]));
  for (const c of colliders) { const pr = c.id ? byId.get(c.id.replace(/c-?[\d.]+$/, '')) : undefined, h = propHopHeight(pr); if (h !== undefined) c.h = h; else { const k = propClimbHeight(pr); if (k !== undefined) c.climb = k; } }
}
