// Time of day -> lighting/sky/fog parameters. Pure (colours as [r,g,b] 0..1) so it is testable and reusable.
// Looks adapted in spirit from the approved Postcard references (misty sunrise, golden dusk); implementation is new.
const hex = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const DAY_LEN = 240;       // seconds for a full day (rules handover)
// Colours taken from the approved Living Postcard mood presets (living-postcard-mobile-v4/src/presets.json: daylight, sunrise, dusk, moon);
// the zenith is a deeper tint of each mood's sky colour so the dome has depth. Postcard look = hazy, warm, slightly muted.
const K = {
  day:   { zen: hex(0x4f9bd8), hor: hex(0xbfe0f0), sun: hex(0xffe9bd), hemiS: hex(0xcfe8ff), hemiG: hex(0x8a9a54), fog: hex(0xb9d6e0) },   // brighter, more saturated storybook day (MegaKit reference look)
  // RED SKIES at sunrise and sunset (parent request 22 Oct, Constitution rule 20): deep red-orange horizon under a dusky violet dome, warm red sun and fog.
  dawn:  { zen: hex(0x5a4a7c), hor: hex(0xe2482c), sun: hex(0xff6a3a), hemiS: hex(0xffb59a), hemiG: hex(0x7a5a4a), fog: hex(0xc9654f) },
  dusk:  { zen: hex(0x45345f), hor: hex(0xd93b22), sun: hex(0xff5a2e), hemiS: hex(0xe6a08f), hemiG: hex(0x66504a), fog: hex(0xb24e40) },
  night: { zen: hex(0x0b1830), hor: hex(0x1c2f4f), sun: hex(0xaac8ff), hemiS: hex(0x8aa8d8), hemiG: hex(0x2d3e56), fog: hex(0x2b4163) },
};
/** p in [0,1): 0.25 sunrise (east, +x), 0.5 noon, 0.75 sunset (west, -x), 0/1 midnight. */
export function atmosphere(p) {
  const a = (p - 0.25) * Math.PI * 2, e = Math.sin(a);
  const sunDir = norm([Math.cos(a), e, 0.42]), moonDir = norm([-Math.cos(a), -e, -0.3]);
  const morning = p < 0.5, golden = 1 - sstep(0.0, 0.5, Math.abs(e));              // 1 at the horizon
  const above = sstep(-0.12, 0.18, e);                                              // 0 night -> 1 daylight
  const edge = morning ? K.dawn : K.dusk;
  let zen = mix(K.night.zen, mix(K.day.zen, edge.zen, golden * 0.9), above);
  let hor = mix(K.night.hor, mix(K.day.hor, edge.hor, golden), above);
  let sun = mix(K.night.sun, mix(K.day.sun, edge.sun, golden), above);
  const hemiS = mix(K.night.hemiS, mix(K.day.hemiS, edge.hemiS, golden), above), hemiG = mix(K.night.hemiG, mix(K.day.hemiG, edge.hemiG, golden), above);
  const fog = mix(K.night.fog, mix(K.day.fog, edge.fog, golden), above);
  const lightDir = e > -0.05 ? sunDir : moonDir;
  const lightI = e > -0.05 ? 0.8 + 2.7 * sstep(-0.05, 0.4, e) + 0.5 * golden * above : 0.9;   // Postcard: sun 3.0-3.6, moon 1.5
  
  return { p, elevation: e, sunDir, moonDir, lightDir, lightColor: e > -0.05 ? sun : K.night.sun, lightIntensity: lightI,
    hemiSky: hemiS, hemiGround: hemiG, hemiIntensity: 0.75 + 0.75 * above, sky: { zenith: zen, horizon: hor },
    fogColor: fog, fogFar: 120 - 48 * golden * above * (morning ? 1 : 0.55) - 22 * (1 - above), fogNear: 16 + 10 * above - 6 * golden * above,
    shafts: Math.max(0, Math.min(1, golden * above * (morning ? 1 : 0.8))), night: 1 - above, exposure: 0.95 + 0.1 * above, isMorning: morning };
}
function norm(v) { const l = Math.hypot(...v); return v.map(x => x / l); }
export const phaseName = (p) => { const e = Math.sin((p - 0.25) * Math.PI * 2); return e < -0.1 ? 'Night' : e < 0.18 ? (p < 0.5 ? 'Sunrise' : 'Dusk') : 'Day'; };

/** Apply weather channels (0..1: cloud, fog, rain, wet, wind, storm; light.flash) to an atmosphere() result. Returns a new object. */
export function withWeather(a, ch, flash = 0) {
  const day = 1 - a.night, overcast = Math.min(1, ch.cloud + ch.rain * 0.4), greyV = (0.30 + 0.5 * day);
  const grey = [0.56 * greyV, 0.61 * greyV, 0.67 * greyV], g = (c, k) => mix(c, grey, k);
  const o = { ...a, sky: { zenith: g(a.sky.zenith, overcast * 0.8), horizon: g(a.sky.horizon, overcast * 0.7) }, fogColor: g(a.fogColor, Math.min(1, overcast * 0.75 + ch.fog * 0.5)),
    lightIntensity: a.lightIntensity * (1 - 0.68 * overcast) + flash * 3.2, hemiIntensity: a.hemiIntensity * (1 - 0.12 * overcast) + flash * 1.4,
    hemiSky: mix(a.hemiSky, grey, overcast * 0.5), shafts: a.shafts * Math.max(0, 1 - overcast * 1.4), exposure: a.exposure * (1 - 0.06 * overcast),
    fogNear: a.fogNear * (1 - 0.7 * ch.fog - 0.3 * ch.rain), fogFar: a.fogFar * (1 - 0.62 * ch.fog - 0.35 * ch.rain), cloud: ch.cloud, wetness: ch.wet, flash };
  o.lightColor = mix(a.lightColor, [0.8, 0.85, 0.95], overcast * 0.5);
  return o;
}
