// Ambient wildlife (Grok Group D, rigged GLBs: Idle/Walk/Look + Graze|Sniff|Peck). Shy, harmless, never blocks the player.
// Pure logic (spawn + step) lives here so it can be tested without a browser; main.js owns the skinned meshes.
import { makeRng } from './rng.js';
import { groundAt, depthAt, slopeAt, riverX, waterY, BOUNDS, WS } from './terrain.js';
const YOFF = { duck: -0.02, trout: -0.25, minnow: -0.15, dragonfly: 0.45 };
const yOf = (kind, x, z) => kind in YOFF ? waterY(z) + YOFF[kind] : groundAt(x, z);
const nearRiver = (x, z, m) => Math.abs(x - riverX(z)) < m;

export const SPECS = {
  rabbit: { model: 'fm_rabbit_forest', act: 'Graze', walk: 0.7, flee: 3.4, nominal: 0.7, fleeDist: 6, roam: 7 },
  deer:   { model: 'fm_deer_forest',   act: 'Graze', walk: 1.2, flee: 4.0, nominal: 1.2, fleeDist: 11, roam: 12 },
  fox:    { model: 'fm_fox_forest',    act: 'Sniff', walk: 1.0, flee: 3.6, nominal: 1.0, fleeDist: 9, roam: 10 },
  heron:  { model: 'fm_heron_forest',  act: 'Peck',  walk: 0.5, flee: 1.6, nominal: 0.5, fleeDist: 8, roam: 6 },
  badger: { model: 'fm_badger_forest', act: 'Dig', walk: 0.9, flee: 3.2, nominal: 0.9, fleeDist: 8, roam: 8 },
  squirrel: { model: 'fm_red_squirrel_forest', act: 'Nibble', walkClip: 'Hop', walk: 1.1, flee: 3.8, nominal: 1.1, fleeDist: 7, roam: 7 },
  duck:   { model: 'fm_mallard_duck_forest', act: 'Dabble', walkClip: 'Swim', walk: 0.5, flee: 1.8, nominal: 0.5, fleeDist: 6, roam: 5 },
  trout:  { model: 'fm_brown_trout_forest', act: 'Look', walkClip: 'Swim', fleeClip: 'Dart', walk: 0.4, flee: 1.8, nominal: 0.4, fleeDist: 4, roam: 6 },
  minnow: { model: 'fm_minnow_school_forest', still: true, idleClip: 'SchoolLoop', startleClip: 'Startle', walk: 0, flee: 0, nominal: 1, fleeDist: 3.5, roam: 0 },
  frog:   { model: 'fm_common_frog_forest', act: 'Croak', walkClip: 'Hop', walk: 0.5, flee: 1.6, nominal: 0.5, fleeDist: 3, roam: 3 },
  dragonfly: { model: 'fm_dragonfly_forest', act: 'Look', idleClip: 'Hover', walkClip: 'Hover', fleeClip: 'Dart', walk: 0.9, flee: 3.0, nominal: 1, fleeDist: 3, roam: 7 },
  owl:    { model: 'fm_tawny_owl_forest', act: 'HeadTurn', perched: true, walk: 0, flee: 0, nominal: 1, fleeDist: 0, roam: 0 },
};
const wetOk = (kind, d) => kind === 'heron' ? d < 0.3 : kind === 'duck' ? d > 0.12 : kind === 'trout' ? d > 0.5 : kind === 'minnow' ? d > 0.15 : kind === 'dragonfly' ? true : d < 0.04;
export const placeOk = (kind, x, z) => wetOk(kind, depthAt(x, z)) && (kind === 'dragonfly' ? nearRiver(x, z, 7) : kind === 'frog' ? nearRiver(x, z, 6.5) && slopeAt(x, z) < 0.6 : ['duck', 'trout', 'minnow'].includes(kind) || slopeAt(x, z) < 0.6);
const dryOk = placeOk;

/** Deterministic animals for a rectangle (a streamed tile or the home area). Never inside `avoid(x,z)`. */
export function spawnAnimals(key, rect, biome, avoid = () => false, perches = []) {
  let h = 7; for (const c of key) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  const rng = makeRng(h ^ 0x5bd1e995), out = [];
  const want = []; const r = rng();
  if (biome === 'meadow') { want.push('rabbit'); if (rng() < 0.6) want.push('rabbit'); if (r < 0.3) want.push('deer'); }
  else if (biome === 'woodland') { want.push('rabbit'); if (r < 0.7) want.push('deer'); if (rng() < 0.4) want.push('fox'); }
  else { if (r < 0.25) want.push('fox'); if (rng() < 0.3) want.push('rabbit'); }
  // a heron stands on the river margin where this rectangle contains the river
  let hz = null; if (!WS) for (let z = rect.z0 + 2; z < rect.z1 - 2; z += 4) { const x = riverX(z); if (x > rect.x0 + 6 && x < rect.x1 - 6) { hz = z; break; } }
  if (hz != null && rng() < 0.7) want.push('heron');
  if (hz != null && rng() < 0.7) { want.push('duck'); if (rng() < 0.5) want.push('duck'); }
  if (hz != null) { if (rng() < 0.7) want.push('trout'); if (rng() < 0.6) want.push('minnow'); if (rng() < 0.7) want.push('dragonfly'); if (rng() < 0.6) want.push('frog'); if (rng() < 0.3) want.push('frog'); }
  if (biome === 'woodland') { if (rng() < 0.7) want.push('squirrel'); if (rng() < 0.3) want.push('badger'); if (perches.length && rng() < 0.45) want.push('owl'); }
  else if (biome === 'meadow') { if (rng() < 0.2) want.push('squirrel'); } else if (rng() < 0.2) want.push('badger');
  for (const kind of want) {
    if (kind === 'owl') { const pc = perches[Math.floor(rng() * perches.length)]; out.push({ id: `a_${key}_${out.length}`, kind, x: pc.x, z: pc.z, y: pc.y, yaw: rng() * 6.283, hx: pc.x, hz: pc.z, state: 'idle', clip: 'Idle', ts: 1, timer: 1 + rng() * 4, tx: pc.x, tz: pc.z, seed: Math.floor(rng() * 1e9) }); continue; }
    for (let t = 0; t < 40; t++) {
      let x, z;
      if (kind === 'duck' || kind === 'trout' || kind === 'minnow' || kind === 'dragonfly') { z = hz + (rng() - 0.5) * 30; x = riverX(z) + (rng() - 0.5) * (kind === 'dragonfly' ? 7 : kind === 'minnow' ? 5 : 2.5); } else if (kind === 'frog') { z = hz + (rng() - 0.5) * 30; x = riverX(z) + (rng() < 0.5 ? -1 : 1) * (3.2 + rng() * 2.4); } else if (kind === 'heron') { z = hz + (rng() - 0.5) * 30; x = riverX(z) + (rng() < 0.5 ? -1 : 1) * (3.6 + rng() * 1.5); } else { x = rect.x0 + 4 + rng() * (rect.x1 - rect.x0 - 8); z = rect.z0 + 4 + rng() * (rect.z1 - rect.z0 - 8); }
      if (x < rect.x0 + 2 || x > rect.x1 - 2 || z < rect.z0 + 2 || z > rect.z1 - 2 || !dryOk(kind, x, z) || avoid(x, z)) continue;
      out.push({ id: `a_${key}_${out.length}`, kind, x, z, y: yOf(kind, x, z), yaw: rng() * 6.283, hx: x, hz: z, state: 'idle', clip: 'Idle', ts: 1, timer: 1 + rng() * 4, tx: x, tz: z, seed: Math.floor(rng() * 1e9) });
      break;
    }
  }
  return out;
}

const wrap = (a) => { while (a > Math.PI) a -= 6.283185; while (a < -Math.PI) a += 6.283185; return a; };
/** Advance one animal. Returns nothing; mutates `a` (x,z,y,yaw,state,clip,ts). `P` = player {x,z,speed}. */
export function stepAnimal(a, dt, P) {
  const S = SPECS[a.kind], dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz), scare = S.fleeDist * ((P.speed || 0) > 0.3 ? 1 : 0.6);
  a.rn = a.rn || makeRng(a.seed || 1);
  if (S.perched) { a.timer -= dt; if (a.timer <= 0) { const r = a.rn(); a.state = r < 0.45 ? 'act' : r < 0.7 ? 'look' : 'idle'; a.timer = 3 + a.rn() * 5; } a.speed = 0; a.clip = a.state === 'act' ? S.act : a.state === 'look' ? 'Look' : 'Idle'; a.ts = 1; return; }
  if (S.still) { const near = d < S.fleeDist; if (near) { a.state = 'flee'; a.timer = 1.2; } else a.timer -= dt; if (a.state === 'flee' && !near && a.timer <= 0) a.state = 'idle'; a.speed = 0; a.clip = a.state === 'flee' ? S.startleClip : S.idleClip; a.ts = 1; return; }
  if (d < scare) { a.state = 'flee'; a.timer = 2.5; const hd = Math.hypot(a.x - a.hx, a.z - a.hz), tow = hd > S.roam * 2 ? 0.6 : 0; const ax = dx / (d || 1) * (1 - tow) - (a.x - a.hx) / (hd || 1) * tow, az = dz / (d || 1) * (1 - tow) - (a.z - a.hz) / (hd || 1) * tow; a.tx = a.x + ax * 8; a.tz = a.z + az * 8; }
  else if (a.state === 'flee') { a.timer -= dt; if (a.timer <= 0 && d > scare * 1.5) { a.state = 'idle'; a.timer = 2 + a.rn() * 3; } }
  a.timer -= dt;
  if (a.state === 'idle' || a.state === 'act' || a.state === 'look') {
    if (a.timer <= 0) { const r = a.rn(); if (r < 0.35) { a.state = 'act'; a.timer = 5 + a.rn() * 4; } else if (r < 0.5) { a.state = 'look'; a.timer = 3 + a.rn() * 2; } else if (r < 0.9) { const ang = a.rn() * 6.283, rad = 2 + a.rn() * S.roam; a.tx = a.hx + Math.cos(ang) * rad; a.tz = a.hz + Math.sin(ang) * rad; a.state = 'walk'; a.timer = 12; } else { a.state = 'idle'; a.timer = 2 + a.rn() * 4; } }
  }
  let speed = 0;
  if (a.state === 'walk' || a.state === 'flee') {
    const tx = a.tx - a.x, tz = a.tz - a.z, td = Math.hypot(tx, tz);
    if (td < 0.4 || (a.state === 'walk' && a.timer <= 0)) { if (a.state === 'walk') { a.state = 'idle'; a.timer = 1.5 + a.rn() * 3; } else { a.tx = a.x + (a.x - P.x); a.tz = a.z + (a.z - P.z); } }
    else {
      const want = Math.atan2(tx, tz); a.yaw += Math.max(-4 * dt, Math.min(4 * dt, wrap(want - a.yaw)));
      const align = Math.max(0, Math.cos(wrap(want - a.yaw))); speed = (a.state === 'flee' ? S.flee : S.walk) * align;
      const nx = a.x + Math.sin(a.yaw) * speed * dt, nz = a.z + Math.cos(a.yaw) * speed * dt;
      if (dryOk(a.kind, nx, nz) && Math.hypot(nx - a.hx, nz - a.hz) < S.roam * 2.5) { a.x = nx; a.z = nz; a.y = yOf(a.kind, nx, nz); }
      else { speed = 0; if (a.state === 'walk') { a.state = 'idle'; a.timer = 1 + a.rn() * 2; } else { a.tx = a.hx; a.tz = a.hz; } }
    }
  }
  if (a.state === 'look' || a.state === 'act' || a.state === 'idle') speed = 0;
  a.speed = speed;
  const idleC = S.idleClip || 'Idle'; a.clip = a.state === 'flee' && speed > 0.05 ? (S.fleeClip || S.walkClip || 'Walk') : a.state === 'walk' || a.state === 'flee' ? (speed > 0.05 ? (S.walkClip || 'Walk') : idleC) : a.state === 'act' ? S.act : a.state === 'look' ? 'Look' : idleC;
  a.ts = a.clip === (S.walkClip || 'Walk') && S.walkClip !== 'Hover' ? Math.min(2.2, Math.max(0.4, speed / S.nominal)) : 1;
}
export const homeAvoid = (x, z) => false;
