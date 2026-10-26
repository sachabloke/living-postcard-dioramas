// Synty Sidekick characters (SyntyPass licence; see PROVENANCE.md): modular parts assembled in Blender (assemble_sidekick.py),
// posed and animated here with simple procedural bone motion (walk / run / idle / a little hammer swing).
import { MOTIONS, createRunner } from './motions.js';
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';

export const SIDEKICK_PRESETS = {
  'boy-blonde': { label: 'Blonde boy · age 12', file: 'sk-boy-blonde', height: 1.50 },
  'boy-brown': { label: 'Brown-haired boy · age 12', file: 'sk-boy-brown', height: 1.50 },
  'elf-ranger': { label: 'Forest ranger (elf)', file: 'sk-elf-ranger', height: 1.55 },
  girl: { label: 'Girl · age 12', file: 'sk-girl', height: 1.48, gait: 'femn' },
  woman: { label: 'Adult woman', file: 'sk-woman', height: 1.66, gait: 'femn' },
  man: { label: 'Adult man', file: 'sk-man', height: 1.76 },
};
const X = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0);

export async function loadSidekick(who = 'boy-blonde', base = './assets/models/sidekick/') {
  const preset = SIDEKICK_PRESETS[who] || SIDEKICK_PRESETS['boy-blonde'];
  const gltf = await new GLTFLoader().loadAsync(`${base}${preset.file}.glb?v=sk1`);
  return { root: gltf.scene, preset };
}

/** Crafting clips (mine, gather, hammer, fish...) retargeted onto the Sidekick skeleton by tools_retarget_crafting.py. Optional: the avatar still walks without them. */
export async function loadSidekickAnims(base = './assets/models/sidekick/', who = 'boy-blonde') {
  const femn = (SIDEKICK_PRESETS[who] || {}).gait === 'femn';
  try {
    const clips = (await new GLTFLoader().loadAsync(`${base}anims.glb?v=sk3`)).animations.filter(c => !c.name.includes('|'));    // our named clips only, not the source rig's leftovers
    for (const c of clips) c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'pelvis.position');      // rotations (+ hips movement); never scale or other bones' positions
    try {   // real walk / run / sprint / idle (Synty Base Locomotion, Sidekick rig), prefixed so they never clash with crafting clips
      for (const c of (await new GLTFLoader().loadAsync(`${base}${femn ? 'loco_femn' : 'loco'}.glb?v=lc2`)).animations.filter(c => !c.name.includes('|'))) { c.name = 'loco_' + c.name; c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'pelvis.position'); clips.push(c); }
    } catch (e) { console.warn('locomotion clips unavailable, using the procedural walk', e); }
    try {   // parent-approved Quaternius TreeChopping_Loop motion baked onto the Sidekick skeleton (tools_bake_chop.py)
      for (const c of (await new GLTFLoader().loadAsync(`${base}chop.glb?v=ch3`)).animations.filter(c => c.name === 'chop_approved')) { c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'pelvis.position'); clips.push(c); }
    } catch (e) { console.warn('approved chop unavailable, using the procedural swing', e); }
    return clips;
  } catch (e) { console.warn('crafting animations unavailable', e); return null; }
}
/** Every other baked Synty Sidekick clip (jump, fall, land, turns, crouch, strafes, slopes, stand-to-run...). Loaded on demand by the animation review tool only. */
export async function loadSidekickExtraAnims(base = './assets/models/sidekick/', who = 'boy-blonde') {
  const femn = (SIDEKICK_PRESETS[who] || {}).gait === 'femn';
  const clips = (await new GLTFLoader().loadAsync(`${base}${femn ? 'loco_femn' : 'loco'}_extra.glb?v=lc2`)).animations.filter(c => !c.name.includes('|'));
  try { clips.push(...(await new GLTFLoader().loadAsync(`${base}anims_basic.glb?v=lc2`)).animations.filter(c => c.name.startsWith('basic_'))); } catch (e) { console.warn('Human Basic Motions clips unavailable', e); }
  for (const c of clips) { c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'pelvis.position'); c.name = 'rev_' + c.name; }
  return clips;
}
/** The two clips a jump needs: a mid-air tuck and a soft landing. Small; loaded in the background after the game starts. */
export async function loadSidekickAirAnims(base = './assets/models/sidekick/', who = 'boy-blonde') {
  const femn = (SIDEKICK_PRESETS[who] || {}).gait === 'femn';
  const clips = (await new GLTFLoader().loadAsync(`${base}${femn ? 'loco_femn' : 'loco'}_air.glb?v=air1`)).animations.filter(c => c.name === 'fall' || c.name === 'land');
  for (const c of clips) { c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion')); c.name = 'air_' + c.name; }   // the physics owns height, so no pelvis position
  return clips;
}
/** The climb-up clip (Quaternius UAL2 ClimbUp_1m, baked by tools_bake_climb.py). The game carries the root, so rotations plus the pelvis' own motion only. */
export async function loadSidekickClimbAnims(base = './assets/models/sidekick/') {
  const clips = (await new GLTFLoader().loadAsync(`${base}climb.glb?v=cl1`)).animations.filter(c => c.name === 'climb_up');
  for (const c of clips) c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'pelvis.position');
  return clips;
}
const SKIP_BONE = /Attach|^ik_|^neutral_bone|^root\.|^prop_|eyeLight/;   // helper bones the standing clips never drive; driving them lifts the hair and props off the head
/** Synty crouch idle + crouch walk (trimmed from the extra library by tools_trim_crouch.py). Rotations only; the game owns movement. */
export async function loadSidekickCrouchAnims(base = './assets/models/sidekick/', who = 'boy-blonde') {
  const femn = (SIDEKICK_PRESETS[who] || {}).gait === 'femn';
  const clips = (await new GLTFLoader().loadAsync(`${base}${femn ? 'crouch_femn' : 'crouch'}.glb?v=cr4`)).animations.filter(c => c.name === 'crouch_idle' || c.name === 'crouch_walk');
  for (const c of clips) c.tracks = c.tracks.filter(t => (t.name.endsWith('.quaternion') && !SKIP_BONE.test(t.name)) || t.name === 'pelvis.position');
  return clips;
}
/** Synty slope gaits (walk/run/sprint up and down 25 degrees) and the medium / hard landings (trimmed by tools_trim_crouch.py). Rotations only. */
export async function loadSidekickMoveAnims(base = './assets/models/sidekick/', who = 'boy-blonde') {
  const femn = (SIDEKICK_PRESETS[who] || {}).gait === 'femn';
  const clips = (await new GLTFLoader().loadAsync(`${base}${femn ? 'moves_femn' : 'moves'}.glb?v=mv2`)).animations.filter(c => c.name.startsWith('m_'));
  for (const c of clips) c.tracks = c.tracks.filter(t => t.name.endsWith('.quaternion') && !SKIP_BONE.test(t.name));
  return clips;
}
/** Simple Neolithic hand tools built from primitives (no models): hafted stone axe, red-deer antler pick, digging stick. Length along +Y. */
function makeTool(kind) {
  const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), stone = new THREE.MeshLambertMaterial({ color: 0x8d8a84 }), bone = new THREE.MeshLambertMaterial({ color: 0xd8cdb4 });
  const rod = (len, r, mat, y = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 8), mat); m.position.y = y; return m; };
  if (kind === 'rod') { g.add(rod(1.7, 0.014, wood, 0.5)); const line = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.9, 4), new THREE.MeshLambertMaterial({ color: 0xe8e4d0 })); line.position.set(0, 1.3, 0); g.add(line); }
  if (kind === 'axe') { g.add(rod(0.62, 0.018, wood, 0.0)); const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.085), stone); head.position.set(0, 0.28, 0.02); head.rotation.x = 0.12; g.add(head); }
  else if (kind === 'pick') { g.add(rod(0.6, 0.02, bone, 0)); const tine = rod(0.2, 0.014, bone, 0); tine.position.set(0, 0.22, 0.07); tine.rotation.x = -0.9; g.add(tine); const bro = rod(0.12, 0.012, bone, 0); bro.position.set(0, -0.2, 0.04); bro.rotation.x = -0.7; g.add(bro); }
  else if (kind === 'stick') { g.add(rod(0.8, 0.017, wood, 0)); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}

export function makeSidekickAvatar(data, targetHeight = data.preset.height, anims = null) {
  const root = data.root; root.updateMatrixWorld(true);
  const bone = (n) => root.getObjectByName(n);
  const meshes = []; root.traverse(o => { if (o.isMesh) { meshes.push(o); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; for (const mt of [].concat(o.material)) mt.side = THREE.FrontSide; } });
  // polish v1: vertices weighted to neutral_bone (hair strands) have a bind pose that does not match that helper bone and stretch into black spikes; carry them on the head instead
  for (const o of meshes) if (o.isSkinnedMesh) { const nbi = o.skeleton.bones.findIndex(b => b.name === 'neutral_bone'), hi = o.skeleton.bones.findIndex(b => b.name === 'head'); if (nbi < 0 || hi < 0) continue; const si = o.geometry.attributes.skinIndex; for (let i = 0; i < si.count; i++) for (let c = 0; c < 4; c++) if (si.getComponent(i, c) === nbi) si.setComponent(i, c, hi); si.needsUpdate = true; }
  // 1) arms down: aim each upper arm from the T-pose toward the ground (rotation applied in the bone's parent space)
  const aim = (upper, lower, dir) => {
    const u = bone(upper), l = bone(lower); if (!u || !l) return;
    const a = u.getWorldPosition(new THREE.Vector3()), b = l.getWorldPosition(new THREE.Vector3()), cur = b.sub(a).normalize();
    const dq = new THREE.Quaternion().setFromUnitVectors(cur, dir.clone().normalize());
    const pq = u.parent.getWorldQuaternion(new THREE.Quaternion()), wq = u.getWorldQuaternion(new THREE.Quaternion());
    u.quaternion.copy(pq.clone().invert().multiply(dq).multiply(wq)); root.updateMatrixWorld(true);
  };
  const side = (bone('upperarm_l').getWorldPosition(new THREE.Vector3()).x > 0) ? 1 : -1;   // which world side is "_l"
  aim('upperarm_l', 'lowerarm_l', new THREE.Vector3(side * 0.16, -1, 0.04)); aim('upperarm_r', 'lowerarm_r', new THREE.Vector3(-side * 0.16, -1, 0.04));
  root.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(root, true), scale = targetHeight / (bounds.max.y - bounds.min.y);
  const avatar = new THREE.Group(), inner = new THREE.Group(), anchor = new THREE.Group();
  inner.scale.setScalar(scale); anchor.position.set(-(bounds.min.x + bounds.max.x) / 2, -bounds.min.y, -(bounds.min.z + bounds.max.z) / 2); anchor.add(root); inner.add(anchor); avatar.add(inner);

  // 2) rest pose + lateral axis in each bone's local frame, so swings are about the character's left-right axis
  const rig = {}; const rootInv = new THREE.Quaternion();
  const relQ = (b) => { const q = new THREE.Quaternion(); for (let o = b; o && o !== root; o = o.parent) q.premultiply(o.quaternion); return q; };   // bone orientation relative to root
  for (const n of ['thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head', 'pelvis', 'clavicle_l', 'clavicle_r', 'hand_l', 'hand_r', ...['l', 'r'].flatMap(sd => ['index', 'middle', 'ring', 'pinky', 'thumb'].flatMap(f => [1, 2, 3].map(k => `${f}_0${k}_${sd}`)))]) {
    const b = bone(n); if (!b) continue; const inv = relQ(b).invert(); rig[n] = { b, rest: b.quaternion.clone(), axis: X.clone().applyQuaternion(inv).normalize(), up: UP.clone().applyQuaternion(inv).normalize(), fwd: new THREE.Vector3(0, 0, 1).applyQuaternion(inv).normalize() };
  }
  const tmp = new THREE.Quaternion();
  const swing = (n, ang) => { const r = rig[n]; if (r) r.b.quaternion.copy(r.rest).multiply(tmp.setFromAxisAngle(r.axis, -ang)); };   // +ang = forward
  const twist = (n, ang) => { const r = rig[n]; if (r) r.b.quaternion.multiply(tmp.setFromAxisAngle(r.up, ang)); };   // about the vertical axis (after swing)
  const roll = (n, ang) => { const r = rig[n]; if (r) r.b.quaternion.multiply(tmp.setFromAxisAngle(r.fwd, ang)); };    // sideways lean
  const baseY = anchor.position.y; let phase = 0, hammer = 0, act = 0;
  // Gait from typical walking curves (fractions of one stride): hip flexed at heel strike and extending through stance; knee bends a little on
  // loading and a lot to swing the leg through; the foot rolls heel-to-toe; each arm swings opposite its leg with the elbow bending as it comes forward.
  const bump = (f, mu, w) => { let d = Math.abs(f - mu); d = Math.min(d, 1 - d); return Math.exp(-(d * d) / (2 * w * w)); };
  const leg = (side, f, k, run) => {
    const hip = (0.12 + 0.26 * Math.cos(2 * Math.PI * f)) * (1 + 0.9 * run), knee = (0.06 + 0.2 * bump(f, 0.13, 0.06) + (0.95 + 0.7 * run) * bump(f, 0.72, 0.1)) * 1;
    const foot = 0.1 * bump(f, 0.02, 0.05) - 0.5 * bump(f, 0.62, 0.07) + 0.15 * bump(f, 0.85, 0.08);
    swing('thigh_' + side, hip * k); swing('calf_' + side, -knee * k); swing('foot_' + side, foot * k);
  };
  // Crafting clips: while one plays the procedural walk is paused; afterwards every bone returns to its resting pose.
  const bones = []; root.traverse(o => { if (o.isBone) bones.push([o, o.position.clone(), o.quaternion.clone()]); });
  let mixer = null, work = null, tool = null; const hand = bone('prop_r');
  const endWork = () => { if (!work) return; const w = work; work = null; w.a && w.a.stop(); anchor.position.y = baseY; for (const [b, p, q] of bones) { b.position.copy(p); b.quaternion.copy(q); } if (tool) tool.visible = false; w.onDone && w.onDone(); };
  /** name: a clip from anims.glb; opts: { loop, speed, tool: 'axe'|'pick'|'stick', onDone }. Returns false when the clip is unavailable. */
  avatar.userData.playWork = (name, opts = {}) => {
    if (name === 'chop' && anims && anims.some(c => c.name === 'chop_approved')) { name = 'chop_approved'; opts = { speed: 0.75, ...opts }; }   // approved motion; the procedural STRIKES.chop stays as the fallback
    if (STRIKES[name]) { endWork(); if (tool) { tool.parent && tool.parent.remove(tool); tool = null; } if (opts.tool && hand) { tool = makeTool(opts.tool); const ws = hand.getWorldScale(new THREE.Vector3()).x || 1; tool.scale.setScalar(1 / ws / (avatar.userData.toolScale || 1)); hand.add(tool); } work = { proc: STRIKES[name], t: 0, dur: STRIKES[name].period / (opts.speed || 1), loop: !!opts.loop, onDone: opts.onDone, speed: opts.speed || 1 }; return true; }
    let clip = anims && anims.find(c => c.name === name); if (!clip) return false; if (!clip.__polished) { clip = clip.clone(); clip.tracks = clip.tracks.filter(t => !/^(\w+Attach\w*|neutral_bone|eyeLight_[lr])\./.test(t.name) && !t.name.endsWith('.scale') && (t.name.endsWith('.quaternion') || t.name === 'pelvis.position')); clip.__polished = true; anims[anims.findIndex(c => c.name === name)] = clip; } /* polish v1: Attach helper bones carry the hair; the clips stretched them into black spikes */  const prev = opts.fade && work && work.a ? work : null; if (prev) work = null; else endWork();   // fade: cross-fade from the clip that is playing, no pop through the rest pose
    mixer ||= new THREE.AnimationMixer(root); const a = mixer.clipAction(clip); a.reset(); a.setLoop(opts.loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = true; a.timeScale = opts.speed || 1; a.play(); if (prev) { a.crossFadeFrom(prev.a, opts.fade, false); setTimeout(() => prev.a.stop(), opts.fade * 1000 + 60); }
    if (tool) { tool.parent && tool.parent.remove(tool); tool = null; }
    if (opts.tool === 'axe' && clip.name === 'chop_approved' && handB) { tool = makePalmAxe(); handB.add(tool); }
    else if (opts.tool && hand) { tool = makeTool(opts.tool); const ws = hand.getWorldScale(new THREE.Vector3()).x || 1; tool.scale.setScalar(1 / ws / (avatar.userData.toolScale || 1)); tool.rotation.set(...(avatar.userData.toolRot || [0, 0, 0])); hand.add(tool); }
    work = { a, t: 0, dur: clip.duration / (opts.speed || 1), loop: !!opts.loop, onDone: opts.onDone }; return true;
  };
  // Held props (developer review of Grok's tool models): attach any Object3D to the right / left hand bone, rotation in degrees, until replaced or cleared with null.
  const held = { r: null, l: null };
  avatar.userData.holdProp = (obj, side = 'r', rotDeg = [90, 0, 0], pos = [0, 0, 0]) => {
    const b = bone(side === 'l' ? 'prop_l' : 'prop_r'); if (!b) return false;
    if (held[side]) { held[side].parent && held[side].parent.remove(held[side]); held[side] = null; }
    if (!obj) return true;
    const ws = b.getWorldScale(new THREE.Vector3()).x || 1, w = new THREE.Group(); w.add(obj); w.scale.setScalar(1 / ws / (avatar.userData.toolScale || 1));
    w.rotation.set(...rotDeg.map(d => d * Math.PI / 180)); w.position.set(...pos); w.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } }); b.add(w); held[side] = w; return true;
  };
  // Hand-authored whole-body motions (src/motions.js): poses eased by a small runner. `hook(eventName, runner)` receives the motion's events (rod to hand, release, ...).
  const curl = (sd, c) => { for (const f of ['index', 'middle', 'ring', 'pinky']) { swing(`${f}_01_${sd}`, 1.0 * c); swing(`${f}_02_${sd}`, 1.35 * c); swing(`${f}_03_${sd}`, 0.9 * c); } swing(`thumb_01_${sd}`, 0.3 * c); swing(`thumb_02_${sd}`, 0.7 * c); swing(`thumb_03_${sd}`, 0.5 * c); };
  // Hand placement for authored motions: the same two-bone solve as the strike, either side. k = [r, u, f, phi, roll]: wrist-to-prop position in metres relative to that shoulder
  // (r toward the character's RIGHT, u up, f forward; arm length counts as 0.62), phi = tilt of the held thing from vertical towards forward (deg), roll = turn about its own axis (deg).
  const armOf = {}; const arm = (sd) => {
    if (armOf[sd]) return armOf[sd]; const ua = bone('upperarm_' + sd), la = bone('lowerarm_' + sd), h = bone('hand_' + sd), pr = bone('prop_' + sd); if (!ua || !la || !h || !pr) return null;
    const V = () => new THREE.Vector3(), Q = () => new THREE.Quaternion(); root.updateMatrixWorld(true); const hq = h.getWorldQuaternion(Q());
    return (armOf[sd] = { ua, la, h, pq: hq.clone().invert().multiply(pr.getWorldQuaternion(Q())), po: pr.getWorldPosition(V()).sub(h.getWorldPosition(V())).applyQuaternion(hq.clone().invert()) });
  };
  const ikT = {};
  const placeHand = (sd, k) => {
    const A = arm(sd); if (!A) return; const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), Q = () => new THREE.Quaternion();
    for (const n of ['upperarm_', 'lowerarm_', 'hand_']) { const g = rig[n + sd]; if (g) g.b.quaternion.copy(g.rest); }
    root.updateMatrixWorld(true);
    const Qa = avatar.getWorldQuaternion(Q()), upW = V(0, 1, 0), fwd = V(0, 0, 1).applyQuaternion(Qa), right = fwd.clone().cross(upW).normalize(), out = sd === 'r' ? right : right.clone().negate();
    const S = A.ua.getWorldPosition(V()), E0 = A.la.getWorldPosition(V()), W0 = A.h.getWorldPosition(V()), L1 = S.distanceTo(E0), L2 = E0.distanceTo(W0), L = L1 + L2, ref = L / 0.62;
    const phi = THREE.MathUtils.degToRad(k[3] || 0), rl = THREE.MathUtils.degToRad(k[4] || 0);
    const ty = upW.clone().multiplyScalar(Math.cos(phi)).addScaledVector(fwd, Math.sin(phi)), tz0 = upW.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(fwd, Math.cos(phi)), tz = tz0.applyAxisAngle(ty, rl), tx = ty.clone().cross(tz);
    const hq = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, ty, tz)).multiply(A.pq.clone().invert());
    const toolP = S.clone().addScaledVector(right, k[0] * ref).addScaledVector(upW, k[1] * ref).addScaledVector(fwd, k[2] * ref);
    const T = toolP.sub(A.po.clone().applyQuaternion(hq)), d0 = T.clone().sub(S), d = THREE.MathUtils.clamp(d0.length(), Math.abs(L1 - L2) + 0.01, L - 0.005), dir = d0.normalize(); T.copy(S).addScaledVector(dir, d);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const pole = upW.clone().multiplyScalar(-1).addScaledVector(out, 0.7).addScaledVector(fwd, -0.2), perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const E = S.clone().addScaledVector(dir, a).addScaledVector(perp, hh);
    const aim = (b, childPos, target) => { const o = b.getWorldPosition(V()), dq = Q().setFromUnitVectors(childPos.clone().sub(o).normalize(), target.clone().sub(o).normalize()); const pq = b.parent.getWorldQuaternion(Q()), wq = b.getWorldQuaternion(Q()); b.quaternion.copy(pq.invert().multiply(dq).multiply(wq)); b.updateMatrixWorld(true); };
    aim(A.ua, A.la.getWorldPosition(V()), E); aim(A.la, A.h.getWorldPosition(V()), T);
    A.h.quaternion.copy(A.la.getWorldQuaternion(Q()).invert().multiply(hq)); A.h.updateMatrixWorld(true);
  };
  const applyBone = (n, s, t, r, x, y) => { if (n === 'ik_r' || n === 'ik_l') { ikT[n.slice(-1)] = [s, t, r, x, y]; return; } if (n === 'grip_r' || n === 'grip_l') { curl(n.slice(-1), s); return; } swing(n, s); twist(n, t); roll(n, r); };
  const afterMotion = () => { for (const sd in ikT) { placeHand(sd, ikT[sd]); delete ikT[sd]; } };
  /** Parents obj to a bone (prop_r, prop_l, backAttach, ...) at a fixed rotation (deg) and offset (m, in bone-local units at game scale), compensating the skeleton scale. null clears. Returns the holder. */
  const mounts = new Map();
  avatar.userData.mount = (obj, boneName, rotDeg = [0, 0, 0], pos = [0, 0, 0]) => {
    const prev = mounts.get(obj); if (prev) { prev.parent && prev.parent.remove(prev); mounts.delete(obj); }
    const b = bone(boneName); if (!b) return null; const ws = b.getWorldScale(new THREE.Vector3()).x || 1, w = new THREE.Group(); w.add(obj); w.scale.setScalar(1 / ws / (avatar.userData.toolScale || 1));
    w.rotation.set(...rotDeg.map(d => d * Math.PI / 180)); w.position.set(...pos.map(v => v / ws)); w.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = true; } }); b.add(w); mounts.set(obj, w); return w;
  };
  avatar.userData.unmount = (obj) => { const w = mounts.get(obj); if (w) { w.parent && w.parent.remove(w); w.remove(obj); mounts.delete(obj); } };
  avatar.userData.playMotion = (name, { hook, onDone } = {}) => {
    const def = MOTIONS[name]; if (!def) return null; endWork(); stopReview();
    let run = null; run = createRunner(def, { apply: applyBone, after: afterMotion, emit: (e) => hook && hook(e, run), drop: (m) => { anchor.position.y = baseY - m / scale; } });
    work = { motion: run, t: 0, dur: 1e9, loop: true, onDone }; return run;
  };
  avatar.userData.clipDur = (n) => { const c = anims && anims.find(x => x.name === n); return c ? c.duration : 0; };
  avatar.userData.motionNames = () => Object.keys(MOTIONS);
  avatar.userData.stopWork = endWork; avatar.userData.working = () => !!work; avatar.userData.workClips = () => (anims || []).map(c => c.name);
  // Procedural strike (chop / pick): the right hand follows an overhead arc, the arm is solved with two-bone IK (shoulder-elbow-wrist) so the tool really
  // moves through that arc; spine, hips and the free arm follow. Keyframes are hand positions in metres relative to the right shoulder (r right, u up, f forward) + tool tilt.
  const STRIKES = {
    chop: { period: 1.25, hitAt: 0.58, keys: [[0, 0.06, -0.12, 0.26, 55], [0.34, 0.1, 0.46, -0.06, -35], [0.5, 0.08, 0.3, 0.12, 20], [0.58, 0.04, -0.12, 0.5, 95], [0.7, 0.04, -0.08, 0.44, 88], [1, 0.06, -0.12, 0.26, 55]], lean: 0.34 },
    pick: { period: 1.45, hitAt: 0.6, keys: [[0, 0.06, -0.1, 0.28, 60], [0.38, 0.08, 0.52, -0.02, -25], [0.52, 0.06, 0.34, 0.16, 25], [0.6, 0.03, -0.3, 0.46, 110], [0.74, 0.03, -0.24, 0.4, 100], [1, 0.06, -0.1, 0.28, 60]], lean: 0.42 },
  };
  const handB = bone('hand_r'), uaB = bone('upperarm_r'), laB = bone('lowerarm_r'), propB = bone('prop_r');
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), Q = () => new THREE.Quaternion();
  let propLocalQ = null, propOff = null;
  if (handB && propB) { root.updateMatrixWorld(true); const hq = handB.getWorldQuaternion(Q()); propLocalQ = hq.clone().invert().multiply(propB.getWorldQuaternion(Q())); propOff = propB.getWorldPosition(V()).sub(handB.getWorldPosition(V())).applyQuaternion(hq.clone().invert()); }
  const BLADE_ROLL = -2.88;   // re-fitted on our skeleton (tools_qa.js): the cutting edge leads the head at the fastest downstroke, alignment 0.999 (Codex-s roll, -1.334, was 0.02 here)
  const makePalmAxe = () => {
    root.updateMatrixWorld(true); const pt = (n) => bone(n).getWorldPosition(V()), wrist = pt('hand_r'), middle = pt('middle_01_r'), index = pt('index_01_r'), pinky = pt('pinky_01_r');
    const centre = middle.clone().lerp(wrist, 0.28), y = index.clone().sub(pinky).normalize(), fwd = middle.clone().sub(wrist).normalize(), z = V().crossVectors(fwd, y).normalize(), x = V().crossVectors(y, z).normalize();
    const wq = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)), holder = new THREE.Group(); holder.name = 'palm-axe-holder';
    holder.position.copy(handB.worldToLocal(centre.clone())); holder.quaternion.copy(handB.getWorldQuaternion(Q()).invert().multiply(wq)); const ws = handB.getWorldScale(V()); holder.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
    const axe = new THREE.Group(); axe.rotation.y = BLADE_ROLL; axe.scale.setScalar(targetHeight / 1.7); holder.add(axe);
    const wood = new THREE.MeshStandardMaterial({ color: '#795232', roughness: 0.91 }), metal = new THREE.MeshStandardMaterial({ color: '#899399', metalness: 0.55, roughness: 0.38 }), edge = new THREE.MeshStandardMaterial({ color: '#c1c9ce', metalness: 0.7, roughness: 0.27 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.021, 0.68, 12), wood); handle.position.y = 0.21; axe.add(handle);
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.12, 0.085), metal); collar.position.y = 0.49; axe.add(collar);
    const shape = new THREE.Shape(); shape.moveTo(0, 0.43); shape.lineTo(0.19, 0.40); shape.quadraticCurveTo(0.23, 0.49, 0.19, 0.58); shape.lineTo(0, 0.55); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.006, bevelSegments: 1, steps: 1 }); geo.rotateY(Math.PI / 2); geo.translate(-0.0175, 0, 0); axe.add(new THREE.Mesh(geo, metal));
    const cut = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.17, 0.017), edge); cut.position.set(0, 0.49, -0.205); axe.add(cut);
    holder.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); return holder;
  };
  const catmull = (keys, f) => { let i = 0; while (i < keys.length - 2 && f > keys[i + 1][0]) i++; const a = keys[i], b = keys[i + 1], u = THREE.MathUtils.clamp((f - a[0]) / (b[0] - a[0]), 0, 1), e = u * u * (3 - 2 * u); return a.map((v, k) => k ? v + (b[k] - v) * e : v); };
  const rotateTo = (b, childPos, target) => {   // turn bone b about its own origin so the direction to childPos points at target
    const o = b.getWorldPosition(V()), dq = Q().setFromUnitVectors(childPos.clone().sub(o).normalize(), target.clone().sub(o).normalize());
    const pq = b.parent.getWorldQuaternion(Q()), wq = b.getWorldQuaternion(Q()); b.quaternion.copy(pq.invert().multiply(dq).multiply(wq)); b.updateMatrixWorld(true);
  };
  const strikeTick = (w, dt) => {
    if (!uaB || !laB || !handB || !propLocalQ) return;
    for (const [b, p, q] of bones) { b.position.copy(p); b.quaternion.copy(q); }       // start from the resting pose every frame
    const f = (w.t / w.dur) % 1, pr = w.proc, scaleLen = avatar.scale.x || 1, k = catmull(pr.keys, f);
    const hit = Math.exp(-Math.pow((f - pr.hitAt) / 0.07, 2)), wind = Math.exp(-Math.pow((f - 0.4) / 0.2, 2)), down = THREE.MathUtils.smoothstep(f, pr.hitAt - 0.15, pr.hitAt) * (1 - THREE.MathUtils.smoothstep(f, pr.hitAt + 0.05, pr.hitAt + 0.3));
    swing('spine_01', pr.lean * down - 0.1 * wind); swing('spine_02', 0.12 * down - 0.08 * wind); twist('spine_02', -0.12 * wind + 0.08 * down); swing('head', -0.1 * down); swing('thigh_l', 0.3 * down); swing('calf_l', -0.3 * down); swing('thigh_r', -0.18 * down); swing('calf_r', -0.12 * down);   // lunge into the blow
    swing('upperarm_l', 0.55 * wind - 0.1 * down); swing('lowerarm_l', 0.5 + 0.3 * wind);                                                  // free arm balances
    root.updateMatrixWorld(true);
    const Qa = avatar.getWorldQuaternion(Q()), upW = V(0, 1, 0), fwd = V(0, 0, 1).applyQuaternion(Qa), right = fwd.clone().cross(upW).normalize();
    const S = uaB.getWorldPosition(V()), E0 = laB.getWorldPosition(V()), W0 = handB.getWorldPosition(V()), L1 = S.distanceTo(E0), L2 = E0.distanceTo(W0), A = L1 + L2, ref = A / 0.62;
    const phi = THREE.MathUtils.degToRad(k[4]);
    const ty = upW.clone().multiplyScalar(Math.cos(phi)).addScaledVector(fwd, Math.sin(phi)), tz = upW.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(fwd, Math.cos(phi)), tx = ty.clone().cross(tz);
    const tq = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(tx, ty, tz)), hq = tq.clone().multiply(propLocalQ.clone().invert());
    const toolP = S.clone().addScaledVector(right, k[1] * ref).addScaledVector(upW, k[2] * ref).addScaledVector(fwd, k[3] * ref);
    const T = toolP.sub(propOff.clone().multiplyScalar(1).applyQuaternion(hq));   // wrist position that puts the tool where we want it
    const d0 = T.clone().sub(S), d = THREE.MathUtils.clamp(d0.length(), Math.abs(L1 - L2) + 0.01, A - 0.005), dir = d0.normalize(); T.copy(S).addScaledVector(dir, d);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    const pole = upW.clone().multiplyScalar(-1).addScaledVector(right, 0.7).addScaledVector(fwd, -0.2), perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const E = S.clone().addScaledVector(dir, a).addScaledVector(perp, h);
    rotateTo(uaB, laB.getWorldPosition(V()), E); rotateTo(laB, handB.getWorldPosition(V()), T);
    handB.quaternion.copy(laB.getWorldQuaternion(Q()).invert().multiply(hq)); handB.updateMatrixWorld(true); grip();
  };
  // Face: the head mesh carries a few ARKit-style morph targets. An expression is a set of target weights eased in and out; blinking runs on its own.
  const headMesh = meshes.find(m => m.morphTargetDictionary), dict = headMesh ? headMesh.morphTargetDictionary : {};
  if (headMesh && headMesh.morphTargetInfluences) headMesh.morphTargetInfluences.fill(0);
  const both = (n, v) => ({ [n + 'Left']: v, [n + 'Right']: v });
  const FACES = {
    neutral: {}, happy: { ...both('mouthSmile', 0.9), ...both('cheekSquint', 0.5), ...both('browOuterUp', 0.2) },
    surprised: { ...both('eyeWideUpper', 1), ...both('browInnerUp', 0.9), ...both('browOuterUp', 0.8), jawOpen: 0.55, mouthFunnel: 0.35 },
    sad: { ...both('mouthFrown', 0.8), ...both('browInnerUp', 0.8), ...both('browFrown', 0.2) },
    thinking: { ...both('browInnerDown', 0.2), browOuterUpLeft: 0.7, mouthPressLeft: 0.6, mouthPressRight: 0.2, eyeSquintRight: 0.3 },
    determined: { ...both('browFrown', 0.7), ...both('mouthPress', 0.5), ...both('eyeSquint', 0.3) },
    eating: { ...both('cheekPuff', 0.35), mouthClose: 0.2 }, effort: { ...both('browFrown', 0.5), ...both('eyeSquint', 0.5), ...both('mouthStretch', 0.4), jawOpen: 0.12 },
    yawn: { jawOpen: 1, ...both('eyeBlinkUpper', 0.7), ...both('browInnerUp', 0.4), mouthFunnel: 0.25 },
  };
  const weights = {}; let face = { name: 'neutral', until: 0 }, faceT = 0, blinkAt = 2.5, blinkP = -1;
  avatar.userData.setFace = (name, seconds = 1.6) => { if (!FACES[name]) return false; face = { name, until: faceT + seconds }; return true; };
  avatar.userData.faceNames = () => Object.keys(FACES); avatar.userData.hasFace = () => !!headMesh && 'jawOpen' in dict;
  const faceTick = (dt) => {
    if (!headMesh) return; faceT += dt; if (faceT > face.until && face.name !== 'neutral') face = { name: 'neutral', until: 0 };
    const tgt = { ...FACES[face.name] };   // eating chews: the jaw opens and closes
    if (face.name === 'eating') tgt.jawOpen = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(faceT * 9));
    if (faceT > blinkAt && blinkP < 0) { blinkP = 0; blinkAt = faceT + 2.2 + Math.random() * 3.5; }
    if (blinkP >= 0) { blinkP += dt / 0.16; const b = Math.sin(Math.min(1, blinkP) * Math.PI); if (blinkP >= 1) blinkP = -1; tgt.eyeBlinkUpperLeft = Math.max(tgt.eyeBlinkUpperLeft || 0, b); tgt.eyeBlinkUpperRight = Math.max(tgt.eyeBlinkUpperRight || 0, b); }
    for (const n in dict) { const w = weights[n] || 0, g = tgt[n] || 0, nw = w + (g - w) * Math.min(1, dt * 12); weights[n] = nw; headMesh.morphTargetInfluences[dict[n]] = nw; }
  };
  // Grip: while a tool is held the right hand closes around it (finger joints curl about each bone's local Y; thumb folds across).
  const FING = []; for (const n of ['index', 'middle', 'ring', 'pinky']) for (const [i, a] of [[1, 1.15], [2, 1.35], [3, 0.9]]) { const b = bone(`${n}_0${i}_r`); if (b) FING.push([b, b.quaternion.clone(), a]); }
  for (const [i, a] of [[1, 0.35], [2, 0.7], [3, 0.6]]) { const b = bone(`thumb_0${i}_r`); if (b) FING.push([b, b.quaternion.clone(), a, 1]); }
  const qy = new THREE.Quaternion(), YAX = new THREE.Vector3(0, 1, 0), ZAX = new THREE.Vector3(0, 0, 1);
  const grip = () => { for (const [b, q0, a, th] of FING) b.quaternion.copy(q0).multiply(qy.setFromAxisAngle(th ? ZAX : YAX, a)); };
  avatar.userData.poseStrike = (name, f) => { const pr = STRIKES[name]; if (!pr) return false; work = work && work.proc === pr ? work : { proc: pr, t: 0, dur: pr.period, loop: true }; work.t = f * pr.period; strikeTick(work, 0); return true; };   // test hook: freeze the swing at fraction f
  // Locomotion: blend the real idle / walk / run / sprint clips by speed. Only bones this character has are driven; pelvis height is kept only if its units match.
  let loco = null;
  const lc = anims && ['idle', 'walk', 'run', 'sprint'].map(n => anims.find(c => c.name === 'loco_' + n));
  if (lc && lc.every(Boolean)) {
    const have = new Set(bones.map(b => b[0].name)), pel = bone('pelvis'); mixer ||= new THREE.AnimationMixer(root);
    loco = {};
    ['idle', 'walk', 'run', 'sprint'].forEach((n, i) => {
      const c = lc[i].clone(); c.tracks = c.tracks.filter(t => have.has(t.name.split('.')[0]));
      if (pel) c.tracks = c.tracks.filter(t => { if (t.name !== 'pelvis.position') return true; const y = t.values[1], ry = pel.position.y; return Math.abs(y - ry) < 0.35 * Math.abs(ry); });   // drop it when the units disagree
      const a = mixer.clipAction(c); a.play(); a.timeScale = 0; a.setEffectiveWeight(n === 'idle' ? 1 : 0); loco[n] = { a, w: n === 'idle' ? 1 : 0, dur: c.duration, t: 0 };
    });
  }
  // All four clips share one gait phase (they all start on the same footfall), so blending walk -> run -> sprint never puts the legs out of step.
  // Cadence comes from ground speed: speed (m/s) / stride length, with each clip's natural stride measured from its root motion (walk 1.5 m, run 1.8 m, sprint 4.3 m per cycle, on the 1.9 m rig).
  let gait = 0;
  const STRIDE = { walk: 1.5, run: 1.81, sprint: 4.35 };
  // Jump: while airborne the mid-air tuck replaces the gait; on touchdown a soft landing fades out over 0.45 s on top of the gait. Weights always sum to 1.
  let aw = 0, lw = 0, lt = 0, wasAir = false, airA = null, landA = null, airT = 0;
  avatar.userData.addAirClips = (clips) => {
    const have = new Set(bones.map(b => b[0].name)), mk = (n) => { const src = clips.find(c => c.name === n); if (!src || !mixer) return null; const c = src.clone(); c.tracks = c.tracks.filter(t => have.has(t.name.split('.')[0])); const a = mixer.clipAction(c); a.play(); a.timeScale = 0; a.setEffectiveWeight(0); return { a, dur: c.duration }; };
    airA = mk('air_fall'); landA = mk('air_land'); return !!(airA && landA);
  };
  // Climb: the game passes progress 0..1 while the player is hauling up onto a stone; the clip fades in over the first 12% and out over the last 12%.
  let cw = 0, climbA = null;
  avatar.userData.addClimbClips = (clips) => {
    const src = clips.find(c => c.name === 'climb_up'); if (!src || !mixer) return false; const have = new Set(bones.map(b => b[0].name)), pel = bone('pelvis'), c = src.clone();
    c.tracks = c.tracks.filter(t => have.has(t.name.split('.')[0])); if (pel) c.tracks = c.tracks.filter(t => t.name !== 'pelvis.position' || Math.abs(t.values[1] - pel.position.y) < 0.35 * Math.abs(pel.position.y));
    const a = mixer.clipAction(c); a.play(); a.timeScale = 0; a.setEffectiveWeight(0); climbA = { a, dur: c.duration }; return true;
  };
  const climbTick = (u) => {
    if (!climbA) return; cw = u == null ? 0 : Math.max(0, Math.min(1, u / 0.12, (1 - u) / 0.12));
    climbA.a.time = Math.min(Math.max(0, u || 0) * climbA.dur, climbA.dur - 0.001); climbA.a.setEffectiveWeight(cw);
  };
  avatar.userData.climbWeight = () => cw;   // test hook
  const airTick = (air, dt, vy = 0) => {
    if (!airA || !landA) return;
    aw += ((air ? 1 : 0) - aw) * Math.min(1, dt * 10);
    if (air) maxFall = Math.max(maxFall, -vy);
    if (wasAir && !air) { lt = 1e-4; landPick = landH && maxFall >= 8.5 ? 'hard' : landM && maxFall >= 6.2 ? 'medium' : 'soft'; }   // normal jump lands at about 4.6 m/s; drops of ~2 m and ~3.7 m land harder
    if (!air && !wasAir) maxFall = 0;
    wasAir = air;
    if (lt > 0) { lt += dt; if (lt >= 0.45) { lt = 0; lw = 0; } else lw = 0.85 * Math.sin(Math.PI * lt / 0.45); }
    airT = (airT + dt) % airA.dur; airA.a.time = airT;
    const lw2 = lw * (1 - aw) * (1 - cw), pk = { soft: landA, medium: landM, hard: landH };
    for (const k in pk) if (pk[k]) { pk[k].a.time = Math.min(lt, pk[k].dur - 0.001); pk[k].a.setEffectiveWeight(k === landPick ? lw2 : 0); }
    airA.a.setEffectiveWeight(aw * (1 - cw));
  };
  // Crouch: Synty crouch idle and crouch walk blended over the standing gait by an eased weight; sprinting and jumping stand you up (the game decides).
  let kw = 0, crouchA = null, cgait = 0;
  avatar.userData.addCrouchClips = (clips) => {
    if (!mixer) return false; const have = new Set(bones.map(b => b[0].name)), pel = bone('pelvis'), mk = (n) => { const src = clips.find(c => c.name === n); if (!src) return null; const c = src.clone(); c.tracks = c.tracks.filter(t => have.has(t.name.split('.')[0])); if (pel) c.tracks = c.tracks.filter(t => t.name !== 'pelvis.position' || Math.abs(t.values[1] - pel.position.y) < 0.35 * Math.abs(pel.position.y));
      // the crouch pitches the head and neck forward; hair is rigid on the head, so a ponytail would stick out sideways. Keep only 35% of that head/neck rotation (the eyes stay level).
      for (const t of c.tracks) { const m = /^(head|neck_01)\.quaternion$/.exec(t.name); if (!m) continue; const rest = bones.find(b => b[0].name === m[1])[2], q = new THREE.Quaternion(), v = t.values; for (let i = 0; i < v.length; i += 4) { q.fromArray(v, i); q.copy(rest.clone().slerp(q, 0.35)); q.toArray(v, i); } }
      const a = mixer.clipAction(c); a.play(); a.timeScale = 0; a.setEffectiveWeight(0); return { a, dur: c.duration }; };
    const idle = mk('crouch_idle'), walk = mk('crouch_walk'); if (!idle || !walk) return false; crouchA = { idle, walk }; return true;
  };
  avatar.userData.crouchWeight = () => kw;   // test hook
  avatar.userData.crouchInfo = () => crouchA && { idle: [crouchA.idle.a.getEffectiveWeight(), crouchA.idle.a.getClip().tracks.length, crouchA.idle.a.time], walk: [crouchA.walk.a.getEffectiveWeight(), crouchA.walk.a.getClip().tracks.length], loco: Object.fromEntries(Object.entries(loco || {}).map(([n, L]) => [n, L.a.getEffectiveWeight()])) };   // test hook
  // Slopes and hard landings: on a rise the walk/run/sprint cycle is replaced by Synty's 25-degree up/down versions (same footfall phase), blended by how steep the ground is under the player.
  let slopeA = null, slopeW = 0, landM = null, landH = null, landPick = 'soft', maxFall = 0;
  avatar.userData.addMoveClips = (clips) => {
    if (!mixer) return false; const have = new Set(bones.map(b => b[0].name)), mk = (n) => { const src = clips.find(c => c.name === n); if (!src) return null; const c = src.clone(); c.tracks = c.tracks.filter(t => have.has(t.name.split('.')[0])); const a = mixer.clipAction(c); a.play(); a.timeScale = 0; a.setEffectiveWeight(0); return { a, dur: c.duration }; };
    const m = {}; for (const g of ['walk', 'run', 'sprint']) for (const d of ['up', 'down']) m[g + '_' + d] = mk(`m_${g}_${d}25f`);
    if (Object.values(m).some(x => !x)) return false; slopeA = m; landM = mk('m_land_idlemedium'); landH = mk('m_land_idlehard'); return true;
  };
  avatar.userData.moveInfo = () => ({ slopeW: +slopeW.toFixed(2), landPick, maxFall: +maxFall.toFixed(1), clips: !!slopeA, w: slopeA ? Object.fromEntries(Object.entries(slopeA).map(([k, v]) => [k, +v.a.getEffectiveWeight().toFixed(2)])) : null });   // test hook
  let sprintI = 0;   // eased Shift / touch-sprint intent: the sprint clip is only ever used while the player is actually sprinting
  const locoTick = (speed, dt, sprinting = true, crouching = false, slopeIn = 0) => {
    const k = targetHeight / 1.9, u = THREE.MathUtils.clamp(speed, 0, 2) * 4 / k;          // ground speed in rig metres per second
    sprintI += ((sprinting ? 1 : 0) - sprintI) * Math.min(1, dt * 8);
    const ss = THREE.MathUtils.smoothstep, move = ss(u, 0.15, 0.55), toRun = ss(u, 1.9, 2.7), toSprint = ss(u, 4.4, 5.6) * sprintI;
    const want = { idle: 1 - move, walk: move * (1 - toRun), run: move * toRun * (1 - toSprint), sprint: move * toRun * toSprint };
    kw += ((crouching && crouchA ? 1 : 0) - kw) * Math.min(1, dt * 9);
    for (const n in loco) { const L = loco[n]; L.w += (want[n] - L.w) * Math.min(1, dt * 12); L.a.setEffectiveWeight(L.w * (1 - aw) * (1 - lw) * (1 - cw) * (1 - kw)); }
    if (crouchA) { const base = (1 - aw) * (1 - lw) * (1 - cw) * kw; crouchA.idle.a.setEffectiveWeight(base * (1 - move)); crouchA.walk.a.setEffectiveWeight(base * move); crouchA.idle.a.time = (crouchA.idle.a.time + dt) % crouchA.idle.dur; if (move > 0.01) cgait = (cgait + dt * Math.min(2.1, u / 1.1)) % 1; crouchA.walk.a.time = cgait * crouchA.walk.dur; }
    if (slopeA) {
      const sl = THREE.MathUtils.clamp(slopeIn, -1, 1); slopeW += (sl - slopeW) * Math.min(1, dt * 6); const su = Math.max(0, slopeW), sd = Math.max(0, -slopeW), f = 1 - Math.max(su, sd);
      for (const g of ['walk', 'run', 'sprint']) { const L = loco[g], base = L.w * (1 - aw) * (1 - lw) * (1 - cw) * (1 - kw); L.a.setEffectiveWeight(base * f); slopeA[g + '_up'].a.setEffectiveWeight(base * su); slopeA[g + '_down'].a.setEffectiveWeight(base * sd); }
    }
    const stride = (loco.walk.w * STRIDE.walk + loco.run.w * STRIDE.run + loco.sprint.w * STRIDE.sprint) / Math.max(0.001, loco.walk.w + loco.run.w + loco.sprint.w);
    if (move > 0.01) gait = (gait + dt * Math.min(2.1, u / stride)) % 1;
    for (const n of ['walk', 'run', 'sprint']) { loco[n].a.time = gait * loco[n].dur; if (slopeA) for (const d of ['up', 'down']) slopeA[n + '_' + d].a.time = gait * slopeA[n + '_' + d].dur; }
    loco.idle.t = (loco.idle.t + dt) % loco.idle.dur; loco.idle.a.time = loco.idle.t;
    mixer.update(0);
  };
  avatar.userData.hasLoco = () => !!loco;
  avatar.userData.gaitState = () => loco ? { ...Object.fromEntries(Object.entries(loco).map(([n, L]) => [n, +L.w.toFixed(2)])), sprintI: +sprintI.toFixed(2), gait: +gait.toFixed(2), review: !!review, working: !!work } : null;   // test hook
  // Review-tool clips (jump, fall, land, turns, crouch, strafes...): one at a time on the same mixer, never triggered by play.
  let review = null; const revActions = {};
  avatar.userData.addReviewClips = (clips) => {
    mixer ||= new THREE.AnimationMixer(root); const have = new Set(bones.map(b => b[0].name)), pel = bone('pelvis'), names = [];
    for (const src of clips) { const c = src.clone(); c.tracks = c.tracks.filter(t => have.has(t.name.split('.')[0])); if (pel) c.tracks = c.tracks.filter(t => t.name !== 'pelvis.position' || Math.abs(t.values[1] - pel.position.y) < 0.35 * Math.abs(pel.position.y)); revActions[c.name] = c; names.push(c.name); }
    const labels = avatar.userData.clipLabels = { ...(avatar.userData.clipLabels || {}) };
    for (const n of names) labels[n] = (n.startsWith('rev_basic_') ? 'Human Basic Motions: ' + n.slice(10) : 'Synty: ' + n.slice(4)).replaceAll('_', ' ');
    const craft = (anims || []).map(c => c.name).filter(n => !n.startsWith('loco_'));   // crafting clips (fishing, gathering variants, mining...) that have no gameplay trigger yet
    for (const n of craft) labels[n] = 'Crafting: ' + n.replaceAll('_', ' ');
    avatar.userData.clipNames = [...new Set([...(avatar.userData.clipNames || []), ...craft, ...names])]; return names.length;
  };
  /** Developer review of a clip from another Sidekick-skeleton pack (Grok's elf pack): bone names match, so tracks bind directly. Rotations only (+ pelvis height when sane); helper bones are never driven. Returns the number of tracks kept. */
  avatar.userData.playExternal = (src, { loop = true, speed = 1 } = {}) => {
    mixer ||= new THREE.AnimationMixer(root); const have = new Set(bones.map(b => b[0].name)), pel = bone('pelvis'), c = src.clone();
    c.tracks = c.tracks.filter(t => { const b = t.name.split('.')[0]; if (!have.has(b) || SKIP_BONE.test(b)) return false; if (t.name.endsWith('.quaternion')) return true; return t.name === 'pelvis.position' && pel && Math.abs(t.values[1] - pel.position.y) < 0.35 * Math.abs(pel.position.y); });
    if (!c.tracks.length) return 0; endWork(); stopReview(); const a = mixer.clipAction(c); a.reset(); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !loop; a.setEffectiveWeight(1); a.setEffectiveTimeScale(speed); a.play(); review = a; return c.tracks.length;
  };
  const stopReview = () => { if (review) { review.stop(); review = null; } };
  avatar.userData.animate = (speed, t, dt = 0.016, movement = {}) => {
    if (avatar.userData.freeze) return;
    faceTick(dt);
    if (movement.speed != null) speed = movement.speed / 4;   // true collision-resolved m/s (not capped at 1, so a real sprint reaches the sprint clip)
    if (movement.moving === false || movement.reduced) speed = 0;   // menus, reduced motion and blocked movement stand still
    if (review && !work) { for (const n in loco || {}) { loco[n].a.setEffectiveWeight(0); loco[n].w = 0; } mixer.update(dt); return; }
    if (loco) { if (work) { for (const n in loco) { loco[n].a.setEffectiveWeight(0); loco[n].w = 0; } if (airA) { airA.a.setEffectiveWeight(0); landA.a.setEffectiveWeight(0); aw = lw = lt = 0; } if (climbA) { climbA.a.setEffectiveWeight(0); cw = 0; } if (crouchA) { crouchA.idle.a.setEffectiveWeight(0); crouchA.walk.a.setEffectiveWeight(0); kw = 0; } if (slopeA) { for (const k in slopeA) slopeA[k].a.setEffectiveWeight(0); slopeW = 0; } } else { climbTick(movement.climb); airTick(!!movement.air, dt, movement.vy || 0); locoTick(speed, dt, movement.sprinting !== false, !!movement.crouch, movement.slope || 0); return; } }
    if (work) { work.t += dt; if (work.motion) { work.motion.tick(dt); if (work.motion.done) endWork(); return; } else if (work.proc) strikeTick(work, dt); else { mixer.update(dt); if (tool) grip(); } if (!work.loop && work.t >= work.dur) endWork(); return; }
    const run = THREE.MathUtils.clamp((speed - 0.62) / 0.3, 0, 1), moving = speed > 0.05, k = moving ? Math.min(1, speed * 2.5) : 0;
    phase += dt * (moving ? 4.2 + 3.2 * speed + 2.6 * run : 0);       // radians per second; one stride = 2π
    const f = ((phase / (2 * Math.PI)) % 1 + 1) % 1, fr = (f + 0.5) % 1, s = Math.sin(phase), c = Math.cos(phase);
    swing('pelvis', 0); swing('spine_03', 0);   // reset the bones that are only twisted below
    leg('l', f, k, run); leg('r', fr, k, run);
    const breath = Math.sin(t * 1.7) * 0.015 * (1 - k), arm = (0.3 + 0.55 * run) * k;   // arms swing opposite the legs, elbows soft
    swing('upperarm_l', arm * Math.cos(phase) * 1.0 + breath - 0.05 * k); swing('upperarm_r', -arm * Math.cos(phase) + breath - 0.05 * k);
    swing('lowerarm_l', 0.18 + (0.25 + 0.7 * run) * k * (0.5 + 0.5 * Math.cos(phase + 0.4))); swing('lowerarm_r', 0.18 + (0.25 + 0.7 * run) * k * (0.5 - 0.5 * Math.cos(phase - 0.4)));
    swing('spine_01', 0.03 * k + 0.14 * run * k); swing('spine_02', breath); swing('head', -0.03 * k - 0.05 * run * k);
    twist('spine_02', -0.1 * k * c); twist('spine_03', -0.05 * k * c); twist('pelvis', 0.09 * k * c); roll('pelvis', 0.035 * k * s); twist('head', 0.06 * k * c);
    if (hammer > 0) { hammer -= dt; const h = Math.sin((1 - hammer / 0.9) * Math.PI * 3); swing('upperarm_r', -1.1 - 0.6 * h); swing('lowerarm_r', 0.9 + 0.5 * h); swing('spine_02', 0.12 * h); }
    anchor.position.y = baseY + (moving ? (0.5 - 0.5 * Math.cos(phase * 2)) * 0.03 * (1 + run) / scale : 0);   // two small bobs per cycle, not a bounce
  };
  avatar.userData.playClip = (name) => {
    if (name === 'hammer') hammer = 0.9;
    else if (revActions[name]) { endWork(); stopReview(); const a = mixer.clipAction(revActions[name]); a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.setEffectiveWeight(1); a.setEffectiveTimeScale(1); a.play(); review = a; }
    else if (anims && anims.some(c => c.name === name)) { stopReview(); avatar.userData.playWork(name, { loop: true }); }   // crafting clips without a gameplay trigger yet (fishing, gathering variants...)
    else { stopReview(); endWork(); }   // null / 'stop': back to walking
    return true;
  };
  avatar.userData.clipNames = ['hammer']; avatar.userData.clipLabels = { hammer: 'Swing a hammer' };
  avatar.userData.height = targetHeight; avatar.userData.character = data.preset.label; avatar.userData.isSidekick = true; avatar.userData.meshes = meshes;
  return avatar;
}
