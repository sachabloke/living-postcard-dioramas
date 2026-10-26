// Question generators. Topic names/weights follow the Grok rules handover (Year 5/6 and KS3 banks);
// the generators themselves are new. Every question: {id,topic,level,strand,q,answer,choices[4],worked,hint,steps[]}.
// level 1/2/3 = easy/normal/hard. Multiple choice, four options.
import { makeRng } from './rng.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

const Y5 = {
  multiply:  { w: 3, strand: 'Multiplication', make(r, L) {
    const a = r.int(L === 1 ? 12 : L === 2 ? 24 : 123, L === 1 ? 49 : L === 2 ? 87 : 489), b = r.int(L === 1 ? 3 : 4, L === 3 ? 9 : 7);
    const ans = a * b, t = Math.floor(a / 10) * 10 * b, o = (a % 10) * b;
    return { viz: { t: 'split', a, b }, q: `A woodcutter stacks ${a} logs a day for ${b} days. How many logs?`, answer: ans,
      wrong: [ans - (a % 10) * b, ans + 10, ans - 10, t, ans + b],
      worked: `${a} × ${b}: ${Math.floor(a / 10) * 10} × ${b} = ${t}, ${a % 10} × ${b} = ${o}, and ${t} + ${o} = ${ans}.`,
      hint: `Split ${a} into tens and ones, multiply each part by ${b}, then add.`, steps: [`${a} = ${Math.floor(a / 10) * 10} + ${a % 10}`, `${Math.floor(a / 10) * 10} × ${b} = ${t}`, `${a % 10} × ${b} = ${o}`, `${t} + ${o} = ${ans}`] }; } },
  divide:    { w: 3, strand: 'Division', make(r, L) {
    const b = r.int(3, L === 3 ? 12 : 8), c = r.int(L === 1 ? 6 : 12, L === 3 ? 60 : 30), a = b * c;
    return { viz: { t: 'groups', total: a, n: b }, q: `${a} berries are shared equally between ${b} baskets. How many in each?`, answer: c,
      wrong: [c + 1, c - 1, c + 10, Math.round(a / (b + 1))], worked: `${a} ÷ ${b} = ${c}, because ${b} × ${c} = ${a}.`,
      hint: `Which number times ${b} makes ${a}?`, steps: [`${a} ÷ ${b} = ?`, `Think: ${b} × ? = ${a}`, `${b} × ${c} = ${a}`] }; } },
  equivalentFractions: { w: 2, strand: 'Fractions', make(r, L) {
    const d = r.pick([2, 3, 4, 5, 6]), n = r.int(1, d - 1), k = r.int(2, L === 3 ? 9 : 5), ans = n * k;
    return { viz: { t: 'fracbars', n, d, k }, q: `${n}/${d} = ?/${d * k}`, answer: ans, wrong: [n + k, ans + k, ans - 1, d * k - n],
      worked: `${d} × ${k} = ${d * k}, so multiply the top by ${k} too: ${n} × ${k} = ${ans}.`,
      hint: `The bottom was multiplied by ${k}. Do the same to the top.`, steps: [`${d} → ${d * k}: × ${k}`, `Top must also × ${k}`, `${n} × ${k} = ${ans}`] }; } },
  perimeterArea: { w: 2, strand: 'Measurement', make(r, L) {
    const w = r.int(3, L === 3 ? 15 : 9), h = r.int(2, L === 3 ? 12 : 8);
    return { viz: { t: 'grid', w, h }, q: `A clearing is ${w} m wide and ${h} m long. What is its area in m²?`, answer: w * h,
      wrong: [2 * (w + h), w + h, w * h + w, w * h - h], worked: `Area = width × length = ${w} × ${h} = ${w * h} m².`,
      hint: `Area of a rectangle: multiply the two sides. (Perimeter would add all four.)`, steps: [`Area = width × length`, `${w} × ${h} = ${w * h}`] }; } },
  roundDecimals: { w: 1, strand: 'Decimals', make(r, L) {
    const whole = r.int(1, L === 3 ? 99 : 20), t = r.int(0, 9), h = r.int(0, 9), th = r.int(0, 9), x = `${whole}.${t}${h}${th}`;
    const ans = (Math.round((whole + t / 10 + h / 100 + th / 1000) * 100) / 100).toFixed(2);
    const wr = [`${whole}.${t}${h}`, `${whole}.${t}${(h + 1) % 10}`, `${whole}.${t}${h}${th}`, `${whole + 1}.00`].filter(v => v !== ans);
    return { viz: { t: 'round', x: Number(x), ans }, q: `Round ${x} to 2 decimal places.`, answer: ans, wrong: wr, worked: `Look at the third decimal digit (${th}): ${th >= 5 ? 'it is 5 or more, so round up' : 'it is below 5, so keep the digit'}. Answer ${ans}.`,
      hint: `Only the third decimal place decides whether to round up.`, steps: [`Third decimal: ${th}`, th >= 5 ? '5 or more → round up' : 'Below 5 → stay', `${ans}`] }; } },
  negative: { w: 2, strand: 'Negative numbers', make(r, L) {
    const a = r.int(1, L === 3 ? 12 : 8), b = r.int(a + 1, a + (L === 3 ? 12 : 8)), ans = a - b;
    return { viz: { t: 'negative', a, b }, q: `On a winter morning it is ${a}°C. By night it drops ${b}°C. What is the temperature?`, answer: `${ans}°C`,
      wrong: [`${b - a}°C`, `${-(a + b)}°C`, `${a + b}°C`, `${ans + 1}°C`], worked: `${a} − ${b} = ${ans}. Going below zero gives a negative number.`,
      hint: `Count down ${a} to zero, then the rest below zero.`, steps: [`${a} − ${a} = 0`, `Still to drop: ${b - a}`, `Below zero: −${b - a}`] }; } },
  placeValue: { w: 3, strand: 'Place value', make(r, L) {
    const n = r.int(L === 1 ? 1000 : 10000, L === 3 ? 999999 : 99999), s = String(n), i = r.int(0, s.length - 1), d = +s[i];
    const names = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'], p = names[s.length - 1 - i], val = d * 10 ** (s.length - 1 - i);
    return { viz: { t: 'placevalue', n, i }, q: `In ${n.toLocaleString('en-GB')}, what is the value of the digit ${d} in the ${p} place?`, answer: val.toLocaleString('en-GB'),
      wrong: [(d * 10 ** Math.max(0, s.length - i)).toLocaleString('en-GB'), String(d), (val * 10).toLocaleString('en-GB'), (val / 10 >= 1 ? val / 10 : val * 100).toLocaleString('en-GB')].filter(v => v !== val.toLocaleString('en-GB')),
      worked: `The ${d} is in the ${p} column, so its value is ${val.toLocaleString('en-GB')}.`, hint: `Name the column first, then write the digit with its zeros.`, steps: [`Column: ${p}`, `${d} × ${10 ** (s.length - 1 - i)} = ${val}`] }; } },
  addSub: { w: 3, strand: 'Addition and subtraction', make(r, L) {
    let a = r.int(L === 1 ? 1200 : L === 2 ? 12000 : 45000, L === 1 ? 4800 : L === 2 ? 48000 : 98000), b = r.int(L === 1 ? 900 : L === 2 ? 3500 : 12000, L === 1 ? 3500 : L === 2 ? 9800 : 41000); const add = r.pick([true, false]);
    if (!add && b > a) [a, b] = [b, a]; const ans = add ? a + b : a - b, f = (n) => n.toLocaleString('en-GB');
    return { viz: { t: 'column', a, b, op: add ? '+' : '-', ans }, q: add ? `The village counts ${f(a)} acorns in autumn and ${f(b)} in winter. How many altogether?` : `The store holds ${f(a)} logs and ${f(b)} are used. How many are left?`, answer: f(ans),
      wrong: [f(ans + 10), f(ans - 10), f(ans + 100), f(add ? a - b : a + b), f(ans + 1000)], worked: `${f(a)} ${add ? '+' : '−'} ${f(b)} = ${f(ans)}. Line the digits up by place value and work from the ones.`,
      hint: `Write the numbers one above the other so the ones line up, then work from the right.`, steps: [`Line up the digits (ones under ones)`, `${add ? 'Add' : 'Subtract'} from the right, carrying or borrowing`, `${f(a)} ${add ? '+' : '−'} ${f(b)} = ${f(ans)}`] }; } },
  factors: { w: 2, strand: 'Factors and multiples', make(r, L) {
    const n = r.pick(L === 1 ? [12, 18, 20, 24] : L === 2 ? [30, 36, 40, 42, 48] : [54, 60, 72, 84, 90]), fac = []; for (let i = 1; i <= n; i++) if (n % i === 0) fac.push(i);
    const non = []; for (let i = 3; i < n && non.length < 12; i++) if (n % i !== 0) non.push(i); const ans = r.pick(non), wr = r.shuffle(fac.filter(f => f > 1 && f < n)).slice(0, 4);
    const pairs = fac.filter(f => f * f <= n).map(f => [f, n / f]);
    return { viz: { t: 'factors', n, pairs }, q: `Which of these is NOT a factor of ${n}?`, answer: ans, wrong: wr, worked: `The factors of ${n} are ${fac.join(', ')}. ${ans} is not in the list because ${n} ÷ ${ans} is not a whole number.`,
      hint: `A factor divides exactly with no remainder. Test each one.`, steps: [`Find factor pairs of ${n}`, pairs.map(([x, y]) => `${x} × ${y}`).join(', '), `${ans} is not in any pair`] }; } },
  fractionOfAmount: { w: 3, strand: 'Fractions', make(r, L) {
    const d = r.pick(L === 1 ? [2, 3, 4, 5] : [4, 5, 6, 8, 10]), n = r.int(1, d - 1), unit = r.int(L === 3 ? 6 : 3, L === 3 ? 15 : 9), total = d * unit, ans = n * unit;
    return { viz: { t: 'bar', parts: d, take: n, label: unit, total: `${n}/${d} of ${total} = ${ans}` }, q: `What is ${n}/${d} of ${total}?`, answer: ans, wrong: [unit, total - ans, ans + unit, n * d],
      worked: `Divide ${total} by ${d} to get one part (${unit}), then take ${n} parts: ${n} × ${unit} = ${ans}.`, hint: `Find 1/${d} first by dividing by ${d}.`, steps: [`${total} ÷ ${d} = ${unit}`, `${n} × ${unit} = ${ans}`] }; } },
  units: { w: 2, strand: 'Measurement', make(r, L) {
    const c = r.pick([['m', 'cm', 100], ['km', 'm', 1000], ['kg', 'g', 1000], ['l', 'ml', 1000]]), v = r.pick(L === 1 ? [2, 3, 5, 6] : [1.5, 2.5, 3.5, 4.25, 0.75]), ans = +(v * c[2]).toFixed(3);
    return { viz: { t: 'convert', v, from: c[0], to: c[1], f: c[2] }, q: `Convert ${v} ${c[0]} to ${c[1]}.`, answer: ans, wrong: [+(v * c[2] / 10).toFixed(3), +(v * c[2] * 10).toFixed(3), +(v + c[2]).toFixed(3), +(v / c[2]).toFixed(5)],
      worked: `1 ${c[0]} = ${c[2]} ${c[1]}, so ${v} ${c[0]} = ${v} × ${c[2]} = ${ans} ${c[1]}.`, hint: `Going to the smaller unit gives a bigger number: multiply by ${c[2]}.`, steps: [`1 ${c[0]} = ${c[2]} ${c[1]}`, `${v} × ${c[2]} = ${ans}`] }; } },
  time: { w: 2, strand: 'Time', make(r, L) {
    const sh = r.int(8, 17), sm = r.pick([0, 10, 15, 20, 30, 45]), dh = r.int(1, L === 1 ? 2 : 3), dm = r.pick([10, 20, 25, 35, 40, 50]), tot = sh * 60 + sm + dh * 60 + dm, eh = Math.floor(tot / 60) % 24, em = tot % 60;
    const p2 = (n) => String(n).padStart(2, '0'), ans = `${p2(eh)}:${p2(em)}`, start = `${p2(sh)}:${p2(sm)}`;
    return { viz: { t: 'timeline', start, h: dh, m: dm, end: ans }, q: `A walk starts at ${start} and lasts ${dh} h ${dm} min. When does it finish?`, answer: ans, wrong: [`${p2(eh)}:${p2((em + 10) % 60)}`, `${p2((eh + 1) % 24)}:${p2(em)}`, `${p2(eh)}:${p2((em + 50) % 60)}`, `${p2((sh + dh) % 24)}:${p2((sm + dm) % 60)}`].filter(v => v !== ans),
      worked: `${start} + ${dh} h = ${p2((sh + dh) % 24)}:${p2(sm)}. Then + ${dm} min = ${ans}.`, hint: `Add the hours first, then the minutes (watch for 60 minutes making a new hour).`, steps: [`Add ${dh} hour(s)`, `Add ${dm} minutes`, `Finish ${ans}`] }; } },
  volume: { w: 2, strand: 'Measurement', make(r, L) {
    const l = r.int(3, L === 3 ? 9 : 6), w = r.int(2, L === 3 ? 8 : 5), h = r.int(2, L === 3 ? 7 : 4), ans = l * w * h;
    return { viz: { t: 'cuboid', l, w, h }, q: `A wooden box is ${l} cm long, ${w} cm wide and ${h} cm high. What is its volume in cm³?`, answer: ans, wrong: [2 * (l * w + w * h + l * h), l + w + h, l * w, ans + l * w],
      worked: `Volume = length × width × height = ${l} × ${w} × ${h} = ${ans} cm³.`, hint: `Volume is a count of cubes: layer area times the number of layers.`, steps: [`One layer: ${l} × ${w} = ${l * w}`, `${h} layers: ${l * w} × ${h} = ${ans}`] }; } },
};

const KS3 = {
  solve:  { w: 3, strand: 'Algebra', make(r, L) {
    const x = r.int(2, L === 3 ? 15 : 9), a = r.int(2, L === 3 ? 9 : 6), b = r.int(1, 15), c = a * x + b;
    return { viz: { t: 'steps', list: [`${a}x + ${b} = ${c}`, `Take ${b} from BOTH sides: ${a}x = ${c - b}`, `Divide BOTH sides by ${a}: x = ${x}`] }, q: `Solve ${a}x + ${b} = ${c}`, answer: `x = ${x}`, wrong: [`x = ${x + 1}`, `x = ${x - 1}`, `x = ${c - b}`, `x = ${c + b}`],
      worked: `Subtract ${b}: ${a}x = ${c - b}. Divide by ${a}: x = ${x}.`, hint: `Undo the "+ ${b}" first, then undo the multiplication.`, steps: [`${a}x + ${b} = ${c}`, `− ${b}: ${a}x = ${c - b}`, `÷ ${a}: x = ${x}`] }; } },
  ratio:  { w: 3, strand: 'Ratio', make(r, L) {
    const a = r.int(1, 4), b = r.int(a + 1, 7), k = r.int(2, L === 3 ? 12 : 8), tot = (a + b) * k;
    return { viz: { t: 'ratio', a, b, k }, q: `Wood and stone are shared ${a}:${b}. There are ${tot} items. How many are wood?`, answer: a * k,
      wrong: [b * k, tot / 2, a * k + a, tot - a], worked: `${a}+${b} = ${a + b} parts. One part = ${tot} ÷ ${a + b} = ${k}. Wood = ${a} × ${k} = ${a * k}.`,
      hint: `Add the ratio parts, find the value of one part, then multiply.`, steps: [`Parts: ${a}+${b} = ${a + b}`, `One part: ${tot} ÷ ${a + b} = ${k}`, `Wood: ${a} × ${k} = ${a * k}`] }; } },
  expand: { w: 3, strand: 'Algebra', make(r, L) {
    const a = r.int(2, 7), b = r.int(1, 9), c = r.int(2, L === 3 ? 9 : 6), sign = r.pick([1, -1]), bs = sign * b;
    const f = (k, v) => `${k}${v}`.replace('+-', '−');
    const ans = `${a * c}x ${bs * c < 0 ? '−' : '+'} ${Math.abs(bs * c)}`, str = (c2, k) => `${c2}x ${k < 0 ? '−' : '+'} ${Math.abs(k)}`;
    return { viz: { t: 'expand', c, a, bs }, q: `Expand ${c}(${a}x ${bs < 0 ? '−' : '+'} ${b})`, answer: ans, wrong: [str(a * c, bs), str(a + c, bs * c), str(a * c, -bs * c), `${a * c}x ${bs * c < 0 ? '−' : '+'} ${Math.abs(bs) + c}`].filter(v => v !== ans),
      worked: `Multiply both terms by ${c}: ${a}x × ${c} = ${a * c}x and ${bs} × ${c} = ${bs * c}.`, hint: `The ${c} multiplies EVERY term in the bracket.`, steps: [`${c} × ${a}x = ${a * c}x`, `${c} × ${bs} = ${bs * c}`] }; } },
  fdp:    { w: 3, strand: 'Fractions, decimals, %', make(r, L) {
    const d = r.pick([4, 5, 8, 10, 20, 25]), n = r.int(1, d - 1), pct = (n / d) * 100;
    return { viz: { t: 'bar', parts: d, take: n, label: '', total: `${n}/${d} = ${+pct.toFixed(1)}%` }, q: `Write ${n}/${d} as a percentage.`, answer: `${+pct.toFixed(1)}%`, wrong: [`${+(pct / 10).toFixed(1)}%`, `${+(pct + 10).toFixed(1)}%`, `${n * d}%`, `${+(pct * 2).toFixed(1)}%`],
      worked: `${n} ÷ ${d} = ${n / d}. Multiply by 100: ${+pct.toFixed(1)}%.`, hint: `Divide the top by the bottom, then × 100.`, steps: [`${n} ÷ ${d} = ${n / d}`, `× 100 = ${+pct.toFixed(1)}%`] }; } },
  neg:    { w: 2, strand: 'Negative numbers', make(r, L) {
    const a = -r.int(2, 12), b = -r.int(2, 9), op = r.pick(['×', '+']), ans = op === '×' ? a * b : a + b;
    return { viz: { t: 'signs', a, b, op, ans }, q: `Work out (${a}) ${op} (${b})`, answer: ans, wrong: [-ans, ans + 2, ans - 2, Math.abs(a) - Math.abs(b)].filter(v => v !== ans),
      worked: op === '×' ? `Negative × negative = positive: ${-a} × ${-b} = ${ans}.` : `Adding two negatives makes a bigger negative: ${a} + ${b} = ${ans}.`,
      hint: op === '×' ? `Two negatives multiply to a positive.` : `Adding a negative moves further below zero.`, steps: [op === '×' ? `Signs: − × − = +` : `Both below zero → move further down`, `${ans}`] }; } },
  angles: { w: 2, strand: 'Geometry', make(r, L) {
    const a = r.int(35, 120), b = r.int(20, 150 - a > 20 ? 150 - a : 25), ans = 180 - a - b;
    return { viz: { t: 'angles', a, b, c: ans }, q: `Two angles of a triangle are ${a}° and ${b}°. What is the third?`, answer: `${ans}°`, wrong: [`${360 - a - b}°`, `${a + b}°`, `${ans + 10}°`, `${ans - 10}°`],
      worked: `Angles in a triangle add to 180°. 180 − ${a} − ${b} = ${ans}°.`, hint: `The three angles of a triangle always total 180°.`, steps: [`Total 180°`, `${a} + ${b} = ${a + b}`, `180 − ${a + b} = ${ans}`] }; } },
  orderOps: { w: 3, strand: 'Number', make(r, L) {
    const a = r.int(2, 9), b = r.int(2, 9), c = r.int(2, 9), t = r.int(0, 2), P = (x) => x;
    const e = [[`${a} + ${b} × ${c}`, a + b * c, [`${b} × ${c} = ${b * c}`, `${a} + ${b * c} = ${a + b * c}`], (a + b) * c], [`(${a} + ${b}) × ${c}`, (a + b) * c, [`Brackets first: ${a} + ${b} = ${a + b}`, `${a + b} × ${c} = ${(a + b) * c}`], a + b * c], [`${a * b} − ${b} × ${c}`, a * b - b * c, [`${b} × ${c} = ${b * c}`, `${a * b} − ${b * c} = ${a * b - b * c}`], (a * b - b) * c]][t];
    return { viz: { t: 'ops', steps: [e[0] + ' = ?', ...e[2]] }, q: `Work out ${e[0]}`, answer: e[1], wrong: [e[3], e[1] + 1, e[1] - 1, e[1] + c], worked: `BIDMAS: brackets, then × or ÷, then + or −. ${e[2].join('; ')}.`, hint: `Brackets first, then multiply or divide, then add or subtract.`, steps: e[2] }; } },
  percentOf: { w: 3, strand: 'Fractions, decimals, %', make(r, L) {
    const pct = r.pick(L === 1 ? [10, 20, 50] : L === 2 ? [15, 25, 30, 40, 60, 75] : [35, 45, 65, 85, 12.5]), base = pct % 5 === 0 ? 20 * r.int(2, 30) : 80 * r.int(1, 10), ans = base * pct / 100;
    return { viz: { t: 'pbar', pct, total: base }, q: `What is ${pct}% of ${base}?`, answer: ans, wrong: [base / 100 * pct * 10, base - ans, ans + 10, base * pct], worked: `10% of ${base} is ${base / 10}. ${pct}% = ${pct} ÷ 100 × ${base} = ${ans}.`,
      hint: `Find 10% (÷10) or 1% (÷100) first, then build up.`, steps: [`1% of ${base} = ${base / 100}`, `${pct} × ${base / 100} = ${ans}`] }; } },
  collect: { w: 3, strand: 'Algebra', make(r, L) {
    const a1 = r.int(2, 7), a2 = r.int(1, 6), b1 = r.int(3, 9), b2 = r.int(1, b1 - 1), A = a1 + a2, B = b1 - b2, f = (n, v) => `${n}${v}`, ans = `${A}a + ${B}b`;
    return { viz: { t: 'terms', groups: [{ v: 'a', parts: [a1, a2], sum: A }, { v: 'b', parts: [b1, -b2], sum: B }] }, q: `Simplify ${a1}a + ${b1}b + ${a2}a − ${b2}b`, answer: ans, wrong: [`${A}a + ${b1 + b2}b`, `${a1 + a2 + b1 - b2}ab`, `${a1 * a2}a + ${B}b`, `${A}a − ${B}b`],
      worked: `Collect like terms: ${a1}a + ${a2}a = ${A}a and ${b1}b − ${b2}b = ${B}b. Answer ${ans}.`, hint: `Only add terms with the same letter. a's with a's, b's with b's.`, steps: [`${a1}a + ${a2}a = ${A}a`, `${b1}b − ${b2}b = ${B}b`, ans] }; } },
  sequences: { w: 2, strand: 'Algebra', make(r, L) {
    const d = r.int(2, L === 3 ? 9 : 6), c = r.int(-3, 8), vals = [1, 2, 3, 4].map(n => d * n + c), cs = c < 0 ? `− ${-c}` : c > 0 ? `+ ${c}` : '', ans = `${d}n ${cs}`.trim();
    return { viz: { t: 'seq', vals, d, c: c >= 0 ? '+' + c : String(c) }, q: `Find the nth term of ${vals.join(', ')}, …`, answer: ans, wrong: [`${d}n`, `n + ${d}`, `${d + 1}n ${cs}`.trim(), `${d}n ${c > 0 ? '−' : '+'} ${Math.abs(c)}`.trim()].filter(v => v !== ans),
      worked: `The sequence goes up by ${d} each time, so it starts ${d}n. When n = 1, ${d}n = ${d} but the first term is ${vals[0]}, so adjust by ${c >= 0 ? '+' : '−'} ${Math.abs(c)}: ${ans}.`, hint: `Find the common difference. That is the number in front of n.`, steps: [`Difference = ${d}, so ${d}n`, `${d}×1 = ${d}, first term ${vals[0]}`, `Adjust by ${c}: ${ans}`] }; } },
  meanMedian: { w: 2, strand: 'Statistics', make(r, L) {
    const n = r.pick([4, 5, 6]), m = r.int(4, 14); let vals = []; for (let i = 0; i < n - 1; i++) vals.push(r.int(m - 3, m + 4)); vals.push(m * n - vals.reduce((x, y) => x + y, 0)); vals = vals.filter(v => v > 0); if (vals.length < n) vals = [m, m + 2, m - 2, m + 1, m - 1].slice(0, n); const mean = Math.round(vals.reduce((x, y) => x + y, 0) / vals.length * 10) / 10, sorted = vals.slice().sort((x, y) => x - y);
    return { viz: { t: 'bars', vals, mean }, q: `Find the mean of ${vals.join(', ')}.`, answer: mean, wrong: [sorted[Math.floor(sorted.length / 2)], Math.max(...vals) - Math.min(...vals), vals.reduce((x, y) => x + y, 0), mean + 1],
      worked: `Add them up: ${vals.reduce((x, y) => x + y, 0)}. Divide by how many there are (${vals.length}): ${mean}.`, hint: `Mean = total ÷ how many numbers.`, steps: [`Total = ${vals.reduce((x, y) => x + y, 0)}`, `${vals.reduce((x, y) => x + y, 0)} ÷ ${vals.length} = ${mean}`] }; } },
  areaTriangle: { w: 2, strand: 'Geometry', make(r, L) {
    const b = 2 * r.int(2, L === 3 ? 12 : 8), h = r.int(3, L === 3 ? 14 : 10), ans = b * h / 2;
    return { viz: { t: 'triangle', b, h }, q: `A triangular sail has base ${b} cm and height ${h} cm. What is its area in cm²?`, answer: ans, wrong: [b * h, b + h, ans + b, b * h / 3],
      worked: `Area of a triangle = ½ × base × height = ½ × ${b} × ${h} = ${ans} cm².`, hint: `A triangle is half of a rectangle with the same base and height.`, steps: [`Rectangle: ${b} × ${h} = ${b * h}`, `Triangle is half: ${ans}`] }; } },
};

export const BANKS = { y56: Y5, ks3: KS3 };
export const topicsOf = (band) => Object.keys(BANKS[band]);

export function makeQuestion(band, topic, level, rng, serial = 0) {
  const bank = BANKS[band], g = bank[topic];
  let out, tries = 0;
  do { out = g.make(rng, level); tries++; } while ((new Set([String(out.answer), ...out.wrong.map(String)]).size < 4) && tries < 20);
  const wrong = [...new Set(out.wrong.map(String))].filter(v => v !== String(out.answer)).slice(0, 3);
  while (wrong.length < 3) wrong.push(String(Number(out.answer) + wrong.length + 1 || `${wrong.length}`));
  const choices = rng.shuffle([String(out.answer), ...wrong]);
  return { id: `${band}:${topic}:${level}:${out.q}`, serial, band, topic, level, strand: g.strand, q: out.q, answer: String(out.answer),
    choices, correctIndex: choices.indexOf(String(out.answer)), worked: out.worked, hint: out.hint, steps: out.steps, viz: out.viz || null };
}
export const weightOf = (band, topic) => BANKS[band][topic].w;
export { makeRng, gcd };
