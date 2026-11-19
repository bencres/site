// Marginal sketches for the field journal, drawn as inline SVG with the same
// seeded "hand" as the Rive scenes: jittered pen lines that ink themselves in
// (stroke-dashoffset on pathLength=1) and watercolor dabs that bloom after.
// Static once drawn; any idle motion is a tiny CSS animation that only runs
// while the sketch is on screen. Season (0-3) and time (0-4) pick variants.

export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.jit = (amt) => (next() * 2 - 1) * amt;
  return next;
}

const TAU = Math.PI * 2;
const n1 = (v) => Math.round(v * 10) / 10;
const P = (x, y) => ({ x, y });

// Catmull-Rom through the points, as cubic Béziers
export function smooth(pts, closed = false) {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${n1(pts[0].x)} ${n1(pts[0].y)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const c1 = P(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6);
    const c2 = P(p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6);
    d += `C${n1(c1.x)} ${n1(c1.y)} ${n1(c2.x)} ${n1(c2.y)} ${n1(p2.x)} ${n1(p2.y)}`;
  }
  return closed ? d + 'Z' : d;
}

export function blob(cx, cy, rx, ry, r, { n = 10, wobble = 0.14, rot = 0 } = {}) {
  const pts = [];
  const st = r() * TAU;
  for (let i = 0; i < n; i++) {
    const a = st + (i / n) * TAU;
    const k = 1 + r.jit(wobble);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    pts.push(P(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)));
  }
  return pts;
}

const darken = (hex, f) =>
  [0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, '0')).join('');

/** Collects washes (painted first, bloom last) and ink (drawn in order). */
class Sheet {
  constructor(seed) {
    this.r = rng(seed);
    this.washes = [];
    this.inks = [];
    this.top = [];
    this.i = 0;
  }
  ink(pts, { w = 1.3, closed = false, amt = 0.45, cls = '', color } = {}) {
    const j = pts.map((p) => P(p.x + this.r.jit(amt), p.y + this.r.jit(amt)));
    const d = smooth(j, closed);
    const st = color ? ` style="stroke:${color};--i:${this.i}"` : ` style="--i:${this.i}"`;
    this.i++;
    const xml = `<path class="bleed" d="${d}" pathLength="1" stroke-width="${n1(w * 2.6)}"${st}/><path class="ink" d="${d}" pathLength="1" stroke-width="${w}"${st}/>`;
    if (cls) this.inks.push(`<g class="${cls}">${xml}</g>`);
    else this.inks.push(xml);
    return this;
  }
  // a run of ink strokes that belong to one moving part
  part(cls, fn) {
    const keep = this.inks;
    this.inks = [];
    fn(this);
    const inner = this.inks.join('');
    this.inks = keep;
    this.inks.push(`<g class="${cls}">${inner}</g>`);
    return this;
  }
  wash(pts, color, { alpha = 0.5, grain = 0.5, cls = '', wobble = 1.2, wet = 1 } = {}) {
    const r = this.r;
    const shape = pts.map((p) => P(p.x + r.jit(wobble), p.y + r.jit(wobble)));
    const cx = shape.reduce((a, p) => a + p.x, 0) / shape.length;
    const cy = shape.reduce((a, p) => a + p.y, 0) / shape.length;
    const wetPts = shape.map((p) => P(cx + (p.x - cx) * 0.7 + r.jit(wobble * 2), cy + (p.y - cy) * 0.66 + r.jit(wobble * 2)));
    const xs = shape.map((p) => p.x), ys = shape.map((p) => p.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    let dots = '';
    const want = Math.round((((x1 - x0) * (y1 - y0)) / 60) * grain);
    for (let i = 0; i < want; i++) {
      const a = r() * TAU, k = Math.sqrt(r()) * 0.85;
      dots += `<circle cx="${n1(cx + Math.cos(a) * (x1 - x0) * 0.5 * k)}" cy="${n1(cy + Math.sin(a) * (y1 - y0) * 0.5 * k)}" r="${n1(r.range(0.3, 0.75))}"/>`;
    }
    this.washes.push(
      `<g class="wash ${cls}" style="--w:${this.washes.length}">` +
        `<path d="${smooth(shape, true)}" fill="#${color}" fill-opacity="${n1(alpha * 0.62 * 100) / 100}" stroke="#${darken(color, 0.3)}" stroke-opacity="${n1(alpha * 0.6 * 100) / 100}" stroke-width=".8" filter="url(#fn-edge)"/>` +
        `<path d="${smooth(wetPts, true)}" fill="#${color}" fill-opacity="${n1(alpha * 0.5 * wet * 100) / 100}" filter="url(#fn-wet)"/>` +
        (dots ? `<g fill="#${darken(color, 0.4)}" fill-opacity="${n1(alpha * 0.55 * 100) / 100}">${dots}</g>` : '') +
        `</g>`
    );
    return this;
  }
  // tiny solid dots of colour (berries, eyes, pollen)
  dot(x, y, rad, color, { cls = '', alpha = 1 } = {}) {
    this.top.push(`<circle class="dab ${cls}" cx="${n1(x)}" cy="${n1(y)}" r="${rad}" fill="#${color}" fill-opacity="${alpha}" style="--i:${this.i}"/>`);
    return this;
  }
  raw(svg, where = 'top') {
    (where === 'top' ? this.top : where === 'under' ? this.washes : this.inks).push(svg);
    return this;
  }
  svg(vb, cls) {
    return `<svg class="sk ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false" style="--n:${this.i}">${this.washes.join('')}<g class="pen">${this.inks.join('')}</g>${this.top.join('')}</svg>`;
  }
}

// ------------------------------------------------------------ the sketches

export function teacup(season, time) {
  const s = new Sheet(41);
  // saucer
  s.wash(blob(70, 94, 48, 9, s.r, { n: 12, wobble: 0.05 }), 'C8B79C', { alpha: 0.45, grain: 0.3 });
  // cup body and tea
  const body = [P(38, 56), P(42, 72), P(51, 86), P(70, 90), P(89, 86), P(98, 72), P(102, 56)];
  s.wash([...body, P(86, 60), P(54, 60)], '86A9C6', { alpha: 0.42, grain: 0.4 });
  s.wash(blob(70, 57, 27, 4.4, s.r, { n: 10, wobble: 0.06 }), '9B6A3A', { alpha: 0.75, grain: 0.2, wet: 1.2 });
  s.wash([P(44, 70), P(96, 70), P(93, 76), P(47, 76)], '3E6A9A', { alpha: 0.35, grain: 0 });
  // ink
  const sau = []; for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU + 0.3; sau.push(P(70 + Math.cos(a) * 48, 94 + Math.sin(a) * 9)); }
  s.ink(sau, { w: 1.3 });
  s.ink([P(36, 95), P(52, 99), P(88, 99), P(104, 95)], { w: 0.9, amt: 0.3 });
  const rim = []; for (let i = 0; i <= 18; i++) { const a = (i / 18) * TAU; rim.push(P(70 + Math.cos(a) * 32, 56 + Math.sin(a) * 6)); }
  s.ink(rim, { w: 1.4 });
  s.ink(body, { w: 1.5 });
  s.ink([P(101, 62), P(112, 60), P(116, 68), P(110, 78), P(97, 79)], { w: 1.4 });
  s.ink([P(46, 72), P(70, 74.5), P(94, 72)], { w: 0.8, amt: 0.3 });
  s.ink([P(48, 77), P(70, 79.5), P(92, 77)], { w: 0.8, amt: 0.3 });
  // steam: livelier in the cold months and in the evening
  const curls = season === 3 || time >= 3 ? 3 : 2;
  s.part('steam', (k) => {
    for (let c = 0; c < curls; c++) {
      const x0 = 58 + c * 11, pts = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(P(x0 + Math.sin(t * 5 + c) * (2.5 + t * 3), 48 - t * 30)); }
      k.ink(pts, { w: 0.9, amt: 0.2, color: '#7b7067' });
    }
  });
  return s.svg('0 0 140 110', 'teacup');
}

export function acorn(season) {
  const s = new Sheet(57);
  // oak leaf: lobes along a midrib
  const rib = (t) => P(18 + t * 74, 104 - t * 74);
  const side = (sgn) => {
    const out = [];
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      const w = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.8) * 17 * (0.7 + 0.45 * Math.abs(Math.sin(t * Math.PI * 4.5)));
      const p = rib(t);
      out.push(P(p.x + sgn * w * 0.7071, p.y + sgn * w * 0.7071));
    }
    return out;
  };
  const left = side(-1), right = side(1);
  const leafCol = ['93B860', '6E9F4E', 'C98A3A', 'A2875A'][season];
  s.wash([...left, ...right.reverse()], leafCol, { alpha: 0.55, grain: 0.5 });
  if (season === 2) s.wash(blob(66, 52, 14, 9, s.r, { rot: -0.8 }), 'C8643B', { alpha: 0.3, grain: 0 });
  s.ink([...side(-1)], { w: 1.2 }).ink([...side(1)], { w: 1.2 });
  s.ink([rib(-0.08), rib(0.5), rib(1)], { w: 1.1, amt: 0.3 });
  for (const t of [0.25, 0.42, 0.6, 0.77]) {
    const p = rib(t);
    s.ink([p, P(p.x - 6, p.y - 12)], { w: 0.7, amt: 0.3 }).ink([p, P(p.x + 12, p.y + 5)], { w: 0.7, amt: 0.3 });
  }
  // the acorn, cupped, a little apart
  s.part('acorn', (k) => {
    k.wash(blob(108, 74, 9, 12, k.r, { n: 9, wobble: 0.05 }), 'B9A04F', { alpha: 0.6, grain: 0.3 });
    k.wash(blob(108, 63, 12, 6.5, k.r, { n: 9, wobble: 0.07 }), '8C6A44', { alpha: 0.7, grain: 0.6 });
    k.ink(blob(108, 74, 9, 12, rng(9), { n: 10, wobble: 0.03 }), { w: 1.2, closed: true, amt: 0.2 });
    k.ink([P(96, 64), P(99, 58), P(108, 56), P(117, 58), P(120, 64), P(108, 68), P(96, 64)], { w: 1.3, amt: 0.3 });
    for (let i = 0; i < 4; i++) k.ink([P(99 + i * 5, 59), P(102 + i * 5, 66)], { w: 0.6, amt: 0.2 });
    k.ink([P(108, 56), P(109, 50), P(112, 47)], { w: 1.1, amt: 0.2 });
    k.dot(105, 80, 0.9, 'fff6dc', { alpha: 0.9 });
  });
  return s.svg('0 0 130 120', 'acorn');
}

export function snail(season) {
  const s = new Sheet(73);
  const asleep = season === 3;
  // shell spiral
  const spiral = [];
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * 2.4 * TAU;
    const rad = 25 * (1 - (i / 40) * 0.88);
    spiral.push(P(70 + Math.cos(-th + 0.6) * rad, 54 + Math.sin(-th + 0.6) * rad * 0.94));
  }
  if (!asleep) {
    const foot = [P(24, 82), P(40, 78), P(66, 80), P(92, 79), P(106, 74), P(114, 64), P(121, 59), P(128, 64), P(125, 75), P(112, 83), P(70, 86), P(32, 86)];
    s.wash([P(0, 84), P(26, 82), P(26, 87), P(0, 87)], '9FB3C2', { alpha: 0.28, grain: 0 });
    s.wash(foot, 'A69C86', { alpha: 0.5, grain: 0.4 });
    s.ink(foot, { w: 1.3, closed: true });
  } else {
    s.ink([P(28, 82), P(70, 81), P(118, 82)], { w: 0.9, amt: 0.4 });
  }
  s.wash(blob(70, 54, 26, 25, s.r, { n: 11, wobble: 0.04 }), 'C9A46A', { alpha: 0.6, grain: 0.6 });
  s.wash(spiral.slice(8, 30).map((p) => P(p.x, p.y)).concat(spiral.slice(10, 30).reverse().map((p) => P(70 + (p.x - 70) * 0.8, 54 + (p.y - 54) * 0.8))), 'B5532E', { alpha: 0.35, grain: 0 });
  s.ink(spiral, { w: 1.5, amt: 0.35 });
  s.ink([spiral[0], P(48, 70), P(58, 78), P(80, 79), P(93, 68)], { w: 1.2, amt: 0.3 });
  if (asleep) {
    // sealed in for winter: a little white door over the mouth, and a snow cap
    s.wash(blob(90, 72, 6, 4, s.r, { n: 8 }), 'E9EEF2', { alpha: 0.8, grain: 0 });
    s.ink(blob(90, 72, 6, 4, rng(3), { n: 9, wobble: 0.04 }), { w: 0.8, closed: true, amt: 0.2 });
    s.raw(`<path class="snowcap" d="${smooth([P(52, 33), P(62, 28), P(76, 28), P(88, 34), P(76, 33), P(62, 33)], true)}" fill="#fff" stroke="#8796ae" stroke-opacity=".6" stroke-width=".7"/>`);
  } else {
    s.part('stalks', (k) => {
      k.ink([P(119, 60), P(117, 50), P(114, 42)], { w: 1.1, amt: 0.2 });
      k.ink([P(123, 60), P(125, 50), P(127, 44)], { w: 1.1, amt: 0.2 });
      k.raw(`<g class="eyes"><circle cx="114" cy="41.5" r="1.6"/><circle cx="127" cy="43.5" r="1.6"/></g>`, 'ink');
    });
  }
  return s.svg('0 0 140 100', `snail${asleep ? ' asleep' : ''}`);
}

export function feather() {
  const s = new Sheet(91);
  const a = P(22, 106), b = P(116, 14);
  const at = (t) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * 6);
  const nx = 0.7, ny = 0.7; // normal to the shaft, roughly
  const vane = (sgn, w0) => {
    const out = [];
    for (let i = 0; i <= 18; i++) {
      const t = 0.18 + (i / 18) * 0.82;
      let w = Math.sin(Math.PI * Math.min(1, (t - 0.12) * 1.15)) * w0;
      if (sgn > 0 && i === 9) w *= 0.55; // a split in the vane
      if (sgn < 0 && i === 13) w *= 0.6;
      const p = at(t);
      out.push(P(p.x + sgn * nx * w, p.y + sgn * ny * w));
    }
    return out;
  };
  const L = vane(-1, 14), R = vane(1, 11);
  s.wash([at(0.18), ...L, ...R.reverse()], '8FA2B8', { alpha: 0.5, grain: 0.4 });
  for (let k = 0; k < 4; k++) {
    const t = 0.55 + k * 0.1, p = at(t), q = at(t + 0.035);
    const wl = Math.sin(Math.PI * Math.min(1, (t - 0.12) * 1.15)) * 12, wr = wl * 0.75;
    s.wash([P(p.x - 0.7 * wl, p.y - 0.7 * wl), P(p.x + 0.7 * wr, p.y + 0.7 * wr), P(q.x + 0.7 * wr, q.y + 0.7 * wr), P(q.x - 0.7 * wl, q.y - 0.7 * wl)], k % 2 ? '2F4E78' : '6F9BD0', { alpha: 0.5, grain: 0, wobble: 0.3, wet: 0.4 });
  }
  s.part('quill', (k) => {
    k.ink([a, at(0.5), b], { w: 1.4, amt: 0.3 });
    k.ink([at(0.18), ...vane(-1, 14)], { w: 1.1, amt: 0.35 });
    k.ink([at(0.18), ...vane(1, 11)], { w: 1.1, amt: 0.35 });
    for (const t of [0.3, 0.42, 0.6, 0.72]) { const p = at(t); k.ink([p, P(p.x - 9, p.y - 3)], { w: 0.6, amt: 0.2 }); }
  });
  return s.svg('0 0 130 120', 'feather');
}

// a sprig from the hedge by the gate: whatever it is wearing this season
export function sprig(season) {
  const s = new Sheet(113 + season);
  const stem = [P(30, 110), P(44, 88), P(60, 66), P(80, 46), P(104, 26)];
  const twigA = [P(52, 76), P(40, 62), P(34, 46)];
  const twigB = [P(70, 56), P(88, 60), P(104, 56)];
  const stemCol = season === 0 ? '#3b2f2a' : undefined;
  const leaf = (x, y, rot, len, col, { lobed = false, spiky = false } = {}) => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      let w = Math.sin(Math.PI * t) * len * 0.34;
      if (spiky) w *= 1 + 0.35 * (i % 3 === 0 ? 1 : -0.2);
      if (lobed) w *= 0.8 + 0.3 * Math.abs(Math.sin(t * Math.PI * 3));
      pts.push(P(t * len, -w));
    }
    for (let i = 11; i > 0; i--) {
      const t = i / 12;
      let w = Math.sin(Math.PI * t) * len * 0.34;
      if (spiky) w *= 1 + 0.35 * (i % 3 === 1 ? 1 : -0.2);
      if (lobed) w *= 0.8 + 0.3 * Math.abs(Math.sin(t * Math.PI * 3 + 0.5));
      pts.push(P(t * len, w));
    }
    const rp = pts.map((p) => P(x + p.x * Math.cos(rot) - p.y * Math.sin(rot), y + p.x * Math.sin(rot) + p.y * Math.cos(rot)));
    s.wash(rp, col, { alpha: 0.6, grain: 0.3, wobble: 0.6 });
    s.ink(rp, { w: 1, closed: true, amt: 0.25 });
    s.ink([P(x, y), P(x + Math.cos(rot) * len * 0.85, y + Math.sin(rot) * len * 0.85)], { w: 0.6, amt: 0.2 });
  };
  const flower = (x, y, rad, col, petals = 5, cls = '') => {
    const ring = [];
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * TAU + 0.3;
      const pc = P(x + Math.cos(a) * rad * 0.62, y + Math.sin(a) * rad * 0.62);
      const pts = blob(pc.x, pc.y, rad * 0.5, rad * 0.42, s.r, { n: 7, wobble: 0.1, rot: a });
      s.wash(pts, col, { alpha: 0.75, grain: 0, wobble: 0.3, cls });
      ring.push(pts);
    }
    ring.forEach((pts) => s.ink(pts, { w: 0.7, closed: true, amt: 0.15, color: '#6b5c55' }));
    s.dot(x, y, Math.max(1, rad * 0.22), 'E9B93A');
  };
  s.ink(stem, { w: 1.6, color: stemCol }).ink(twigA, { w: 1.1, color: stemCol }).ink(twigB, { w: 1.1, color: stemCol });
  if (season === 0) {
    // blackthorn: white blossom on dark bare twigs
    [[34, 46, 6], [46, 66, 5], [62, 64, 6], [80, 46, 5.5], [92, 58, 5], [104, 27, 6], [96, 34, 4.5]].forEach(([x, y, r]) => flower(x, y, r, 'F4F1EA'));
    s.raw('<g class="drop" fill="#f4eef0" stroke="#9a8a90" stroke-width=".5"><ellipse cx="80" cy="46" rx="2.6" ry="1.8"/></g>');
  } else if (season === 1) {
    // dog rose: one open flower, buds and leaves
    leaf(56, 70, -2.4, 18, '6E9F4E'); leaf(76, 52, 0.4, 16, '6E9F4E'); leaf(44, 86, 2.6, 14, '7FAF5A'); leaf(92, 58, -0.6, 14, '7FAF5A');
    flower(102, 28, 13, 'EBA2B6', 5);
    s.wash(blob(36, 46, 3.5, 5, s.r, { n: 7 }), 'D9738A', { alpha: 0.7, grain: 0 });
    s.ink(blob(36, 46, 3.5, 5, rng(5), { n: 8, wobble: 0.04 }), { w: 0.8, closed: true, amt: 0.15 });
    s.raw('<g class="drop" fill="#eba2b6" stroke="#9a5a6a" stroke-width=".5"><ellipse cx="102" cy="28" rx="4" ry="2.6"/></g>');
  } else if (season === 2) {
    // hawthorn: haws in clusters, a few turning leaves
    leaf(60, 64, -2.2, 16, 'C98A3A', { lobed: true }); leaf(86, 58, 0.2, 15, 'D9A93F', { lobed: true }); leaf(46, 86, 2.5, 13, 'B5532E', { lobed: true });
    [[34, 46], [37, 50], [31, 50], [104, 56], [100, 60], [106, 61], [104, 26], [100, 30], [108, 30], [96, 26]].forEach(([x, y]) => {
      s.dot(x, y, 2.6, 'A8322A', { alpha: 0.9 });
      s.dot(x - 0.8, y - 0.9, 0.7, 'ffe9e0', { alpha: 0.85 });
    });
    s.raw('<g class="drop" fill="#a8322a"><circle cx="100" cy="60" r="2.6"/></g>');
  } else {
    // holly: spiky dark leaves, red berries, a little snow
    leaf(56, 70, -2.3, 20, '3F6B44', { spiky: true }); leaf(78, 50, 0.3, 20, '3F6B44', { spiky: true }); leaf(46, 86, 2.5, 16, '4E7A50', { spiky: true }); leaf(98, 32, -0.9, 16, '4E7A50', { spiky: true });
    [[68, 58], [72, 62], [64, 62], [36, 48]].forEach(([x, y]) => { s.dot(x, y, 2.7, 'C0352B'); s.dot(x - 0.8, y - 0.9, 0.7, 'fff1ea', { alpha: 0.9 }); });
    s.raw(`<path class="snowcap" d="${smooth([P(70, 47), P(80, 42), P(92, 44), P(84, 47)], true)}" fill="#fff" stroke="#8796ae" stroke-opacity=".6" stroke-width=".6"/>`);
    s.raw('<g class="drop" fill="#fff" stroke="#8796ae" stroke-width=".5"><circle cx="82" cy="44" r="2.4"/></g>');
  }
  return s.svg('0 0 130 120', 'sprig');
}

// a lantern; lit, with a moth, in the evening
export function lantern(season, time) {
  const s = new Sheet(131);
  const lit = time >= 3;
  if (lit) s.raw('<circle class="halo" cx="60" cy="74" r="44" fill="url(#fn-glow)"/>', 'under');
  s.wash([P(44, 56), P(76, 56), P(78, 98), P(42, 98)], lit ? 'F4C84A' : 'C9D3D8', { alpha: lit ? 0.6 : 0.35, grain: 0.3 });
  s.wash([P(38, 50), P(60, 40), P(82, 50)], '6C5A48', { alpha: 0.6, grain: 0.2 });
  s.wash([P(38, 98), P(82, 98), P(80, 106), P(40, 106)], '6C5A48', { alpha: 0.6, grain: 0.2 });
  if (lit) s.wash(blob(60, 82, 3.5, 7, s.r, { n: 8, wobble: 0.08 }), 'E8823A', { alpha: 0.9, grain: 0, wobble: 0.4 });
  s.ink([P(52, 40), P(52, 30), P(60, 24), P(68, 30), P(68, 40)], { w: 1.2 });
  s.ink([P(36, 51), P(60, 39), P(84, 51), P(36, 51)], { w: 1.4, amt: 0.3 });
  s.ink([P(42, 52), P(43, 98)], { w: 1.3, amt: 0.3 }).ink([P(78, 52), P(77, 98)], { w: 1.3, amt: 0.3 });
  s.ink([P(60, 52), P(60, 98)], { w: 0.7, amt: 0.3 });
  s.ink([P(38, 98), P(82, 98), P(80, 106), P(40, 106), P(38, 98)], { w: 1.3, amt: 0.3 });
  s.ink([P(56, 98), P(57, 88), P(60, 76), P(63, 88), P(64, 98)], { w: 0.8, amt: 0.2 });
  if (lit) {
    s.raw(
      `<g class="moth-orbit"><g class="moth-at"><g class="moth"><path d="M0 0 C-5 -6 -11 -4 -9 2 C-7 5 -3 3 0 0 C3 3 7 5 9 2 C11 -4 5 -6 0 0Z" fill="#cdbb9c" fill-opacity=".9" stroke="#2b2420" stroke-width=".7"/><path d="M0 -2 L0 3" stroke="#2b2420" stroke-width="1.1"/><path d="M-1 -2 L-3 -6 M1 -2 L3 -6" stroke="#2b2420" stroke-width=".5"/></g></g></g>`
    );
  }
  return s.svg('0 0 120 116', `lantern${lit ? ' lit' : ''}`);
}

// a short hand-drawn rule, for under headings and the masthead
export function rule(seed, width = 200, { amp = 1.2, w = 1.1 } = {}) {
  const r = rng(seed);
  const pts = [];
  const n = Math.max(4, Math.round(width / 28));
  for (let i = 0; i <= n; i++) pts.push(P((i / n) * (width - 6) + 3, 4 + r.jit(amp)));
  const d = smooth(pts);
  return `<svg class="rule" viewBox="0 0 ${width} 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="ink" d="${d}" pathLength="1" stroke-width="${w}" vector-effect="non-scaling-stroke"/></svg>`;
}

// visits, tallied in fives like a bird count
export function tally(count) {
  const r = rng(count * 7 + 3);
  let x = 2, out = '';
  for (let i = 0; i < count; i++) {
    if (i % 5 === 4) {
      out += `<path d="M${n1(x - 20 + r.jit(1))} ${n1(13 + r.jit(1))} L${n1(x + 1 + r.jit(1))} ${n1(3 + r.jit(1))}"/>`;
      x += 8;
    } else {
      out += `<path d="M${n1(x + r.jit(0.6))} ${n1(2 + r.jit(0.8))} L${n1(x + r.jit(0.8))} ${n1(14 + r.jit(0.8))}"/>`;
      x += 4.6;
    }
  }
  return `<svg class="tally-marks" viewBox="0 0 ${n1(x + 2)} 16" width="${n1(x + 2)}" height="16" aria-hidden="true" focusable="false">${out}</svg>`;
}
