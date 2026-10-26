// Copied unchanged from living-postcard-mobile-v4/src/weather.js (Claude-authored Postcard weather state; first 78 lines = WeatherState). Time-of-day helpers omitted.

export const CHANNELS = ['cloud', 'fog', 'rain', 'wet', 'wind', 'storm', 'snow', 'dust'];
export const WEATHER = {
  clear: {label: 'Clear', ch: {}},
  cloudy: {label: 'Cloudy', ch: {cloud: 1}},
  mist: {label: 'Mist', ch: {fog: 1, cloud: .25}},
  shower: {label: 'Passing shower', ch: {cloud: .3, wet: .35}},       // scenes that opt in run a moving rain cell and a rainbow
  rain: {label: 'Rain', ch: {cloud: .75, rain: 1, wet: 1}},
  storm: {label: 'Storm', ch: {cloud: 1, rain: 1, wet: 1, wind: 1, storm: 1}},
  snow: {label: 'Snow', ch: {cloud: .5, snow: 1}},
  dust: {label: 'Dust and wind', ch: {dust: 1, wind: 1, cloud: .2}},
  wind: {label: 'Windy', ch: {wind: 1, cloud: .3}},
};
// seconds for a channel to cover ~63% of the way; wetness dries slowly
const TAU = {cloud: 2.6, fog: 3.2, rain: 1.8, wet: 3.5, wind: 2.2, storm: 2.0, snow: 2.4, dust: 2.4};
const TAU_DRY = {wet: 22};
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

export class WeatherState {
  constructor({allowed = ['clear', 'cloudy', 'rain'], seed = 1, comfort = true} = {}) {
    this.allowed = allowed; this.type = 'clear'; this.intensity = .6; this.auto = false; this.comfort = comfort;
    this.cur = Object.fromEntries(CHANNELS.map(c => [c, 0])); this.target = {...this.cur};
    this.rand = mulberry(seed); this.autoTimer = 0; this.light = {timer: 8, t: -1, pulses: [], azimuth: 0, flash: 0, count: 0, last: -99};
    this.clock = 0;
  }
  setAllowed(list) { this.allowed = list.length ? list : ['clear']; if (!this.allowed.includes(this.type)) this.set('clear', this.intensity); }
  set(type, intensity = this.intensity) {
    if (!WEATHER[type] || !this.allowed.includes(type)) return false;
    this.type = type; this.intensity = Math.min(1, Math.max(0, intensity)); this.retarget(); return true;
  }
  setIntensity(v) { this.intensity = Math.min(1, Math.max(0, v)); this.retarget(); }
  retarget() { const r = WEATHER[this.type].ch; for (const c of CHANNELS) this.target[c] = Math.min(1, (r[c] || 0) * (this.type === 'clear' ? 0 : this.intensity)); }
  // advance by dt seconds; instant = jump to the targets (reduced motion / paused UI / tests)
  step(dt, {instant = false, paused = false} = {}) {
    this.clock += dt;
    if (this.auto && !paused) {
      this.autoTimer -= dt;
      if (this.autoTimer <= 0) {
        const opts = this.allowed.filter(t => t !== this.type), pick = (this.type !== 'clear' && this.rand() < .55) ? 'clear' : opts[Math.floor(this.rand() * opts.length)] || 'clear';
        this.set(pick, .4 + this.rand() * .55); this.autoTimer = 40 + this.rand() * 50;
      }
    }
    let moving = false;
    for (const c of CHANNELS) {
      const d = this.target[c] - this.cur[c]; if (Math.abs(d) < 1e-4) { this.cur[c] = this.target[c]; continue; }
      const tau = d < 0 ? (TAU_DRY[c] || TAU[c]) : TAU[c], k = instant ? 1 : 1 - Math.exp(-Math.min(dt, .25) / tau);
      this.cur[c] += Math.abs(d) < .002 ? d : d * k; moving = true;
    }
    this.stepLightning(dt, paused || instant);
    return moving;
  }
  stepLightning(dt, hold) {
    const L = this.light, active = !this.comfort && this.cur.storm > .35;
    if (hold || !active) { L.flash = Math.max(0, L.flash - dt * 6); if (!active) { L.t = -1; L.pulses = []; } if (hold) return; }
    if (!active) { L.flash = 0; return; }
    if (L.t < 0) {
      L.timer -= dt;
      if (L.timer <= 0) {   // start a strike: a main pulse and a weaker echo
        L.t = 0; L.azimuth = this.rand() * Math.PI * 2; L.count++; L.last = this.clock;
        L.pulses = [{at: .05, a: .75 + .25 * this.cur.storm}, {at: .26 + this.rand() * .08, a: .3 + .15 * this.rand()}];
      }
    } else {
      L.t += dt; let f = 0;
      for (const p of L.pulses) { const x = L.t - p.at; if (x >= -.05 && x < 0) f += p.a * (1 + x / .05); else if (x >= 0) f += p.a * Math.exp(-x / .11); }
      L.flash = Math.min(1, f);
      if (L.t > 1.4) { L.t = -1; L.flash = 0; L.timer = Math.max(5, (7 + this.rand() * 12) / (.5 + .5 * this.cur.storm)); }
    }
  }
  // 0..1 progress of the current strike (a ~0.2 s leader from cloud to ground, then the flash fades); -1 when idle
  strikeProgress() { return this.light.t < 0 ? -1 : Math.min(1, this.light.t / .2); }
}
