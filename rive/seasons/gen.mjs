// Draft 13 · Seasons — the winter woods grown into a whole year. The same
// spruce, birch, maple and fir, but every season-dependent thing (snow loads,
// buds, leaves, ground cover, the sun, weather, visiting birds, the canoe) is
// keyed on a 0..100 `year` input and blended between poses, so the page
// follows the calendar and a slider can scrub winter → winter.
import {
  Ids, Scene, rng, P, el, argb, pathXml, fill, stroke, solid, solidId, blobPts, resample, jitterPts,
  washShape, document, EASE, TAU, boil, inkShape,
} from '../lib/ink.mjs';
import { Season } from './season.mjs';

const INK = '2E3A44'; // cold slate ink
const SNOW = 'FFFFFF';
const SHADOW = '9DB6CC'; // blue snow shadow
const SPRUCE = '3D5C57';
const FIR = '466B5C';
const RUST = 'B4532E';
const CANOE = 'B8432F';
const BG = process.env.SEASONS_BG; // paper colour for CLI previews only
const YEAR0 = +(process.env.SEASONS_YEAR ?? 0); // initial year input for CLI previews

const ink = (a = 1) => argb(INK, a);

// ---------------------------------------------------------------- the calendar
// 0 = Jan 15 ... 16 = mid March ... 34 = mid May ... 50 = mid July ... 78 = late Oct ... 100 = Jan 15
const SNOW_ON_TREES = [[0, 1], [12, 1], [19, 0.5], [25, 0], [84, 0], [88, 0.45], [94, 1]];
const SNOW_ON_GROUND = [[0, 1], [14, 1], [21, 0.55], [27, 0], [84, 0], [87, 0.35], [92, 0.8], [100, 1]];
const PUDDLES = [[14, 0], [19, 1], [29, 1], [36, 0]];
const TRILLIUMS = [[27, 0], [32, 1], [42, 1], [47, 0]];
const WILDFLOWERS = [[43, 0], [49, 1], [66, 1], [72, 0]];
const FALLEN = [[70, 0], [76, 1], [88, 1], [93, 0]];
const CATKINS = [[15, 0], [21, 1], [30, 1], [34, 0]];
const BIRCH_LEAF_OP = [[26, 0], [32, 1], [76, 1], [81, 0.5], [85, 0]];
const BIRCH_LEAF_SC = [[26, 0.25], [34, 0.85], [42, 1], [86, 1]];
const BIRCH_LEAF_COL = [[28, 'C9DA6E'], [40, '86B257'], [62, '6E9E48'], [70, 'D9C54A'], [76, 'E9B733'], [84, 'C8912C']];
const BUDS = [[15, 0], [21, 1], [30, 1], [34, 0]];
const FLOWERS = [[26, 0], [30, 1], [36, 1], [41, 0]];
const MAPLE_LEAF_OP = [[30, 0], [35, 1], [77, 1], [81, 0.4], [85, 0]];
const MAPLE_LEAF_SC = [[30, 0.25], [36, 0.75], [43, 1], [86, 1]];
const MAPLE_LEAF_COL = [[32, 'B9D65C'], [44, '649A3E'], [62, '4F8236'], [68, '9CA43A'], [72, 'E6A02C'], [76, 'D44A2C'], [86, 'A63E24']];
const DRIED = [[0, 1], [18, 1], [26, 0], [86, 0], [91, 1]];
const ROBIN = [[22, 0], [24, 1], [52, 1], [55, 0]];
const DRAGONFLY = [[44, 0], [48, 1], [62, 1], [67, 0]];
const CANOE_DOWN = [[0, 1], [41, 1], [45, 0], [73, 0], [77, 1]];
const CANOE_UP = [[41, 0], [45, 1], [73, 1], [77, 0]];
// earth under the snow: thaw mud → spring green → summer grass → leaf litter → dun → (snow)
const EARTH = [[16, argb('7E6A56', 0.6)], [26, argb('8A7257', 0.62)], [34, argb('8FB063', 0.55)], [48, argb('7BA552', 0.55)], [64, argb('8FA85A', 0.52)], [72, argb('C49552', 0.5)], [80, argb('B47F49', 0.5)], [88, argb('9A8B76', 0.45)], [96, argb('9A8B76', 0.45)]];
const TUFT = [[0, ink(0.8)], [20, argb('8C7A5A', 0.85)], [32, argb('4F7F3A', 0.9)], [66, argb('4F7F3A', 0.9)], [76, argb('A08A4A', 0.9)], [86, argb('7A6E58', 0.85)], [94, ink(0.8)]];

// ---------------------------------------------------------------- shared bits

// keys that hide something until `t`, then ease it in
const appear = (id, t, len = 30, from = 0) => ({ object: id, prop: 'opacity', keys: [[0, from], [t, from, 'cubic', EASE.out], [t + len, 1]] });
const trimIn = (id, t, len) => ({ object: id, prop: 'end', keys: [[0, 0], [t, 0, 'cubic', [0.35, 0, 0.25, 1]], [t + len, 1]] });

// an ink line that draws on: soft bleed + crisp body, both trimmed together
function drawnLine(ids, pts, { width = 1.4, alpha = 1, tension = 1, color = INK, closed = false }, t, len, tracks) {
  const a = ids.next();
  const b = ids.next();
  tracks.push(trimIn(a, t, len), trimIn(b, t, len));
  return el('Shape', { name: 'line' }, [
    pathXml(pts, { tension, closed }),
    el('Stroke', { thickness: width * 2.3, cap: 'round', join: 'round', name: 'Bleed' }, [solid(argb(color, alpha * 0.14)), el('TrimPath', { end: 0, id: a, name: 'Trim' }), el('Feather', { strength: width * 1.4, name: 'F' })]),
    el('Stroke', { thickness: width, cap: 'round', join: 'round', name: 'Body' }, [solid(argb(color, alpha)), el('TrimPath', { end: 0, id: b, name: 'Trim' })]),
  ]);
}

// many short ticks in one shape (needles, grass, lenticels)
function ticks(segs, { width = 0.8, color, name = 'ticks', id, opacity, colorId }) {
  return el('Shape', { name, id, opacity }, [...segs.map((s) => pathXml(s, { tension: 0.6 })), stroke(color, width, { colorId })]);
}

// lumpy snow sitting on top of a line of points
function capPts(top, r, thick) {
  const n = top.length;
  const upper = top.map((p, i) => {
    const taper = Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 0.55);
    return P(p.x + r.jit(0.6), p.y - (thick * taper * r.range(0.75, 1.25) + 0.6));
  });
  const lower = [...top].reverse().map((p) => P(p.x, p.y + 1.2));
  return [...upper, ...lower];
}

function snowCap(r, top, thick, { id, opacity, name = 'snow' } = {}) {
  const pts = capPts(top, r, thick);
  const ridge = pts.slice(0, top.length);
  return el('Node', { name, id, opacity }, [
    el('Shape', { name: 'ridge' }, [pathXml(ridge, { tension: 0.8 }), stroke(argb('7F97AB', 0.55), 0.7)]),
    el('Shape', { name: 'cap' }, [pathXml(pts, { closed: true, tension: 0.8 }), fill(argb(SNOW, 1))]),
    el('Shape', { name: 'shade', y: 2.2 }, [pathXml(pts, { closed: true, tension: 0.8 }), fill(argb(SHADOW, 0.32), { feather: 2.2 })]),
  ]);
}

// a few flakes of snow that puff out and fall when a cap lets go
function puff(ids, r, c, start, tracks, n = 6, spread = 30) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const id = ids.next();
    const sz = r.range(2.2, 4.6);
    out.push(el('Shape', { name: 'puff', x: c.x, y: c.y, opacity: 0, id }, [
      el('Ellipse', { width: sz, height: sz, originX: 0.5, originY: 0.5, name: 'P' }),
      fill(argb('FFFFFF', 1)),
      stroke(argb('7F97AB', 0.95), 0.7),
    ]));
    const t0 = start + Math.round(r.range(0, 8));
    const len = Math.round(r.range(70, 120));
    const dx = r.jit(spread);
    const dy = r.range(60, 150);
    tracks.push(
      { object: id, prop: 'x', keys: [[t0, c.x + r.jit(spread * 0.3), 'cubic', EASE.out], [t0 + len, c.x + dx]] },
      { object: id, prop: 'y', keys: [[t0, c.y, 'cubic', [0.4, 0, 0.9, 0.6]], [t0 + len, c.y + dy]] },
      { object: id, prop: 'opacity', keys: [[0, 0], [t0, 0, 'linear'], [t0 + 6, 0.95], [t0 + Math.round(len * 0.6), 0.85], [t0 + len, 0]] },
    );
  }
  return out;
}

// a cap that slides off its bough with a puff, then quietly settles back
function slideTracks(capId, start, { drop = 22, back = 260 } = {}) {
  return [
    { object: capId, prop: 'y', keys: [[0, 0], [start, 0, 'cubic', [0.5, 0, 0.9, 0.5]], [start + 26, drop, 'hold'], [start + 27, -4], [start + back, -4, 'cubic', EASE.out], [start + back + 50, 0]] },
    { object: capId, prop: 'opacity', keys: [[0, 1], [start + 8, 1, 'cubic', EASE.in], [start + 26, 0, 'hold'], [start + back, 0, 'cubic', EASE.out], [start + back + 50, 1]] },
  ];
}

// wrap drawables in a node whose opacity the year controls (nesting keeps the
// intro's own opacity keys on the inner objects independent)
function seasonal(ids, yr, curve, kids, { name = 'seasonal', x, y } = {}) {
  const id = ids.next();
  yr.num(id, 'opacity', curve);
  return el('Node', { name, id, x, y }, [...kids].reverse());
}

// ---------------------------------------------------------------- conifers

function conifer(ids, r, { cx, base, height, maxW, tiers, color, alpha = 1, t0 = 0, club = false, snowiness = 0.75 }, tracks) {
  const back = [];
  const mid = [];
  const front = [];
  const caps = [];
  const top = P(cx + r.jit(4), base - height);
  const trunk = resample([P(cx, base), P(cx + r.jit(3), base - height * 0.4), P(cx + r.jit(3), base - height * 0.75), top], 8).map((p) => P(p.x + r.jit(0.8), p.y));
  mid.push(drawnLine(ids, trunk, { width: 1.7, alpha }, t0, 70, tracks));
  mid.push(drawnLine(ids, [P(cx - 3, base), P(cx - 2.4, base - 26)], { width: 1, alpha: alpha * 0.8 }, t0, 30, tracks));

  const bodyId = ids.next();
  const bodyPts = [];
  for (let k = 0; k <= 8; k++) {
    const f = k / 8;
    const yy = base - height * (0.04 + 0.94 * f);
    const ww = (maxW * Math.pow(1 - f, 0.9) + 5) * 0.75;
    bodyPts.push(P(cx + ww + r.jit(4), yy));
  }
  for (let k = 8; k >= 0; k--) {
    const f = k / 8;
    const yy = base - height * (0.04 + 0.94 * f) + 6;
    const ww = (maxW * Math.pow(1 - f, 0.9) + 5) * 0.75;
    bodyPts.push(P(cx - ww + r.jit(4), yy));
  }
  back.push(el('Node', { name: 'bodyWash', id: bodyId, opacity: 0 }, el('Shape', { name: 'body', x: 3, y: 2, blendModeValue: 'multiply' }, [pathXml(bodyPts, { closed: true, tension: 0.6 }), fill(argb(color, 0.28 * alpha), { feather: 9 })])));
  tracks.push(appear(bodyId, t0 + 60, 90));

  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1);
    const y = base - height * (0.05 + 0.93 * f) + r.jit(4);
    let w = maxW * Math.pow(1 - f, 0.85) + 7;
    if (club && f > 0.8) w *= 1.45 + r.range(0, 0.4);
    if (club && f > 0.25 && f < 0.75 && r() < 0.3) w *= 0.45;
    const tStart = t0 + 18 + Math.round(f * 110);
    for (const side of [-1, 1]) {
      if (r() < 0.08) continue;
      const L = w * r.range(0.6, 1.2);
      const sag = L * r.range(0.12, 0.3);
      const lift = r.range(-2, 4);
      const b = [P(cx, y - lift), P(cx + side * L * 0.33, y + sag * 0.35), P(cx + side * L * 0.7, y + sag * 0.95), P(cx + side * L, y + sag * 0.75 - 2)].map((p) => P(p.x + r.jit(1.2), p.y + r.jit(1.2)));
      mid.push(drawnLine(ids, b, { width: 1 + (1 - f) * 0.55, alpha, tension: 0.9 }, tStart, 26, tracks));
      const along = resample(b, Math.max(5, Math.round(L / 2.6)));
      const nId = ids.next();
      const segs = [];
      along.slice(1).forEach((p, k) => {
        const ln = r.range(4, 10) * (0.65 + (1 - f) * 0.55) * (1 - (k / along.length) * 0.35);
        segs.push([p, P(p.x + side * ln * r.range(0.2, 0.6) + r.jit(1), p.y + ln)]);
        if (k % 2 === 0) segs.push([p, P(p.x + side * r.range(1, 3), p.y - r.range(2, 4.5))]);
      });
      mid.push(ticks(segs, { width: 0.7, color: ink(alpha * 0.8), id: nId, opacity: 0 }));
      tracks.push(appear(nId, tStart + 10, 22));
      const under = [...along.map((p) => P(p.x, p.y - 2)), ...[...along].reverse().map((p, k) => P(p.x - side * 1, p.y + r.range(5, 9) * (0.7 + (1 - f) * 0.5) * (k / along.length + 0.3)))];
      const wId = ids.next();
      back.push(el('Node', { name: 'boughWash', id: wId, opacity: 0, x: r.jit(2) + 2, y: r.jit(2) + 2 }, washShape({ pts: under, color, alpha: 0.55 * alpha, edge: 0.6, soft: 1.6, tension: 0.6 })));
      tracks.push(appear(wId, tStart + 18, 40));
      if (r() < snowiness) {
        const capId = ids.next();
        const capTop = resample(b.slice(0, 4), 7).map((p) => P(p.x, p.y - 0.8));
        front.push(snowCap(r, capTop.slice(1, -1 - (r() < 0.5 ? 1 : 0)), r.range(2.4, 4.4) * (0.65 + (1 - f) * 0.7), { id: capId, opacity: 0 }));
        tracks.push(appear(capId, tStart + 40, 30));
        caps.push({ id: capId, c: along[Math.floor(along.length * 0.55)], L, side, f });
      }
    }
  }
  return { back, mid, front, caps, top };
}

// ---------------------------------------------------------------- white birch

function birch(ids, r, { x, base, height, w, lean = 0, t0 = 0 }, tracks) {
  const center = resample([P(x, base), P(x + lean * 0.3 + r.jit(3), base - height * 0.35), P(x + lean * 0.7 + r.jit(3), base - height * 0.7), P(x + lean, base - height)], 14);
  const half = (i) => (w / 2) * (1 - (i / (center.length - 1)) * 0.45);
  const L = center.map((p, i) => P(p.x - half(i) + r.jit(0.5), p.y));
  const R = center.map((p, i) => P(p.x + half(i) + r.jit(0.5), p.y));
  const body = [...L, ...[...R].reverse()];
  const parts = [];
  const bodyId = ids.next();
  parts.push(el('Node', { name: 'bark', id: bodyId, opacity: 0 }, [
    el('Shape', { name: 'shade' }, [pathXml(R.map((p, i) => P(p.x - half(i) * 0.35, p.y)), { tension: 0.9 }), stroke(argb('8EA0B1', 0.32), w * 0.32, { feather: 2 })]),
    el('Shape', { name: 'white' }, [pathXml(body, { closed: true, tension: 0.9 }), fill(argb('FFFFFF', 1))]),
  ].reverse()));
  tracks.push(appear(bodyId, t0 + 10, 50));
  parts.push(drawnLine(ids, L, { width: 1.3 }, t0, 80, tracks));
  parts.push(drawnLine(ids, R, { width: 1.1, alpha: 0.85 }, t0 + 6, 80, tracks));

  const marks = [];
  for (let k = 0; k < 44; k++) {
    const i = Math.floor(r.range(0.5, center.length - 1.5));
    const p = center[i];
    const hw = half(i);
    const len = hw * r.range(0.5, 1.15);
    const off = r.jit(hw - len / 2);
    const y = p.y + r.jit(6);
    marks.push([P(p.x + off - len / 2, y), P(p.x + off, y + r.jit(0.8)), P(p.x + off + len / 2, y + r.jit(0.8))]);
  }
  const eyes = [];
  for (let k = 0; k < 4; k++) {
    const i = Math.floor(r.range(2, center.length - 3));
    const p = center[i];
    const s = r.range(3, 5.5);
    eyes.push([P(p.x - s * 1.2, p.y - s * 0.4), P(p.x, p.y + s * 0.5), P(p.x + s * 1.2, p.y - s * 0.4)]);
  }
  const mId = ids.next();
  parts.push(el('Node', { name: 'marks', id: mId, opacity: 0 }, [
    ticks(marks.slice(0, 22), { width: 2.2, color: ink(0.85) }),
    ticks(marks.slice(22), { width: 1.2, color: ink(0.75) }),
    ticks(eyes, { width: 1.8, color: ink(0.9) }),
    ...[0, 1, 2].map(() => {
      const i = Math.floor(r.range(2, center.length - 2));
      const p = center[i];
      return el('Shape', { name: 'peel', x: p.x + r.jit(half(i) * 0.4), y: p.y }, [pathXml(blobPts(half(i) * 0.5, 4, r, { n: 7 }), { closed: true }), fill(argb('D7B48E', 0.35), { feather: 1.2 })]);
    }),
  ]));
  tracks.push(appear(mId, t0 + 60, 40));

  // twigs up top, more than the winter draft had: they carry the leaves
  const tip = center[center.length - 1];
  const anchors = [];
  for (let k = 0; k < 9; k++) {
    const p = center[center.length - 2 - k];
    const side = k % 2 ? 1 : -1;
    const a = P(p.x + side * r.range(16, 28), p.y - r.range(12, 24));
    const b = P(a.x + side * r.range(14, 26), a.y - r.range(14, 26));
    const tw = [p, a, b];
    parts.push(drawnLine(ids, tw, { width: 1 - k * 0.06 }, t0 + 70 + k * 8, 40, tracks));
    anchors.push({ p: b, side, drop: 1 }, { p: P((a.x + b.x) / 2, (a.y + b.y) / 2), side, drop: 0.8 });
    // a side shoot off each twig
    const c = P(a.x + side * r.range(4, 10), a.y - r.range(12, 22));
    parts.push(drawnLine(ids, [a, c], { width: 0.8 }, t0 + 90 + k * 8, 24, tracks));
    anchors.push({ p: c, side, drop: 0.7 });
  }
  parts.push(drawnLine(ids, [tip, P(tip.x + r.jit(6), tip.y - 30)], { width: 0.9 }, t0 + 78, 30, tracks));
  anchors.push({ p: P(tip.x + 2, tip.y - 26), side: 1, drop: 0.7 });
  return { parts, anchors };
}

// catkins in early spring, then a hanging cluster of small leaves whose colour
// walks from yellow-green to gold
function birchFoliage(ids, r, yr, anchors) {
  const out = [];
  anchors.forEach((a, k) => {
    const id = ids.next();
    const cid = ids.next();
    const n = 9 + Math.floor(r() * 5);
    const leaves = [];
    for (let i = 0; i < n; i++) {
      const ang = r.range(-0.4, 1.2) * a.side;
      const d = r.range(3, 20) * a.drop;
      leaves.push(el('Ellipse', { x: Math.sin(ang) * d * 0.5 + r.jit(7), y: d + r.jit(3), width: r.range(3.8, 5.2), height: r.range(6, 8.5), rotation: ang * 0.6 + r.jit(0.5), originX: 0.5, originY: 0.5, name: 'l' }));
    }
    const catk = [];
    for (let i = 0; i < 2; i++) catk.push([P(r.jit(4), 0), P(r.jit(3), 6 + r.range(4, 9))]);
    const catkId = ids.next();
    yr.num(id, 'opacity', BIRCH_LEAF_OP).scale(id, BIRCH_LEAF_SC).color(cid, BIRCH_LEAF_COL.map(([y, c]) => [y, argb(c, 0.78)]));
    yr.num(catkId, 'opacity', CATKINS);
    out.push(el('Node', { name: 'birchLeaves', x: a.p.x, y: a.p.y, id, scaleX: 0, scaleY: 0 }, [
      el('Shape', { name: 'leaves', blendModeValue: 'multiply' }, [...leaves, el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [solidId(argb('86B257', 0.78), cid), el('Feather', { strength: 0.9, name: 'F' })])]),
      el('Shape', { name: 'veins' }, [...leaves.map((x) => x), stroke(ink(0.35), 0.45)]),
    ]));
    out.push(el('Node', { name: 'catkins', x: a.p.x, y: a.p.y, id: catkId }, [
      ticks(catk, { width: 2.2, color: argb('C9A472', 0.85) }),
      ticks(catk, { width: 0.8, color: argb('8A6A3F', 0.8) }),
    ]));
  });
  return out;
}

// ---------------------------------------------------------------- ground

// ground drift: a long lumpy mound, white, with blue shadows pooled under things
function drift(r, { x0, x1, y, h, shadows = [], taperL = false, taperR = false }) {
  const n = 12;
  const top = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    let k = 0.55 + 0.45 * Math.sin(f * Math.PI);
    if (taperL) k *= Math.min(1, f * 3.2);
    if (taperR) k *= Math.min(1, (1 - f) * 3.2);
    top.push(P(x0 + (x1 - x0) * f, y + 26 - (h + 26) * k + (k > 0.05 ? r.jit(h * 0.12) : 0)));
  }
  const pts = [...top, P(x1, y + 200), P(x0, y + 200)];
  return [
    ...shadows.map((s) => el('Shape', { name: 'pool', x: s.x, y: s.y }, [pathXml(blobPts(s.rx, s.ry, r, { n: 9, wobble: 0.2 }), { closed: true }), fill(argb(SHADOW, 0.32), { feather: 7 })])),
    el('Shape', { name: 'drift' }, [pathXml(top, { tension: 0.8 }), stroke(argb('7F97AB', 0.5), 0.9)]),
    el('Shape', { name: 'driftBody' }, [pathXml(pts, { closed: true, tension: 0.6 }), fill(argb('FFFFFF', 0.92))]),
  ];
}

function trillium(r, x, y, s = 1) {
  const petals = [];
  const leaves = [];
  for (let k = 0; k < 3; k++) {
    const a = -Math.PI / 2 + (k * TAU) / 3 + r.jit(0.2);
    petals.push(el('Ellipse', { x: Math.cos(a) * 3.2 * s, y: Math.sin(a) * 3.2 * s, width: 4.2 * s, height: 7 * s, rotation: a + Math.PI / 2, originX: 0.5, originY: 0.5, name: 'p' }));
    const b = a + Math.PI / 3;
    leaves.push(el('Ellipse', { x: Math.cos(b) * 6 * s, y: Math.sin(b) * 6 * s + 2, width: 7 * s, height: 11 * s, rotation: b + Math.PI / 2, originX: 0.5, originY: 0.5, name: 'l' }));
  }
  return el('Node', { name: 'trillium', x, y }, [
    el('Shape', { name: 'petals' }, [...petals, fill(argb('FFFFFF', 0.96)), stroke(ink(0.4), 0.5)]),
    el('Shape', { name: 'centre' }, [el('Ellipse', { width: 2.2 * s, height: 2.2 * s, originX: 0.5, originY: 0.5, name: 'c' }), fill(argb('E8C64A', 1))]),
    el('Shape', { name: 'leaves', blendModeValue: 'multiply' }, [...leaves, fill(argb('4E8A3C', 0.75), { feather: 0.8 })]),
    el('Shape', { name: 'stem' }, [pathXml([P(0, 4), P(r.jit(1), 16 * s)]), stroke(argb('3E6E31', 0.9), 0.9)]),
  ]);
}

// a black-eyed susan or an ox-eye daisy on a stalk
function wildflower(r, x, y, kind) {
  const petals = [];
  const n = kind ? 9 : 11;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + r.jit(0.1);
    petals.push(el('Ellipse', { x: Math.cos(a) * 3.3, y: Math.sin(a) * 3.3, width: 2.2, height: 4.6, rotation: a + Math.PI / 2, originX: 0.5, originY: 0.5, name: 'p' }));
  }
  const h = r.range(14, 26);
  return el('Node', { name: 'flower', x, y }, [
    el('Shape', { name: 'petals', y: -h }, [...petals, fill(kind ? argb('F2B53B', 0.95) : argb('FFFFFF', 0.97)), stroke(ink(0.25), 0.4)]),
    el('Shape', { name: 'eye', y: -h }, [el('Ellipse', { width: 2.6, height: 2.6, originX: 0.5, originY: 0.5, name: 'c' }), fill(kind ? argb('3B2A1E', 1) : argb('E9C23D', 1))]),
    el('Shape', { name: 'stalk' }, [pathXml([P(0, 0), P(r.jit(2), -h * 0.55), P(r.jit(1), -h + 2)]), stroke(argb('4A7A36', 0.9), 0.8)]),
  ]);
}

// fallen leaves: small ovals in rust and gold, a few maple shapes
function litter(r, x0, x1, y, n) {
  const kinds = ['C8632C', 'D9962B', 'B4532E', 'E2B23A', '9C5A2D'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = r.pick(kinds);
    out.push(el('Shape', { name: 'leaf', x: r.range(x0, x1), y: y + r.jit(7), rotation: r.range(0, TAU), blendModeValue: 'multiply' }, [
      el('Ellipse', { width: r.range(5, 8), height: r.range(3, 4.5), originX: 0.5, originY: 0.5, name: 'l' }),
      fill(argb(c, 0.8), { feather: 0.6 }),
      stroke(ink(0.3), 0.4),
    ]));
  }
  return out;
}

// what the snow was hiding: a band of earth whose colour follows the year, with
// puddles, trilliums, summer flowers and autumn litter switched in and out
function earth(ids, r, yr, { x0, x1, y, trill = [], flowers = [], puddles = [], litterN = 14, taperL = false, taperR = false }) {
  const top = [];
  for (let i = 0; i <= 12; i++) {
    const f = i / 12;
    let k = 1;
    if (taperL) k = Math.min(1, f * 4);
    if (taperR) k = Math.min(1, (1 - f) * 4);
    top.push(P(x0 + (x1 - x0) * f, y + (1 - k) * 44 + (k > 0.05 ? r.jit(3) : 0)));
  }
  const cid = ids.next();
  yr.color(cid, EARTH);
  const band = el('Shape', { name: 'earth', blendModeValue: 'multiply' }, [
    pathXml([...top, P(x1, y + 200), P(x0, y + 200)], { closed: true, tension: 0.7 }),
    el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [solidId(argb('8A7257', 0.6), cid), el('Feather', { strength: 7, name: 'F' })]),
  ]);
  const edge = el('Shape', { name: 'edge' }, [pathXml(top.slice(taperL ? 2 : 0, taperR ? -2 : undefined).map((p) => P(p.x, p.y + 1)), { tension: 0.7 }), stroke(ink(0.22), 0.8, { feather: 1.2 })]);
  const pud = seasonal(ids, yr, PUDDLES, puddles.map((p) => el('Shape', { name: 'puddle', x: p.x, y: p.y }, [pathXml(blobPts(p.rx, p.ry, r, { n: 9, wobble: 0.2 }), { closed: true }), fill(argb('A9BFCB', 0.55), { feather: 2 }), stroke(argb('7A8F9C', 0.5), 0.6)])), { name: 'puddles' });
  const tr = seasonal(ids, yr, TRILLIUMS, trill.map(([x, yy, s]) => trillium(r, x, yy, s)), { name: 'trilliums' });
  const fl = seasonal(ids, yr, WILDFLOWERS, flowers.map(([x, yy, k]) => wildflower(r, x, yy, k)), { name: 'wildflowers' });
  const li = seasonal(ids, yr, FALLEN, litter(r, x0 + 10, x1 - 10, y + 6, litterN), { name: 'litter' });
  return [band, edge, pud, li, tr, fl];
}

// ---------------------------------------------------------------- artboards

function standL(ids) {
  const W = 460, H = 900;
  const s = new Scene(ids, { name: 'StandL', w: W, h: H, x: 0, y: 0, bg: BG });
  const year = s.input('number', 'year', YEAR0);
  const yr = new Season(s);
  const r = rng(31);
  const grow = [];
  const far = coniferAuto(ids, r, { cx: 265, base: 852, height: 600, maxW: 44, tiers: 26, color: '7C9790', alpha: 0.45, t0: 40, club: true });
  const near = coniferAuto(ids, r, { cx: 112, base: 868, height: 740, maxW: 58, tiers: 32, color: SPRUCE, alpha: 1, t0: 0, club: true });
  const bir = birch(ids, r, { x: 356, base: 884, height: 780, w: 22, lean: 14, t0: 90 }, grow);
  const tufts = [];
  for (const gx of [40, 205, 300, 420]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, 866), P(gx + k * 3 + r.jit(6) - 4, 866 - r.range(7, 16))]);
  const tuftId = ids.next();
  const tuftCol = ids.next();
  grow.push(appear(tuftId, 160, 40));
  yr.color(tuftCol, TUFT);
  const ground = drift(r, { x0: -30, x1: W - 6, y: 878, h: 26, taperR: true, shadows: [{ x: 140, y: 878, rx: 90, ry: 9 }, { x: 290, y: 870, rx: 60, ry: 7 }, { x: 380, y: 884, rx: 50, ry: 7 }] });
  const soil = earth(ids, r, yr, {
    x0: -30, x1: W + 4, y: 866, taperR: true,
    puddles: [{ x: 60, y: 882, rx: 34, ry: 5 }, { x: 250, y: 878, rx: 22, ry: 4 }],
    trill: [[30, 862, 1], [190, 858, 1.1], [300, 866, 0.9], [410, 864, 1]],
    flowers: [[48, 868, 1], [60, 870, 0], [230, 866, 1], [245, 869, 1], [330, 868, 0], [415, 866, 1]],
  });
  // leaves on the birch: hidden until the twigs are drawn
  const folId = ids.next();
  grow.push(appear(folId, 170, 50));
  const foliage = el('Node', { name: 'foliage', id: folId, opacity: 0 }, birchFoliage(ids, r, yr, bir.anchors).reverse());

  // ambient: every so often a clump lets go of a bough
  const amb = [];
  const ambCaps = near.caps.filter((c) => c.f > 0.25 && c.f < 0.6).slice(0, 1);
  const ambPuffs = [];
  for (const c of ambCaps) {
    amb.push(...slideTracks(c.id, 520));
    ambPuffs.push(...puff(ids, r, c.c, 520, amb, 7, 26));
  }
  const LOOP = 1100;
  const slideLoop = s.anim({ name: 'Ambient slide', duration: LOOP, loop: 'loop', tracks: amb });

  const interactive = near.caps.filter((c) => !ambCaps.includes(c) && c.f > 0.12 && c.f < 0.85).filter((_, i) => i % 3 === 0).slice(0, 5);
  const shakePuffs = [];
  const hits = [];
  interactive.forEach((c, k) => {
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    shakePuffs.push(...puff(ids, r, c.c, 0, tr, 7, 28));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x - c.side * 4, y: c.c.y - 4, id: hid }, [el('Ellipse', { width: c.L * 1.3, height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });
  // puffs of snow only make sense when there is snow
  const puffsNode = seasonal(ids, yr, SNOW_ON_TREES, [...ambPuffs, ...shakePuffs], { name: 'puffs' });

  s.add(
    ...far.back, ...far.mid, seasonal(ids, yr, SNOW_ON_TREES, far.front, { name: 'farSnow' }),
    ...soil,
    seasonal(ids, yr, SNOW_ON_GROUND, ground, { name: 'groundSnow' }),
    ...near.back, ...near.mid, seasonal(ids, yr, SNOW_ON_TREES, near.front, { name: 'nearSnow' }),
    ...bir.parts, foliage,
    ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts', colorId: tuftCol }),
    puffsNode, ...hits,
  );
  const intro = s.anim({ name: 'Grow', duration: 300, tracks: [...grow, ...gatherTracks()] });
  s.loopLayer('grow', intro);
  const wait = s.anim({ name: 'Wait', duration: 320, tracks: [] });
  s.sequenceLayer('ambient', [wait, slideLoop]);
  yr.build(year);
  return s.toXml();
}

let coniferTracks = [];
function gatherTracks() {
  const t = coniferTracks;
  coniferTracks = [];
  return t;
}
function coniferAuto(ids, r, opts) {
  return conifer(ids, r, opts, coniferTracks);
}

// ---------- sugar maple branch reaching in from the top right, with a chickadee

function growBranch(r, { origin, angle, length, thick, depth, speed = 3, bounds }) {
  const segs = [];
  const tips = [];
  function branch(start, ang, len, th, d, t0, bias) {
    const n = Math.max(2, Math.round(len / 50));
    let p = start, t = t0, a = ang;
    for (let i = 0; i < n; i++) {
      a += r.jit(0.3) + bias * 0.1;
      const L = (len / n) * r.range(0.8, 1.2);
      const q = P(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L);
      if (bounds && (q.x < bounds.x0 || q.y < bounds.y0 || q.y > bounds.y1)) break;
      const w0 = th * (1 - (i / n) * 0.5);
      const w1 = th * (1 - ((i + 1) / n) * 0.5);
      const dur = L / speed;
      segs.push({ a: p, b: q, w: (w0 + w1) / 2, t0: t, t1: t + dur });
      if (d > 0 && i < n - 1 && r() < (d > 1 ? 0.6 : 0.4)) {
        const side = r() < 0.5 ? -1 : 1;
        branch(q, a + side * r.range(0.45, 0.85) + (Math.cos(a) < 0 ? 0.25 : -0.25), len * r.range(0.35, 0.55), w1 * 0.6, d - 1, t + dur, -side);
      }
      p = q;
      t += dur;
    }
    tips.push({ p, a, t, th });
    if (d > 0 && th > 3) branch(p, a + r.jit(0.4), len * 0.5, th * 0.5, d - 1, t, 0);
  }
  branch(origin, angle, length, thick, depth, 0, 0);
  return { segs, tips };
}

function mapleLeaf(r) {
  const pts = [];
  const lobes = [[0, 13], [0.5, 6], [0.9, 11], [1.35, 5], [1.65, 8], [2.2, 3]];
  for (const side of [1, -1]) {
    const arr = lobes.map(([a, rr]) => {
      const ang = -Math.PI / 2 + side * a;
      return P(Math.cos(ang) * rr * r.range(0.9, 1.1), Math.sin(ang) * rr * r.range(0.9, 1.1) + 2);
    });
    pts.push(...(side === 1 ? arr : arr.reverse()));
  }
  pts.push(P(0, 6));
  return pts;
}

// a living maple leaf: grows from nothing in May, colours through the year,
// lets go in late October (each one a little differently)
function liveLeaf(ids, r, yr, { x, y, rotation, scale = 0.8, fallOffset = 0 }) {
  const id = ids.next();
  const cid = ids.next();
  const lp = mapleLeaf(r);
  const o = fallOffset;
  yr.num(id, 'opacity', [[30, 0], [35, 1], [77 + o, 1], [81 + o, 0.4], [85 + o, 0]]);
  yr.scale(id, MAPLE_LEAF_SC.map(([yy, v]) => [yy, v * scale]));
  yr.color(cid, MAPLE_LEAF_COL.map(([yy, c]) => [yy, argb(c, 0.8)]));
  return el('Node', { name: 'leaf', x, y, rotation, id, scaleX: 0, scaleY: 0 }, [
    el('Shape', { name: 'stem' }, [pathXml([P(0, 0), P(0.5, 4), P(0, 8)]), stroke(ink(0.7), 0.7)]),
    el('Node', { name: 'blade', y: 18 }, [
      el('Shape', { name: 'wash', x: 1, y: 0.8, blendModeValue: 'multiply' }, [pathXml(lp, { closed: true, tension: 0.35 }), el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [solidId(argb('649A3E', 0.8), cid), el('Feather', { strength: 1, name: 'F' })])]),
      inkShape({ pts: lp, closed: true, tension: 0.35, color: ink(0.7), width: 0.7, bleed: 0 }),
      inkShape({ pts: [P(0, 8), P(0, -10)], color: ink(0.45), width: 0.5, bleed: 0 }),
    ].reverse()),
  ].reverse());
}

function chickadee(ids, s, r, { headId, wingId, tailId }) {
  const ox = 0, oy = -14;
  const bodyPts = blobPts(13, 9.5, r, { n: 10, wobble: 0.05 }).map((p) => P(p.x + ox + 1, p.y + oy));
  const washes = [
    el('Shape', { name: 'belly' }, [pathXml(blobPts(10, 6, r, { n: 8 }).map((p) => P(p.x + ox - 1, p.y + oy + 4)), { closed: true }), fill(argb('F1E7D2', 0.95), { feather: 1.5 })]),
    el('Shape', { name: 'flank', blendModeValue: 'multiply' }, [pathXml(blobPts(7, 4, r, { n: 7 }).map((p) => P(p.x + ox + 6, p.y + oy + 3)), { closed: true }), fill(argb('D9AE7C', 0.75), { feather: 2 })]),
    el('Shape', { name: 'back', blendModeValue: 'multiply' }, [pathXml(blobPts(12, 6, r, { n: 8 }).map((p) => P(p.x + ox + 3, p.y + oy - 3)), { closed: true }), fill(argb('9AA4AB', 0.8), { feather: 1.2 })]),
  ];
  const bodyInk = boil(s, {
    name: 'BirdInk', seed: 61, hold: 8,
    draw: (rr) => [
      inkShape({ pts: jitterPts(bodyPts, 0.5, rr), closed: true, color: ink(), width: 1.2, bleed: 0.12 }),
      inkShape({ pts: [P(-3, -8), P(-3.5, -2), P(-4, 0)], color: ink(), width: 1, bleed: 0 }),
      inkShape({ pts: [P(3, -8), P(3, -2), P(2.5, 0)], color: ink(), width: 1, bleed: 0 }),
      inkShape({ pts: [P(-7, 0), P(-1, 0.4), P(5, 0)], color: ink(0.9), width: 0.9, bleed: 0 }),
    ],
  });
  const wing = el('Node', { name: 'wing', x: 4, y: oy - 2, id: wingId }, [
    el('Shape', { name: 'wingWash', blendModeValue: 'multiply' }, [pathXml([P(-7, -3), P(4, -5), P(11, 0), P(2, 4), P(-6, 3)], { closed: true, tension: 0.7 }), fill(argb('6F7C86', 0.65), { feather: 0.8 })]),
    el('Shape', { name: 'wingInk' }, [pathXml([P(-6, -2), P(4, -4.5), P(11, 0)], { tension: 0.8 }), pathXml([P(-3, 1), P(4, 0.5), P(9, 1.5)], { tension: 0.8 }), stroke(argb('F5F2EA', 0.9), 0.8), stroke(ink(0.9), 0.5)]),
  ].reverse());
  const tail = el('Node', { name: 'tail', x: 12, y: oy + 1, id: tailId }, [
    el('Shape', { name: 'tailWash', blendModeValue: 'multiply' }, [pathXml([P(0, -2.5), P(14, 2), P(13, 5.5), P(0, 2.5)], { closed: true, tension: 0.3 }), fill(argb('7A858D', 0.8))]),
    el('Shape', { name: 'tailInk' }, [pathXml([P(0, -2.5), P(14, 2), P(13, 5.5), P(0, 2.5)], { tension: 0.3 }), stroke(ink(), 1)]),
  ].reverse());
  const hx = -11, hy = oy - 7;
  const headCircle = blobPts(7.5, 7, r, { n: 9, wobble: 0.04 });
  const capPtsH = [];
  for (let a = 180; a <= 360; a += 30) capPtsH.push(P(Math.cos((a * Math.PI) / 180) * 7.6, Math.sin((a * Math.PI) / 180) * 7.2));
  capPtsH.push(P(5, -0.5), P(-1, 0.6), P(-7.6, 0.2));
  const headInk = boil(s, {
    name: 'HeadInk', seed: 63, hold: 8,
    draw: (rr) => [inkShape({ pts: jitterPts(headCircle, 0.35, rr), closed: true, color: ink(), width: 1.1, bleed: 0.1 })],
  });
  const head = el('Node', { name: 'head', x: hx, y: hy, id: headId }, [
    el('Shape', { name: 'cheek' }, [pathXml(headCircle, { closed: true }), fill(argb('FBFAF6', 1))]),
    el('Shape', { name: 'cap' }, [pathXml(capPtsH, { closed: true, tension: 0.6 }), fill(argb('20262C', 0.95))]),
    el('Shape', { name: 'bib' }, [pathXml(blobPts(4, 3.2, r, { n: 7 }).map((p) => P(p.x - 1, p.y + 6)), { closed: true }), fill(argb('20262C', 0.92))]),
    headInk.xml,
    el('Shape', { name: 'beak' }, [pathXml([P(-7.3, -1.5), P(-11, -0.3), P(-7.2, 0.8)], { closed: true, tension: 0 }), fill(argb('2A2F33', 1))]),
    el('Shape', { name: 'eye' }, [el('Ellipse', { x: -3.6, y: -2.2, width: 1.1, height: 1.1, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFFFFF', 0.9))]),
  ].reverse());
  s.loopLayer('bird boil', bodyInk.animId);
  s.loopLayer('head boil', headInk.animId);
  return [tail, el('Shape', { name: 'bodyBase' }, [pathXml(bodyPts, { closed: true }), fill(argb('F6F2EA', 1))]), ...washes, bodyInk.xml, wing, head];
}

// an American robin, facing right, feet at (0,0): grey-brown back, brick breast
function robin(ids, r, { headId }) {
  const oy = -15;
  const bodyPts = blobPts(14, 10, r, { n: 10, wobble: 0.05 }).map((p) => P(p.x - 1, p.y + oy));
  const breast = blobPts(10, 7.5, r, { n: 8 }).map((p) => P(p.x + 2, p.y + oy + 3));
  const back = blobPts(12, 6, r, { n: 8 }).map((p) => P(p.x - 3, p.y + oy - 4));
  const headCircle = blobPts(7.5, 7, r, { n: 9, wobble: 0.04 });
  const hx = 11, hy = oy - 8;
  return [
    el('Shape', { name: 'tail' }, [pathXml([P(-10, oy - 2), P(-24, oy + 1), P(-23, oy + 5), P(-10, oy + 3)], { closed: true, tension: 0.3 }), fill(argb('5A5248', 0.9)), stroke(ink(0.9), 0.9)]),
    el('Shape', { name: 'bodyBase' }, [pathXml(bodyPts, { closed: true }), fill(argb('F3EEE4', 1))]),
    el('Shape', { name: 'breast', blendModeValue: 'multiply' }, [pathXml(breast, { closed: true }), fill(argb('D9642F', 0.85), { feather: 1.4 })]),
    el('Shape', { name: 'back', blendModeValue: 'multiply' }, [pathXml(back, { closed: true }), fill(argb('6E675E', 0.85), { feather: 1.2 })]),
    el('Shape', { name: 'wing', blendModeValue: 'multiply' }, [pathXml([P(-9, oy - 3), P(2, oy - 5), P(-2, oy + 4), P(-11, oy + 2)], { closed: true, tension: 0.6 }), fill(argb('5B554C', 0.75), { feather: 0.8 }), stroke(ink(0.7), 0.5)]),
    inkShape({ pts: bodyPts, closed: true, color: ink(), width: 1.2, bleed: 0.12 }),
    inkShape({ pts: [P(2, -8), P(2.5, -2), P(3, 0)], color: ink(), width: 1, bleed: 0 }),
    inkShape({ pts: [P(-3, -8), P(-3, -2), P(-3.5, 0)], color: ink(), width: 1, bleed: 0 }),
    el('Node', { name: 'head', x: hx, y: hy, id: headId }, [
      el('Shape', { name: 'cheek' }, [pathXml(headCircle, { closed: true }), fill(argb('5B554C', 0.95))]),
      el('Shape', { name: 'throat', blendModeValue: 'multiply' }, [pathXml(blobPts(4, 3, r, { n: 7 }).map((p) => P(p.x + 1, p.y + 6)), { closed: true }), fill(argb('F0E6D8', 0.9))]),
      inkShape({ pts: headCircle, closed: true, color: ink(), width: 1.1, bleed: 0.1 }),
      el('Shape', { name: 'beak' }, [pathXml([P(7.2, -1.5), P(11.5, -0.2), P(7.2, 0.9)], { closed: true, tension: 0 }), fill(argb('E0B33C', 1))]),
      el('Shape', { name: 'ring' }, [el('Ellipse', { x: 3.6, y: -2.2, width: 3.2, height: 3.2, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFFFFF', 0.95))]),
      el('Shape', { name: 'eye' }, [el('Ellipse', { x: 3.6, y: -2.2, width: 1.8, height: 1.8, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('1E2226', 1))]),
    ].reverse()),
  ];
}

function mapleTR(ids) {
  const W = 640, H = 560;
  const s = new Scene(ids, { name: 'MapleTR', w: W, h: H, x: 520, y: 0, bg: BG });
  const year = s.input('number', 'year', YEAR0);
  const yr = new Season(s);
  const r = rng(14);
  const tree = growBranch(r, { origin: P(W + 30, 120), angle: Math.PI + 0.12, length: 560, thick: 16, depth: 3, bounds: { x0: 14, y0: 10, y1: H - 14 } });
  const grow = [];
  const wood = [];
  const snow = [];
  const caps = [];
  const leafSpots = [];
  for (const seg of [...tree.segs].sort((a, b) => b.w - a.w)) {
    const pts = [seg.a, P((seg.a.x + seg.b.x) / 2 + r.jit(seg.w * 0.4), (seg.a.y + seg.b.y) / 2 + r.jit(seg.w * 0.4)), seg.b];
    const tone = Math.min(1, 0.55 + seg.w * 0.05);
    const a = ids.next();
    const b = ids.next();
    grow.push(trimIn(a, Math.round(seg.t0), Math.round(seg.t1 - seg.t0) + 2), trimIn(b, Math.round(seg.t0), Math.round(seg.t1 - seg.t0) + 2));
    wood.push(el('Shape', { name: 'wood' }, [
      pathXml(pts, { tension: 0.7 }),
      el('Stroke', { thickness: seg.w * 2, cap: 'round', join: 'round', name: 'Bleed' }, [solid(ink(0.1)), el('TrimPath', { end: 0, id: a, name: 'Trim' }), el('Feather', { strength: seg.w + 2, name: 'F' })]),
      el('Stroke', { thickness: Math.max(0.9, seg.w), cap: 'round', join: 'round', name: 'Body' }, [solid(ink(tone)), el('TrimPath', { end: 0, id: b, name: 'Trim' })]),
    ]));
    const ang = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
    if (seg.w > 2.4 && Math.abs(Math.sin(ang)) < 0.62 && r() < 0.85) {
      const top = resample(pts, 6).map((p) => P(p.x, p.y - seg.w / 2));
      const capId = ids.next();
      snow.push(snowCap(r, top, Math.min(7, 1.6 + seg.w * 0.55), { id: capId, opacity: 0 }));
      grow.push(appear(capId, Math.round(seg.t1) + 30, 40));
      caps.push({ id: capId, c: top[3], w: seg.w, len: Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y), seg });
    }
    // leaves grow along the thin wood, alternately each side
    if (seg.w < 5) {
      const len = Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y);
      const n = Math.max(1, Math.round(len / 36));
      for (let k = 0; k < n; k++) {
        const f = (k + 0.6) / n;
        const p = P(seg.a.x + (seg.b.x - seg.a.x) * f, seg.a.y + (seg.b.y - seg.a.y) * f);
        const side = k % 2 ? 1 : -1;
        leafSpots.push({ p, rot: ang + side * r.range(0.9, 1.5) + Math.PI / 2 + Math.PI, drop: side });
      }
    }
  }
  for (const t of tree.tips) if (t.th < 5) leafSpots.push({ p: t.p, rot: t.a + Math.PI / 2 + r.jit(0.4), drop: 0 });
  const introLen = Math.round(Math.max(...tree.segs.map((x) => x.t1))) + 80;

  // the living canopy (buds → flowers → leaves), hidden until the wood is drawn
  const folId = ids.next();
  grow.push(appear(folId, introLen - 60, 50));
  const leaves = [];
  const budDots = [];
  const flowerTicks = [];
  const inView = leafSpots.filter((sp) => sp.p.x > 24 && sp.p.x < W - 10 && sp.p.y > 24 && sp.p.y < H - 20);
  inView.forEach((sp, i) => {
    // leaves hang from their twig, splayed a little to either side
    const finalRot = sp.drop * 0.55 + r.jit(0.7);
    leaves.push(liveLeaf(ids, r, yr, { x: sp.p.x, y: sp.p.y, rotation: finalRot, scale: r.range(1.05, 1.55), fallOffset: r.range(-3, 3) }));
    budDots.push(el('Ellipse', { x: sp.p.x + r.jit(1.5), y: sp.p.y + r.jit(1.5), width: 2.6, height: 3.4, rotation: finalRot, originX: 0.5, originY: 0.5, name: 'b' }));
    if (i % 2 === 0) flowerTicks.push([P(sp.p.x, sp.p.y), P(sp.p.x + r.jit(3), sp.p.y + r.range(5, 9))], [P(sp.p.x, sp.p.y), P(sp.p.x + r.jit(4), sp.p.y + r.range(4, 8))]);
  });
  const budId = ids.next();
  const flId = ids.next();
  yr.num(budId, 'opacity', BUDS);
  yr.num(flId, 'opacity', FLOWERS);
  const buds = el('Shape', { name: 'buds', id: budId, opacity: 0 }, [...budDots, fill(argb('B83A3A', 0.9)), stroke(ink(0.5), 0.4)]);
  const flowers = el('Node', { name: 'flowers', id: flId, opacity: 0 }, [
    ticks(flowerTicks, { width: 1.8, color: argb('D6DE6A', 0.85) }),
    ticks(flowerTicks, { width: 0.6, color: argb('8A9A3A', 0.8) }),
  ]);
  const foliage = el('Node', { name: 'foliage', id: folId, opacity: 0 }, [buds, flowers, ...leaves].reverse());

  // two dried maple leaves still hanging on through the winter
  const leafNodes = [];
  const leafTips = tree.tips.filter((t) => t.th < 4 && t.p.x > 40 && t.p.y < H - 40 && t.p.y > 30).slice(0, 2);
  const leafIds = [];
  leafTips.forEach((tp, i) => {
    const id = ids.next();
    leafIds.push(id);
    const lp = mapleLeaf(r);
    leafNodes.push(el('Node', { name: 'leaf', x: tp.p.x, y: tp.p.y, rotation: 0.3 + i * 0.4, id, opacity: 0 }, [
      el('Shape', { name: 'stem' }, [pathXml([P(0, 0), P(1, 5), P(0, 9)]), stroke(ink(0.8), 0.8)]),
      el('Node', { name: 'blade', y: 20 }, [
        washShape({ pts: lp.map((p) => P(p.x + 1.5, p.y + 1)), color: i ? 'C27A3A' : RUST, alpha: 0.75, edge: 0.9, soft: 1, tension: 0.35 }),
        inkShape({ pts: lp, closed: true, tension: 0.35, color: ink(0.85), width: 0.8, bleed: 0 }),
        inkShape({ pts: [P(0, 8), P(0, -10)], color: ink(0.6), width: 0.6, bleed: 0 }),
      ].reverse()),
    ].reverse()));
    grow.push(appear(id, introLen - 40, 40));
  });
  const dried = seasonal(ids, yr, DRIED, leafNodes, { name: 'dried' });

  // the chickadee lands on a sturdy, level perch
  const level = (c) => Math.abs(Math.atan2(c.seg.b.y - c.seg.a.y, c.seg.b.x - c.seg.a.x));
  const perches = caps.filter((c) => c.w > 3 && c.w < 10 && c.seg.a.x < 500 && c.seg.a.x > 140 && c.seg.a.y > 110 && c.len > 30).sort((a, b) => level(a) - level(b));
  const perch = perches[0] || caps[0];
  const pa = perch.seg.a, pb = perch.seg.b;
  const perchAt = (f) => P(pa.x + (pb.x - pa.x) * f, pa.y + (pb.y - pa.y) * f - perch.w / 2 + 0.5);
  const home = perchAt(0.45);
  const away = perchAt(0.8);
  const birdId = ids.next(), headId = ids.next(), wingId = ids.next(), tailId = ids.next(), bodyId = ids.next();
  const bird = el('Node', { name: 'chickadee', x: home.x, y: home.y, id: birdId, opacity: 0, scaleX: 1.7, scaleY: 1.7 },
    el('Node', { name: 'squash', id: bodyId }, chickadee(ids, s, r, { headId, wingId, tailId }).reverse()));
  const land = introLen - 20;
  grow.push(
    { object: birdId, prop: 'opacity', keys: [[0, 0], [land, 0, 'linear'], [land + 10, 1]] },
    { object: birdId, prop: 'y', keys: [[0, home.y - 120], [land, home.y - 120, 'cubic', [0.2, 0.6, 0.4, 1]], [land + 34, home.y]] },
    { object: birdId, prop: 'x', keys: [[0, home.x - 90], [land, home.x - 90, 'cubic', EASE.out], [land + 34, home.x]] },
    { object: wingId, prop: 'scaleY', keys: [[land, -0.8, 'linear'], [land + 4, 1], [land + 8, -0.8], [land + 12, 1], [land + 16, -0.6], [land + 22, 1], [land + 30, 0.7], [land + 34, 1]] },
    { object: bodyId, prop: 'scaleY', keys: [[land + 32, 1, 'cubic', EASE.out], [land + 37, 0.84, 'cubic', EASE.back], [land + 52, 1]] },
  );

  // the robin comes back in April and sits on another branch
  const rp = perches.filter((c) => c !== perch && Math.abs(c.seg.a.x - pa.x) > 120).sort((a, b) => a.seg.a.x - b.seg.a.x)[0] || perches[1] || perch;
  const ra = rp.seg.a, rb = rp.seg.b;
  const rhome = P(ra.x + (rb.x - ra.x) * 0.5, ra.y + (rb.y - ra.y) * 0.5 - rp.w / 2 + 0.5);
  const robinHead = ids.next();
  const robinNode = seasonal(ids, yr, ROBIN, [el('Node', { name: 'robin', x: rhome.x, y: rhome.y, scaleX: 1.75, scaleY: 1.75 }, robin(ids, r, { headId: robinHead }).reverse())], { name: 'robinSeason' });

  const intro = s.anim({ name: 'Grow', duration: introLen + 60, tracks: grow });

  const IDLE = 720;
  const tilt = s.anim({
    name: 'Bird idle', duration: IDLE, loop: 'loop',
    tracks: [
      { object: headId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [70, 0, 'cubic', EASE.out], [78, 0.32, 'hold'], [150, 0.32, 'cubic', EASE.out], [158, 0, 'hold'], [300, 0, 'cubic', EASE.out], [306, -0.22, 'hold'], [340, -0.22, 'cubic', EASE.out], [346, 0.18, 'hold'], [380, 0.18, 'cubic', EASE.out], [388, 0, 'hold'], [560, 0, 'cubic', EASE.out], [566, 0.4, 'hold'], [600, 0.4, 'cubic', EASE.out], [608, 0, 'hold'], [IDLE, 0]] },
      { object: tailId, prop: 'rotation', keys: [[0, 0], [220, 0, 'cubic', EASE.out], [225, -0.35, 'cubic', EASE.inOut], [236, 0], [470, 0, 'cubic', EASE.out], [474, -0.3, 'cubic', EASE.inOut], [482, 0.05, 'cubic', EASE.inOut], [490, 0], [IDLE, 0]] },
      { object: robinHead, prop: 'rotation', keys: [[0, 0], [120, 0, 'cubic', EASE.out], [126, -0.3, 'hold'], [200, -0.3, 'cubic', EASE.out], [208, 0, 'hold'], [420, 0, 'cubic', EASE.out], [426, 0.25, 'hold'], [470, 0.25, 'cubic', EASE.out], [478, 0, 'hold'], [IDLE, 0]] },
      ...leafIds.map((id, i) => ({ object: id, prop: 'rotation', keys: [[0, 0.3 + i * 0.4, 'cubic', EASE.inOut], [IDLE / 2, 0.3 + i * 0.4 + (i ? -0.35 : 0.3), 'cubic', EASE.inOut], [IDLE, 0.3 + i * 0.4]] })),
    ],
  });
  const wait = s.anim({ name: 'Wait', duration: introLen + 60, tracks: [] });
  s.sequenceLayer('idle', [wait, tilt]);

  const hop = s.input('trigger', 'hop');
  const hopTracks = [];
  const hopTo = (from, to, t, len, lift) => {
    hopTracks.push(
      { object: birdId, prop: 'x', keys: [[t, from.x, 'cubic', EASE.inOut], [t + len, to.x]] },
      { object: birdId, prop: 'y', keys: [[t, from.y, 'cubic', EASE.out], [t + len / 2, Math.min(from.y, to.y) - lift, 'cubic', EASE.in], [t + len, to.y]] },
    );
  };
  hopTo(home, away, 0, 22, 18);
  hopTo(away, home, 60, 26, 26);
  const merged = {};
  for (const tr of hopTracks) (merged[tr.prop] ||= []).push(...tr.keys);
  const hopAnim = s.anim({
    name: 'Hop', duration: 110,
    tracks: [
      { object: birdId, prop: 'x', keys: merged.x },
      { object: birdId, prop: 'y', keys: merged.y },
      { object: birdId, prop: 'scaleX', keys: [[0, 1.7, 'hold'], [41, 1.7, 'hold'], [42, -1.7, 'hold'], [58, -1.7, 'hold'], [59, 1.7, 'hold'], [110, 1.7]] },
      { object: wingId, prop: 'scaleY', keys: [[0, 1], [4, -0.7], [8, 1], [12, -0.7], [18, 1], [60, 1], [64, -0.8], [68, 1], [72, -0.8], [76, 1], [82, -0.5], [88, 1]] },
      { object: bodyId, prop: 'scaleY', keys: [[0, 0.85, 'cubic', EASE.out], [6, 1.08, 'cubic', EASE.inOut], [22, 0.86, 'cubic', EASE.back], [34, 1], [60, 0.86, 'cubic', EASE.out], [66, 1.08], [86, 0.86, 'cubic', EASE.back], [100, 1]] },
      { object: headId, prop: 'rotation', keys: [[24, 0, 'cubic', EASE.out], [30, -0.3, 'hold'], [50, -0.3, 'cubic', EASE.out], [56, 0]] },
    ],
  });
  s.triggerLayer('hop', hop, hopAnim, { fromAny: false, mix: 0 });
  const birdHit = ids.next();

  const shakeCaps = caps.filter((c) => c !== perch && c !== rp && c.w > 3.2).slice(0, 4);
  const puffs = [];
  const hits = [];
  shakeCaps.forEach((c, k) => {
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    puffs.push(...puff(ids, r, c.c, 0, tr, 8, 26));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x, y: c.c.y, id: hid }, [el('Ellipse', { width: Math.max(40, c.len), height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });
  hits.push(el('Shape', { name: 'birdHit', x: home.x - 4, y: home.y - 24, id: birdHit }, [el('Ellipse', { width: 64, height: 54, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
  s.listen(birdHit, 'click', [Scene.fire(hop)]);
  s.listen(birdHit, 'enter', [Scene.fire(hop)]);

  s.add(
    ...wood.reverse(),
    seasonal(ids, yr, SNOW_ON_TREES, snow, { name: 'branchSnow' }),
    dried, foliage, robinNode, bird,
    seasonal(ids, yr, SNOW_ON_TREES, puffs, { name: 'puffs' }),
    ...hits,
  );
  s.loopLayer('grow', intro);
  yr.build(year);
  return s.toXml();
}

// ---------- balsam fir + the red canoe, bottom right

function dragonfly(ids, s, r) {
  const id = ids.next();
  const wl = ids.next(), wr = ids.next();
  const wing = (wid, sx) => el('Node', { name: 'wings', id: wid, scaleX: 1 }, [
    el('Shape', { name: 'w1' }, [el('Ellipse', { x: sx * 9, y: -3.5, width: 15, height: 4, rotation: sx * -0.25, originX: 0.5, originY: 0.5, name: 'w' }), fill(argb('C9DCE8', 0.55), { feather: 0.4 }), stroke(ink(0.45), 0.4)]),
    el('Shape', { name: 'w2' }, [el('Ellipse', { x: sx * 8, y: 1.5, width: 13, height: 3.6, rotation: sx * 0.2, originX: 0.5, originY: 0.5, name: 'w' }), fill(argb('C9DCE8', 0.5), { feather: 0.4 }), stroke(ink(0.4), 0.4)]),
  ]);
  const xml = el('Node', { name: 'dragonfly', x: 150, y: 500, id, rotation: 0.3 }, [
    el('Shape', { name: 'body' }, [pathXml([P(-2, -6), P(0, 4), P(1, 18)]), stroke(argb('3C7A8A', 0.95), 1.6)]),
    el('Shape', { name: 'head' }, [el('Ellipse', { y: -7, width: 3.6, height: 3.2, originX: 0.5, originY: 0.5, name: 'h' }), fill(argb('2E5F6B', 1))]),
    wing(wl, -1), wing(wr, 1),
  ].reverse());
  const LOOP = 600;
  const flick = [];
  for (let f = 0; f < LOOP; f += 2) flick.push([f, f % 4 ? 0.35 : 1, 'hold']);
  s.loopLayer('dragonfly', s.anim({
    name: 'Dragonfly', duration: LOOP, loop: 'loop',
    tracks: [
      { object: wl, prop: 'scaleX', keys: flick },
      { object: wr, prop: 'scaleX', keys: flick },
      { object: id, prop: 'x', keys: [[0, 150, 'cubic', EASE.inOut], [180, 196, 'cubic', EASE.inOut], [260, 192, 'cubic', EASE.inOut], [420, 128, 'cubic', EASE.inOut], [600, 150]] },
      { object: id, prop: 'y', keys: [[0, 500, 'cubic', EASE.inOut], [120, 482, 'cubic', EASE.inOut], [300, 516, 'cubic', EASE.inOut], [480, 488, 'cubic', EASE.inOut], [600, 500]] },
      { object: id, prop: 'rotation', keys: [[0, 0.3, 'cubic', EASE.inOut], [180, -0.4, 'cubic', EASE.inOut], [420, 0.6, 'cubic', EASE.inOut], [600, 0.3]] },
    ],
  }));
  return xml;
}

function firBR(ids) {
  const W = 520, H = 620;
  const s = new Scene(ids, { name: 'FirBR', w: W, h: H, x: 1200, y: 0, bg: BG });
  const year = s.input('number', 'year', YEAR0);
  const yr = new Season(s);
  const r = rng(52);
  const fir = coniferAuto(ids, r, { cx: 392, base: 586, height: 470, maxW: 88, tiers: 26, color: FIR, alpha: 1, t0: 30, snowiness: 0.85 });
  const small = coniferAuto(ids, r, { cx: 486, base: 590, height: 250, maxW: 46, tiers: 15, color: '7C9790', alpha: 0.5, t0: 60 });
  const grow = [];

  // the canoe, keel up, half buried (winter, spring and late autumn)
  const hull = [P(58, 590), P(84, 576), P(130, 565), P(200, 560), P(270, 563), P(318, 572), P(350, 590), P(300, 584), P(204, 582), P(110, 584)];
  const canoeId = ids.next();
  const keel = hull.slice(0, 7);
  const gunwale = [P(66, 588), P(110, 583), P(204, 581), P(300, 583), P(342, 588)];
  const canoeDown = el('Node', { name: 'canoe', id: canoeId, opacity: 0 }, [
    washShape({ pts: hull.map((p) => P(p.x + 3, p.y + 1.5)), color: CANOE, alpha: 0.9, edge: 0.9, soft: 1.1, tension: 0.6 }),
    el('Shape', { name: 'shine' }, [pathXml([P(120, 568), P(200, 563), P(268, 566)], { tension: 0.9 }), stroke(argb('F2B9A2', 0.55), 2.2, { feather: 1.2 })]),
    el('Shape', { name: 'gunwaleWash', blendModeValue: 'multiply' }, [pathXml(gunwale, { tension: 0.8 }), stroke(argb('6B3B22', 0.75), 3)]),
    inkShape({ pts: hull, closed: true, tension: 0.6, color: ink(), width: 1.3, bleed: 0.14 }),
    inkShape({ pts: gunwale, tension: 0.8, color: ink(0.75), width: 0.9, bleed: 0 }),
    seasonal(ids, yr, SNOW_ON_TREES, [snowCap(r, resample(keel, 11).slice(2, -2).map((p) => P(p.x, p.y - 0.4)), 7)], { name: 'canoeSnow' }),
  ].reverse());
  grow.push(appear(canoeId, 150, 50));

  // in summer it is righted on the shore, a paddle leaning on it
  const sheer = [P(56, 556), P(100, 566), P(200, 571), P(300, 566), P(352, 556)];
  const belly = [P(352, 556), P(332, 580), P(260, 592), P(200, 594), P(140, 592), P(78, 581), P(56, 556)];
  const side = [...sheer, ...belly.slice(1)];
  const canoeUp = seasonal(ids, yr, CANOE_UP, [
    el('Shape', { name: 'shadow', y: 4 }, [pathXml(blobPts(150, 7, r, { n: 10, wobble: 0.1 }).map((p) => P(p.x + 204, p.y + 592)), { closed: true }), fill(argb('5A5444', 0.22), { feather: 5 })]),
    washShape({ pts: side.map((p) => P(p.x + 2, p.y + 1.5)), color: CANOE, alpha: 0.9, edge: 0.9, soft: 1.1, tension: 0.5 }),
    el('Shape', { name: 'shine' }, [pathXml([P(110, 578), P(200, 585), P(290, 579)], { tension: 0.9 }), stroke(argb('F2B9A2', 0.45), 2.4, { feather: 1.4 })]),
    el('Shape', { name: 'inside', blendModeValue: 'multiply' }, [pathXml([P(62, 557), P(110, 563), P(200, 566), P(300, 563), P(346, 557), P(300, 561), P(200, 564), P(110, 561)], { closed: true, tension: 0.6 }), fill(argb('8C5A3A', 0.6), { feather: 0.8 })]),
    el('Shape', { name: 'gunwaleWash', blendModeValue: 'multiply' }, [pathXml(sheer, { tension: 0.8 }), stroke(argb('6B3B22', 0.75), 2.6)]),
    inkShape({ pts: side, closed: true, tension: 0.5, color: ink(), width: 1.3, bleed: 0.14 }),
    inkShape({ pts: [P(132, 562), P(134, 571)], color: ink(0.7), width: 0.9, bleed: 0 }),
    inkShape({ pts: [P(268, 562), P(266, 571)], color: ink(0.7), width: 0.9, bleed: 0 }),
    // the paddle
    el('Shape', { name: 'paddle', blendModeValue: 'multiply' }, [pathXml([P(176, 571), P(183, 576), P(188, 590), P(185, 599), P(178, 600), P(172, 590), P(171, 578)], { closed: true, tension: 0.7 }), fill(argb('C9A268', 0.85), { feather: 0.6 })]),
    inkShape({ pts: [P(176, 571), P(183, 576), P(188, 590), P(185, 599), P(178, 600), P(172, 590), P(171, 578), P(176, 571)], tension: 0.7, color: ink(0.85), width: 0.9, bleed: 0 }),
    inkShape({ pts: [P(177, 572), P(228, 548)], color: ink(0.85), width: 1.6, bleed: 0.1 }),
    inkShape({ pts: [P(226, 550), P(234, 544), P(236, 550)], color: ink(0.85), width: 1.2, bleed: 0 }),
  ], { name: 'canoeUp' });

  const ground = drift(r, { x0: 20, x1: W + 30, y: 598, h: 22, taperL: true, shadows: [{ x: 210, y: 598, rx: 140, ry: 9 }, { x: 400, y: 594, rx: 80, ry: 8 }] });
  const soil = earth(ids, r, yr, {
    x0: 0, x1: W + 30, y: 588, taperL: true,
    puddles: [{ x: 230, y: 604, rx: 40, ry: 5 }, { x: 470, y: 600, rx: 20, ry: 4 }],
    trill: [[40, 582, 1], [455, 584, 0.9], [300, 580, 1.1]],
    flowers: [[36, 590, 1], [46, 592, 1], [250, 588, 0], [470, 592, 1], [484, 590, 0]],
    litterN: 16,
  });
  const tuftId = ids.next();
  const tuftCol = ids.next();
  yr.color(tuftCol, TUFT);
  const tufts = [];
  for (const gx of [30, 160, 352]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, 597), P(gx + k * 3 + r.jit(6) - 4, 597 - r.range(6, 14))]);
  grow.push(appear(tuftId, 200, 40));

  const hits = [];
  const puffs = [];
  const interactive = fir.caps.filter((c) => c.f > 0.1 && c.f < 0.8).filter((_, i) => i % 3 === 1).slice(0, 4);
  interactive.forEach((c, k) => {
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    puffs.push(...puff(ids, r, c.c, 0, tr, 7, 26));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x, y: c.c.y - 4, id: hid }, [el('Ellipse', { width: c.L * 1.3, height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });

  const fly = seasonal(ids, yr, DRAGONFLY, [dragonfly(ids, s, r)], { name: 'dragonflySeason' });

  s.add(
    ...small.back, ...small.mid, seasonal(ids, yr, SNOW_ON_TREES, small.front, { name: 'smallSnow' }),
    ...fir.back, ...fir.mid, seasonal(ids, yr, SNOW_ON_TREES, fir.front, { name: 'firSnow' }),
    ...soil,
    seasonal(ids, yr, SNOW_ON_GROUND, ground, { name: 'groundSnow' }),
    seasonal(ids, yr, CANOE_DOWN, [canoeDown], { name: 'canoeDown' }), canoeUp,
    ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts', colorId: tuftCol }),
    fly,
    seasonal(ids, yr, SNOW_ON_TREES, puffs, { name: 'puffs' }), ...hits,
  );
  s.loopLayer('grow', s.anim({ name: 'Grow', duration: 300, tracks: [...grow, ...gatherTracks()] }));
  yr.build(year);
  return s.toXml();
}

// ---------- the sun: scroll slides it along its arc, the year lifts the arc and warms it

function sun(ids) {
  const s = new Scene(ids, { name: 'Sun', w: 420, h: 420, x: 1780, y: 0, bg: BG });
  const year = s.input('number', 'year', YEAR0);
  const yr = new Season(s);
  const r = rng(9);
  const seasonId = ids.next();
  const sunId = ids.next();
  const haloId = ids.next();
  const discCol = ids.next();
  const haloCol = ids.next();
  const hazeId = ids.next();
  const disc = el('Node', { name: 'season', id: seasonId }, el('Node', { name: 'sun', x: 120, y: 300, id: sunId }, [
    el('Shape', { name: 'disc' }, [pathXml(blobPts(36, 36, r, { n: 12, wobble: 0.03 }), { closed: true }), el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [solidId(argb('FFF0C4', 0.85), discCol), el('Feather', { strength: 3, name: 'F' })])]),
    el('Shape', { name: 'rim' }, [pathXml(blobPts(36, 36, r, { n: 12, wobble: 0.03 }), { closed: true }), stroke(argb('E8C98A', 0.35), 1.2, { feather: 1 })]),
    el('Shape', { name: 'glow', id: haloId }, [el('Ellipse', { width: 180, height: 180, originX: 0.5, originY: 0.5, name: 'P' }), el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [solidId(argb('FFF4D6', 0.55), haloCol), el('Feather', { strength: 46, name: 'F' })])]),
    // autumn haze: a wide, very soft warm veil
    el('Shape', { name: 'haze', id: hazeId, opacity: 0 }, [el('Ellipse', { width: 210, height: 170, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('F3D59A', 0.42), { feather: 46 })]),
  ]));
  s.add(disc);
  // the year: winter sun sits low and pale; summer rides high and warm; autumn hangs gold in haze
  yr.num(seasonId, 'y', [[0, 0], [16, -20], [34, -70], [50, -110], [68, -70], [80, -40], [92, -8], [100, 0]]);
  yr.num(seasonId, 'x', [[0, 0], [50, 30], [100, 0]]);
  yr.color(discCol, [[0, argb('FFF0C4', 0.85)], [24, argb('FFF2BE', 0.9)], [50, argb('FFE89A', 0.95)], [68, argb('FFD98A', 0.95)], [78, argb('F5C473', 0.95)], [88, argb('F7E7C6', 0.85)], [100, argb('FFF0C4', 0.85)]]);
  yr.color(haloCol, [[0, argb('FFF4D6', 0.55)], [34, argb('FFF2CC', 0.6)], [50, argb('FFEBB0', 0.7)], [74, argb('F6D79A', 0.7)], [88, argb('F7EEDC', 0.5)], [100, argb('FFF4D6', 0.55)]]);
  yr.num(hazeId, 'opacity', [[60, 0], [70, 0.7], [80, 1], [88, 0.3], [94, 0]]);
  yr.scale(haloId, [[0, 1], [50, 1.25], [74, 1.5], [88, 1.1], [100, 1]]);
  const scroll = s.input('number', 'scroll', 0);
  const low = s.anim({ name: 'Morning', duration: 1, tracks: [{ object: sunId, prop: 'x', keys: [[0, 110]] }, { object: sunId, prop: 'y', keys: [[0, 300]] }] });
  const high = s.anim({ name: 'Noon', duration: 1, tracks: [{ object: sunId, prop: 'x', keys: [[0, 300]] }, { object: sunId, prop: 'y', keys: [[0, 150]] }] });
  s.blendLayer('scroll', scroll, [{ anim: low, value: 0 }, { anim: high, value: 100 }]);
  const shimmerId = ids.next();
  s.loopLayer('shimmer', s.anim({ name: 'Shimmer', duration: 480, loop: 'pingPong', tracks: [{ object: haloId, prop: 'opacity', keys: [[0, 0.65, 'cubic', EASE.inOut], [480, 1]] }] }));
  s.loopLayer('rise', s.anim({ name: 'Rise', duration: 150, tracks: [{ object: seasonId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [150, 1]] }] }));
  yr.build(year);
  return s.toXml();
}

// ---------- weather over the whole page (fit cover): snow, rain, petals, fluff, leaves, geese

// wrap-around fall tracks for one particle: constant fall, `cycles` per loop
function fallTracks(id, { x0, phase, span, LOOP, cycles, sway, r, yTop = -20, drift = 0 }) {
  const per = LOOP / cycles;
  const ys = [];
  for (let c = 0; c < cycles; c++) {
    const t0 = c * per;
    const wrapAt = t0 + (1 - phase) * per;
    const yStart = yTop + phase * span;
    ys.push([Math.round(t0), yStart, 'linear'], [Math.round(wrapAt), yTop + span, 'hold'], [Math.round(wrapAt) + 1, yTop, 'linear']);
  }
  ys.push([LOOP, yTop + phase * span]);
  const seen = new Set();
  const xs = [];
  const n = 6;
  for (let k = 0; k <= n; k++) xs.push([Math.round((k / n) * LOOP), x0 + (k === n || k === 0 ? 0 : (k % 2 ? sway : -sway) + r.jit(4)) + drift * (k / n) * 0, 'cubic', EASE.inOut]);
  return [
    { object: id, prop: 'y', keys: ys.filter((k) => (seen.has(k[0]) ? false : seen.add(k[0]))).sort((a, b) => a[0] - b[0]) },
    { object: id, prop: 'x', keys: xs },
  ];
}

function weather(ids) {
  const W = 800, H = 900;
  const s = new Scene(ids, { name: 'Weather', w: W, h: H, x: 2240, y: 0, bg: BG });
  const year = s.input('number', 'year', YEAR0);
  const yr = new Season(s);
  const r = rng(101);
  const groups = [];
  const group = (name, curve, kids, animSpec) => {
    const id = ids.next();
    yr.num(id, 'opacity', curve);
    groups.push(el('Node', { name, id, opacity: 0 }, kids));
    s.loopLayer(name, s.anim({ ...animSpec, loop: 'loop' }));
  };

  // snow
  {
    const LOOP = 1800, flakes = [], tracks = [];
    for (let i = 0; i < 60; i++) {
      const id = ids.next();
      const near = r();
      const sz = 1.6 + near * 3.4;
      const x0 = r.range(0, W);
      flakes.push(el('Shape', { name: 'flake', x: x0, y: -20, id, opacity: 0.35 + near * 0.55 }, [
        el('Ellipse', { width: sz, height: sz * r.range(0.85, 1), originX: 0.5, originY: 0.5, name: 'P' }),
        fill(argb('B6C7D5', 0.8), { feather: near < 0.3 ? 1.2 : 0.4 }),
      ]));
      tracks.push(...fallTracks(id, { x0, phase: r(), span: H + 40, LOOP, cycles: near > 0.75 ? 3 : near > 0.35 ? 2 : 1, sway: 8 + near * 16, r }));
    }
    group('snow', [[0, 1], [12, 1], [19, 0], [84, 0], [88, 0.5], [94, 1]], flakes, { name: 'Snow', duration: LOOP, tracks });
  }
  // spring rain: thin fast streaks
  {
    const LOOP = 300, drops = [], tracks = [];
    for (let i = 0; i < 44; i++) {
      const id = ids.next();
      const x0 = r.range(0, W);
      const len = r.range(12, 22);
      drops.push(el('Shape', { name: 'drop', x: x0, y: -20, id, opacity: r.range(0.25, 0.55) }, [
        pathXml([P(0, 0), P(-len * 0.12, len)]), stroke(argb('8FA6B8', 0.9), 0.9),
      ]));
      const cycles = 2 + Math.floor(r() * 2);
      const per = LOOP / cycles, phase = r();
      const ys = [];
      for (let c = 0; c < cycles; c++) {
        const t0 = c * per, wrapAt = t0 + (1 - phase) * per;
        ys.push([Math.round(t0), -20 + phase * (H + 40), 'linear'], [Math.round(wrapAt), H + 20, 'hold'], [Math.round(wrapAt) + 1, -20, 'linear']);
      }
      ys.push([LOOP, -20 + phase * (H + 40)]);
      const seen = new Set();
      tracks.push({ object: id, prop: 'y', keys: ys.filter((k) => (seen.has(k[0]) ? false : seen.add(k[0]))).sort((a, b) => a[0] - b[0]) });
    }
    group('rain', [[15, 0], [19, 1], [29, 1], [34, 0]], drops, { name: 'Rain', duration: LOOP, tracks });
  }
  // blossom petals (serviceberry, cherry): slow, tumbling
  {
    const LOOP = 1500, petals = [], tracks = [];
    for (let i = 0; i < 22; i++) {
      const id = ids.next();
      const x0 = r.range(0, W);
      petals.push(el('Shape', { name: 'petal', x: x0, y: -20, id, opacity: r.range(0.6, 0.95), rotation: r.range(0, TAU) }, [
        el('Ellipse', { width: r.range(5, 7), height: r.range(3.2, 4.2), originX: 0.5, originY: 0.5, name: 'P' }),
        fill(argb('F4CBD3', 0.9), { feather: 0.5 }), stroke(argb('D98FA3', 0.5), 0.4),
      ]));
      tracks.push(...fallTracks(id, { x0, phase: r(), span: H + 40, LOOP, cycles: 1 + Math.floor(r() * 2), sway: 20 + r() * 30, r }));
      tracks.push({ object: id, prop: 'rotation', keys: [[0, 0, 'linear'], [LOOP, TAU * (2 + Math.floor(r() * 3)) * (r() < 0.5 ? -1 : 1)]] });
    }
    group('petals', [[30, 0], [34, 1], [40, 1], [44, 0]], petals, { name: 'Petals', duration: LOOP, tracks });
  }
  // summer: dandelion fluff drifting up and across
  {
    const LOOP = 1800, seeds = [], tracks = [];
    for (let i = 0; i < 16; i++) {
      const id = ids.next();
      const x0 = r.range(-40, W);
      const rays = [];
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI / 2 + (k - 4) * 0.26 + r.jit(0.08);
        rays.push([P(0, 0), P(Math.cos(a) * 7, Math.sin(a) * 7)]);
      }
      seeds.push(el('Node', { name: 'seed', x: x0, y: H + 20, id, opacity: r.range(0.5, 0.85), rotation: r.jit(0.4) }, [
        el('Shape', { name: 'stalk' }, [pathXml([P(0, 0), P(0.3, 9)]), stroke(argb('8A7A5A', 0.8), 0.5)]),
        el('Shape', { name: 'pappus' }, [...rays.map((sg) => pathXml(sg)), stroke(argb('FFFFFF', 0.95), 0.6)]),
        el('Shape', { name: 'pappusShade' }, [...rays.map((sg) => pathXml(sg)), stroke(argb('9FA8A0', 0.4), 1.4, { feather: 1 })]),
        el('Shape', { name: 'achene' }, [el('Ellipse', { y: 9.5, width: 1.6, height: 3, originX: 0.5, originY: 0.5, name: 'a' }), fill(argb('8A6A3A', 0.9))]),
      ].reverse()));
      const phase = r.range(0.03, 0.97);
      const per = LOOP;
      const yStart = H + 20 - phase * (H + 60);
      const wrapAt = Math.round((1 - phase) * per);
      const ys = [[0, yStart, 'linear'], [wrapAt, -40, 'hold'], [wrapAt + 1, H + 20, 'linear'], [LOOP, yStart]].filter((k, i, a) => i === 0 || k[0] > a[i - 1][0]);
      tracks.push({ object: id, prop: 'y', keys: ys });
      const xs = [];
      for (let k = 0; k <= 6; k++) xs.push([Math.round((k / 6) * LOOP), x0 + (k % 2 ? 26 : -26) * (k === 0 || k === 6 ? 0 : 1) + (k / 6) * 0, 'cubic', EASE.inOut]);
      tracks.push({ object: id, prop: 'x', keys: xs });
    }
    group('fluff', [[44, 0], [48, 1], [64, 1], [69, 0]], seeds, { name: 'Fluff', duration: LOOP, tracks });
  }
  // autumn: leaves tumbling down
  {
    const LOOP = 1500, leaves = [], tracks = [];
    const cols = ['D9542E', 'E39A2A', 'C9792F', 'E8B531', 'B4532E'];
    for (let i = 0; i < 20; i++) {
      const id = ids.next();
      const x0 = r.range(0, W);
      const c = r.pick(cols);
      const maple = r() < 0.45;
      const body = maple
        ? [pathXml(mapleLeaf(r).map((p) => P(p.x * 0.55, p.y * 0.55)), { closed: true, tension: 0.35 })]
        : [el('Ellipse', { width: r.range(6, 9), height: r.range(4, 5.5), originX: 0.5, originY: 0.5, name: 'P' })];
      leaves.push(el('Shape', { name: 'leaf', x: x0, y: -20, id, opacity: r.range(0.6, 0.95), rotation: r.range(0, TAU), blendModeValue: 'multiply' }, [
        ...body, fill(argb(c, 0.85), { feather: 0.5 }), stroke(ink(0.35), 0.4),
      ]));
      tracks.push(...fallTracks(id, { x0, phase: r(), span: H + 40, LOOP, cycles: 1 + Math.floor(r() * 2), sway: 30 + r() * 40, r }));
      tracks.push({ object: id, prop: 'rotation', keys: [[0, 0, 'linear'], [LOOP, TAU * (2 + Math.floor(r() * 3)) * (r() < 0.5 ? -1 : 1)]] });
    }
    group('leaves', [[70, 0], [74, 1], [82, 1], [87, 0]], leaves, { name: 'Leaves', duration: LOOP, tracks });
  }
  // geese going south: a V crossing high, flapping
  {
    const LOOP = 2600;
    const vId = ids.next();
    const geese = [];
    const tracks = [];
    const slots = [[0, 0], [-26, 14], [-52, 28], [-78, 42], [26, 16], [52, 32], [78, 48]];
    slots.forEach(([dx, dy], i) => {
      const wl = ids.next(), wr = ids.next();
      const gx = dx + r.jit(3), gy = dy + r.jit(3);
      geese.push(el('Node', { name: 'goose', x: gx, y: gy }, [
        el('Shape', { name: 'body' }, [pathXml([P(-5, 0), P(5, 0)]), stroke(ink(0.8), 1.8)]),
        el('Node', { name: 'wl', id: wl }, el('Shape', { name: 'w' }, [pathXml([P(-1, 0), P(-6, -6), P(-11, -7)], { tension: 0.5 }), stroke(ink(0.8), 1.3)])),
        el('Node', { name: 'wr', id: wr }, el('Shape', { name: 'w' }, [pathXml([P(1, 0), P(6, -6), P(11, -7)], { tension: 0.5 }), stroke(ink(0.8), 1.3)])),
      ].reverse()));
      const flap = [];
      const period = 34 + r.jit(4), off = Math.round(r.range(0, period));
      for (let f = off; f < LOOP; f += period) flap.push([Math.round(f), 1, 'cubic', EASE.inOut], [Math.round(f + period / 2), -0.6, 'cubic', EASE.inOut]);
      flap.sort((a, b) => a[0] - b[0]);
      const keys = flap.filter((k, j, a) => j === 0 || k[0] > a[j - 1][0]);
      tracks.push({ object: wl, prop: 'scaleY', keys }, { object: wr, prop: 'scaleY', keys });
    });
    const v = el('Node', { name: 'skein', id: vId, x: W + 140, y: 150, scaleX: 1.1, scaleY: 1.1 }, geese.reverse());
    tracks.push(
      { object: vId, prop: 'x', keys: [[0, W + 140, 'linear'], [1900, -200, 'hold'], [LOOP, W + 140]] },
      { object: vId, prop: 'y', keys: [[0, 120, 'linear'], [1900, 230, 'hold'], [LOOP, 120]] },
    );
    group('geese', [[65, 0], [69, 1], [82, 1], [86, 0]], [v], { name: 'Geese', duration: LOOP, tracks });
  }
  s.add(...groups);
  yr.build(year);
  return s.toXml();
}

// ---------- dividers: animal tracks that appear print by print; snow-blue in winter, mud otherwise

function tracksArtboard(ids, { name, x, kind }) {
  const s = new Scene(ids, { name, w: 240, h: 40, x, y: 1000, bg: BG });
  const year = s.input('number', 'year', YEAR0);
  const yr = new Season(s);
  const r = rng(kind === 'hare' ? 3 : 4);
  const prints = [];
  const tracks = [];
  const colIds = [];
  const printShape = (x, y, rx, ry, rot = 0) => {
    const cid = ids.next();
    colIds.push(cid);
    return [
      el('Shape', { name: 'dimple', x, y, rotation: rot }, [pathXml(blobPts(rx, ry, r, { n: 7, wobble: 0.12 }), { closed: true }), el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [solidId(argb(SHADOW, 0.7), cid), el('Feather', { strength: 0.8, name: 'F' })])]),
      el('Shape', { name: 'edge', x: x + 0.4, y: y - 0.6, rotation: rot }, [pathXml(blobPts(rx, ry, r, { n: 7, wobble: 0.1 }).slice(4), { tension: 0.8 }), stroke(ink(0.55), 0.6)]),
    ];
  };
  let t = 6;
  const add = (shapes) => {
    const id = ids.next();
    prints.push(el('Node', { name: 'print', id, opacity: 0 }, shapes));
    tracks.push({ object: id, prop: 'opacity', keys: [[0, 0], [t, 0, 'cubic', EASE.out], [t + 10, 1]] });
  };
  if (kind === 'hare') {
    for (let g = 0; g < 4; g++) {
      const gx = 24 + g * 50 + r.jit(3);
      add([...printShape(gx, 22 + r.jit(1), 2.2, 2.6), ...printShape(gx + 7, 19 + r.jit(1), 2.2, 2.6)]);
      t += 6;
      add([...printShape(gx + 19, 14 + r.jit(1), 5.5, 2.6, -0.1), ...printShape(gx + 19, 27 + r.jit(1), 5.5, 2.6, 0.1)]);
      t += 16;
    }
  } else {
    for (let k = 0; k < 9; k++) {
      const px = 22 + k * 23 + r.jit(1.5);
      const py = 20 + (k % 2 ? 2.5 : -2.5);
      add([...printShape(px, py, 3, 2.4), ...printShape(px + 4.5, py - 1.2, 0.9, 0.9), ...printShape(px + 4.5, py + 1.2, 0.9, 0.9)]);
      t += 9;
    }
  }
  const printCol = [[0, argb(SHADOW, 0.7)], [16, argb(SHADOW, 0.7)], [24, argb('8A6E55', 0.6)], [40, argb('8A6E55', 0.55)], [50, argb('A48E66', 0.45)], [66, argb('A48E66', 0.45)], [74, argb('9A6B45', 0.55)], [86, argb('8A7868', 0.6)], [94, argb(SHADOW, 0.7)]];
  for (const cid of colIds) yr.color(cid, printCol);
  s.add(...prints);
  s.loopLayer('walk', s.anim({ name: 'Walk', duration: t + 20, tracks }));
  yr.build(year);
  return s.toXml();
}

export default function () {
  const ids = new Ids(10);
  return document(
    standL(ids),
    mapleTR(ids),
    firBR(ids),
    sun(ids),
    weather(ids),
    tracksArtboard(ids, { name: 'HareTracks', x: 0, kind: 'hare' }),
    tracksArtboard(ids, { name: 'FoxTracks', x: 300, kind: 'fox' }),
  );
}
