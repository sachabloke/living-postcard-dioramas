// Player movement. Substepped so a fast or low-fps frame cannot tunnel through a collider. Uses terrain.groundAt only.
import { groundAt, depthAt, slopeAt, BOUNDS, SEAM_Z, GATE, BRIDGE } from './terrain.js';

export const PLAYER_R = 0.38, MAX_STEP = 0.2, MAX_SLOPE = 1.0, MAX_WADE = 0.42, SUBSTEP = 0.18;
/** Jumping: a hop reaches about 1.08 m, so a prop is hoppable only when its top is at most HOP_MAX high (colliders get an optional height `h`; no `h` means too tall). */
export const GRAVITY = 9.8, JUMP_V = 4.6, HOP_MAX = 0.9;

/** world: {colliders:[{x,z,r,h?}]}, gates: {seamOpen:boolean, clear?:metres the feet are above the ground}. Colliders whose top is at or below the feet are ignored. Returns new {x,y,z}. */
export function moveStep(p, dx, dz, worldFull, gates = {}) {
  const len = Math.hypot(dx, dz), n = Math.max(1, Math.ceil(len / SUBSTEP));
  // only colliders near this move matter: keeps the cost flat however many tiles are loaded
  const reach = len + 4, near = []; const clear = gates.clear || 0; for (const c of worldFull.colliders) { { const top = c.h !== undefined ? c.h : c.climb; if (top !== undefined && top <= clear + 0.05) continue; }; const ex = c.x - p.x, ez = c.z - p.z; if (ex * ex + ez * ez < (reach + c.r) * (reach + c.r)) near.push(c); }
  const world = { colliders: near, ready: worldFull.ready };
  let x = p.x, z = p.z;
  for (let i = 0; i < n; i++) {
    const sx = dx / n, sz = dz / n;
    // try full step, then axis-sliding
    for (const [mx, mz] of [[sx, sz], [sx, 0], [0, sz]]) {
      if (!mx && !mz) continue;
      const nx = x + mx, nz = z + mz;
      if (!passable(x, z, nx, nz, world, gates)) continue;
      x = nx; z = nz; break;
    }
    ({ x, z } = pushOut(x, z, world.colliders));   // resolve residual overlap (e.g. moving collider, spawn)
  }
  return { x, z, y: groundAt(x, z) };
}
/** Top (absolute y) of the highest hoppable prop under the feet that is no higher than maxTop, or -Infinity. Used to land on logs, stumps and low rocks. */
export function supportTop(x, z, colliders, maxTop) {
  let top = -Infinity;
  for (const c of colliders) {
    let hh, lim = maxTop;
    if (c.h !== undefined) { if (c.h > HOP_MAX) continue; hh = c.h; }
    else if (c.climb !== undefined) { hh = c.climb; lim = maxTop - 0.2; }   // a climbable prop only holds you up once you are already at its top (a jump never lands on it)
    else continue;
    const t = groundAt(c.x, c.z) + hh; if (t > lim || t <= top) continue;
    if (Math.hypot(x - c.x, z - c.z) < c.r + 0.05) top = t;
  }
  return top;
}
/** One vertical step for the player: terrain-following on foot, ballistic in the air, landing on terrain or on a low prop's top, and falling off its edge. Mutates p ({x,y,z,vy,air}); returns 'jump' | 'land' | null. */
export function stepVertical(p, dt, wantJump, colliders, jumpMul = 1) {
  const g0 = groundAt(p.x, p.z), floor = Math.max(g0, supportTop(p.x, p.z, colliders, p.y + 0.25));
  let ev = null;
  if (wantJump && !p.air && p.y <= floor + 0.05) { p.air = true; p.vy = JUMP_V * jumpMul; ev = 'jump'; }
  if (p.air) {
    p.vy -= GRAVITY * dt; p.y += p.vy * dt;
    if (p.y <= floor && p.vy <= 0) { p.y = floor; p.air = false; p.vy = 0; ev = 'land'; }
  } else if (p.y > floor + 0.03 && !(floor === g0 && p.y - floor <= MAX_STEP)) { p.air = true; p.vy = 0; }       // walked off the edge of a prop or a real drop; going down a hill the feet stay on the ground (drops up to MAX_STEP a frame are followed, not fallen)
  else p.y = floor;
  return ev;
}
export function passable(x, z, nx, nz, world, gates) {
  if (world.ready && !world.ready(nx, nz)) return false;                             // hold a safe boundary until the next tile's collision is loaded
  if (Math.abs(nx - BRIDGE.x) < BRIDGE.halfLen - 1.2 && Math.abs(nz - BRIDGE.z) > 0.78 && Math.abs(nz - BRIDGE.z) < BRIDGE.halfWid + 0.6) return false;   // bridge railings
  if (depthAt(nx, nz) > MAX_WADE) return false;                                      // deep water
  const step = Math.hypot(nx - x, nz - z) || 1e-6;
  if (Math.abs(groundAt(nx, nz) - groundAt(x, z)) / step > MAX_SLOPE + 1e-9 && Math.abs(groundAt(nx, nz) - groundAt(x, z)) > MAX_STEP * 0.5) return false;
  for (const c of world.colliders) {
    const d = Math.hypot(nx - c.x, nz - c.z); if (d < c.r + PLAYER_R) { const d0 = Math.hypot(x - c.x, z - c.z); if (d < d0) return false; }
  }
  return true;
}
export function pushOut(x, z, colliders) {
  for (let k = 0; k < 3; k++) for (const c of colliders) {
    const d = Math.hypot(x - c.x, z - c.z), need = c.r + PLAYER_R - 0.001;
    if (d < need) { const a = d < 1e-6 ? 0 : (x - c.x) / d, b = d < 1e-6 ? 1 : (z - c.z) / d; x = c.x + a * need; z = c.z + b * need; }
  }
  return { x, z };
}
/** Safe unstuck: nearest clear dry ground ring-searched from the player, never inside a collider. */
export function findSafeSpot(x, z, world, gates = {}) {
  for (let r = 0; r < 40; r += 0.75) for (let a = 0; a < 6.283; a += 0.4) {
    const nx = x + Math.cos(a) * r, nz = z + Math.sin(a) * r;
    if (depthAt(nx, nz) > 0 || slopeAt(nx, nz) > 0.6) continue;
    if (world.colliders.some(c => Math.hypot(nx - c.x, nz - c.z) < c.r + PLAYER_R + 0.4)) continue;
    return { x: nx, z: nz, y: groundAt(nx, nz) };
  }
  return null;
}
