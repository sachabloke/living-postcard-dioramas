// ONE authoritative ground surface. The visible mesh, the player's feet, props' roots, rocks, the bridge deck and
// collisions all call groundAt()/depthAt(). Nothing else may define a height. Pure module (no three.js).
// STREAMED WORLD (prototype): x east, z south, unbounded. The surface is a pure function of world position, sampled on a global
// 1 m vertex grid, so any tile edge is exact by construction. Tiles (TILE m square, aligned so the hand-built HOME area is whole tiles)
// are only loading units; crossing an edge never changes position, facing or height.
import { makeWorld, worldAt } from "./worldmap.js";
export const TILE = 48, TILE_ORIGIN_X = -72, TILE_ORIGIN_Z = -96;           // tile edges at x = -72,-24,24,72 ... and z = -96,-48,0,48,96 ...
export const tileOf = (x, z) => [Math.floor((x - TILE_ORIGIN_X) / TILE), Math.floor((z - TILE_ORIGIN_Z) / TILE)];
export const tileRect = (tx, tz) => ({ x0: TILE_ORIGIN_X + tx * TILE, z0: TILE_ORIGIN_Z + tz * TILE, x1: TILE_ORIGIN_X + (tx + 1) * TILE, z1: TILE_ORIGIN_Z + (tz + 1) * TILE });
export const tileKey = (tx, tz) => `${tx},${tz}`;
export const SEAM_Z = 0;                                                       // kept for the old optional gate only (no longer a barrier)
export const BOUNDS = { minX: -62, maxX: 62, minZ: -84, maxZ: 84 };           // the hand-built HOME core (camp, hut, bridge, gate); tiles around it are generated
export const CAMP = { x: 16, z: 44 };
export const HUT = { x: 28, z: 51, half: 2.2, door: 1.2 };   // 4.4 m square cabin; door gap centred on the WEST wall (faces the camp)

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (i, j) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return (hash(i, j) * (1 - u) + hash(i + 1, j) * u) * (1 - v) + (hash(i, j + 1) * (1 - u) + hash(i + 1, j + 1) * u) * v;
}
export const fbm = (x, z) => 0.55 * vnoise(x * 0.045, z * 0.045) + 0.3 * vnoise(x * 0.11 + 9, z * 0.11 - 4) + 0.15 * vnoise(x * 0.27 - 3, z * 0.27 + 7);

export const riverX = (z) => -9 + 7 * Math.sin(z / 17) + 3 * Math.sin(z / 6.5 + 1.2);   // centreline
export const SEA_Y = -6;                                                              // constant sea level, below the river's lowest level (-3.9) so the two never meet
export const waterY = (z) => 1.3 - 5.2 * Math.sin(z / 290);                            // flows towards +z; bounded so the world can run for kilometres
const profile = (d) => -1.0 * (1 - sstep(1.8, 5.4, d)) + 0.38 * sstep(4.5, 8.5, d);       // bed -> bank, metres relative to water level

/** Far regions (beyond the home core, blended in over ~90 m): mountains with a snowline, snowfields, rolling highland moor. Pure and cheap; shared by height, colour, cover and tiles. */
const trailXc = (z) => -34 + 4 * Math.sin((z + 40) / 41) + 2 * Math.sin((z + 40) / 15 + 0.7) + 7.7 * Math.exp((z + 40) / 25);   // same centreline as tiles.js trailX: regions keep a gentle corridor round the long trail
let worldMap = null, useWorldMap = true;
/** Switch between the grand map (default) and the older independent-noise regions (kept for A/B checks). Clears the height cache. */
export function setWorldMap(on) { useWorldMap = !!on; HC.clear(); }
function regionFromMap(x, z, far) {
  worldMap ||= makeWorld();
  const w = worldAt(worldMap, x, z).weights, g = (k) => (w[k] || 0) * far, mount = g('mount') + g('snow');
  const ridge = 1 - Math.abs(2 * vnoise(x * 0.006 + 7, z * 0.006 - 3) - 1), mh = mount * (6 + 22 * Math.pow(ridge, 1.3) + 3 * (vnoise(x * 0.03, z * 0.03) - 0.5));
  const snowAmt = Math.min(1, Math.max(g('snow'), sstep(13, 22, mh + 3 * (fbm(x * 2.1 + 5, z * 2.1) - 0.5))));
  return { far, mount, snow: 0, moor: g('moor'), mh, snowAmt, sea: g('sea'), hill: g('hill'), blossom: g('blossom'), gold: g('gold'), marsh: g('marsh'), downs: g('downs') };
}
export function regionAt(x, z) {
  if (WS) return WS.region(x, z);
  const dx = Math.max(0, Math.abs(x) - 62), dz = Math.max(0, Math.abs(z) - 84), corr = z < -38 ? sstep(8, 45, Math.abs(x - trailXc(z))) : 1, far = sstep(60, 150, Math.hypot(dx, dz)) * corr;
  if (far > 0 && useWorldMap) return regionFromMap(x, z, far);
  if (far <= 0) return { far: 0, mount: 0, snow: 0, moor: 0, mh: 0, snowAmt: 0, sea: 0, hill: 0, blossom: 0, gold: 0, marsh: 0, downs: 0 };
  const q = 0.72 * vnoise(x * 0.0042 + 50, z * 0.0042 + 20) + 0.28 * vnoise(x * 0.011 - 8, z * 0.011 + 31), p = 0.72 * vnoise(x * 0.0038 - 40, z * 0.0038 + 77) + 0.28 * vnoise(x * 0.01 + 9, z * 0.01 - 5);
  const o = 0.72 * vnoise(x * 0.0035 + 120, z * 0.0035 - 60) + 0.28 * vnoise(x * 0.009 - 17, z * 0.009 + 44), h2 = 0.72 * vnoise(x * 0.004 - 90, z * 0.004 + 15) + 0.28 * vnoise(x * 0.01 + 3, z * 0.01 - 29);
  const mount = sstep(0.56, 0.74, q) * far, snow = (1 - sstep(0.26, 0.42, q)) * far, free = (1 - mount) * (1 - snow);
  const sea = sstep(0.6, 0.74, o) * far * free, moor = sstep(0.56, 0.72, p) * far * free * (1 - sea), hill = sstep(0.5, 0.64, h2) * far * free * (1 - sea) * (1 - moor);
  const ridge = 1 - Math.abs(2 * vnoise(x * 0.006 + 7, z * 0.006 - 3) - 1), mh = mount * (6 + 22 * Math.pow(ridge, 1.3) + 3 * (vnoise(x * 0.03, z * 0.03) - 0.5));
  const snowAmt = Math.min(1, Math.max(snow, sstep(13, 22, mh + 3 * (fbm(x * 2.1 + 5, z * 2.1) - 0.5))));
  const e = 0.72 * vnoise(x * 0.0033 - 210, z * 0.0033 + 95) + 0.28 * vnoise(x * 0.0085 + 60, z * 0.0085 - 12), g = 0.72 * vnoise(x * 0.0031 + 310, z * 0.0031 - 140) + 0.28 * vnoise(x * 0.008 - 33, z * 0.008 + 71);
  const rest = far * free * (1 - sea) * (1 - moor) * (1 - hill), blossom = sstep(0.6, 0.72, e) * rest, gold = (1 - sstep(0.28, 0.4, e)) * rest * (1 - blossom);
  const marsh = sstep(0.6, 0.72, g) * rest * (1 - blossom) * (1 - gold), downs = (1 - sstep(0.28, 0.4, g)) * rest * (1 - blossom) * (1 - gold) * (1 - marsh);
  return { far, mount, snow, moor, mh, snowAmt, sea, hill, blossom, gold, marsh, downs };
}
function hills(x, z) {
  const n = fbm(x, z) - 0.42;
  const big = Math.sin(x / 23 + 0.7) * Math.cos(z / 29 - 0.4) * 1.5;
  let h = Math.max(0, n * 8.5 + big + 1.0);
  const dc = Math.hypot(x - CAMP.x, z - CAMP.z);                      // gentle campsite
  h *= 0.12 + 0.88 * sstep(5, 15, dc);
  h *= 0.1 + 0.9 * sstep(4, 11, Math.hypot(x - HUT.x, z - HUT.z));
  const rg = regionAt(x, z);
  return h * (1 - 0.5 * rg.snow) * (1 - 0.8 * rg.marsh);
}

/** The analytic definition of the land (used only to fill the height grid below). */
export function terrainExact(x, z) {
  if (WS) return WS.ground(x, z);
  const d = Math.abs(x - riverX(z));
  const rg = regionAt(x, z), big = rg.far > 0 ? Math.max(0, rg.mh + rg.moor * 6 * (vnoise(x * 0.025 + 3, z * 0.025) - 0.35)) : 0;   // mountains and moor keep a wide berth from the river so its valley stays gentle
  const hillH = (rg.hill > 0 ? rg.hill * (7 + 9 * (vnoise(x * 0.02 + 11, z * 0.02 - 4) - 0.35)) : 0) + (rg.downs > 0 ? rg.downs * (5 + 7 * (vnoise(x * 0.009 + 40, z * 0.009 - 8) - 0.4)) : 0) - 0.8 * rg.marsh, far80 = sstep(16, 80, d);
  const base = waterY(z) + profile(d) + hills(x, z) * sstep(5.5, 16, d) + (big + Math.max(0, hillH)) * far80;
  if (rg.sea <= 0) return base;
  const sf = rg.sea * sstep(30, 120, d);                                  // the sea keeps well away from the river; its floor is below SEA_Y so the shore is a gentle beach
  return base + (SEA_Y - 2 - 5 * sf - base) * sf;
}
// The AUTHORITATIVE surface is the global 1 m height grid, triangulated exactly like the visible mesh (three.js PlaneGeometry:
// triangles (a,b,d) and (b,c,d), diagonal b-d). Vertex (i,j) sits at world (i, j) metres and is computed lazily and cached, so
// feet, roots, water depth and collisions work anywhere, loaded or not; chunk meshes read the same vertices.
export const GRID = 1;
const HC = new Map();
/** Opt-in LOCAL watershed world (src/watershed.js). When set, height, water, regions and the colour info come from it; the home core, bridge, trail and old river are inert. */
export let WS = null;
export function useWatershed(ws) { WS = ws || null; HC.clear(); }
export const seaLevelY = () => (WS ? 0 : SEA_Y);
export function gridHeight(i, j) { const k = i * 100003 + j; let v = HC.get(k); if (v === undefined) { v = terrainExact(i * GRID, j * GRID); HC.set(k, v); if (HC.size > 400000) HC.delete(HC.keys().next().value); } return v; }
/** Terrain surface height (no bridge): exact triangle interpolation of the grid. */
export function terrainAt(x, z) {
  const fx = x / GRID, fz = z / GRID, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  const ha = gridHeight(i, j), hb = gridHeight(i, j + 1), hc = gridHeight(i + 1, j + 1), hd = gridHeight(i + 1, j);
  return u + v <= 1 ? ha + u * (hd - ha) + v * (hb - ha) : hc + (1 - u) * (hb - hc) + (1 - v) * (hd - hc);
}

// Footbridge over the river at z=30, centred on the river. Deck profile is MEASURED from the library model
// (Woodland_Footbridge: raycast of the real mesh, 3.93 m long, deck 0.216 m at the ends rising to 0.496 m mid-span),
// then scaled by the same factors the renderer applies to the model, so the visible planks and the feet agree.
export const BRIDGE = { x: 0, z: 30, halfLen: 6.6, halfWid: 1.15, y0: 0.15, sy: 1.3, sx: 6.6 * 2 / 3.93, sz: 1.5,
  table: [[0, 0.496], [0.167, 0.485], [0.333, 0.451], [0.5, 0.395], [0.667, 0.317], [0.833, 0.216], [1, 0.216]] };
BRIDGE.x = riverX(BRIDGE.z);
const onBridge = (x, z) => !WS && Math.abs(x - BRIDGE.x) <= BRIDGE.halfLen && Math.abs(z - BRIDGE.z) <= BRIDGE.halfWid;
export function deckY(x) {
  const u = Math.min(1, Math.abs(x - BRIDGE.x) / BRIDGE.halfLen), T = BRIDGE.table; let i = 0; while (i < T.length - 2 && u > T[i + 1][0]) i++;
  const f = (u - T[i][0]) / (T[i + 1][0] - T[i][0]); return waterY(BRIDGE.z) + BRIDGE.y0 + BRIDGE.sy * (T[i][1] + (T[i + 1][1] - T[i][1]) * f);
}
export const bridgeDeckY = () => deckY(BRIDGE.x);
/** The surface the feet stand on: terrain, or the footbridge deck (eased into the banks so there is no step). */
export function groundAt(x, z) {
  const t = terrainAt(x, z);
  if (!onBridge(x, z)) return t;
  const taper = sstep(BRIDGE.halfLen, BRIDGE.halfLen - 1.2, Math.abs(x - BRIDGE.x));
  return t + (Math.max(t, deckY(x)) - t) * taper;
}
/** Water depth in metres at a point (0 when dry). Over the bridge deck you are not wading. */
export function depthAt(x, z) { if (WS) return WS.depth(x, z); if (onBridge(x, z)) return 0; const t = terrainAt(x, z), r = waterY(z) - t; if (r <= 0) return 0; if (Math.abs(x - riverX(z)) > 28 && regionAt(x, z).sea > 0.02) return Math.max(0, SEA_Y - t); return r; }   // river water below the river level; sea water below the constant sea level
export function slopeAt(x, z, e = 0.5) {
  const gx = (groundAt(x + e, z) - groundAt(x - e, z)) / (2 * e), gz = (groundAt(x, z + e) - groundAt(x, z - e)) / (2 * e);
  return Math.hypot(gx, gz);
}
export const areaOf = (z) => (z < SEAM_Z ? 'woodland' : 'clearing');

/** Ground tint weights for vertex colouring (renderer only; derived from the same surface). */
export function surfaceInfo(x, z) {
  if (WS) {   // nearest-water distance by probing the real water depth; the home camp and path do not exist here
    let d = 12; for (const r of [1.5, 3, 5, 7.5, 10]) { if (WS.depth(x + r, z) > 0 || WS.depth(x - r, z) > 0 || WS.depth(x, z + r) > 0 || WS.depth(x, z - r) > 0) { d = r; break; } }
    const s = slopeAt(x, z), h = fbm(x * 1.7 + 40, z * 1.7 - 10), rg = regionAt(x, z);
    return { bank: 1 - sstep(4.5, 8.5, d), rock: Math.min(1, sstep(0.45, 0.85, s) + 0.45 * rg.mount * (1 - rg.snowAmt)), patch: h, camp: 0, path: 0, dist: d, snow: rg.snowAmt * (1 - 0.5 * sstep(0.7, 1.1, s)), moor: rg.moor, mount: rg.mount, gold: 0, marsh: 0, downs: 0, blossom: 0 };
  }
  const d = Math.abs(x - riverX(z)), s = slopeAt(x, z), h = fbm(x * 1.7 + 40, z * 1.7 - 10), dc = Math.hypot(x - CAMP.x, z - CAMP.z);
  const rg = regionAt(x, z);
  return { bank: 1 - sstep(5.5, 9.5, d), rock: Math.min(1, sstep(0.45, 0.85, s) + 0.45 * rg.mount * (1 - rg.snowAmt)), patch: h, camp: 1 - sstep(3, 7.5, dc), path: pathWeight(x, z), dist: d, snow: rg.snowAmt * (1 - 0.5 * sstep(0.7, 1.1, s)), moor: rg.moor, mount: rg.mount, gold: rg.gold, marsh: rg.marsh, downs: rg.downs, blossom: rg.blossom };
}
// A worn path from the campsite to the bridge, then from the far bank north to the seam gate and into the woodland.
export const PATH = [[CAMP.x, CAMP.z], [10, 40], [5, 34.5], [BRIDGE.x + 7.5, 30], [BRIDGE.x - 7.5, 30], [-20, 24], [-22, 14], [-21, 4], [-22, -6], [-27, -14], [-28, -26], [-25, -40]];
export function pathWeight(x, z) {
  if (WS) return 0;
  let best = 99;
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, az] = PATH[i], [bx, bz] = PATH[i + 1], vx = bx - ax, vz = bz - az, t = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    best = Math.min(best, Math.hypot(x - (ax + t * vx), z - (az + t * vz)));
  }
  return 1 - sstep(0.9, 2.2, best);
}
export const GATE = { x: -21, z: 1.2, r: 2.4 };   // crossing ring just south of the seam, on the path
