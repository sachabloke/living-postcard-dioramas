// Grand map: a 20×20 grid of biome cells. The home clearing is one cell. Neighbouring cells may differ by at most ONE step of
// elevation and ONE of moisture (so mountains never touch grassland: there is always foothills / highland between), and sampling
// blends cell-to-cell smoothly, so there is never a hard biome edge. Pure and seeded: node-testable, shared by terrain / colour / cover later.
import { makeRng } from './rng.js';

export const N = 20, CELL = 240, HOME = { i: 10, j: 10 };          // metres per cell; the home cell is centred on the world origin
export const ELEV = ['coast', 'lowland', 'hills', 'highland', 'mountain', 'snow'];
// biome = f(elevation step 0..5, moisture 0 dry .. 2 wet). Names match terrain.regionAt() regions so they plug straight in.
export const BIOMES = {
  sea: { col: '#3f78b5' }, beach: { col: '#e3d29a' },
  downs: { col: '#a9c872' }, woodland: { col: '#4f9a4e' }, marsh: { col: '#6b8f68' },
  gold: { col: '#d2b25a' }, hill: { col: '#7fae5c' }, blossom: { col: '#e5a9c0' },
  moor: { col: '#9a8a6a' }, mount: { col: '#7d7f86' }, snow: { col: '#f2f6fa' },
};
export function biomeOf(e, m) {
  if (e <= 0) return m === 0 ? 'beach' : 'sea';
  if (e === 1) return ['downs', 'woodland', 'marsh'][m];
  if (e === 2) return ['gold', 'hill', 'blossom'][m];
  if (e === 3) return 'moor';
  return e === 4 ? 'mount' : 'snow';
}
const smooth = (t) => t * t * (3 - 2 * t);
function lattice(rng, size) { const a = []; for (let i = 0; i < size; i++) { a.push([]); for (let j = 0; j < size; j++) a[i].push(rng()); } return a; }
function noise2(L, x, y) {   // smooth value noise over a lattice (wraps by clamping)
  const n = L.length, x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0), g = (i, j) => L[Math.max(0, Math.min(n - 1, i))][Math.max(0, Math.min(n - 1, j))];
  return (g(x0, y0) * (1 - fx) + g(x0 + 1, y0) * fx) * (1 - fy) + (g(x0, y0 + 1) * (1 - fx) + g(x0 + 1, y0 + 1) * fx) * fy;
}
/** 1-Lipschitz upper envelope over ALL cells (Chebyshev distance): afterwards every pair of neighbouring cells differs by at most 1. */
function envelope(v) {
  const out = v.map(r => r.slice());
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) for (let l = 0; l < N; l++) out[i][j] = Math.min(out[i][j], v[k][l] + Math.max(Math.abs(i - k), Math.abs(j - l)));
  return out;
}
/** Build the world: {elev[i][j], moist[i][j], biome[i][j]}. Pinned: home = lowland woodland; the outer ring is coast / sea (an island). */
export const WORLD_SEED = 61;                                      // picked by eye from a scan: all 11 biomes, ~70% land, a snow-capped range, lakes and a coast
export function makeWorld(seed = WORLD_SEED) {
  const r = makeRng(seed), LE = lattice(r, 8), LE2 = lattice(r, 16), LM = lattice(r, 8), LM2 = lattice(r, 16);
  const elev = [], moist = [], edge = (i, j) => i === 0 || j === 0 || i === N - 1 || j === N - 1;
  for (let i = 0; i < N; i++) { elev.push([]); moist.push([]); for (let j = 0; j < N; j++) {
    const E = 0.7 * noise2(LE, i / 4, j / 4) + 0.3 * noise2(LE2, i / 2, j / 2), M = 0.7 * noise2(LM, i / 4, j / 4) + 0.3 * noise2(LM2, i / 2, j / 2);
    elev[i].push(edge(i, j) ? 0 : Math.max(0, Math.min(5, Math.floor((0.52 + (E - 0.5) * 4.0) * 6)))); moist[i].push(Math.max(0, Math.min(2, Math.floor((0.5 + (M - 0.5) * 2.2) * 3))));
  } }
  elev[HOME.i][HOME.j] = 1; moist[HOME.i][HOME.j] = 1;
  const e2 = envelope(elev), m2 = envelope(moist);
  const biome = e2.map((row, i) => row.map((e, j) => (edge(i, j) ? 'sea' : biomeOf(e, m2[i][j]))));   // the outer ring is always open sea, so the world ends in water
  return { seed, elev: e2, moist: m2, biome };
}
const cellOf = (x, z) => [x / CELL + HOME.i + 0.5, z / CELL + HOME.j + 0.5];     // continuous cell coords (cell centre at integer + 0.5 → shifted below)
/** Smooth sample at world metres: continuous elevation 0..5, moisture 0..2, and biome weights (a partition of unity). */
export function worldAt(w, x, z) {
  const warp = 0.12, [cx, cz] = cellOf(x, z), wx = cx + warp * Math.sin(z / 61 + x / 97) + warp * 0.5 * Math.sin(z / 23 - x / 37), wz = cz + warp * Math.sin(x / 71 - z / 89) + warp * 0.5 * Math.sin(x / 29 + z / 41);
  const u = wx - 0.5, v = wz - 0.5, i0 = Math.floor(u), j0 = Math.floor(v), plate = (t) => smooth(Math.max(0, Math.min(1, (t - 0.25) / 0.5))), fu = plate(u - i0), fv = plate(v - j0);   // each cell keeps a flat middle; the blend lives in the band around its edges
  let e = 0, m = 0; const weights = {};
  const at = (i, j) => [Math.max(0, Math.min(N - 1, i)), Math.max(0, Math.min(N - 1, j))];
  for (const [di, dj, wgt] of [[0, 0, (1 - fu) * (1 - fv)], [1, 0, fu * (1 - fv)], [0, 1, (1 - fu) * fv], [1, 1, fu * fv]]) {
    const [i, j] = at(i0 + di, j0 + dj); e += w.elev[i][j] * wgt; m += w.moist[i][j] * wgt; weights[w.biome[i][j]] = (weights[w.biome[i][j]] || 0) + wgt;
  }
  let best = null; for (const k in weights) if (!best || weights[k] > weights[best]) best = k;
  return { elev: e, moist: m, weights, dominant: best };
}
