// Rendering. Original to this build: terrain mesh, water, sky, grass, shafts, fire, wind. Only the GLB props
// come from the library (asset-library-v2 'Graphics Creator', original procedural models; see PROVENANCE.md).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/three/loaders/GLTFLoader.js';
import { groundAt, terrainAt, gridHeight, GRID, TILE, tileRect, waterY, riverX, surfaceInfo, BRIDGE, bridgeDeckY, CAMP, SEA_Y, WS, depthAt } from './terrain.js';
import { groundTexture, waterNormalTexture, softTexture } from './textures.js';
import { makeRng } from './rng.js';

export const uTime = { value: 0 }, uWind = { value: 1 };     // shared motion clock (frozen by pause / reduced motion)

/** Wind sway injected into standard materials: bends by height above the model's own base. */
function addSway(mat, amp, freq = 1.3, hBase = 0) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind;
    sh.vertexShader = 'uniform float uTime; uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float hh = max(0.0, position.y - ${hBase.toFixed(2)});
       #ifdef USE_INSTANCING
         vec3 wp = (instanceMatrix * vec4(position,1.0)).xyz;
       #else
         vec3 wp = (modelMatrix * vec4(position,1.0)).xyz;
       #endif
       float ph = wp.x * 0.35 + wp.z * 0.27;
       float gust = 0.5 + 0.5 * sin(wp.x * 0.045 + wp.z * 0.03 - uTime * 0.9);   // a gust front rolls across the forest
       float bend = hh * hh * ${amp.toFixed(4)} * uWind * (1.0 + (uWind - 1.0) * 1.2 * gust * gust);
       transformed.x += sin(uTime * ${freq.toFixed(2)} + ph) * bend + sin(uTime * ${(freq * 2.3).toFixed(2)} + ph * 2.0) * bend * 0.25;
       transformed.z += cos(uTime * ${(freq * 0.8).toFixed(2)} + ph) * bend * 0.6;`);
  };
  mat.customProgramCacheKey = () => `sway${amp}${freq}${hBase}`;
}

// Snow dusting for winter variants: whitens upward-facing surfaces of the MegaKit meshes in the shader.
function addSnow(root) {
  root.traverse(o => { if (!o.isMesh) return; const m = o.material; m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normalize(mat3(modelMatrix) * objectNormal).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUp;').replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, vec3(0.93, 0.96, 1.0), smoothstep(0.3, 0.7, vUp));\n#include <opaque_fragment>'); };
    m.customProgramCacheKey = () => 'snowcap'; m.needsUpdate = true; });
}
export async function loadModels(names, base = './assets/models/') {
  const loader = new GLTFLoader(), out = {};
  await Promise.all(names.map(n => new Promise((res, rej) => loader.load(`${base}${n}.glb`, g => {
    const root = g.scene; if (/snowcap|frosted|winter_bare|far_bare/.test(n)) addSnow(root); root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    // Foot/root pivot: record the raw offset so placement can seat the true base on the surface.
    const info = { name: n, root, clips: g.animations || [], minY: box.min.y, size: size.toArray(), center: box.getCenter(new THREE.Vector3()).toArray() };
    // Base footprint radius: vertices within 0.45 m of the lowest point (trunk/rock contact area).
    let cx = 0, cz = 0, cnt = 0; const pts = [];
    root.traverse(o => { if (o.isMesh) { const p = o.geometry.attributes.position, m = o.matrixWorld; const v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); if (v.y < box.min.y + 0.45) { pts.push([v.x, v.z]); cx += v.x; cz += v.z; cnt++; } } } });
    cx /= cnt || 1; cz /= cnt || 1; info.base = { x: cx, z: cz, r: Math.max(0.01, ...pts.map(([x, z]) => Math.hypot(x - cx, z - cz))), n: cnt };
    out[n] = info; res();
  }, undefined, rej))));
  return out;
}

/** Seat a clone so its lowest point sits on the surface (small sink for rocks), pivot-corrected. */
export function instantiate(models, name, x, z, rot, scale, sink = 0, y = groundAt(x, z)) {
  const m = models[name], o = m.root.clone(true); o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  const g = new THREE.Group(); g.add(o);
  o.position.set(-m.base.x, -m.minY - sink / scale, -m.base.z);        // base centre -> group origin, base height -> y=0
  g.position.set(x, y, z); g.rotation.y = rot; g.scale.setScalar(scale);
  return g;
}

/** One shared ground material (texture + wetness uniform) for every terrain chunk. */
export function makeTerrainMaterial() {
  const tm = new THREE.MeshLambertMaterial({ map: groundTexture(), vertexColors: true }), uWet = { value: 0 }, uSnow = { value: 0 };
  tm.onBeforeCompile = (sh) => { sh.uniforms.uWet = uWet; sh.uniforms.uSnow = uSnow; sh.fragmentShader = 'uniform float uWet;\nuniform float uSnow;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float lum = dot(diffuseColor.rgb, vec3(0.33)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.90, 0.94, 1.0) * (0.86 + 0.3 * lum), uSnow * (0.62 + 0.3 * smoothstep(0.15, 0.5, lum))); diffuseColor.rgb *= (1.0 - uWet * 0.34); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.9,1.0,0.92), uWet * 0.5);'); };
  tm.userData.uWet = uWet; tm.userData.uSnow = uSnow; return tm;
}
const GCOL = { grassA: new THREE.Color(0x5f9f3c), grassB: new THREE.Color(0x92c24f), clover: new THREE.Color(0x4f9f50), dry: new THREE.Color(0xb3aa62), mud: new THREE.Color(0x75603f), rock: new THREE.Color(0x9a968c), path: new THREE.Color(0xa88e68), camp: new THREE.Color(0x8c764f), snow: new THREE.Color(0xeef3fa).multiplyScalar(1.12), moor: new THREE.Color(0x8b7a52), gold: new THREE.Color(0xc9a24a), marsh: new THREE.Color(0x4a5a34), downs: new THREE.Color(0xb7b975), blossom: new THREE.Color(0x93c562) };
/** A TILE x TILE terrain chunk. Vertices are the GLOBAL grid vertices (so neighbouring chunks share exact edge heights) and normals come
 *  from central differences of the global grid, so lighting is seamless across tile joins too. */
export function makeTerrainChunk(tx, tz, material) {
  const R = tileRect(tx, tz), n = TILE / GRID, geo = new THREE.PlaneGeometry(TILE, TILE, n, n); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, uv = geo.attributes.uv, nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color(), P = THREE.MathUtils.smoothstep;
  const xs = new Int32Array(pos.count), zs = new Int32Array(pos.count);
  for (let k = 0; k < pos.count; k++) {                 // cheap pass: positions, uvs, analytic normals (shape and lighting are final immediately)
    const x = Math.round(pos.getX(k) + (R.x0 + R.x1) / 2), z = Math.round(pos.getZ(k) + (R.z0 + R.z1) / 2), i = x / GRID, j = z / GRID; xs[k] = x; zs[k] = z;
    pos.setXYZ(k, x, gridHeight(i, j), z); uv.setXY(k, x * 0.22, z * 0.22);
    const gx = (gridHeight(i + 1, j) - gridHeight(i - 1, j)) / (2 * GRID), gz = (gridHeight(i, j + 1) - gridHeight(i, j - 1)) / (2 * GRID), l = Math.hypot(gx, 1, gz); nrm.setXYZ(k, -gx / l, 1 / l, -gz / l);
    col[k * 3] = 0.45; col[k * 3 + 1] = 0.58; col[k * 3 + 2] = 0.28;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, material); mesh.receiveShadow = true; mesh.name = `terrain-${tx},${tz}`;
  let k = 0;   // resumable ground-colour pass (the expensive part): call mesh.userData.fill(msBudget) each frame until it returns true
  mesh.userData.fill = (ms) => { const t0 = performance.now(); while (k < pos.count && performance.now() - t0 < ms) { const s2 = surfaceInfo(xs[k], zs[k]);
      c.copy(GCOL.grassA).lerp(GCOL.grassB, P(s2.patch, 0.35, 0.7)).lerp(GCOL.clover, P(s2.patch, 0.62, 0.8) * 0.5).lerp(GCOL.dry, P(s2.patch, 0.15, 0.0) * 0.55);
      c.lerp(GCOL.moor, s2.moor * 0.75).lerp(GCOL.gold, s2.gold * 0.55).lerp(GCOL.marsh, s2.marsh * 0.75).lerp(GCOL.downs, s2.downs * 0.6).lerp(GCOL.blossom, s2.blossom * 0.35).lerp(GCOL.mud, s2.bank * 0.9).lerp(GCOL.rock, s2.rock * 0.85).lerp(GCOL.path, s2.path * 0.8).lerp(GCOL.camp, s2.camp * 0.75).lerp(GCOL.snow, s2.snow * 0.96); col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b; k++; }
    geo.attributes.color.needsUpdate = true; return k >= pos.count; };
  mesh.userData.done = false; return mesh;
}

export function makeSky() {
  const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, moonDir: { value: new THREE.Vector3() }, night: { value: 0 }, uTime, cloud: { value: 0 }, grey: { value: new THREE.Color(0.6, 0.64, 0.7) } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `varying vec3 vD; uniform vec3 zen,hor,sunDir,sunCol,moonDir,grey; uniform float night,uTime,cloud;
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5), b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5), c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5), d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){ vec3 d = normalize(vD); float y = max(d.y, 0.0);
        vec3 c = mix(hor, zen, pow(y, 0.55));
        float sd = max(dot(d, sunDir), 0.0);
        c += sunCol * (pow(sd, 700.0) * 3.0 + pow(sd, 18.0) * 0.35 + pow(sd, 4.0) * 0.12 * (1.0 - y));
        float md = max(dot(d, moonDir), 0.0); c += vec3(0.85,0.9,1.0) * pow(md, 1500.0) * 1.6 * night + vec3(0.3,0.4,0.6) * pow(md, 40.0) * 0.2 * night;
        vec3 sp = floor(d * 160.0); float st = step(0.9975, h(sp)) * smoothstep(0.1, 0.5, d.y) * night; c += vec3(st) * (0.6 + 0.4 * sin(uTime * 2.0 + h(sp) * 30.0));
        { vec2 cp = d.xz / (max(d.y, 0.04) + 0.25) * 1.3 + vec2(uTime * 0.012, uTime * 0.006); float cl = vn(cp*2.) * .55 + vn(cp*4.3) * .3 + vn(cp*9.1) * .15;
          float cov = smoothstep(.62 - cloud * .38, .85 - cloud * .38, cl) * smoothstep(0., .18, d.y) * (0.35 + 0.65 * cloud + 0.2); float lit = clamp(0.55 + 0.5 * dot(normalize(vec3(sunDir.x,.3,sunDir.z)), normalize(vec3(d.x,.3,d.z))), 0., 1.);
          vec3 ccol = mix(grey * (0.55 + 0.45 * (1. - night)), mix(vec3(1.), sunCol, .35) * (0.7 + 0.4 * lit), 1. - cloud * .8); ccol *= (1. - night * .75); c = mix(c, ccol, clamp(cov, 0., 1.) * (cloud * .9 + .35)); }
        if (d.y < 0.0) c = mix(hor, hor * 0.7, clamp(-d.y * 4.0, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });   // polish v1: run the sky through the same tone-mapping + sRGB output as the lit scene, so fogged hills meet the sky without a dark band
  const m = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -10; return m;
}

/** Geometry of one river band covering world z in [z0, z1] (the river runs the whole length of the world; bands load with tiles). */
function waterBandGeometry(z0, z1) {
  const nx = 24, nz = Math.max(2, Math.round((z1 - z0) / 1)), pos = [], dep = [], idx = [], uvs = [], flow = [];
  for (let j = 0; j <= nz; j++) { const z = z0 + j * ((z1 - z0) / nz); for (let i = 0; i <= nx; i++) { const x = riverX(z) + (i / nx - 0.5) * 22; pos.push(x, waterY(z), z); const dd = Math.max(0, waterY(z) - terrainAt(x, z)), tz = 1, tx = (riverX(z + 0.5) - riverX(z - 0.5)), tl = Math.hypot(tx, tz); dep.push(dd); uvs.push(x * 0.12, z * 0.12); flow.push(tx / tl, tz / tl, (0.35 + 0.65 * Math.min(1, dd / 0.8)) * (0.85 + 0.15 * Math.sin(z * 0.11))); } }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g;
}
/** The water system: ONE shared material (uniforms, ripples) and a group of bands that stream in and out with the tile rows. */
export function makeWater() {
  const ripples = Array.from({ length: 6 }, () => new THREE.Vector3(0, 0, -99));        // x, z, age
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime, nrm: { value: waterNormalTexture() }, zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() },
      fogColor: { value: new THREE.Color() }, fogNear: { value: 20 }, fogFar: { value: 120 }, flow: { value: 1 }, ripples: { value: ripples }, night: { value: 0 }, litAmt: { value: 1 }, uRain: { value: 0 }, uWindW: { value: 0 }, uFlash: { value: 0 } },
    vertexShader: 'attribute float aDepth; attribute vec3 aFlow; varying vec3 vFl; varying float vD; varying vec3 vW; varying vec2 vUv; void main(){ vFl=aFlow; vD=aDepth; vUv=uv; vec4 w=modelMatrix*vec4(position,1.0); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform sampler2D nrm; uniform float uTime, fogNear, fogFar, flow, night, litAmt, uRain, uFlash, uWindW; varying vec3 vFl; uniform vec3 zen,hor,sunDir,sunCol,fogColor; uniform vec3 ripples[6]; varying float vD; varying vec3 vW; varying vec2 vUv;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      void main(){
        // flow map: two phases of the normal map advected along the river's own direction, cross-faded to hide the reset
        vec2 dir = normalize(vFl.xy + 1e-4); float spd = (0.05 + 0.04 * uRain) * vFl.z * flow, t0 = fract(uTime * 0.18), t1 = fract(uTime * 0.18 + 0.5), wgt = abs(t0 * 2.0 - 1.0);
        vec2 q = vUv; vec2 off = vec2(-dir.x, -dir.y);
        vec3 a0 = texture2D(nrm, q * 1.6 + off * t0 * 0.9 * vFl.z * flow).xyz * 2.0 - 1.0, a1 = texture2D(nrm, q * 1.6 + off * t1 * 0.9 * vFl.z * flow + 0.37).xyz * 2.0 - 1.0;
        vec3 b0 = texture2D(nrm, q * 3.3 + off * t0 * 1.6 * vFl.z * flow + 0.2).xyz * 2.0 - 1.0, b1 = texture2D(nrm, q * 3.3 + off * t1 * 1.6 * vFl.z * flow + 0.71).xyz * 2.0 - 1.0;
        vec3 n1 = mix(a0, a1, wgt), n2 = mix(b0, b1, wgt); vec2 f = off * uTime * spd;
        float chop = 0.5 + uRain*0.4 + uWindW*0.45*(0.6 + 0.4*sin(uTime*0.9 + vW.x*0.05 + vW.z*0.04));   // wind roughens the surface in gusts
        vec3 N = normalize(vec3((n1.x+n2.x)*chop, 2.6 - uRain*0.8 - uWindW*0.5, (n1.y+n2.y)*chop));
        float drops = 0.0; for (int k=0;k<2;k++){ vec2 qq = vW.xz*(2.4+float(k)*1.1)+float(k)*7.3; vec2 id=floor(qq), ff=fract(qq)-.5; float ph=fract(hh(id)+uTime*(.55+hh(id+3.)*.9)); float rr=ph*.5; drops += smoothstep(.04,0.,abs(length(ff)-rr))*(1.-ph)*step(hh(id+7.),uRain*.85); }
        float rip = 0.0; for (int i=0;i<6;i++){ float age = ripples[i].z; if (age >= 0.0 && age < 3.0){ float d = distance(vW.xz, ripples[i].xy); float r = age*1.2; rip += smoothstep(0.18,0.0,abs(d-r)) * (1.0-age/3.0); } }
        N = normalize(N + vec3(rip*0.0, 0.0, 0.0));
        vec3 V = normalize(cameraPosition - vW); float fr = pow(1.0 - max(dot(N,V),0.0), 3.0);
        vec3 refl = mix(hor, zen, clamp(reflect(-V,N).y * 1.4, 0.0, 1.0));
        vec3 deep = mix(vec3(0.03,0.22,0.24), vec3(0.01,0.04,0.07), night), shallow = mix(vec3(0.24,0.50,0.38), vec3(0.03,0.08,0.10), night);
        vec3 body = mix(shallow, deep, smoothstep(0.0,0.9,vD));
        vec3 c = mix(body, refl, clamp(0.06 + fr * 0.8, 0.0, 1.0)); c += body * 0.0;
        vec3 R = reflect(-sunDir, N); float sp = pow(max(dot(R,V),0.0), 160.0) * 2.2 + pow(max(dot(R,V),0.0), 16.0) * 0.12; c += sunCol * sp * litAmt;
        float foam = smoothstep(0.16, 0.0, vD) * (0.5 + 0.5 * texture2D(nrm, vUv * 4.0 + f * 2.0).x); c = mix(c, vec3(0.85,0.9,0.88) * (1.0 - night*0.6), foam * 0.55);
        c += vec3(0.7,0.85,1.0) * (rip * 0.35 + drops * 0.5) * (1.0-night*0.5); float streak = smoothstep(.55,.9, texture2D(nrm, vUv*vec2(2.,.55) + off*uTime*spd*3.).x) * smoothstep(.1,.6,vD) * 0.18; c += (sunCol*0.8+0.2) * streak * litAmt * (1.0 - night*.7); c += vec3(.8,.85,1.) * uFlash * .5;
        float dist = distance(cameraPosition, vW); c = mix(c, fogColor, smoothstep(fogNear, fogFar, dist));
        float a = clamp(vD * 3.2, 0.0, 1.0) * 0.93; a = max(a, foam * 0.5) * step(0.001, vD + foam); gl_FragColor = vec4(c, a); }` });
  const grp = new THREE.Group(); grp.name = 'water'; grp.material = mat; grp.userData.ripples = ripples; const bands = new Map();
  grp.userData.hasBand = (tz) => bands.has(tz);
  grp.userData.addBand = (tz) => { if (WS || bands.has(tz)) return; const R = tileRect(0, tz), m = new THREE.Mesh(waterBandGeometry(R.z0, R.z1), mat); m.renderOrder = 2; m.name = 'water-band-' + tz; bands.set(tz, m); grp.add(m); };
  grp.userData.removeBand = (tz) => { const m = bands.get(tz); if (!m) return; grp.remove(m); m.geometry.dispose(); bands.delete(tz); };
  // the sea: one flat plane per tile that holds any water below SEA_Y; shares the river material (so weather, ripples and lighting match)
  const seaMeshes = new Map(), seaHas = new Map();
  const seaGeo = (tx, tz) => { const R = tileRect(tx, tz), n = 24, pos = [], dep = [], uvs = [], flow = [], idx = [];
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = R.x0 + i * TILE / n, z = R.z0 + j * TILE / n; pos.push(x, SEA_Y, z); dep.push(Math.max(0, SEA_Y - terrainAt(x, z))); uvs.push(x * 0.12, z * 0.12); flow.push(0.6, 0.8, 0.18); }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g; };
  const tileHasSea = (tx, tz) => { const R = tileRect(tx, tz); for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) if (SEA_Y - terrainAt(R.x0 + i * TILE / 4, R.z0 + j * TILE / 4) > 0.05) return true; return false; };
  // watershed world: one mesh per tile that holds water, 1 m vertices; every vertex sits on its own water surface (sea 0, each lake its own flat level, streams their descending surface),
  // dry vertices sink just below the ground so the shoreline is where the surface meets the real terrain. Depth/foam/flow attributes feed the shared water shader.
  const wsGeo = (tx, tz) => { const R = tileRect(tx, tz), n = 48, pos = [], dep = [], uvs = [], flow = [], idx = []; let any = false;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = R.x0 + i * TILE / n, z = R.z0 + j * TILE / n, sm = WS.sample(x, z), d = sm.depth;
      if (d > 0.005) any = true; const nl = sm.near > -1e8 ? sm.near : null; pos.push(x, nl !== null ? nl : sm.g - 0.35, z); dep.push(nl !== null ? Math.max(sm.depth, Math.min(0, nl - sm.g)) : 0); uvs.push(x * 0.12, z * 0.12);
      if (sm.flowX || sm.flowZ - 1) flow.push(sm.flowX, sm.flowZ, 0.6); else flow.push(0.6, 0.8, 0.18); }
    if (!any) return null;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setAttribute('aFlow', new THREE.Float32BufferAttribute(flow, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g; };
  grp.userData.syncSea = (tiles) => { const want = new Set();
    if (WS) { for (const T of tiles.values()) { const k = T.tx + ',' + T.tz; want.add(k); if (seaHas.has(k)) continue; const g = wsGeo(T.tx, T.tz); seaHas.set(k, !!g); if (!g) continue;
        const m = new THREE.Mesh(g, mat); m.renderOrder = 2; m.name = 'water-ws-' + k; seaMeshes.set(k, m); grp.add(m); }
      for (const [k, m] of seaMeshes) if (!want.has(k)) { grp.remove(m); m.geometry.dispose(); seaMeshes.delete(k); seaHas.delete(k); }
      for (const k of [...seaHas.keys()]) if (!want.has(k)) seaHas.delete(k);
      return; }
    for (const T of tiles.values()) { const k = T.tx + ',' + T.tz; let h = seaHas.get(k); if (h === undefined) { h = tileHasSea(T.tx, T.tz); seaHas.set(k, h); }
      if (!h) continue; want.add(k); if (!seaMeshes.has(k)) { const m = new THREE.Mesh(seaGeo(T.tx, T.tz), mat); m.renderOrder = 2; m.name = 'water-sea-' + k; m.frustumCulled = true; seaMeshes.set(k, m); grp.add(m); } }
    for (const [k, m] of seaMeshes) if (!want.has(k)) { grp.remove(m); m.geometry.dispose(); seaMeshes.delete(k); } };
  grp.userData.addRipple = (x, z) => { let k = 0, oldest = -1; ripples.forEach((r, i) => { if (r.z > oldest) { oldest = r.z; k = i; } }); ripples[k].set(x, z, 0); };
  grp.userData.tick = (dt) => { for (const r of ripples) if (r.z >= 0) { r.z += dt; if (r.z > 3) r.z = -99; } };
  return grp;
}

/** Short patchy grass + clover, instanced and streamed around the player in 1 m cells (stable per cell, so nothing
 *  shimmers). Placement uses the same ground surface and colour patches as the terrain. */
export function makeGrass(max = 12000, radius = 19) {
  const blade = new THREE.BufferGeometry(), v = [], cl = [], idx = [];
  for (let k = 0; k < 5; k++) {                                    // five slightly splayed blades per tuft
    const a = k * 1.2566 + 0.3, lean = 0.05 + (k % 2) * 0.05, w = 0.02, base = v.length / 3;
    v.push(Math.cos(a) * 0.05 - w * Math.sin(a), 0, Math.sin(a) * 0.05 + w * Math.cos(a), Math.cos(a) * 0.05 + w * Math.sin(a), 0, Math.sin(a) * 0.05 - w * Math.cos(a), Math.cos(a) * (0.05 + lean), 0.13 + (k % 3) * 0.035, Math.sin(a) * (0.05 + lean));
    cl.push(0.5, 0.62, 0.42, 0.5, 0.62, 0.42, 1.0, 1.0, 0.75); idx.push(base, base + 1, base + 2);
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); blade.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3)); blade.setIndex(idx); blade.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }); addSway(mat, 2.2, 2.0, 0);
  const mesh = new THREE.InstancedMesh(blade, mat, max), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), color = new THREE.Color();
  const cache = new Map(); mesh.frustumCulled = false; mesh.userData = { total: max, center: null, density: 1 };
  const cellInfo = (ix, iz) => { const key = ix * 7919 + iz; let c = cache.get(key); if (!c) { const x = ix + 0.5, z = iz + 0.5, info = surfaceInfo(x, z); c = { ok: !(info.bank > 0.5 || info.rock > 0.5 || info.path > 0.45 || info.camp > 0.6 || waterY(z) - terrainAt(x, z) > -0.05), patch: info.patch, edge: info.bank }; cache.set(key, c); if (cache.size > 6000) cache.delete(cache.keys().next().value); } return c; };
  mesh.userData.update = (fx, fz, force = false) => {
    const c0 = mesh.userData.center; if (!force && c0 && Math.hypot(fx - c0[0], fz - c0[1]) < 3) return; mesh.userData.center = [fx, fz];
    let n = 0; const R2 = radius * radius, ix0 = Math.floor(fx - radius), iz0 = Math.floor(fz - radius), dens = mesh.userData.density;
    for (let ix = ix0; ix <= ix0 + radius * 2; ix++) for (let iz = iz0; iz <= iz0 + radius * 2; iz++) {
      const d2 = (ix + 0.5 - fx) ** 2 + (iz + 0.5 - fz) ** 2; if (d2 > R2) continue; const c = cellInfo(ix, iz); if (!c.ok) continue;
      const fade = 1 - Math.min(1, Math.max(0, (Math.sqrt(d2) - (radius - 6)) / 6)), rng = makeRng((ix * 73856093) ^ (iz * 19349663)), cnt = Math.floor((c.patch * 12 + 1.5) * dens);
      for (let k = 0; k < cnt && n < max; k++) {
        const x = ix + rng(), z = iz + rng(), r = rng(), sz = (0.6 + rng() * 0.7) * fade; if (sz < 0.12) continue;
        e.set(0, rng() * 6.283, (rng() - 0.5) * 0.2); q.setFromEuler(e); sc.set(sz * 1.3, sz, sz * 1.3); p.set(x, groundAt(x, z) - 0.015, z); m.compose(p, q, sc); mesh.setMatrixAt(n, m);
        const clover = c.patch > 0.62 && r < 0.18; color.setHSL(clover ? 0.33 : 0.22 + rng() * 0.06, clover ? 0.5 : 0.5 + rng() * 0.2, (clover ? 0.36 : 0.34) + rng() * 0.16 + c.patch * 0.07); mesh.setColorAt(n, color); n++;
      }
    }
    mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  return mesh;
}

export function makeShafts(n = 7) {
  const tex = softTexture('shaft'), g = new THREE.Group(), rng = makeRng(31), geo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < n; i++) {
    const d = { ox: (rng() - 0.5) * 34, oz: (rng() - 0.5) * 34, w: 3.5 + rng() * 6, ph: rng() * 6.28, sp: 0.15 + rng() * 0.2, meshes: [] };
    for (let k = 0; k < 2; k++) {                               // two crossed cards so a shaft reads from any angle
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0xffd8a0 });
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 5; m.userData = d; d.meshes.push(m); g.add(m);
    }
  }
  const up = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(), Z = new THREE.Vector3(), S = new THREE.Vector3(), M = new THREE.Matrix4();
  g.userData.update = (focus, a, time, amt) => {
    S.set(...a.sunDir).normalize();                                     // towards the light
    const len = Math.min(70, 16 / Math.max(S.y, 0.12)), seen = new Set();
    X.crossVectors(S, up).normalize();
    for (const m of g.children) {
      const d = m.userData, bx = focus.x + d.ox, bz = focus.z + d.oz, k = d.meshes.indexOf(m);
      const bottom = new THREE.Vector3(bx, groundAt(bx, bz) - 0.3, bz), mid = bottom.clone().addScaledVector(S, len / 2);
      if (k === 0) { Z.crossVectors(X, S).normalize(); M.makeBasis(X, S, Z); } else { Z.crossVectors(X, S).normalize(); M.makeBasis(Z, S, X.clone().negate()); }
      m.quaternion.setFromRotationMatrix(M); m.position.copy(mid); m.scale.set(d.w, len, 1);
      m.material.opacity = amt * (0.5 + 0.2 * Math.sin(time * d.sp + d.ph)); m.material.color.setRGB(...a.lightColor); m.visible = amt > 0.02;
    }
  };
  return g;
}

/** A functional campfire: logs + stones (library logs), flame billboards, ember light, smoke. Returns {group, update, light}. */
export function makeFire(models, x, z) {
  const g = new THREE.Group(), y = groundAt(x, z); g.position.set(x, y, z);
  if (models.fm_campfire_stage1_laid) g.add(instantiate(models, 'fm_campfire_stage1_laid', 0, 0, 0.3, 1.0, 0, 0)); else { if (models.fire_stone_ring) g.add(instantiate(models, 'fire_stone_ring', 0, 0, 0.3, 1.0, 0, 0));
  for (let i = 0; i < 3; i++) { const l = instantiate(models, 'Timber_Log', 0, 0, i * 2.09 + 0.4, 0.55, 0, 0); l.position.set(Math.cos(i * 2.09 + 1) * 0.32, 0.08, Math.sin(i * 2.09 + 1) * 0.32); l.rotation.set(0.2, i * 2.09 + 0.4, 0.15); g.add(l); } }
  const flameTex = softTexture('flame'), flames = [];
  for (let i = 0; i < 3; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })); s.position.set((i - 1) * 0.1, 0.5, 0); s.scale.set(0.8, 1.2, 1); s.userData.ph = i * 2.1; g.add(s); flames.push(s); }
  const light = new THREE.PointLight(0xff9a40, 0, 16, 1.6); light.position.set(0, 1.0, 0); g.add(light);
  const N = 22, sp = new Float32Array(N * 3), smoke = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)),
    new THREE.PointsMaterial({ map: softTexture('dot'), size: 0.9, transparent: true, opacity: 0.22, depthWrite: false, color: 0xb8b4ae, sizeAttenuation: true }));
  smoke.frustumCulled = false; g.add(smoke);
  const age = Array.from({ length: N }, (_, i) => i / N * 4);
  const update = (t, dt, night, motion = 1) => {
    flames.forEach((f, i) => { const k = 1 + 0.18 * Math.sin(t * 9 + f.userData.ph) + 0.1 * Math.sin(t * 17 + i); f.scale.set(0.75 * k * (1 - i * 0.12), 1.15 * k * (1 + (motion ? 0 : 0)), 1); f.position.y = 0.5 + 0.05 * Math.sin(t * 7 + i); f.position.x = (i - 1) * 0.1 + 0.05 * Math.sin(t * 5 + i * 2); });
    light.intensity = (night * 22 + 6) * (0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.7));
    if (motion) for (let i = 0; i < N; i++) { age[i] += dt; if (age[i] > 4) age[i] = 0; const a = age[i]; sp[i * 3] = Math.sin(i * 1.7 + a * 1.2) * 0.25 * a + 0.4 * a * 0.3; sp[i * 3 + 1] = 1.0 + a * 0.9; sp[i * 3 + 2] = Math.cos(i * 2.3 + a) * 0.2 * a; }
    smoke.geometry.attributes.position.needsUpdate = true;
  };
  return { group: g, update, light, x, z };
}

/** Ambient life: drifting pollen/dust motes in sun shafts and fireflies at dusk. Count scales with quality. */
export function makeMotes(max = 260) {
  const pos = new Float32Array(max * 3), ph = new Float32Array(max); const rng = makeRng(9);
  for (let i = 0; i < max; i++) { pos[i * 3] = (rng() - 0.5) * 40; pos[i * 3 + 1] = 0.5 + rng() * 5; pos[i * 3 + 2] = (rng() - 0.5) * 40; ph[i] = rng() * 6.28; }
  const m = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)), new THREE.PointsMaterial({ map: softTexture('dot'), size: 0.14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff1c0, opacity: 0.8, fog: false }));
  m.frustumCulled = false; const base = pos.slice();
  m.userData.update = (focus, t, a, density = 1, motion = 1) => {
    const n = Math.floor(max * density); m.geometry.setDrawRange(0, n);
    for (let i = 0; i < n; i++) { const bx = Math.round((focus.x - base[i * 3]) / 40) * 40 + base[i * 3], bz = Math.round((focus.z - base[i * 3 + 2]) / 40) * 40 + base[i * 3 + 2];
      const x = bx + Math.sin(t * 0.2 * motion + ph[i]) * 1.5, z = bz + Math.cos(t * 0.17 * motion + ph[i] * 1.3) * 1.5; pos[i * 3] = x; pos[i * 3 + 2] = z; pos[i * 3 + 1] = groundAt(x, z) + 0.6 + (base[i * 3 + 1] % 4) + Math.sin(t * 0.5 * motion + ph[i]) * 0.4; }
    m.geometry.attributes.position.needsUpdate = true;
    m.material.color.setRGB(...(a.night > 0.5 ? [0.7, 1, 0.45] : a.lightColor)); m.material.opacity = a.night > 0.5 ? 0.9 : 0.25 + a.shafts * 0.6; m.material.size = a.night > 0.5 ? 0.2 : 0.12;
  };
  return m;
}

export function makeSprite(text, scale = 1) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.font = 'bold 56px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(text, 128, 48); g.fillStyle = '#fff'; g.fillText(text, 128, 48);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false })); s.scale.set(1.6 * scale, 0.6 * scale, 1); return s;
}

/** All props of one library model drawn as InstancedMeshes (one draw call per mesh part), rebuilt from a visible list.
 *  Roots are pivot-corrected exactly like instantiate(); sway is the same wind shader. */
export function makeInstancedKind(models, name, capacity, { sway = 0, freq = 1, hBase = 0.4, sink = 0, shadow = true } = {}) {
  const m = models[name], group = new THREE.Group(), parts = [];
  m.root.updateMatrixWorld(true);
  m.root.traverse(o => { if (o.isMesh) {
    const mat = o.material.clone(); if (sway) addSway(mat, sway, freq, hBase);
    const im = new THREE.InstancedMesh(o.geometry, mat, capacity); im.castShadow = shadow; im.receiveShadow = shadow; im.frustumCulled = false; im.count = 0;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3).fill(1), 3);
    parts.push({ im, local: o.matrixWorld.clone() }); group.add(im); } });
  const T = new THREE.Matrix4(), R = new THREE.Matrix4(), Sc = new THREE.Matrix4(), B = new THREE.Matrix4(), M = new THREE.Matrix4();
  group.userData.set = (list) => {
    const n = Math.min(list.length, capacity);
    for (let i = 0; i < n; i++) { const p = list[i];
      T.makeTranslation(p.x, p.y, p.z); R.makeRotationY(p.rot); Sc.makeScale(p.scale, p.scale, p.scale); B.makeTranslation(-m.base.x, -m.minY - sink / p.scale, -m.base.z);
      M.copy(T).multiply(R).multiply(Sc).multiply(B);
      const tc = group.userData.tintFn ? group.userData.tintFn(p) : null;
      for (const pt of parts) { pt.im.setMatrixAt(i, tmpM.multiplyMatrices(M, pt.local)); pt.im.instanceColor.setXYZ(i, tc ? tc[0] : 1, tc ? tc[1] : 1, tc ? tc[2] : 1); } }
    for (const pt of parts) { pt.im.count = n; pt.im.instanceMatrix.needsUpdate = true; pt.im.instanceColor.needsUpdate = true; }
    group.userData.count = n;
  };
  return group;
}
const tmpM = new THREE.Matrix4();

/** Rigged avatar from a Meshy GLB (skinned mesh + walk clip). Feet seated at y=0, scaled to targetHeight. Falls back to the primitive avatar. */
export function makeAvatarFromModel(models, name, targetHeight) {
  const m = models[name]; if (!m) return null;
  const root = m.root, box = new THREE.Box3().setFromObject(root), h = box.max.y - box.min.y, k = targetHeight / h;
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(root); g.add(inner); inner.scale.setScalar(k);
  root.position.y -= box.min.y; root.position.x -= (box.min.x + box.max.x) / 2; root.position.z -= (box.min.z + box.max.z) / 2;
  root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(root), find = (re) => m.clips.find(c => re.test(c.name)) || null, walkClip = find(/walk/i) || m.clips[0], idleClip = find(/idle/i);
  const walk = walkClip ? mixer.clipAction(walkClip) : null, idle = idleClip && idleClip !== walkClip ? mixer.clipAction(idleClip) : null; if (walk) walk.play(); if (idle) idle.play();
  let ts = 0, wk = 0;
  g.userData.animate = (speed01, t, dt = 0.016) => { const moving = speed01 > 0.05; ts += ((moving ? 0.7 + speed01 * 0.8 : 0) - ts) * Math.min(1, dt * 10); wk += ((moving ? 1 : 0) - wk) * Math.min(1, dt * 9);
    if (walk) { walk.timeScale = idle ? ts : ts; walk.setEffectiveWeight(idle ? wk : 1); } if (idle) idle.setEffectiveWeight(1 - wk); mixer.update(dt); };
  g.userData.isModel = true; g.userData.height = targetHeight; return g;
}

/** A small stylised placeholder avatar built from primitives (no rig); legs/arms swing smoothly. */
export function makePlayer() {
  const g = new THREE.Group(), skin = new THREE.MeshLambertMaterial({ color: 0xe0b48a }), cloth = new THREE.MeshLambertMaterial({ color: 0x3e6aa0 }), pant = new THREE.MeshLambertMaterial({ color: 0x4a4034 }), hat = new THREE.MeshLambertMaterial({ color: 0x8a3b2a });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 4, 10), cloth); body.position.y = 0.95; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), skin); head.position.y = 1.5; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 8, 0, 6.283, 0, 1.3), hat); cap.position.y = 1.54; g.add(cap);
  const mkLimb = (x, mat, y, len) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, len, 3, 8), mat); m.position.y = -len / 2 - 0.05; p.add(m); g.add(p); return p; };
  const legL = mkLimb(-0.1, pant, 0.72, 0.5), legR = mkLimb(0.1, pant, 0.72, 0.5), armL = mkLimb(-0.27, cloth, 1.28, 0.38), armR = mkLimb(0.27, cloth, 1.28, 0.38);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.animate = (speed01, t) => { const s = Math.sin(t * 9) * 0.7 * speed01; legL.rotation.x = s; legR.rotation.x = -s; armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.8; body.position.y = 0.95 + Math.abs(Math.sin(t * 9)) * 0.03 * speed01; };
  return g;
}
/** polish v1: directional wind with travelling gust fronts. amp = bend at the top as a fraction of the model height squared, hBase = local y where the bend starts,
 *  flutter = high-frequency leaf shake (model units, strongest toward the top, scaled by hTop), hTop = model height. Bends along the world wind direction uWindDir. */
export const uWindDir = { value: new THREE.Vector2(0.8, 0.6) };
export const GUST = `float gustAt(vec2 w, vec2 wd, float t) { float g = 0.5 + 0.5 * sin(dot(w, wd) * 0.11 - t * 1.5 + 1.3 * sin(dot(w, vec2(-wd.y, wd.x)) * 0.07)); return g * g; }`;
function addWindSway(mat, { amp = 0.05, freq = 1.4, hBase = 0, flutter = 0, hTop = 1 } = {}) {
  if (mat.userData.windSway) return; mat.userData.windSway = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime; sh.uniforms.uWind = uWind; sh.uniforms.uWindDir = uWindDir;
    sh.vertexShader = 'uniform float uTime; uniform float uWind; uniform vec2 uWindDir;\n' + GUST + '\n' + sh.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       float hh = max(0.0, position.y - ${hBase.toFixed(3)});
       #ifdef USE_INSTANCING
         mat4 wm = modelMatrix * instanceMatrix;
       #else
         mat4 wm = modelMatrix;
       #endif
       vec3 wp = (wm * vec4(position, 1.0)).xyz;
       vec2 wd = normalize(uWindDir);
       float gust = gustAt(wp.xz, wd, uTime), w = uWind * (0.6 + 0.9 * gust), ph = wp.x * 0.35 + wp.z * 0.27;
       vec3 dl = normalize(transpose(mat3(wm)) * vec3(wd.x, 0.0, wd.y) + vec3(1e-5)); vec3 pl = vec3(-dl.z, 0.0, dl.x);
       float bend = hh * hh * ${amp.toFixed(5)} * w;
       transformed += dl * bend * (1.0 + 0.3 * sin(uTime * ${freq.toFixed(2)} + ph)) + pl * bend * 0.35 * sin(uTime * ${(freq * 1.7).toFixed(2)} + ph * 1.3);
       transformed.y -= bend * bend / (hh + 0.5) * 0.3;   // a bent stem also drops a little
       ${flutter > 0 ? `float fl = smoothstep(0.1, 1.0, hh / ${hTop.toFixed(3)}) * ${flutter.toFixed(5)} * w * w;
       transformed += vec3(sin(uTime * 11.0 + wp.x * 6.0 + wp.y * 4.0), cos(uTime * 9.0 + wp.z * 5.0), sin(uTime * 13.0 + wp.z * 7.0 + wp.x * 3.0)) * fl;` : ''}`);
  };
  mat.customProgramCacheKey = () => `wsway${amp}${freq}${hBase}${flutter}${hTop}`;
  mat.needsUpdate = true;
}
export { addSway, addWindSway };
