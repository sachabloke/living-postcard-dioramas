// Body skills (Skyrim-style, use-based). DRAFT: see CONSTITUTION_AMENDMENT_SKILLS_DRAFT.md. Only Athletics exists so far.
// Rules: skills grow from doing the thing (running, sprinting, jumping, climbing); they never decay, nothing is ever taken away, there is no pressure or timer;
// a correct maths answer gives a short "focus" window of 1.5x use-xp (a thank-you, not a gate); the parent can switch skills off or cap the level shown (xp keeps counting);
// perks are small and only change how far you hop, how fast you run and how quickly you climb. Maths, rewards and saves are untouched (state.skills is a new optional field).
export const MAX_LEVEL = 20;
export const BODY_SKILLS = {
  athletics: { label: 'Athletics', icon: '🏃', blurb: 'Running, sprinting, jumping and climbing make your legs stronger and your climbs quicker.', perk: 'Each level: hop and sprint 0.5% stronger, climbs 1.2% quicker.' },
  woodcraft: { label: 'Woodcraft', icon: '🪓', blurb: 'Gathering wood from trees (after a correct answer) makes your chopping swing quicker.', perk: 'Each level: chopping swing 0.5% quicker. Yields never change.' },
  foraging: { label: 'Foraging', icon: '🌿', blurb: 'Noticing plants, naming them from their clues and gathering a little, carefully, builds your Foraging.', perk: 'No perk yet: proposed for the parent to choose. Yields never change.' },
  cooking: { label: 'Cooking', icon: '🍲', blurb: 'Preparing food you gathered builds your Cooking.', perk: 'No perk yet: proposed for the parent to choose. Nothing here gives health effects.' },
  stonework: { label: 'Stonework', icon: '⛏️', blurb: 'Gathering stone from rocks (after a correct answer) builds your Stonework.', perk: 'No perk yet: proposed for the parent to choose. Yields never change.' },
};
export const xpToNext = (level) => 40 + 20 * level;
/** Level, xp into it and xp still needed (0 at the top) from total xp. */
export function levelOf(xp) {
  let level = 1, left = Math.max(0, xp || 0);
  while (level < MAX_LEVEL && left >= xpToNext(level)) { left -= xpToNext(level); level++; }
  return { level, into: left, need: level >= MAX_LEVEL ? 0 : xpToNext(level) };
}
export const skillsOn = (state) => state?.settings?.skills !== false;
export const capOf = (state) => Math.max(1, Math.min(MAX_LEVEL, Math.floor(state?.settings?.skillCap ?? MAX_LEVEL)));
/** The level that counts in play: real level, but no higher than the parent's cap. */
export function shownLevel(state, id = 'athletics') { return Math.min(levelOf(state?.skills?.[id]?.xp).level, capOf(state)); }
export function perks(state) {
  if (!skillsOn(state)) return { jumpMul: 1, sprintMul: 1, climbMul: 1, chopMul: 1 };
  const k = shownLevel(state) - 1, w = shownLevel(state, 'woodcraft') - 1;
  return { jumpMul: 1 + 0.0053 * k, sprintMul: 1 + 0.0053 * k, climbMul: 1 - 0.012 * k, chopMul: 1 + 0.0053 * w };   // level 20: hop 10% stronger (about 21% higher), sprint 10% faster, climb 23% quicker
}
/** Add use-xp. Returns the new level when it went up, else null. Does nothing while skills are off. */
export function addXp(state, id, amount, now = Date.now()) {
  if (!skillsOn(state) || !(amount > 0)) return null;
  const sk = ((state.skills ||= {})[id] ||= { xp: 0 }), before = levelOf(sk.xp).level;
  sk.xp += amount * (state.skills.focusUntil > now ? 1.5 : 1);
  const after = levelOf(sk.xp).level; return after > before && after <= capOf(state) ? after : null;
}
/** A correct answer opens a 90 second focus window. */
export function noteCorrect(state, now = Date.now()) { if (skillsOn(state)) (state.skills ||= {}).focusUntil = now + 90000; }
/** Per-frame use tracking. `acc` is a plain object kept by the caller (not saved). Returns a new level or null. */
export function trackMove(state, acc, dt, speed, sprinting, onGround, now = Date.now()) {
  if (!onGround || speed < 0.5) return null;
  acc.m = (acc.m || 0) + speed * dt; const per = sprinting ? 15 : 40;
  if (acc.m >= per) { const n = Math.floor(acc.m / per); acc.m -= n * per; return addXp(state, 'athletics', n, now); }
  return null;
}
/** A jump counts only after real travel: at least 6 m from where the last counted jump happened, and 1.5 s apart. Jumping on the spot trains nothing. */
export function trackJump(state, acc, x, z, now = Date.now()) {
  if (now - (acc.lastJump || 0) < 1500) return null;
  if (acc.jx !== undefined && Math.hypot(x - acc.jx, z - acc.jz) < 6) return null;
  acc.lastJump = now; acc.jx = x; acc.jz = z; return addXp(state, 'athletics', 1, now);
}
/** A climb counts once per stone per 10 minutes, and at most 5 count per rolling minute. Repeating the same stone trains nothing. */
export function trackClimb(state, acc, id, now = Date.now()) {
  const seen = (acc.climbs ||= []).filter(c => now - c.t < 600000); acc.climbs = seen;
  if (seen.some(c => c.id === id) || seen.filter(c => now - c.t < 60000).length >= 5) return null;
  seen.push({ id, t: now }); return addXp(state, 'athletics', 6, now);
}
/** A real gather (a correct answer that gave resources) trains the matching skill once: trees -> Woodcraft, rocks -> Stonework. Nodes rest after three gathers, so this cannot be farmed. */
export function trackGather(state, kind, now = Date.now()) { const id = kind === 'tree' ? 'woodcraft' : kind === 'rock' ? 'stonework' : null; return id ? addXp(state, id, 3, now) : null; }
