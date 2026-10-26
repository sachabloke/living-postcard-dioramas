// The cabin, built in visible stages (floor, log walls with a door gap, roof, door). Procedural three.js geometry, original to this build.
import * as THREE from 'three';
import { groundAt, HUT } from './terrain.js';

const rot = (m, x, y, z) => { m.rotation.set(x, y, z); return m; };
export function makeHut() {
  const g = new THREE.Group(), h = HUT.half, parts = { hut1: new THREE.Group(), hut2: new THREE.Group(), hut3: new THREE.Group(), hut4: new THREE.Group() };
  for (const p of Object.values(parts)) { p.visible = false; g.add(p); }
  const corners = [[-h, -h], [h, -h], [h, h], [-h, h], [0, 0]].map(([dx, dz]) => groundAt(HUT.x + dx, HUT.z + dz));
  const base = Math.max(...corners) + 0.06;                       // floor sits on the highest corner; skirt hides the slope below
  const wood = (c, r = 0.85) => new THREE.MeshStandardMaterial({ color: c, roughness: r }), logM = wood(0x6a4a2c), logM2 = wood(0x5c3f25), floorM = wood(0x8c6c46, 0.9), roofM = wood(0x5b4a33, 0.95), mossM = wood(0x4f6c36, 1.0), doorM = wood(0x7a5532);
  const add = (grp, mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); return mesh; };
  // 1 floor: planks + a skirt down to the lowest ground
  const low = Math.min(...corners) - 0.1;
  add(parts.hut1, new THREE.Mesh(new THREE.BoxGeometry(h * 2 + 0.3, 0.14, h * 2 + 0.3), floorM), 0, base - 0.07, 0);
  add(parts.hut1, new THREE.Mesh(new THREE.BoxGeometry(h * 2 + 0.2, base - low, h * 2 + 0.2), logM2), 0, (base + low) / 2 - 0.08, 0);
  for (let i = 0; i < 9; i++) add(parts.hut1, new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.01, h * 2 + 0.3), logM2), -h + 0.2 + i * (h * 2 - 0.1) / 8, base + 0.001, 0);
  // 2 walls: stacked logs. North/south/east full; west has the door gap.
  const courses = 9, r = 0.135;
  const logGeo = (len) => new THREE.CylinderGeometry(r, r, len, 10);
  for (let c = 0; c < courses; c++) {
    const y = base + r + c * r * 1.92, m = c % 2 ? logM : logM2, o = (c % 2) * 0.1;
    add(parts.hut2, rot(new THREE.Mesh(logGeo(h * 2 + 0.5), m), 0, 0, Math.PI / 2), 0 + o, y, -h);
    add(parts.hut2, rot(new THREE.Mesh(logGeo(h * 2 + 0.5), m), 0, 0, Math.PI / 2), 0 - o, y, h);
    add(parts.hut2, rot(new THREE.Mesh(logGeo(h * 2 + 0.5), m), Math.PI / 2, 0, 0), h, y + 0.0, 0 + o);
    const seg = (h * 2 - HUT.door) / 2;                                                        // two west-wall segments either side of the doorway
    for (const s of [-1, 1]) add(parts.hut2, rot(new THREE.Mesh(logGeo(seg + 0.1), m), Math.PI / 2, 0, 0), -h, y, s * (HUT.door / 2 + seg / 2));
  }
  const top = base + courses * r * 1.92 + r;
  // 3 roof: two sloped planks with a moss top, ridge log, gable infill
  const rw = h * 1.5, pitch = 0.62;
  for (const s of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(h * 2 + 0.9, 0.14, rw), roofM); slab.rotation.x = s * pitch; add(parts.hut3, slab, 0, top + 0.55, s * h * 0.46 - 0.0);
    const moss = new THREE.Mesh(new THREE.BoxGeometry(h * 2 + 0.95, 0.05, rw * 0.96), mossM); moss.rotation.x = s * pitch; add(parts.hut3, moss, 0, top + 0.62 + 0.0, s * h * 0.46);
  }
  add(parts.hut3, rot(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, h * 2 + 1.0, 8), logM), 0, 0, Math.PI / 2), 0, top + 1.28, 0);
  for (const s of [-1, 1]) { const tri = new THREE.Mesh(new THREE.ConeGeometry(h * 1.18, 1.25, 4, 1), logM); tri.rotation.y = Math.PI / 4; tri.scale.set(1, 1, 0.12); tri.rotation.y = 0; tri.scale.set(0.12, 1, 1); tri.rotation.set(0, 0, 0); add(parts.hut3, tri, s * (h - 0.05), top + 0.6, 0); tri.scale.set(0.1, 1, 1.0); }
  // 4 door: hinged on the north jamb, swung half open outwards (west)
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, HUT.door - 0.1), doorM); const hinge = new THREE.Group(); hinge.position.set(-h, base, -HUT.door / 2); door.position.set(0, 0.95, (HUT.door - 0.1) / 2); hinge.add(door); hinge.rotation.y = 1.25; door.castShadow = true; parts.hut4.add(hinge);
  g.position.set(HUT.x, 0, HUT.z); g.userData.base = base;
  g.userData.set = (built) => { for (const k of Object.keys(parts)) parts[k].visible = !!built[k]; };
  g.userData.parts = parts; return g;
}

/** A quick lean-to: two tall front poles, two short back poles, a slanted thatch roof and a stick back wall. Footprint ~2.4 x 2.0 m, opening faces +z. */
export function makeShelterMesh() {
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2c, roughness: 0.9 }), thatch = new THREE.MeshStandardMaterial({ color: 0x6f7a3a, roughness: 1.0 }), sticks = new THREE.MeshStandardMaterial({ color: 0x5c3f25, roughness: 1.0 });
  const pole = (x, z, h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, h, 7), wood); m.position.set(x, h / 2, z); m.castShadow = true; g.add(m); };
  pole(-1.1, 0.9, 1.9); pole(1.1, 0.9, 1.9); pole(-1.1, -0.9, 1.0); pole(1.1, -0.9, 1.0);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 2.4), thatch); roof.position.set(0, 1.5, 0); roof.rotation.x = Math.atan2(0.9, 1.8); roof.castShadow = true; g.add(roof);
  for (let i = 0; i < 9; i++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 5), sticks); s.position.set(-1.0 + i * 0.25, 0.5, -0.92); s.rotation.z = (i % 2 ? 0.05 : -0.05); g.add(s); }
  const floor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 1.6), new THREE.MeshStandardMaterial({ color: 0x7a6a40, roughness: 1 })); floor.position.set(0, 0.02, 0.05); g.add(floor);
  return g;
}
