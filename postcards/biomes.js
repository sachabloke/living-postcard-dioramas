// Postcard biomes: each one is a small self-contained patch of the Forest Maths world (a ~26 m disc), described as PLAIN DATA so the same
// description can later drive real game regions (ground colours, relief, what grows there, who lives there, the weather it tends to have).
// Nothing here touches game state or saves. Model names are the game's own files in assets/models/.
//
// relief   : { style: 'rolling'|'river'|'lake'|'sea'|'slope'|'ridge'|'marsh', amp (m), k (noise detail) }
// ground   : colours (hex) a/b = grass (low/high), rock, shore (sand/mud), snow cover 0..1, dirt = worn ground by the camp
// scatter  : { m model, n count, s [min,max] scale, zone 'any'|'dry'|'shore'|'water'|'far'|'back', r spacing radius (0 = decoration), tint?: hex }
// character: { who, work: clip name or null, tool, face: 'water'|'view'|'fire'|'rock', pos: [x,z] }
import { MORE } from './biomes2.js';
const BASE = [
  { id: 'river', title: 'Greetings from the River Clearing', place: 'Home valley · first light', tod: 0.285, weather: { cloud: 0.25, fog: 0.35, rain: 0, wet: 0.1, wind: 0.2, snow: 0 }, seed: 11,
    idea: 'Where every game begins. Water first, then wood, stone, shelter, fire. The river is the first lesson in rates and ratios.',
    tags: ['Start of the game', 'Fishing', 'Ratio'],
    relief: { style: 'river', amp: 0.9, k: 1.2 }, ground: { a: 0x6f9a45, b: 0x8cb458, rock: 0x8a8578, shore: 0xb9a888, snow: 0, dirt: 0x8b7050 },
    scatter: [
      { m: 'tree_hero_broadleaf_01_mobile', n: 9, s: [0.55, 0.85], zone: 'dry', r: 1.6, far: 8 }, { m: 'Tree_44', n: 3, s: [0.8, 1.1], zone: 'dry', r: 1.6, far: 12 },
      { m: 'wildflower_clump', n: 26, s: [0.8, 1.6], zone: 'dry' }, { m: 'Flower_150', n: 14, s: [0.9, 1.4], zone: 'dry' }, { m: 'Flower_151', n: 12, s: [0.9, 1.4], zone: 'dry' },
      { m: 'fm_fern_clump', n: 10, s: [0.9, 1.3], zone: 'dry' }, { m: 'fm_bush_round', n: 5, s: [0.9, 1.3], zone: 'dry', r: 0.8, far: 6 },
      { m: 'fm_boulder_mossy_a', n: 3, s: [0.8, 1.3], zone: 'shore', r: 1.0 }, { m: 'fm_reeds_cattail_a', n: 7, s: [0.9, 1.4], zone: 'shore' }, { m: 'fm_reeds_cattail_b', n: 5, s: [0.9, 1.4], zone: 'shore' },
      { m: 'lily_pad_cluster', n: 4, s: [0.6, 1.0], zone: 'water' }, { m: 'fm_driftwood_pile', n: 1, s: [1, 1], zone: 'shore', r: 1.2 }, { m: 'fm_log_mossy_fallen_a', n: 1, s: [1, 1.1], zone: 'dry', r: 1.4, far: 5 },
      { m: 'mk_grass_tall', n: 64, s: [0.6, 1.0], zone: 'dry' }],
    animals: [{ m: 'fm_heron_forest', h: 0.95, zone: 'shore' }, { m: 'fm_red_squirrel_forest', h: 0.28, zone: 'tree' }],
    extras: { motes: 1 }, character: { who: 'boy-brown', work: 'fish_loop', rod: true, face: 'water', pos: [-1, 0] }, cam: { yaw: 0.9, pitch: 0.27, dist: 9.5 } },

  { id: 'coast', title: 'Greetings from Sunset Cove', place: 'The western coast · golden hour', tod: 0.69, weather: { cloud: 0.35, fog: 0.0, rain: 0, wet: 0, wind: 0.5, snow: 0 }, seed: 23,
    idea: 'Driftwood, shells and salt for shore-only finds. A tide table makes clocks and timetables matter: when is the beach safe to walk?',
    tags: ['Time and timetables', 'Shore finds', 'Calm evenings'],
    relief: { style: 'sea', amp: 0.7, k: 1.3 }, ground: { a: 0x5f8f48, b: 0x93a456, rock: 0x8d8678, shore: 0xe2cf9f, snow: 0, dirt: 0x9a8058 },
    scatter: [
      { m: 'tree_hero_broadleaf_01_mobile', n: 3, s: [0.55, 0.85], zone: 'dry', r: 2.0, far: 7, back: 1 },
      { m: 'fm_boulder_mossy_b', n: 9, s: [0.8, 1.8], zone: 'shore', r: 1.0 }, { m: 'fm_boulder_mossy_c', n: 3, s: [0.8, 1.3], zone: 'shore', r: 1.0 },
      { m: 'fm_driftwood_pile', n: 5, s: [0.9, 1.4], zone: 'shore', r: 1.0 }, { m: 'mk_grass_wispy', n: 96, s: [0.35, 0.6], zone: 'dry' }, { m: 'mk_clover', n: 18, s: [0.5, 0.8], zone: 'dry' },
      { m: 'wildflower_clump', n: 14, s: [0.8, 1.4], zone: 'dry' }, { m: 'fm_cairn', n: 1, s: [1, 1], zone: 'shore', r: 1.0 }, { m: 'fm_bush_low_spread', n: 6, s: [0.9, 1.4], zone: 'dry', r: 0.7 },
      { m: 'fm_rowing_boat', n: 1, s: [1, 1], zone: 'water', r: 2.0, y: 'water' }],
    animals: [{ m: 'fm_mallard_duck_forest', h: 0.36, zone: 'water' }, { m: 'fm_rabbit_forest', h: 0.34, zone: 'dry' }],
    extras: { motes: 1 }, character: { who: 'woman', work: 'gather2', face: 'shore', pos: [2, 1] }, cam: { yaw: -0.7, pitch: 0.27, dist: 9.5 } },

  { id: 'meadow', title: 'Greetings from Blossom Meadow', place: 'The eastern meadows · noon', tod: 0.5, weather: { cloud: 0.2, fog: 0, rain: 0, wet: 0, wind: 0.25, snow: 0 }, seed: 31,
    idea: 'Soft ground for foraging and garden plots. Berries, herb beds and bees to plan with area and perimeter.',
    tags: ['Foraging', 'Area and perimeter', 'Plants'],
    relief: { style: 'rolling', amp: 0.9, k: 1.0 }, ground: { a: 0x7fb050, b: 0x9bc462, rock: 0x948f80, shore: 0xb9a888, snow: 0, dirt: 0x8f7650 },
    scatter: [
      { m: 'fm_tree_blossom_spring', n: 6, s: [0.9, 1.3], zone: 'dry', r: 2.0, far: 7 }, { m: 'fm_berry_bush_full', n: 7, s: [1.1, 1.6], zone: 'dry', r: 0.8, far: 2.5 },
      { m: 'fm_shrub_flowering_rose', n: 4, s: [0.9, 1.3], zone: 'dry', r: 0.7, far: 5 }, { m: 'fm_shrub_flowering_elder', n: 3, s: [0.9, 1.3], zone: 'dry', r: 0.8, far: 6 },
      { m: 'mk_flower3', n: 40, s: [0.3, 0.5], zone: 'dry' }, { m: 'mk_flower4', n: 40, s: [0.25, 0.4], zone: 'dry' }, { m: 'Flower_150', n: 20, s: [1, 1.6], zone: 'dry' }, { m: 'Flower_151', n: 20, s: [1, 1.6], zone: 'dry' },
      { m: 'mk_grass_tall', n: 112, s: [0.6, 1.0], zone: 'dry' }, { m: 'mk_clover', n: 24, s: [0.5, 0.8], zone: 'dry' }, { m: 'fm_log_hollow', n: 1, s: [1, 1.1], zone: 'dry', r: 1.4, far: 5 }, { m: 'fm_mushroom_ring', n: 1, s: [1, 1], zone: 'dry', r: 1.0, far: 4 }],
    animals: [{ m: 'fm_rabbit_forest', h: 0.34, zone: 'dry' }, { m: 'fm_deer_forest', h: 1.8, zone: 'back' }],
    extras: { motes: 2, butterflies: 1 }, character: { who: 'boy-blonde', work: 'gather1', face: 'rock', pos: [0, 0], faceTo: 'berry' }, cam: { yaw: 0.35, pitch: 0.27, dist: 9.5 } },

  { id: 'lake', title: 'Greetings from Still Lake', place: 'The northern lake · morning', tod: 0.31, weather: { cloud: 0.35, fog: 0.5, rain: 0, wet: 0.2, wind: 0.05, snow: 0 }, seed: 41,
    idea: 'No current to worry about, so a good place to learn the rod. Fishing spots that rest after a miss, and jars to fill: capacity and volume.',
    tags: ['Fishing', 'Volume and capacity', 'Patience'],
    relief: { style: 'lake', amp: 0.8, k: 1.1 }, ground: { a: 0x769a4c, b: 0x93b25c, rock: 0x8c8a80, shore: 0xb3a381, snow: 0, dirt: 0x8a7050 },
    scatter: [
      { m: 'tree_hero_broadleaf_01_mobile', n: 4, s: [0.55, 0.85], zone: 'dry', r: 1.8, far: 9 }, { m: 'Tree_46', n: 3, s: [0.8, 1.1], zone: 'dry', r: 1.6, far: 11 },
      { m: 'fm_reeds_cattail_a', n: 10, s: [1, 1.5], zone: 'shore' }, { m: 'fm_reeds_cattail_c', n: 8, s: [1, 1.5], zone: 'shore' }, { m: 'lily_pad_cluster', n: 8, s: [0.6, 1.0], zone: 'water' },
      { m: 'dock_short', n: 1, s: [1.1, 1.1], zone: 'shore', r: 2.0, y: 'dock' }, { m: 'alp_Prop_Canoe_01', n: 1, s: [1, 1], zone: 'shore', r: 1.8 },
      { m: 'mk_grass_tall', n: 80, s: [0.6, 1.0], zone: 'dry' }, { m: 'wildflower_clump', n: 16, s: [0.8, 1.4], zone: 'dry' }, { m: 'fm_boulder_mossy_a', n: 3, s: [0.8, 1.2], zone: 'shore', r: 1.0 },
      { m: 'fm_fern_clump', n: 8, s: [0.9, 1.3], zone: 'dry' }],
    animals: [{ m: 'fm_heron_forest', h: 0.95, zone: 'shore' }, { m: 'fm_mallard_duck_forest', h: 0.36, zone: 'water' }, { m: 'fm_dragonfly_forest', h: 0.1, zone: 'shore', high: 0.9 }],
    extras: { motes: 1 }, character: { who: 'boy-brown', work: 'fish_loop', rod: true, face: 'water', pos: [1, 1] }, cam: { yaw: 2.6, pitch: 0.27, dist: 9.5 } },

  { id: 'hills', title: 'Greetings from the Windy Hills', place: 'The south-east hills · afternoon', tod: 0.62, weather: { cloud: 0.55, fog: 0, rain: 0, wet: 0, wind: 0.8, snow: 0 }, seed: 53,
    idea: 'Walking up is slow, walking down is quick, and a lookout cairn shows the whole watershed. Slopes and gradients are ratios you can feel.',
    tags: ['Gradients', 'Climbing', 'Viewpoints'],
    relief: { style: 'slope', amp: 1.4, k: 1.0, tilt: 0.28 }, ground: { a: 0x93a355, b: 0xb7b062, rock: 0x938c7c, shore: 0xb3a381, snow: 0, dirt: 0x907550 },
    scatter: [
      { m: 'fm_tree_autumn_a', n: 3, s: [0.55, 0.75], zone: 'dry', r: 2.0, far: 8 }, { m: 'fm_tree_autumn_b', n: 3, s: [0.55, 0.75], zone: 'dry', r: 2.0, far: 9 },
      { m: 'fm_standing_stone', n: 1, s: [1, 1], zone: 'dry', r: 1.5, far: 9, back: 1 }, { m: 'fm_cairn', n: 1, s: [1.2, 1.2], zone: 'dry', r: 1.0, far: 6, back: 1 },
      { m: 'fm_boulder_mossy_a', n: 5, s: [0.9, 1.6], zone: 'dry', r: 1.1, far: 5 }, { m: 'fm_boulder_mossy_c', n: 3, s: [0.9, 1.6], zone: 'dry', r: 1.1, far: 6 },
      { m: 'mk_grass_wispy', n: 144, s: [0.35, 0.6], zone: 'dry' }, { m: 'mk_grass_short', n: 64, s: [0.5, 0.8], zone: 'dry' }, { m: 'fm_bush_low_spread', n: 7, s: [0.9, 1.4], zone: 'dry', r: 0.7 },
      { m: 'fm_leaf_litter_patch_medium', n: 5, s: [1, 1.2], zone: 'dry' }, { m: 'wildflower_clump', n: 10, s: [0.8, 1.2], zone: 'dry' }],
    animals: [{ m: 'fm_fox_forest', h: 0.9, zone: 'back' }],
    extras: { motes: 1 }, character: { who: 'elf-ranger', work: null, face: 'view', pos: [0, 0] }, cam: { yaw: 0.4, pitch: 0.27, dist: 9.5 } },

  { id: 'moor', title: 'Greetings from the Moonlit Moor', place: 'The high moor · night', tod: 0.02, weather: { cloud: 0.15, fog: 0.1, rain: 0, wet: 0, wind: 0.15, snow: 0 }, seed: 67,
    idea: 'A quiet place to learn the night sky: bearings, angles, finding your way back by the fire and the stars.',
    tags: ['Bearings and angles', 'Night calm', 'Navigation'],
    relief: { style: 'rolling', amp: 1.5, k: 1.1 }, ground: { a: 0x5c6a4a, b: 0x7a6a86, rock: 0x7b7a76, shore: 0x8a8068, snow: 0, dirt: 0x6e5a40 },
    scatter: [
      { m: 'fm_boulder_mossy_a', n: 5, s: [0.9, 1.7], zone: 'dry', r: 1.1, far: 4 }, { m: 'fm_boulder_mossy_b', n: 4, s: [0.9, 1.7], zone: 'dry', r: 1.1, far: 5 },
      { m: 'fm_bush_low_spread', n: 22, s: [0.8, 1.5], zone: 'dry', r: 0.6, far: 2.5, tint: 0xa77fb4 }, { m: 'fm_fern_clump', n: 14, s: [0.8, 1.2], zone: 'dry', tint: 0xb095bd },
      { m: 'mk_grass_wispy', n: 112, s: [0.35, 0.6], zone: 'dry' }, { m: 'fm_standing_stone', n: 1, s: [1.1, 1.1], zone: 'dry', r: 1.4, far: 8, back: 1 },
      { m: 'fm_tent_aframe', n: 1, s: [1, 1], zone: 'dry', r: 2.0, at: [-4.2, -1.6], rot: 0.5 }, { m: 'fm_log_seat_short', n: 2, s: [1, 1], zone: 'dry', r: 0.6, at: [2.4, 1.4], rot: 0.4 },
      { m: 'fm_lantern_post', n: 1, s: [1, 1], zone: 'dry', r: 0.4, at: [-2.2, 2.2] }],
    animals: [{ m: 'fm_tawny_owl_forest', h: 0.37, zone: 'rock' }, { m: 'fm_rabbit_forest', h: 0.34, zone: 'dry' }],
    extras: { fire: [1.3, 2.4], fireflies: 70 }, character: { who: 'boy-blonde', work: null, face: 'fire', pos: [0, 0], lantern: true }, cam: { yaw: -0.5, pitch: 0.27, dist: 9.5 } },

  { id: 'snow', title: 'Greetings from the Snowline', place: 'The northern slopes · noon', tod: 0.5, weather: { cloud: 0.4, fog: 0.15, rain: 0, wet: 0, wind: 0.35, snow: 0.8 }, seed: 79,
    idea: 'Reading a thermometer below zero. Tracks in the snow, pine resin and a log shelter to explore. Always calm: nobody gets cold or hurt.',
    tags: ['Negative numbers', 'Tracks and clues', 'Shelter'],
    relief: { style: 'slope', amp: 0.9, k: 1.0, tilt: 0.12 }, ground: { a: 0xdfe8ee, b: 0xf1f5f8, rock: 0x8d8f94, shore: 0xcfd8de, snow: 1, dirt: 0xbfc6cc },
    scatter: [
      { m: 'fm_pine_a', n: 8, s: [0.5, 0.75], zone: 'dry', r: 1.5, far: 6 }, { m: 'fm_pine_b', n: 7, s: [0.5, 0.75], zone: 'dry', r: 1.5, far: 7 }, { m: 'fm_tree_winter_bare_a', n: 3, s: [0.45, 0.65], zone: 'dry', r: 1.6, far: 9 },
      { m: 'fm_boulder_snowcap_a', n: 3, s: [0.9, 1.5], zone: 'dry', r: 1.1, far: 5 }, { m: 'fm_boulder_snowcap_b', n: 3, s: [0.9, 1.5], zone: 'dry', r: 1.1, far: 6 },
      { m: 'fm_snowdrift_low_a', n: 6, s: [1,1.5], zone: 'dry', far: 3 }, { m: 'fm_snowdrift_low_b', n: 6, s: [1, 1.6], zone: 'dry', far: 3 }, { m: 'fm_fern_frosted', n: 8, s: [0.9, 1.3], zone: 'dry' }, { m: 'fm_bush_frosted', n: 6, s: [0.9, 1.3], zone: 'dry', r: 0.7 },
      { m: 'fm_log_mossy_fallen_a_snow', n: 1, s: [1.2, 1.2], zone: 'dry', r: 1.4, far: 4 }, { m: 'fm_tent_aframe_snow', n: 1, s: [1, 1], zone: 'dry', r: 2.0, at: [-4.4, -1.4], rot: 0.6 },
      { m: 'fm_barrel_snow', n: 1, s: [1, 1], zone: 'dry', r: 0.5, at: [-2.6, -2.6] }, { m: 'fm_crate_snow', n: 1, s: [1, 1], zone: 'dry', r: 0.5, at: [-3.2, -3.1], rot: 0.4 }, { m: 'fm_ice_patch_a', n: 2, s: [1, 1.4], zone: 'dry', far: 4 }],
    animals: [{ m: 'fm_fox_forest', h: 0.9, zone: 'back' }, { m: 'fm_tawny_owl_forest', h: 0.37, zone: 'tree' }],
    extras: { fire: [1.4, 2.2] }, character: { who: 'elf-ranger', work: null, face: 'fire', pos: [0, 0] }, cam: { yaw: 0.3, pitch: 0.27, dist: 9.5 } },

  { id: 'ridge', title: 'Greetings from Boulder Ridge', place: 'The high ridge · morning', tod: 0.33, weather: { cloud: 0.3, fog: 0.15, rain: 0, wet: 0, wind: 0.45, snow: 0 }, seed: 89,
    idea: 'Stone is everywhere up here: mining, tool making, and scale. How heavy is a stone axe head? How many of these fit in a cart?',
    tags: ['Mining', 'Units and scale', 'Tool making'],
    relief: { style: 'ridge', amp: 1.6, k: 1.3 }, ground: { a: 0x85925a, b: 0x9a9a68, rock: 0x8f8b84, shore: 0xa09a8a, snow: 0, dirt: 0x8a7656 },
    scatter: [
      { m: 'rock_boulder_bare_mobile', n: 1, s: [3.2, 3.2], zone: 'dry', r: 3.2, at: [-3.8, -3.2], rot: 0.5 }, { m: 'rock_spire_bare_mobile', n: 2, s: [1.4, 2.0], zone: 'dry', r: 1.2, far: 6 },
      { m: 'rock_slab_bare_mobile', n: 1, s: [1.4, 1.4], zone: 'dry', r: 2.0, far: 7 }, { m: 'fm_boulder_mossy_a', n: 5, s: [0.8, 1.5], zone: 'dry', r: 1.0, far: 3 }, { m: 'fm_boulder_mossy_c', n: 4, s: [0.8, 1.4], zone: 'dry', r: 1.0, far: 4 },
      { m: 'alp_Env_Pine_01', n: 3, s: [0.35, 0.5], zone: 'dry', r: 1.3, far: 9 }, { m: 'alp_Env_Pine_03', n: 2, s: [0.7, 1.0], zone: 'dry', r: 1.3, far: 10 },
      { m: 'wildflower_clump', n: 22, s: [0.9, 1.6], zone: 'dry' }, { m: 'mk_grass_wispy', n: 64, s: [0.35, 0.6], zone: 'dry' }, { m: 'alp_Env_Moss_Lumps_01', n: 5, s: [0.5, 0.8], zone: 'dry', far: 3 },
      { m: 'fm_waymarker_boulder', n: 1, s: [1, 1], zone: 'dry', r: 1.0, far: 6, back: 1 }, { m: 'fm_cairn', n: 1, s: [1, 1], zone: 'dry', r: 0.9, at: [4.2, 1.8] }],
    animals: [{ m: 'fm_fox_forest', h: 0.9, zone: 'back' }],
    extras: { motes: 1 }, character: { who: 'man', work: 'mine_wall', tool: 'pick', face: 'rock', pos: [-0.8, 0.2], faceAt: [-3.8, -3.2] }, cam: { yaw: 0.7, pitch: 0.27, dist: 9.5 } },

  { id: 'marsh', title: 'Greetings from Lantern Marsh', place: 'The south-west marsh · dusk', tod: 0.73, weather: { cloud: 0.4, fog: 0.3, rain: 0, wet: 0.6, wind: 0.1, snow: 0 }, seed: 97,
    idea: 'Stepping stones and a lantern path across the wetland. Patterns and sequences for crossing safely, and frogs, dragonflies and reeds to count.',
    tags: ['Sequences', 'Counting and sampling', 'Wetland life'],
    relief: { style: 'marsh', amp: 0.35, k: 1.4 }, ground: { a: 0x5f7a45, b: 0x728a4c, rock: 0x7d7a6c, shore: 0x6e6448, snow: 0, dirt: 0x5e5238 },
    scatter: [
      { m: 'swp_Env_Tree_Swamp_03', n: 3, s: [0.45, 0.65], zone: 'dry', r: 2.0, far: 8 }, { m: 'swp_Env_Tree_Mangrove_01', n: 2, s: [0.6, 0.8], zone: 'shore', r: 2.0, far: 8 },
      { m: 'swp_Env_Reeds_01', n: 12, s: [0.45, 0.8], zone: 'shore' }, { m: 'swp_Env_Reeds_02', n: 10, s: [0.45, 0.8], zone: 'shore' }, { m: 'swp_Env_Toetoe_01', n: 6, s: [0.5, 0.8], zone: 'dry' },
      { m: 'swp_Env_LillyPads_01', n: 8, s: [0.5, 0.8], zone: 'water' }, { m: 'swp_Env_MossMound_01', n: 5, s: [1, 1.6], zone: 'dry', r: 0.8, far: 3 }, { m: 'swp_Env_Bush_Bramble_01', n: 4, s: [1, 1.3], zone: 'dry', r: 0.8, far: 5 },
      { m: 'fm_stepping_stones_path5', n: 1, s: [1, 1], zone: 'any', r: 0.1, at: [1.8, 0.6], rot: 1.0 }, { m: 'swp_Prop_Swamp_Lantern_01', n: 3, s: [1, 1], zone: 'shore', r: 0.5 }, { m: 'fm_mud_patch_wet', n: 4, s: [1, 1.4], zone: 'dry' }],
    animals: [{ m: 'fm_common_frog_forest', h: 0.1, zone: 'shore' }, { m: 'fm_dragonfly_forest', h: 0.1, zone: 'shore', high: 1.0 }, { m: 'fm_heron_forest', h: 0.95, zone: 'shore' }],
    extras: { fireflies: 36, motes: 1 }, character: { who: 'girl', work: null, face: 'view', pos: [0, 0], lantern: true }, cam: { yaw: 0.5, pitch: 0.27, dist: 9.5 } },
];
export const BIOMES = [...BASE, ...MORE];
