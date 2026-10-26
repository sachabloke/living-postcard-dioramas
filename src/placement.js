// Place-and-build validation (Constitution rules 18 + 23). Pure: every rule is testable in Node. A ghost shows green only when canPlace().ok.
import { groundAt, depthAt, slopeAt, pathWeight, HUT, CAMP, GATE, BRIDGE } from './terrain.js';
import { pathAny } from './tiles.js';
import { PLAYER_R } from './movement.js';
import { COSTS } from './rules.js';

// PLACEHOLDER costs: the Forest handover gives costs for the hut/campfire chain only; these are prototype values awaiting parent decision.
export const ITEMS = {
  quickfire: { label: 'Quick fire', r: 0.7, maxSlope: 0.35, cost: COSTS.quickfire, colliders: (x, z) => [{ x, z, r: 0.55 }], model: 'fire_stone_ring', scale: 1 },
  fence:     { label: 'Fence piece', r: 1.05, maxSlope: 0.45, cost: COSTS.fence, colliders: (x, z, rot) => [-0.75, -0.25, 0.25, 0.75].map(k => ({ x: x + Math.cos(rot) * k, z: z - Math.sin(rot) * k, r: 0.22 })), model: 'fence_section', scale: 1, length: 2.0 },
  shelter:   { label: 'Quick shelter', r: 1.7, maxSlope: 0.3, cost: COSTS.shelter, colliders: (x, z, rot) => [-1, -0.3, 0.4, 1].map(k => ({ x: x + Math.cos(rot) * k, z: z - Math.sin(rot) * k, r: 0.35 })).concat([{ x: x - Math.sin(rot) * 0.9, z: z - Math.cos(rot) * 0.9, r: 0.35 }]), model: null, scale: 1, roof: true },
};
const samples = (item, x, z, rot) => { const out = [[x, z]]; const R = item.r; for (let a = 0; a < 6.283; a += 0.785) out.push([x + Math.cos(a) * R, z + Math.sin(a) * R]); if (item.length) for (const k of [-1, -0.5, 0.5, 1]) out.push([x + Math.cos(rot) * k * item.length / 2, z - Math.sin(rot) * k * item.length / 2]); return out; };

/** ctx: { colliders:[{x,z,r}], player:{x,z} }. Returns { ok, reason }. Reasons are plain words for the player. */
export function canPlace(itemId, x, z, rot, ctx) {
  const item = ITEMS[itemId]; if (!item) return { ok: false, reason: 'unknown item' };
  const pts = samples(item, x, z, rot);
  if (pts.some(([px, pz]) => depthAt(px, pz) > 0)) return { ok: false, reason: 'In water' };
  let maxS = 0, lo = 1e9, hi = -1e9; for (const [px, pz] of pts) { maxS = Math.max(maxS, slopeAt(px, pz)); const h = groundAt(px, pz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  if (maxS > item.maxSlope || hi - lo > item.r * 0.9) return { ok: false, reason: 'Too steep' };
  // reserved build sites: the cabin, the camp fire, the gate ring and both bridge approaches must stay clear
  const reserved = [[HUT.x, HUT.z, HUT.half + 2.4, 'Keep the cabin site clear'], [CAMP.x, CAMP.z, 2.6, 'Keep the camp fire site clear'], [GATE.x, GATE.z, GATE.r + 1.2, 'Keep the gate ring clear'], [BRIDGE.x + BRIDGE.halfLen + 1.5, BRIDGE.z, 3, 'Keep the bridge approach clear'], [BRIDGE.x - BRIDGE.halfLen - 1.5, BRIDGE.z, 3, 'Keep the bridge approach clear']];
  for (const [rx, rz, rr, why] of reserved) if (Math.hypot(x - rx, z - rz) < rr + item.r) return { ok: false, reason: why };
  const cols = item.colliders(x, z, rot);
  for (const n of cols) for (const c of ctx.colliders) if (Math.hypot(n.x - c.x, n.z - c.z) < n.r + c.r + 0.1) return { ok: false, reason: 'Something is in the way' };
  for (const n of cols) if (Math.hypot(n.x - ctx.player.x, n.z - ctx.player.z) < n.r + PLAYER_R + 0.15) return { ok: false, reason: 'You are standing there' };
  for (const [px, pz] of pts) if (pathAny(px, pz) > 0.3) return { ok: false, reason: 'Keep the path clear' };
  if (blocksRoute(cols, ctx, x, z)) return { ok: false, reason: 'Would block your way' };
  return { ok: true, reason: '' };
}

/** Small flood fill on a 0.5 m grid: cells the player could reach before must (nearly) all still be reachable after adding the object. */
export function blocksRoute(newCols, ctx, cx, cz) {
  const H = 14, S = 0.5, N = Math.round(2 * H / S), x0 = ctx.player.x - H, z0 = ctx.player.z - H;
  const nearby = ctx.colliders.filter(c => Math.abs(c.x - ctx.player.x) < H + 3 && Math.abs(c.z - ctx.player.z) < H + 3);
  const walk = (cols) => { const g = new Uint8Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + (i + 0.5) * S, z = z0 + (j + 0.5) * S; let ok = depthAt(x, z) <= 0.42; if (ok) for (const c of cols) { const r = c.r + PLAYER_R; if ((x - c.x) * (x - c.x) + (z - c.z) * (z - c.z) < r * r) { ok = false; break; } } g[j * N + i] = ok ? 1 : 0; } return g; };
  const flood = (g, si, sj) => { const seen = new Uint8Array(N * N), st = [sj * N + si]; if (!g[st[0]]) return seen; seen[st[0]] = 1; while (st.length) { const k = st.pop(), i = k % N, j = (k - i) / N; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= N || b >= N) continue; const q = b * N + a; if (g[q] && !seen[q]) { seen[q] = 1; st.push(q); } } } return seen; };
  const si = Math.min(N - 1, Math.max(0, Math.floor((ctx.player.x - x0) / S))), sj = Math.min(N - 1, Math.max(0, Math.floor((ctx.player.z - z0) / S)));
  const before = flood(walk(nearby), si, sj), after = flood(walk(nearby.concat(newCols)), si, sj);
  let lost = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i; if (before[k] && !after[k]) { const x = x0 + (i + 0.5) * S, z = z0 + (j + 0.5) * S; if (Math.hypot(x - cx, z - cz) > 2.4 + 0.5) lost++; } }   // cells swallowed by the footprint itself don't count
  return lost > 6;
}
