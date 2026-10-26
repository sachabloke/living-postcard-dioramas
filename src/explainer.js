// Step-by-step picture explainer shown after a wrong answer. Pure strings (no DOM) so node can test every topic.
// explainFrames(q, pickedText) -> { slip, frames: [{svg, say}] }. Each frame adds one idea to the picture, with one short sentence.
import { C, T, R, L, fmt } from './visual.js';

const DARK = '#10241a';
const svg = (w, h, b, cap) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${String(cap).replace(/"/g, '')}" style="width:100%;max-width:560px;height:auto">${b}</svg>`;
const dot = (x, y, r, f) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
const arrow = (x1, y1, x2, y2, col = C.b) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 9;
  return L(x1, y1, x2, y2, { stroke: col, sw: 2.5 }) + `<polygon points="${x2},${y2} ${x2 - s * Math.cos(a - 0.45)},${y2 - s * Math.sin(a - 0.45)} ${x2 - s * Math.cos(a + 0.45)},${y2 - s * Math.sin(a + 0.45)}" fill="${col}"/>`;
};
const neg = (s) => String(s).replace('-', '−');
const num = (n) => fmt(+Number(n).toFixed(4));

// The usual slip for each topic, shown (kindly) with the child's own pick.
export const SLIPS = {
  multiply: 'Easy to forget one of the two parts. Multiply the tens AND the ones, then add.',
  divide: 'Check by multiplying back: groups × each should make the total.',
  equivalentFractions: 'What you do to the bottom you must do to the top: multiply, do not add.',
  perimeterArea: 'Area counts the squares inside (multiply). Perimeter is the way round the edge (add).',
  roundDecimals: 'Only the digit after the one you keep decides: 5 or more rounds up, 4 or less stays.',
  negative: 'Count down to zero first, then carry on below it.',
  placeValue: 'Name the column first, then write the digit followed by that column\'s zeros.',
  addSub: 'Keep the digits lined up and work from the right, carrying or borrowing as you go.',
  factors: 'A factor divides exactly with nothing left over. Test it with a times table.',
  fractionOfAmount: 'Divide by the bottom number first to get one part, then take as many parts as the top says.',
  units: 'Going to a smaller unit makes the number bigger, so multiply.',
  time: '60 minutes make a new hour, so watch for minutes going past 60.',
  volume: 'Volume is layers: the area of one layer times the number of layers.',
  solve: 'Undo the adding first, then undo the multiplying. Do the same to both sides.',
  ratio: 'Add the parts first, find what one part is worth, then multiply.',
  expand: 'The number outside the bracket multiplies every term inside.',
  fdp: 'Divide the top by the bottom, then multiply by 100 for a percentage.',
  neg: 'Two negatives multiplied make a positive. Adding a negative moves further below zero.',
  angles: 'The three angles of a triangle always add to 180°.',
  orderOps: 'Brackets first, then × and ÷, then + and −.',
  percentOf: 'Find 10% (÷ 10) or 1% (÷ 100) first, then build up.',
  collect: 'Only combine terms with the same letter: a with a, b with b.',
  sequences: 'The step between terms is the number in front of n.',
  meanMedian: 'Mean = total ÷ how many numbers.',
  areaTriangle: 'A triangle is exactly half of a rectangle with the same base and height.',
};

// ---------- builders: each returns [[svg, say], ...] ----------
function gridF(w, h) {
  const cell = Math.min(26, Math.floor(300 / Math.max(w, h))), ox = 44, oy = 28, W = w * cell, H = h * cell;
  const draw = (rows, res) => {
    let b = ''; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) b += R(ox + i * cell, oy + j * cell, cell - 1, cell - 1, j < rows ? (rows === 1 ? C.b : C.a) : 'none', { stroke: C.line, op: 0.85 });
    b += T(ox + W / 2, 18, `${w} m`) + T(26, oy + H / 2 + 4, `${h} m`);
    if (res) b += T(ox + W / 2, oy + H + 22, `${w} × ${h} = ${w * h} m²`, { bold: true });
    return svg(ox + W + 24, oy + H + 34, b, 'area of a rectangle');
  };
  return [[draw(0), `The clearing is ${w} m wide and ${h} m long. Area asks: how many 1 m squares cover it?`], [draw(1), `One row holds ${w} squares.`], [draw(h), `There are ${h} rows, so ${h} lots of ${w}.`], [draw(h, 1), `${w} × ${h} = ${w * h}. The area is ${w * h} m².`]];
}
function splitF(a, b) {
  const tens = Math.floor(a / 10) * 10, ones = a % 10, wT = 190, wO = 90, h = 70, ox = 24, oy = 34;
  const draw = (st) => {
    let s = R(ox, oy, wT, h, st >= 1 ? C.a : 'none', { op: 0.75, stroke: C.line }) + R(ox + wT + 6, oy, wO, h, st >= 2 ? C.b : 'none', { op: 0.8, stroke: C.line });
    s += T(ox + wT / 2, 26, String(tens), { bold: st === 1 }) + T(ox + wT + 6 + wO / 2, 26, String(ones), { bold: st === 2 }) + T(12, oy + h / 2 + 4, `× ${b}`, { anchor: 'end', size: 12, fill: C.dim });
    if (st >= 1) s += T(ox + wT / 2, oy + h / 2 + 4, `${tens} × ${b} = ${tens * b}`, { fill: DARK, bold: true });
    if (st >= 2) s += T(ox + wT + 6 + wO / 2, oy + h / 2 + 4, `${ones} × ${b} = ${ones * b}`, { size: 12, fill: DARK, bold: true });
    if (st >= 3) s += T(ox + (wT + wO) / 2, oy + h + 28, `${tens * b} + ${ones * b} = ${a * b}`, { bold: true, size: 15 });
    return svg(340, oy + h + 40, s, 'split multiplication');
  };
  if (!ones) return [[draw(0), `${a} is ${a / 10} tens with no ones left over, so there is only one part to multiply by ${b}.`], [draw(1), `${tens} × ${b} = ${tens * b}.`], [draw(3), `Nothing to add from the ones, so ${a} × ${b} = ${a * b}.`]];
  return [[draw(0), `Split ${a} into ${tens} and ${ones}. Each part gets multiplied by ${b}.`], [draw(1), `First the big part: ${tens} × ${b} = ${tens * b}.`], [draw(2), `Now the small part: ${ones} × ${b} = ${ones * b}.`], [draw(3), `Add the two answers: ${tens * b} + ${ones * b} = ${a * b}.`]];
}
function groupsF(total, n) {
  const per = total / n, cols = Math.min(n, 4), rows = Math.ceil(n / cols), cw = 100, ch = 62;
  const draw = (st) => {
    let b = '';
    if (st === 0) { const show = Math.min(total, 60); b += R(20, 10, 320, 60, 'none', { stroke: C.line, rx: 10 }); for (let k = 0; k < show; k++) b += dot(34 + (k % 30) * 10, 24 + Math.floor(k / 30) * 12, 3.6, C.b); b += T(180, 62, `${fmt(total)} altogether`, { bold: true }); return svg(360, 84, b, 'items to share'); }
    for (let g = 0; g < n; g++) {
      const gx = 10 + (g % cols) * cw, gy = 8 + Math.floor(g / cols) * ch; b += R(gx, gy, cw - 8, ch - 8, 'none', { stroke: C.line, rx: 8 });
      const show = st === 1 ? 0 : st === 2 ? Math.min(2, per) : Math.min(per, 24); for (let k = 0; k < show; k++) b += dot(gx + 10 + (k % 8) * 10, gy + 12 + Math.floor(k / 8) * 11, 3.6, C.b);
      if (st >= 3) b += T(gx + (cw - 8) / 2, gy + ch - 12, String(per), { size: 11, fill: C.dim });
    }
    if (st >= 3) b += T(cols * cw / 2 + 10, rows * ch + 26, `${fmt(total)} ÷ ${n} = ${per} in each`, { bold: true });
    return svg(cols * cw + 20, rows * ch + 40, b, 'equal groups');
  };
  return [[draw(0), `${fmt(total)} to share out equally.`], [draw(1), `There are ${n} baskets, and they must all get the same.`], [draw(2), 'Deal them out one at a time to each basket, round and round…'], [draw(3), `Every basket ends up with ${per}. Check: ${n} × ${per} = ${total}.`]];
}
function fracF(n, d, k) {
  const W = 300, h = 26;
  const draw = (st) => {
    let b = ''; for (let i = 0; i < d; i++) b += R(40 + i * W / d, 20, W / d - 2, h, i < n ? C.a : 'none', { stroke: C.line });
    b += T(18, 38, `${n}/${d}`, { size: 12 });
    if (st >= 1) { for (let i = 0; i < d * k; i++) b += R(40 + i * W / (d * k), 80, W / (d * k) - 2, h, st >= 2 && i < n * k ? C.b : 'none', { stroke: C.line }); b += T(18, 98, st >= 2 ? `${n * k}/${d * k}` : `?/${d * k}`, { size: 12 }); for (let i = 0; i < d; i++) b += L(40 + i * W / d, 46, 40 + i * W / d, 80, { dash: true, sw: 1 }); }
    if (st >= 3) b += T(190, 134, `${n} × ${k} = ${n * k}`, { bold: true, size: 15 });
    return svg(360, 146, b, 'equivalent fractions');
  };
  return [[draw(0), `Start with ${n}/${d}: ${n} of ${d} equal parts shaded.`], [draw(1), `Cut every part into ${k} smaller pieces. Now there are ${d} × ${k} = ${d * k} pieces in total.`], [draw(2), `The shaded part is the same amount, but it now covers ${n} × ${k} = ${n * k} small pieces.`], [draw(3), `Top × ${k} and bottom × ${k}: ${n}/${d} = ${n * k}/${d * k}.`]];
}
function nline(lo, hi, { marks = [], segs = [] } = {}) {
  const X = (v) => 30 + (v - lo) / (hi - lo) * 320, st = Math.max(1, Math.ceil((hi - lo) / 14)); let b = L(24, 70, 356, 70, { sw: 2 });
  for (let v = Math.ceil(lo); v <= hi; v++) if (v % st === 0 || v === 0) b += L(X(v), 64, X(v), 76) + T(X(v), 92, neg(v), { size: 11, fill: v === 0 ? C.ink : C.dim, bold: v === 0 });
  for (const s of segs) b += arrow(X(s.from), 44, X(s.to), 44, s.col) + T((X(s.from) + X(s.to)) / 2, 34, s.label, { size: 12, fill: s.col, bold: true });
  for (const m of marks) b += dot(X(m.v), 70, 6, m.col) + T(X(m.v), 112, m.label, { size: 12, bold: true, fill: m.col });
  return svg(380, 124, b, 'number line');
}
function negF(a, b) {
  const ans = a - b, lo = ans - 1, hi = a + 1, d = (marks, segs) => nline(lo, hi, { marks, segs });
  return [[d([{ v: a, label: `${a}`, col: C.a }], []), `Start at ${a}.`], [d([{ v: a, label: `${a}`, col: C.a }, { v: 0, label: '0', col: C.dim }], [{ from: a, to: 0, col: C.a, label: `−${a}` }]), `Go down ${a} steps to reach zero. That uses up ${a} of the ${b}.`],
    [d([{ v: a, label: `${a}`, col: C.a }, { v: 0, label: '0', col: C.dim }], [{ from: a, to: 0, col: C.a, label: `−${a}` }, { from: 0, to: ans, col: C.c, label: `−${b - a}` }]), `There are still ${b - a} steps to go, and zero is behind you, so you go below zero.`],
    [d([{ v: a, label: `${a}`, col: C.a }, { v: ans, label: neg(ans), col: C.c }], [{ from: a, to: ans, col: C.c, label: `−${b}` }]), `You land on ${neg(ans)}. ${a} − ${b} = ${neg(ans)}.`]];
}
function roundF(x, ans) {
  const s = x.toFixed(3), th = +s[s.length - 1], lo = s.slice(0, -1), hi = ((Math.round(+lo * 100) + 1) / 100).toFixed(2), X = (f) => 40 + f * 280;
  const digits = (hl) => T(190, 52, `${s.slice(0, -1)}<tspan fill="${hl ? C.b : C.ink}" font-weight="700" font-size="30">${th}</tspan>`, { size: 26 });
  const line = (st) => {
    let b = L(40, 70, 320, 70, { sw: 2 }) + dot(X(0), 70, 6, C.a) + dot(X(1), 70, 6, C.a) + T(X(0), 94, lo, { size: 13 }) + T(X(1), 94, hi, { size: 13 });
    if (st >= 1) b += L(X(0.5), 58, X(0.5), 82, { dash: true }) + T(X(0.5), 108, 'halfway', { size: 11, fill: C.dim });
    if (st >= 2) b += dot(X(th / 10), 70, 7, C.b) + T(X(th / 10), 54, s, { size: 12, bold: true, fill: C.b });
    if (st >= 3) b += T(190, 134, `→ ${ans}`, { bold: true, size: 16, fill: C.a });
    return svg(380, 146, b, 'rounding on a number line');
  };
  return [[svg(380, 72, digits(true), 'the deciding digit'), `We keep 2 decimal places, so look at the next digit along: ${th}. It decides.`], [line(0), `${lo} and ${hi} are the two neighbours with 2 decimal places.`], [line(1), `Halfway between them is the dashed line. A third digit of 5 or more is at or past halfway.`], [line(2), `${s} sits ${th >= 5 ? 'at or past' : 'before'} halfway.`], [line(3), `So it is closer to ${ans}.`]];
}
function placeF(n, i) {
  const s = String(n), cols = ['100 000', '10 000', '1 000', '100', '10', '1'].slice(6 - s.length), names = ['hundred thousands', 'ten thousands', 'thousands', 'hundreds', 'tens', 'ones'].slice(6 - s.length), d = +s[i], p = s.length - 1 - i, v = d * 10 ** p;
  const draw = (st) => {
    let b = ''; for (let k = 0; k < s.length; k++) { const x = 20 + k * 52, on = st >= 1 && k === i; b += R(x, 30, 48, 34, on ? C.b : 'none', { stroke: C.line }) + T(x + 24, 54, s[k], { size: 20, bold: true, fill: on ? DARK : C.ink }) + T(x + 24, 22, cols[k], { size: 10, fill: on ? C.b : C.dim }); }
    if (st >= 2) b += T(20 + s.length * 26, 96, `${d} × ${cols[i]} = ${fmt(v)}`, { bold: true, size: 15 });
    return svg(40 + s.length * 52, 112, b, 'place value chart');
  };
  return [[draw(0), `Each digit sits in a column. Each column is worth ten times the one on its right.`], [draw(1), `The ${d} is in the ${names[i]} column, which is worth ${cols[i]}.`], [draw(2), `${d} lots of ${cols[i]} is ${fmt(v)}.`]];
}
function columnF(a, b, op, ans) {
  const sa = String(a), sb = String(b), sr = String(ans), n = Math.max(sa.length, sb.length, sr.length), dig = (s, k) => (k < s.length ? +s[s.length - 1 - k] : null);
  const names = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'], cx = (k) => 70 + (n - 1 - k) * 36, W = 70 + n * 36 + 16; const cols = []; let carry = 0;
  for (let k = 0; k < sr.length; k++) {
    const top = dig(sa, k) ?? 0, bot = dig(sb, k) ?? 0; let res, cout = 0, cap;
    if (op === '+') {
      const t = top + bot + carry; res = t % 10; cout = t >= 10 ? 1 : 0;
      cap = dig(sa, k) == null && dig(sb, k) == null ? `Bring down the carried 1 into the ${names[k]}.` : `${names[k]}: ${top} + ${bot}${carry ? ` + ${carry} carried` : ''} = ${t}. Write ${res}${cout ? ' and carry 1 to the next column' : ''}.`;
    } else {
      let t = top - carry; const low = t < bot; if (low) { t += 10; cout = 1; } res = t - bot;
      cap = `${names[k]}: ${low ? `${top - carry} is too small to take away ${bot}, so borrow 1 from the next column: ${t} − ${bot} = ${res}.` : `${t} − ${bot} = ${res}.`}`;
    }
    cols.push({ res, cout, cap }); carry = cout;
  }
  const draw = (k) => {
    let s = '';
    if (k >= 0) s += R(cx(k) - 17, 4, 34, 146, C.b, { op: 0.18, rx: 6 });
    cols.forEach((c, j) => { if (j <= k && c.cout) { if (op === '+') s += T(cx(j + 1), 32, '1', { size: 13, fill: C.c, bold: true }); else s += T(cx(j), 14, '+10', { size: 12, fill: C.b, bold: true }) + T(cx(j + 1), 32, '−1', { size: 12, fill: C.c, bold: true }); } });
    for (let j = 0; j < n; j++) { const da = dig(sa, j), db = dig(sb, j); if (da != null) s += T(cx(j), 64, String(da), { size: 22 }); if (db != null) s += T(cx(j), 96, String(db), { size: 22 }); }
    s += T(30, 96, op === '+' ? '+' : '−', { size: 22, fill: C.b }) + L(40, 106, W - 6, 106, { sw: 2 });
    cols.forEach((c, j) => { if (j <= k) s += T(cx(j), 136, String(c.res), { size: 22, bold: true, fill: C.a }); });
    return svg(W, 158, s, 'column method');
  };
  const out = [[draw(-1), `Write the numbers one above the other, ones under ones, tens under tens. We start on the right.`]];
  cols.forEach((c, k) => out.push([draw(k), c.cap]));
  out.push([draw(cols.length - 1), `${fmt(a)} ${op === '+' ? '+' : '−'} ${fmt(b)} = ${fmt(ans)}.`]);
  return out;
}
function factorsF(n, pairs, q) {
  const draw = (cnt, hl) => {
    let b = ''; pairs.forEach(([x, y], i) => { if (i < cnt) b += R(20, 12 + i * 30, 190, 26, C.a, { op: 0.35, stroke: C.line }) + T(115, 30 + i * 30, `${x} × ${y} = ${n}`, { size: 14 }); });
    if (hl) b += R(20, 20 + cnt * 30, 190, 30, C.c, { op: 0.35, stroke: C.c }) + T(115, 41 + cnt * 30, `${q.answer} × ? = ${n}  ✗`, { size: 14 });
    return svg(230, 60 + cnt * 30, b, 'factor pairs');
  };
  const out = [[draw(0), `A factor is a number that fits into ${n} exactly. Factors come in pairs that multiply to ${n}.`]];
  pairs.forEach((p, i) => out.push([draw(i + 1), `${p[0]} × ${p[1]} = ${n}, so ${p[0]} and ${p[1]} are factors.`]));
  out.push([draw(pairs.length, true), `${q.answer} is not in any pair: ${n} ÷ ${q.answer} leaves a remainder. So ${q.answer} is NOT a factor.`]); return out;
}
function convertF(v, from, to, f) {
  const draw = (st) => {
    let b = R(20, 14, 90, 34, C.dim, { op: 0.3, rx: 8 }) + T(65, 36, `1 ${from}`) + T(125, 36, '=', {}) + R(140, 14, 110, 34, C.dim, { op: 0.3, rx: 8 }) + T(195, 36, `${f} ${to}`);
    if (st >= 1) b += R(20, 76, 90, 36, C.a, { op: 0.85, rx: 8 }) + T(65, 99, `${v} ${from}`, { fill: DARK, bold: true });
    if (st >= 2) b += arrow(116, 94, 188, 94, C.b) + T(152, 86, `× ${f}`, { size: 13, bold: true, fill: C.b }) + R(192, 76, 124, 36, C.b, { op: 0.9, rx: 8 }) + T(254, 99, `${num(v * f)} ${to}`, { fill: '#2a1d08', bold: true });
    return svg(340, 128, b, 'unit conversion');
  };
  return [[draw(0), `The key fact: 1 ${from} = ${f} ${to}.`], [draw(1), `We have ${v} ${from}. That is ${v} lots of 1 ${from}.`], [draw(2), `So multiply: ${v} × ${f} = ${num(v * f)} ${to}. The smaller unit gives a bigger number.`]];
}
function timeF(start, h, m, end) {
  const [sh, sm] = start.split(':').map(Number), p2 = (x) => String(x).padStart(2, '0'), t1 = `${p2((sh + h) % 24)}:${p2(sm)}`, over = sm + m >= 60;
  const draw = (st) => {
    let b = L(20, 56, 330, 56, { sw: 2 }) + dot(30, 56, 7, C.a) + T(30, 38, start, { bold: true }) + T(30, 80, 'start', { size: 11, fill: C.dim });
    if (st >= 1) b += arrow(38, 56, 180, 56, C.d) + dot(190, 56, 7, C.d) + T(110, 46, `+${h} h`, { fill: C.d, bold: true }) + T(190, 38, t1, { bold: true });
    if (st >= 2) b += arrow(198, 56, 312, 56, C.b) + dot(320, 56, 7, C.b) + T(255, 46, `+${m} min`, { fill: C.b, bold: true }) + T(320, 38, end, { bold: true, fill: C.a }) + T(320, 80, 'finish', { size: 11, fill: C.dim });
    return svg(350, 94, b, 'time line');
  };
  return [[draw(0), `The walk starts at ${start}.`], [draw(1), `Add the hours first: ${start} + ${h} h = ${t1}.`], [draw(2), over ? `Now add ${m} minutes: ${sm} + ${m} = ${sm + m}, which is past 60. So the hour goes up by 1 and the minutes become ${sm + m - 60}: ${end}.` : `Now add ${m} minutes: ${t1} + ${m} min = ${end}.`]];
}
function cuboidF(l, w, h) {
  const cw = 18, lh = w * cw / 2.2, layer = l * w, H = 20 + 48 + lh + 56;
  const draw = (cnt, t1, t2) => {
    let b = ''; for (let k = 0; k < Math.min(cnt, 6); k++) b += R(30 + k * 6, 20 + (5 - k) * 8, l * cw, lh, C.a, { op: 0.35 + k * 0.1, stroke: C.line });
    const bx = 30 + l * cw / 2; if (t1) b += T(bx, 20 + 48 + lh + 18, t1); if (t2) b += T(bx, 20 + 48 + lh + 40, t2, { bold: true });
    return svg(40 + l * cw + 40, H, b, 'volume layers');
  };
  return [[draw(1, `${l} cm long × ${w} cm wide`), 'Volume counts how many 1 cm cubes fit inside. Start with the bottom layer.'], [draw(1, `One layer: ${l} × ${w} = ${layer}`), `One layer holds ${l} × ${w} = ${layer} cubes.`], [draw(h, `One layer: ${l} × ${w} = ${layer}`, `${h} layers high`), `The box is ${h} cm high, so it has ${h} layers like this.`], [draw(h, `${h} layers of ${layer}`, `${layer} × ${h} = ${layer * h} cm³`), `${layer} × ${h} = ${layer * h}. The volume is ${layer * h} cm³.`]];
}
function barF(v, q) {
  const { parts, take, label, total } = v, frac = q.topic === 'fractionOfAmount', W = 320, per = frac ? label : +(100 / parts).toFixed(1);
  const draw = (st) => {
    let b = T(180, 16, frac ? `${fmt(label * parts)}` : '100%', { size: 12, fill: C.dim });
    for (let i = 0; i < parts; i++) { const on = st >= 2 && i < take; b += R(20 + i * W / parts, 24, W / parts - 3, 40, on ? C.a : 'none', { stroke: C.line, op: 0.85 }); if (st >= 1) b += T(20 + i * W / parts + W / parts / 2, 49, frac ? String(per) : `${per}%`, { size: 12, fill: on ? DARK : C.dim }); }
    if (st >= 3) b += T(180, 96, total, { bold: true, size: 15 });
    return svg(360, 110, b, 'bar model');
  };
  const eq = frac ? `${fmt(label * parts)} ÷ ${parts} = ${label}` : `100% ÷ ${parts} = ${per}%`;
  return [[draw(0), `Draw the whole as a bar and cut it into ${parts} equal parts.`], [draw(1), `Each part is worth ${eq}.`], [draw(2), `Take ${take} of the ${parts} parts (the green ones).`], [draw(3), frac ? `${take} × ${label} = ${take * label}.` : `${take} × ${per}% = ${+(take * per).toFixed(1)}%.`]];
}
function opsF(list) { return list.map((_, i) => [svg(340, 20 + list.length * 34, list.map((s, j) => (j <= i ? R(20, 12 + j * 34, 300, 28, j === i ? C.a : 'none', { stroke: C.line, op: j === i ? 0.5 : 1 }) + T(170, 31 + j * 34, s, { size: 14 }) : '')).join(''), 'order of operations'), i === 0 ? 'Remember BIDMAS: brackets, then × and ÷, then + and −.' : i === list.length - 1 ? 'Now the last step gives the answer.' : 'Do the next step.']); }
function pbarF(pct, total) {
  const W = 320, tenth = total / 10, ans = +(total * pct / 100).toFixed(3);
  const draw = (st) => {
    let b = R(20, 30, W, 30, 'none', { stroke: C.line });
    if (st >= 1) b += R(20, 30, st >= 2 ? W * pct / 100 : W / 10, 30, st >= 2 ? C.a : C.b, { op: 0.85 });
    for (let i = 1; i < 10; i++) b += L(20 + W * i / 10, 30, 20 + W * i / 10, 60, { sw: 1 });
    b += T(20, 24, '0', { size: 11, fill: C.dim }) + T(20 + W, 24, fmt(total), { size: 11, fill: C.dim, anchor: 'end' });
    if (st === 1) b += T(20 + W / 20, 82, `10% = ${num(tenth)}`, { size: 12, anchor: 'start', fill: C.b, bold: true });
    if (st >= 3) b += T(180, 90, `${pct}% of ${fmt(total)} = ${num(ans)}`, { bold: true, size: 15 });
    return svg(360, 104, b, 'percentage bar');
  };
  return [[draw(0), `The whole bar is ${fmt(total)}. Each tenth of the bar is 10%.`], [draw(1), `10% is ${fmt(total)} ÷ 10 = ${num(tenth)}.`], [draw(2), `${pct}% is ${num(pct / 10)} tenths: ${num(pct / 10)} × ${num(tenth)} = ${num(ans)}.`], [draw(3), `So ${pct}% of ${fmt(total)} is ${num(ans)}.`]];
}
function termsF(groups, q) {
  const draw = (st) => {
    let b = ''; groups.forEach((g, i) => { const y = 16 + i * 40, on = st === i + 1, dim = st >= 1 && !on && st <= groups.length;
      b += R(14, y, 320, 32, on ? C.b : 'none', { op: 0.18, rx: 6 }) + T(24, y + 21, `${g.v}-terms`, { anchor: 'start', fill: C.dim, size: 12 }) + T(110, y + 21, g.parts.map(p => (p < 0 ? '−' : '+') + Math.abs(p) + g.v).join('   '), { anchor: 'start', fill: dim ? C.dim : C.ink });
      if (st >= i + 1) b += T(260, y + 21, `= ${g.sum}${g.v}`, { anchor: 'start', bold: true, fill: C.a }); });
    if (st > groups.length) b += T(170, 16 + groups.length * 40 + 14, q.answer, { bold: true, size: 17, fill: C.a });
    return svg(340, 30 + groups.length * 40 + 12, b, 'collecting like terms');
  };
  return [[draw(0), 'Sort the terms by their letter. Different letters cannot be added together.'], ...groups.map((g, i) => [draw(i + 1), `${g.v}-terms: ${g.parts.map((p, k) => (k && p >= 0 ? '+' : '') + (p < 0 ? '−' : '') + Math.abs(p) + g.v).join(' ')} = ${g.sum}${g.v}.`]), [draw(groups.length + 1), `Put them together: ${q.answer}.`]];
}
function seqF(vals, d, c) {
  const x = (i) => 20 + i * 80, cc = neg(c);
  const draw = (st) => {
    let b = ''; vals.forEach((v, i) => { b += R(x(i), 22, 66, 32, C.a, { op: 0.5, stroke: C.line }) + T(x(i) + 33, 44, String(v), { size: 16 }); if (st >= 1 && i < vals.length - 1) b += arrow(x(i) + 68, 18, x(i + 1) - 2, 18, C.b) + T(x(i) + 74, 10, `+${d}`, { size: 11, fill: C.b, anchor: 'middle' }); });
    if (st >= 2) vals.forEach((v, i) => { b += R(x(i), 84, 66, 28, 'none', { stroke: C.line }) + T(x(i) + 33, 103, `${d} × ${i + 1} = ${d * (i + 1)}`, { size: 12 }); });
    if (st >= 3) vals.forEach((v, i) => { b += T(x(i) + 33, 136, `${cc} to reach ${v}`, { size: 11, fill: C.b }); });
    if (st >= 4) b += T(20 + vals.length * 40, 166, `${d}n ${c.startsWith('-') ? '−' : '+'} ${Math.abs(+c)}`, { bold: true, size: 18, fill: C.a });
    return svg(40 + vals.length * 80, 178, b, 'sequence');
  };
  if (!+c) return [[draw(0), 'Look at how the numbers change from one term to the next.'], [draw(1), `The terms go up by ${d} each time, so the rule starts with ${d}n.`], [draw(2), `Row 2 is ${d}n for n = 1, 2, 3, 4, and it matches the sequence exactly, so there is nothing to add. The nth term is ${d}n.`]];
  return [[draw(0), 'Look at how the numbers change from one term to the next.'], [draw(1), `The terms go up by ${d} each time, so the rule starts with ${d}n.`], [draw(2), `Row 2 is what ${d}n gives for n = 1, 2, 3, 4: it is ${d} times the term number.`], [draw(3), `Compare with the real terms: each is ${cc === '+0' ? 'the same' : `${cc} away`} from ${d}n.`], [draw(4), `So the nth term is ${d}n ${c.startsWith('-') ? '−' : '+'} ${Math.abs(+c)}.`]];
}
function barsF(vals, mean) {
  const mx = Math.max(...vals, mean), H = 90, sum = vals.reduce((x, y) => x + y, 0);
  const draw = (st) => {
    let b = ''; vals.forEach((v, i) => { const h = v / mx * H; b += R(26 + i * 40, 106 - h, 30, h, C.a, { op: 0.7 }) + T(41 + i * 40, 120, String(v), { size: 11 }); });
    if (st >= 2) { const y = 106 - mean / mx * H; b += L(16, y, 30 + vals.length * 40, y, { stroke: C.b, sw: 2, dash: true }) + T(30 + vals.length * 40, y - 4, `mean ${mean}`, { anchor: 'end', size: 12, fill: C.b, bold: true }); }
    if (st >= 1) b += T(30 + vals.length * 20, 146, `total ${vals.join(' + ')} = ${sum}`, { size: 12, bold: true });
    return svg(50 + vals.length * 40, 158, b, 'mean as a level line');
  };
  return [[draw(0), 'Here are the numbers as bars.'], [draw(1), `Add them all up: the total is ${sum}.`], [draw(2), `Share the total equally between ${vals.length} bars: ${sum} ÷ ${vals.length} = ${mean}. The mean is the level they would all reach.`]];
}
function triangleF(bs, h) {
  const k = Math.min(18, 240 / bs), W = bs * k, H = h * k, ax = 30 + W * 0.35;
  const draw = (st) => {
    let s = R(30, 20, W, H, 'none', { stroke: C.line, rx: 0 });
    if (st >= 1) s += `<polygon points="30,${H + 20} ${30 + W},${H + 20} ${ax},20" fill="${C.a}" opacity="0.6" stroke="${C.line}"/>` + `<polygon points="30,20 ${ax},20 30,${H + 20}" fill="${C.b}" opacity="0.5"/><polygon points="${ax},20 ${30 + W},20 ${30 + W},${H + 20}" fill="${C.b}" opacity="0.5"/>`;
    s += T(30 + W / 2, H + 38, `base ${bs}`) + T(22, 20 + H / 2, `${h}`, { anchor: 'end' });
    if (st >= 2) s += T(30 + W / 2, H + 60, `½ × ${bs} × ${h} = ${bs * h / 2}`, { bold: true, size: 15 });
    return svg(60 + W, H + 72, s, 'triangle area');
  };
  return [[draw(0), `Start with a rectangle ${bs} by ${h}. Its area is ${bs} × ${h} = ${bs * h}.`], [draw(1), 'Draw the triangle inside. The two yellow bits that are left over fit together to make another copy of the triangle.'], [draw(2), `So the triangle is exactly half of the rectangle: ${bs * h} ÷ 2 = ${bs * h / 2}.`]];
}
function ratioF(a, b, k) {
  const W = 320, n = a + b, tot = n * k;
  const draw = (st) => {
    let s = ''; for (let i = 0; i < n; i++) s += R(20 + i * W / n, 24, W / n - 3, 34, i < a ? C.a : C.b, { op: st >= 3 && i >= a ? 0.25 : 0.85 }) + (st >= 2 ? T(20 + i * W / n + W / n / 2, 46, String(k), { size: 12, fill: DARK, bold: true }) : '');
    s += T(20 + a * W / n / 2, 78, `wood ${a}`, { size: 12 }) + T(20 + a * W / n + b * W / n / 2, 78, `stone ${b}`, { size: 12 });
    if (st >= 1) s += T(180, 16, `${a} + ${b} = ${n} parts`, { size: 12, bold: true, fill: C.b });
    if (st >= 3) s += T(180, 102, `${a} × ${k} = ${a * k} wood`, { bold: true, size: 15 });
    return svg(360, 114, s, 'ratio bar');
  };
  return [[draw(0), `${a}:${b} means ${a} parts of wood for every ${b} parts of stone.`], [draw(1), `Count the parts altogether: ${a} + ${b} = ${n}.`], [draw(2), `${tot} shared into ${n} equal parts: ${tot} ÷ ${n} = ${k} in each part.`], [draw(3), `Wood has ${a} parts: ${a} × ${k} = ${a * k}.`]];
}
function expandF(c, a, bs, q) {
  const draw = (st) => {
    let s = R(40, 34, 130, 54, C.a, { op: 0.5, stroke: C.line }) + R(170, 34, 90, 54, C.b, { op: 0.5, stroke: C.line }) + T(105, 26, `${a}x`) + T(215, 26, neg(`${bs < 0 ? '-' : '+'}${Math.abs(bs)}`)) + T(26, 66, String(c), { anchor: 'end', size: 18, bold: true });
    if (st >= 1) s += T(105, 66, `${c} × ${a}x = ${a * c}x`, { bold: true });
    if (st >= 2) s += T(215, 66, `${c} × ${neg(bs)} = ${neg(bs * c)}`, { size: 12, bold: true });
    if (st >= 3) s += T(150, 118, q.answer, { bold: true, size: 18, fill: C.a });
    return svg(300, 134, s, 'expanding a bracket');
  };
  return [[draw(0), `Think of a box: ${c} on the side, and the two parts of the bracket along the top.`], [draw(1), `${c} multiplies the first part: ${c} × ${a}x = ${a * c}x.`], [draw(2), `${c} also multiplies the second part: ${c} × ${neg(bs)} = ${neg(bs * c)}.`], [draw(3), `Put the two answers together: ${q.answer}.`]];
}
function anglesF(a, b, c) {
  const S = 300 / 180;
  const draw = (st) => {
    let s = `<polygon points="30,110 250,110 90,20" fill="${C.a}" opacity="0.35" stroke="${C.line}"/>` + T(62, 104, `${a}°`, { size: 12 }) + T(212, 104, `${b}°`, { size: 12 }) + T(92, 56, '?°', { bold: true, fill: C.b });
    if (st >= 1) s += R(20, 136, a * S, 24, C.a, { op: 0.8 }) + R(20 + a * S, 136, b * S, 24, C.d, { op: 0.8 }) + T(20 + a * S / 2, 153, `${a}°`, { size: 12, fill: DARK }) + T(20 + a * S + b * S / 2, 153, `${b}°`, { size: 12, fill: DARK }) + R(20, 136, 300, 24, 'none', { stroke: C.line }) + T(170, 176, 'a straight line = 180°', { size: 11, fill: C.dim });
    if (st >= 2) s += R(20 + (a + b) * S, 136, c * S, 24, C.b, { op: 0.9 }) + T(20 + (a + b) * S + c * S / 2, 153, `${c}°`, { size: 12, fill: DARK, bold: true }) + T(170, 198, `180 − ${a + b} = ${c}`, { bold: true, size: 15 });
    return svg(340, 210, s, 'angles in a triangle');
  };
  return [[draw(0), 'The three angles of any triangle add up to 180°.'], [draw(1), `The two we know use up ${a} + ${b} = ${a + b}° of that 180°.`], [draw(2), `What is left is the third angle: 180 − ${a + b} = ${c}°.`]];
}
function signsF(a, b, op, ans) {
  const A = -a;
  if (op === '+') {
    const lo = ans - 1, hi = 1, d = (marks, segs) => nline(lo, hi, { marks, segs });
    return [[d([{ v: a, label: neg(a), col: C.a }], []), `Start at ${neg(a)}, which is ${A} below zero.`], [d([{ v: a, label: neg(a), col: C.a }], [{ from: a, to: ans, col: C.c, label: neg(b) }]), `Adding ${neg(b)} means moving ${-b} steps DOWN (to the left).`], [d([{ v: a, label: neg(a), col: C.a }, { v: ans, label: neg(ans), col: C.c }], [{ from: a, to: ans, col: C.c, label: neg(b) }]), `Further below zero, at ${neg(ans)}. Two negatives added make a bigger negative.`]];
  }
  const rows = [[2, a * 2], [1, a], [0, 0], [-1, -a]], last = [b, ans];
  const draw = (cnt, tail) => {
    let s = ''; const all = rows.slice(0, cnt).concat(tail ? [null, last] : []);
    all.forEach((r, i) => { const y = 14 + i * 34; if (!r) { s += T(150, y + 20, '⋮', { size: 18, fill: C.dim }); return; } const m = r[0], v = r[1], pos = v > 0;
      s += R(30, y, 240, 28, pos ? C.a : 'none', { stroke: C.line, op: pos ? 0.4 : 1, rx: 6 }) + T(150, y + 19, `${neg(a)} × ${neg(m)} = ${neg(v)}`, { size: 14, bold: pos });
      if (i > 0 && all[i - 1]) s += T(290, y - 4, `+${A}`, { size: 11, fill: C.b, bold: true }); });
    return svg(330, 28 + all.length * 34, s, 'multiplying negatives pattern');
  };
  return [[draw(3), `Look at the pattern. Each time the second number goes down by 1, the answer goes UP by ${A}.`], [draw(4), `Carry on past zero: ${neg(a)} × −1 = ${A}. A negative times a negative is a positive.`], [draw(4, true), `Keep going down to ${neg(b)} and the answer is ${ans}.`]];
}
function cardsF(list, worked) {
  return list.map((_, i) => [svg(380, 12 + list.length * 38, list.map((s, j) => (j <= i ? `<g opacity="${j === i ? 1 : 0.55}">${dot(22, 24 + j * 38, 12, j === i ? C.b : C.a)}${T(22, 29 + j * 38, String(j + 1), { fill: DARK, size: 12, bold: true })}${T(44, 29 + j * 38, s, { anchor: 'start', size: 14 })}</g>` : '')).join(''), 'steps'), i === list.length - 1 ? (worked || `Step ${i + 1}.`) : `Step ${i + 1} of ${list.length}.`]);
}

function build(q) {
  const v = q.viz; if (!v) return cardsF(q.steps, q.worked);
  switch (v.t) {
    case 'grid': return gridF(v.w, v.h);
    case 'split': return splitF(v.a, v.b);
    case 'groups': return groupsF(v.total, v.n);
    case 'fracbars': return fracF(v.n, v.d, v.k);
    case 'negative': return negF(v.a, v.b);
    case 'round': return roundF(v.x, v.ans);
    case 'placevalue': return placeF(v.n, v.i);
    case 'column': return columnF(v.a, v.b, v.op, v.ans);
    case 'factors': return factorsF(v.n, v.pairs, q);
    case 'convert': return convertF(v.v, v.from, v.to, v.f);
    case 'timeline': return timeF(v.start, v.h, v.m, v.end);
    case 'cuboid': return cuboidF(v.l, v.w, v.h);
    case 'bar': return barF(v, q);
    case 'ops': return opsF(v.steps);
    case 'pbar': return pbarF(v.pct, v.total);
    case 'terms': return termsF(v.groups, q);
    case 'seq': return seqF(v.vals, v.d, v.c);
    case 'bars': return barsF(v.vals, v.mean);
    case 'triangle': return triangleF(v.b, v.h);
    case 'ratio': return ratioF(v.a, v.b, v.k);
    case 'expand': return expandF(v.c, v.a, v.bs, q);
    case 'angles': return anglesF(v.a, v.b, v.c);
    case 'signs': return signsF(v.a, v.b, v.op, v.ans);
    case 'steps': return cardsF(v.list, q.worked);
    default: return cardsF(q.steps, q.worked);
  }
}

/** Frames for the wrong-answer walkthrough. Never throws: falls back to numbered step cards. */
export function explainFrames(q, picked) {
  let raw; try { raw = build(q); } catch { raw = null; }
  if (!raw || raw.length < 2 || raw.some(f => !f[0] || /NaN|undefined|Infinity/.test(f[0] + f[1]))) raw = cardsF(q.steps?.length ? q.steps : [q.worked], q.worked);
  const frames = raw.map(([s, say]) => ({ svg: s, say }));
  frames[frames.length - 1].say += ` The answer is ${q.answer}.`;
  return { slip: `${picked != null ? `You picked ${picked}. ` : ''}${SLIPS[q.topic] || ''}`.trim(), frames };
}
