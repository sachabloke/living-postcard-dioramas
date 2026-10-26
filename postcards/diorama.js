// Postcard viewer: builds one BIOMES entry as a small floating disc of the Forest Maths world (own terrain function, the game's own models, sky,
// lighting, weather and Sidekick character) so you can turn it, change the hour and the weather, and judge what it would be like inside the game.
// Local only. Reads game modules and assets; changes nothing in the game.
import * as THREE from 'three';
import { BIOMES } from './biomes.js';
import { loadModels, instantiate, makeSky, makeFire, uTime, uWind } from '../src/scene.js';
import { atmosphere, withWeather, phaseName } from '../src/atmosphere.js';
import { makeRain } from '../src/weatherfx.js';
import { makeRng } from '../src/rng.js';
import { fbm } from '../src/terrain.js';
import { loadSidekick, loadSidekickAnims, makeSidekickAvatar } from '../src/sidekick-character.js';
import { makeRod, makeFishFx, castTarget } from '../src/fishfx.js';
import { softTexture } from '../src/textures.js';

const R = 26, $ = (id) => document.getElementById(id);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const WEATHERS = {
  clear: { cloud: 0.12, fog: 0, rain: 0, wet: 0, wind: 0.25, storm: 0, snow: 0, dust: 0 }, cloudy: { cloud: 0.75, fog: 0.05, rain: 0, wet: 0.1, wind: 0.5, storm: 0, snow: 0, dust: 0 },
  fog: { cloud: 0.5, fog: 0.8, rain: 0, wet: 0.3, wind: 0.05, storm: 0, snow: 0, dust: 0 }, rain: { cloud: 0.95, fog: 0.25, rain: 0.9, wet: 0.9, wind: 0.6, storm: 0, snow: 0, dust: 0 },
  snow: { cloud: 0.65, fog: 0.25, rain: 0, wet: 0, wind: 0.3, storm: 0, snow: 0.9, dust: 0 },
};
const WATER_STYLES = ['river', 'lake', 'sea', 'marsh'];

// ---------- renderer / scene ----------
const canvas = $('gl'), renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(48, 1.6, 0.1, 900);
const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 0.8), sun = new THREE.DirectionalLight(0xffffff, 2);
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(hemi, sun, sun.target); scene.fog = new THREE.Fog(0xaaccdd, 20, 140);
const sky = makeSky(); scene.add(sky);
const rain = makeRain(2600); scene.add(rain.object);
function size() { const w = innerWidth || 1280, h = innerHeight || 800; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', size); size();
// ---------- graphics settings (levels 0 Low .. 3 Ultra); defaults follow the recommended guide ----------
const QN = ['Low', 'Medium', 'High', 'Ultra'], GUIDE = { light: 2, near: 1, far: 2, vol: 2, part: 1 };
const QS = { light: 'Lighting quality', near: 'Near volumetric resolution', far: 'Far volumetric resolution', vol: 'Volumetric lighting quality', part: 'Particle lighting quality' };
const Q = { ...GUIDE }; try { Object.assign(Q, JSON.parse(localStorage.getItem('pc-quality') || '{}')); } catch (e) {}
const QT = { shadow: [512, 1024, 2048, 4096], shafts: [3, 5, 7, 9], shaftOp: [0.05, 0.08, 0.11, 0.14], nearK: [0.7, 0.55, 0.4, 0.3], far: [60, 80, 110, 150], cloud: [0.6, 0.8, 1, 1], motes: [0, 90, 170, 260], particle: [0.5, 0.75, 1, 1.3] };
function applyQuality() {
  const sz = QT.shadow[Q.light]; if (sun.shadow.mapSize.x !== sz) { sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  const ty = Q.light === 0 ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; if (renderer.shadowMap.type !== ty) { renderer.shadowMap.type = ty; scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true); }); }
  hemi.intensity = 0.8 + (Q.light === 0 ? 0.15 : 0);
  try { localStorage.setItem('pc-quality', JSON.stringify(Q)); } catch (e) {}
}

// ---------- model cache ----------
const MODELS = {};
async function need(names) {
  await Promise.all([...new Set(names)].filter(n => !MODELS[n]).map(async n => { try { Object.assign(MODELS, await loadModels([n], '../assets/models/')); } catch (e) { console.warn('model missing', n); } }));
}

// ---------- terrain ----------
function heightFn(b) {
  const { style, amp, k, tilt = 0 } = b.relief, s = b.seed;
  return (x, z) => {
    const r = Math.hypot(x, z), flat = sstep(1.8, 7.5, r);
    let h = (fbm(x * k + s, z * k + s * 0.7) - 0.5) * 2.2 * amp * flat;
    if (style === 'slope') return h - z * tilt;
    if (style === 'ridge') return h + 0.2 + 2.2 * sstep(10, 24, Math.hypot(x + 6, z + 14));
    if (style === 'river') { const cx = 7.5 + 4 * Math.sin(z * 0.17 + s), d = Math.abs(x - cx); return 0.35 + h * sstep(2.5, 8, d) - 1.25 * (1 - sstep(1.6, 4.4, d)); }
    if (style === 'lake') { const rr = Math.hypot(x - 9, z - 6); return 0.35 + h * sstep(4, 10, rr) - 1.5 * (1 - sstep(4.5, 9.5, rr)); }
    if (style === 'sea' && b.relief.beach) { const sx = 6 + 3 * Math.sin(z * 0.2 + s) + 2 * Math.sin(z * 0.07); return 0.35 + h * (1 - sstep(sx - 6, sx + 3, x)) * 0.8 - 0.42 * sstep(sx - 6, sx + 2, x) - 2.1 * sstep(sx + 2, sx + 12, x); }   // polish v1: a real beach: flat grass, a ~6 m sand ramp to the waterline, then a gentle shelf (no cliff)
    if (style === 'sea') { const sx = 6 + 3 * Math.sin(z * 0.2 + s) + 2 * Math.sin(z * 0.07), t = sstep(sx - 1, sx + 9, x); return 0.35 + h * (1 - t) - 2.4 * t; }
    if (style === 'marsh') { const m = 0.24 - 0.75 * sstep(0.47, 0.55, fbm(x * k + s, z * k)) + (fbm(x * 2.2, z * 2.2) - 0.5) * 0.1; return Math.max(m, 0.22 * (1 - sstep(3.5, 6.5, r))); }
    return h + 0.1;
  };
}
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (hex) => [(hex >> 16 & 255) / 255, (hex >> 8 & 255) / 255, (hex & 255) / 255].map(v => Math.pow(v, 2.2));   // sRGB -> linear (vertex colours are linear)
const RW = 95, ringR = (i, n) => RW * Math.pow(i / n, 1.7);   // fine rings near the middle, wide ones out to the far hills
const grainPatch = (shader) => {
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWP;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`).replace('#include <color_fragment>', `#include <color_fragment>
{ float d = length(vWP.xz - cameraPosition.xz);
  float fine = h21(floor(vWP.xz * 140.0)), mid = vn(vWP.xz * 9.0), big = vn(vWP.xz * 1.3 + 7.0);
  float fade = 1.0 - smoothstep(14.0, 50.0, d);
  float g = (fine - 0.5) * 0.34 * fade + (mid - 0.5) * 0.34 * fade + (big - 0.5) * 0.30;
  diffuseColor.rgb *= 1.0 + g;
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.02, 0.84), smoothstep(0.55, 0.9, mid) * 0.5 * fade); }`);
};
function buildTerrain(b, H, hasWater) {
  const rings = 120, segs = 180, pos = [], col = [], idx = [], g = b.ground, A = rgb(g.a), B = rgb(g.b), ROCK = rgb(g.rock), SHORE = rgb(g.shore), DIRT = rgb(g.dirt), SNOW = rgb(0xf4f8fb), FAR = rgb(0x5d7a62);
  const slopeAt = (x, z) => Math.hypot((H(x + 0.5, z) - H(x - 0.5, z)), (H(x, z + 0.5) - H(x, z - 0.5)));
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) {
    const r = ringR(i, rings), a = j / segs * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, h = H(x, z); pos.push(x, h, z);
    const n = fbm(x * 1.9 + b.seed, z * 1.9), n2 = fbm(x * 0.55, z * 0.55 + b.seed), sl = slopeAt(x, z); let c = mix3(A, B, sstep(0.3, 0.7, n2)); c = c.map(v => v * (0.78 + 0.44 * n));
    const rockAmt = sstep(0.5, 1.0, sl); c = mix3(c, ROCK, rockAmt);
    if (hasWater) { c = mix3(c, SHORE, 1 - sstep(-0.05, b.relief.beach ? 0.3 : b.relief.style === 'sea' ? 0.75 : 0.28, h)); if (b.relief.beach) { const rip = 0.5 + 0.5 * Math.sin(x * 2.3 + 3 * fbm(x * 0.8, z * 0.8)) * Math.sin(z * 1.1 + 4 * n); c = mix3(c, c.map(v => v * 0.9), rip * (1 - sstep(0.0, 0.3, h)) * 0.6); c = mix3(c, c.map((v, k) => v * [0.72, 0.68, 0.62][k]), 1 - sstep(-0.1, 0.06, h)); } }   // beach: faint sand ripples, darker wet sand at the waterline
    c = mix3(c, DIRT, (1 - sstep(1.0, 3.0, Math.hypot(x - (b.character.pos[0]), z - (b.character.pos[1])))) * 0.5);
    if (g.snow) c = mix3(c, SNOW, g.snow * (0.8 - rockAmt * 0.55));
    { const fo = sstep(0.42, 0.58, fbm(x * 0.07 + b.seed, z * 0.07)) * sstep(30, 48, r) * sstep(0.8, 2.5, h) * (1 - (g.snow || 0) * 0.5); c = mix3(c, mix3(c, FAR, 0.35), sstep(30, 80, r)); c = mix3(c, c.map(v => v * 0.38), fo * (0.65 + 0.35 * fbm(x * 0.9, z * 0.9))); }
    col.push(...c);
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, c = a + segs + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide }); mat.onBeforeCompile = grainPatch;
  const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = true; return m;
}

// grass: instanced clumps of tapered blades that sway in the wind, tinted from the biome's ground colours
function buildGrass(b, H, hasWater, avoid) {
  const g = b.ground, A = rgb(g.a), B = rgb(g.b), rng = makeRng(b.seed * 13 + 3), pos = [], cl = [], uv = [];
  const BL = 7; for (let k = 0; k < BL; k++) {
    const a = k / BL * 6.283 + 0.4, r = 0.03 + (k % 3) * 0.03, hgt = 0.26 + ((k * 37) % 10) / 45, w = 0.022, lean = 0.2 + (k % 2) * 0.15, cx = Math.cos(a) * r, cz = Math.sin(a) * r, tx = Math.cos(a) * lean, tz = Math.sin(a) * lean, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(cx - px, 0, cz - pz, cx + px, 0, cz + pz, cx + tx * hgt, hgt, cz + tz * hgt); uv.push(0, 0, 1); for (let q = 0; q < 3; q++) cl.push(...(q < 2 ? [0.5, 0.5, 0.5] : [1.35, 1.35, 1.2]));
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); geo.setAttribute('aTip', new THREE.Float32BufferAttribute(uv, 1));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTip; uniform float uTime; uniform float uWind;').replace('#include <begin_vertex>', `#include <begin_vertex>
{ vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]); float ph = ip.x * 0.7 + ip.z * 0.5; transformed.x += sin(uTime * 1.6 + ph) * aTip * 0.07 * uWind; transformed.z += cos(uTime * 1.3 + ph * 1.3) * aTip * 0.05 * uWind; }`); };
  const N = Math.round(26000 * (1 - (g.snow || 0) * 0.75)), mesh = new THREE.InstancedMesh(geo, mat, N), d = new THREE.Object3D(), c = new THREE.Color(); let n = 0;
  for (let t = 0; t < N * 4 && n < N; t++) {
    const a = rng() * 6.283, r = Math.pow(rng(), 0.62) * 24, x = Math.cos(a) * r, z = Math.sin(a) * r, h = H(x, z);
    if (hasWater && h < (b.relief.beach ? 0.3 : 0.2)) continue; if (b.relief.beach && rng() > sstep(0.3, 0.42, h)) continue;   // beach: grass thins out toward the sand if (Math.hypot(H(x + 0.5, z) - H(x - 0.5, z), H(x, z + 0.5) - H(x, z - 0.5)) > 0.8) continue;
    if (avoid.some(q => Math.hypot(x - q.x, z - q.z) < q.r)) continue;
    const s = 0.45 + rng() * 0.75 * (1 + 0.5 * sstep(0.3, 0.7, fbm(x * 0.7, z * 0.7 + b.seed)));
    d.position.set(x, h - 0.02, z); d.rotation.set(0, rng() * 6.28, 0); d.scale.set(s, s * (0.8 + rng() * 0.6), s); d.updateMatrix(); mesh.setMatrixAt(n, d.matrix);
    const k = mix3(A, B, sstep(0.3, 0.7, fbm(x * 0.55, z * 0.55 + b.seed))); const v = 0.85 + rng() * 0.5; c.setRGB(k[0] * v * 1.1, k[1] * v * 1.15, k[2] * v); mesh.setColorAt(n, c); n++;
  }
  mesh.count = n; mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
}
// distant tree silhouettes on the far hills, so the horizon reads as woodland in the haze
function buildFarTrees(b, H, hasWater) {
  const rng = makeRng(b.seed * 3 + 9), geo = new THREE.ConeGeometry(1, 3.4, 6), m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), N = 2600, mesh = new THREE.InstancedMesh(geo, m, N), d = new THREE.Object3D(), c = new THREE.Color(), A = rgb(b.ground.a); let n = 0;
  for (let t = 0; t < N * 8 && n < N; t++) { const a = rng() * 6.283, r = 55 + rng() * 38, x = Math.cos(a) * r, z = Math.sin(a) * r, h = H(x, z); if (h < 1.5) continue; const s = 0.9 + rng() * 1.5;
    d.position.set(x, h + s * 1.1, z); d.scale.set(s, s * (1 + rng() * 0.8), s); d.rotation.set(0, rng() * 6, 0); d.updateMatrix(); mesh.setMatrixAt(n, d.matrix); const v = 0.28 + rng() * 0.22; c.setRGB(A[0] * v * 0.8, A[1] * v * 1.0, A[2] * v * 0.9); mesh.setColorAt(n, c); n++; }
  mesh.count = n; mesh.frustumCulled = false; return mesh;
}

const WU = { uSky: { value: new THREE.Color(0x9fc4e0) }, uSun: { value: new THREE.Color(0xfff0c0) }, uGlint: { value: 1 }, uRefl: { value: null }, uTexMat: { value: new THREE.Matrix4() }, uReflAmt: { value: 0 }, uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) }, uRain: { value: 0 }, uWindW: { value: 1 }, uWFx: { value: 1 } };   // polish v1: planar reflection (render target + texture matrix, filled in tick)
function buildWater(b, H) {
  const rings = 80, segs = 160, pos = [], col = [], idx = [], deep = rgb(b.relief.style === 'marsh' ? 0x2c4a52 : b.relief.style === 'sea' ? 0x2b86a0 : 0x1f5f7a), shallow = rgb(b.relief.style === 'marsh' ? 0x7aa39b : 0x6fc2c0);
  for (let i = 0; i <= rings; i++) for (let j = 0; j <= segs; j++) { const r = ringR(i, rings), a = j / segs * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, d = Math.max(0, -H(x, z)); pos.push(x, 0, z); const t = sstep(0, 1.2, d), c = mix3(shallow, deep, t); col.push(...c, d < 0.01 ? 0 : 0.35 + 0.55 * sstep(0, 0.5, d)); }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) { const a = i * (segs + 1) + j, c = a + segs + 1; idx.push(a, a + 1, c, a + 1, c + 1, c); }
  const dep = []; for (let k = 0; k < pos.length; k += 3) dep.push(Math.max(0, -H(pos[k], pos[k + 2])));   // water depth, drives the shore foam
  const g = new THREE.BufferGeometry(); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.08, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const isSea = b.relief.style === 'sea', SWELL = `
  // polish v1: big swell for the sea (zero on lakes); height H and its slope G at world xz, faded out toward the shore by water depth
  vec3 swell(vec2 p, float t, float dep) { float f = smoothstep(0.15, 2.2, dep); vec2 d1 = normalize(vec2(1.0, 0.3)), d2 = normalize(vec2(-0.5, 1.0)), d3 = normalize(vec2(0.7, -0.6)), d4 = normalize(vec2(-0.2, -1.0));
    float a1 = dot(p, d1) * 0.22 + t * 0.85, a2 = dot(p, d2) * 0.37 - t * 1.05, a3 = dot(p, d3) * 0.66 + t * 1.4, a4 = dot(p, d4) * 1.05 - t * 1.8;
    float h = 0.75 * sin(a1) + 0.4 * sin(a2) + 0.2 * sin(a3) + 0.09 * sin(a4); vec2 g = d1 * 0.75 * 0.22 * cos(a1) + d2 * 0.4 * 0.37 * cos(a2) + d3 * 0.2 * 0.66 * cos(a3) + d4 * 0.09 * 1.05 * cos(a4); vec3 r = vec3(h * f, g * f);
    if (uSurf > 0.5) { float k = 0.78, ph = p.x * k + t * 1.55, sn = 0.5 + 0.5 * sin(ph); float amp = 0.62 * (0.35 + 0.65 * smoothstep(2.4, 1.0, dep)) * smoothstep(0.06, 0.55, dep);   // shoaling: waves grow and steepen as the water shallows, crest sharpened by the power
      r.x += amp * (pow(sn, 2.4) * 1.7 - 0.55); r.y += amp * 1.7 * 2.4 * pow(sn, 1.4) * 0.5 * cos(ph) * k; }
    return r; }
  float surfS(vec2 p, float t) { return 0.5 + 0.5 * sin(p.x * 0.78 + t * 1.55); }
`;
  mat.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, WU, { uTime }); sh.uniforms.uSea = { value: isSea ? 1 : 0 }; sh.uniforms.uSurf = { value: isSea && b.relief.beach ? 1 : 0 }; sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; attribute float aDepth; varying float vDep; varying float vH; uniform float uTime; uniform float uSea; uniform float uSurf;' + SWELL).replace('#include <begin_vertex>', '#include <begin_vertex>\nvDep = aDepth; vH = 0.0; if (uSea > 0.5) { vec3 sw = swell((modelMatrix * vec4(transformed, 1.0)).xz, uTime, aDepth); transformed.y += sw.x; vH = sw.x; } vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vDep; varying float vH; uniform float uSea; uniform float uSurf; uniform vec3 uSunDir; uniform float uRain; uniform float uWindW; uniform float uWFx; uniform vec3 uSky;' + SWELL + ' uniform vec3 uSun; uniform float uGlint; uniform float uTime; uniform sampler2D uRefl; uniform mat4 uTexMat; uniform float uReflAmt;').replace('#include <opaque_fragment>', `
  vec2 q = vWP.xz; float T = uTime; float ch = (0.55 + 0.45 * uWindW) * (1.0 + 1.3 * uSea);
  // wave normal: five travelling waves (long swell to short chop) plus fine ripple; amplitude follows the wind
  vec2 g = vec2(0.0);
  { vec2 d1 = normalize(vec2(1.0, 0.35)); float f1 = dot(q, d1) * 0.55 + T * 0.9; g += d1 * cos(f1) * 0.55 * 0.5 * ch;
    vec2 d2 = normalize(vec2(-0.4, 1.0)); float f2 = dot(q, d2) * 0.95 - T * 1.15; g += d2 * cos(f2) * 0.95 * 0.28 * ch;
    vec2 d3 = normalize(vec2(0.8, -0.7)); float f3 = dot(q, d3) * 1.7 + T * 1.5; g += d3 * cos(f3) * 1.7 * 0.12 * ch;
    vec2 d4 = normalize(vec2(-0.9, -0.3)); float f4 = dot(q, d4) * 3.1 - T * 2.0; g += d4 * cos(f4) * 3.1 * 0.05 * uWindW;
    vec2 d5 = normalize(vec2(0.2, 0.95)); float f5 = dot(q, d5) * 5.6 + T * 2.6; g += d5 * cos(f5) * 5.6 * 0.022 * uWindW; }
  if (uSea > 0.5) g += swell(q, T, vDep).yz;
  // rain rings: a jittered grid of expanding circles
  float ringH = 0.0;
  if (uRain > 0.02) { for (int k = 0; k < 2; k++) { vec2 c = q * (1.5 + float(k) * 0.8) + float(k) * 17.0; vec2 id = floor(c), f = fract(c) - 0.5; float h1 = fract(sin(dot(id, vec2(127.1, 311.7))) * 43758.5), h2 = fract(sin(dot(id, vec2(269.5, 183.3))) * 43758.5); vec2 o = (vec2(h1, h2) - 0.5) * 0.6; float ph = fract(T * (0.7 + 0.5 * h1) + h2); float rr = length(f - o), rad = ph * 0.5; float ring = exp(-pow((rr - rad) * 22.0, 2.0)) * (1.0 - ph) * step(h1, uRain * 0.9); g += normalize(f - o + 1e-4) * ring * 0.9; ringH += ring; } }
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y)); vec3 V = normalize(cameraPosition - vWP);
  float fr = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
  vec4 rc = uTexMat * vec4(vWP, 1.0); vec3 refl = texture2D(uRefl, rc.xy / rc.w + g * 0.035 * (0.4 + 0.6 * V.y)).rgb;
  float rk = uReflAmt * (0.22 + 0.7 * fr) * (1.0 - 0.4 * uSea) * (0.5 + 0.5 * clamp(diffuseColor.a * 1.6, 0.0, 1.0)); outgoingLight = mix(outgoingLight, refl, rk);
  outgoingLight = mix(outgoingLight, uSky, fr * 0.7 * (1.0 - uReflAmt * 0.6) * (1.0 - 0.5 * uSea));
  // sun glitter: reflected sun direction against the wave normals (broad sheen + sharp sparkle)
  vec3 Rv = reflect(-normalize(uSunDir), N); float sd = max(dot(Rv, V), 0.0);
  outgoingLight += uSun * (pow(sd, 60.0) * 0.5 + pow(sd, 600.0) * 3.0) * uGlint * uWFx;
  outgoingLight += uSky * 0.12 * smoothstep(0.35, 0.9, length(g)) * uWFx + vec3(0.8, 0.9, 1.0) * ringH * 0.10 * uWFx;
  // shore foam: a lapping band where the water is shallow, broken up by noise, plus foam streaks on windy crests
  float lap = (0.12 + 0.08 * sin(T * 0.9 + q.x * 0.6 + q.y * 0.4)) * (1.0 + uSea * (2.5 + 2.0 * sin(T * 0.75 + q.x * 0.25 + q.y * 0.18))), nz = clamp(0.5 + 0.3 * sin(dot(q, vec2(2.3, 1.1)) + T * 0.6 + 2.0 * sin(q.y * 0.9)) + 0.25 * sin(dot(q, vec2(-1.3, 3.7)) - T * 0.8 + sin(q.x * 1.3)) + 0.2 * sin(dot(q, vec2(5.1, -2.9)) + T), 0.0, 1.0);   // non-grid noise (a product of sines made a checkerboard)
  float foam = (1.0 - smoothstep(lap * 0.35, lap + 0.1, vDep)) * smoothstep(0.0, 0.03, vDep) * (0.55 + 0.45 * nz);
  foam = max(foam, smoothstep(0.62, 0.95, length(g)) * uWindW * 0.35 * nz);
  foam = max(foam, uSea * smoothstep(0.78, 1.05, vH + 0.12 * nz * uWindW) * 0.8 * (0.5 + 0.5 * nz));   // whitecaps on the biggest crests
  if (uSurf > 0.5) { float sn = surfS(q, T); float crest = smoothstep(0.72, 0.96, sn) * smoothstep(2.0, 0.9, vDep) * smoothstep(0.05, 0.3, vDep);   // the wave breaks: a white lip along the crest, then a turbulent wash behind it that thins as it runs up the sand
    float wash = smoothstep(1.0, 0.12, vDep) * (0.18 + 0.45 * smoothstep(0.25, 0.85, sn)) * (0.4 + 0.6 * nz) * smoothstep(0.0, 0.05, vDep); foam = max(foam, max(crest * (0.65 + 0.35 * nz), wash)); }
  outgoingLight = mix(outgoingLight, vec3(0.93, 0.97, 0.98) * (0.6 + 0.4 * uWFx), clamp(foam, 0.0, 0.85));
  gl_FragColor = vec4(outgoingLight, clamp(diffuseColor.a + fr * 0.45 + foam * 0.6, 0.0, 1.0));`); };
  const w = new THREE.Mesh(g, mat); w.receiveShadow = !isSea;   /* displaced sea would show shadow acne */ w.renderOrder = 2;
  if (b.relief.style === 'sea') { const og = new THREE.RingGeometry(RW - 1, 700, 96, 1); og.rotateX(-Math.PI / 2); const n = og.attributes.position.count, oc = new Float32Array(n * 4); for (let i = 0; i < n; i++) oc.set([...deep, 0.9], i * 4); og.setAttribute('color', new THREE.BufferAttribute(oc, 4)); og.setAttribute('aDepth', new THREE.Float32BufferAttribute(new Float32Array(n).fill(6), 1)); const ow = new THREE.Mesh(og, mat); ow.renderOrder = 2; w.add(ow); }   // polish v1: the open sea continues past the 95 m disc, so there is no hard edge at the horizon
  return w;
}

// ---------- scattering ----------
function tinted(obj, hex) { obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.lerp(new THREE.Color(hex), 0.6); } }); }
function populate(b, H, hasWater, group) {
  const rng = makeRng(b.seed * 7 + 1), placed = [], cols = [{ x: b.character.pos[0], z: b.character.pos[1], r: 1.8 }], water = (x, z) => hasWater && H(x, z) < 0.04;
  const zoneOk = (zone, x, z) => { const h = H(x, z); if (zone === 'dry') return !hasWater || h > 0.38; if (zone === 'shore') return hasWater && h > 0.0 && h < 0.5; if (zone === 'water') return hasWater && h < -0.2; return true; };
  const hs = (it, v) => (it.h && MODELS[it.m] ? it.h * (0.85 + v * 0.3) / MODELS[it.m].size[1] : null);   // optional target height in metres
  const put = (it, x, z, rot, s, yAt) => {
    const info = MODELS[it.m]; if (!info) return null; const y = yAt ?? (it.y === 'water' ? 0 : H(x, z)), o = instantiate(MODELS, it.m, x, z, rot, s, /boulder|rock|spire|slab/.test(it.m) ? 0.08 : 0, y);
    if (it.tint) tinted(o, it.tint); group.add(o); const rec = { m: it.m, x, z, y, s, rot, info, obj: o }; placed.push(rec); return rec;
  };
  for (const it of b.scatter) {
    if (!MODELS[it.m]) continue;
    if (it.at) { const rec = put(it, it.at[0], it.at[1], it.rot ?? rng() * 6.28, hs(it, 0.5) ?? it.s[0]); if (rec) cols.push({ x: it.at[0], z: it.at[1], r: it.r || 0.4 }); if (it.n > 1) for (let k = 1; k < it.n; k++) { const x = it.at[0] + (k % 2 ? 1 : -1) * (0.9 + k * 0.5), z = it.at[1] + 1.1; put(it, x, z, rng() * 6.28, hs(it, 0.5) ?? it.s[0]); cols.push({ x, z, r: it.r || 0.4 }); } continue; }
    const want = Math.round(it.n * (it.r || it.far ? 1 : 2.2)); let n = 0, tries = 0; while (n < want && tries++ < want * (it.m === 'dock_short' ? 1500 : 80)) {
      const a = rng() * 6.283, r = Math.sqrt(rng()) * (R - 2.5), x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (it.far && r < it.far) continue; if (it.max && Math.hypot(x - b.character.pos[0], z - b.character.pos[1]) > it.max) continue; if (it.back && z > -2 && x > -2 && rng() < 0.9) continue;
      if (!zoneOk(it.zone, x, z)) continue; if (it.zone !== 'water' && water(x, z)) continue;
      const rad = (it.r || 0) * 0.8; if (rad && cols.some(c => Math.hypot(x - c.x, z - c.z) < c.r + rad)) continue; if (!rad && cols.some(c => c.r > 0.9 && Math.hypot(x - c.x, z - c.z) < c.r * 0.7)) continue;
      const s = hs(it, rng()) ?? it.s[0] + rng() * (it.s[1] - it.s[0]); let rot = rng() * 6.283, yAt;
      if (it.m === 'dock_short') { const h0 = H(x, z); let best = 0, bd = 1e9; for (let q = 0; q < 16; q++) { const aa = q / 16 * 6.283, hh = H(x + Math.cos(aa) * 3, z + Math.sin(aa) * 3); if (hh < bd) { bd = hh; best = aa; } }
        // polish v1: only accept a spot on the real bank (low, near the waterline) whose lowest direction runs out over open water, so the far end of the pier is over the lake and the near end on land
        const ex = x + Math.cos(best) * 1.9, ez = z + Math.sin(best) * 1.9, bx = x - Math.cos(best) * 1.9, bz = z - Math.sin(best) * 1.9; if (!(h0 > -0.05 && h0 < 0.3 && H(ex, ez) < -0.25 && H(bx, bz) > 0.05)) continue;
        rot = Math.PI / 2 - best; yAt = Math.max(h0, 0.05) + 0.05; }
      if (put(it, x, z, rot, s, yAt)) { n++; if (rad) cols.push({ x, z, r: rad }); }
    }
  }
  return placed;
}

// ---------- ambient ----------
function makeFireflies(n, H) {
  const rng = makeRng(77), p = new Float32Array(n * 3), base = [], g = new THREE.BufferGeometry(); for (let i = 0; i < n; i++) { const a = rng() * 6.283, r = Math.sqrt(rng()) * 18; base.push([Math.cos(a) * r, 0.4 + rng() * 2.2, Math.sin(a) * r, rng() * 6.28]); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ map: softTexture('dot'), size: 0.22, color: 0xc8ff70, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
  m.frustumCulled = false; m.userData.update = (t, night) => { m.material.opacity = Math.min(0.95, night * 1.1); m.visible = night > 0.05; base.forEach((q, i) => { const x = q[0] + Math.sin(t * 0.4 + q[3]) * 1.2, z = q[2] + Math.cos(t * 0.33 + q[3] * 1.3) * 1.2; p[i * 3] = x; p[i * 3 + 2] = z; p[i * 3 + 1] = Math.max(H(x, z), 0) + q[1] + Math.sin(t * 0.9 + q[3]) * 0.3; }); g.attributes.position.needsUpdate = true; };
  return m;
}
function makeSnowfall(n = 1600) {
  const rng = makeRng(5), p = new Float32Array(n * 3), v = []; for (let i = 0; i < n; i++) { p[i * 3] = (rng() - 0.5) * 36; p[i * 3 + 1] = rng() * 16; p[i * 3 + 2] = (rng() - 0.5) * 36; v.push([0.7 + rng() * 0.9, rng() * 6.28]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); const m = new THREE.Points(g, new THREE.PointsMaterial({ map: softTexture('dot'), size: 0.11, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  m.frustumCulled = false; m.userData.update = (t, dt, amt, c) => { m.visible = amt > 0.03; g.setDrawRange(0, Math.floor(n * amt)); m.position.set(c.x, 0, c.z); for (let i = 0; i < n; i++) { p[i * 3 + 1] -= v[i][0] * dt; if (p[i * 3 + 1] < -1) p[i * 3 + 1] += 16; p[i * 3] += Math.sin(t * 0.7 + v[i][1]) * dt * 0.35; } g.attributes.position.needsUpdate = true; };
  return m;
}
const snowfall = makeSnowfall(); scene.add(snowfall);
// light shafts: long soft additive ribbons along the sun's direction; motes: warm pollen drifting in the light
const shaftTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 256);
  x.globalCompositeOperation = 'destination-in'; const g2 = x.createLinearGradient(0, 0, 0, 256); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(0.25, 'rgba(0,0,0,1)'); g2.addColorStop(0.75, 'rgba(0,0,0,1)'); g2.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(0, 0, 64, 256); return new THREE.CanvasTexture(c); })();
const shafts = new THREE.Group(), shaftMat = new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0xfff0c0 });
{ const r = makeRng(31); for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shaftMat); m.userData = { ox: (r() - 0.5) * 18, oz: (r() - 0.5) * 16, w: 1.2 + r() * 2.6, ry: r() * 3.14 }; shafts.add(m); } } scene.add(shafts);
const moteN = 260, moteP = new Float32Array(moteN * 3), moteB = Array.from({ length: moteN }, (_, i) => { const r = makeRng(900 + i); return [(r() - 0.5) * 22, 0.2 + r() * 4, (r() - 0.5) * 22, r() * 6.28]; });
const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(moteP, 3)), new THREE.PointsMaterial({ map: softTexture('dot'), size: 0.09, color: 0xffe2a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); motes.frustumCulled = false; scene.add(motes);

// ---------- the postcard ----------
const S = { b: null, root: null, tod: 0.5, wx: 'clear', wch: { ...WEATHERS.clear }, mixers: [], avatar: null, fire: null, fireflies: null, fx: null, rod: null, H: null, hasWater: false, t: 0, target: new THREE.Vector3(0, 1, 0), yaw: 0, pitch: 0.2, dist: 8, spin: true, load: 0, flyers: [], cpos: [0, 0], ready: false };
async function show(id, opts = {}) {
  const b = BIOMES.find(x => x.id === id) || BIOMES[0], my = ++S.load; $('loading').style.display = 'grid'; S.ready = false;
  if (S.root) { scene.remove(S.root); S.root = null; } S.mixers = []; S.fire = S.fireflies = S.fx = S.rod = null; S.flyers = []; S.avatar = null;
  const names = [...b.scatter.map(s => s.m), ...(b.animals || []).map(a => a.m), 'fm_lantern_hand', ...(b.extras.fire ? ['fm_campfire_stage1_laid', 'fire_stone_ring', 'Timber_Log'] : [])];
  await need(names); const data = await loadSidekick(b.character.who, '../assets/models/sidekick/'), anims = await loadSidekickAnims('../assets/models/sidekick/', b.character.who); if (my !== S.load) return;
  const H0 = heightFn(b), hasWater = WATER_STYLES.includes(b.relief.style), H = (x, z) => { const h = H0(x, z), r = Math.hypot(x, z); return r < 26 ? h : h + (b.relief.style === 'sea' && h < -1 ? 0 : (6 + 16 * fbm(x * 0.045 + b.seed, z * 0.045)) * sstep(28, 80, r) * sstep(-1.2, 0.3, h)); }, root = new THREE.Group(), things = new THREE.Group(); root.add(things); S.b = b; S.H = H; S.hasWater = hasWater;
  root.add(buildTerrain(b, H, hasWater));
  if (hasWater) { S.waterMesh = buildWater(b, H); root.add(S.waterMesh); } else S.waterMesh = null;
  const placed = populate(b, H, hasWater, things); S.placed = placed;
  // the character (placed first so it can stand next to a berry bush or a rock)
  const C = b.character; let [cx, cz] = C.pos, face = 0;
  if (C.faceTo === 'berry') { const bush = placed.find(p => /berry/.test(p.m)); if (bush) { const d = Math.hypot(bush.x, bush.z) || 1; cx = bush.x - bush.x / d * 0.95; cz = bush.z - bush.z / d * 0.95; face = Math.atan2(bush.x - cx, bush.z - cz); } }
  else if (C.faceAt) { const rk = placed.find(p => Math.abs(p.x - C.faceAt[0]) < 0.1 && Math.abs(p.z - C.faceAt[1]) < 0.1), rad = rk ? rk.info.base.r * rk.s : 1.5, d = Math.hypot(C.faceAt[0], C.faceAt[1]) || 1; cx = C.faceAt[0] - C.faceAt[0] / d * (rad + 0.55); cz = C.faceAt[1] - C.faceAt[1] / d * (rad + 0.55); face = Math.atan2(C.faceAt[0] - cx, C.faceAt[1] - cz); }
  else if (C.face === 'water' || C.face === 'shore') { let best = 0, bd = 1e9; for (let q = 0; q < 32; q++) { const a = q / 32 * 6.283; for (let r = 1.5; r < 12; r += 0.5) { if (H(cx + Math.sin(a) * r, cz + Math.cos(a) * r) < -0.1) { if (r < bd) { bd = r; best = a; } break; } } } face = best; }
  else if (C.face === 'fire' && b.extras.fire) face = Math.atan2(b.extras.fire[0] - cx, b.extras.fire[1] - cz);
  else if (C.face === 'view') face = (b.cam.yaw + Math.PI) + 0.9;
  const sk = makeSidekickAvatar(data, undefined, anims), u = sk.userData; sk.position.set(cx, H(cx, cz), cz); sk.rotation.y = face; things.add(sk); S.avatar = sk; S.cpos = [cx, cz]; S.cx = cx; S.cz = cz;
  if (C.work) u.playWork(C.work, { loop: true, tool: C.tool });
  if (C.rod) { const rod = makeRod(); u.mount(rod, 'prop_r', [0, 0, 0]); S.rod = rod; S.fx = makeFishFx(things, { surface: () => 0 }); S.castFrom = { cx, cz, face }; }
  if (C.lantern && MODELS.fm_lantern_hand) { const l = MODELS.fm_lantern_hand.root.clone(true); const lamp = new THREE.PointLight(0xffb060, 0, 9, 1.6); l.add(lamp); u.mount(l, 'prop_l', [0, 0, 0]); S.lamp = lamp; } else S.lamp = null;
  root.add(buildGrass(b, H, hasWater, [{ x: cx, z: cz, r: 0.7 }, ...placed.filter(p => p.info.base.r * p.s > 0.5).map(p => ({ x: p.x, z: p.z, r: p.info.base.r * p.s * 0.8 }))]));
  // animals: gentle idles, placed by zone
  const rng = makeRng(b.seed + 5), animalAt = (zone) => { for (let t = 0; t < 400; t++) { const a = rng() * 6.283, r = 4 + rng() * (R - 8), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - cx, z - cz) < 6 || Math.hypot(x - cx, z - cz) > 13) continue; if (zone === 'shore' && !(hasWater && H(x, z) > 0.05 && H(x, z) < 0.45)) continue; if (zone === 'water' && !(hasWater && H(x, z) < -0.25)) continue; if ((zone === 'dry' || zone === 'back') && hasWater && (H(x, z) < 0.4)) continue; if (zone === 'back' && r < 10) continue; return [x, z]; } return null; };
  for (const an of b.animals || []) { const info = MODELS[an.m]; if (!info) continue; let pos = null, yAdd = 0;
    if (an.zone === 'tree') { const t = placed.find(p => /tree|pine/i.test(p.m)); if (t) pos = [t.x + 0.7, t.z + 0.3]; } else if (an.zone === 'rock') { const r = placed.find(p => /boulder|stone/.test(p.m)); if (r) { pos = [r.x, r.z]; yAdd = r.info.size[1] * r.s * 0.8; } } else pos = animalAt(an.zone);
    if (!pos) continue; const s = an.h / Math.max(...info.size, 0.01), o = instantiate(MODELS, an.m, pos[0], pos[1], rng() * 6.28, s, 0, (an.high ? Math.max(H(pos[0], pos[1]), 0) + an.high : H(pos[0], pos[1])) + yAdd); things.add(o);
    const clip = info.clips.find(c => /idle/i.test(c.name)) || info.clips[0]; if (clip) { const mx = new THREE.AnimationMixer(o.children[0]); mx.clipAction(clip).play(); S.mixers.push(mx); } if (an.high) S.flyers.push({ o, y0: o.position.y, x0: pos[0], z0: pos[1], ph: rng() * 6 }); }
  if (b.extras.fire) { const f = makeFire(MODELS, b.extras.fire[0], b.extras.fire[1]); f.group.position.y = H(b.extras.fire[0], b.extras.fire[1]); things.add(f.group); S.fire = f; }
  if (b.extras.fireflies) { S.fireflies = makeFireflies(b.extras.fireflies, H); root.add(S.fireflies); }
  scene.add(root); S.root = root; S.tod = opts.tod ?? b.tod; S.wx = opts.wx || 'default'; S.wch = { ...(S.wx === 'default' ? { cloud: 0, fog: 0, rain: 0, wet: 0, wind: 0.2, storm: 0, snow: 0, dust: 0, ...b.weather } : WEATHERS[S.wx]) };
  S.yaw = opts.yaw ?? (C.face && C.face !== 'view' || C.faceAt || C.faceTo ? face + Math.PI + 0.85 : b.cam.yaw); S.pitch = opts.pitch ?? b.cam.pitch; S.dist = opts.dist ?? b.cam.dist; S.target.set(cx, H(cx, cz) + 0.9, cz);
  { const cp = Math.cos(S.pitch), cam = new THREE.Vector3(cx + Math.sin(S.yaw) * cp * S.dist, 0, cz + Math.cos(S.yaw) * cp * S.dist);   // keep the camera's view of the character clear of trunks and rocks
    for (const p of placed.slice()) { const tall = p.info.size[1] * p.s; if (tall < 0.5 || (tall < 1.8 && p.info.base.r * p.s < 0.7) || p.obj === sk) continue; const vx = cam.x - cx, vz = cam.z - cz, t = Math.min(1, Math.max(0, ((p.x - cx) * vx + (p.z - cz) * vz) / (vx * vx + vz * vz))), d = Math.hypot(p.x - (cx + vx * t), p.z - (cz + vz * t)); if (((p.x - cx) * vx + (p.z - cz) * vz) > 0 && d < 1.6 + p.info.base.r * p.s) { things.remove(p.obj); placed.splice(placed.indexOf(p), 1); } } }
  $('loading').style.display = 'none'; S.ready = true; ui(b);
}
function ui(b) {
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x.dataset.id === b.id)); $('cap').innerHTML = `<h2>${b.title}</h2><p class="pl">${b.place}</p><p>${b.idea}</p><p class="tg">${b.tags.map(t => `<span>${t}</span>`).join('')}</p>`;
  $('time').value = S.tod; document.querySelectorAll('#wx button').forEach(x => x.classList.toggle('on', x.dataset.w === S.wx)); history.replaceState(null, '', `?b=${b.id}${S.wx !== 'default' ? '&w=' + S.wx : ''}`);
}
// ---------- frame ----------
let last = performance.now();
function frame(now) { requestAnimationFrame(frame); const dt = Math.min(0.05, (now - last) / 1000); last = now; tick(dt); }
// polish v1: planar water reflection. Mirror camera below y = 0, scene clipped to above the surface, water hidden, rendered at a fraction of the screen size.
const reflRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: true }), mirror = new THREE.PerspectiveCamera(), clipPl = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.03)], REFL_K = [0, 0.35, 0.5, 0.7], _v = new THREE.Vector3(), _u = new THREE.Vector3();
reflRT.texture.colorSpace = THREE.LinearSRGBColorSpace; WU.uRefl.value = reflRT.texture;
function reflectPass() {
  const k = REFL_K[Q.light] ?? 0.5, wm = S.waterMesh; if (!wm || !k || /[?&]refl=0/.test(location.search)) { WU.uReflAmt.value = 0; return; }
  const sz = renderer.getDrawingBufferSize(_v), w = Math.max(64, Math.round(sz.x * k)), h = Math.max(64, Math.round(sz.y * k)); if (reflRT.width !== w || reflRT.height !== h) reflRT.setSize(w, h);
  camera.updateMatrixWorld(); mirror.projectionMatrix.copy(camera.projectionMatrix); mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse); mirror.near = camera.near; mirror.far = camera.far;
  const cp = camera.position; mirror.position.set(cp.x, -cp.y, cp.z); _v.set(0, 0, -1).transformDirection(camera.matrixWorld); _u.set(0, 1, 0).transformDirection(camera.matrixWorld);
  mirror.up.set(_u.x, -_u.y, _u.z); mirror.lookAt(cp.x + _v.x, -(cp.y + _v.y), cp.z + _v.z); mirror.updateMatrixWorld(); mirror.matrixWorldInverse.copy(mirror.matrixWorld).invert();
  WU.uTexMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse);
  const prevRT = renderer.getRenderTarget(), prevClip = renderer.clippingPlanes, vis = wm.visible, sh = renderer.shadowMap.autoUpdate; wm.visible = false; renderer.clippingPlanes = clipPl; renderer.shadowMap.autoUpdate = false;
  renderer.setRenderTarget(reflRT); renderer.clear(); renderer.render(scene, mirror); renderer.setRenderTarget(prevRT); renderer.clippingPlanes = prevClip; renderer.shadowMap.autoUpdate = sh; wm.visible = vis; WU.uReflAmt.value = 1;
}
function tick(dt) {
  if (!S.ready) return; S.t += dt; uTime.value = S.t; step(dt);
  const ch = S.wch, a = withWeather(atmosphere(S.tod), ch, 0), night = a.night;
  sun.color.setRGB(...a.lightColor); sun.intensity = a.lightIntensity; hemi.color.setRGB(...a.hemiSky); hemi.groundColor.setRGB(...a.hemiGround); hemi.intensity = a.hemiIntensity * (1.2 + 0.8 * night);
  const L = a.lightDir; sun.position.set(L[0] * 70, Math.max(L[1], 0.08) * 70, L[2] * 70); sun.castShadow = L[1] > 0.02 && ch.fog < 0.9; scene.fog.color.setRGB(...a.fogColor); scene.fog.near = a.fogNear * QT.nearK[Q.near]; scene.fog.far = Math.min(a.fogFar * 0.8, QT.far[Q.far]); renderer.toneMappingExposure = a.exposure;
  const su = sky.material.uniforms; { const fg = Math.min(1, ch.fog * 3 + ch.rain * 0.3), fz = Math.min(1, ch.fog * 4); su.zen.value.setRGB(...a.sky.zenith).lerp(scene.fog.color, fz); su.hor.value.setRGB(...a.sky.horizon).lerp(scene.fog.color, fg); } su.sunDir.value.set(...a.sunDir); su.sunCol.value.setRGB(...a.lightColor); su.moonDir.value.set(...a.moonDir); su.night.value = a.night; su.cloud.value = QT.cloud[Q.far] * Math.min(1, ch.cloud + ch.rain * 0.4) * (1 - Math.min(0.9, ch.fog * 1.5)); su.grey.value.setRGB(...a.fogColor).lerp(su.hor.value, 0.65).multiplyScalar(1.15); sky.position.copy(camera.position);
  uWind.value = 1 + 1.4 * ch.wind; rain.uniforms.uTime.value = S.t; rain.uniforms.uGround.value = -1.5; rain.setAmount(ch.rain); rain.uniforms.uColor.value.setRGB(...(night > 0.5 ? [0.45, 0.55, 0.75] : [0.74, 0.81, 0.9]));
  snowfall.userData.update(S.t, dt, ch.snow, S.target);
  { const sunUp = sstep(0.04, 0.3, L[1]), amt = sunUp * (1 - night) * (1 - Math.min(1, ch.cloud * 1.2)) * (1 - ch.fog * 0.3) * (1 - ch.rain), dir = new THREE.Vector3(-L[0], -L[1], -L[2]).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    shaftMat.opacity = QT.shaftOp[Q.vol] * amt; shaftMat.color.setRGB(...a.lightColor); shafts.visible = amt > 0.02;
    shafts.children.forEach((m, k) => { m.visible = k < QT.shafts[Q.near]; }); for (const m of shafts.children) { const u = m.userData, len = 26; m.scale.set(u.w, len, 1); m.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), u.ry)); m.position.set(S.target.x + u.ox, 0, S.target.z + u.oz).addScaledVector(dir, -len * 0.5).setY(len * 0.5 * -dir.y + 0.5); }
    motes.material.opacity = 0.65 * (sunUp * (1 - night) * (1 - ch.rain) * (1 - ch.snow) + night * 0.0) * (1 - ch.fog * 0.5); motes.material.color.setRGB(...a.lightColor); motes.visible = motes.material.opacity > 0.01 && QT.motes[Q.part] > 0; motes.geometry.setDrawRange(0, QT.motes[Q.part]); motes.material.size = 0.09 * QT.particle[Q.part];
    moteB.forEach((p, i) => { moteP[i * 3] = S.target.x + p[0] + Math.sin(S.t * 0.2 + p[3]) * 0.9; moteP[i * 3 + 1] = Math.max(S.H(S.target.x + p[0], S.target.z + p[2]), 0) + p[1] + Math.sin(S.t * 0.5 + p[3]) * 0.3; moteP[i * 3 + 2] = S.target.z + p[2] + Math.cos(S.t * 0.17 + p[3]) * 0.9; }); motes.geometry.attributes.position.needsUpdate = true;
    WU.uSky.value.setRGB(...a.sky.horizon).lerp(new THREE.Color(...a.sky.zenith), 0.35); WU.uSun.value.setRGB(...a.lightColor); WU.uGlint.value = amt + 0.1; WU.uSunDir.value.set(...a.sunDir); WU.uRain.value = ch.rain; WU.uWindW.value = 0.5 + ch.wind; WU.uWFx.value = 0.35 + 0.65 * (1 - night); }
  if (S.fire) S.fire.update(S.t, dt, night, 1); if (S.fireflies) S.fireflies.userData.update(S.t, night); if (S.lamp) S.lamp.intensity = night * 6;
  for (const f of S.flyers) { f.o.position.set(f.x0 + Math.sin(S.t * 0.6 + f.ph) * 1.4, f.y0 + Math.sin(S.t * 1.7 + f.ph) * 0.25, f.z0 + Math.cos(S.t * 0.5 + f.ph) * 1.4); }
  if (S.spin && !drag) S.yaw += dt * 0.07;
  const cp = Math.cos(S.pitch), want = new THREE.Vector3(Math.sin(S.yaw) * cp, Math.sin(S.pitch), Math.cos(S.yaw) * cp).multiplyScalar(S.dist); camera.position.copy(S.target).add(want);
  const ground = S.H(camera.position.x, camera.position.z); if (camera.position.y < ground + 0.5) camera.position.y = ground + 0.5; camera.lookAt(S.target); reflectPass(); renderer.render(scene, camera);
  $('clock').textContent = `${String(Math.floor(S.tod * 24)).padStart(2, '0')}:${String(Math.floor(S.tod * 24 * 60) % 60).padStart(2, '0')} · ${phaseName(S.tod)}`;
}
const tip = new THREE.Vector3();
// polish v1: walking. Left stick / WASD moves the character relative to the camera, dragging the picture turns the view; the camera follows.
const WK = { on: false, jx: 0, jy: 0, keys: {}, face: 0, v: 0 };
function setWalk(on) { WK.on = on; document.body.classList.toggle('walking', on); if (on) { S.spin = false; $('spin').checked = false; S.avatar.userData.stopWork && S.avatar.userData.stopWork(); WK.face = S.avatar.rotation.y; S.dist = Math.min(S.dist, 6); S.pitch = Math.min(S.pitch, 0.35); } else WK.v = 0; }
function walkStep(dt) {
  const k = WK.keys; let jx = WK.jx + ((k.d || k.arrowright) ? 1 : 0) - ((k.a || k.arrowleft) ? 1 : 0), jy = WK.jy + ((k.w || k.arrowup) ? 1 : 0) - ((k.s || k.arrowdown) ? 1 : 0); const m = Math.hypot(jx, jy); if (m > 1) { jx /= m; jy /= m; }
  const sy = Math.sin(S.yaw), cy = Math.cos(S.yaw), dx = -sy * jy + cy * jx, dz = -cy * jy - sy * jx, want = Math.min(1, m) * (k.shift ? 4.2 : 2.7), av = S.avatar; WK.v += (want - WK.v) * Math.min(1, dt * 8);
  if (m > 0.05) { let nx = av.position.x + dx / m * WK.v * dt, nz = av.position.z + dz / m * WK.v * dt;
    // stay on the island, out of deep water, and slide around trees, rocks and props
    const r = Math.hypot(nx, nz); if (r > R - 3) { nx *= (R - 3) / r; nz *= (R - 3) / r; } if (S.hasWater && S.H(nx, nz) < -0.3) { nx = av.position.x; nz = av.position.z; }
    for (const p of S.placed) { if (p.obj === av) continue; const rad = p.info.base.r * p.s, tall = p.info.size[1] * p.s; if (rad < 0.12 || tall < 0.35) continue; const ex = nx - p.x, ez = nz - p.z, d = Math.hypot(ex, ez), lim = rad * 0.85 + 0.3; if (d < lim && d > 1e-4) { nx = p.x + ex / d * lim; nz = p.z + ez / d * lim; } }
    av.position.x = nx; av.position.z = nz; const ft = Math.atan2(dx, dz); let dA = ft - WK.face; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); WK.face += dA * Math.min(1, dt * 10); av.rotation.y = WK.face; }
  av.position.y += (S.H(av.position.x, av.position.z) - av.position.y) * Math.min(1, dt * 14);
  S.target.x += (av.position.x - S.target.x) * Math.min(1, dt * 6); S.target.z += (av.position.z - S.target.z) * Math.min(1, dt * 6); S.target.y += (av.position.y + 0.9 - S.target.y) * Math.min(1, dt * 6);
  av.userData.animate(0, S.t, dt, { speed: WK.v, moving: WK.v > 0.1 });
}
function step(dt) {
  if (WK.on) { walkStep(dt); for (const m of S.mixers) m.update(dt); return; }
  S.avatar.userData.animate(0, S.t, dt, { speed: 0 }); for (const m of S.mixers) m.update(dt);
  if (S.fx && S.rod) { S.rod.getWorldPosition(tip); S.rod.userData.tip.getWorldPosition(tip); if (!S.fx.bobbed) { const c = S.castFrom, ba = Math.PI / 2 - c.face, tg = castTarget(c.cx, c.cz, ba, (x, z) => (S.H(x, z) < -0.3 ? 1 : 0), { min: 2.5, max: 7 }); S.fx.cast(tip, tg.x, tg.z, 0.01); S.fx.bobbed = true; } S.fx.update(dt, tip); }
}
// ---------- controls ----------
let drag = false, px = 0, py = 0;
canvas.addEventListener('pointerdown', e => { drag = true; px = e.clientX; py = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointerup', () => { drag = false; });
canvas.addEventListener('pointermove', e => { if (!drag) return; S.yaw -= (e.clientX - px) * 0.008; S.pitch = Math.min(1.2, Math.max(0.03, S.pitch + (e.clientY - py) * 0.006)); px = e.clientX; py = e.clientY; });
canvas.addEventListener('wheel', e => { e.preventDefault(); S.dist = Math.min(22, Math.max(3.5, S.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
$('tabs').innerHTML = BIOMES.map(b => `<button data-id="${b.id}">${b.id}</button>`).join(''); $('tabs').onclick = e => { const id = e.target.dataset?.id; if (id) show(id); };
$('wx').onclick = e => { const w = e.target.dataset?.w; if (!w) return; S.wx = w; S.wch = { ...(w === 'default' ? { cloud: 0, fog: 0, rain: 0, wet: 0, wind: 0.2, storm: 0, snow: 0, dust: 0, ...S.b.weather } : WEATHERS[w]) }; ui(S.b); };
$('time').oninput = e => { S.tod = +e.target.value; }; $('spin').onchange = e => { S.spin = e.target.checked; };
$('save').onclick = () => { renderer.render(scene, camera); const src = renderer.domElement, c = document.createElement('canvas'), W = src.width, Hh = src.height, band = Math.round(Hh * 0.1); c.width = W; c.height = Hh + band; const x = c.getContext('2d'); x.fillStyle = '#f6efe0'; x.fillRect(0, 0, W, c.height); x.drawImage(src, 0, 0);
  x.fillStyle = '#2b2a22'; x.font = `italic 700 ${Math.round(band * 0.45)}px Georgia, serif`; x.fillText(S.b.title, band * 0.3, Hh + band * 0.62); x.font = `${Math.round(band * 0.24)}px system-ui, sans-serif`; x.fillStyle = '#6a6556'; x.fillText(S.b.place, band * 0.3, Hh + band * 0.88);
  c.toBlob(bl => { const a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = `postcard-${S.b.id}.png`; a.click(); }); };
addEventListener('keydown', e => { WK.keys[e.key.toLowerCase()] = true; if (e.key === 'Shift') WK.keys.shift = true; if (e.key.toLowerCase() === 'e') setWalk(!WK.on); }); addEventListener('keyup', e => { WK.keys[e.key.toLowerCase()] = false; if (e.key === 'Shift') WK.keys.shift = false; });
{ const st = $('stick'), kn = st.firstElementChild; let id = null; const mv = e => { const r = st.getBoundingClientRect(), R0 = r.width / 2; let x = (e.clientX - r.left - R0) / R0, y = (e.clientY - r.top - R0) / R0; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } WK.jx = x; WK.jy = -y; kn.style.transform = `translate(${x * R0 * 0.6}px, ${y * R0 * 0.6}px)`; };
  st.addEventListener('pointerdown', e => { id = e.pointerId; st.setPointerCapture(id); mv(e); e.preventDefault(); }); st.addEventListener('pointermove', e => { if (e.pointerId === id) mv(e); }); const end = e => { if (e.pointerId !== id) return; id = null; WK.jx = WK.jy = 0; kn.style.transform = ''; }; st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end); }
$('walkbtn').onclick = () => setWalk(!WK.on); $('uibtn').onclick = () => document.body.classList.toggle('clean');
{ const qq = new URLSearchParams(location.search); if (qq.get('ui') === '1') document.body.classList.remove('clean'); else if (qq.get('clean') === '1' || matchMedia('(max-width: 700px), (pointer: coarse)').matches) document.body.classList.add('clean'); if (qq.get('walk') === '1') { const t = setInterval(() => { if (S.ready) { setWalk(true); clearInterval(t); } }, 200); } }
window.__pc = { setWalk, WK, placedOf: () => S.placed, S, show, tick, scene, camera, renderer, BIOMES, MODELS, size };
const q = new URLSearchParams(location.search);
show(q.get('b') || 'river', { wx: q.get('w') || undefined, tod: q.has('t') ? +q.get('t') : undefined }).then(() => { if (q.has('still')) S.spin = false; });
requestAnimationFrame(frame);

// settings panel
{ const panel = document.createElement('div'); panel.id = 'set'; panel.hidden = true;
  panel.innerHTML = '<b>Graphics</b>' + Object.keys(QS).map(k => `<label>${QS[k]}<select data-k="${k}">${QN.map((n, i) => `<option value="${i}">${n}</option>`).join('')}</select></label>`).join('') + '<div><button id="setrec">Recommended</button><button id="setlow">All low</button><button id="setult">All ultra</button></div><small>Recommended: Lighting High, Near Medium, Far High, Volumetric lighting High, Particles Medium.</small>';
  document.body.appendChild(panel);
  const sync = () => panel.querySelectorAll('select').forEach(e => { e.value = Q[e.dataset.k]; });
  panel.onchange = e => { Q[e.target.dataset.k] = +e.target.value; applyQuality(); };
  const all = v => () => { for (const k in QS) Q[k] = v === 'g' ? GUIDE[k] : v; sync(); applyQuality(); };
  panel.querySelector('#setrec').onclick = all('g'); panel.querySelector('#setlow').onclick = all(0); panel.querySelector('#setult').onclick = all(3);
  const b = document.createElement('button'); b.textContent = 'Graphics'; b.onclick = () => { panel.hidden = !panel.hidden; }; $('bar').appendChild(b);
  sync(); applyQuality(); }
