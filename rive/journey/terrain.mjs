// Lays out the journey map from the stop list: where each stop sits, how the
// road winds between them, where the coast, rivers, lake, mountains, forests,
// hills, towns and marsh go, and where each red label fits. Pure geometry, no
// RML: gen.mjs turns the plan into ink. Everything comes from one seeded rng,
// so the same stops and seed always give the same map.
import { rng, P, TAU, resample, blobPts } from '../lib/ink.mjs';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const plen = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

// label metrics, in artboard units; the page sets the same font size
export const LABEL = { size: 25, charW: 11.4, lineH: 25, wrap: 14 };

function noise1(r, scale) {
  const v = Float32Array.from({ length: 256 }, () => r() * 2 - 1);
  return (x) => {
    const t = x / scale, i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
    return lerp(v[((i % 256) + 256) % 256], v[(((i + 1) % 256) + 256) % 256], u);
  };
}
function noise2(r, scale) {
  const n = 64;
  const v = Float32Array.from({ length: n * n }, () => r() * 2 - 1);
  const g = (i, j) => v[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
  return (x, y) => {
    const tx = x / scale, ty = y / scale, ix = Math.floor(tx), iy = Math.floor(ty);
    const fx = tx - ix, fy = ty - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return lerp(lerp(g(ix, iy), g(ix + 1, iy), ux), lerp(g(ix, iy + 1), g(ix + 1, iy + 1), ux), uy);
  };
}

function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

// where a vertical line at x crosses a closed polygon, as [y0, y1] spans
function scan(poly, x) {
  const ys = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) ys.push(a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y));
  }
  ys.sort((p, q) => p - q);
  const spans = [];
  for (let i = 0; i + 1 < ys.length; i += 2) spans.push([ys[i], ys[i + 1]]);
  return spans;
}

// occupancy as bit flags, so each kind of thing can choose what it avoids
export const HARD = 1, MTN = 2, WATER = 4, SOFT = 8;
class Grid {
  constructor(W, H, c = 4) {
    Object.assign(this, { c, cols: Math.ceil(W / c), rows: Math.ceil(H / c) });
    this.a = new Uint8Array(this.cols * this.rows);
  }
  each(x0, y0, x1, y1, fn) {
    const c = this.c;
    for (let j = Math.max(0, Math.floor(y0 / c)); j <= Math.min(this.rows - 1, Math.floor(y1 / c)); j++)
      for (let i = Math.max(0, Math.floor(x0 / c)); i <= Math.min(this.cols - 1, Math.floor(x1 / c)); i++)
        if (fn(i, j, (i + 0.5) * c, (j + 0.5) * c) === false) return;
  }
  mark(x, y, r, v = HARD) {
    this.each(x - r, y - r, x + r, y + r, (i, j, cx, cy) => {
      if (Math.hypot(cx - x, cy - y) <= r + this.c * 0.5) this.a[j * this.cols + i] |= v;
    });
  }
  rect(x0, y0, x1, y1, v = HARD) {
    this.each(x0, y0, x1, y1, (i, j) => { this.a[j * this.cols + i] |= v; });
  }
  line(pts, r, v = HARD) {
    for (const p of resample(pts, Math.max(2, Math.ceil(plen(pts) / this.c)))) this.mark(p.x, p.y, r, v);
  }
  poly(pts, v = HARD) {
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    this.each(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (i, j, cx, cy) => {
      if (inside(P(cx, cy), pts)) this.a[j * this.cols + i] |= v;
    });
  }
  // every flag set within r of (x, y)
  peek(x, y, r = 0) {
    let m = 0;
    this.each(x - r, y - r, x + r, y + r, (i, j, cx, cy) => {
      if (Math.hypot(cx - x, cy - y) <= r + this.c * 0.5) m |= this.a[j * this.cols + i];
    });
    return m;
  }
}

const TARGET_Y = { mountains: 345, hills: 410, forest: 470, lake: 430, river: 520, town: 545, plain: 560 };

export function plan(stops, seed = 1) {
  // every feature draws from its own stream, keyed by what it belongs to (a
  // stop, a row of trees, a patch of ground), so a stop added at the end grows
  // the map east without reshuffling the land that was already there
  const R = (...k) => rng(k.reduce((h, v) => Math.imul(h ^ Math.round(v * 977 + 13), 0x9e3779b1) >>> 0, seed >>> 0));
  const N = stops.length;
  const SPACING = 135;
  const W = Math.max(1600, 490 + SPACING * (N - 1));
  const H = 1000;
  const M = 34; // inner frame
  const cart = { x0: 46, y0: 46, x1: 446, y1: 212 };
  const grid = new Grid(W, H);

  // ---------- the coast: the sea runs along the south
  const nCoast = noise1(R(1), 170);
  const nCoast2 = noise1(R(2), 45);
  const nCoast3 = noise1(R(3), 14);
  const baseCoast = (x) => H - 180 + nCoast(x) * 34 + nCoast2(x) * 11 + nCoast3(x) * 3.5;

  // ---------- stops along a winding route, west to east
  const xs = 200, xe = W - 290;
  const phase = R(4).range(0, TAU);
  const placed = stops.map((s, i) => {
    const x = N === 1 ? (xs + xe) / 2 : xs + ((xe - xs) * i) / (N - 1) + R(5, i).jit(18);
    const serp = 500 + 190 * Math.sin(i * 2.25 + phase);
    if (s.terrain === 'coast') return { ...s, x, y: clamp(baseCoast(x) - 78, 330, H - 240) };
    const t = TARGET_Y[s.terrain] ?? serp;
    const y = lerp(serp, t, s.terrain ? 0.72 : 0) + R(6, i).jit(22);
    return { ...s, x, y: clamp(y, x < cart.x1 + 40 ? 330 : 300, H - 270) };
  });
  // neighbours should differ in height enough for their labels
  for (let i = 1; i < N; i++) {
    const a = placed[i - 1], b = placed[i];
    if (b.terrain === 'coast') continue;
    if (Math.abs(b.y - a.y) < 95) {
      const opts = [a.y - 95, a.y + 95].filter((v) => v >= 300 && v <= H - 270);
      if (opts.length) b.y = opts.reduce((p, q) => (Math.abs(q - b.y) < Math.abs(p - b.y) ? q : p));
    }
  }
  // the coast reaches up to meet any stop that asked for it
  const coastStops = placed.filter((s) => s.terrain === 'coast');
  const coastY = (x) => {
    let y = baseCoast(x);
    for (const s of coastStops) {
      const k = Math.exp(-(((x - s.x) / 90) ** 2));
      y = lerp(y, s.y + 46 + nCoast2(x * 3) * 8, k);
    }
    return y;
  };
  const coast = [];
  for (let x = M - 2; x <= W - M + 2; x += 12) coast.push(P(x, coastY(x)));
  const onLand = (x, y, m = 0) => x > M + m && x < W - M - m && y > M + m && y < coastY(x) - m;

  // ---------- the road: one gently bowed leg per pair of stops
  const legs = [];
  const avoid = (pts, i, j) => {
    let m = 1e9;
    for (const s of placed) {
      if (s === placed[i] || s === placed[j]) continue;
      for (const p of pts) m = Math.min(m, dist(p, P(s.x, s.y - 12)));
    }
    return m;
  };
  const bowed = (A, B, amp, ph, n = 14) => {
    const d = dist(A, B), nx = -(B.y - A.y) / d, ny = (B.x - A.x) / d;
    return Array.from({ length: n + 1 }, (_, k) => {
      const t = k / n, s = Math.sin(Math.PI * t);
      const off = amp * s + d * 0.03 * Math.sin(TAU * 1.5 * t + ph) * s;
      return P(lerp(A.x, B.x, t) + nx * off, lerp(A.y, B.y, t) + ny * off);
    });
  };
  for (let i = 0; i < N - 1; i++) {
    const A = placed[i], B = placed[i + 1];
    const lg = R(7, i);
    const d = dist(A, B), amp = d * lg.range(0.1, 0.2), ph = lg.range(0, TAU);
    const a = bowed(A, B, amp, ph), b = bowed(A, B, -amp, ph);
    legs.push(avoid(a, i, i + 1) >= avoid(b, i, i + 1) ? a : b);
  }
  const last = placed[N - 1];
  const er = R(8);
  const edge = P(W - M - 46, clamp(last.y + er.jit(60), 320, coastY(W - 80) - 70));
  const onward = bowed(P(last.x, last.y), edge, dist(last, edge) * 0.12, er.range(0, TAU), 8);

  // resample into a hand-wobbly polyline; remember how far along each stop is
  const route = [P(placed[0].x, placed[0].y)];
  const at = [0];
  let run = 0;
  for (const [li, leg] of legs.entries()) {
    const jr = R(9, li);
    const L = plen(leg);
    const pts = resample(leg, Math.max(4, Math.round(L / 9)));
    for (let k = 1; k < pts.length; k++) {
      const end = k === pts.length - 1;
      route.push(end ? pts[k] : P(pts[k].x + jr.jit(0.7), pts[k].y + jr.jit(0.7)));
    }
    run += L;
    at.push(run);
  }
  const jo = R(10);
  const onwardPts = resample(onward, Math.max(4, Math.round(plen(onward) / 9))).map((p, k) => (k ? P(p.x + jo.jit(0.6), p.y + jo.jit(0.6)) : p));

  // ---------- keep-outs: markers, the road, the cartouche, the frame
  grid.rect(0, 0, W, M + 8);
  grid.rect(0, H - M - 8, W, H);
  grid.rect(0, 0, M + 8, H);
  grid.rect(W - M - 8, 0, W, H);
  grid.rect(cart.x0 - 10, cart.y0 - 10, cart.x1 + 12, cart.y1 + 14);
  for (const s of placed) {
    grid.mark(s.x, s.y - 28, 34);
    grid.mark(s.x, s.y, 14);
  }
  if (route.length > 1) grid.line(route, 12);
  grid.line(onwardPts, 12);
  // the arrow off the edge and its label
  grid.rect(edge.x - 40, edge.y - 40, W, edge.y + 22);

  // ---------- labels: try above, below, right, left; least trouble wins
  const labels = [];
  const labelBoxes = [];
  const markerBox = (s) => ({ x0: s.x - 22, y0: s.y - 62, x1: s.x + 22, y1: s.y + 8 });
  const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  for (const [si, s] of placed.entries()) {
    const lr = R(11, si);
    const lines = wrap(s.title);
    const w = Math.max(...lines.map((l) => l.length)) * LABEL.charW + 6;
    const h = lines.length * LABEL.lineH + (s === last ? 18 : 0);
    const cands = [
      { pos: 'above', pref: 0, box: { x0: s.x - w / 2, y0: s.y - 66 - h, x1: s.x + w / 2, y1: s.y - 66 }, anchor: 'middle', ax: s.x },
      { pos: 'below', pref: 3, box: { x0: s.x - w / 2, y0: s.y + 14, x1: s.x + w / 2, y1: s.y + 14 + h }, anchor: 'middle', ax: s.x },
      { pos: 'right', pref: 4, box: { x0: s.x + 26, y0: s.y - 24 - h / 2, x1: s.x + 26 + w, y1: s.y - 24 + h / 2 }, anchor: 'start', ax: s.x + 26 },
      { pos: 'left', pref: 4, box: { x0: s.x - 26 - w, y0: s.y - 24 - h / 2, x1: s.x - 26, y1: s.y - 24 + h / 2 }, anchor: 'end', ax: s.x - 26 },
    ];
    for (const c of cands) {
      const b = c.box;
      let score = c.pref;
      for (const p of [...route, ...onwardPts]) if (p.x > b.x0 - 5 && p.x < b.x1 + 5 && p.y > b.y0 - 5 && p.y < b.y1 + 5) score += 11;
      for (const o of placed) if (o !== s && overlap(b, markerBox(o)) > 0) score += 200;
      for (const lb of labelBoxes) if (overlap(b, lb) > 0) score += 300;
      if (overlap(b, { x0: cart.x0 - 10, y0: cart.y0 - 10, x1: cart.x1 + 10, y1: cart.y1 + 10 }) > 0) score += 300;
      if (b.x0 < M + 10 || b.x1 > W - M - 10 || b.y0 < M + 10) score += 300;
      if (b.y1 > Math.min(coastY(b.x0), coastY(b.x1), coastY((b.x0 + b.x1) / 2)) - 4) score += 150;
      c.score = score + lr() * 0.5;
    }
    cands.sort((a, b) => a.score - b.score);
    const c = cands[0];
    labelBoxes.push(c.box);
    grid.rect(c.box.x0 - 8, c.box.y0 - 6, c.box.x1 + 8, c.box.y1 + 6);
    labels.push({ id: s.id, pos: c.pos, anchor: c.anchor, x: c.ax, y: c.box.y0 + LABEL.size * 0.82, lines, box: c.box });
  }

  // "the road goes on", beside the arrow, clear of the road and the last label
  const onwardW = 16 * 9.6;
  const onwardLabel = [edge.y + 30, edge.y - 14, edge.y + 52, edge.y - 36]
    .map((y, k) => {
      const b = { x0: edge.x + 24 - onwardW, y0: y - 17, x1: edge.x + 24, y1: y + 4 };
      let score = k;
      for (const p of onwardPts) if (p.x > b.x0 - 4 && p.x < b.x1 + 4 && p.y > b.y0 - 4 && p.y < b.y1 + 4) score += 10;
      for (const lb of labelBoxes) if (overlap(b, lb) > 0) score += 300;
      if (b.y1 > coastY(edge.x) - 6) score += 300;
      return { x: edge.x + 24, y, score };
    })
    .sort((a, b) => a.score - b.score)[0];
  grid.rect(onwardLabel.x - onwardW - 6, onwardLabel.y - 22, onwardLabel.x + 6, onwardLabel.y + 8);

  // ---------- the lake, beside whichever stop asked for one
  const lakes = [];
  for (const s of placed.filter((p) => p.terrain === 'lake')) {
    const lr = R(12, placed.indexOf(s));
    let best = null;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU;
      const rx = 92, ry = 26, rot = lr.jit(0.18);
      const c = P(s.x + Math.cos(a) * 118, s.y - 10 + Math.sin(a) * 74);
      let bad = 0;
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * TAU;
        const px = c.x + Math.cos(t) * rx * Math.cos(rot) - Math.sin(t) * ry * Math.sin(rot);
        const py = c.y + Math.cos(t) * rx * Math.sin(rot) + Math.sin(t) * ry * Math.cos(rot);
        if (grid.peek(px, py, 4) & HARD) bad++;
        if (!onLand(px, py, 30)) bad += 3;
      }
      if (!best || bad < best.bad) best = { c, rx, ry, rot, bad };
    }
    const outline = blobPts(best.rx, best.ry, lr, { n: 18, wobble: 0.05 }).map((p) => P(best.c.x + p.x * Math.cos(best.rot) - p.y * Math.sin(best.rot), best.c.y + p.x * Math.sin(best.rot) + p.y * Math.cos(best.rot)));
    grid.poly(outline, WATER);
    outline.forEach((p) => grid.mark(p.x, p.y, 8, WATER));
    lakes.push({ ...best, outline, stop: s });
  }

  // ---------- mountains: a range along the north, and a knot behind any stop
  // that asked for mountains
  const mountains = [];
  const nR = noise1(R(13), 120), nH = noise1(R(14), 90);
  const tryPeak = (x, y, w, h, mr, opts = {}) => {
    if (!onLand(x - w / 2, y, 0) || !onLand(x + w / 2, y, 0) || y - h < M + 14) return false;
    // keep the body off labels, markers and the road
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const px = x - w / 2 + w * t, py = y - h * (1 - Math.abs(t - 0.5) * 2) * 0.55;
      if ((grid.peek(px, py, 3) | grid.peek(px, y - 3, 3)) & (HARD | WATER)) return false;
    }
    if (grid.peek(x, y - h * 0.8, 4) & (HARD | WATER)) return false;
    const m = mountain(x, y, w, h, mr, opts);
    grid.poly(m.body, MTN);
    mountains.push(m);
    return true;
  };
  // three staggered rows, back to front; the range thins out where the
  // noise dips, so it reads as several ranges rather than a wall
  const rowsY = [150, 182, 214];

  // a patch-by-patch scatter: each cell of the map has its own stream
  const cells = (size, k, fn) => {
    for (let cy = 0; cy * size < H; cy++) for (let cx = 0; cx * size < W; cx++) fn(R(k, cx, cy), cx * size, cy * size);
  };
  rowsY.forEach((ry, pass) => {
    const mr = R(15, pass);
    for (let x = cart.x1 + 30 + pass * 17; x < W - M - 30; ) {
      const lift = 0.5 + 0.5 * nH(x * 0.8 + pass * 211);
      const h = 24 + lift * 42 + mr.range(0, 10) - pass * 4;
      const w = h * mr.range(1.45, 2);
      const y = ry + nR(x + pass * 97) * 16 + mr.jit(5);
      if (lift > 0.34 || mr() < 0.15) tryPeak(x, y, w, h, mr);
      x += w * mr.range(0.5, 0.75);
    }
  });
  for (const s of placed.filter((p) => p.terrain === 'mountains')) {
    const mr = R(16, placed.indexOf(s));
    for (let k = 0, made = 0; k < 120 && made < 14; k++) {
      const h = mr.range(34, 70), w = h * mr.range(1.4, 1.8);
      const x = s.x + mr.jit(190), y = s.y - 50 - mr.range(0, 140);
      if (tryPeak(x, y, w, h, mr)) made++;
    }
  }
  // low black ridges here and there, like folds in the land
  cells(380, 17, (mr, x0, y0) => {
    if (mr() > 0.4) return;
    for (let k = 0; k < 6; k++) {
      const x = x0 + mr.range(0, 380), y = y0 + mr.range(0, 380);
      if (y < 300 || y > H - 260 || placed.some((s) => dist(s, P(x, y)) < 150)) continue;
      if (tryPeak(x, y, mr.range(70, 130), mr.range(16, 26), mr, { ridge: true })) return;
    }
  });

  // ---------- rivers: down from the mountains, past a stop, out to sea
  const rivers = [];
  const riverStops = placed.filter((s) => s.terrain === 'river' || s.terrain === 'lake');
  const sources = riverStops.map((s) => ({ s, lake: lakes.find((l) => l.stop === s) }));
  const want = Math.max(2, sources.length);
  const xr = R(18);
  for (let k = 0; sources.length < want && k < 40; k++) {
    const x = xr.range(cart.x1 + 80, 1400);
    if (sources.every((o) => Math.abs((o.s?.x ?? o.x) - x) > 260)) sources.push({ x });
  }
  const nMeander = noise1(R(19), 60);
  for (const [si, src] of sources.slice(0, 3).entries()) {
    const rr = R(20, si);
    const way = [];
    const sx = (src.lake ? src.lake.c.x : src.s ? src.s.x : src.x) + rr.jit(60);
    way.push(P(sx, 196 + rr.jit(14)));
    if (src.lake) {
      const l = src.lake;
      const top = l.outline.reduce((a, p) => (p.y < a.y ? p : a)), bot = l.outline.reduce((a, p) => (p.y > a.y ? p : a));
      way.push(P(top.x - 4, top.y - 30), P(top.x, top.y + 2));
      way.push(P(bot.x, bot.y - 2), P(bot.x + 6, bot.y + 34));
    } else if (src.s) {
      const s = src.s;
      const side = rr() < 0.5 ? -1 : 1;
      way.push(P(s.x + side * 52, s.y - 70), P(s.x + side * 48, s.y + 30));
    } else {
      way.push(P(sx + rr.jit(80), lerp(200, coastY(sx), 0.5)));
    }
    const lastW = way.at(-1);
    const mx = clamp(lastW.x + rr.jit(90), M + 60, W - M - 60);
    way.push(P(mx, coastY(mx) + 6));
    // through the waypoints, meandering between them
    const segs = [];
    for (let i = 0; i < way.length - 1; i++) {
      const a = way[i], b = way[i + 1];
      const inLake = src.lake && i === 2;
      const pts = resample([a, b], Math.max(2, Math.round(dist(a, b) / 14)));
      const d = dist(a, b), nx = -(b.y - a.y) / d, ny = (b.x - a.x) / d;
      pts.forEach((p, k) => {
        if (k === 0 && i > 0) return;
        const t = k / (pts.length - 1), env = Math.sin(Math.PI * t);
        const off = inLake ? 0 : nMeander(p.y + p.x * 0.3) * 18 * env;
        segs.push({ p: P(p.x + nx * off, p.y + ny * off), lake: inLake && k > 0 && k < pts.length - 1 });
      });
    }
    // split where it passes through the lake
    const parts = [[]];
    for (const q of segs) {
      if (q.lake) { if (parts.at(-1).length) parts.push([]); continue; }
      parts.at(-1).push(q.p);
    }
    const total = segs.length;
    let idx = 0;
    const banks = parts.filter((p) => p.length > 1).map((pts) => {
      const t0 = idx / total;
      idx += pts.length;
      return { pts, t0, t1: idx / total };
    });
    for (const b of banks) b.pts.forEach((p) => grid.mark(p.x, p.y, 8, WATER));
    rivers.push({ banks });
  }

  // ---------- forests: tiers of little trees wherever the land is open
  const nF = noise2(R(21), 230), nE = noise2(R(22), 46);
  const density = (x, y) => {
    let d = nF(x, y) * 0.95 + nE(x, y) * 0.28 + 0.42;
    for (const s of placed) {
      const k = Math.exp(-((dist(s, P(x, y)) / 210) ** 2));
      if (s.terrain === 'forest') d += 0.95 * k;
      if (s.terrain === 'town' || s.terrain === 'plain') d -= 0.55 * Math.exp(-((dist(s, P(x, y)) / 150) ** 2));
      if (s.terrain === 'lake' || s.terrain === 'river') d -= 0.25 * k;
    }
    for (const l of lakes) d -= 0.5 * Math.exp(-((dist(l.c, P(x, y)) / 150) ** 2));
    return d;
  };
  const darkWood = placed.filter((s) => s.terrain === 'forest' && /death|dark|night|horror/i.test(`${s.title} ${s.note}`));
  const trees = [];
  let row = 0;
  for (let y = 70; y < H - M; y += 11.5, row++) {
    const fr = R(23, row);
    for (let x = M + 6 + (row % 2) * 7 + fr.range(0, 4); x < W - M - 6; ) {
      const w = fr.range(12, 17);
      const h = w * fr.range(1.12, 1.45);
      const yy = y + fr.jit(1.4);
      const step = w * fr.range(0.84, 1.0);
      if (density(x, yy) > 0.18 && onLand(x, yy, 10) && !(grid.peek(x, yy - h * 0.45, w * 0.48) & (HARD | MTN | WATER)) && !(grid.peek(x, yy + 2, 2) & (HARD | MTN | WATER))) {
        const dark = darkWood.some((s) => dist(s, P(x, yy)) < 190);
        const roll = fr();
        const type = dark ? (roll < 0.45 ? 'pine' : roll < 0.8 ? 'bell' : 'lolli') : roll < 0.58 ? 'bell' : roll < 0.88 ? 'lolli' : 'pine';
        trees.push({ x, y: yy, w, h, type, row, black: dark && fr() < 0.12, seed: Math.floor(fr() * 1e9) });
        grid.mark(x, yy - h * 0.4, w * 0.6, SOFT);
      }
      x += step;
    }
  }

  // ---------- hills: humps near stops that asked, and at forest edges
  const hills = [];
  const tryHill = (x, y, w, h, hr) => {
    if (!onLand(x, y, 16) || grid.peek(x, y - h * 0.5, w * 0.45) || grid.peek(x, y, 4)) return false;
    hills.push({ x, y, w, h, seed: Math.floor(hr() * 1e9) });
    grid.mark(x, y - h * 0.5, w * 0.55, SOFT);
    return true;
  };
  for (const s of placed.filter((p) => p.terrain === 'hills')) {
    const hr = R(24, placed.indexOf(s));
    for (let k = 0, made = 0; k < 80 && made < 9; k++) if (tryHill(s.x + hr.jit(150), s.y + hr.jit(100), hr.range(34, 58), hr.range(12, 20), hr)) made++;
  }
  cells(210, 25, (hr, x0, y0) => {
    if (hr() > 0.5) return;
    for (let k = 0; k < 3; k++) {
      const y = y0 + hr.range(0, 210);
      if (y > 260 && y < H - 200 && tryHill(x0 + hr.range(0, 210), y, hr.range(26, 46), hr.range(9, 15), hr)) return;
    }
  });

  // ---------- towns: little houses and ploughed fields
  const houses = [];
  const fields = [];
  for (const s of placed.filter((p) => p.terrain === 'town')) {
    const tr = R(26, placed.indexOf(s));
    for (let k = 0, made = 0; k < 120 && made < 9; k++) {
      const a = tr.range(0, TAU), d = tr.range(44, 96);
      const x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d * 0.7;
      const w = tr.range(8, 12);
      if (!onLand(x, y, 12) || grid.peek(x, y - w * 0.5, w * 0.8)) continue;
      houses.push({ x, y, w, seed: Math.floor(tr() * 1e9) });
      grid.mark(x, y - w * 0.5, w, SOFT);
      made++;
    }
    for (let k = 0, made = 0; k < 60 && made < 3; k++) {
      const x = s.x + tr.jit(120), y = s.y + tr.jit(90), fw = tr.range(30, 46), fh = tr.range(14, 20);
      if (!onLand(x, y, 12) || grid.peek(x, y, Math.max(fw, fh) * 0.6)) continue;
      fields.push({ x, y, w: fw, h: fh, rot: tr.jit(0.25), seed: Math.floor(tr() * 1e9) });
      grid.mark(x, y, Math.max(fw, fh) * 0.6, SOFT);
      made++;
    }
  }

  // ---------- marsh dots, dotted whirls, grass tufts, field hatching
  const marsh = [];
  const marshCenters = [
    ...lakes.map((l, i) => P(l.c.x + R(27, i).jit(80), l.c.y + 50)),
    ...placed.filter((s) => ['plain', 'river', 'lake'].includes(s.terrain)).map((s) => { const kr = R(28, placed.indexOf(s)); return P(s.x + kr.jit(90), s.y + kr.jit(70)); }),
  ];
  cells(420, 29, (kr, x0, y0) => { if (kr() < 0.5) marshCenters.push(P(x0 + kr.range(0, 420), y0 + kr.range(0, 420))); });
  for (const c of marshCenters) {
    if (c.y < 280 || c.y > H - 200) continue;
    const kr = R(30, Math.round(c.x), Math.round(c.y));
    for (let k = 0; k < 26; k++) {
      const x = c.x + kr.jit(60), y = c.y + kr.jit(36), n = 2 + Math.floor(kr() * 3);
      if (!onLand(x, y, 10) || grid.peek(x + n * 1.7, y, n * 2.2 + 2)) continue;
      marsh.push({ x, y, n });
      grid.mark(x + n * 1.7, y, n * 2 + 1, SOFT);
    }
  }
  const whirls = [];
  cells(400, 31, (kr, x0, y0) => {
    if (kr() > 0.42) return;
    for (let k = 0; k < 8; k++) {
      const rad = kr.range(20, 30), x = x0 + kr.range(0, 400), y = y0 + kr.range(0, 400);
      if (y < 260 || y > H - 220 || !onLand(x, y, rad + 6) || grid.peek(x, y, rad + 4)) continue;
      whirls.push({ x, y, R: rad, turns: kr.range(2.4, 3.4), rot: kr.range(0, TAU) });
      grid.mark(x, y, rad + 4, SOFT);
      return;
    }
  });
  const tufts = [];
  cells(64, 32, (kr, x0, y0) => {
    if (kr() > 0.6) return;
    for (let k = 0; k < 3; k++) {
      const x = x0 + kr.range(0, 64), y = y0 + kr.range(0, 64);
      if (y < 240 || y > H - 150 || !onLand(x, y, 8) || grid.peek(x, y - 2, 6)) continue;
      tufts.push({ x, y, s: kr.range(0.8, 1.2), seed: Math.floor(kr() * 1e9) });
      grid.mark(x, y - 2, 7, SOFT);
      return;
    }
  });
  // hatching under the forest edges, as the land falls away
  const hatch = [];
  for (const t of trees) {
    const kr = R(33, t.seed);
    if (kr() > 0.06) continue;
    const x = t.x + kr.jit(10), y = t.y + 9;
    if (!onLand(x, y, 8) || grid.peek(x, y + 3, 9)) continue;
    hatch.push({ x, y, w: kr.range(14, 24), n: 2 + Math.floor(kr() * 3) });
    grid.mark(x, y + 3, 11, SOFT);
  }

  // ---------- the sea: compass rose, a ship, a serpent, waves
  const sr = R(34);
  const seaTop = (x0, x1) => Math.max(...Array.from({ length: 9 }, (_, i) => coastY(lerp(x0, x1, i / 8))));
  const compass = { x: W - 150, y: 0, R: 52 };
  compass.y = Math.max(seaTop(W - 210, W - 90) + 66, H - M - 70);
  const findSea = (w, h, x0, x1) => {
    for (let k = 0; k < 80; k++) {
      const x = sr.range(x0, x1);
      const top = seaTop(x - w / 2, x + w / 2) + 46;
      if (top + h < H - M - 10) return P(x, top + (H - M - 10 - h - top) * sr.range(0.2, 0.7));
    }
    return P((x0 + x1) / 2, H - M - h - 10);
  };
  const ship = findSea(70, 60, W * 0.42, W * 0.62);
  ship.y += 46;
  const serpent = findSea(110, 30, W * 0.12, W * 0.3);
  serpent.y += 24;
  const waves = [];
  cells(96, 35, (wr, x0, y0) => {
    if (y0) return; // one column of cells is enough for the sea
    for (let k = 0; k < 2; k++) {
      const x = x0 + wr.range(0, 96), y = wr.range(coastY(x) + 40, H - M - 10);
      if (x < M + 20 || x > W - M - 20 || y > H - M - 12 || wr() < 0.35) continue;
      if (Math.hypot(x - compass.x, y - compass.y) < compass.R + 26 || Math.abs(x - ship.x) < 50 && Math.abs(y - ship.y + 20) < 44 || Math.abs(x - serpent.x) < 76 && Math.abs(y - serpent.y) < 26) continue;
      if (waves.some((w) => Math.abs(w.x - x) < 44 && Math.abs(w.y - y) < 14)) continue;
      waves.push({ x, y, w: wr.range(10, 18) });
    }
  });
  const br = R(36);
  const birds = Array.from({ length: 4 }, (_, i) => ({ x: lerp(cart.x1 + 120, W - 200, br()), y: br.range(56, 92), s: br.range(0.8, 1.2), i }));

  // ---------- the cartouche's scale of years, from the years in `when`
  const years = stops.flatMap((s) => [...String(s.when).matchAll(/\b(19|20)\d{2}\b/g)].map((m) => +m[0]));
  const y0 = years.length ? Math.min(...years) : new Date().getFullYear();
  const y1 = years.length ? Math.max(...years) : y0;

  return {
    W, H, M, cart, stops: placed, labels, onwardLabel, route, at, onward: onwardPts, edge, coast, coastY, lakes, rivers,
    mountains, trees, hills, houses, fields, marsh, whirls, tufts, hatch, compass, ship, serpent, waves, birds,
    years: { from: y0, to: Math.max(y1, y0 + 1) },
  };
}

// break a long title into two lines at the space nearest its middle
export function wrap(title) {
  if (title.length <= LABEL.wrap || !title.includes(' ')) return [title];
  const mid = title.length / 2;
  let best = -1;
  for (let i = 0; i < title.length; i++) if (title[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return [title.slice(0, best), title.slice(best + 1)];
}

// one mountain: outline, a ridge splitting the lit face from the shadow, the
// shadow inked solid with close strokes, and a few hatch lines on the lit face
function mountain(x, y, w, h, r, { ridge = false } = {}) {
  const px = x + r.jit(w * 0.12);
  const top = P(px, y - h);
  const L = P(x - w / 2, y), R = P(x + w / 2, y);
  const slope = (a, b, n, amt) => Array.from({ length: n }, (_, k) => {
    const t = (k + 1) / (n + 1);
    const bend = ridge ? -Math.sin(Math.PI * t) * h * 0.25 : -Math.sin(Math.PI * t) * h * 0.05 + (k % 2 ? -1 : 1) * h * r.range(0, 0.07);
    return P(lerp(a.x, b.x, t) + r.jit(amt), lerp(a.y, b.y, t) + r.jit(amt) + bend);
  });
  const ls = slope(L, top, ridge ? 2 : 3, h * 0.06);
  const rs = slope(top, R, ridge ? 2 : 3, h * 0.06);
  const outline = [L, ...ls, top, ...rs, R];
  const rb = P(px + w * r.range(0.04, 0.16), y);
  const ridgeLine = [top, ...Array.from({ length: 2 }, (_, k) => {
    const t = (k + 1) / 3;
    return P(lerp(top.x, rb.x, t) + r.jit(w * 0.05), lerp(top.y, rb.y, t));
  }), rb];
  const body = [...outline, P(x + w * 0.2, y + 1.5), P(x - w * 0.2, y + 1.5)];
  // shadow: right of the ridge, under the right slope
  const shadowPoly = [top, ...rs, R, rb, ...ridgeLine.slice(1, -1).reverse()];
  // one zigzag stroke, down and up across the shadow like a pen hatching;
  // it starts a little below the ridge so the top of the shadow stays broken
  const zig = [];
  const xs = shadowPoly.map((p) => p.x);
  let down = true;
  for (let sx = Math.min(...xs) + 1; sx < Math.max(...xs) - 0.5; sx += 2.3) {
    const spans = scan(shadowPoly, sx);
    if (!spans.length) continue;
    const [a, b] = spans.reduce((p, q) => (q[1] - q[0] > p[1] - p[0] ? q : p));
    if (b - a < 1.5) continue;
    const a2 = a + (b - a) * r.range(0.05, ridge ? 0.2 : 0.42);
    const top = P(sx + r.jit(0.3), a2), bot = P(sx + r.jit(0.4) - 0.6, b - 0.6);
    zig.push(...(down ? [top, bot] : [bot, top]).map((p) => ({ ...p, c: true })));
    down = !down;
  }
  const shade = zig.length > 1 ? [zig] : [];
  // lit face: a few strokes down from the left slope
  const lit = [];
  const nl = ridge ? 2 : 3 + Math.floor(r() * 3);
  for (let k = 0; k < nl; k++) {
    const t = r.range(0.25, 0.85);
    const i = Math.min(ls.length - 1, Math.floor(t * ls.length));
    const a = ls[i] || L;
    const len = h * r.range(0.14, 0.3);
    lit.push([P(a.x + 2, a.y + 2), P(a.x + 2 + len * 0.35, a.y + 2 + len)]);
  }
  // a tick or two along the foot
  const foot = [[P(x - w * 0.42, y + 1), P(x - w * 0.3, y + 1)]];
  return { x, y, w, h, ridge, outline, ridgeLine, body, shade, lit, foot };
}
