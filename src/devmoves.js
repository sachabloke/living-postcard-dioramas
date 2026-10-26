// Developer "microcosm" for testing every movement: ?test=1&dev=1 on localhost only. A small flat arena of stones at hop / climb / too-tall heights, a row of solid posts,
// buttons that jump to the nearest real slopes, shore, wading and deep water on the current terrain, a clip player for every animation the character has, and a live readout.
// Nothing here touches saves, maths, rewards or the normal world: the arena exists only while this panel is on, and colliders are removed when it is closed.
import { makeRod } from './fishfx.js';
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';

/** Heights (m) of the arena stones. HOP_MAX / CLIMB_MAX decide which behaviour each gets; the last two must stay solid. */
export const ARENA_STONES = [0.2, 0.35, 0.5, 0.65, 0.8, 1.0, 1.2, 1.35, 1.6, 2.2];

/** Scans the terrain around (x0,z0) for sample sites: dry slopes near the given steepness (rise/run), a shore, wading depth and deep water. Pure given the samplers. */
export function findStations(x0, z0, { groundAt, depthAt, slopeAt }, { radius = 300, step = 6 } = {}) {
  const want = { 'Gentle slope (~11°)': 0.2, 'Slope (~24°)': 0.45, 'Steep slope (~37°)': 0.75 }, best = {}, d = (a, b) => Math.hypot(a - x0, b - z0);
  const note = (k, x, z, score) => { if (!best[k] || score < best[k].score || (score === best[k].score && d(x, z) < best[k].dist)) best[k] = { x, z, score, dist: d(x, z) }; };
  for (let x = x0 - radius; x <= x0 + radius; x += step) for (let z = z0 - radius; z <= z0 + radius; z += step) {
    const dep = depthAt(x, z);
    if (dep <= 0.02) {
      const s = slopeAt(x, z); for (const [k, v] of Object.entries(want)) note(k, x, z, Math.round(Math.abs(s - v) * 100) * 1000 + Math.round(d(x, z)));   // closest steepness first, then nearest
      if (s < 0.1 && (depthAt(x + 4, z) > 0.2 || depthAt(x - 4, z) > 0.2 || depthAt(x, z + 4) > 0.2 || depthAt(x, z - 4) > 0.2)) note('Shore (dry, water within 4 m)', x, z, Math.round(d(x, z)));
    } else if (dep > 0.12 && dep < 0.5 && slopeAt(x, z) < 0.25) note('Wading (shallow water)', x, z, Math.round(d(x, z)));
    else if (dep > 1.2) note('Deep water', x, z, Math.round(d(x, z)));
  }
  return Object.fromEntries(Object.entries(best).map(([k, v]) => [k, { x: v.x, z: v.z }]));
}


/** Grok's hand props (elf-game-pack/props, Synty-derived: PRIVATE, local only). side/rot follow ATTACH.md; the handle runs along glTF -Z, so +90 deg about X turns it along the game's tool +Y. clip = the game clip that pairs with it. */
export const HELD_PROPS = [
  { id: 'fishing_rod', side: 'r', rot: [90, 0, 0], clip: 'fish_loop' }, { id: 'axe', side: 'r', rot: [90, 0, 0], clip: 'chop' }, { id: 'pickaxe', side: 'r', rot: [90, 0, 0], clip: 'pick' },
  { id: 'hammer', side: 'r', rot: [90, 0, 0], clip: 'hammer' }, { id: 'shovel', side: 'r', rot: [90, 0, 0] }, { id: 'saw', side: 'r', rot: [90, 0, 0] }, { id: 'knife', side: 'r', rot: [90, 0, 0] },
  { id: 'spear', side: 'r', rot: [90, 0, 0] }, { id: 'bow', side: 'l', rot: [90, 0, -90] }, { id: 'torch', side: 'l', rot: [90, 0, 0] }, { id: 'fish', side: 'l', rot: [0, 0, 0] },
  { id: 'bucket', side: 'l', rot: [0, 0, 0] }, { id: 'basket', side: 'l', rot: [0, 0, 0] }, { id: 'waterskin', side: 'r', rot: [90, 0, 0] }, { id: 'cup', side: 'r', rot: [90, 0, 0] }, { id: 'cooking_pan', side: 'r', rot: [90, 0, 0] },
];
const propCache = new Map();
async function loadProp(id) { if (!propCache.has(id)) propCache.set(id, (await new GLTFLoader().loadAsync(`private-local/props/${id}.glb`)).scene); return propCache.get(id).clone(true); }

const clipCache = new Map();
async function playGrok(c, info) {
  const u = deps_game().playerObj.userData; let clip = clipCache.get(c.p);
  if (!clip) { try { clip = (await new GLTFLoader().loadAsync('private-local/elf-pack/' + c.p)).animations[0]; clipCache.set(c.p, clip); } catch (e) { info.textContent = 'could not load ' + c.p; return; } }
  const prop = HELD_PROPS.find(h => new RegExp('(^|[^a-z_])' + h.id + '([^a-z_]|$)').test(c.prop || '')); u.holdProp(null, 'r'); u.holdProp(null, 'l');
  if (prop) { u.holdProp(await loadProp(prop.id), prop.side, prop.rot); }
  const kept = u.playExternal(clip, { loop: c.loop });
  info.textContent = `${c.n}  [${c.g}]  ${clip.duration.toFixed(2)} s, ${c.fps} fps, ${c.loop ? 'loop' : 'one-shot'}${c.rm ? ', ROOT MOTION (plays in place here)' : ''}\n${kept ? kept + ' tracks bound' : 'NO tracks bound to this character'}${prop ? '\nholding: ' + prop.id : ''}${c.def ? '\nknown: ' + c.def.slice(0, 160) : ''}`;
}
let deps_game = () => null;

export function makeDevMoves(deps) {
  const { scene, getGame, teleport, groundAt, depthAt, slopeAt, findFlat } = deps; deps_game = getGame;
  let panel = null, arena = null, stations = null, readT = 0;
  const css = 'position:fixed;left:8px;top:64px;z-index:60;max-height:78vh;overflow:auto;width:230px;background:rgba(15,20,15,.88);color:#eee;font:12px system-ui,sans-serif;border-radius:8px;padding:6px;';
  const btn = (label, fn, parent) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'display:block;width:100%;margin:2px 0;padding:5px 6px;text-align:left;font:12px system-ui;border-radius:6px;border:0;background:#3a4a38;color:#fff;cursor:pointer'; b.onclick = (e) => { e.stopPropagation(); fn(); b.blur(); }; parent.append(b); return b; };
  const head = (t, parent) => { const h = document.createElement('div'); h.textContent = t; h.style.cssText = 'margin:8px 0 2px;font-weight:700;color:#e8c36a'; parent.append(h); };

  function buildArena() {
    if (arena) return arena;
    const G = getGame(), spot = findFlat(), group = new THREE.Group(), cols = [], stoneMat = new THREE.MeshStandardMaterial({ color: 0x8d8d86, roughness: 1 }), postMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }), labelCol = [];
    group.name = 'dev-arena'; scene.add(group);
    const hop = deps.HOP_MAX, climb = deps.CLIMB_MAX;
    ARENA_STONES.forEach((h, i) => {   // a row of stones facing the player start, 3 m apart, base on the real ground
      const x = spot.x + (i - 4.5) * 3, z = spot.z - 8, g = groundAt(x, z), r = 0.8;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 10), stoneMat); m.position.set(x, g + h / 2, z); m.castShadow = true; group.add(m);
      const c = { x, z, r, id: `devstone${i}c0`, dev: true }; if (h <= hop) c.h = h; else if (h <= climb) c.climb = h; cols.push(c);
      labelCol.push([x, z, `${h} m ${h <= hop ? 'hop' : h <= climb ? 'climb' : 'solid'}`]);
    });
    for (let i = 0; i < 6; i++) { const x = spot.x - 7.5 + i * 3, z = spot.z + 8, g = groundAt(x, z); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.2, 8), postMat); m.position.set(x, g + 1.1, z); group.add(m); cols.push({ x, z, r: 0.25, id: `devpost${i}c0`, dev: true }); }
    for (const c of cols) G.world.colliders.push(c);
    arena = { group, cols, spot, labels: labelCol }; return arena;
  }
  function closeArena() { if (!arena) return; const G = getGame(); scene.remove(arena.group); G.world.colliders = G.world.colliders.filter(c => !c.dev); arena = null; }

  function readout(el) {
    const G = getGame(), P = G.player, u = G.playerObj?.userData || {};
    const gait = u.gaitState?.() || {}, mi = u.moveInfo?.() || {};
    el.textContent = `x ${P.x.toFixed(1)}  z ${P.z.toFixed(1)}  y ${P.y.toFixed(2)}\nslope ${slopeAt(P.x, P.z).toFixed(2)}  depth ${depthAt(P.x, P.z).toFixed(2)}\nair ${!!P.air}  climb ${!!G.climb}  crouch ${!!G.crouch}\ngait ${gait.gait ?? '-'}  working ${!!u.working?.()}\nslopeW ${mi.slopeW ?? '-'}  land ${mi.landPick ?? '-'}`;
  }

  function open() {
    if (panel) return; const G = getGame(); panel = document.createElement('div'); panel.id = 'devMoves'; panel.style.cssText = css; document.body.append(panel);
    const title = document.createElement('div'); title.innerHTML = '<b>DEV · movement testbed</b> (local only)'; panel.append(title);
    const ro = document.createElement('pre'); ro.style.cssText = 'margin:4px 0;font:11px ui-monospace,monospace;white-space:pre-wrap;color:#9fe29f'; panel.append(ro);
    const tick = setInterval(() => readout(ro), 250); panel.dataset.tick = tick; panel._tick = tick;
    head('Arena (flat site near you)', panel);
    btn('Go to arena (stones 0.2–2.2 m, posts)', () => { const a = buildArena(); teleport(a.spot.x, a.spot.z + 3); }, panel);
    btn('Remove arena', closeArena, panel);
    head('Terrain stations', panel);
    const stBox = document.createElement('div'); panel.append(stBox);
    btn('Scan around me', () => { stBox.textContent = 'scanning…'; setTimeout(() => { const P = getGame().player; stations = findStations(P.x, P.z, { groundAt, depthAt, slopeAt }); stBox.textContent = ''; for (const [k, v] of Object.entries(stations)) btn(k, () => teleport(v.x, v.z), stBox); if (!Object.keys(stations).length) stBox.textContent = 'nothing found within 300 m'; }, 30); }, panel);
    head('Toggles', panel);
    btn('Toggle crouch (C)', () => { getGame().crouch = !getGame().crouch; }, panel);
    btn('Noon, clear', () => { getGame().state.tod = 12; }, panel);
    btn('Stand still / stop clip', () => { const u = getGame().playerObj?.userData; u?.stopWork?.(); u?.playClip?.(null); }, panel);
    head("Tools in hand (Grok models, private)", panel);
    for (const pr of HELD_PROPS) btn(pr.id.replaceAll('_', ' ') + (pr.clip ? ' + ' + pr.clip : ''), async () => { const u = getGame().playerObj.userData; u.holdProp(null, 'r'); u.holdProp(null, 'l'); u.holdProp(await loadProp(pr.id), pr.side, pr.rot); u.stopWork?.(); if (pr.clip) u.playWork(pr.clip, { loop: true }); }, panel);
    btn('Empty hands', () => { const u = getGame().playerObj.userData; u.holdProp(null, 'r'); u.holdProp(null, 'l'); u.stopWork?.(); }, panel);
    head('Fishing', panel);
    { const water = () => { const P = getGame().player; let best = 0, ba = 0; for (let a = 0; a < 6.283; a += 0.3) { const d = depthAt(P.x + Math.cos(a) * 2.4, P.z + Math.sin(a) * 2.4); if (d > best) { best = d; ba = a; } } getGame().player.face = Math.atan2(Math.cos(ba), Math.sin(ba)); return ba; };
      let auth = null; const fm = () => window.__fm;
      btn('Full fishing: rod out, cast, wait (no question)', () => fm().fishStart(water(), 'dev', true), panel);
      btn('  ...then: fish bites, reel in, lift', () => fm().fishResolve(true), panel);
      btn('  ...or: no bite, reel in empty', () => fm().fishResolve(false), panel);
      btn('Claude hand-authored whole sequence (no clips)', () => { const g = getGame(), u = g.playerObj.userData; water(); const rod = makeRod(); auth = u.playMotion('fish_full', { hook: (e) => { if (!rod) return; if (e === 'phase:settle' || e === 'rod-to-back') u.mount(rod, 'backAttach', [8, 0, 28], [0, 0.25, -0.12]); if (e === 'rod-to-hand') u.mount(rod, 'prop_r', [0, 0, 0]); if (e === 'done') u.unmount(rod); } }); }, panel);
      for (const ph of ['bite', 'strike', 'reel', 'lift', 'stow']) btn('  authored: go to ' + ph, () => auth && auth.go(ph), panel); }
    btn('Take me to the water (fishing spot)', () => { const P = getGame().player; const st = findStations(P.x, P.z, { groundAt, depthAt, slopeAt }, { radius: 250, step: 5 })['Shore (dry, water within 4 m)']; if (!st) return; teleport(st.x, st.z); for (let r = 1; r < 10; r += 1) for (let a = 0; a < 6.28; a += 0.3) { const wx = st.x + Math.cos(a) * r, wz = st.z + Math.sin(a) * r; if (depthAt(wx, wz) > 0.3) { getGame().player.face = Math.atan2(wx - st.x, wz - st.z); return; } } }, panel);
    btn('Rod in hand + casting', async () => { const u = getGame().playerObj.userData; u.holdProp(null, 'l'); u.holdProp(await loadProp('fishing_rod'), 'r', [90, 0, 0]); u.playWork('fish_loop', { loop: true }); }, panel);
    btn('Catch in hand (fish)', async () => { const u = getGame().playerObj.userData; u.stopWork?.(); u.holdProp(await loadProp('fishing_rod'), 'r', [90, 0, 0]); u.holdProp(await loadProp('fish'), 'l', [0, 0, 0]); }, panel);
    head('Grok clips (elf pack, private, review only)', panel);
    { const box = document.createElement('div'), sel = document.createElement('select'), q = document.createElement('input'), list = document.createElement('div'), info = document.createElement('div'); let clips = [];
      sel.style.cssText = q.style.cssText = 'width:100%;margin:2px 0;padding:4px;font:12px system-ui'; q.placeholder = 'filter by name…'; info.style.cssText = 'font-size:11px;color:#f0c987;margin:3px 0;white-space:pre-wrap'; box.append(sel, q, info, list); panel.append(box);
      const show = () => { list.textContent = ''; const f = q.value.toLowerCase(), rows = clips.filter(c => (sel.value === 'all' || c.g === sel.value) && (!f || c.n.toLowerCase().includes(f))); for (const c of rows.slice(0, 80)) btn(c.n + (c.rm ? '  (root motion)' : ''), () => playGrok(c, info), list); if (rows.length > 80) { const m = document.createElement('div'); m.textContent = `+${rows.length - 80} more: type to filter`; list.append(m); } };
      fetch('private-local/grok_clips.json').then(r => r.json()).then(j => { clips = j; const groups = [...new Set(j.map(c => c.g))]; sel.innerHTML = '<option value="all">all groups (' + j.length + ')</option>' + groups.map(g => `<option value="${g}">${g} (${j.filter(c => c.g === g).length})</option>`).join(''); sel.onchange = show; q.oninput = show; show(); }).catch(() => { info.textContent = 'clip index not found'; });
    }
    head('Play any clip (looped, no rewards)', panel);
    const names = [...new Set([...(G.playerObj?.userData.workClips?.() || []), ...(G.playerObj?.userData.clipNames || [])])];
    for (const n of names) btn((G.playerObj.userData.clipLabels?.[n] || n).replaceAll('_', ' '), () => { const u = getGame().playerObj.userData; if (!u.playClip?.(n)) u.playWork?.(n, { loop: true }); }, panel);
    if (!names.length) { const e = document.createElement('div'); e.textContent = 'no extra clips loaded for this character'; panel.append(e); }
    readout(ro);
  }
  function close() { if (!panel) return; clearInterval(panel._tick); panel.remove(); panel = null; closeArena(); }
  return { open, close, toggle: () => (panel ? close() : open()), buildArena, closeArena, get isOpen() { return !!panel; }, get arena() { return arena; } };
}
