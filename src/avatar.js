// Character customisation: swappable hair (procedural meshes parented to the head bone), hair colour, and a jacket
// hue shift applied in the material shader (only texels near the jacket's original hue are rotated, so skin/trousers/boots stay).
import * as THREE from 'three';

export const HAIR_STYLES = [['short', 'Short'], ['quiff', 'Quiff'], ['long', 'Long'], ['curly', 'Curly'], ['spiky', 'Spiky'], ['none', 'No hair']];
export const HAIR_COLOURS = [['blonde', '#e0bd62'], ['light brown', '#9a6b3c'], ['brown', '#5a3a22'], ['black', '#1c1a1d'], ['ginger', '#b5521f'], ['silver', '#c9ccd2'], ['blue', '#3f6fd8'], ['pink', '#e06fa8'], ['green', '#4caf6a']];
export const JACKET_COLOURS = [['blue', 0.60], ['red', 0.0], ['green', 0.36], ['orange', 0.07], ['purple', 0.78], ['teal', 0.5], ['yellow', 0.14]];
export const SKIN_TONES = [['light', '#f1c9a8'], ['fair', '#e3a982'], ['medium', '#c68a60'], ['tan', '#a56a45'], ['deep', '#6e4228']];
export const DEFAULT_LOOK = { style: 'short', colour: 'blonde', jacket: 'blue', skin: 'fair' };
export const JACKET_BASE_HUE = 0.6;

/** Rig-aware set-up. `avatar` comes from makeAvatarFromModel; returns {set(look), ready}. */
export function makeCustomiser(avatar) {
  let head = null, topY = -1e9; const root = avatar;
  root.updateMatrixWorld(true);
  const bones = []; root.traverse(o => { if (o.isBone) bones.push(o); if (o.isSkinnedMesh) { const p = o.geometry.attributes.position, v = new THREE.Vector3(); o.updateMatrixWorld(true);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(o.bindMatrix ? o.matrixWorld : o.matrixWorld); topY = Math.max(topY, v.y); } } });
  topY = new THREE.Box3().setFromObject(root, true).max.y;   // precise (skinned) bounds
  head = bones.find(b => /^head$/i.test(b.name)) || null;
  const mats = []; root.traverse(o => { if (o.isMesh && o.material) { o.material.onBeforeCompile = jacketPatch; o.material.customProgramCacheKey = () => 'jacket'; mats.push(o.material); } });
  const hairGroup = new THREE.Group(); let hairMat = new THREE.MeshStandardMaterial({ color: 0xe0bd62, roughness: 0.78, metalness: 0 });
  let R = 0.11, centreY = 0, API_fit = null;
  if (head) {
    // Fit to the real head: bounding box of the vertices skinned (weight > 0.5) to the Head bone, in world space.
    const hp = new THREE.Vector3(); head.getWorldPosition(hp); const hb = new THREE.Box3(), sms = []; root.traverse(o => { if (o.isSkinnedMesh) sms.push(o); });
    for (const sm of sms) { const hset = new Set(sm.skeleton.bones.map((b, i) => (/head/i.test(b.name) ? i : -1)).filter(i => i >= 0)), si = sm.geometry.attributes.skinIndex, sw = sm.geometry.attributes.skinWeight, v = new THREE.Vector3(); sm.updateMatrixWorld(true);
      for (let i = 0; i < si.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (hset.has(si.getComponent(i, k))) w += sw.getComponent(i, k); if (w > 0.6) { sm.getVertexPosition(i, v); v.applyMatrix4(sm.matrixWorld); hb.expandByPoint(v); } } }
    let cx = hp.x, cz = hp.z; if (!hb.isEmpty() && (hb.max.y - hb.min.y) > 0.05) { const c = hb.getCenter(new THREE.Vector3()), sz = hb.getSize(new THREE.Vector3()); R = Math.max(sz.x, sz.z) / 2; centreY = hb.min.y + Math.max(sz.y, R * 2) - R; cx = c.x; cz = c.z; topY = hb.max.y; API_fit = { box: hb.min.toArray().concat(hb.max.toArray()).map(x => +x.toFixed(3)), R: +R.toFixed(3) }; }
    else { R = Math.max(0.07, (topY - hp.y) / 2.25); centreY = topY - R; }
    const wq = new THREE.Quaternion(); head.getWorldQuaternion(wq); const ws = new THREE.Vector3(); head.getWorldScale(ws);
    head.add(hairGroup);
    const target = new THREE.Vector3(cx, centreY, cz); head.worldToLocal(target); hairGroup.position.copy(target);
    hairGroup.quaternion.copy(wq.invert()); hairGroup.scale.set(1 / ws.x, 1 / ws.y, 1 / ws.z);
  } else { root.add(hairGroup); hairGroup.position.y = 1.4; }
  const API = { head, R, topY, bones: bones.length, hairGroup, fit: API_fit, look: { ...DEFAULT_LOOK } };
  API.set = (look) => {
    API.look = { ...API.look, ...look }; const L = API.look;
    hairMat.color.set(HAIR_COLOURS.find(c => c[0] === L.colour)?.[1] || '#e0bd62');
    for (const c of [...hairGroup.children]) { hairGroup.remove(c); c.geometry?.dispose(); }
    for (const m of buildHair(L.style, R, hairMat)) hairGroup.add(m);
    const hue = JACKET_COLOURS.find(c => c[0] === L.jacket)?.[1] ?? JACKET_BASE_HUE;
    for (const m of mats) if (m.userData.jacketU) m.userData.jacketU.uHue.value = hue; else m.userData.pendingHue = hue;
    jacketHue = hue;
    const hsl = {}; new THREE.Color().setHSL(hue, 0.72, 0.42).getHexString();
    for (const m of mats) { if (/^jacket$/i.test(m.name) && !m.map) m.color.setHSL(hue, 0.72, 0.42); if (/^skin$/i.test(m.name) && !m.map) m.color.set(SKIN_TONES.find(c => c[0] === L.skin)?.[1] || '#e3a982'); }
  };
  let jacketHue = JACKET_BASE_HUE;
  function jacketPatch(sh) {
    const u = { uHue: { value: jacketHue }, uBase: { value: JACKET_BASE_HUE } }; sh.uniforms.uHue = u.uHue; sh.uniforms.uBase = u.uBase; this.userData.jacketU = u;
    sh.fragmentShader = 'uniform float uHue, uBase;\nvec3 rgb2hsv(vec3 c){ vec4 K=vec4(0.,-1./3.,2./3.,-1.); vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g)); vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r)); float d=q.x-min(q.w,q.y); return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x); }\nvec3 hsv2rgb(vec3 c){ vec4 K=vec4(1.,2./3.,1./3.,3.); vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www); return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y); }\n' + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\n { vec3 hsv = rgb2hsv(diffuseColor.rgb); float dh = abs(hsv.x - uBase); dh = min(dh, 1. - dh); float m = smoothstep(0.09, 0.04, dh) * smoothstep(0.22, 0.4, hsv.y); hsv.x = mix(hsv.x, uHue, m); diffuseColor.rgb = hsv2rgb(hsv); }\n#endif');
  }
  return API;
}

function buildHair(style, R, mat) {
  const out = []; const mk = (geo, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, 0, rz); m.castShadow = true; out.push(m); return m; };
  const cap = (theta, r = 1.07) => new THREE.SphereGeometry(R * r, 28, 18, 0, Math.PI * 2, 0, theta);
  switch (style) {
    case 'short': { mk(cap(1.52)); mk(new THREE.SphereGeometry(R * 1.05, 20, 12, 0, Math.PI * 2, 1.3, 0.55), 0, -0.1 * R, -0.3 * R, 1, 0.9, 0.85); break; }
    case 'quiff': { mk(cap(1.48)); mk(new THREE.SphereGeometry(R, 20, 14), 0, 0.95 * R, 0.55 * R, 0.62, 0.36, 0.78, -0.35); mk(new THREE.SphereGeometry(R * 1.04, 18, 10, 0, Math.PI * 2, 1.3, 0.55), 0, -0.1 * R, -0.3 * R, 1, 0.9, 0.85); break; }
    case 'long': { mk(cap(1.62, 1.09)); mk(new THREE.SphereGeometry(R, 22, 16), 0, -0.55 * R, -0.42 * R, 1.08, 1.5, 0.82); mk(new THREE.SphereGeometry(R, 14, 12), -0.98 * R, -0.35 * R, 0.0, 0.3, 1.0, 0.7); mk(new THREE.SphereGeometry(R, 14, 12), 0.98 * R, -0.35 * R, 0.0, 0.3, 1.0, 0.7); break; }
    case 'curly': { const n = 34; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, phi = i * 2.399963, th = Math.acos(1 - t * 1.12), r = R * 1.02; mk(new THREE.SphereGeometry(R * 0.3, 10, 8), Math.sin(th) * Math.cos(phi) * r, Math.cos(th) * r * 1.02, Math.sin(th) * Math.sin(phi) * r); } mk(cap(1.6, 1.02)); break; }
    case 'spiky': { mk(cap(1.5)); const n = 16; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, phi = i * 2.399963, th = Math.acos(1 - t * 0.95) * 0.95, d = new THREE.Vector3(Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi)); const cone = new THREE.ConeGeometry(R * 0.2, R * 0.7, 6); const m = mk(cone, d.x * R * 1.18, d.y * R * 1.18, d.z * R * 1.18); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); } break; }
    default: break;
  }
  return out;
}
