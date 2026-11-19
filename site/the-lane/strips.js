// The lane between the sections, painted as inline SVG with the same seeded
// "hand" as the Rive scenes: jittered pen lines that ink themselves in
// (stroke-dashoffset on pathLength=1) and watercolor washes that soak in after.
// Static once painted. The season (0-3) and the hour (0-4) pick what is there:
// blossom or hips or snow, lamps and windows lit, how long the shadows are.
// Also here: the painted boards (headings, fingerpost arms) as SVG data URIs.

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
function smooth(pts, closed = false) {
  const n = pts.length;
  if (n < 2) return '';
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${n1(pts[0].x)} ${n1(pts[0].y)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${n1(p1.x + (p2.x - p0.x) / 6)} ${n1(p1.y + (p2.y - p0.y) / 6)} ${n1(p2.x - (p3.x - p1.x) / 6)} ${n1(p2.y - (p3.y - p1.y) / 6)} ${n1(p2.x)} ${n1(p2.y)}`;
  }
  return closed ? d + 'Z' : d;
}
const poly = (pts) => 'M' + pts.map((p) => `${n1(p.x)} ${n1(p.y)}`).join('L') + 'Z';

function circ(cx, cy, rx, ry = rx, n = 12) {
  return Array.from({ length: n }, (_, i) => P(cx + Math.cos((i / n) * TAU) * rx, cy + Math.sin((i / n) * TAU) * ry));
}

const darken = (hex, f) =>
  [0, 2, 4].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, '0')).join('');

// per season: spring, summer, autumn, winter
const HEDGE = ['8DBA5E', '5F9447', '8E9A48', '8D9C88'];
const GRASS = ['9CC26A', '86B35B', 'B8A455', 'C3CAC2'];
const LANE = ['EAD9AE', 'EBD6A4', 'E2CB9E', 'E2E2DE'];
const CANOPY = ['A2CB6A', '5E9A4A', 'D38B3B', '8F8A7A'];
const WATER = ['86B8DA', '6FA8D6', '8AA8C0', 'C9D6E2'];

/** One strip of lane: washes (soak in), ink (draws on), lights and snow on top. */
class Sheet {
  constructor(seed, when) {
    this.r = rng(seed);
    this.when = when;
    this.washes = [];
    this.inks = [];
    this.top = [];
    this.i = 0;
  }
  ink(pts, { w = 1.4, closed = false, amt = 0.5, color, tension } = {}) {
    const j = pts.map((p) => P(p.x + this.r.jit(amt), p.y + this.r.jit(amt)));
    const d = tension === 0 ? 'M' + j.map((p) => `${n1(p.x)} ${n1(p.y)}`).join('L') + (closed ? 'Z' : '') : smooth(j, closed);
    const st = `--i:${this.i++}${color ? `;stroke:${color}` : ''}`;
    this.inks.push(`<path class="i" d="${d}" pathLength="1" stroke-width="${w}" style="${st}"/>`);
    return this;
  }
  wash(pts, color, { a = 0.5, wob = 1.6, straight = false, rim = true } = {}) {
    const j = pts.map((p) => P(p.x + 1.5 + this.r.jit(wob), p.y + 1.2 + this.r.jit(wob)));
    const d = straight ? poly(j) : smooth(j, true);
    this.washes.push(`<path d="${d}" fill="#${color}" fill-opacity="${a}"${rim ? ` stroke="#${darken(color, 0.3)}" stroke-opacity="${n1(a * 0.6)}" stroke-width="1.1"` : ''}/>`);
    return this;
  }
  dots(list, color, a = 0.95) {
    this.washes.push(`<g fill="#${color}" fill-opacity="${a}">${list.map((d) => `<circle cx="${n1(d.x)}" cy="${n1(d.y)}" r="${n1(d.r)}"/>`).join('')}</g>`);
    return this;
  }
  // a separate moving part: its ink and paint live in one group with a class
  part(cls, fn, attrs = '') {
    const [w, k] = [this.washes, this.inks];
    this.washes = [];
    this.inks = [];
    fn(this);
    const xml = `<g class="${cls}"${attrs}><g class="ws" filter="url(#lane-wc)">${this.washes.join('')}</g><g class="is">${this.inks.join('')}</g></g>`;
    this.washes = w;
    this.inks = k;
    this.inks.push(xml);
    return this;
  }
  glow(x, y, rx, ry = rx, a = 0.7) {
    this.top.push(`<ellipse class="glow" cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#lane-glow)" opacity="${a}"/>`);
    return this;
  }
  // snow: a white gouache cap riding a line, over a blue-grey shadow
  snow(pts, th = 4) {
    if (this.when.season !== 3) return this;
    const top = pts.map((p) => P(p.x + this.r.jit(0.6), p.y - 1 + this.r.jit(0.6)));
    const bot = pts.slice().reverse().map((p, i) => P(p.x, p.y + th * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7)))));
    const d = smooth([...top, ...bot], true);
    this.top.push(`<path d="${d}" fill="#9AAFC6" fill-opacity=".5" transform="translate(.5 1.6)"/><path d="${d}" fill="#FFFDF8" fill-opacity=".95"/>`);
    return this;
  }
  // a shadow cast from (x, y), long in the morning and late afternoon
  shadow(x, y, len, th = 4) {
    const t = this.when.time;
    const k = [-1.8, 0.5, 2.4, 3.2, 0][t], a = [0.7, 0.9, 0.85, 0.4, 0][t];
    if (!a) return this;
    const L = len * k;
    const pts = [P(x, y - th * 0.4), P(x + L * 0.5, y - th * 0.5), P(x + L, y), P(x + L * 0.5, y + th * 0.5), P(x, y + th * 0.4)];
    this.washes.push(`<path d="${smooth(pts, true)}" fill="#6D6890" fill-opacity="${(0.22 * a).toFixed(2)}"/>`);
    return this;
  }
  svg(name) {
    return `<svg class="lane-art ${name}" style="--n:${this.i}" viewBox="0 0 640 130" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
<g class="soak" filter="url(#lane-wc)">${this.washes.join('')}</g>
<g class="pen">${this.inks.join('')}</g>
<g class="over">${this.top.join('')}</g></svg>`;
  }
}

const lit = (w) => w.time >= 3;

// the lane itself runs along the bottom of every strip, with a grassy verge
function laneBand(s, { from = 0, to = 640, gap } = {}) {
  const { season } = s.when;
  const r = s.r;
  const top = [];
  for (let x = from; x <= to; x += 40) top.push(P(x, 109 + Math.sin(x * 0.021 + r()) * 2));
  s.wash([...top, P(to, 130), P(from, 130)], LANE[season], { a: 0.7, rim: false });
  s.wash([P(from, 104), ...top.slice(1, -1).map((p) => P(p.x, p.y - 8)), P(to, 104), ...top.slice().reverse()], GRASS[season], { a: 0.3, rim: false });
  // the near edge, broken where something stands on it
  const pieces = gap ? [top.filter((p) => p.x <= gap[0]), top.filter((p) => p.x >= gap[1])] : [top];
  for (const pc of pieces) if (pc.length > 1) s.ink(pc, { w: 1.5, amt: 0.6 });
  for (let x = from + 30; x < to - 30; x += r.range(60, 110)) {
    const y = 118 + r.jit(4);
    s.ink([P(x, y), P(x + 16, y + r.jit(1)), P(x + 30, y + r.jit(1.4))], { w: 0.9, amt: 0.3, color: '#5E554C' });
  }
  for (let x = from + 14; x < to - 10; x += r.range(40, 90)) {
    if (gap && x > gap[0] - 8 && x < gap[1] + 8) continue;
    const y = 109 + Math.sin(x * 0.021) * 2;
    s.ink([P(x, y), P(x - 3, y - 6)], { w: 1, amt: 0.2 }).ink([P(x + 3, y), P(x + 4, y - 8)], { w: 1, amt: 0.2 });
  }
  s.snow(top, 4);
}

function hedge(s, x0, x1, { y = 70, seed = 1 } = {}) {
  const r = rng(seed);
  const top = [];
  for (let x = x0; x <= x1; x += 8) {
    const edge = Math.min(1, (x - x0) / 30, (x1 - x) / 30);
    top.push(P(x, 108 - (108 - y) * Math.pow(Math.max(0, edge), 0.6) - Math.abs(Math.sin(x * 0.23)) * 6 * edge + r.jit(1)));
  }
  s.wash([...top, P(x1, 110), P(x0, 110)], HEDGE[s.when.season], { a: 0.55 });
  s.ink(top, { w: 1.5, amt: 0.6 });
  for (let i = 0; i < (x1 - x0) / 22; i++) {
    const x = r.range(x0 + 10, x1 - 10), yy = r.range(y + 12, 100);
    s.ink([P(x, yy), P(x + 4, yy - 3), P(x + 8, yy)], { w: 0.9, amt: 0.3, color: '#5E554C' });
  }
  // what the hedge is wearing this season
  const season = s.when.season;
  if (season < 3) {
    const cols = [['F4EFE6', 'F4EFE6', 'EBA2B8'], ['E79CB2', 'F2D6DE', 'E79CB2'], ['C4503B', '5A3A5A', 'C4503B']][season];
    const list = [];
    for (let i = 0; i < (x1 - x0) / 9; i++) {
      const x = r.range(x0 + 8, x1 - 8);
      const ty = top[Math.round((x - x0) / 8)]?.y ?? y;
      list.push({ x, y: r.range(ty + 4, 102), r: r.range(1.3, 2.2), c: cols[i % 3] });
    }
    for (const c of new Set(list.map((d) => d.c))) s.dots(list.filter((d) => d.c === c), c);
  }
  s.snow(top, 5);
  return top;
}

// ---------- the five stretches of lane ----------

const PAINT = {
  // a stile through the hedge, and a robin who sits on it
  stile(s) {
    const w = s.when;
    hedge(s, 250, 432, { y: 66, seed: 11 });
    hedge(s, 470, 640, { y: 62, seed: 12 });
    s.wash([P(438, 66), P(444, 66), P(444, 110), P(438, 110)], 'B89470', { a: 0.85, straight: true, rim: false });
    s.wash([P(462, 64), P(468, 64), P(468, 110), P(462, 110)], 'B89470', { a: 0.85, straight: true, rim: false });
    s.ink([P(441, 110), P(441, 64)], { w: 1.6 }).ink([P(465, 110), P(465, 62)], { w: 1.6 });
    s.ink([P(428, 70), P(476, 68)], { w: 1.5 }).ink([P(426, 88), P(478, 87)], { w: 1.4 }).ink([P(430, 99), P(474, 99)], { w: 1.3 });
    s.shadow(452, 110, 18);
    if (w.time < 4) {
      s.part('robin', (b) => {
        b.wash(circ(452, 61, 6.5, 5, 10), 'A27A4F', { a: 0.75, wob: 0.4 });
        b.wash(circ(457, 61, 3.2, 3.4, 8), 'D9733A', { a: 0.9, wob: 0.3, rim: false });
        b.ink(circ(452, 61, 6.5, 5, 10), { w: 1.1, closed: true, amt: 0.2 });
        b.ink(circ(457, 55, 3.4, 3.2, 8), { w: 1.1, closed: true, amt: 0.15 });
        b.ink([P(460.4, 54.6), P(463.5, 55.4)], { w: 1.1, amt: 0.1 });
        b.ink([P(446, 60), P(441, 56)], { w: 1.2, amt: 0.1 });
        b.ink([P(451, 66), P(451, 69)], { w: 0.9, amt: 0.1 }).ink([P(454, 66), P(454, 69)], { w: 0.9, amt: 0.1 });
      });
      s.washes.push(`<circle cx="458.2" cy="54.6" r=".9" fill="#2b231c"/>`);
    }
    laneBand(s, { gap: [436, 470] });
  },

  // a neighbour's round door in the bank, a lamp at the gatepost
  door(s) {
    const w = s.when;
    const bank = [P(300, 110), P(326, 82), P(370, 56), P(430, 40), P(500, 36), P(560, 42), P(610, 56), P(640, 64)];
    s.wash([...bank, P(640, 110)], HEDGE[w.season], { a: 0.42 });
    s.ink(bank, { w: 1.5, amt: 0.7 });
    // chimney pipe, smoking
    s.wash([P(566, 40), P(566, 26), P(574, 26), P(574, 41)], 'B5644A', { a: 0.6, straight: true, wob: 0.4 });
    s.ink([P(566, 41), P(566, 26), P(574, 26), P(574, 41)], { w: 1.2, amt: 0.2, tension: 0 });
    s.part('smoke', (b) => b.ink([P(570, 22), P(574, 16), P(568, 10), P(573, 3)], { w: 1.1, amt: 0.3, color: '#6A625A' }));
    // the door
    s.wash(circ(470, 82, 27, 27, 16), 'B8A88A', { a: 0.5 });
    s.ink(circ(470, 82, 27, 27, 16), { w: 1.5, closed: true, amt: 0.4 });
    s.top.push(`<circle class="inside" cx="470" cy="82" r="21" fill="#E9A646"/>`);
    s.top.push('<g class="leaf">' + (() => {
      const leaf = new Sheet(41, w);
      leaf.wash(circ(470, 82, 21, 21, 14), 'C0603E', { a: 0.92, wob: 0.6 });
      leaf.ink(circ(470, 82, 21, 21, 14), { w: 1.4, closed: true, amt: 0.3 });
      leaf.ink([P(457, 66), P(457, 98)], { w: 0.8, amt: 0.3, color: '#5E554C' }).ink([P(483, 66), P(483, 98)], { w: 0.8, amt: 0.3, color: '#5E554C' });
      leaf.dots([{ x: 470, y: 82, r: 2.4 }], 'D2A23A', 1);
      return `<g filter="url(#lane-wc)">${leaf.washes.join('')}</g>${leaf.inks.join('')}`;
    })() + '</g>');
    s.wash([P(444, 104), P(496, 104), P(500, 110), P(440, 110)], 'B8A88A', { a: 0.6, straight: true, wob: 0.4 });
    s.ink([P(444, 104), P(496, 104)], { w: 1.2, amt: 0.3 });
    // round windows
    for (const [x, y, R] of [[408, 76, 9], [532, 70, 10]]) {
      s.wash(circ(x, y, R, R, 10), lit(w) ? 'F7CB5C' : '86B8DA', { a: lit(w) ? 0.9 : 0.45, wob: 0.4 });
      s.ink(circ(x, y, R, R, 10), { w: 1.3, closed: true, amt: 0.25 });
      s.ink([P(x, y - R), P(x, y + R)], { w: 0.8, amt: 0.15 }).ink([P(x - R, y), P(x + R, y)], { w: 0.8, amt: 0.15 });
      if (lit(w)) s.glow(x, y, R * 4, R * 3.4, 0.65);
    }
    // a pot of whatever is flowering
    s.wash([P(504, 96), P(518, 96), P(516, 108), P(506, 108)], 'C0603E', { a: 0.75, straight: true, wob: 0.4 });
    s.ink([P(504, 96), P(518, 96), P(516, 108), P(506, 108)], { w: 1.1, closed: true, amt: 0.2, tension: 0 });
    if (w.season < 3) s.dots([{ x: 507, y: 91, r: 2.4 }, { x: 512, y: 88, r: 2.6 }, { x: 516, y: 92, r: 2.2 }], ['E79CB2', 'E9B93A', 'D38B3B'][w.season]);
    else s.ink([P(511, 96), P(509, 88)], { w: 1, amt: 0.2 }).ink([P(512, 96), P(516, 89)], { w: 1, amt: 0.2 });
    lamp(s, 352, 110);
    s.shadow(352, 110, 16).shadow(511, 108, 8, 3);
    s.snow(bank.slice(1), 5).snow([P(564, 26), P(570, 25), P(576, 26)], 3);
    laneBand(s);
  },

  // the mill and its pond
  mill(s) {
    const w = s.when;
    // pond, reeds and (most of the year) a duck
    const pond = circ(354, 98, 74, 8, 14);
    s.wash(pond, WATER[w.season], { a: w.season === 3 ? 0.6 : 0.5 });
    s.ink(pond.slice(1, 7), { w: 1.2, amt: 0.4 });
    for (const x of [276, 282, 288, 424, 430]) s.ink([P(x, 100), P(x + s.r.jit(3), 80 + s.r.range(0, 8))], { w: 1, amt: 0.3 });
    if (w.season === 3) s.ink([P(310, 97), P(330, 96)], { w: 0.8, amt: 0.2, color: '#8EA3BC' }).ink([P(370, 99), P(398, 98)], { w: 0.8, amt: 0.2, color: '#8EA3BC' });
    else {
      s.part('duck', (b) => {
        b.wash([P(356, 94), P(372, 94), P(370, 99), P(358, 99)], 'F2EEE6', { a: 0.95, wob: 0.3 });
        b.ink([P(355, 93), P(360, 97), P(370, 98), P(373, 93), P(372, 89)], { w: 1.1, amt: 0.2 });
        b.ink(circ(372.5, 87.5, 2.8, 2.6, 8), { w: 1, closed: true, amt: 0.1 });
        b.ink([P(375, 87.6), P(378, 88.4)], { w: 1.4, amt: 0.1, color: '#D9A93F' });
        b.ink([P(358, 99.5), P(370, 99.5)], { w: 0.8, amt: 0.2, color: '#5E7FA0' });
      });
    }
    // the mill
    s.wash([P(448, 108), P(448, 58), P(562, 58), P(562, 108)], 'EADBB4', { a: 0.85, straight: true });
    s.wash([P(440, 60), P(505, 24), P(570, 60)], 'B5644A', { a: 0.6, straight: true });
    s.ink([P(448, 108), P(448, 60)], { w: 1.4 }).ink([P(562, 60), P(562, 108)], { w: 1.4 });
    s.ink([P(438, 61), P(505, 23), P(572, 61)], { w: 1.6, amt: 0.4 });
    s.ink([P(440, 60), P(570, 60)], { w: 1.1, amt: 0.4 });
    for (const [x, y] of [[456, 72], [470, 98], [540, 92], [552, 70], [500, 66]]) s.ink([P(x, y), P(x + 9, y + 0.5)], { w: 0.8, amt: 0.3, color: '#7A6E62' });
    s.wash([P(490, 108), P(490, 90), P(498, 84), P(506, 90), P(506, 108)], '8A4B32', { a: 0.7, wob: 0.5 });
    s.ink([P(490, 108), P(490, 90), P(498, 84), P(506, 90), P(506, 108)], { w: 1.2, amt: 0.2 });
    s.wash([P(526, 70), P(542, 70), P(542, 84), P(526, 84)], lit(w) ? 'F7CB5C' : '86B8DA', { a: lit(w) ? 0.9 : 0.45, straight: true, wob: 0.4 });
    s.ink([P(526, 70), P(542, 70), P(542, 84), P(526, 84)], { w: 1.1, closed: true, amt: 0.2, tension: 0 });
    if (lit(w)) s.glow(534, 77, 34, 28, 0.6);
    // the wheel (turns when you hover it)
    s.wash([P(560, 108), P(616, 106), P(626, 112), P(556, 112)], WATER[w.season], { a: 0.55, rim: false });
    s.part('wheel', (b) => {
      b.wash(circ(590, 82, 29, 29, 18), '8C7A64', { a: 0.25, rim: false });
      b.ink(circ(590, 82, 29, 29, 18), { w: 1.5, closed: true, amt: 0.4 });
      b.ink(circ(590, 82, 6, 6, 8), { w: 1.2, closed: true, amt: 0.2 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + 0.2;
        b.ink([P(590 + Math.cos(a) * 6, 82 + Math.sin(a) * 6), P(590 + Math.cos(a) * 28, 82 + Math.sin(a) * 28)], { w: 1, amt: 0.3 });
        b.ink([P(590 + Math.cos(a) * 28, 82 + Math.sin(a) * 28), P(590 + Math.cos(a + 0.12) * 34, 82 + Math.sin(a + 0.12) * 34)], { w: 1.6, amt: 0.2 });
      }
    }, ' style="transform-origin:590px 82px"');
    s.shadow(505, 108, 30, 5);
    s.snow([P(440, 60), P(505, 24), P(570, 60)], 4);
    laneBand(s);
  },

  // a humpbacked bridge over the stream, and the scarecrow in the field past it
  bridge(s) {
    const w = s.when;
    const r = s.r;
    // stream under the arch
    s.wash([P(352, 112), P(428, 112), P(436, 130), P(344, 130)], WATER[w.season], { a: 0.6, rim: false });
    // the bridge
    const top = [P(296, 110), P(330, 98), P(390, 86), P(450, 98), P(484, 110)];
    const arch = [P(352, 130), P(356, 116), P(372, 104), P(390, 101), P(408, 104), P(424, 116), P(428, 130)];
    s.wash([...top, P(484, 130), ...arch.slice().reverse(), P(296, 130)], 'B8A88A', { a: 0.55 });
    s.ink(top, { w: 1.6, amt: 0.5 }).ink(arch, { w: 1.4, amt: 0.4 });
    for (const [x, y] of [[320, 114], [338, 104], [446, 106], [462, 116], [370, 94], [412, 94], [328, 124], [452, 124]]) s.ink([P(x, y), P(x + 10, y + r.jit(0.6))], { w: 0.8, amt: 0.3, color: '#7A6E62' });
    s.snow(top, 4);
    // field and stubble
    const field = [P(496, 108), P(520, 100), P(640, 96), P(640, 110)];
    s.wash(field, ['A6C864', 'D9C060', 'C9A75A', 'D5DAD6'][w.season], { a: 0.4, rim: false });
    for (let x = 506; x < 636; x += r.range(9, 15)) s.ink([P(x, 106), P(x + r.jit(2), 100)], { w: 0.9, amt: 0.2, color: '#7A6E62' });
    // the scarecrow (sways when you hover it), in a scarf when it is cold
    s.part('scarecrow', (b) => {
      b.ink([P(575, 108), P(575, 48)], { w: 1.6, amt: 0.3 });
      b.ink([P(546, 62), P(604, 60)], { w: 1.5, amt: 0.4 });
      b.wash([P(562, 58), P(588, 58), P(592, 92), P(558, 92)], ['7E9A88', '8E86C9', 'A0708A', '6A7FA0'][w.season], { a: 0.7 });
      b.wash([P(568, 72), P(576, 72), P(576, 80), P(568, 80)], 'D9A93F', { a: 0.8, straight: true, wob: 0.3, rim: false });
      b.ink([P(562, 58), P(588, 58), P(592, 92), P(558, 92)], { w: 1.2, closed: true, amt: 0.4, tension: 0 });
      b.ink([P(558, 92), P(554, 98)], { w: 1, amt: 0.3 }).ink([P(592, 92), P(596, 99)], { w: 1, amt: 0.3 });
      b.wash(circ(575, 47, 8, 8, 10), 'EADBB4', { a: 0.9, wob: 0.4 });
      b.ink(circ(575, 47, 8, 8, 10), { w: 1.2, closed: true, amt: 0.2 });
      b.dots([{ x: 572, y: 46, r: 0.9 }, { x: 578, y: 46, r: 0.9 }], '2B231C', 1);
      b.wash([P(562, 40), P(588, 39), P(583, 37), P(582, 29), P(568, 29), P(567, 38)], 'C9A05A', { a: 0.85, straight: true, wob: 0.3 });
      b.ink([P(561, 40), P(589, 39)], { w: 1.3, amt: 0.2 }).ink([P(567, 39), P(568, 29), P(582, 29), P(583, 38)], { w: 1.2, amt: 0.2, tension: 0 });
      if (w.season === 3) {
        b.wash([P(566, 54), P(584, 54), P(584, 58), P(566, 58)], 'C8463B', { a: 0.9, straight: true, wob: 0.3 });
        b.wash([P(580, 56), P(586, 56), P(590, 72), P(584, 73)], 'C8463B', { a: 0.9, straight: true, wob: 0.3 });
        b.ink([P(580, 57), P(584, 72)], { w: 0.9, amt: 0.2 });
      }
      if (w.season === 2) {
        b.wash([P(598, 56), P(606, 52), P(612, 56), P(604, 60)], '2B231C', { a: 0.85, wob: 0.3, rim: false });
        b.ink([P(610, 54), P(614, 55)], { w: 1, amt: 0.1 });
      }
    }, ' style="transform-origin:575px 108px"');
    s.shadow(575, 104, 20, 4);
    laneBand(s, { gap: [300, 480] });
  },

  // a drystone wall with a cat on it, and a lamp where the roads part
  wall(s) {
    const w = s.when;
    const r = s.r;
    const top = [];
    for (let x = 300; x <= 520; x += 20) top.push(P(x, 84 + r.jit(1.6)));
    s.wash([...top, P(522, 110), P(298, 110)], 'B8A88A', { a: 0.5 });
    s.ink(top, { w: 1.5, amt: 0.4 }).ink([P(300, 84), P(298, 110)], { w: 1.3 }).ink([P(520, 84), P(522, 110)], { w: 1.3 });
    for (let row = 0; row < 3; row++) {
      for (let x = 304 + (row % 2) * 10; x < 512; x += r.range(18, 26)) {
        const y = 90 + row * 7;
        s.ink([P(x, y), P(x + r.range(8, 14), y + r.jit(1))], { w: 0.8, amt: 0.3, color: '#7A6E62' });
      }
    }
    s.snow(top, 4);
    // the cat (flicks its tail when you hover it); in at night
    if (w.time < 4) {
      s.part('cat', (b) => {
        const body = [P(462, 84), P(460, 74), P(463, 66), P(468, 62), P(474, 62), P(478, 66), P(480, 74), P(479, 84)];
        b.wash(body, 'D9893F', { a: 0.75, wob: 0.4 });
        b.wash(circ(470, 56, 6.5, 6, 10), 'D9893F', { a: 0.8, wob: 0.3 });
        b.ink(body, { w: 1.2, amt: 0.2 });
        b.ink([P(464, 54), P(465, 47), P(468.5, 51), P(471.5, 51), P(475, 47), P(476, 54)], { w: 1.1, amt: 0.15, tension: 0 });
        b.ink([P(463.6, 54), P(464.5, 60), P(470, 62.6), P(475.5, 60), P(476.4, 54)], { w: 1.1, amt: 0.15 });
        b.ink([P(467, 72), P(469, 74)], { w: 0.8, amt: 0.1, color: '#8A5A2A' }).ink([P(473, 70), P(475, 72)], { w: 0.8, amt: 0.1, color: '#8A5A2A' });
        b.part('tail', (t) => t.ink([P(478, 82), P(487, 84), P(492, 79), P(490, 71)], { w: 1.8, amt: 0.2, color: '#B8732F' }), ' style="transform-origin:478px 82px"');
      });
    }
    lamp(s, 566, 110);
    s.shadow(410, 110, 40, 5).shadow(566, 110, 16);
    laneBand(s);
  },
};

function lamp(s, x, y) {
  const w = s.when;
  s.wash([P(x - 1.5, y), P(x - 1.5, y - 50), P(x + 1.5, y - 50), P(x + 1.5, y)], '6A5A4A', { a: 0.7, straight: true, wob: 0.3, rim: false });
  s.ink([P(x, y), P(x, y - 52)], { w: 1.6, amt: 0.3 }).ink([P(x, y - 48), P(x + 12, y - 48), P(x + 12, y - 44)], { w: 1.3, amt: 0.2, tension: 0 });
  const bx = x + 12, by = y - 36;
  s.part('lantern', (b) => {
    b.wash([P(bx - 5, by - 7), P(bx + 5, by - 7), P(bx + 6, by + 7), P(bx - 6, by + 7)], lit(w) ? 'F7CB5C' : 'D9A93F', { a: lit(w) ? 0.95 : 0.45, straight: true, wob: 0.3 });
    b.ink([P(bx - 5, by - 7), P(bx + 5, by - 7), P(bx + 6, by + 7), P(bx - 6, by + 7)], { w: 1.2, closed: true, amt: 0.2, tension: 0 });
    b.ink([P(bx - 7, by - 6), P(bx, by - 11), P(bx + 7, by - 6)], { w: 1.2, amt: 0.2 });
  }, ` style="transform-origin:${bx}px ${by - 11}px"`);
  if (lit(w)) s.glow(bx, by, 46, 46, 0.85);
  s.snow([P(bx - 7, by - 7), P(bx, by - 11), P(bx + 7, by - 7)], 2);
}

export function strip(kind, when, seed) {
  const s = new Sheet(seed, when);
  PAINT[kind](s);
  return s.svg(kind);
}

// ---------- painted boards, as data URIs ----------

const uri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
const GRAIN = (seed) => `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9 0.08' numOctaves='2' seed='${seed % 97}'/><feColorMatrix values='0 0 0 0 .38 0 0 0 0 .3 0 0 0 0 .22 -2.6 0 0 0 1.3'/><feComposite in2='SourceGraphic' operator='in'/></filter>`;

/** A fingerpost arm, pointing 'r' or 'l'. Drawn in a 200×40 box, stretched to fit. */
export function arm({ dir = 'r', color = 'F2E6C8', seed = 1 }) {
  const r = rng(seed);
  const j = (x, y, a = 1) => `${n1(x + r.jit(a))} ${n1(y + r.jit(a))}`;
  const pts = dir === 'r'
    ? [j(3, 5), j(176, 4), j(197, 20, 0.4), j(176, 36), j(4, 35)]
    : [j(197, 5), j(24, 4), j(3, 20, 0.4), j(24, 36), j(196, 35)];
  const d = `M${pts.join('L')}Z`;
  const nail = dir === 'r' ? [10, 20] : [190, 20];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 40' preserveAspectRatio='none'><defs>${GRAIN(seed)}</defs>
<path d='${d}' fill='#${color}'/><path d='${d}' filter='url(#g)' opacity='.55'/>
<path d='M${j(8, 9, 0.6)}L${j(190, 9, 0.6)}' stroke='#5e554c' stroke-opacity='.35' stroke-width='.7' fill='none'/>
<path d='${d}' fill='none' stroke='#2b231c' stroke-width='1.6' stroke-linejoin='round' vector-effect='non-scaling-stroke'/>
<circle cx='${nail[0]}' cy='${nail[1]}' r='1.6' fill='#2b231c'/></svg>`;
  return uri(svg);
}

/** A heading board on two short stakes, in a 260×120 box. */
export function board({ color = 'F2E6C8', seed = 1 }) {
  const r = rng(seed);
  const j = (x, y, a = 1.4) => `${n1(x + r.jit(a))} ${n1(y + r.jit(a))}`;
  const d = `M${[j(4, 6), j(256, 3), j(254, 82), j(6, 85)].join('L')}Z`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 260 120' preserveAspectRatio='none'><defs>${GRAIN(seed)}</defs>
<path d='M${j(60, 84, 0.5)}L${j(60, 118, 0.5)}L${j(70, 118, 0.5)}L${j(70, 84, 0.5)}Z' fill='#B89470'/>
<path d='M${j(190, 84, 0.5)}L${j(190, 118, 0.5)}L${j(200, 118, 0.5)}L${j(200, 84, 0.5)}Z' fill='#B89470'/>
<path d='M60 86L60 118M70 86L70 118M190 86L190 118M200 86L200 118' stroke='#2b231c' stroke-width='1.6' fill='none' vector-effect='non-scaling-stroke'/>
<path d='${d}' fill='#${color}'/><path d='${d}' filter='url(#g)' opacity='.5'/>
<path d='M${j(10, 12, 0.8)}L${j(248, 10, 0.8)}' stroke='#5e554c' stroke-opacity='.35' stroke-width='.8' fill='none'/>
<path d='${d}' fill='none' stroke='#2b231c' stroke-width='1.8' stroke-linejoin='round' vector-effect='non-scaling-stroke'/>
<g fill='#2b231c'><circle cx='14' cy='14' r='1.7'/><circle cx='246' cy='12' r='1.7'/><circle cx='15' cy='76' r='1.7'/><circle cx='245' cy='74' r='1.7'/></g></svg>`;
  return uri(svg);
}

/** The fingerpost's post: a weathered upright with a cap, standing in a tuft. */
export function post(seed = 7) {
  const r = rng(seed);
  const j = (x, y, a = 0.8) => `${n1(x + r.jit(a))} ${n1(y + r.jit(a))}`;
  const body = `M${[j(6, 14), j(18, 14), j(18.5, 292), j(5.5, 292)].join('L')}Z`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 300' preserveAspectRatio='none'><defs>${GRAIN(seed)}</defs>
<path d='${body}' fill='#B89470'/><path d='${body}' filter='url(#g)' opacity='.6'/>
<path d='M${j(3, 14, 0.3)}L${j(21, 14, 0.3)}L${j(16, 5, 0.3)}L${j(8, 5, 0.3)}Z' fill='#8A6A4A' stroke='#2b231c' stroke-width='1.4' stroke-linejoin='round' vector-effect='non-scaling-stroke'/>
<path d='${body}' fill='none' stroke='#2b231c' stroke-width='1.8' vector-effect='non-scaling-stroke'/></svg>`;
  return uri(svg);
}
