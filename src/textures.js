// Procedural textures generated in code (no external image files). Original to this build.
import * as THREE from 'three';
const rnd = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;
function canvas(n) { const c = document.createElement('canvas'); c.width = c.height = n; return c; }
function tex(c, rep = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = rep ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; return t; }

/** Greyscale-ish ground detail: soil grit, blade flecks, clover dots. Multiplied with vertex colour. */
export function groundTexture() {
  const n = 512, c = canvas(n), g = c.getContext('2d'), r = rnd(12345);
  g.fillStyle = '#d6d6cc'; g.fillRect(0, 0, n, n);
  const wrap = (x, y, f) => { for (const dx of [-n, 0, n]) for (const dy of [-n, 0, n]) f(x + dx, y + dy); };
  for (let i = 0; i < 9000; i++) { const x = r() * n, y = r() * n, v = 150 + r() * 90 | 0; wrap(x, y, (X, Y) => { g.fillStyle = `rgba(${v},${v},${v - 8},0.35)`; g.fillRect(X, Y, 1 + r() * 2, 1 + r() * 2); }); }
  for (let i = 0; i < 2600; i++) { const x = r() * n, y = r() * n, l = 3 + r() * 6, a = -1.2 + r() * 0.5, v = 100 + r() * 70 | 0; wrap(x, y, (X, Y) => { g.strokeStyle = `rgba(${v},${v + 30},${v - 20},0.55)`; g.lineWidth = 1; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); g.stroke(); }); }
  for (let i = 0; i < 700; i++) { const x = r() * n, y = r() * n; wrap(x, y, (X, Y) => { g.fillStyle = 'rgba(70,90,50,0.35)'; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(X + Math.cos(k * 2.1) * 2, Y + Math.sin(k * 2.1) * 2, 1.7, 0, 6.3); g.fill(); } }); }
  return tex(c);
}
/** Tileable tangent-space normal map from value noise, for flowing water. */
export function waterNormalTexture(n = 256) {
  // Tileable height field from a sum of waves with INTEGER wave vectors (so it wraps exactly) and random phases.
  // (Value-noise lattices produced visible straight grid lines in the normals; waves have none.)
  const h = new Float32Array(n * n), r = rnd(777), waves = [];
  for (let i = 0; i < 22; i++) { let kx = 0, ky = 0; while (!kx && !ky) { kx = Math.floor(r() * 15) - 7; ky = Math.floor(r() * 15) - 7; } const k = Math.hypot(kx, ky); waves.push([kx, ky, 1 / Math.pow(k, 0.8), r() * 6.283, 0.7 + r() * 0.6]); }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let v = 0; for (const [kx, ky, a, ph] of waves) v += a * Math.sin((kx * x + ky * y) / n * 6.283185 + ph); h[y * n + x] = v * 0.12 + 0.5; }
  const c = canvas(n), g = c.getContext('2d'), im = g.createImageData(n, n), H = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * 7, dy = (H(x, y + 1) - H(x, y - 1)) * 7, l = Math.hypot(dx, dy, 1), o = (y * n + x) * 4;
    im.data[o] = (-dx / l * 0.5 + 0.5) * 255; im.data[o + 1] = (-dy / l * 0.5 + 0.5) * 255; im.data[o + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[o + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; t.anisotropy = 4; return t;
}
/** Soft vertical gradient strip used for light shafts and flame sprites. */
export function softTexture(kind = 'shaft') {
  const c = canvas(128), g = c.getContext('2d');
  if (kind === 'shaft') { const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    const gv = g.createLinearGradient(0, 0, 0, 128); gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(0.15, 'rgba(0,0,0,0.6)'); gv.addColorStop(0.5, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'destination-in'; g.fillStyle = gv; g.fillRect(0, 0, 128, 128); }
  else if (kind === 'flame') { const gr = g.createRadialGradient(64, 84, 4, 64, 70, 60); gr.addColorStop(0, 'rgba(255,250,200,1)'); gr.addColorStop(0.35, 'rgba(255,170,50,0.85)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.globalCompositeOperation = 'destination-in'; const m = g.createLinearGradient(0, 0, 0, 128); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.25, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = m; g.fillRect(0, 0, 128, 128); }
  else { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
