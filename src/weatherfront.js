// Rain is ONE global state (WeatherState); this only shapes how hard it falls at a place and moment, with a slow world-space field that drifts,
// so a rain front arrives, passes and moves on. Pure function of (x, z, t): identical on both sides of every tile join (Constitution rule 24).
import { fbm } from './terrain.js';
/** 0.15..1 multiplier on the global rain at world position (x, z), time t seconds. */
export function weatherFront(x, z, t) { const n = fbm(x / 9 + t * 0.04, z / 9 - t * 0.026) * 0.7 + fbm(x / 3.6 - t * 0.07, z / 3.6 + 7) * 0.3; return Math.min(1, Math.max(0.15, (n - 0.36) * 5)); }
