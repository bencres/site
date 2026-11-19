// Draft 20 · The lane: signs along a country lane, down the Hill through a
// village of round doors, to your own gate. Draft 16's hand (boiling ink,
// washes laid in a little off the line), with the walk itself as the site.
//
// Two artboards share one file: Lane (the hero: the top of the lane, looking
// down into the village; the fingerpost nav is HTML standing in its left bank)
// and Gate (the footer: the end of the walk, your gate and painted sign, the
// inn across the lane). The bits of lane between sections are inline SVG,
// painted once in the page, so the whole walk costs two canvases.
//
// Inputs, both artboards: season 0..3 (spring, summer, autumn, winter),
// time 0..4 (morning, day, late afternoon, dusk, night), still (skip the intro).
// Lane also: triggers rustle, peek, swing. Gate: open (bool), knock (trigger).
//
// Performance: one combined boil animation per artboard, hard-edged glazes
// (feathers only on the few big soft washes), radial-gradient glows, season and
// time as 1-frame hold poses picked once at load, weather loops gated by season.
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, polyXml,
  fill, stroke, stippleShape, document, EASE,
} from '../lib/ink.mjs';

const SEASON0 = +(process.env.LN_SEASON ?? 2);
const TIME0 = +(process.env.LN_TIME ?? 1);
const OPEN0 = process.env.LN_OPEN ? 1 : 0;
const SPEED = 0.9; // intro frame scale (60 fps)

const INK = 'FF2B231C'; // iron-gall brown-black
const INK_SOFT = 'FF5E554C';
const C = {
  grass: '7FAE57',
  door: '3E7A50',
  brass: 'D2A23A',
  ochre: 'D9A93F',
  terra: 'C0603E',
  brick: 'B5644A',
  stone: 'B8A88A',
  cream: 'EADBB4',
  sky: '86B8DA',
  slate: '8C99AA',
  lamp: 'F5C451',
  rose: 'D9738A',
  violet: '8E86C9',
  butter: 'E9B93A',
  white: 'F2EEE6',
  wood: 'A27A4F',
  post: 'B89470',
  lane: 'E6CF9C',
  shadow: '6D6890',
  thatch: 'C9A05A',
};

// ---------- small helpers ----------

const group = (attrs, kids) => el('Node', attrs, [].concat(kids).filter(Boolean).reverse());
const alphaHex = (a) => Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
const circ = (cx, cy, rx, ry = rx, n = 16, a0 = 0) =>
  Array.from({ length: n }, (_, i) => P(cx + Math.cos(a0 + (i / n) * TAU) * rx, cy + Math.sin(a0 + (i / n) * TAU) * ry));
const lerp = (a, b, t) => a + (b - a) * t;

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
  const paths = items.map((it) => pathXml(trace(it.pts, r, amt, it.n ?? n), { closed: it.closed, tension: it.tension ?? tension }));
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
function tintTracks(key, color, k = 1) {
  return (TINT.get(key) || []).map((t) => ({
    object: t.id, prop: 'colorValue', type: 'Color',
    vals: argb(t.role === 'rim' ? darken(color, 0.28) : color, t.alpha * k),
  }));
}

/**
 * Watercolor for an outline in artboard coords: a hard-edged glaze with a pooled
 * rim (how a wash dries), a smaller wet-in-wet glaze (soft only on big areas),
 * and granulation. `off` misregisters the paint from the ink line.
 */
function wc(ids, pts, color, r, { alpha = 0.55, off = [2.5, 2], wobble = 2, grain = 0.8, soft, name = 'paint', key, id, opacity, blend = 'multiply', rimK = 1, hazy = false, tension } = {}) {
  const ten = tension ?? (pts.length <= 8 ? 0.3 : 1);
  const opaque = blend === 'normal' && alpha >= 0.9;
  const shape = pts.map((p) => P(p.x + off[0] + r.jit(wobble), p.y + off[1] + r.jit(wobble)));
  const c = centroid(shape);
  const wet = shape.map((p) => P(c.x + (p.x - c.x) * 0.76 + r.jit(wobble * 1.6), c.y + (p.y - c.y) * 0.72 + r.jit(wobble * 1.6)));
  const xs = shape.map((p) => p.x), ys = shape.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const area = (x1 - x0) * (y1 - y0);
  const useSoft = soft ?? area > 2600;
  const dots = [];
  const want = Math.min(150, Math.round((area / 110) * grain));
  for (let i = 0, tries = 0; i < want && tries < want * 6; tries++) {
    const d = P(r.range(x0, x1), r.range(y0, y1));
    if (inside(d, shape)) { dots.push({ ...d, r: r.range(0.35, 0.9) }); i++; }
  }
  const softness = Math.max(3, Math.min(x1 - x0, y1 - y0) * 0.14);
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
    el('Shape', { name: 'wet', blendModeValue: blend === 'normal' ? undefined : blend }, [pathXml(wet, { closed: true, tension: ten }), wetFill]),
    dots.length ? stippleShape({ name: 'grain', dots, color: argb('5E4A36', Math.min(0.3, alpha * 0.32)) }) : '',
  ]);
}

// a soft glow as one radial-gradient ellipse (cheaper than a feather)
function glow({ name = 'glow', x, y, w, h, color, alpha, id, opacity, colorKey }) {
  const stops = [[0, alpha], [0.3, alpha * 0.66], [0.6, alpha * 0.26], [1, 0]];
  return el('Shape', { name, x, y, id, opacity }, [
    el('Ellipse', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'g' }),
    el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: 0, startY: 0, endX: w / 2, endY: 0, name: 'G' }, stops.map(([p, a]) => el('GradientStop', { colorValue: argb(color, a), position: p })))),
  ]);
}

function hit(id, x, y, w, h) {
  return el('Shape', { x, y, name: 'hit', id }, [el('Rectangle', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'R' }), fill('00000000')]);
}

// sample a function of phase into keyframes so loops can be authored as curves
function sampled(object, prop, frames, step, fn) {
  const keys = [];
  for (let f = 0; f <= frames; f += step) keys.push([Math.min(f, frames), fn(Math.min(f, frames) / frames), 'linear']);
  if (keys.at(-1)[0] !== frames) keys.push([frames, fn(1), 'linear']);
  return { object, prop, keys };
}

function scallop(cx, cy, R, r, { n = 44, bumps = 7, depth = 0.11, squash = 1 } = {}) {
  const pts = [];
  const ph = r.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + depth * Math.abs(Math.sin(a * bumps * 0.5 + ph)) + r.jit(0.025);
    pts.push(P(cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k * squash));
  }
  return pts;
}

function cloudPts(w, h, r) {
  const pts = [];
  const bumps = 3 + Math.floor(r() * 2);
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const env = Math.sin(t * Math.PI);
    pts.push(P(-w / 2 + t * w, -h * env * (0.62 + 0.38 * Math.abs(Math.sin(t * Math.PI * bumps)))));
  }
  for (let i = 1; i < 8; i++) {
    const t = 1 - i / 8;
    pts.push(P(-w / 2 + t * w + r.jit(2), h * 0.12 * Math.sin(t * Math.PI) + r.jit(1)));
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

// ---------- scene plumbing: boil, draw-on, intro, poses ----------

class Kit {
  constructor(s) {
    this.s = s;
    this.ids = s.ids;
    this.boilTracks = [];
    this.intro = [];
  }
  // line boil: N re-traced cels swapped by a Solo; all boils share one animation
  boil({ name = 'boil', seed, draw, x, y }) {
    const r = rng(seed);
    const soloId = this.ids.next();
    const celIds = [];
    const kids = [];
    for (let i = 0; i < 3; i++) {
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
function poseLayer(s, name, inputId, n, props, { mix = 1600 } = {}) {
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
      sts.filter((_, j) => j !== i).map((st) => el('StateTransition', { stateToId: st, duration: mix }, cond(sts.indexOf(st)))))),
  ]));
}

// a loop that only runs while every condition holds (rests otherwise)
function gatedLoop(s, name, animId, conds) {
  const rest = s.ids.next(), run = s.ids.next();
  const c = ([inputId, op, value]) => el('TransitionNumberCondition', { inputId, opValue: op, value });
  const inverse = { equal: 'notEqual', notEqual: 'equal', greaterThanOrEqual: 'lessThan', lessThan: 'greaterThanOrEqual', greaterThan: 'lessThanOrEqual', lessThanOrEqual: 'greaterThan' };
  s.layers.push(s._layer(name, [
    el('AnyState', { x: 100, y: -120 }),
    el('ExitState', { x: 500, y: -120 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: rest })),
    el('AnimationState', { x: 200, y: 0, animationId: s.empty(), id: rest }, el('StateTransition', { stateToId: run }, conds.map(c))),
    el('AnimationState', { x: 400, y: 0, animationId: animId, id: run },
      conds.map(([i, op, v]) => el('StateTransition', { stateToId: rest }, c([i, inverse[op], v])))),
  ]));
}

// a pose for the 1-frame bool layer helper
const hold = (s, name, tracks) => s.anim({ name, duration: 1, tracks });

// pose colour for one registered tint id: (re)derive from the role
function tintColor(key, id, color, k) {
  const t = TINT.get(key).find((x) => x.id === id);
  return argb(t.role === 'rim' ? darken(color, 0.28) : color, Math.min(1, t.alpha * k));
}

// many tiny dots in one shape, with a colour a pose can re-tint
function dotsShape({ name = 'dots', dots, color, colorId, opacity, id }) {
  return el('Shape', { name, opacity, id }, [
    ...dots.map((d) => el('Ellipse', { x: d.x, y: d.y, width: d.r * 2, height: (d.ry ?? d.r) * 2, originX: 0.5, originY: 0.5, name: 'd' })),
    el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: color, name: 'C', id: colorId })),
  ]);
}

// a band of white gouache over a blue-grey shadow, sitting on a line
function snowCap(pts, th, seed) {
  const sr = rng(seed);
  const top = pts.map((p) => P(p.x + sr.jit(0.8), p.y - 1 + sr.jit(0.8)));
  const bot = pts.slice().reverse().map((p, i) => P(p.x + sr.jit(0.8), p.y + th * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7))) + sr.jit(0.6)));
  const outline = [...top, ...bot];
  return [
    el('Shape', { name: 'snow shade', x: 0.5, y: 1.6, blendModeValue: 'multiply' }, [pathXml(outline, { closed: true, tension: 0.6 }), fill(argb('9AAFC6', 0.55))]),
    el('Shape', { name: 'snow' }, [pathXml(outline, { closed: true, tension: 0.6 }), fill(argb('FFFDF8', 0.95))]),
  ];
}

// left and right edges of a ribbon laid along a centre line
function ribbon(center, widths) {
  const L = [], R = [];
  center.forEach((c, i) => {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y;
    const d = Math.hypot(tx, ty) || 1;
    tx /= d; ty /= d;
    const w = widths[i] / 2;
    L.push(P(c.x + ty * w, c.y - tx * w));
    R.push(P(c.x - ty * w, c.y + tx * w));
  });
  return { L, R };
}

// a turf knoll: a soft dome sitting on a base line
function knoll(cx, base, w, h, r, n = 14) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = cx - w / 2 + t * w;
    pts.push(P(x + r.jit(1), base - Math.pow(Math.sin(t * Math.PI), 0.75) * h + r.jit(1)));
  }
  return pts;
}

// ---------- palettes ----------

// per time: morning, day, late afternoon, dusk, night
const SKY = [['A9CDEB', 0.4], ['7DB5E0', 0.42], ['9FC0DA', 0.34], ['B49ACB', 0.42], ['34508F', 0.62]];
const HORIZON = [['F2B98A', 0.34], ['E9DCAE', 0.14], ['EDB45A', 0.36], ['E8845A', 0.5], ['5A5E92', 0.3]];
const GLAZE = [['F4CFA8', 0.1], ['F4E3B0', 0], ['E9B356', 0.15], ['A06D9A', 0.24], ['1E2A5E', 0.42]];
const SUN = ['F2C66B', 'EDB940', 'E8993A', 'DB6239', 'DB6239'];
const SUNPOS = [[812, 104, 0.9], [610, 54, 1], [452, 96, 1.04], [440, 232, 1.15], [440, 232, 1.15]];
const SHADOW = [[-1.8, 0.7], [0.55, 0.9], [2.6, 0.85], [3.6, 0.45], [1, 0]];
const LIT = [0, 0, 0, 1, 1];
// per season: spring, summer, autumn, winter
const FAR = ['93BFD1', '86B3C9', '9DAEC0', 'B1BDCA'];
const FIELDS = ['A3C988', '8DB884', 'C2B36E', 'C7CFCB'];
const KNOLL = ['A6C864', '74A553', 'A8A957', 'B4BFB2'];
const CANOPY = ['A2CB6A', '5E9A4A', 'D38B3B', '8F8A7A'];
const HEDGE = ['8DBA5E', '5F9447', '8E9A48', '8D9C88'];
const GROUND = ['9CC26A', '86B35B', 'B8A455', 'C3CAC2'];
const LANE = ['EAD9AE', 'EBD6A4', 'E2CB9E', 'E2E2DE'];
const BLOOM = [['F4EFE6', 0.95], ['E79CB2', 0.95], ['C4503B', 0.95], ['C4503B', 0]]; // hawthorn, dog rose, hips
const DROP = ['F2E9E4', '6E9F4E', 'D08A3A', 'C9D6E2'];

// ---------- hero: the top of the Lane ----------

function lane(ids) {
  const W = 900, H = 440;
  const s = new Scene(ids, { name: 'Lane', w: W, h: H, x: 0, y: 0, bg: process.env.LN_BG ? 'FFF8F2E4' : undefined });
  const k = new Kit(s);
  const r = rng(1954);
  const season = s.input('number', 'season', SEASON0);
  const time = s.input('number', 'time', TIME0);
  const still = s.input('bool', 'still', 0);
  const seasonP = [], timeP = [];
  const sp = (object, prop, vals, type) => seasonP.push({ object, prop, vals, type });
  const tp = (object, prop, vals, type) => timeP.push({ object, prop, vals, type });
  const tint = (key, pal, list, alphaOf = () => 1) => {
    for (const t of tintTracks(key, 'FFFFFF')) list.push({ object: t.object, prop: t.prop, type: 'Color', vals: pal.map((c, i) => tintColor(key, t.object, Array.isArray(c) ? c[0] : c, alphaOf(c, i))) });
  };

  // draw-on order
  const fxLand = k.fx('land', 4, 70);
  const fxSky = k.fx('sky', 34, 96);
  const fxVillage = k.fx('village', 30, 104);
  const fxHedge = k.fx('hedge', 18, 88);
  const fxLamp = k.fx('lamp', 70, 124);

  // --- sky: one big soft wash, a warmer band where the valley meets it
  const skyPts = blobPts(380, 104, rng(2), { n: 16, wobble: 0.1 }).map((p) => P(p.x + 520, p.y + 120));
  const sky2Pts = blobPts(150, 46, rng(6), { n: 12, wobble: 0.14 }).map((p) => P(p.x + 170, p.y + 92));
  const horPts = blobPts(300, 36, rng(3), { n: 14, wobble: 0.16 }).map((p) => P(p.x + 560, p.y + 214));
  s.add(k.in({ name: 'sky', cx: 480, cy: 140, t0: 0, t1: 60, sc: 0.94 }, [
    wc(ids, skyPts, SKY[1][0], rng(4), { alpha: 0.36, off: [0, 0], grain: 0.1, soft: true, key: 'sky', hazy: true }),
    wc(ids, sky2Pts, SKY[1][0], rng(7), { alpha: 0.36, off: [0, 0], grain: 0.1, soft: true, key: 'sky', hazy: true }),
    wc(ids, horPts, HORIZON[1][0], rng(5), { alpha: 0.34, off: [0, 0], grain: 0.12, soft: true, key: 'horizon', hazy: true }),
  ]));
  for (const t of tintTracks('sky', 'FFFFFF')) tp(t.object, t.prop, SKY.map(([c, a]) => tintColor('sky', t.object, c, a / 0.36)), 'Color');
  for (const t of tintTracks('horizon', 'FFFFFF')) tp(t.object, t.prop, HORIZON.map(([c, a]) => tintColor('horizon', t.object, c, a / 0.34)), 'Color');

  // --- stars and moon (night only)
  const nightId = ids.next();
  const starSpots = [[520, 44, 4], [612, 92, 3], [700, 36, 3.5], [834, 58, 3], [404, 70, 3], [258, 50, 3.5], [470, 128, 2.5], [770, 140, 2.5]];
  s.add(group({ name: 'night sky', id: nightId, opacity: TIME0 === 4 ? 1 : 0 }, [
    ink(starSpots.map(([x, y, R]) => ({ pts: starPts(R).map((p) => P(p.x + x, p.y + y)), closed: true, tension: 0.2 })), rng(8), { w: 1.1, amt: 0.15, color: 'FFF1DFA6' }),
    glow({ x: 760, y: 78, w: 120, h: 120, color: 'F5E6B0', alpha: 0.3 }),
    wc(ids, circ(760, 78, 17, 17, 14), 'F2E3A8', rng(9), { alpha: 0.95, off: [0, 0], wobble: 0.6, grain: 0.4, soft: false, blend: 'normal' }),
    wc(ids, circ(768, 73, 14, 14, 12), '34508F', rng(10), { alpha: 0.5, off: [0, 0], wobble: 0.4, grain: 0, soft: false }),
    ink({ pts: circ(760, 78, 17, 17, 12), closed: true }, rng(11), { w: 1.3, amt: 0.3, color: 'FFE9DDB0' }),
  ]));
  tp(nightId, 'opacity', [0, 0, 0, 0.35, 1]);

  // --- sun: moves with the hour; rays only while it is high
  const sunId = ids.next(), raysId = ids.next(), haloId = ids.next();
  const rays = k.boil({
    name: 'rays', seed: 12, draw: (rr) => {
      const list = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + rr.jit(0.07);
        list.push([P(Math.cos(a) * 30, Math.sin(a) * 30), P(Math.cos(a) * 39, Math.sin(a) * 39)]);
      }
      return ink(list, rr, { w: 1.5, amt: 0.5, fx: fxSky });
    },
  });
  const sunInk = k.boil({ name: 'sun ink', seed: 13, draw: (rr) => ink({ pts: blobPts(22, 22, rr, { n: 9, wobble: 0.04 }), closed: true }, rr, { w: 1.8, amt: 0.4, fx: fxSky }) });
  s.add(k.in({ name: 'sun in', t0: 24, t1: 70 }, [
    group({ name: 'sun', id: sunId, x: SUNPOS[TIME0][0], y: SUNPOS[TIME0][1] }, [
      glow({ name: 'halo', id: haloId, x: 0, y: 0, w: 140, h: 140, color: C.lamp, alpha: 0.3 }),
      wc(ids, blobPts(24, 23, rng(14), { n: 10, wobble: 0.07 }), SUN[1], rng(15), { alpha: 0.75, off: [3, 2], wobble: 1, grain: 0.5, key: 'sun', soft: false }),
      sunInk,
      group({ name: 'rays', id: raysId }, [rays]),
    ]),
  ]));
  tp(sunId, 'x', SUNPOS.map((p) => p[0]));
  tp(sunId, 'y', SUNPOS.map((p) => p[1]));
  tp(sunId, 'scaleX', SUNPOS.map((p) => p[2]));
  tp(sunId, 'scaleY', SUNPOS.map((p) => p[2]));
  tp(sunId, 'opacity', [1, 1, 1, 0.95, 0]);
  tp(raysId, 'opacity', [1, 1, 0.75, 0, 0]);
  tp(haloId, 'opacity', [0.7, 0.8, 1, 1, 0]);
  for (const t of tintTracks('sun', 'FFFFFF')) tp(t.object, t.prop, SUN.map((c) => tintColor('sun', t.object, c, 1)), 'Color');

  // --- two clouds, drifting a little
  const clouds = [
    { x: 330, y: 70, w: 110, h: 30, seed: 21, dx: 22, dur: 1500 },
    { x: 700, y: 118, w: 92, h: 24, seed: 24, dx: -18, dur: 1700 },
  ];
  const cloudKids = [];
  clouds.forEach((c, i) => {
    const id = ids.next();
    const cr = rng(c.seed);
    const base = cloudPts(c.w, c.h, cr);
    const b = k.boil({ name: `cloud${i} ink`, seed: c.seed + 1, draw: (rr) => ink({ pts: base, closed: true }, rr, { w: 1.5, amt: 0.6, fx: fxSky }) });
    cloudKids.push(group({ name: `cloud${i}`, x: c.x, y: c.y, id }, [wc(ids, base, C.slate, cr, { alpha: 0.22, off: [4, 4], grain: 0.4, soft: false }), b]));
    s.loopLayer(`cloud${i} drift`, s.anim({ name: `cloud${i} drift`, duration: c.dur, loop: 'pingPong', tracks: [{ object: id, prop: 'x', keys: [[0, c.x, 'cubic', EASE.inOut], [c.dur, c.x + c.dx]] }] }));
  });
  const cloudsId = ids.next();
  s.add(k.in({ name: 'clouds in', t0: 50, t1: 110 }, [group({ name: 'clouds', id: cloudsId }, cloudKids)]));
  tp(cloudsId, 'opacity', [1, 1, 1, 0.85, 0.5]);

  // --- birds: cross the sky every 44 s. Each crossing starts and ends
  // off-canvas and holds there, so the loop wraps unseen (no return trip).
  const flyDur = 2640;
  const flyers = [{ y: 132, start: 300, scale: 0.9, seed: 31 }, { y: 150, start: 352, scale: 0.66, seed: 37 }];
  const flyTracks = [];
  const birdKids = [];
  flyers.forEach((f, i) => {
    const id = ids.next(), flapId = ids.next();
    const r0 = rng(f.seed);
    const cels = [0, 1].map((cel) => {
      const cid = ids.next();
      const up = cel === 0 ? -7 : 3;
      return { cid, xml: el('Node', { name: `wing${cel}`, id: cid }, ink([P(-12, up), P(-6, up * 0.4 - 3), P(0, 0), P(6, up * 0.4 - 3), P(12, up)], r0, { w: 1.6, amt: 0.3 })) };
    });
    birdKids.push(group({ name: `flyer${i}`, x: W + 40, y: f.y, id, scaleX: f.scale, scaleY: f.scale, opacity: 0 }, [el('Solo', { name: 'flap', id: flapId, activeComponentId: cels[0].cid }, cels.map((c) => c.xml))]));
    s.loopLayer(`flyer${i} flap`, s.anim({ name: `flap${i}`, duration: 22 + i * 2, loop: 'loop', tracks: [{ object: flapId, prop: 'activeComponentId', type: 'Id', keys: [[0, cels[0].cid, 'hold'], [11 + i, cels[1].cid, 'hold']] }] }));
    // right to left this time, down towards the village
    const cross = 820;
    const t0 = f.start, t1 = f.start + cross;
    flyTracks.push(
      { object: id, prop: 'x', keys: [[0, W + 40, 'hold'], [t0, W + 40, 'linear'], [t1, -40, 'hold'], [flyDur, -40, 'hold']] },
      { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [t0 - 1, 1, 'hold'], [t1 + 1, 0, 'hold'], [flyDur, 0, 'hold']] },
      sampled(id, 'y', flyDur, 20, (t) => {
        const ft = Math.max(0, Math.min(1, (t * flyDur - t0) / cross));
        return f.y + Math.sin(ft * 8 + i) * 7 - ft * 28;
      })
    );
  });
  const birdsId = ids.next();
  s.add(group({ name: 'birds', id: birdsId }, birdKids));
  tp(birdsId, 'opacity', [1, 1, 1, 0.8, 0]);
  s.loopLayer('flyers', s.anim({ name: 'flyers', duration: flyDur, loop: 'loop', tracks: flyTracks }));

  // --- far hills across the valley
  const farBack = [P(0, 242), P(120, 226), P(260, 216), P(400, 228), P(520, 216), P(660, 204), P(800, 214), P(900, 206)];
  const farFront = [P(0, 280), P(150, 266), P(320, 270), P(470, 258), P(620, 262), P(760, 250), P(900, 258)];
  const farInk = k.boil({
    name: 'far ink', seed: 51, draw: (rr) => [
      ink(farBack, rr, { w: 1.2, amt: 0.6, n: 14, color: 'FF5E6878', fx: fxLand }),
      ink(farFront, rr, { w: 1.3, amt: 0.6, n: 14, color: 'FF55606B', fx: fxLand }),
    ],
  });
  // field boundaries, little hedgerows ruled across the valley floor
  const rows = [
    [P(40, 300), P(170, 290), P(300, 296)], [P(330, 284), P(440, 280)],
    [P(660, 300), P(780, 290), P(900, 296)], [P(780, 290), P(760, 262)],
  ];
  const rowsInk = k.boil({ name: 'rows ink', seed: 52, draw: (rr) => ink(rows, rr, { w: 1, amt: 0.5, n: 8, color: 'FF6A6A58', fx: fxLand }) });
  s.add(k.in({ name: 'far in', cx: 450, cy: 260, t0: 8, t1: 70, sc: 0.98 }, [
    wc(ids, [...farBack, P(900, 300), P(0, 300)], FAR[1], rng(53), { alpha: 0.3, off: [0, 3], grain: 0.25, key: 'far', soft: true, hazy: true }),
    wc(ids, [...farFront, P(900, 380), P(700, 384), P(600, 336), P(300, 334), P(0, 330)], FIELDS[1], rng(54), { alpha: 0.36, off: [0, 3], grain: 0.35, key: 'fields' }),
    farInk,
    rowsInk,
  ]));
  tint('far', FAR, seasonP);
  tint('fields', FIELDS, seasonP);

  // --- the village: three knolls with round doors, two trees, a chimney
  const knolls = [
    { cx: 512, base: 296, w: 160, h: 40, seed: 61, door: [520, 284, 9, C.door], wins: [[552, 280, 4.5]] },
    { cx: 676, base: 290, w: 200, h: 56, seed: 62, door: [668, 274, 11, C.butter], wins: [[702, 268, 5], [636, 272, 4.5]] },
    { cx: 800, base: 298, w: 130, h: 38, seed: 63, door: [806, 287, 8.5, '5A7FA8'], wins: [[782, 284, 4]] },
  ];
  const villageKids = [];
  const winSpots = [];
  let doorB = null;
  knolls.forEach((kn, i) => {
    const kr = rng(kn.seed);
    const top = knoll(kn.cx, kn.base, kn.w, kn.h, kr);
    const [dx, dy, dr, dc] = kn.door;
    const doorInk = k.boil({
      name: `knoll${i} ink`, seed: kn.seed + 10, draw: (rr) => [
        ink(top, rr, { w: 1.5, amt: 0.5, fx: fxVillage }),
        ink([{ pts: circ(dx, dy, dr + 3, dr + 3, 14), closed: true }, ...kn.wins.map(([wx, wy, wr]) => ({ pts: circ(wx, wy, wr, wr, 10), closed: true }))], rr, { w: 1.2, amt: 0.25, fx: fxVillage }),
      ],
    });
    const leafId = ids.next();
    const leaf = group({ name: 'door leaf', id: leafId, x: dx - dr, y: dy }, [group({ name: 'leaf body', x: -(dx - dr), y: -dy }, [
      wc(ids, circ(dx, dy, dr, dr, 12), dc, rng(kn.seed + 20), { alpha: 0.95, off: [1, 1], wobble: 0.6, grain: 0.3, soft: false, blend: 'normal' }),
      ink({ pts: circ(dx, dy, dr, dr, 12), closed: true }, rng(kn.seed + 21), { w: 1.1, amt: 0.2, fx: fxVillage }),
      dotsShape({ dots: [{ x: dx, y: dy, r: 1.3 }], color: argb(C.brass, 1) }),
    ])]);
    const inside = ids.next();
    if (i === 1) doorB = { leafId, inside, dx, dy, dr };
    villageKids.push(k.in({ name: `knoll${i} in`, cx: kn.cx, cy: kn.base, t0: 30 + i * 10, t1: 90 + i * 10, sc: 0.9 }, [
      wc(ids, [...top, P(kn.cx + kn.w / 2, kn.base + 6), P(kn.cx - kn.w / 2, kn.base + 6)], KNOLL[1], kr, { alpha: 0.5, off: [0, 3], grain: 0.5, key: 'knoll' }),
      wc(ids, circ(dx, dy, dr + 3, dr + 3, 14), C.stone, rng(kn.seed + 22), { alpha: 0.5, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false }),
      ...kn.wins.map(([wx, wy, wr], j) => wc(ids, circ(wx, wy, wr, wr, 10), C.sky, rng(kn.seed + 30 + j), { alpha: 0.45, off: [0.8, 0.8], wobble: 0.3, grain: 0, soft: false })),
      i === 1 ? group({ name: 'inside', id: inside, opacity: 0 }, [
        el('Shape', { name: 'room', x: dx, y: dy }, [el('Ellipse', { width: dr * 2, height: dr * 2, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('E9A646', 0.95))]),
        glow({ x: dx + 2, y: dy + 2, w: 46, h: 46, color: 'FFE7A0', alpha: 0.9 }),
      ]) : '',
      leaf,
      doorInk,
    ]));
    winSpots.push(...kn.wins.map(([wx, wy, wr]) => [wx, wy, wr]));
  });
  tint('knoll', KNOLL, seasonP);

  // trees in the village
  const trees = [{ x: 600, y: 266, R: 21, seed: 71 }, { x: 742, y: 262, R: 16, seed: 72 }];
  const treeKids = trees.map((t, i) => {
    const tr = rng(t.seed);
    const crown = scallop(t.x, t.y - t.R - 10, t.R, tr, { n: 30, bumps: 6, depth: 0.12, squash: 0.9 });
    const tInk = k.boil({
      name: `tree${i} ink`, seed: t.seed + 5, draw: (rr) => [
        ink([[P(t.x - 1, t.y + 2), P(t.x, t.y - t.R - 6)], [P(t.x + 2, t.y + 2), P(t.x + 2, t.y - t.R - 4)], [P(t.x, t.y - 16), P(t.x - 9, t.y - 26)], [P(t.x + 2, t.y - 20), P(t.x + 10, t.y - 30)]], rr, { w: 1.3, amt: 0.3, fx: fxVillage }),
        ink({ pts: crown, closed: true }, rr, { w: 1.3, amt: 0.5, fx: fxVillage }),
      ],
    });
    const crownId = ids.next();
    const xml = k.in({ name: `tree${i} in`, cx: t.x, cy: t.y, t0: 50 + i * 8, t1: 104 + i * 8, sc: 0.6, ease: EASE.back }, [
      group({ name: 'crown', id: crownId }, [wc(ids, crown, CANOPY[1], tr, { alpha: 0.6, off: [2, 2], grain: 0.5, key: 'canopy' })]),
      tInk,
    ]);
    return { xml, crownId };
  });
  villageKids.splice(1, 0, ...treeKids.map((t) => t.xml));
  for (const t of treeKids) sp(t.crownId, 'opacity', [1, 1, 1, 0.3]);
  tint('canopy', CANOPY, seasonP);

  // chimney on the big knoll, smoking
  const chim = [P(692, 244), P(692, 226), P(702, 225), P(702, 243)];
  const chimInk = k.boil({ name: 'chimney ink', seed: 81, draw: (rr) => [ink([chim, [P(689, 226), P(705, 225)]], rr, { w: 1.3, amt: 0.3, fx: fxVillage })] });
  villageKids.push(k.in({ name: 'chimney in', cx: 697, cy: 244, t0: 60, t1: 100, sc: 0.6, ease: EASE.back }, [
    wc(ids, chim, C.brick, rng(82), { alpha: 0.6, off: [1, 1], wobble: 0.5, grain: 0.4, soft: false }),
    chimInk,
  ]));
  s.add(group({ name: 'village' }, villageKids));

  const smokeDur = 420;
  const smokeTracks = [];
  const smokeKids = [];
  for (let i = 0; i < 3; i++) {
    const id = ids.next();
    const curl = k.boil({
      name: `smoke${i}`, seed: 90 + i, draw: (rr) => {
        const pts = [];
        for (let j = 0; j <= 9; j++) { const t = j / 9; pts.push(P(Math.sin(t * 5.5) * (4 + t * 3), -t * 18)); }
        return ink(pts, rr, { w: 1.2, amt: 0.4, color: 'FF57504A' });
      },
    });
    smokeKids.push(group({ name: `smoke${i}`, x: 697, y: 218, id, opacity: 0 }, [curl]));
    const ph = i / 3;
    const at = (t) => (t + ph) % 1;
    const op = (u) => (u < 0.04 || u > 0.94 ? 0 : u < 0.18 ? (u - 0.04) / 0.14 : Math.max(0, 1 - (u - 0.18) / 0.76));
    smokeTracks.push(
      sampled(id, 'y', smokeDur, 10, (t) => 218 - at(t) * 64),
      sampled(id, 'x', smokeDur, 10, (t) => 697 - at(t) * 26 + Math.sin(at(t) * 6) * 4),
      sampled(id, 'opacity', smokeDur, 10, (t) => op(at(t))),
      sampled(id, 'scaleX', smokeDur, 10, (t) => 0.6 + at(t) * 0.7),
      sampled(id, 'scaleY', smokeDur, 10, (t) => 0.6 + at(t) * 0.7)
    );
  }
  s.add(k.in({ name: 'smoke in', t0: 110, t1: 160 }, smokeKids));
  s.loopLayer('smoke', s.anim({ name: 'smoke', duration: smokeDur, loop: 'loop', tracks: smokeTracks }));

  // --- the left bank, where the fingerpost (HTML) stands
  const bank = [P(0, 326), P(110, 316), P(230, 322), P(330, 342), P(392, 376), P(420, 424), P(300, 430), P(160, 422), P(40, 428), P(0, 424)];
  const bankTicks = [];
  for (const [x, y] of [[40, 322], [96, 318], [170, 318], [262, 328], [318, 340], [360, 356]]) {
    bankTicks.push([P(x, y + 2), P(x - 3, y - 5)], [P(x + 2, y + 2), P(x + 2, y - 7)], [P(x + 4, y + 2), P(x + 8, y - 4)]);
  }
  const bankInk = k.boil({
    name: 'bank ink', seed: 101, draw: (rr) => [
      ink(bank.slice(0, 5), rr, { w: 1.7, amt: 0.7, n: 18, fx: fxLand, bleed: 0.1 }),
      ink(bankTicks, rr, { w: 1.1, amt: 0.3, fx: fxLand }),
    ],
  });
  s.add(k.in({ name: 'bank in', cx: 200, cy: 400, t0: 6, t1: 60, sc: 0.98 }, [
    wc(ids, bank, GROUND[1], rng(102), { alpha: 0.46, off: [0, 3], grain: 0.5, key: 'ground' }),
    bankInk,
  ]));

  // --- the lane itself, winding down into the village
  const centre = [P(536, 428), P(536, 410), P(552, 386), P(578, 360), P(598, 338), P(604, 320), P(596, 306), P(586, 296), P(582, 288)];
  const widths = [250, 220, 148, 98, 64, 42, 28, 18, 10];
  const { L, R } = ribbon(centre, widths);
  const lanePts = [...L, ...R.slice().reverse()];
  const ruts = ribbon(centre.slice(0, 6), widths.slice(0, 6).map((w) => w * 0.36));
  const laneInk = k.boil({
    name: 'lane ink', seed: 111, draw: (rr) => {
      const broken = (pts) => resample(pts, 22).reduce((acc, p, i, a) => (i % 3 !== 2 && a[i + 1] ? [...acc, [p, a[i + 1]]] : acc), []);
      return [
        ink([L.slice(0, -1), R.slice(0, -1)], rr, { w: 1.6, amt: 0.6, n: 26, fx: fxLand }),
        ink([...broken(ruts.L), ...broken(ruts.R)], rr, { w: 1, amt: 0.4, color: INK_SOFT, fx: fxLand }),
      ];
    },
  });
  s.add(k.in({ name: 'lane in', cx: 560, cy: 400, t0: 10, t1: 70, sc: 0.98 }, [
    wc(ids, lanePts, LANE[1], rng(112), { alpha: 0.62, off: [0, 2], grain: 0.8, key: 'lane' }),
    laneInk,
  ]));
  tint('lane', LANE, seasonP);

  // --- lamps along the lane
  const lamps = [{ x: 452, y: 352, sc: 1 }, { x: 642, y: 318, sc: 0.62 }];
  const lanternId = ids.next();
  const lampKids = lamps.map((lp, i) => {
    const lr = rng(120 + i);
    const box = [P(-5, -6), P(5, -6), P(6, 8), P(-6, 8)];
    const body = [
      wc(ids, [P(-2, 0), P(2, 0), P(2, 50), P(-2, 50)].map((p) => P(p.x, p.y - 50)), '6A5A4A', lr, { alpha: 0.7, off: [0.5, 0], wobble: 0.3, grain: 0, soft: false }),
      ink([[P(0, 0), P(0, -52)], [P(0, -46), P(10, -46), P(10, -42)]], lr, { w: 1.6, amt: 0.3, fx: fxLamp }),
    ];
    const lantern = group({ name: 'lantern', id: i === 0 ? lanternId : undefined, x: 10, y: -42 }, [
      wc(ids, box.map((p) => P(p.x, p.y + 8)), C.ochre, lr, { alpha: 0.45, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
      ink([{ pts: box.map((p) => P(p.x, p.y + 8)), closed: true }, [P(-7, 2), P(0, -3), P(7, 2)]], lr, { w: 1.2, amt: 0.2, fx: fxLamp, tension: 0.3 }),
    ]);
    return group({ name: `lamp${i}`, x: lp.x, y: lp.y, scaleX: lp.sc, scaleY: lp.sc }, [...body, lantern]);
  });
  s.add(k.in({ name: 'lamps in', t0: 70, t1: 120 }, lampKids));

  // --- long shadows: anchored at each thing's foot, stretched by the hour
  const shadowIds = [];
  const shadow = (x, y, len, th, seed) => {
    const id = ids.next();
    shadowIds.push(id);
    const sr = rng(seed);
    const pts = [P(0, -th * 0.4), P(len * 0.5, -th * 0.5 + sr.jit(1)), P(len, sr.jit(1)), P(len * 0.5, th * 0.5 + sr.jit(1)), P(0, th * 0.4)];
    return group({ name: 'shadow', id, x, y, scaleX: SHADOW[TIME0][0], opacity: SHADOW[TIME0][1] }, [
      el('Shape', { name: 's', blendModeValue: 'multiply' }, [pathXml(pts, { closed: true }), fill(argb(C.shadow, 0.24))]),
    ]);
  };
  s.add(k.in({ name: 'shadows in', t0: 96, t1: 140 }, [shadow(452, 352, 30, 5, 131), shadow(642, 318, 18, 3, 132), shadow(600, 268, 22, 4, 133), shadow(742, 262, 18, 4, 134), shadow(868, 368, 40, 6, 135)]));
  for (const id of shadowIds) {
    tp(id, 'scaleX', SHADOW.map((v) => v[0]));
    tp(id, 'opacity', SHADOW.map((v) => v[1]));
  }

  // --- the hedge on the right, with a hawthorn standing out of it
  const hedgeTop = [];
  for (let x = 652; x <= 904; x += 9) {
    const t = (x - 652) / 252;
    hedgeTop.push(P(x, 378 - t * 66 - Math.abs(Math.sin(x * 0.19)) * 8 + r.jit(1.2)));
  }
  const hedgePts = [...hedgeTop, P(906, 424), P(840, 432), P(760, 424), P(690, 430), P(648, 410)];
  const tx = 868, tb = 366;
  const thorn = scallop(tx + 4, tb - 72, 44, rng(141), { n: 40, bumps: 7, depth: 0.12, squash: 0.82 });
  const hedgeInk = k.boil({
    name: 'hedge ink', seed: 142, draw: (rr) => {
      const leaves = [];
      for (let i = 0; i < 22; i++) {
        const x = rr.range(664, 896), y = rr.range(380, 416) - (x - 652) * 0.18;
        leaves.push([P(x, y), P(x + 4, y - 3), P(x + 8, y)]);
      }
      return [
        ink(hedgeTop, rr, { w: 1.7, amt: 0.6, n: 34, fx: fxHedge, bleed: 0.1 }),
        ink(leaves, rr, { w: 1, amt: 0.3, color: INK_SOFT, fx: fxHedge }),
        ink([[P(tx - 2, tb + 6), P(tx - 4, tb - 60)], [P(tx + 6, tb + 6), P(tx + 6, tb - 58)], [P(tx, tb - 40), P(tx - 22, tb - 66)], [P(tx + 4, tb - 46), P(tx + 26, tb - 74)], [P(tx - 14, tb - 56), P(tx - 24, tb - 84)]], rr, { w: 1.5, amt: 0.4, fx: fxHedge }),
        ink({ pts: thorn, closed: true }, rr, { w: 1.5, amt: 0.5, fx: fxHedge }),
      ];
    },
  });
  const crownId = ids.next(), hedgeSway = ids.next(), crownSway = ids.next();
  const br = rng(143);
  const blooms = [];
  for (let i = 0; i < 34; i++) {
    const onTree = i < 14;
    const p = onTree ? (() => { const a = br() * TAU, d = Math.sqrt(br()) * 36; return P(tx + 4 + Math.cos(a) * d, tb - 72 + Math.sin(a) * d * 0.8); })() : (() => { const x = br.range(664, 896); return P(x, br.range(376, 412) - (x - 652) * 0.2); })();
    blooms.push({ x: p.x, y: p.y, r: br.range(1.4, 2.3) });
  }
  const bloomColor = ids.next(), bloomId = ids.next();
  s.add(group({ name: 'hedge sway', id: hedgeSway, x: 780, y: 446 }, [group({ name: 'hedge body', x: -780, y: -446 }, [
    k.in({ name: 'hedge in', cx: 780, cy: 446, t0: 16, t1: 74, sc: 0.97 }, [
      group({ name: 'crown sway', id: crownSway, x: tx, y: tb }, [group({ name: 'crown body', x: -tx, y: -tb }, [
        group({ name: 'thorn crown', id: crownId }, [wc(ids, thorn, CANOPY[1], rng(144), { alpha: 0.56, off: [3, 3], grain: 0.5, key: 'canopy' })]),
      ])]),
      wc(ids, hedgePts, HEDGE[1], rng(145), { alpha: 0.58, off: [0, 3], grain: 0.6, key: 'hedge' }),
      hedgeInk,
    ]),
    k.in({ name: 'blooms in', cx: 780, cy: 400, t0: 100, t1: 150, sc: 0.9 }, [dotsShape({ name: 'blooms', id: bloomId, dots: blooms, color: argb(BLOOM[SEASON0][0], BLOOM[SEASON0][1]), colorId: bloomColor })]),
  ])]));
  sp(crownId, 'opacity', [1, 1, 1, 0.25]);
  sp(bloomColor, 'colorValue', BLOOM.map(([c, a]) => argb(c, a)), 'Color');
  tint('hedge', HEDGE, seasonP);
  tint('ground', GROUND, seasonP);

  // --- snow: caps on the knolls, the bank, the hedge and the hawthorn
  const snowId = ids.next();
  const snowKids = [
    ...knolls.flatMap((kn, i) => snowCap(resample(knoll(kn.cx, kn.base, kn.w * 0.86, kn.h, rng(kn.seed)), 16), 4, 150 + i)),
    ...snowCap(resample(bank.slice(0, 5), 24), 6, 154),
    ...snowCap(resample(hedgeTop, 26), 6, 155),
    ...snowCap(resample(thorn.slice(20, 36), 10), 4, 156),
    ...snowCap(resample(farFront.slice(2), 20), 3, 157),
  ];
  s.add(group({ name: 'snow', id: snowId, opacity: SEASON0 === 3 ? 1 : 0 }, [k.in({ name: 'snow in', t0: 90, t1: 140 }, snowKids)]));
  sp(snowId, 'opacity', [0, 0, 0, 1]);

  // snowfall: two sheets of flakes sliding down, half a cycle apart
  const flakesId = ids.next();
  const sheets = [];
  const snowTracks = [];
  const sDur = 900;
  for (let j = 0; j < 2; j++) {
    const id = ids.next();
    const fr = rng(160 + j);
    const dots = [];
    for (let i = 0; i < 28; i++) dots.push({ x: fr.range(10, 890), y: fr.range(-60, 360), r: fr.range(0.9, 1.9) });
    sheets.push(group({ name: `flakes${j}`, id, opacity: 0 }, [stippleShape({ dots, color: argb('8EA3BC', 0.75) })]));
    const ph = j / 2;
    const at = (t) => (t + ph) % 1;
    snowTracks.push(
      sampled(id, 'y', sDur, 30, (t) => at(t) * 90),
      sampled(id, 'x', sDur, 30, (t) => Math.sin(at(t) * TAU) * 8),
      sampled(id, 'opacity', sDur, 30, (t) => { const u = at(t); return u < 0.03 || u > 0.97 ? 0 : Math.min(1, (u - 0.03) / 0.25, (0.97 - u) / 0.25); })
    );
  }
  s.add(group({ name: 'flakes', id: flakesId, opacity: SEASON0 === 3 ? 1 : 0 }, sheets));
  sp(flakesId, 'opacity', [0, 0, 0, 1]);
  gatedLoop(s, 'snowfall', s.anim({ name: 'snowfall', duration: sDur, loop: 'loop', tracks: snowTracks }), [[season, 'equal', 3]]);

  // --- the light of the hour: one soft glaze over the whole painting
  const glazePts = blobPts(470, 220, rng(170), { n: 16, wobble: 0.08 }).map((p) => P(p.x + 450, p.y + 226));
  const glazeColor = ids.next();
  s.add(k.in({ name: 'glaze in', t0: 0, t1: 60 }, [
    el('Shape', { name: 'hour glaze', blendModeValue: 'multiply' }, [pathXml(glazePts, { closed: true }), el('Fill', { name: 'Fill', fillRule: 'clockwise' }, [el('SolidColor', { colorValue: argb(GLAZE[TIME0][0], GLAZE[TIME0][1]), name: 'C', id: glazeColor }), el('Feather', { strength: 26, name: 'F' })])]),
  ]));
  tp(glazeColor, 'colorValue', GLAZE.map(([c, a]) => argb(c, a)), 'Color');

  // --- lamplight sits above the glaze: village windows, the two lane lamps
  const litId = ids.next(), flareId = ids.next();
  s.add(k.in({ name: 'lit in', t0: 96, t1: 150 }, [
    group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
      ...winSpots.map(([x, y, wr]) => glow({ x, y, w: wr * 9, h: wr * 8, color: C.lamp, alpha: 0.45 })),
      ...winSpots.map(([x, y, wr]) => el('Shape', { name: 'pane', x, y }, [el('Ellipse', { width: wr * 2, height: wr * 2, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('F7CB5C', 0.9))])),
      group({ name: 'flare', id: flareId, x: 462, y: 318 }, [glow({ x: 0, y: 0, w: 120, h: 120, color: C.lamp, alpha: 0.55 })]),
      el('Shape', { name: 'flame', x: 462, y: 318 }, [el('Ellipse', { width: 6, height: 9, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
      glow({ x: 648, y: 296, w: 70, h: 70, color: C.lamp, alpha: 0.5 }),
      el('Shape', { name: 'flame', x: 648, y: 296 }, [el('Ellipse', { width: 4, height: 6, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
      glow({ x: 520, y: 400, w: 220, h: 60, color: C.lamp, alpha: 0.16 }),
    ]),
  ]));
  tp(litId, 'opacity', LIT);

  // --- hit areas
  const hHedge = ids.next(), hDoor = ids.next(), hLamp = ids.next();
  s.add(hit(hHedge, 792, 362, 228, 168), hit(hDoor, doorB.dx, doorB.dy, 40, 36), hit(hLamp, 458, 322, 40, 70));

  // --- poses
  poseLayer(s, 'season', season, 4, seasonP);
  poseLayer(s, 'time', time, 5, timeP);

  // --- reactions
  // the hedge and its hawthorn shiver, and one leaf (petal, snowflake) lets go
  const dropId = ids.next(), dropColor = ids.next();
  s.add(group({ name: 'drop', id: dropId, x: tx, y: tb - 80, opacity: 0 }, [
    el('Shape', { name: 'leaf' }, [pathXml([P(-4, 0), P(0, -2.6), P(4, 0), P(0, 2.6)], { closed: true }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb(DROP[SEASON0], 0.95), name: 'C', id: dropColor }))]),
    ink({ pts: [P(-4, 0), P(0, -2.6), P(4, 0), P(0, 2.6)], closed: true }, rng(180), { w: 0.8, amt: 0.1 }),
  ]));
  poseLayer(s, 'drop colour', season, 4, [{ object: dropColor, prop: 'colorValue', type: 'Color', vals: DROP.map((c) => argb(c, 0.95)) }]);
  const rustle = s.input('trigger', 'rustle');
  s.triggerLayer('rustle', rustle, s.anim({ name: 'rustle', duration: 190, tracks: [
    { object: hedgeSway, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [10, 0.012, 'cubic', EASE.inOut], [26, -0.009, 'cubic', EASE.inOut], [44, 0.004, 'cubic', EASE.inOut], [64, 0]] },
    { object: crownSway, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [12, 0.04, 'cubic', EASE.inOut], [28, -0.028, 'cubic', EASE.inOut], [46, 0.012, 'cubic', EASE.inOut], [66, 0]] },
    { object: dropId, prop: 'opacity', keys: [[0, 0, 'linear'], [8, 1, 'hold'], [160, 1, 'linear'], [190, 0]] },
    sampled(dropId, 'y', 190, 10, (t) => tb - 80 + t * 120),
    sampled(dropId, 'x', 190, 10, (t) => tx - 10 + Math.sin(t * 9) * 10 - t * 70),
    sampled(dropId, 'rotation', 190, 10, (t) => Math.sin(t * 9) * 0.8),
  ] }), { fromAny: false });
  s.listen(hHedge, 'enter', [Scene.fire(rustle)]);
  s.listen(hHedge, 'click', [Scene.fire(rustle)]);

  // the yellow door opens a crack: someone is in
  const peek = s.input('trigger', 'peek');
  s.triggerLayer('peek', peek, s.anim({ name: 'peek', duration: 260, tracks: [
    { object: doorB.leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [30, 0.55, 'hold'], [200, 0.55, 'cubic', EASE.inOut], [240, 1.02, 'cubic', EASE.out], [252, 1]] },
    { object: doorB.inside, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [30, 1, 'hold'], [206, 1, 'cubic', EASE.in], [240, 0]] },
  ] }), { fromAny: false });
  s.listen(hDoor, 'enter', [Scene.fire(peek)]);
  s.listen(hDoor, 'click', [Scene.fire(peek)]);

  // the lantern swings on its hook, and brightens if it is lit
  const swing = s.input('trigger', 'swing');
  s.triggerLayer('swing', swing, s.anim({ name: 'swing', duration: 150, tracks: [
    { object: lanternId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [14, 0.22, 'cubic', EASE.inOut], [40, -0.15, 'cubic', EASE.inOut], [66, 0.08, 'cubic', EASE.inOut], [92, -0.03, 'cubic', EASE.inOut], [116, 0]] },
    { object: flareId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [16, 1.35, 'cubic', EASE.inOut], [150, 1]] },
    { object: flareId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [16, 1.35, 'cubic', EASE.inOut], [150, 1]] },
  ] }), { fromAny: false });
  s.listen(hLamp, 'enter', [Scene.fire(swing)]);

  k.finish(still);
  return s.toXml();
}

// ---------- footer: the Gate, at the end of the lane ----------

function gate(ids) {
  const W = 680, H = 270;
  const s = new Scene(ids, { name: 'Gate', w: W, h: H, x: 960, y: 0, bg: process.env.LN_BG ? 'FFF8F2E4' : undefined });
  const k = new Kit(s);
  const season = s.input('number', 'season', SEASON0);
  const time = s.input('number', 'time', TIME0);
  const still = s.input('bool', 'still', 0);
  const seasonP = [], timeP = [];
  const tint = (key, pal, list) => {
    for (const t of tintTracks(key, 'FFFFFF')) list.push({ object: t.object, prop: t.prop, type: 'Color', vals: pal.map((c) => tintColor(key, t.object, c, 1)) });
  };
  const fxBack = k.fx('back', 0, 50);
  const fxInn = k.fx('inn', 16, 76);
  const fxGate = k.fx('gate', 20, 76);
  const fxSign = k.fx('sign', 6, 56);

  // a scrap of sky behind the inn, coloured by the hour
  const skyPts = blobPts(124, 56, rng(301), { n: 12, wobble: 0.12 }).map((p) => P(p.x + 548, p.y + 72));
  s.add(k.in({ name: 'sky in', cx: 540, cy: 70, t0: 0, t1: 50, sc: 0.9 }, [wc(ids, skyPts, SKY[1][0], rng(302), { alpha: 0.32, off: [0, 0], grain: 0.1, soft: true, key: 'gsky', hazy: true })]));
  for (const t of tintTracks('gsky', 'FFFFFF')) timeP.push({ object: t.object, prop: t.prop, type: 'Color', vals: SKY.map(([c, a]) => tintColor('gsky', t.object, c, a / 0.34)) });

  // the inn across the lane: long and low, a thatch, two windows and a sign
  const roof = [P(440, 152), P(470, 106), P(606, 102), P(638, 150)];
  const wall = [P(452, 150), P(626, 148), P(627, 212), P(451, 213)];
  const wins = [[470, 164, 498, 188], [580, 164, 608, 188]];
  const innInk = k.boil({
    name: 'inn ink', seed: 310, draw: (rr) => [
      ink([{ pts: roof, closed: false, tension: 0.2 }, [P(440, 152), P(638, 150)], [P(452, 152), P(452, 213)], [P(626, 150), P(627, 212)]], rr, { w: 1.7, amt: 0.5, fx: fxInn, tension: 0.2 }),
      ink([[P(478, 116), P(468, 140)], [P(510, 110), P(504, 138)], [P(546, 110), P(544, 140)], [P(582, 112), P(586, 138)], [P(612, 118), P(624, 140)]], rr, { w: 0.9, amt: 0.5, color: INK_SOFT, fx: fxInn }),
      ink(wins.map(([x0, y0, x1, y1]) => ({ pts: [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], closed: true, tension: 0.1 })), rr, { w: 1.3, amt: 0.3, fx: fxInn }),
      ink(wins.flatMap(([x0, y0, x1, y1]) => [[P((x0 + x1) / 2, y0), P((x0 + x1) / 2, y1)], [P(x0, (y0 + y1) / 2), P(x1, (y0 + y1) / 2)]]), rr, { w: 0.9, amt: 0.2, fx: fxInn }),
      ink([{ pts: [P(526, 212), P(526, 176), P(539, 164), P(552, 176), P(552, 212)], closed: false, tension: 0.6 }], rr, { w: 1.4, amt: 0.3, fx: fxInn }),
      ink([[P(452, 134), P(424, 134)], [P(428, 134), P(428, 140)], [P(446, 134), P(446, 140)]], rr, { w: 1.3, amt: 0.2, fx: fxInn }),
      ink([[P(596, 104), P(596, 86), P(608, 86), P(608, 104)]], rr, { w: 1.3, amt: 0.3, fx: fxInn, tension: 0.1 }),
    ],
  });
  const signSwing = ids.next();
  const innSign = [P(-12, 0), P(12, 0), P(12, 22), P(-12, 22)];
  s.add(group({ name: 'inn', x: 12 }, [k.in({ name: 'inn in', cx: 538, cy: 212, t0: 12, t1: 70, sc: 0.96 }, [
    wc(ids, wall, C.cream, rng(311), { alpha: 0.85, off: [2, 2], grain: 0.6, blend: 'normal' }),
    wc(ids, roof.concat([P(606, 102)]).slice(0, 4), C.thatch, rng(312), { alpha: 0.7, off: [1, 2], grain: 0.9 }),
    wc(ids, [P(596, 104), P(596, 86), P(608, 86), P(608, 104)], C.brick, rng(313), { alpha: 0.6, off: [1, 1], wobble: 0.4, grain: 0.3, soft: false }),
    ...wins.map(([x0, y0, x1, y1], i) => wc(ids, [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], C.sky, rng(314 + i), { alpha: 0.4, off: [1, 1], wobble: 0.5, grain: 0.2, soft: false })),
    wc(ids, [P(526, 212), P(526, 176), P(539, 164), P(552, 176), P(552, 212)], '8A4B32', rng(316), { alpha: 0.75, off: [1, 1], wobble: 0.5, grain: 0.4, soft: false }),
    innInk,
    group({ name: 'inn sign', id: signSwing, x: 437, y: 140 }, [
      wc(ids, innSign, '3E6A8A', rng(317), { alpha: 0.85, off: [0.5, 0.5], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal' }),
      wc(ids, circ(0, 11, 5, 5, 9), C.butter, rng(318), { alpha: 0.95, off: [0, 0], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
      ink([{ pts: innSign, closed: true, tension: 0.1 }], rng(319), { w: 1.2, amt: 0.2, fx: fxInn }),
    ]),
  ])]));
  s.loopLayer('inn sign', s.anim({ name: 'inn sign', duration: 480, loop: 'loop', tracks: [sampled(signSwing, 'rotation', 480, 20, (t) => Math.sin(t * TAU) * 0.05 + Math.sin(t * TAU * 3) * 0.015)] }));

  // inn smoke
  const smokeDur = 420;
  const smokeTracks = [], smokeKids = [];
  for (let i = 0; i < 3; i++) {
    const id = ids.next();
    const curl = k.boil({
      name: `inn smoke${i}`, seed: 320 + i, draw: (rr) => {
        const pts = [];
        for (let j = 0; j <= 9; j++) { const t = j / 9; pts.push(P(Math.sin(t * 5.5) * (4 + t * 3), -t * 18)); }
        return ink(pts, rr, { w: 1.2, amt: 0.4, color: 'FF57504A' });
      },
    });
    smokeKids.push(group({ name: `smoke${i}`, x: 614, y: 80, id, opacity: 0 }, [curl]));
    const ph = i / 3;
    const at = (t) => (t + ph) % 1;
    const op = (u) => (u < 0.04 || u > 0.94 ? 0 : u < 0.18 ? (u - 0.04) / 0.14 : Math.max(0, 1 - (u - 0.18) / 0.76));
    smokeTracks.push(
      sampled(id, 'y', smokeDur, 10, (t) => 80 - at(t) * 60),
      sampled(id, 'x', smokeDur, 10, (t) => 614 - at(t) * 22 + Math.sin(at(t) * 6) * 4),
      sampled(id, 'opacity', smokeDur, 10, (t) => op(at(t))),
      sampled(id, 'scaleX', smokeDur, 10, (t) => 0.6 + at(t) * 0.7),
      sampled(id, 'scaleY', smokeDur, 10, (t) => 0.6 + at(t) * 0.7)
    );
  }
  s.add(k.in({ name: 'smoke in', t0: 80, t1: 120 }, smokeKids));
  s.loopLayer('smoke', s.anim({ name: 'smoke', duration: smokeDur, loop: 'loop', tracks: smokeTracks }));

  // beyond the gate: a turf bank with your own round door, and the path up to it
  const D = P(333, 112), DR = 15;
  const bankTop = knoll(333, 150, 150, 70, rng(330), 12);
  const path = [P(326, 128), P(340, 128), P(386, 212), P(282, 212)];
  const homeInk = k.boil({
    name: 'home ink', seed: 331, draw: (rr) => [
      ink(bankTop, rr, { w: 1.4, amt: 0.5, fx: fxGate }),
      ink({ pts: circ(D.x, D.y, DR + 4, DR + 4, 16), closed: true }, rr, { w: 1.3, amt: 0.3, fx: fxGate }),
    ],
  });
  const homeLeaf = ids.next(), homeInside = ids.next();
  s.add(k.in({ name: 'home in', cx: 333, cy: 150, t0: 10, t1: 64, sc: 0.95 }, [
    wc(ids, [...bankTop, P(410, 160), P(256, 160)], KNOLL[1], rng(332), { alpha: 0.48, off: [0, 2], grain: 0.5, key: 'gknoll' }),
    wc(ids, path, 'F0E2C0', rng(333), { alpha: 0.95, off: [0, 0], grain: 0.5, blend: 'normal' }),
    wc(ids, circ(D.x, D.y, DR + 4, DR + 4, 16), C.stone, rng(334), { alpha: 0.5, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false }),
    group({ name: 'inside', id: homeInside, opacity: 0 }, [
      el('Shape', { name: 'room', x: D.x, y: D.y }, [el('Ellipse', { width: DR * 2, height: DR * 2, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('E9A646', 0.95))]),
      glow({ x: D.x + 2, y: D.y + 2, w: 64, h: 64, color: 'FFE7A0', alpha: 0.9 }),
    ]),
    group({ name: 'leaf', id: homeLeaf, x: D.x - DR, y: D.y }, [group({ name: 'leaf body', x: -(D.x - DR), y: -D.y }, [
      wc(ids, circ(D.x, D.y, DR, DR, 14), C.door, rng(335), { alpha: 0.92, off: [1, 1], wobble: 0.6, grain: 0.4, soft: false, blend: 'normal' }),
      ink({ pts: circ(D.x, D.y, DR, DR, 14), closed: true }, rng(336), { w: 1.2, amt: 0.2, fx: fxGate }),
      dotsShape({ dots: [{ x: D.x, y: D.y, r: 1.8 }], color: argb(C.brass, 1) }),
    ])]),
    homeInk,
  ]));
  tint('gknoll', KNOLL, seasonP);

  // hedge either side of the gate
  const hedgeL = [], hedgeR = [];
  for (let x = 14; x <= 262; x += 10) { const e = Math.pow(Math.min(1, (x - 14) / 40), 0.6); hedgeL.push(P(x, 212 - (212 - (138 - Math.abs(Math.sin(x * 0.21)) * 9 + Math.sin(x * 0.013) * 5)) * e)); }
  for (let x = 404; x <= 446; x += 10) hedgeR.push(P(x, 146 - Math.abs(Math.sin(x * 0.21)) * 8));
  const hedgeInk = k.boil({ name: 'hedge ink', seed: 340, draw: (rr) => [ink(hedgeL, rr, { w: 1.6, amt: 0.6, n: 30, fx: fxBack }), ink(hedgeR, rr, { w: 1.6, amt: 0.5, n: 8, fx: fxBack })] });
  s.add(k.in({ name: 'hedge in', cx: 200, cy: 210, t0: 0, t1: 46, sc: 0.98 }, [
    wc(ids, [...hedgeL, P(266, 160), P(264, 214), P(14, 214)], HEDGE[1], rng(341), { alpha: 0.52, off: [0, 3], grain: 0.6, key: 'ghedge' }),
    wc(ids, [...hedgeR, P(448, 214), P(402, 214)], HEDGE[1], rng(342), { alpha: 0.52, off: [0, 3], grain: 0.6, key: 'ghedge' }),
    hedgeInk,
  ]));
  tint('ghedge', HEDGE, seasonP);

  // the lane runs across the front
  const laneTop = [P(10, 216), P(160, 210), P(330, 216), P(500, 211), P(670, 215)];
  const laneBot = [P(674, 232), P(650, 252), P(480, 260), P(300, 255), P(140, 261), P(34, 254), P(8, 234)];
  const laneInk = k.boil({
    name: 'lane ink', seed: 350, draw: (rr) => {
      const list = [];
      for (let x = 30; x < 630; x += rr.range(46, 80)) list.push([P(x, 236 + rr.jit(5)), P(x + 18, 238 + rr.jit(5)), P(x + 32, 238 + rr.jit(5))]);
      return [ink(laneTop, rr, { w: 1.5, amt: 0.6, n: 26, fx: fxBack }), ink(list, rr, { w: 1, amt: 0.4, color: INK_SOFT, fx: fxBack })];
    },
  });
  s.add(k.in({ name: 'lane in', cx: 320, cy: 240, t0: 0, t1: 40 }, [wc(ids, [...laneTop, ...laneBot], LANE[1], rng(351), { alpha: 0.7, off: [0, 1], grain: 0.6, key: 'glane' }), laneInk]));
  tint('glane', LANE, seasonP);

  // the sign board on its stake: the hand-lettered words are HTML laid over it
  const board = [P(22, 40), P(238, 35), P(242, 124), P(26, 129)];
  const signInk = k.boil({
    name: 'sign ink', seed: 360, draw: (rr) => [
      ink({ pts: board, closed: true }, rr, { w: 1.9, amt: 0.6, fx: fxSign, tension: 0.15 }),
      ink([[P(124, 129), P(125, 222)], [P(134, 128), P(134, 222)]], rr, { w: 1.8, amt: 0.4, fx: fxSign }),
      ink([[P(30, 44), P(234, 40)]], rr, { w: 0.8, amt: 0.6, color: INK_SOFT, fx: fxSign }),
    ],
  });
  s.add(k.in({ name: 'sign in', cx: 130, cy: 90, t0: 4, t1: 50 }, [
    wc(ids, [P(122, 126), P(136, 126), P(136, 222), P(122, 222)], C.post, rng(361), { alpha: 0.9, off: [1, 0], grain: 0.4, soft: false, blend: 'normal' }),
    wc(ids, board, 'F2E6C8', rng(362), { alpha: 1, off: [2, 2], wobble: 1.5, grain: 0.3, soft: false, blend: 'normal' }),
    stippleShape({ name: 'nails', dots: [{ x: 32, y: 48, r: 1.6 }, { x: 230, y: 44, r: 1.6 }, { x: 34, y: 120, r: 1.6 }, { x: 232, y: 116, r: 1.6 }], color: INK }),
    signInk,
  ]));

  // gate posts and the lamp on the right one
  const postsInk = k.boil({
    name: 'posts ink', seed: 370, draw: (rr) => [
      ink([[P(262, 222), P(262, 76)], [P(274, 222), P(274, 76)], [P(392, 222), P(392, 76)], [P(404, 222), P(404, 76)]], rr, { w: 1.9, amt: 0.5, fx: fxGate }),
      ink([{ pts: circ(268, 72, 8, 5, 10), closed: true }, { pts: circ(398, 72, 8, 5, 10), closed: true }], rr, { w: 1.6, amt: 0.3, fx: fxGate }),
      ink([[P(404, 94), P(420, 94), P(420, 102)], { pts: [P(414, 102), P(426, 102), P(427, 120), P(413, 120)], closed: true }, [P(412, 102), P(420, 96), P(428, 102)]], rr, { w: 1.3, amt: 0.3, fx: fxGate, tension: 0.3 }),
    ],
  });
  s.add(k.in({ name: 'posts in', cx: 333, cy: 222, t0: 14, t1: 64 }, [
    wc(ids, [P(262, 76), P(274, 76), P(274, 222), P(262, 222)], C.post, rng(371), { alpha: 0.9, off: [1, 1], grain: 0.5, soft: false, blend: 'normal' }),
    wc(ids, [P(392, 76), P(404, 76), P(404, 222), P(392, 222)], C.post, rng(372), { alpha: 0.9, off: [1, 1], grain: 0.5, soft: false, blend: 'normal' }),
    wc(ids, [P(414, 102), P(426, 102), P(427, 120), P(413, 120)], C.ochre, rng(373), { alpha: 0.5, off: [1, 1], wobble: 0.4, grain: 0, soft: false }),
    postsInk,
  ]));

  // the gate leaf, hinged on the left post; it swings open as you arrive
  const leafId = ids.next();
  const gateInk = k.boil({
    name: 'gate ink', seed: 380, draw: (rr) => [
      ink([[P(276, 100), P(390, 98)], [P(276, 190), P(390, 188)]], rr, { w: 1.8, amt: 0.5, fx: fxGate }),
      ink([290, 310, 330, 350, 370].map((x) => [P(x, 92 - Math.sin((x - 276) / 114 * Math.PI) * 9), P(x, 200)]), rr, { w: 1.4, amt: 0.4, fx: fxGate }),
      ink([[P(280, 186), P(386, 102)]], rr, { w: 1.5, amt: 0.4, fx: fxGate }),
      ink([[P(380, 144), P(396, 144)]], rr, { w: 2, amt: 0.2, fx: fxGate }),
    ],
  });
  const gateWash = [P(278, 92), P(333, 82), P(388, 92), P(388, 200), P(278, 200)];
  s.add(k.in({ name: 'gate in', t0: 20, t1: 66 }, [
    group({ name: 'leaf', id: leafId, x: 276, y: 0, scaleX: OPEN0 ? 0.3 : 1 }, [
      group({ name: 'leaf body', x: -276, y: 0 }, [wc(ids, gateWash, C.door, rng(381), { alpha: 0.3, off: [2, 2], grain: 0.4, soft: false }), gateInk]),
    ]),
  ]));

  // ground strip under the hedge, flowers by season
  const flowersId = ids.next();
  const fl = [], stems = [];
  const fspots = [[16, 214], [52, 216], [90, 212], [160, 216], [200, 212], [236, 215], [420, 214], [442, 212]];
  const cols = [C.rose, C.butter, C.violet, C.terra, C.white];
  fspots.forEach(([x, y], i) => {
    const fr = rng(390 + i);
    fl.push(wc(ids, blobPts(4.6, 4, fr, { n: 7, wobble: 0.2 }).map((p) => P(p.x + x, p.y + y - 11)), cols[i % 5], fr, { alpha: 0.9, off: [0, 0], wobble: 0.4, grain: 0, soft: false }));
    stems.push([P(x, y + 2), P(x + fr.jit(1.4), y - 7)]);
  });
  fl.push(ink(stems, rng(399), { w: 1.1, amt: 0.3, fx: fxBack }));
  s.add(group({ name: 'flowers', id: flowersId, opacity: SEASON0 === 3 ? 0 : 1 }, [k.in({ name: 'flowers in', cx: 220, cy: 212, t0: 40, t1: 84, sc: 0.85, ease: EASE.back }, fl)]));
  seasonP.push({ object: flowersId, prop: 'opacity', vals: [1, 1, 0.4, 0] });

  // snow caps
  const snowId = ids.next();
  s.add(group({ name: 'snow', id: snowId, opacity: SEASON0 === 3 ? 1 : 0 }, [
    ...snowCap(resample([P(22, 39), P(130, 37), P(238, 34)], 8), 4, 400),
    ...snowCap([P(260, 70), P(268, 66), P(276, 70)], 4, 401),
    ...snowCap([P(390, 70), P(398, 66), P(406, 70)], 4, 402),
    ...snowCap(resample(hedgeL, 20), 6, 403),
    ...snowCap(resample(roof, 18).map((p) => P(p.x + 12, p.y)), 6, 404),
    ...snowCap(resample(laneTop, 24), 5, 406),
  ]));
  seasonP.push({ object: snowId, prop: 'opacity', vals: [0, 0, 0, 1] });

  // hour glaze, then lamplight above it
  const glazeColor = ids.next();
  const glazePts = blobPts(324, 116, rng(410), { n: 14, wobble: 0.07 }).map((p) => P(p.x + 340, p.y + 140));
  s.add(el('Shape', { name: 'hour glaze', blendModeValue: 'multiply' }, [pathXml(glazePts, { closed: true }), el('Fill', { name: 'Fill', fillRule: 'clockwise' }, [el('SolidColor', { colorValue: argb(GLAZE[TIME0][0], GLAZE[TIME0][1] * 0.6), name: 'C', id: glazeColor }), el('Feather', { strength: 20, name: 'F' })])]));
  timeP.push({ object: glazeColor, prop: 'colorValue', type: 'Color', vals: GLAZE.map(([c, a]) => argb(c, a * 0.6)) });
  const litId = ids.next();
  s.add(group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
    glow({ x: 420, y: 111, w: 90, h: 90, color: C.lamp, alpha: 0.6 }),
    el('Shape', { name: 'flame', x: 420, y: 111 }, [el('Ellipse', { width: 6, height: 10, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
    ...wins.map(([x0, y0, x1, y1]) => glow({ x: (x0 + x1) / 2 + 12, y: (y0 + y1) / 2, w: 110, h: 90, color: C.lamp, alpha: 0.45 })),
    ...wins.map(([x0, y0, x1, y1], i) => el('Shape', { name: 'pane', x: (x0 + x1) / 2 + 12, y: (y0 + y1) / 2 }, [el('Rectangle', { width: x1 - x0 - 2, height: y1 - y0 - 2, originX: 0.5, originY: 0.5, name: 'R' }), fill(argb('F7CB5C', 0.9))])),
    ink(wins.flatMap(([x0, y0, x1, y1]) => [[P((x0 + x1) / 2 + 12, y0), P((x0 + x1) / 2 + 12, y1)], [P(x0 + 12, (y0 + y1) / 2), P(x1 + 12, (y0 + y1) / 2)]]), rng(411), { w: 1, amt: 0.2 }),
    glow({ x: 551, y: 240, w: 180, h: 40, color: C.lamp, alpha: 0.2 }),
  ]));
  timeP.push({ object: litId, prop: 'opacity', vals: LIT });

  poseLayer(s, 'season', season, 4, seasonP);
  poseLayer(s, 'time', time, 5, timeP);

  // open: the gate swings in to let you up the path (bool, so it stays open)
  const open = s.input('bool', 'open', OPEN0);
  const shut = hold(s, 'shut', [{ object: leafId, prop: 'scaleX', keys: [[0, 1]] }]);
  const ajar = s.anim({ name: 'opening', duration: 70, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', [0.4, 0, 0.6, 1]], [46, 0.26, 'cubic', EASE.out], [58, 0.33, 'cubic', EASE.inOut], [70, 0.3]] },
  ] });
  s.boolLayer('open', open, shut, ajar, { mixIn: 0, mixOut: 500 });
  const hGate = ids.next(), hDoor = ids.next();
  s.add(hit(hGate, 333, 150, 140, 130), hit(hDoor, D.x, D.y, 44, 44));
  s.listen(hGate, 'enter', [Scene.setBool(open, true)]);

  // knock: your own door opens a crack, and the light comes out
  const knock = s.input('trigger', 'knock');
  s.triggerLayer('knock', knock, s.anim({ name: 'knock', duration: 300, tracks: [
    { object: homeLeaf, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [6, 0.96, 'cubic', EASE.out], [12, 1, 'cubic', EASE.inOut], [40, 0.55, 'hold'], [230, 0.55, 'cubic', EASE.inOut], [276, 1.01, 'cubic', EASE.out], [290, 1]] },
    { object: homeInside, prop: 'opacity', keys: [[0, 0, 'hold'], [12, 0, 'cubic', EASE.out], [40, 1, 'hold'], [240, 1, 'cubic', EASE.in], [276, 0]] },
  ] }), { fromAny: false });
  s.listen(hDoor, 'enter', [Scene.fire(knock)]);
  s.listen(hDoor, 'click', [Scene.fire(knock)]);

  k.finish(still);
  return s.toXml();
}

export default function () {
  TINT.clear();
  const ids = new Ids(10);
  return document(lane(ids), gate(ids));
}
