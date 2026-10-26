// Foraging and Cooking (local trial). Pure module (no three.js): species, where each plant really grows, identification, bounded harvest, preparations.
// Source of truth for the content: outputs/forest-foraging-species (BRIEF.txt, SOURCES.txt, species.json). Quantities are abstract game portions.
// Rules: nothing here gives health, medicine, hunger or cold effects. A wrong answer takes nothing. Re-opening a card never gives xp.
// The game plants are stylised: the field note says so, and real gathering needs expert or adult guidance.
import { makeRng } from './rng.js';
import { addXp, skillsOn, shownLevel } from './skills.js';

export const FORAGE_VERSION = 1;
/** Placeholder models are marked until Grok's assets arrive (outputs/forest-foraging-assets/MANIFEST.json). */
export const SPECIES = {
  blackberry: { id: 'blackberry', name: 'Blackberry', sci: 'Rubus fruticosus agg.', part: 'ripe fruit', habitatText: 'sunny woodland edge and scrub', months: [7, 8, 9, 10],
    clues: ['arching prickly stems', 'compound toothed leaflets', 'dark aggregate fruit'], history: 'Saxon dietary remains; species aggregate, not named microspecies',
    yields: { item: 'blackberry', n: 2 }, glyph: '🫐', placeholder: true },
  wild_strawberry: { id: 'wild_strawberry', name: 'Wild strawberry', sci: 'Fragaria vesca', part: 'ripe fruit', habitatText: 'well-drained woodland edge and banks', months: [6, 7, 8],
    clues: ['low runner-forming plant', 'three toothed leaflets', 'small red externally seeded fruit'], history: 'Wild strawberry recognised in Saxon dietary records; no exact dish asserted',
    yields: { item: 'wild_strawberry', n: 2 }, glyph: '🍓', placeholder: true },
  hazelnut: { id: 'hazelnut', name: 'Hazel', sci: 'Corylus avellana', part: 'kernel after shelling', habitatText: 'woodland and scrub', months: [9, 10],
    clues: ['multi-stem shrub', 'rounded pointed double-toothed leaves', 'nuts in leafy husks'], history: 'Prehistoric and Saxon nut consumption; heat-processing interpretation supported',
    yields: { item: 'hazelnut_whole', n: 2 }, glyph: '🌰', placeholder: true },
  water_mint: { id: 'water_mint', name: 'Water mint', sci: 'Mentha aquatica', part: 'leaf', habitatText: 'freshwater margins and damp ground', months: [7, 8, 9, 10], flowerOnly: true,
    clues: ['opposite toothed oval leaves', 'square reddish stem', 'rounded lilac-pink flower head when flowering'], history: 'Exact species culinary use documented; Anglo-Saxon mint evidence is genus-level only',
    yields: { item: 'water_mint', n: 2 }, glyph: '🌿', placeholder: true },
};
export const EXTRA_CLUES = {"blackberry": ["often grows where woods meet open ground", "stems root where their tips touch the soil", "flowers are white to pink with five petals"], "wild_strawberry": ["sends thin runners along the ground", "flowers are white with five petals", "fruit hangs on a slender stalk"], "hazelnut": ["yellow catkins hang from bare twigs in late winter", "leaves feel soft and slightly hairy", "nuts grow in small clusters"], "water_mint": ["has a strong minty smell", "grows with its feet in wet ground", "flowers in rounded heads at the stem tips"]};   // unlocked by Cooking level 3, 6, 9 (one each): learning help, no game advantage
/** Species whose delivered model was inspected at close range and in the real game camera (25 Oct). The rest keep a 'being checked' badge until they are. */
export const GAME_CAMERA_CHECKED = ['blackberry', 'hazelnut'];
export const SPECIES_IDS = Object.keys(SPECIES);
export const ITEM_LABEL = { blackberry: 'blackberries', wild_strawberry: 'wild strawberries', hazelnut_whole: 'hazelnuts in shell', hazelnut: 'shelled hazelnuts', water_mint: 'water-mint leaves',
  toasted_hazelnuts: 'toasted hazelnuts', woodland_fruit_bowl: 'woodland fruit bowls', mint_infusion: 'mint infusions', pot: 'stone bowl', fetched_water: 'fetched water (not safe)', safe_water: 'boiled water' };
export const ITEM_GLYPH = { blackberry: '🫐', wild_strawberry: '🍓', hazelnut_whole: '🌰', hazelnut: '🌰', water_mint: '🌿', toasted_hazelnuts: '🥜', woodland_fruit_bowl: '🥣', mint_infusion: '🍵', pot: '🥣', fetched_water: '💧', safe_water: '♨️' };
/** Grok's delivered icons (assets/models/forage/icons). Items without one (water, bowl) keep their emoji. */
const ICON_FILE = { blackberry: 'ing_blackberry', wild_strawberry: 'ing_wild_strawberry', hazelnut: 'ing_hazelnut_kernel', hazelnut_whole: 'ing_hazelnut_in_shell', water_mint: 'ing_water_mint_sprig', toasted_hazelnuts: 'meal_toasted_hazelnuts', woodland_fruit_bowl: 'meal_woodland_fruit_bowl', mint_infusion: 'meal_mint_infusion', plant_blackberry: 'plant_blackberry', plant_wild_strawberry: 'plant_wild_strawberry', plant_hazelnut: 'plant_hazelnut', plant_water_mint: 'plant_water_mint' };
export const iconUrl = (key) => (ICON_FILE[key] ? `assets/models/forage/icons/${ICON_FILE[key]}.png` : null);
export const FIELD_NOTE = 'Field note: these game plants are stylised. Real gathering needs an expert or a grown-up who knows the plants. Never taste anything wild on your own.';

export const RECIPES = {
  shell_hazelnuts: { id: 'shell_hazelnuts', name: 'Shell hazelnuts', inputs: { hazelnut_whole: 2 }, output: { hazelnut: 2 }, needs: ['stone'], label: 'Separate shelling step. Cracking with a stone.', xp: 1, cook: false },
  toasted_hazelnuts: { id: 'toasted_hazelnuts', name: 'Toasted hazelnuts', inputs: { hazelnut: 2 }, output: { toasted_hazelnuts: 1 }, needs: ['fire'], identified: ['hazelnut'], label: 'Historically supported nut processing; game adaptation', xp: 4, cook: true },
  woodland_fruit_bowl: { id: 'woodland_fruit_bowl', name: 'Woodland fruit bowl', inputs: { blackberry: 2, wild_strawberry: 1, hazelnut: 1 }, output: { woodland_fruit_bowl: 1 }, needs: [], identified: ['blackberry', 'wild_strawberry', 'hazelnut'], label: 'Game combination of historically used foods; no exact period recipe claimed', xp: 5, cook: true },
  make_pot: { id: 'make_pot', name: 'Make a stone bowl', inputs: { stone: 4 }, output: { pot: 1 }, needs: [], once: true, label: 'Game vessel for boiling water; not a claim about period cookware', xp: 3, cook: true },
  fetch_water: { id: 'fetch_water', name: 'Fetch water', inputs: {}, output: { fetched_water: 1 }, needs: ['pot', 'freshwater'], label: 'River and lake water is never safe to drink as it is', xp: 0, cook: false, cap: { fetched_water: 1 } },
  boil_water: { id: 'boil_water', name: 'Boil water', inputs: { fetched_water: 1 }, output: { safe_water: 1 }, needs: ['pot', 'fire'], label: 'Boiling makes the game water safe', xp: 1, cook: true },
  mint_infusion: { id: 'mint_infusion', name: 'Mint infusion', inputs: { water_mint: 1, safe_water: 1 }, output: { mint_infusion: 1 }, needs: ['pot', 'fire'], identified: ['water_mint'], label: 'Traditional culinary herb preparation; exact early British recipe not established', xp: 5, cook: true },
};
export const RECIPE_ORDER = ['shell_hazelnuts', 'toasted_hazelnuts', 'woodland_fruit_bowl', 'make_pot', 'fetch_water', 'boil_water', 'mint_infusion'];

// ---------------------------------------------------------------- state
export function newForage() { return { v: FORAGE_VERSION, ident: {}, plants: {}, journal: [], made: {}, cookXp: {}, recent: [] }; }
export const forageOf = (state) => (state.forage ||= newForage());
const spOf = (state, id) => (forageOf(state).ident[id] ||= { plants: [], seen: [] });
/** A species is "known" (journal page filled in) once it was identified on 2 different plants. */
export const knownSpecies = (state, id) => (forageOf(state).ident[id]?.plants.length || 0) >= 2;
export const identifiedPlant = (state, speciesId, plantId) => !!forageOf(state).ident[speciesId]?.plants.includes(plantId);
export const identifiedAny = (state, speciesId) => (forageOf(state).ident[speciesId]?.plants.length || 0) >= 1;
const addJournal = (state, text) => { const j = forageOf(state).journal; if (!j.includes(text)) j.push(text); if (j.length > 80) j.shift(); };

/** Months from the game season (spring 4, summer 7, autumn 10, winter 1): the game calendar has seasons, not months. */
export const MONTH_OF_SEASON = { spring: 4, summer: 7, autumn: 10, winter: 1 };
export const inSeason = (sp, season) => sp.months.includes(MONTH_OF_SEASON[season] ?? 7);
export function seasonNote(sp, season) {
  const mo = sp.months, span = `months ${mo[0]}-${mo[mo.length - 1]}`;
  return inSeason(sp, season) ? `In season now (${span}).` : `Seasonal-specimen study: ${sp.name.toLowerCase()} is really ${sp.flowerOnly ? 'in flower' : 'ripe'} in ${span}; the game shows it out of season so you can still learn it.`;
}
export function inspect(state, plant) { const sp = SPECIES[plant.sp]; const rec = spOf(state, plant.sp); if (!rec.seen.includes(plant.id)) { rec.seen.push(plant.id); if (rec.seen.length > 40) rec.seen.shift(); } return { species: sp, clues: sp.clues }; }   // no xp, ever

// ---------------------------------------------------------------- identification task (trait based)
/** Four species names, one correct; the question lists the traits the player can see on the plant. Options are shuffled by `rng`. */
export function identQuestion(plant, rng = Math.random) {
  const sp = SPECIES[plant.sp], others = SPECIES_IDS.filter(i => i !== plant.sp).sort(() => rng() - 0.5).slice(0, 3);
  const opts = [plant.sp, ...others].sort(() => rng() - 0.5);
  return { prompt: `You notice: ${sp.clues.join('; ')}. Which plant is it?`, options: opts.map(i => ({ id: i, label: SPECIES[i].name, sci: SPECIES[i].sci })), answer: plant.sp };
}
/** Records one answer. A correct identification of a plant not yet recorded gives Foraging xp once; wrong answers cost nothing and can be retried at once. */
export function answerIdent(state, plant, choice, now = Date.now()) {
  const sp = SPECIES[plant.sp], rec = spOf(state, plant.sp);
  if (choice !== plant.sp) return { ok: false, message: `Not quite. Look at the clues again: ${sp.clues.join(', ')}. Nothing is lost.` };
  if (rec.plants.includes(plant.id)) return { ok: true, repeat: true, message: `You already recorded this ${sp.name.toLowerCase()}.` };
  rec.plants.push(plant.id); const known = rec.plants.length >= 2;
  addJournal(state, `${sp.name} (${sp.sci}): ${sp.clues.join(', ')}. Grows in ${sp.habitatText}. ${sp.history}.`);
  const lvl = addXp(state, 'foraging', known ? 6 : 4, now);
  return { ok: true, first: rec.plants.length === 1, known, level: lvl, message: known ? `${sp.name} added to your field notes.` : `That is ${sp.name.toLowerCase()}. Find one more to fill in the page.` };
}

// ---------------------------------------------------------------- harvest (the maths question is asked by the caller)
export const HARVESTS_PER_PLANT = 2, REGROW_SEC = 900, HARVEST_WINDOW_MS = 60000, HARVEST_WINDOW_MAX = 4;
/** `play` is the saved play-seconds clock; plants regrow after REGROW_SEC of play, so the clock can never run backwards. */
export function canHarvest(state, plant, play, now = Date.now()) {
  if (!identifiedPlant(state, plant.sp, plant.id)) return { ok: false, reason: 'Identify this plant first.' };
  const st = forageOf(state).plants[plant.id];
  if (st && st.regrowAt > play) return { ok: false, reason: `This ${SPECIES[plant.sp].name.toLowerCase()} has been picked and is growing back. Try another plant.` };
  const recent = forageOf(state).recent.filter(t => now - t < HARVEST_WINDOW_MS);
  if (recent.length >= HARVEST_WINDOW_MAX) return { ok: false, reason: 'Slow and steady. Rest a moment, then carry on.' };
  return { ok: true };
}
/** Called after a CORRECT maths answer. Gives the yield once, marks the plant, trains Foraging once. */
export function applyHarvest(state, plant, play, now = Date.now()) {
  const c = canHarvest(state, plant, play, now); if (!c.ok) return { ok: false, message: c.reason };
  const f = forageOf(state), sp = SPECIES[plant.sp], st = (f.plants[plant.id] ||= { n: 0, regrowAt: 0 }); st.n++;
  if (st.n >= HARVESTS_PER_PLANT) { st.n = 0; st.regrowAt = play + REGROW_SEC; }
  f.recent = f.recent.filter(t => now - t < HARVEST_WINDOW_MS); f.recent.push(now);
  const y = sp.yields; state.inv[y.item] = (state.inv[y.item] || 0) + y.n;
  return { ok: true, item: y.item, n: y.n, level: addXp(state, 'foraging', 3, now), message: `+${y.n} ${ITEM_LABEL[y.item]}` };
}
export const plantResting = (state, plantId, play) => (forageOf(state).plants[plantId]?.regrowAt || 0) > play;

// ---------------------------------------------------------------- preparations
/** env: { fire: bool (a lit fire close by), freshwater: bool (standing at a river or lake edge) }. */
export function canMake(state, id, env = {}) {
  const r = RECIPES[id]; if (!r) return { ok: false, reason: 'Unknown recipe.' };
  const inv = state.inv || {};
  for (const sid of r.identified || []) if (!identifiedAny(state, sid)) return { ok: false, reason: `Identify ${SPECIES[sid].name.toLowerCase()} first.` };
  if (r.needs.includes('pot') && !(inv.pot > 0)) return { ok: false, reason: 'Needs a stone bowl (a vessel). Make one from 4 stone.' };
  if (r.needs.includes('fire') && !env.fire) return { ok: false, reason: 'Stand next to a lit fire.' };
  if (r.needs.includes('freshwater') && !env.freshwater) return { ok: false, reason: 'Stand at the edge of a river or lake.' };
  if (r.needs.includes('stone') && !((inv.stone || 0) >= 1)) return { ok: false, reason: 'Needs a stone to crack the shells (it is not used up).' };
  if (r.once && inv.pot > 0) return { ok: false, reason: 'You already have a stone bowl.' };
  for (const [k, v] of Object.entries(r.inputs)) if (!((inv[k] || 0) >= v)) return { ok: false, reason: `Needs ${v} ${ITEM_LABEL[k] || k}, you have ${inv[k] || 0}.` };
  for (const [k, v] of Object.entries(r.cap || {})) if ((inv[k] || 0) >= v) return { ok: false, reason: 'You already carry water.' };
  return { ok: true };
}
/** Atomic: checks, takes inputs, gives outputs, records the meal. Cooking xp is limited: at most once per recipe per 5 minutes of play (play = seconds clock). */
export function make(state, id, env, play = 0, now = Date.now()) {
  const c = canMake(state, id, env); if (!c.ok) return { ok: false, message: c.reason };
  const r = RECIPES[id], inv = state.inv, f = forageOf(state);
  for (const [k, v] of Object.entries(r.inputs)) inv[k] -= v;
  for (const [k, v] of Object.entries(r.output)) inv[k] = (inv[k] || 0) + v;
  f.made[id] = (f.made[id] || 0) + 1;
  let level = null; const last = f.cookXp[id]; if (r.xp > 0 && (last === undefined || play - last >= 300)) { f.cookXp[id] = play; level = addXp(state, r.cook ? 'cooking' : 'foraging', r.xp, now); }
  if (id === 'toasted_hazelnuts' || id === 'woodland_fruit_bowl' || id === 'mint_infusion') addJournal(state, `${r.name}: ${r.label}.`);
  return { ok: true, level, message: `${r.name} made.` };
}

// ---------------------------------------------------------------- where plants really grow
/** Habitat weight 0..1 for a species from sampled terrain facts: env = { h, depth, slope, wetNear (distance in m to the nearest water, capped), biome }. */
export function habitat(id, e) {
  if (e.depth > 0.25) return 0;                                  // nothing here grows in deep water
  const dry = e.wetNear >= 2.5, b = e.biome;
  switch (id) {
    case 'blackberry': return !dry || e.h > 350 || e.slope > 0.4 ? 0 : (b === 'meadow' ? 0.9 : b === 'woodland' ? 0.6 : 0.1);        // sunny edges and scrub
    case 'wild_strawberry': return !dry || e.h > 450 || e.slope > 0.55 || e.slope < 0.06 ? 0 : (b === 'meadow' ? 0.8 : b === 'woodland' ? 0.7 : 0.15);   // well-drained banks
    case 'hazelnut': return !dry || e.h > 400 || e.slope > 0.6 ? 0 : (b === 'woodland' ? 1 : b === 'meadow' ? 0.3 : 0.1);
    case 'water_mint': return e.wetNear <= 5 && e.slope < 0.5 && e.h < 450 ? 1 : 0;           // freshwater margins and damp ground only
    default: return 0;
  }
}
/** Plants in one square cell (default 32 m), a pure function of (cx, cz, world seed) and the sampler `env(x,z)`. Same cell always gives the same plants. */
export function plantsInCell(cx, cz, env, cell = 32, seed = 61) {
  const rng = makeRng((Math.imul(cx + 5000, 73856093) ^ Math.imul(cz + 5000, 19349663) ^ Math.imul(seed, 83492791)) >>> 0), out = [];
  for (const id of SPECIES_IDS) {
    let placed = 0; const want = id === 'water_mint' ? 3 : 2;
    for (let k = 0; k < 14 && placed < want; k++) {
      const x = (cx + rng()) * cell, z = (cz + rng()) * cell, rot = rng() * 6.283, roll = rng(), e = env(x, z), w = habitat(id, e);
      if (w > 0 && roll < w * 0.6) { out.push({ id: `${id}:${cx},${cz}:${placed}`, sp: id, x, z, y: e.h, rot, scale: 0.9 + rng() * 0.3 }); placed++; }
    }
  }
  return out;
}
export const plantAt = (plants, x, z, reach = 2) => { let best = null, bd = reach; for (const p of plants) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best; };
/** The sampler plantsInCell needs, built from the game's one terrain source: groundAt, depthAt, slopeAt and biomeAt. wetNear is the distance (capped at 12 m) to the nearest water. */
export function makeEnv({ groundAt, depthAt, slopeAt, biomeAt }) {
  return (x, z) => {
    const depth = depthAt(x, z); let wetNear = depth > 0 ? 0 : 12;
    if (depth <= 0) for (const r of [2, 4, 6, 9, 12]) { let hit = false; for (let a = 0; a < 6.283; a += 0.785) if (depthAt(x + Math.cos(a) * r, z + Math.sin(a) * r) > 0) { hit = true; break; } if (hit) { wetNear = r; break; } }
    return { h: groundAt(x, z), depth, slope: slopeAt(x, z), wetNear, biome: biomeAt(x, z) };
  };
}

// ---------------------------------------------------------------- eating: small, clearly non-medical game perks (parent skills switch turns them off)
export const FED_SEC = 300, FED_MOVE = 1.03;
export const MEALS = { toasted_hazelnuts: { name: 'toasted hazelnuts', taste: 'Warm, nutty and a little crunchy.' }, woodland_fruit_bowl: { name: 'woodland fruit bowl', taste: 'Sweet and tart, all at once.' }, mint_infusion: { name: 'mint infusion', taste: 'Warm and fresh-smelling.' } };
export const fedLeft = (state, play) => Math.max(0, (forageOf(state).fedUntil || 0) - play);
/** Walk, sprint and jump 3% stronger and climbs 3% quicker for 5 minutes of play after any meal (game effect only; refreshes, never stacks). Neutral when skills are off. */
export const fedPerk = (state, play) => (skillsOn(state) && fedLeft(state, play) > 0 ? { move: FED_MOVE, climb: 1 / FED_MOVE } : { move: 1, climb: 1 });
export function extraClues(state, id) { const n = Math.floor(shownLevel(state, 'cooking') / 3); return EXTRA_CLUES[id].slice(0, Math.min(3, n)); }
export function eat(state, id, play) {
  const m = MEALS[id], inv = state.inv; if (!m) return { ok: false, message: 'That cannot be eaten.' };
  if (!(inv[id] > 0)) return { ok: false, message: `You have no ${m.name}.` };
  inv[id] -= 1; const f = forageOf(state), first = !(f.eaten ||= {})[id]; f.eaten[id] = (f.eaten[id] || 0) + 1; f.fedUntil = play + FED_SEC;
  if (first) addJournal(state, `First ${m.name} eaten. ${m.taste}`);
  return { ok: true, first, message: `${m.taste} ${skillsOn(state) ? 'A little spring in your step for a few minutes (game effect).' : ''}`.trim() };
}
