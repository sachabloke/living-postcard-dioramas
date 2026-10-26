// Hidden warmth (parent decision, 22 Oct 2026): no bar; red pulses warn when dangerously cold; cold is worse in rain, winter and at night,
// mild in summer; a fire, the roofed cabin or a shelter keep you warm. "Dying" is gentle: you collapse and wake at camp, warm, with NOTHING lost
// (Constitution rules 6, 11, 13). Cosmetic-free of learning: it never touches questions, rewards, evidence or progress. Pure module.
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const DAYS_PER_SEASON = 6;                      // game days (240 s each) per season when the season follows play time
export const seasonOfDay = (day) => SEASONS[Math.floor(Math.max(0, day) / DAYS_PER_SEASON) % 4];
// how cold the season is on its own (0 = harmless, 1 = harsh)
export const SEASON_COLD = { summer: 0.0, spring: 0.30, autumn: 0.55, winter: 1.0 };
export const WARM = { start: 1, warnBelow: 0.34, dangerBelow: 0.16, collapseAt: 0 };
const LOSS_PER_S = 0.0036, REGEN_NEAR_FIRE = 0.03, REGEN_CABIN = 0.022, REGEN_MILD = 0.004;

/** ctx: { season, night(0..1), rain(0..1 local, after shelter masking), wind(0..1, after shelter masking), snow(0..1, after shelter masking), wet(0..1 ground/clothes), sheltered(0..1), nearFire(0..1), cabin(0..1), moving(0..1) }
 *  Returns the net warmth change per second (negative = losing). */
export function warmthRate(ctx) {
  const season = SEASON_COLD[ctx.season] ?? 0.3;
  let exposure = season + 0.25 * ctx.night + 0.9 * ctx.rain + 0.25 * ctx.wet * (ctx.rain > 0.05 ? 1 : 0.5);   // rain is the biggest single factor; winter next; night adds
  exposure += (ctx.wind ?? 0) * (0.12 + 0.25 * season) * (1 + 0.5 * ctx.wet) + 0.5 * (ctx.snow ?? 0);                 // wind chill (harmless on a dry summer day, bites in winter, worse when wet) and falling snow
  exposure *= 1 - 0.6 * ctx.sheltered;                                                                           // a lean-to cuts the exposure
  exposure *= 1 - 0.8 * ctx.cabin;                                                                               // the roofed cabin is the best protection
  exposure *= 1 - 0.1 * ctx.moving;                                                                               // walking keeps you a little warmer than standing still
  let rate = -LOSS_PER_S * exposure;
  rate += REGEN_NEAR_FIRE * ctx.nearFire + REGEN_CABIN * ctx.cabin;
  if (exposure < 0.2) rate += REGEN_MILD * (1 - exposure / 0.2);                                                  // a mild day (summer, dry) slowly restores warmth
  return rate;
}
/** Advance warmth; returns { w, collapsed } (collapsed only on the step that reaches zero). */
export function stepWarmth(w, dt, ctx) { const n = Math.min(1, Math.max(0, w + warmthRate(ctx) * dt)); return { w: n, collapsed: w > 0 && n <= WARM.collapseAt }; }
/** 0..1 strength of the red warning: 0 when comfortable, soft below warnBelow, strong below dangerBelow. */
export function warningStrength(w) { if (w >= WARM.warnBelow) return 0; return Math.min(1, (WARM.warnBelow - w) / (WARM.warnBelow - 0.02)); }
/** Pulse envelope in 0..1: slow (<= 0.8 Hz), smooth sine, never a strobe; reduced motion gets a steady edge instead. */
export function pulse(t, reduced) { return reduced ? 0.75 : 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 0.8); }
