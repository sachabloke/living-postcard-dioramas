// Device-measured adaptive render scale. Pure controller: feed it frame times, read scale. It only changes
// resolution/effect detail — never terrain, collision, learning or saves.
export const SCALE_MIN = 0.6, SCALE_MAX = 1.0, STEP = 0.1;
export const TARGET_MS = 1000 / 30;
export function makeQuality({ cap = 1, auto = true, startScale = 1 } = {}) {
  const q = { auto, scale: Math.min(startScale, cap), cap, over: 0, under: 0, cool: 0, history: [], tier: 'high', shadowOn: true, particles: 1 };
  q.frame = (ms, { hidden = false, loading = false, resumed = false } = {}) => {
    if (!q.auto || hidden || loading || resumed || ms > 250) return q.scale;      // ignore stalls / loading / resume
    q.cool = Math.max(0, q.cool - ms);
    if (ms > TARGET_MS * 1.15) { q.over += ms; q.under = 0; } else if (ms < TARGET_MS * 0.7) { q.under += ms; q.over = Math.max(0, q.over - ms); } else { q.over = Math.max(0, q.over - ms); q.under = Math.max(0, q.under - ms * 0.5); }
    if (q.over > 2500 && q.cool <= 0) { q.over = 0; q.cool = 3000; if (q.scale > SCALE_MIN + 1e-6) q.scale = Math.max(SCALE_MIN, +(q.scale - STEP).toFixed(2)); else lowerDetail(q); q.history.push(['down', q.scale, q.tier]); }
    else if (q.under > 9000 && q.cool <= 0) { q.under = 0; q.cool = 6000; if (q.tier !== 'high') raiseDetail(q); else if (q.scale < q.cap - 1e-6) q.scale = Math.min(q.cap, +(q.scale + STEP).toFixed(2)); q.history.push(['up', q.scale, q.tier]); }
    return q.scale;
  };
  return q;
}
function lowerDetail(q) { if (q.tier === 'high') { q.tier = 'med'; q.shadowOn = true; q.particles = 0.6; } else if (q.tier === 'med') { q.tier = 'low'; q.shadowOn = false; q.particles = 0.3; } }
function raiseDetail(q) { if (q.tier === 'low') { q.tier = 'med'; q.shadowOn = true; q.particles = 0.6; } else if (q.tier === 'med') { q.tier = 'high'; q.particles = 1; } }
