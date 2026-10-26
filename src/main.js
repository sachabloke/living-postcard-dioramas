import { createTogether } from './together.js';
import * as THREE from 'three';
import { regionAt, groundAt, depthAt, slopeAt, tileOf, tileKey, tileRect, BOUNDS, TILE, CAMP, HUT, GATE, BRIDGE, waterY, riverX, useWatershed, WS } from './terrain.js';
import { makeWatershed, WS_ID, SPAWN_CANDIDATE } from './watershed.js';
import { generateTile, biomeAt, THEME_MODELS } from './tiles.js';
import { weatherFront } from './weatherfront.js';
import { makeGroundCover } from './cover.js';
import { stepWarmth, warningStrength, pulse, seasonOfDay, SEASONS, WARM } from './warmth.js';
import { makeHut, makeShelterMesh } from './hut.js';
import { canPlace, ITEMS } from './placement.js';
import { buildWorld } from './world.js';
import { moveStep, findSafeSpot, PLAYER_R, stepVertical } from './movement.js';
import { annotateHops } from './hop.js';
import { findClimb, climbAt, CLIMB_DUR } from './climb.js';
import * as SK from './skills.js';
import * as F from './foraging.js';
import { makeForageView, loadForageAssets } from './foraging_view.js';
import { makeTreeFx } from './treefx.js';
import { makeDevMoves } from './devmoves.js';
import { HOP_MAX } from './movement.js';
import { CLIMB_MAX } from './hop.js';
import { skyHtml, nextSkill } from './skillsview.js';
import { topicName } from './topicnames.js';
import * as ADV from './adventure.js';
import * as GD from './guide.js';
import { makeFishFx, castTarget } from './fishfx.js';
import { atmosphere, withWeather, phaseName, DAY_LEN } from './atmosphere.js';
import { WeatherState, WEATHER } from './weather.js';
import { hutWallColliders } from './world.js';
import * as WF from './weatherfx.js';
import * as LIFE from './life.js';
import { makeCustomiser, HAIR_STYLES, HAIR_COLOURS, JACKET_COLOURS, SKIN_TONES, DEFAULT_LOOK } from './avatar.js';
import { makeQuality } from './quality.js';
import * as S from './scene.js';
import { makeExplorerFromModel } from './explorer.js';
import { FAMILY as CFG_FAMILY } from './config.js';
import { vizSVG, stepsSVG } from './visual.js';
import { explainFrames } from './explainer.js';
const FAMILY = CFG_FAMILY || /[?&]family=1/.test(location.search);
import * as SkeletonUtils from '../vendor/three/utils/SkeletonUtils.js';
import { spawnAnimals, stepAnimal, SPECS as ANIMAL_SPECS } from './animals.js';
import * as R from './rules.js';
import { makeRng } from './rng.js';
import { PROFILES, loadState, saveState, peekState, hasPin, setPin, checkPin, clearProfile } from './save.js';

const $ = (id) => document.getElementById(id);
const qs = new URLSearchParams(location.search), TEST = qs.get('test') === '1' && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);   // test hooks exist on localhost only
const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 1;
const LOD_FAR = { tree_hero_broadleaf_01_mobile: 'tree_far_lod2', tree_hero_broadleaf_01_mobile_gold: 'tree_far_lod2', fm_tree_winter_bare_a: 'tree_far_bare', fm_tree_winter_bare_b: 'tree_far_bare', fm_tree_blossom_spring: 'tree_far_lod2' };
// Seasonal look: the same world props are drawn with a different model (Grok Group A). Collision and node data never change.
const SEASON_KIND = { fm_tree_autumn_a: 'tree', fm_tree_autumn_b: 'tree', fm_bush_autumn: 'deco', fm_tree_winter_bare_a: 'tree', fm_tree_winter_bare_b: 'tree', fm_tree_blossom_spring: 'tree', fm_boulder_snowcap_a: 'grock', fm_boulder_snowcap_b: 'grock', fm_boulder_snowcap_c: 'grock', fm_bush_frosted: 'deco', fm_fern_frosted: 'deco', fm_snowdrift_low_a: 'deco', fm_puddle_rain_small: 'deco', fm_puddle_rain_medium: 'deco', fm_frost_patch_small: 'deco', fm_frost_patch_large: 'deco', fm_mud_patch_wet: 'deco', fm_leaf_litter_patch_medium_frost: 'deco', fm_log_mossy_fallen_a_snow: 'grock', fm_log_mossy_fallen_b_snow: 'grock', fm_log_mossy_fallen_c_snow: 'grock', fm_tent_aframe_snow: 'grock', fm_crate_snow: 'grock', fm_barrel_snow: 'grock', fm_drying_rack_frost: 'grock', fm_snowdrift_low_b: 'deco' };
const idHash = (id) => { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; };
function seasonModel(p, season) {
  const m = p.model, h = idHash(p.id);
  if (p.snowy) season = 'winter';                                                // props in snow regions look wintry all year
  if (season === 'winter') { if (m.startsWith('tree_hero_broadleaf')) return h % 2 ? 'fm_tree_winter_bare_a' : 'fm_tree_winter_bare_b'; if (m.startsWith('fm_boulder_mossy_')) return 'fm_boulder_snowcap_' + m.slice(-1); if (m === 'fm_bush_round' || m === 'fm_bush_low_spread' || m.startsWith('fm_shrub_')) return 'fm_bush_frosted'; if (m === 'fm_fern_clump') return 'fm_fern_frosted'; if (m.startsWith('fm_log_mossy_fallen_')) return m + '_snow'; if (m === 'fm_leaf_litter_patch_medium') return 'fm_leaf_litter_patch_medium_frost'; if (m === 'fm_leaf_litter_patch_small') return 'fm_frost_patch_small'; if (m === 'fm_leaf_litter_patch_large') return 'fm_frost_patch_large'; if (m === 'fm_tent_aframe') return 'fm_tent_aframe_snow'; if (m === 'fm_crate_wooden') return 'fm_crate_snow'; if (m === 'fm_barrel_wooden') return 'fm_barrel_snow'; if (m === 'fm_drying_rack') return 'fm_drying_rack_frost'; }
  if (season === 'spring' && m === 'tree_hero_broadleaf_01_mobile' && h % 5 === 0) return 'fm_tree_blossom_spring';
  if (season === 'autumn') { if (m === 'tree_hero_broadleaf_01_mobile' && h % 3 === 0) return h % 2 ? 'fm_tree_autumn_a' : 'fm_tree_autumn_b'; if (m === 'fm_bush_round' || m === 'fm_bush_low_spread') return 'fm_bush_autumn'; }
  return m;
}
// Per-tree colour variety (reference look: mixed greens with some warm trees). Deterministic per prop id; winter stays untinted.
const TREE_TINTS = {
  summer: [[1, 1, 1], [0.92, 1.08, 0.72], [0.8, 1, 0.88], [1, 1.05, 0.8], [0.9, 1, 0.95], [1, 0.95, 0.75]],
  spring: [[1, 1.06, 0.9], [0.92, 1.1, 0.78], [1, 1, 1], [0.95, 1.08, 0.95]],
  autumn: [[2.2, 0.75, 0.2], [2.4, 0.45, 0.2], [2.0, 1.2, 0.25], [1, 1, 0.7], [2.1, 0.6, 0.25], [1.6, 1.1, 0.3]],   // >1 on purpose: lifts the dull green leaf texture to bright orange/red/gold
  winter: null,
};
const treeTintFn = (season) => { const pal = TREE_TINTS[season]; return pal ? (p) => pal[idHash(p.id || String(p.x)) % pal.length] : null; };
// Ground-cover reach (m) follows the adaptive quality tier: far when the device keeps up, near when frame rate drops.
const COVER_REACH = { high: 26, med: 19, low: 12 };
const FAR_TINT = { winter: [0.62, 0.56, 0.52], autumn: [1, 0.95, 0.85], spring: [1, 1.04, 1.02], summer: [1, 1, 1] };
const MODEL_NAMES = ['tree_far_decimated', 'tree_far_lod2', 'tree_far_bare', 'mk_grass_tall', 'mk_grass_wispy', 'mk_grass_short', 'mk_flower3', 'mk_flower4', 'mk_mushroom', 'mk_clover', 'tree_hero_broadleaf_01_mobile', 'tree_hero_broadleaf_01_mobile_gold', 'rock_boulder_bare_mobile', 'rock_spire_bare_mobile', 'rock_slab_bare_mobile', 'Bush_80', 'Bush_82', 'Fern_170', 'Flower_150', 'Flower_151', 'reeds_cattail_clump', 'lily_pad_cluster', 'wildflower_clump', 'Hollow_Log', 'Woodland_Workbench', 'fm_boulder_mossy_a', 'fm_boulder_mossy_b', 'fm_boulder_mossy_c', 'fm_cairn', 'fm_signpost', 'fm_lantern_post', 'fm_fern_clump', 'fm_bush_round', 'fm_bush_low_spread', 'fm_shrub_flowering_elder', 'fm_shrub_flowering_rose', 'fm_mushroom_ring', 'fm_log_hollow', 'fm_tree_stump', 'fm_driftwood_pile', 'fm_rowing_boat', 'fm_crate_wooden', 'fm_barrel_wooden', 'fm_firewood_stack', 'fm_cooking_pot_tripod', 'fm_bedroll', 'fm_bucket_ladle', 'fm_tent_aframe', 'fm_drying_rack', 'fm_rabbit_forest', 'fm_deer_forest', 'fm_heron_forest', 'fm_fox_forest', 'fm_blanket_wool_folded', 'fm_food_basket_forage', 'fm_lantern_hand', 'fm_log_seat_short', 'fm_rain_awning_tarp', 'fm_stool_stump_cushion', 'fm_puddle_rain_small', 'fm_puddle_rain_medium', 'fm_frost_patch_small', 'fm_frost_patch_large', 'fm_mud_patch_wet', 'fm_leaf_litter_patch_medium_frost', 'fm_log_mossy_fallen_a_snow', 'fm_log_mossy_fallen_b_snow', 'fm_log_mossy_fallen_c_snow', 'fm_leaf_litter_patch_small', 'fm_leaf_litter_patch_medium', 'fm_leaf_litter_patch_large', 'fm_log_mossy_fallen_a', 'fm_log_mossy_fallen_b', 'fm_log_mossy_fallen_c', 'fm_brown_trout_forest', 'fm_minnow_school_forest', 'fm_common_frog_forest', 'fm_dragonfly_forest', 'fm_berry_bush_full', 'fm_berry_bush_picked', 'fm_tent_aframe_snow', 'fm_crate_snow', 'fm_barrel_snow', 'fm_drying_rack_frost', 'fm_campfire_stage1_laid', 'fm_campfire_stage3_embers', 'fm_badger_forest', 'fm_mallard_duck_forest', 'fm_red_squirrel_forest', 'fm_tawny_owl_forest', 'fm_boulder_snowcap_a', 'fm_boulder_snowcap_b', 'fm_boulder_snowcap_c', 'fm_bush_frosted', 'fm_fern_frosted', 'fm_ice_patch_a', 'fm_ice_patch_b', 'fm_pine_a', 'fm_pine_b', 'fm_snowdrift_low_a', 'fm_snowdrift_low_b', 'fm_tree_blossom_spring', 'fm_tree_winter_bare_a', 'fm_tree_winter_bare_b', 'fm_tree_autumn_a', 'fm_tree_autumn_b', 'fm_bush_autumn', 'fm_trunk_fallen_dead_a', 'fm_trunk_fallen_dead_b', 'fm_reeds_cattail_a', 'fm_reeds_cattail_b', 'fm_reeds_cattail_c', 'fm_standing_stone', 'fm_stone_circle_piece', 'fm_ruined_arch_small', 'fm_watchtower_small', 'fm_waymarker_boulder', 'fm_paddle_and_net_stakes', 'stone_well', 'fence_section', 'fence_gate', 'dock_short', 'fire_stone_ring', 'stepping_stones', 'Woodland_Mushrooms', 'Timber_Log', 'Log_Bench', 'Cut_Stump', 'Woodland_Footbridge', 'Trail_Sign', 'Timber_Stack', 'Rock_100', 'Rock_101', 'Rock_102', 'alp_Prop_Cabin_01', 'alp_Prop_Wood_Pile_01', 'alp_Prop_Chair_Log_01', 'alp_Prop_Fish_Rack_01', 'alp_Prop_Canoe_01', 'alp_Env_Pine_01', 'alp_Env_Pine_03', 'alp_Env_Pine_05', 'alp_Env_Bush_Flower_01', 'swp_Env_Tree_Mangrove_01', 'swp_Env_Tree_Mangrove_02', 'swp_Env_Reeds_01', 'swp_Env_Reeds_02', 'swp_Env_MossMound_01', 'swp_Env_Toetoe_01', 'swp_Env_LillyPads_01', 'nat_Rock_Pile_01', 'nat_Prop_CampFire_01', 'alp_Env_Rock_05', 'alp_Env_Bush_01', 'alp_Env_Moss_Lumps_01', 'alp_Prop_Tent_01', 'alp_Prop_Ice_Fishing_Hut_01', 'alp_Prop_Bench_01', 'swp_Env_Bush_Bramble_01', 'swp_Prop_Swamp_Lantern_01', 'swp_Env_Tree_Swamp_03'];

// ---------------- renderer / scene ----------------
{ const g = document.createElement('canvas'); g.width = g.height = 160; const x = g.getContext('2d'), im = x.createImageData(160, 160); for (let i = 0; i < im.data.length; i += 4) { const v = 90 + Math.random() * 120 | 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); $('grain').style.backgroundImage = `url(${g.toDataURL()})`; }   // fine film grain, as in the Postcards
const canvas = $('gl'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.1, 600);
const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 0.8), sun = new THREE.DirectionalLight(0xffffff, 2);
sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048); Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 220 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(hemi, sun, sun.target);
scene.fog = new THREE.Fog(0xaaccdd, 20, 140);
const sky = S.makeSky(); scene.add(sky);
let quality = makeQuality({ cap: 1, auto: true, startScale: touch ? 0.85 : 1 }); let qualityMode = 'Auto';
const dprBase = Math.min(window.devicePixelRatio || 1, touch ? 2 : 1.75);
let appliedScale = -1;
function applyScale() { if (Math.abs(appliedScale - quality.scale) < 1e-3) return; appliedScale = quality.scale; renderer.setPixelRatio(dprBase * quality.scale); resize(); }
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); addEventListener('orientationchange', () => setTimeout(resize, 200));

// ---------------- game state ----------------
let G = null;               // set by startGame
const input = { x: 0, y: 0, sprint: false, jump: false, keys: new Set() };
const cam = { yaw: 0.95, pitch: 0.38, dist: 6.2, pos: new THREE.Vector3(), look: new THREE.Vector3() };
let mode = 'start';         // start | play | ask | menu | report | time
let reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let paused = false, nowMs = () => Date.now();

const notifyLevel = (lv, name = 'Athletics') => { if (lv) toast(name === 'Athletics' || name === 'Woodcraft' || name === 'Stonework' ? `${name} ${lv}: you feel stronger` : `${name} ${lv}: you are getting better at this`, 3000); };
function toast(msg, ms = 2200) { const t = $('toast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.add('hidden'), ms); }

// ---------------- start screen / profiles ----------------
let models = null, loading = null;
// Meshy explorer trial (parent-approved 23 Oct 2026; review build only). Off by default: ?explorer=1 or the menu toggle.
const EXPLORER = (() => { try { return localStorage.getItem('fm_explorer') === '1' || /[?&]explorer=1/.test(location.search); } catch { return false; } })();
const WOODLAND = /[?&]character=woodland/.test(location.search);                                  // optional local trial of the free woodland character (Codex package, 23 Oct 2026); never saved, never default
async function ensureModels() { if (models) return; $('loadmsg').textContent = 'Loading library models…'; models = await S.loadModels(MODEL_NAMES); try { Object.assign(models, await S.loadModels(['char_boy_native'])); } catch { /* optional: primitive avatar used */ } if (EXPLORER) { try { Object.assign(models, await S.loadModels(['char_explorer_meshy'])); } catch { /* falls back to the native boy */ } } if (touch) shrinkTextures(512); $('loadmsg').textContent = ''; }
/** iPad memory: the library's 1024 px textures add up to about 550 MB, which makes Safari kill the page. Halve them on touch devices before anything is cloned. */
function shrinkTextures(maxDim) {
  const seen = new Set();
  for (const m of Object.values(models)) m?.root?.traverse?.(o => { for (const mat of [].concat(o.material || [])) for (const k in mat) { const t = mat[k]; if (!t?.isTexture || seen.has(t)) continue; seen.add(t); const im = t.image, w = im?.width, h = im?.height; const lim = k === 'normalMap' ? maxDim / 2 : maxDim; if (!w || !h || Math.max(w, h) <= lim) continue; const sc = lim / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * sc)); c.height = Math.max(1, Math.round(h * sc)); try { c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); t.image = c; t.needsUpdate = true; } catch { /* keep the original */ } } });
}
document.querySelectorAll('[data-profile]').forEach(b => b.onclick = async () => { await startGame(b.dataset.profile, false); });
$('btnParent').onclick = () => openPin();
function openPin() {
  $('start').classList.add('hidden'); $('pin').classList.remove('hidden'); $('pinInput').value = ''; $('pinMsg').textContent = '';
  const first = !hasPin(); $('pinTitle').textContent = first ? 'Set a parent PIN' : 'Parent PIN';
  $('pinHelp').textContent = first ? 'Choose 4–8 digits. It is stored only in this browser as a salted hash. There is no built-in or shared PIN.' : 'Enter your PIN to open parent mode.';
}
$('pinCancel').onclick = () => { $('pin').classList.add('hidden'); $('start').classList.remove('hidden'); };
$('pinOk').onclick = async () => {
  const v = $('pinInput').value.trim();
  try { if (!hasPin()) await setPin(v); else if (!(await checkPin(v))) { $('pinMsg').textContent = 'That PIN is not right.'; return; } }
  catch (e) { $('pinMsg').textContent = e.message; return; }
  $('pin').classList.add('hidden'); await startGame('parent-test', true);
};

// Separate opt-in LOCAL world: ?world=watershed. Own terrain/water/tiles (src/watershed.js) and its own saves: every profile id is prefixed, so nothing here can touch a normal save or world.
const WSW = /[?&]world=watershed/.test(location.search), FORAGE_ON = WSW || /[?&]forage=1/.test(location.search);   // foraging and cooking trial: local, watershed (or ?forage=1) only
async function loadWatershed() { if (WS) return; const r = await fetch('./assets/data/watershed-v1-seed61.bin'); if (!r.ok) throw new Error('watershed data missing'); useWatershed(makeWatershed(await r.arrayBuffer())); }
async function startGame(profileId, parentAuthed) {
  if (WSW) { await loadWatershed(); const base = PROFILES[profileId]; profileId = 'ws61-' + profileId; PROFILES[profileId] ||= { ...base, id: profileId, name: base.name.replace(/\)$/, '') + (base.name.endsWith(')') ? ', watershed)' : ' (watershed)'), synthetic: true, family: false }; }   // own save key and always a synthetic profile
  await ensureModels();
  $('start').classList.add('hidden'); $('hud').classList.remove('hidden');
  // Empty start (local opt-in): ?start=empty on a profile with NO save yet gives an open forest with none of the founder camp, and remembers it in the save (state.start).
  // Saves made before this existed have no state.start, so every existing world keeps its camp and buildings exactly as before.
  if (WSW && /[?&]fresh=1/.test(location.search)) clearProfile(profileId);   // watershed test world only: start over from the dry clearing
  const fresh = !peekState(profileId), state = loadState(profileId); if (WSW) { if (fresh) state.start = 'empty'; state.world = WS_ID; } else if (fresh && /[?&]start=empty/.test(location.search)) state.start = 'empty';
  const world = buildWorld(7, { empty: state.start === 'empty', watershed: WSW }); annotateHops(world.colliders, world.props);
  G = { state, id: profileId, parent: !!parentAuthed, free: !!parentAuthed, world, objs: new Map(), tiles: new Map(), stats: { loads: 0, unloads: 0 }, t: 0, hitCull: 0, regrow: [],
    player: { x: 0, y: 0, z: 0, face: 0, speed: 0 }, session: null, fires: [], nodeById: new Map(), lastSave: 0, lastRipple: 0, lastTouch: 0, resting: new Map() };
  for (const n of world.nodes) G.nodeById.set(n.id, n);
  state.tod ??= 0.27;
  // objects that are always present: terrain, water, grass, bridge, gate, camp furniture
  G.terrainMat = S.makeTerrainMaterial(); G.tileGroup = new THREE.Group(); scene.add(G.tileGroup); G.homeProps = world.props.slice(); G.homeNodes = world.nodes.slice(); world.ready = (x, z) => G.tiles.has(tileKey(...tileOf(x, z)));
  G.water = S.makeWater(); scene.add(G.water);
  G.cover = makeGroundCover(); G.cover.userData.addModels?.(models); scene.add(G.cover);
  G.grass = S.makeGrass(touch ? 7000 : 13000, touch ? 15 : 19); scene.add(G.grass);
  G.terrain = { userData: G.terrainMat.userData }; G.weather = new WeatherState({ allowed: ['clear', 'cloudy', 'mist', 'shower', 'rain', 'storm', 'wind'], seed: 11, comfort: true });
  if (state.weather) { G.weather.set(state.weather.type, state.weather.intensity); G.weather.auto = !!state.weather.auto; } G.weather.step(1, { instant: true });
  G.rainbow = WF.createRainbow(); scene.add(G.rainbow.group); G.rain = WF.makeRain(touch ? 1800 : 3600); scene.add(G.rain.object); G.bolt = WF.createBolt({ radius: 110 }); scene.add(G.bolt.mesh); G.leaves = WF.makeRiverLeaves(touch ? 16 : 30); scene.add(G.leaves); G.butterflies = LIFE.makeButterflies(touch ? 8 : 14); scene.add(G.butterflies); G.birds = LIFE.makeBirds(touch ? 4 : 7); scene.add(G.birds); G.lastStrike = 0;
  G.shafts = S.makeShafts(); scene.add(G.shafts); G.motes = S.makeMotes(touch ? 140 : 260); scene.add(G.motes);
  if (!WSW) { addBridge(); addGate(); }
  { const useExplorer = EXPLORER && models.char_explorer_meshy; let sample = null;
    if (!EXPLORER && !WOODLAND && !/[?&]character=legacy/.test(location.search)) {   // default: Synty Sidekick character (boy / girl / woman / man; the choice is remembered on this device)
      try { const m = await import('./sidekick-character.js'); let who = 'elf-ranger'; try { who = localStorage.getItem('fm_who') || who; } catch {} if (!m.SIDEKICK_PRESETS[who]) who = 'elf-ranger'; G.sk = { who, order: Object.keys(m.SIDEKICK_PRESETS), presets: m.SIDEKICK_PRESETS }; G.skAnims = await m.loadSidekickAnims(undefined, who); sample = m.makeSidekickAvatar(await m.loadSidekick(who), undefined, G.skAnims);
        m.loadSidekickAirAnims(undefined, who).then(c => sample.userData.addAirClips?.(c)).catch(e => console.warn('jump animations unavailable, the jump still works', e));
        m.loadSidekickCrouchAnims(undefined, who).then(c => sample.userData.addCrouchClips?.(c)).catch(e => console.warn('crouch animation unavailable, crouching just slows you', e));
        m.loadSidekickMoveAnims(undefined, who).then(c => sample.userData.addMoveClips?.(c)).catch(e => console.warn('slope animations unavailable, slopes use the normal gait', e));
        m.loadSidekickClimbAnims().then(c => sample.userData.addClimbClips?.(c)).catch(e => console.warn('climb animation unavailable, climbing still works', e));
        if (/[?&]anims=1/.test(location.search)) { try { sample.userData.addReviewClips(await m.loadSidekickExtraAnims(undefined, who)); } catch (e) { console.warn('review animations unavailable', e); } } }
      catch (e) { G.sk = null; console.warn('Sidekick character unavailable, using the default', e); } }
    if (WOODLAND && !useExplorer) { try { const sc = await import('./sample-character.js'); const who = (location.search.match(/[?&]who=([\w-]+)/) || [])[1] || 'boy-12'; const data = await sc.loadSampleCharacter({ preset: who }); sample = sc.makeSampleAvatar(data); } catch (e) { console.warn('woodland character unavailable, using the default', e); } }
    G.playerObj = sample || (useExplorer ? makeExplorerFromModel(models, 'char_explorer_meshy', 1.5) : S.makeAvatarFromModel(models, 'char_boy_native', 1.5)) || S.makePlayer(); scene.add(G.playerObj);
    if (sample && G.sk) { $('mLook').textContent = `Character: ${G.sk.presets[G.sk.who].label.split(' · ')[0]} (tap to choose)`; if (/[?&]anims=1/.test(location.search)) installExplorerReview(sample, 'Play animation (review tool, nothing is awarded)'); }
    else if (sample) { installExplorerReview(sample, 'Play woodland action'); toast('Woodland character trial (local test). Actions are in the menu; nothing is awarded.', 5000); }
    else if (useExplorer) { fetch('./assets/data/character-contact-samples.json').then(r => r.json()).then(d => G.playerObj.userData.setContactProfiles?.(d)).catch(() => {}); installExplorerReview(G.playerObj); }
    else if (models.char_boy_native) { G.custom = makeCustomiser(G.playerObj); G.custom.set(state.look || DEFAULT_LOOK); } }
  const spawn = state.pos ? state.pos : WSW ? SPAWN_CANDIDATE : { x: 19.5, z: 47.5 };
  if (WSW) { const s = wsSpawn(spawn.x, spawn.z, true); Object.assign(G.player, s); G.wsSpawn = s; }
  else { const safe = findSafeSpot(spawn.x, spawn.z, world, { seamOpen: state.crossed });
  Object.assign(G.player, safe || { x: 19.5, z: 47.5, y: groundAt(19.5, 47.5) }); }
  if (state.start === 'empty') {   // first woodland adventure: a checklist, a river to find, and the first view looks toward natural water rather than the bridge
    state.adv ||= ADV.newAdv(); G.advWater = ADV.findWaterTarget(G.player.x, G.player.z) || false;
    if (!state.pos && G.advWater) cam.yaw = Math.atan2(-(G.advWater.wx - G.player.x), -(G.advWater.wz - G.player.z));
    if (!state.pos && G.advWater) {   // keep the footbridge (the only crossing, left in place) out of the opening view if the river can stay in it
      const rel = (x, z, y) => Math.atan2((x - G.player.x) * Math.cos(y) + (z - G.player.z) * -Math.sin(y), (x - G.player.x) * -Math.sin(y) + (z - G.player.z) * -Math.cos(y));
      const b = rel(BRIDGE.x, BRIDGE.z, cam.yaw); if (Math.abs(b) < 0.85) { const y2 = cam.yaw + Math.sign(b || 1) * (0.85 - Math.abs(b)); if (Math.abs(rel(G.advWater.wx, G.advWater.wz, y2)) < 0.6) cam.yaw = y2; }
    }
  }
  $('mJournal').classList.toggle('hidden', !state.adv);
  G.animals = new Map();
  if (!WSW) { const B = BOUNDS, avoid = (x, z) => Math.hypot(x - CAMP.x, z - CAMP.z) < 10 || Math.hypot(x - HUT.x, z - HUT.z) < 9 || Math.hypot(x - GATE.x, z - GATE.z) < 6;
    for (const a of [...spawnAnimals('home_m', { x0: B.minX, x1: B.maxX, z0: 0, z1: B.maxZ }, 'meadow', avoid, []), ...spawnAnimals('home_w', { x0: B.minX, x1: B.maxX, z0: B.minZ, z1: 0 }, 'woodland', avoid, G.world.props.filter(p => p.model === 'fm_tree_stump').map(p => ({ x: p.x, z: p.z, y: p.y + 0.62 * p.scale })))]) G.animals.set(a.id, a); }
  buildKinds(); updateTiles(true); cullProps(); G.cover.userData.update(G.player.x, G.player.z, 1, 0, true);
  buildHutVisuals();
  for (const f of state.fires || []) addFire(f.x, f.z, false);
  if (state.built.campfire && !(state.fires || []).length) { state.fires = [{ x: CAMP.x, z: CAMP.z }]; addFire(CAMP.x, CAMP.z, false); }
  syncBuilt(); for (const p of state.placed || []) addPlaced(p);
  updatePill(); renderInv(); renderGoal(); $('btnBuild').classList.toggle('hidden', !G.parent); $('mReport').classList.toggle('hidden', !G.parent); $('mFree').classList.toggle('hidden', !G.parent); $('mTime').classList.toggle('hidden', !G.parent); $('mDiag').classList.toggle('hidden', !G.parent);
  $('rulesText').innerHTML = 'How it works: <b>exploring is free</b>. Gathering and building need a maths question. A right answer always pays. A wrong answer takes nothing; it shows how, and that tree/rock rests about 5 minutes. Hints are fine — they are noted separately for your parent.';
  G.treeFx = makeTreeFx(scene, { instantiate: (name, x, z, rot, sc, sink, y) => S.instantiate(models, name, x, z, rot, sc, sink, y), groundAt, onFallStart: (p) => refreshNodeVisual(p) });
  if (TEST && qs.get('dev') === '1') {   // developer movement testbed (localhost + ?test=1 only)
    const flat = () => { const P = G.player, ok = (x, z) => { for (const r of [0, 6, 12, 18]) for (let a = 0; a < 6.283; a += 0.6) { const X = x + Math.cos(a) * r, Z = z + Math.sin(a) * r; if (depthAt(X, Z) > 0 || slopeAt(X, Z) > 0.07) return false; } return !G.world.colliders.some(c => !c.dev && Math.hypot(x - c.x, z - c.z) < c.r + 16); };
      for (let r = 0; r < 400; r += 4) for (let a = 0; a < 6.283; a += r < 1 ? 7 : 0.3) { const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; if (ok(x, z)) return { x, z }; } return { x: P.x + 20, z: P.z }; };
    G.dev = makeDevMoves({ scene, getGame: () => G, groundAt, depthAt, slopeAt, findFlat: flat, HOP_MAX, CLIMB_MAX, teleport: (x, z) => { const P = G.player; P.x = x; P.z = z; P.y = groundAt(x, z); P.air = false; P.vy = 0; G.climb = null; updateTiles(true); cullProps(); G.cover.userData.update(x, z, 1, 0, true); } });
    G.dev.open(); addEventListener('keydown', (e) => { if (e.key === '\\') G.dev.toggle(); });
  }
  if (FORAGE_ON) { const assets = await loadForageAssets(F.SPECIES_IDS); for (const id of Object.keys(assets)) { F.SPECIES[id].modelLoaded = true; if (F.GAME_CAMERA_CHECKED.includes(id)) F.SPECIES[id].placeholder = false; } G.forage = makeForageView(scene, F.makeEnv({ groundAt, depthAt, slopeAt, biomeAt }), { assets }); }
  mode = 'play'; resize(); applyScale(); last = performance.now(); requestAnimationFrame(loop);
  if (!state.seenIntro) { toast('Walk with WASD / the stick. Gather, build, and follow the trail: the world goes on and on.', 6000); state.seenIntro = true; }
  if (TEST) exposeTest();
}

/** Dry, open, collision-free start in the watershed world: searches outward from the study's candidate on the real surface and loaded colliders (trees, rocks, props), needs a dry ring, a gentle slope and water within reach. */
function wsSpawn(x0, z0, search) {
  const [tx0, tz0] = tileOf(x0, z0), colliders = []; for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) colliders.push(...generateTile(tx0 + dx, tz0 + dz, 7, { empty: true }).colliders);   // the same pure tile generator the game will load
  const ok = (x, z) => {
    if (depthAt(x, z) > 0 || slopeAt(x, z) > 0.28) return false;
    for (const r of [2, 4, 6]) for (let a = 0; a < 6.283; a += 0.5) if (depthAt(x + Math.cos(a) * r, z + Math.sin(a) * r) > 0 || slopeAt(x + Math.cos(a) * r, z + Math.sin(a) * r) > 0.5) return false;
    return !colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 3.2);
  };
  if (search) for (let r = 0; r < 60; r += 1.5) for (let a = 0; a < 6.283; a += r < 1 ? 7 : 0.35) { const x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r; if (ok(x, z)) return { x, z, y: groundAt(x, z) }; }
  return { x: x0, z: z0, y: groundAt(x0, z0) };
}
// ---------------- scene content ----------------
function addBridge() {
  const m = models['Woodland_Footbridge'], o = m.root.clone(true); o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  const g = new THREE.Group(); g.add(o); o.position.set(-m.base.x, -m.minY, -m.base.z);
  g.position.set(BRIDGE.x, waterY(BRIDGE.z) + BRIDGE.y0, BRIDGE.z); g.scale.set(BRIDGE.sx, BRIDGE.sy, BRIDGE.sz); g.name = 'bridge'; scene.add(g); G.bridge = g;
}
function addGate() {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(GATE.r, 0.07, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  ring.rotation.x = Math.PI / 2; ring.position.set(GATE.x, groundAt(GATE.x, GATE.z) + 0.12, GATE.z); scene.add(ring); G.gateRing = ring;
  const sign = S.instantiate(models, 'Trail_Sign', GATE.x + 2.9, GATE.z + 0.8, -0.5, 1.5); scene.add(sign);
  const label = S.makeSprite('Optional challenge', 1.3); label.position.set(GATE.x, groundAt(GATE.x, GATE.z) + 2.4, GATE.z); scene.add(label); G.gateLabel = label;   // rule 17: never a barrier
}
// Props are drawn as instanced kinds (one draw call per mesh part per model). Each 0.3 s the visible lists are rebuilt from
// the world data by distance, area load state and depletion. Collision never depends on what is drawn.
const SOLO = new Set(['log', 'stump', 'bench', 'well', 'fence', 'dock']);
const KIND_STYLE = { grock: {}, tree: { sway: 0.0036, freq: 1.0, sink: 1.8 }, bush: { sway: 0.012, freq: 1.6, sink: 0.05 }, deco: { sway: 0.012, freq: 1.6, sink: 0 }, rock: { sink: 0.1 }, other: {} };
const KIND_CAP = 900;
function buildKinds() {
  G.kinds = new Map(); G.solo = new THREE.Group(); scene.add(G.solo); G.stumps = new Map();
  const kindOf = new Map(); for (const p of G.world.props) if (!SOLO.has(p.kind)) kindOf.set(p.model, p.kind);
  for (const [a, b] of [[2, 0], [3, 2], [-1, -3], [1, -3], [4, 4], [-2, 5], [5, 1], [0, 6]]) for (const p of generateTile(a, b, 7).props) if (!kindOf.has(p.model)) kindOf.set(p.model, p.kind);
  for (const p of G.world.props.filter(p => SOLO.has(p.kind))) { const o = S.instantiate(models, p.model, p.x, p.z, p.rot, p.scale, 0, p.y); o.userData.prop = p; G.solo.add(o); }
  for (const [model, kind] of Object.entries(THEME_MODELS)) if (!kindOf.has(model)) kindOf.set(model, kind);
  for (const [model, kind] of Object.entries(SEASON_KIND)) kindOf.set(model, kind);
  for (const [model, kind] of kindOf) { const g = S.makeInstancedKind(models, model, KIND_CAP, KIND_STYLE[kind] || {}); g.userData.props = []; scene.add(g); G.kinds.set(model, g); }
  for (const far of new Set(Object.values(LOD_FAR))) { const g = S.makeInstancedKind(models, far, KIND_CAP, { ...KIND_STYLE.tree, shadow: false }); g.userData.props = []; scene.add(g); G.kinds.set(far, g); }
}
// ---- wildlife: skinned clones are made only when an animal is near, dropped when far; logic freezes when very far ----
function makeAnimalView(a) {
  const info = models[ANIMAL_SPECS[a.kind].model]; if (!info) return;
  const root = SkeletonUtils.clone(info.root); root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(root), actions = {}; for (const c of info.clips) actions[c.name] = mixer.clipAction(c);
  const cur = actions.Idle; if (cur) cur.play(); scene.add(root); a.view = { root, mixer, actions, cur, clip: 'Idle' };
}
function dropAnimalView(a) { if (!a.view) return; scene.remove(a.view.root); a.view.mixer.stopAllAction(); a.view = null; }
function updateAnimals(dt) {
  const P = G.player; if (!G.animals) return;
  for (const a of G.animals.values()) {
    const d = Math.hypot(a.x - P.x, a.z - P.z);
    if (d < 90) stepAnimal(a, Math.min(dt, 0.1), P);
    if (d < 52 && !a.view) makeAnimalView(a); else if (d > 70 && a.view) dropAnimalView(a);
    const v = a.view; if (!v) continue;
    v.root.position.set(a.x, a.y, a.z); v.root.rotation.y = a.yaw;
    if (a.clip !== v.clip) { const nx = v.actions[a.clip] || v.actions.Idle; if (nx && nx !== v.cur) { nx.reset().fadeIn(0.25).play(); v.cur?.fadeOut(0.25); v.cur = nx; } v.clip = a.clip; }
    if (v.cur) v.cur.timeScale = a.ts; v.mixer.update(dt);
  }
}
/** Rebuild each model's prop list from the home props + every loaded tile's props (cheap; only on tile changes). */
function rebuildKindLists() {
  const season = seasonNow(), by = new Map(), put = (m, p) => (by.get(m) || by.set(m, []).get(m)).push(p); G.seasonShown = season; G.cover?.userData.setSeason?.(season); const wetOn = G.wetShown = G.weather.cur.wet > 0.35 && season !== 'winter';
  for (const p of G.world.props) { if (SOLO.has(p.kind)) continue; if (!wetOn && p.model.startsWith('fm_puddle_')) continue; const m = seasonModel(p, season); put(m, p);
    if (season === 'winter' && p.kind === 'grock' && p.model.startsWith('fm_boulder_mossy_') && G.kinds.has('fm_snowdrift_low_a')) { const h = idHash(p.id), a = (h % 628) / 100, sc = 0.7 + (h % 7) / 10, dm = h % 2 ? 'fm_snowdrift_low_a' : 'fm_snowdrift_low_b', x = p.x + Math.cos(a) * 1.1 * p.scale, z = p.z + Math.sin(a) * 1.1 * p.scale; put(dm, { id: p.id + 'sd', kind: 'deco', model: dm, x, y: groundAt(x, z), z, rot: a, scale: sc, tile: p.tile }); } }
  for (const [far, tint] of [['tree_far_lod2', FAR_TINT[season] || FAR_TINT.summer]]) { const g = G.kinds.get(far); if (g) g.traverse(o => { if (o.isInstancedMesh && o.material.color) o.material.color.setRGB(...tint); }); }
  for (const [model, g] of G.kinds) { if (!Object.values(LOD_FAR).includes(model)) g.userData.props = by.get(model) || []; g.userData.tintFn = /^tree_(hero_broadleaf|far_lod2)/.test(model) ? treeTintFn(season) : null; }
}
const propLoaded = (p) => !p.tile || G.tiles.has(p.tile);
const TILE_R = touch ? 1 : 2;                                                            // 5 x 5 tiles around the player stay loaded; one more ring of hysteresis before unloading
function removeFromArray(arr, pred) { for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) arr.splice(i, 1); }
function loadTile(tx, tz) {
  const key = tileKey(tx, tz), T = generateTile(tx, tz, 7, { empty: G.state.start === 'empty' }); G.tiles.set(key, T); G.stats.loads++;
  annotateHops(T.colliders, T.props); for (const c of T.colliders) G.world.colliders.push(c); for (const p of T.props) G.world.props.push(p);
  for (const n of T.nodes) { G.world.nodes.push(n); G.nodeById.set(n.id, n); }
  T.animals = spawnAnimals(key, tileRect(tx, tz), T.biome, () => false, T.props.filter(p => p.model === 'fm_tree_stump').map(p => ({ x: p.x, z: p.z, y: p.y + 0.62 * p.scale }))); for (const a of T.animals) G.animals.set(a.id, a);
  T.queued = true; (G.meshQueue ||= []).push([tx, tz]);
  return T;
}
function unloadTile(key) {
  const T = G.tiles.get(key); if (!T) return;
  removeFromArray(G.world.colliders, c => c.tile === key); removeFromArray(G.world.props, p => p.tile === key); removeFromArray(G.world.nodes, n => n.tile === key);
  for (const n of T.nodes) { G.nodeById.delete(n.id); const st = G.stumps.get(n.id); if (st) { G.solo.remove(st); G.stumps.delete(n.id); } restSprite(n.id, false); }
  for (const a of T.animals || []) { dropAnimalView(a); G.animals.delete(a.id); }
  if (T.mesh) { G.tileGroup.remove(T.mesh); T.mesh.geometry.dispose(); }
  G.tiles.delete(key); G.stats.unloads++;
  G.meshQueue = (G.meshQueue || []).filter(([a, b]) => tileKey(a, b) !== key);
}
/** Stream tiles around the player. `force` builds everything now (start-up / teleport / tests); otherwise at most one data load and one mesh per call. */
function updateTiles(force = false) {
  const [px, pz] = tileOf(G.player.x, G.player.z); let changed = false, budget = force ? 999 : 1;
  const want = []; for (let dx = -TILE_R; dx <= TILE_R; dx++) for (let dz = -TILE_R; dz <= TILE_R; dz++) want.push([px + dx, pz + dz, Math.max(Math.abs(dx), Math.abs(dz)) * 10 + Math.abs(dx) + Math.abs(dz)]);
  want.sort((a, b) => a[2] - b[2]);
  for (const [tx, tz] of want) { if (G.tiles.has(tileKey(tx, tz))) continue; if (budget-- <= 0) break; loadTile(tx, tz); changed = true; }
  for (const key of [...G.tiles.keys()]) { const [tx, tz] = key.split(',').map(Number); if (Math.max(Math.abs(tx - px), Math.abs(tz - pz)) > TILE_R + 1) { unloadTile(key); changed = true; } }
  let meshBudget = force ? 999 : 1;
  while (G.meshQueue?.length && meshBudget-- > 0) { const [tx, tz] = G.meshQueue.shift(), T = G.tiles.get(tileKey(tx, tz)); if (!T || T.mesh) continue; T.mesh = S.makeTerrainChunk(tx, tz, G.terrainMat); G.tileGroup.add(T.mesh); if (force) { T.mesh.userData.fill(1e9); T.mesh.userData.done = true; } else (G.fillQueue ||= []).push(T.mesh); }
  if (G.fillQueue?.length) { const t0 = performance.now(); while (G.fillQueue.length && performance.now() - t0 < 3) { const m = G.fillQueue[0]; if (!m.parent) { G.fillQueue.shift(); continue; } if (m.userData.fill(3 - (performance.now() - t0))) { m.userData.done = true; G.fillQueue.shift(); } } }
  const rows = new Set([...G.tiles.values()].map(t => t.tz)); for (const tz of rows) if (!G.water.userData.hasBand(tz)) G.water.userData.addBand(tz);
  for (const tz of [...new Set([...G.tiles.values()].map(t => t.tz))].length ? [] : []) void tz;
  { const all = new Set([...rows]); const have = [...G.water.children].map(m => +m.name.replace('water-band-', '')); for (const tz of have) if (!all.has(tz)) G.water.userData.removeBand(tz); }
  G.water.userData.syncSea?.(G.tiles);
  if (changed) { rebuildKindLists(); for (const n of G.world.nodes) if (G.state.nodes[n.id]?.depleted) refreshNodeVisual(n); }
  return changed;
}
function refreshNodeVisual(p) {
  const st = G.state.nodes[p.id] || {}, depleted = !!st.depleted, col = G.world.colliders.find(c => c.id === p.id);
  p.hidden = depleted;
  if (p.kind === 'tree') {
    let s = G.stumps.get(p.id);
    if (depleted && !s) { s = S.instantiate(models, 'Cut_Stump', p.x, p.z, p.rot, 1.7, 0, p.y); G.solo.add(s); G.stumps.set(p.id, s); }
    if (s) s.visible = depleted;
    if (col) col.r = depleted ? 0.5 : p.r;
  } else if (p.kind === 'bush') {
    let s = G.stumps.get(p.id);
    if (depleted && !s) { s = S.instantiate(models, 'fm_berry_bush_picked', p.x, p.z, p.rot, p.scale, 0, p.y); G.solo.add(s); G.stumps.set(p.id, s); }
    if (s) s.visible = depleted; if (col) col.r = depleted ? 0 : p.r;
  } else if (col) col.r = depleted ? 0 : p.r;
}

// ---------------- warmth / cold (parent decision 22 Oct 2026) ----------------
const seasonNow = () => G.state.seasonOverride || seasonOfDay(G.state.day || 0);
const coldActive = () => !FAMILY && !G.free && G.state.coldOn !== false;                       // parent free-build never gets cold; children always do unless the parent switches it off
function coldTick(dt) {
  const s = G.state, P = G.player, a = G.lastAtmo, nightF = a ? a.night : 0; s.warmth ??= 1;
  const front = weatherFront(P.x, P.z, G.t), cur = G.weather.cur, sh = shelterState(P);
  const rainRaw = cur.rain * front + (G.weather.type === 'shower' ? 0.55 * G.weather.intensity * front * front : 0), rain = Math.min(1, rainRaw) * (1 - 0.96 * sh.any);
  let nearFire = 0; for (const f of G.fires) { const d = Math.hypot(P.x - f.x, P.z - f.z); nearFire = Math.max(nearFire, 1 - Math.min(1, Math.max(0, (d - 2.5) / 3.5))); }
  const wind = (cur.wind || 0) * (1 - 0.85 * sh.any), snow = (cur.snow || 0) * front * (1 - 0.96 * sh.any);
  const r = stepWarmth(s.warmth, dt, { season: seasonNow(), night: nightF, rain, wind, snow, wet: cur.wet, sheltered: sh.shelter, nearFire, cabin: sh.cabin, moving: P.speed > 0.3 ? 1 : 0 });
  const before = s.warmth; s.warmth = r.w; G.warmthCtx = { rain: +rain.toFixed(2), wind: +wind.toFixed(2), snow: +snow.toFixed(2), nearFire: +nearFire.toFixed(2), sheltered: sh.shelter, cabin: sh.cabin, season: seasonNow() };
  const ws = warningStrength(s.warmth); G.coldFx = G.coldFx || $('coldFx');
  if (G.coldFx) G.coldFx.style.opacity = String(ws > 0 ? Math.min(0.75, 0.18 + 0.55 * ws) * (0.35 + 0.65 * pulse(G.t, reduced)) : 0);
  if (before >= WARM.warnBelow && s.warmth < WARM.warnBelow) toast("You're getting cold. Find a fire, a shelter or the cabin.", 4200);
  if (before >= WARM.dangerBelow && s.warmth < WARM.dangerBelow) toast("You're freezing! Get warm!", 3200);
  if (r.collapsed) coldCollapse();
}
function coldCollapse() {
  const s = G.state; (s.events ||= []).push({ type: 'cold_collapse', ts: nowMs(), where: s.area || '', season: seasonNow() }); if (s.events.length > 60) s.events.shift();
  const fade = $('fade'); fade.classList.remove('hidden'); fade.style.opacity = 1; mode = 'fade';
  setTimeout(() => { const spot = findSafeSpot(CAMP.x + 2.5, CAMP.z + 3.5, G.world, {}) || { x: CAMP.x + 2.5, z: CAMP.z + 3.5, y: groundAt(CAMP.x + 2.5, CAMP.z + 3.5) };
    Object.assign(G.player, spot); updateTiles(true); cullProps(); s.warmth = 1; if (G.coldFx) G.coldFx.style.opacity = 0; fade.style.opacity = 0; mode = 'play'; saveNow();
    toast('You collapsed from the cold and woke up by the camp, warm again. Nothing was lost.', 5200); setTimeout(() => fade.classList.add('hidden'), 900); }, 1200);
}
// ---------------- hut, workbench and the craft menu ----------------
function buildHutVisuals() {
  G.hut = makeHut(); scene.add(G.hut);
  const wb = S.instantiate(models, 'Woodland_Workbench', HUT.x + 4.2, HUT.z - 1.8, 0.4, 1.4); wb.visible = false; scene.add(wb); G.workbench = wb;
  const bx = HUT.x + 4.2, bz = HUT.z - 1.8; G.workbenchCol = { x: bx, z: bz, r: 0.0, id: 'workbench' }; G.world.colliders.push(G.workbenchCol); G.hutWallCols = [];
  G.spit = new THREE.Group(); for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 6), new THREE.MeshStandardMaterial({ color: 0x5c3f25 })); f.position.set(s * 0.55, 0.45, 0); f.castShadow = true; G.spit.add(f); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x4a3420 })); bar.rotation.z = Math.PI / 2; bar.position.y = 0.88; G.spit.add(bar); G.spit.position.set(CAMP.x, groundAt(CAMP.x, CAMP.z), CAMP.z); G.spit.visible = false; scene.add(G.spit);
}
function applyBuilt(what, initial) {
  const b = G.state.built;
  if (what === 'campfire') { if (!initial || !G.fires.length) { if (!G.fires.some(f => Math.hypot(f.x - CAMP.x, f.z - CAMP.z) < 0.5)) placeFire(CAMP.x, CAMP.z, true, initial); } }
  if (what === 'hut2' && G.hutWallCols.length === 0) { for (const c of hutWallColliders()) { G.world.colliders.push(c); G.hutWallCols.push(c); } }
  if (what === 'workbench') { G.workbench.visible = true; G.workbenchCol.r = 0.9; }
  if (what === 'spit') G.spit.visible = true;
  G.hut.userData.set(b); renderInv(); if (!initial) { toast(`${R.LABELS[what] || what} built!`); saveNow(); }
}
function syncBuilt() { for (const k of Object.keys(G.state.built)) if (G.state.built[k]) applyBuilt(k, true); G.hut.userData.set(G.state.built); }
const CRAFT_GROUPS = [['The hut', ['hut1', 'hut2', 'hut3', 'hut4', 'campfire']], ['Tools and crafts', ['axe', 'pickaxe', 'workbench', 'spit']], ['Neolithic crafts (from what each land gives)', R.NEO_IDS]];
const costText = (w) => Object.entries(R.COSTS[w]).map(([k, v]) => `${v} ${k}`).join(' + ');
function openCraft() {
  mode = 'craft'; $('craft').classList.remove('hidden'); const s = G.state;
  $('craftBody').innerHTML = CRAFT_GROUPS.map(([title, items]) => `<h3>${title}</h3>` + items.map(w => {
    const done = !!s.built[w], v = R.canBuild(s, w), free = G.free && !done, label = R.LABELS[w], made = (s.made || {})[w] || 0;
    const note = done ? '✔ built' : free ? 'free build' : v.ok ? 'ready: one question' + (made ? ` · made ${made}` : '') : v.reason + (made ? ` · made ${made}` : '');
    return `<button class="craftItem ${done ? 'done' : v.ok || free ? 'ready' : 'locked'}" data-w="${w}" ${done || (!v.ok && !free) ? 'aria-disabled="true"' : ''}><b>${label}</b><span>${costText(w)}</span><em>${note}</em></button>`; }).join('')).join('');
  $('craftBody').innerHTML += '<h3>Quick builds (place anywhere)</h3>' + ['quickfire', 'fence', 'shelter'].map(w => { const ok = R.canAfford(s, w) || G.free; return `<button class="craftItem ${ok ? 'ready' : 'locked'}" data-place="${w}"><b>${R.LABELS[w]}</b><span>${costText(w)}</span><em>${G.free ? 'free build: preview it, then place' : ok ? 'ready: preview, place, one question' : 'missing ' + Object.entries(R.shortfall(s, w)).map(([k, v]) => `${v} ${k}`).join(', ')}</em></button>`; }).join('');
  if (FORAGE_ON) $('craftBody').innerHTML += kitchenHtml();
  const inv = s.inv; $('craftInv').textContent = 'You have: ' + Object.entries(R.RES_LABEL).filter(([k]) => inv[k] || ['wood', 'stone', 'sticks'].includes(k)).map(([k, l]) => `${inv[k] || 0} ${l}`).join(' · ');
}
$('craftBody').addEventListener('click', (e) => {
  const q = e.target.closest('[data-place]'); if (q) { const w = q.dataset.place; if (!G.free && !R.canAfford(G.state, w)) { toast(`${R.LABELS[w]}: ${Object.entries(R.shortfall(G.state, w)).map(([k, v]) => `need ${v} more ${k}`).join(', ')}`); return; } closeCraft(); startPlacement(w); return; }
  const b = e.target.closest('.craftItem'); if (!b) return; const w = b.dataset.w, s = G.state;
  if (s.built[w]) return;
  if (G.free) { R.parentFreeBuild(s, w, true); if (R.HUT_STAGES.includes(w) || true) applyBuilt(w, false); closeCraft(); return; }          // parent free build: the real build runs, no question, no cost
  const v = R.canBuild(s, w); if (!v.ok) { toast(`${R.LABELS[w]}: ${v.reason}`); return; }
  closeCraft(true); openQuestion({ kind: 'build', what: w, nodeId: 'hut' });
});

// ---------------- foraging and cooking trial (local; src/foraging.js) ----------------
const plantBusy = (p) => F.plantResting(G.state, p.id, G.state.play.sec) || (G.state.rest[p.id] || 0) > nowMs();
const forageEnv = () => { const P = G.player; let fresh = depthAt(P.x, P.z) > 0; for (let r = 1.5; r <= 4 && !fresh; r += 1) for (let a = 0; a < 6.283; a += 0.5) if (depthAt(P.x + Math.cos(a) * r, P.z + Math.sin(a) * r) > 0) fresh = true;
  return { fire: G.fires.some(f => Math.hypot(P.x - f.x, P.z - f.z) < 4.5), freshwater: fresh }; };
let FG = null;   // the open plant card: { plant, phase: 'look' | 'ident', q }
const ic = (key, fb = '') => (F.iconUrl(key) ? `<img class="fgIc" alt="" src="${F.iconUrl(key)}">` : fb);
const fgRow = (t) => `<div class="fgClue">${t}</div>`;
function openForage(plant) {
  FG = { plant, phase: 'look' }; mode = 'forage'; $('forage').classList.remove('hidden'); F.inspect(G.state, plant); renderForage();
}
function renderForage(msg) {
  const st = G.state, pl = FG.plant, sp = F.SPECIES[pl.sp], idd = F.identifiedPlant(st, pl.sp, pl.id), season = seasonNow();
  $('forageTitle').innerHTML = idd ? `${F.iconUrl('plant_' + pl.sp) ? `<img class="fgIc" alt="" src="${F.iconUrl('plant_' + pl.sp)}"> ` : sp.glyph + ' '}${sp.name}` : '🔎 A plant you have not named yet';
  const badge = sp.placeholder ? `<span class="fgBadge">${sp.modelLoaded ? 'DELIVERED MODEL: still being checked in the game camera' : 'PLACEHOLDER MODEL: final art is coming'}</span>` : `<span class="fgBadge ok">Stylised game plant, not a real identification guide</span>`, note = `<p class="tiny">${F.FIELD_NOTE}</p>`, m = msg ? `<p><b>${msg}</b></p>` : '';
  if (FG.phase === 'ident') {
    $('forageBody').innerHTML = `${badge}${m}<p>${FG.q.prompt}</p>` + FG.q.options.map((o, i) => `<button class="fgOpt big alt" data-id="${o.id}">${i + 1}. ${o.label}<br><small>${o.sci}</small></button>`).join('') + `<button class="small" data-back="1">Back</button>${note}`; return;
  }
  const extra = F.extraClues(st, pl.sp), clues = sp.clues.map(fgRow).join('') + extra.map(c => fgRow(c + ' <small>(from your Cooking know-how)</small>')).join(''), btns = [];
  if (!idd) btns.push('<button class="big" data-act="ident">Name this plant</button>');
  else if (plantBusy(pl)) btns.push('<button class="big alt" aria-disabled="true">Growing back: try another plant</button>');
  else { const c = F.canHarvest(st, pl, st.play.sec, nowMs()); btns.push(c.ok ? `<button class="big" data-act="harvest">Gather a little (one maths question)</button>` : `<button class="big alt" aria-disabled="true">${c.reason}</button>`); }
  const info = idd ? `<p class="tiny"><i>${sp.sci}</i> · part used: ${sp.part} · grows in ${sp.habitatText}</p><p class="tiny">${F.seasonNote(sp, season)}</p><p class="tiny">${sp.history}.</p>` : '<p class="tiny">Look at the clues, then name it. Wrong guesses cost nothing.</p>';
  $('forageBody').innerHTML = `${badge}${m}<h3>What you notice</h3>${clues}${info}${btns.join('')}${note}`;
}
$('forageBody').addEventListener('click', (e) => {
  if (!FG) return; const b = e.target.closest('button'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
  if (b.dataset.back) { FG.phase = 'look'; renderForage(); return; }
  if (b.dataset.act === 'ident') { FG.q = F.identQuestion(FG.plant, Math.random); FG.phase = 'ident'; renderForage(); return; }
  if (b.dataset.act === 'harvest') { harvestPlant(); return; }
  if (b.dataset.id) pickIdent(b.dataset.id);
});
function pickIdent(id) {
  const r = F.answerIdent(G.state, FG.plant, id, nowMs());
  if (!r.ok) { FG.q = F.identQuestion(FG.plant, Math.random); renderForage(r.message); return; }
  if (r.level) notifyLevel(r.level, 'Foraging'); FG.phase = 'look'; saveNow(); renderForage(r.message);
}
function closeForage() { $('forage').classList.add('hidden'); FG = null; mode = 'play'; }
$('forageClose').onclick = closeForage;
function harvestPlant() {
  const pl = FG.plant, c = F.canHarvest(G.state, pl, G.state.play.sec, nowMs()); if (!c.ok) { renderForage(c.reason); return; }
  closeForage();
  if (G.free || DEV_NOQ) { applyForage(pl, true); return; }
  openQuestion({ kind: 'forage', nodeId: pl.id, plantId: pl.id, tier: 'normal' });
}
function applyForage(pl, free) {
  const r = F.applyHarvest(G.state, pl, G.state.play.sec, nowMs()); toast(r.ok ? r.message + (free ? ' (developer: no question)' : '') : r.message, 2600);
  if (r.ok) { if (r.level) notifyLevel(r.level, 'Foraging'); G.playerObj?.userData.playWork?.('gather1'); renderInv(); saveNow(); }
}
function kitchenHtml() {
  const st = G.state, env = forageEnv(), inv = st.inv, held = Object.entries(F.ITEM_LABEL).filter(([k]) => inv[k] > 0).map(([k]) => `${ic(k, F.ITEM_GLYPH[k] || '')} ${inv[k]} ${F.ITEM_LABEL[k]}`).join(' · ');
  return `<h3>Kitchen (foraging trial)</h3><p class="tiny">${held || 'Nothing gathered yet. Find plants, name them, then gather.'}</p>` + F.RECIPE_ORDER.map(id => {
    const r = F.RECIPES[id], c = F.canMake(st, id, env), made = (st.forage?.made || {})[id] || 0, ins = Object.entries(r.inputs).map(([k, v]) => `${v} ${F.ITEM_LABEL[k] || k}`).join(' + ') || 'nothing';
    return `<button class="kItem ${c.ok ? 'ready' : 'locked'}" data-k="${id}" ${c.ok ? '' : 'aria-disabled="true"'}><b>${ic(Object.keys(r.output)[0], F.ITEM_GLYPH[Object.keys(r.output)[0]] || '')} ${r.name}</b><span>${ins}${made ? ` · made ${made}` : ''}</span><em>${c.ok ? 'ready' : c.reason} · ${r.label}</em></button>`; }).join('') + Object.keys(F.MEALS).filter(id => inv[id] > 0).map(id => `<button class="kItem ready" data-eat="${id}"><b>${ic(id)} Eat the ${F.MEALS[id].name}</b><span>1 of ${inv[id]}</span><em>Game effect only: a little spring in your step for 5 minutes. Nothing about health.</em></button>`).join('') + '<p class="tiny">Quantities are game portions, not real recipes. Nothing here gives health effects.</p>';
}
$('craftBody').addEventListener('click', (e) => {
  const eb = e.target.closest('[data-eat]');
  if (eb) { e.stopPropagation(); const r = F.eat(G.state, eb.dataset.eat, G.state.play.sec); toast(r.message, 3200); if (r.ok) { G.playerObj?.userData?.setFace?.('eating', 2.6); G.playerObj?.userData?.playWork?.('gather1'); renderInv(); saveNow(); } openCraft(); return; }
  const b = e.target.closest('[data-k]'); if (!b) return; e.stopPropagation();
  const r = F.make(G.state, b.dataset.k, forageEnv(), G.state.play.sec, nowMs()); toast(r.message, 2600);
  if (r.ok) { if (r.level) notifyLevel(r.level, F.RECIPES[b.dataset.k].cook ? 'Cooking' : 'Foraging'); renderInv(); saveNow(); }
  openCraft();
}, true);
function forageJournalHtml() {
  const st = G.state, f = st.forage; if (!f) return `<h3>Plants</h3><p class="tiny">${F.FIELD_NOTE}</p>`;
  const pages = F.SPECIES_IDS.map(id => { const k = F.knownSpecies(st, id), any = F.identifiedAny(st, id), sp = F.SPECIES[id]; return `<p class="tiny">${any ? ic('plant_' + id, sp.glyph) + ' <b>' + sp.name + '</b> (' + sp.sci + ') · ' + (k ? 'page complete' : 'named once, find one more') : '❔ Not named yet'}</p>`; }).join('');
  return `<h3>Plants</h3>${pages}${f.journal.map(j => `<p class="tiny">${j}</p>`).join('')}<p class="tiny">${F.FIELD_NOTE}</p>`;
}
function closeCraft(keepMode) { $('craft').classList.add('hidden'); if (!keepMode) mode = 'play'; }
$('craftClose').onclick = () => closeCraft();

// ---------------- place-and-build ghost (rules 18, 23) ----------------
function ghostMaterialize(obj, ok) { obj.traverse(o => { if (o.isMesh) { if (!o.userData.ghostM) { o.userData.ghostM = (Array.isArray(o.material) ? o.material : [o.material]).map(m => { const c = m.clone(); c.transparent = true; c.opacity = 0.55; c.depthWrite = false; return c; }); o.material = Array.isArray(o.material) ? o.userData.ghostM : o.userData.ghostM[0]; }
    for (const m of o.userData.ghostM) { if (m.emissive) { m.emissive.set(ok ? 0x2f9a45 : 0xb02a2a); m.emissiveIntensity = 0.7; } else if (m.color) m.color.set(ok ? 0x6fd07a : 0xd96a5a); } o.castShadow = false; } }); }
function itemObject(id) { const it = ITEMS[id]; if (it.roof) return makeShelterMesh(); const o = S.instantiate(models, it.model, 0, 0, 0, 1, 0, 0); if (id === 'quickfire') { const l = S.instantiate(models, 'Timber_Log', 0, 0, 0.4, 0.55, 0, 0); l.position.y = 0.08; const g = new THREE.Group(); g.add(o, l); return g; } return o; }
function startPlacement(id) {
  cancelPlacement(true); const it = ITEMS[id], g = itemObject(id); g.position.y = 0; scene.add(g);
  G.placing = { id, rot: 0, dist: 3.0, ghost: g, ok: false, reason: '', t: 0 }; $('placeBar').classList.remove('hidden'); $('placeTitle').textContent = `Placing: ${it.label}`; toast('Move to position it. R/F or the buttons rotate. Enter or Place builds it.', 4200); updateGhost(true);
}
function cancelPlacement(silent) { if (!G.placing) return; scene.remove(G.placing.ghost); G.placing = null; $('placeBar').classList.add('hidden'); if (!silent) toast('Cancelled. Nothing was used.'); }
function updateGhost(force) {
  const pl = G.placing; if (!pl) return; const P = G.player, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), x = P.x + fx * pl.dist, z = P.z + fz * pl.dist;
  pl.x = x; pl.z = z; pl.ghost.position.set(x, groundAt(x, z), z); pl.ghost.rotation.y = pl.rot;
  if (force || G.t - pl.t > 0.12) { pl.t = G.t; const r = canPlace(pl.id, x, z, pl.rot, { colliders: G.world.colliders, player: P }); if (r.ok !== pl.ok || force || r.reason !== pl.reason) { pl.ok = r.ok; pl.reason = r.reason; ghostMaterialize(pl.ghost, r.ok); $('placeMsg').textContent = r.ok ? 'Good spot ✓' : r.reason; $('placeMsg').className = r.ok ? 'ok' : 'bad'; $('btnPlace').classList.toggle('disabled', !r.ok); } }
}
function confirmPlacement() {
  const pl = G.placing; if (!pl) return; const r = canPlace(pl.id, pl.x, pl.z, pl.rot, { colliders: G.world.colliders, player: G.player });
  if (!r.ok) { toast(`Can't place here: ${r.reason}`); return; }                                          // invalid: nothing spent, ghost stays
  const where = { x: +pl.x.toFixed(2), z: +pl.z.toFixed(2), rot: +pl.rot.toFixed(3) };
  if (G.free) { (G.state.placed ||= []).push({ what: pl.id, ...where, ts: nowMs() }); addPlaced(G.state.placed[G.state.placed.length - 1]); tgSendPlaced(G.state.placed[G.state.placed.length - 1]); cancelPlacement(true); toast(`${ITEMS[pl.id].label} placed (free build)`); saveNow(); return; }
  if (!R.canAfford(G.state, pl.id)) { toast('Not enough materials yet.'); return; }
  G.pendingPlace = { id: pl.id, where }; G.placing.frozen = true; openQuestion({ kind: 'place', what: pl.id, nodeId: 'place', where });
}
function addPlaced(p) {
  const it = ITEMS[p.what], g = it.roof ? makeShelterMesh() : it.model ? S.instantiate(models, it.model, 0, 0, 0, 1, 0, 0) : null; if (!g) return;
  if (p.what === 'quickfire') { const f = addFire(p.x, p.z, false); f.col.r = 0.55; return; }
  g.position.set(p.x, groundAt(p.x, p.z), p.z); g.rotation.y = p.rot; g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); G.solo.add(g);
  it.colliders(p.x, p.z, p.rot).forEach((c, i) => G.world.colliders.push({ ...c, id: `pl${G.world.colliders.length}_${i}` }));
}
$('btnPlace').onclick = confirmPlacement; $('btnPlaceCancel').onclick = () => cancelPlacement(); $('btnRotL').onclick = () => { if (G.placing) G.placing.rot += Math.PI / 12; }; $('btnRotR').onclick = () => { if (G.placing) G.placing.rot -= Math.PI / 12; };
$('btnNear').onclick = () => { if (G.placing) G.placing.dist = Math.max(1.6, G.placing.dist - 0.5); }; $('btnFar').onclick = () => { if (G.placing) G.placing.dist = Math.min(7, G.placing.dist + 0.5); };
function restSprite(id, on, x, y, z) {
  let s = G.resting.get(id);
  if (on && !s) { s = S.makeSprite('zzz', 1.1); s.position.set(x, y, z); scene.add(s); G.resting.set(id, s); }
  else if (!on && s) { scene.remove(s); G.resting.delete(id); }
}
function addFire(x, z, persist = true) {
  const f = S.makeFire(models, x, z); scene.add(f.group); G.fires.push(f);
  const col = { x, z, r: 0.55, id: 'fire' + G.fires.length }; G.world.colliders.push(col); f.col = col;
  if (persist) { (G.state.fires ||= []).push({ x, z }); }
  return f;
}

// ---------------- HUD ----------------
function renderInv() { const i = G.state.inv, b = G.state.built; $('inv').innerHTML = `<span title="wood">🪵 ${i.wood}</span><span title="stone">🪨 ${i.stone}</span><span title="berries">🫐 ${i.berries}</span><span title="sticks">🌿 ${i.sticks || 0}</span>${i.resin ? `<span title="resin">🟠 ${i.resin}</span>` : ''}${i.flint ? `<span title="flint">◆ ${i.flint}</span>` : ''}${Object.keys(R.RES_ICON).filter(k => i[k]).map(k => `<span title="${R.RES_LABEL[k]}">${R.RES_ICON[k]} ${i[k]}</span>`).join('')}${b.axe ? '<span title="stone axe">🪓</span>' : ''}${b.pickaxe ? '<span title="stone pickaxe">⛏</span>' : ''}<span title="streak">🔥 ${G.state.streak}</span>`; }
function updatePill() {
  const p = $('pill'); if (!G.parent) { p.classList.add('hidden'); return; }
  p.classList.remove('hidden'); p.classList.toggle('free', G.free); p.textContent = G.free ? 'PARENT · FREE BUILD (tap to switch)' : 'PARENT · NORMAL CHALLENGES (tap to switch)'; $('mFree').textContent = G.free ? 'Switch to normal challenges' : 'Switch to free build';
}
$('pill').onclick = $('mFree').onclick = () => { G.free = !G.free; updatePill(); toast(G.free ? 'Free build: no questions, no costs' : 'Normal challenges: as a child would play'); };
$('btnMenu').onclick = () => openMenu();
function openMenu() { if (mode !== 'play') return; mode = 'menu'; $('menu').classList.remove('hidden'); $('mPause').textContent = paused ? 'Resume time' : 'Pause time'; }
function closeMenu() { $('menu').classList.add('hidden'); mode = 'play'; }
$('mResume').onclick = closeMenu;
$('mPause').onclick = () => { paused = !paused; $('mPause').textContent = paused ? 'Resume time' : 'Pause time'; toast(paused ? 'Time paused (day/night, water and wind hold still)' : 'Time running'); closeMenu(); };
$('mStuck').onclick = () => { const s = findSafeSpot(G.player.x, G.player.z, G.world, { seamOpen: G.state.crossed }) || { x: 19.5, z: 47.5, y: groundAt(19.5, 47.5) }; Object.assign(G.player, s); toast('Moved to nearby clear ground. Nothing was lost.'); closeMenu(); };
$('mQuality').onclick = () => { const order = ['Auto', 'High', 'Medium', 'Low']; qualityMode = order[(order.indexOf(qualityMode) + 1) % 4]; setQualityMode(); $('mQuality').textContent = 'Quality: ' + qualityMode; };
function setQualityMode() {
  const m = { Auto: null, High: [1, 'high', true, 1], Medium: [0.8, 'med', true, 0.6], Low: [0.65, 'low', false, 0.3] }[qualityMode];
  quality.auto = !m; if (m) { quality.scale = m[0]; quality.tier = m[1]; quality.shadowOn = m[2]; quality.particles = m[3]; }
}
$('mMotion').onclick = () => { reduced = !reduced; $('mMotion').textContent = 'Motion: ' + (reduced ? 'reduced' : 'normal'); document.body.classList.toggle('reduced', reduced); };
$('mLook').onclick = () => { if (G.sk) {   // character chooser: one big button per character, current one marked
    let box = document.getElementById('whoPick'); box?.remove(); box = document.createElement('div'); box.id = 'whoPick'; box.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(10,20,14,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px';
    const t = document.createElement('div'); t.textContent = 'Choose your character'; t.style.cssText = 'font-size:22px;font-weight:700;margin-bottom:6px'; box.append(t);
    for (const k of G.sk.order) { const b = document.createElement('button'); b.className = 'big' + (k === G.sk.who ? '' : ' alt'); b.textContent = (k === G.sk.who ? '✔ ' : '') + G.sk.presets[k].label; b.style.minWidth = '260px';
      b.onclick = () => { try { localStorage.setItem('fm_who', k); } catch {} saveNow(); location.reload(); }; box.append(b); }
    const x = document.createElement('button'); x.className = 'small alt'; x.textContent = 'Close'; x.onclick = () => box.remove(); box.append(x); document.body.append(box); return; } if (!G.custom) { toast(WOODLAND ? 'The woodland character has one fixed look (trial).' : EXPLORER ? 'The Meshy explorer has one baked look (trial).' : 'Customisation needs the new character model.'); return; } $('menu').classList.add('hidden'); $('look').classList.remove('hidden'); mode = 'look'; renderLook(); };
$('lookClose').onclick = () => { $('look').classList.add('hidden'); mode = 'play'; saveNow(); };
function renderLook() { const L = G.custom.look;
  $('lookStyles').innerHTML = HAIR_STYLES.map(([k, n]) => `<button class="big alt ${L.style === k ? 'on' : ''}" data-s="${k}">${n}</button>`).join('');
  $('lookColours').innerHTML = HAIR_COLOURS.map(([k, c]) => `<button class="sw ${L.colour === k ? 'on' : ''}" data-c="${k}" title="${k}" aria-label="${k} hair" style="background:${c}"></button>`).join('');
  $('lookSkins').innerHTML = SKIN_TONES.map(([k, c]) => `<button class="sw ${L.skin === k ? 'on' : ''}" data-k="${k}" title="${k}" aria-label="${k} skin" style="background:${c}"></button>`).join('');
  $('lookJackets').innerHTML = JACKET_COLOURS.map(([k, h]) => `<button class="sw ${L.jacket === k ? 'on' : ''}" data-j="${k}" title="${k}" aria-label="${k} jacket" style="background:hsl(${Math.round(h * 360)} 70% 45%)"></button>`).join(''); }
$('look').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || !G.custom) return; const d = b.dataset; if (d.s) G.custom.set({ style: d.s }); if (d.c) G.custom.set({ colour: d.c }); if (d.j) G.custom.set({ jacket: d.j }); if (d.k) G.custom.set({ skin: d.k }); G.state.look = { ...G.custom.look }; renderLook(); });
// ---- Weather & sky panel (Postcard-style: pick the weather, how strong, auto-change, flashes, time of day). Cosmetic only; never touches learning. ----
const WX_TYPES = [['clear', 'Clear'], ['cloudy', 'Cloudy'], ['mist', 'Misty'], ['shower', 'Shower + rainbow'], ['rain', 'Rain'], ['storm', 'Storm'], ['wind', 'Windy']];
const WX_TIMES = [['Sunrise', 0.265], ['Morning', 0.36], ['Noon', 0.5], ['Afternoon', 0.62], ['Sunset', 0.735], ['Night', 0.93]];
function saveWeather() { const w = G.weather; G.state.weather = { type: w.type, intensity: w.intensity, auto: !!w.auto }; }
function renderWx() { const w = G.weather;
  $('wxTypes').innerHTML = WX_TYPES.map(([k, n]) => `<button class="big alt ${w.type === k ? 'on' : ''}" data-wt="${k}">${n}</button>`).join('');
  $('wxTimes').innerHTML = WX_TIMES.map(([n, p]) => `<button class="big alt" data-tp="${p}">${n}</button>`).join('');
  $('wxParent').classList.toggle('hidden', !G.parent); $('wxSeason').textContent = 'Season: ' + (G.state.seasonOverride ? G.state.seasonOverride + ' (set)' : seasonNow() + ' (follows play time)'); $('wxCold').textContent = 'Cold: ' + (G.state.coldOn === false ? 'off' : 'on' + (G.free ? ' (not in free build)' : ''));
  $('wxInt').value = Math.round(w.intensity * 100); $('wxIntVal').textContent = Math.round(w.intensity * 100) + '%';
  $('wxAuto').textContent = 'Changes by itself: ' + (w.auto ? 'on' : 'off'); $('wxFlash').textContent = 'Storm flashes: ' + (w.comfort ? 'off (comfort)' : 'on');
  const t = G.state.tod, mins = Math.round(t * 24 * 60); $('wxTimeVal').textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; $('wxTime').value = Math.round(t * 1000); }
$('mSky').onclick = () => { $('menu').classList.add('hidden'); $('wx').classList.remove('hidden'); mode = 'wx'; renderWx(); };
$('wxClose').onclick = () => { $('wx').classList.add('hidden'); mode = 'play'; saveNow(); };
$('wxTypes').onclick = (e) => { const k = e.target.closest('[data-wt]')?.dataset.wt; if (!k) return; G.weather.set(k, k === 'clear' ? G.weather.intensity : Math.max(0.5, G.weather.intensity)); saveWeather(); renderWx(); };
$('wxInt').oninput = (e) => { G.weather.setIntensity(+e.target.value / 100); $('wxIntVal').textContent = e.target.value + '%'; saveWeather(); };
$('wxAuto').onclick = () => { G.weather.auto = !G.weather.auto; if (G.weather.auto) G.weather.autoTimer = 0; saveWeather(); renderWx(); };
$('wxSeason').onclick = () => { const order = [null, ...SEASONS], i = (order.indexOf(G.state.seasonOverride || null) + 1) % order.length; G.state.seasonOverride = order[i]; renderWx(); };
$('wxCold').onclick = () => { G.state.coldOn = G.state.coldOn === false; if (G.state.coldOn === false) { G.state.warmth = 1; } renderWx(); };
$('wxFlash').onclick = () => { G.weather.comfort = !G.weather.comfort; renderWx(); };
$('wxTimes').onclick = (e) => { const p = e.target.closest('[data-tp]')?.dataset.tp; if (p) { G.state.tod = +p; renderWx(); } };
$('wxTime').oninput = (e) => { G.state.tod = +e.target.value / 1000; const mins = Math.round(G.state.tod * 24 * 60); $('wxTimeVal').textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; };
$('mDiag').onclick = () => { $('diag').classList.toggle('hidden'); closeMenu(); };
$('mSwitch').onclick = () => { saveNow(); location.href = location.pathname + (TEST ? '?test=1' : ''); };
$('mTime').onclick = () => { $('menu').classList.add('hidden'); $('timeSet').classList.remove('hidden'); mode = 'time'; };
$('timeBtns').innerHTML = [['Sunrise', .27], ['Morning', .36], ['Noon', .5], ['Golden dusk', .715], ['Night', .93]].map(([n, p]) => `<button class="big alt" data-p="${p}">${n}</button>`).join('');
$('timeBtns').onclick = (e) => { const p = e.target.dataset?.p; if (p) { G.state.tod = +p; toast('Time set'); } };
$('timeClose').onclick = () => { $('timeSet').classList.add('hidden'); mode = 'play'; };
$('mReport').onclick = () => { $('menu').classList.add('hidden'); openReport(); };

// ---------------- input ----------------
addEventListener('keydown', (e) => {
  if (mode === 'start') return; const k = e.key.toLowerCase();
  if (mode === 'ideas') { if (k === 'escape') $('ideaClose').click(); return; }
  if (mode === 'skills' && (k === 'arrowleft' || k === 'arrowright')) { SKSEL = nextSkill(SKSEL, k === 'arrowleft' ? -1 : 1); skRedraw(); return; }
  if (mode === 'skills' && k === 'escape') { $('skillsClose').click(); return; }
  if (mode === 'forage') { if (k === 'escape') closeForage(); else if (FG?.phase === 'ident' && /^[1-4]$/.test(k)) pickIdent(FG.q.options[+k - 1].id); return; }
  if (mode === 'ask') { if (/^[1-4]$/.test(k) && Q.phase === 'q') answerChoice(+k - 1); if (k === 'enter' || k === ' ') { if (Q.phase === 'done') $('qContinue').click(); } return; }
  if (G.placing && mode === 'play') { if (k === 'r') { G.placing.rot += Math.PI / 12; return; } if (k === 'f') { G.placing.rot -= Math.PI / 12; return; } if (k === 'enter') { confirmPlacement(); return; } if (k === 'escape') { cancelPlacement(); return; } if (k === '[') { G.placing.dist = Math.max(1.6, G.placing.dist - 0.5); return; } if (k === ']') { G.placing.dist = Math.min(7, G.placing.dist + 0.5); return; } }
  if (k === 'escape') { mode === 'menu' ? closeMenu() : openMenu(); return; }
  if (mode !== 'play') return;
  input.keys.add(k); if (k === 'e' || k === ' ') { e.preventDefault(); act(); } if (k === 'b') parentFire(); if (k === 'j') input.jump = true; if (k === 'c') G.crouch = !G.crouch;   // hop over or onto low things (logs, stumps, small rocks)
});
addEventListener('keyup', (e) => input.keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => input.keys.clear());
const stick = $('stick'), knob = $('knob'); let stickId = null;
stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = (e) => { if (e.pointerId === stickId) { stickId = null; input.x = input.y = 0; input.sprint = false; knob.style.transform = ''; } };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
function stickMove(e) { const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } input.x = dx; input.y = -dy; input.sprint = l > 0.92; knob.style.transform = `translate(${dx * 40}px,${dy * 40}px)`; }
let drag = null;
canvas.addEventListener('pointerdown', (e) => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id || mode !== 'play') return; cam.yaw -= (e.clientX - drag.x) * 0.0055; cam.pitch = Math.min(1.1, Math.max(0.08, cam.pitch + (e.clientY - drag.y) * 0.004)); drag.x = e.clientX; drag.y = e.clientY; });
const dragEnd = () => { drag = null; }; canvas.addEventListener('pointerup', dragEnd); canvas.addEventListener('pointercancel', dragEnd);
canvas.addEventListener('wheel', (e) => { cam.dist = Math.min(11, Math.max(3.2, cam.dist + e.deltaY * 0.004)); }, { passive: true });
$('btnAct').addEventListener('click', () => act());
$('btnJump').addEventListener('pointerdown', (e) => { e.preventDefault(); if (mode === 'play') input.jump = true; });
$('btnBuild').addEventListener('click', () => parentFire());
document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
addEventListener('pagehide', () => saveNow());

// ---------------- interaction ----------------
function targets() {
  const P = G.player, out = [];
  for (const n of G.world.nodes) { const st = G.state.nodes[n.id] || {}; if (st.depleted) continue; const d = Math.hypot(P.x - n.x, P.z - n.z) - n.r; if (d < 2.2) out.push({ type: 'node', n, d }); }
  const dg = Math.hypot(P.x - GATE.x, P.z - GATE.z); if (!G.state.crossed && dg < GATE.r + 0.8) out.push({ type: 'gate', d: dg - GATE.r });
  const dc = Math.hypot(P.x - CAMP.x, P.z - CAMP.z), dh = Math.hypot(P.x - HUT.x, P.z - HUT.z); if (dc < 4.5 || dh < HUT.half + 3.2) out.push({ type: 'hut', d: Math.min(dc - 2, dh - HUT.half - 1) });
  if (G.state.start === 'empty' && !out.some(o => o.type === 'hut') && !G.placing) out.push({ type: 'hut', d: 40 });   // empty start: no camp to walk to, so the build / craft menu opens wherever nothing else is in reach
  if (G.state.adv && !G.placing && ADV.nearWater(P.x, P.z, 3.2)) out.push({ type: 'fish', id: 'fish:' + Math.round(P.x / 8) + ',' + Math.round(P.z / 8), d: 1.4 });
  if (G.forage && !G.placing) { const pl = G.forage.nearest(P.x, P.z, 2.2); if (pl) out.push({ type: 'plant', p: pl, d: Math.hypot(P.x - pl.x, P.z - pl.z) - 0.5 }); }
  out.sort((a, b) => a.d - b.d); return out;
}
function describe(t) {
  const now = nowMs(), s = G.state;
  if (t.type === 'gate') return R.gateReady(s, 'seam', now) ? 'Press E / Act: answer the path gate to go north' : `Come back later (${Math.ceil((s.gateCD.seam - now) / 1000)}s). Nothing is lost.`;
  if (t.type === 'plant') return plantBusy(t.p) ? 'This plant is resting or growing back. Try another.' : F.identifiedPlant(G.state, t.p.sp, t.p.id) ? `Press E / Act: ${F.SPECIES[t.p.sp].name.toLowerCase()} (gather carefully)` : 'Press E / Act: look closely at this plant';
  if (t.type === 'fish') return (G.state.rest[t.id] || 0) > nowMs() ? 'The fish are resting here. Try another spot along the bank.' : 'Press E / Act: cast a line (one question)';
  if (t.type === 'hut' && t.d >= 40) return 'Press E / Act: build and craft here';
  if (t.type === 'hut') return G.free ? 'Press E: build / craft menu (free build)' : 'Press E / Act: build the hut and craft tools';
  const nm = { tree: 'tree', rock: 'rock', bush: 'berry bush', stick: 'fallen branch' }[t.n.kind];
  if (R.isResting(s, t.n.id, now) && !G.free) return `This ${nm} is resting — ${Math.ceil(R.restLeftMs(s, t.n.id, now) / 1000)}s. Try another.`;
  const lr = R.localFor(t.n.kind, R.landOf(regionAt(t.n.x, t.n.z)));
  return `Press E / Act: gather from the ${nm}${lr ? ' (' + R.RES_LABEL[lr] + ' here)' : ''}${G.free ? ' (free)' : ''}`;
}
const DEV_NOQ = typeof TEST !== 'undefined' && TEST && /[?&]noq=1/.test(location.search);   // developer view: chop/mine animation without the maths question (test mode only)
/** Signed steepness of the ground in the direction of travel for the character's slope gaits: +1 is a 25-degree climb, -1 a 25-degree descent, 0 on the flat or when not walking. */
function slopeAhead() {
  const P = G.player, v = Math.hypot(P.vx || 0, P.vz || 0); if (P.air || G.climb || v < 0.3) return 0;
  return Math.max(-1, Math.min(1, (groundAt(P.x + P.vx / v, P.z + P.vz / v) - groundAt(P.x, P.z)) / 0.466));
}
function act() {
  if (mode !== 'play' || G.player.air || G.climb) return;
  if (G.placing) { confirmPlacement(); return; } const t = targets()[0]; if (!t) { toast('Nothing to do here. Keep exploring.'); return; }
  const s = G.state, now = nowMs();
  if (t.type === 'gate') { if (G.free) { openGate(true); return; } if (!R.gateReady(s, 'seam', now)) { toast('Come back later. Nothing is lost.'); return; } openQuestion({ kind: 'gate', nodeId: 'seam' }); return; }
  if (t.type === 'fish') {
    if ((s.rest[t.id] || 0) > now) { toast('The fish are resting here. Try another spot along the bank.'); return; }
    let best = 0, ba = 0; for (let a = 0; a < 6.283; a += 0.3) { const d = depthAt(G.player.x + Math.cos(a) * 2.4, G.player.z + Math.sin(a) * 2.4); if (d > best) { best = d; ba = a; } }
    G.player.face = Math.atan2(Math.cos(ba), Math.sin(ba)); if (fishStart(ba, t.id)) return; G.playerObj?.userData.playWork?.('fish_loop', { loop: true, tool: 'rod' }); openQuestion({ kind: 'fish', nodeId: t.id }); return;
  }
  if (t.type === 'plant') { openForage(t.p); return; }
  if (t.type === 'hut') { openCraft(); return; }
  const n = t.n;
  if (G.free || DEV_NOQ) { const y = R.yieldFor(n.kind, 'normal', 0); s.inv[y.res] = (s.inv[y.res] || 0) + y.n; toast(`+${y.n} ${y.res} (${DEV_NOQ ? 'developer: no question' : 'free build'}, no answer recorded)`); if (DEV_NOQ) playWorkFor(n.kind); renderInv(); return; }
  if (R.isResting(s, n.id, now)) { toast('That one is resting. Try another.'); return; }
  openQuestion({ kind: n.kind, nodeId: n.id, tier: null, land: R.landOf(regionAt(n.x, n.z)) });
}
function openGate(free) { G.state.crossed = true; G.gateRing.material.color.set(0x7ee08a); toast(free ? 'Path opened (parent free build)' : 'The path north opens!'); saveNow(); }
function placeFire(x, z, atCamp, initial = false) {
  addFire(x, z, !initial); if (atCamp) G.state.built.campfire = { x, z }; else R.parentFreeBuild(G.state, 'campfire', { x, z });
  const f = G.fires[G.fires.length - 1]; if (initial) return; f.group.scale.setScalar(0.01); f.grow = 0; toast('A fire crackles to life'); saveNow();
}
function parentFire() {
  if (!G.parent || mode !== 'play') return;
  if (!G.free) { toast('Switch to free build to place a fire without costs'); return; }
  if (G.fires.length >= 4) { toast('Four fires is plenty'); return; }
  const P = G.player, fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw);
  for (let r = 2.2; r < 9; r += 0.6) for (const a of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6]) {
    const ca = Math.cos(a), sa = Math.sin(a), x = P.x + (fx * ca - fz * sa) * r, z = P.z + (fx * sa + fz * ca) * r;
    if (fireSpotOk(x, z)) { placeFire(x, z, false); return; }
  }
  toast('No clear spot nearby for a fire — move to open ground');
}
export function fireSpotOk(x, z) {
  if (depthAt(x, z) > 0 || slopeAt(x, z) > 0.45) return false;
  if (Math.hypot(x - G.player.x, z - G.player.z) < PLAYER_R + 0.55 + 0.8) return false;                        // never on top of the player
  if (G.world.colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + 0.55 + 0.6)) return false;               // never overlapping solids
  if (Math.hypot(x - GATE.x, z - GATE.z) < GATE.r + 1.5) return false;                                           // never block the gate ring
  if (Math.abs(x - BRIDGE.x) < BRIDGE.halfLen + 2 && Math.abs(z - BRIDGE.z) < 3) return false;                   // nor the bridge approaches
  return true;
}

// ---------------- questions ----------------
const Q = { s: null, phase: 'none', timer: 0, rng: makeRng((Date.now() & 0xffff) + 17), autoClose: 0 };
function meanMastery() { const v = Object.keys(G.state.mastery).map(t => R.masteryOf(G.state, t, nowMs()).m); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.5; }
function openQuestion(ctx) {
  mode = 'ask'; $('q').classList.remove('hidden'); $('qBody').classList.add('hidden'); $('qTier').classList.add('hidden'); Q.ctx = ctx;
  if (['tree', 'rock', 'bush', 'stick'].includes(ctx.kind)) {
    const names = { tree: ['Sapling', 'Oak', 'Ancient oak'], rock: ['Pebble', 'Rock', 'Boulder'], bush: ['Small', 'Medium', 'Big'], stick: ['Twig', 'Branch', 'Bough'] }[ctx.kind], sug = R.suggestTier(meanMastery());
    $('qTierTitle').textContent = 'Choose your swing'; $('qTierBtns').innerHTML = ['easy', 'normal', 'hard'].map((t, i) => `<button class="big ${t === sug ? '' : 'alt'}" data-tier="${t}">${names[i]}<br><small>${R.TIERS[t].level === 1 ? 'easier' : R.TIERS[t].level === 2 ? 'medium' : 'harder'} · up to ${R.yieldFor(ctx.kind, t, G.state.streak).n} ${R.BASE_YIELD[ctx.kind][0]}${t === sug ? ' · suggested' : ''}</small></button>`).join('');
    $('qTier').classList.remove('hidden');
  } else beginQ(ctx);
}
$('qTierBtns').onclick = (e) => { const b = e.target.closest('[data-tier]'); if (!b) return; $('qTier').classList.add('hidden'); beginQ({ ...Q.ctx, tier: b.dataset.tier }); };
$('qTierCancel').onclick = closeQuestion;
function beginQ(ctx) {
  stopExplainer();
  Q.s = R.startQuestion(G.state, ctx, Q.rng, nowMs()); Q.phase = 'q';
  $('qBody').classList.remove('hidden'); $('qMeta').textContent = `${Q.s.q.strand} · ${['', 'easier', 'medium', 'harder'][Q.s.q.level]}`;
  $('qText').textContent = Q.s.q.q; $('qChoices').innerHTML = Q.s.q.choices.map((c, i) => `<button data-i="${i}">${i + 1}. ${c}</button>`).join('');
  for (const id of ['qHintText', 'qFeedback', 'qContinue', 'qSimilar']) $(id).classList.add('hidden'); $('qSteps').innerHTML = ''; $('qViz').innerHTML = ''; $('qHint').disabled = false;
  $('qLater').classList.toggle('hidden', false);
}
$('qChoices').onclick = (e) => { const b = e.target.closest('button[data-i]'); if (b && Q.phase === 'q') answerChoice(+b.dataset.i); };
$('qHint').onclick = () => { if (Q.phase !== 'q') return; const h = R.useHint(Q.s); $('qHintText').textContent = '💡 ' + h + ' (Your parent sees that a hint was used.)'; $('qHintText').classList.remove('hidden'); $('qHint').disabled = true; };
$('qLater').onclick = () => closeQuestion();
function answerChoice(i) {
  const s = Q.s, now = nowMs(); const out = R.submitAnswer(G.state, s, i, now, { test: !!G.state.profile.synthetic }); Q.phase = 'done'; Q.out = out;
  [...$('qChoices').children].forEach((b, k) => { b.disabled = true; if (k === s.q.correctIndex) b.classList.add('right'); else if (k === i) b.classList.add('wrong'); });
  $('qHint').disabled = true; $('qLater').classList.add('hidden'); const f = $('qFeedback'); f.classList.remove('hidden');
  if (out.ok) { SK.noteCorrect(G.state, now); G.playerObj?.userData?.setFace?.('happy', 2.4); f.textContent = '✔ Correct! ' + out.message; s.doneOk = true; effectsAfter(out); Q.autoClose = 1.3; if (s.hintUsed) f.textContent += ' (hint used — counted as helped)'; }
  else {
    G.playerObj?.userData?.setFace?.('thinking', 2.4); R.noteExplainer(G.state, s, now); f.innerHTML = `Not this time. The answer is <b>${s.q.answer}</b>.<br><span class="tiny">${out.message}</span>`; effectsAfter(out);
    $('qSimilar').classList.toggle('hidden', !!s.ctx.practice); showExplainer(s.q, s.q.choices[i]);
  }
  $('qContinue').classList.remove('hidden'); renderInv(); renderGoal(); saveNow();
}
let exTimer = 0;
function stopExplainer() { clearInterval(exTimer); exTimer = 0; }
function showExplainer(q, picked) {
  stopExplainer(); const { slip, frames } = explainFrames(q, picked), box = $('qViz'); let k = 0, auto = !reduced;
  box.innerHTML = `<div class="exSlip"></div><div class="exPic" aria-live="polite"></div><div class="exSay"></div><div class="exCtl"><button class="small alt" data-ex="back">◀ Back</button><span class="exDots"></span><button class="small" data-ex="next">Next ▶</button></div>`;
  box.querySelector('.exSlip').textContent = slip;
  const show = (n) => {
    k = Math.max(0, Math.min(frames.length - 1, n)); box.querySelector('.exPic').innerHTML = frames[k].svg; box.querySelector('.exSay').textContent = frames[k].say;
    box.querySelector('.exDots').innerHTML = frames.map((_, j) => `<i class="${j === k ? 'on' : ''}"></i>`).join('');
    box.querySelector('[data-ex=back]').disabled = k === 0; box.querySelector('[data-ex=next]').textContent = k === frames.length - 1 ? '↺ Again' : 'Next ▶';
  };
  box.onclick = (e) => { const b = e.target.closest('[data-ex]'); if (!b) return; auto = false; stopExplainer(); if (b.dataset.ex === 'back') show(k - 1); else show(k === frames.length - 1 ? 0 : k + 1); };
  show(0); if (auto) exTimer = setInterval(() => { if (k >= frames.length - 1 || !auto) return stopExplainer(); show(k + 1); }, 4200);
  $('qSteps').innerHTML = ''; const d = document.createElement('div'); d.textContent = 'Written out: ' + q.worked; $('qSteps').appendChild(d);
}
function effectsAfter(out) {
  const c = Q.ctx, st = G.state;
  if (R.BASE_YIELD[c.kind]) {
    const n = G.nodeById.get(c.nodeId), ns = (st.nodes[c.nodeId] ||= { hits: 0 });
    if (out.ok && out.gained) notifyLevel(SK.trackGather(st, c.kind), c.kind === 'tree' ? 'Woodcraft' : 'Stonework');
    if (out.ok) { const cap = c.kind === 'bush' || c.kind === 'stick' ? 1 : 3; if (ns.hits >= cap) { ns.depleted = true; ns.regrowAtSec = st.play.sec + (c.kind === 'tree' ? 60 : 45); if (c.kind === 'tree' && G.treeFx && !G.state.reducedFx) { const col = G.world.colliders.find(k => k.id === n.id); if (col) col.r = 0.5; setTimeout(() => { if (G.state.nodes[n.id]?.depleted && !G.stumps.get(n.id)?.visible) refreshNodeVisual(n); }, 7000); } else refreshNodeVisual(n); } }
    else if (out.rested) { /* rest sprite handled each frame from state.rest */ }
  } else if (c.kind === 'build' && out.ok) { applyBuilt(c.what, false); }
  else if (c.kind === 'gate' && out.ok) openGate(false);
  if (c.kind === 'forage' && out.ok) { const pl = G.forage?.plants.find(p => p.id === c.plantId); if (pl) applyForage(pl, false); }
  if (c.kind === 'fish' && out.ok) { const a = (st.adv ||= ADV.newAdv()); a.fish = (a.fish || 0) + 1; toast('You caught a fish!', 3000); saveNow(); }
  if (c.kind === 'place') { if (out.ok) { addPlaced(G.state.placed[G.state.placed.length - 1]); tgSendPlaced(G.state.placed[G.state.placed.length - 1]); cancelPlacement(true); } else if (G.placing) G.placing.frozen = false; }
}
/** A correct answer is followed by the matching craft animation once the question closes: chop (tree), mine (rock), gather (bush, stick), build. */
const WORK_FOR = { fish: ['fish_pull', 'rod', 0], tree: ['chop', 'axe', 2500], rock: ['pick', 'pick', 2900], bush: ['gather1', null, 0], stick: ['gather2', null, 0], build: ['hammer', 'axe', 1500], place: ['hammer', 'axe', 1500] };
// ---------------- fishing: draw the rod, cast, wait, strike, reel, lift, stow ----------------
// Body: hand-authored draw (motions.js) -> baked fish_begin -> fish_throw -> fish_loop (the question is open here) -> fish_pull -> fish_stop -> hand-authored stow. Props and line: fishfx.js.
// A right answer lands the fish; a wrong or skipped one just reels in an empty line. Nothing is lost either way.
const FISH_V = new THREE.Vector3(), ROD_BACK = { rot: [8, 0, 28], pos: [0, 0.25, -0.12] };
function fishStart(ba, nodeId, demo = false) {
  const u = G.playerObj?.userData; if (!u?.playMotion || !u.clipDur || !u.clipDur('fish_throw')) return false;
  if (G.fishSeq) fishEnd(G.fishSeq);
  const fx = (G.fishFx ||= makeFishFx(scene, { surface: (x, z) => groundAt(x, z) + depthAt(x, z) })), P = G.player, rod = fx.makeRod(), tg = castTarget(P.x, P.z, ba, depthAt);
  const seq = G.fishSeq = { rod, tg, nodeId, demo, ba, resolved: false, stage: 'draw' }; fx.clear();
  const alive = () => G.fishSeq === seq, later = (t, fn) => { (seq.q ||= []).push({ t: t / 1000, fn }); }, ms = (n) => u.clipDur(n) * 1000;
  seq.toBack = () => u.mount(rod, 'backAttach', ROD_BACK.rot, ROD_BACK.pos); seq.toHand = () => u.mount(rod, 'prop_r', [0, 0, 0]); seq.toBack();
  const wait = () => { seq.stage = 'wait'; u.playWork('fish_loop', { loop: true, fade: 0.2 }); if (!demo) openQuestion({ kind: 'fish', nodeId }); };
  const thr = () => { seq.stage = 'throw'; u.playWork('fish_throw', { loop: true, fade: 0.15 }); later(ms('fish_throw') * 0.5, () => fx.cast(seq.rod.userData.tip.getWorldPosition(new THREE.Vector3()), tg.x, tg.z, 0.8)); later(ms('fish_throw') - 120, wait); };
  const begin = () => { seq.stage = 'begin'; u.playWork('fish_begin', { loop: true }); later(Math.max(250, ms('fish_begin') - 60), thr); };
  u.playMotion('fish_draw', { hook: (e) => { if (e === 'rod-to-hand') seq.toHand(); }, onDone: () => { if (alive()) begin(); } });
  return true;
}
/** Game-time scheduler for the fishing sequence (so pausing and the test stepper both freeze it). */
function fishTick(dt) { const sq = G.fishSeq; if (!sq || !sq.q) return; for (const e of sq.q.slice()) { e.t -= dt; if (e.t <= 0) { sq.q.splice(sq.q.indexOf(e), 1); if (G.fishSeq === sq) e.fn(); } } }
function fishEnd(seq) { const u = G.playerObj?.userData; if (G.fishSeq === seq) G.fishSeq = null; G.fishFx?.clear(); u?.unmount?.(seq.rod); }
function fishResolve(ok) {
  const seq = G.fishSeq, u = G.playerObj?.userData, fx = G.fishFx; if (!seq || seq.resolved || !u) return false; seq.resolved = true; seq.stage = ok ? 'catch' : 'retrieve';
  const alive = () => G.fishSeq === seq, later = (t, fn) => { (seq.q ||= []).push({ t: t / 1000, fn }); }, ms = (n) => u.clipDur(n) * 1000, P = G.player;
  const nx = P.x + Math.cos(seq.ba) * 1.1, nz = P.z + Math.sin(seq.ba) * 1.1;
  const stow = () => { seq.stage = 'stow'; fx.clear(); u.playMotion('fish_stow', { hook: (e) => { if (e === 'rod-to-back') seq.toBack(); }, onDone: () => fishEnd(seq) }); };
  const stop = () => { u.playWork('fish_stop', { loop: true, fade: 0.2 }); later(Math.max(300, ms('fish_stop') - 40), stow); };
  if (ok) { fx.bite(); later(650, () => { u.playWork('fish_pull', { loop: true, fade: 0.12 }); fx.reel(nx, nz, ms('fish_pull') * 0.55 / 1000, true); later(ms('fish_pull') * 0.55, () => fx.lift(true)); later(ms('fish_pull') + 700, stop); }); }
  else { fx.reel(nx, nz, 1.3, false); later(1400, stop); }
  return true;
}
const CHOP_CONTACT = 0.5;   // fraction of one swing cycle at which the axe lands (measured on the approved chop, see GROK_INTAKE_LEDGER.md)
function treeFeedback(nodeId, speed) {
  const n = G.nodeById.get(nodeId), P = G.player, fx = G.treeFx; if (!n || !fx || n.kind !== 'tree') return;
  const ns = G.state.nodes[nodeId] || {}, final = !!ns.depleted, period = 0.958 / speed, hits = Math.min(ns.hits || 1, 3), px = P.x, pz = P.z;
  const swings = final ? 2 : 1;
  for (let k = 0; k < swings; k++) setTimeout(() => {
    if (final && k === swings - 1) { const m = seasonModel(n, seasonNow()); fx.hit(n, px, pz, 3); fx.fell(n, models[m] ? m : n.model, px, pz); } else fx.hit(n, px, pz, hits);
  }, Math.round((k + CHOP_CONTACT) * period * 1000));
}
function playWorkFor(kind) {
  const w = WORK_FOR[kind], u = G.playerObj?.userData; if (!w || !u?.playWork) return;
  if (kind === 'tree') treeFeedback(Q.ctx?.nodeId, 0.75 * SK.perks(G.state).chopMul);
  u.setFace?.(kind === 'bush' ? 'eating' : (kind === 'tree' || kind === 'rock') ? 'effort' : 'determined', kind === 'bush' ? 2.4 : 2.2);   // face follows the job: tasting a berry, straining at the axe
  if (w[2]) { if (u.playWork(w[0], { loop: true, tool: w[1], ...(kind === 'tree' ? { speed: 0.75 * SK.perks(G.state).chopMul } : {}) })) setTimeout(() => u.stopWork?.(), w[2]); } else u.playWork(w[0], { tool: w[1] });
}
function closeQuestion() { const wk = Q.ctx && Q.s && Q.s.doneOk ? Q.ctx.kind : null; stopExplainer(); if (G.placing) G.placing.frozen = false; $('q').classList.add('hidden'); $('jotter').classList.add('hidden'); Q.phase = 'none'; Q.autoClose = 0; mode = 'play'; if (Q.ctx?.kind === 'fish' && G.fishSeq) fishResolve(wk === 'fish'); else if (wk) playWorkFor(wk); else if (Q.ctx?.kind === 'fish') G.playerObj?.userData.stopWork?.(); }
$('qContinue').onclick = closeQuestion;
$('qSimilar').onclick = () => { const c = Q.ctx || {}, topic = Q.s?.q.topic; beginQ({ kind: 'practice', practice: true, tier: c.tier || 'normal', topicHint: topic }); };
// Jotter: draws freely; clears when closed (constitution rule 8).
{ const c = $('jotCanvas'), g = c.getContext('2d'); let down = false;
  const size = () => { c.width = c.clientWidth; c.height = c.clientHeight; g.lineWidth = 3; g.lineCap = 'round'; g.strokeStyle = '#1b2a4a'; };
  const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  c.onpointerdown = (e) => { down = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); }; c.onpointermove = (e) => { if (!down) return; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); }; c.onpointerup = () => { down = false; };
  $('qJot').onclick = () => { if (Q.s) Q.s.jotterUsed = true; $('jotter').classList.remove('hidden'); size(); };
  $('jotClear').onclick = () => g.clearRect(0, 0, c.width, c.height); $('jotClose').onclick = () => { g.clearRect(0, 0, c.width, c.height); $('jotter').classList.add('hidden'); };
  $('mJot').onclick = () => { toast('The jotter opens during a question.'); closeMenu(); }; }


// ---------------- education layer UI (constitution rules 11-15) ----------------
const PIPS = (n) => '●'.repeat(n) + '○'.repeat(5 - n);
function renderGoal() { const p = $('goalPill'); if (!G.state || !G.state.settings) { p.classList.add('hidden'); return; } const t = R.todayProgress(G.state, nowMs()); if (G.state.settings.quiet || !t.target) { p.classList.add('hidden'); return; } p.classList.remove('hidden'); p.textContent = t.met ? `Today ✔ ${t.answered}` : `Today ${t.answered}/${t.target}`; p.classList.toggle('met', t.met); }
// ---------------- first woodland adventure (empty start only) ----------------
const ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
function advBeacon(name, color, h, r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); m.name = name; m.visible = false; scene.add(m); return m;
}
function updateAdv() {
  const s = G.state, a = s.adv, P = G.player, pill = $('advPill'); if (!a) return;
  if (mode !== 'play') { pill.classList.add('hidden'); return; }
  if (!a.water && ADV.nearWater(P.x, P.z)) { a.water = true; toast('You found the river. A good place to fish.', 4000); saveNow(); }
  if (ADV.noteAway(s, P.x, P.z)) saveNow();
  if (ADV.shouldComplete(s, P.x, P.z)) { a.done = true; a.doneAt = nowMs(); showAdvDone(); saveNow(); }
  const cl = GD.checklist(s, { forage: !!G.forage }), g = s.guide; if (!g.told) { g.told = {}; for (const x of cl) if (x.isDone) g.told[x.id] = true; }
  if (GD.noteWalk(s, P.x, P.z)) saveNow();
  for (const x of cl) if (x.isDone && !g.told[x.id]) { g.told[x.id] = true; toast(`✔ ${x.chapter}: done. ${cl.filter(y => y.isDone).length} of ${cl.length} steps.`, 3500); saveNow(); }
  const nx = GD.next(s, { forage: !!G.forage }), pt = GD.pointing(nx.level), home = ADV.homeOf(s), isDep = (n) => (s.nodes[n.id] || {}).depleted || R.isResting(s, n.id, nowMs());
  let pos = null; if (nx.target === 'water') pos = G.advWater && { x: G.advWater.x, z: G.advWater.z }; else if (nx.target === 'home') pos = home;
  else if (nx.target === 'plant') { const pl = G.forage?.nearest(P.x, P.z, 60); pos = pl && { x: pl.x, z: pl.z }; } else if (nx.target) pos = GD.nearestNode(G.world.nodes, nx.target, P.x, P.z, isDep);
  G.advBeacon ||= advBeacon('advBeacon', 0xffe9a8, 16, 0.45); G.homeMark ||= advBeacon('homeMark', 0x9fe3a0, 7, 0.3);
  const place = (m, p, h) => { if (!p) { m.visible = false; return; } m.visible = true; m.position.set(p.x, groundAt(p.x, p.z) + h / 2, p.z); };
  place(G.advBeacon, pt.beam && pos && Math.hypot(pos.x - P.x, pos.z - P.z) > 6 ? pos : null, 16); place(G.homeMark, pt.beam && home && nx.target !== 'home' ? home : null, 7);
  G.advBeacon.material.opacity = G.homeMark.material.opacity = reduced ? 0.28 : 0.2 + 0.1 * Math.sin(G.t * 2);
  let txt = nx.done ? nx.text : `${nx.index + 1}/${nx.total} · ${nx.text}`; if (pos && pt.arrow) { const dx = pos.x - P.x, dz = pos.z - P.z, f = [-Math.sin(cam.yaw), -Math.cos(cam.yaw)], r = [Math.cos(cam.yaw), -Math.sin(cam.yaw)], ang = Math.atan2(dx * r[0] + dz * r[1], dx * f[0] + dz * f[1]); txt += ` · ${Math.round(Math.hypot(dx, dz))} m ${ARROWS[(Math.round(ang / (Math.PI / 4)) + 8) % 8]}`; }
  if (nx.why) txt += `  ·  ${nx.why}`;  pill.textContent = txt; pill.classList.toggle('hidden', nx.done && !!a.done);
}
function advListHtml() {
  const cl = GD.checklist(G.state, { forage: !!G.forage }), lv = GD.levelOf(G.state), cur = GD.next(G.state, { forage: !!G.forage }).step;
  return `<p class="tiny">Help level: <b>${lv}</b>. ${GD.LEVEL_NAME[lv]}.</p><div class="row">${GD.LEVELS.map(l => `<button class="small ${l === lv ? '' : 'alt'}" data-help="${l}">${l[0].toUpperCase() + l.slice(1)}</button>`).join('')}</div>` + cl.map(x => `<div class="advStep"><span class="${x.isDone ? 'ok' : ''}">${x.isDone ? '✔' : x === cur || x.id === cur?.id ? '➜' : '○'}</span><span><b>${x.chapter}</b> · ${x.say[lv === 'free' ? 'steady' : lv]}</span></div>`).join('');
}
function openJournal() {
  const s = G.state, m = ADV.summary(s), home = ADV.homeOf(s), a = s.adv || {}; mode = 'journal'; $('journal').classList.remove('hidden');
  const bits = [a.water ? 'You found the river.' : 'The river is still to find.', home ? 'Your shelter stands in a clearing you chose.' : 'No shelter yet: gather wood and sticks, then place a Quick shelter anywhere clear.', a.fish ? `Fish caught: ${a.fish}.` : 'No fish caught yet.',
    `Correct gathers so far: ${m.trees} tree${m.trees === 1 ? '' : 's'}, ${m.rocks} rock${m.rocks === 1 ? '' : 's'}, ${m.sticks} stick${m.sticks === 1 ? '' : 's'}, ${m.berries} berry bush${m.berries === 1 ? '' : 'es'}.`];
  $('journalBody').innerHTML = `<p class="tiny">You can do these in any order, or ignore them and just explore.</p>${advListHtml()}<h3>What has happened</h3>${bits.map(b => `<p class="tiny">${b}</p>`).join('')}${FORAGE_ON ? forageJournalHtml() : ''}`;
  $('journalBody').querySelectorAll('[data-help]').forEach(b => b.onclick = () => { (G.state.guide ||= { v: 1, done: {} }).force = b.dataset.help; saveNow(); openJournal(); });
}
function showAdvDone() {
  const m = ADV.summary(G.state); mode = 'advdone'; $('advDone').classList.remove('hidden');
  $('advDoneBody').innerHTML = `<p>You found the river, built a shelter in a clearing you chose, caught a fish and walked home.</p><p class="tiny">Along the way: ${m.correct} correct answer${m.correct === 1 ? '' : 's'}, ${m.trees} tree${m.trees === 1 ? '' : 's'} and ${m.rocks} rock${m.rocks === 1 ? '' : 's'} gathered, ${m.fish} fish. Nothing was lost on the way.</p>`;
}
$('mJournal').onclick = () => { $('menu').classList.add('hidden'); openJournal(); };
$('journalClose').onclick = () => { $('journal').classList.add('hidden'); mode = 'play'; };
$('advDoneOk').onclick = () => { $('advDone').classList.add('hidden'); mode = 'play'; };
function openSkills() {
  mode = 'skills'; $('skills').classList.remove('hidden'); const st = G.state, now = nowMs();
  const rows = R.topicsOf(st.profile.band).map(t => { const p = R.pipsOf(st, t, now), m = R.masteryOf(st, t, now); return `<div class="skRow"><div><b>${topicName(t)}</b><div class="tiny">${R.titleOf(p)}${m.n < R.MIN_N ? ' · answer a few more to earn pips' : ''}</div></div><div class="pips" aria-label="${p} of 5 pips">${PIPS(p)}</div></div>`; }).join('');
  const body = SK.skillsOn(st) ? skyHtml(st, SKSEL) + '<p class="tiny">Skills grow by doing, never by spending. A correct answer gives a short boost. They never go down.</p>' : '<p class="tiny">Body skills are switched off by your parent.</p>';
  $('skillsBody').innerHTML = `<h3>Body</h3>${body}<h3>Maths</h3><p class="tiny">Pips grow when you answer well on your own. They never reset or go down because of one wrong answer.</p>${rows}<p class="tiny">Streak ${st.streak} · best ${st.best} · free shields left this week ${R.shieldsLeft(st, now)} · chests opened ${st.chests || 0}</p>`;
}
$('mSkills').onclick = () => { $('menu').classList.add('hidden'); openSkills(); };
let SKSEL = 'athletics';
const skRedraw = () => { openSkills(); $('skillsBody').querySelector('.skTab.sel')?.focus({ preventScroll: true }); };
$('skillsBody').addEventListener('click', (e) => { const c = e.target.closest('[data-sk]'), a = e.target.closest('[data-skstep]'); if (c) SKSEL = c.dataset.sk; else if (a) SKSEL = nextSkill(SKSEL, +a.dataset.skstep); else return; skRedraw(); });
$('skillsClose').onclick = () => { $('skills').classList.add('hidden'); mode = 'play'; };
$('mHow').onclick = () => { $('menu').classList.add('hidden'); mode = 'how'; $('how').classList.remove('hidden'); $('howBody').innerHTML = R.rulesInWords(G.state).map(x => `<p>${x}</p>`).join(''); };
$('howClose').onclick = () => { $('how').classList.add('hidden'); mode = 'play'; };
// ---- play together: another device in the same world (positions, character look and placed builds only) ----
const TG = { net: null, remote: null, placed: new Set(), last: 0, sentAt: 0, code: '' };
const tgSay = (m) => { $('tgMsg').textContent = m; };
function tgView(connected, code) { $('tgChoose').classList.toggle('hidden', connected || !!code); $('tgLeave').classList.toggle('hidden', !connected && !code); $('tgCode').classList.toggle('hidden', !code); $('tgCode').textContent = code || ''; }
async function tgRemoteAvatar(who) {
  if (TG.remote) { scene.remove(TG.remote.obj); TG.remote = null; }
  let obj = null; try { const m = await import('./sidekick-character.js'); if (m.SIDEKICK_PRESETS[who]) obj = m.makeSidekickAvatar(await m.loadSidekick(who), undefined, G.skAnims || null); } catch {}
  obj ||= S.makePlayer(); scene.add(obj); obj.position.set(G.player.x, G.player.y, G.player.z); TG.remote = { obj, x: G.player.x, y: G.player.y, z: G.player.z, face: 0, speed: 0 };
}
function tgGot(m) {
  if (m.t === 'hello') { tgRemoteAvatar(m.who); for (const p of m.placed || []) tgPlaced(p); }
  else if (m.t === 'pos' && TG.remote) Object.assign(TG.remote, { x: m.x, y: m.y, z: m.z, face: m.f, speed: m.s });
  else if (m.t === 'place') tgPlaced(m.p);
}
function tgPlaced(p) { if (!p || !ITEMS[p.what]) return; const k = p.what + ',' + p.x + ',' + p.z; if (TG.placed.has(k)) return; TG.placed.add(k); addPlaced({ what: p.what, x: +p.x, z: +p.z, rot: +p.rot || 0 }); }   // drawn for this visit only; never saved into this player's own save
function tgSendPlaced(p) { if (TG.net?.connected && p) TG.net.send({ t: 'place', p: { what: p.what, x: p.x, z: p.z, rot: p.rot } }); }
function tgState(st, x) {
  if (st === 'waiting') { TG.code = x; tgView(false, x); tgSay('Tell your friend this code. Waiting for them…'); }
  else if (st === 'joining') tgSay('Connecting…');
  else if (st === 'connected') { TG.code = ''; tgView(true); tgSay('Together! Close this and walk around.'); toast('Your friend joined 👫', 3000); TG.net.send({ t: 'hello', who: G.sk?.who || 'boy-blonde', placed: (G.state.placed || []).map(p => ({ what: p.what, x: p.x, z: p.z, rot: p.rot })) }); }
  else if (st === 'closed') { if (TG.remote) { scene.remove(TG.remote.obj); TG.remote = null; } tgView(false); tgSay('Your friend left.'); }
  else if (st === 'error') { TG.code = ''; tgView(false); tgSay(x || 'Something went wrong. Try again.'); }
}
function tgTick(dt) {
  if (!TG.net?.connected) return; const P = G.player, now = performance.now();
  if (now - TG.sentAt > 120) { TG.sentAt = now; TG.net.send({ t: 'pos', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), f: +P.face.toFixed(2), s: +Math.min(1, P.speed / 4).toFixed(2) }); }
  const r = TG.remote; if (!r) return; const k = Math.min(1, dt * 10), o = r.obj;
  o.position.x += (r.x - o.position.x) * k; o.position.z += (r.z - o.position.z) * k; o.position.y += (r.y - o.position.y) * k;
  let d = r.face - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * k; o.userData.animate?.(r.speed, G.t, dt);
}
$('mTogether').onclick = () => { $('menu').classList.add('hidden'); mode = 'how'; $('together').classList.remove('hidden'); if (!TG.net) TG.net = createTogether({ onState: tgState, onMessage: tgGot }); };
$('tgClose').onclick = () => { $('together').classList.add('hidden'); mode = 'play'; };
$('tgHost').onclick = () => { tgSay('Getting a code…'); TG.net.host(); };
$('tgJoin').onclick = () => { const c = $('tgIn').value.trim(); if (c.length !== 4) { tgSay('Type the 4 letters your friend sees.'); return; } tgSay('Looking for that game…'); TG.net.join(c); };
$('tgLeave').onclick = () => { TG.net.close(); if (TG.remote) { scene.remove(TG.remote.obj); TG.remote = null; } tgView(false); tgSay('You left the game.'); };
function openSummary() {
  const S = R.summaryOf(G.state, nowMs()); mode = 'summary'; $('sumCard').classList.remove('hidden');
  const learned = S.topics.map(t => `<div class="skRow"><div><b>${t.topic}</b><div class="tiny">${t.right} of ${t.n} right${t.pips > t.was ? ' · new pip!' : ''}</div></div><div class="pips">${PIPS(t.pips)}</div></div>`).join('');
  $('sumBody').innerHTML = S.answered ? `<p>You answered <b>${S.answered}</b> question${S.answered === 1 ? '' : 's'} and got <b>${S.right}</b> right${S.minutes ? ` in about ${S.minutes} minutes` : ''}. ${S.up.length ? `You moved up in ${S.up.map(t => t.topic).join(', ')}.` : ''}${S.best ? ` Your strongest topic today: ${S.best.topic}.` : ''}</p>${learned}<p>Best streak ${S.bestStreak}${S.chests ? ` · chests opened ${S.chests}` : ''}</p><p><b>${S.goal}</b></p>` : `<p>No questions today yet.</p><p><b>${S.goal}</b></p>`;
  saveNow();
}
$('mDone').onclick = () => { $('menu').classList.add('hidden'); openSummary(); };
$('sumKeep').onclick = () => { $('sumCard').classList.add('hidden'); mode = 'play'; };
$('sumSleep').onclick = () => { $('sumCard').classList.add('hidden'); mode = 'play'; saveNow(); toast('Sleep well. See you in the forest tomorrow.'); };
// Daddy's dials: daily target, reward toggles, quiet week (inside the parent report, PIN-protected)
function dialsHtml(st) {
  const s = st.settings || {};
  return `<h3>Daddy's dials</h3><div class="row" id="dials"><label class="tiny">Daily questions <select data-d="dailyTarget">${[0, 5, 10, 15, 20, 30].map(n => `<option value="${n}" ${s.dailyTarget === n ? 'selected' : ''}>${n || 'off'}</option>`).join('')}</select></label>
  <button class="small ${s.chests ? '' : 'alt'}" data-d="chests">Chests: ${s.chests ? 'on' : 'off'}</button><button class="small ${s.finds ? '' : 'alt'}" data-d="finds">Lucky finds: ${s.finds ? 'on' : 'off'}</button><button class="small ${s.quiet ? '' : 'alt'}" data-d="quiet">Quiet week: ${s.quiet ? 'on' : 'off'}</button><button class="small ${SK.skillsOn(st) ? '' : 'alt'}" data-d="skills">Body skills: ${SK.skillsOn(st) ? 'on' : 'off'}</button><label class="tiny">Skill level cap <select data-d="skillCap">${[5, 10, 15, 20].map(n => `<option value="${n}" ${SK.capOf(st) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>`;
}
$('repBody').addEventListener('click', (e) => dialChange(e)); $('repBody').addEventListener('change', (e) => dialChange(e));
function dialChange(e) {
  const d = e.target.dataset?.d; if (!d || (e.type === 'click' && e.target.tagName === 'SELECT')) return;
  const st = repWho === G.id ? G.state : Object.assign(R.newState(PROFILES[repWho]), peekState(repWho) || {}); st.settings ||= { dailyTarget: 10, chests: true, finds: true, quiet: false };
  if (d === 'dailyTarget') st.settings.dailyTarget = +e.target.value; else if (d === 'skillCap') st.settings.skillCap = +e.target.value; else if (d === 'skills') st.settings.skills = st.settings.skills === false; else st.settings[d] = !st.settings[d];
  if (!saveState(st, repWho)) toast('Could not save'); if (repWho === G.id) G.state = st; renderGoal(); openReport();
}

// ---------------- parent report ----------------
const REP_IDS = () => (FAMILY ? ['tommy', 'charlie'] : ['synthetic-y56', 'synthetic-ks3']);
let repWho = FAMILY ? 'tommy' : 'synthetic-y56';
function openReport() {
  mode = 'report'; $('report').classList.remove('hidden');
  $('repWho').innerHTML = REP_IDS().map(id => `<button class="small ${id === repWho ? '' : 'alt'}" data-w="${id}">${PROFILES[id].name}</button>`).join('') + (FAMILY ? '<button class="small alt" id="repCsv">Download answers (CSV)</button>' : '<button class="small alt" id="repDemo">Add 24 simulated answers to this TEST profile</button>');
  const raw = repWho === G.id ? G.state : peekState(repWho);
  if (!raw) { $('repBody').innerHTML = `<p class="tiny">No saved play for ${PROFILES[repWho].name} yet. ${FAMILY ? 'Saves live on the device each boy plays on, so open this report on that device.' : 'This report only ever shows synthetic test data.'}</p>`; return; }
  const st = Object.assign(R.newState(PROFILES[repWho]), raw), rep = R.report(st, nowMs()), T = rep.totals;
  const rows = rep.topics.map(t => `<tr><td>${t.topic}<div class="tiny">${t.strand} · ${PIPS(t.pips)} ${t.title}</div></td><td>${t.level ?? '—'}</td><td>${t.indep.n ? `${t.indep.right}/${t.indep.n}${t.indepAccuracy != null ? ' (' + t.indepAccuracy + '%)' : ''}` : '—'}</td><td>${t.helped.n ? `${t.helped.right}/${t.helped.n}` : '—'}</td><td>${t.medianSec ?? '—'}</td><td>~${t.estimate}%</td><td><span class="tag ${t.status === 'needs practice' ? 'bad' : t.status === 'secure' ? 'good' : ''}">${t.status}</span> <span class="tiny">${t.verdict}</span></td></tr>`).join('');
  $('repBody').innerHTML = `<p>${rep.profile.synthetic ? '<span class="tag bad">SYNTHETIC TEST DATA</span>' : '<span class="tag good">REAL PLAY</span>'} <b>${rep.profile.name}</b> · ${T.answered} questions (${T.independent} independent, ${T.helped} helped, ${T.practice} practice) · ${T.explainers} explainers · warmth collapses ${T.coldCollapses} (no effect on learning) · best streak ${T.bestStreak} · ${T.playMinutes} min played</p>
  <table><tr><th>Topic</th><th>Level (1–3)</th><th>Independent first tries</th><th>Helped</th><th>Median s (active)</th><th>Estimate*</th><th>Status</th></tr>${rows || '<tr><td colspan=7>Not enough data yet.</td></tr>'}</table>
  ${rep.placement ? `<p class="tiny"><b>Starting-level check:</b> ${rep.placement.done ? 'finished' : 'in progress'} (${rep.placement.answered}/${rep.placement.target} questions). Levels are estimated from play, not a school assessment.</p>` : ''}
  <p class="tiny">*${rep.note}</p><p><b>Suggested next step:</b> ${rep.nextStep}</p>
  <p class="tiny">Today: ${rep.today.answered}${rep.today.target ? ' of ' + rep.today.target : ''} questions · free shields left ${rep.shieldsLeft} · chests ${rep.chests}</p>
  <h3>Last days</h3><div class="tiny">${rep.trend.map(d => `${d.day.slice(5)}: ${d.answered} q, ${d.accuracy}%${d.medianSec != null ? ', ' + d.medianSec + ' s' : ''}`).join(' · ') || 'No days yet.'}</div>
  ${dialsHtml(st)}
  <h3>Recent mistakes</h3>${rep.recentMistakes.map(m => `<div class="tiny">${m.topic}: ${m.q} — chose ${m.chosen}, answer ${m.correct}</div>`).join('') || '<div class="tiny">None recorded.</div>'}
  <p class="tiny">${FAMILY ? 'Play link: https://forest-maths-family-b1896d.netlify.app · Family version. The old Forest Maths game and saves are unchanged.' : 'Play link: this preview URL (synthetic profiles only; the real Forest Maths link is unchanged).'}</p>`;
}
$('repWho').onclick = (e) => { const w = e.target.dataset?.w; if (w) { repWho = w; openReport(); } if (e.target.id === 'repDemo') simulateAnswers(repWho, 24);
  if (e.target.id === 'repCsv') { const raw = repWho === G.id ? G.state : peekState(repWho); if (!raw) { toast('No saved answers on this device yet.'); return; } const csv = R.exportCSV(Object.assign(R.newState(PROFILES[repWho]), raw)), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `forest-maths-${repWho}-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); } };
$('repClose').onclick = () => { $('report').classList.add('hidden'); mode = 'play'; };
function simulateAnswers(id, n) {
  const st = id === G.id ? G.state : Object.assign(R.newState(PROFILES[id]), peekState(id) || {}), rng = makeRng(99 + st.log.length);
  let t = nowMs() - 5 * 86400000;
  for (let i = 0; i < n; i++) { t += 600000 + rng() * 300000; const s = R.startQuestion(st, { kind: 'tree', nodeId: 'sim' + i, tier: rng.pick(['easy', 'normal', 'normal', 'hard']) }, rng, t); if (rng() < 0.3) R.useHint(s);
    R.addActive(s, (6 + rng() * 20) * 1000); const weak = ['divide', 'expand', 'ratio'].includes(s.q.topic); R.submitAnswer(st, s, rng() < (weak ? 0.35 : 0.85) ? s.q.correctIndex : (s.q.correctIndex + 1) % 4, t + 20000, { test: true }); }
  st.inv = { wood: 0, stone: 0, berries: 0 }; // simulated data should not feed the child's inventory
  if (!saveState(st, id)) toast('Could not save'); if (id === G.id) G.state = st; openReport();
}

// ---------------- persistence ----------------
function saveNow() { if (!G) return; G.state.pos = { x: G.player.x, z: G.player.z }; { const t = tileOf(G.player.x, G.player.z); G.state.area = `${tileKey(...t)} ${biomeAt(G.player.x, G.player.z)}`; } saveState(G.state, G.id); }

// ---------------- main loop ----------------
let last = 0, frames = 0, fpsAcc = 0, fpsShown = 0, camSmooth = new THREE.Vector3(), camInit = false;
const tmpV = new THREE.Vector3();
function loop(t) {
  requestAnimationFrame(loop); const raw = Math.min(250, t - last); last = t; const dt = raw / 1000;
  if (G) update(dt, raw); render(dt, raw);
}
function update(dt, rawMs) {
  const s = G.state, P = G.player, vis = !document.hidden;
  if (mode === 'ask' && Q.phase === 'q' && vis) R.addActive(Q.s, rawMs);       // active time only: visible, question open, not in explainer
  G.treeFx?.update(dt); fishTick(dt); if (G.fishFx) { const sq = G.fishSeq; G.fishFx.update(dt, sq && sq.rod.parent ? sq.rod.userData.tip.getWorldPosition(FISH_V) : null); }
  if (G.forage) { G.fgT = (G.fgT || 0) - dt; if (G.fgT <= 0) { G.fgT = 0.3; G.forage.update(P.x, P.z, (id) => F.plantResting(s, id, s.play.sec) || (s.rest[id] || 0) > nowMs()); } }
  if (mode === 'ask' && Q.autoClose > 0) { Q.autoClose -= dt; if (Q.autoClose <= 0) closeQuestion(); }
  if (!paused && mode !== 'start') { G.t += dt; S.uTime.value = reduced ? 0 : G.t; { const prev = s.tod; s.tod = (s.tod + dt / DAY_LEN) % 1; if (s.tod < prev) s.day = (s.day || 0) + 1; } }
  if (mode === 'play' && vis) { s.play.sec += dt; const day = new Date().toISOString().slice(0, 10); s.play.days[day] = (s.play.days[day] || 0) + dt; }
  { const w = G.weather; w.step(paused ? 0 : dt, { instant: reduced, paused }); const L = w.light; if (L.count !== G.lastStrike) { G.lastStrike = L.count; G.bolt.strike(L.azimuth, L.count + 3); } }
  // ---- hidden warmth (no bar): season + weather + night vs shelter/fire; red pulses warn; a collapse is gentle and loses nothing ----
  if (mode === 'play' && !paused && coldActive()) coldTick(dt);
  else { G.coldFx = G.coldFx || $('coldFx'); if (G.coldFx) G.coldFx.style.opacity = 0; }
  // regrow
  if (mode === 'play') for (const [id, ns] of Object.entries(s.nodes)) if (ns.depleted && s.play.sec >= ns.regrowAtSec) { ns.depleted = false; ns.hits = 0; refreshNodeVisual(G.nodeById.get(id)); }
  // movement
  if (mode === 'play') {
    let ix = input.x, iy = input.y; const k = input.keys;
    if (k.has('w') || k.has('arrowup')) iy += 1; if (k.has('s') || k.has('arrowdown')) iy -= 1; if (k.has('d') || k.has('arrowright')) ix += 1; if (k.has('a') || k.has('arrowleft')) ix -= 1;
    const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
    const perk = SK.perks(s), fed = F.fedPerk(s, s.play.sec); if (G.climb) { ix = iy = 0; }
    if (P.air || G.climb || G.placing || input.jump) G.crouch = false;   // jumping, climbing or placing stands you up
    const sprint = !G.crouch && (k.has('shift') || input.sprint), wade = depthAt(P.x, P.z) > 0.08 ? 0.6 : 1, sl = slopeAt(P.x, P.z);
    if (!P.air) P.sprinting = sprint;   // in the air nothing can be changed: the takeoff gait stays
    const sp = (sprint ? 5.2 * perk.sprintMul : G.crouch ? 1.5 : 3.1) * fed.move * wade * (1 - Math.min(0.35, sl * 0.3)), fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    // grounded feel: velocity eases toward the wanted velocity (about 0.15 s to full speed, 0.1 s to stop) so starts, turns and stops have a little weight, without lag
    const wvx = (fx * iy + rx * ix) * sp, wvz = (fz * iy + rz * ix) * sp, ease = Math.min(1, dt * ((wvx || wvz) ? 11 : 16));
    if (!P.air) { P.vx = (P.vx || 0) + (wvx - (P.vx || 0)) * ease; P.vz = (P.vz || 0) + (wvz - (P.vz || 0)) * ease;   // real momentum: once airborne the horizontal velocity is fixed, no steering, braking or speeding up until you land
      if (Math.hypot(P.vx, P.vz) < 0.05 && !wvx && !wvz) P.vx = P.vz = 0; }
    const mx = P.vx * dt, mz = P.vz * dt;
    if (mx || mz) { const n = moveStep(P, mx, mz, G.world, { seamOpen: s.crossed, clear: Math.max(0, P.y - groundAt(P.x, P.z)) }); const moved = Math.hypot(n.x - P.x, n.z - P.z); P.x = n.x; P.z = n.z; P.speed = moved / dt;
      const target = Math.atan2(mx, mz); let d = target - P.face; d = Math.atan2(Math.sin(d), Math.cos(d)); if (!P.air) P.face += d * Math.min(1, dt * 12); }
    else P.speed = 0;
    if (P.y === undefined) P.y = groundAt(P.x, P.z);
    if (!G.climb && input.jump && !G.placing) { const job = findClimb(P, G.world.colliders, G.world.ready); if (job) { G.climb = { job, t: 0, dur: CLIMB_DUR * perk.climbMul * fed.climb }; G.playerObj?.userData.setFace?.('happy', 1.2); } }
    if (G.climb) { const c = G.climb; P.vx = P.vz = 0; c.t += dt; const u = Math.min(1, c.t / c.dur), q = climbAt(c.job, u); P.x = q.x; P.y = q.y; P.z = q.z; P.speed = 0; P.air = false; P.vy = 0; let d = c.job.face - P.face; d = Math.atan2(Math.sin(d), Math.cos(d)); P.face += d * Math.min(1, dt * 14); if (u >= 1) { G.climb = null; notifyLevel(SK.trackClimb(s, G.skAcc ||= {}, c.job.id)); } }
    else { const ev = stepVertical(P, dt, input.jump && !G.placing, G.world.colliders, perk.jumpMul * fed.move); if (ev === 'jump') { G.playerObj?.userData.setFace?.('happy', 0.9); notifyLevel(SK.trackJump(s, G.skAcc ||= {}, P.x, P.z)); } }
    input.jump = false; notifyLevel(SK.trackMove(s, G.skAcc ||= {}, dt, P.speed, !!P.sprinting, !P.air && !G.climb));
    if (touch || TEST) $('btnJump').classList.remove('hidden');
    if (wade < 1 && P.speed > 0.3 && G.t - G.lastRipple > 0.45) { G.lastRipple = G.t; G.water.userData.addRipple(P.x, P.z); }
    if (G.t - G.lastTouch > 0.3) { G.lastTouch = G.t; if (G.seasonShown !== seasonNow() || G.wetShown !== (G.weather.cur.wet > 0.35 && seasonNow() !== 'winter')) rebuildKindLists(); cullProps(); const tg = targets()[0]; $('prompt').textContent = tg ? describe(tg) : ''; $('prompt').classList.toggle('hidden', !tg); $('btnAct').classList.toggle('hidden', !tg); $('btnAct').textContent = tg?.type === 'hut' ? 'Build' : tg?.type === 'gate' ? 'Gate' : 'Gather'; }
    updateTiles(false);
    if (G.state.adv) updateAdv();
    if (G.t - G.lastSave > 12) { G.lastSave = G.t; saveNow(); }
  } else { $('prompt').classList.add('hidden'); $('advPill').classList.add('hidden'); $('btnJump').classList.add('hidden'); input.jump = false; P.vx = P.vz = 0; if (G.climb) { const j = G.climb.job; P.x = j.x1; P.y = j.y1; P.z = j.z1; G.climb = null; } if (P.air) stepVertical(P, dt, false, G.world.colliders); }
  G.cover.userData.update(P.x, P.z, 0.45 + 0.55 * quality.particles, quality.tier === 'low' ? 1.5 : 2.5, false, COVER_REACH[quality.tier] || 15);
  if (G.placing && !G.placing.frozen) updateGhost(false);
  { const eff = G.weather.cur.rain * weatherFront(P.x, P.z, G.t); if (eff > 0.55 && (G.shelt ?? 0) < 0.5 && G.t - (G.lastShelterHint ?? -999) > 240 && mode === 'play') { G.lastShelterHint = G.t; toast('Heavy rain. A shelter (or the cabin) would keep you dry.', 4500); } }
  // visuals tied to state
  for (const [id, until] of Object.entries(s.rest)) { const on = until > nowMs() && !s.nodes[id]?.depleted, n = G.nodeById.get(id); if (n) restSprite(id, on, n.x, n.y + (n.kind === 'tree' ? 4.4 * n.scale : 1.3), n.z); }
  for (const f of G.fires) { if (f.grow !== undefined) { f.grow = Math.min(1, f.grow + dt * 1.6); f.group.scale.setScalar(Math.max(0.01, f.grow)); if (f.grow >= 1) delete f.grow; } }
  if (G.gateRing) G.gateRing.material.opacity = reduced ? 0.7 : 0.55 + 0.25 * Math.sin(G.t * 2.2);
  G.water.userData.tick(reduced ? 0 : dt); G.water.material.uniforms.flow.value = reduced ? 0 : 1;
  G.playerObj.position.set(P.x, P.y, P.z); G.playerObj.position.y += G.playerObj.userData.floorSupportOffset?.() || 0; G.playerObj.rotation.y = P.face; G.playerObj.userData.animate(Math.min(1, P.speed / 4), G.t, dt, { speed: P.speed, sprinting: !!P.sprinting, crouch: !!G.crouch, vy: P.vy || 0, slope: slopeAhead(), moving: mode === 'play' && vis && P.speed > 0.05, reduced, air: !!P.air, climb: G.climb ? Math.min(1, G.climb.t / G.climb.dur) : undefined }); tgTick(dt);
  renderInv();
}
// Draw budgets by quality tier (metres). Collision and gameplay never depend on these; they only choose what is drawn.
const DRAW = { high: { treeNear: 34, treeFar: 80, deco: 36, bush: 46, solid: 60, rock: 70 }, med: { treeNear: 27, treeFar: 64, deco: 28, bush: 36, solid: 48, rock: 56 }, low: { treeNear: 20, treeFar: 50, deco: 20, bush: 26, solid: 36, rock: 42 } };
function cullProps() {
  const P = G.player, D = DRAW[quality.tier] || DRAW.high, list = [], farLists = new Map(), sq = (v) => v * v;
  for (const [model, g] of G.kinds) { if (!g.userData.props.length) continue; list.length = 0; const lodModel = LOD_FAR[model];
    for (const p of g.userData.props) { if (p.hidden || !propLoaded(p)) continue; const dx = p.x - P.x, dz = p.z - P.z, d2 = dx * dx + dz * dz;
      const lim = p.kind === 'tree' ? sq(D.treeFar) : p.kind === 'rock' ? sq(D.rock) : p.kind === 'grock' ? sq(D.solid) : p.model === 'reeds_cattail_clump' || p.model === 'lily_pad_cluster' ? sq(D.bush) : p.model.startsWith('fm_bush') || p.model.startsWith('fm_shrub') || p.model.startsWith('Bush') ? sq(D.bush) : sq(D.deco);
      if (d2 >= lim) continue; if (lodModel && d2 >= sq(D.treeNear)) (farLists.get(lodModel) || farLists.set(lodModel, []).get(lodModel)).push(p); else list.push(p); }
    g.userData.set(list); }
  for (const [model, g] of G.kinds) if (!g.userData.props.length) g.userData.set(farLists.get(model) || []);
}
// ---- weather over the streamed world: ONE global state, shaped by a slow world-space front (continuous across every tile join) ----
function shelterState(P) {
  let shelter = 0; for (const p of G.state.placed || []) if (p.what === 'shelter') { const d = Math.hypot(P.x - p.x, P.z - p.z); shelter = Math.max(shelter, 1 - Math.min(1, Math.max(0, (d - 1.2) / 0.8))); }
  const cabin = G.state.built.hut3 && Math.abs(P.x - HUT.x) < HUT.half - 0.2 && Math.abs(P.z - HUT.z) < HUT.half - 0.2 ? 1 : 0;       // inside the roofed cabin
  return { shelter, cabin, any: Math.max(shelter, cabin) };
}
function render(dt, rawMs) {
  if (!G) { renderer.clear(); return; }
  G.lastAtmo = atmosphere(G.state.tod); const wchBase = G.weather.cur, front = weatherFront(G.player.x, G.player.z, G.t), shelt = G.shelt = (G.shelt ?? 0) + (shelterState(G.player).any - (G.shelt ?? 0)) * Math.min(1, dt * 4);
  const wch = { ...wchBase, rain: wchBase.rain * front + (G.weather.type === 'shower' ? 0.55 * G.weather.intensity * front * front : 0), fog: Math.min(1, wchBase.fog * (0.7 + 0.6 * (1 - front)) + 0.25 * wchBase.rain * (1 - front)) }, flash = G.weather.light.flash, a = withWeather(atmosphere(G.state.tod), wch, flash), P = G.player;
  // light + sky
  sun.color.setRGB(...a.lightColor); sun.intensity = a.lightIntensity; hemi.color.setRGB(...a.hemiSky); hemi.groundColor.setRGB(...a.hemiGround); hemi.intensity = a.hemiIntensity;
  const L = a.lightDir; sun.position.set(P.x + L[0] * 90, P.y + L[1] * 90 + 4, P.z + L[2] * 90);
  const sh = sun.shadow.camera, texel = 64 / sun.shadow.mapSize.x; sun.target.position.set(Math.round(P.x / texel) * texel, P.y, Math.round(P.z / texel) * texel); sun.target.updateMatrixWorld();
  sun.castShadow = quality.shadowOn && L[1] > 0.02; scene.fog.color.setRGB(...a.fogColor); scene.fog.near = a.fogNear; scene.fog.far = a.fogFar; renderer.toneMappingExposure = a.exposure;
  const su = sky.material.uniforms; su.zen.value.setRGB(...a.sky.zenith); su.hor.value.setRGB(...a.sky.horizon); su.sunDir.value.set(...a.sunDir); su.sunCol.value.setRGB(...a.lightColor); su.moonDir.value.set(...a.moonDir); su.night.value = a.night; sky.position.copy(camera.position);
  const wu = G.water.material.uniforms; wu.zen.value.copy(su.zen.value); wu.hor.value.copy(su.hor.value); wu.sunDir.value.set(...(a.elevation > -0.05 ? a.sunDir : a.moonDir)); wu.sunCol.value.setRGB(...a.lightColor); wu.fogColor.value.setRGB(...a.fogColor); wu.fogNear.value = a.fogNear; wu.fogFar.value = a.fogFar; wu.night.value = a.night; wu.litAmt.value = a.elevation > -0.05 ? 1 : 0.35;
  su.cloud.value = Math.min(1, wch.cloud + wch.rain * .4); su.grey.value.setRGB(...a.fogColor); G.terrain.userData.uWet.value = wch.wet; { const tgt = seasonNow() === 'winter' ? 1 : 0, u = G.terrain.userData.uSnow; u.value += (tgt - u.value) * Math.min(1, dt * 0.8); G.grass.material.color.setRGB(1 - 0.35 * u.value, 1 - 0.1 * u.value, 1 + 0.2 * u.value); } wu.uRain.value = wch.rain; if (wu.uWindW) wu.uWindW.value = reduced ? 0 : Math.min(1, wch.wind); wu.uFlash.value = flash;
  G.rain.uniforms.uTime.value = G.t; G.rain.uniforms.uGround.value = P.y - 1.5; G.rain.setAmount(Math.min(1, wch.rain) * (0.35 + 0.65 * quality.particles) * (1 - 0.96 * shelt)); G.rain.uniforms.uColor.value.setRGB(...(a.night > .5 ? [.45, .55, .75] : [.74, .81, .9]));
  { const sunUp = Math.min(1, Math.max(0, (a.elevation - 0.06) / 0.2)), rb = (G.weather.type === 'shower' ? Math.min(1, 0.4 + wchBase.wet * 1.5) * (1 - front) * 1.4 : 0) * sunUp * (1 - a.night); G.rainbow.setStrength(Math.min(1, rb)); if (rb > 0.02) G.rainbow.place(P, a.sunDir, camera); }
  G.bolt.set(G.weather.strikeProgress(), flash, camera); G.leaves.userData.update(reduced || paused ? 0 : dt, G.t, P, wch.rain > .5 ? 1.6 : 1); updateAnimals(paused ? 0 : dt);
  S.uWind.value = reduced ? 0 : 1 + 1.4 * wch.wind + 0.5 * wch.rain;
  { const day = 1 - a.night, calm = Math.max(0, 1 - wch.rain * 1.5 - wch.cloud * 0.4); G.butterflies.userData.update(G.t, P, reduced ? 0 : 1, quality.particles * (day > 0.5 ? calm : 0)); G.birds.userData.update(G.t, P, reduced ? 0 : 1, day > 0.4 ? 1 - wch.rain : 0); }
  G.shafts.userData.update(P, a, reduced ? 0 : G.t, a.shafts * quality.particles); G.motes.userData.update(P, G.t, a, quality.particles, reduced ? 0 : 1);
  { const dn = 0.4 + 0.6 * quality.particles; if (Math.abs(G.grass.userData.density - dn) > 0.01) { G.grass.userData.density = dn; G.grass.userData.update(P.x, P.z, true); } else G.grass.userData.update(P.x, P.z); }
  for (const f of G.fires) f.update(G.t, reduced ? 0 : dt, a.night, reduced ? 0 : 1);
  // camera: orbit behind the player, kept above ground and out of trunks
  const head = tmpV.set(P.x, P.y + 1.35, P.z);
  const cp = Math.cos(cam.pitch), want = new THREE.Vector3(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
  let dist = cam.dist; for (let d = 0.6; d <= cam.dist; d += 0.4) { const x = head.x + want.x * d, y = head.y + want.y * d, z = head.z + want.z * d; if (y < groundAt(x, z) + 0.45) { dist = Math.max(0.9, d - 0.5); break; }
    let hit = false; for (const c of G.world.colliders) { if (c.r > 0.3 && y < 3 && Math.hypot(x - c.x, z - c.z) < c.r + 0.25) { hit = true; break; } } if (hit) { dist = Math.max(0.9, d - 0.5); break; } }
  const target = new THREE.Vector3(head.x + want.x * dist, head.y + want.y * dist, head.z + want.z * dist); target.y = Math.max(target.y, groundAt(target.x, target.z) + 0.5);
  if (!camInit) { camSmooth.copy(target); camInit = true; } else camSmooth.lerp(target, 1 - Math.exp(-dt * 14));
  camera.position.copy(camSmooth); camera.lookAt(head.x, head.y + 0.1, head.z);
  quality.frame(rawMs, { hidden: document.hidden, loading: false, resumed: rawMs > 200 }); applyScale();
  renderer.shadowMap.enabled = quality.shadowOn;
  renderer.render(scene, camera);
  frames++; fpsAcc += rawMs; if (fpsAcc > 500) { fpsShown = Math.round(frames * 1000 / fpsAcc); frames = 0; fpsAcc = 0; updateClock(a); }
}
function updateClock(a) {
  const mins = Math.round(a.p * 24 * 60), hh = String(Math.floor(mins / 60) % 24).padStart(2, '0'), mm = String(mins % 60).padStart(2, '0');
  $('clock').textContent = `${hh}:${mm} · ${phaseName(a.p)} · ${seasonNow()}${paused ? ' · paused' : ''}`;
  if (!$('diag').classList.contains('hidden')) { const i = renderer.info.render; $('diag').textContent = `warmth ${(G.state.warmth ?? 1).toFixed(2)} ${JSON.stringify(G.warmthCtx || {})}\nfps ${fpsShown}  scale ${quality.scale.toFixed(2)} (${qualityMode})  tier ${quality.tier}\ncalls ${i.calls}  tris ${i.triangles}\nxz ${G.player.x.toFixed(1)}, ${G.player.z.toFixed(1)}  y ${G.player.y.toFixed(2)}  ${tileKey(...tileOf(G.player.x, G.player.z))}\ntiles ${G.tiles.size} (loads ${G.stats.loads} unloads ${G.stats.unloads})\nEMULATED/BROWSER measure — not a physical iPad test`; }
}

// ---------------- test hooks (only with ?test=1) ----------------
function exposeTest() {
  window.__fm = { get WS() { return WS; }, F, get FG() { return FG; }, openForage, closeForage, pickIdent, harvestPlant, forageEnv, kitchenHtml, TG, G, R, S, THREE, scene, camera, renderer, quality, cam, input, get mode() { return mode; },
    teleport(x, z) { const P = G.player; P.x = x; P.z = z; P.y = groundAt(x, z); P.air = false; P.vy = 0; G.climb = null; updateTiles(true); cullProps(); G.cover.userData.update(x, z, 1, 0, true); }, setTime(p) { G.state.tod = p; }, setCam(yaw, pitch, dist) { cam.yaw = yaw; if (pitch != null) cam.pitch = pitch; if (dist) cam.dist = dist; },
    act, parentFire, targets, fishStart, fishResolve, get fishSeq() { return G.fishSeq; }, openMenu, closeMenu, answer: (correct) => { const s = Q.s; if (s && Q.phase === 'q') answerChoice(correct ? s.q.correctIndex : (s.q.correctIndex + 1) % 4); }, qstate: () => ({ phase: Q.phase, ctx: Q.ctx }),
    pickTier: (t) => { const b = document.querySelector(`[data-tier="${t}"]`); b && b.click(); }, closeQ: closeQuestion, saveNow, setFree: (v) => { G.free = v; updatePill(); },
    step(dx, dz) { const n = moveStep(G.player, dx, dz, G.world, { seamOpen: G.state.crossed }); Object.assign(G.player, n); return n; }, pause: (v) => { paused = v; }, setQualityMode: (m) => { qualityMode = m; setQualityMode(); },
    /** run the real update()+render() path for n frames of dt seconds with the given keys held; returns per-frame CPU ms (works while the pane is hidden and rAF is throttled) */
    sim(n, dt = 1 / 30, keys = []) { const out = []; for (const k of keys) input.keys.add(k); for (let i = 0; i < n; i++) { const t0 = performance.now(); update(dt, dt * 1000); render(dt, dt * 1000); out.push(performance.now() - t0); } for (const k of keys) input.keys.delete(k); return out; },
    cullProps, rebuildKindLists, cover: () => G.cover, coldTick, coldCollapse, seasonNow, setFreeMode: (v) => { G.free = v; },
    startPlacement, confirmPlacement, cancelPlacement, updateGhost, placing: () => G.placing, updateTiles, canPlace,
    fireSpotOk, simulateAnswers, clearProfile,
    async snap(name) { for (let i = 0; i < 4; i++) { update(0.05, 50); render(0.05, 16); } renderer.render(scene, camera); const url = canvas.toDataURL('image/png'); const r = await fetch('/save?name=' + encodeURIComponent(name), { method: 'POST', body: url }); return r.text(); } };
}

// ---- Meshy explorer trial: toggle + manual clip review (manual clips never award resources) ----
function installExplorerReview(avatar, playLabel = 'Play explorer clip') {
  const grid = document.querySelector('#menu .grid'); if (!grid || document.getElementById('explorerClip')) return;
  const sel = document.createElement('select'); sel.id = 'explorerClip'; sel.className = 'big alt';
  for (const name of avatar.userData.clipNames || []) { const o = document.createElement('option'); o.value = name; o.textContent = avatar.userData.clipLabels?.[name] || name.replaceAll('_', ' '); sel.append(o); }
  const play = document.createElement('button'); play.className = 'big alt'; play.textContent = playLabel; play.onclick = () => avatar.userData.playClip?.(sel.value);
  const back = document.createElement('button'); back.className = 'big alt'; back.textContent = 'Back to walking'; back.onclick = () => avatar.userData.playClip?.(null);
  grid.append(sel, play, back);
}
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('#menu .grid'); if (!grid) return;
  const b = document.createElement('button'); b.className = 'big alt'; b.id = 'mExplorer'; b.textContent = 'Explorer (Meshy trial): ' + (EXPLORER ? 'ON' : 'off');
  b.onclick = () => { try { localStorage.setItem('fm_explorer', EXPLORER ? '0' : '1'); } catch {} location.href = location.pathname + (EXPLORER ? '' : '?explorer=1'); };
  grid.append(b);
});

// ---- family version: start screen, idea box ----
if (FAMILY) {
  $('startSub').innerHTML = 'River Clearing · <b>family version</b>';
  $('startTiny').textContent = 'Your answers are saved on this device. The only thing that can be sent is an idea you type into the Idea box.';
  document.querySelectorAll('[data-profile^="synthetic"]').forEach(b => b.classList.add('hidden'));
  $('pTommy').classList.remove('hidden'); $('pCharlie').classList.remove('hidden');
}
const IDEAS_KEY = 'fmr1.ideas', ideasGet = () => { try { return JSON.parse(localStorage.getItem(IDEAS_KEY) || '[]'); } catch { return []; } }, ideasSet = (v) => { try { localStorage.setItem(IDEAS_KEY, JSON.stringify(v.slice(-40))); } catch { /* ignore */ } };
async function postIdea(it) {
  const pics = it.pics && (it.pics.shot || it.pics.photo);
  let body, headers;
  if (pics) { body = new FormData(); for (const [k, v] of Object.entries({ 'form-name': 'ideas-pics', profile: it.profile, year: String(it.year || ''), ts: it.ts, build: 'family-1', idea: it.idea, where: it.where || '' })) body.append(k, v); if (it.pics.shot) body.append('shot', it.pics.shot, 'game.jpg'); if (it.pics.photo) body.append('photo', it.pics.photo, 'photo.jpg'); }
  else { body = new URLSearchParams({ 'form-name': 'ideas', profile: it.profile, year: String(it.year || ''), ts: it.ts, build: 'family-1', idea: it.idea }).toString(); headers = { 'Content-Type': 'application/x-www-form-urlencoded' }; }
  const r = await fetch('/', { method: 'POST', headers, body }); return r.ok;
}
// ---- pictures + voice for the idea box: snap the game, use the device camera, speak the idea. Nothing is sent until the child taps Send. ----
const IP = { shot: null, photo: null, stream: null, rec: null };
async function jpegOf(source, w, h) {   // source: canvas or video; returns a JPEG blob at most 1280 px wide
  const k = Math.min(1, 1280 / w), c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.8));
}
function showPic() { const b = IP.photo || IP.shot; $('picBox').classList.toggle('hidden', !b); if (b) $('ideaPic').src = URL.createObjectURL(b); }
function stopCam() { IP.stream?.getTracks().forEach(t => t.stop()); IP.stream = null; $('camBox').classList.add('hidden'); }
$('ideaSnap').onclick = async () => { try { renderer.render(scene, camera); IP.shot = await jpegOf(canvas, canvas.width, canvas.height); IP.photo = null; showPic(); $('ideaMsg').textContent = 'Picture of the game added. Now say or type what to change.'; } catch { $('ideaMsg').textContent = 'Could not take a picture of the game.'; } };
$('ideaCam').onclick = async () => {
  try { IP.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); const v = $('camVid'); v.srcObject = IP.stream; await v.play(); $('camBox').classList.remove('hidden'); }
  catch { $('ideaMsg').textContent = 'The camera is not available (or was not allowed). You can still type or speak your idea.'; }
};
$('camTake').onclick = async () => { const v = $('camVid'); if (!v.videoWidth) return; IP.photo = await jpegOf(v, v.videoWidth, v.videoHeight); stopCam(); showPic(); $('ideaMsg').textContent = 'Photo added. Now say or type what to change.'; };
$('camCancel').onclick = stopCam;
$('picRemove').onclick = () => { IP.shot = IP.photo = null; showPic(); };
{ const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) $('ideaMic').classList.add('hidden'); else $('ideaMic').onclick = () => {
  if (IP.rec) { IP.rec.stop(); return; }
  const r = IP.rec = new SR(); r.lang = 'en-GB'; r.interimResults = false; r.continuous = true; $('ideaMic').textContent = '⏹ Stop'; $('ideaMsg').textContent = 'Listening… speak, then tap Stop. You can fix the words before sending.';
  r.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const t = $('ideaText'); t.value = (t.value + ' ' + e.results[i][0].transcript).trim().slice(0, 500); $('ideaCount').textContent = String(t.value.length); } };
  r.onerror = () => { $('ideaMsg').textContent = 'The microphone is not available (or was not allowed). You can type instead.'; };
  r.onend = () => { IP.rec = null; $('ideaMic').textContent = '🎤 Speak'; };
  try { r.start(); } catch { IP.rec = null; $('ideaMic').textContent = '🎤 Speak'; } }; }
function renderIdeas() { $('ideaList').innerHTML = ideasGet().slice(-6).reverse().map(i => `<div>${i.sent ? '✔ sent' : '⏳ saved here, will send'}: ${i.idea.replace(/</g, '&lt;').slice(0, 90)}</div>`).join(''); }
async function flushIdeas() { const list = ideasGet(); let changed = false; for (const it of list) { if (!it.sent) { try { if (await postIdea(it)) { it.sent = true; changed = true; } } catch { /* offline: keep */ } } } if (changed) ideasSet(list); }
function openIdeas() { IP.shot = IP.photo = null; showPic(); mode = 'ideas'; $('menu').classList.add('hidden'); $('ideas').classList.remove('hidden'); $('ideaMsg').textContent = ''; $('ideaText').value = ''; $('ideaCount').textContent = '0'; renderIdeas(); }
$('ideaText').oninput = () => { $('ideaCount').textContent = String($('ideaText').value.length); };
$('ideaClose').onclick = () => { stopCam(); IP.rec?.stop(); $('ideas').classList.add('hidden'); mode = 'play'; };
$('ideaSend').onclick = async () => {
  const text = $('ideaText').value.trim().slice(0, 500); if (text.length < 3) { $('ideaMsg').textContent = 'Say or type your idea first.'; return; }
  const P = G?.player || { x: 0, z: 0 }, it = { profile: G.state.profile.name.split(' ')[0], year: G.state.profile.year, ts: new Date().toISOString(), idea: text, sent: false, where: `x${P.x.toFixed(0)} z${P.z.toFixed(0)} · ${G?.sk?.who || ''} · ${G?.state?.profile?.band || ''}` };
  const withPics = !!(IP.shot || IP.photo); if (withPics) it.pics = { shot: IP.shot, photo: IP.photo };
  $('ideaMsg').textContent = 'Sending…'; let ok = false; try { ok = await postIdea(it); } catch { ok = false; }
  if (withPics) { if (ok) { IP.shot = IP.photo = null; showPic(); $('ideaText').value = ''; $('ideaCount').textContent = '0'; $('ideaMsg').textContent = 'Sent with your picture! Thank you. Your parent will read it.'; } else $('ideaMsg').textContent = 'Could not send the picture just now (are you online?). It is still here: try again.'; return; }
  const list = ideasGet(); it.sent = ok; list.push(it); ideasSet(list); $('ideaText').value = ''; $('ideaCount').textContent = '0';
  $('ideaMsg').textContent = it.sent ? 'Sent! Thank you. Your parent will read it.' : 'Saved on this device. It will be sent when you are online.'; renderIdeas();
};
window.addEventListener('online', () => { flushIdeas(); });
document.addEventListener('DOMContentLoaded', () => {
  if (!FAMILY) return; const grid = document.querySelector('#menu .grid'); if (!grid) return;
  const b = document.createElement('button'); b.className = 'big alt'; b.id = 'mIdeas'; b.textContent = '💡 Idea box'; b.onclick = openIdeas; grid.append(b); flushIdeas();
  const cam = document.createElement('button'); cam.id = 'btnIdea'; cam.textContent = '📷'; cam.title = 'Tell the game builder what to change'; cam.setAttribute('aria-label', 'Idea box with camera and microphone');
  cam.style.cssText = 'position:fixed;right:var(--pad,12px);top:max(70px,calc(env(safe-area-inset-top) + 62px));width:48px;height:48px;border-radius:50%;z-index:15;font-size:22px;background:rgba(0,0,0,.55);color:#fff;border:0';
  cam.onclick = () => { if (mode === 'play') openIdeas(); }; $('hud').append(cam);
});
