// Skyrim-style skills sky: one large constellation at a time on a night sky, a strip to move between skills, and a footer with level, progress and the next big star.
// Pure string builders, no three.js. A skill is a constellation of MAX_LEVEL stars; each level lights one star.
import { MAX_LEVEL, BODY_SKILLS, levelOf, shownLevel } from './skills.js';
const W = 400, H = 260;
const CTRL = {   // hand-drawn paths; the 20 level stars are spaced evenly along each
  athletics: [[30, 215], [80, 150], [125, 195], [175, 105], [225, 160], [275, 65], [325, 120], [372, 38]],
  woodcraft: [[55, 230], [120, 190], [150, 130], [105, 80], [170, 48], [232, 90], [262, 150], [312, 118], [345, 58]],
  stonework: [[40, 222], [100, 200], [132, 148], [192, 170], [232, 108], [292, 130], [322, 68], [372, 92]],
  foraging: [[200, 238], [150, 202], [118, 150], [150, 94], [212, 66], [274, 96], [294, 152], [262, 204], [205, 192], [203, 138]],
  cooking: [[58, 88], [98, 168], [160, 222], [240, 222], [302, 168], [342, 88], [272, 112], [202, 58], [130, 112]],
};
export const TRAIN = {
  athletics: 'Run, sprint, jump and climb across new ground. Hopping on the spot or re-climbing the same stone trains nothing.',
  woodcraft: 'Chop trees after a correct answer.', stonework: 'Mine rocks after a correct answer.',
  foraging: 'Look closely at plants, name them from their clues, and gather a little. Opening the same card again gives nothing.',
  cooking: 'Prepare food you gathered. Each recipe trains at most once every 5 minutes.',
};
/** Levels that unlock something, with the plain words for it. */
export const MILESTONES = { athletics: [5, 10, 15, 20], woodcraft: [5, 10, 15, 20], stonework: [], foraging: [5, 10, 15, 20], cooking: [3, 6, 9] };
const MILE_TEXT = { cooking: 'a new plant-lore clue on every plant card' };
export const SKILL_IDS = Object.keys(BODY_SKILLS);
const seeded = (n) => { let h = n * 2654435761 >>> 0; return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0) / 4294967296); };
/** The 20 star positions of a skill, evenly spaced along its hand-drawn path. */
export function starPositions(id) {
  const P = CTRL[id] || CTRL.athletics, seg = [], L = []; let tot = 0;
  for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); seg.push(d); tot += d; L.push(tot); }
  return Array.from({ length: MAX_LEVEL }, (_, k) => { const t = (k / (MAX_LEVEL - 1)) * tot; let i = L.findIndex(x => x >= t - 1e-9); if (i < 0) i = L.length - 1; const a = P[i], b = P[i + 1], u = seg[i] ? (t - (L[i] - seg[i])) / seg[i] : 0; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; });
}
export const starPos = (id, i) => starPositions(id)[i];
export function nextMilestone(id, level) { const m = (MILESTONES[id] || []).find(l => l > level); return m ? { level: m, text: MILE_TEXT[id] || 'a bigger star: a small, clear perk' } : null; }
const spark = (r) => `M0 ${-r * 2.1} L${r * 0.4} ${-r * 0.4} L${r * 2.1} 0 L${r * 0.4} ${r * 0.4} L0 ${r * 2.1} L${-r * 0.4} ${r * 0.4} L${-r * 2.1} 0 L${-r * 0.4} ${-r * 0.4}Z`;
export function constellationSvg(id, st) {
  const lv = levelOf(st.skills?.[id]?.xp), shown = shownLevel(st, id), pc = lv.need ? lv.into / lv.need : 1, ms = new Set(MILESTONES[id] || []), pts = starPositions(id), rnd = seeded(SKILL_IDS.indexOf(id) + 7);
  let bg = '', lines = '', stars = '';
  for (let i = 0; i < 46; i++) bg += `<circle cx="${(rnd() * W).toFixed(0)}" cy="${(rnd() * H).toFixed(0)}" r="${(0.4 + rnd() * 0.9).toFixed(1)}" class="bgs" style="animation-delay:${(rnd() * 5).toFixed(1)}s"/>`;
  for (let i = 1; i < MAX_LEVEL; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; lines += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${i < shown ? 'on' : ''}"/>`; }
  for (let i = 0; i < MAX_LEVEL; i++) {
    const [x, y] = pts[i], lit = i < shown, next = i === shown && shown < MAX_LEVEL, big = ms.has(i + 1), r = big ? 5 : 3;
    stars += `<g class="${lit ? 'lit' : next ? 'next' : ''}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">` + (lit ? `<circle r="${big ? 15 : 9}" class="halo"/>` : '')
      + (next ? `<circle r="11" class="ring"/><circle r="11" class="prog" stroke-dasharray="${(69.1 * pc).toFixed(1)} 80" transform="rotate(-90)"/>` : '')
      + (big ? `<path class="spark" d="${spark(r)}"/>` : `<circle r="${r}" class="dot"/>`)
      + (big ? `<text y="${y > H * 0.7 ? -14 : 22}" class="lvn">${i + 1}</text>` : '') + `</g>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${BODY_SKILLS[id].label}: level ${shown} of ${MAX_LEVEL}" class="skCon"><defs><radialGradient id="neb${id}" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#3b4f8c" stop-opacity=".55"/><stop offset="1" stop-color="#0b1226" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#neb${id})"/>${bg}${lines}${stars}</svg>`;
}
export function skyHtml(st, sel) {
  const id = SKILL_IDS.includes(sel) ? sel : SKILL_IDS[0], k = BODY_SKILLS[id], lv = levelOf(st.skills?.[id]?.xp), shown = shownLevel(st, id), pc = lv.need ? Math.round(100 * lv.into / lv.need) : 100, nm = nextMilestone(id, shown);
  const strip = SKILL_IDS.map(s => `<button class="skTab ${s === id ? 'sel' : ''}" data-sk="${s}" aria-label="${BODY_SKILLS[s].label}, level ${shownLevel(st, s)}" aria-pressed="${s === id}"><span>${BODY_SKILLS[s].icon}</span><i>${shownLevel(st, s)}</i></button>`).join('');
  return `<div class="skSky"><div class="skStrip" role="tablist">${strip}</div>
<div class="skStage"><button class="skArrow l" data-skstep="-1" aria-label="Previous skill">‹</button>${constellationSvg(id, st)}<button class="skArrow r" data-skstep="1" aria-label="Next skill">›</button></div>
<div class="skFoot"><div class="skName">${k.label}</div><div class="skRule"><i></i><b>◆</b><i></i></div>
<div class="skLevel"><span>Level</span> <big>${shown}</big> <span>of ${MAX_LEVEL}</span></div>
<div class="skBar big" aria-label="${lv.need ? pc + ' percent to the next level' : 'complete'}"><i style="width:${shown < lv.level ? 100 : pc}%"></i></div>
<p class="skTxt">${k.blurb}</p><p class="skTxt dim"><b>Light the next star:</b> ${TRAIN[id]}${lv.need ? ` About ${Math.ceil(lv.need - lv.into)} xp to go.` : ' This constellation is complete.'}</p>
<p class="skTxt dim"><b>Reward:</b> ${k.perk}${nm ? ` <b>Next big star:</b> level ${nm.level}, ${nm.text}.` : ''}</p></div></div>`;
}
export const nextSkill = (id, d) => SKILL_IDS[(SKILL_IDS.indexOf(id) + d + SKILL_IDS.length) % SKILL_IDS.length];
