// Tree-felling presentation: wood chips on each axe contact and a falling tree on the last one. Visual only: the maths answer, the yield, the 3-hit depletion and the
// 60 s regrowth stay in rules.js / main.js. Timings are taken from Grok's chop_tree delivery (elf-game-pack/world/chop_tree/events.json, 24 fps):
// fall starts 4.04 s, impact 5.50 s, settled 6.58 s, rest angle 77.4 deg. Grok's own tree_fall.glb is NOT used (a procedural tree that would not match the game's trees);
// the game's own tree model is tilted about its base with the same timeline instead.
import * as THREE from 'three';

export const FALL = { creak: 0.35, drop: 1.46, settle: 1.08, restDeg: 77.4, hold: 1.6, fade: 0.8 };
/** Angle (radians) of a felled tree t seconds after the last hit: a short creak, an accelerating fall (inverted pendulum), two small bounces. */
export function fallAngle(t, rest = FALL.restDeg * Math.PI / 180) {
  if (t <= 0) return 0;
  const { creak, drop, settle } = FALL, lean = 0.045;
  if (t < creak) return lean * (t / creak);
  const u = Math.min(1, (t - creak) / drop);
  if (u < 1) return lean + (rest - lean) * u * u * (0.35 + 0.65 * u);
  const s = (t - creak - drop) / settle; if (s >= 1) return rest;
  return rest - 0.05 * Math.abs(Math.sin(s * Math.PI * 2)) * (1 - s);
}

const chipGeo = new THREE.BoxGeometry(0.07, 0.025, 0.045), chipMat = new THREE.MeshStandardMaterial({ color: 0xcfa874, roughness: 0.9 }), dustMat = new THREE.MeshBasicMaterial({ color: 0xb9a98c, transparent: true, opacity: 0.4, depthWrite: false });

export function makeTreeFx(scene, { instantiate, groundAt, onFallStart }) {
  const chips = [], falls = [], dust = [];
  const root = new THREE.Group(); root.name = 'treefx'; scene.add(root);
  function burst(x, y, z, dirX, dirZ, n = 12) {   // chips fly out of the cut towards the chopper
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(chipGeo, chipMat), a = Math.atan2(dirZ, dirX) + (Math.random() - 0.5) * 1.6, sp = 1.4 + Math.random() * 2.2;
      m.position.set(x, y, z); m.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); root.add(m);
      chips.push({ m, vx: Math.cos(a) * sp, vy: 1.6 + Math.random() * 2.2, vz: Math.sin(a) * sp, spin: (Math.random() - 0.5) * 14, life: 0.9 + Math.random() * 0.4, t: 0 });
    }
  }
  function puff(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), dustMat); m.position.set(x + (Math.random() - 0.5) * 3, y + 0.2, z + (Math.random() - 0.5) * 3); root.add(m); dust.push({ m, t: 0, life: 1.1 }); }
  }
  /** A contact on tree p seen from (px, pz). Chips come out of the trunk at about chest height on the chopper's side. */
  function hit(p, px, pz, hits) {
    const dx = px - p.x, dz = pz - p.z, d = Math.hypot(dx, dz) || 1, r = 0.45 * (p.scale || 1);
    burst(p.x + dx / d * r, p.y + 1.0, p.z + dz / d * r, dx / d, dz / d, 8 + hits * 3);
  }
  /** Fells tree p away from (px, pz). `model` is the tree model name actually drawn for p. */
  function fell(p, model, px, pz) {
    const dx = p.x - px, dz = p.z - pz, d = Math.hypot(dx, dz) || 1, fx = dx / d, fz = dz / d;
    const tree = instantiate(model, p.x, p.z, p.rot, p.scale, 0, p.y); tree.position.set(0, 0, 0);
    const pivot = new THREE.Group(); pivot.position.set(p.x, p.y, p.z); pivot.add(tree); root.add(pivot);
    falls.push({ p, pivot, axis: new THREE.Vector3(fz, 0, -fx), fx, fz, t: 0, hit: false, reach: 5 * (p.scale || 1) });
    onFallStart?.(p);
  }
  function update(dt) {
    for (let i = chips.length - 1; i >= 0; i--) { const c = chips[i]; c.t += dt; c.vy -= 9.8 * dt; c.m.position.x += c.vx * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt; c.m.rotation.x += c.spin * dt;
      const g = groundAt(c.m.position.x, c.m.position.z); if (c.m.position.y < g + 0.02) { c.m.position.y = g + 0.02; c.vx *= 0.4; c.vz *= 0.4; c.vy = 0; c.spin *= 0.4; }
      if (c.t > c.life) { c.m.scale.multiplyScalar(0.9); if (c.t > c.life + 0.5) { root.remove(c.m); chips.splice(i, 1); } } }
    for (let i = dust.length - 1; i >= 0; i--) { const d = dust[i]; d.t += dt; d.m.scale.setScalar(1 + d.t * 1.4); d.m.position.y += dt * 0.4; if (d.t > d.life) { root.remove(d.m); dust.splice(i, 1); } }
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i]; f.t += dt; f.pivot.quaternion.setFromAxisAngle(f.axis, fallAngle(f.t));
      if (!f.hit && f.t >= FALL.creak + FALL.drop) { f.hit = true; puff(f.p.x + f.fx * f.reach, f.p.y, f.p.z + f.fz * f.reach); }
      const end = FALL.creak + FALL.drop + FALL.settle + FALL.hold;
      if (f.t > end) { const k = Math.max(0, 1 - (f.t - end) / FALL.fade); f.pivot.scale.setScalar(Math.max(0.001, k)); if (k <= 0) { root.remove(f.pivot); falls.splice(i, 1); } }
    }
  }
  return { root, hit, fell, update, burst, get active() { return chips.length + falls.length + dust.length; }, falls, chips };
}
