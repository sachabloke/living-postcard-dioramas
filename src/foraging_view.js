// PLACEHOLDER plant models for the foraging trial. Simple primitives, each species distinguishable by shape and colour, each marked with a pale ring on the ground.
// Swap-in point: replace `build(sp)` with a clone of Grok's world model once outputs/forest-foraging-assets/MANIFEST.json lists it (assetKey in species.json).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { plantsInCell, plantAt } from './foraging.js';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
const mats = { stem: M(0x3f5a2a), thorn: M(0x5a3a2a), leaf: M(0x3f7a35), leaf2: M(0x4f8f3f), bk: M(0x241a33, { roughness: 0.4 }), bkRed: M(0x7a2a3a), sr: M(0xd33a3a, { roughness: 0.5 }), srLeaf: M(0x58a13f), hz: M(0x5b4026), hzLeaf: M(0x62953a), nut: M(0xb98a4a), husk: M(0x8fb04a), mint: M(0x2f7a45), mintStem: M(0x7a3b3b), flower: M(0xb48ad0), ring: M(0xffb347, { transparent: true, opacity: 0.55, side: THREE.DoubleSide }) };
const add = (g, geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = false; g.add(m); return m; };
const sph = (r) => new THREE.SphereGeometry(r, 8, 6), cyl = (r, h) => new THREE.CylinderGeometry(r * 0.7, r, h, 6), cone = (r, h) => new THREE.ConeGeometry(r, h, 6);
function build(sp) {
  const g = new THREE.Group();
  if (sp === 'blackberry') {                                                       // arching prickly stems, dark aggregate fruit
    for (let i = 0; i < 5; i++) { const a = i * 1.26; add(g, cyl(0.03, 1.5), mats.stem, Math.cos(a) * 0.3, 0.75, Math.sin(a) * 0.3, Math.sin(a) * 0.5, -Math.cos(a) * 0.5); }
    for (let i = 0; i < 10; i++) { const a = i * 0.63, r = 0.35 + (i % 3) * 0.2; add(g, new THREE.SphereGeometry(0.17, 6, 4), mats.leaf, Math.cos(a) * r, 0.5 + (i % 4) * 0.25, Math.sin(a) * r).scale.set(1, 0.4, 1); }
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4; add(g, sph(0.07), i % 3 ? mats.bk : mats.bkRed, Math.cos(a) * 0.5, 0.45 + (i % 3) * 0.2, Math.sin(a) * 0.5); }
  } else if (sp === 'wild_strawberry') {                                           // low plant, three-leaflet leaves, small red fruit, runners
    for (let i = 0; i < 6; i++) { const a = i * 1.05, c = [Math.cos(a) * 0.22, Math.sin(a) * 0.22]; for (let k = 0; k < 3; k++) add(g, sph(0.1), mats.srLeaf, c[0] + Math.cos(a + k * 2.1) * 0.08, 0.1, c[1] + Math.sin(a + k * 2.1) * 0.08).scale.set(1, 0.3, 0.8); }
    for (let i = 0; i < 4; i++) { const a = i * 1.6 + 0.3; add(g, cone(0.05, 0.1), mats.sr, Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3, Math.PI, 0); }
    add(g, cyl(0.008, 0.9), mats.stem, 0.5, 0.03, 0, 0, Math.PI / 2);
  } else if (sp === 'hazelnut') {                                                  // multi-stem shrub, rounded leaves, nuts in leafy husks
    for (let i = 0; i < 5; i++) { const a = i * 1.26; add(g, cyl(0.05, 2.1), mats.hz, Math.cos(a) * 0.25, 1.0, Math.sin(a) * 0.25, Math.sin(a) * 0.18, -Math.cos(a) * 0.18); }
    for (let i = 0; i < 12; i++) { const a = i * 0.52, r = 0.35 + (i % 3) * 0.25; add(g, sph(0.3), mats.hzLeaf, Math.cos(a) * r, 1.2 + (i % 4) * 0.28, Math.sin(a) * r).scale.set(1, 0.7, 1); }
    for (let i = 0; i < 5; i++) { const a = i * 1.3; add(g, sph(0.055), mats.nut, Math.cos(a) * 0.7, 1.3 + (i % 3) * 0.2, Math.sin(a) * 0.7); add(g, cone(0.07, 0.1), mats.husk, Math.cos(a) * 0.7, 1.38 + (i % 3) * 0.2, Math.sin(a) * 0.7); }
  } else {                                                                         // water mint: square reddish stems, opposite oval leaves, lilac flower head
    for (let i = 0; i < 4; i++) { const a = i * 1.57, x = Math.cos(a) * 0.12, z = Math.sin(a) * 0.12; add(g, new THREE.BoxGeometry(0.02, 0.6, 0.02), mats.mintStem, x, 0.3, z);
      for (let k = 1; k <= 3; k++) for (const s of [-1, 1]) add(g, sph(0.07), mats.mint, x + s * 0.07, 0.1 + k * 0.14, z).scale.set(1, 0.3, 0.7); add(g, sph(0.06), mats.flower, x, 0.64, z); }
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.65, 24), mats.ring); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; ring.userData.ring = true; g.add(ring);   // PLACEHOLDER marker
  return g;
}
/** Keeps the plants of every 32 m cell within `radius` cells of the player in the scene. env(x,z) is the terrain sampler. */
/** Loads Grok's world models (one default state per species: ripe fruit/nuts, mint in flower). Returns { id: Object3D } for those that loaded; the rest keep the placeholder shapes. */
export async function loadForageAssets(ids, base = 'assets/models/forage/world/') {
  const loader = new GLTFLoader(), out = {};
  await Promise.all(ids.map(id => loader.loadAsync(`${base}${id}.glb`).then(g => { g.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); out[id] = g.scene; }).catch(() => {})));
  return out;
}
export function makeForageView(scene, env, { cell = 32, radius = 2, assets = {} } = {}) {
  const root = new THREE.Group(); root.name = 'forage-placeholders'; scene.add(root); const cells = new Map(), byId = new Map();
  const view = {
    root, plants: [],
    update(px, pz, resting = () => false) {
      const cx = Math.floor(px / cell), cz = Math.floor(pz / cell), want = new Set(); let changed = false;
      for (let i = -radius; i <= radius; i++) for (let j = -radius; j <= radius; j++) {
        const k = `${cx + i},${cz + j}`; want.add(k); if (cells.has(k)) continue;
        const plants = plantsInCell(cx + i, cz + j, env, cell), grp = new THREE.Group();
        for (const p of plants) { const o = assets[p.sp] ? assets[p.sp].clone(true) : build(p.sp); o.position.set(p.x, p.y, p.z); o.rotation.y = p.rot; o.scale.setScalar(p.scale); o.userData.plant = p; grp.add(o); byId.set(p.id, o); }
        root.add(grp); cells.set(k, { grp, plants }); changed = true;
      }
      for (const [k, c] of cells) if (!want.has(k)) { root.remove(c.grp); for (const p of c.plants) byId.delete(p.id); cells.delete(k); changed = true; }
      if (changed) view.plants = [...cells.values()].flatMap(c => c.plants);
      for (const p of view.plants) { const o = byId.get(p.id); if (o) { const r = resting(p.id); o.visible = true; o.children.forEach(ch => { if (!ch.userData.ring) ch.visible = !r; }); } }   // a picked plant shows only its ring until it regrows
    },
    nearest(x, z, reach = 2) { return plantAt(view.plants, x, z, reach); },
  };
  return view;
}
