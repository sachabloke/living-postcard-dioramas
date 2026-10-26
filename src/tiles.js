// Deterministic content for streamed tiles outside the hand-built HOME core. Pure (no three.js): a tile's props/colliders/nodes are a
// function of (tx, tz, seed) only, so unloading and reloading gives the identical tile and tests can check every property numerically.
import { makeRng } from './rng.js';
import { GROK } from './grok_props.js';
import { groundAt, depthAt, slopeAt, riverX, waterY, fbm, pathWeight, tileRect, tileKey, BOUNDS, regionAt, SEA_Y, WS, seaLevelY } from './terrain.js';

export const BIOMES = ['meadow', 'woodland', 'rocky'];
const hashSeed = (tx, tz, seed) => (Math.imul(tx + 1000, 73856093) ^ Math.imul(tz + 1000, 19349663) ^ Math.imul(seed, 83492791)) >>> 0;
/** Biome from smooth world-space noise, so neighbouring tiles blend (a biome rarely changes abruptly at an edge). */
export function biomeAt(x, z) { const rg = regionAt(x, z); if (rg.far > 0.5) { if (rg.mount > 0.5 || rg.moor > 0.5) return 'rocky'; if (rg.snow > 0.5 || rg.gold > 0.5) return 'woodland'; if (rg.blossom > 0.5 || rg.marsh > 0.5 || rg.downs > 0.5) return 'meadow'; }   // far regions: peaks and moor are rocky, snowfields are pine forest
  const n = fbm(x * 0.55 + 300, z * 0.55 - 120); return n < 0.4 ? 'meadow' : n < 0.62 ? 'woodland' : 'rocky'; }
const inHomeCore = (x, z, m = 0) => !WS && x > BOUNDS.minX - m && x < BOUNDS.maxX + m && z > BOUNDS.minZ - m && z < BOUNDS.maxZ + m;
// the long trail continues the home path's north end (-25,-40) forever; deterministic, so both sides of every tile edge agree where it runs
export const trailX = (z) => -34 + 4 * Math.sin((z + 40) / 41) + 2 * Math.sin((z + 40) / 15 + 0.7) + 7.7 * Math.exp((z + 40) / 25);   // starts at the home path's end (-25,-40), then keeps to the west bank of the river
export function trailWeight(x, z) { if (WS || z > -38) return 0; const d = Math.abs(x - trailX(z)); return 1 - Math.min(1, Math.max(0, (d - 0.9) / 1.3)); }
export const pathAny = (x, z) => Math.max(pathWeight(x, z), trailWeight(x, z));

const TREE = { m: 'tree_hero_broadleaf_01_mobile', r: 0.42 }, GOLD_TREE = { m: 'tree_hero_broadleaf_01_mobile_gold', r: 0.42 };
const CLAUDE_ROCKS = [{ m: 'rock_boulder_bare_mobile', r: 0.78 }, { m: 'rock_spire_bare_mobile', r: 0.58 }];
const DENS = {   // per-tile counts by biome
  meadow:   { tree: 7, rock: 2, bush: 8, shrub: 6, fern: 5, flower: 34, log: 1, stump: 1, mush: 1 },
  woodland: { tree: 34, rock: 3, bush: 12, shrub: 5, fern: 26, flower: 8, log: 3, stump: 4, mush: 3 },
  rocky:    { tree: 5, rock: 13, bush: 5, shrub: 3, fern: 8, flower: 6, log: 1, stump: 2, mush: 1 },
};


/** Themed corners. Each item: [model, kind, count, scatter radius m, min scale, max scale, collider radius at scale 1, solid?] */
const THEMES = [
  { name: 'flower_glade', items: [['Cut_Stump', 'deco', 1, 0.5, 1.4, 1.6, 0, false], ['Flower_151', 'deco', 16, 5, 1.6, 2.6, 0, false], ['Flower_150', 'deco', 12, 5, 2, 3, 0, false], ['Bush_80', 'bush', 3, 6, 0.9, 1.2, 0.8, true], ['fm_mushroom_ring', 'deco', 1, 4, 1, 1.3, 0, false]] },
  { name: 'woodcutters_clearing', items: [['Timber_Stack', 'grock', 2, 3, 1, 1.2, 0.7, true], ['Timber_Log', 'deco', 5, 3.5, 1.2, 1.7, 0, false], ['Log_Bench', 'grock', 2, 3, 1.1, 1.4, 0.35, true], ['Cut_Stump', 'deco', 4, 4, 1.2, 1.8, 0, false], ['Woodland_Workbench', 'grock', 1, 2, 1, 1.1, 0.7, true], ['Trail_Sign', 'grock', 1, 4, 1.1, 1.3, 0.3, true]] },
  { name: 'fern_hollow', items: [['Fern_170', 'deco', 18, 6, 1.3, 2.2, 0, false], ['Hollow_Log', 'grock', 1, 2.5, 0.7, 0.9, 1.1, true], ['Woodland_Mushrooms', 'deco', 3, 4.5, 1, 1.5, 0, false], ['Bush_82', 'bush', 3, 6, 0.9, 1.3, 0.8, true]] },
  { name: 'boulder_garden', items: [['Rock_100', 'rock', 2, 4, 1, 1.5, 0.7, true], ['Rock_101', 'rock', 2, 4, 1, 1.4, 0.6, true], ['Rock_102', 'rock', 2, 4, 1, 1.4, 0.6, true], ['Fern_170', 'deco', 6, 5, 1.2, 1.8, 0, false], ['Bush_82', 'bush', 3, 5.5, 0.9, 1.3, 0.8, true], ['Flower_151', 'deco', 8, 5, 1.6, 2.4, 0, false]] },
];
/** every model the themes can place, so main.js can make a render kind for it even when no sampled tile uses it */
/** Synty (SyntyPass) pieces: alpine pines/cabin, swamp mangroves/reeds. Sizes in metres. See synty-raw/SYNTY_INTAKE.md */
const SYN = { alp_Prop_Cabin_01: 'grock', alp_Prop_Wood_Pile_01: 'grock', alp_Prop_Chair_Log_01: 'deco', alp_Prop_Fish_Rack_01: 'grock', alp_Prop_Canoe_01: 'grock', alp_Env_Pine_01: 'tree', alp_Env_Pine_03: 'tree', alp_Env_Pine_05: 'tree', alp_Env_Bush_Flower_01: 'deco', swp_Env_Tree_Mangrove_01: 'tree', swp_Env_Tree_Mangrove_02: 'tree', swp_Env_Reeds_01: 'deco', swp_Env_Reeds_02: 'deco', swp_Env_MossMound_01: 'deco', swp_Env_Toetoe_01: 'deco', swp_Env_LillyPads_01: 'deco', nat_Rock_Pile_01: 'grock', nat_Prop_CampFire_01: 'grock', alp_Env_Rock_05: 'grock', alp_Env_Bush_01: 'deco', alp_Env_Moss_Lumps_01: 'deco', alp_Prop_Tent_01: 'grock', alp_Prop_Ice_Fishing_Hut_01: 'grock', alp_Prop_Bench_01: 'grock', swp_Env_Bush_Bramble_01: 'deco', swp_Prop_Swamp_Lantern_01: 'deco', swp_Env_Tree_Swamp_03: 'tree' };
export const THEME_MODELS = { ...SYN, fm_pine_a: 'tree', fm_pine_b: 'tree', fm_tree_blossom_spring: 'tree', tree_hero_broadleaf_01_mobile_gold: 'tree', fm_reeds_cattail_a: 'deco', fm_reeds_cattail_b: 'deco', fm_reeds_cattail_c: 'deco', fm_mud_patch_wet: 'deco', fm_stone_circle_piece: 'grock', fm_standing_stone: 'grock', fm_cairn: 'grock', ...Object.fromEntries(THEMES.flatMap(t => t.items.map(([m, k]) => [m, k]))) };

/** What a region offers: coast has little wood but driftwood and boulders; mountains are stone-rich; hills are open, flowery pasture. */
const regionDens = (b, rg) => { const D = DENS[b];
  if (rg.sea > 0.15) return { ...D, tree: Math.min(D.tree, 4), flower: 5, mush: 0, rock: D.rock + 3 };
  if (rg.mount > 0.5) return { ...D, tree: 3, rock: 20 };
  if (rg.hill > 0.5) return { ...D, tree: 6, shrub: 8, flower: 22 };
  if (rg.blossom > 0.5) return { ...D, tree: 16, shrub: 8, flower: 30 };
  if (rg.gold > 0.5) return { ...D, tree: 30, fern: 14 };
  if (rg.marsh > 0.5) return { ...D, tree: 2, fern: 12, flower: 12, bush: 4 };
  if (rg.downs > 0.5) return { ...D, tree: 2, rock: 5, shrub: 3, bush: 3, flower: 14 };
  return D; };
/** Settlement-like props (camps, cabins, benches, workbenches, racks, posts) that an empty-start world leaves out. */
const SETTLEMENT = /Cabin|Tent|Bench|Workbench|Timber_Stack|Fish_Rack|Canoe|Ice_Fishing|Wood_Pile|Chair|signpost|lantern|rowing|dock|fence|well|crate|barrel|bedroll|tarp|drying_rack|cooking|stool|seat|cairn|ruined_arch|Hut/i;
export function generateTile(tx, tz, seed = 7, opts = {}) {
  const T = generateTileFull(tx, tz, seed);
  if (!opts.empty) return T;
  const gone = new Set(T.props.filter(p => SETTLEMENT.test(p.model || '') || ['woodcutters_clearing', 'alpine_cabin', 'ice_camp'].includes(p.theme)).map(p => p.id));
  if (!gone.size) return T;
  const dropCol = (c) => { const id = c.id ? c.id.replace(/c-?[\d.]+$/, '') : ''; return gone.has(id) || gone.has(c.id); };
  return { ...T, props: T.props.filter(p => !gone.has(p.id)), colliders: T.colliders.filter(c => !dropCol(c)), nodes: T.nodes.filter(n => !gone.has(n.id)), landmark: T.landmark && SETTLEMENT.test(T.landmark.model || '') ? null : T.landmark };
}
function generateTileFull(tx, tz, seed = 7) {
  const R = tileRect(tx, tz), rng = makeRng(hashSeed(tx, tz, seed)), props = [], colliders = [], nodes = [], key = tileKey(tx, tz);
  const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, biome = biomeAt(cx, cz), RG = regionAt(cx, cz), D = regionDens(biome, RG);
  let n = 0;
  const edgeMargin = (x, z, m) => x - R.x0 < m || R.x1 - x < m || z - R.z0 < m || R.z1 - z < m;
  const free = (x, z, rad) => !inHomeCore(x, z, rad + 1) && !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad + 0.25);
  const dry = (x, z, rad) => depthAt(x, z) === 0 && depthAt(x + rad + 0.3, z) === 0 && depthAt(x - rad - 0.3, z) === 0 && depthAt(x, z + rad + 0.3) === 0 && depthAt(x, z - rad - 0.3) === 0;
  const add = (kind, model, x, z, rot, scale, extra = {}) => { const p = { id: `t${tx}_${tz}_${n++}`, kind, model, x, y: extra.y ?? groundAt(x, z), z, rot, scale, r: 0, tile: key, biome, ...extra }; props.push(p); return p; };
  const tryPlace = (count, build, sizeRadius, margin) => { let got = 0, t = 0; while (got < count && t++ < count * 40) {
    const x = R.x0 + 0.5 + rng() * (R.x1 - R.x0 - 1), z = R.z0 + 0.5 + rng() * (R.z1 - R.z0 - 1); const rad = sizeRadius(); if (edgeMargin(x, z, margin ?? rad + 0.2)) continue;
    if (!free(x, z, rad) || !dry(x, z, rad) || slopeAt(x, z) > 0.62 || pathAny(x, z) > (rad > 0.3 ? 0.5 : 0.8)) continue; build(x, z, rad); got++; } return got; };
  const solidCol = (p, w, d) => { const rad = Math.max(0.15, Math.min(w, d) / 2 * 0.9), k = Math.max(1, Math.round(Math.max(w, d) / (rad * 1.6)));
    for (let i = 0; i < k; i++) { const tt = k === 1 ? 0 : (i / (k - 1) - 0.5) * (Math.max(w, d) - rad * 2); const a = w >= d ? tt : 0, b = w >= d ? 0 : tt; colliders.push({ x: p.x + Math.cos(p.rot) * a + Math.sin(p.rot) * b, z: p.z - Math.sin(p.rot) * a + Math.cos(p.rot) * b, r: rad, id: `${p.id}c${i}`, tile: key }); } };
  // trees (22% autumn gold in woodland), each with a trunk collider and optionally a gatherable node
  tryPlace(D.tree, (x, z) => { const sp = biome === 'woodland' && rng() < 0.22 ? GOLD_TREE : TREE, s = 0.7 + rng() * 0.55, p = add('tree', sp.m, x, z, rng() * 6.283, s); p.r = sp.r * s; colliders.push({ x, z, r: p.r, id: p.id, tile: key }); }, () => 0.5, 1.2);
  tryPlace(D.rock, (x, z) => { const m = rng(), ids = ['fm_boulder_mossy_a', 'fm_boulder_mossy_b', 'fm_boulder_mossy_c'], useGrok = m < 0.6;
    if (useGrok) { const nm = ids[Math.floor(rng() * 3)], s = 0.9 + rng() * 0.7, p = add('grock', nm, x, z, rng() * 6.283, s); solidCol(p, GROK[nm].w * s, GROK[nm].d * s); }
    else { const sp = CLAUDE_ROCKS[Math.floor(rng() * 2)], s = 0.9 + rng() * 0.7, p = add('rock', sp.m, x, z, rng() * 6.283, s); p.r = sp.r * s; colliders.push({ x, z, r: p.r, id: p.id, tile: key }); } }, () => 1.0, 1.6);
  const softKinds = [['bush', D.bush, ['fm_bush_round', 'fm_bush_low_spread'], 0.9, 1.4], ['shrub', D.shrub, ['fm_shrub_flowering_elder', 'fm_shrub_flowering_rose'], 0.9, 1.4], ['fern', D.fern, ['fm_fern_clump'], 0.9, 1.5]];
  for (const [, cnt, models, a, b] of softKinds) tryPlace(cnt, (x, z) => add('deco', models[Math.floor(rng() * models.length)], x, z, rng() * 6.283, a + rng() * (b - a)), () => 0.4, 0.4);
  tryPlace(D.flower, (x, z) => add('deco', 'wildflower_clump', x, z, rng() * 6.283, 0.55 + rng() * 0.6), () => 0.3, 0.3);
  tryPlace(D.log, (x, z) => { const s = 1.0 + rng() * 0.3, p = add('grock', 'fm_log_hollow', x, z, rng() * 6.283, s); solidCol(p, GROK.fm_log_hollow.w * s, GROK.fm_log_hollow.d * s); }, () => 1.3, 1.6);
  tryPlace(D.stump, (x, z) => { const s = 1.0 + rng() * 0.4, p = add('grock', 'fm_tree_stump', x, z, rng() * 6.283, s); solidCol(p, GROK.fm_tree_stump.w * s, GROK.fm_tree_stump.d * s); }, () => 0.7, 1.0);
  tryPlace(D.mush, (x, z) => add('deco', 'fm_mushroom_ring', x, z, rng() * 6.283, 1.0 + rng() * 0.4), () => 0.8, 0.8);
  // river flora where this tile contains the river (matches the home area's reeds and lily pads)
  if (!WS) { let got = 0, t = 0; while (got < 16 && t++ < 700) { const z = R.z0 + rng() * (R.z1 - R.z0), x = riverX(z) + (rng() < 0.5 ? -1 : 1) * (3.2 + rng() * 4.2), d = depthAt(x, z); if (x < R.x0 + 0.5 || x > R.x1 - 0.5 || inHomeCore(x, z, 0) || !(d > 0.05 && d < 0.4) || !free(x, z, 1.0)) continue; add('deco', 'reeds_cattail_clump', x, z, rng() * 6.283, 0.9 + rng() * 0.7); got++; } }
  if (!WS) { let got = 0, t = 0; while (got < 7 && t++ < 700) { const z = R.z0 + rng() * (R.z1 - R.z0), x = riverX(z) + (rng() - 0.5) * 6, d = depthAt(x, z); if (x < R.x0 + 0.5 || x > R.x1 - 0.5 || inHomeCore(x, z, 0) || !(d > 0.3 && d < 0.8)) continue; add('deco', 'lily_pad_cluster', x, z, rng() * 6.283, 0.8 + rng() * 0.8, { y: waterY(z) + 0.01, onWater: true }); got++; } }
  // one readable LANDMARK per tile, as near the tile centre as ground allows, never on the trail itself
  const LMS = ['fm_cairn', 'fm_signpost', 'fm_lantern_post', 'fm_standing_stone', 'fm_waymarker_boulder', 'fm_ruined_arch_small'], lm = LMS[Math.floor(rng() * LMS.length)]; let landmark = null;
  for (let r = 0; r < 20 && !landmark; r += 1.5) for (let a = 0; a < 6.283 && !landmark; a += 0.7) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (edgeMargin(x, z, 2) || !free(x, z, 0.8) || !dry(x, z, 0.8) || slopeAt(x, z) > 0.5 || pathAny(x, z) > 0.1) continue; const p = add('grock', lm, x, z, rng() * 6.283, 1.0, { landmark: true }); solidCol(p, GROK[lm].w, GROK[lm].d); landmark = p; }
  // gatherable nodes: the tile's trees/boulders near its centre become resource nodes (same rules as home)
  for (const p of props) if ((p.kind === 'tree' || p.kind === 'rock') && Math.hypot(p.x - cx, p.z - cz) < 24) { p.node = p.kind; nodes.push(p); }
  // every land gets bushes and fallen branches to gather too, so each land's own finds (reed, grain, flax, bark...) can appear. A separate rng keeps the rest of the tile unchanged.
  { const sr = makeRng(hashSeed(tx, tz, seed + 977));
    for (const [kind, model, sc] of [['stick', 'Timber_Log', () => 0.55], ['bush', 'fm_berry_bush_full', () => 1.5 + sr() * 0.5]]) for (let i = 0, t = 0; i < 3 && t < 60; t++) { const a = sr() * 6.283, d = 4 + sr() * 18, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (edgeMargin(x, z, 2) || !free(x, z, 0.8) || !dry(x, z, 0.8) || slopeAt(x, z) > 0.5 || pathAny(x, z) > 0.1) continue; const p = add(kind, model, x, z, sr() * 6.283, sc()); if (kind === 'bush') p.r = 0; p.node = kind; nodes.push(p); i++; } }
  // Grok autumn kit (leaf litter decals + mossy fallen logs): added last so earlier placement is unchanged
  { const L = biome === 'woodland' ? [4, 6, 8, 2] : biome === 'meadow' ? [0, 1, 2, 1] : [0, 1, 1, 1];
    for (const [nm, cnt] of [['fm_leaf_litter_patch_large', L[0]], ['fm_leaf_litter_patch_medium', L[1]], ['fm_leaf_litter_patch_small', L[2]]]) tryPlace(cnt, (x, z) => { if (slopeAt(x, z) < 0.22) add('deco', nm, x, z, rng() * 6.283, 0.8 + rng() * 0.5); }, () => 0.8, 1.0);
    tryPlace(L[3], (x, z) => { const nm = ['fm_log_mossy_fallen_a', 'fm_log_mossy_fallen_b', 'fm_log_mossy_fallen_c'][Math.floor(rng() * 3)], p = add('grock', nm, x, z, rng() * 6.283, 1.0); solidCol(p, GROK[nm].w, GROK[nm].d); }, () => 1.5, 1.8); }
  // Grok weather-ground decals: puddles (drawn only while wet), a muddy patch near the trail
  { tryPlace(biome === 'rocky' ? 1 : 3, (x, z) => { if (slopeAt(x, z) < 0.12) add('deco', rng() < 0.5 ? 'fm_puddle_rain_small' : 'fm_puddle_rain_medium', x, z, rng() * 6.283, 0.9 + rng() * 0.5); }, () => 0.9, 1.0);
    tryPlace(1, (x, z) => { if (slopeAt(x, z) < 0.15) add('deco', 'fm_mud_patch_wet', x, z, rng() * 6.283, 1.0 + rng() * 0.4); }, () => 0.8, 1.0); }
  // Beauty set-piece (added last, own rng, so everything above is unchanged): about 6 tiles in 10 get one themed corner built from the Synty pieces
  { const tr = makeRng(hashSeed(tx, tz, seed + 99)), roll = tr(), theme = roll < 0.4 ? null : THEMES[Math.floor((roll - 0.4) / 0.6 * THEMES.length)]; let c = null;
    if (theme) for (let r = 0; r < 26 && !c; r += 2) for (let a = 0; a < 6.283 && !c; a += 0.6) { const x = cx + 4 + Math.cos(a) * r, z = cz - 3 + Math.sin(a) * r;
      if (edgeMargin(x, z, 7) || !free(x, z, 3.5) || !dry(x, z, 3.5) || slopeAt(x, z) > 0.28 || pathAny(x, z) > 0.05) continue; c = { x, z }; }
    if (c) { const put = (model, kind, dist, sMin, sMax, rad = 0, solid = false) => { for (let t = 0; t < 12; t++) { const a = tr() * 6.283, d = dist * Math.sqrt(tr()), x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d, s = sMin + tr() * (sMax - sMin), rr = rad * s;
          if (edgeMargin(x, z, 1.2) || !free(x, z, rr) || !dry(x, z, rr) || slopeAt(x, z) > 0.5 || pathAny(x, z) > 0.4) continue;
          const p = add(kind, model, x, z, tr() * 6.283, s, { theme: theme.name }); if (solid) { p.r = rr; colliders.push({ x, z, r: rr, id: p.id, tile: key }); } return p; } return null; };
      for (const [model, kind, n, dist, a, b, rad, solid] of theme.items) for (let i = 0; i < n; i++) put(model, kind, dist, a, b, rad, solid); } }
  // New landscapes: blossom valley, golden woods, marsh reeds, standing-stone downs
  if (RG.marsh > 0.3) { const nms = ['fm_reeds_cattail_a', 'fm_reeds_cattail_b', 'fm_reeds_cattail_c']; tryPlace(14, (x, z) => add('deco', nms[Math.floor(rng() * 3)], x, z, rng() * 6.283, 0.9 + rng() * 0.6), () => 0.4, 0.4);
    tryPlace(6, (x, z) => add('deco', 'fm_mud_patch_wet', x, z, rng() * 6.283, 1.4 + rng() * 0.8), () => 0.9, 1.0); }
  if (RG.downs > 0.3) { const tr2 = makeRng(hashSeed(tx, tz, seed + 123)); if (tr2() < 0.65) { let c2 = null;
      for (let r = 0; r < 24 && !c2; r += 2) for (let a = 0; a < 6.283 && !c2; a += 0.6) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (edgeMargin(x, z, 8) || !free(x, z, 6) || !dry(x, z, 6) || slopeAt(x, z) > 0.25 || pathAny(x, z) > 0.05) continue; c2 = { x, z }; }
      if (c2) { const place = (nm, x, z, s) => { const p = add('grock', nm, x, z, tr2() * 6.283, s, { theme: 'standing_stones' }); solidCol(p, GROK[nm].w * s, GROK[nm].d * s); };
        for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; place('fm_stone_circle_piece', c2.x + Math.cos(a) * 5, c2.z + Math.sin(a) * 5, 1.0); }
        place('fm_standing_stone', c2.x, c2.z, 1.2); if (tr2() < 0.4) place('fm_cairn', c2.x + 8, c2.z - 4, 1.1); } } }
  // Coast: driftwood washed up on the beach band just above the sea
  if (RG.sea > 0.15) { const nm = 'fm_driftwood_pile'; let got = 0; for (let t = 0; got < 4 && t < 300; t++) { const x = R.x0 + 1 + rng() * (R.x1 - R.x0 - 2), z = R.z0 + 1 + rng() * (R.z1 - R.z0 - 2), y = groundAt(x, z);
      if (y > seaLevelY() + 2.4 || y < seaLevelY() + 0.15 || !free(x, z, 1.2) || !dry(x, z, 1.2) || slopeAt(x, z) > 0.4 || pathAny(x, z) > 0.3) continue;
      const s = 0.9 + rng() * 0.5, p = add('grock', nm, x, z, rng() * 6.283, s); solidCol(p, GROK[nm].w * s, GROK[nm].d * s); got++; } }
  // Snow regions (snowfields and mountain tops): pines, snow-capped rocks, frosted plants, no flowers or litter. Done last so placement above is unchanged.
  for (let i = props.length - 1; i >= 0; i--) { const p = props[i], rg = regionAt(p.x, p.z); if (rg.snowAmt < 0.5) continue;
    if (p.model === 'wildflower_clump' || p.model === 'fm_mushroom_ring' || p.model.startsWith('Flower_') || p.model.startsWith('fm_leaf_litter') || p.model.startsWith('fm_puddle_') || p.model === 'fm_mud_patch_wet') { props.splice(i, 1); continue; }
    if (p.kind === 'rock' && !p.node) { p.kind = 'grock'; p.model = 'fm_boulder_snowcap_' + 'abc'[(Math.imul(i + 3, 2654435761) >>> 0) % 3]; continue; }
    if (p.model.startsWith('tree_hero_broadleaf')) { const h = (Math.imul(i + 1, 2654435761) >>> 0) % 5; if (h < 2) p.model = h ? 'fm_pine_a' : 'fm_pine_b'; else if (h === 2) { p.model = 'alp_Env_Pine_01'; p.scale *= 0.6; } else { p.model = h === 3 ? 'alp_Env_Pine_03' : 'alp_Env_Pine_05'; p.scale *= 1.35; } } else p.snowy = true; }
  for (const p of props) if (p.kind === 'tree' && p.model === 'tree_hero_broadleaf_01_mobile') { const rg = regionAt(p.x, p.z); if (rg.blossom > 0.5) p.model = 'fm_tree_blossom_spring'; else if (rg.gold > 0.5) p.model = 'tree_hero_broadleaf_01_mobile_gold'; }
  for (const p of props) if (p.kind === 'tree' && p.model === 'tree_hero_broadleaf_01_mobile' && regionAt(p.x, p.z).marsh > 0.5) { p.model = (Math.imul(props.indexOf(p) + 5, 2654435761) >>> 0) % 2 ? 'swp_Env_Tree_Mangrove_01' : 'swp_Env_Tree_Mangrove_02'; p.scale *= 1.1; }
  for (const p of props) if (p.kind === 'grock' && p.model.startsWith('fm_boulder_mossy') && regionAt(p.x, p.z).mount > 0.5) { const h = (Math.imul(Math.round(p.x * 3 + p.z * 7), 2654435761) >>> 0) % 5; if (h === 0) { p.model = 'alp_Env_Rock_05'; p.scale *= 1.3; } else if (h === 1) { p.model = 'nat_Rock_Pile_01'; p.scale *= 0.55; } }
  for (const p of props) if (p.kind === 'tree' && p.model.startsWith('swp_Env_Tree_Mangrove') && (Math.imul(Math.round(p.x + p.z * 5), 2654435761) >>> 0) % 4 === 0) { p.model = 'swp_Env_Tree_Swamp_03'; p.scale *= 0.7; }
  // Synty set-pieces (own rng, added last): alpine cabin yard in the mountains, canoe and fish rack on the beach, marsh reeds and mounds
  { const ts = makeRng(hashSeed(tx, tz, seed + 311)), put2 = (model, kind, x, z, s, rad, extra = {}) => { const p = add(kind, model, x, z, ts() * 6.283, s, extra); if (rad) { p.r = rad; colliders.push({ x, z, r: rad, id: p.id, tile: key }); } return p; };
    if (RG.mount > 0.4 && RG.snowAmt < 0.5 && ts() < 0.5) { let c3 = null;
      for (let r = 0; r < 24 && !c3; r += 2) for (let a = 0; a < 6.283 && !c3; a += 0.6) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (edgeMargin(x, z, 8) || !free(x, z, 6) || !dry(x, z, 6) || slopeAt(x, z) > 0.3 || pathAny(x, z) > 0.05) continue; c3 = { x, z }; }
      if (c3) { put2('alp_Prop_Cabin_01', 'grock', c3.x, c3.z, 1.0, 3.4, { theme: 'alpine_cabin' }); put2('alp_Prop_Wood_Pile_01', 'grock', c3.x + 4.2, c3.z + 1.5, 1.1, 0.8, { theme: 'alpine_cabin' }); put2('alp_Prop_Chair_Log_01', 'deco', c3.x - 3, c3.z + 4.2, 1.0, 0, { theme: 'alpine_cabin' }); put2('alp_Prop_Chair_Log_01', 'deco', c3.x - 4.2, c3.z + 3.4, 1.0, 0, { theme: 'alpine_cabin' }); put2('alp_Prop_Tent_01', 'grock', c3.x + 6.5, c3.z - 3.5, 1.0, 1.3, { theme: 'alpine_cabin' }); put2('nat_Prop_CampFire_01', 'grock', c3.x - 3.6, c3.z + 3.7, 0.9, 0, { theme: 'alpine_cabin' }); } }
    if (RG.snowAmt > 0.55 && ts() < 0.2) { let c4 = null; for (let r = 0; r < 24 && !c4; r += 2) for (let a = 0; a < 6.283 && !c4; a += 0.6) { const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; if (edgeMargin(x, z, 6) || !free(x, z, 4) || !dry(x, z, 4) || slopeAt(x, z) > 0.3 || pathAny(x, z) > 0.05) continue; c4 = { x, z }; }
      if (c4) { put2('alp_Prop_Ice_Fishing_Hut_01', 'grock', c4.x, c4.z, 1.0, 1.7, { theme: 'ice_camp' }); put2('alp_Prop_Bench_01', 'grock', c4.x + 3.2, c4.z + 1.2, 1.0, 0.6, { theme: 'ice_camp' }); put2('alp_Prop_Tent_01', 'grock', c4.x - 4, c4.z - 2, 1.0, 1.3, { theme: 'ice_camp' }); } }
    if (RG.mount > 0.3 && RG.snowAmt < 0.5) { tryPlace(3, (x, z) => put2('alp_Env_Bush_01', 'deco', x, z, 0.9 + ts() * 0.5, 0), () => 0.5, 0.5); tryPlace(2, (x, z) => put2('alp_Env_Moss_Lumps_01', 'deco', x, z, 0.9 + ts() * 0.5, 0), () => 0.6, 0.6); }
    if (RG.mount > 0.3 && RG.snowAmt < 0.5) tryPlace(5, (x, z) => put2('alp_Env_Bush_Flower_01', 'deco', x, z, 0.9 + ts() * 0.5, 0), () => 0.5, 0.5);
    if (RG.sea > 0.15 && ts() < 0.6) for (let t2 = 0, got = 0; got < 2 && t2 < 300; t2++) { const x = R.x0 + 2 + ts() * (R.x1 - R.x0 - 4), z = R.z0 + 2 + ts() * (R.z1 - R.z0 - 4), y = groundAt(x, z);
      if (y > seaLevelY() + 2.2 || y < seaLevelY() + 0.2 || !free(x, z, 2.2) || !dry(x, z, 2.2) || slopeAt(x, z) > 0.35 || pathAny(x, z) > 0.3) continue; put2(got ? 'alp_Prop_Fish_Rack_01' : 'alp_Prop_Canoe_01', 'grock', x, z, 1.0, got ? 1.4 : 1.7, { theme: 'beach' }); got++; }
    if (RG.marsh > 0.3) { tryPlace(10, (x, z) => put2(ts() < 0.5 ? 'swp_Env_Reeds_01' : 'swp_Env_Reeds_02', 'deco', x, z, 0.9 + ts() * 0.6, 0), () => 0.4, 0.4);
      tryPlace(4, (x, z) => put2('swp_Env_MossMound_01', 'deco', x, z, 1.0 + ts() * 0.8, 0), () => 1.0, 1.0); tryPlace(5, (x, z) => put2('swp_Env_Bush_Bramble_01', 'deco', x, z, 0.9 + ts() * 0.5, 0), () => 0.6, 0.6); if (ts() < 0.5) tryPlace(1, (x, z) => put2('swp_Prop_Swamp_Lantern_01', 'deco', x, z, 1.0, 0), () => 0.4, 0.5); tryPlace(3, (x, z) => put2('swp_Env_Toetoe_01', 'deco', x, z, 0.8 + ts() * 0.4, 0), () => 0.6, 0.6); } }
  return { key, tx, tz, biome, props, colliders, nodes, landmark: landmark && { x: landmark.x, z: landmark.z, model: landmark.model } };
}
