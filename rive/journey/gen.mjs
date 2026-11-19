// Draft 22 · Journey: what Ben has been up to, as a pen-and-ink book map.
// One artboard, Map, drawn entirely from site/journey/journey.js through the
// planner in terrain.mjs: black ink on cream, red for the road and the places.
//
// On load the map inks itself in from west to east (one synchronized trim per
// band of land, so every tree outline and hatch stroke draws at once), the
// rivers run down from the mountains, then the dashed red road draws stop by
// stop while a small traveller walks it and each landmark stamps down as the
// road reaches it. The dashes keep marching slowly once it's done.
//
// Inputs: still (bool, jump to the finished map), spot (number, 1-based stop
// to lift and ring; 0 for none). Labels, the note card and the stop list are
// HTML/SVG on the page, positioned from site/journey/layout.json, which this
// generator writes alongside the scene.
//
// Size: trees are composed many to a Shape (one per row per band), mountains
// share one ink and one shadow shape each, and nothing boils.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ids, Scene, rng, P, TAU, el, argb, smoothVertices, signedArea, document, EASE, blobPts } from '../lib/ink.mjs';
import { stops, seed } from '../../site/journey/journey.js';
import { plan, lerp, clamp, LABEL } from './terrain.mjs';

const INK = 'FF221C17';
const PAPER = 'FFF3EAD5';
const RED = 'FFC3392A';
const FPS = 60;
const MK = 1.4; // landmark scale

// ---------- paths with optional sharp corners (points flagged c: true) and
// explicit handles (rot, d), which let a tree be four vertices instead of eight

const C = (x, y) => ({ x, y, c: true });
const H = (x, y, rot, d) => ({ x, y, rot, d });
function pth(pts, { closed = false, tension = 1 } = {}) {
  const verts = smoothVertices(pts, { closed, tension });
  const cw = closed ? signedArea(pts) >= 0 : true;
  return el('PointsPath', { isClosed: closed ? 'true' : undefined, isClockwise: cw ? 'true' : 'false', name: 'P' },
    verts.map((v, i) => {
      const p = pts[i];
      if (p.d != null) return el('CubicMirroredVertex', { x: p.x, y: p.y, rotation: p.rot, distance: p.d });
      return p.c || v.distance < 0.01
        ? el('StraightVertex', { x: v.x, y: v.y })
        : el('CubicMirroredVertex', { x: v.x, y: v.y, rotation: v.rotation, distance: v.distance });
    }));
}
// a list item is an array of points (open) or { pts, closed, tension }
const norm = (it) => (Array.isArray(it) ? { pts: it } : it);
function paints({ fillC, color, w, fx, trim, dash, cap = 'round', colorId, trimId }) {
  const out = [];
  if (fillC) out.push(el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: fillC, name: 'C' })));
  if (color) {
    const kids = [el('SolidColor', { colorValue: color, name: 'C', id: colorId })];
    if (trim) kids.push(el('TrimPath', { start: 0, end: trim.end ?? 0, modeValue: trim.mode || 'synchronized', id: trimId, name: 'Trim' }));
    if (fx) kids.push(el('TargetEffect', { targetId: fx, name: 'Use' }));
    if (dash) kids.push(el('DashPath', { offset: 0, id: dash.id, name: 'Dash' }, dash.pattern.map((d) => el('Dash', { length: d, name: 'd' }))));
    out.push(el('Stroke', { thickness: w, cap, join: 'round', name: 'Stroke' }, kids));
  }
  return out;
}
function shape(name, list, opts = {}) {
  const items = list.map(norm).filter((it) => it.pts.length > 1);
  if (!items.length) return '';
  return el('Shape', { name, id: opts.id, x: opts.x, y: opts.y, opacity: opts.opacity }, [
    ...items.map((it) => pth(it.pts, { closed: it.closed, tension: it.tension ?? opts.tension ?? 1 })),
    ...paints(opts),
  ]);
}
const group = (attrs, kids) => el('Node', attrs, [].concat(kids).filter(Boolean).reverse());
const jit = (r, a) => (p) => ({ ...p, x: p.x + r.jit(a), y: p.y + r.jit(a) });
const circle = (cx, cy, rx, ry = rx, n = 10, a0 = 0) => Array.from({ length: n }, (_, i) => P(cx + Math.cos(a0 + (i / n) * TAU) * rx, cy + Math.sin(a0 + (i / n) * TAU) * ry));

// ---------- the little things the map is made of

function treePaths(t) {
  const r = rng(t.seed);
  const { x, y, w, h } = t;
  const j = jit(r, 0.4);
  const at = (dx, dy, c) => (c ? C(x + dx, y + dy) : P(x + dx, y + dy));
  if (t.type === 'lolli') {
    // a wobbly circle from four handles, on a short stalk
    const R = w / 2, cy = y - h + R, k = R * 0.552;
    const q = () => k * (1 + r.jit(0.12));
    const crown = [H(x - R + r.jit(0.4), cy, -Math.PI / 2 + r.jit(0.1), q()), H(x, cy - R + r.jit(0.4), r.jit(0.1), q()), H(x + R + r.jit(0.4), cy, Math.PI / 2 + r.jit(0.1), q()), H(x, cy + R * 0.94, Math.PI + r.jit(0.1), q())];
    const out = [{ pts: crown, closed: true }];
    if (h - 2 * R > 1.5) out.push([C(x + r.jit(0.3), cy + R * 0.94), C(x + r.jit(0.4), y)]);
    return out;
  }
  if (t.type === 'pine') {
    return [{ pts: [at(-w * 0.42, 0, 1), at(r.jit(0.6), -h * 1.12, 1), at(w * 0.42, 0, 1), H(x, y + h * 0.1, Math.PI, w * 0.18)].map(j), closed: true }];
  }
  // the bell: two sharp feet, a round crown, a slightly sagging hem
  const out = [{ pts: [at(-w * 0.5, 0, 1), H(x + r.jit(0.5), y - h + r.jit(0.4), r.jit(0.08), w * r.range(0.32, 0.4)), at(w * 0.5, 0, 1), H(x, y + h * 0.13, Math.PI, w * 0.22)].map(j), closed: true }];
  if (r() < 0.3) out.push([C(x, y + h * 0.12), C(x + r.jit(0.4), y + h * 0.34)]);
  return out;
}

function hillPaths(hl) {
  const r = rng(hl.seed);
  const { x, y, w, h } = hl;
  const hump = [P(x - w / 2, y), P(x - w * 0.3, y - h * 0.7), P(x - w * 0.05 + r.jit(2), y - h), P(x + w * 0.25, y - h * 0.75), P(x + w / 2, y)].map(jit(r, 0.5));
  const shade = [];
  for (let k = 0; k < 3; k++) {
    const t = 0.25 + k * 0.22;
    const a = P(lerp(x + w * 0.05, x + w * 0.45, t), lerp(y - h * 0.9, y - h * 0.15, t) + 2);
    shade.push([a, P(a.x + 2, a.y + h * 0.3), P(a.x + 1, a.y + h * 0.5)]);
  }
  return [hump, ...shade];
}

function housePaths(hs) {
  const r = rng(hs.seed);
  const { x, y, w } = hs;
  const j = jit(r, 0.3);
  const body = [C(x - w / 2, y), C(x - w / 2, y - w * 0.6), C(x, y - w * 1.15), C(x + w / 2, y - w * 0.6), C(x + w / 2, y)].map(j);
  return [{ pts: body, closed: true, tension: 0 }, [C(x - w / 2, y - w * 0.6), C(x + w / 2, y - w * 0.6)], [C(x + w * 0.1, y), C(x + w * 0.1, y - w * 0.32)]];
}

function fieldPaths(f) {
  const r = rng(f.seed);
  const rot = (dx, dy) => C(f.x + dx * Math.cos(f.rot) - dy * Math.sin(f.rot), f.y + dx * Math.sin(f.rot) + dy * Math.cos(f.rot));
  const out = [{ pts: [rot(-f.w / 2, -f.h / 2), rot(f.w / 2, -f.h / 2), rot(f.w / 2, f.h / 2), rot(-f.w / 2, f.h / 2)].map(jit(r, 0.5)), closed: true, tension: 0 }];
  for (let k = 1; k < 4; k++) out.push([rot(-f.w / 2 + 3, -f.h / 2 + (k * f.h) / 4), rot(f.w / 2 - 3, -f.h / 2 + (k * f.h) / 4)].map(jit(r, 0.4)));
  return out;
}

function tuftPaths(t) {
  const r = rng(t.seed);
  const s = t.s * 4.2;
  return [[P(t.x - s * 0.7, t.y - s), P(t.x - s * 0.15, t.y)], [P(t.x + r.jit(0.4), t.y - s * 1.2), P(t.x, t.y)], [P(t.x + s * 0.7, t.y - s), P(t.x + s * 0.15, t.y)]].map((l) => l.map(jit(r, 0.3)));
}

const dotAt = (x, y) => [P(x, y), P(x + 0.35, y + 0.1)];

// ---------- markers: small red landmarks, by kind (origin at the stop)

function marker(kind, r) {
  const j = jit(r, 0.25);
  const red = [], fills = [], flags = [];
  if (kind === 'school') {
    fills.push({ pts: [C(-12, -11.5), C(12, -11.5), C(12, -22), C(-12, -22)], closed: true, tension: 0 });
    red.push([C(-14.5, -9), C(14.5, -9)], [C(-12.5, -11.5), C(12.5, -11.5)]);
    for (const x of [-9, -3, 3, 9]) red.push([C(x, -11.5), C(x, -22)]);
    red.push([C(-12.5, -22), C(12.5, -22)]);
    const ped = [C(-14.5, -23.5), C(0, -32), C(14.5, -23.5)];
    fills.push({ pts: ped, closed: true, tension: 0 });
    red.push({ pts: ped, closed: true, tension: 0 }, { pts: circle(0, -26.3, 1.6, 1.6, 6), closed: true });
  } else if (kind === 'project') {
    const tent = [C(-12, -9), C(0, -28), C(12, -9)];
    fills.push({ pts: tent, closed: true, tension: 0 });
    red.push({ pts: tent, closed: true, tension: 0 }, [C(0, -28), C(-3.5, -9)], [C(0, -28), C(4, -9)], [C(-15, -9), C(15, -9)], [C(0, -28), C(0, -36)]);
    flags.push([C(0, -36), P(4, -35.2), C(8, -34.4), P(4, -33), C(0, -31.6)]);
  } else if (kind === 'milestone') {
    const stones = [circle(-5, -11.5, 4.5, 3, 7), circle(5, -11.5, 4.5, 3, 7), circle(0, -16.5, 4, 2.8, 7)];
    for (const s of stones) { fills.push({ pts: s, closed: true }); red.push({ pts: s, closed: true }); }
    red.push([C(0, -19), C(0, -42)]);
    flags.push([C(0, -42), P(6, -40.5), C(13, -42), P(12, -37.5), C(14, -34), P(7, -33.5), C(0, -35)]);
    red.push([C(-15, -8.5), C(15, -8.5)]);
  } else {
    // work: a tower with battlements and a pennant
    const body = [C(-6.5, -9), C(-5.6, -30), C(5.6, -30), C(6.5, -9)];
    const bat = [C(-7, -30), C(-7, -34.5), C(-3.8, -34.5), C(-3.8, -32), C(-1.4, -32), C(-1.4, -34.5), C(1.4, -34.5), C(1.4, -32), C(3.8, -32), C(3.8, -34.5), C(7, -34.5), C(7, -30)];
    fills.push({ pts: body, closed: true, tension: 0 }, { pts: bat, closed: true, tension: 0 });
    red.push({ pts: body, closed: true, tension: 0 }, { pts: bat, closed: true, tension: 0 }, [C(-2.4, -9), C(-2.4, -14), P(0, -16.2), C(2.4, -14), C(2.4, -9)], [C(0, -25), C(0, -21)], [C(-13, -9), C(13, -9)], [C(0, -34.5), C(0, -41)]);
    flags.push([C(0, -41), P(4, -40.3), C(8, -39.6), P(4, -38.3), C(0, -37.2)]);
  }
  const rj = (l) => l.map((it) => { const o = norm(it); return { ...o, pts: o.pts.map(j) }; });
  return { red: rj(red), fills: rj(fills), flags: rj(flags) };
}

// ---------- the scene

export default function build() {
  const L = plan(stops, seed);
  const { W, H, M } = L;
  const ids = new Ids(10);
  const s = new Scene(ids, { name: 'Map', w: W, h: H, bg: process.env.JOURNEY_BG ? 'FFEFE5CC' : undefined });
  const still = s.input('bool', 'still', 0);
  const spot = s.input('number', 'spot', 0);
  const intro = []; // { object, prop, keys, to }
  const tween = (object, prop, from, to, t0, t1, ease = EASE.out) =>
    intro.push({ object, prop, to, keys: t0 > 0 ? [[0, from, 'hold'], [t0, from, 'cubic', ease], [t1, to]] : [[0, from, 'cubic', ease], [t1, to]] });

  // --- draw-on: one synchronized trim per band of land, west to east
  const B = Math.max(4, Math.round(W / 270));
  const bandT = (k) => [8 + k * 13, 8 + k * 13 + 58];
  const fx = Array.from({ length: B }, (_, k) => {
    const fxId = ids.next(), trimId = ids.next();
    s.add(el('GroupEffect', { name: `band ${k}`, id: fxId }, el('TrimPath', { start: 0, end: 0, modeValue: 'synchronized', id: trimId, name: 'Trim' })));
    const [t0, t1] = bandT(k);
    tween(trimId, 'end', 0, 1, t0, t1, [0.45, 0, 0.3, 1]);
    return fxId;
  });
  // the sweep leans and wavers, so the bands never meet in a straight seam
  const lean = 0.45, wob = (y) => Math.sin(y * 0.021) * 26 + Math.sin(y * 0.057 + 1) * 12;
  const bandOf = (x, y = H / 2) => clamp(Math.floor((x + (y - H / 2) * lean + wob(y) + (H / 2) * lean + 38) / ((W + H * lean + 76) / B)), 0, B - 1);
  const fadeIn = (id, x, y, dt = 20) => { const [t0, t1] = bandT(bandOf(x, y)); tween(id, 'opacity', 0, 1, t0 + dt, t1); };
  const trimFx = (name, t0, t1, ease = [0.45, 0, 0.3, 1], mode = 'synchronized') => {
    const fxId = ids.next(), trimId = ids.next();
    s.add(el('GroupEffect', { name, id: fxId }, el('TrimPath', { start: 0, end: 0, modeValue: mode, id: trimId, name: 'Trim' })));
    tween(trimId, 'end', 0, 1, t0, t1, ease);
    return fxId;
  };

  // --- the sheet: cream paper, a little browner toward the edges
  const sheet = [];
  const er = rng(5);
  const edge = (a, b, n) => { for (let i = 0; i < n; i++) sheet.push(P(lerp(a.x, b.x, i / n) + er.jit(1.4), lerp(a.y, b.y, i / n) + er.jit(1.4))); };
  edge(P(3, 3), P(W - 3, 3), 30); edge(P(W - 3, 3), P(W - 3, H - 3), 18); edge(P(W - 3, H - 3), P(3, H - 3), 30); edge(P(3, H - 3), P(3, 3), 18);
  s.add(el('Shape', { name: 'sheet' }, [pth(sheet, { closed: true, tension: 0.3 }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: PAPER, name: 'C' }))]));
  s.add(el('Shape', { name: 'sheet age', blendModeValue: 'multiply' }, [pth(sheet, { closed: true, tension: 0.3 }),
    el('Stroke', { thickness: 40, name: 'Stroke' }, [el('SolidColor', { colorValue: argb('B89660', 0.22), name: 'C' }), el('Feather', { strength: 34, name: 'F' })])]));

  // --- the sea: coastline with echo lines, wave marks
  const fxCoast = trimFx('coast', 4, 96);
  const coast = L.coast;
  const echo = (off, gapP, r) => {
    const out = [];
    let cur = [];
    for (let i = 0; i < coast.length; i++) {
      const a = coast[Math.max(0, i - 1)], b = coast[Math.min(coast.length - 1, i + 1)];
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const p = P(coast[i].x - ((b.y - a.y) / d) * -off + r.jit(0.5), coast[i].y + ((b.x - a.x) / d) * off + r.jit(0.5));
      if (r() < gapP) { if (cur.length > 1) out.push(cur); cur = []; continue; }
      cur.push(p);
    }
    if (cur.length > 1) out.push(cur);
    return out;
  };
  const cr = rng(11);
  s.add(shape('coast', [coast.map(jit(cr, 0.6))], { color: INK, w: 1.7, fx: fxCoast }));
  s.add(shape('coast echo', [...echo(7, 0, cr), ...echo(14, 0.05, cr)], { color: INK, w: 0.85, fx: fxCoast }));
  s.add(shape('coast echo far', [...echo(23, 0.16, cr), ...echo(34, 0.3, cr)], { color: argb('221C17', 0.7), w: 0.75, fx: fxCoast }));
  const waveFx = trimFx('waves', 70, 130);
  s.add(shape('waves', L.waves.map((wv) => {
    const r = rng(Math.round(wv.x * 7 + wv.y));
    const h = wv.w / 2;
    return [P(wv.x - h, wv.y), P(wv.x - h / 2, wv.y - 2.6), P(wv.x, wv.y), P(wv.x + h / 2, wv.y - 2.6), P(wv.x + h, wv.y)].map(jit(r, 0.3));
  }), { color: INK, w: 0.9, fx: waveFx }));

  // --- rivers, each running down from its source
  L.rivers.forEach((rv, ri) => {
    const t0 = 18 + ri * 10, t1 = t0 + 110;
    const all = rv.banks.flatMap((b) => b.pts);
    const total = all.length;
    let k0 = 0;
    for (const b of rv.banks) {
      const pts = b.pts;
      const left = [], right = [];
      pts.forEach((p, i) => {
        const a = pts[Math.max(0, i - 1)], c = pts[Math.min(pts.length - 1, i + 1)];
        const d = Math.hypot(c.x - a.x, c.y - a.y) || 1;
        const nx = -(c.y - a.y) / d, ny = (c.x - a.x) / d;
        const hw = lerp(1.4, 3.6, (k0 + i) / total);
        left.push(P(p.x + nx * hw, p.y + ny * hw));
        right.push(P(p.x - nx * hw, p.y - ny * hw));
      });
      const trimId = ids.next();
      const a0 = lerp(t0, t1, k0 / total), a1 = lerp(t0, t1, (k0 + pts.length) / total);
      s.add(shape(`river ${ri}`, [left, right], { color: INK, w: 0.95, trim: { mode: 'synchronized' }, trimId }));
      intro.push({ object: trimId, prop: 'end', to: 1, keys: [[0, 0, 'hold'], [Math.round(a0), 0, 'linear'], [Math.round(a1), 1]] });
      k0 += pts.length;
    }
  });

  // --- the lake: a long water with an inner line and ripples
  for (const lk of L.lakes) {
    const r = rng(41);
    const inner = lk.outline.map((p) => P(lk.c.x + (p.x - lk.c.x) * 0.9, lk.c.y + (p.y - lk.c.y) * 0.78)).map(jit(r, 0.4));
    const rip = [];
    for (let k = 0; k < 5; k++) {
      const x = lk.c.x + r.jit(lk.rx * 0.55), y = lk.c.y + r.jit(lk.ry * 0.4), w = r.range(8, 16);
      rip.push([P(x - w / 2, y), P(x, y - 1), P(x + w / 2, y)]);
    }
    const f = fx[bandOf(lk.c.x, lk.c.y)];
    s.add(shape('lake', [{ pts: lk.outline.map(jit(r, 0.4)), closed: true }], { fillC: PAPER, color: INK, w: 1.4, fx: f }));
    s.add(shape('lake inner', [{ pts: inner, closed: true }, ...rip], { color: INK, w: 0.7, fx: f }));
  }

  // --- flat ground marks, gathered per band: tufts, hatching, fields, marsh dots, whirls
  const perBand = () => Array.from({ length: B }, () => []);
  const groundInk = perBand(), groundDots = perBand(), fieldInk = perBand();
  for (const t of L.tufts) groundInk[bandOf(t.x, t.y)].push(...tuftPaths(t));
  for (const h of L.hatch) {
    for (let k = 0; k < h.n; k++) {
      const r = rng(Math.round(h.x * 13 + k));
      const y = h.y + k * 3.2, w = h.w * (1 - k * 0.18);
      groundInk[bandOf(h.x, h.y)].push([P(h.x - w / 2 + r.jit(1), y), P(h.x + w / 2 + r.jit(1), y + r.jit(0.5))]);
    }
  }
  for (const f of L.fields) fieldInk[bandOf(f.x, f.y)].push(...fieldPaths(f));
  for (const m of L.marsh) for (let k = 0; k < m.n; k++) groundDots[bandOf(m.x, m.y)].push(dotAt(m.x + k * 3.6, m.y));
  for (const wh of L.whirls) {
    const steps = Math.round(wh.turns * 2 * Math.PI * wh.R * 0.5 / 4.2);
    for (let k = 4; k < steps; k++) {
      const t = k / steps, a = wh.rot + t * wh.turns * TAU, rad = t * wh.R;
      groundDots[bandOf(wh.x, wh.y)].push(dotAt(wh.x + Math.cos(a) * rad, wh.y + Math.sin(a) * rad * 0.8));
    }
  }
  for (let k = 0; k < B; k++) {
    s.add(shape(`ground ${k}`, groundInk[k], { color: INK, w: 0.85, fx: fx[k] }));
    s.add(shape(`fields ${k}`, fieldInk[k], { fillC: PAPER, color: INK, w: 0.8, fx: fx[k] }));
    s.add(shape(`dots ${k}`, groundDots[k], { color: INK, w: 1.7, fx: fx[k] }));
  }

  // --- standing things, back to front: mountains, hills, trees, houses
  const standing = [];
  for (const m of L.mountains) {
    const r = rng(Math.round(m.x * 3 + m.y));
    const f = fx[bandOf(m.x, m.y)];
    const ink = shape('mountain', [m.outline.map(jit(r, 0.3)), m.ridgeLine.map(jit(r, 0.3)), ...m.lit, ...m.foot], { fillC: PAPER, color: INK, w: m.ridge ? 1.15 : 1.3, fx: f, tension: 0.35 });
    const shade = shape('shadow', m.shade, { color: INK, w: 2.1, fx: f, cap: 'butt', tension: 0 });
    standing.push({ y: m.y, xml: [ink, shade] });
  }
  for (const hl of L.hills) standing.push({ y: hl.y, xml: [shape('hill', hillPaths(hl), { fillC: PAPER, color: INK, w: 1.1, fx: fx[bandOf(hl.x, hl.y)] })] });
  for (const hs of L.houses) standing.push({ y: hs.y, xml: [shape('house', housePaths(hs), { fillC: PAPER, color: INK, w: 1.05, fx: fx[bandOf(hs.x, hs.y)], tension: 0 })] });
  const rows = new Map();
  for (const t of L.trees) {
    const key = `${t.row}:${bandOf(t.x, t.y)}:${t.black ? 1 : 0}`;
    if (!rows.has(key)) rows.set(key, { y: t.y, band: bandOf(t.x, t.y), black: t.black, trees: [] });
    rows.get(key).trees.push(t);
  }
  for (const row of rows.values()) {
    const list = row.trees.flatMap(treePaths);
    if (row.black) {
      const id = ids.next();
      standing.push({ y: row.y + 0.1, xml: [shape('dark trees', list, { fillC: INK, color: INK, w: 1.1, fx: fx[row.band], id, opacity: 0 })] });
      fadeIn(id, row.trees[0].x, row.y, 34);
    } else {
      standing.push({ y: row.y, xml: [shape('trees', list, { fillC: PAPER, color: INK, w: 1.1, fx: fx[row.band] })] });
    }
  }
  standing.sort((a, b) => a.y - b.y);
  for (const st of standing) s.add(...st.xml.filter(Boolean));

  // --- the frame: a heavy outer rule, a fine inner one
  const fxFrame = trimFx('frame', 0, 64);
  const fr = rng(21);
  const rect = (x0, y0, x1, y1, n = 40) => {
    const pts = [];
    const sideN = (a, b) => Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / n));
    const cs = [C(x0, y0), C(x1, y0), C(x1, y1), C(x0, y1)];
    cs.forEach((a, i) => {
      const b = cs[(i + 1) % 4];
      const k = sideN(a, b);
      for (let j = 0; j < k; j++) pts.push(j ? P(lerp(a.x, b.x, j / k) + fr.jit(0.6), lerp(a.y, b.y, j / k) + fr.jit(0.6)) : a);
    });
    return { pts, closed: true, tension: 0.2 };
  };
  s.add(shape('frame outer', [rect(14, 14, W - 14, H - 14)], { color: INK, w: 2.6, fx: fxFrame }));
  s.add(shape('frame inner', [rect(M - 12, M - 12, W - M + 12, H - M + 12), rect(M - 6, M - 6, W - M + 6, H - M + 6)], { color: INK, w: 0.8, fx: fxFrame }));
  // year ticks along the inner frame's top edge, like a graticule
  const ticks = [];
  for (let x = M + 40; x < W - M - 20; x += 60) ticks.push([C(x, M - 12), C(x, M - 6)], [C(x, H - M + 6), C(x, H - M + 12)]);
  for (let y = M + 40; y < H - M - 20; y += 60) ticks.push([C(M - 12, y), C(M - 6, y)], [C(W - M + 6, y), C(W - M + 12, y)]);
  s.add(shape('frame ticks', ticks, { color: INK, w: 0.8, fx: fxFrame }));

  // --- the cartouche: a framed title block with a scale of years
  const { cart } = L;
  const fxCart = trimFx('cartouche', 10, 76);
  const cx0 = cart.x0, cy0 = cart.y0, cx1 = cart.x1, cy1 = cart.y1;
  s.add(shape('cartouche', [rect(cx0, cy0, cx1, cy1, 60)], { fillC: PAPER, color: INK, w: 1.6, fx: fxCart }));
  const notch = (x, y, sx, sy) => [C(x + sx * 10, y), C(x + sx * 10, y + sy * 10), C(x, y + sy * 10)];
  s.add(shape('cartouche inner', [
    rect(cx0 + 6, cy0 + 6, cx1 - 6, cy1 - 6, 60),
    notch(cx0 + 6, cy0 + 6, 1, 1), notch(cx1 - 6, cy0 + 6, -1, 1), notch(cx1 - 6, cy1 - 6, -1, -1), notch(cx0 + 6, cy1 - 6, 1, -1),
  ], { color: INK, w: 0.8, fx: fxCart, tension: 0 }));
  // the scale: one box per year, alternately inked solid
  const ny = L.years.to - L.years.from + 1;
  const sx0 = cx0 + 60, sx1 = cx1 - 60, sy = cy1 - 40;
  const segW = (sx1 - sx0) / ny;
  const boxes = [], solids = [];
  for (let k = 0; k < ny; k++) {
    const a = sx0 + k * segW;
    boxes.push({ pts: [C(a, sy - 3.5), C(a + segW, sy - 3.5), C(a + segW, sy + 3.5), C(a, sy + 3.5)], closed: true, tension: 0 });
    if (k % 2 === 0) solids.push([C(a + 1, sy), C(a + segW - 1, sy)]);
  }
  s.add(shape('scale', boxes, { color: INK, w: 0.9, fx: fxCart }));
  s.add(shape('scale solid', solids, { color: INK, w: 6, fx: fxCart, cap: 'butt' }));
  const yearTicks = Array.from({ length: ny + 1 }, (_, k) => [C(sx0 + k * segW, sy + 3.5), C(sx0 + k * segW, sy + 8)]);
  s.add(shape('scale ticks', yearTicks, { color: INK, w: 0.9, fx: fxCart }));

  // --- compass rose, in the sea
  const cp = L.compass;
  const roseId = ids.next();
  const R = cp.R;
  const halves = [], halvesDark = [], roseInk = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const len = i % 2 ? R * 0.55 : R;
    const tip = P(Math.cos(a) * len, Math.sin(a) * len);
    const w = i % 2 ? 5 : 8;
    const sideL = P(Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w);
    const sideR = P(Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w);
    halvesDark.push({ pts: [C(0, 0), C(tip.x, tip.y), C(sideR.x * 0.98, sideR.y * 0.98)], closed: true, tension: 0 });
    halves.push({ pts: [C(0, 0), C(sideL.x, sideL.y), C(tip.x, tip.y), C(sideR.x, sideR.y)], closed: true, tension: 0 });
    roseInk.push({ pts: [C(sideL.x, sideL.y), C(tip.x, tip.y), C(sideR.x, sideR.y)], tension: 0 }, [C(0, 0), C(tip.x, tip.y)]);
  }
  // short points first, so the long ones sit on top
  const order = [1, 3, 5, 7, 0, 2, 4, 6];
  const roseTicks = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * TAU;
    const r0 = R * 0.8, r1 = R * (i % 4 === 0 ? 0.92 : 0.86);
    return [C(Math.cos(a) * r0, Math.sin(a) * r0), C(Math.cos(a) * r1, Math.sin(a) * r1)];
  });
  s.add(group({ name: 'compass', id: roseId, x: cp.x, y: cp.y, opacity: 0, scaleX: 0.6, scaleY: 0.6 }, [
    shape('rose ring', [{ pts: circle(0, 0, R * 0.8, R * 0.8, 24), closed: true }, { pts: circle(0, 0, R * 0.74, R * 0.74, 24), closed: true }], { fillC: PAPER, color: INK, w: 0.8 }),
    shape('rose ticks', roseTicks, { color: INK, w: 0.8 }),
    ...order.map((i) => group({ name: `point ${i}` }, [
      shape('half', [halves[i]], { fillC: PAPER, color: INK, w: 0.9 }),
      shape('dark half', [halvesDark[i]], { fillC: i === 0 ? RED : INK }),
      shape('edge', [roseInk[2 * i], roseInk[2 * i + 1]], { color: INK, w: 0.9 }),
    ])),
    shape('hub', [{ pts: circle(0, 0, 2.6, 2.6, 8), closed: true }], { fillC: PAPER, color: INK, w: 0.9 }),
  ]));
  tween(roseId, 'opacity', 0, 1, 70, 100);
  tween(roseId, 'scaleX', 0.6, 1, 70, 116, EASE.back);
  tween(roseId, 'scaleY', 0.6, 1, 70, 116, EASE.back);

  // --- a ship under sail
  const sh = L.ship;
  const shipId = ids.next(), shipRock = ids.next();
  const hull = [C(-26, -8), P(-14, 1), P(10, 1), C(26, -9), C(18, -9), C(-18, -8)];
  const sail = [C(-11, -16), P(-3, -24), C(-11, -38), P(-1, -33), C(10, -38), P(6, -24), C(10, -16), P(0, -17)];
  s.add(group({ name: 'ship', id: shipId, x: sh.x, y: sh.y, opacity: 0 }, group({ name: 'rock', id: shipRock }, [
    shape('sail', [{ pts: sail, closed: true, tension: 0.6 }], { fillC: PAPER, color: INK, w: 1.1 }),
    shape('hull', [{ pts: hull, closed: true, tension: 0.6 }], { fillC: PAPER, color: INK, w: 1.2 }),
    shape('rig', [[C(-1, -8), C(-1, -46)], [C(-1, -46), C(9, -43.5), C(-1, -41)], [C(-1, -14), C(-24, -8)], [C(-1, -36), C(-20, -9)], [C(-20, -4), C(18, -4)]], { color: INK, w: 0.9, tension: 0 }),
    shape('flag', [{ pts: [C(-1, -46), C(9, -43.5), C(-1, -41)], closed: true, tension: 0 }], { fillC: RED }),
    shape('wake', [[P(-34, 3), P(-28, 1), P(-22, 3)], [P(20, 3), P(27, 1), P(34, 3)], [P(-12, 6), P(0, 5), P(12, 6)]], { color: INK, w: 0.8 }),
  ])));
  tween(shipId, 'opacity', 0, 1, 90, 130);

  // --- a sea serpent, three coils and a curious head
  const sp = L.serpent;
  const serpId = ids.next(), serpBob = ids.next();
  const coils = [];
  for (let k = 0; k < 3; k++) {
    const x = -38 + k * 24;
    coils.push({ pts: [C(x - 8, 0), P(x - 7, -8), P(x, -12), P(x + 7, -8), C(x + 8, 0), P(x + 4.5, -5.5), P(x, -7), P(x - 4.5, -5.5)], closed: true, tension: 0.8 });
  }
  const head = [C(30, 0), P(30, -11), P(33, -19), P(40, -22), P(47, -20.5), C(49, -18), P(44, -16), P(38, -14), P(36, -8), C(37, 0)];
  const tail = [P(-58, -2), P(-56, -8), P(-51, -9), P(-49, -5), P(-52, -3)];
  s.add(group({ name: 'serpent', id: serpId, x: sp.x, y: sp.y, opacity: 0 }, group({ name: 'bob', id: serpBob }, [
    shape('coils', [...coils, { pts: head, closed: true, tension: 0.7 }], { fillC: PAPER, color: INK, w: 1.2 }),
    shape('tail', [tail], { color: INK, w: 1.2 }),
    shape('spines', [[C(-3, -12.5), C(-1, -16), C(1, -12.5)], [C(21, -12.5), C(23, -16), C(25, -12.5)], [C(33, -19), C(33, -25), C(37, -21)]], { color: INK, w: 0.9, tension: 0 }),
    shape('eye', [{ pts: circle(42, -18.6, 1.1, 1.1, 6), closed: true }], { fillC: INK }),
    shape('water', [[P(-62, 1), P(-50, 0)], [P(-31, 1), P(-24, 0), P(-17, 1)], [P(-7, 1), P(0, 0), P(7, 1)], [P(17, 1), P(24, 0), P(30, 1)], [P(38, 1), P(48, 0), P(56, 1)]], { color: INK, w: 0.8 }),
  ])));
  tween(serpId, 'opacity', 0, 1, 100, 140);

  // --- birds over the mountains
  const birdIds = L.birds.map((b) => {
    const id = ids.next();
    const k = b.s * 5;
    s.add(group({ name: 'bird', id, x: b.x, y: b.y, opacity: 0 }, [shape('v', [[P(-k, -k * 0.5), P(-k * 0.45, -k * 0.65), C(0, 0), P(k * 0.45, -k * 0.65), P(k, -k * 0.5)]], { color: INK, w: 0.9 })]));
    tween(id, 'opacity', 0, 1, 110 + b.i * 8, 150 + b.i * 8);
    return id;
  });

  // --- the road, the stops, the traveller
  const T0 = 150, HOLD = 16, SPEED = 6.4;
  const legsLen = L.at.slice(1).map((v, i) => v - L.at[i]);
  const arrive = [T0];
  legsLen.forEach((len, i) => arrive.push(arrive[i] + HOLD + Math.max(24, Math.round(len / SPEED))));
  const total = L.at.at(-1) || 1;
  const ease = (t) => t * t * (3 - 2 * t);
  // where the head of the road is at frame f (as a fraction of its length)
  const headAt = (f) => {
    if (f <= arrive[0]) return 0;
    for (let i = 0; i < arrive.length - 1; i++) {
      const go = arrive[i] + HOLD;
      if (f <= go) return L.at[i] / total;
      if (f <= arrive[i + 1]) return lerp(L.at[i], L.at[i + 1], ease((f - go) / (arrive[i + 1] - go))) / total;
    }
    return 1;
  };
  const routeTrim = ids.next(), routeDash = ids.next();
  const DASH = [9, 6, 7, 5.5, 11, 6.5, 8, 6];
  const dashSum = DASH.reduce((a, b) => a + b, 0);
  const lastF = arrive.at(-1);
  const trimKeys = [];
  for (let f = 0; f <= lastF; f += 3) trimKeys.push([f, headAt(f), 'linear']);
  trimKeys.push([lastF, 1, 'linear']);
  const routeXml = shape('road', [{ pts: L.route, tension: 0.8 }], { color: RED, w: 2.5, trim: { mode: 'sequential' }, trimId: routeTrim, dash: { id: routeDash, pattern: DASH }, cap: 'round' });
  intro.push({ object: routeTrim, prop: 'end', keys: trimKeys, to: 1 });

  const onTrim = ids.next(), onDash = ids.next();
  const onwardXml = shape('onward', [{ pts: L.onward, tension: 0.8 }], { color: RED, w: 2.2, trim: { mode: 'sequential' }, trimId: onTrim, dash: { id: onDash, pattern: [6, 7, 5, 8] }, opacity: 0.75 });
  intro.push({ object: onTrim, prop: 'end', to: 1, keys: [[0, 0, 'hold'], [lastF + 10, 0, 'cubic', [0.3, 0.2, 0.4, 1]], [lastF + 70, 1]] });
  // the arrow off the edge: a shaft, a head and fletching, like a signpost
  const ed = L.edge;
  const arrowId = ids.next();
  s.add(routeXml, onwardXml);
  s.add(group({ name: 'arrow', id: arrowId, x: ed.x, y: ed.y, opacity: 0 }, [
    shape('shaft', [[P(-30, 0), P(-6, -0.3), P(22, 0)]], { color: RED, w: 1.8 }),
    shape('head', [[C(14, -6), C(23, 0), C(14, 6)]], { color: RED, w: 1.8, tension: 0 }),
    shape('fletch', [[C(-30, 0), C(-36, -5)], [C(-30, 0), C(-36, 5)], [C(-24, 0), C(-30, -5)], [C(-24, 0), C(-30, 5)], [C(-18, 0), C(-24, -5)], [C(-18, 0), C(-24, 5)]], { color: RED, w: 1.4, tension: 0 }),
  ]));
  tween(arrowId, 'opacity', 0, 1, lastF + 60, lastF + 84);
  tween(arrowId, 'x', ed.x - 16, ed.x, lastF + 60, lastF + 90, EASE.back);

  // stop dots and landmarks
  const lifts = [];
  L.stops.forEach((st, i) => {
    const r = rng(300 + i);
    const t = arrive[i];
    const dotId = ids.next();
    const isNow = i === L.stops.length - 1;
    s.add(group({ name: `dot ${st.id}`, id: dotId, x: st.x, y: st.y, opacity: 0, scaleX: 2, scaleY: 2 }, [
      shape('dot', [{ pts: circle(0, 0, 3.6, 3.4, 8).map(jit(r, 0.2)), closed: true }], { fillC: RED }),
      shape('dot ring', [{ pts: circle(0, 0, 6.6, 6.2, 10).map(jit(r, 0.3)), closed: true }, ...(isNow ? [{ pts: blobPts(11.5, 10.5, r, { n: 11, wobble: 0.06 }).concat([P(12, -3)]) }] : [])], { color: RED, w: isNow ? 1.3 : 1 }),
    ]));
    tween(dotId, 'opacity', 0, 1, t - 4, t + 6);
    tween(dotId, 'scaleX', 2, 1, t - 4, t + 14);
    tween(dotId, 'scaleY', 2, 1, t - 4, t + 14);

    const mk = marker(st.kind, r);
    const liftId = ids.next(), stampId = ids.next(), ringId = ids.next(), shadowId = ids.next();
    const ring = blobPts(25 * MK, 23 * MK, r, { n: 12, wobble: 0.05 }).map((p) => P(p.x, p.y - 20 * MK));
    ring.push(P(ring[0].x - 2, ring[0].y + 5));
    s.add(group({ name: `lift ${st.id}`, id: liftId, x: st.x, y: st.y }, [
      el('Shape', { name: 'lift shadow', id: shadowId, y: -6, opacity: 0 }, [el('Ellipse', { width: 26, height: 5, originX: 0.5, originY: 0.5, name: 'E' }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb('221C17', 0.25), name: 'C' }))]),
      group({ name: 'stamp', id: stampId, opacity: 0, scaleX: MK * 1.7, scaleY: MK * 1.7 }, [
        shape('ground', mk.fills, { fillC: PAPER, tension: 0.4 }),
        shape('flag', mk.flags, { fillC: RED, color: RED, w: 0.8, tension: 0.6 }),
        shape('landmark', mk.red, { color: RED, w: 1.45, tension: 0.4 }),
      ]),
      shape('ring', [{ pts: ring.map(jit(r, 0.4)) }], { color: RED, w: 1.4, id: ringId, opacity: 0 }),
    ]));
    tween(stampId, 'opacity', 0, 1, t, t + 8);
    tween(stampId, 'scaleX', MK * 1.7, MK, t, t + 22, EASE.back);
    tween(stampId, 'scaleY', MK * 1.7, MK, t, t + 22, EASE.back);
    lifts.push({ liftId, ringId, shadowId, st });
  });

  // the traveller: a small cloaked walker with a staff, at the head of the road
  const walkId = ids.next(), bobId = ids.next(), walkerId = ids.next();
  const cloak = [C(-4.5, 0), P(-3.6, -6), C(-2.4, -10.5), P(0, -12), C(2.4, -10.5), P(3.4, -6), C(4.5, 0), P(0, 0.6)];
  s.add(group({ name: 'traveller', id: walkId, x: L.route[0].x, y: L.route[0].y, opacity: 0 }, group({ name: 'bob', id: bobId }, group({ name: 'walker', id: walkerId, y: -3 }, [
    shape('cloak', [{ pts: cloak, closed: true, tension: 0.7 }], { fillC: PAPER, color: INK, w: 1.05 }),
    shape('head', [{ pts: [C(-2.4, -10.5), P(-2.2, -14), C(0, -18.5), P(2.2, -14), C(2.4, -10.5)], closed: true, tension: 0.6 }], { fillC: PAPER, color: INK, w: 1.05 }),
    shape('staff', [[C(5.6, 1), C(6.6, -17)], [C(-1.5, 0), C(-2, 2.5)], [C(1.5, 0), C(2, 2.5)]], { color: INK, w: 1.05, tension: 0 }),
    shape('pack', [{ pts: circle(-4.2, -7.4, 2.4, 2.8, 7), closed: true }], { fillC: INK }),
  ]))));
  // sample the head of the road for the traveller's path
  const routeLen = [0];
  for (let i = 1; i < L.route.length; i++) routeLen.push(routeLen[i - 1] + Math.hypot(L.route[i].x - L.route[i - 1].x, L.route[i].y - L.route[i - 1].y));
  const pointAt = (frac) => {
    const d = frac * routeLen.at(-1);
    let i = 1;
    while (i < routeLen.length - 1 && routeLen[i] < d) i++;
    const a = L.route[i - 1], b = L.route[i];
    const t = (d - routeLen[i - 1]) / (routeLen[i] - routeLen[i - 1] || 1);
    return P(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  };
  const wx = [], wy = [];
  for (let f = T0 - 6; f <= lastF; f += 3) {
    const p = pointAt(headAt(f) * (L.at.at(-1) ? 1 : 0));
    wx.push([f, p.x, 'linear']);
    wy.push([f, p.y, 'linear']);
  }
  const lastS = L.stops.at(-1);
  // rest beside the last landmark, on the side away from its label
  const restSide = L.labels.at(-1).anchor === 'start' ? -1 : 1;
  const rest = P(lastS.x + restSide * 24, lastS.y + 10);
  wx.push([lastF + 26, rest.x, 'cubic', EASE.inOut]);
  wy.push([lastF + 26, rest.y, 'cubic', EASE.inOut]);
  intro.push({ object: walkId, prop: 'x', keys: [[0, L.route[0].x, 'hold'], ...wx], to: rest.x });
  intro.push({ object: walkId, prop: 'y', keys: [[0, L.route[0].y, 'hold'], ...wy], to: rest.y });
  tween(walkId, 'opacity', 0, 1, T0 - 20, T0);
  // a step bob while walking, sampled (it stops at each stop)
  const bob = [];
  for (let f = 0; f <= lastF + 26; f += 6) {
    const moving = f > T0 && (f >= lastF ? f < lastF + 26 : headAt(f + 3) !== headAt(f));
    bob.push([f, moving ? (Math.floor(f / 6) % 2 ? -1.6 : 0) : 0, 'linear']);
  }
  intro.push({ object: bobId, prop: 'y', keys: bob, to: 0 });
  // facing: flip when heading west
  const face = [];
  let lastFace = 1;
  for (let f = T0; f <= lastF; f += 6) {
    const a = pointAt(headAt(f)), b = pointAt(headAt(f + 6));
    const dir = Math.abs(b.x - a.x) < 0.3 ? lastFace : b.x >= a.x ? 1 : -1;
    if (dir !== lastFace || !face.length) face.push([f, dir, 'hold']);
    lastFace = dir;
  }
  face.push([lastF + 2, 1, 'hold']);
  intro.push({ object: walkerId, prop: 'scaleX', keys: [[0, 1, 'hold'], ...face], to: 1 });

  // ---------- state machine

  const dur = Math.max(...intro.map((t) => t.keys.at(-1)[0])) + 2;
  const introAnim = s.anim({ name: 'intro', duration: dur, tracks: intro.map((t) => ({ object: t.object, prop: t.prop, keys: t.keys })) });
  // cues for the page: it letters each label as its event arrives, so the
  // lettering keeps time with the road however fast the scene runs
  const cues = [[40, 'title'], [100, 'compass'], ...L.stops.map((st, i) => [arrive[i] + 4, `stop:${st.id}`]), [lastF + 70, 'onward'], [lastF + 90, 'done']];
  const cueXml = cues.map(([f, name]) => el('KeyedObject', { objectId: s.event(name) }, el('KeyedProperty', { property: 'trigger' }, el('KeyFrameCallback', { frame: f }))));
  s.anims[s.anims.length - 1] = s.anims.at(-1).replace(/<\/LinearAnimation>$/, `${cueXml.join('\n')}\n</LinearAnimation>`);
  const drawn = s.anim({ name: 'drawn', duration: 1, tracks: intro.map((t) => ({ object: t.object, prop: t.prop, keys: [[0, t.to]] })) });
  const a = ids.next(), b = ids.next();
  s.layers.push(s._layer('intro', [
    el('AnyState', { x: 100, y: -120 }),
    el('ExitState', { x: 700, y: -120 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: a })),
    el('AnimationState', { x: 300, y: 0, animationId: introAnim, id: a }, [
      el('StateTransition', { stateToId: b }, el('TransitionBoolCondition', { inputId: still, opValue: 'equal' })),
      el('StateTransition', { stateToId: b, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 }),
    ]),
    el('AnimationState', { x: 500, y: 0, animationId: drawn, id: b }),
  ]));

  // idle: marching dashes, a rocking ship, a bobbing serpent, drifting birds
  const LOOP = 480;
  const sine = (object, prop, base, amp, periods = 1, phase = 0, step = 30) => {
    const keys = [];
    for (let f = 0; f <= LOOP; f += step) keys.push([f, base + amp * Math.sin((f / LOOP) * TAU * periods + phase), 'linear']);
    return { object, prop, keys };
  };
  s.loopLayer('idle', s.anim({
    name: 'idle', duration: LOOP, loop: 'loop', tracks: [
      { object: routeDash, prop: 'offset', keys: [[0, 0, 'linear'], [LOOP, -dashSum * 2, 'linear']] },
      { object: onDash, prop: 'offset', keys: [[0, 0, 'linear'], [LOOP, -26 * 3, 'linear']] },
      sine(shipRock, 'rotation', 0, 0.045, 2),
      sine(shipRock, 'y', 0, 1.4, 2, 1.2),
      sine(serpBob, 'y', 0, 1.8, 2, 0.4),
      ...birdIds.map((id, i) => sine(id, 'x', L.birds[i].x, 14, 1, i * 1.7, 40)),
      ...birdIds.map((id, i) => sine(id, 'y', L.birds[i].y, 4, 2, i, 40)),
    ],
  }));

  // lift: spot = i + 1 raises that landmark, rings it and drops a shadow
  lifts.forEach(({ liftId, ringId, shadowId, st }, i) => {
    const pose = (up) => s.anim({
      name: `${up ? 'lift' : 'rest'} ${st.id}`, duration: 1, tracks: [
        { object: liftId, prop: 'y', keys: [[0, up ? st.y - 7 : st.y]] },
        { object: liftId, prop: 'scaleX', keys: [[0, up ? 1.18 : 1]] },
        { object: liftId, prop: 'scaleY', keys: [[0, up ? 1.18 : 1]] },
        { object: ringId, prop: 'opacity', keys: [[0, up ? 1 : 0]] },
        { object: shadowId, prop: 'opacity', keys: [[0, up ? 1 : 0]] },
        { object: shadowId, prop: 'y', keys: [[0, up ? 1 : -6]] },
      ],
    });
    const restA = pose(false), upA = pose(true);
    const r0 = ids.next(), r1 = ids.next();
    s.layers.push(s._layer(`lift ${i}`, [
      el('AnyState', { x: 100, y: -120 }),
      el('ExitState', { x: 500, y: -120 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: r0 })),
      el('AnimationState', { x: 200, y: 0, animationId: restA, id: r0 }, el('StateTransition', { stateToId: r1, duration: 160 }, el('TransitionNumberCondition', { inputId: spot, opValue: 'equal', value: i + 1 }))),
      el('AnimationState', { x: 400, y: 0, animationId: upA, id: r1 }, el('StateTransition', { stateToId: r0, duration: 260 }, el('TransitionNumberCondition', { inputId: spot, opValue: 'notEqual', value: i + 1 }))),
    ]));
  });

  // ---------- layout for the page: labels, timings, title block

  const sec = (f) => +(f / FPS).toFixed(3);
  const layout = {
    W, H, label: LABEL,
    stops: L.stops.map((st, i) => ({
      id: st.id, x: +st.x.toFixed(1), y: +st.y.toFixed(1), at: sec(arrive[i]),
      label: { ...L.labels[i], x: +L.labels[i].x.toFixed(1), y: +L.labels[i].y.toFixed(1), box: undefined },
    })),
    title: { x: (cx0 + cx1) / 2, y: cy0 + 54, sub: cy0 + 82 },
    scale: { label: { x: (sx0 + sx1) / 2, y: sy - 11 }, years: Array.from({ length: ny }, (_, k) => ({ x: +(sx0 + (k + 0.5) * segW).toFixed(1), y: sy + 21, text: String(L.years.from + k) })) },
    onward: { x: L.onwardLabel.x, y: L.onwardLabel.y, at: sec(lastF + 70) },
    compass: { x: cp.x, y: +(cp.y - R - 9).toFixed(1), at: sec(100) },
    done: sec(lastF + 90),
  };
  writeFileSync(resolve(import.meta.dirname, '../../site/journey/layout.json'), JSON.stringify(layout, null, 1) + '\n');
  if (process.env.JOURNEY_DEBUG) console.error(`journey: ${W}x${H}, ${L.trees.length} trees, ${L.mountains.length} mountains, ${rows.size} tree rows, arrive ${arrive.join(',')}`);

  return document(s.toXml());
}
