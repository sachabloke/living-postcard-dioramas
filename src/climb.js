// Climbing onto big stones, RDR2-style: face a boulder, press Jump, and the Quaternius ClimbUp_1m clip plays while the code carries the player's root up and over the edge.
// The root path below is the Universal Animation Library 2 RM clip's pelvis minus its in-place clip's pelvis, sampled on the 17 frames of the baked clip (tools_bake_climb.py):
// forward metres and rise metres from the start. It is normalised, so any stone from 0.45 m to CLIMB_MAX high gets the same motion stretched to its real height.
import { groundAt } from './terrain.js';
import { PLAYER_R } from './movement.js';
import { CLIMB_MAX } from './hop.js';
export const CLIMB_DUR = 0.9, CLIMB_REACH = 0.5, MIN_RISE = 0.45;
const FWD = [0, 0.034, 0.093, 0.165, 0.241, 0.309, 0.379, 0.46, 0.547, 0.633, 0.713, 0.79, 0.871, 0.956, 1.048, 1.147, 1.256];
const RISE = [0, 0.068, 0.158, 0.253, 0.336, 0.395, 0.444, 0.502, 0.567, 0.634, 0.698, 0.763, 0.831, 0.898, 0.96, 1.012, 1.032];
const at = (arr, u) => { const f = Math.min(1, Math.max(0, u)) * (arr.length - 1), i = Math.min(arr.length - 2, Math.floor(f)); return (arr[i] + (arr[i + 1] - arr[i]) * (f - i)) / arr[arr.length - 1]; };
const group = (id) => (id ? String(id).replace(/c-?[\d.]+$/, '') : '');
/** True when a standing player at (x,z), top height y, would overlap an unrelated solid blocker (anything that is not the stone being climbed): trees, walls, other tall stones. Low props the player steps over are ignored. */
function blockedAt(x, z, y, colliders, own, r) {
  for (const c of colliders) {
    if (group(c.id) === own) continue;
    const top = c.h !== undefined ? c.h : c.climb; if (top !== undefined && groundAt(c.x, c.z) + top <= y - 0.3) continue;   // a low prop under the climber's feet
    if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
  }
  return false;
}
/** A climb the player could start now, or null. p: {x,y,z,face,air}; colliders carry `climb` (top height above their ground) from annotateHops. Needs to be on the ground, facing the stone, within reach of its edge. */
export function findClimb(p, colliders, ready) {
  if (p.air || p.y - groundAt(p.x, p.z) > 0.3) return null;
  const fx = Math.sin(p.face), fz = Math.cos(p.face); let best = null;
  for (const c of colliders) {
    const k = c.climb ?? c.h; if (k === undefined) continue;   // tall stones, and stumps/logs/small rocks too: anything at least MIN_RISE above your feet is clambered, lower ones are hopped
    const top = groundAt(c.x, c.z) + k, rise = top - p.y; if (rise < MIN_RISE || rise > CLIMB_MAX + 0.15) continue;
    const d = Math.hypot(c.x - p.x, c.z - p.z) || 1e-6, gap = d - c.r - PLAYER_R; if (gap > CLIMB_REACH || gap < -0.25) continue;
    if (((c.x - p.x) * fx + (c.z - p.z) * fz) / d < 0.5) continue;
    if (!best || gap < best.gap) best = { c, gap, top, d };
  }
  if (!best) return null;
  const { c, top, d } = best, e = Math.max(0, Math.min(c.r - 0.45, c.r * 0.5)), ux = (p.x - c.x) / best.d, uz = (p.z - c.z) / best.d;
  const job = { x0: p.x, z0: p.z, y0: p.y, x1: c.x + ux * e, z1: c.z + uz * e, y1: top, face: Math.atan2(c.x - p.x, c.z - p.z), id: c.id }, own = group(c.id);
  // the sweep and the landing must be clear of every unrelated blocker, and the destination tile must be loaded
  for (const u of [0.25, 0.5, 0.75, 1]) { const q = climbAt(job, u); if (blockedAt(q.x, q.z, q.y, colliders, own, PLAYER_R * 0.8)) return null; }
  if (ready && !ready(job.x1, job.z1)) return null;
  return job;
}
/** Root position at progress u (0..1) of a climb job. */
export function climbAt(job, u) { const f = at(FWD, u), r = at(RISE, u); return { x: job.x0 + (job.x1 - job.x0) * f, z: job.z0 + (job.z1 - job.z0) * f, y: job.y0 + (job.y1 - job.y0) * r }; }
