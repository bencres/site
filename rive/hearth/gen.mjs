// Draft 19 · Hearth: the inside of the round-doored house in draft 16, in ink and
// watercolor. A round tunnel-hall with panelled walls, a tiled floor and a rug,
// lots of pegs, a hearth with a kettle, a deep armchair with a cat in it, a round
// window with the season outside, and pantry shelves of labelled jars and books.
//
// Two artboards share one file: Hall (the hero) and Door (the footer: the inside
// of the front door, with the hand-painted board hung beside it in HTML).
//
// Inputs, both artboards: season 0..3 (spring, summer, autumn, winter),
// time 0..4 (morning, day, late afternoon, dusk, night), still (skip the intro).
// Hall also: hour (0..24) and minute (0..60) for the mantel clock, regular (a
// returning visitor: their coat is on a peg), steaming (the kettle is on), and
// triggers pop, rattle, stir, breeze, sway, peek. Door: seeout, post.
//
// Performance: one shared boil clock per artboard, hard-edged glazes (feathers
// only on the two or three big soft ones), glows are radial gradients, the hour
// light is one gradient clipped to the room, season/time are 1-frame hold poses
// picked once at load, and weather loops only run in the season that shows them.
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, polyXml,
  fill, stroke, stippleShape, document, EASE,
} from '../lib/ink.mjs';

const SEASON0 = +(process.env.HE_SEASON ?? 2);
const TIME0 = +(process.env.HE_TIME ?? 1);
const REGULAR0 = process.env.HE_REGULAR ? 1 : 0;
const HOUR0 = +(process.env.HE_HOUR ?? 10.2);
const MIN0 = +(process.env.HE_MIN ?? 12);
const STEAM0 = process.env.HE_STEAM ? 1 : 0;
const SPEED = 0.95; // intro frame scale (60 fps)

const INK = 'FF2B231C'; // iron-gall brown-black
const INK_SOFT = 'FF5E554C';
const INK_WARM = 'FF6B3A1E';
const C = {
  plaster: 'EBD3A4',
  vault: 'B48A5C',
  wood: 'A27A4F',
  oak: 'B98A55',
  tile: 'C9946A',
  door: '3E7A50',
  brass: 'D2A23A',
  ochre: 'D9A93F',
  terra: 'C0603E',
  madder: 'A6533F',
  rose: 'D9738A',
  stone: 'B8A88A',
  cream: 'F2E8CF',
  ginger: 'D98E45',
  copper: 'C0703E',
  flame: 'E8823A',
  yolk: 'F5C451',
  lamp: 'F5C451',
  sky: '86B8DA',
  shadow: '6D6890',
  white: 'F2EEE6',
  butter: 'E9B93A',
  violet: '8E86C9',
};

// ---------- small helpers ----------

const group = (attrs, kids) => el('Node', attrs, [].concat(kids).filter(Boolean).reverse());
const alphaHex = (a) => Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
const circ = (cx, cy, rx, ry = rx, n = 16, a0 = 0) =>
  Array.from({ length: n }, (_, i) => P(cx + Math.cos(a0 + (i / n) * TAU) * rx, cy + Math.sin(a0 + (i / n) * TAU) * ry));
const arc = (cx, cy, R, a0, a1, n = 16) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return P(cx + Math.cos(a) * R, cy + Math.sin(a) * R); });
const rect = (x0, y0, x1, y1) => Object.assign([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], { sharp: true });
const tens = (pts, t) => (pts.sharp ? 0.04 : t);
const sharp = (pts) => Object.assign(pts, { sharp: true });
// resample a closed outline into many points, so smoothing can't bulge past long edges
const dense = (pts, step = 14) => {
  let len = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; len += Math.hypot(b.x - a.x, b.y - a.y); }
  return resample([...pts, pts[0]], Math.max(8, Math.round(len / step))).slice(0, -1);
};
const shift = (pts, dx, dy) => pts.map((p) => P(p.x + dx, p.y + dy));

function trace(pts, r, amt = 0.7, n) {
  const src = n ? resample(pts, n) : pts;
  return src.map((p) => P(p.x + r.jit(amt), p.y + r.jit(amt)));
}

function centroid(pts) {
  const s = pts.reduce((a, p) => P(a.x + p.x, a.y + p.y), P(0, 0));
  return P(s.x / pts.length, s.y / pts.length);
}

function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/**
 * Several pen lines in one Shape (one draw for many ticks). Each item is a
 * point list or { pts, closed }. `fx` hooks the strokes to a shared trim so the
 * line can draw itself on.
 */
function ink(list, r, { w = 1.6, amt = 0.6, n, color = INK, bleed = 0, fx, name = 'ink', tension = 1 } = {}) {
  const items = (Array.isArray(list[0]) || list[0]?.pts ? list : [list]).map((it) => (Array.isArray(it) ? { pts: it } : it));
  const paths = items.map((it) => pathXml(trace(it.pts, r, amt, it.n ?? n), { closed: it.closed, tension: tens(it.pts, it.tension ?? tension) }));
  const paints = [];
  if (bleed) paints.push(stroke(color.replace(/^../, alphaHex(bleed)), w * 2.2, { feather: w * 1.3, effect: fx }));
  paints.push(stroke(color, w, { effect: fx }));
  return el('Shape', { name }, [...paths, ...paints]);
}

// colour registry, so poses can re-tint a wash: key -> [{ id, role, alpha }]
const TINT = new Map();
function tintIds(key, ids, role, alpha) {
  if (!key) return undefined;
  const id = ids.next();
  if (!TINT.has(key)) TINT.set(key, []);
  TINT.get(key).push({ id, role, alpha });
  return id;
}
// pose values for every colour registered under `key`: colors[i] (and alpha scales ks[i])
function tint(push, key, colors, ks) {
  for (const t of TINT.get(key) || []) {
    push(t.id, 'colorValue', colors.map((c, i) => argb(t.role === 'rim' ? darken(c, 0.28) : c, Math.min(1, t.alpha * (ks ? ks[i] : 1)))), 'Color');
  }
}

/**
 * Watercolor for an outline in artboard coords: a hard-edged glaze with a pooled
 * rim (how a wash dries), a smaller wet-in-wet glaze (soft only on big areas),
 * and granulation. `off` misregisters the paint from the ink line.
 */
function wc(ids, pts, color, r, { alpha = 0.55, off = [2.5, 2], wobble = 2, grain = 0.8, soft, name = 'paint', key, id, opacity, blend = 'multiply', rimK = 1, hazy = false, tension, wetLayer = true } = {}) {
  const ten = pts.sharp ? 0.04 : tension ?? (pts.length <= 8 ? 0.3 : 1);
  const opaque = blend === 'normal' && alpha >= 0.9;
  const shape = pts.map((p) => P(p.x + off[0] + r.jit(wobble), p.y + off[1] + r.jit(wobble)));
  const c = centroid(shape);
  const wet = shape.map((p) => P(c.x + (p.x - c.x) * 0.76 + r.jit(wobble * 1.6), c.y + (p.y - c.y) * 0.72 + r.jit(wobble * 1.6)));
  const xs = shape.map((p) => p.x), ys = shape.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const area = (x1 - x0) * (y1 - y0);
  const useSoft = soft ?? area > 2600;
  const dots = [];
  const want = Math.min(110, Math.round((area / 120) * grain));
  for (let i = 0, tries = 0; i < want && tries < want * 6; tries++) {
    const d = P(r.range(x0, x1), r.range(y0, y1));
    if (inside(d, shape)) { dots.push({ ...d, r: r.range(0.35, 0.9) }); i++; }
  }
  const softness = Math.min(22, Math.max(3, Math.min(x1 - x0, y1 - y0) * 0.14));
  const g = tintIds(key, ids, 'glaze', alpha * (opaque ? 0.94 : 0.6));
  const rim = hazy ? undefined : tintIds(key, ids, 'rim', alpha * 0.55 * rimK);
  const w = tintIds(key, ids, 'wet', alpha * 0.42);
  const glazeFill = el('Fill', { name: 'Fill', fillRule: hazy ? 'clockwise' : undefined }, [
    el('SolidColor', { colorValue: argb(color, alpha * (opaque ? 0.94 : 0.6)), name: 'C', id: g }),
    hazy ? el('Feather', { strength: softness * 0.7, name: 'F' }) : '',
  ].filter(Boolean));
  const rimStroke = el('Stroke', { thickness: 1.3, cap: 'round', join: 'round', name: 'Rim' }, el('SolidColor', { colorValue: argb(darken(color, 0.28), alpha * 0.55 * rimK), name: 'C', id: rim }));
  const wetFill = el('Fill', { name: 'Fill', fillRule: useSoft ? 'clockwise' : undefined }, [
    el('SolidColor', { colorValue: argb(color, alpha * 0.42), name: 'C', id: w }),
    useSoft ? el('Feather', { strength: softness, name: 'F' }) : '',
  ].filter(Boolean));
  return group({ name, id, opacity }, [
    el('Shape', { name: 'glaze', blendModeValue: blend === 'normal' ? undefined : blend }, [pathXml(shape, { closed: true, tension: ten }), glazeFill, hazy ? '' : rimStroke].filter(Boolean)),
    wetLayer ? el('Shape', { name: 'wet', blendModeValue: blend === 'normal' ? undefined : blend }, [pathXml(wet, { closed: true, tension: ten }), wetFill]) : '',
    dots.length ? stippleShape({ name: 'grain', dots, color: argb('5E4A36', Math.min(0.3, alpha * 0.32)) }) : '',
  ]);
}

// one flat glaze (no rim, no wet layer): for small accents and keyed sky panes
function flat(pts, color, alpha, { name = 'flat', blend, colorId, tension = 1, x, y } = {}) {
  return el('Shape', { name, x, y, blendModeValue: blend === 'normal' ? undefined : blend }, [pathXml(pts, { closed: true, tension: tens(pts, tension) }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb(color, alpha), name: 'C', id: colorId }))]);
}

// a soft glow as one radial-gradient ellipse (cheaper than a feather)
function glow({ name = 'glow', x, y, w, h, color, alpha, id, opacity }) {
  const stops = [[0, alpha], [0.3, alpha * 0.66], [0.6, alpha * 0.26], [1, 0]];
  return el('Shape', { name, x, y, id, opacity }, [
    el('Ellipse', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'g' }),
    el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: 0, startY: 0, endX: w / 2, endY: 0, name: 'G' }, stops.map(([p, a]) => el('GradientStop', { colorValue: argb(color, a), position: p })))),
  ]);
}

function hit(id, x, y, w, h) {
  return el('Shape', { x, y, name: 'hit', id }, [el('Rectangle', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'R' }), fill('00000000')]);
}

// a paint-less shape used as a clipping mask
function mask(id, pts, { tension = 1 } = {}) {
  return el('Shape', { name: 'mask', id }, [pathXml(pts, { closed: true, tension })]);
}
const clipped = (attrs, maskId, kids) => el('Node', attrs, [el('ClippingShape', { sourceId: maskId, name: 'Clip' }), ...[].concat(kids).filter(Boolean).reverse()]);

// sample a function of phase into keyframes so loops can be authored as curves
function sampled(object, prop, frames, step, fn) {
  const keys = [];
  for (let f = 0; f <= frames; f += step) keys.push([Math.min(f, frames), fn(Math.min(f, frames) / frames), 'linear']);
  if (keys.at(-1)[0] !== frames) keys.push([frames, fn(1), 'linear']);
  return { object, prop, keys };
}

function scallop(cx, cy, R, r, { n = 40, bumps = 7, depth = 0.11, squash = 1 } = {}) {
  const pts = [];
  const ph = r.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + depth * Math.abs(Math.sin(a * bumps * 0.5 + ph)) + r.jit(0.025);
    pts.push(P(cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k * squash));
  }
  return pts;
}

function starPts(R) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const k = i % 2 ? 0.32 : 1;
    pts.push(P(Math.cos(a) * R * k, Math.sin(a) * R * k));
  }
  return pts;
}

// a flame tongue standing on `base`, leaning by `lean`
function tongue(cx, base, w, h, lean) {
  return [P(cx - w / 2, base), P(cx - w * 0.46, base - h * 0.38), P(cx - w * 0.16 + lean * 0.4, base - h * 0.74), P(cx + lean, base - h), P(cx + w * 0.22 + lean * 0.5, base - h * 0.62), P(cx + w * 0.5, base - h * 0.26), P(cx + w * 0.46, base)];
}

// ---------- scene plumbing: boil, draw-on, intro, poses ----------

class Kit {
  constructor(s) {
    this.s = s;
    this.ids = s.ids;
    this.boilTracks = [];
    this.intro = [];
  }
  // line boil: N re-traced cels swapped by a Solo; all boils share one animation
  boil({ name = 'boil', seed, draw, x, y, cels = 3 }) {
    const r = rng(seed);
    const soloId = this.ids.next();
    const celIds = [];
    const kids = [];
    for (let i = 0; i < cels; i++) {
      const cid = this.ids.next();
      celIds.push(cid);
      kids.push(el('Node', { name: `cel${i}`, id: cid }, [].concat(draw(r.fork(), i)).filter(Boolean).reverse()));
    }
    this.boilTracks.push({ object: soloId, prop: 'activeComponentId', type: 'Id', keys: celIds.map((c, i) => [i * 8, c, 'hold']) });
    return el('Solo', { name, x, y, activeComponentId: celIds[0], id: soloId }, kids);
  }
  // a shared trim that ink strokes hook onto, drawn on between t0 and t1
  fx(name, t0, t1) {
    const fxId = this.ids.next();
    const trimId = this.ids.next();
    this.s.add(el('GroupEffect', { name: `${name} draw`, id: fxId }, el('TrimPath', { start: 0, end: 0, modeValue: 'synchronized', id: trimId, name: 'Trim' })));
    this.intro.push({ object: trimId, prop: 'end', from: 0, to: 1, t0, t1, ease: [0.45, 0, 0.25, 1] });
    return fxId;
  }
  // a node that fades / swells / drops into place during the intro, pivoting at (cx, cy)
  in({ name, cx = 0, cy = 0, t0, t1, op = 0, sc = 1, dy = 0, ease }, kids) {
    const id = this.ids.next();
    if (op !== 1) this.intro.push({ object: id, prop: 'opacity', from: op, to: 1, t0, t1, ease: EASE.out });
    if (sc !== 1) {
      this.intro.push({ object: id, prop: 'scaleX', from: sc, to: 1, t0, t1, ease: ease || EASE.out });
      this.intro.push({ object: id, prop: 'scaleY', from: sc, to: 1, t0, t1, ease: ease || EASE.out });
    }
    if (dy) this.intro.push({ object: id, prop: 'y', from: cy + dy, to: cy, t0, t1, ease: ease || EASE.back });
    return el('Node', { name, id, x: cx, y: cy + dy, opacity: op, scaleX: sc === 1 ? undefined : sc, scaleY: sc === 1 ? undefined : sc }, group({ name: `${name} body`, x: -cx, y: -cy }, kids));
  }
  // any other property eased during the intro
  tween(object, prop, from, to, t0, t1, ease = EASE.inOut) {
    this.intro.push({ object, prop, from, to, t0, t1, ease });
  }
  // intro plays once, then a 1-frame pose holds the drawn state; `still` jumps there
  finish(stillId) {
    const s = this.s;
    const T = (f) => Math.round(f * SPEED);
    const dur = Math.max(...this.intro.map((t) => T(t.t1))) + 2;
    const intro = s.anim({
      name: 'intro', duration: dur,
      tracks: this.intro.map((t) => ({
        object: t.object, prop: t.prop,
        keys: T(t.t0) > 0 ? [[0, t.from, 'hold'], [T(t.t0), t.from, 'cubic', t.ease], [T(t.t1), t.to]] : [[0, t.from, 'cubic', t.ease], [T(t.t1), t.to]],
      })),
    });
    const done = s.anim({ name: 'drawn', duration: 1, tracks: this.intro.map((t) => ({ object: t.object, prop: t.prop, keys: [[0, t.to]] })) });
    const a = this.ids.next(), b = this.ids.next();
    s.layers.unshift(s._layer('intro', [
      el('AnyState', { x: 100, y: -120 }),
      el('ExitState', { x: 500, y: -120 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: a })),
      el('AnimationState', { x: 200, y: 0, animationId: intro, id: a }, [
        el('StateTransition', { stateToId: b }, el('TransitionBoolCondition', { inputId: stillId, opValue: 'equal' })),
        el('StateTransition', { stateToId: b, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 }),
      ]),
      el('AnimationState', { x: 400, y: 0, animationId: done, id: b }),
    ]));
    s.loopLayer('boil', s.anim({ name: 'boil', duration: 24, loop: 'loop', tracks: this.boilTracks }));
  }
}

/**
 * Hold-poses picked by a number input. props: [{ object, prop, type, vals: [per state] }].
 * Entry picks the pose matching the input with no mix (so the first frame is
 * right); later changes cross-fade. Every pose keys every property.
 */
function poseLayer(s, name, inputId, n, props, { mix = 1600, still } = {}) {
  const anims = Array.from({ length: n }, (_, i) =>
    s.anim({ name: `${name} ${i}`, duration: 1, tracks: props.map((p) => ({ object: p.object, prop: p.prop, type: p.type, keys: [[0, p.vals[i], 'linear']] })) })
  );
  const sts = anims.map(() => s.ids.next());
  const cond = (v, op = 'equal') => el('TransitionNumberCondition', { inputId, opValue: op, value: v });
  s.layers.push(s._layer(name, [
    el('AnyState', { x: 100, y: -160 }),
    el('ExitState', { x: 600, y: -160 }),
    el('EntryState', { x: 0, y: 0 }, sts.map((st, i) => el('StateTransition', { stateToId: st }, cond(i)))),
    ...anims.map((a, i) => el('AnimationState', { x: 200 + i * 120, y: 120, animationId: a, id: sts[i] },
      sts.filter((_, j) => j !== i).flatMap((st) => [
        // with `still` (reduced motion) the change is instant, so a paused canvas never stops mid-fade
        still ? el('StateTransition', { stateToId: st }, [cond(sts.indexOf(st)), el('TransitionBoolCondition', { inputId: still, opValue: 'equal' })]) : '',
        el('StateTransition', { stateToId: st, duration: mix }, cond(sts.indexOf(st))),
      ].filter(Boolean)))),
  ]));
}

// a loop that only runs while every condition holds (rests otherwise).
// conds: [inputId, op, value] for numbers, or [inputId, 'bool', true|false]
function gatedLoop(s, name, animId, conds) {
  const rest = s.ids.next(), run = s.ids.next();
  const inverse = { equal: 'notEqual', notEqual: 'equal', greaterThanOrEqual: 'lessThan', lessThan: 'greaterThanOrEqual', greaterThan: 'lessThanOrEqual', lessThanOrEqual: 'greaterThan' };
  const c = ([inputId, op, value], neg = false) =>
    op === 'bool'
      ? el('TransitionBoolCondition', { inputId, opValue: value !== neg ? 'equal' : 'notEqual' })
      : el('TransitionNumberCondition', { inputId, opValue: neg ? inverse[op] : op, value });
  s.layers.push(s._layer(name, [
    el('AnyState', { x: 100, y: -120 }),
    el('ExitState', { x: 500, y: -120 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: rest })),
    el('AnimationState', { x: 200, y: 0, animationId: s.empty(), id: rest }, el('StateTransition', { stateToId: run }, conds.map((x) => c(x)))),
    el('AnimationState', { x: 400, y: 0, animationId: animId, id: run }, conds.map((x) => el('StateTransition', { stateToId: rest }, c(x, true)))),
  ]));
}

const hold = (s, name, tracks) => s.anim({ name, duration: 1, tracks });

// ---------- palettes ----------

// per time: morning, day, late afternoon, dusk, night
const VSKY = [['CFE2F0', 0.9], ['B4D6EE', 0.9], ['D3DCE2', 0.88], ['D6AEC0', 0.9], ['34457E', 0.95]];
const VHOR = [['F6C79A', 0.6], ['F2E6BE', 0.4], ['F0BC6A', 0.62], ['EE8F5E', 0.66], ['4A548C', 0.5]];
const SPILL = [['FFEFC6', 0.85], ['FFF6D8', 0.8], ['FAD488', 0.8], ['F0B48E', 0.45], ['B8C6EA', 0.28]];
const GLAZE = [['F2CBA0', [0, 0.05, 0.12]], ['F2E2B4', [0, 0.02, 0.06]], ['E6AE58', [0.03, 0.1, 0.2]], ['8E5E78', [0.04, 0.18, 0.32]], ['33295A', [0.05, 0.26, 0.46]]];
const FIRE = [0.18, 0.12, 0.22, 0.42, 0.55];
const LIT = [0, 0, 0, 1, 1];
const DAYLIGHT = [0.7, 0.8, 0.6, 0.15, 0];
const NIGHTSKY = [0, 0, 0, 0.55, 1];
// per season: spring, summer, autumn, winter
const GRASS = ['A6C864', '74A553', 'A8A957', 'D3DAD6'];
const FARV = ['93BFD1', '86B3C9', '9DAEC0', 'B6C2CE'];
const HEDGE = ['8DBA5E', '5F9447', '8E9A48', '9AA59A'];
const CANOPY = ['A2CB6A', '5E9A4A', 'D38B3B', '8F8A7A'];
const FIRESCALE = [0.92, 0.8, 1, 1.12];

// the tunnel: a squared-off ellipse from x 12 to 888, crown at y 30, floor line 332
const ARCH = { cx: 450, hw: 438, top: 30, base: 332, p: 3 };
const archY = (x) => {
  const u = Math.min(1, Math.abs((x - ARCH.cx) / ARCH.hw));
  return ARCH.base - (ARCH.base - ARCH.top) * Math.pow(1 - Math.pow(u, ARCH.p), 1 / ARCH.p);
};
const archPts = (x0, x1, n, inset = 0) => Array.from({ length: n + 1 }, (_, i) => { const x = x0 + ((x1 - x0) * i) / n; return P(x, archY(x) + inset); });

// ---------- hero: the Hall ----------

function hall(ids) {
  const W = 900, H = 410;
  const s = new Scene(ids, { name: 'Hall', w: W, h: H, x: 0, y: 0, bg: process.env.HE_BG ? 'FFF8F0E0' : undefined });
  const k = new Kit(s);
  const r = rng(1954);
  const season = s.input('number', 'season', SEASON0);
  const time = s.input('number', 'time', TIME0);
  const still = s.input('bool', 'still', 0);
  const seasonP = [], timeP = [];
  const sp = (object, prop, vals, type) => seasonP.push({ object, prop, vals, type });
  const tp = (object, prop, vals, type) => timeP.push({ object, prop, vals, type });

  // draw-on order
  const fxRoom = k.fx('room', 2, 64);
  const fxWood = k.fx('wood', 18, 84);
  const fxHearth = k.fx('hearth', 30, 96);
  const fxThings = k.fx('things', 44, 116);
  const fxView = k.fx('view', 0, 40);
  const fxSmall = k.fx('small', 80, 136);

  // --- the room: plaster vault, shading in the crown, panelled walls, tiled floor
  const vault = archPts(12, 888, 40);
  const wallPts = dense([...vault, P(888, 332), P(12, 332)]);
  const floorPts = dense([P(18, 330), P(882, 330), P(880, 360), P(856, 384), P(790, 397), P(450, 402), P(110, 397), P(44, 384), P(20, 360)]);
  const crownBand = [...archPts(70, 830, 22, 2), ...archPts(70, 830, 22, 46).reverse()];
  s.add(k.in({ name: 'wall in', cx: 450, cy: 330, t0: 0, t1: 64, sc: 0.97 }, [
    wc(ids, wallPts, C.plaster, rng(2), { alpha: 0.44, off: [0, 2], grain: 0.18, soft: true }),
    wc(ids, crownBand, C.vault, rng(3), { alpha: 0.2, off: [0, 0], grain: 0.1, hazy: true, soft: false }),
  ]));
  const floorMask = ids.next();
  s.add(mask(floorMask, floorPts));
  const floorKids = [wc(ids, floorPts, C.tile, rng(4), { alpha: 0.5, off: [0, 1], grain: 0.4, soft: true })];
  // panelling: a wood band below the dado rail; panels only where the wall shows
  const spans = [[18, 108], [254, 410], [570, 724], [828, 880]];
  const panelSpans = [[24, 104], [258, 406], [832, 876]];
  const panels = [];
  for (const [a, b] of panelSpans) {
    const n = Math.max(1, Math.round((b - a) / 48));
    const pw = (b - a) / n;
    for (let i = 0; i < n; i++) panels.push({ pts: rect(a + i * pw + 5, 272, a + (i + 1) * pw - 5, 322), closed: true, tension: 0.12 });
  }
  const woodInk = k.boil({
    name: 'panel ink', seed: 11, draw: (rr) => [
      ink(spans.flatMap(([a, b]) => [[P(a, 262), P(b, 262)], [P(a, 267), P(b, 267)]]), rr, { w: 1.4, amt: 0.4, fx: fxWood }),
      ink(spans.map(([a, b]) => [P(a, 326), P(b, 326)]), rr, { w: 1.1, amt: 0.3, color: INK_SOFT, fx: fxWood }),
      ink(panels, rr, { w: 0.9, amt: 0.35, color: INK_SOFT, fx: fxWood }),
    ],
  });
  s.add(k.in({ name: 'panels in', cx: 450, cy: 300, t0: 14, t1: 70 }, [
    wc(ids, sharp([P(21, 262), P(879, 262), P(882, 331), P(18, 331)]), C.wood, rng(12), { alpha: 0.34, off: [0, 1], grain: 0.35, soft: false }),
    woodInk,
  ]));
  // tiles: courses and joints in perspective, broken like a quick pen
  const tileList = [];
  for (const y of [345, 364, 386]) {
    for (let x = 40; x < 860;) {
      const len = r.range(40, 110);
      tileList.push([P(x, y + r.jit(0.6)), P(Math.min(860, x + len), y + r.jit(0.8))]);
      x += len + r.range(10, 26);
    }
  }
  for (let x = 66; x <= 834; x += 48) {
    const k2 = (y) => 450 + (x - 450) * ((y - 150) / (332 - 150));
    tileList.push([P(k2(334), 334), P(k2(343), 343)], [P(k2(348), 348), P(k2(362), 362)], [P(k2(368), 368), P(k2(384), 384)]);
  }
  floorKids.push(k.boil({ name: 'tile ink', seed: 13, draw: (rr) => ink(tileList, rr, { w: 0.9, amt: 0.4, color: INK_SOFT, fx: fxWood }) }));
  s.add(k.in({ name: 'floor in', cx: 450, cy: 360, t0: 6, t1: 60, sc: 0.98 }, [clipped({ name: 'floor' }, floorMask, floorKids)]));
  const roomInk = k.boil({
    name: 'vault ink', seed: 14, draw: (rr) => [
      ink(vault, rr, { w: 2, amt: 0.9, n: 40, fx: fxRoom, bleed: 0.12 }),
      ink(archPts(40, 860, 30, 15), rr, { w: 1, amt: 0.7, n: 30, color: INK_SOFT, fx: fxRoom }),
      ink([P(12, 332), P(888, 332)], rr, { w: 1.6, amt: 0.6, n: 20, fx: fxRoom }),
      ink([[P(22, 356), P(30, 372), P(46, 386)], [P(878, 356), P(868, 374), P(852, 386)]], rr, { w: 1.2, amt: 0.4, fx: fxRoom }),
    ],
  });
  s.add(roomInk);

  // --- daylight from the round window, on the plaster (by the hour)
  const Wn = P(654, 166), WR = 34;
  const dayId = ids.next();
  s.add(group({ name: 'daylight', id: dayId, opacity: DAYLIGHT[TIME0] }, [glow({ x: Wn.x - 6, y: Wn.y + 30, w: 230, h: 170, color: 'FFF6DA', alpha: 0.7 })]));
  tp(dayId, 'opacity', DAYLIGHT);

  // --- the rug, in front of the hearth
  const Hx = 490;
  const rugPts = circ(Hx, 366, 152, 23, 22);
  const rugInk = k.boil({
    name: 'rug ink', seed: 21, draw: (rr) => [
      ink({ pts: rugPts, closed: true }, rr, { w: 1.6, amt: 0.6, fx: fxThings }),
      ink({ pts: circ(Hx, 366, 124, 17, 20), closed: true }, rr, { w: 0.9, amt: 0.5, color: INK_SOFT, fx: fxThings }),
      ink({ pts: circ(Hx, 366, 84, 11, 16), closed: true }, rr, { w: 0.9, amt: 0.4, color: INK_SOFT, fx: fxThings }),
    ],
  });
  s.add(k.in({ name: 'rug in', cx: Hx, cy: 366, t0: 40, t1: 100, sc: 0.6 }, [
    wc(ids, rugPts, 'B5483A', rng(22), { alpha: 0.95, off: [1.5, 1], wobble: 1.5, grain: 0.5, blend: 'normal', soft: false }),
    wc(ids, circ(Hx, 366, 124, 17, 20), C.ochre, rng(23), { alpha: 0.7, off: [1, 1], wobble: 1.2, grain: 0.3, soft: false }),
    wc(ids, circ(Hx, 366, 84, 11, 16), 'B5644A', rng(24), { alpha: 0.7, off: [1, 1], wobble: 1, grain: 0.2, soft: false }),
    rugInk,
  ]));

  // --- the front door, open: the garden bright beyond it
  const D = P(180, 270), DR = 60, RR = 72;
  const viewMask = ids.next();
  s.add(mask(viewMask, circ(D.x, D.y, DR - 0.5, DR - 0.5, 28)));
  const viewKids = [];
  // sky and horizon (by the hour)
  const vskyId = ids.next(), vhorId = ids.next();
  viewKids.push(flat(rect(D.x - 64, D.y - 64, D.x + 64, D.y + 64), VSKY[TIME0][0], VSKY[TIME0][1], { name: 'sky', colorId: vskyId, tension: 0, blend: 'normal' }));
  tp(vskyId, 'colorValue', VSKY.map(([c, a]) => argb(c, a)), 'Color');
  viewKids.push(el('Shape', { name: 'horizon', x: D.x, y: D.y + 18 }, [el('Ellipse', { width: 160, height: 60, originX: 0.5, originY: 0.5, name: 'E' }), el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: 0, startY: 0, endX: 80, endY: 0, name: 'G' }, [el('GradientStop', { colorValue: argb(VHOR[TIME0][0], VHOR[TIME0][1]), position: 0, id: vhorId }), el('GradientStop', { colorValue: argb(VHOR[TIME0][0], 0), position: 1, id: ids.next() })]))]));
  tp(vhorId, 'colorValue', VHOR.map(([c, a]) => argb(c, a)), 'Color');
  // night: moon and stars in the doorway
  const nightId = ids.next();
  const moonO = [], moonI = [];
  for (let i = 0; i <= 10; i++) { const a = -2.1 + (i / 10) * 4.2; moonO.push(P(Math.cos(a) * 9, Math.sin(a) * 9)); }
  for (let i = 0; i <= 8; i++) { const a = 1.75 - (i / 8) * 3.5; moonI.push(P(-4 + Math.cos(a) * 8, Math.sin(a) * 8)); }
  const moon = [...moonO, ...moonI];
  viewKids.push(group({ name: 'night sky', id: nightId, opacity: NIGHTSKY[TIME0] }, [
    group({ name: 'moon', x: D.x + 24, y: D.y - 30 }, [glow({ x: 0, y: 0, w: 50, h: 50, color: 'F3E7B8', alpha: 0.4 }), flat(moon, 'EFE2A8', 0.95, { tension: 0.6 }), ink({ pts: moon, closed: true }, rng(31), { w: 1.1, amt: 0.2 })]),
    ...[[D.x - 30, D.y - 36, 3.2], [D.x - 8, D.y - 46, 2.6], [D.x + 4, D.y - 22, 2.2]].map(([x, y, R]) => el('Shape', { name: 'star', x, y }, [polyXml(starPts(R), { closed: true }), fill(argb('F6E7A8', 0.95))])),
  ]));
  tp(nightId, 'opacity', NIGHTSKY);
  // far hills, garden slope, path, hedge, a tree
  const farV = [P(D.x - 70, D.y + 2), P(D.x - 40, D.y - 8), P(D.x - 6, D.y - 4), P(D.x + 30, D.y - 14), P(D.x + 70, D.y - 6), P(D.x + 70, D.y + 30), P(D.x - 70, D.y + 30)];
  const nearV = [P(D.x - 70, D.y + 18), P(D.x - 30, D.y + 12), P(D.x + 20, D.y + 16), P(D.x + 70, D.y + 10), P(D.x + 70, D.y + 70), P(D.x - 70, D.y + 70)];
  const pathV = [P(D.x - 4, D.y + 14), P(D.x + 4, D.y + 14), P(D.x + 26, D.y + 64), P(D.x - 22, D.y + 64)];
  viewKids.push(
    wc(ids, farV, FARV[SEASON0], rng(32), { alpha: 0.5, off: [0, 0], wobble: 1, grain: 0.2, soft: false, key: 'farv' }),
    wc(ids, nearV, GRASS[SEASON0], rng(33), { alpha: 0.6, off: [0, 0], wobble: 1, grain: 0.4, soft: false, key: 'grass' }),
    wc(ids, pathV, 'F0E2C0', rng(34), { alpha: 0.95, off: [0, 0], wobble: 0.8, grain: 0.3, soft: false, blend: 'normal' }),
  );
  // hedge left, gateposts at the end of the path
  const hedgeV = [];
  for (let i = 0; i <= 8; i++) hedgeV.push(P(D.x - 66 + i * 7.5, D.y + 10 - Math.abs(Math.sin(i * 1.3)) * 5));
  viewKids.push(wc(ids, [...hedgeV, P(D.x - 6, D.y + 22), P(D.x - 66, D.y + 24)], HEDGE[SEASON0], rng(35), { alpha: 0.7, off: [0, 1], wobble: 0.6, grain: 0.3, soft: false, key: 'hedgev' }));
  // the apple tree on the right of the view
  const T0 = P(D.x + 38, D.y + 14);
  const crownV = scallop(T0.x - 2, T0.y - 40, 22, rng(36), { bumps: 6, depth: 0.14, squash: 0.85 });
  const crownVid = ids.next(), blossomV = ids.next(), applesV = ids.next(), crownInkV = ids.next();
  const bdots = [], adots = [];
  const br = rng(37);
  for (let i = 0; i < 12; i++) { const a = br() * TAU, d = Math.sqrt(br()) * 17; bdots.push({ x: T0.x - 2 + Math.cos(a) * d, y: T0.y - 40 + Math.sin(a) * d * 0.8, r: br.range(1.2, 2) }); }
  for (let i = 0; i < 5; i++) { const a = br() * TAU, d = Math.sqrt(br()) * 15; adots.push({ x: T0.x - 2 + Math.cos(a) * d, y: T0.y - 38 + Math.sin(a) * d * 0.8, r: 2 }); }
  viewKids.push(
    wc(ids, [P(T0.x - 2, T0.y), P(T0.x + 2, T0.y), P(T0.x + 1, T0.y - 28), P(T0.x - 1, T0.y - 28)], C.wood, rng(38), { alpha: 0.6, off: [0.5, 0], wobble: 0.3, grain: 0, soft: false }),
    group({ name: 'crown', id: crownVid }, [wc(ids, crownV, CANOPY[SEASON0], rng(39), { alpha: 0.62, off: [-1.5, 1.5], wobble: 1, grain: 0.4, soft: false, key: 'canopyv' })]),
    group({ name: 'blossom', id: blossomV, opacity: SEASON0 === 0 ? 1 : 0 }, [stippleShape({ dots: bdots, color: argb('E48AA6', 0.85) })]),
    group({ name: 'apples', id: applesV, opacity: SEASON0 === 2 ? 1 : 0 }, [stippleShape({ dots: adots, color: argb('C8463B', 0.9) })]),
  );
  sp(crownVid, 'opacity', [1, 1, 1, 0.12]);
  sp(blossomV, 'opacity', [1, 0, 0, 0]);
  sp(applesV, 'opacity', [0, 0, 1, 0]);
  // flowers along the path, snow over the garden
  const flowV = ids.next(), snowV = ids.next();
  const fdots = [];
  const fr = rng(41);
  for (let i = 0; i < 14; i++) { const y = D.y + 22 + fr() * 40; const side = i % 2 ? 1 : -1; fdots.push({ x: D.x + side * (14 + (y - D.y) * 0.45 + fr() * 12), y, r: fr.range(1.4, 2.3) }); }
  viewKids.push(
    group({ name: 'flowers', id: flowV, opacity: SEASON0 < 2 ? 1 : 0 }, [stippleShape({ dots: fdots.filter((_, i) => i % 3 === 0), color: argb(C.rose, 0.9) }), stippleShape({ dots: fdots.filter((_, i) => i % 3 === 1), color: argb(C.butter, 0.95) }), stippleShape({ dots: fdots.filter((_, i) => i % 3 === 2), color: argb(C.violet, 0.9) })]),
    group({ name: 'snow', id: snowV, opacity: SEASON0 === 3 ? 1 : 0 }, [
      flat([...hedgeV.map((p) => P(p.x, p.y - 1)), ...hedgeV.slice().reverse().map((p, i) => P(p.x, p.y + 2 + (i % 2)))], 'FFFDF8', 0.95, { tension: 0.6 }),
      flat([P(T0.x - 22, T0.y - 46), P(T0.x - 6, T0.y - 58), P(T0.x + 14, T0.y - 50), P(T0.x + 10, T0.y - 47), P(T0.x - 6, T0.y - 54), P(T0.x - 20, T0.y - 43)], 'FFFDF8', 0.95, { tension: 0.6 }),
    ]),
  );
  sp(flowV, 'opacity', [1, 1, 0, 0]);
  sp(snowV, 'opacity', [0, 0, 0, 1]);
  // the view's ink: horizon, path edges, hedge, tree, fence
  viewKids.push(k.boil({
    name: 'view ink', seed: 42, draw: (rr) => [
      ink([farV.slice(0, 5), nearV.slice(0, 4)], rr, { w: 1, amt: 0.4, color: 'FF55606B', fx: fxView }),
      ink([[pathV[0], pathV[3]], [pathV[1], pathV[2]]], rr, { w: 1, amt: 0.4, fx: fxView }),
      ink([hedgeV, [P(T0.x - 2, T0.y), P(T0.x - 1, T0.y - 28)], [P(T0.x + 2, T0.y), P(T0.x + 1, T0.y - 28)]], rr, { w: 1, amt: 0.3, fx: fxView }),
      ink({ pts: crownV, closed: true }, rr, { w: 1.1, amt: 0.4, fx: fxView, name: 'crown ink' }),
      ink([[P(D.x - 8, D.y + 16), P(D.x - 8, D.y + 6)], [P(D.x + 8, D.y + 16), P(D.x + 8, D.y + 6)], [P(D.x - 8, D.y + 10), P(D.x + 8, D.y + 9)]], rr, { w: 0.9, amt: 0.2, fx: fxView }),
    ],
  }));
  // birds crossing the doorway now and then. Each crossing starts and ends outside
  // the round mask and holds there, so the loop wraps unseen.
  const flyDur = 1560, flyTracks = [], birdKids = [];
  [{ y: D.y - 34, start: 300, scale: 0.55, seed: 51 }, { y: D.y - 26, start: 330, scale: 0.42, seed: 53 }].forEach((f, i) => {
    const id = ids.next(), flapId = ids.next();
    const r0 = rng(f.seed);
    const cels = [0, 1].map((cel) => {
      const cid = ids.next();
      const up = cel === 0 ? -7 : 3;
      return { cid, xml: el('Node', { name: `wing${cel}`, id: cid }, ink([P(-12, up), P(-6, up * 0.4 - 3), P(0, 0), P(6, up * 0.4 - 3), P(12, up)], r0, { w: 2, amt: 0.3 })) };
    });
    birdKids.push(group({ name: `flyer${i}`, x: D.x - 90, y: f.y, id, scaleX: f.scale, scaleY: f.scale }, [el('Solo', { name: 'flap', id: flapId, activeComponentId: cels[0].cid }, cels.map((c) => c.xml))]));
    s.loopLayer(`flyer${i} flap`, s.anim({ name: `flap${i}`, duration: 20 + i * 4, loop: 'loop', tracks: [{ object: flapId, prop: 'activeComponentId', type: 'Id', keys: [[0, cels[0].cid, 'hold'], [10 + i * 2, cels[1].cid, 'hold']] }] }));
    const cross = 220, t0 = f.start, t1 = f.start + cross;
    flyTracks.push(
      { object: id, prop: 'x', keys: [[0, D.x - 90, 'hold'], [t0, D.x - 90, 'linear'], [t1, D.x + 90, 'hold'], [flyDur, D.x + 90, 'hold']] },
      sampled(id, 'y', flyDur, 20, (t) => { const ft = Math.max(0, Math.min(1, (t * flyDur - t0) / cross)); return f.y + Math.sin(ft * 7 + i) * 4 - ft * 10; }),
    );
  });
  const birdsId = ids.next();
  viewKids.push(group({ name: 'birds', id: birdsId, opacity: TIME0 < 3 ? 1 : 0 }, birdKids));
  tp(birdsId, 'opacity', [1, 1, 1, 0, 0]);
  s.loopLayer('flyers', s.anim({ name: 'flyers', duration: flyDur, loop: 'loop', tracks: flyTracks }));
  // weather through the door: blossom drifting in spring, snow in winter
  const weather = (name, dots, color, seasonIdx, dur, fall, sway) => {
    const id = ids.next(), sheets = [], tracks = [];
    for (let j = 0; j < 2; j++) {
      const sid = ids.next();
      sheets.push(group({ name: `${name}${j}`, id: sid, opacity: 0 }, [stippleShape({ dots: dots(rng(60 + j + seasonIdx * 7)), color })]));
      const at = (t) => (t + j / 2) % 1;
      tracks.push(
        sampled(sid, 'y', dur, 30, (t) => at(t) * fall),
        sampled(sid, 'x', dur, 30, (t) => Math.sin(at(t) * TAU) * sway - at(t) * sway),
        sampled(sid, 'opacity', dur, 30, (t) => { const u = at(t); return u < 0.03 || u > 0.97 ? 0 : Math.min(1, (u - 0.03) / 0.2, (0.97 - u) / 0.2); }),
      );
    }
    gatedLoop(s, name, s.anim({ name, duration: dur, loop: 'loop', tracks }), [[season, 'equal', seasonIdx]]);
    return { id, xml: group({ name, id, opacity: SEASON0 === seasonIdx ? 1 : 0 }, sheets) };
  };
  const flakeDots = (rr) => Array.from({ length: 16 }, () => ({ x: rr.range(D.x - 62, D.x + 62), y: rr.range(D.y - 96, D.y + 20), r: rr.range(0.9, 1.7) }));
  const petalDots = (rr) => Array.from({ length: 5 }, () => ({ x: rr.range(D.x - 50, D.x + 70), y: rr.range(D.y - 90, D.y), r: rr.range(1.2, 1.8) }));
  const snowW = weather('door snow', flakeDots, argb('FFFFFF', 0.95), 3, 720, 70, 6);
  const petW = weather('door petals', petalDots, argb('E8A0B6', 0.9), 0, 900, 80, 14);
  viewKids.push(snowW.xml, petW.xml);
  sp(snowW.id, 'opacity', [0, 0, 0, 1]);
  sp(petW.id, 'opacity', [1, 0, 0, 0]);
  for (const [key, cols] of [['farv', FARV], ['grass', GRASS], ['hedgev', HEDGE], ['canopyv', CANOPY]]) tint(sp, key, cols);

  // door surround (an oak frame, cut off by the floor), threshold, and the leaf
  const surround = arc(D.x, D.y, RR, 2.06, TAU + 1.08, 26);
  const surroundIn = arc(D.x, D.y, DR + 1, 1.86, TAU + 1.28, 26);
  const frameInk = k.boil({
    name: 'frame ink', seed: 71, draw: (rr) => [
      ink(surround, rr, { w: 2, amt: 0.6, fx: fxWood, bleed: 0.12 }),
      ink(surroundIn, rr, { w: 1.4, amt: 0.5, fx: fxWood }),
      ink(Array.from({ length: 9 }, (_, i) => { const a = 2.3 + (i / 8) * 4.85; return [P(D.x + Math.cos(a) * (DR + 2), D.y + Math.sin(a) * (DR + 2)), P(D.x + Math.cos(a) * (RR - 2), D.y + Math.sin(a) * (RR - 2))]; }), rr, { w: 0.9, amt: 0.3, color: INK_SOFT, fx: fxWood }),
      ink({ pts: rect(110, 329, 250, 338), closed: true, tension: 0.2 }, rr, { w: 1.4, amt: 0.4, fx: fxWood }),
    ],
  });
  const ringPts = [...surround, ...surroundIn.slice().reverse()];
  const swingId = ids.next(), breezeId = ids.next();
  const leaf = circ(D.x, D.y, DR - 1, DR - 1, 22);
  const planks = [-36, -18, 0, 18, 36].map((dx) => { const hh = Math.sqrt((DR - 3) ** 2 - dx * dx); return [P(D.x + dx, D.y - hh), P(D.x + dx, D.y + hh)]; });
  const leafInk = k.boil({
    name: 'leaf ink', seed: 72, draw: (rr) => [
      ink({ pts: leaf, closed: true }, rr, { w: 1.9, amt: 0.5, fx: fxWood }),
      ink(planks, rr, { w: 0.9, amt: 0.4, color: INK_SOFT, fx: fxWood }),
      ink([[P(D.x - DR + 4, D.y - 26), P(D.x + 10, D.y - 26)], [P(D.x - DR + 4, D.y + 26), P(D.x + 10, D.y + 26)]], rr, { w: 1.5, amt: 0.3, fx: fxWood }),
      ink({ pts: circ(D.x + 34, D.y + 4, 4.5, 4.5, 8), closed: true }, rr, { w: 1.3, amt: 0.2, fx: fxWood }),
    ],
  });
  s.add(k.in({ name: 'door in', cx: D.x, cy: D.y, t0: 20, t1: 80 }, [
    clipped({ name: 'view' }, viewMask, viewKids),
    wc(ids, ringPts, C.oak, rng(74), { alpha: 0.95, off: [1, 1], wobble: 0.8, grain: 0.5, blend: 'normal', soft: false, tension: 1, wetLayer: false }),
    wc(ids, rect(110, 329, 250, 338), C.stone, rng(75), { alpha: 0.9, off: [1, 1], wobble: 0.6, grain: 0.4, blend: 'normal', soft: false }),
    frameInk,
    // the leaf, hinged at its left edge; it swings open in the intro
    group({ name: 'swing', id: swingId, x: D.x - DR, y: D.y, scaleX: 1 }, [
      group({ name: 'breeze', id: breezeId }, [
        group({ name: 'leaf body', x: -(D.x - DR), y: -D.y }, [
          wc(ids, leaf, C.door, rng(76), { alpha: 0.95, off: [1.5, 1.5], wobble: 1, grain: 0.6, blend: 'normal', soft: false }),
          wc(ids, circ(D.x + 34, D.y + 4, 4.5, 4.5, 8), C.brass, rng(77), { alpha: 0.95, off: [0.6, 0.6], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
          leafInk,
        ]),
      ]),
    ]),
  ]));
  k.tween(swingId, 'scaleX', 1, 0.24, 92, 170, [0.5, 0, 0.2, 1]);

  // light spilling in across the floor from the open door (by the hour)
  const spillId = ids.next(), spillColor = ids.next();
  s.add(group({ name: 'spill', id: spillId, opacity: 0 }, [
    el('Shape', { name: 'spill' }, [pathXml([P(124, 333), P(244, 333), P(410, 396), P(340, 402), P(176, 401)], { closed: true, tension: 0.3 }), el('Fill', { name: 'Fill', fillRule: 'clockwise' }, [el('SolidColor', { colorValue: argb(SPILL[TIME0][0], SPILL[TIME0][1]), name: 'C', id: spillColor }), el('Feather', { strength: 9, name: 'F' })])]),
  ]));
  k.tween(spillId, 'opacity', 0, 1, 110, 190, EASE.out);
  tp(spillColor, 'colorValue', SPILL.map(([c, a]) => argb(c, a)), 'Color');

  // --- an umbrella in a crock by the door
  const crock = [P(46, 334), P(44, 306), P(48, 300), P(80, 300), P(84, 306), P(82, 334)];
  const umb = [P(60, 302), P(55, 268), P(57, 254), P(64, 236), P(66, 232), P(68, 236), P(75, 254), P(76, 268), P(70, 302)];
  s.add(k.in({ name: 'umbrella in', cx: 64, cy: 334, t0: 60, t1: 110, sc: 0.85, ease: EASE.back }, [
    wc(ids, umb, '4E6E5A', rng(81), { alpha: 0.75, off: [1, 1], wobble: 0.6, grain: 0.3, soft: false }),
    wc(ids, crock, '6F8FA8', rng(82), { alpha: 0.8, off: [1, 1], wobble: 0.6, grain: 0.4, soft: false }),
    k.boil({
      name: 'umbrella ink', seed: 83, draw: (rr) => [
        ink([{ pts: crock, closed: true, tension: 0.4 }, [P(46, 310), P(82, 310)]], rr, { w: 1.4, amt: 0.3, fx: fxThings }),
        ink([{ pts: umb, closed: true, tension: 0.6 }, [P(62, 300), P(60, 268), P(64, 240)], [P(68, 300), P(70, 268), P(67, 240)], [P(57, 262), P(75, 266)]], rr, { w: 1.2, amt: 0.3, fx: fxThings }),
        ink([[P(66, 232), P(66, 220), P(68, 212), P(75, 210), P(80, 215), P(79, 220)]], rr, { w: 2.6, amt: 0.2, color: 'FF6A4A30', fx: fxThings }),
      ],
    }),
  ]));

  // --- lots and lots of pegs: a hat, the season's scarf or straw hat, your coat
  const pegX = [274, 296, 318, 340, 362, 384];
  const pegInk = k.boil({
    name: 'pegs ink', seed: 91, draw: (rr) => [
      ink({ pts: rect(262, 208, 398, 217), closed: true, tension: 0.15 }, rr, { w: 1.3, amt: 0.3, fx: fxThings }),
      ink(pegX.map((x) => [P(x, 216), P(x + 2, 224), P(x + 5, 227)]), rr, { w: 2.2, amt: 0.2, fx: fxThings }),
    ],
  });
  s.add(k.in({ name: 'pegs in', cx: 330, cy: 212, t0: 50, t1: 100 }, [
    wc(ids, rect(262, 208, 398, 217), C.oak, rng(92), { alpha: 0.9, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false, blend: 'normal' }),
    pegInk,
  ]));
  const swayIds = [];
  const hanging = (name, px, kids, id, opacity) => {
    const sw = ids.next();
    swayIds.push(sw);
    return group({ name, id, x: px, y: 224, opacity }, [group({ name: `${name} sway`, id: sw }, [group({ name: `${name} body`, x: -px, y: -224 }, kids)])]);
  };
  // a wide-brimmed felt hat
  const hatCrown = [P(286, 230), P(288, 220), P(296, 216), P(304, 220), P(306, 230)];
  const hatBrim = [P(278, 232), P(296, 227), P(314, 232), P(296, 237)];
  const felt = hanging('felt hat', 296, [
    wc(ids, hatBrim, '7A5A3A', rng(93), { alpha: 0.8, off: [1, 1], wobble: 0.4, grain: 0.2, soft: false }),
    wc(ids, [...hatCrown, P(296, 232)], '7A5A3A', rng(94), { alpha: 0.75, off: [1, 1], wobble: 0.4, grain: 0.2, soft: false }),
    k.boil({ name: 'felt ink', seed: 95, draw: (rr) => ink([hatCrown, { pts: hatBrim, closed: true }, [P(287, 228), P(305, 228)]], rr, { w: 1.3, amt: 0.25, fx: fxThings, tension: 0.6 }) }),
  ]);
  // straw hat (spring, summer) or a long striped scarf (autumn, winter)
  const strawId = ids.next(), scarfId = ids.next();
  const strawBrim = [P(324, 238), P(340, 230), P(356, 238), P(340, 244)];
  const strawCrown = [P(332, 236), P(333, 226), P(340, 223), P(347, 226), P(348, 236)];
  const straw = hanging('straw hat', 340, [
    wc(ids, strawBrim, 'E2C27A', rng(96), { alpha: 0.9, off: [1, 1], wobble: 0.4, grain: 0.3, soft: false }),
    wc(ids, [...strawCrown, P(340, 238)], 'E2C27A', rng(97), { alpha: 0.85, off: [1, 1], wobble: 0.4, grain: 0.3, soft: false }),
    flat([P(332, 233), P(348, 233), P(348, 236), P(332, 236)], 'C8463B', 0.85, { tension: 0 }),
    k.boil({ name: 'straw ink', seed: 98, draw: (rr) => ink([strawCrown, { pts: strawBrim, closed: true }], rr, { w: 1.2, amt: 0.25, fx: fxThings, tension: 0.6 }) }),
  ], strawId);
  const scarfL = [P(336, 226), P(344, 226), P(343, 260), P(345, 296), P(337, 297), P(335, 260)];
  const scarfR = [P(342, 226), P(350, 228), P(352, 262), P(356, 290), P(348, 292), P(344, 262)];
  const stripes = [];
  for (const y of [244, 262, 280]) stripes.push([P(335, y), P(344, y + 1)], [P(343, y + 6), P(352, y + 7)]);
  const scarf = hanging('scarf', 342, [
    wc(ids, scarfR, 'B5483A', rng(99), { alpha: 0.8, off: [1, 1], wobble: 0.4, grain: 0.3, soft: false }),
    wc(ids, scarfL, 'C8563F', rng(100), { alpha: 0.85, off: [1, 1], wobble: 0.4, grain: 0.3, soft: false }),
    k.boil({ name: 'scarf ink', seed: 101, draw: (rr) => [ink([{ pts: scarfL, closed: true }, { pts: scarfR, closed: true }], rr, { w: 1.2, amt: 0.3, fx: fxThings, tension: 0.5 }), ink(stripes, rr, { w: 2, amt: 0.2, color: 'FFE9C46A', fx: fxThings })] }),
  ], scarfId);
  // a returning visitor's coat
  const coatId = ids.next();
  const coat = [P(378, 226), P(390, 226), P(398, 236), P(402, 276), P(396, 278), P(396, 306), P(372, 308), P(372, 278), P(366, 276), P(370, 236)];
  const coatHood = [P(376, 228), P(384, 220), P(392, 228)];
  const coatXml = hanging('coat', 384, [
    wc(ids, coat, '6F86A6', rng(102), { alpha: 0.85, off: [1, 1], wobble: 0.6, grain: 0.4, soft: false }),
    k.boil({ name: 'coat ink', seed: 103, draw: (rr) => [ink([{ pts: coat, closed: true }, coatHood], rr, { w: 1.3, amt: 0.3, tension: 0.4 }), ink([[P(384, 230), P(384, 306)], [P(372, 278), P(376, 250)], [P(396, 278), P(392, 250)]], rr, { w: 0.9, amt: 0.3, color: INK_SOFT })] }),
    stippleShape({ name: 'buttons', dots: [{ x: 387, y: 246, r: 1.3 }, { x: 387, y: 262, r: 1.3 }, { x: 387, y: 278, r: 1.3 }], color: argb(C.brass, 1) }),
  ], coatId, REGULAR0);
  s.add(k.in({ name: 'hanging in', cx: 330, cy: 224, t0: 70, t1: 120, dy: -8 }, [felt, straw, scarf]));
  s.add(coatXml);
  sp(strawId, 'opacity', [1, 1, 0, 0]);
  sp(scarfId, 'opacity', [0, 0, 1, 1]);
  // walking stick leaning by the hearth
  s.add(k.in({ name: 'stick in', cx: 400, cy: 334, t0: 78, t1: 120 }, [
    k.boil({ name: 'stick ink', seed: 104, draw: (rr) => ink([[P(404, 334), P(398, 280), P(392, 238)], [P(392, 238), P(388, 230), P(394, 226), P(399, 230)]], rr, { w: 2.4, amt: 0.3, color: 'FF5A4130', fx: fxThings }) }),
  ]));

  // --- the hearth: a stone surround with a round-topped firebox, a mantel above
  const opening = [P(444, 332), ...arc(Hx, 292, 46, Math.PI, TAU, 14), P(536, 332)];
  const surroundH = sharp([P(414, 332), P(413, 236), P(567, 234), P(566, 332)]);
  const stoneLines = [
    [P(414, 262), P(440, 262)], [P(540, 260), P(566, 260)], [P(414, 296), P(444, 296)], [P(536, 298), P(566, 298)],
    [P(428, 236), P(428, 262)], [P(554, 236), P(552, 260)], [P(430, 262), P(430, 296)], [P(552, 260), P(552, 298)],
    [P(426, 296), P(426, 332)], [P(554, 298), P(554, 332)],
    ...Array.from({ length: 7 }, (_, i) => { const a = Math.PI + 0.25 + (i / 6) * (Math.PI - 0.5); return [P(Hx + Math.cos(a) * 47, 292 + Math.sin(a) * 47), P(Hx + Math.cos(a) * 60, 292 + Math.sin(a) * 60)]; }),
  ];
  const mantel = rect(400, 222, 580, 231);
  const hearthInk = k.boil({
    name: 'hearth ink', seed: 111, draw: (rr) => [
      ink({ pts: surroundH, closed: true, tension: 0.12 }, rr, { w: 1.8, amt: 0.5, fx: fxHearth, bleed: 0.1 }),
      ink(opening, rr, { w: 1.7, amt: 0.5, fx: fxHearth }),
      ink(stoneLines, rr, { w: 1, amt: 0.4, color: INK_SOFT, fx: fxHearth }),
      ink([{ pts: mantel, closed: true, tension: 0.1 }, [P(408, 231), P(410, 240), P(416, 241)], [P(572, 231), P(570, 240), P(564, 241)]], rr, { w: 1.6, amt: 0.35, fx: fxHearth }),
      ink({ pts: rect(402, 332, 578, 342), closed: true, tension: 0.15 }, rr, { w: 1.4, amt: 0.4, fx: fxHearth }),
    ],
  });
  s.add(k.in({ name: 'hearth in', cx: Hx, cy: 332, t0: 26, t1: 90, sc: 0.96 }, [
    wc(ids, surroundH, C.stone, rng(112), { alpha: 0.95, off: [1.5, 1.5], wobble: 1, grain: 0.6, blend: 'normal', soft: false }),
    wc(ids, opening, '3E302A', rng(113), { alpha: 0.82, off: [0.5, 0.5], wobble: 0.6, grain: 0.3, soft: false, tension: 0.6 }),
    wc(ids, rect(402, 332, 578, 342), C.stone, rng(114), { alpha: 0.9, off: [1, 1], wobble: 0.5, grain: 0.3, blend: 'normal', soft: false }),
    wc(ids, mantel, C.oak, rng(115), { alpha: 0.95, off: [1, 1], wobble: 0.5, grain: 0.4, blend: 'normal', soft: false }),
    hearthInk,
  ]));

  // the fire: logs and flames (re-drawn cels on the boil clock), plus a flicker
  const logs = [[P(458, 330), P(522, 322)], [P(462, 322), P(520, 331)]];
  const fireScale = ids.next(), popScale = ids.next(), flickId = ids.next();
  const flames = k.boil({
    name: 'flames', seed: 121, draw: (rr, i) => {
      const t = [
        tongue(Hx - 18, 326, 22, 30 + rr.jit(6), -4 + rr.jit(3)),
        tongue(Hx + 2, 326, 30, 46 + rr.jit(7), 3 + rr.jit(4)),
        tongue(Hx + 20, 326, 20, 26 + rr.jit(6), 5 + rr.jit(3)),
      ];
      const inner = [tongue(Hx - 1, 326, 16, 26 + rr.jit(4), 2 + rr.jit(2)), tongue(Hx - 16, 326, 10, 14 + rr.jit(3), -2)];
      return [
        ...t.map((pts) => flat(pts, C.flame, 0.86, { tension: 0.9 })),
        ...inner.map((pts) => flat(pts, C.yolk, 0.92, { tension: 0.9 })),
        ink(t.map((pts) => ({ pts: pts.slice(1, -1) })), rr, { w: 1.1, amt: 0.3, color: INK_WARM }),
      ];
    },
  });
  s.add(k.in({ name: 'fire in', cx: Hx, cy: 330, t0: 70, t1: 140, sc: 0.15, ease: EASE.out }, [
    group({ name: 'season fire', id: fireScale, x: Hx, y: 330, scaleX: FIRESCALE[SEASON0], scaleY: FIRESCALE[SEASON0] }, [
      group({ name: 'pop fire', id: popScale }, [
        group({ name: 'flicker', id: flickId }, [group({ name: 'flames body', x: -Hx, y: -330 }, [flames])]),
      ]),
    ]),
    wc(ids, [P(458, 326), P(522, 318), P(524, 324), P(460, 333)], '6B4A30', rng(122), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
    wc(ids, [P(462, 318), P(520, 327), P(519, 334), P(460, 325)], '7E5A3A', rng(123), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
    k.boil({ name: 'log ink', seed: 124, draw: (rr) => ink([...logs, { pts: circ(520, 322, 3, 3.5, 7), closed: true }, { pts: circ(458, 330, 3, 3.5, 7), closed: true }], rr, { w: 1.3, amt: 0.3, fx: fxHearth }) }),
  ]));
  sp(fireScale, 'scaleX', FIRESCALE);
  sp(fireScale, 'scaleY', FIRESCALE);
  s.loopLayer('flicker', s.anim({ name: 'flicker', duration: 150, loop: 'loop', tracks: [
    sampled(flickId, 'scaleY', 150, 6, (t) => 1 + 0.06 * Math.sin(t * TAU * 3) + 0.04 * Math.sin(t * TAU * 7 + 1)),
    sampled(flickId, 'scaleX', 150, 6, (t) => 1 + 0.03 * Math.sin(t * TAU * 5 + 2)),
  ] }));
  // sparks for the pop
  const sparks = [];
  const sparkTracks = [];
  for (let i = 0; i < 6; i++) {
    const id = ids.next();
    const sr = rng(130 + i);
    const dx = sr.range(-34, 34), up = sr.range(46, 74);
    sparks.push(el('Shape', { name: 'spark', id, x: Hx, y: 316, opacity: 0 }, [el('Ellipse', { width: 3.4, height: 3.4, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FFC85A', 1))]));
    const d0 = i * 3, d1 = d0 + 60 + sr.range(0, 20);
    sparkTracks.push(
      { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [d0, 1, 'linear'], [d1 - 14, 0.9, 'linear'], [d1, 0, 'hold'], [96, 0]] },
      sampled(id, 'x', 96, 6, (t) => { const u = Math.max(0, Math.min(1, (t * 96 - d0) / (d1 - d0))); return Hx + dx * u + Math.sin(u * 9 + i) * 3; }),
      sampled(id, 'y', 96, 6, (t) => { const u = Math.max(0, Math.min(1, (t * 96 - d0) / (d1 - d0))); return 316 - up * (1 - (1 - u) * (1 - u)); }),
    );
  }
  s.add(group({ name: 'sparks' }, sparks));

  // the kettle on the hearthstone
  const K = P(554, 320);
  const kettle = [P(K.x - 16, K.y + 12), P(K.x - 18, K.y + 2), P(K.x - 13, K.y - 8), P(K.x, K.y - 11), P(K.x + 13, K.y - 8), P(K.x + 18, K.y + 2), P(K.x + 16, K.y + 12)];
  const spout = [P(K.x - 15, K.y + 2), P(K.x - 24, K.y - 4), P(K.x - 28, K.y - 12)];
  const lidId = ids.next();
  s.add(k.in({ name: 'kettle in', cx: K.x, cy: K.y + 12, t0: 96, t1: 140, sc: 0.5, ease: EASE.back }, [
    wc(ids, kettle, C.copper, rng(141), { alpha: 0.92, off: [1, 1], wobble: 0.5, grain: 0.4, soft: false, blend: 'normal', tension: 0.8 }),
    wc(ids, [P(K.x - 15, K.y + 1), P(K.x - 23, K.y - 4), P(K.x - 28, K.y - 12), P(K.x - 25, K.y - 13), P(K.x - 19, K.y - 6), P(K.x - 13, K.y - 3)], C.copper, rng(142), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
    flat([P(K.x - 9, K.y - 6), P(K.x - 4, K.y - 8), P(K.x - 7, K.y + 4), P(K.x - 11, K.y + 3)], 'FFE7B8', 0.55, { tension: 0.8 }),
    k.boil({
      name: 'kettle ink', seed: 143, draw: (rr) => [
        ink([{ pts: kettle, closed: true }, spout, [P(K.x - 13, K.y - 3), P(K.x - 19, K.y - 6), P(K.x - 25, K.y - 13)]], rr, { w: 1.5, amt: 0.3, fx: fxSmall, tension: 0.8 }),
        ink([P(K.x - 11, K.y - 9), P(K.x - 9, K.y - 22), P(K.x, K.y - 26), P(K.x + 9, K.y - 22), P(K.x + 11, K.y - 9)], rr, { w: 1.4, amt: 0.3, fx: fxSmall }),
      ],
    }),
    group({ name: 'lid', id: lidId, x: K.x, y: K.y - 11 }, [
      flat([P(-8, 1), P(-6, -3), P(6, -3), P(8, 1)], darken(C.copper, 0.1), 0.95, { tension: 0.5 }),
      ink([{ pts: [P(-8, 1), P(-6, -3), P(6, -3), P(8, 1)], closed: true }, [P(0, -3), P(0, -6)]], rng(144), { w: 1.2, amt: 0.15, tension: 0.5 }),
      el('Shape', { name: 'knob', x: 0, y: -6.5 }, [el('Ellipse', { width: 4, height: 3, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('2B231C', 1))]),
    ]),
  ]));
  // steam: curls from the spout while the kettle is on
  const steamKids = [], steamTracks = [];
  const steamDur = 240;
  for (let i = 0; i < 3; i++) {
    const id = ids.next();
    // white gouache curls with a faint pencil edge, so they read over stone and plaster
    const curl = k.boil({ name: `steam${i}`, seed: 150 + i, draw: (rr) => { const pts = []; for (let j = 0; j <= 9; j++) { const t = j / 9; pts.push(P(Math.sin(t * 5.5 + i) * (2 + t * 4), -t * 18)); } return el('Shape', { name: 'curl' }, [pathXml(trace(pts, rr, 0.4)), stroke(argb('FFFFFF', 0.9), 3.2), stroke('FF8A8076', 0.9)]); } });
    steamKids.push(group({ name: `steam${i}`, id, x: K.x - 28, y: K.y - 14, opacity: 0 }, [curl]));
    const at = (t) => (t + i / 3) % 1;
    const op = (u) => (u < 0.04 || u > 0.94 ? 0 : u < 0.2 ? (u - 0.04) / 0.16 : Math.max(0, 1 - (u - 0.2) / 0.74)) * 0.85;
    steamTracks.push(
      sampled(id, 'y', steamDur, 12, (t) => K.y - 14 - at(t) * 52),
      sampled(id, 'x', steamDur, 12, (t) => K.x - 28 - at(t) * 10 + Math.sin(at(t) * 6) * 3),
      sampled(id, 'opacity', steamDur, 12, (t) => op(at(t))),
      sampled(id, 'scaleX', steamDur, 12, (t) => 0.6 + at(t) * 0.7),
      sampled(id, 'scaleY', steamDur, 12, (t) => 0.6 + at(t) * 0.7),
    );
  }
  s.add(group({ name: 'steam' }, steamKids));
  const steaming = s.input('bool', 'steaming', STEAM0);
  gatedLoop(s, 'steam', s.anim({ name: 'steam', duration: steamDur, loop: 'loop', tracks: steamTracks }), [[steaming, 'bool', true]]);

  // --- on the mantel: candlesticks, the clock, a jug with the season's sprig
  const CL = P(Hx, 198);
  const hourHand = ids.next(), minHand = ids.next(), sweepH = ids.next(), sweepM = ids.next();
  const ticks = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU; const l = i % 3 === 0 ? 4 : 2.2; return [P(CL.x + Math.sin(a) * 15, CL.y - Math.cos(a) * 15), P(CL.x + Math.sin(a) * (15 - l), CL.y - Math.cos(a) * (15 - l))]; });
  const caseOut = [...arc(CL.x, CL.y, 21, Math.PI * 0.82, Math.PI * 2.18, 16), P(CL.x + 16, 222), P(CL.x - 16, 222)];
  s.add(k.in({ name: 'clock in', cx: CL.x, cy: 222, t0: 84, t1: 130, sc: 0.5, ease: EASE.back }, [
    wc(ids, caseOut, C.wood, rng(161), { alpha: 0.95, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false, blend: 'normal', tension: 0.7 }),
    wc(ids, circ(CL.x, CL.y, 16, 16, 14), C.cream, rng(162), { alpha: 0.98, off: [0.5, 0.5], wobble: 0.3, grain: 0.1, soft: false, blend: 'normal' }),
    k.boil({
      name: 'clock ink', seed: 163, draw: (rr) => [
        ink([{ pts: caseOut, closed: true, tension: 0.7 }, { pts: circ(CL.x, CL.y, 16, 16, 14), closed: true }], rr, { w: 1.5, amt: 0.3, fx: fxSmall }),
        ink(ticks, rr, { w: 1, amt: 0.15, fx: fxSmall }),
      ],
    }),
    group({ name: 'sweep m', id: sweepM, x: CL.x, y: CL.y }, [group({ name: 'minute hand', id: minHand, rotation: (MIN0 / 60) * TAU }, [ink([P(0, 2.5), P(0, -12.5)], rng(164), { w: 1.3, amt: 0.1 })])]),
    group({ name: 'sweep h', id: sweepH, x: CL.x, y: CL.y }, [group({ name: 'hour hand', id: hourHand, rotation: (HOUR0 / 12) * TAU }, [ink([P(0, 2), P(0, -8.5)], rng(165), { w: 2.1, amt: 0.1 })])]),
    el('Shape', { name: 'pin', x: CL.x, y: CL.y }, [el('Ellipse', { width: 3, height: 3, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('2B231C', 1))]),
  ]));
  k.tween(sweepH, 'rotation', -TAU, 0, 90, 200, EASE.inOut);
  k.tween(sweepM, 'rotation', -TAU * 2, 0, 90, 200, EASE.inOut);
  const hour = s.input('number', 'hour', HOUR0);
  const minute = s.input('number', 'minute', MIN0);
  // a 1D blend moves each hand toward every stop by its weight, starting from the
  // value it already has; zeroing both hands first in their own layer makes the
  // result exactly linear (stop 0 is 0, so the hand ends at weight x the far stop)
  s.loopLayer('clock base', hold(s, 'clock zero', [{ object: hourHand, prop: 'rotation', keys: [[0, 0]] }, { object: minHand, prop: 'rotation', keys: [[0, 0]] }]));
  s.blendLayer('hour', hour, [
    { anim: hold(s, 'hour 0', [{ object: hourHand, prop: 'rotation', keys: [[0, 0]] }]), value: 0 },
    { anim: hold(s, 'hour 24', [{ object: hourHand, prop: 'rotation', keys: [[0, TAU * 2]] }]), value: 24 },
  ]);
  s.blendLayer('minute', minute, [
    { anim: hold(s, 'minute 0', [{ object: minHand, prop: 'rotation', keys: [[0, 0]] }]), value: 0 },
    { anim: hold(s, 'minute 60', [{ object: minHand, prop: 'rotation', keys: [[0, TAU]] }]), value: 60 },
  ]);
  // candlesticks
  const candle = (x) => [
    wc(ids, [P(x - 3, 220), P(x + 3, 220), P(x + 3, 200), P(x - 3, 201)], C.white, rng(x), { alpha: 0.98, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, [P(x - 8, 222), P(x - 6, 218), P(x + 6, 218), P(x + 8, 222)], C.brass, rng(x + 1), { alpha: 0.95, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
    ink([{ pts: [P(x - 3, 219), P(x - 3, 201), P(x + 3, 200), P(x + 3, 219)] }, { pts: [P(x - 8, 222), P(x - 6, 218), P(x + 6, 218), P(x + 8, 222)], closed: true }, [P(x, 200), P(x + 0.5, 196)]], rng(x + 2), { w: 1.2, amt: 0.15, tension: 0.3 }),
  ];
  // the jug, with a sprig for the season
  const jug = [P(560, 222), P(557, 210), P(559, 202), P(556, 197), P(568, 197), P(566, 202), P(569, 210), P(566, 222)];
  const sprigIds = [ids.next(), ids.next(), ids.next(), ids.next()];
  const stems = [[P(562, 198), P(556, 182), P(552, 172)], [P(563, 198), P(565, 180), P(570, 168)], [P(564, 198), P(574, 184)]];
  const tips = [P(552, 172), P(570, 168), P(574, 184), P(556, 182), P(565, 180)];
  const sprig = [
    stippleShape({ dots: tips.flatMap((p) => [{ x: p.x, y: p.y, r: 2.6 }, { x: p.x + 2, y: p.y + 3, r: 1.8 }]), color: argb('EBA2B8', 0.95) }),
    stippleShape({ dots: tips.map((p) => ({ x: p.x, y: p.y, r: 2.6 })), color: argb('F2EEE6', 1) }),
    stippleShape({ dots: tips.map((p, i) => ({ x: p.x + (i % 2), y: p.y, r: 2.4 })), color: argb('C4503B', 0.95) }),
    stippleShape({ dots: [P(553, 175), P(569, 171), P(572, 186)].map((p) => ({ x: p.x, y: p.y, r: 2 })), color: argb('C8253B', 1) }),
  ];
  const sprigXml = sprig.map((d, i) => group({ name: `sprig${i}`, id: sprigIds[i], opacity: SEASON0 === i ? 1 : 0 }, [d]));
  sp(sprigIds[0], 'opacity', [1, 0, 0, 0]);
  sp(sprigIds[1], 'opacity', [0, 1, 0, 0]);
  sp(sprigIds[2], 'opacity', [0, 0, 1, 0]);
  sp(sprigIds[3], 'opacity', [0, 0, 0, 1]);
  const stemColor = ['FF6E8A4A', 'FF5E8A4A', 'FF7A6A3A', 'FF3E6A44'];
  const stemCol = ids.next();
  s.add(k.in({ name: 'mantel things in', cx: Hx, cy: 222, t0: 100, t1: 146, sc: 0.7, ease: EASE.back }, [
    ...candle(438), ...candle(526),
    wc(ids, jug, '8FA7C4', rng(171), { alpha: 0.9, off: [0.6, 0.6], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal', tension: 0.6 }),
    el('Shape', { name: 'stems' }, [...stems.map((st) => pathXml(st)), el('Stroke', { thickness: 1.2, cap: 'round', join: 'round', name: 'S' }, el('SolidColor', { colorValue: stemColor[SEASON0], name: 'C', id: stemCol }))]),
    ...sprigXml,
    k.boil({ name: 'jug ink', seed: 172, draw: (rr) => ink([{ pts: jug, closed: true }, [P(568, 202), P(573, 204), P(572, 212), P(568, 213)]], rr, { w: 1.2, amt: 0.25, fx: fxSmall, tension: 0.6 }) }),
  ]));
  sp(stemCol, 'colorValue', stemColor, 'Color');

  // --- the armchair, and the cat asleep in it
  const chairBack = [P(616, 300), P(614, 258), P(622, 240), P(654, 232), P(686, 240), P(694, 258), P(692, 300)];
  const armL = [P(600, 330), P(600, 288), P(606, 280), P(618, 280), P(624, 288), P(624, 330)];
  const armR = [P(684, 330), P(684, 288), P(690, 280), P(702, 280), P(708, 288), P(708, 330)];
  const seat = [P(620, 300), P(688, 300), P(690, 312), P(618, 312)];
  const base = [P(600, 312), P(708, 312), P(708, 332), P(600, 332)];
  const chairInk = k.boil({
    name: 'chair ink', seed: 181, draw: (rr) => [
      ink([{ pts: chairBack, tension: 0.7 }, { pts: armL, closed: true, tension: 0.5 }, { pts: armR, closed: true, tension: 0.5 }], rr, { w: 1.7, amt: 0.4, fx: fxThings }),
      ink([[P(624, 312), P(684, 312)], [P(604, 333), P(604, 340)], [P(704, 333), P(704, 340)], [P(624, 324), P(684, 324)]], rr, { w: 1.4, amt: 0.3, fx: fxThings }),
      ink([[P(632, 250), P(636, 290)], [P(676, 250), P(672, 290)], [P(654, 240), P(654, 292)]], rr, { w: 0.8, amt: 0.4, color: INK_SOFT, fx: fxThings }),
    ],
  });
  s.add(k.in({ name: 'chair in', cx: 654, cy: 336, t0: 56, t1: 112, sc: 0.92 }, [
    wc(ids, [...chairBack, P(616, 312)], C.madder, rng(182), { alpha: 0.95, off: [1.5, 1.5], wobble: 0.8, grain: 0.6, blend: 'normal', soft: false, tension: 0.7 }),
    wc(ids, base, darken(C.madder, 0.08), rng(183), { alpha: 0.95, off: [1, 1], wobble: 0.6, grain: 0.4, blend: 'normal', soft: false }),
    wc(ids, seat, 'C46A4E', rng(184), { alpha: 0.95, off: [1, 1], wobble: 0.6, grain: 0.3, blend: 'normal', soft: false }),
    wc(ids, armL, 'B85F48', rng(185), { alpha: 0.95, off: [1, 1], wobble: 0.6, grain: 0.4, blend: 'normal', soft: false }),
    wc(ids, armR, 'B85F48', rng(186), { alpha: 0.95, off: [1, 1], wobble: 0.6, grain: 0.4, blend: 'normal', soft: false }),
    chairInk,
  ]));
  // the cat: a grey tabby loaf on the cushion, tail hanging over the edge
  const catBody = [P(626, 302), P(628, 290), P(642, 282), P(668, 282), P(682, 290), P(685, 302)];
  const catHead = [P(618, 302), P(614, 292), P(617, 283), P(628, 280), P(637, 284), P(639, 295), P(633, 302)];
  const earL = [P(617, 285), P(616, 274), P(623, 281)];
  const earR = [P(627, 280), P(633, 272), P(635, 283)];
  const tailRoot = P(680, 301);
  const tail = [P(0, 0), P(4, 9), P(3, 20), P(-1, 26), P(2, 31), P(7, 30)];
  const tailId = ids.next(), earId = ids.next();
  const CAT = '8E8780';
  s.add(k.in({ name: 'cat in', cx: 652, cy: 300, t0: 112, t1: 150, op: 0 }, [
    wc(ids, catBody, CAT, rng(191), { alpha: 0.95, off: [0.5, 0.5], wobble: 0.5, grain: 0.3, soft: false, blend: 'normal', tension: 0.8 }),
    wc(ids, catHead, CAT, rng(192), { alpha: 0.95, off: [0.5, 0.5], wobble: 0.4, grain: 0.2, soft: false, blend: 'normal', tension: 0.8 }),
    flat([P(617, 296), P(624, 293), P(631, 297), P(624, 301)], 'F2EEE6', 0.9, { tension: 0.8 }),
    k.boil({
      name: 'cat ink', seed: 193, draw: (rr) => [
        ink([{ pts: catBody, tension: 0.8 }, { pts: catHead, closed: true, tension: 0.8 }, earL], rr, { w: 1.4, amt: 0.25, fx: fxSmall }),
        ink([[P(646, 284), P(648, 291)], [P(655, 283), P(657, 291)], [P(664, 284), P(665, 291)], [P(673, 287), P(673, 293)], [P(620, 290), P(624, 291)], [P(628, 289), P(632, 290)], [P(624, 283), P(625, 287)]], rr, { w: 1, amt: 0.15, color: INK_SOFT, fx: fxSmall }),
      ],
    }),
    group({ name: 'ear', id: earId, x: 631, y: 282 }, [group({ name: 'ear body', x: -631, y: -282 }, [flat([...earR, P(631, 284)], CAT, 0.95, { tension: 0 }), ink(earR, rng(194), { w: 1.4, amt: 0.15, tension: 0.2 })])]),
    group({ name: 'tail', id: tailId, x: tailRoot.x, y: tailRoot.y }, [
      el('Shape', { name: 'tail fur' }, [pathXml(tail), el('Stroke', { thickness: 5.5, cap: 'round', join: 'round', name: 'S' }, el('SolidColor', { colorValue: argb(CAT, 0.95), name: 'C' }))]),
      ink(tail, rng(195), { w: 1.1, amt: 0.15 }),
      ink([[P(-1, 11), P(5, 12)], [P(-2, 20), P(4, 21)], [P(-2, 27), P(3, 29)]], rng(196), { w: 1.1, amt: 0.1, color: INK_SOFT }),
    ]),
  ]));
  s.loopLayer('tail', s.anim({ name: 'tail swish', duration: 420, loop: 'loop', tracks: [sampled(tailId, 'rotation', 420, 14, (t) => 0.09 * Math.sin(t * TAU) + 0.03 * Math.sin(t * TAU * 3))] }));

  // --- the round window, with the season outside and a deep reveal
  const winMask = ids.next();
  s.add(mask(winMask, circ(Wn.x, Wn.y, WR, WR, 22)));
  const wkids = [];
  const wskyId = ids.next();
  wkids.push(flat(rect(Wn.x - 40, Wn.y - 40, Wn.x + 40, Wn.y + 40), VSKY[TIME0][0], VSKY[TIME0][1], { name: 'sky', colorId: wskyId, tension: 0, blend: 'normal' }));
  tp(wskyId, 'colorValue', VSKY.map(([c, a]) => argb(c, a)), 'Color');
  const wstar = ids.next();
  wkids.push(group({ name: 'star', id: wstar, opacity: NIGHTSKY[TIME0] }, [el('Shape', { name: 'star', x: Wn.x - 14, y: Wn.y - 16 }, [polyXml(starPts(3), { closed: true }), fill(argb('F6E7A8', 0.95))])]));
  tp(wstar, 'opacity', NIGHTSKY);
  const farW = [P(Wn.x - 40, Wn.y + 14), P(Wn.x - 10, Wn.y + 6), P(Wn.x + 20, Wn.y + 12), P(Wn.x + 40, Wn.y + 8), P(Wn.x + 40, Wn.y + 40), P(Wn.x - 40, Wn.y + 40)];
  wkids.push(wc(ids, farW, GRASS[SEASON0], rng(201), { alpha: 0.55, off: [0, 0], wobble: 0.6, grain: 0.2, soft: false, key: 'grassw' }));
  // a branch reaching in from the right, swaying when you look out
  const branchId = ids.next();
  const twig = [P(Wn.x + 44, Wn.y - 26), P(Wn.x + 22, Wn.y - 16), P(Wn.x + 2, Wn.y - 14), P(Wn.x - 12, Wn.y - 6)];
  const leafSpots = [P(Wn.x + 26, Wn.y - 24), P(Wn.x + 14, Wn.y - 10), P(Wn.x + 4, Wn.y - 22), P(Wn.x - 8, Wn.y - 12), P(Wn.x - 10, Wn.y), P(Wn.x + 30, Wn.y - 8)];
  const leavesW = ids.next(), blossomW = ids.next(), applesW = ids.next(), snowW2 = ids.next();
  wkids.push(group({ name: 'branch', id: branchId, x: Wn.x + 44, y: Wn.y - 26 }, [group({ name: 'branch body', x: -(Wn.x + 44), y: -(Wn.y - 26) }, [
    ink(twig, rng(202), { w: 1.8, amt: 0.3, color: 'FF4A3A2C' }),
    group({ name: 'leaves', id: leavesW }, leafSpots.map((p, i) => wc(ids, blobPts(6, 3.6, rng(203 + i), { n: 7, wobble: 0.15, start: 0.5 + i }).map((q) => P(q.x + p.x, q.y + p.y)), CANOPY[SEASON0], rng(210 + i), { alpha: 0.9, off: [0, 0], wobble: 0.3, grain: 0, soft: false, key: 'canopyw' }))),
    group({ name: 'blossom', id: blossomW, opacity: SEASON0 === 0 ? 1 : 0 }, [stippleShape({ dots: leafSpots.map((p, i) => ({ x: p.x + 3, y: p.y - 2 + (i % 2) * 3, r: 2.2 })), color: argb('F2B0C4', 0.95) })]),
    group({ name: 'apples', id: applesW, opacity: SEASON0 === 2 ? 1 : 0 }, [stippleShape({ dots: [{ x: Wn.x + 18, y: Wn.y - 6, r: 3.6 }, { x: Wn.x - 4, y: Wn.y - 2, r: 3.2 }], color: argb('C8463B', 0.95) })]),
    group({ name: 'snow', id: snowW2, opacity: SEASON0 === 3 ? 1 : 0 }, [flat([...twig.map((p) => P(p.x, p.y - 2.5)), ...twig.slice().reverse().map((p) => P(p.x, p.y - 0.5))], 'FFFDF8', 0.95, { tension: 0.6 })]),
  ])]));
  sp(leavesW, 'opacity', [1, 1, 1, 0]);
  sp(blossomW, 'opacity', [1, 0, 0, 0]);
  sp(applesW, 'opacity', [0, 0, 1, 0]);
  sp(snowW2, 'opacity', [0, 0, 0, 1]);
  tint(sp, 'grassw', GRASS);
  tint(sp, 'canopyw', CANOPY);
  // frost creeping in from the edge of the pane, winter only
  const frostId = ids.next();
  wkids.push(group({ name: 'frost', id: frostId, opacity: SEASON0 === 3 ? 1 : 0 }, [
    el('Shape', { name: 'rime', x: Wn.x, y: Wn.y }, [el('Ellipse', { width: WR * 2, height: WR * 2, originX: 0.5, originY: 0.5, name: 'E' }), stroke(argb('FFFFFF', 0.85), 12, { feather: 7 })]),
    stippleShape({ name: 'crystals', dots: Array.from({ length: 22 }, (_, i) => { const a = (i / 22) * TAU + 0.2; const d = WR - 3 - (i % 3) * 3; return { x: Wn.x + Math.cos(a) * d, y: Wn.y + Math.sin(a) * d, r: 0.9 + (i % 2) * 0.5 }; }), color: argb('FFFFFF', 0.9) }),
  ]));
  sp(frostId, 'opacity', [0, 0, 0, 1]);
  const wsnow = weather('window snow', (rr) => Array.from({ length: 9 }, () => ({ x: rr.range(Wn.x - 36, Wn.x + 36), y: rr.range(Wn.y - 80, Wn.y + 10), r: rr.range(0.8, 1.5) })), argb('FFFFFF', 0.95), 3, 720, 60, 4);
  wkids.push(wsnow.xml);
  sp(wsnow.id, 'opacity', [0, 0, 0, 1]);
  // reveal, pane and mullions
  const revealPts = circ(Wn.x, Wn.y + 2, WR + 12, WR + 11, 20);
  const sill = [P(Wn.x - 36, Wn.y + 40), P(Wn.x + 36, Wn.y + 40), P(Wn.x + 40, Wn.y + 47), P(Wn.x - 40, Wn.y + 47)];
  s.add(k.in({ name: 'window in', cx: Wn.x, cy: Wn.y, t0: 40, t1: 104, sc: 0.9 }, [
    wc(ids, revealPts, C.vault, rng(221), { alpha: 0.38, off: [1, 2], wobble: 1, grain: 0.3, soft: false }),
    clipped({ name: 'outside' }, winMask, wkids),
    wc(ids, sill, C.oak, rng(222), { alpha: 0.95, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false, blend: 'normal' }),
    k.boil({
      name: 'window ink', seed: 223, draw: (rr) => [
        ink([{ pts: circ(Wn.x, Wn.y + 2, WR + 12, WR + 11, 18), closed: true }], rr, { w: 1.4, amt: 0.6, color: INK_SOFT, fx: fxThings }),
        ink([{ pts: circ(Wn.x, Wn.y, WR, WR, 18), closed: true }, { pts: sill, closed: true, tension: 0.2 }], rr, { w: 1.7, amt: 0.4, fx: fxThings }),
        ink([[P(Wn.x, Wn.y - WR), P(Wn.x, Wn.y + WR)], [P(Wn.x - WR, Wn.y), P(Wn.x + WR, Wn.y)]], rr, { w: 1.3, amt: 0.25, fx: fxThings }),
      ],
    }),
    el('Shape', { name: 'sheen' }, [pathXml([P(Wn.x - 20, Wn.y + 6), P(Wn.x - 6, Wn.y - 20)]), stroke(argb('FFFFFF', 0.5), 2.2)]),
  ]));
  // a pot of geraniums on the sill
  s.add(k.in({ name: 'pot in', cx: Wn.x + 24, cy: Wn.y + 40, t0: 118, t1: 150, sc: 0.4, ease: EASE.back }, [
    wc(ids, [P(Wn.x + 17, Wn.y + 40), P(Wn.x + 16, Wn.y + 30), P(Wn.x + 32, Wn.y + 30), P(Wn.x + 31, Wn.y + 40)], C.terra, rng(231), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.3, grain: 0.2, soft: false, blend: 'normal' }),
    wc(ids, blobPts(10, 6, rng(232), { n: 8, wobble: 0.2 }).map((p) => P(p.x + Wn.x + 24, p.y + Wn.y + 25)), '6E9A4E', rng(233), { alpha: 0.85, off: [0, 0], wobble: 0.3, grain: 0.2, soft: false }),
    stippleShape({ dots: [{ x: Wn.x + 20, y: Wn.y + 21, r: 2.6 }, { x: Wn.x + 27, y: Wn.y + 19, r: 2.8 }, { x: Wn.x + 30, y: Wn.y + 24, r: 2.2 }], color: argb('D9473F', 0.95) }),
    ink([{ pts: [P(Wn.x + 17, Wn.y + 40), P(Wn.x + 16, Wn.y + 30), P(Wn.x + 32, Wn.y + 30), P(Wn.x + 31, Wn.y + 40)], closed: true }], rng(234), { w: 1.2, amt: 0.2, tension: 0.2 }),
  ]));

  // --- pantry shelves: labelled jars, books, a crock and a loaf
  const dres = { x0: 726, x1: 822, top: 230, s1: 264, s2: 298, bot: 332 };
  const jars = [
    { x: 742, h: 24, w: 16, c: 'E0A23A' }, { x: 762, h: 20, w: 15, c: 'B53A3A' }, { x: 782, h: 26, w: 16, c: '7E9A48' }, { x: 803, h: 21, w: 15, c: '6A3E6A' },
  ];
  const jarShapes = jars.map((j) => ({ ...j, pts: [P(j.x - j.w / 2, dres.s1), P(j.x - j.w / 2 - 1, dres.s1 - j.h + 5), P(j.x - j.w / 2 + 2, dres.s1 - j.h), P(j.x + j.w / 2 - 2, dres.s1 - j.h), P(j.x + j.w / 2 + 1, dres.s1 - j.h + 5), P(j.x + j.w / 2, dres.s1)] }));
  const books = [];
  let bx = 732;
  const br2 = rng(241);
  for (const [w, h, c] of [[7, 26, '4E6E8E'], [6, 22, 'B5644A'], [8, 28, '5E8A5A'], [6, 24, 'C99A3E'], [7, 27, '8E5A6E']]) { books.push({ pts: rect(bx, dres.s2 - h, bx + w, dres.s2), c }); bx += w + br2.range(0.5, 1.5); }
  const leaning = [P(bx + 1, dres.s2), P(bx + 7, dres.s2), P(bx + 19, dres.s2 - 22), P(bx + 13, dres.s2 - 24)];
  const flatBooks = [rect(792, dres.s2 - 6, 818, dres.s2), rect(794, dres.s2 - 11, 815, dres.s2 - 6)];
  const crockP = [P(734, dres.bot), P(732, dres.bot - 20), P(738, dres.bot - 26), P(756, dres.bot - 26), P(762, dres.bot - 20), P(760, dres.bot)];
  const loaf = [P(774, dres.bot), P(772, dres.bot - 8), P(780, dres.bot - 15), P(798, dres.bot - 16), P(808, dres.bot - 9), P(808, dres.bot)];
  const shelfInk = k.boil({
    name: 'shelves ink', seed: 242, draw: (rr) => [
      ink([[P(dres.x0, dres.bot + 2), P(dres.x0, dres.top)], [P(dres.x1, dres.bot + 2), P(dres.x1, dres.top)], { pts: rect(dres.x0 - 5, dres.top - 6, dres.x1 + 5, dres.top), closed: true, tension: 0.1 }], rr, { w: 1.7, amt: 0.35, fx: fxThings }),
      ink([[P(dres.x0, dres.s1), P(dres.x1, dres.s1)], [P(dres.x0, dres.s2), P(dres.x1, dres.s2)], [P(dres.x0, dres.bot - 1), P(dres.x1, dres.bot - 1)]], rr, { w: 1.4, amt: 0.3, fx: fxThings }),
      ink(jarShapes.map((j) => ({ pts: j.pts, closed: true, tension: 0.4 })), rr, { w: 1.1, amt: 0.2, fx: fxSmall }),
      ink(jarShapes.map((j) => [P(j.x - j.w / 2 + 1, dres.s1 - j.h + 3), P(j.x + j.w / 2 - 1, dres.s1 - j.h + 3)]), rr, { w: 1, amt: 0.15, fx: fxSmall }),
      ink([...books.map((b) => ({ pts: b.pts, closed: true, tension: 0.1 })), { pts: leaning, closed: true, tension: 0.1 }, ...flatBooks.map((b) => ({ pts: b, closed: true, tension: 0.1 }))], rr, { w: 1, amt: 0.2, fx: fxSmall }),
      ink([{ pts: crockP, closed: true, tension: 0.5 }, { pts: loaf, closed: true, tension: 0.6 }, [P(784, dres.bot - 13), P(788, dres.bot - 8)], [P(792, dres.bot - 14), P(796, dres.bot - 9)]], rr, { w: 1.1, amt: 0.2, fx: fxSmall }),
    ],
  });
  s.add(k.in({ name: 'shelves in', cx: 774, cy: dres.bot, t0: 50, t1: 110, sc: 0.94 }, [
    wc(ids, rect(dres.x0, dres.top, dres.x1, dres.bot), C.wood, rng(243), { alpha: 0.5, off: [1, 1], wobble: 0.6, grain: 0.4, soft: false }),
    wc(ids, rect(dres.x0 - 5, dres.top - 6, dres.x1 + 5, dres.top), C.oak, rng(244), { alpha: 0.95, off: [1, 1], wobble: 0.4, grain: 0.2, soft: false, blend: 'normal' }),
    ...jarShapes.map((j, i) => wc(ids, j.pts, j.c, rng(250 + i), { alpha: 0.85, off: [0.6, 0.6], wobble: 0.4, grain: 0.2, soft: false })),
    ...jarShapes.map((j, i) => flat(rect(j.x - j.w / 2 + 2.5, dres.s1 - j.h * 0.55, j.x + j.w / 2 - 2.5, dres.s1 - j.h * 0.55 + 7), 'F7EEDA', 0.98, { name: 'label', tension: 0.1 })),
    ...books.map((b, i) => wc(ids, b.pts, b.c, rng(260 + i), { alpha: 0.85, off: [0.4, 0.4], wobble: 0.3, grain: 0, soft: false })),
    wc(ids, leaning, '6A7F99', rng(266), { alpha: 0.85, off: [0.4, 0.4], wobble: 0.3, grain: 0, soft: false }),
    ...flatBooks.map((b, i) => wc(ids, b, i ? 'C2913F' : '7D4E3A', rng(267 + i), { alpha: 0.85, off: [0.4, 0.4], wobble: 0.3, grain: 0, soft: false })),
    wc(ids, crockP, 'C9B48A', rng(270), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, loaf, 'D29A55', rng(271), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal' }),
    shelfInk,
  ]));

  // --- a lantern hanging from the vault (lit in the evening)
  const LX = 330, LY = 122;
  s.add(k.in({ name: 'lantern in', cx: LX, cy: archY(LX), t0: 70, t1: 120, dy: -20 }, [
    wc(ids, [P(LX - 7, LY), P(LX + 7, LY), P(LX + 8, LY + 18), P(LX - 8, LY + 18)], C.ochre, rng(281), { alpha: 0.55, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
    k.boil({ name: 'lantern ink', seed: 282, draw: (rr) => ink([[P(LX, archY(LX) + 1), P(LX, LY - 6)], { pts: [P(LX - 9, LY), P(LX, LY - 7), P(LX + 9, LY)], closed: true }, { pts: [P(LX - 7, LY), P(LX + 7, LY), P(LX + 8, LY + 18), P(LX - 8, LY + 18)], closed: true }, [P(LX - 9, LY + 20), P(LX + 9, LY + 20)]], rr, { w: 1.3, amt: 0.25, fx: fxThings, tension: 0.2 }) }),
  ]));

  // --- the light of the hour: a gradient glaze over the room, darker at the edges
  const roomMask = ids.next();
  s.add(mask(roomMask, dense([...vault, P(888, 332), P(882, 360), P(856, 384), P(790, 396), P(450, 400), P(110, 396), P(44, 384), P(18, 360), P(12, 332)])));
  const gStops = [ids.next(), ids.next(), ids.next()];
  const [gc0, ga0] = GLAZE[TIME0];
  s.add(k.in({ name: 'glaze in', t0: 0, t1: 60 }, [
    clipped({ name: 'hour light' }, roomMask, [
      group({ name: 'squash', x: Hx - 20, y: 296, scaleY: 0.62 }, [
        el('Shape', { name: 'hour glaze', blendModeValue: 'multiply' }, [
          el('Ellipse', { width: 1100, height: 1100, originX: 0.5, originY: 0.5, name: 'E' }),
          el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: 0, startY: 0, endX: 520, endY: 0, name: 'G' }, [0, 0.55, 1].map((p, i) => el('GradientStop', { colorValue: argb(gc0, ga0[i]), position: p, id: gStops[i] })))),
        ]),
      ]),
    ]),
  ]));
  gStops.forEach((id, i) => tp(id, 'colorValue', GLAZE.map(([c, a]) => argb(c, a[i])), 'Color'));

  // --- firelight: a warm glow from the hearth, stronger as the evening comes in
  const fireGlow = ids.next(), fireFlick = ids.next();
  s.add(k.in({ name: 'firelight in', t0: 90, t1: 170 }, [
    clipped({ name: 'firelight' }, roomMask, [
      group({ name: 'fire glow', id: fireGlow, opacity: FIRE[TIME0] }, [
        group({ name: 'fire flick', id: fireFlick }, [
          glow({ x: Hx, y: 306, w: 620, h: 300, color: 'FFB257', alpha: 0.9 }),
          glow({ x: Hx, y: 318, w: 170, h: 110, color: 'FFC870', alpha: 0.9 }),
        ]),
      ]),
    ]),
  ]));
  tp(fireGlow, 'opacity', FIRE);
  s.loopLayer('fire flick', s.anim({ name: 'fire flick', duration: 200, loop: 'loop', tracks: [sampled(fireFlick, 'opacity', 200, 10, (t) => 0.86 + 0.08 * Math.sin(t * TAU * 2) + 0.06 * Math.sin(t * TAU * 5 + 1))] }));

  // --- candles, the lantern and lamplight on the sill: lit at dusk and night
  const litId = ids.next();
  const flame = (x, y, sx = 1) => el('Shape', { name: 'flame', x, y }, [pathXml(tongue(0, 4, 4.5 * sx, 10 * sx, 0.5), { closed: true, tension: 0.9 }), fill(argb('FBD56A', 0.98))]);
  s.add(k.in({ name: 'lit in', t0: 130, t1: 180 }, [
    group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
      glow({ x: 438, y: 194, w: 90, h: 90, color: C.lamp, alpha: 0.5 }),
      glow({ x: 526, y: 194, w: 90, h: 90, color: C.lamp, alpha: 0.5 }),
      flame(438, 192), flame(526, 192),
      glow({ x: LX, y: LY + 10, w: 220, h: 200, color: C.lamp, alpha: 0.42 }),
      el('Shape', { name: 'pane', x: LX, y: LY + 9 }, [el('Rectangle', { width: 13, height: 15, originX: 0.5, originY: 0.5, name: 'R' }), fill(argb('F7CB5C', 0.85))]),
      flame(LX, LY + 8, 0.8),
    ]),
  ]));
  tp(litId, 'opacity', LIT);

  // --- hit areas
  const hFire = ids.next(), hKettle = ids.next(), hChair = ids.next(), hDoor = ids.next(), hPegs = ids.next(), hWin = ids.next();
  s.add(hit(hFire, Hx, 296, 96, 72), hit(hKettle, K.x - 4, K.y - 4, 44, 40), hit(hChair, 654, 290, 112, 96), hit(hDoor, D.x, D.y, 140, 140), hit(hPegs, 330, 254, 140, 100), hit(hWin, Wn.x, Wn.y, 96, 96));

  // --- poses
  poseLayer(s, 'season', season, 4, seasonP, { still });
  poseLayer(s, 'time', time, 5, timeP, { still });

  // a returning visitor's coat is on its peg
  const regular = s.input('bool', 'regular', REGULAR0);
  s.boolLayer('regular', regular, hold(s, 'no coat', [{ object: coatId, prop: 'opacity', keys: [[0, 0]] }]), hold(s, 'coat', [{ object: coatId, prop: 'opacity', keys: [[0, 1]] }]), { mixIn: 900, mixOut: 300 });

  // --- reactions
  const pop = s.input('trigger', 'pop');
  s.triggerLayer('pop', pop, s.anim({ name: 'pop', duration: 96, tracks: [
    { object: popScale, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [8, 1.12, 'cubic', EASE.inOut], [40, 0.97, 'cubic', EASE.inOut], [70, 1]] },
    { object: popScale, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [8, 1.3, 'cubic', EASE.inOut], [40, 0.96, 'cubic', EASE.inOut], [70, 1]] },
    ...sparkTracks,
  ] }), { fromAny: false });
  s.listen(hFire, 'enter', [Scene.fire(pop)]);
  s.listen(hFire, 'click', [Scene.fire(pop)]);

  const rattle = s.input('trigger', 'rattle');
  s.triggerLayer('rattle', rattle, s.anim({ name: 'rattle', duration: 60, tracks: [
    { object: lidId, prop: 'y', keys: [[0, K.y - 11], [5, K.y - 14], [10, K.y - 11], [16, K.y - 13.5], [21, K.y - 11], [28, K.y - 12.5], [33, K.y - 11], [60, K.y - 11]] },
    { object: lidId, prop: 'rotation', keys: [[0, 0], [5, -0.12], [10, 0], [16, 0.1], [21, 0], [28, -0.05], [33, 0], [60, 0]] },
  ] }), { fromAny: false });
  s.listen(hKettle, 'enter', [Scene.fire(rattle)]);
  s.listen(hKettle, 'click', [Scene.fire(rattle)]);

  const stir = s.input('trigger', 'stir');
  s.triggerLayer('stir', stir, s.anim({ name: 'stir', duration: 90, tracks: [
    { object: earId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [5, -0.35, 'cubic', EASE.inOut], [10, 0.05, 'cubic', EASE.inOut], [16, -0.2, 'cubic', EASE.inOut], [24, 0]] },
    { object: tailId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [30, -1, 'cubic', EASE.inOut], [62, 1]] },
  ] }), { fromAny: false });
  s.listen(hChair, 'enter', [Scene.fire(stir)]);
  s.listen(hChair, 'click', [Scene.fire(stir)]);

  const breeze = s.input('trigger', 'breeze');
  s.triggerLayer('breeze', breeze, s.anim({ name: 'breeze', duration: 120, tracks: [
    { object: breezeId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [40, 1.5, 'cubic', EASE.inOut], [80, 0.9, 'cubic', EASE.inOut], [120, 1]] },
  ] }), { fromAny: false });
  s.listen(hDoor, 'enter', [Scene.fire(breeze)]);

  const sway = s.input('trigger', 'sway');
  s.triggerLayer('sway', sway, s.anim({ name: 'sway', duration: 110, tracks: swayIds.map((id, i) => ({ object: id, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [12 + i * 3, 0.12 - i * 0.02, 'cubic', EASE.inOut], [36 + i * 3, -0.07, 'cubic', EASE.inOut], [62 + i * 3, 0.03, 'cubic', EASE.inOut], [90 + i * 3, 0]] })) }), { fromAny: false });
  s.listen(hPegs, 'enter', [Scene.fire(sway)]);

  const peek = s.input('trigger', 'peek');
  s.triggerLayer('peek', peek, s.anim({ name: 'peek', duration: 120, tracks: [
    { object: branchId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [14, 0.1, 'cubic', EASE.inOut], [40, -0.06, 'cubic', EASE.inOut], [70, 0.025, 'cubic', EASE.inOut], [104, 0]] },
  ] }), { fromAny: false });
  s.listen(hWin, 'enter', [Scene.fire(peek)]);

  k.finish(still);
  return s.toXml();
}

// ---------- footer: the front Door, from inside ----------

function door(ids) {
  const W = 600, H = 236;
  const s = new Scene(ids, { name: 'Door', w: W, h: H, x: 960, y: 0, bg: process.env.HE_BG ? 'FFF8F0E0' : undefined });
  const k = new Kit(s);
  const season = s.input('number', 'season', SEASON0);
  const time = s.input('number', 'time', TIME0);
  const still = s.input('bool', 'still', 0);
  const seasonP = [], timeP = [];
  const sp = (object, prop, vals, type) => seasonP.push({ object, prop, vals, type });
  const tp = (object, prop, vals, type) => timeP.push({ object, prop, vals, type });
  const fxWall = k.fx('wall', 0, 50);
  const fxDoor = k.fx('door', 10, 64);
  const fxSign = k.fx('sign', 6, 56);
  const FL = 206; // floor line

  // the same round tunnel as the hall, a little further along: plaster, panelling, tiles
  const fy = (x) => { const u = Math.min(1, Math.abs((x - 300) / 292)); return FL - (FL - 10) * Math.pow(1 - u ** 3, 1 / 3); };
  const wallTop = Array.from({ length: 31 }, (_, i) => { const x = 8 + (584 * i) / 30; return P(x, fy(x)); });
  const wallPts = dense([...wallTop, P(592, FL), P(8, FL)]);
  s.add(k.in({ name: 'wall in', cx: 300, cy: FL, t0: 0, t1: 46, sc: 0.98 }, [
    wc(ids, wallPts, C.plaster, rng(301), { alpha: 0.44, off: [0, 2], grain: 0.15, soft: true }),
    wc(ids, sharp([P(10, 160), P(590, 160), P(590, FL), P(10, FL)]), C.wood, rng(302), { alpha: 0.34, off: [0, 1], grain: 0.3, soft: false }),
    wc(ids, sharp([P(8, FL), P(592, FL), P(586, 224), P(520, 232), P(80, 232), P(14, 224)]), C.tile, rng(303), { alpha: 0.4, off: [0, 0], grain: 0.3, soft: false }),
  ]));
  const panels = [];
  for (const [a, b] of [[16, 346], [536, 586]]) {
    const n = Math.max(1, Math.round((b - a) / 50));
    const pw = (b - a) / n;
    for (let i = 0; i < n; i++) panels.push({ pts: rect(a + i * pw + 5, 170, a + (i + 1) * pw - 5, 200), closed: true, tension: 0.12 });
  }
  s.add(k.boil({
    name: 'wall ink', seed: 304, draw: (rr) => [
      ink(wallTop, rr, { w: 2, amt: 0.8, n: 30, fx: fxWall, bleed: 0.12 }),
      ink(Array.from({ length: 23 }, (_, i) => { const x = 30 + (540 * i) / 22; return P(x, fy(x) + 12); }), rr, { w: 1, amt: 0.6, n: 22, color: INK_SOFT, fx: fxWall }),
      ink([[P(10, 160), P(352, 160)], [P(10, 164), P(352, 164)], [P(532, 160), P(590, 160)], [P(532, 164), P(590, 164)]], rr, { w: 1.3, amt: 0.4, fx: fxWall }),
      ink([P(6, FL), P(594, FL)], rr, { w: 1.6, amt: 0.6, n: 16, fx: fxWall }),
      ink(panels, rr, { w: 0.9, amt: 0.35, color: INK_SOFT, fx: fxWall }),
      ink([[P(60, 220), P(150, 221)], [P(200, 219), P(300, 220)], [P(520, 220), P(570, 219)], [P(120, 207), P(110, 230)], [P(250, 207), P(246, 231)], [P(560, 207), P(566, 228)]], rr, { w: 0.9, amt: 0.4, color: INK_SOFT, fx: fxWall }),
    ],
  }));

  // the door: a view of the garden behind it, an oak frame, and the leaf hinged on the right
  const D = P(442, 128), DR = 74, RR = 86;
  const viewMask = ids.next();
  s.add(mask(viewMask, circ(D.x, D.y, DR - 0.5, DR - 0.5, 28)));
  const vsky = ids.next();
  const vk = [
    flat(rect(D.x - 80, D.y - 80, D.x + 80, D.y + 80), VSKY[TIME0][0], VSKY[TIME0][1], { name: 'sky', colorId: vsky, tension: 0, blend: 'normal' }),
  ];
  tp(vsky, 'colorValue', VSKY.map(([c, a]) => argb(c, a)), 'Color');
  const hillV = [P(D.x - 80, D.y + 22), P(D.x - 40, D.y + 10), P(D.x, D.y + 14), P(D.x + 40, D.y + 6), P(D.x + 80, D.y + 16), P(D.x + 80, D.y + 80), P(D.x - 80, D.y + 80)];
  const pathV = [P(D.x - 6, D.y + 16), P(D.x + 6, D.y + 16), P(D.x + 40, D.y + 80), P(D.x - 36, D.y + 80)];
  const fdots = [];
  const fr = rng(311);
  for (let i = 0; i < 14; i++) { const y = D.y + 26 + fr() * 44; const side = i % 2 ? 1 : -1; fdots.push({ x: D.x + side * (18 + (y - D.y) * 0.5 + fr() * 12), y, r: fr.range(1.6, 2.6) }); }
  const vFlow = ids.next(), vSnow = ids.next();
  vk.push(
    wc(ids, hillV, GRASS[SEASON0], rng(312), { alpha: 0.6, off: [0, 0], wobble: 1, grain: 0.3, soft: false, key: 'dgrass' }),
    wc(ids, pathV, 'F0E2C0', rng(313), { alpha: 0.95, off: [0, 0], wobble: 0.8, grain: 0.2, soft: false, blend: 'normal' }),
    group({ name: 'flowers', id: vFlow, opacity: SEASON0 < 2 ? 1 : 0 }, [stippleShape({ dots: fdots.filter((_, i) => i % 2), color: argb(C.rose, 0.9) }), stippleShape({ dots: fdots.filter((_, i) => !(i % 2)), color: argb(C.butter, 0.95) })]),
    group({ name: 'snow', id: vSnow, opacity: SEASON0 === 3 ? 1 : 0 }, [stippleShape({ dots: Array.from({ length: 18 }, (_, i) => ({ x: D.x - 70 + ((i * 37) % 140), y: D.y - 60 + ((i * 53) % 120), r: 1.2 })), color: argb('FFFFFF', 0.95) })]),
    ink([hillV.slice(0, 5), [pathV[0], pathV[3]], [pathV[1], pathV[2]]], rng(314), { w: 1, amt: 0.4, color: 'FF55606B' }),
  );
  sp(vFlow, 'opacity', [1, 1, 0, 0]);
  sp(vSnow, 'opacity', [0, 0, 0, 1]);
  tint(sp, 'dgrass', GRASS);
  const surround = arc(D.x, D.y, RR, 2.1, TAU + 1.04, 26);
  const surroundIn = arc(D.x, D.y, DR + 1, 1.9, TAU + 1.24, 26);
  const leafPts = circ(D.x, D.y, DR - 1, DR - 1, 24);
  const planks = [-48, -24, 0, 24, 48].map((dx) => { const hh = Math.sqrt((DR - 3) ** 2 - dx * dx); return [P(D.x + dx, D.y - hh), P(D.x + dx, D.y + hh)]; });
  const swingId = ids.next(), latchId = ids.next(), flapId = ids.next();
  const hinge = D.x + DR;
  s.add(k.in({ name: 'door in', cx: D.x, cy: D.y, t0: 8, t1: 60 }, [
    clipped({ name: 'view' }, viewMask, vk),
    wc(ids, [...surround, ...surroundIn.slice().reverse()], C.oak, rng(321), { alpha: 0.95, off: [1, 1], wobble: 0.8, grain: 0.5, blend: 'normal', soft: false, wetLayer: false }),
    k.boil({
      name: 'frame ink', seed: 322, draw: (rr) => [
        ink(surround, rr, { w: 2, amt: 0.6, fx: fxDoor, bleed: 0.12 }),
        ink(surroundIn, rr, { w: 1.4, amt: 0.5, fx: fxDoor }),
        ink(Array.from({ length: 10 }, (_, i) => { const a = 2.35 + (i / 9) * 4.7; return [P(D.x + Math.cos(a) * (DR + 2), D.y + Math.sin(a) * (DR + 2)), P(D.x + Math.cos(a) * (RR - 2), D.y + Math.sin(a) * (RR - 2))]; }), rr, { w: 0.9, amt: 0.3, color: INK_SOFT, fx: fxDoor }),
      ],
    }),
    group({ name: 'swing', id: swingId, x: hinge, y: D.y }, [group({ name: 'leaf body', x: -hinge, y: -D.y }, [
      wc(ids, leafPts, C.door, rng(323), { alpha: 0.95, off: [1.5, 1.5], wobble: 1, grain: 0.6, blend: 'normal', soft: false }),
      wc(ids, circ(D.x - 44, D.y, 5.5, 5.5, 8), C.brass, rng(324), { alpha: 0.95, off: [0.6, 0.6], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
      wc(ids, rect(D.x - 16, D.y + 30, D.x + 16, D.y + 38), C.brass, rng(325), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
      k.boil({
        name: 'leaf ink', seed: 326, draw: (rr) => [
          ink({ pts: leafPts, closed: true }, rr, { w: 1.9, amt: 0.5, fx: fxDoor }),
          ink(planks, rr, { w: 0.9, amt: 0.4, color: INK_SOFT, fx: fxDoor }),
          ink([[P(hinge - 4, D.y - 34), P(D.x - 14, D.y - 34)], [P(hinge - 4, D.y + 52), P(D.x - 4, D.y + 52)]], rr, { w: 2.2, amt: 0.3, fx: fxDoor }),
          ink([{ pts: circ(D.x - 44, D.y, 5.5, 5.5, 8), closed: true }, { pts: rect(D.x - 16, D.y + 30, D.x + 16, D.y + 38), closed: true, tension: 0.1 }], rr, { w: 1.3, amt: 0.2, fx: fxDoor }),
        ],
      }),
      // the letterbox flap, which lifts when post comes
      group({ name: 'flap', id: flapId, x: D.x, y: D.y + 30 }, [
        flat(rect(-15, 0, 15, 4), darken(C.brass, 0.15), 0.95, { tension: 0 }),
        ink([P(-15, 4), P(15, 4)], rng(327), { w: 1, amt: 0.1 }),
      ]),
      // the latch bar
      group({ name: 'latch', id: latchId, x: D.x - 56, y: D.y - 2 }, [
        ink([P(0, 0), P(-14, 0)], rng(328), { w: 2.6, amt: 0.1 }),
        ink([[P(-18, -5), P(-18, 5)]], rng(329), { w: 1.6, amt: 0.1 }),
      ]),
    ])]),
  ]));
  const spillId = ids.next(), spillColor = ids.next();
  s.add(group({ name: 'spill', id: spillId, opacity: 0 }, [
    el('Shape', { name: 'spill' }, [pathXml([P(370, FL + 1), P(470, FL + 1), P(436, 234), P(320, 234)], { closed: true, tension: 0.3 }), el('Fill', { name: 'Fill', fillRule: 'clockwise' }, [el('SolidColor', { colorValue: argb(SPILL[TIME0][0], SPILL[TIME0][1]), name: 'C', id: spillColor }), el('Feather', { strength: 7, name: 'F' })])]),
  ]));
  tp(spillColor, 'colorValue', SPILL.map(([c, a]) => argb(c, a)), 'Color');

  // a doormat, and a letter that comes through the box
  const mat = [P(392, FL + 6), P(492, FL + 6), P(498, FL + 18), P(386, FL + 18)];
  s.add(k.in({ name: 'mat in', cx: 442, cy: FL + 12, t0: 40, t1: 80, sc: 0.7 }, [
    wc(ids, mat, C.ochre, rng(331), { alpha: 0.8, off: [0.5, 0.5], wobble: 0.5, grain: 0.7, soft: false }),
    ink([{ pts: mat, closed: true, tension: 0.2 }, [P(396, FL + 12), P(488, FL + 12)]], rng(332), { w: 1.2, amt: 0.3 }),
  ]));
  const letterId = ids.next();
  s.add(group({ name: 'letter', id: letterId, x: D.x, y: D.y + 34, opacity: 0 }, [
    flat(rect(-11, -7, 11, 7), 'F7F0DE', 1, { tension: 0 }),
    ink([{ pts: rect(-11, -7, 11, 7), closed: true, tension: 0 }, [P(-11, -7), P(0, 1), P(11, -7)]], rng(333), { w: 1, amt: 0.15, tension: 0.2 }),
    el('Shape', { name: 'seal', x: 0, y: 2 }, [el('Ellipse', { width: 4, height: 4, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('C8463B', 1))]),
  ]));

  // a lantern on a bracket beside the door
  const LX = 330, LY = 92;
  s.add(k.in({ name: 'lantern in', cx: LX, cy: LY, t0: 20, t1: 60, sc: 0.8 }, [
    wc(ids, [P(LX - 7, LY), P(LX + 7, LY), P(LX + 8, LY + 18), P(LX - 8, LY + 18)], C.ochre, rng(341), { alpha: 0.55, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
    k.boil({ name: 'lantern ink', seed: 342, draw: (rr) => ink([[P(LX + 22, LY - 14), P(LX, LY - 14), P(LX, LY - 7)], { pts: [P(LX - 9, LY), P(LX, LY - 7), P(LX + 9, LY)], closed: true }, { pts: [P(LX - 7, LY), P(LX + 7, LY), P(LX + 8, LY + 18), P(LX - 8, LY + 18)], closed: true }, [P(LX - 9, LY + 20), P(LX + 9, LY + 20)], [P(LX + 22, LY - 20), P(LX + 22, LY - 6)]], rr, { w: 1.3, amt: 0.25, fx: fxDoor, tension: 0.2 }) }),
  ]));

  // the sign board, hung on a peg by its string: the words are HTML laid over it
  const board = [P(74, 70), P(286, 66), P(289, 150), P(77, 154)];
  s.add(k.in({ name: 'sign in', cx: 181, cy: 32, t0: 4, t1: 50, sc: 0.96 }, [
    wc(ids, board, 'F2E6C8', rng(351), { alpha: 1, off: [2, 2], wobble: 1.5, grain: 0.3, soft: false, blend: 'normal' }),
    stippleShape({ name: 'nails', dots: [{ x: 94, y: 74, r: 1.6 }, { x: 266, y: 70, r: 1.6 }], color: INK }),
    k.boil({
      name: 'sign ink', seed: 352, draw: (rr) => [
        ink({ pts: board, closed: true }, rr, { w: 1.9, amt: 0.6, fx: fxSign, tension: 0.15 }),
        ink([[P(94, 74), P(181, 33), P(266, 70)]], rr, { w: 1, amt: 0.3, color: INK_SOFT, fx: fxSign, tension: 0.2 }),
        ink([[P(175, 35), P(187, 31)], { pts: circ(181, 32, 4, 4, 8), closed: true }], rr, { w: 1.8, amt: 0.2, fx: fxSign }),
        ink([[P(84, 74), P(278, 70)]], rr, { w: 0.8, amt: 0.6, color: INK_SOFT, fx: fxSign }),
      ],
    }),
  ]));

  // hour glaze, lantern light
  const wallMask = ids.next();
  s.add(mask(wallMask, dense([...wallTop, P(592, FL), P(586, 224), P(520, 232), P(80, 232), P(14, 224), P(8, FL)])));
  const gStops = [ids.next(), ids.next(), ids.next()];
  const [gc0, ga0] = GLAZE[TIME0];
  s.add(clipped({ name: 'hour light' }, wallMask, [
    group({ name: 'squash', x: 300, y: 140, scaleY: 0.5 }, [
      el('Shape', { name: 'hour glaze', blendModeValue: 'multiply' }, [
        el('Ellipse', { width: 760, height: 760, originX: 0.5, originY: 0.5, name: 'E' }),
        el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: 0, startY: 0, endX: 360, endY: 0, name: 'G' }, [0, 0.55, 1].map((p, i) => el('GradientStop', { colorValue: argb(gc0, ga0[i] * 0.7), position: p, id: gStops[i] })))),
      ]),
    ]),
  ]));
  gStops.forEach((id, i) => tp(id, 'colorValue', GLAZE.map(([c, a]) => argb(c, a[i] * 0.7)), 'Color'));
  const litId = ids.next();
  s.add(group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
    glow({ x: LX, y: LY + 10, w: 200, h: 180, color: C.lamp, alpha: 0.5 }),
    el('Shape', { name: 'pane', x: LX, y: LY + 9 }, [el('Rectangle', { width: 13, height: 15, originX: 0.5, originY: 0.5, name: 'R' }), fill(argb('F7CB5C', 0.85))]),
    el('Shape', { name: 'flame', x: LX, y: LY + 8 }, [pathXml(tongue(0, 4, 4, 9, 0.5), { closed: true, tension: 0.9 }), fill(argb('FBD56A', 0.98))]),
  ]));
  tp(litId, 'opacity', LIT);

  poseLayer(s, 'season', season, 4, seasonP, { still });
  poseLayer(s, 'time', time, 5, timeP, { still });

  // see out: the latch lifts and the door swings open; it stays open
  const seeout = s.input('trigger', 'seeout');
  const opening = s.anim({ name: 'opening', duration: 130, tracks: [
    { object: latchId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [14, -0.5, 'hold'], [34, -0.5, 'cubic', EASE.inOut], [60, 0]] },
    { object: swingId, prop: 'scaleX', keys: [[0, 1, 'hold'], [16, 1, 'cubic', [0.5, 0, 0.2, 1]], [110, 0.34]] },
    { object: spillId, prop: 'opacity', keys: [[0, 0, 'hold'], [24, 0, 'cubic', EASE.out], [110, 1]] },
  ] });
  const shut = hold(s, 'shut', [{ object: latchId, prop: 'rotation', keys: [[0, 0]] }, { object: swingId, prop: 'scaleX', keys: [[0, 1]] }, { object: spillId, prop: 'opacity', keys: [[0, 0]] }]);
  const open = hold(s, 'open', [{ object: latchId, prop: 'rotation', keys: [[0, 0]] }, { object: swingId, prop: 'scaleX', keys: [[0, 0.34]] }, { object: spillId, prop: 'opacity', keys: [[0, 1]] }]);
  const a = ids.next(), b = ids.next(), c = ids.next();
  s.layers.push(s._layer('seeout', [
    el('AnyState', { x: 100, y: -120 }),
    el('ExitState', { x: 700, y: -120 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: a })),
    el('AnimationState', { x: 200, y: 0, animationId: shut, id: a }, [
      el('StateTransition', { stateToId: b }, el('TransitionTriggerCondition', { inputId: seeout })),
    ]),
    el('AnimationState', { x: 400, y: 0, animationId: opening, id: b }, el('StateTransition', { stateToId: c, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 })),
    el('AnimationState', { x: 600, y: 0, animationId: open, id: c }),
  ]));

  // post: the flap lifts and a letter drops onto the mat
  const post = s.input('trigger', 'post');
  s.triggerLayer('post', post, s.anim({ name: 'post', duration: 200, tracks: [
    { object: flapId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [8, -1.6, 'hold'], [30, -1.6, 'cubic', EASE.back], [44, 1]] },
    { object: letterId, prop: 'opacity', keys: [[0, 0, 'hold'], [10, 1, 'hold'], [160, 1, 'linear'], [196, 0]] },
    { object: letterId, prop: 'y', keys: [[0, D.y + 34, 'hold'], [10, D.y + 34, 'cubic', EASE.in], [40, FL + 10, 'cubic', EASE.out], [48, FL + 6, 'cubic', EASE.in], [56, FL + 10]] },
    { object: letterId, prop: 'x', keys: [[0, D.x, 'hold'], [10, D.x, 'cubic', EASE.out], [56, D.x - 18]] },
    { object: letterId, prop: 'rotation', keys: [[0, 0, 'hold'], [10, 0, 'cubic', EASE.inOut], [40, -0.5, 'cubic', EASE.out], [56, -0.12]] },
  ] }), { fromAny: false });
  const hDoor = ids.next();
  s.add(hit(hDoor, D.x, D.y, 160, 160));
  s.listen(hDoor, 'enter', [Scene.fire(post)]);

  k.finish(still);
  return s.toXml();
}

export default function () {
  TINT.clear();
  const ids = new Ids(10);
  return document(hall(ids), door(ids));
}
