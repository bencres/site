// Draft 18 · Manuscript: the site as the owner's own book, being written.
// Three small artboards, all ink and watercolor on the page:
//
//   Frontis  the frontispiece vignette: a round door in a hill, a road leaving
//            it over a stone bridge toward far mountains. Plays on load.
//   Map      a map of the road so far, in brown and red ink like an old
//            endpaper map: compass rose, hills as bumps, a sea, a wood, and the
//            dotted red road inking itself station by station. Waits for `go`.
//   Coda     the foot of the last leaf: the painted sign at the gate, and the
//            quill finishing the flourish under the signature. Waits for `go`.
//
// Inputs. Frontis: season 0..3, time 0..4, still; triggers knock, glint,
// rustle, shine. Map: go, still, spot 0..7 (ring around a station), trigger
// swing. Coda: season, time, go, still; triggers dip, swing.
//
// Performance: one shared boil animation per artboard (the map isn't boiled:
// it is a finished drawing), feathers only on the few big soft washes, glows
// are radial gradients, season/time are 1-frame hold poses picked once.
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, polyXml,
  fill, stroke, stippleShape, document, EASE,
} from '../lib/ink.mjs';

const SEASON0 = +(process.env.MS_SEASON ?? 2);
const TIME0 = +(process.env.MS_TIME ?? 1);
const GO0 = process.env.MS_GO ? 1 : 0;

const INK = 'FF2E241B'; // iron-gall brown-black
const INK_SOFT = 'FF62574B';
const RED = 'FFA8392B'; // the map's second ink
const C = {
  door: '3E7A50', brass: 'D2A23A', ochre: 'D9A93F', terra: 'C0603E', brick: 'B5644A',
  stone: 'B8A88A', sky: '86B8DA', slate: '8C99AA', lamp: 'F5C451', rose: 'D9738A',
  violet: '8E86C9', butter: 'E9B93A', white: 'F2EEE6', wood: 'A27A4F', road: 'DDB872',
};

// ---------- small helpers (adapted from draft 16) ----------

const group = (attrs, kids) => el('Node', attrs, [].concat(kids).filter(Boolean).reverse());
const alphaHex = (a) => Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
const circ = (cx, cy, rx, ry = rx, n = 16, a0 = 0) =>
  Array.from({ length: n }, (_, i) => P(cx + Math.cos(a0 + (i / n) * TAU) * rx, cy + Math.sin(a0 + (i / n) * TAU) * ry));
const lerp = (a, b, t) => a + (b - a) * t;
const add = (pts, dx, dy) => pts.map((p) => P(p.x + dx, p.y + dy));

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
const plen = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

// several pen lines in one Shape; `fx` hooks them to a shared draw-on trim
function ink(list, r, { w = 1.6, amt = 0.6, n, color = INK, bleed = 0, fx, name = 'ink', tension = 1, colorId } = {}) {
  const items = (Array.isArray(list[0]) || list[0]?.pts ? list : [list]).map((it) => (Array.isArray(it) ? { pts: it } : it));
  const paths = items.map((it) => pathXml(trace(it.pts, r, amt, it.n ?? n), { closed: it.closed, tension: it.tension ?? tension }));
  const paints = [];
  if (bleed) paints.push(stroke(color.replace(/^../, alphaHex(bleed)), w * 2.2, { feather: w * 1.3, effect: fx }));
  paints.push(stroke(color, w, { effect: fx, colorId }));
  return el('Shape', { name }, [...paths, ...paints]);
}

// colour registry so poses can re-tint a wash: key -> [{ id, role, alpha }]
const TINT = new Map();
function tintIds(key, ids, role, alpha) {
  if (!key) return undefined;
  const id = ids.next();
  if (!TINT.has(key)) TINT.set(key, []);
  TINT.get(key).push({ id, role, alpha });
  return id;
}
function tintColor(key, id, color, k) {
  const t = TINT.get(key).find((x) => x.id === id);
  return argb(t.role === 'rim' ? darken(color, 0.28) : color, Math.min(1, t.alpha * k));
}
// push a per-state colour track for every wash registered under `key`
function tintPose(push, key, colors, base = 1) {
  for (const t of TINT.get(key) || []) push(t.id, 'colorValue', colors.map((c) => (Array.isArray(c) ? tintColor(key, t.id, c[0], c[1] / base) : tintColor(key, t.id, c, 1))), 'Color');
}

// watercolor for an outline: hard glaze with a pooled rim, a wet-in-wet glaze, granulation
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
  const want = Math.min(140, Math.round((area / 110) * grain));
  for (let i = 0, tries = 0; i < want && tries < want * 6; tries++) {
    const d = P(r.range(x0, x1), r.range(y0, y1));
    if (inside(d, shape)) { dots.push({ ...d, r: r.range(0.35, 0.9) }); i++; }
  }
  const softness = Math.max(3, Math.min(x1 - x0, y1 - y0) * 0.14);
  const g = tintIds(key, ids, 'glaze', alpha * (opaque ? 0.94 : 0.6));
  const rim = hazy ? undefined : tintIds(key, ids, 'rim', alpha * 0.55 * rimK);
  const w = tintIds(key, ids, 'wet', alpha * 0.42);
  const bm = blend === 'normal' ? undefined : blend;
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
    el('Shape', { name: 'glaze', blendModeValue: bm }, [pathXml(shape, { closed: true, tension: ten }), glazeFill, hazy ? '' : rimStroke].filter(Boolean)),
    el('Shape', { name: 'wet', blendModeValue: bm }, [pathXml(wet, { closed: true, tension: ten }), wetFill]),
    dots.length ? stippleShape({ name: 'grain', dots, color: argb('5E4A36', Math.min(0.3, alpha * 0.32)) }) : '',
  ]);
}

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

function sampled(object, prop, frames, step, fn, f0 = 0) {
  const keys = [];
  for (let f = f0; f <= frames; f += step) keys.push([Math.min(f, frames), fn((Math.min(f, frames) - f0) / (frames - f0)), 'linear']);
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

function cloudPts(w, h, r) {
  const pts = [];
  const bumps = 3 + Math.floor(r() * 2);
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const env = Math.sin(t * Math.PI);
    pts.push(P(-w / 2 + t * w, -h * env * (0.62 + 0.38 * Math.abs(Math.sin(t * Math.PI * bumps)))));
  }
  for (let i = 1; i < 7; i++) {
    const t = 1 - i / 7;
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

// a snow cap laid along a ridge: white gouache over a blue-grey shadow
function capOn(pts, th) {
  const bot = pts.slice().reverse().map((p, i) => P(p.x, p.y + th * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.9)))));
  const o = [...pts.map((p) => P(p.x, p.y - 1)), ...bot];
  return [
    el('Shape', { name: 'snow shade', x: 0.5, y: 1.6, blendModeValue: 'multiply' }, [pathXml(o, { closed: true, tension: 0.6 }), fill(argb('9AAFC6', 0.5))]),
    el('Shape', { name: 'snow' }, [pathXml(o, { closed: true, tension: 0.6 }), fill(argb('FFFDF8', 0.95))]),
  ];
}

// ---------- scene plumbing: boil, draw-on, intro, poses ----------

class Kit {
  constructor(s) {
    this.s = s;
    this.ids = s.ids;
    this.boilTracks = [];
    this.intro = [];
  }
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
  fx(name, t0, t1) {
    const fxId = this.ids.next();
    const trimId = this.ids.next();
    this.s.add(el('GroupEffect', { name: `${name} draw`, id: fxId }, el('TrimPath', { start: 0, end: 0, modeValue: 'synchronized', id: trimId, name: 'Trim' })));
    this.intro.push({ object: trimId, prop: 'end', from: 0, to: 1, t0, t1, ease: [0.45, 0, 0.25, 1] });
    return fxId;
  }
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
  // a track with its own keyframes; `to` is the settled value
  raw(object, prop, keys, to) {
    this.intro.push({ object, prop, keys, to });
  }
  // the intro plays once (on load, or when `go` turns true), then a 1-frame pose
  // holds the drawn state; `still` jumps straight there
  finish(stillId, goId) {
    const s = this.s;
    const dur = Math.max(...this.intro.map((t) => (t.keys ? t.keys.at(-1)[0] : t.t1))) + 2;
    const intro = s.anim({
      name: 'intro', duration: dur,
      tracks: this.intro.map((t) => ({
        object: t.object, prop: t.prop,
        keys: t.keys || (t.t0 > 0 ? [[0, t.from, 'hold'], [t.t0, t.from, 'cubic', t.ease], [t.t1, t.to]] : [[0, t.from, 'cubic', t.ease], [t.t1, t.to]]),
      })),
    });
    const done = s.anim({ name: 'drawn', duration: 1, tracks: this.intro.map((t) => ({ object: t.object, prop: t.prop, keys: [[0, t.to]] })) });
    const w = s.ids.next(), a = s.ids.next(), b = s.ids.next();
    const isStill = el('TransitionBoolCondition', { inputId: stillId, opValue: 'equal' });
    const states = [
      el('AnyState', { x: 100, y: -120 }),
      el('ExitState', { x: 700, y: -120 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: goId ? w : a })),
      el('AnimationState', { x: 400, y: 0, animationId: intro, id: a }, [
        el('StateTransition', { stateToId: b }, isStill),
        el('StateTransition', { stateToId: b, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 }),
      ]),
      el('AnimationState', { x: 600, y: 0, animationId: done, id: b }),
    ];
    if (goId) {
      states.push(el('AnimationState', { x: 200, y: 0, animationId: s.empty(), id: w }, [
        el('StateTransition', { stateToId: b }, isStill),
        el('StateTransition', { stateToId: a }, el('TransitionBoolCondition', { inputId: goId, opValue: 'equal' })),
      ]));
    }
    s.layers.unshift(s._layer('intro', states));
    if (this.boilTracks.length) s.loopLayer('boil', s.anim({ name: 'boil', duration: 24, loop: 'loop', tracks: this.boilTracks }));
  }
}

// hold-poses picked by a number input; entry picks the matching pose with no mix
function poseLayer(s, name, inputId, n, props, { mix = 1600 } = {}) {
  const anims = Array.from({ length: n }, (_, i) =>
    s.anim({ name: `${name} ${i}`, duration: 1, tracks: props.map((p) => ({ object: p.object, prop: p.prop, type: p.type, keys: [[0, p.vals[i], 'linear']] })) })
  );
  const sts = anims.map(() => s.ids.next());
  const cond = (v) => el('TransitionNumberCondition', { inputId, opValue: 'equal', value: v });
  s.layers.push(s._layer(name, [
    el('AnyState', { x: 100, y: -160 }),
    el('ExitState', { x: 600, y: -160 }),
    el('EntryState', { x: 0, y: 0 }, sts.map((st, i) => el('StateTransition', { stateToId: st }, cond(i)))),
    ...anims.map((a, i) => el('AnimationState', { x: 200 + i * 120, y: 120, animationId: a, id: sts[i] },
      sts.filter((_, j) => j !== i).map((st) => el('StateTransition', { stateToId: st, duration: mix }, cond(sts.indexOf(st)))))),
  ]));
}

function gatedLoop(s, name, animId, conds) {
  const rest = s.ids.next(), run = s.ids.next();
  const c = ([inputId, op, value]) => el('TransitionNumberCondition', { inputId, opValue: op, value });
  const inverse = { equal: 'notEqual', notEqual: 'equal', greaterThanOrEqual: 'lessThan', lessThan: 'greaterThanOrEqual' };
  s.layers.push(s._layer(name, [
    el('AnyState', { x: 100, y: -120 }),
    el('ExitState', { x: 500, y: -120 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: rest })),
    el('AnimationState', { x: 200, y: 0, animationId: s.empty(), id: rest }, el('StateTransition', { stateToId: run }, conds.map(c))),
    el('AnimationState', { x: 400, y: 0, animationId: animId, id: run },
      conds.map(([i, op, v]) => el('StateTransition', { stateToId: rest }, c([i, inverse[op], v])))),
  ]));
}

// ---------- palettes ----------

// per time: morning, day, late afternoon, dusk, night
const SKY = [['A9CDEB', 0.4], ['86BBE0', 0.4], ['9FC0DA', 0.34], ['B49ACB', 0.42], ['3E5A95', 0.56]];
const HORIZON = [['F2B98A', 0.34], ['EADFB4', 0.16], ['EDB45A', 0.36], ['E8845A', 0.48], ['5A5E92', 0.28]];
const GLAZE = [['F4CFA8', 0.08], ['F4E3B0', 0], ['E9B356', 0.12], ['A06D9A', 0.18], ['1E2A5E', 0.3]];
const SUN = ['F2C66B', 'EDB940', 'E8993A', 'DB6239', 'DB6239'];
const SUNPOS = [[662, 98, 0.9], [420, 50, 1], [236, 74, 1.04], [120, 150, 1.25], [120, 150, 1.25]];
const LIT = [0, 0, 0, 1, 1];
// per season: spring, summer, autumn, winter
const HILL = ['A6C864', '74A553', 'A8A957', 'A9B5A6'];
const HILL2 = ['A3C988', '8DB884', 'B2AF7C', 'B5C2BC'];
const FIELD = ['C9D27A', 'B9C46A', 'D2A75A', 'CDD3CF'];
const MTN = ['93AFC6', '86A6C0', '9DAAB9', 'A7B4C4'];
const RIVER = ['7FB2D6', '6FA8D6', '86A9C4', 'A9BCCD'];
const CANOPY = ['A2CB6A', '5E9A4A', 'D38B3B', '8F8A7A'];
const CANOPY2 = ['E79CB2', '9CBF55', 'C4503B', '8F8A7A'];
const HEDGE = ['8DBA5E', '5F9447', '8E9A48', '8D9C88'];

// ======================================================================
// Frontis: the frontispiece
// ======================================================================

function frontis(ids) {
  const W = 760, H = 320;
  const s = new Scene(ids, { name: 'Frontis', w: W, h: H, x: 0, y: 0, bg: process.env.MS_BG ? 'FFF6EEDB' : undefined });
  const k = new Kit(s);
  const season = s.input('number', 'season', SEASON0);
  const time = s.input('number', 'time', TIME0);
  const still = s.input('bool', 'still', 0);
  const seasonP = [], timeP = [];
  const sp = (object, prop, vals, type) => seasonP.push({ object, prop, vals, type });
  const tp = (object, prop, vals, type) => timeP.push({ object, prop, vals, type });

  const fxFar = k.fx('far', 6, 70);
  const fxSky = k.fx('sky', 24, 84);
  const fxHill = k.fx('hill', 16, 80);
  const fxHome = k.fx('home', 34, 100);
  const fxRoad = k.fx('road', 52, 128);
  const fxTree = k.fx('tree', 60, 118);

  // --- sky
  const skyPts = blobPts(320, 88, rng(2), { n: 16, wobble: 0.1 }).map((p) => P(p.x + 400, p.y + 116));
  const horPts = blobPts(210, 34, rng(3), { n: 14, wobble: 0.16 }).map((p) => P(p.x + 520, p.y + 196));
  s.add(k.in({ name: 'sky in', cx: 400, cy: 130, t0: 0, t1: 60, sc: 0.94 }, [
    wc(ids, skyPts, SKY[1][0], rng(4), { alpha: 0.36, off: [0, 0], grain: 0.1, soft: true, key: 'sky', hazy: true }),
    wc(ids, horPts, HORIZON[1][0], rng(5), { alpha: 0.34, off: [0, 0], grain: 0.12, soft: true, key: 'horizon', hazy: true }),
  ]));
  tintPose(tp, 'sky', SKY, 0.36);
  tintPose(tp, 'horizon', HORIZON, 0.34);

  // --- sun
  const sunId = ids.next(), sunPulse = ids.next(), raysId = ids.next(), haloId = ids.next();
  const rays = k.boil({
    name: 'rays', seed: 11, draw: (rr) => {
      const list = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + rr.jit(0.07);
        list.push([P(Math.cos(a) * 25, Math.sin(a) * 25), P(Math.cos(a) * 32, Math.sin(a) * 32)]);
      }
      return ink(list, rr, { w: 1.3, amt: 0.4, fx: fxSky });
    },
  });
  const sunInk = k.boil({ name: 'sun ink', seed: 12, draw: (rr) => ink({ pts: blobPts(18, 18, rr, { n: 9, wobble: 0.04 }), closed: true }, rr, { w: 1.6, amt: 0.4, fx: fxSky }) });
  s.add(group({ name: 'sun', id: sunId, x: SUNPOS[TIME0][0], y: SUNPOS[TIME0][1] }, [
    glow({ name: 'halo', id: haloId, x: 0, y: 0, w: 120, h: 120, color: C.lamp, alpha: 0.3 }),
    group({ name: 'pulse', id: sunPulse }, [
      wc(ids, blobPts(19, 18, rng(13), { n: 10, wobble: 0.07 }), SUN[1], rng(14), { alpha: 0.75, off: [2, 2], wobble: 0.8, grain: 0.5, key: 'sun', soft: false }),
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
  tintPose(tp, 'sun', SUN);

  // --- clouds, drifting very slowly
  const clouds = [{ x: 296, y: 76, w: 92, h: 24, seed: 21, dx: 18, dur: 1500 }, { x: 548, y: 58, w: 72, h: 20, seed: 24, dx: -14, dur: 1700 }];
  const cloudKids = clouds.map((c, i) => {
    const id = ids.next();
    const cr = rng(c.seed);
    const base = cloudPts(c.w, c.h, cr);
    s.loopLayer(`cloud${i}`, s.anim({ name: `cloud${i}`, duration: c.dur, loop: 'pingPong', tracks: [{ object: id, prop: 'x', keys: [[0, c.x, 'cubic', EASE.inOut], [c.dur, c.x + c.dx]] }] }));
    return group({ name: `cloud${i}`, x: c.x, y: c.y, id }, [
      wc(ids, base, C.slate, cr, { alpha: 0.22, off: [3, 3], grain: 0.3, soft: false }),
      k.boil({ name: `cloud${i} ink`, seed: c.seed + 1, draw: (rr) => ink({ pts: base, closed: true }, rr, { w: 1.4, amt: 0.5, fx: fxSky }) }),
    ]);
  });
  const cloudsId = ids.next();
  s.add(k.in({ name: 'clouds in', t0: 40, t1: 100 }, [group({ name: 'clouds', id: cloudsId }, cloudKids)]));
  tp(cloudsId, 'opacity', [1, 1, 1, 0.85, 0.5]);

  // --- birds: cross every 36 s; the crossing starts and ends off-canvas and
  // holds there, so the loop wraps unseen
  const flyDur = 2160;
  const flyers = [{ y: 104, start: 300, scale: 0.9, seed: 31 }, { y: 120, start: 350, scale: 0.66, seed: 37 }];
  const flyTracks = [];
  const birdKids = [];
  flyers.forEach((f, i) => {
    const id = ids.next(), flapId = ids.next();
    const r0 = rng(f.seed);
    const cels = [0, 1].map((cel) => {
      const cid = ids.next();
      const up = cel === 0 ? -6 : 3;
      return { cid, xml: el('Node', { name: `wing${cel}`, id: cid }, ink([P(-10, up), P(-5, up * 0.4 - 2.5), P(0, 0), P(5, up * 0.4 - 2.5), P(10, up)], r0, { w: 1.4, amt: 0.3 })) };
    });
    birdKids.push(group({ name: `flyer${i}`, x: -30, y: f.y, id, scaleX: f.scale, scaleY: f.scale, opacity: 0 }, [el('Solo', { name: 'flap', id: flapId, activeComponentId: cels[0].cid }, cels.map((c) => c.xml))]));
    s.loopLayer(`flap${i}`, s.anim({ name: `flap${i}`, duration: 22 + i * 2, loop: 'loop', tracks: [{ object: flapId, prop: 'activeComponentId', type: 'Id', keys: [[0, cels[0].cid, 'hold'], [11 + i, cels[1].cid, 'hold']] }] }));
    const cross = 720;
    const t0 = f.start, t1 = f.start + cross;
    flyTracks.push(
      { object: id, prop: 'x', keys: [[0, -30, 'hold'], [t0, -30, 'linear'], [t1, W + 30, 'hold'], [flyDur, W + 30, 'hold']] },
      { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [t0 - 1, 1, 'hold'], [t1 + 1, 0, 'hold'], [flyDur, 0, 'hold']] },
      sampled(id, 'y', flyDur, 20, (t) => {
        const ft = Math.max(0, Math.min(1, (t * flyDur - t0) / cross));
        return f.y + Math.sin(ft * 8 + i) * 6 - ft * 26;
      })
    );
  });
  const birdsId = ids.next();
  s.add(group({ name: 'birds', id: birdsId }, birdKids));
  tp(birdsId, 'opacity', [1, 1, 1, 0.8, 0]);
  s.loopLayer('flyers', s.anim({ name: 'flyers', duration: flyDur, loop: 'loop', tracks: flyTracks }));

  // --- far mountains: where the road is going
  const peaks = [[458, 26], [496, 44], [536, 36], [576, 62], [618, 50], [658, 72], [698, 48], [732, 30]];
  const mBase = 236;
  const ridge = [P(424, mBase)];
  peaks.forEach(([x, h], i) => {
    ridge.push(P(x, mBase - h));
    const nx = peaks[i + 1];
    if (nx) ridge.push(P((x + nx[0]) / 2 + 3, mBase - Math.min(h, nx[1]) * 0.42));
  });
  ridge.push(P(752, mBase));
  const hatch = [];
  peaks.forEach(([x, h]) => {
    for (let j = 1; j <= 3; j++) {
      const t = j / 4.2;
      hatch.push([P(x + 3 + t * h * 0.42, mBase - h + t * h * 0.7 + 4), P(x + 3 + t * h * 0.42 - 5, mBase - h + t * h * 0.7 + 14)]);
    }
  });
  const caps = peaks.filter(([, h]) => h >= 44).map(([x, h]) => {
    const top = P(x, mBase - h);
    const d = h * 0.24;
    return [P(top.x - d * 0.62, top.y + d), top, P(top.x + d * 0.66, top.y + d * 1.05), P(top.x + d * 0.3, top.y + d * 0.78), P(top.x + 0.5, top.y + d * 1.1), P(top.x - d * 0.25, top.y + d * 0.8)];
  });
  s.add(k.in({ name: 'mountains in', cx: 590, cy: 236, t0: 4, t1: 64 }, [
    wc(ids, ridge, MTN[1], rng(41), { alpha: 0.42, off: [2, 3], wobble: 1.2, grain: 0.5, key: 'mtn', tension: 0.2 }),
    ...caps.map((c, i) => el('Shape', { name: 'cap' }, [polyXml(add(c, 1, 1), { closed: true }), fill(argb('FBF8F0', 0.92))])),
    k.boil({
      name: 'mountain ink', seed: 42, draw: (rr) => [
        ink(ridge.slice(1, -1), rr, { w: 1.3, amt: 0.4, color: 'FF55606B', fx: fxFar, tension: 0.15 }),
        ink(hatch, rr, { w: 0.9, amt: 0.3, color: 'FF6A7380', fx: fxFar }),
      ],
    }),
  ]));
  tintPose(sp, 'mtn', MTN);

  // --- middle hills and fields
  const h2Top = [P(244, 252), P(320, 240), P(400, 246), P(470, 236), P(540, 241), P(620, 231), P(700, 236), P(748, 242)];
  const h2 = [...h2Top, P(752, 268), P(560, 274), P(360, 282), P(250, 282)];
  const field = [P(286, 284), P(400, 278), P(520, 271), P(640, 265), P(742, 262), P(746, 296), P(600, 304), P(420, 312), P(292, 314)];
  const tufts = [];
  for (const [x, y] of [[420, 300], [480, 294], [560, 290], [632, 284], [700, 280], [370, 304]]) {
    tufts.push([P(x, y), P(x - 3, y - 6)], [P(x + 2, y), P(x + 2, y - 7)], [P(x + 4, y), P(x + 8, y - 5)]);
  }
  s.add(k.in({ name: 'vale in', cx: 500, cy: 280, t0: 14, t1: 72, sc: 0.98 }, [
    wc(ids, h2, HILL2[1], rng(51), { alpha: 0.36, off: [0, 3], grain: 0.35, key: 'hill2' }),
    wc(ids, field, FIELD[1], rng(52), { alpha: 0.3, off: [0, 2], grain: 0.35, key: 'field' }),
    k.boil({
      name: 'vale ink', seed: 53, draw: (rr) => [
        ink(h2Top.slice(1), rr, { w: 1.2, amt: 0.5, n: 16, color: 'FF55606B', fx: fxHill }),
        ink(tufts, rr, { w: 1, amt: 0.25, fx: fxHill }),
      ],
    }),
  ]));
  tintPose(sp, 'hill2', HILL2);
  tintPose(sp, 'field', FIELD);

  // --- the road: out of the door, over the bridge, up into the mountains
  const road = [P(150, 284), P(200, 290), P(256, 292), P(310, 288), P(342, 284), P(384, 278), P(432, 270), P(480, 262), P(528, 254), P(574, 246), P(614, 238), P(646, 229)];
  const roadS = resample(road, 30);
  const eL = [], eR = [];
  roadS.forEach((p, i) => {
    const q = roadS[Math.min(i + 1, roadS.length - 1)], o = roadS[Math.max(i - 1, 0)];
    const a = Math.atan2(q.y - o.y, q.x - o.x) + Math.PI / 2;
    const hw = lerp(9, 1, Math.pow(i / (roadS.length - 1), 0.8));
    eL.push(P(p.x + Math.cos(a) * hw, p.y + Math.sin(a) * hw));
    eR.push(P(p.x - Math.cos(a) * hw, p.y - Math.sin(a) * hw));
  });
  const broken = (pts) => pts.reduce((acc, p, i, a) => (i % 4 === 0 && a[i + 2] ? [...acc, [p, a[i + 1], a[i + 2]]] : acc), []);
  s.add(k.in({ name: 'road in', cx: 400, cy: 270, t0: 50, t1: 110 }, [
    wc(ids, [...eL, ...eR.slice().reverse()], C.road, rng(71), { alpha: 0.62, off: [0, 0], wobble: 0.5, grain: 0.4, soft: false, tension: 1 }),
    k.boil({
      name: 'road ink', seed: 73, draw: (rr) => [
        ink([eL.slice(0, 14), eR.slice(0, 12)], rr, { w: 1.2, amt: 0.3, fx: fxRoad }),
        ink([...broken(eL.slice(13)), ...broken(eR.slice(11))], rr, { w: 1, amt: 0.25, fx: fxRoad }),
      ],
    }),
  ]));

  // --- little trees along the vale
  const lolli = [[392, 266, 8], [408, 270, 6], [520, 252, 6.5], [590, 244, 6], [603, 247, 4.5], [266, 236, 7]];
  const crownOf = (x, y, R, rr) => blobPts(R, R * 0.92, rr, { n: 8, wobble: 0.12 }).map((p) => P(p.x + x, p.y + y - R * 1.7));
  const smallTreesId = ids.next();
  s.add(k.in({ name: 'trees in', cx: 480, cy: 260, t0: 70, t1: 120, sc: 0.9, ease: EASE.back }, [
    group({ name: 'small trees', id: smallTreesId }, lolli.map(([x, y, R], i) => wc(ids, crownOf(x, y, R, rng(80 + i)), CANOPY[1], rng(90 + i), { alpha: 0.6, off: [1, 1], wobble: 0.5, grain: 0.2, soft: false, key: 'canopy' }))),
    k.boil({ name: 'trees ink', seed: 99, draw: (rr) => ink(lolli.flatMap(([x, y, R], i) => [[P(x, y), P(x, y - R * 0.9)], { pts: crownOf(x, y, R, rng(80 + i)), closed: true }]), rr, { w: 1, amt: 0.3, fx: fxTree }) }),
  ]));

  // --- the hill, with its round door
  const hillRidge = [P(24, 306), P(40, 262), P(70, 226), P(112, 206), P(160, 199), P(210, 210), P(252, 232), P(282, 262), P(298, 300)];
  const hillPts = [...hillRidge, P(300, 312), P(22, 314)];
  const turf = [];
  const ridgeS = resample(hillRidge, 50);
  for (const t of [0.12, 0.2, 0.3, 0.46, 0.6, 0.72, 0.84]) {
    const p = ridgeS[Math.floor(t * 49)];
    for (let j = 0; j < 3; j++) turf.push([P(p.x + (j - 1) * 3, p.y + 1), P(p.x + (j - 1) * 4.5, p.y - 4 - (j % 2) * 2)]);
  }
  const hillSnowId = ids.next();
  s.add(k.in({ name: 'hill in', cx: 160, cy: 300, t0: 16, t1: 78, sc: 0.97 }, [
    wc(ids, hillPts, HILL[1], rng(101), { alpha: 0.48, off: [0, 3], grain: 0.5, key: 'hill' }),
    k.boil({
      name: 'hill ink', seed: 102, draw: (rr) => [
        ink(hillRidge.slice(0, -1), rr, { w: 1.9, amt: 0.7, n: 22, fx: fxHill, bleed: 0.1 }),
        ink(turf, rr, { w: 1.1, amt: 0.3, fx: fxHill }),
        ink([[P(60, 296), P(74, 293)], [P(236, 270), P(248, 274)], [P(96, 236), P(108, 233)]], rr, { w: 1, amt: 0.3, color: INK_SOFT, fx: fxHill }),
      ],
    }),
    group({ name: 'hill snow', id: hillSnowId, opacity: SEASON0 === 3 ? 1 : 0 }, [...capOn(resample(hillRidge.slice(1, -1), 20), 6), ...capOn(resample(h2Top, 20).map((p) => P(p.x, p.y + 1)), 4)]),
  ]));
  tintPose(sp, 'hill', HILL);
  sp(hillSnowId, 'opacity', [0, 0, 0, 1]);

  // the tree on the hill
  const tx = 82, tb = 218;
  const ccx = tx + 2, ccy = tb - 40;
  const crown = scallop(ccx, ccy, 30, rng(111), { bumps: 7, depth: 0.13, squash: 0.86 });
  const crownSeason = ids.next(), crownInkSeason = ids.next(), blossomId = ids.next(), rustleId = ids.next();
  const blossoms = [];
  const br = rng(112);
  for (let i = 0; i < 12; i++) {
    const a = br() * TAU, d = Math.sqrt(br()) * 24;
    blossoms.push({ x: ccx + Math.cos(a) * d, y: ccy + Math.sin(a) * d * 0.8, r: br.range(1.4, 2.4) });
  }
  s.add(k.in({ name: 'tree in', cx: tx, cy: tb, t0: 56, t1: 112, sc: 0.86, ease: EASE.back }, [
    k.boil({ name: 'trunk ink', seed: 113, draw: (rr) => ink([[P(tx - 3, tb), P(tx - 1, tb - 18), P(tx + 1, tb - 34)], [P(tx + 4, tb), P(tx + 5, tb - 18), P(tx + 6, tb - 32)], [P(tx, tb - 22), P(tx - 10, tb - 34)]], rr, { w: 1.5, amt: 0.3, fx: fxTree }) }),
    group({ name: 'rustle', id: rustleId, x: tx, y: tb - 20 }, [
      group({ name: 'crown body', x: -tx, y: -(tb - 20) }, [
        group({ name: 'crown season', id: crownSeason }, [
          wc(ids, crown, CANOPY[1], rng(114), { alpha: 0.58, off: [-3, 3], grain: 0.6, key: 'canopy' }),
          wc(ids, scallop(ccx - 8, ccy + 8, 15, rng(115), { bumps: 5 }), CANOPY2[1], rng(116), { alpha: 0.28, off: [0, 0], grain: 0.2, key: 'canopy2', soft: false }),
        ]),
        group({ name: 'blossom', id: blossomId, opacity: SEASON0 === 0 ? 1 : 0 }, [stippleShape({ dots: blossoms, color: argb('E48AA6', 0.8) })]),
        group({ name: 'crown ink', id: crownInkSeason }, [k.boil({ name: 'crown ink', seed: 117, draw: (rr) => ink({ pts: crown, closed: true }, rr, { w: 1.6, amt: 0.5, fx: fxTree }) })]),
      ]),
    ]),
  ]));
  sp(crownSeason, 'opacity', [1, 1, 1, 0.2]);
  sp(crownInkSeason, 'opacity', [1, 1, 1, 0]);
  sp(blossomId, 'opacity', [1, 0, 0, 0]);
  tintPose(sp, 'canopy', CANOPY);
  tintPose(sp, 'canopy2', CANOPY2);

  // chimney and smoke
  const chim = [P(188, 204), P(188, 188), P(198, 187), P(198, 203)];
  s.add(k.in({ name: 'chimney in', cx: 193, cy: 204, t0: 40, t1: 90, sc: 0.6, ease: EASE.back }, [
    wc(ids, chim, C.brick, rng(121), { alpha: 0.6, off: [1, 1], wobble: 0.6, grain: 0.4 }),
    k.boil({ name: 'chimney ink', seed: 122, draw: (rr) => ink([chim, [P(185, 188), P(201, 187)]], rr, { w: 1.4, amt: 0.3, fx: fxHome }) }),
  ]));
  const smokeDur = 420;
  const smokeTracks = [];
  const smokeKids = [];
  for (let i = 0; i < 3; i++) {
    const id = ids.next();
    const curl = k.boil({
      name: `smoke${i}`, seed: 130 + i, draw: (rr) => {
        const pts = [];
        for (let j = 0; j <= 9; j++) { const t = j / 9; pts.push(P(Math.sin(t * 5.5) * (4 + t * 3), -t * 17)); }
        return ink(pts, rr, { w: 1.1, amt: 0.4, color: 'FF57504A' });
      },
    });
    smokeKids.push(group({ name: `smoke${i}`, x: 193, y: 180, id, opacity: 0 }, [curl]));
    const ph = i / 3;
    const at = (t) => (t + ph) % 1;
    const op = (u) => (u < 0.04 || u > 0.94 ? 0 : u < 0.18 ? (u - 0.04) / 0.14 : Math.max(0, 1 - (u - 0.18) / 0.76));
    smokeTracks.push(
      sampled(id, 'y', smokeDur, 12, (t) => 180 - at(t) * 60),
      sampled(id, 'x', smokeDur, 12, (t) => 193 + at(t) * 24 + Math.sin(at(t) * 6) * 3),
      sampled(id, 'opacity', smokeDur, 12, (t) => op(at(t))),
      sampled(id, 'scaleX', smokeDur, 12, (t) => 0.6 + at(t) * 0.7),
      sampled(id, 'scaleY', smokeDur, 12, (t) => 0.6 + at(t) * 0.7)
    );
  }
  s.add(k.in({ name: 'smoke in', t0: 110, t1: 160 }, smokeKids));
  s.loopLayer('smoke', s.anim({ name: 'smoke', duration: smokeDur, loop: 'loop', tracks: smokeTracks }));

  // round windows, the round door
  const wins = [P(104, 262), P(198, 260)];
  const D = P(150, 262), DR = 16, RR = 22;
  const stones = [];
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 0.64 + (i / 10) * Math.PI * 1.72;
    stones.push([P(D.x + Math.cos(a) * (DR + 1.5), D.y + Math.sin(a) * (DR + 1.5)), P(D.x + Math.cos(a) * (RR - 1), D.y + Math.sin(a) * (RR - 1))]);
  }
  const step = [P(134, 282), P(166, 282), P(169, 288), P(131, 288)];
  const leafId = ids.next(), insideId = ids.next(), glintId = ids.next(), spillId = ids.next();
  s.add(k.in({ name: 'home in', cx: D.x, cy: D.y, t0: 40, t1: 96 }, [
    ...wins.map((w, i) => wc(ids, circ(w.x, w.y, 9, 9, 12), C.terra, rng(141 + i), { alpha: 0.42, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false })),
    ...wins.map((w, i) => wc(ids, circ(w.x, w.y, 6, 6, 10), C.sky, rng(143 + i), { alpha: 0.4, off: [1, 1], wobble: 0.4, grain: 0.2, soft: false })),
    wc(ids, circ(D.x, D.y, RR + 1, RR + 1, 16), C.stone, rng(145), { alpha: 0.5, off: [1.5, 1.5], grain: 0.5 }),
    wc(ids, step, C.stone, rng(146), { alpha: 0.55, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false }),
    group({ name: 'inside', id: insideId, opacity: 0 }, [
      el('Shape', { name: 'room', x: D.x, y: D.y }, [el('Ellipse', { width: DR * 2, height: DR * 2, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('E9A646', 0.9))]),
      glow({ x: D.x + 2, y: D.y + 2, w: 34, h: 34, color: 'FFE7A0', alpha: 0.9 }),
    ]),
    group({ name: 'leaf', id: leafId, x: D.x - DR, y: D.y }, [
      group({ name: 'leaf body', x: -(D.x - DR), y: -D.y }, [
        wc(ids, circ(D.x, D.y, DR - 0.5, DR - 0.5, 16), C.door, rng(147), { alpha: 0.9, off: [1, 1], wobble: 0.6, grain: 0.5, blend: 'normal' }),
        wc(ids, circ(D.x, D.y, 2.6, 2.6, 8), C.brass, rng(148), { alpha: 0.95, off: [0.4, 0.4], wobble: 0.2, grain: 0, soft: false }),
        k.boil({
          name: 'door ink', seed: 149, draw: (rr) => [
            ink({ pts: circ(D.x, D.y, DR, DR, 16, 0.1), closed: true }, rr, { w: 1.5, amt: 0.35, fx: fxHome }),
            ink([[P(D.x - 9, D.y - 12), P(D.x - 9, D.y + 12)], [P(D.x + 9, D.y - 12), P(D.x + 9, D.y + 12)]], rr, { w: 0.8, amt: 0.3, color: INK_SOFT, fx: fxHome }),
          ],
        }),
        el('Shape', { name: 'glint', id: glintId, x: D.x - 0.8, y: D.y - 1, opacity: 0.35 }, [el('Ellipse', { width: 1.6, height: 1.4, originX: 0.5, originY: 0.5, name: 'E' }), fill('FFFFF6DC')]),
      ]),
    ]),
    k.boil({
      name: 'home ink', seed: 150, draw: (rr) => [
        ink({ pts: circ(D.x, D.y, RR, RR, 18, 0.3), closed: true }, rr, { w: 1.7, amt: 0.45, fx: fxHome, bleed: 0.1 }),
        ink(stones, rr, { w: 0.9, amt: 0.3, color: INK_SOFT, fx: fxHome }),
        ink({ pts: step, closed: true }, rr, { w: 1.2, amt: 0.3, fx: fxHome, tension: 0.3 }),
        ...wins.map((w) => ink([{ pts: circ(w.x, w.y, 9, 9, 12), closed: true }, [P(w.x, w.y - 6), P(w.x, w.y + 6)], [P(w.x - 6, w.y), P(w.x + 6, w.y)]], rr, { w: 1.2, amt: 0.3, fx: fxHome })),
      ],
    }),
  ]));

  // foreground: grass along the foot of the picture, fading off the page
  s.add(k.in({ name: 'grass in', t0: 30, t1: 90 }, [
    k.boil({
      name: 'grass ink', seed: 160, draw: (rr) => {
        const list = [];
        for (let x = 36; x < 290; x += rr.range(26, 40)) list.push([P(x, 312), P(x - 2, 304)], [P(x + 3, 312), P(x + 4, 302)], [P(x + 6, 312), P(x + 10, 305)]);
        for (let x = 30; x < 296; x += rr.range(50, 70)) list.push([P(x, 314), P(x + 16, 314 + rr.jit(1)), P(x + 30, 314 + rr.jit(1))]);
        return ink(list, rr, { w: 1.1, amt: 0.3, fx: fxHill });
      },
    }),
  ]));

  // --- the light of the hour
  const glazePts = blobPts(380, 150, rng(170), { n: 14, wobble: 0.08 }).map((p) => P(p.x + 390, p.y + 170));
  const glazeColor = ids.next();
  s.add(el('Shape', { name: 'hour glaze', blendModeValue: 'multiply' }, [pathXml(glazePts, { closed: true }), el('Fill', { name: 'Fill', fillRule: 'clockwise' }, [el('SolidColor', { colorValue: argb(GLAZE[TIME0][0], GLAZE[TIME0][1]), name: 'C', id: glazeColor }), el('Feather', { strength: 30, name: 'F' })])]));
  tp(glazeColor, 'colorValue', GLAZE.map(([c, a]) => argb(c, a)), 'Color');

  // lamplight, moon and stars sit above the glaze
  const litId = ids.next();
  s.add(k.in({ name: 'lit in', t0: 96, t1: 150 }, [
    group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
      ...wins.map((w) => glow({ x: w.x, y: w.y + 2, w: 46, h: 40, color: C.lamp, alpha: 0.45 })),
      ...wins.map((w) => el('Shape', { name: 'pane', x: w.x, y: w.y }, [el('Ellipse', { width: 12, height: 12, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('F7CB5C', 0.88))])),
      ...wins.map((w, i) => ink([[P(w.x, w.y - 6), P(w.x, w.y + 6)], [P(w.x - 6, w.y), P(w.x + 6, w.y)]], rng(180 + i), { w: 0.9, amt: 0.15 })),
      glow({ x: 150, y: 296, w: 110, h: 26, color: C.lamp, alpha: 0.22 }),
    ]),
  ]));
  tp(litId, 'opacity', LIT);
  s.add(group({ name: 'spill', id: spillId, opacity: 0 }, [glow({ x: 152, y: 292, w: 70, h: 22, color: 'FFD77A', alpha: 0.6 })]));

  const moonId = ids.next();
  const moonOuter = [], moonInner = [];
  for (let i = 0; i <= 10; i++) { const a = -2.1 + (i / 10) * 4.2; moonOuter.push(P(Math.cos(a) * 13, Math.sin(a) * 13)); }
  for (let i = 0; i <= 8; i++) { const a = 1.75 - (i / 8) * 3.5; moonInner.push(P(-5.5 + Math.cos(a) * 11.5, Math.sin(a) * 11.5)); }
  const moon = [...moonOuter, ...moonInner];
  s.add(group({ name: 'moon', id: moonId, x: 560, y: 66, opacity: TIME0 === 4 ? 1 : 0 }, [
    glow({ x: 0, y: 0, w: 90, h: 90, color: 'F3E7B8', alpha: 0.3 }),
    wc(ids, moon, 'EFE2A8', rng(190), { alpha: 0.95, off: [1, 1], wobble: 0.4, grain: 0.2, soft: false }),
    k.boil({ name: 'moon ink', seed: 191, draw: (rr) => ink({ pts: moon, closed: true }, rr, { w: 1.3, amt: 0.25 }) }),
  ]));
  tp(moonId, 'opacity', [0, 0, 0, 0, 1]);
  const stars = [[150, 52, 4.5], [330, 40, 4], [450, 70, 3.5], [660, 40, 4.5], [250, 110, 3]];
  const twinkle = [];
  stars.forEach(([x, y, R], i) => {
    const id = ids.next(), tw = ids.next();
    s.add(group({ name: 'star', id, x, y, opacity: 0 }, [
      group({ name: 'twinkle', id: tw }, [el('Shape', { name: 'star' }, [polyXml(starPts(R), { closed: true }), fill(argb('F6E7A8', 0.95)), stroke(INK, 0.8)])]),
    ]));
    tp(id, 'opacity', [0, 0, 0, i === 3 ? 0.9 : 0, 1]);
    twinkle.push(sampled(tw, 'scaleX', 240, 20, (t) => 1 + 0.25 * Math.sin((t + i * 0.29) * TAU)), sampled(tw, 'scaleY', 240, 20, (t) => 1 + 0.25 * Math.sin((t + i * 0.29) * TAU)));
  });
  gatedLoop(s, 'twinkle', s.anim({ name: 'twinkle', duration: 240, loop: 'loop', tracks: twinkle }), [[time, 'greaterThanOrEqual', 3]]);

  // --- hit areas, poses, reactions
  const hDoor = ids.next(), hTree = ids.next(), hSun = ids.next();
  s.add(hit(hDoor, D.x, D.y + 2, 54, 54), hit(hTree, tx + 2, tb - 30, 70, 76), hit(hSun, 420, 70, 260, 110));

  poseLayer(s, 'season', season, 4, seasonP);
  poseLayer(s, 'time', time, 5, timeP);

  const knock = s.input('trigger', 'knock');
  s.triggerLayer('knock', knock, s.anim({ name: 'knock', duration: 300, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [6, 0.97, 'cubic', EASE.out], [12, 1, 'cubic', EASE.inOut], [40, 0.6, 'hold'], [230, 0.6, 'cubic', EASE.inOut], [276, 1.01, 'cubic', EASE.out], [290, 1]] },
    { object: insideId, prop: 'opacity', keys: [[0, 0, 'hold'], [12, 0, 'cubic', EASE.out], [40, 1, 'hold'], [240, 1, 'cubic', EASE.in], [276, 0]] },
    { object: spillId, prop: 'opacity', keys: [[0, 0, 'hold'], [16, 0, 'cubic', EASE.out], [50, 1, 'hold'], [230, 1, 'cubic', EASE.in], [272, 0]] },
  ] }), { fromAny: false });
  s.listen(hDoor, 'click', [Scene.fire(knock)]);

  const glint = s.input('trigger', 'glint');
  s.triggerLayer('glint', glint, s.anim({ name: 'glint', duration: 60, tracks: [
    { object: glintId, prop: 'opacity', keys: [[0, 0.35, 'cubic', EASE.out], [10, 1, 'cubic', EASE.inOut], [60, 0.35]] },
    { object: glintId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [10, 2, 'cubic', EASE.inOut], [60, 1]] },
    { object: glintId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [10, 2, 'cubic', EASE.inOut], [60, 1]] },
  ] }), { fromAny: false });
  s.listen(hDoor, 'enter', [Scene.fire(glint)]);

  const rustle = s.input('trigger', 'rustle');
  s.triggerLayer('rustle', rustle, s.anim({ name: 'rustle', duration: 60, tracks: [
    { object: rustleId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [10, 0.05, 'cubic', EASE.inOut], [24, -0.035, 'cubic', EASE.inOut], [40, 0.015, 'cubic', EASE.inOut], [58, 0]] },
  ] }), { fromAny: false });
  s.listen(hTree, 'enter', [Scene.fire(rustle)]);

  const shine = s.input('trigger', 'shine');
  s.triggerLayer('shine', shine, s.anim({ name: 'shine', duration: 80, tracks: [
    { object: sunPulse, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [16, 1.16, 'cubic', EASE.inOut], [80, 1]] },
    { object: sunPulse, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [16, 1.16, 'cubic', EASE.inOut], [80, 1]] },
    { object: sunPulse, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [80, 0.35]] },
  ] }), { fromAny: false });
  s.listen(hSun, 'enter', [Scene.fire(shine)]);

  k.finish(still);
  return s.toXml();
}

// ======================================================================
// Map: the road so far
// ======================================================================

// Stations, in the order the road reaches them. `t` is the frame (60 fps,
// after `go`) at which the red road arrives; main.js shows the labels on the
// same schedule (MAP_TIMES there).
export const STATIONS = [
  { key: 'home', x: 80, y: 440 },
  { key: 'utd', x: 214, y: 352 },
  { key: 'fries', x: 150, y: 194 },
  { key: 'utd2', x: 214, y: 352 },
  { key: 'lab', x: 330, y: 256 },
  { key: 'foundry', x: 452, y: 386 },
  { key: 'hytale', x: 514, y: 230 },
  { key: 'axle', x: 622, y: 362 },
];
const LEGS = [
  [P(80, 440), P(108, 428), P(146, 414), P(182, 390), P(206, 366)],
  [P(206, 366), P(180, 334), P(158, 302), P(140, 266), P(138, 232), P(148, 206)],
  [P(158, 202), P(184, 216), P(208, 246), P(226, 288), P(228, 326), P(220, 350)],
  [P(222, 352), P(256, 326), P(292, 296), P(322, 266)],
  [P(336, 266), P(362, 302), P(394, 338), P(420, 368), P(444, 382)],
  [P(462, 380), P(482, 346), P(492, 302), P(500, 266), P(508, 240)],
  [P(522, 238), P(548, 266), P(576, 302), P(600, 334), P(616, 354)],
  [P(630, 356), P(650, 320), P(662, 272), P(664, 216), P(668, 170), P(672, 142)],
];
const MAP_T0 = 90, HOLD = 8, SPEED_PX = 4; // px of road per frame

function mapScene(ids) {
  const W = 720, H = 540;
  const s = new Scene(ids, { name: 'Map', w: W, h: H, x: 0, y: 400, bg: process.env.MS_BG ? 'FFF6EEDB' : undefined });
  const k = new Kit(s);
  const go = s.input('bool', 'go', GO0);
  const still = s.input('bool', 'still', 0);
  const spot = s.input('number', 'spot', 0);
  const r = rng(1937);
  const BR = 'FF4A3A2C'; // map ink: a browner brown
  const BR_SOFT = 'FF7A6A58';

  const fxBorder = k.fx('border', 0, 70);
  const fxLand = k.fx('land', 16, 96);
  const fxRose = k.fx('rose', 40, 100);

  // --- the sheet: a slightly darker, older paper laid on the leaf
  const sheet = [];
  const edge = (a, b, n) => { for (let i = 0; i < n; i++) sheet.push(P(lerp(a.x, b.x, i / n) + r.jit(1.6), lerp(a.y, b.y, i / n) + r.jit(1.6))); };
  edge(P(4, 6), P(716, 4), 18); edge(P(716, 4), P(714, 536), 14); edge(P(714, 536), P(6, 534), 18); edge(P(6, 534), P(4, 6), 14);
  s.add(k.in({ name: 'sheet in', t0: 0, t1: 40 }, [
    el('Shape', { name: 'sheet', blendModeValue: 'multiply' }, [pathXml(sheet, { closed: true, tension: 0.4 }), fill(argb('EBD7A6', 0.42)), stroke(argb('B08A55', 0.16), 22, { feather: 16 })]),
    el('Shape', { name: 'sheet edge', blendModeValue: 'multiply' }, [pathXml(sheet, { closed: true, tension: 0.4 }), stroke(argb('8A6A40', 0.35), 1.1)]),
  ]));

  // --- border: two rules with a band of rune-like marks between them.
  // The marks are made-up strokes (no alphabet), so they spell nothing.
  const glyphs = [];
  const gl = rng(77);
  const band = (x0, x1, y, vertical = false) => {
    for (let t = x0; t < x1 - 8; t += gl.range(11, 15)) {
      const strokes = [];
      const h = 8, w = 5;
      strokes.push([P(0, -h / 2), P(0, h / 2)]);
      const kind = Math.floor(gl() * 6);
      if (kind === 0) strokes.push([P(0, -h / 2), P(w, -h / 2 + 3)]);
      if (kind === 1) strokes.push([P(0, -1), P(w, -h / 2 + 1)], [P(0, 2), P(w, -1)]);
      if (kind === 2) strokes.push([P(w, -h / 2), P(w, h / 2)], [P(0, -h / 2), P(w, h / 2)]);
      if (kind === 3) strokes.push([P(0, -h / 2), P(w, 0), P(0, h / 2 - 2)]);
      if (kind === 4) strokes.push([P(-w / 2, -1), P(w / 2, 1)]);
      if (kind === 5) strokes.push([P(-w / 2, -h / 2 + 1), P(0, 0), P(w / 2, -h / 2 + 1)]);
      const dot = gl() < 0.12;
      for (const st of strokes) glyphs.push(st.map((p) => (vertical ? P(y + p.y * 0.9, t + p.x) : P(t + p.x, y + p.y))));
      if (dot) t += 6;
    }
  };
  band(34, 690, 19.5); band(34, 690, 520.5);
  band(36, 506, 19.5, true); band(36, 506, 700.5, true);
  const ruleO = [P(11, 11), P(709, 11), P(709, 529), P(11, 529)];
  const ruleI = [P(28, 28), P(692, 28), P(692, 512), P(28, 512)];
  s.add(group({ name: 'border', id: undefined }, [
    ink([{ pts: ruleO, closed: true, tension: 0.05 }, { pts: ruleI, closed: true, tension: 0.05 }], rng(78), { w: 1.4, amt: 0.5, n: undefined, color: BR, fx: fxBorder }),
    ink(glyphs, rng(79), { w: 1, amt: 0.25, color: BR_SOFT, fx: fxBorder }),
  ]));

  // --- the sea to the west, with wave marks
  const coast = [P(30, 40), P(66, 52), P(92, 82), P(100, 120), P(92, 160), P(104, 200), P(118, 236), P(108, 272), P(84, 304), P(54, 330), P(30, 344)];
  const waves = [];
  for (const [x, y] of [[48, 96], [70, 150], [44, 200], [66, 250], [44, 300], [72, 120], [40, 150]]) {
    waves.push([P(x - 8, y), P(x - 4, y - 3), P(x, y), P(x + 4, y - 3), P(x + 8, y)]);
  }
  s.add(k.in({ name: 'sea in', cx: 60, cy: 190, t0: 16, t1: 70 }, [
    wc(ids, [...coast, P(30, 344), P(30, 40)], '8DB4CF', rng(81), { alpha: 0.32, off: [-2, 0], grain: 0.3, soft: false }),
    ink(coast, rng(82), { w: 1.4, amt: 0.5, n: 30, color: BR, fx: fxLand }),
    ink(add(coast.slice(1, -1), -6, 2), rng(83), { w: 0.7, amt: 0.6, n: 26, color: BR_SOFT, fx: fxLand }),
    ink(waves, rng(84), { w: 0.9, amt: 0.2, color: 'FF5A7A94', fx: fxLand }),
  ]));

  // --- mountains along the north, drawn as bumps with shading strokes
  const mtn = [];
  const mts = [];
  for (let x = 300, i = 0; ; i++) {
    const h = 26 + Math.abs(Math.sin(i * 1.7)) * 30 + r.range(0, 10);
    const w = h * 0.9;
    if (x + w > 686) break;
    mts.push({ x, h, w, by: 128 - Math.abs(Math.sin(i * 0.9)) * 22 });
    x += w * 0.62;
  }
  const mWash = [];
  mts.forEach((m) => {
    const L = P(m.x, m.by), T = P(m.x + m.w * 0.48, m.by - m.h), R = P(m.x + m.w, m.by);
    mtn.push([L, P(m.x + m.w * 0.25, m.by - m.h * 0.62), T, P(m.x + m.w * 0.76, m.by - m.h * 0.5), R]);
    for (let j = 1; j <= 3; j++) {
      const f = j / 4;
      const a = P(lerp(T.x, R.x, f) - 1, lerp(T.y, R.y, f));
      mtn.push([a, P(a.x - 4, a.y + 8)]);
    }
    mWash.push(wc(ids, [L, T, R], '9AA6B2', rng(Math.round(m.x)), { alpha: 0.28, off: [2, 1], wobble: 1, grain: 0.15, soft: false }));
  });
  s.add(k.in({ name: 'mountains in', cx: 500, cy: 110, t0: 20, t1: 80 }, [...mWash, ink(mtn, rng(91), { w: 1.2, amt: 0.35, color: BR, fx: fxLand, tension: 0.4 })]));

  // --- a river out of the mountains, past the foundry, off the bottom of the map
  const river = [P(420, 124), P(430, 168), P(420, 212), P(426, 258), P(450, 300), P(478, 338), P(482, 380), P(470, 432), P(482, 476), P(476, 510)];
  s.add(k.in({ name: 'river in', cx: 450, cy: 320, t0: 30, t1: 90 }, [
    wc(ids, [...add(river, -3, 0), ...add(river, 4, 0).reverse()], '8DB4CF', rng(92), { alpha: 0.4, off: [0, 0], wobble: 0.6, grain: 0, soft: false, tension: 1 }),
    ink([add(river, -3, 0), add(river, 4, 0)], rng(93), { w: 0.9, amt: 0.4, n: 30, color: BR, fx: fxLand }),
  ]));

  // --- woods: little round trees, as on old maps
  const woods = [];
  const wr = rng(95);
  const plant = (cx, cy, rx, ry, n) => {
    for (let i = 0, tries = 0; i < n && tries < n * 8; tries++) {
      const p = P(cx + wr.jit(rx), cy + wr.jit(ry));
      if (Math.hypot((p.x - cx) / rx, (p.y - cy) / ry) > 1) continue;
      if (woods.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 11)) continue;
      woods.push(P(p.x, p.y)); i++;
    }
  };
  plant(330, 446, 62, 34, 16);
  plant(262, 176, 26, 17, 5);
  plant(572, 480, 24, 15, 4);
  woods.sort((a, b) => a.y - b.y);
  const treeInk = woods.flatMap((p) => [{ pts: blobPts(5, 4.6, wr, { n: 7, wobble: 0.1 }).map((q) => P(q.x + p.x, q.y + p.y - 6)), closed: true }, [P(p.x, p.y - 1.5), P(p.x, p.y + 3)]]);
  s.add(k.in({ name: 'woods in', cx: 330, cy: 440, t0: 36, t1: 96 }, [
    wc(ids, blobPts(66, 36, rng(96), { n: 12, wobble: 0.12 }).map((p) => P(p.x + 330, p.y + 444)), '8FB070', rng(97), { alpha: 0.26, off: [0, 0], grain: 0.2, soft: false }),
    wc(ids, blobPts(30, 20, rng(98), { n: 10, wobble: 0.12 }).map((p) => P(p.x + 262, p.y + 174)), '8FB070', rng(99), { alpha: 0.24, off: [0, 0], grain: 0.2, soft: false }),
    wc(ids, blobPts(28, 18, rng(100), { n: 10, wobble: 0.12 }).map((p) => P(p.x + 572, p.y + 478)), '8FB070', rng(101), { alpha: 0.24, off: [0, 0], grain: 0.2, soft: false }),
    ink(treeInk, rng(102), { w: 1, amt: 0.25, color: BR, fx: fxLand }),
  ]));

  // a few hills as bumps
  const bumps = [[44, 488], [236, 498], [250, 392], [390, 200], [560, 180], [610, 300], [100, 360], [600, 220]];
  s.add(k.in({ name: 'bumps in', t0: 30, t1: 90 }, [
    ink(bumps.flatMap(([x, y]) => [[P(x - 12, y), P(x - 5, y - 7), P(x + 2, y - 8), P(x + 9, y - 3), P(x + 13, y)], [P(x + 2, y - 4), P(x + 6, y - 1)]]), rng(103), { w: 1, amt: 0.3, color: BR, fx: fxLand }),
  ]));

  // --- compass rose, bottom right
  const RX = 640, RY = 462;
  const roseNeedle = ids.next();
  const rosePts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU - Math.PI / 2;
    const R = i % 4 === 0 ? 26 : i % 2 === 0 ? 15 : 5.5;
    rosePts.push(P(Math.cos(a) * R, Math.sin(a) * R));
  }
  const nPts = [P(0, -26), P(4, -5), P(0, 0), P(-4, -5)];
  s.add(k.in({ name: 'rose in', cx: RX, cy: RY, t0: 40, t1: 100, sc: 0.7, ease: EASE.back }, [
    el('Shape', { name: 'rose ring', x: RX, y: RY }, [el('Ellipse', { width: 40, height: 40, originX: 0.5, originY: 0.5, name: 'E' }), stroke(BR_SOFT.replace(/^FF/, 'AA'), 0.8)]),
    group({ name: 'needle', id: roseNeedle, x: RX, y: RY }, [
      wc(ids, rosePts, 'D9C08A', rng(110), { alpha: 0.5, off: [0, 0], wobble: 0.2, grain: 0, soft: false, tension: 0 }),
      el('Shape', { name: 'north' }, [polyXml(nPts, { closed: true }), fill(argb('A8392B', 0.85))]),
      ink({ pts: rosePts, closed: true, tension: 0 }, rng(111), { w: 1, amt: 0.15, color: BR, fx: fxRose }),
      // a little N, made of strokes
      ink([[P(-4, -32), P(-4, -41), P(4, -32), P(4, -41)]], rng(112), { w: 1.2, amt: 0.1, color: BR, fx: fxRose, tension: 0 }),
    ]),
  ]));

  // --- the moon, top left, for the moon-letters (HTML) beside it
  const moonOuter = [], moonInner = [];
  for (let i = 0; i <= 10; i++) { const a = -2.1 + (i / 10) * 4.2; moonOuter.push(P(Math.cos(a) * 11, Math.sin(a) * 11)); }
  for (let i = 0; i <= 8; i++) { const a = 1.75 - (i / 8) * 3.5; moonInner.push(P(-4.5 + Math.cos(a) * 9.6, Math.sin(a) * 9.6)); }
  const moon = [...moonOuter, ...moonInner];
  s.add(k.in({ name: 'moon in', cx: 62, cy: 62, t0: 60, t1: 100 }, [
    group({ name: 'moon', x: 62, y: 62 }, [
      wc(ids, moon, 'E6DDB8', rng(120), { alpha: 0.7, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
      ink({ pts: moon, closed: true }, rng(121), { w: 1.1, amt: 0.2, color: BR, fx: fxRose }),
    ]),
  ]));

  // --- stations: little landmarks that pop up as the road reaches them
  const legLen = LEGS.map(plen);
  const arrive = [MAP_T0];
  legLen.forEach((L, i) => arrive.push(arrive[i] + HOLD + Math.round(L / SPEED_PX)));
  const T = STATIONS.map((st, i) => arrive[i]);
  if (process.env.MS_DEBUG) console.error('map times (frames):', arrive.join(', '));
  const pop = (i, name, cx, cy, kids) => k.in({ name, cx, cy, t0: T[i] - 6, t1: T[i] + 22, sc: 0.3, ease: EASE.back }, kids);
  const sx = (x, y, list) => list.map((pts) => pts.map((p) => P(p.x + x, p.y + y)));

  // home: a round door in a hill
  s.add(pop(0, 'home', 80, 440, [
    wc(ids, [P(58, 446), P(66, 432), P(80, 426), P(94, 432), P(102, 446)], '9FBF6E', rng(130), { alpha: 0.5, off: [0, 0], wobble: 0.4, grain: 0, soft: false }),
    ink([[P(56, 446), P(66, 432), P(80, 426), P(94, 432), P(104, 446)], { pts: circ(80, 440, 4.5, 4.5, 10), closed: true }], rng(131), { w: 1.2, amt: 0.2, color: BR }),
  ]));
  // UT Dallas: a hall with a tower and a flag
  s.add(pop(1, 'utd', 214, 352, [
    wc(ids, [P(200, 364), P(200, 340), P(214, 340), P(214, 364)], 'C9B48C', rng(132), { alpha: 0.55, off: [0, 0], wobble: 0.3, grain: 0.1, soft: false }),
    wc(ids, [P(214, 364), P(214, 350), P(232, 350), P(232, 364)], 'C9B48C', rng(133), { alpha: 0.45, off: [0, 0], wobble: 0.3, grain: 0, soft: false }),
    el('Shape', { name: 'flag' }, [polyXml([P(207, 328), P(217, 331), P(207, 334)], { closed: true }), fill(argb('A8392B', 0.85))]),
    ink(sx(0, 0, [
      [P(200, 364), P(200, 340), P(214, 340), P(214, 364)], [P(200, 340), P(200, 336), P(204, 336), P(204, 340)], [P(210, 340), P(210, 336), P(214, 336), P(214, 340)],
      [P(214, 350), P(232, 350), P(232, 364)], [P(212, 350), P(223, 343), P(234, 350)], [P(207, 336), P(207, 326)], [P(196, 364), P(236, 364)],
      [P(205, 347), P(205, 352)], [P(209, 347), P(209, 352)], [P(222, 355), P(222, 360)],
    ]), rng(134), { w: 1.1, amt: 0.2, color: BR, tension: 0.2 }),
  ]));
  // Unlimited Fries Studios: a lighthouse by the sea
  s.add(pop(2, 'fries', 150, 194, [
    wc(ids, [P(144, 206), P(146, 180), P(154, 180), P(156, 206)], 'F2EEE6', rng(135), { alpha: 0.9, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, [P(145, 196), P(155, 196), P(155.5, 202), P(144.5, 202)], 'B5443A', rng(136), { alpha: 0.8, off: [0, 0], wobble: 0.1, grain: 0, soft: false }),
    wc(ids, [P(145.5, 186), P(154.5, 186), P(155, 191), P(145, 191)], 'B5443A', rng(137), { alpha: 0.8, off: [0, 0], wobble: 0.1, grain: 0, soft: false }),
    glow({ x: 150, y: 175, w: 26, h: 18, color: 'F5C451', alpha: 0.6 }),
    ink([[P(144, 206), P(146, 180), P(154, 180), P(156, 206)], [P(146, 180), P(147, 174), P(153, 174), P(154, 180)], [P(145, 173), P(150, 168), P(155, 173)], [P(136, 207), P(164, 207)], [P(158, 174), P(166, 172)], [P(142, 174), P(134, 172)]], rng(138), { w: 1.1, amt: 0.15, color: BR, tension: 0.2 }),
  ]));
  // Multimodal Interaction Lab: a domed observatory
  s.add(pop(4, 'lab', 330, 256, [
    wc(ids, [P(318, 266), P(318, 256), P(342, 256), P(342, 266)], 'C9B48C', rng(139), { alpha: 0.5, off: [0, 0], wobble: 0.2, grain: 0, soft: false }),
    wc(ids, [...Array.from({ length: 9 }, (_, i) => P(330 + Math.cos(Math.PI + (i / 8) * Math.PI) * 11, 256 + Math.sin(Math.PI + (i / 8) * Math.PI) * 11))], '9AB0C2', rng(140), { alpha: 0.55, off: [0, 0], wobble: 0.2, grain: 0, soft: false }),
    ink([
      [P(316, 266), P(344, 266)], [P(318, 266), P(318, 256), P(342, 256), P(342, 266)],
      Array.from({ length: 9 }, (_, i) => P(330 + Math.cos(Math.PI + (i / 8) * Math.PI) * 11, 256 + Math.sin(Math.PI + (i / 8) * Math.PI) * 11)),
      [P(330, 245), P(331, 256)], [P(333, 247), P(343, 238)], [P(326, 260), P(326, 266)], [P(334, 260), P(334, 266)],
    ], rng(141), { w: 1.1, amt: 0.15, color: BR, tension: 0.6 }),
  ]));
  // Pixel Foundry: a forge with a tall chimney
  s.add(pop(5, 'foundry', 452, 386, [
    wc(ids, [P(436, 398), P(436, 382), P(464, 382), P(464, 398)], 'B5644A', rng(142), { alpha: 0.45, off: [0, 0], wobble: 0.2, grain: 0.1, soft: false }),
    glow({ x: 444, y: 392, w: 14, h: 10, color: 'F2A23A', alpha: 0.8 }),
    ink([
      [P(434, 398), P(468, 398)], [P(436, 398), P(436, 382), P(464, 382), P(464, 398)], [P(434, 382), P(450, 372), P(466, 382)],
      [P(458, 377), P(458, 360), P(463, 360), P(463, 380)], [P(441, 398), P(441, 389), P(447, 389), P(447, 398)],
      [P(461, 356), P(464, 351), P(460, 346), P(464, 340)], [P(466, 352), P(470, 346), P(467, 341)],
    ], rng(143), { w: 1.1, amt: 0.15, color: BR, tension: 0.3 }),
  ]));
  // HytaleModding: a busy little town
  const houses = [[498, 236, 9], [510, 228, 11], [524, 238, 9], [532, 226, 8], [506, 244, 7], [520, 246, 8]];
  s.add(pop(6, 'hytale', 514, 236, [
    ...houses.map(([x, y, w], i) => wc(ids, [P(x - w / 2, y), P(x - w / 2, y - w * 0.7), P(x, y - w * 1.25), P(x + w / 2, y - w * 0.7), P(x + w / 2, y)], i % 2 ? 'C9B48C' : 'B5644A', rng(150 + i), { alpha: 0.5, off: [0, 0], wobble: 0.2, grain: 0, soft: false })),
    ink(houses.flatMap(([x, y, w]) => [[P(x - w / 2, y), P(x - w / 2, y - w * 0.7), P(x, y - w * 1.25), P(x + w / 2, y - w * 0.7), P(x + w / 2, y), P(x - w / 2, y)], [P(x, y), P(x, y - w * 0.32)]]), rng(160), { w: 1, amt: 0.12, color: BR, tension: 0 }),
  ]));
  // The Axle Group: a cartwheel beside the X
  const wheel = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; wheel.push([P(644 + Math.cos(a) * 8, 366 + Math.sin(a) * 8), P(644 - Math.cos(a) * 8, 366 - Math.sin(a) * 8)]); }
  s.add(pop(7, 'axle', 640, 366, [
    wc(ids, circ(644, 366, 9, 9, 12), 'C9A46A', rng(161), { alpha: 0.4, off: [0, 0], wobble: 0.2, grain: 0, soft: false }),
    ink([{ pts: circ(644, 366, 9, 9, 14), closed: true }, { pts: circ(644, 366, 2, 2, 6), closed: true }, ...wheel], rng(162), { w: 1.1, amt: 0.15, color: BR }),
  ]));

  // --- the road: red dashes in one shape, trimmed sequentially so it inks
  // itself on dash by dash; the pen pauses at each station
  const dashes = [];
  const roadTrim = ids.next();
  const legDash = [];
  const dr = rng(170);
  LEGS.forEach((leg, li) => {
    const pts = resample(leg, Math.max(6, Math.round(plen(leg) / 1.5)));
    let acc = 0, on = true, cur = [pts[0]], dashLen = 0;
    const startCount = dashes.length;
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      acc += d;
      if (on) cur.push(pts[i]);
      const lim = on ? 6.5 : 4.5;
      if (acc >= lim) {
        if (on && cur.length > 1) dashes.push(cur.map((p) => P(p.x + dr.jit(0.3), p.y + dr.jit(0.3))));
        on = !on; acc = 0; cur = [pts[i]];
      }
    }
    if (on && cur.length > 1) dashes.push(cur);
    legDash.push(dashes.length - startCount);
  });
  // last leg (onward) fades: drawn in its own lighter shape
  const onwardN = legDash.at(-1);
  const mainDashes = dashes.slice(0, dashes.length - onwardN);
  const onward = dashes.slice(dashes.length - onwardN);
  const dashLenOf = (d) => plen(d);
  const totalMain = mainDashes.reduce((a, d) => a + dashLenOf(d), 0);
  // cumulative fraction at the end of each leg (main shape)
  const fr = [0];
  let seen = 0, run = 0;
  legDash.slice(0, -1).forEach((n) => { for (let i = 0; i < n; i++) run += dashLenOf(mainDashes[seen + i]); seen += n; fr.push(run / totalMain); });
  const trimKeys = [[0, 0, 'hold']];
  for (let i = 0; i < LEGS.length - 1; i++) {
    trimKeys.push([arrive[i] + HOLD, fr[i], 'linear']);
    trimKeys.push([arrive[i + 1], fr[i + 1], 'hold']);
  }
  const roadShape = el('Shape', { name: 'road' }, [
    ...mainDashes.map((d) => pathXml(d, { tension: 0.5 })),
    el('Stroke', { thickness: 1.9, cap: 'round', join: 'round', name: 'Stroke' }, [el('SolidColor', { colorValue: RED, name: 'C' }), el('TrimPath', { start: 0, end: 0, modeValue: 'sequential', id: roadTrim, name: 'Trim' })]),
  ]);
  k.raw(roadTrim, 'end', trimKeys, 1);
  const onwardTrim = ids.next();
  const onwardShape = el('Shape', { name: 'onward', opacity: 0.6 }, [
    ...onward.map((d) => pathXml(d, { tension: 0.5 })),
    el('Stroke', { thickness: 1.6, cap: 'round', join: 'round', name: 'Stroke' }, [el('SolidColor', { colorValue: RED, name: 'C' }), el('TrimPath', { start: 0, end: 0, modeValue: 'sequential', id: onwardTrim, name: 'Trim' })]),
  ]);
  const lastT = arrive.at(-1);
  k.raw(onwardTrim, 'end', [[0, 0, 'hold'], [arrive.at(-2) + HOLD, 0, 'cubic', [0.2, 0.4, 0.4, 1]], [lastT + 30, 1]], 1);
  // the X: here I am now
  const xId = ids.next();
  const xs = ink([[P(613, 353), P(631, 371)], [P(631, 353), P(613, 371)]], rng(171), { w: 2.4, amt: 0.4, color: RED, bleed: 0.15 });
  s.add(roadShape, onwardShape, el('Node', { name: 'X', id: xId, x: 622, y: 362, opacity: 0, scaleX: 2, scaleY: 2 }, group({ name: 'X body', x: -622, y: -362 }, [xs])));
  const tX = T[7];
  k.raw(xId, 'opacity', [[0, 0, 'hold'], [tX - 2, 0, 'cubic', EASE.out], [tX + 10, 1]], 1);
  k.raw(xId, 'scaleX', [[0, 2, 'hold'], [tX - 2, 2, 'cubic', EASE.out], [tX + 14, 1]], 1);
  k.raw(xId, 'scaleY', [[0, 2, 'hold'], [tX - 2, 2, 'cubic', EASE.out], [tX + 14, 1]], 1);

  // --- the spot ring: hovering a label or an entry rings that station
  const ringId = ids.next();
  const ringPts = blobPts(25, 21, rng(180), { n: 12, wobble: 0.06 });
  ringPts.push(P(ringPts[0].x + 6, ringPts[0].y - 4));
  const ringR = [{ x: 80, y: 438 }, ...STATIONS.filter((s2) => s2.key !== 'utd2').slice(1).map((s2) => (s2.key === 'utd' ? { x: 216, y: 348 } : s2.key === 'axle' ? { x: 632, y: 364 } : s2))];
  s.add(el('Node', { name: 'ring', id: ringId, x: ringR[0].x, y: ringR[0].y, opacity: 0 }, [ink(ringPts, rng(181), { w: 1.5, amt: 0.4, color: RED, bleed: 0.1 })]));
  const ringP = [
    { object: ringId, prop: 'opacity', vals: [0, ...ringR.map(() => 0.9)] },
    { object: ringId, prop: 'x', vals: [ringR[0].x, ...ringR.map((p) => p.x)] },
    { object: ringId, prop: 'y', vals: [ringR[0].y, ...ringR.map((p) => p.y)] },
  ];
  poseLayer(s, 'spot', spot, ringR.length + 1, ringP, { mix: 260 });

  // --- compass swings when touched
  const swing = s.input('trigger', 'swing');
  s.triggerLayer('swing', swing, s.anim({ name: 'swing', duration: 150, tracks: [
    { object: roseNeedle, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [14, 0.5, 'cubic', EASE.inOut], [40, -0.3, 'cubic', EASE.inOut], [66, 0.15, 'cubic', EASE.inOut], [96, -0.06, 'cubic', EASE.inOut], [130, 0]] },
  ] }), { fromAny: false });
  const hRose = ids.next();
  s.add(hit(hRose, RX, RY - 6, 70, 80));
  s.listen(hRose, 'enter', [Scene.fire(swing)]);

  k.finish(still, go);
  return s.toXml();
}

// ======================================================================
// Coda: the foot of the last leaf
// ======================================================================

function coda(ids) {
  const W = 680, H = 260;
  const s = new Scene(ids, { name: 'Coda', w: W, h: H, x: 800, y: 0, bg: process.env.MS_BG ? 'FFF6EEDB' : undefined });
  const k = new Kit(s);
  const season = s.input('number', 'season', SEASON0);
  const time = s.input('number', 'time', TIME0);
  const go = s.input('bool', 'go', GO0);
  const still = s.input('bool', 'still', 0);
  const seasonP = [], timeP = [];
  const sp = (object, prop, vals, type) => seasonP.push({ object, prop, vals, type });
  const tp = (object, prop, vals, type) => timeP.push({ object, prop, vals, type });

  const fxBack = k.fx('back', 0, 50);
  const fxSign = k.fx('sign', 6, 56);
  const fxGate = k.fx('gate', 16, 66);

  // hedge behind the sign and gate
  const top = [];
  for (let x = 16; x <= 352; x += 11) top.push(P(x, 152 - Math.abs(Math.sin(x * 0.21)) * 8 + Math.sin(x * 0.017) * 5));
  s.add(k.in({ name: 'hedge in', cx: 180, cy: 190, t0: 0, t1: 46, sc: 0.98 }, [
    wc(ids, [...top, P(356, 176), P(352, 214), P(16, 214), P(12, 172)], HEDGE[1], rng(402), { alpha: 0.46, off: [0, 3], grain: 0.6, key: 'hedge' }),
    k.boil({ name: 'hedge ink', seed: 401, draw: (rr) => ink(top, rr, { w: 1.5, amt: 0.6, n: 30, fx: fxBack }) }),
  ]));
  tintPose(sp, 'hedge', HEDGE);
  const hedgeSnow = ids.next();
  s.add(group({ name: 'hedge snow', id: hedgeSnow, opacity: SEASON0 === 3 ? 1 : 0 }, capOn(top.map((p) => P(p.x, p.y + 1)), 5)));
  sp(hedgeSnow, 'opacity', [0, 0, 0, 1]);

  // the sign board on its stake; the hand-lettered words are HTML laid over it
  const board = [P(30, 40), P(250, 35), P(254, 122), P(34, 127)];
  s.add(k.in({ name: 'sign in', cx: 140, cy: 90, t0: 4, t1: 50 }, [
    wc(ids, [P(136, 124), P(148, 124), P(148, 214), P(136, 214)], 'B89470', rng(404), { alpha: 0.9, off: [1, 0], grain: 0.4, soft: false, blend: 'normal' }),
    wc(ids, board, 'F2E6C8', rng(405), { alpha: 1, off: [2, 2], wobble: 1.4, grain: 0.3, soft: false, blend: 'normal' }),
    stippleShape({ name: 'nails', dots: [{ x: 40, y: 47, r: 1.5 }, { x: 242, y: 43, r: 1.5 }, { x: 42, y: 118, r: 1.5 }, { x: 244, y: 114, r: 1.5 }], color: INK }),
    k.boil({
      name: 'sign ink', seed: 403, draw: (rr) => [
        ink({ pts: board, closed: true }, rr, { w: 1.8, amt: 0.6, fx: fxSign, tension: 0.15 }),
        ink([[P(136, 127), P(137, 212)], [P(148, 126), P(148, 212)]], rr, { w: 1.7, amt: 0.4, fx: fxSign }),
        ink([[P(38, 43), P(246, 39)]], rr, { w: 0.8, amt: 0.6, color: INK_SOFT, fx: fxSign }),
      ],
    }),
  ]));

  // the gate, ajar; posts and a lantern
  const leafId = ids.next();
  const gx0 = 270, gx1 = 334;
  s.add(k.in({ name: 'posts in', cx: 300, cy: 214, t0: 12, t1: 60 }, [
    wc(ids, [P(262, 112), P(270, 112), P(270, 214), P(262, 214)], 'B89470', rng(411), { alpha: 0.9, off: [1, 1], grain: 0.4, soft: false, blend: 'normal' }),
    wc(ids, [P(334, 112), P(342, 112), P(342, 214), P(334, 214)], 'B89470', rng(412), { alpha: 0.9, off: [1, 1], grain: 0.4, soft: false, blend: 'normal' }),
    wc(ids, [P(346, 128), P(355, 128), P(356, 142), P(345, 142)], C.ochre, rng(413), { alpha: 0.5, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
    k.boil({
      name: 'posts ink', seed: 414, draw: (rr) => [
        ink([[P(262, 214), P(262, 112)], [P(270, 214), P(270, 112)], [P(334, 214), P(334, 112)], [P(342, 214), P(342, 112)]], rr, { w: 1.6, amt: 0.4, fx: fxGate }),
        ink([{ pts: circ(266, 109, 6, 4, 10), closed: true }, { pts: circ(338, 109, 6, 4, 10), closed: true }], rr, { w: 1.3, amt: 0.25, fx: fxGate }),
        ink([[P(342, 122), P(350, 122), P(350, 128)], { pts: [P(346, 128), P(355, 128), P(356, 142), P(345, 142)], closed: true }], rr, { w: 1.1, amt: 0.2, fx: fxGate, tension: 0.3 }),
      ],
    }),
    group({ name: 'gate leaf', id: leafId, x: gx0, y: 0, scaleX: 0.72 }, [
      group({ name: 'leaf body', x: -gx0, y: 0 }, [
        wc(ids, [P(gx0 + 2, 136), P(302, 128), P(gx1 - 2, 136), P(gx1 - 2, 204), P(gx0 + 2, 204)], C.door, rng(421), { alpha: 0.32, off: [1, 1], grain: 0.3, soft: false }),
        k.boil({
          name: 'gate ink', seed: 420, draw: (rr) => [
            ink([[P(gx0 + 2, 146), P(gx1 - 2, 145)], [P(gx0 + 2, 196), P(gx1 - 2, 195)], [P(gx0 + 4, 194), P(gx1 - 4, 148)]], rr, { w: 1.5, amt: 0.4, fx: fxGate }),
            ink([280, 292, 304, 316, 326].map((x) => [P(x, 138 - Math.sin((x - gx0) / 64 * Math.PI) * 7), P(x, 206)]), rr, { w: 1.2, amt: 0.3, fx: fxGate }),
          ],
        }),
      ]),
    ]),
  ]));

  // ground and flowers
  const ground = [P(10, 210), P(120, 207), P(240, 212), P(356, 208), P(360, 220), P(240, 224), P(10, 222)];
  s.add(k.in({ name: 'ground in', cx: 180, cy: 214, t0: 0, t1: 40 }, [
    wc(ids, ground, '9CC26A', rng(441), { alpha: 0.38, off: [0, 0], grain: 0.4, key: 'ground' }),
    k.boil({
      name: 'ground ink', seed: 440, draw: (rr) => {
        const list = [];
        for (let x = 16; x < 330; x += rr.range(50, 70)) list.push([P(x, 216), P(x + 18, 216 + rr.jit(1)), P(x + 34, 216 + rr.jit(1))]);
        for (const gx of [60, 200, 238, 352]) list.push([P(gx, 214), P(gx - 4, 205)], [P(gx + 2, 214), P(gx + 2, 203)], [P(gx + 4, 214), P(gx + 8, 206)]);
        return ink(list, rr, { w: 1.3, amt: 0.35, fx: fxBack });
      },
    }),
  ]));
  tintPose(sp, 'ground', ['A6C864', '86B35B', 'B8A455', 'C3CAC2']);
  const flowersId = ids.next();
  const fl = [];
  const stems = [];
  const cols = [C.rose, C.butter, C.violet, C.terra, C.white];
  [[20, 206], [48, 210], [96, 204], [176, 208], [214, 204], [246, 210], [300, 210], [354, 206]].forEach(([x, y], i) => {
    const fr = rng(450 + i);
    fl.push(wc(ids, blobPts(4.4, 4, fr, { n: 7, wobble: 0.2 }).map((p) => P(p.x + x, p.y + y - 11)), cols[i % 5], fr, { alpha: 0.9, off: [0, 0], wobble: 0.3, grain: 0, soft: false }));
    stems.push([P(x, y + 2), P(x + fr.jit(1.2), y - 7)]);
  });
  fl.push(ink(stems, rng(460), { w: 1, amt: 0.3, fx: fxBack }));
  s.add(group({ name: 'flowers', id: flowersId }, [k.in({ name: 'flowers in', cx: 180, cy: 206, t0: 36, t1: 80, sc: 0.85, ease: EASE.back }, fl)]));
  sp(flowersId, 'opacity', [1, 1, 0.4, 0]);

  const snowId = ids.next();
  s.add(group({ name: 'snow', id: snowId, opacity: SEASON0 === 3 ? 1 : 0 }, [
    ...capOn([P(30, 39), P(140, 37), P(250, 34)], 4),
    ...capOn([P(260, 107), P(266, 104), P(272, 107)], 3),
    ...capOn([P(332, 107), P(338, 104), P(344, 107)], 3),
    ...capOn([P(10, 210), P(120, 207), P(240, 212), P(356, 208)], 6),
  ]));
  sp(snowId, 'opacity', [0, 0, 0, 1]);

  const litId = ids.next();
  s.add(group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
    glow({ x: 350, y: 135, w: 74, h: 74, color: C.lamp, alpha: 0.6 }),
    el('Shape', { name: 'flame', x: 350.5, y: 135 }, [el('Ellipse', { width: 5, height: 8, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
  ]));
  tp(litId, 'opacity', LIT);

  // --- something pressed between the pages, by season
  const pressed = [];
  const PX = 476, PY = 200;
  // spring: a primrose
  {
    const petals = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU - Math.PI / 2;
      petals.push(blobPts(6.5, 5, rng(500 + i), { n: 7, wobble: 0.12 }).map((p) => P(PX + Math.cos(a) * 7 + p.x * Math.cos(a) - p.y * Math.sin(a), PY - 4 + Math.sin(a) * 7 + p.x * Math.sin(a) + p.y * Math.cos(a))));
    }
    const id = ids.next();
    pressed.push({ id, xml: group({ name: 'primrose', id, opacity: SEASON0 === 0 ? 1 : 0 }, [
      wc(ids, [P(PX - 30, PY + 26), P(PX - 8, PY + 10), P(PX + 2, PY + 6), P(PX - 6, PY + 14), P(PX - 28, PY + 30)], '8FB070', rng(506), { alpha: 0.55, off: [0, 0], wobble: 0.4, grain: 0.2, soft: false }),
      ...petals.map((pp, i) => wc(ids, pp, 'EBD27A', rng(510 + i), { alpha: 0.75, off: [0, 0], wobble: 0.3, grain: 0.1, soft: false })),
      wc(ids, circ(PX, PY - 4, 2.6, 2.6, 8), 'D98A3A', rng(516), { alpha: 0.9, off: [0, 0], wobble: 0.1, grain: 0, soft: false }),
      ink([[P(PX - 2, PY + 4), P(PX - 20, PY + 24), P(PX - 36, PY + 34)]], rng(517), { w: 0.9, amt: 0.2, color: INK_SOFT }),
    ]) });
  }
  // summer: a clover head and leaf
  {
    const id = ids.next();
    const head = [];
    const hr = rng(520);
    for (let i = 0; i < 26; i++) { const a = hr() * TAU, d = Math.sqrt(hr()) * 8; head.push({ x: PX + Math.cos(a) * d, y: PY - 6 + Math.sin(a) * d * 0.9, r: hr.range(1.2, 2) }); }
    const leaf = (a) => blobPts(6, 4, rng(530 + Math.round(a * 10)), { n: 7, wobble: 0.1 }).map((p) => P(PX - 18 + Math.cos(a) * 6 + p.x * Math.cos(a) - p.y * Math.sin(a), PY + 18 + Math.sin(a) * 6 + p.x * Math.sin(a) + p.y * Math.cos(a)));
    pressed.push({ id, xml: group({ name: 'clover', id, opacity: SEASON0 === 1 ? 1 : 0 }, [
      ...[-1.6, 0.5, 2.6].map((a, i) => wc(ids, leaf(a), '6E9F4E', rng(540 + i), { alpha: 0.6, off: [0, 0], wobble: 0.3, grain: 0.1, soft: false })),
      wc(ids, circ(PX, PY - 6, 9, 8.5, 12), 'D98AAE', rng(545), { alpha: 0.55, off: [0, 0], wobble: 0.4, grain: 0, soft: false }),
      stippleShape({ name: 'florets', dots: head, color: argb('B5527E', 0.5) }),
      ink([[P(PX, PY + 2), P(PX - 8, PY + 22), P(PX - 26, PY + 36)], [P(PX - 12, PY + 24), P(PX - 18, PY + 18)]], rng(546), { w: 0.9, amt: 0.2, color: INK_SOFT }),
    ]) });
  }
  // autumn: an oak leaf
  {
    const id = ids.next();
    const L = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const wv = Math.sin(t * Math.PI) * (9 + 3.5 * Math.abs(Math.sin(t * Math.PI * 4.5)));
      L.push(P(-24 + t * 48, -wv));
    }
    for (let i = 13; i >= 1; i--) {
      const t = i / 14;
      const wv = Math.sin(t * Math.PI) * (9 + 3.5 * Math.abs(Math.sin(t * Math.PI * 4.5 + 0.6)));
      L.push(P(-24 + t * 48, wv));
    }
    const rot = (pts, a) => pts.map((p) => P(PX + p.x * Math.cos(a) - p.y * Math.sin(a), PY + 4 + p.x * Math.sin(a) + p.y * Math.cos(a)));
    const a = -0.5;
    pressed.push({ id, xml: group({ name: 'oak', id, opacity: SEASON0 === 2 ? 1 : 0 }, [
      wc(ids, rot(L, a), 'D0843A', rng(550), { alpha: 0.6, off: [0, 0], wobble: 0.4, grain: 0.4, soft: false }),
      wc(ids, rot(L.map((p) => P(p.x * 0.6 + 6, p.y * 0.5)), a), 'B5443A', rng(551), { alpha: 0.35, off: [0, 0], wobble: 0.4, grain: 0, soft: false }),
      ink([{ pts: rot(L, a), closed: true }, rot([P(-32, 0), P(22, 0)], a), ...[-12, -2, 8].map((x) => rot([P(x, 0), P(x + 6, -7)], a)), ...[-8, 2, 12].map((x) => rot([P(x, 0), P(x + 6, 7)], a))], rng(552), { w: 0.9, amt: 0.2, color: INK_SOFT }),
    ]) });
  }
  // winter: a sprig of holly
  {
    const id = ids.next();
    const holly = (cx, cy, a) => {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(P(-14 + t * 28, -(Math.sin(t * Math.PI) * 6 + (i % 2 ? 2.5 : 0)))); }
      for (let i = 9; i >= 1; i--) { const t = i / 10; pts.push(P(-14 + t * 28, Math.sin(t * Math.PI) * 6 + (i % 2 ? 2.5 : 0))); }
      return pts.map((p) => P(cx + p.x * Math.cos(a) - p.y * Math.sin(a), cy + p.x * Math.sin(a) + p.y * Math.cos(a)));
    };
    const leaves = [holly(PX - 8, PY + 2, -0.7), holly(PX + 12, PY + 4, 0.5)];
    pressed.push({ id, xml: group({ name: 'holly', id, opacity: SEASON0 === 3 ? 1 : 0 }, [
      ...leaves.map((l, i) => wc(ids, l, '4E7A52', rng(560 + i), { alpha: 0.6, off: [0, 0], wobble: 0.3, grain: 0.2, soft: false, tension: 0 })),
      ...[[PX + 2, PY - 6], [PX + 7, PY - 3], [PX + 1, PY]].map(([x, y], i) => wc(ids, circ(x, y, 3.2, 3.2, 8), 'B8352B', rng(565 + i), { alpha: 0.85, off: [0, 0], wobble: 0.1, grain: 0, soft: false })),
      ink([...leaves.map((l) => ({ pts: l, closed: true, tension: 0 })), [P(PX + 2, PY + 2), P(PX - 10, PY + 22)]], rng(568), { w: 0.9, amt: 0.15, color: INK_SOFT }),
    ]) });
  }
  s.add(k.in({ name: 'pressed in', cx: PX, cy: PY, t0: 30, t1: 80, op: 0 }, [group({ name: 'pressed scale', x: PX, y: PY, scaleX: 1.5, scaleY: 1.5, rotation: -0.15 }, [group({ name: 'pressed body', x: -PX, y: -PY }, pressed.map((p) => p.xml))])]));
  pressed.forEach((p, i) => sp(p.id, 'opacity', [0, 1, 2, 3].map((j) => (j === i ? 1 : 0))));

  // --- the inkwell
  const IX = 614, IY = 196;
  const well = [P(IX - 26, IY + 18), P(IX - 28, IY), P(IX - 20, IY - 18), P(IX - 9, IY - 24), P(IX - 9, IY - 32), P(IX + 9, IY - 32), P(IX + 9, IY - 24), P(IX + 20, IY - 18), P(IX + 28, IY), P(IX + 26, IY + 18)];
  const inkLevel = [P(IX - 27, IY + 2), P(IX - 10, IY - 1), P(IX + 10, IY + 1), P(IX + 27, IY - 1), P(IX + 26, IY + 18), P(IX - 26, IY + 18)];
  s.add(k.in({ name: 'well in', cx: IX, cy: IY + 18, t0: 10, t1: 50 }, [
    el('Shape', { name: 'shadow', x: IX + 8, y: IY + 20, blendModeValue: 'multiply' }, [el('Ellipse', { width: 70, height: 9, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('6D6050', 0.18), { feather: 4 })]),
    wc(ids, well, 'A9BDB8', rng(600), { alpha: 0.4, off: [0, 0], wobble: 0.4, grain: 0.2, soft: false }),
    wc(ids, inkLevel, '1F2A38', rng(601), { alpha: 0.8, off: [0, 0], wobble: 0.3, grain: 0.3, soft: false, tension: 0.6 }),
    el('Shape', { name: 'shine', x: IX - 16, y: IY - 8 }, [el('Ellipse', { width: 4, height: 12, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FFFFFF', 0.55))]),
    k.boil({ name: 'well ink', seed: 602, draw: (rr) => ink([{ pts: well, closed: true, tension: 0.5 }, [P(IX - 9, IY - 27), P(IX + 9, IY - 27)]], rr, { w: 1.5, amt: 0.35 }) }),
  ]));

  // --- the flourish under the signature (signature itself is HTML), written by the quill
  const fl0 = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    let x = 420 + t * 196, y = 110 + Math.sin(t * Math.PI) * 4 - t * 6;
    // a small cursive loop two thirds along (a trochoid: the pen circles back)
    const u = (t - 0.6) / 0.16;
    if (u > 0 && u < 1) { x += Math.sin(u * TAU) * 13; y -= (1 - Math.cos(u * TAU)) * 8; }
    fl0.push(P(x, y));
  }
  const flourish = resample(fl0, 60);
  const flTrim = ids.next(), flColor = ids.next(), flGloss = ids.next();
  s.add(el('Shape', { name: 'flourish' }, [
    pathXml(flourish, { tension: 1 }),
    el('Stroke', { thickness: 2, cap: 'round', join: 'round', name: 'Stroke' }, [el('SolidColor', { colorValue: INK, name: 'C', id: flColor }), el('TrimPath', { start: 0, end: GO0 ? 1 : 0, modeValue: 'sequential', id: flTrim, name: 'Trim' })]),
  ]));
  // a wet gleam on the last of the line, which dries away
  s.add(el('Shape', { name: 'gloss', id: flGloss, x: flourish.at(-1).x - 3, y: flourish.at(-1).y - 1, opacity: 0 }, [el('Ellipse', { width: 7, height: 2, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FFFFFF', 0.7))]));

  // --- the quill: nib at the group origin, feather up its local -y axis
  const QL = 116;
  const quillId = ids.next(), liftId = ids.next();
  const vane = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; vane.push(P(-Math.sin(Math.pow(t, 0.7) * Math.PI) * 9 - t * 2, -30 - t * (QL - 30))); }
  for (let i = 11; i >= 1; i--) { const t = i / 12; vane.push(P(Math.sin(Math.pow(t, 0.8) * Math.PI) * 6, -30 - t * (QL - 30))); }
  const barbs = [];
  for (let i = 1; i < 11; i++) { const t = i / 12, y = -30 - t * (QL - 30); barbs.push([P(0, y), P(-Math.sin(Math.pow(t, 0.7) * Math.PI) * 8, y + 6)]); }
  const quillBody = group({ name: 'quill body' }, [
    wc(ids, vane, 'EFE6D2', rng(610), { alpha: 0.95, off: [0, 0], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, vane.map((p) => P(p.x * 0.5 - 2, p.y)), 'B9A88A', rng(611), { alpha: 0.4, off: [0, 0], wobble: 0.3, grain: 0, soft: false }),
    ink([{ pts: vane, closed: true }], rng(612), { w: 1.2, amt: 0.25 }),
    ink(barbs, rng(613), { w: 0.6, amt: 0.15, color: INK_SOFT }),
    ink([[P(0, 0), P(0.4, -14), P(0.6, -36), P(0, -QL + 4)]], rng(614), { w: 1.5, amt: 0.1 }),
    el('Shape', { name: 'nib' }, [polyXml([P(-1.6, -12), P(1.6, -12), P(0.2, 0.5)], { closed: true }), fill(argb('2B2F3A', 0.9))]),
  ]);
  const REST = { x: IX - 2, y: IY - 30, r: -0.24 };
  s.add(group({ name: 'quill', id: quillId, x: GO0 ? REST.x : REST.x, y: REST.y, rotation: REST.r }, [group({ name: 'lift', id: liftId }, [quillBody])]));

  // writing: wait, lift out of the well, travel to the flourish, write it, go back
  const WAIT = 70, TRAVEL = 34, WRITE = 92, BACK = 40;
  const tW0 = WAIT + TRAVEL, tW1 = tW0 + WRITE, tB = tW1 + BACK, END = tB + 30;
  const flLen = plen(flourish);
  const cum = [0];
  for (let i = 1; i < flourish.length; i++) cum.push(cum[i - 1] + Math.hypot(flourish[i].x - flourish[i - 1].x, flourish[i].y - flourish[i - 1].y));
  const at = (u) => {
    const d = u * flLen;
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return P(lerp(flourish[i - 1].x, flourish[i].x, f), lerp(flourish[i - 1].y, flourish[i].y, f));
  };
  const ease = (u) => u * u * (3 - 2 * u);
  const WR = 0.42; // writing angle
  const writeKeys = (prop) => {
    const keys = [[0, REST[prop], 'hold'], [WAIT, REST[prop], 'cubic', EASE.inOut]];
    const start = at(0);
    keys.push([tW0, prop === 'r' ? WR : start[prop], 'linear']);
    for (let f = tW0 + 4; f <= tW1; f += 4) {
      const u = ease((f - tW0) / WRITE);
      const p = at(u);
      keys.push([f, prop === 'r' ? WR + Math.sin(u * TAU * 2) * 0.04 : p[prop], 'linear']);
    }
    keys.at(-1)[2] = 'cubic';
    keys.at(-1)[3] = EASE.inOut;
    keys.push([tB, REST[prop], 'linear'], [END, REST[prop], 'linear']);
    return keys;
  };
  const writeAnim = s.anim({ name: 'write', duration: END, tracks: [
    { object: quillId, prop: 'x', keys: writeKeys('x') },
    { object: quillId, prop: 'y', keys: writeKeys('y').map(([f, v, i, e], j, arr) => [f, v - (f > WAIT && f < tW0 ? Math.sin(((f - WAIT) / TRAVEL) * Math.PI) * 30 : 0), i, e]) },
    { object: quillId, prop: 'rotation', keys: writeKeys('r') },
    { object: flTrim, prop: 'end', keys: [[0, 0, 'hold'], [tW0, 0, 'linear'], ...Array.from({ length: WRITE / 4 }, (_, j) => [tW0 + (j + 1) * 4, ease(((j + 1) * 4) / WRITE), 'linear']), [END, 1, 'linear']] },
    { object: flColor, prop: 'colorValue', type: 'Color', keys: [[0, 'FF151B2C', 'hold'], [tW1, 'FF151B2C', 'linear'], [END, 'FF231F24', 'linear']] },
    { object: flGloss, prop: 'opacity', keys: [[0, 0, 'hold'], [tW1 - 4, 0, 'linear'], [tW1 + 6, 1, 'linear'], [END, 0.6, 'linear']] },
  ] });
  // after writing, the ink dries from blue-black to brown over a few seconds
  const dryAnim = s.anim({ name: 'dry', duration: 360, tracks: [
    { object: flColor, prop: 'colorValue', type: 'Color', keys: [[0, 'FF231F24', 'linear'], [360, INK, 'linear']] },
    { object: flGloss, prop: 'opacity', keys: [[0, 0.6, 'linear'], [300, 0, 'linear'], [360, 0, 'linear']] },
    { object: flTrim, prop: 'end', keys: [[0, 1], [360, 1]] },
  ] });
  const restAnim = s.anim({ name: 'rest', duration: 1, tracks: [
    { object: quillId, prop: 'x', keys: [[0, REST.x]] },
    { object: quillId, prop: 'y', keys: [[0, REST.y]] },
    { object: quillId, prop: 'rotation', keys: [[0, REST.r]] },
    { object: flTrim, prop: 'end', keys: [[0, 1]] },
    { object: flColor, prop: 'colorValue', type: 'Color', keys: [[0, INK]] },
    { object: flGloss, prop: 'opacity', keys: [[0, 0]] },
  ] });
  const waitAnim = s.anim({ name: 'quill wait', duration: 1, tracks: [
    { object: quillId, prop: 'x', keys: [[0, REST.x]] },
    { object: quillId, prop: 'y', keys: [[0, REST.y]] },
    { object: quillId, prop: 'rotation', keys: [[0, REST.r]] },
    { object: flTrim, prop: 'end', keys: [[0, GO0 ? 1 : 0]] },
    { object: flColor, prop: 'colorValue', type: 'Color', keys: [[0, INK]] },
    { object: flGloss, prop: 'opacity', keys: [[0, 0]] },
  ] });
  {
    const w = ids.next(), a = ids.next(), d = ids.next(), b = ids.next();
    const isStill = el('TransitionBoolCondition', { inputId: still, opValue: 'equal' });
    const exit = (to) => el('StateTransition', { stateToId: to, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 });
    s.layers.push(s._layer('write', [
      el('AnyState', { x: 100, y: -120 }),
      el('ExitState', { x: 900, y: -120 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: w })),
      el('AnimationState', { x: 200, y: 0, animationId: waitAnim, id: w }, [
        el('StateTransition', { stateToId: b }, isStill),
        el('StateTransition', { stateToId: a }, el('TransitionBoolCondition', { inputId: go, opValue: 'equal' })),
      ]),
      el('AnimationState', { x: 400, y: 0, animationId: writeAnim, id: a }, [el('StateTransition', { stateToId: b }, isStill), exit(d)]),
      el('AnimationState', { x: 600, y: 0, animationId: dryAnim, id: d }, exit(b)),
      el('AnimationState', { x: 800, y: 0, animationId: restAnim, id: b }),
    ]));
  }

  // --- poses, hover reactions
  poseLayer(s, 'season', season, 4, seasonP);
  poseLayer(s, 'time', time, 5, timeP);

  const dip = s.input('trigger', 'dip');
  s.triggerLayer('dip', dip, s.anim({ name: 'dip', duration: 70, tracks: [
    { object: liftId, prop: 'y', keys: [[0, 0, 'cubic', EASE.out], [14, -12, 'cubic', EASE.inOut], [30, 2, 'cubic', EASE.inOut], [44, -3, 'cubic', EASE.inOut], [62, 0]] },
    { object: liftId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [14, -0.06, 'cubic', EASE.inOut], [30, 0.02, 'cubic', EASE.inOut], [62, 0]] },
  ] }), { fromAny: false });
  const hWell = ids.next();
  s.add(hit(hWell, IX - 6, IY - 40, 90, 140));
  s.listen(hWell, 'enter', [Scene.fire(dip)]);

  const swing = s.input('trigger', 'swing');
  s.triggerLayer('swing', swing, s.anim({ name: 'swing', duration: 150, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 0.72, 'cubic', EASE.out], [30, 0.42, 'cubic', EASE.inOut], [110, 0.42, 'cubic', EASE.inOut], [150, 0.72]] },
  ] }), { fromAny: false });
  const hGate = ids.next();
  s.add(hit(hGate, 302, 162, 90, 110));
  s.listen(hGate, 'enter', [Scene.fire(swing)]);

  k.finish(still, go);
  return s.toXml();
}

export default function () {
  TINT.clear();
  const ids = new Ids(10);
  return document(frontis(ids), mapScene(ids), coda(ids));
}
