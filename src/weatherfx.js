// Weather rendering. createBolt is copied from living-postcard-mobile-v4/src/fx.js (Claude-authored Postcard lightning);
// the rain streaks, cloud/wet hooks and leaf drift are new for this build.
import * as T from 'three';
import { groundAt, riverX, waterY } from './terrain.js';

export function createBolt({radius = 112}) {
  const maxSeg = 160, pos = new Float32Array(maxSeg * 4 * 3), ord = new Float32Array(maxSeg * 4), idx = []; for (let i = 0; i < maxSeg; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aOrd', new T.BufferAttribute(ord, 1)); g.setIndex(idx); g.setDrawRange(0, 0);
  const u = {uReveal: {value: 0}, uFlash: {value: 0}};
  const m = new T.ShaderMaterial({uniforms: u, transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
    vertexShader: 'attribute float aOrd; varying float vO; void main(){vO=aOrd;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uReveal,uFlash; varying float vO; void main(){ if(vO>uReveal) discard; float a=clamp(uFlash*1.4,0.,1.)*(.55+.45*smoothstep(uReveal-.25,uReveal,vO)); gl_FragColor=vec4(vec3(.85,.9,1.)*a,a);}'});
  const mesh = new T.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = -1;
  let az = 0, shift = 0;
  const r = seed => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  function strike(azimuth, seed) {
    const rnd = r(seed * 7919 + 13); az = azimuth; let n = 0;
    const seg = (x0, y0, x1, y1, w, o0, o1) => { if (n >= maxSeg) return; const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w, k = n * 4;
      const P = [[x0 - nx, y0 - ny, o0], [x0 + nx, y0 + ny, o0], [x1 - nx, y1 - ny, o1], [x1 + nx, y1 + ny, o1]];
      P.forEach((p, i) => { pos[(k + i) * 3] = p[0]; pos[(k + i) * 3 + 1] = p[1]; pos[(k + i) * 3 + 2] = 0; ord[k + i] = p[2]; }); n++; };
    const branch = (x, y, depth, o) => { const steps = depth ? 7 : 16; let cx = x, cy = y; for (let i = 0; i < steps; i++) { const nx = cx + (rnd() - .5) * (depth ? 7 : 5), ny = cy - (depth ? 3 : 2.6) - rnd() * 2, oo = o + (i + 1) / steps * (depth ? .18 : .55); seg(cx, cy, nx, ny, depth ? .22 : .5, o + i / steps * (depth ? .18 : .55), oo); if (!depth && i > 2 && rnd() < .3) branch(nx, ny, 1, oo); cx = nx; cy = ny; if (cy < 1) break; } };
    branch(0, 46, 0, 0); g.setDrawRange(0, n * 6); g.attributes.position.needsUpdate = true; g.attributes.aOrd.needsUpdate = true;
    // place: local (x,y) -> world on the arc: x along the tangent, y up; stored in position.xy, converted below every frame via mesh transform
    mesh.userData.count = n;
  }
  function set(progress, flash, camera) {
    u.uReveal.value = Math.min(1, progress * 1.15); u.uFlash.value = flash; mesh.visible = flash > .01 && progress >= 0;
    shift = (progress - .5) * 24; const tx = Math.cos(az), tz = Math.sin(az); mesh.position.set(camera.position.x + Math.sin(az) * radius * -1 + tx * shift * 0, camera.position.y, camera.position.z - Math.cos(az) * radius);
    mesh.rotation.set(0, -az, 0); mesh.position.x = camera.position.x + Math.sin(az) * radius + (Math.cos(az)) * shift; mesh.position.z = camera.position.z - Math.cos(az) * radius + (Math.sin(az)) * shift;
  }
  return {mesh, uniforms: u, strike, set};
}


/** Rain: thin falling streaks wrapped in a box that follows the camera. One draw call; density scales with `budget`. */
export function makeRain(count = 3200) {
  const pos = new Float32Array(count * 6), g = new T.BufferGeometry();
  let s = 12345; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const aR = new Float32Array(count * 2 * 4), aE = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) { const a = [rnd(), rnd(), rnd(), rnd()]; for (let k = 0; k < 2; k++) { aR.set(a, (i * 2 + k) * 4); aE[i * 2 + k] = k; } }
  g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aR', new T.BufferAttribute(aR, 4)); g.setAttribute('aE', new T.BufferAttribute(aE, 1));
  const u = { uTime: { value: 0 }, uBox: { value: new T.Vector3(38, 24, 38) }, uVel: { value: new T.Vector3(-2.2, -17, -0.8) }, uAmt: { value: 0 }, uColor: { value: new T.Color(0xbcd0e6) }, uGround: { value: 0 } };
  const m = new T.ShaderMaterial({ uniforms: u, transparent: true, depthWrite: false, fog: false,
    vertexShader: `uniform float uTime,uAmt,uGround; uniform vec3 uBox,uVel; attribute vec4 aR; attribute float aE; varying float vA;
      void main(){ vec3 c = cameraPosition; vec3 p = aR.xyz*uBox + uVel*uTime*(.8+.4*aR.w); vec3 rel = mod(p - c + uBox*.5, uBox) - uBox*.5;
        vec3 head = c + rel; head.y = max(head.y, uGround + .02); vec3 tail = head - normalize(uVel) * (.55 + .5*aR.w);
        vec3 w = mix(head, tail, aE); float edge = 1. - max(max(abs(rel.x)/(uBox.x*.5), abs(rel.z)/(uBox.z*.5)), abs(rel.y)/(uBox.y*.5));
        float vis = step(aR.w, uAmt); vA = vis * smoothstep(0., .25, edge) * (1. - aE*.7) * (1. - smoothstep(10., 19., length(rel.xz)) * .5);
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.); }`,
    fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ if(vA<.02) discard; gl_FragColor = vec4(uColor, vA*.8); }' });
  const ls = new T.LineSegments(g, m); ls.frustumCulled = false; ls.renderOrder = 6;
  return { object: ls, uniforms: u, setAmount(a) { u.uAmt.value = a; ls.visible = a > 0.02; } };
}

/** Leaves drifting down the river on the current (JS-positioned: ~28 instanced quads following the true river centreline). */
export function makeRiverLeaves(n = 28) {
  const geo = new T.CircleGeometry(0.11, 6); geo.rotateX(-Math.PI / 2);
  const mat = new T.MeshLambertMaterial({ color: 0xb98a2e, side: T.DoubleSide }), mesh = new T.InstancedMesh(geo, mat, n), d = new T.Object3D(), c = new T.Color();
  const st = Array.from({ length: n }, (_, i) => ({ z: -84 + ((i * 37) % 168), off: ((i * 53) % 100) / 100 * 5 - 2.5, ph: i * 1.7, sp: 0.8 + ((i * 29) % 10) / 14, hue: i % 3 }));
  for (let i = 0; i < n; i++) { c.set(['#b98a2e', '#8c9a3a', '#a65a2a'][st[i].hue]); mesh.setColorAt(i, c); }
  mesh.frustumCulled = false;
  mesh.userData.update = (dt, t, center, moving = 1) => {
    for (let i = 0; i < n; i++) { const o = st[i]; o.z += dt * o.sp * moving; if (o.z > center.z + 84) o.z -= 168; if (o.z < center.z - 84) o.z += 168;   // leaves drift downstream inside a window that follows the player
      const x = riverX(o.z) + o.off * (0.8 + 0.2 * Math.sin(o.z * 0.2)), y = waterY(o.z) + 0.02 + 0.015 * Math.sin(t * 2 + o.ph);
      d.position.set(x, y, o.z); d.rotation.set(0.08 * Math.sin(t * 1.5 + o.ph), t * 0.4 + o.ph, 0.08 * Math.cos(t * 1.3 + o.ph)); d.visible = true; d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); }
    mesh.instanceMatrix.needsUpdate = true;
  };
  return mesh;
}

/** Rainbow: seven additive bands (adapted from Living Postcard v4 fx.js createRainbow). Placed opposite the sun, facing the camera; strength 0..1. */
export function createRainbow({ radius = 30, thickness = 0.9 } = {}) {
  const grp = new T.Group(), cols = ['#ff4b3a', '#ff9a2e', '#ffe14a', '#6ddc5a', '#43b6ff', '#4a63ff', '#9a4aff'], mats = [];
  cols.forEach((c, i) => { const m = new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }); mats.push(m);
    const r = radius - i * thickness; grp.add(new T.Mesh(new T.RingGeometry(r - thickness, r, 72, 1, 0, Math.PI), m)); });
  grp.renderOrder = 4; grp.visible = false;
  return { group: grp, setStrength(v) { mats.forEach(m => { m.opacity = 0.26 * v; }); grp.visible = v > 0.02; }, place(player, sunDir, camera) { const hx = -sunDir[0], hz = -sunDir[2], l = Math.hypot(hx, hz) || 1; grp.position.set(player.x + hx / l * 170, player.y - 4, player.z + hz / l * 170); grp.rotation.y = Math.atan2(camera.position.x - grp.position.x, camera.position.z - grp.position.z); grp.scale.setScalar(2.3); } };
}
