// Procedurally animated environmental life (no licensed animation needed): butterflies and soaring birds.
// Wings flap in the vertex shader from one shared clock; bodies move on smooth paths (no joints, so nothing can jitter).
import * as T from 'three';
import { groundAt, depthAt } from './terrain.js';
import { makeRng } from './rng.js';

function wingGeometry(span, chord) {
  // two wings (left/right) as triangles hinged on the body line; aSide = -1/+1 drives the flap angle
  const g = new T.BufferGeometry(), v = [0, 0, -chord * 0.5, span, 0, -chord * 0.55, span * 0.8, 0, chord * 0.6, 0, 0, chord * 0.1, 0, 0, -chord * 0.5, -span, 0, -chord * 0.55, -span * 0.8, 0, chord * 0.6, 0, 0, chord * 0.1];
  g.setAttribute('position', new T.Float32BufferAttribute(v, 3)); g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]); g.computeVertexNormals(); return g;
}
function flapMaterial(color, rate, amp) {
  const m = new T.MeshLambertMaterial({ color, side: T.DoubleSide });
  m.onBeforeCompile = (sh) => { sh.uniforms.uT = shared; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float ph = float(gl_InstanceID) * 1.37; float fl = sin(uT * ${rate.toFixed(1)} + ph) * ${amp.toFixed(2)};
    transformed.y += abs(position.x) * fl; transformed.x *= cos(fl * 0.6);`); };
  m.customProgramCacheKey = () => 'flap' + rate + amp; return m;
}
const shared = { value: 0 };

export function makeButterflies(n = 14, seed = 4) {
  const rng = makeRng(seed), mesh = new T.InstancedMesh(wingGeometry(0.065, 0.06), flapMaterial(0xffffff, 26, 1.1), n), c = new T.Color(), d = new T.Object3D();
  const pal = ['#f2a43a', '#f4f0e0', '#6fa8e8', '#e8c43a', '#d9663a'];
  const st = Array.from({ length: n }, (_, i) => ({ ax: (rng() - 0.5) * 70, az: (rng() - 0.5) * 70, r: 2 + rng() * 4, sp: 0.25 + rng() * 0.3, ph: rng() * 6.28, h: 0.5 + rng() * 1.2 }));
  for (let i = 0; i < n; i++) { c.set(pal[i % pal.length]); mesh.setColorAt(i, c); }
  mesh.frustumCulled = false; mesh.castShadow = false;
  mesh.userData.update = (t, focus, speed = 1, amount = 1) => {
    shared.value = t * (speed ? 1 : 0);
    const k = Math.floor(n * amount); mesh.count = k;
    for (let i = 0; i < k; i++) { const o = st[i], tt = t * speed * o.sp + o.ph;
      let ax = o.ax + Math.round((focus.x - o.ax) / 70) * 70, az = o.az + Math.round((focus.z - o.az) / 70) * 70;       // wrap anchors around the player
      const x = ax + Math.sin(tt) * o.r + Math.sin(tt * 2.3) * 0.7, z = az + Math.cos(tt * 0.8) * o.r + Math.cos(tt * 1.9) * 0.7;
      const y = Math.max(groundAt(x, z), 0) + o.h + Math.sin(tt * 3.1) * 0.25, vx = Math.cos(tt) * o.r - 0, vz = -Math.sin(tt * 0.8) * o.r * 0.8;
      d.position.set(x, y, z); d.rotation.set(0.25 * Math.sin(tt * 2), Math.atan2(vx, vz), 0); d.scale.setScalar(1); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}

export function makeBirds(n = 7, seed = 8) {
  const rng = makeRng(seed), mesh = new T.InstancedMesh(wingGeometry(0.55, 0.28), flapMaterial(0x2c2a2a, 5.5, 0.55), n), d = new T.Object3D();
  const st = Array.from({ length: n }, () => ({ cx: (rng() - 0.5) * 120, cz: (rng() - 0.5) * 140, r: 22 + rng() * 30, sp: 0.06 + rng() * 0.07, ph: rng() * 6.28, h: 26 + rng() * 22 }));
  mesh.frustumCulled = false; mesh.castShadow = false;
  mesh.userData.update = (t, focus, speed = 1, visible = 1) => {
    mesh.visible = visible > 0.05; if (!mesh.visible) return; shared.value = t * (speed ? 1 : 0);
    for (let i = 0; i < n; i++) { const o = st[i], a = t * speed * o.sp + o.ph, x = focus.x * 0.5 + o.cx * 0.5 + Math.cos(a) * o.r, z = focus.z * 0.5 + o.cz * 0.5 + Math.sin(a) * o.r;
      d.position.set(x, o.h + Math.sin(a * 2.2) * 2, z); d.rotation.set(0, -a + Math.PI, -0.35); d.scale.setScalar(1.6); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}
