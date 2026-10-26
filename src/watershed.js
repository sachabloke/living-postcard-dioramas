// The "watershed-v1-seed61" landscape: an opt-in local world whose height, lakes, sea and rivers come from the drainage study in outputs/forest-watershed-preview
// (240x240 nodes over 4.8 km, priority-flood spill levels, routed streams). Pure module (no three.js). terrain.js asks this ONE module for ground height, water depth
// and regions when the world is active, so the visible mesh, the feet, props, collisions and the water surface all agree.
//
// Transform (from the study): node index = col + row*n; world x = col*spacing - 2520, world z = row*spacing - 2520; y is the study's height in metres above sea level 0.
// Water:  sea = connected ocean nodes at level 0;  lake = nodes with filled-height > 0, flat surface at the filled level (each lake its own level);
//         streams = the study's routed centrelines above a catchment threshold, here CARVED as shallow beds below a monotonically descending surface.
export const WS_ID = 'watershed-v1-seed61';
export const ORIGIN = -2520, STREAM_AREA = 90000;   // m2 of catchment (the study's river threshold)
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (i, j) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, z) { const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v; }

export function makeWatershed(buf) {
  const dv = new DataView(buf), n = dv.getInt32(0, true), sp = 4800 / (n - 1), N = n * n; let o = 8;   // exact spacing (the file stores it as float32)
  const f32 = (len) => { const a = new Float32Array(buf.slice(o, o + len * 4)); o += len * 4; return a; };
  const height = f32(N), filled = f32(N), down = new Int32Array(buf.slice(o, o + N * 4)); o += N * 4; const area = f32(N), ocean = new Uint8Array(buf.slice(o, o + N));
  const node = (c, r) => Math.min(n - 1, Math.max(0, c)) + Math.min(n - 1, Math.max(0, r)) * n;
  const wetLevel = (i) => (ocean[i] ? 0 : filled[i] - height[i] > 1e-7 ? filled[i] : NaN);   // flat water surface of a sea / lake node, NaN when dry
  // ---- stream segments (node centre -> downstream node centre), hashed by node cell
  const segs = [], hashMap = new Map(), cellOf = (x) => Math.floor((x - ORIGIN) / sp);
  const key = (a, b) => a * 1024 + b;
  for (let i = 0; i < N; i++) {
    const d = down[i]; if (d < 0 || ocean[i] || area[i] < STREAM_AREA || filled[i] - height[i] > 1e-7) continue;
    const c0 = i % n, r0 = (i / n) | 0, c1 = d % n, r1 = (d / n) | 0, a = area[i] / 1e5, k = segs.length;
    segs.push({ x0: c0 * sp + ORIGIN, z0: r0 * sp + ORIGIN, x1: c1 * sp + ORIGIN, z1: r1 * sp + ORIGIN, s0: filled[i], s1: filled[d], hw: Math.min(7, 1.1 + 0.95 * Math.sqrt(a)), bd: Math.min(1.6, 0.12 + 0.16 * Math.sqrt(a)), area: area[i] });
    for (let dc = -2; dc <= 3; dc++) for (let dr = -2; dr <= 3; dr++) { const kk = key(Math.min(c0, c1) + dc, Math.min(r0, r1) + dr); let l = hashMap.get(kk); if (!l) hashMap.set(kk, l = []); if (l[l.length - 1] !== k) l.push(k); }
  }
  const BANK = 0.5;   // bank slope (m rise per m) from the waterline until the natural ground takes over
  // ---- one sample of the whole surface; cached for the last point because ground() and depth() are usually asked together
  let cx = NaN, cz = NaN; const S = { g: 0, depth: 0, level: -Infinity, near: -Infinity, flowX: 0, flowZ: 1 };
  function sample(x, z) {
    if (x === cx && z === cz) return S; cx = x; cz = z;
    const fu = Math.min(n - 1.001, Math.max(0, (x - ORIGIN) / sp)), fv = Math.min(n - 1.001, Math.max(0, (z - ORIGIN) / sp)), c = Math.floor(fu), r = Math.floor(fv), a = fu - c, b = fv - r;
    const i00 = c + r * n, i10 = i00 + 1, i01 = i00 + n, i11 = i01 + 1, w00 = (1 - a) * (1 - b), w10 = a * (1 - b), w01 = (1 - a) * b, w11 = a * b;
    let g = height[i00] * w00 + height[i10] * w10 + height[i01] * w01 + height[i11] * w11;
    let ws = 0, wl = 0;   // weights of wet (sea/lake) corners and their weighted level
    for (const [i, w] of [[i00, w00], [i10, w10], [i01, w01], [i11, w11]]) { const L = wetLevel(i); if (L === L) { ws += w; wl += w * L; } }
    g += (vnoise(x * 0.09, z * 0.09) - 0.5) * 2.2 * (1 - ws) + (vnoise(x * 0.31 + 5, z * 0.31 - 7) - 0.5) * 0.7 * (1 - ws);   // small relief, absent in lake and sea beds
    let level = ws > 1e-6 ? wl / ws : -Infinity, flowX = 0, flowZ = 1;
    // streams: carve a shallow bed below the descending surface and flood it (never above the natural ground elsewhere)
    const list = hashMap.get(key(cellOf(x), cellOf(z))); let sLevel = -Infinity, sNear = -Infinity;
    if (list) for (const k of list) {
      const s = segs[k], vx = s.x1 - s.x0, vz = s.z1 - s.z0, t = Math.min(1, Math.max(0, ((x - s.x0) * vx + (z - s.z0) * vz) / (vx * vx + vz * vz))), d = Math.hypot(x - (s.x0 + vx * t), z - (s.z0 + vz * t));
      const reach = s.hw + 14; if (d > reach) continue; const sur = s.s0 + (s.s1 - s.s0) * t;
      const cut = d < s.hw ? sur - s.bd * (1 - (d / s.hw) * (d / s.hw)) : sur + BANK * (d - s.hw);
      if (cut < g) g = cut;
      if (d < s.hw + 1.6 && sur > sNear) sNear = sur;   // the surface a shoreline mesh should continue to, just past the waterline
      if (d < s.hw && sur > sLevel) { sLevel = sur; const l = Math.hypot(vx, vz) || 1; flowX = vx / l; flowZ = vz / l; }
    }
    const lakeNear = level;   // sea / lake surface continues under the rim so the mesh crosses the ground exactly at the shoreline
    if (sLevel > level) { level = sLevel; }
    S.g = g; S.near = Math.max(lakeNear, sNear); S.level = level; S.depth = level > g ? level - g : 0; S.flowX = flowX; S.flowZ = flowZ; return S;
  }
  const ground = (x, z) => sample(x, z).g;
  const depth = (x, z) => sample(x, z).depth;
  /** Land regions in terrain.regionAt's vocabulary (weights 0..1) from elevation; the whole island counts as "far" so the home-core logic stays off. */
  const region = (x, z) => { const h = sample(x, z).g, mount = sstep(170, 270, h), snow = sstep(310, 370, h), moor = sstep(95, 160, h) * (1 - mount);
    return { far: 1, mount, snow, moor, mh: 0, snowAmt: Math.max(snow, sstep(330, 390, h)), sea: 0, hill: sstep(30, 90, h) * (1 - mount) * (1 - moor), blossom: 0, gold: 0, marsh: 0, downs: 0 }; };
  /** The nearest dry, gently sloped ground from (x,z): ring search on the real surface (used for the spawn). */
  const slope = (x, z, e = 0.7) => Math.hypot((ground(x + e, z) - ground(x - e, z)) / (2 * e), (ground(x, z + e) - ground(x, z - e)) / (2 * e));
  const stats = () => ({ n, spacing: sp, streamSegments: segs.length, lakeNodes: (() => { let k = 0; for (let i = 0; i < N; i++) if (!ocean[i] && filled[i] - height[i] > 1e-7) k++; return k; })() });
  return { id: WS_ID, n, spacing: sp, height, filled, down, area, ocean, segs, sample, ground, depth, region, slope, stats, level: (x, z) => sample(x, z).level, flow: (x, z) => { const s = sample(x, z); return [s.flowX, s.flowZ]; } };
}
/** The study's dry-clearing candidate (index 34467, col 147, row 143). Must be validated against real props before use. */
export const SPAWN_CANDIDATE = { x: 432.3012552301252, z: 351.9665271966528, ground: 235.6465375485732 };
