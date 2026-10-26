// Picture explanations for wrong answers. Each question carries `viz` ({t: type, ...numbers}); this returns an SVG string (or '' for none).
// Pure strings: no DOM, so it can be tested in node. Colours suit the dark question card.
export const C = { a: '#7fd1ae', b: '#f2c46d', c: '#e98a8a', d: '#8fb8f2', ink: '#eef6ee', dim: '#9fb5a8', line: '#cfe3d6' };
const wrap = (w, h, body, cap) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${(cap || 'diagram').replace(/"/g, '')}" style="width:100%;max-width:${Math.min(w, 460)}px;height:auto">${body}</svg>`;
export const T = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.fill || C.ink}" font-size="${o.size || 13}" text-anchor="${o.anchor || 'middle'}" font-family="system-ui,sans-serif"${o.bold ? ' font-weight="700"' : ''}>${s}</text>`;
export const R = (x, y, w, h, fill, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 3}" fill="${fill}" stroke="${o.stroke || 'none'}" stroke-width="${o.sw || 1}" opacity="${o.op ?? 1}"/>`;
export const L = (x1, y1, x2, y2, o = {}) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${o.stroke || C.line}" stroke-width="${o.sw || 1.5}"${o.dash ? ' stroke-dasharray="4 3"' : ''}/>`;
export const fmt = (n) => Number(n).toLocaleString('en-GB');

function grid(w, h, label) {                                   // area of a rectangle as unit squares
  const cell = Math.min(26, Math.floor(300 / Math.max(w, h))), W = w * cell, H = h * cell, ox = 40, oy = 24; let b = '';
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) b += R(ox + i * cell, oy + j * cell, cell - 1, cell - 1, C.a, { op: 0.75 });
  b += T(ox + W / 2, 16, `${w} m`) + T(24, oy + H / 2 + 4, `${h} m`) + T(ox + W / 2, oy + H + 20, label || `${w} × ${h} = ${w * h}`, { bold: true });
  return wrap(ox + W + 20, oy + H + 30, b, 'area grid');
}
function split(a, b) {                                         // multiplication as a split area model
  const tens = Math.floor(a / 10) * 10, ones = a % 10, wT = 190, wO = 90, h = 70, ox = 20, oy = 34;
  let s = R(ox, oy, wT, h, C.a, { op: 0.75 }) + R(ox + wT + 6, oy, wO, h, C.b, { op: 0.8 });
  s += T(ox + wT / 2, 26, String(tens)) + T(ox + wT + 6 + wO / 2, 26, String(ones)) + T(10, oy + h / 2 + 4, `${b}`, { anchor: 'end' });
  s += T(ox + wT / 2, oy + h / 2 + 4, `${tens} × ${b} = ${tens * b}`) + T(ox + wT + 6 + wO / 2, oy + h / 2 + 4, `${ones} × ${b} = ${ones * b}`, { size: 12 });
  s += T(ox + (wT + wO) / 2, oy + h + 26, `${tens * b} + ${ones * b} = ${a * b}`, { bold: true });
  return wrap(340, oy + h + 38, s, 'split multiplication');
}
function groups(total, n) {                                    // sharing into equal groups
  const per = total / n, cols = Math.min(n, 4), rows = Math.ceil(n / cols), cw = 100, ch = 62; let b = '';
  for (let g = 0; g < n; g++) {
    const gx = 10 + (g % cols) * cw, gy = 8 + Math.floor(g / cols) * ch;
    b += R(gx, gy, cw - 8, ch - 8, 'none', { stroke: C.line, rx: 8 });
    const show = Math.min(per, 24); for (let k = 0; k < show; k++) b += `<circle cx="${gx + 10 + (k % 8) * 10}" cy="${gy + 12 + Math.floor(k / 8) * 11}" r="3.6" fill="${C.b}"/>`;
    b += T(gx + (cw - 8) / 2, gy + ch - 12, String(per), { size: 11, fill: C.dim });
  }
  return wrap(cols * cw + 20, rows * ch + 40, b + T(cols * cw / 2 + 10, rows * ch + 26, `${fmt(total)} ÷ ${n} = ${per} in each`, { bold: true }), 'equal groups');
}
function fracbars(n, d, k) {
  const W = 300, h = 26; let b = '';
  for (let i = 0; i < d; i++) b += R(30 + i * W / d, 20, W / d - 2, h, i < n ? C.a : 'none', { stroke: C.line });
  for (let i = 0; i < d * k; i++) b += R(30 + i * W / (d * k), 70, W / (d * k) - 2, h, i < n * k ? C.b : 'none', { stroke: C.line });
  b += T(14, 38, `${n}/${d}`, { size: 12 }) + T(14, 88, `${n * k}/${d * k}`, { size: 11 }) + T(180, 120, `Same amount shaded: both × ${k}`, { bold: true });
  return wrap(350, 132, b, 'equivalent fractions');
}
function numline(vals, marks, caption) {                        // generic number line; marks = [{v,label,color}]
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.12 || 1, a = lo - pad, z = hi + pad, X = (v) => 30 + (v - a) / (z - a) * 300; let b = L(24, 60, 340, 60, { sw: 2 });
  const step = Math.max(1, Math.round((hi - lo) / 10)); for (let v = Math.ceil(lo); v <= hi; v += step) b += L(X(v), 54, X(v), 66) + T(X(v), 84, String(v), { size: 11, fill: C.dim });
  for (const m of marks) b += `<circle cx="${X(m.v)}" cy="60" r="6" fill="${m.color || C.b}"/>` + T(X(m.v), 44, m.label || '', { size: 12, bold: true });
  b += T(190, 112, caption || '', { bold: true });
  return wrap(370, 124, b, 'number line');
}
function negative(a, b) {
  const ans = a - b; let s = numline([ans, 0, a], [{ v: a, label: `${a}`, color: C.a }, { v: 0, label: '0', color: C.dim }, { v: ans, label: `${ans}`, color: C.c }], `${a} − ${b} = ${ans}`);
  return s;
}
function roundline(x, ans) {
  const lo = Math.floor(x * 100) / 100, hi = lo + 0.01, mid = lo + 0.005;
  return numline([lo, hi], [{ v: lo, label: lo.toFixed(2), color: C.a }, { v: x, label: String(x), color: C.b }, { v: hi, label: hi.toFixed(2), color: C.a }], `${x} is ${x >= mid ? 'past' : 'before'} the halfway mark → ${ans}`);
}
function placevalue(n, i) {
  const s = String(n), names = ['Th', 'H', 'T', 'O'], cols = ['100 000', '10 000', '1 000', '100', '10', '1'].slice(6 - s.length); let b = '';
  for (let k = 0; k < s.length; k++) { const x = 20 + k * 52; b += R(x, 26, 48, 30, k === i ? C.b : 'none', { stroke: C.line, op: k === i ? 0.85 : 1 }) + T(x + 24, 46, s[k], { size: 18, bold: true, fill: k === i ? '#1a2a1f' : C.ink }) + T(x + 24, 20, cols[k], { size: 10, fill: C.dim }); }
  const v = +s[i] * 10 ** (s.length - 1 - i);
  return wrap(40 + s.length * 52, 96, b + T(20 + s.length * 26, 82, `${s[i]} in the ${cols[i]} column → ${fmt(v)}`, { bold: true }), 'place value chart');
}
function column(a, b, op, ans) {
  const sa = fmt(a), sb = fmt(b), sr = fmt(ans), wd = Math.max(sa.length, sb.length, sr.length) * 12 + 40;
  let s = T(wd - 20, 28, sa, { anchor: 'end', size: 18 }) + T(wd - 20, 54, `${op === '+' ? '+' : '−'} ${sb}`, { anchor: 'end', size: 18 }) + L(20, 62, wd, 62, { sw: 2 }) + T(wd - 20, 86, sr, { anchor: 'end', size: 18, fill: C.a, bold: true });
  s += T(wd - 20, 108, 'Line up ones under ones, tens under tens…', { anchor: 'end', size: 11, fill: C.dim });
  return wrap(wd + 30, 118, s, 'column method');
}
function factors(n, pairs) {
  let b = ''; pairs.forEach(([x, y], i) => { b += R(20, 14 + i * 28, 150, 24, C.a, { op: 0.35, stroke: C.line }) + T(95, 31 + i * 28, `${x} × ${y} = ${n}`, { size: 13 }); });
  return wrap(200, 20 + pairs.length * 28, b, 'factor pairs');
}
function convert(v, from, to, f) {
  const up = f >= 1; let s = R(20, 20, 90, 36, C.a, { op: 0.8, rx: 8 }) + T(65, 43, `${v} ${from}`, { fill: '#10241a', bold: true }) + L(112, 38, 190, 38, { sw: 2 }) + T(151, 30, up ? `× ${f}` : `÷ ${1 / f}`, { size: 12 });
  s += R(192, 20, 110, 36, C.b, { op: 0.85, rx: 8 }) + T(247, 43, `${+(v * f).toFixed(3)} ${to}`, { fill: '#2a1d08', bold: true });
  s += T(160, 84, `1 ${from} = ${f >= 1 ? f : 1 / f} ${f >= 1 ? to : from === 'g' ? 'g' : to}`, { size: 11, fill: C.dim });
  return wrap(320, 96, s, 'unit conversion');
}
function timeline(start, h, m, end) {
  let s = L(20, 46, 330, 46, { sw: 2 }) + `<circle cx="30" cy="46" r="6" fill="${C.a}"/><circle cx="190" cy="46" r="6" fill="${C.d}"/><circle cx="320" cy="46" r="6" fill="${C.b}"/>`;
  s += T(30, 30, start, { bold: true }) + T(190, 30, `+${h} h`, { fill: C.d }) + T(320, 30, `+${m} min`, { fill: C.b }) + T(190, 66, end ? 'Finish ' + end : '', { bold: true, fill: C.a });
  return wrap(350, 78, s, 'time line');
}
function cuboid(l, w, h) {
  let b = ''; const layer = l * w, cw = 18;
  for (let k = 0; k < Math.min(h, 6); k++) b += R(30 + k * 6, 20 + (5 - k) * 8, l * cw, w * cw / 2.2, C.a, { op: 0.35 + k * 0.1, stroke: C.line });
  b += T(30 + l * cw / 2, 20 + 6 * 8 + w * cw / 2.2 + 18, `One layer: ${l} × ${w} = ${layer}`) + T(30 + l * cw / 2, 20 + 6 * 8 + w * cw / 2.2 + 38, `${h} layers: ${layer} × ${h} = ${layer * h} cm³`, { bold: true });
  return wrap(40 + l * cw + 40, 20 + 6 * 8 + w * cw / 2.2 + 50, b, 'volume layers');
}
function bar(parts, take, label, total) {                       // n of d parts shaded
  const W = 320; let b = '';
  for (let i = 0; i < parts; i++) b += R(20 + i * W / parts, 22, W / parts - 3, 34, i < take ? C.a : 'none', { stroke: C.line, op: 0.85 }) + (i < take ? T(20 + i * W / parts + W / parts / 2, 44, String(label), { size: 12, fill: '#10241a' }) : '');
  return wrap(360, 90, b + T(180, 82, total, { bold: true }), 'bar model');
}
function ops(steps) {
  let b = ''; steps.forEach((s, i) => { b += R(20, 12 + i * 34, 300, 28, i === steps.length - 1 ? C.a : 'none', { stroke: C.line, op: i === steps.length - 1 ? 0.5 : 1 }) + T(170, 31 + i * 34, s, { size: 14 }); });
  return wrap(340, 20 + steps.length * 34, b, 'order of operations');
}
function pbar(pct, total) {
  const W = 320, filled = W * pct / 100; let b = R(20, 24, W, 30, 'none', { stroke: C.line }) + R(20, 24, filled, 30, C.a, { op: 0.8 });
  for (let i = 1; i < 10; i++) b += L(20 + W * i / 10, 24, 20 + W * i / 10, 54, { sw: 1 });
  b += T(20, 20, '0', { size: 11, fill: C.dim }) + T(20 + W, 20, fmt(total), { size: 11, fill: C.dim, anchor: 'end' }) + T(180, 80, `10% = ${fmt(total / 10)}  →  ${pct}% = ${fmt(total * pct / 100)}`, { bold: true });
  return wrap(360, 92, b, 'percentage bar');
}
function terms(groupsArr) {
  let b = ''; groupsArr.forEach((g, i) => { const y = 16 + i * 34; b += T(24, y + 17, `${g.v}-terms`, { anchor: 'start', fill: C.dim, size: 12 }) + T(110, y + 17, g.parts.map(p => (p < 0 ? '−' : '+') + Math.abs(p) + g.v).join('  '), { anchor: 'start' }) + T(260, y + 17, `= ${g.sum}${g.v}`, { anchor: 'start', bold: true, fill: C.a }); });
  return wrap(340, 20 + groupsArr.length * 34, b, 'collecting like terms');
}
function seq(vals, d, c) {
  let b = ''; vals.forEach((v, i) => { b += R(20 + i * 60, 22, 52, 30, C.a, { op: 0.5, stroke: C.line }) + T(46 + i * 60, 43, String(v), { size: 15 }) + (i < vals.length - 1 ? T(76 + i * 60, 16, `+${d}`, { size: 11, fill: C.b }) : ''); });
  b += T(20 + vals.length * 30, 84, `+${d} each time → ${d}n. When n=1 the term is ${vals[0]}, so add ${c}`, { bold: true, size: 12 });
  return wrap(40 + vals.length * 60, 96, b, 'sequence');
}
function bars(vals, mean) {
  const mx = Math.max(...vals, mean), H = 90; let b = '';
  vals.forEach((v, i) => { const h = v / mx * H; b += R(26 + i * 40, 106 - h, 30, h, C.a, { op: 0.7 }) + T(41 + i * 40, 120, String(v), { size: 11 }); });
  const y = 106 - mean / mx * H; b += L(16, y, 30 + vals.length * 40, y, { stroke: C.b, sw: 2, dash: true }) + T(30 + vals.length * 40, y - 4, `mean ${mean}`, { anchor: 'end', size: 12, fill: C.b, bold: true });
  return wrap(50 + vals.length * 40, 132, b, 'mean as a level line');
}
function triangle(bs, h) {
  const k = Math.min(18, 240 / bs), W = bs * k, H = h * k; let s = `<polygon points="30,${H + 20} ${30 + W},${H + 20} ${30 + W * 0.35},20" fill="${C.a}" opacity="0.55" stroke="${C.line}"/>`;
  s += L(30 + W * 0.35, 20, 30 + W * 0.35, H + 20, { dash: true }) + T(30 + W / 2, H + 38, `base ${bs}`) + T(18, 20 + H / 2, `${h}`, { anchor: 'end' }) + T(30 + W / 2, H + 58, `½ × ${bs} × ${h} = ${bs * h / 2}`, { bold: true });
  return wrap(60 + W, H + 70, s, 'triangle area');
}
function ratioParts(a, b, k, ask) {
  const W = 320, n = a + b; let s = '';
  for (let i = 0; i < n; i++) s += R(20 + i * W / n, 24, W / n - 3, 32, i < a ? C.a : C.b, { op: 0.8 }) + T(20 + i * W / n + W / n / 2, 45, String(k), { size: 12, fill: '#10241a' });
  s += T(20 + a * W / n / 2, 76, `wood ${a}`, { size: 12 }) + T(20 + a * W / n + b * W / n / 2, 76, `stone ${b}`, { size: 12 }) + T(180, 98, `${a + b} parts × ${k} = ${(a + b) * k}  →  wood = ${a} × ${k} = ${a * k}`, { bold: true, size: 12 });
  return wrap(360, 110, s, 'ratio bar');
}
function expandGrid(c, a, bs) {
  let s = R(30, 28, 130, 50, C.a, { op: 0.6, stroke: C.line }) + R(160, 28, 80, 50, C.b, { op: 0.6, stroke: C.line });
  s += T(95, 20, `${a}x`) + T(200, 20, `${bs < 0 ? '−' : '+'}${Math.abs(bs)}`) + T(18, 58, String(c), { anchor: 'end' }) + T(95, 58, `${c} × ${a}x = ${a * c}x`) + T(200, 58, `${c} × ${bs} = ${bs * c}`, { size: 12 });
  return wrap(280, 100, s + T(135, 96, 'The bracket multiplies BOTH parts', { bold: true, size: 12 }), 'expanding a bracket');
}
function angles(a, b, c) {
  let s = `<polygon points="30,110 250,110 90,20" fill="${C.a}" opacity="0.35" stroke="${C.line}"/>` + T(60, 104, `${a}°`, { size: 12 }) + T(212, 104, `${b}°`, { size: 12 }) + T(90, 52, '?°', { bold: true, fill: C.b });
  return wrap(290, 160, s + T(145, 140, `${a} + ${b} = ${a + b};  180 − ${a + b} = ${c}`, { bold: true, size: 12 }), 'angles in a triangle');
}
function steps(list) {
  let b = ''; list.forEach((s, i) => { b += `<circle cx="22" cy="${24 + i * 34}" r="11" fill="${C.a}"/>` + T(22, 28 + i * 34, String(i + 1), { fill: '#10241a', size: 12, bold: true }) + T(42, 29 + i * 34, s, { anchor: 'start' }); });
  return wrap(360, 12 + list.length * 34, b, 'steps');
}

/** SVG for a question's `viz` (or null). */
export function vizSVG(q) {
  const v = q?.viz; if (!v) return null;
  try {
    switch (v.t) {
      case 'grid': return grid(v.w, v.h, v.label);
      case 'split': return split(v.a, v.b);
      case 'groups': return groups(v.total, v.n);
      case 'fracbars': return fracbars(v.n, v.d, v.k);
      case 'negative': return negative(v.a, v.b);
      case 'round': return roundline(v.x, v.ans);
      case 'placevalue': return placevalue(v.n, v.i);
      case 'column': return column(v.a, v.b, v.op, v.ans);
      case 'factors': return factors(v.n, v.pairs);
      case 'convert': return convert(v.v, v.from, v.to, v.f);
      case 'timeline': return timeline(v.start, v.h, v.m, v.end);
      case 'cuboid': return cuboid(v.l, v.w, v.h);
      case 'bar': return bar(v.parts, v.take, v.label, v.total);
      case 'ops': return ops(v.steps);
      case 'pbar': return pbar(v.pct, v.total);
      case 'terms': return terms(v.groups);
      case 'seq': return seq(v.vals, v.d, v.c);
      case 'bars': return bars(v.vals, v.mean);
      case 'triangle': return triangle(v.b, v.h);
      case 'ratio': return ratioParts(v.a, v.b, v.k);
      case 'expand': return expandGrid(v.c, v.a, v.bs);
      case 'angles': return angles(v.a, v.b, v.c);
      case 'steps': return steps(v.list);
      default: return null;
    }
  } catch { return null; }
}
/** Generic fallback: numbered step cards from the question's steps. */
export const stepsSVG = (q) => (q?.steps?.length ? steps(q.steps.slice(0, 6)) : null);
