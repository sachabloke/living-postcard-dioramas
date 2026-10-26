// Deterministic placement of solid props and resource nodes. Uses groundAt() only; every prop records the exact
// y it was seated on so tests can verify roots touch the surface.
import { makeRng } from './rng.js';
import { GROK } from './grok_props.js';
import { groundAt, depthAt, slopeAt, riverX, waterY, pathWeight, HUT, CAMP, SEAM_Z, BOUNDS, BRIDGE, GATE } from './terrain.js';

// radius = collision radius (m) measured against the visible trunk/rock footprint at the model's scale (see measureColliders in main).
// Claude-made workshop assets (asset-workshop-2026-10-20, Blender, procedural, textured). r = collision radius from each asset's own
// collision_guidance (tree trunk r 0.42 m; spire r ~0.6; boulder ~1.7x1.2 footprint; slab 2.7x2.2 treated as a wall), x model scale.
const TREES = [{ m: 'tree_hero_broadleaf_01_mobile', r: 0.42, s: 1.0 }];
const GOLD = { m: 'tree_hero_broadleaf_01_mobile_gold', r: 0.42, s: 1.0 };
const ROCKS = [{ m: 'rock_boulder_bare_mobile', r: 0.78, s: 1.0 }, { m: 'rock_spire_bare_mobile', r: 0.58, s: 1.0 }, { m: 'rock_slab_bare_mobile', r: 0.0, s: 1.0, slab: true }];
const wet = (x, z, m) => depthAt(x, z) > 0 || depthAt(x + m, z) > 0 || depthAt(x - m, z) > 0 || depthAt(x, z + m) > 0 || depthAt(x, z - m) > 0;
/** opts.empty: a fresh open forest with none of the founder camp (stump, bench, well, fences, dock, tent, racks, signposts, lantern posts, cairns, rowing boat). The bridge, the gate ring and the natural props stay. */
export function buildWorld(seed = 7, opts = {}) {
  const empty = !!opts.empty;
  if (opts.watershed) return { props: [], nodes: [], colliders: [], seed, hutWalls: [] };   // the separate watershed world has no hand-built home core; everything comes from streamed tiles
  const rng = makeRng(seed), props = [], nodes = [], colliders = [], keepClear = [];
  const clear = (x, z, r) => keepClear.push({ x, z, r });
  clear(CAMP.x, CAMP.z, 5); clear(HUT.x, HUT.z, 7); clear(BRIDGE.x, BRIDGE.z, 7.5); clear(GATE.x, GATE.z, 5); clear(18, 52, 3);
  const blocked = (x, z, r) => keepClear.some(c => Math.hypot(x - c.x, z - c.z) < c.r + r) || pathWeight(x, z) > 0.55
    || wet(x, z, r + 0.3) || colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + r + 0.4)
    || x < BOUNDS.minX + 5 || x > BOUNDS.maxX - 5 || z < BOUNDS.minZ + 5 || z > BOUNDS.maxZ - 5;
  const place = (kind, spec, x, z, rot, scale, extra = {}) => {
    const y = groundAt(x, z), p = { id: `${kind}${props.length}`, kind, model: spec.m, x, y, z, rot, scale, r: spec.r * scale, area: z < SEAM_Z ? 'woodland' : 'clearing', ...extra };
    props.push(p); return p;
  };
  const scatter = (n, area, make) => { let tries = 0, got = 0; while (got < n && tries++ < n * 60) {
    const x = BOUNDS.minX + 6 + rng() * (BOUNDS.maxX - BOUNDS.minX - 12), z = area === 'clearing' ? 4 + rng() * 78 : -80 + rng() * 78;
    if (make(x, z)) got++; } };
  // Trees: denser in the woodland (B), looser in the clearing (A). Skip steep slopes.
  const tree = (x, z) => { const sp = z < SEAM_Z && rng() < 0.22 ? GOLD : rng.pick(TREES), s = (0.7 + rng() * 0.55) * sp.s; if (blocked(x, z, sp.r * s) || slopeAt(x, z) > 0.7) return false;
    const p = place('tree', sp, x, z, rng() * 6.283, s); colliders.push({ x, z, r: p.r, id: p.id }); return true; };
  scatter(30, 'clearing', tree); scatter(80, 'woodland', tree);
  const rock = (x, z) => { const sp = rng.pick(ROCKS), s = (0.9 + rng() * 0.7) * sp.s, rr = sp.slab ? 1.6 * s : sp.r * s; if (blocked(x, z, rr)) return false;
    const rot = rng() * 6.283, p = place('rock', sp, x, z, rot, s);
    if (sp.slab) { p.r = 1.1 * s; for (const k of [-1, 1]) colliders.push({ x: x + Math.cos(rot) * k * 0.8 * s, z: z - Math.sin(rot) * k * 0.8 * s, r: 1.0 * s, id: p.id + 'c' + k }); }
    else colliders.push({ x, z, r: p.r, id: p.id }); return true; };
  scatter(14, 'clearing', rock); scatter(14, 'woodland', rock);
  // Resource nodes = a subset of those props near the camp so the first loop is short.
  for (const p of props) { if (p.kind === 'tree' || p.kind === 'rock') { const d = Math.hypot(p.x - CAMP.x, p.z - CAMP.z); if (d < 38 && p.area === 'clearing') { p.node = p.kind; nodes.push(p); } } }
  // Fallen branches = stick nodes (1 swing each), near the camp so the first crafting loop is short.
  for (let i = 0, t = 0; i < 14 && t < 800; t++) { const a = rng() * 6.283, d = 6 + rng() * 30, x = CAMP.x + Math.cos(a) * d, z = CAMP.z + Math.sin(a) * d; if (z < SEAM_Z + 3 || blocked(x, z, 0.8) || slopeAt(x, z) > 0.5) continue; const p = place('stick', { m: 'Timber_Log', r: 0 }, x, z, rng() * 6.283, 0.55); p.node = 'stick'; nodes.push(p); i++; }
  // Bushes: soft cover (no collision) and berry nodes.
  const bush = (x, z) => { if (blocked(x, z, 0.8)) return false; const p = place('bush', { m: 'fm_berry_bush_full', r: 0.5 }, x, z, rng() * 6.283, 1.5 + rng() * 0.5); p.node = 'bush'; if (z > SEAM_Z && Math.hypot(x - CAMP.x, z - CAMP.z) < 40) nodes.push(p); return true; };
  scatter(16, 'clearing', bush); scatter(26, 'woodland', bush);
  // Soft decoration (no collision): ferns, flowers, mushrooms, a hollow log.
  const deco = (m, n, area, sc) => scatter(n, area, (x, z) => { if (blocked(x, z, 0.5)) return false; place('deco', { m, r: 0 }, x, z, rng() * 6.283, sc * (0.8 + rng() * 0.5)); return true; });
  deco('Fern_170', 22, 'clearing', 1); deco('Fern_170', 40, 'woodland', 1.2); deco('Flower_150', 18, 'clearing', 1); deco('Flower_151', 14, 'clearing', 1); deco('Woodland_Mushrooms', 6, 'woodland', 1);
  { const x = 28, z = 58; if (!blocked(x, z, 2.2)) { const rot = 0.6, p = place('log', { m: 'Hollow_Log', r: 0.0 }, x, z, rot, 0.8); for (const k of [-1, 0, 1]) colliders.push({ x: x + Math.cos(rot) * k * 0.95 * 0.8 * 1.0, z: z - Math.sin(rot) * k * 0.95 * 0.8 * 1.0, r: 0.8, id: p.id + 'c' + k }); } }
  if (!empty) { const p = place('stump', { m: 'Cut_Stump', r: 0.5 }, CAMP.x - 3.4, CAMP.z + 2.2, 0.3, 1.4); colliders.push({ x: p.x, z: p.z, r: 0.42, id: p.id }); }
  if (!empty) { const p = place('bench', { m: 'Log_Bench', r: 0 }, CAMP.x + 3.6, CAMP.z - 1.2, 1.9, 1.3); for (const k of [-1, 1]) colliders.push({ x: p.x + Math.cos(1.9) * k * 0.45, z: p.z - Math.sin(1.9) * k * 0.45, r: 0.4, id: p.id + 'c' + k }); }
  // ---- camp furniture (Blender-made by Claude): well, fence with an open gap, dock. Solid via circle colliders. ----
  if (!empty) { const add = (kind, model, x, z, rot, sc, y = groundAt(x, z)) => { const p = { id: `${kind}${props.length}`, kind, model, x, y, z, rot, scale: sc, r: 0, area: z < SEAM_Z ? 'woodland' : 'clearing' }; props.push(p); return p; };
    const wx = CAMP.x + 5.5, wz = CAMP.z - 4.5, w = add('well', 'stone_well', wx, wz, 0.4, 1.2); colliders.push({ x: wx, z: wz, r: 1.0, id: w.id }); keepClear.push({ x: wx, z: wz, r: 1.6 });
    for (let i = 3; i < 8; i++) { if (i === 5) continue; const fz = CAMP.z - 4 + i * 2.0, fx = CAMP.x - 8.5, f = add('fence', 'fence_section', fx, fz, Math.PI / 2, 1.0); for (const k of [-0.75, -0.25, 0.25, 0.75]) colliders.push({ x: fx, z: fz + k, r: 0.22, id: f.id + 'c' + k }); keepClear.push({ x: fx, z: fz, r: 1.2 }); }
    add('fence', 'fence_gate', CAMP.x - 8.5, CAMP.z + 6.0, Math.PI / 2, 1.0);
    const dz = 50, dx = riverX(dz) + 5.6, d = add('dock', 'dock_short', dx, dz, Math.PI / 2, 1.3, waterY(dz) - 0.42); d.yFixed = true; for (const k of [-1.7, 0, 1.7]) colliders.push({ x: dx - k * 1.0, z: dz, r: 0.55, id: d.id + 'c' + k }); keepClear.push({ x: dx, z: dz, r: 3.5 }); }
  // ---- river and meadow flora (Blender-made by Claude; no collision). Own RNG so earlier placements are unchanged. ----
  { const r2 = makeRng(seed + 99), free = (x, z, rad) => !keepClear.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad) && !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad + 0.3);
    const put = (model, x, z, y, sc, onWater) => { props.push({ id: `deco${props.length}`, kind: 'deco', model, x, y, z, rot: r2() * 6.283, scale: sc, r: 0, area: z < SEAM_Z ? 'woodland' : 'clearing', onWater }); };
    let n = 0, t = 0; while (n < 70 && t++ < 4000) { const z = BOUNDS.minZ + 6 + r2() * (BOUNDS.maxZ - BOUNDS.minZ - 12), x = riverX(z) + (r2() < 0.5 ? -1 : 1) * (3.2 + r2() * 4.2), d = depthAt(x, z);
      if (d > 0.05 && d < 0.4 && free(x, z, 1.0)) { put('reeds_cattail_clump', x, z, groundAt(x, z), 0.9 + r2() * 0.7, false); n++; } }
    n = 0; t = 0; while (n < 26 && t++ < 4000) { const z = BOUNDS.minZ + 6 + r2() * (BOUNDS.maxZ - BOUNDS.minZ - 12), x = riverX(z) + (r2() - 0.5) * 6, d = depthAt(x, z);
      if (d > 0.3 && d < 0.8 && free(x, z, 1.0) && Math.abs(z - BRIDGE.z) > 4) { put('lily_pad_cluster', x, z, waterY(z) + 0.01, 0.8 + r2() * 0.8, true); n++; } }
    n = 0; t = 0; while (n < 110 && t++ < 6000) { const x = BOUNDS.minX + 6 + r2() * (BOUNDS.maxX - BOUNDS.minX - 12), z = BOUNDS.minZ + 6 + r2() * (BOUNDS.maxZ - BOUNDS.minZ - 12);
      if (depthAt(x, z) === 0 && slopeAt(x, z) < 0.5 && pathWeight(x, z) < 0.3 && free(x, z, 0.8) && Math.abs(x - riverX(z)) > 5) { put('wildflower_clump', x, z, groundAt(x, z), 0.8 + r2() * 0.9, false); n++; } } }
  // ---- Grok-made props (incoming-grok, passed intake 22 Oct). Own RNG so nothing earlier moves. Solids get circle colliders from their footprint. ----
  { const r3 = makeRng(seed + 199), okSpot = (x, z, rad) => !keepClear.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad) && !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad + 0.3) && depthAt(x, z) === 0 && !wet(x, z, rad + 0.2) && slopeAt(x, z) < 0.55 && pathWeight(x, z) < 0.4 && x > BOUNDS.minX + 6 && x < BOUNDS.maxX - 6 && z > BOUNDS.minZ + 6 && z < BOUNDS.maxZ - 6;
    const put = (name, x, z, rot, sc, y = groundAt(x, z), extra = {}) => { const g = GROK[name], id = `g_${name.slice(3)}${props.length}`; const p = { id, kind: g.solid ? 'grock' : 'deco', model: name, x, y, z, rot, scale: sc, r: 0, area: z < SEAM_Z ? 'woodland' : 'clearing', ...extra }; props.push(p);
      if (g.solid && !extra.noCollide) { const w = g.w * sc, d = g.d * sc, rad = Math.max(0.15, Math.min(w, d) / 2 * 0.9), n = Math.max(1, Math.round(Math.max(w, d) / (rad * 1.6)));
        for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (Math.max(w, d) - rad * 2) * (w >= d ? 1 : 0), u = n === 1 ? 0 : (i / (n - 1) - 0.5) * (Math.max(w, d) - rad * 2) * (w >= d ? 0 : 1);
          colliders.push({ x: x + Math.cos(rot) * t + Math.sin(rot) * u, z: z - Math.sin(rot) * t + Math.cos(rot) * u, r: rad, id: `${id}c${i}` }); } } return p; };
    const scatterG = (name, n, area, scMin, scMax) => { let got = 0, t = 0; while (got < n && t++ < 3000) { const z = area === 'clearing' ? 6 + r3() * 74 : -78 + r3() * 74, x = BOUNDS.minX + 8 + r3() * (BOUNDS.maxX - BOUNDS.minX - 16), sc = scMin + r3() * (scMax - scMin); if (!okSpot(x, z, Math.max(GROK[name].w, GROK[name].d) * sc * 0.5)) continue; put(name, x, z, r3() * 6.283, sc); got++; } };
    for (const nm of ['fm_boulder_mossy_a', 'fm_boulder_mossy_b', 'fm_boulder_mossy_c']) { scatterG(nm, 3, 'clearing', 0.9, 1.5); scatterG(nm, 4, 'woodland', 0.9, 1.6); }
    scatterG('fm_log_hollow', 2, 'clearing', 1.0, 1.3); scatterG('fm_log_hollow', 3, 'woodland', 1.0, 1.4); scatterG('fm_tree_stump', 3, 'clearing', 1.0, 1.4); scatterG('fm_tree_stump', 4, 'woodland', 1.0, 1.5);
    scatterG('fm_mushroom_ring', 2, 'clearing', 1.0, 1.3); scatterG('fm_mushroom_ring', 4, 'woodland', 1.0, 1.4);
    for (const nm of ['fm_fern_clump', 'fm_bush_round', 'fm_bush_low_spread', 'fm_shrub_flowering_elder', 'fm_shrub_flowering_rose']) { scatterG(nm, 10, 'clearing', 0.9, 1.4); scatterG(nm, 14, 'woodland', 0.9, 1.5); }
    if (!empty) scatterG('fm_cairn', 1, 'woodland', 1.0, 1.2);
    // waymarks: signposts at both ends of the bridge, the gate, the camp and the hut; lantern posts around camp/hut (the fixed spots ignore the random-scatter spot test but never block the route)
    const sp = (nm, x, z, rot) => { if (empty) return; if (!colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.8) && pathWeight(x, z) < 0.08 && depthAt(x, z) === 0 && Math.hypot(x - HUT.x, z - HUT.z) > HUT.half + 3.6) put(nm, x, z, rot, 1.0); };
    sp('fm_signpost', BRIDGE.x + BRIDGE.halfLen + 2.2, BRIDGE.z - 2.0, -0.4); sp('fm_signpost', BRIDGE.x - BRIDGE.halfLen - 2.2, BRIDGE.z + 2.0, 2.7); sp('fm_signpost', GATE.x - 3.2, GATE.z + 2.4, 0.5); sp('fm_signpost', CAMP.x + 2.8, CAMP.z + 4.0, -0.8); sp('fm_signpost', HUT.x - 5.2, HUT.z + 3.0, 0.9);
    sp('fm_lantern_post', CAMP.x - 2.6, CAMP.z - 3.2, 0.3); sp('fm_lantern_post', CAMP.x + 4.6, CAMP.z + 1.4, 2.4); sp('fm_lantern_post', HUT.x - 5.6, HUT.z - 4.6, 1.2); sp('fm_lantern_post', BRIDGE.x + BRIDGE.halfLen + 3.2, BRIDGE.z - 3.4, 0.1);
    sp('fm_cairn', GATE.x + 3.4, GATE.z + 3.2, 0.7); sp('fm_cairn', CAMP.x + 9.5, CAMP.z + 7.0, 2.0);
    // driftwood on the river margin; rowing boat floating beside the dock (decorative: it sits on deep water that the player can't enter)
    { let got = 0, t = 0; while (got < 4 && t++ < 3000) { const z = 6 + r3() * 74, x = riverX(z) + (r3() < 0.5 ? -1 : 1) * (4.6 + r3() * 1.2), d = depthAt(x, z); if (d > 0.02 || !(Math.abs(x - riverX(z)) > 4.4) || !okSpot(x, z, 1.0)) continue; put('fm_driftwood_pile', x, z, r3() * 6.283, 1.0); got++; } }
    if (!empty) { const dz = 50, bx = riverX(dz) + 3.4, bz = dz + 2.4; put('fm_rowing_boat', bx, bz, Math.PI / 2 - 0.15, 1.0, waterY(bz) - 0.22, { yFixed: true, noCollide: true }); } }
  // ---- Grok landmark props (Group C, intake PASS 22 Oct). Separate RNG so nothing earlier moves. ----
  { const r4 = makeRng(seed + 211), okSpot = (x, z, rad) => !keepClear.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad) && !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad + 0.3) && depthAt(x, z) === 0 && !wet(x, z, rad + 0.2) && slopeAt(x, z) < 0.5 && pathWeight(x, z) < 0.3 && x > BOUNDS.minX + 8 && x < BOUNDS.maxX - 8 && z > BOUNDS.minZ + 8 && z < BOUNDS.maxZ - 8;
    const put = (name, x, z, rot, sc, extra = {}) => { const g = GROK[name], id = `g_${name.slice(3)}${props.length}`; props.push({ id, kind: g.solid ? 'grock' : 'deco', model: name, x, y: groundAt(x, z), z, rot, scale: sc, r: 0, area: z < SEAM_Z ? 'woodland' : 'clearing', ...extra });
      if (g.solid && !extra.noCollide) { const w = g.w * sc, d = g.d * sc, rad = Math.max(0.15, Math.min(w, d) / 2 * 0.9), n = Math.max(1, Math.round(Math.max(w, d) / (rad * 1.6)));
        for (let i = 0; i < n; i++) { const a = n === 1 ? 0 : (i / (n - 1) - 0.5) * (Math.max(w, d) - rad * 2), tx = w >= d ? a : 0, tz = w >= d ? 0 : a; colliders.push({ x: x + Math.cos(rot) * tx + Math.sin(rot) * tz, z: z - Math.sin(rot) * tx + Math.cos(rot) * tz, r: rad, id: `${id}c${i}` }); } } };
    const spot = (area, rad) => { for (let t = 0; t < 4000; t++) { const z = area === 'clearing' ? 8 + r4() * 70 : -76 + r4() * 70, x = BOUNDS.minX + 10 + r4() * (BOUNDS.maxX - BOUNDS.minX - 20); if (okSpot(x, z, rad)) return { x, z }; } return null; };
    const one = (nm, area, sc) => { const g = GROK[nm], s = spot(area, Math.max(g.w, g.d) * sc * 0.6); if (s) put(nm, s.x, s.z, r4() * 6.283, sc); };
    one('fm_standing_stone', 'woodland', 1.1); one('fm_standing_stone', 'clearing', 1.0); one('fm_ruined_arch_small', 'woodland', 1.2); one('fm_watchtower_small', 'clearing', 1.1);
    for (const a of ['woodland', 'clearing', 'woodland']) one('fm_waymarker_boulder', a, 1.0 + r4() * 0.3);
    { const c = spot('woodland', 4.2); if (c) for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283, x = c.x + Math.cos(a) * 3.4, z = c.z + Math.sin(a) * 3.4; if (okSpot(x, z, 0.5)) put('fm_stone_circle_piece', x, z, -a + Math.PI / 2, 1.0 + r4() * 0.15); } }
    for (const nm of ['fm_reeds_cattail_a', 'fm_reeds_cattail_b', 'fm_reeds_cattail_c']) { let n = 0, t = 0; while (n < 7 && t++ < 4000) { const z = BOUNDS.minZ + 8 + r4() * (BOUNDS.maxZ - BOUNDS.minZ - 16), x = riverX(z) + (r4() - 0.5) * 12, d = depthAt(x, z); if (d > 0.04 && d < 0.35 && !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.6) && Math.abs(z - BRIDGE.z) > 4) { put(nm, x, z, r4() * 6.283, 0.9 + r4() * 0.5); n++; } } }
    for (const nm of ['fm_pine_a', 'fm_pine_b']) one(nm, 'woodland', 1.0 + r4() * 0.3); one('fm_pine_a', 'clearing', 0.9);
    one('fm_trunk_fallen_dead_a', 'woodland', 1.0); one('fm_trunk_fallen_dead_b', 'woodland', 1.0); one('fm_trunk_fallen_dead_b', 'clearing', 1.0);
    if (!empty) { const cp = (nm, dx, dz, rot, sc = 1.0) => { const x = CAMP.x + dx, z = CAMP.z + dz; if (!colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.7) && pathWeight(x, z) < 0.08 && depthAt(x, z) === 0 && slopeAt(x, z) < 0.5 && Math.hypot(x - HUT.x, z - HUT.z) > HUT.half + 3.4) put(nm, x, z, rot, sc); };
      cp('fm_tent_aframe', -6.8, 2.6, 0.5); cp('fm_bedroll', -4.3, 3.8, 1.3); cp('fm_drying_rack', -7.4, -1.8, 0.2); cp('fm_crate_wooden', 3.4, -3.3, 0.4); cp('fm_barrel_wooden', 4.4, -2.7, 0.0); cp('fm_firewood_stack', -3.3, -4.6, 1.6); cp('fm_bucket_ladle', 0.8, -5.8, 0.8); cp('fm_cooking_pot_tripod', -1.9, 4.8, 0.0);
      cp('fm_log_seat_short', -2.2, 2.6, 2.2); cp('fm_stool_stump_cushion', 2.4, -2.2, 0.5); cp('fm_food_basket_forage', -4.8, -2.4, 0.6); cp('fm_rain_awning_tarp', -6.4, -8.0, 0.3);
      { const seat = props.find(p => p.model === 'fm_log_seat_short'), crate = props.find(p => p.model === 'fm_crate_wooden');
        if (seat) put('fm_blanket_wool_folded', seat.x, seat.z, seat.rot, 1.0, { y: seat.y + 0.4, noCollide: true, yFixed: true });
        if (crate) put('fm_lantern_hand', crate.x, crate.z, 0.7, 1.0, { y: crate.y + 0.5, noCollide: true, yFixed: true }); } }
    for (const [nm, n, sc] of [['fm_leaf_litter_patch_large', 4, 1.0], ['fm_leaf_litter_patch_medium', 10, 1.0], ['fm_leaf_litter_patch_small', 14, 1.0]]) for (let i = 0; i < n; i++) { const s = spot(i % 3 === 0 ? 'clearing' : 'woodland', 0.8); if (s && slopeAt(s.x, s.z) < 0.25) put(nm, s.x, s.z, r4() * 6.283, sc * (0.8 + r4() * 0.5)); }
    for (const [nm, a] of [['fm_log_mossy_fallen_a', 'woodland'], ['fm_log_mossy_fallen_b', 'woodland'], ['fm_log_mossy_fallen_c', 'woodland'], ['fm_log_mossy_fallen_a', 'clearing'], ['fm_log_mossy_fallen_b', 'clearing']]) one(nm, a, 1.0);
    { let n = 0, t = 0; while (n < 2 && t++ < 3000) { const z = 8 + r4() * 70, x = riverX(z) + (r4() < 0.5 ? -1 : 1) * (4.7 + r4()); if (depthAt(x, z) === 0 && Math.abs(x - riverX(z)) > 4.4 && okSpot(x, z, 1.0)) { put('fm_paddle_and_net_stakes', x, z, r4() * 6.283, 1.0); n++; } } } }
  return { props, nodes, colliders, seed, hutWalls: hutWallColliders() };
}

/** Circle colliders along the cabin walls (added when the Walls stage is built). Leaves the door gap on the west wall open. */
export function hutWallColliders() {
  const out = [], h = HUT.half, step = 0.45; let n = 0;
  const seg = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), k = Math.max(1, Math.ceil(L / step)); for (let i = 0; i <= k; i++) { const t = i / k, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; if (x < HUT.x - h + 0.3 && Math.abs(z - HUT.z) < HUT.door / 2 - 0.05) continue; out.push({ x, z, r: 0.3, id: 'hutwall' + n++ }); } };
  seg(HUT.x - h, HUT.z - h, HUT.x + h, HUT.z - h); seg(HUT.x + h, HUT.z - h, HUT.x + h, HUT.z + h); seg(HUT.x + h, HUT.z + h, HUT.x - h, HUT.z + h); seg(HUT.x - h, HUT.z + h, HUT.x - h, HUT.z - h);
  return out;
}
