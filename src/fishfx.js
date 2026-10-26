// Fishing props and effects: the rod (cane, cork grip, reel), the line, the bobber, ripples and the fish. Built from primitives so the family build can ship them.
// The body motion comes from the baked fishing clips (fish_begin / fish_throw / fish_loop / fish_pull / fish_stop) plus a short hand-authored draw and stow (motions.js);
// this file only draws what the hands are holding and where the line goes, and is told when to cast, bite, reel and lift. Visual only: the maths question decides the catch.
import * as THREE from 'three';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
const ROD_LEN = 2.0;
/** Rod along +Y with the grip around y = 0 (same placement as the old primitive rod). userData.tip is an Object3D at the rod tip. */
export function makeRod() {
  const g = new THREE.Group(); g.name = 'fishing-rod';
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.017, 0.3, 10), mat(0xb98a55)); cork.position.y = -0.05; g.add(cork);
  const butt = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.05, 10), mat(0x3a2a1e)); butt.position.y = -0.22; g.add(butt);
  const reel = new THREE.Group(); reel.position.set(0, 0.16, 0.045);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 14), mat(0x8c969c, { metalness: 0.6, roughness: 0.4 })); drum.rotation.z = Math.PI / 2; reel.add(drum);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 6), mat(0xc9c2a8)); knob.position.set(0.03, 0.02, 0); reel.add(knob); g.add(reel); g.userData.reel = reel;
  const segs = 5, r0 = 0.0125; let y = 0.1;
  for (let i = 0; i < segs; i++) {
    const len = (ROD_LEN - 0.1) / segs, r1 = r0 * (1 - i / segs * 0.8), r2 = r0 * (1 - (i + 1) / segs * 0.8);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 8), mat(i % 2 ? 0xa67c3d : 0xb78a46)); s.position.y = y + len / 2; s.rotation.x = -0.035 * i; s.position.z = -0.0035 * i * i; g.add(s); y += len;   // a slight forward bend towards the tip
  }
  const tip = new THREE.Object3D(); tip.position.set(0, y, -0.0035 * 16); g.add(tip); g.userData.tip = tip;
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}

function makeFish() {
  const g = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), mat(0x9fb4b8, { metalness: 0.25, roughness: 0.45 })); body.scale.set(0.045, 0.16, 0.035); g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mat(0xe7d6a8)); belly.scale.set(0.038, 0.13, 0.026); belly.position.set(0, -0.005, 0.014); g.add(belly);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.1, 4), mat(0x7e9aa0)); tail.position.y = -0.2; tail.rotation.x = Math.PI; tail.scale.z = 0.3; g.add(tail);
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 3), mat(0x6f8c92)); fin.position.set(0, 0.02, 0.04); fin.scale.x = 0.3; g.add(fin);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), mat(0x101418)); e.position.set(sx * 0.03, 0.1, 0.012); g.add(e); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
  return g;
}

/**
 * Line, bobber, ripples and fish in the world. `surface(x,z)` gives the water height. Call update(dt, tipWorld) every frame; tipWorld is the rod tip's world position (or null).
 * States: idle -> fly (cast) -> float -> bite -> reel (towards the player) -> lift (the fish hangs from the tip) -> idle.
 */
export function makeFishFx(scene, { surface }) {
  const root = new THREE.Group(); root.name = 'fishfx'; scene.add(root);
  const bob = new THREE.Group(), top = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd9382f)), bot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0xf4f1e6));
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.06, 5), mat(0xf4f1e6)); stem.position.y = -0.06; bob.add(top, bot, stem); bob.visible = false; root.add(bob);
  const N = 18, pts = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xf2eed8, transparent: true, opacity: 0.8 })); line.frustumCulled = false; line.visible = false; root.add(line);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }), rings = [];
  const fish = makeFish(); fish.visible = false; root.add(fish);
  const fx = { root, state: 'idle', pos: new THREE.Vector3(), from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0, dur: 0, sag: 0.1, hasFish: false, rod: null };
  const ripple = (x, z, big = 1) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.09, 24), ringMat.clone()); m.rotation.x = -Math.PI / 2; m.position.set(x, surface(x, z) + 0.02, z); root.add(m); rings.push({ m, t: 0, life: 1.4, big }); };
  fx.makeRod = makeRod;
  /** Throw the bobber from `tip` to the water at (x,z) over `dur` seconds. */
  fx.cast = (tip, x, z, dur = 0.8) => { fx.state = 'fly'; fx.from.copy(tip); fx.to.set(x, surface(x, z) + 0.02, z); fx.t = 0; fx.dur = dur; bob.visible = line.visible = true; fx.sag = 0.15; };
  fx.bite = () => { if (fx.state === 'float') { fx.state = 'bite'; fx.t = 0; ripple(fx.pos.x, fx.pos.z, 1.4); } };
  /** Haul the bobber (and the fish, if any) in to (x,z) over `dur`. */
  fx.reel = (x, z, dur = 1.6, withFish = false) => { fx.state = 'reel'; fx.from.copy(fx.pos); fx.to.set(x, surface(x, z) + 0.02, z); fx.t = 0; fx.dur = dur; fx.hasFish = withFish; };
  fx.lift = (fishToo = true) => { fx.state = 'lift'; fx.t = 0; fx.hasFish = fishToo; fish.visible = fishToo; };
  fx.clear = () => { fx.state = 'idle'; bob.visible = line.visible = fish.visible = false; fx.hasFish = false; for (const r of rings) root.remove(r.m); rings.length = 0; };
  fx.fishVisible = () => fish.visible;
  fx.update = (dt, tip) => {
    fx.t += dt; const u = fx.dur > 0 ? Math.min(1, fx.t / fx.dur) : 1, tm = performance.now() / 1000;
    if (fx.state === 'fly') {
      fx.pos.lerpVectors(fx.from, fx.to, u); fx.pos.y += Math.sin(u * Math.PI) * (1.6 + 0.2 * fx.from.distanceTo(fx.to));
      if (u >= 1) { fx.state = 'float'; fx.t = 0; ripple(fx.to.x, fx.to.z, 1.2); ripple(fx.to.x, fx.to.z, 0.7); }
    } else if (fx.state === 'float') { fx.pos.set(fx.to.x, surface(fx.to.x, fx.to.z) + 0.02 + Math.sin(tm * 2.2) * 0.012, fx.to.z); fx.sag = 0.12; }
    else if (fx.state === 'bite') { const k = Math.min(1, fx.t / 0.3); fx.pos.set(fx.to.x, surface(fx.to.x, fx.to.z) + 0.02 - 0.07 * Math.sin(k * Math.PI) - 0.02 + Math.sin(tm * 18) * 0.015, fx.to.z); if (((fx.t * 6) | 0) !== (((fx.t - dt) * 6) | 0)) ripple(fx.to.x, fx.to.z, 0.6); }
    else if (fx.state === 'reel') {
      const e = u * u * (3 - 2 * u); fx.pos.lerpVectors(fx.from, fx.to, e); fx.pos.y = surface(fx.pos.x, fx.pos.z) + 0.02; fx.sag = 0.05;
      if (fx.hasFish) { fish.visible = true; fish.position.copy(fx.pos).add(new THREE.Vector3(0, 0.05, 0)); fish.rotation.set(Math.PI / 2, 0, Math.sin(tm * 14) * 0.5); bob.visible = false; }
      if (((fx.t * 8) | 0) !== (((fx.t - dt) * 8) | 0)) ripple(fx.pos.x, fx.pos.z, 0.5);
      if (u >= 1) fx.state = 'float2';
    } else if (fx.state === 'lift' && tip) { bob.visible = false; fx.pos.copy(tip).add(new THREE.Vector3(0, -0.85, 0)); fish.visible = fx.hasFish; fish.position.copy(fx.pos); fish.rotation.set(0, tm * 1.2, Math.sin(tm * 5) * 0.18); fx.sag = 0.02; }
    else if (fx.state === 'float2') { fx.pos.y = surface(fx.pos.x, fx.pos.z) + 0.02; }
    if (bob.visible) { bob.position.copy(fx.pos); bob.rotation.z = Math.sin(tm * 3) * 0.08; }
    // the line: from the rod tip to the bobber (or the fish), hanging in a shallow curve
    if (line.visible && tip) {
      const end = fx.state === 'lift' ? fx.pos.clone().add(new THREE.Vector3(0, 0.1, 0)) : fx.pos, a = tip;
      for (let i = 0; i < N; i++) { const k = i / (N - 1); pts[i * 3] = a.x + (end.x - a.x) * k; pts[i * 3 + 1] = a.y + (end.y - a.y) * k - Math.sin(k * Math.PI) * fx.sag * (0.4 + a.distanceTo(end) * 0.25); pts[i * 3 + 2] = a.z + (end.z - a.z) * k; }
      geo.attributes.position.needsUpdate = true;
    }
    for (let i = rings.length - 1; i >= 0; i--) { const r = rings[i]; r.t += dt; const k = r.t / r.life; r.m.scale.setScalar(1 + k * 5 * r.big); r.m.material.opacity = 0.5 * (1 - k); if (k >= 1) { root.remove(r.m); rings.splice(i, 1); } }
  };
  return fx;
}
/** Water point to cast to: the farthest wet spot (up to `max` m) in direction `ba` (radians, world x/z), at least `min` m out; falls back to `min`. */
export function castTarget(px, pz, ba, depthAt, { min = 3, max = 7 } = {}) {
  let best = min; for (let d = min; d <= max; d += 0.5) if (depthAt(px + Math.cos(ba) * d, pz + Math.sin(ba) * d) > 0.3) best = d;
  return { x: px + Math.cos(ba) * best, z: pz + Math.sin(ba) * best, d: best };
}
