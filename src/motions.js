// Hand-authored whole-body motions for the Sidekick character: fishing (draw the rod, cast, wait, strike, reel, lift, stow), mining, berry picking, hand-over-hand climbing.
// Authored as poses, not baked clips: each phase names a target angle triple [swing, twist, roll] per bone (radians, in the character's own left-right / up / forward frame, the same
// helpers the walk cycle uses) and the runner eases between them, with optional small looping offsets (breathing, bobbing, hauling). Phases can wait for the game ('hold'),
// emit events (take the rod off the back, release the line, the pick strikes), and lower the body (`drop`, metres at game scale) for kneeling and squatting.
// Pure data + a tiny runner, no three.js, so it is unit-tested in node. The character file supplies `apply(bone, s, t, r)`.
export const ease = { smooth: (u) => u * u * (3 - 2 * u), out: (u) => 1 - (1 - u) * (1 - u), in: (u) => u * u, lin: (u) => u, snap: (u) => 1 - Math.pow(1 - u, 4) };

/** Standing, relaxed: what the walk cycle leaves at rest. Every motion starts from this and returns to it. */
export const STANCE = { lowerarm_l: [0.18, 0, 0], lowerarm_r: [0.18, 0, 0], ik_r: [0.14, -0.58, -0.05, 0, 0], ik_l: [-0.14, -0.58, -0.05, 0, 0] };
// Conventions, measured on the Sidekick rig (tests: see tools_qa notes): arms and thighs swing + = forward; spine, neck and head swing + = BACK (negative leans forward / looks down);
// calf swing negative bends the knee; spine twist + = turns to the character's LEFT (the right shoulder comes forward); thigh roll + = the left leg out, the right leg in.
// Hands are placed with ik_r / ik_l = [r, u, f, phi, roll]: metres from that shoulder (r toward the character's RIGHT, u up, f forward; arm length = 0.62), phi = tilt of the held thing from vertical
// towards forward in degrees, roll = turn about its own axis. grip_r / grip_l = [0 open .. 1 fist].
export const GRIP = (c, side = 'r') => ({ ['grip_' + side]: [c, 0, 0] });

const P = (o) => o;   // readability: P({ bone: [swing, twist, roll] })
const LEG0 = { thigh_l: [0.04, 0, 0], thigh_r: [-0.02, 0, 0], calf_l: [-0.04, 0, 0], calf_r: [-0.04, 0, 0] }, STAG = { thigh_l: [0.3, 0, 0], calf_l: [-0.08, 0, 0], thigh_r: [-0.2, 0, 0], calf_r: [-0.14, 0, 0] }, STAG_S = { thigh_l: [0.16, 0, 0], calf_l: [-0.06, 0, 0], thigh_r: [-0.1, 0, 0], calf_r: [-0.1, 0, 0] };

/** FISHING. stand, reach over the shoulder for the rod, draw it, hold ready, wind back, cast, wait (loop, bobber floats) -> bite (hold) -> strike -> reel (loop) -> lift -> show -> stow. */
export const FISH = {
  id: 'fish', tool: 'rod',
  phases: [
    { id: 'settle', dur: 0.35, ease: 'smooth', pose: P({ ...LEG0, head: [-0.03, 0, 0] }) },
    { id: 'reach', dur: 0.55, ease: 'smooth', pose: P({ ik_r: [-0.04, 0.2, -0.24, -15, 0], ...GRIP(0.15), spine_02: [0.03, -0.22, 0], spine_03: [0.03, -0.14, 0], head: [0, -0.22, 0], ...STAG_S }) },
    { id: 'draw', dur: 0.55, ease: 'out', ev: [[0.0, 'rod-to-hand']], pose: P({ ik_r: [0.12, -0.1, 0.38, 52, 0], ...GRIP(0.85), spine_02: [-0.02, 0.06, 0], spine_03: [0, 0.04, 0], head: [-0.05, 0.04, 0], ...STAG_S }) },
    { id: 'ready', dur: 0.45, ease: 'smooth', pose: P({ ik_r: [0.12, -0.12, 0.4, 50, 0], ik_l: [0.26, -0.2, 0.42, 45, 0], ...GRIP(0.9), ...GRIP(0.5, 'l'), spine_02: [-0.04, -0.1, 0], head: [-0.1, 0.1, 0], ...STAG_S }) },
    { id: 'windup', dur: 0.5, ease: 'smooth', pose: P({ ik_r: [0.16, 0.26, -0.1, -38, 0], ik_l: [-0.34, -0.2, 0.22, 0, 0], ...GRIP(0.9), ...GRIP(0.1, 'l'), spine_02: [0.04, -0.4, 0], spine_03: [0.03, -0.25, 0], head: [-0.02, -0.15, 0], thigh_l: [0.2, 0, 0], calf_l: [-0.06, 0, 0], thigh_r: [-0.14, 0, 0], calf_r: [-0.14, 0, 0] }) },
    { id: 'cast', dur: 0.3, ease: 'snap', ev: [[0.55, 'release']], pose: P({ ik_r: [0.1, 0.16, 0.5, 72, 0], ik_l: [-0.3, -0.25, 0.3, 0, 0], spine_02: [-0.16, 0.34, 0], spine_03: [-0.1, 0.2, 0], head: [-0.08, 0.1, 0], ...STAG }) },
    { id: 'follow', dur: 0.5, ease: 'smooth', pose: P({ ik_r: [0.1, 0.0, 0.5, 52, 0], ik_l: [0.2, -0.24, 0.4, 40, 0], ...GRIP(0.9), ...GRIP(0.4, 'l'), spine_02: [-0.06, 0.1, 0], spine_03: [-0.03, 0.05, 0], head: [-0.1, 0.05, 0], ...STAG_S }) },
    { id: 'wait', dur: 1.2, ease: 'smooth', loop: true, wobble: { hz: 0.4, amp: { ik_r: [0, 0.008, 0, 1.5, 0], head: [0.015, 0.03, 0], spine_02: [0.01, 0, 0] } }, pose: P({ ik_r: [0.12, -0.1, 0.42, 50, 0], ik_l: [0.22, -0.26, 0.36, 40, 0], ...GRIP(0.85), ...GRIP(0.4, 'l'), spine_02: [-0.03, 0, 0], spine_03: [0, 0, 0], head: [-0.12, 0.02, 0], ...STAG_S }) },
    { id: 'bite', dur: 0.2, ease: 'snap', hold: true, pose: P({ ik_r: [0.12, -0.14, 0.42, 62, 0], head: [-0.18, 0, 0], spine_02: [-0.05, 0, 0] }) },
    { id: 'strike', dur: 0.22, ease: 'snap', pose: P({ ik_r: [0.1, 0.12, 0.16, 8, 0], ik_l: [0.2, -0.12, 0.28, 8, 0], spine_02: [0.1, 0, 0], spine_03: [0.05, 0, 0], head: [0.04, 0, 0], thigh_l: [0.2, 0, 0], thigh_r: [-0.2, 0, 0], calf_r: [-0.18, 0, 0] }) },
    { id: 'reel', dur: 0.8, ease: 'smooth', loop: true, wobble: { hz: 1.25, amp: { ik_l: [0.07, 0, 0, 0, 0] }, camp: { ik_l: [0, 0.08, 0, 0, 0], spine_02: [0, 0.03, 0] }, amp2: { spine_02: [0, 0, 0] } }, pose: P({ ik_r: [0.13, -0.12, 0.36, 38, 0], ik_l: [0.25, -0.3, 0.36, 38, 0], ...GRIP(0.85), ...GRIP(0.6, 'l'), spine_02: [-0.06, 0.04, 0], head: [-0.1, 0, 0], ...STAG }) },
    { id: 'lift', dur: 0.55, ease: 'out', ev: [[0.35, 'fish-up']], pose: P({ ik_r: [0.06, 0.34, 0.26, 12, 0], ik_l: [0.2, -0.16, 0.3, 12, 0], spine_02: [0.08, 0, 0], head: [0.02, 0, 0], ...STAG_S }) },
    { id: 'show', dur: 1.0, ease: 'smooth', pose: P({ ik_r: [0.12, 0.08, 0.4, 28, 0], ik_l: [0.14, 0.02, 0.48, 0, 0], spine_02: [0, 0.05, 0], head: [-0.06, 0, 0], ...STAG_S }) },
    { id: 'stow', dur: 0.8, ease: 'smooth', ev: [[0.45, 'rod-to-back']], pose: P({ ik_r: [-0.04, 0.2, -0.24, -15, 0], ik_l: [-0.14, -0.58, -0.05, 0, 0], ...GRIP(0.3), ...GRIP(0, 'l'), spine_02: [0.03, -0.22, 0], spine_03: [0.03, -0.14, 0], head: [0, -0.2, 0], ...STAG_S }) },
    { id: 'done', dur: 0.45, ease: 'smooth', pose: P({ ik_r: STANCE.ik_r, ik_l: STANCE.ik_l, ...GRIP(0), ...GRIP(0, 'l'), spine_02: [0, 0, 0], spine_03: [0, 0, 0], head: [0, 0, 0], ...LEG0 }) },
  ],
};

// Gap fillers around the baked fishing clips: taking the rod off the back, and putting it away. (The full hand-authored sequence above stays as 'fish_full' for comparison.)
const part = (id, ids) => ({ id, tool: 'rod', phases: ids.map(k => FISH.phases.find(p => p.id === k)) });
export const FISH_DRAW = part('fish_draw', ['settle', 'reach', 'draw']), FISH_STOW = part('fish_stow', ['stow', 'done']);
export const MOTIONS = { fish_full: FISH, fish_draw: FISH_DRAW, fish_stow: FISH_STOW };

/** Runs one motion. `apply(bone, ...values)` sets a bone's pose (up to five numbers); `after()` runs once all bones are set (hand placement); `emit(name)` and `drop(m)` are game hooks. Seconds. */
export function createRunner(def, { apply, after = () => {}, emit = () => {}, drop = () => {}, stance = STANCE } = {}) {
  const cur = {}, bones = new Set();
  for (const ph of def.phases) for (const b of Object.keys(ph.pose || {})) bones.add(b);
  for (const b of bones) cur[b] = (stance[b] || [0, 0, 0]).slice();
  let i = -1, t = 0, from = null, fired = new Set(), dropFrom = 0, curDrop = 0, finished = false, wait = false, clock = 0;
  const begin = (k) => { i = k; t = 0; wait = false; fired = new Set(); from = {}; for (const b of bones) from[b] = cur[b].slice(); dropFrom = curDrop; emit('phase:' + def.phases[k].id); };
  begin(0);
  const run = {
    get phase() { return i >= 0 && !finished ? def.phases[i].id : null; },
    get done() { return finished; },
    get waiting() { return wait; },
    /** Seconds into the current phase and its length (for effects that follow the motion, e.g. the bobber on the reel). */
    get progress() { const d = def.phases[Math.max(0, i)].dur; return { t, dur: d, u: d > 0 ? Math.min(1, t / d) : 1 }; },
    /** Jump to a named phase (used to leave the open-ended waiting / reeling phases). */
    go(id) { const k = def.phases.findIndex(p => p.id === id); if (k < 0) return false; finished = false; begin(k); return true; },
    tick(dt) {
      if (finished) return;
      const ph = def.phases[i]; t += dt; clock += dt;
      const u = ph.dur > 0 ? Math.min(1, t / ph.dur) : 1, e = (ease[ph.ease] || ease.smooth)(u);
      for (const b of bones) { const tgt = ph.pose && ph.pose[b], f = from[b]; if (!tgt) { cur[b] = f.slice(); continue; } cur[b] = f.map((v, k) => v + ((tgt[k] ?? v) - v) * e); }
      curDrop = dropFrom + ((ph.drop ?? dropFrom) - dropFrom) * e; drop(curDrop);
      for (const ev of ph.ev || []) if (!fired.has(ev[1]) && t >= ev[0] * ph.dur) { fired.add(ev[1]); emit(ev[1]); }
      const w = ph.wobble, sn = w ? Math.sin(clock * Math.PI * 2 * w.hz) : 0, cs = w ? Math.cos(clock * Math.PI * 2 * w.hz) : 0;
      for (const b of bones) { const v = cur[b].slice(); if (w) { const a = w.amp && w.amp[b], c = w.camp && w.camp[b]; if (a) for (let k = 0; k < a.length; k++) v[k] += a[k] * sn; if (c) for (let k = 0; k < c.length; k++) v[k] += c[k] * cs; } apply(b, ...v); }
      after();
      if (u >= 1) { if (ph.hold) { wait = true; } else if (ph.loop) { t = 0; fired = new Set(); wait = true; for (const b of bones) if (ph.pose && ph.pose[b]) from[b] = ph.pose[b].slice(); } else if (i + 1 < def.phases.length) begin(i + 1); else { finished = true; emit('done'); } }
    },
  };
  return run;
}
