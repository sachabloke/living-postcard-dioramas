// Streamed ground cover (parent reference 21 Oct 2026: dense tiny multi-coloured flowers over fine grass; woodland litter; waterside pebbles).
// Layers of instanced meshes around the player, placed per 1 m cell from world-space noise + biome, rebuilt in time slices into back buffers
// (no hitching), rooted on the one ground surface. Decorative only: never blocks movement; routes keep only sparse pebbles/litter.
import * as THREE from 'three';
import { groundAt, depthAt, surfaceInfo, fbm } from './terrain.js';
import { biomeAt } from './tiles.js';
import { makeRng } from './rng.js';
import { addSway } from './scene.js';

const FLOWER_COLS = ['#ffffff', '#f6f0e4', '#fff3a8', '#f2dc7a', '#b9cdf0', '#d9c4ea'];
const LEAF_COLS = ['#8a5a2a', '#a8742f', '#c08a38', '#6e4a28', '#9a6a30', '#b5651d'];
const CAPS = { flower: 14000, clover: 6000, seed: 2600, litter: 16000, pebble: 1800, twig: 2000 };
const R_DEFAULT = 15;                                 // radius (m) around the player; the caller passes a larger/smaller reach according to frame rate
let R = R_DEFAULT;
function geo(parts) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(parts.v, 3)); g.setIndex(parts.i); g.computeVertexNormals(); return g; }
function flowerGeo() { const v = [0, 0.012, 0], i = []; for (let k = 0; k < 5; k++) { const a = k * 1.2566 + 0.2, b = 0.5; const p = v.length / 3; v.push(Math.cos(a - b) * 0.03, 0.014, Math.sin(a - b) * 0.03, Math.cos(a) * 0.055, 0.02, Math.sin(a) * 0.055, Math.cos(a + b) * 0.03, 0.014, Math.sin(a + b) * 0.03); i.push(0, p, p + 1, 0, p + 1, p + 2); } return geo({ v, i }); }
function cloverGeo() { const v = [], i = []; for (let k = 0; k < 3; k++) { const a = k * 2.094; const p = v.length / 3; v.push(0, 0.01, 0, Math.cos(a - 0.5) * 0.06, 0.012, Math.sin(a - 0.5) * 0.06, Math.cos(a) * 0.075, 0.016, Math.sin(a) * 0.075, Math.cos(a + 0.5) * 0.06, 0.012, Math.sin(a + 0.5) * 0.06); i.push(p, p + 1, p + 2, p, p + 2, p + 3); } return geo({ v, i }); }
function seedGeo() { const v = [-0.006, 0, 0, 0.006, 0, 0, 0, 0.3, 0.004, -0.02, 0.28, 0, 0.02, 0.28, 0, 0, 0.36, 0.01, 0, 0.27, -0.015], i = [0, 1, 2, 3, 4, 5, 3, 5, 6, 4, 5, 6]; return geo({ v, i }); }
function leafGeo() { const v = [0, 0.012, -0.07, 0.04, 0.014, 0, 0, 0.012, 0.07, -0.04, 0.014, 0], i = [0, 1, 2, 0, 2, 3]; return geo({ v, i }); }
const pebbleGeo = () => { const g = new THREE.IcosahedronGeometry(0.055, 0); g.scale(1, 0.55, 1); g.translate(0, 0.02, 0); return g; };
const twigGeo = () => { const g = new THREE.CylinderGeometry(0.008, 0.012, 0.42, 4); g.rotateZ(Math.PI / 2); g.translate(0, 0.012, 0); return g; };

export function makeGroundCover() {
  const grp = new THREE.Group(), L = {};
  const mk = (name, g, mat, cap, sway) => { if (sway) addSway(mat, sway, 1.8, 0); const im = new THREE.InstancedMesh(g, mat, cap); im.frustumCulled = false; im.count = 0; im.receiveShadow = false; im.castShadow = false;
    const col = new Float32Array(cap * 3); im.instanceColor = new THREE.InstancedBufferAttribute(col, 3); L[name] = { im, cap, back: new Float32Array(cap * 16), backCol: new Float32Array(cap * 3), n: 0 }; grp.add(im); };
  const lam = (c = 0xffffff) => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide });
  mk('flower', flowerGeo(), lam(), CAPS.flower, 0.05); mk('clover', cloverGeo(), lam(), CAPS.clover, 0); mk('seed', seedGeo(), lam(), CAPS.seed, 0.5); mk('litter', leafGeo(), lam(), CAPS.litter, 0);
  mk('pebble', pebbleGeo(), new THREE.MeshLambertMaterial({ color: 0xffffff }), CAPS.pebble, 0); mk('twig', twigGeo(), new THREE.MeshLambertMaterial({ color: 0xffffff }), CAPS.twig, 0);
  // MegaKit tufts (real models, instanced): added once the GLBs are loaded. Caps keep the triangle budget small; density is scaled by the
  // adaptive-quality factor passed to update(), so slow devices thin them out first.
  const TUFTS = [['mk_grass_tall', 600, 0.9], ['mk_grass_wispy', 260, 0.9], ['mk_grass_short', 800, 0.7], ['mk_flower3', 120, 0.8], ['mk_flower4', 80, 0.8], ['mk_mushroom', 100, 0.9], ['mk_clover', 300, 0.9]];
  const SEAS = { summer: [1, [1, 1, 1]], spring: [1, [1, 1.05, 1]], autumn: [0.8, [1.55, 1.05, 0.5]], winter: [0.3, [2.6, 2.9, 3.3]] }; let seasonK = SEAS.summer;
  grp.userData.setSeason = (name) => { const k = SEAS[name] || SEAS.summer; if (k !== seasonK) { seasonK = k; center = null; } };
  grp.userData.addModels = (models) => {
    for (const [name, cap, sway] of TUFTS) { const m = models[name]; if (!m || L['t_' + name]) continue; let mesh = null; m.root.updateMatrixWorld(true); m.root.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
      if (!mesh) continue; const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), mat = mesh.material.clone(); mat.side = THREE.DoubleSide; if (sway) addSway(mat, 0.05 * sway, 1.6, 0.25);
      mk('t_' + name, g, mat, cap, 0); L['t_' + name].im.castShadow = false; }
    center = null;                                    // force a rebuild so the new layers fill in
  };
  const cols = (arr) => arr.map(h => new THREE.Color(h)), FC = cols(FLOWER_COLS), LC = cols(LEAF_COLS), PEB = cols(['#8c8a84', '#a09c92', '#6f6d68', '#b4ae9f']), TW = cols(['#5a4128', '#6a4d2f']), CL = cols(['#4f8f4a', '#5f9d52', '#3f7d42']), SD = cols(['#b9a45a', '#9aa34a', '#c4b07a']), c = new THREE.Color();
  const cache = new Map();
  const cell = (ix, iz) => { const key = ix * 7919 + iz; let r = cache.get(key); if (!r) { const x = ix + 0.5, z = iz + 0.5, s = surfaceInfo(x, z), wet = depthAt(x, z) > 0, bio = biomeAt(x, z);
      r = { ok: !wet && s.bank < 0.8 && s.snow < 0.3, bio, patch: s.patch, bank: s.bank, path: s.path, camp: s.camp, rock: s.rock, drift: fbm(x * 2.3 + 40, z * 2.3 - 9), drift2: fbm(x * 1.4 - 70, z * 1.4 + 30), under: fbm(x * 1.1 + 5, z * 1.1 + 5) }; cache.set(key, r); if (cache.size > 9000) cache.delete(cache.keys().next().value); } return r; };
  let job = null, center = null, density = 1;
  function* rebuild(fx, fz, dens) {
    for (const k in L) L[k].n = 0; let budget = 0;
    const ix0 = Math.floor(fx - R), iz0 = Math.floor(fz - R), R2 = R * R;
    const put = (name, x, z, rot, sx, sy, colr) => { const l = L[name]; if (l.n >= l.cap) return; const y = groundAt(x, z), o = l.n * 16, b = l.back, ca = Math.cos(rot), sa = Math.sin(rot); b[o] = ca * sx; b[o + 1] = 0; b[o + 2] = -sa * sx; b[o + 3] = 0; b[o + 4] = 0; b[o + 5] = sy; b[o + 6] = 0; b[o + 7] = 0; b[o + 8] = sa * sx; b[o + 9] = 0; b[o + 10] = ca * sx; b[o + 11] = 0; b[o + 12] = x; b[o + 13] = y; b[o + 14] = z; b[o + 15] = 1; l.backCol[l.n * 3] = colr.r; l.backCol[l.n * 3 + 1] = colr.g; l.backCol[l.n * 3 + 2] = colr.b; l.n++; };
    for (let ix = ix0; ix <= ix0 + 2 * R; ix++) for (let iz = iz0; iz <= iz0 + 2 * R; iz++) {
      const d2 = (ix + 0.5 - fx) ** 2 + (iz + 0.5 - fz) ** 2; if (d2 > R2) continue; const ce = cell(ix, iz), dist = Math.sqrt(d2), fade = 1 - Math.min(1, Math.max(0, (dist - (R - 5)) / 5)), farK = 1 - 0.55 * Math.min(1, Math.max(0, (dist - R * 0.4) / (R * 0.6))); if (!(++budget % 40)) yield;
      const rng = makeRng((ix * 73856093) ^ (iz * 19349663) ^ 0x9e3779b9), onPath = ce.path > 0.4 || ce.camp > 0.5, sc = (a, b) => (a + rng() * (b - a)) * fade;
      const dens2 = dens * (ce.ok ? 1 : 0) * farK, bio = ce.bio;
      // per-biome densities (per m^2), modulated by drifts so cover forms clumps and clearings, never a uniform sprinkle
      const clump = Math.max(0, (ce.drift - 0.38) * 3.2), clump2 = Math.max(0, (ce.drift2 - 0.42) * 2.8), under = Math.max(0, (ce.under - 0.4) * 2.6);
      const nf = bio === 'meadow' ? 4 + 34 * clump : bio === 'woodland' ? 0.8 + 6 * clump2 * (1 - Math.min(1, under)) : 1.2 + 4 * clump;
      const ncl = (bio === 'meadow' ? 3.5 : bio === 'woodland' ? 1.8 : 0.8) * (0.4 + clump2 * 1.4), nse = (bio === 'meadow' ? 1.8 : bio === 'woodland' ? 0.5 : 0.7) * (0.4 + clump * 1.2);
      const nle = (bio === 'woodland' ? 7 + 9 * under : bio === 'rocky' ? 1.5 : 0.6) + (onPath ? 1.5 : 0), npe = (ce.bank > 0.25 ? 3.2 : bio === 'rocky' ? 2.2 : 0.2) + (onPath ? 0.7 : 0), ntw = bio === 'woodland' ? 0.55 + 0.9 * under : 0.12;
      const cnt = (n) => Math.floor(n + rng()) ;
      if (dens2 > 0 && !onPath) {
        for (let k = cnt(nf * 0.15 * dens2); k > 0; k--) { c.copy(FC[Math.floor(rng() * (clump > 0.3 ? FC.length : 4))]); const cc = c.clone().multiplyScalar(0.9 + rng() * 0.25); put('flower', ix + rng(), iz + rng(), rng() * 6.28, sc(0.6, 1.2), sc(0.6, 1.1) + 0.001, cc); }
        for (let k = cnt(ncl * dens2); k > 0; k--) put('clover', ix + rng(), iz + rng(), rng() * 6.28, sc(0.8, 1.6), 1, CL[Math.floor(rng() * 3)]);
        for (let k = cnt(nse * dens2); k > 0; k--) put('seed', ix + rng(), iz + rng(), rng() * 6.28, sc(0.8, 1.4), sc(0.6, 1.3) + 0.001, SD[Math.floor(rng() * 3)]);
      }
      if (dens2 > 0 && !onPath && L.t_mk_grass_tall) {
        const mead = bio === 'meadow', wood = bio === 'woodland', rich = Math.min(2.0, (0.45 + clump * 1.2 + clump2 * 0.4) * 1.8), W = (a, b, c) => (mead ? a : wood ? b : c) * dens2 * rich * seasonK[0], tint = (lo) => { const v = (lo + rng() * (1 - lo)) * 1.15; return new THREE.Color(v * seasonK[1][0], v * 1.02 * seasonK[1][1], v * 0.95 * seasonK[1][2]); };
        for (let k = cnt(W(0.32, 0.12, 0.12)); k > 0; k--) put('t_mk_grass_tall', ix + rng(), iz + rng(), rng() * 6.28, sc(0.28, 0.5), sc(0.28, 0.52), tint(0.85));
        for (let k = cnt(W(0.12, 0.05, 0.05)); k > 0; k--) put('t_mk_grass_wispy', ix + rng(), iz + rng(), rng() * 6.28, sc(0.28, 0.5), sc(0.28, 0.5), tint(0.85));
        for (let k = cnt(W(0.4, 0.2, 0.18)); k > 0; k--) put('t_mk_grass_short', ix + rng(), iz + rng(), rng() * 6.28, sc(0.42, 0.77), sc(0.49, 0.84), tint(0.85));
        for (let k = cnt(W(0.012 * (0.4 + clump * 3), 0.006, 0.008)); k > 0; k--) put('t_mk_flower3', ix + rng(), iz + rng(), rng() * 6.28, sc(0.2, 0.35), sc(0.21, 0.36), tint(0.9));
        for (let k = cnt(W(0.006 * (0.4 + clump * 3), 0.004, 0.004)); k > 0; k--) put('t_mk_flower4', ix + rng(), iz + rng(), rng() * 6.28, sc(0.18, 0.32), sc(0.18, 0.32), tint(0.9));
        for (let k = cnt(W(0.01, 0.06 * (0.3 + under * 2), 0.01)); k > 0; k--) put('t_mk_mushroom', ix + rng(), iz + rng(), rng() * 6.28, sc(0.5, 0.9), sc(0.5, 0.9), tint(0.9));
        for (let k = cnt(W(0.1, 0.07, 0.05)); k > 0; k--) put('t_mk_clover', ix + rng(), iz + rng(), rng() * 6.28, sc(0.42, 0.77), sc(0.42, 0.7), tint(0.85));
      }
      if (ce.ok || ce.bank >= 0.8) { for (let k = cnt(nle * dens); k > 0; k--) { if (!ce.ok) break; put('litter', ix + rng(), iz + rng(), rng() * 6.28, sc(0.8, 1.7), 1, LC[Math.floor(rng() * LC.length)]); } for (let k = cnt(ntw * dens); k > 0; k--) put('twig', ix + rng(), iz + rng(), rng() * 6.28, sc(0.7, 1.4), 1, TW[Math.floor(rng() * 2)]); }
      if (ce.ok || ce.bank > 0.3) for (let k = cnt(npe * dens); k > 0; k--) { const x = ix + rng(), z = iz + rng(); if (depthAt(x, z) > 0) continue; put('pebble', x, z, rng() * 6.28, sc(0.6, 1.6), sc(0.5, 1.2) + 0.001, PEB[Math.floor(rng() * 4)]); }
    }
  }
  const swap = () => { for (const k in L) { const l = L[k], im = l.im; im.instanceMatrix.array.set(l.back.subarray(0, l.n * 16)); im.instanceColor.array.set(l.backCol.subarray(0, l.n * 3)); im.count = l.n; im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; } };
  grp.userData.stats = () => Object.fromEntries(Object.entries(L).map(([k, l]) => [k, l.im.count]));
  /** Call every frame with the player position; works for ~msBudget per call and swaps buffers when a rebuild finishes. */
  grp.userData.update = (fx, fz, dens = 1, msBudget = 2.5, force = false, reach = R) => {
    if (Math.abs(reach - R) > 0.5) { R = reach; center = null; }
    if (force) { job = rebuild(fx, fz, dens); center = [fx, fz]; density = dens; while (!job.next().done); job = null; swap(); return; }
    if (!job) { if (!center || Math.hypot(fx - center[0], fz - center[1]) > Math.max(3.5, R * 0.22) || Math.abs(dens - density) > 0.15) { job = rebuild(fx, fz, dens); center = [fx, fz]; density = dens; } else return; }
    const t0 = performance.now(); while (performance.now() - t0 < msBudget) { if (job.next().done) { job = null; swap(); return; } }
  };
  return grp;
}
