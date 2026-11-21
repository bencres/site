// Yule · the Shire's midwinter feast (about Dec 18 – Jan 3), painted over Shire II
// (rive/shire-ii/gen.mjs) by the same hand: same kit, pigments, boil and washes. Only
// winter is painted; every season pose shows it. The hill is piled with snow, the round
// door wears a holly wreath, firelight glows in the windows (candles in them at dusk and
// night), lanterns stand down the path, a fir on the shoulder is hung with ribbons and
// lanterns under a Yule star, a Yule log waits on its sledge, and the post at the gate is
// overflowing with letters and parcels.
//
// Two artboards share one file: Hill (the hero) and Gate (the footer).
//
// Inputs, both artboards: season 0..3 (kept for the page; all show winter),
// time 0..4 (morning, day, late afternoon, dusk, night), still (skip the intro).
// Hill also: regular, bare, and triggers knock, welcome, slam, glint, puff, rustle,
// shake, post, shine, ring-*, plus Yule's own: lamps (the path lanterns light one by
// one), parcel (one more parcel lands on the pile at the gate), heave (a tug at the Yule
// log's sledge). Events: door, chimney, carol (the hedge, where the carollers are
// heard), parcel, heave. Gate: close, mouse, moth, and rattle (the parcels), event rattle.
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, polyXml,
  fill, stroke, stippleShape, document, EASE, thin,
} from '../lib/ink.mjs';

const SEASON0 = +(process.env.SH_SEASON ?? 3);
const TIME0 = +(process.env.SH_TIME ?? 1);
const REGULAR0 = process.env.SH_REGULAR ? 1 : 0;
// The season and time inputs start unset (-1), so the pose layers wait at Entry until the
// page sets them and then go straight to the visitor's pose, rather than starting in the
// default light and cross-fading to it (which would show under the page's still picture).
// A native screenshot can't set inputs, so SH_SEASON / SH_TIME pick the pose there.
const SEASON_IN = process.env.SH_SEASON ? SEASON0 : -1;
const TIME_IN = process.env.SH_TIME ? TIME0 : -1;
const SPEED = 0.9; // intro frame scale (60 fps)
// The always-on loops (drift, breathe, smoke, sway, weather...) step at this rate
// rather than every frame, so the canvas can rest between steps. 15 fps puts the
// line boil (a new cel every 8 frames at 60) on the same ticks: 8/60 s = 2/15 s.
// Intro, reactions and pose cross-fades still run at the full frame rate.
const AMBIENT = 15;
const TICK = 60 / AMBIENT; // one ambient step, in 60 fps frames

const INK = 'FF2B231C'; // iron-gall brown-black
const INK_SOFT = 'FF5E554C';
const C = {
  grass: '7FAE57',
  leaf: '5E9A4A',
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
  shadow: '6D6890',
  // Yule: holly, fir and ribbon mixed from the same box (terra and flag red, door green)
  holly: 'B23A2E',
  berry: 'C8463B',
  fir: '3E6E4A',
  fir2: '5E8F5A',
  candle: 'F4ECD8',
  gold: 'E2B04A',
  kraft: 'C9A57A',
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

// how far a thinned key may stray from its curve: a tenth of a unit, one level of opacity
const EPS = { x: 0.1, y: 0.1, rotation: 0.002, scaleX: 0.002, scaleY: 0.002, opacity: 1 / 255 };

// sample a function of phase into keyframes so loops can be authored as curves,
// then keep only the keys where it bends. Ambient loops sample every TICK, so each
// step they show lands on a key.
function sampled(object, prop, frames, step, fn) {
  const keys = [];
  for (let f = 0; f <= frames; f += step) keys.push([Math.min(f, frames), fn(Math.min(f, frames) / frames), 'linear']);
  if (keys.at(-1)[0] !== frames) keys.push([frames, fn(1), 'linear']);
  return { object, prop, keys: thin(keys, EPS[prop]) };
}

// an always-on loop, stepping at the ambient rate
const ambient = (s, spec) => s.anim({ rate: AMBIENT, ...spec });

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
    s.loopLayer('boil', ambient(s, { name: 'boil', duration: 24, loop: 'loop', tracks: this.boilTracks }));
  }
}

/**
 * Hold-poses picked by a number input. props: [{ object, prop, type, vals: [per state] }].
 * Entry picks the pose matching the input with no mix (so the first frame is
 * right), waiting there while the input is unset; later changes cross-fade. Every
 * pose keys every property.
 */
function poseLayer(s, name, inputId, n, props, { mix = 1600 } = {}) {
  // Yule is winter only: every season pose holds winter's values
  if (name === 'season') props = props.map((p) => ({ ...p, vals: p.vals.map(() => p.vals[3]) }));
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


// the hour's glaze: even over the whole canvas (so nothing in a corner is left in
// daylight), thinning away over the bottom 6% so it never ends in a line. The page
// carries the same colour on out past the other three edges (.hill::before / .gate::before).
function hourGlaze(ids, W, H, k) {
  const stops = [ids.next(), ids.next(), ids.next()];
  const col = (i, c, a) => argb(c, i === 2 ? 0 : a * k);
  const xml = el('Shape', { name: 'hour glaze', blendModeValue: 'multiply' }, [
    // a little past the edges, so the canvas's own edge pixels are fully covered
    el('Rectangle', { x: W / 2, y: H / 2, width: W + 20, height: H + 20, originX: 0.5, originY: 0.5, name: 'r' }),
    el('Fill', { name: 'Fill' }, el('LinearGradient', { startX: 0, startY: 0, endX: 0, endY: H, name: 'G' },
      [0, 0.94, 1].map((pos, i) => el('GradientStop', { colorValue: col(i, ...GLAZE[TIME0]), position: pos, id: stops[i] })))),
  ]);
  const tracks = stops.map((id, i) => ({ object: id, prop: 'colorValue', type: 'Color', vals: GLAZE.map(([c, a]) => col(i, c, a)) }));
  return [xml, tracks];
}

// a pose for the 1-frame bool layer helper
const hold = (s, name, tracks) => s.anim({ name, duration: 1, tracks });

// ---------- palettes ----------

// per time: morning, day, late afternoon, dusk, night
const SKY = [['A9CDEB', 0.4], ['7DB5E0', 0.42], ['9FC0DA', 0.34], ['B49ACB', 0.42], ['34508F', 0.62]];
const HORIZON = [['F2B98A', 0.34], ['E9DCAE', 0.14], ['EDB45A', 0.36], ['E8845A', 0.5], ['5A5E92', 0.3]];
const GLAZE = [['F4CFA8', 0.1], ['F4E3B0', 0], ['E9B356', 0.15], ['A06D9A', 0.24], ['1E2A5E', 0.42]];
const SUN = ['F2C66B', 'EDB940', 'E8993A', 'DB6239', 'DB6239'];
const SUNPOS = [[566, 66, 0.9], [252, 54, 1], [118, 116, 1.06], [74, 236, 1.3], [74, 236, 1.3]];
const SHADOW = [[-1.7, 0.75], [0.55, 0.9], [2.5, 0.85], [3.6, 0.45], [1, 0]];
const LIT = [0, 0, 0, 1, 1];
// per season: spring, summer, autumn, winter
// spring is pale, cool and wet (new leaf, rain on the way); summer is deep and warm,
// with the grass dried gold in patches
const HILL = ['BCD98A', '5E8F3A', 'A8A957', 'A9B5A6'];
const PATCH = [['D6E6B0', 0.22], ['E2B648', 0.42], ['D4863A', 0.32], ['C9CCC6', 0.18]];
const FAR = ['A2BFD0', '7FB0CC', '9DAEC0', 'B1BDCA'];
const FAR2 = ['C2DCA4', '7DA663', 'B2AF7C', 'B5C2BC'];
const CANOPY = ['BEDD92', '477F35', 'D38B3B', '8F8A7A'];
const CANOPY2 = ['EBA8BE', '8EB246', 'C4503B', '8F8A7A'];
const HEDGE = ['A7CF7A', '4C7F38', '8E9A48', '8D9C88'];
const GROUND = ['B2D58A', 'B3AD58', 'B8A455', 'C3CAC2'];
const DROP = ['EBA2B8', '6E9F4E', 'D08A3A', 'C9D6E2'];

// a holly wreath: fir and holly leaves round a ring, red berries, a ribbon bow at its foot
function wreathKids(ids, k, fx, WR, WRR, seed) {
  const wr = rng(seed);
  const leaves = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU + wr.jit(0.12);
    const rr = WRR + (i % 2 ? 2 : -1.6);
    const c = P(WR.x + Math.cos(a) * rr, WR.y + Math.sin(a) * rr);
    // a leaf lying along the ring, tipped a little out
    const rot = a + Math.PI / 2 + wr.jit(0.5);
    const lf = blobPts(4.6, 2.3, wr, { n: 7, wobble: 0.14 }).map((p) => P(c.x + p.x * Math.cos(rot) - p.y * Math.sin(rot), c.y + p.x * Math.sin(rot) + p.y * Math.cos(rot)));
    leaves.push(lf);
  }
  const berries = [0.4, 1.3, 2.2, 3.3, 4.1, 5.2, 5.9].map((a) => ({ x: WR.x + Math.cos(a) * (WRR + 1.2), y: WR.y + Math.sin(a) * (WRR + 1.2), r: 1.35 }));
  const bow = [
    { pts: [P(WR.x, WR.y + WRR + 1), P(WR.x - 6, WR.y + WRR - 3), P(WR.x - 7, WR.y + WRR + 3)], closed: true },
    { pts: [P(WR.x, WR.y + WRR + 1), P(WR.x + 6, WR.y + WRR - 3), P(WR.x + 7, WR.y + WRR + 3)], closed: true },
  ];
  const tails = [[P(WR.x - 0.5, WR.y + WRR + 1.5), P(WR.x - 3, WR.y + WRR + 6), P(WR.x - 4.5, WR.y + WRR + 8)], [P(WR.x + 0.5, WR.y + WRR + 1.5), P(WR.x + 3, WR.y + WRR + 6), P(WR.x + 4.5, WR.y + WRR + 7.5)]];
  return [
    // darker and lighter than the door's own green, so it reads against it
    ...leaves.map((lf, i) => wc(ids, lf, i % 3 === 2 ? '8DB86A' : i % 2 ? '6F9E4E' : '23432C', rng(seed + 1 + i), { alpha: 0.97, off: [0.3, 0.3], wobble: 0.2, grain: 0, soft: false, blend: 'normal' })),
    k.boil({ name: 'wreath ink', seed: seed - 1, draw: (rr) => [
      ink(leaves.map((lf) => ({ pts: lf, closed: true })), rr, { w: 0.7, amt: 0.2, fx }),
      ink(bow, rr, { w: 0.9, amt: 0.15, fx, tension: 0.4 }),
      ink(tails, rr, { w: 1.3, amt: 0.2, color: argb(darken(C.holly, 0.2)), fx }),
    ] }),
    stippleShape({ name: 'berries', dots: berries, color: argb(C.berry, 0.95) }),
    ...bow.map((b, i) => wc(ids, b.pts, C.holly, rng(seed + 30 + i), { alpha: 0.95, off: [0.2, 0.2], wobble: 0.15, grain: 0, soft: false, blend: 'normal', tension: 0.4 })),
  ];
}


// a letter in its envelope, sealed or not, standing at (cx, cy) tipped by rot
function envelopeKids(ids, fx, cx, cy, rot, seed, seal, k = 1) {
  const R = (p) => P(cx + (p.x * Math.cos(rot) - p.y * Math.sin(rot)) * k, cy + (p.x * Math.sin(rot) + p.y * Math.cos(rot)) * k);
  const body = [P(-5.5, -4.5), P(5.5, -4.5), P(5.5, 4.5), P(-5.5, 4.5)].map(R);
  const flap = [P(-5.5, -4.5), P(0, -0.6), P(5.5, -4.5)].map(R);
  return [
    wc(ids, body, 'F2E6C8', rng(seed), { alpha: 1, off: [0.3, 0.3], wobble: 0.2, grain: 0.2, soft: false, blend: 'normal', tension: 0.2 }),
    ink([{ pts: body, closed: true }, flap], rng(seed + 1), { w: 0.9 * Math.sqrt(k), amt: 0.15, fx, tension: 0.2 }),
    seal ? stippleShape({ name: 'seal', dots: [{ ...R(P(0, -0.4)), r: 1.4 * k }], color: argb(C.berry, 0.95) }) : '',
  ];
}

// a parcel in paper, tied with string both ways and finished with a bow
function parcelKids(ids, fx, x0, y0, x1, y1, paper, string, seed) {
  const pr = rng(seed);
  const box = [P(x0, y0), P(x1, y0 + pr.jit(0.6)), P(x1, y1), P(x0, y1)];
  const mx = lerp(x0, x1, 0.5 + pr.jit(0.08)), my = lerp(y0, y1, 0.5);
  const b = Math.min(6, (x1 - x0) * 0.26);
  const bow = [
    { pts: [P(mx, y0), P(mx - b, y0 - b * 0.78), P(mx - b * 1.1, y0 + b * 0.16)], closed: true },
    { pts: [P(mx, y0), P(mx + b, y0 - b * 0.78), P(mx + b * 1.1, y0 + b * 0.16)], closed: true },
  ];
  const sw = Math.max(1.3, (x1 - x0) * 0.06);
  return [
    wc(ids, box, paper, pr, { alpha: 0.92, off: [0.6, 0.6], wobble: 0.3, grain: 0.5, soft: false, blend: 'normal', tension: 0.2 }),
    ink([[P(mx, y0), P(mx, y1)], [P(x0, my), P(x1, my)]], pr.fork(), { w: sw, amt: 0.15, color: argb(string), fx }),
    ink([{ pts: box, closed: true }, ...bow], pr.fork(), { w: 1 + sw * 0.15, amt: 0.2, fx, tension: 0.25 }),
    ...bow.map((bw, i) => wc(ids, bw.pts, string, rng(seed + 5 + i), { alpha: 0.9, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal', tension: 0.4 })),
  ];
}

// ---------- hero: the Hill ----------

function hill(ids) {
  const W = 900, H = 400;
  const s = new Scene(ids, { name: 'Hill', w: W, h: H, x: 0, y: 0, bg: process.env.SH_BG ? 'FFF8F2E4' : undefined });
  const k = new Kit(s);
  const r = rng(1937);
  const season = s.input('number', 'season', SEASON_IN);
  const time = s.input('number', 'time', TIME_IN);
  const still = s.input('bool', 'still', 0);
  const seasonP = [], timeP = [];
  const sp = (object, prop, vals, type) => seasonP.push({ object, prop, vals, type });
  const tp = (object, prop, vals, type) => timeP.push({ object, prop, vals, type });

  // draw-on order
  const fxLand = k.fx('land', 4, 70);
  const fxSky = k.fx('sky', 30, 95);
  const fxDoor = k.fx('door', 26, 92);
  const fxTree = k.fx('tree', 44, 110);
  const fxGarden = k.fx('garden', 58, 124);
  const fxWash = k.fx('washing', 78, 128);
  const fxPost = k.fx('post', 62, 116);
  const PX = 164, PT = 104; // the signpost's centre line and the top of its cap

  // --- sky: a big soft wash, and a warmer band at the horizon
  // kept well inside the canvas: a wash that runs off the edge shows a hard cut there
  const skyPts = blobPts(290, 84, rng(2), { n: 16, wobble: 0.1 }).map((p) => P(p.x + 400, p.y + 128));
  const sky2Pts = blobPts(118, 40, rng(6), { n: 12, wobble: 0.14 }).map((p) => P(p.x + 752, p.y + 62));
  const horPts = blobPts(200, 38, rng(3), { n: 14, wobble: 0.14 }).map((p) => P(p.x + 290, p.y + 236));
  s.add(k.in({ name: 'sky', cx: 420, cy: 140, t0: 0, t1: 60, sc: 0.94 }, [
    wc(ids, skyPts, SKY[1][0], rng(4), { alpha: 0.36, off: [0, 0], grain: 0.12, soft: true, key: 'sky', hazy: true }),
    wc(ids, sky2Pts, SKY[1][0], rng(7), { alpha: 0.36, off: [0, 0], grain: 0.12, soft: true, key: 'sky', hazy: true }),
    wc(ids, horPts, HORIZON[1][0], rng(5), { alpha: 0.34, off: [0, 0], grain: 0.15, soft: true, key: 'horizon', hazy: true }),
  ]));
  for (const t of tintTracks('sky', 'FFFFFF')) tp(t.object, t.prop, SKY.map(([c, a]) => tintColor('sky', t.object, c, a / 0.36)), 'Color');
  for (const t of tintTracks('horizon', 'FFFFFF')) tp(t.object, t.prop, HORIZON.map(([c, a]) => tintColor('horizon', t.object, c, a / 0.34)), 'Color');

  // --- sun: moves with the hour; rays only while it is high
  const sunId = ids.next(), sunPulse = ids.next(), raysId = ids.next(), haloId = ids.next();
  const rays = k.boil({
    name: 'rays', seed: 11, draw: (rr) => {
      const list = [];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + rr.jit(0.07);
        list.push([P(Math.cos(a) * 32, Math.sin(a) * 32), P(Math.cos(a) * 41, Math.sin(a) * 41)]);
      }
      return ink(list, rr, { w: 1.5, amt: 0.5, fx: fxSky });
    },
  });
  const sunInk = k.boil({ name: 'sun ink', seed: 12, draw: (rr) => ink({ pts: blobPts(24, 24, rr, { n: 9, wobble: 0.04 }), closed: true }, rr, { w: 1.8, amt: 0.4, fx: fxSky }) });
  s.add(k.in({ name: 'sun in', cx: 0, cy: 0, t0: 24, t1: 70, sc: 1 }, [
    group({ name: 'sun', id: sunId, x: SUNPOS[TIME0][0], y: SUNPOS[TIME0][1] }, [
      glow({ name: 'halo', id: haloId, x: 0, y: 0, w: 150, h: 150, color: C.lamp, alpha: 0.32 }),
      group({ name: 'pulse', id: sunPulse }, [
        wc(ids, blobPts(26, 25, rng(13), { n: 10, wobble: 0.07 }), SUN[1], rng(14), { alpha: 0.75, off: [3, 2], wobble: 1, grain: 0.5, key: 'sun', soft: false }),
        sunInk,
        group({ name: 'rays', id: raysId }, [rays]),
      ]),
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

  // --- clouds
  const clouds = [
    { x: 118, y: 70, w: 118, h: 32, seed: 21, dx: 18, dur: 1300 },
    { x: 402, y: 50, w: 96, h: 26, seed: 24, dx: -20, dur: 1600 },
    { x: 668, y: 74, w: 86, h: 24, seed: 27, dx: 18, dur: 1450 },
  ];
  const cloudKids = [];
  clouds.forEach((c, i) => {
    const id = ids.next();
    const cr = rng(c.seed);
    const base = cloudPts(c.w, c.h, cr);
    const b = k.boil({ name: `cloud${i} ink`, seed: c.seed + 1, draw: (rr) => ink({ pts: base, closed: true }, rr, { w: 1.6, amt: 0.6, fx: fxSky }) });
    cloudKids.push(group({ name: `cloud${i}`, x: c.x, y: c.y, id }, [wc(ids, base, C.slate, cr, { alpha: 0.24, off: [4, 4], grain: 0.4, soft: false, key: 'cloud' }), b]));
    s.loopLayer(`cloud${i} drift`, ambient(s, { name: `cloud${i} drift`, duration: c.dur, loop: 'pingPong', tracks: [{ object: id, prop: 'x', keys: [[0, c.x, 'cubic', EASE.inOut], [c.dur, c.x + c.dx]] }] }));
  });
  const cloudsId = ids.next();
  s.add(k.in({ name: 'clouds in', t0: 50, t1: 110 }, [group({ name: 'clouds', id: cloudsId }, cloudKids)]));
  tp(cloudsId, 'opacity', [1, 1, 1, 0.85, 0.55]);

  // --- birds: cross the sky every 40 s. The crossing starts and ends off-canvas
  // and holds there, so the loop wraps unseen (no visible return trip).
  const flyDur = 2400;
  const flyers = [
    { y: 122, start: 420, scale: 1, seed: 31 },
    { y: 142, start: 470, scale: 0.72, seed: 37 },
    { y: 112, start: 520, scale: 0.6, seed: 41 },
  ];
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
    birdKids.push(group({ name: `flyer${i}`, x: -40, y: f.y, id, scaleX: f.scale, scaleY: f.scale, opacity: 0 }, [el('Solo', { name: 'flap', id: flapId, activeComponentId: cels[0].cid }, cels.map((c) => c.xml))]));
    s.loopLayer(`flyer${i} flap`, ambient(s, { name: `flap${i}`, duration: 22 + i * 2, loop: 'loop', tracks: [{ object: flapId, prop: 'activeComponentId', type: 'Id', keys: [[0, cels[0].cid, 'hold'], [11 + i, cels[1].cid, 'hold']] }] }));
    const cross = 760;
    const t0 = f.start, t1 = f.start + cross;
    flyTracks.push(
      { object: id, prop: 'x', keys: [[0, -40, 'hold'], [t0, -40, 'linear'], [t1, W + 40, 'hold'], [flyDur, W + 40, 'hold']] },
      { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [t0 - 1, 1, 'hold'], [t1 + 1, 0, 'hold'], [flyDur, 0, 'hold']] },
      sampled(id, 'y', flyDur, TICK, (t) => {
        const ft = Math.max(0, Math.min(1, (t * flyDur - t0) / cross));
        return f.y + Math.sin(ft * 9 + i) * 8 - ft * 34;
      })
    );
  });
  s.add(group({ name: 'birds' }, birdKids));
  s.loopLayer('flyers', ambient(s, { name: 'flyers', duration: flyDur, loop: 'loop', tracks: flyTracks }));

  // --- far hills
  // both ranges run down into the meadow at the left, so the wash ends where it dried, not at a cut
  const farBack = [P(26, 322), P(58, 290), P(112, 260), P(190, 238), P(300, 247), P(400, 270), P(470, 304)];
  const farFront = [P(22, 344), P(50, 316), P(96, 296), P(160, 284), P(250, 296), P(330, 322)];
  const farInk = k.boil({
    name: 'far ink', seed: 51, draw: (rr) => [
      ink(farBack.slice(2, 6), rr, { w: 1.2, amt: 0.6, n: 10, color: 'FF5E6878', fx: fxLand }),
      ink(farFront.slice(2, 6), rr, { w: 1.3, amt: 0.6, n: 10, color: 'FF55606B', fx: fxLand }),
    ],
  });
  s.add(k.in({ name: 'far in', cx: 220, cy: 300, t0: 8, t1: 66 }, [
    wc(ids, [...farBack, P(470, 330), P(140, 336), P(44, 334)], FAR[1], rng(52), { alpha: 0.2, off: [0, 3], grain: 0.3, key: 'far' }),
    wc(ids, [...farFront, P(330, 340), P(120, 350), P(40, 352)], FAR2[1], rng(53), { alpha: 0.3, off: [0, 3], grain: 0.3, key: 'far2' }),
    ...[[96, 290, 7], [118, 287, 5.5], [238, 241, 5]].map(([x, y, R], i) => wc(ids, blobPts(R, R * 0.9, rng(54 + i), { n: 8, wobble: 0.15 }).map((p) => P(p.x + x, p.y + y - R * 1.9)), FAR2[1], rng(57 + i), { alpha: 0.6, off: [1, 1], wobble: 0.5, grain: 0.2, soft: false, key: 'far2' })),
    k.boil({ name: 'far trees', seed: 59, draw: (rr) => ink([[96, 290, 7], [118, 287, 5.5], [238, 241, 5]].flatMap(([x, y, R]) => [[P(x, y), P(x, y - R)], { pts: blobPts(R, R * 0.9, rr, { n: 8, wobble: 0.12 }).map((p) => P(p.x + x, p.y + y - R * 1.9)), closed: true }]), rr, { w: 1, amt: 0.3, color: 'FF55606B', fx: fxLand }) }),
    farInk,
  ]));
  for (const t of tintTracks('far2', 'FFFFFF')) sp(t.object, t.prop, FAR2.map((c) => tintColor('far2', t.object, c, 1)), 'Color');
  for (const t of tintTracks('far', 'FFFFFF')) sp(t.object, t.prop, FAR.map((c) => tintColor('far', t.object, c, 1)), 'Color');

  // --- hedge left of the gate
  const hedgeTop = [];
  for (let x = 138, b = 0; x < 316; b++) {
    const bw = r.range(15, 22);
    for (let j = 0; j < 4; j++) {
      const t = j / 4;
      hedgeTop.push(P(x + t * bw, 346 - Math.sin(t * Math.PI) * r.range(6, 9) + (b % 2) * 2 + r.jit(0.6)));
    }
    x += bw;
  }
  hedgeTop.push(P(316, 348));
  const hedge = [...hedgeTop, P(316, 394), P(140, 394)];
  const hedgeInk = k.boil({ name: 'hedge ink', seed: 55, draw: (rr) => ink(hedgeTop, rr, { w: 1.6, amt: 0.6, n: 26, fx: fxLand }) });
  s.add(k.in({ name: 'hedge in', cx: 228, cy: 380, t0: 40, t1: 96, sc: 0.96 }, [
    wc(ids, hedge, HEDGE[1], rng(56), { alpha: 0.7, off: [2, 3], grain: 0.9, key: 'hedge' }),
    hedgeInk,
  ]));
  for (const t of tintTracks('hedge', 'FFFFFF')) sp(t.object, t.prop, HEDGE.map((c) => tintColor('hedge', t.object, c, 1)), 'Color');

  // --- the signpost at the verge: an old upright with a cap, a tuft at its foot.
  // The arms are HTML (real links) laid over it at PX, from y 122 down.
  const postBody = [P(PX - 5.5, PT + 8), P(PX + 5.5, PT + 8), P(PX + 6, 393), P(PX - 6.2, 393)];
  const postCap = [P(PX - 8, PT + 8), P(PX + 8, PT + 8), P(PX + 4, PT), P(PX - 4, PT)];
  const postInk = k.boil({
    name: 'post ink', seed: 131, draw: (rr) => [
      ink([[postBody[0], postBody[3]], [postBody[1], postBody[2]]], rr, { w: 1.9, amt: 0.45, n: 12, fx: fxPost }),
      ink({ pts: postCap, closed: true }, rr, { w: 1.6, amt: 0.3, fx: fxPost, tension: 0.2 }),
      ink([[P(PX - 1.5, 150), P(PX - 1, 176)], [P(PX + 2, 214), P(PX + 2.4, 232)], [P(PX - 2, 268), P(PX - 1.6, 300)], [P(PX + 1.6, 336), P(PX + 2, 352)]], rr, { w: 0.9, amt: 0.3, color: INK_SOFT, fx: fxPost }),
      ink([[P(PX - 12, 393), P(PX - 16, 384)], [P(PX - 9, 393), P(PX - 9, 382)], [P(PX + 8, 393), P(PX + 9, 381)], [P(PX + 11, 393), P(PX + 16, 385)]], rr, { w: 1.2, amt: 0.3, fx: fxPost }),
    ],
  });
  const postId = ids.next();
  s.add(group({ name: 'signpost', id: postId }, [k.in({ name: 'post in', cx: PX, cy: 393, t0: 58, t1: 112 }, [
    wc(ids, postBody, 'B89470', rng(132), { alpha: 0.9, off: [1, 0], wobble: 0.6, grain: 0.6, soft: false, blend: 'normal' }),
    wc(ids, postCap, '8A6A4A', rng(133), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
    postInk,
  ])]));

  // --- the Hill
  const ridge = [P(300, 374), P(352, 330), P(420, 264), P(500, 210), P(590, 178), P(680, 170), P(770, 182), P(850, 214), P(884, 234)];
  const hillPts = [...ridge, P(894, 256), P(897, 310), P(892, 362), P(884, 394), P(300, 396)];
  const turfTicks = [];
  const ridgeS = resample(ridge, 80);
  for (const t of [0.1, 0.17, 0.26, 0.33, 0.41, 0.52, 0.6, 0.66, 0.79, 0.88, 0.95]) {
    const p = ridgeS[Math.floor(t * 79)];
    const m = 2 + Math.floor(r() * 2);
    for (let j = 0; j < m; j++) {
      const bx = p.x + (j - m / 2) * 3 + r.jit(0.8);
      turfTicks.push([P(bx, p.y + 1), P(bx + (j - (m - 1) / 2) * 2.6 + r.jit(0.8), p.y - 3.5 - r() * 3.5)]);
    }
  }
  const faceTicks = [[P(410, 330), P(424, 326)], [P(468, 300), P(480, 298)], [P(770, 236), P(786, 238)], [P(820, 262), P(836, 266)], [P(452, 262), P(462, 258)], [P(560, 226), P(574, 222)], [P(668, 214), P(684, 214)]];
  const hillInk = k.boil({
    name: 'ridge ink', seed: 61, draw: (rr) => [
      ink(ridge.slice(1), rr, { w: 2, amt: 0.9, n: 24, fx: fxLand, bleed: 0.12 }),
      ink(turfTicks, rr, { w: 1.2, amt: 0.3, fx: fxLand }),
      ink(faceTicks, rr, { w: 1.1, amt: 0.4, color: INK_SOFT, fx: fxLand }),
    ],
  });
  s.add(k.in({ name: 'hill in', cx: 600, cy: 300, t0: 22, t1: 84, sc: 0.97 }, [
    wc(ids, hillPts, HILL[1], rng(62), { alpha: 0.46, off: [0, 4], grain: 0.5, key: 'hill' }),
    wc(ids, [P(470, 250), P(600, 206), P(760, 210), P(860, 248), P(880, 330), P(560, 330)], PATCH[1][0], rng(63), { alpha: 0.2, off: [0, 0], grain: 0.3, key: 'patch', hazy: true }),
    hillInk,
  ]));
  for (const t of tintTracks('hill', 'FFFFFF')) sp(t.object, t.prop, HILL.map((c) => tintColor('hill', t.object, c, 1)), 'Color');
  for (const t of tintTracks('patch', 'FFFFFF')) sp(t.object, t.prop, PATCH.map(([c, a]) => tintColor('patch', t.object, c, a / 0.2)), 'Color');
  for (const t of tintTracks('patch', 'FFFFFF')) sp(t.object, t.prop, PATCH.map(([c, a]) => tintColor('patch', t.object, c, a / 0.2)), 'Color');

  // --- long shadows: anchored at each thing's foot, stretched by the hour
  const shadowIds = [];
  const shadow = (x, y, len, th, seed) => {
    const id = ids.next();
    shadowIds.push(id);
    const sr = rng(seed);
    const pts = [P(0, -th * 0.4), P(len * 0.5, -th * 0.5 + sr.jit(1)), P(len, sr.jit(1)), P(len * 0.5, th * 0.5 + sr.jit(1)), P(0, th * 0.4)];
    return group({ name: 'shadow', id, x, y, scaleX: SHADOW[TIME0][0], opacity: SHADOW[TIME0][1] }, [
      el('Shape', { name: 's', blendModeValue: 'multiply' }, [pathXml(pts, { closed: true }), fill(argb(C.shadow, 0.24), { feather: 2.5 })]),
    ]);
  };
  const shadowsOnHill = [shadow(816, 202, 36, 7, 71), shadow(700, 175, 16, 4, 72)];
  const shadowsLow = [shadow(PX, 393, 34, 5, 79), shadow(318, 394, 30, 5, 73), shadow(356, 394, 26, 5, 74), shadow(394, 394, 22, 4, 75), shadow(516, 346, 40, 6, 76), shadow(752, 340, 18, 4, 77), shadow(872, 330, 18, 4, 78)];
  s.add(k.in({ name: 'hill shadows in', t0: 90, t1: 140 }, shadowsOnHill));
  for (const id of shadowIds) {
    tp(id, 'scaleX', SHADOW.map((v) => v[0]));
    tp(id, 'opacity', SHADOW.map((v) => v[1]));
  }

  // --- a fir on the shoulder of the hill, dressed for Yule: red ribbon swags, little
  // lanterns, a gold star on top, and snow along every bough. Brush it and it shivers a
  // clump of snow off a bough; click it and it shakes off a good deal more
  const tx = 815, tb = 201, FT = 92;
  const ridgeY = (x) => {
    for (let i = 1; i < ridge.length; i++) if (x <= ridge[i].x) return lerp(ridge[i - 1].y, ridge[i].y, (x - ridge[i - 1].x) / (ridge[i].x - ridge[i - 1].x));
    return ridge.at(-1).y;
  };
  // each tier: [bough tips' y, half width, notch y]
  const tiers = [[127, 19, 0], [156, 30, 121], [187, 42, 149]];
  const side = (sx) => {
    const pts = [];
    tiers.forEach(([y, hw, ny], i) => {
      const from = i ? P(tx + sx * hw * 0.36, ny) : P(tx, FT);
      if (i) pts.push(from);
      const tip = P(tx + sx * hw, y);
      pts.push(P(lerp(from.x, tip.x, 0.55), lerp(from.y, tip.y, 0.55) + 2.6));
      pts.push(tip);
    });
    return pts;
  };
  const firPts = [P(tx, FT), ...side(1), P(tx + 22, 190), P(tx - 22, 190), ...side(-1).reverse()];
  const firShade = [P(tx + 1, FT + 4), ...side(1), P(tx + 22, 190), P(tx + 3, 190)];
  const trunk = [[P(tx - 3, tb), P(tx - 3, 189)], [P(tx + 4, tb), P(tx + 4, 189)]];
  const needles = tiers.flatMap(([y, hw, ny]) => [-1, 1].flatMap((sx) => [
    [P(tx + sx * 3, (ny || FT + 6) + 7), P(tx + sx * hw * 0.62, y - 4)],
    [P(tx + sx * 5, (ny || FT + 6) + 15), P(tx + sx * hw * 0.8, y - 1)],
  ]));
  const swag = (x0, y0, x1, y1, sag) => Array.from({ length: 9 }, (_, i) => { const t = i / 8; return P(lerp(x0, x1, t), lerp(y0, y1, t) + Math.sin(t * Math.PI) * sag); });
  const swags = [swag(tx - 10, 113, tx + 12, 118, 4), swag(tx - 20, 139, tx + 22, 146, 5.5), swag(tx - 31, 167, tx + 33, 176, 6.5)];
  const baubles = [[tx - 9, 121], [tx + 12, 125], [tx - 19, 149], [tx + 3, 153], [tx + 24, 153], [tx - 30, 179], [tx - 6, 182], [tx + 20, 183], [tx + 36, 182]];
  const starAt = P(tx, FT - 5);
  const starOutline = starPts(7.5).map((p) => P(p.x + starAt.x, p.y + starAt.y));
  const fir = k.boil({
    name: 'fir ink', seed: 81, draw: (rr) => [
      ink(trunk, rr, { w: 1.8, amt: 0.3, fx: fxTree }),
      ink({ pts: firPts, closed: true }, rr, { w: 1.8, amt: 0.6, fx: fxTree, bleed: 0.1, tension: 0.55 }),
      ink(needles, rr, { w: 0.9, amt: 0.4, color: INK_SOFT, fx: fxTree }),
      ink(baubles.map(([x, y]) => ({ pts: circ(x, y, 2.4, 2.4, 7), closed: true })), rr, { w: 0.9, amt: 0.2, fx: fxTree }),
      ink({ pts: starOutline, closed: true, tension: 0 }, rr, { w: 1.1, amt: 0.2, fx: fxTree }),
    ],
  });
  // the ribbons are painted, then gone over with a red line of their own
  const ribbonInk = k.boil({ name: 'ribbon ink', seed: 82, draw: (rr) => ink(swags, rr, { w: 1.3, amt: 0.3, color: argb(darken(C.holly, 0.25)), fx: fxTree }) });
  // snow along the top of each bough, on both sides
  const snowCap = (pts, th, seed) => {
    const sr = rng(seed);
    const top = pts.map((p) => P(p.x + sr.jit(0.6), p.y - 1 + sr.jit(0.6)));
    const bot = pts.slice().reverse().map((p, i) => P(p.x + sr.jit(0.6), p.y + th * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7))) + sr.jit(0.5)));
    const outline = [...top, ...bot];
    return [
      el('Shape', { name: 'snow shade', x: 0.5, y: 1.4, blendModeValue: 'multiply' }, [pathXml(outline, { closed: true, tension: 0.6 }), fill(argb('9AAFC6', 0.55))]),
      el('Shape', { name: 'snow' }, [pathXml(outline, { closed: true, tension: 0.6 }), fill(argb('FFFDF8', 0.95))]),
    ];
  };
  const firSnowIds = [];
  const firSnow = tiers.map(([y, hw, ny], i) => {
    const id = ids.next();
    firSnowIds.push(id);
    const sides = [-1, 1].flatMap((sx) => {
      const from = i ? P(tx + sx * hw * 0.36, ny) : P(tx + sx * 1.5, FT + 5);
      const tip = P(tx + sx * hw, y);
      const pts = [0.06, 0.4, 0.72, 0.97].map((t) => P(lerp(from.x, tip.x, t), lerp(from.y, tip.y, t) + Math.sin(t * Math.PI) * 2.2 - 0.6));
      return snowCap(sx < 0 ? pts.reverse() : pts, 2.6 + i * 0.5, 820 + i * 2 + (sx > 0 ? 1 : 0));
    });
    return group({ name: `bough snow ${i}`, id }, sides);
  });
  const rustleId = ids.next(), breatheId = ids.next(), rustle2 = ids.next(), breathe2 = ids.next();
  const pivot = P(tx, 190);
  s.add(k.in({ name: 'fir in', cx: tx, cy: tb, t0: 56, t1: 118, sc: 0.88, ease: EASE.back }, [
    wc(ids, [P(tx - 4, 189), P(tx + 5, 189), P(tx + 5, tb), P(tx - 4, tb)], C.wood, rng(85), { alpha: 0.5, off: [1, 1], wobble: 0.4, grain: 0.3, soft: false }),
    group({ name: 'breathe', id: breatheId, x: pivot.x, y: pivot.y }, [
      group({ name: 'rustle', id: rustleId }, [
        group({ name: 'fir body', x: -pivot.x, y: -pivot.y }, [
          wc(ids, firPts, C.fir, rng(86), { alpha: 0.92, off: [-2, 3], grain: 0.8, tension: 0.55 }),
          wc(ids, firShade, darken(C.fir, 0.3), rng(87), { alpha: 0.45, off: [1, 2], grain: 0.3, soft: false, tension: 0.55 }),
          wc(ids, scallop(tx - 12, 168, 14, rng(88), { bumps: 4, squash: 0.6 }), C.fir2, rng(89), { alpha: 0.22, off: [0, 0], grain: 0.2, soft: false }),
          ...swags.map((sw, i) => wc(ids, [...sw, ...sw.slice().reverse().map((p) => P(p.x, p.y + 2.4))], C.holly, rng(830 + i), { alpha: 0.75, off: [0.6, 0.8], wobble: 0.3, grain: 0, soft: false, tension: 0.8 })),
          ...baubles.map(([x, y], i) => wc(ids, circ(x, y, 2.4, 2.4, 7), i % 3 === 1 ? C.berry : C.gold, rng(840 + i), { alpha: 0.95, off: [0.4, 0.4], wobble: 0.2, grain: 0, soft: false, blend: 'normal' })),
          wc(ids, starOutline, C.gold, rng(850), { alpha: 0.95, off: [0.6, 0.6], wobble: 0.3, grain: 0, soft: false, blend: 'normal', tension: 0 }),
          fir,
          ribbonInk,
          ...firSnow,
        ]),
      ]),
    ]),
  ]));
  s.loopLayer('breathe', ambient(s, { name: 'breathe', duration: 330, loop: 'pingPong', tracks: [breatheId, breathe2].flatMap((id) => [
    { object: id, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [330, 1.012]] },
    { object: id, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [330, 1.018]] },
  ]) }));
  // the fir's lanterns are lit above the hour's glaze (with the windows' light, below), in a
  // copy of the fir's sway so they move with it
  const firLit = (litKids) => group({ name: 'fir breathe', id: breathe2, x: pivot.x, y: pivot.y }, [
    group({ name: 'fir rustle', id: rustle2 }, [group({ name: 'fir lit body', x: -pivot.x, y: -pivot.y }, litKids)]),
  ]);

  // a clump of snow drops when the fir is brushed; a shake sends down several
  const dropId = ids.next();
  const clump = (rx, ry, seed) => {
    const pts = blobPts(rx, ry, rng(seed), { n: 8, wobble: 0.18 });
    return [
      el('Shape', { name: 'clump shade', x: 0.5, y: 1.2, blendModeValue: 'multiply' }, [pathXml(pts, { closed: true }), fill(argb('9AAFC6', 0.6))]),
      el('Shape', { name: 'clump' }, [pathXml(pts, { closed: true }), fill(argb('FFFDF8', 0.96))]),
    ];
  };
  const drop0 = P(tx + 27, 152);
  s.add(group({ name: 'drop', x: drop0.x, y: drop0.y, id: dropId, opacity: 0 }, clump(4.2, 2.8, 89)));
  const fall = [
    { x: tx + 27, y: 152, drift: 18, len: 110, delay: 4, r: 4.4 },
    { x: tx - 27, y: 153, drift: -20, len: 110, delay: 9, r: 4 },
    { x: tx + 38, y: 183, drift: 24, len: 90, delay: 15, r: 5 },
    { x: tx - 38, y: 183, drift: -24, len: 90, delay: 21, r: 4.6 },
    { x: tx + 16, y: 124, drift: 12, len: 130, delay: 27, r: 3.6 },
  ].map((f, i) => ({ ...f, id: ids.next(), seed: 300 + i, gy: ridgeY(f.x + f.drift) + 3 }));
  for (const f of fall) s.add(group({ name: 'fall', x: f.x, y: f.y, id: f.id, opacity: 0 }, clump(f.r, f.r * 0.66, f.seed)));

  // --- chimney in the turf, with smoke
  const chim = [P(692, 177), P(692, 152), P(707, 151), P(707, 176)];
  const cap = [P(688, 152), P(688, 146), P(711, 145), P(711, 151)];
  const chimInk = k.boil({ name: 'chimney ink', seed: 91, draw: (rr) => [ink([chim, { pts: cap, closed: true }, [P(693, 162), P(706, 161)]], rr, { w: 1.6, amt: 0.35, fx: fxDoor })] });
  s.add(k.in({ name: 'chimney in', cx: 700, cy: 176, t0: 40, t1: 96, sc: 0.6, ease: EASE.back }, [
    wc(ids, chim, C.brick, rng(92), { alpha: 0.6, off: [1, 1], wobble: 0.8, grain: 0.5 }),
    wc(ids, cap, C.stone, rng(93), { alpha: 0.6, off: [1, 1], wobble: 0.6, grain: 0.3 }),
    chimInk,
  ]));
  // smoke rings, blown when the chimney is clicked; the page picks which
  const rings = {};
  const ringShapes = {
    ring: { pts: circ(0, 0, 7, 5, 14), tension: 1 },
    wobble: { pts: blobPts(7.5, 5.5, rng(95), { n: 9, wobble: 0.34 }), tension: 1 },
    heart: { pts: [P(0, 6), P(-6, 0), P(-6.5, -3.6), P(-3.6, -5.6), P(0, -3), P(3.6, -5.6), P(6.5, -3.6), P(6, 0)], tension: 0.6 },
    // Yule's: every fifth ring a star
    star: { pts: Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * TAU - Math.PI / 2, R = i % 2 ? 3 : 7.5; return P(Math.cos(a) * R, Math.sin(a) * R); }), tension: 0.15 },
  };
  for (const [name, sh] of Object.entries(ringShapes)) {
    const id = ids.next();
    s.add(group({ name: `${name} ring`, id, x: 699, y: 140, opacity: 0 }, [ink({ pts: sh.pts, closed: true, tension: sh.tension }, rng(96), { w: 1.3, amt: 0.25, color: 'FF6E6660' })]));
    const trig = s.input('trigger', `ring-${name}`);
    s.triggerLayer(`ring ${name}`, trig, s.anim({ name: `ring ${name}`, duration: 170, tracks: [
      { object: id, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [12, 0.9, 'linear'], [110, 0.55, 'cubic', EASE.in], [170, 0]] },
      { object: id, prop: 'y', keys: [[0, 142, 'cubic', EASE.out], [170, 62]] },
      { object: id, prop: 'x', keys: [[0, 699, 'cubic', EASE.inOut], [170, 716]] },
      { object: id, prop: 'scaleX', keys: [[0, 0.5, 'cubic', EASE.out], [170, 2.3]] },
      { object: id, prop: 'scaleY', keys: [[0, 0.5, 'cubic', EASE.out], [170, 2.3]] },
      { object: id, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [170, name === 'heart' || name === 'star' ? 0.1 : 0.3]] },
    ] }), { mix: 0 });
    rings[name] = id;
  }
  const hChim = ids.next();
  s.add(hit(hChim, 700, 160, 32, 40));
  s.listen(hChim, 'click', [Scene.emit(s.event('chimney'))]);

  const smokeDur = 420;
  const smokeTracks = [];
  const smokeKids = [];
  for (let i = 0; i < 3; i++) {
    const id = ids.next();
    const curl = k.boil({
      name: `smoke${i}`, seed: 100 + i, draw: (rr) => {
        const pts = [];
        for (let j = 0; j <= 10; j++) {
          const t = j / 10;
          pts.push(P(Math.sin(t * 5.5) * (5 + t * 4), -t * 22));
        }
        return ink(pts, rr, { w: 1.3, amt: 0.5, color: 'FF57504A' });
      },
    });
    smokeKids.push(group({ name: `smoke${i}`, x: 700, y: 140, id, opacity: 0 }, [curl]));
    const ph = i / 3;
    const at = (t) => (t + ph) % 1;
    const op = (u) => (u < 0.04 || u > 0.94 ? 0 : u < 0.18 ? (u - 0.04) / 0.14 : Math.max(0, 1 - (u - 0.18) / 0.76));
    smokeTracks.push(
      sampled(id, 'y', smokeDur, TICK, (t) => 140 - at(t) * 74),
      sampled(id, 'x', smokeDur, TICK, (t) => 700 + at(t) * 30 + Math.sin(at(t) * 6) * 4),
      sampled(id, 'opacity', smokeDur, TICK, (t) => op(at(t))),
      sampled(id, 'scaleX', smokeDur, TICK, (t) => 0.6 + at(t) * 0.8),
      sampled(id, 'scaleY', smokeDur, TICK, (t) => 0.6 + at(t) * 0.8)
    );
  }
  s.add(k.in({ name: 'smoke in', t0: 120, t1: 170 }, smokeKids));
  s.loopLayer('smoke', ambient(s, { name: 'smoke', duration: smokeDur, loop: 'loop', tracks: smokeTracks }));

  // --- the round door
  const D = P(620, 292), DR = 40, RR = 52;
  const stones = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * 0.62 + (i / 13) * Math.PI * 1.76;
    stones.push([P(D.x + Math.cos(a) * (DR + 2), D.y + Math.sin(a) * (DR + 2)), P(D.x + Math.cos(a) * (RR - 1), D.y + Math.sin(a) * (RR - 1))]);
  }
  const step = [P(588, 333), P(652, 333), P(656, 342), P(584, 342)];
  const surroundInk = k.boil({
    name: 'surround ink', seed: 111, draw: (rr) => [
      ink({ pts: circ(D.x, D.y, RR, RR, 22, 0.3), closed: true }, rr, { w: 2, amt: 0.6, fx: fxDoor, bleed: 0.12 }),
      ink(stones, rr, { w: 1.1, amt: 0.4, color: INK_SOFT, fx: fxDoor }),
      ink({ pts: step, closed: true }, rr, { w: 1.5, amt: 0.4, fx: fxDoor }),
    ],
  });
  const planks = [];
  for (const dx of [-26, -13, 13, 26]) {
    const hh = Math.sqrt(DR * DR - dx * dx) - 3;
    planks.push([P(D.x + dx, D.y - hh), P(D.x + dx, D.y + hh)]);
  }
  const leafInk = k.boil({
    name: 'door ink', seed: 112, draw: (rr) => [
      ink({ pts: circ(D.x, D.y, DR, DR, 20, 0.1), closed: true }, rr, { w: 1.9, amt: 0.5, fx: fxDoor }),
      ink(planks, rr, { w: 0.9, amt: 0.4, color: INK_SOFT, fx: fxDoor }),
      ink({ pts: circ(D.x, D.y, 5, 5, 8), closed: true }, rr, { w: 1.4, amt: 0.2, fx: fxDoor }),
    ],
  });
  // a holly wreath hung on the door above the knob: fir and holly leaves round a ring,
  // red berries, and a ribbon bow at its foot. It's on the leaf, so it swings with the door
  const WR = P(D.x, D.y - 20), WRR = 11.5;
  const wreath = () => wreathKids(ids, k, fxDoor, WR, WRR, 118);

  // door leaf hinged at its left edge; knocking swings it open a crack
  const leafId = ids.next(), insideId = ids.next(), spillId = ids.next(), glintId = ids.next();
  s.add(k.in({ name: 'door in', cx: D.x, cy: D.y, t0: 48, t1: 104 }, [
    wc(ids, circ(D.x, D.y, RR + 1, RR + 1, 18), C.stone, rng(113), { alpha: 0.5, off: [2, 2], grain: 0.6 }),
    wc(ids, step, C.stone, rng(114), { alpha: 0.55, off: [1, 1], wobble: 0.8, grain: 0.4, soft: false }),
    group({ name: 'inside', id: insideId, opacity: 0 }, [
      el('Shape', { name: 'room', x: D.x, y: D.y }, [el('Ellipse', { width: DR * 2, height: DR * 2, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('E9A646', 0.9))]),
      glow({ x: D.x + 4, y: D.y + 4, w: 70, h: 70, color: 'FFE7A0', alpha: 0.9 }),
    ]),
    group({ name: 'leaf', id: leafId, x: D.x - DR, y: D.y }, [
      group({ name: 'leaf body', x: -(D.x - DR), y: -D.y }, [
        wc(ids, circ(D.x, D.y, DR - 1, DR - 1, 18), C.door, rng(115), { alpha: 0.9, off: [2, 2], wobble: 1.2, grain: 0.7, blend: 'normal' }),
        wc(ids, circ(D.x, D.y, 5, 5, 8), C.brass, rng(116), { alpha: 0.95, off: [0.8, 0.8], wobble: 0.4, grain: 0, soft: false }),
        leafInk,
        ...wreath(),
        el('Shape', { name: 'glint', id: glintId, x: D.x - 1.6, y: D.y - 1.8, opacity: 0.35 }, [el('Ellipse', { width: 2.6, height: 2.2, originX: 0.5, originY: 0.5, name: 'E' }), fill('FFFFF6DC')]),
      ]),
    ]),
    surroundInk,
  ]));

  // --- round windows, and the lantern by the door
  const wins = [P(528, 286), P(712, 282)];
  const winInk = k.boil({
    name: 'window ink', seed: 121, draw: (rr) => wins.flatMap((w) => [
      ink([{ pts: circ(w.x, w.y, 19, 19, 14), closed: true }, { pts: circ(w.x, w.y, 13.5, 13.5, 12), closed: true }], rr, { w: 1.6, amt: 0.4, fx: fxDoor }),
      ink([[P(w.x, w.y - 13), P(w.x, w.y + 13)], [P(w.x - 13, w.y), P(w.x + 13, w.y)]], rr, { w: 1, amt: 0.25, fx: fxDoor }),
    ]),
  });
  const fireIds = wins.map(() => ids.next());
  s.loopLayer('firelight', ambient(s, { name: 'firelight', duration: 240, loop: 'loop', tracks: fireIds.map((id, i) =>
    sampled(id, 'opacity', 240, TICK, (t) => 0.62 + 0.22 * Math.sin(t * TAU * 3 + i) + 0.14 * Math.sin(t * TAU * 7 + i * 2.3) * Math.sin(t * TAU * 2)),
  ) }));
  const lantern = [P(677, 256), P(687, 256), P(688, 270), P(676, 270)];
  const lanternInk = k.boil({
    name: 'lantern ink', seed: 122, draw: (rr) => ink([[P(668, 248), P(684, 248), P(682, 256)], { pts: lantern, closed: true }, [P(675, 256), P(682, 251), P(689, 256)]], rr, { w: 1.3, amt: 0.3, fx: fxDoor }),
  });
  s.add(k.in({ name: 'windows in', t0: 60, t1: 110 }, [
    ...wins.map((w, i) => wc(ids, circ(w.x, w.y, 19, 19, 14), C.terra, rng(123 + i), { alpha: 0.4, off: [1.5, 1.5], wobble: 0.8, grain: 0.4, soft: false })),
    // the fire's in all day: the panes glow warm, and the light in them flickers
    ...wins.map((w, i) => wc(ids, circ(w.x, w.y, 13.5, 13.5, 12), 'E9A646', rng(125 + i), { alpha: 0.55, off: [1.5, 1], wobble: 0.8, grain: 0.3, soft: false })),
    ...wins.map((w, i) => group({ name: 'firelight', id: fireIds[i] }, [glow({ x: w.x + 2, y: w.y + 6, w: 30, h: 26, color: 'F7B54C', alpha: 0.75 })])),
    wc(ids, lantern, C.ochre, rng(127), { alpha: 0.5, off: [1, 1], wobble: 0.4, grain: 0, soft: false }),
    winInk,
    lanternInk,
  ]));

  // --- the Yule log, hauled down from the wood on a sledge and left in the snow by the
  // door while whoever brought it went in to warm up: a holly sprig and a ribbon tied
  // round it, and the rope trailing off toward the door. Click it for a heave
  const sledgeId = ids.next();
  const LG = { x0: 748, x1: 806, y: 334, r: 7.5 };
  const runner = [P(732, 343), P(736, 349), P(746, 352), P(800, 352), P(816, 351)];
  const deck = [P(740, 343), P(812, 343), P(812, 347), P(740, 347)];
  const logBody = [P(LG.x0, LG.y - LG.r), P(LG.x1, LG.y - LG.r - 1), P(LG.x1, LG.y + LG.r - 1), P(LG.x0, LG.y + LG.r)];
  const logEnd = circ(LG.x1, LG.y - 1, 4.2, LG.r, 12);
  const bark = [[P(756, 329), P(770, 330)], [P(764, 337), P(782, 336)], [P(786, 330), P(798, 329)], [P(752, 339), P(760, 339)]];
  const logRings = [{ pts: circ(LG.x1 + 0.4, LG.y - 1, 2.2, 4, 9), closed: true }, [P(LG.x1 + 0.4, LG.y - 1), P(LG.x1 + 1, LG.y - 1.4)]];
  const rope = [P(733, 344), P(724, 348), P(714, 353), P(704, 354), P(694, 352)];
  const ribbonX = 788;
  const sprigLeaves = [[-5.5, -1.2], [-2, 0.6], [2.5, -0.6], [6, 0.8]].map(([dx, rot], i) =>
    blobPts(4, 1.9, rng(560 + i), { n: 7, wobble: 0.12 }).map((p) => P(ribbonX + dx + p.x * Math.cos(rot) - p.y * Math.sin(rot), LG.y - LG.r - 4 + p.x * Math.sin(rot) + p.y * Math.cos(rot))));
  const sledgeInk = k.boil({
    name: 'sledge ink', seed: 551, draw: (rr) => [
      ink([runner, [P(748, 347), P(746, 352)], [P(800, 347), P(800, 352)], { pts: deck, closed: true, tension: 0.2 }], rr, { w: 1.5, amt: 0.3, fx: fxWash, tension: 0.6 }),
      ink([{ pts: [logBody[0], logBody[1]] }, { pts: [logBody[3], logBody[2]] }, { pts: logEnd, closed: true }, [P(LG.x0, LG.y - LG.r), P(LG.x0 - 2.5, LG.y), P(LG.x0, LG.y + LG.r)]], rr, { w: 1.6, amt: 0.35, fx: fxWash }),
      ink([...bark, ...logRings], rr, { w: 0.9, amt: 0.3, color: INK_SOFT, fx: fxWash }),
      ink(rope, rr, { w: 1.1, amt: 0.3, color: 'FF6E5A44', fx: fxWash }),
      ink([[P(ribbonX - 1.5, LG.y - LG.r), P(ribbonX - 1, LG.y + LG.r)], [P(ribbonX + 2.5, LG.y - LG.r), P(ribbonX + 3, LG.y + LG.r)]], rr, { w: 0.9, amt: 0.2, color: argb(darken(C.holly, 0.25)), fx: fxWash }),
      ink(sprigLeaves.filter((_, i) => i % 2 === 0).map((pts) => ({ pts, closed: true })), rr, { w: 0.8, amt: 0.15, fx: fxWash }),
    ],
  });
  s.add(group({ name: 'sledge', id: sledgeId }, [k.in({ name: 'yule log in', cx: 772, cy: 352, t0: 96, t1: 146, dy: -10 }, [
    wc(ids, deck, C.wood, rng(552), { alpha: 0.6, off: [1, 1], wobble: 0.4, grain: 0.3, soft: false }),
    wc(ids, logBody, '8A6A4C', rng(553), { alpha: 0.75, off: [1.5, 1.2], wobble: 0.6, grain: 0.7, soft: false }),
    wc(ids, logEnd, 'E2C99A', rng(554), { alpha: 0.95, off: [0.5, 0.5], wobble: 0.3, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, [P(ribbonX - 1.5, LG.y - LG.r), P(ribbonX + 2.5, LG.y - LG.r), P(ribbonX + 3, LG.y + LG.r), P(ribbonX - 1, LG.y + LG.r)], C.holly, rng(555), { alpha: 0.85, off: [0.3, 0.3], wobble: 0.2, grain: 0, soft: false }),
    sledgeInk,
    ...sprigLeaves.map((pts, i) => wc(ids, pts, i % 2 ? C.fir2 : C.fir, rng(565 + i), { alpha: 0.95, off: [0.2, 0.2], wobble: 0.15, grain: 0, soft: false, blend: 'normal' })),
    stippleShape({ name: 'berries', dots: [{ x: ribbonX - 1, y: LG.y - LG.r - 5.5, r: 1.3 }, { x: ribbonX + 1.6, y: LG.y - LG.r - 6, r: 1.3 }, { x: ribbonX + 0.4, y: LG.y - LG.r - 3.6, r: 1.2 }], color: argb(C.berry, 0.95) }),
  ])]));

  // --- bench, with a pipe left smoking on it
  const bench = [
    [P(478, 330), P(560, 328)], [P(480, 334), P(558, 332)],
    [P(482, 306), P(556, 304)], [P(482, 314), P(556, 312)],
    [P(484, 300), P(485, 347)], [P(554, 298), P(554, 346)],
    [P(476, 322), P(484, 322), P(484, 330)], [P(554, 320), P(562, 320), P(562, 329)],
  ];
  const benchInk = k.boil({ name: 'bench ink', seed: 141, draw: (rr) => ink(bench, rr, { w: 1.7, amt: 0.35, fx: fxGarden }) });
  const pipeInk = k.boil({ name: 'pipe ink', seed: 142, draw: (rr) => ink([[P(528, 326), P(536, 327), P(542, 326)], { pts: [P(542, 320), P(549, 320), P(548, 327), P(543, 327)], closed: true }], rr, { w: 1.3, amt: 0.2, fx: fxGarden, tension: 0.4 }) });
  const pipeSmoke = ids.next(), ringId = ids.next();
  const pipeCurl = k.boil({
    name: 'pipe curl', seed: 143, draw: (rr) => {
      const pts = [];
      for (let j = 0; j <= 9; j++) { const t = j / 9; pts.push(P(Math.sin(t * 6) * (2 + t * 3), -t * 18)); }
      return ink(pts, rr, { w: 1, amt: 0.3, color: 'FF6A625A' });
    },
  });
  s.add(k.in({ name: 'bench in', cx: 518, cy: 346, t0: 84, t1: 132, op: 0 }, [
    wc(ids, [P(482, 302), P(556, 300), P(556, 316), P(482, 318)], C.wood, rng(144), { alpha: 0.45, off: [1, 1], grain: 0.4, soft: false }),
    wc(ids, [P(478, 328), P(560, 326), P(560, 334), P(478, 336)], C.wood, rng(145), { alpha: 0.5, off: [1, 1], grain: 0.3, soft: false }),
    benchInk,
    pipeInk,
    group({ name: 'pipe smoke', id: pipeSmoke, x: 546, y: 318, opacity: 0 }, [pipeCurl]),
    el('Shape', { name: 'ring', id: ringId, x: 546, y: 316, opacity: 0 }, [el('Ellipse', { width: 9, height: 5, originX: 0.5, originY: 0.5, name: 'E' }), stroke('FF6A625A', 1.1)]),
  ]));
  s.loopLayer('pipe', ambient(s, { name: 'pipe', duration: 300, loop: 'loop', tracks: [
    sampled(pipeSmoke, 'y', 300, TICK, (t) => 318 - t * 26),
    sampled(pipeSmoke, 'opacity', 300, TICK, (t) => (t < 0.05 || t > 0.95 ? 0 : t < 0.25 ? (t - 0.05) * 3.5 : Math.max(0, 0.7 * (1 - (t - 0.25) / 0.7)))),
    sampled(pipeSmoke, 'scaleX', 300, TICK, (t) => 0.7 + t * 0.6),
    sampled(pipeSmoke, 'scaleY', 300, TICK, (t) => 0.7 + t * 0.6),
  ] }));

  // --- garden path from the step down to the gate
  const pathL = [P(592, 343), P(560, 352), P(500, 360), P(430, 372), P(372, 384), P(334, 396)];
  const pathR = [P(648, 343), P(626, 358), P(560, 370), P(480, 382), P(410, 392), P(380, 398)];
  const pathInk = k.boil({
    name: 'path ink', seed: 151, draw: (rr) => {
      const cut = (pts) => resample(pts, 14).reduce((acc, p, i, a) => (i % 3 === 0 && a[i + 1] ? [...acc, [p, a[i + 1], a[i + 2] || a[i + 1]]] : acc), []);
      return ink([...cut(pathL), ...cut(pathR)], rr, { w: 1.3, amt: 0.4, fx: fxGarden });
    },
  });
  s.add(k.in({ name: 'path in', cx: 490, cy: 372, t0: 70, t1: 124 }, [
    wc(ids, [...pathL, ...pathR.slice().reverse()], 'F0E2C0', rng(152), { alpha: 0.95, off: [0, 0], grain: 0.6, blend: 'normal' }),
    pathInk,
  ]));

  // --- gate and mailbox
  const gateInk = k.boil({
    name: 'gate ink', seed: 191, draw: (rr) => [
      ink([[P(316, 396), P(316, 350)], [P(358, 396), P(358, 348)]], rr, { w: 2, amt: 0.4, fx: fxGarden }),
      ink([[P(318, 362), P(356, 360)], [P(318, 384), P(356, 382)], [P(328, 362), P(328, 384)], [P(337, 361), P(337, 383)], [P(346, 361), P(346, 383)], [P(320, 383), P(354, 362)]], rr, { w: 1.3, amt: 0.3, fx: fxGarden }),
    ],
  });
  const flagId = ids.next();
  const box = [P(382, 352), P(381, 340), P(386, 334), P(402, 334), P(407, 340), P(406, 352)];
  const mailInk = k.boil({ name: 'mail ink', seed: 193, draw: (rr) => [ink([[P(394, 397), P(394, 352)], { pts: box, closed: true }], rr, { w: 1.6, amt: 0.3, fx: fxGarden, tension: 0.5 })] });
  const flagInk = ink([[P(0, 0), P(12, 0)], { pts: [P(7, -1), P(12, -1), P(12, -6), P(7, -6)], closed: true }], rng(194), { w: 1.1, amt: 0.15, fx: fxGarden });
  s.add(k.in({ name: 'gate in', cx: 360, cy: 396, t0: 76, t1: 130 }, [
    wc(ids, [P(318, 360), P(356, 358), P(356, 384), P(318, 386)], C.door, rng(195), { alpha: 0.32, off: [1, 1], grain: 0.4, soft: false }),
    wc(ids, box, C.terra, rng(196), { alpha: 0.6, off: [1, 1], wobble: 0.6, grain: 0.4, soft: false }),
    gateInk,
    mailInk,
    group({ name: 'flag', id: flagId, x: 406, y: 348, rotation: 0 }, [wc(ids, [P(7, -1), P(12, -1), P(12, -6), P(7, -6)], 'C8463B', rng(197), { alpha: 0.9, off: [0, 0], wobble: 0.2, grain: 0, soft: false }), flagInk]),
  ]));

  // --- Yule post: the box is too full to shut, letters stand up out of its lid, and the
  // parcels that wouldn't go in are piled at the foot of its post. Brush it and the flag
  // goes up and the letters stir; click it and one more parcel comes down on the pile
  const lettersId = ids.next();
  const parcelDropId = ids.next();
  const PD = { x0: 403, x1: 415, y0: 361, y1: 371 };
  s.add(k.in({ name: 'post in', cx: 400, cy: 396, t0: 104, t1: 150, op: 0 }, [
    group({ name: 'letters', id: lettersId, x: 394, y: 336 }, [group({ name: 'letters body', x: -394, y: -336 }, [
      ...envelopeKids(ids, fxGarden, 387.5, 329, -0.34, 900, false),
      ...envelopeKids(ids, fxGarden, 401, 330, 0.4, 903, false),
      ...envelopeKids(ids, fxGarden, 394, 327, 0.06, 906, true),
    ])]),
    ...parcelKids(ids, fxGarden, 376, 386, 390, 396, C.fir2, C.holly, 910),
    ...parcelKids(ids, fxGarden, 399, 382, 422, 396, C.kraft, C.holly, 920),
    ...parcelKids(ids, fxGarden, 402, 371, 416, 382, C.holly, C.gold, 930),
  ]));
  // the one that comes with a click: it falls on the pile with a bump and stays
  s.add(group({ name: 'new parcel', id: parcelDropId, x: 0, y: -70, opacity: 0 }, parcelKids(ids, fxGarden, PD.x0, PD.y0, PD.x1, PD.y1, 'E7D7B0', C.berry, 940)));
  // a red bow on the gate's top rail
  const gateBow = [
    { pts: [P(337, 361), P(331, 357), P(331, 364)], closed: true },
    { pts: [P(337, 361), P(343, 357), P(343, 364)], closed: true },
  ];
  s.add(k.in({ name: 'gate bow in', cx: 337, cy: 361, t0: 120, t1: 160, sc: 0.3, ease: EASE.back }, [
    ...gateBow.map((b, i) => wc(ids, b.pts, C.holly, rng(950 + i), { alpha: 0.95, off: [0.2, 0.2], wobble: 0.2, grain: 0, soft: false, blend: 'normal', tension: 0.4 })),
    ink([...gateBow, [P(336.5, 362), P(334, 369)], [P(337.5, 362), P(340.5, 368)]], rng(953), { w: 1, amt: 0.15, tension: 0.4 }),
  ]));

  // --- lanterns on short stakes down the path, from the gate up to the step. They're lit at
  // dusk and night (as the painting draws in, one by one from the gate up); by day, brush the
  // path and they're lit for you, one by one
  const lamps = [[456, 390], [528, 380], [600, 368], [668, 354]];
  const lampTop = (x, b) => ({ box: [P(x - 3.4, b - 26), P(x + 3.4, b - 26), P(x + 3.8, b - 17), P(x - 3.8, b - 17)], roof: [P(x - 5, b - 26), P(x, b - 31), P(x + 5, b - 26)], flame: P(x, b - 21.5) });
  const lampInk = k.boil({
    name: 'path lantern ink', seed: 960, draw: (rr) => lamps.map(([x, b]) => {
      const L = lampTop(x, b);
      return ink([[P(x, b), P(x + rr.jit(0.4), b - 17)], { pts: L.box, closed: true }, L.roof, { pts: circ(x, b - 32.5, 1.4, 1.4, 6), closed: true }], rr, { w: 1.2, amt: 0.25, fx: fxGarden, tension: 0.2 });
    }),
  });
  s.add(k.in({ name: 'path lanterns in', cx: 560, cy: 380, t0: 86, t1: 136 }, [
    ...lamps.map(([x, b], i) => wc(ids, lampTop(x, b).box, C.ochre, rng(965 + i), { alpha: 0.55, off: [0.6, 0.6], wobble: 0.3, grain: 0, soft: false })),
    ...lamps.map(([x, b], i) => wc(ids, lampTop(x, b).roof.concat([P(x, b - 27)]), '6E5A44', rng(970 + i), { alpha: 0.6, off: [0.3, 0.3], wobble: 0.2, grain: 0, soft: false })),
    lampInk,
  ]));
  // their light: one set kept by the hour, one lit by hand (both added above the glaze)
  const lampLight = (x, b, a) => [
    glow({ x, y: b - 21, w: 44, h: 44, color: C.lamp, alpha: 0.55 * a }),
    glow({ x: x + 4, y: b + 2, w: 46, h: 11, color: C.lamp, alpha: 0.3 * a }),
    el('Shape', { name: 'flame', x, y: b - 21.5 }, [el('Ellipse', { width: 3.2, height: 5, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
  ];
  const handLitIds = lamps.map(() => ids.next());

  // --- doormat for regulars
  const matId = ids.next();
  const mat = [P(600, 337), P(640, 337), P(642, 343), P(598, 343)];
  s.add(group({ name: 'doormat', id: matId, opacity: REGULAR0 }, [
    wc(ids, mat, C.ochre, rng(198), { alpha: 0.75, off: [0.5, 0.5], wobble: 0.4, grain: 0.6, soft: false }),
    ink([{ pts: mat, closed: true }, [P(606, 340), P(634, 340)]], rng(199), { w: 1.1, amt: 0.2, tension: 0.3 }),
  ]));
  const regular = s.input('bool', 'regular', REGULAR0);
  s.boolLayer('regular', regular, hold(s, 'no mat', [{ object: matId, prop: 'opacity', keys: [[0, 0]] }]), hold(s, 'mat', [{ object: matId, prop: 'opacity', keys: [[0, 1]] }]), { mixIn: 600, mixOut: 300 });

  // --- foreground
  const groundPts = [P(30, 389), P(200, 380), P(420, 388), P(640, 380), P(870, 386), P(884, 392), P(620, 398), P(380, 396), P(140, 398), P(36, 396)];
  const dashSpec = [];
  for (let x = 24; x < 880;) {
    const len = r.range(16, 56);
    if ((x + len < 330 || x > 400) && (x + len < 704 || x > 874) && x + len < 876) dashSpec.push({ x, y: r.range(390, 395), len });
    x += len + r.range(14, 40);
  }
  const groundInk = k.boil({
    name: 'ground ink', seed: 201, draw: (rr) => {
      const list = dashSpec.map((d) => [P(d.x, d.y), P(d.x + d.len / 2, d.y + rr.jit(1.1)), P(d.x + d.len, d.y + rr.jit(1.4))]);
      for (const gx of [60, 120, 432, 520, 690]) {
        list.push([P(gx, 388), P(gx - 4, 380)], [P(gx + 2, 388), P(gx + 2, 378)], [P(gx + 4, 388), P(gx + 8, 381)]);
      }
      return ink(list, rr, { w: 1.6, amt: 0.4, fx: fxLand });
    },
  });
  s.add(k.in({ name: 'ground in', cx: 450, cy: 392, t0: 10, t1: 66 }, [
    wc(ids, groundPts, GROUND[1], rng(202), { alpha: 0.42, off: [0, 0], grain: 0.6, key: 'ground' }),
    wc(ids, [P(30, 388), P(20, 370), P(30, 350), P(58, 336), P(100, 334), P(146, 342), P(152, 366), P(150, 390), P(80, 394)], GROUND[1], rng(203), { alpha: 0.3, off: [0, 0], grain: 0.5, key: 'ground' }),
    groundInk,
  ]));
  for (const t of tintTracks('ground', 'FFFFFF')) sp(t.object, t.prop, GROUND.map((c) => tintColor('ground', t.object, c, 1)), 'Color');

  // --- the kitchen garden under snow: a raised bed and the bare wigwam of bean canes
  const G = { x0: 712, x1: 866, top: 366, bot: 384 };
  const bedTop = [P(G.x0, G.top + 1), P(760, G.top - 1), P(812, G.top + 1), P(G.x1, G.top)];
  const bed = [...bedTop, P(G.x1 + 1, G.bot), P(G.x0 - 1, G.bot + 1)];
  const canes = [[836, G.top], [847, G.top + 1], [858, G.top]];
  const apex = P(847, 314);
  const gardenInk = k.boil({
    name: 'garden ink', seed: 611, draw: (rr) => ink([
      { pts: bed, closed: true, tension: 0.3 },
      [P(G.x0 + 2, G.top + 9), P(790, G.top + 10), P(G.x1 - 2, G.top + 9)],
      ...canes.map(([x, y]) => [P(x, y), P(apex.x + rr.jit(0.6), apex.y - 4)]),
      [P(apex.x - 4, apex.y + 4), P(apex.x + 4, apex.y + 5)],
    ], rr, { w: 1.2, amt: 0.35, fx: fxGarden }),
  });
  s.add(k.in({ name: 'garden in', cx: 790, cy: G.bot, t0: 74, t1: 132, sc: 0.94 }, [
    wc(ids, bed, '8A6A4C', rng(612), { alpha: 0.5, off: [1.5, 1.5], wobble: 0.8, grain: 0.6, soft: false }),
    wc(ids, [P(G.x0 + 2, G.top + 9), P(G.x1 - 2, G.top + 9), P(G.x1, G.bot - 1), P(G.x0, G.bot)], C.wood, rng(613), { alpha: 0.45, off: [1, 1], wobble: 0.6, grain: 0.3, soft: false }),
    gardenInk,
    wc(ids, [P(G.x0 + 2, G.top + 2), P(760, G.top - 3), P(812, G.top - 1), P(G.x1 - 2, G.top + 1), P(G.x1 - 4, G.top + 5), P(G.x0 + 4, G.top + 6)], 'FBFBF8', rng(714), { alpha: 0.95, off: [0, 0], wobble: 0.5, grain: 0, soft: false, blend: 'normal' }),
  ]));
  s.add(k.in({ name: 'low shadows in', t0: 110, t1: 150 }, shadowsLow));

  // --- a dusting of snow: white gouache caps over a blue-grey shadow
  const snowId = ids.next();
  const cap1 = (pts, th, seed) => {
    const sr = rng(seed);
    const top = pts.map((p) => P(p.x + sr.jit(0.8), p.y - 1 + sr.jit(0.8)));
    const bot = pts.slice().reverse().map((p, i) => P(p.x + sr.jit(0.8), p.y + th * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7))) + sr.jit(0.6)));
    const outline = [...top, ...bot];
    return [
      el('Shape', { name: 'snow shade', x: 0.5, y: 1.6, blendModeValue: 'multiply' }, [pathXml(outline, { closed: true, tension: 0.6 }), fill(argb('9AAFC6', 0.55))]),
      el('Shape', { name: 'snow' }, [pathXml(outline, { closed: true, tension: 0.6 }), fill(argb('FFFDF8', 0.95))]),
    ];
  };
  // Yule's snow lies deeper: piled on the hill and the hedge, and on everything left out
  const arcTop = (cx, cy, R, a0 = -2.7, a1 = -0.45, n = 6) => Array.from({ length: n }, (_, i) => { const a = lerp(a0, a1, i / (n - 1)); return P(cx + Math.cos(a) * R, cy + Math.sin(a) * R); });
  const snowKids = [
    ...cap1(resample(ridge.slice(1), 34), 9, 211),
    ...cap1(hedgeTop, 7, 212),
    ...cap1([P(687, 145), P(700, 144), P(712, 145)], 4, 213),
    ...cap1([P(478, 313), P(519, 312), P(560, 311)], 3.5, 214),
    ...cap1([P(380, 340), P(388, 333), P(400, 333), P(408, 340)], 3.5, 215),
    ...cap1([P(570, 246), P(598, 238), P(620, 236), P(642, 238), P(670, 246)], 5, 216),
    ...cap1([P(PX - 8, PT + 7), P(PX - 4, PT - 1), P(PX + 4, PT - 1), P(PX + 8, PT + 7)], 3.5, 221),
    ...cap1([P(10, 386), P(200, 380), P(330, 386)], 7, 217),
    ...cap1([P(420, 388), P(640, 380), P(890, 386)], 7, 218),
    ...wins.flatMap((w, i) => cap1(arcTop(w.x, w.y, 19.6), 2.6, 222 + i)),
    ...cap1([P(667, 248), P(676, 247.5), P(685, 248)], 2, 224),
    ...lamps.flatMap(([x, b], i) => cap1([P(x - 5.4, b - 26), P(x, b - 31.2), P(x + 5.4, b - 26)], 1.8, 225 + i)),
    ...cap1([P(749, 326.5), P(777, 325.8), P(805, 325)], 3.2, 230),
    ...cap1([P(402, 371), P(409, 370.5), P(416, 371)], 2.2, 231),
    ...cap1([P(376, 386), P(383, 385.6), P(390, 386)], 2, 232),
    ...cap1([P(318, 361.5), P(337, 360.5), P(356, 359.5)], 2.4, 233),
    ...cap1([P(313, 350), P(316, 348.6), P(319, 350)], 2.4, 234),
    ...cap1([P(355, 348), P(358, 346.6), P(361, 348)], 2.4, 235),
  ];
  s.add(group({ name: 'snow', id: snowId, opacity: SEASON0 === 3 ? 1 : 0 }, [k.in({ name: 'snow in', t0: 96, t1: 150 }, snowKids)]));
  sp(snowId, 'opacity', [0, 0, 0, 1]);

  // --- snow falling: two sheets of flakes sliding down, half a cycle apart
  const flakesId = ids.next();
  const sheets = [];
  const snowTracks = [];
  const sDur = 900;
  for (let j = 0; j < 2; j++) {
    const id = ids.next();
    const fr = rng(250 + j);
    const dots = [];
    for (let i = 0; i < 30; i++) dots.push({ x: fr.range(10, 890), y: fr.range(-60, 330), r: fr.range(0.9, 1.9) });
    sheets.push(group({ name: `flakes${j}`, id, y: 0, opacity: 0 }, [stippleShape({ dots, color: argb('8EA3BC', 0.75) })]));
    const ph = j / 2;
    const at = (t) => (t + ph) % 1;
    snowTracks.push(
      sampled(id, 'y', sDur, TICK, (t) => at(t) * 90),
      sampled(id, 'x', sDur, TICK, (t) => Math.sin(at(t) * TAU) * 8),
      sampled(id, 'opacity', sDur, TICK, (t) => { const u = at(t); return u < 0.03 || u > 0.97 ? 0 : Math.min(1, (u - 0.03) / 0.25, (0.97 - u) / 0.25); })
    );
  }
  s.add(group({ name: 'flakes', id: flakesId }, sheets));
  s.loopLayer('snowfall', ambient(s, { name: 'snowfall', duration: sDur, loop: 'loop', tracks: snowTracks }));

  // --- the light of the hour: one even glaze over the whole painting, edge to edge, so
  // nothing in a corner is left in daylight; the page carries the same colour on out
  // past the canvas and lets it fade (.hill::before in style.css)
  const [glazeXml, glazeTracks] = hourGlaze(ids, W, H, 1);
  // it's there from the first frame: the page fades the whole canvas in on the same clock as
  // the halo around it (style.css), so the two can never be at different strengths and
  // show the canvas's edge as a box
  s.add(glazeXml);
  for (const t of glazeTracks) tp(t.object, t.prop, t.vals, t.type);

  // --- lamplight, moon and stars sit above the glaze
  const litId = ids.next();
  const candleIds = wins.map(() => ids.next());
  s.add(k.in({ name: 'lit in', t0: 96, t1: 150 }, [
    group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
      ...wins.map((w) => glow({ x: w.x, y: w.y + 4, w: 100, h: 86, color: C.lamp, alpha: 0.42 })),
      ...wins.map((w, i) => el('Shape', { name: 'pane', x: w.x, y: w.y }, [el('Ellipse', { width: 26, height: 26, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('F7CB5C', 0.88))])),
      ...wins.map((w, i) => ink([[P(w.x, w.y - 13), P(w.x, w.y + 13)], [P(w.x - 13, w.y), P(w.x + 13, w.y)]], rng(270 + i), { w: 1.1, amt: 0.2 })),
      glow({ x: 682, y: 264, w: 70, h: 70, color: C.lamp, alpha: 0.6 }),
      el('Shape', { name: 'flame', x: 682, y: 264 }, [el('Ellipse', { width: 6, height: 9, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
      glow({ x: 560, y: 368, w: 200, h: 46, color: C.lamp, alpha: 0.22 }),
      // a candle stands in each window
      ...wins.flatMap((w, i) => [
        el('Shape', { name: 'candle', x: w.x, y: w.y + 8.5 }, [el('Rectangle', { width: 3.6, height: 8, originX: 0.5, originY: 0.5, name: 'R' }), fill(argb(C.candle, 0.98))]),
        ink([[P(w.x - 1.8, w.y + 4.5), P(w.x - 1.8, w.y + 12.5)], [P(w.x + 1.8, w.y + 4.5), P(w.x + 1.8, w.y + 12.5)], [P(w.x - 5, w.y + 12.8), P(w.x + 5, w.y + 12.6)]], rng(280 + i), { w: 0.8, amt: 0.1 }),
        group({ name: 'candle flame', id: candleIds[i], x: w.x, y: w.y + 2.5 }, [
          glow({ x: 0, y: 0, w: 16, h: 16, color: 'FFF1C0', alpha: 0.9 }),
          el('Shape', { name: 'flame', y: -0.5 }, [el('Ellipse', { width: 2.6, height: 4.6, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FFF6D8', 0.98))]),
        ]),
      ]),
      // the path lanterns, lit one by one from the gate up as the painting comes in
      ...lamps.map(([x, b], i) => k.in({ name: `lamp ${i} lit`, cx: x, cy: b - 21, t0: 112 + i * 16, t1: 128 + i * 16, sc: 0.4 }, lampLight(x, b, 1))),
    ]),
  ]));
  tp(litId, 'opacity', LIT);
  s.loopLayer('candles', ambient(s, { name: 'candles', duration: 180, loop: 'loop', tracks: candleIds.flatMap((id, i) => [
    sampled(id, 'scaleY', 180, TICK, (t) => 1 + 0.12 * Math.sin(t * TAU * 5 + i * 1.7) * Math.sin(t * TAU * 2 + i)),
    sampled(id, 'scaleX', 180, TICK, (t) => 1 - 0.06 * Math.sin(t * TAU * 5 + i * 1.7)),
  ]) }));
  // the fir's lanterns and its star, lit with the windows, one by one
  const firLitId = ids.next();
  s.add(group({ name: 'fir lit', id: firLitId, opacity: LIT[TIME0] }, [firLit([
    k.in({ name: 'star lit', cx: starAt.x, cy: starAt.y, t0: 100, t1: 130, sc: 0.3 }, [glow({ x: starAt.x, y: starAt.y, w: 46, h: 46, color: 'F6E7A8', alpha: 0.7 })]),
    ...baubles.filter((_, i) => i % 3 !== 1).map(([x, y], i) => k.in({ name: `bauble ${i} lit`, cx: x, cy: y, t0: 104 + i * 7, t1: 118 + i * 7, sc: 0.3 }, [
      glow({ x, y, w: 20, h: 20, color: C.lamp, alpha: 0.85 }),
      el('Shape', { name: 'bulb', x, y }, [el('Ellipse', { width: 3.6, height: 3.6, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBE08A', 0.95))]),
    ])),
  ])]));
  tp(firLitId, 'opacity', LIT);
  // and the path lanterns as lit by hand (the 'lamps' trigger)
  s.add(group({ name: 'lamps lit by hand' }, lamps.map(([x, b], i) => group({ name: `lamp ${i} by hand`, id: handLitIds[i], opacity: 0 }, lampLight(x, b, 1)))));
  // light out of the open door, painted rather than glowed: by day a little pool on the
  // step; as it gets dark the room shows warm through the doorway and pale washes of
  // lamplight lie out across the path, fading off at their soft, uneven edges
  const nightLightId = ids.next();
  // the right-hand half of the doorway, the part the open leaf doesn't cover
  // the part of the doorway the open leaf doesn't cover. The leaf is a disc squashed toward
  // its hinge (scaleX = how far open), so its free edge is a half-ellipse; the light runs from
  // that edge to the doorway's right side. Calmly the leaf opens to half; flung, to a fifth
  const opening = (r, open) => {
    const edge = (y) => D.x - DR + open * (DR + Math.sqrt(Math.max(0, DR * DR - y * y))) - 0.6;
    const right = [], left = [];
    for (let i = 0; i <= 16; i++) {
      const y = -r + (i / 16) * 2 * r;
      const half = Math.sqrt(Math.max(0, r * r - y * y));
      right.push(P(D.x + half, D.y + y));
      left.unshift(P(Math.min(edge(y), D.x + half), D.y + y));
    }
    return [...right, ...left];
  };
  const roomHalfId = ids.next(), roomWideId = ids.next();
  const pool = (cx, cy, rx, ry, seed, widen) =>
    blobPts(rx, ry, rng(seed), { n: 14, wobble: 0.12 }).map((p) => P(cx + p.x * (1 + Math.max(0, p.y / ry) * widen), cy + p.y));
  s.add(group({ name: 'spill', id: spillId, opacity: 0 }, [
    glow({ x: 610, y: 360, w: 150, h: 44, color: 'FFD77A', alpha: 0.6 }),
    group({ name: 'night light', id: nightLightId, opacity: [0.2, 0, 0.3, 0.8, 1][TIME0] }, [
      wc(ids, pool(622, 362, 84, 24, 300, 0.55), 'F3D48C', rng(301), { alpha: 0.5, off: [0, 0], wobble: 1.5, grain: 0.25, soft: true, hazy: true, blend: 'normal' }),
      wc(ids, pool(618, 344, 44, 12, 302, 0.35), 'F8E2A8', rng(303), { alpha: 0.6, off: [0, 0], wobble: 1, grain: 0.15, soft: true, hazy: true, blend: 'normal' }),
      // the room, warm through the open half of the doorway (the leaf covers the other half)
      group({ name: 'room, door half open', id: roomHalfId }, [
        wc(ids, opening(DR - 0.5, 0.5), 'EDB25C', rng(304), { alpha: 0.85, off: [0, 0], wobble: 0, tension: 0.6, grain: 0.3, soft: false, blend: 'normal' }),
        wc(ids, opening(DR * 0.62, 0.62).map((p) => P(p.x + 5, p.y + 2)), 'F8DC9C', rng(305), { alpha: 0.65, off: [0, 0], wobble: 0.3, grain: 0.1, soft: false, blend: 'normal' }),
      ]),
      // flung wide: more of the room shows, and its light is fuller
      group({ name: 'room, door flung open', id: roomWideId, opacity: 0 }, [
        wc(ids, opening(DR - 0.5, 0.22), 'EDB25C', rng(306), { alpha: 0.88, off: [0, 0], wobble: 0, tension: 0.6, grain: 0.3, soft: false, blend: 'normal' }),
        wc(ids, opening(DR * 0.78, 0.4).map((p) => P(p.x + 2, p.y + 2)), 'F8DC9C', rng(307), { alpha: 0.7, off: [0, 0], wobble: 0.5, grain: 0.1, soft: false, blend: 'normal' }),
      ]),
    ]),
  ]));
  tp(nightLightId, 'opacity', [0.2, 0, 0.3, 0.8, 1]);

  // moon and stars
  const moonId = ids.next();
  const moonOuter = [];
  for (let i = 0; i <= 10; i++) { const a = -2.1 + (i / 10) * 4.2; moonOuter.push(P(Math.cos(a) * 17, Math.sin(a) * 17)); }
  const moonInner = [];
  for (let i = 0; i <= 8; i++) { const a = 1.75 - (i / 8) * 3.5; moonInner.push(P(-7 + Math.cos(a) * 15, Math.sin(a) * 15)); }
  const moon = [...moonOuter, ...moonInner];
  // the moon rises into place and the stars come out one by one, as the night washes in
  s.add(k.in({ name: 'moon in', cx: 232, cy: 74, t0: 30, t1: 84, sc: 0.7, dy: 10 }, [group({ name: 'moon', id: moonId, x: 232, y: 74, opacity: TIME0 === 4 ? 1 : 0 }, [
    glow({ x: 0, y: 0, w: 120, h: 120, color: 'F3E7B8', alpha: 0.3 }),
    wc(ids, moon, 'EFE2A8', rng(290), { alpha: 0.95, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false }),
    k.boil({ name: 'moon ink', seed: 291, draw: (rr) => ink({ pts: moon, closed: true }, rr, { w: 1.5, amt: 0.3 }) }),
  ])]));
  tp(moonId, 'opacity', [0, 0, 0, 0, 1]);
  const stars = [[64, 44, 6], [300, 30, 5], [470, 52, 4.5], [150, 150, 4], [770, 36, 5.5]];
  const twinkle = [];
  stars.forEach(([x, y, R], i) => {
    const id = ids.next(), tw = ids.next();
    s.add(k.in({ name: 'star in', cx: x, cy: y, t0: 56 + i * 9, t1: 86 + i * 9, sc: 0.3, ease: EASE.back }, [group({ name: 'star', id, x, y, opacity: 0 }, [
      group({ name: 'twinkle', id: tw }, [el('Shape', { name: 'star' }, [polyXml(starPts(R), { closed: true }), fill(argb('F6E7A8', 0.95)), stroke(INK, 0.9)])]),
    ])]));
    tp(id, 'opacity', [0, 0, 0, i === 1 || i === 4 ? 0.9 : 0, 1]);
    twinkle.push(sampled(tw, 'scaleX', 240, TICK, (t) => 1 + 0.25 * Math.sin((t + i * 0.29) * TAU)), sampled(tw, 'scaleY', 240, TICK, (t) => 1 + 0.25 * Math.sin((t + i * 0.29) * TAU)));
  });
  gatedLoop(s, 'twinkle', ambient(s, { name: 'twinkle', duration: 240, loop: 'loop', tracks: twinkle }), [[time, 'greaterThanOrEqual', 3]]);

  // --- hit areas
  const hDoor = ids.next(), hBench = ids.next(), hTree = ids.next(), hMail = ids.next(), hSun = ids.next();
  const hPath = ids.next(), hHedge = ids.next(), hLog = ids.next();
  s.add(hit(hDoor, D.x, D.y, 108, 104), hit(hBench, 519, 328, 92, 40), hit(hTree, tx, 150, 100, 124), hit(hMail, 400, 364, 50, 70), hit(hSun, 200, 90, 220, 140));
  s.add(hit(hPath, 548, 374, 190, 30), hit(hHedge, 262, 372, 104, 44), hit(hLog, 770, 340, 96, 34));

  // --- poses
  poseLayer(s, 'season', season, 4, seasonP);
  poseLayer(s, 'time', time, 5, timeP);

  // --- reactions
  // the door: a knock rattles it; the page (main.js) decides what happens next and
  // either has it opened kindly ('welcome') or flung open and slammed ('slam')
  const knock = s.input('trigger', 'knock');
  s.triggerLayer('knock', knock, s.anim({ name: 'knock', duration: 16, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [3, 0.975, 'cubic', EASE.out], [7, 1.004, 'cubic', EASE.inOut], [16, 1]] },
  ] }), { mix: 0 });
  const welcome = s.input('trigger', 'welcome');
  s.triggerLayer('welcome', welcome, s.anim({ name: 'welcome', duration: 300, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', [0.4, 0, 0.3, 1]], [40, 0.5, 'hold'], [228, 0.5, 'cubic', [0.45, 0, 0.35, 1]], [288, 1.006, 'cubic', EASE.out], [300, 1]] },
    { object: insideId, prop: 'opacity', keys: [[0, 0, 'hold'], [4, 0, 'cubic', EASE.out], [36, 1, 'hold'], [236, 1, 'cubic', EASE.in], [284, 0]] },
    { object: spillId, prop: 'opacity', keys: [[0, 0, 'hold'], [8, 0, 'cubic', EASE.out], [44, 1, 'hold'], [228, 1, 'cubic', EASE.in], [280, 0]] },
    { object: roomHalfId, prop: 'opacity', keys: [[0, 1], [300, 1]] },
    { object: roomWideId, prop: 'opacity', keys: [[0, 0], [300, 0]] },
  ] }), { fromAny: false, mix: 0 });
  const slam = s.input('trigger', 'slam');
  const jolt = [[88, 0], [91, 2.4], [94, -2], [97, 1.4], [100, -0.8], [104, 0.3], [110, 0]].map(([f, dx]) => [f, D.x - DR + dx, 'cubic', EASE.inOut]);
  s.triggerLayer('slam', slam, s.anim({ name: 'slam', duration: 120, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', [0.2, 0.9, 0.3, 1]], [7, 0.16, 'cubic', EASE.inOut], [12, 0.22, 'hold'], [80, 0.22, 'cubic', [0.7, 0, 1, 0.6]], [88, 1.03, 'cubic', EASE.out], [93, 0.985, 'cubic', EASE.inOut], [100, 1]] },
    { object: leafId, prop: 'x', keys: [[0, D.x - DR, 'hold'], ...jolt, [120, D.x - DR]] },
    { object: insideId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [6, 1, 'hold'], [82, 1, 'linear'], [88, 0]] },
    { object: spillId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [8, 1, 'hold'], [80, 1, 'linear'], [88, 0]] },
    { object: roomHalfId, prop: 'opacity', keys: [[0, 0], [120, 0]] },
    { object: roomWideId, prop: 'opacity', keys: [[0, 1], [120, 1]] },
  ] }), { fromAny: false, mix: 0 });
  const doorEv = s.event('door');
  s.listen(hDoor, 'click', [Scene.emit(doorEv)]);

  const glint = s.input('trigger', 'glint');
  s.triggerLayer('glint', glint, s.anim({ name: 'glint', duration: 60, tracks: [
    { object: glintId, prop: 'opacity', keys: [[0, 0.35, 'cubic', EASE.out], [10, 1, 'cubic', EASE.inOut], [60, 0.35]] },
    { object: glintId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [10, 1.9, 'cubic', EASE.inOut], [60, 1]] },
    { object: glintId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [10, 1.9, 'cubic', EASE.inOut], [60, 1]] },
  ] }), { fromAny: false });
  s.listen(hDoor, 'enter', [Scene.fire(glint)]);

  const puff = s.input('trigger', 'puff');
  s.triggerLayer('puff', puff, s.anim({ name: 'puff', duration: 160, tracks: [
    { object: ringId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [14, 0.9, 'linear'], [100, 0.5, 'cubic', EASE.in], [160, 0]] },
    { object: ringId, prop: 'y', keys: [[0, 316, 'cubic', EASE.out], [160, 280]] },
    { object: ringId, prop: 'x', keys: [[0, 546, 'cubic', EASE.inOut], [160, 552]] },
    { object: ringId, prop: 'scaleX', keys: [[0, 0.6, 'cubic', EASE.out], [160, 2.2]] },
    { object: ringId, prop: 'scaleY', keys: [[0, 0.6, 'cubic', EASE.out], [160, 2]] },
  ] }), { fromAny: false });
  s.listen(hBench, 'enter', [Scene.fire(puff)]);
  s.listen(hBench, 'click', [Scene.fire(puff)]);

  // the fir: brushed, it shivers and lets one clump of snow go; clicked (or jarred by a
  // slammed door) it shakes, and the snow comes off its boughs in clumps
  const sway = (keys) => [rustleId, rustle2].map((object) => ({ object, prop: 'rotation', keys }));
  const fallTo = (x0, y0, x1, y1, t) => P(lerp(x0, x1, t) + Math.sin(t * 5) * 1.5, y0 + (y1 - y0) * t ** 1.7);
  const rustle = s.input('trigger', 'rustle');
  const dropEnd = P(drop0.x + 14, ridgeY(drop0.x + 14) + 3);
  s.triggerLayer('rustle', rustle, s.anim({ name: 'rustle', duration: 120, tracks: [
    ...sway([[0, 0, 'cubic', EASE.out], [10, 0.035, 'cubic', EASE.inOut], [24, -0.024, 'cubic', EASE.inOut], [40, 0.01, 'cubic', EASE.inOut], [58, 0]]),
    { object: dropId, prop: 'opacity', keys: [[0, 0, 'hold'], [10, 1, 'hold'], [96, 1, 'linear'], [120, 0]] },
    sampled(dropId, 'y', 120, 4, (u) => fallTo(drop0.x, drop0.y, dropEnd.x, dropEnd.y, Math.max(0, Math.min(1, (u * 120 - 10) / 90))).y),
    sampled(dropId, 'x', 120, 4, (u) => fallTo(drop0.x, drop0.y, dropEnd.x, dropEnd.y, Math.max(0, Math.min(1, (u * 120 - 10) / 90))).x),
    sampled(dropId, 'rotation', 120, 4, (u) => u * 1.2),
  ] }), { fromAny: false });
  s.listen(hTree, 'enter', [Scene.fire(rustle)]);
  const shake = s.input('trigger', 'shake');
  s.triggerLayer('shake', shake, s.anim({ name: 'shake', duration: 240, tracks: [
    ...sway([[0, 0, 'cubic', EASE.out], [5, 0.05, 'cubic', EASE.inOut], [11, -0.045, 'cubic', EASE.inOut], [17, 0.035, 'cubic', EASE.inOut], [24, -0.022, 'cubic', EASE.inOut], [34, 0.01, 'cubic', EASE.inOut], [46, 0]]),
    // the boughs lose most of their snow, and the fresh fall slowly whitens them again
    ...firSnowIds.map((id, i) => ({ object: id, prop: 'opacity', keys: [[0, 1, 'hold'], [6 + i * 6, 1, 'cubic', EASE.out], [14 + i * 6, 0.3, 'hold'], [150, 0.3, 'cubic', EASE.inOut], [240, 1]] })),
    ...fall.flatMap((f) => {
      const end = Math.min(240, f.delay + f.len);
      const t = (u) => Math.max(0, Math.min(1, (u * 240 - f.delay) / f.len));
      const at = (u) => fallTo(f.x, f.y, f.x + f.drift, f.gy, t(u));
      return [
        { object: f.id, prop: 'opacity', keys: [[0, 0, 'hold'], [f.delay, 1, 'hold'], [end - 18, 1, 'linear'], [end, 0]] },
        sampled(f.id, 'y', 240, 4, (u) => at(u).y),
        sampled(f.id, 'x', 240, 4, (u) => at(u).x),
        sampled(f.id, 'rotation', 240, 4, (u) => t(u) * (f.drift > 0 ? 1.4 : -1.4)),
      ];
    }),
  ] }), { fromAny: false, mix: 0 });
  s.listen(hTree, 'click', [Scene.fire(shake)]);

  // the post: brushed, the flag goes up and the letters in the lid stir; clicked, one more
  // parcel comes down on the pile (and the page writes the bump)
  const post = s.input('trigger', 'post');
  s.triggerLayer('post', post, s.anim({ name: 'post', duration: 210, tracks: [
    { object: flagId, prop: 'rotation', keys: [[0, 0, 'elastic', { amplitude: 1, period: 0.5 }], [40, -Math.PI / 2, 'hold'], [160, -Math.PI / 2, 'cubic', EASE.inOut], [200, 0]] },
    { object: lettersId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [6, -0.05, 'cubic', EASE.inOut], [14, 0.04, 'cubic', EASE.inOut], [22, -0.02, 'cubic', EASE.inOut], [32, 0]] },
    { object: lettersId, prop: 'y', keys: [[0, 336, 'cubic', EASE.out], [6, 334, 'cubic', EASE.inOut], [18, 336]] },
  ] }), { fromAny: false });
  s.listen(hMail, 'enter', [Scene.fire(post)]);
  const parcelIn = s.input('trigger', 'parcel');
  s.triggerLayer('parcel', parcelIn, s.anim({ name: 'parcel', duration: 60, tracks: [
    { object: parcelDropId, prop: 'opacity', keys: [[0, 1], [60, 1]] },
    { object: parcelDropId, prop: 'y', keys: [[0, -70, 'cubic', EASE.in], [20, 0, 'cubic', EASE.out], [27, -3.5, 'cubic', EASE.in], [33, 0, 'cubic', EASE.out], [37, -1, 'cubic', EASE.in], [40, 0]] },
    { object: parcelDropId, prop: 'rotation', keys: [[0, 0.15, 'cubic', EASE.in], [20, 0, 'hold'], [60, 0]] },
    { object: lettersId, prop: 'rotation', keys: [[0, 0, 'hold'], [20, 0, 'cubic', EASE.out], [24, 0.04, 'cubic', EASE.inOut], [32, -0.02, 'cubic', EASE.inOut], [40, 0]] },
  ] }), { fromAny: false, mix: 0 });
  const parcelEv = s.event('parcel');
  s.listen(hMail, 'click', [Scene.fire(parcelIn), Scene.emit(parcelEv)]);

  // the path lanterns, lit by hand one by one from the gate up to the door; by day they
  // burn a while and go out together
  const lampsIn = s.input('trigger', 'lamps');
  s.triggerLayer('lamps', lampsIn, s.anim({ name: 'lamps', duration: 600, tracks: handLitIds.map((id, i) => {
    const f = 10 + i * 24;
    return { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [f, 0, 'cubic', EASE.out], [f + 4, 1, 'linear'], [f + 7, 0.55, 'linear'], [f + 11, 1, 'hold'], [540, 1, 'cubic', EASE.inOut], [600, 0]] };
  }) }), { fromAny: false, mix: 0 });
  s.listen(hPath, 'enter', [Scene.fire(lampsIn)]);
  s.listen(hPath, 'click', [Scene.fire(lampsIn)]);

  // the Yule log: a heave at the rope pulls the sledge a little way toward the door, and it
  // slides back where it was
  const heave = s.input('trigger', 'heave');
  s.triggerLayer('heave', heave, s.anim({ name: 'heave', duration: 90, tracks: [
    { object: sledgeId, prop: 'x', keys: [[0, 0, 'cubic', EASE.out], [8, 1.2, 'cubic', [0.2, 0.8, 0.3, 1]], [20, -7, 'hold'], [34, -7, 'cubic', EASE.inOut], [80, 0]] },
    { object: sledgeId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [10, -0.012, 'cubic', EASE.inOut], [22, 0.006, 'cubic', EASE.inOut], [34, 0]] },
  ] }), { fromAny: false, mix: 0 });
  const heaveEv = s.event('heave');
  s.listen(hLog, 'click', [Scene.fire(heave), Scene.emit(heaveEv)]);

  // carollers somewhere beyond the hedge: they're only ever heard, in the page's sfx words
  s.listen(hHedge, 'click', [Scene.emit(s.event('carol'))]);

  // on a phone the page plants its own signpost under the painting
  const bare = s.input('bool', 'bare', 0);
  s.boolLayer('bare', bare, hold(s, 'post up', [{ object: postId, prop: 'opacity', keys: [[0, 1]] }]), hold(s, 'post down', [{ object: postId, prop: 'opacity', keys: [[0, 0]] }]), { mixIn: 0, mixOut: 300 });

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

// pose colour for one registered tint id: (re)derive from the role
function tintColor(key, id, color, k) {
  const t = TINT.get(key).find((x) => x.id === id);
  return argb(t.role === 'rim' ? darken(color, 0.28) : color, Math.min(1, t.alpha * k));
}

// ---------- footer: the Gate ----------

function gate(ids) {
  const W = 600, H = 210;
  const s = new Scene(ids, { name: 'Gate', w: W, h: H, x: 960, y: 0, bg: process.env.SH_BG ? 'FFF8F2E4' : undefined });
  const k = new Kit(s);
  const season = s.input('number', 'season', SEASON_IN);
  const time = s.input('number', 'time', TIME_IN);
  const still = s.input('bool', 'still', 0);
  const seasonP = [], timeP = [];
  const fxBack = k.fx('back', 0, 50);
  const fxGate = k.fx('gate', 14, 70);
  const fxSign = k.fx('sign', 6, 56);
  const capOn = (pts, th) => {
    const bot = pts.slice().reverse().map((p, i) => P(p.x, p.y + th * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.9)))));
    const o = [...pts.map((p) => P(p.x, p.y - 1)), ...bot];
    return [
      el('Shape', { name: 'snow shade', x: 0.5, y: 1.6, blendModeValue: 'multiply' }, [pathXml(o, { closed: true, tension: 0.6 }), fill(argb('9AAFC6', 0.55))]),
      el('Shape', { name: 'snow' }, [pathXml(o, { closed: true, tension: 0.6 }), fill(argb('FFFDF8', 0.95))]),
    ];
  };
  // hedge behind
  const top = [];
  for (let x = 26; x <= 574; x += 12) {
    // the hedge rises out of the grass at either end rather than stopping short
    const end = Math.min(1, (x - 26) / 70, (574 - x) / 70);
    top.push(P(x, 196 - (68 + Math.abs(Math.sin(x * 0.21)) * 9 - Math.sin(x * 0.013) * 6) * Math.sin((end * Math.PI) / 2)));
  }
  const hedgeInk = k.boil({ name: 'hedge ink', seed: 401, draw: (rr) => ink(top, rr, { w: 1.6, amt: 0.6, n: 40, fx: fxBack }) });
  s.add(k.in({ name: 'hedge in', cx: 300, cy: 170, t0: 0, t1: 46, sc: 0.98 }, [wc(ids, [...top, P(560, 198), P(40, 198)], HEDGE[1], rng(402), { alpha: 0.5, off: [0, 3], grain: 0.7, key: 'ghedge' }), hedgeInk]));
  for (const t of tintTracks('ghedge', 'FFFFFF')) seasonP.push({ object: t.object, prop: t.prop, type: 'Color', vals: HEDGE.map((c) => tintColor('ghedge', t.object, c, 1)) });

  const hedgeSnow = ids.next();
  s.add(group({ name: 'hedge snow', id: hedgeSnow, opacity: SEASON0 === 3 ? 1 : 0 }, capOn(top.map((p) => P(p.x, p.y + 1)), 6)));
  seasonP.push({ object: hedgeSnow, prop: 'opacity', vals: [0, 0, 0, 1] });

  // the sign board on its stake: the hand-lettered words are HTML laid over it
  const board = [P(34, 42), P(266, 37), P(270, 126), P(38, 131)];
  const signInk = k.boil({
    name: 'sign ink', seed: 403, draw: (rr) => [
      ink({ pts: board, closed: true }, rr, { w: 1.9, amt: 0.6, fx: fxSign, tension: 0.15 }),
      ink([[P(150, 131), P(151, 194)], [P(160, 130), P(160, 194)]], rr, { w: 1.8, amt: 0.4, fx: fxSign }),
      ink([[P(42, 46), P(262, 42)]], rr, { w: 0.8, amt: 0.6, color: INK_SOFT, fx: fxSign }),
    ],
  });
  s.add(k.in({ name: 'sign in', cx: 150, cy: 90, t0: 4, t1: 50 }, [
    wc(ids, [P(148, 128), P(162, 128), P(162, 194), P(148, 194)], 'B89470', rng(404), { alpha: 0.9, off: [1, 0], grain: 0.4, soft: false, blend: 'normal' }),
    wc(ids, board, 'F2E6C8', rng(405), { alpha: 1, off: [2, 2], wobble: 1.5, grain: 0.3, soft: false, blend: 'normal' }),
    stippleShape({ name: 'nails', dots: [{ x: 44, y: 50, r: 1.6 }, { x: 258, y: 46, r: 1.6 }, { x: 46, y: 122, r: 1.6 }, { x: 260, y: 118, r: 1.6 }], color: INK }),
    signInk,
  ]));

  // posts, lantern
  const postsInk = k.boil({
    name: 'posts ink', seed: 410, draw: (rr) => [
      ink([[P(300, 198), P(300, 66)], [P(312, 198), P(312, 66)], [P(448, 198), P(448, 66)], [P(460, 198), P(460, 66)]], rr, { w: 1.9, amt: 0.5, fx: fxGate }),
      ink([{ pts: circ(306, 62, 8, 5, 10), closed: true }, { pts: circ(454, 62, 8, 5, 10), closed: true }], rr, { w: 1.6, amt: 0.3, fx: fxGate }),
      ink([[P(460, 84), P(476, 84), P(476, 92)], { pts: [P(470, 92), P(482, 92), P(483, 110), P(469, 110)], closed: true }, [P(468, 92), P(476, 86), P(484, 92)]], rr, { w: 1.3, amt: 0.3, fx: fxGate, tension: 0.3 }),
    ],
  });
  s.add(k.in({ name: 'posts in', cx: 380, cy: 198, t0: 10, t1: 60 }, [
    wc(ids, [P(300, 66), P(312, 66), P(312, 198), P(300, 198)], 'B89470', rng(411), { alpha: 0.9, off: [1, 1], grain: 0.5, soft: false, blend: 'normal' }),
    wc(ids, [P(448, 66), P(460, 66), P(460, 198), P(448, 198)], 'B89470', rng(412), { alpha: 0.9, off: [1, 1], grain: 0.5, soft: false, blend: 'normal' }),
    wc(ids, [P(470, 92), P(482, 92), P(483, 110), P(469, 110)], C.ochre, rng(413), { alpha: 0.5, off: [1, 1], wobble: 0.4, grain: 0, soft: false }),
    postsInk,
  ]));


  // a moth comes to the lantern while you hover it, at dusk and at night
  const mothId = ids.next(), wingsId = ids.next();
  const wing = blobPts(4.2, 3, rng(480), { n: 8, wobble: 0.1 });
  s.add(group({ name: 'moth', id: mothId, x: 476, y: 101, opacity: 0, scaleX: 1.4, scaleY: 1.4 }, [
    group({ name: 'wings', id: wingsId }, [
      ...[-1, 1].map((sx) => wc(ids, wing.map((p) => P(p.x * sx + sx * 3.6, p.y - 0.5)), 'EFE3C2', rng(481 + sx), { alpha: 0.95, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' })),
      ink([{ pts: wing.map((p) => P(p.x + 3.6, p.y - 0.5)), closed: true }, { pts: wing.map((p) => P(-p.x - 3.6, p.y - 0.5)), closed: true }], rng(483), { w: 0.8, amt: 0.1 }),
    ]),
    ink([[P(0, -2.6), P(0, 3)]], rng(484), { w: 1.6, amt: 0.1 }),
  ]));
  const mothOn = s.input('bool', 'moth', 0);
  const mothRest = hold(s, 'moth away', [{ object: mothId, prop: 'opacity', keys: [[0, 0]] }]);
  // the wings beat at 11 a second, too fast for the ambient rate, so the moth steps at 30
  const mothLoop = s.anim({ name: 'moth', duration: 200, loop: 'loop', rate: 30, tracks: [
    { object: mothId, prop: 'opacity', keys: [[0, 1], [200, 1]] },
    sampled(mothId, 'x', 200, 2, (t) => 476 + Math.cos(t * TAU) * 19 + Math.sin(t * TAU * 3) * 3),
    sampled(mothId, 'y', 200, 2, (t) => 101 + Math.sin(t * TAU) * 12 + Math.cos(t * TAU * 2) * 3),
    sampled(mothId, 'rotation', 200, 2, (t) => Math.sin(t * TAU) * 0.5),
    sampled(wingsId, 'scaleY', 200, 2, (t) => 0.35 + Math.abs(Math.sin(t * TAU * 18)) * 0.65),
  ] });
  const m0 = ids.next(), m1 = ids.next();
  const isDusk = el('TransitionNumberCondition', { inputId: time, opValue: 'greaterThanOrEqual', value: 3 });
  s.layers.push(s._layer('moth', [
    el('AnyState', { x: 100, y: -120 }),
    el('ExitState', { x: 500, y: -120 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: m0 })),
    el('AnimationState', { x: 200, y: 0, animationId: mothRest, id: m0 },
      el('StateTransition', { stateToId: m1, duration: 400 }, [el('TransitionBoolCondition', { inputId: mothOn, opValue: 'equal' }), isDusk])),
    el('AnimationState', { x: 400, y: 0, animationId: mothLoop, id: m1 }, [
      el('StateTransition', { stateToId: m0, duration: 600 }, el('TransitionBoolCondition', { inputId: mothOn, opValue: 'notEqual' })),
      el('StateTransition', { stateToId: m0, duration: 600 }, el('TransitionNumberCondition', { inputId: time, opValue: 'lessThan', value: 3 })),
    ]),
  ]));
  const hLamp = ids.next();
  s.add(hit(hLamp, 476, 100, 44, 48));
  s.listen(hLamp, 'enter', [Scene.setBool(mothOn, true)]);
  s.listen(hLamp, 'exit', [Scene.setBool(mothOn, false)]);

  // the gate leaf, hinged on the left post; starts ajar and closes when you reach it
  const leafId = ids.next(), clickId = ids.next();
  const gateInk = k.boil({
    name: 'gate ink', seed: 420, draw: (rr) => [
      ink([[P(314, 90), P(446, 88)], [P(314, 170), P(446, 168)]], rr, { w: 1.8, amt: 0.5, fx: fxGate }),
      ink([328, 350, 372, 394, 416, 436].map((x) => [P(x, 82 - Math.sin((x - 314) / 132 * Math.PI) * 10), P(x, 182)]), rr, { w: 1.4, amt: 0.4, fx: fxGate }),
      ink([[P(318, 166), P(442, 92)]], rr, { w: 1.5, amt: 0.4, fx: fxGate }),
      ink([[P(436, 124), P(452, 124)]], rr, { w: 2, amt: 0.2, fx: fxGate }),
    ],
  });
  const gateWash = [P(316, 82), P(380, 72), P(444, 82), P(444, 182), P(316, 182)];
  s.add(k.in({ name: 'gate in', t0: 14, t1: 60 }, [
    group({ name: 'leaf', id: leafId, x: 314, y: 0, scaleX: 0.74 }, [
      group({ name: 'leaf body', x: -314, y: 0 }, [wc(ids, gateWash, C.door, rng(421), { alpha: 0.34, off: [2, 2], grain: 0.4, soft: false }), gateInk, ...wreathKids(ids, k, fxGate, P(380, 122), 13, 1460)]),
    ]),
  ]));
  s.add(group({ name: 'click', id: clickId, opacity: 0 }, [ink([[P(462, 112), P(470, 106)], [P(464, 124), P(474, 124)], [P(462, 136), P(470, 142)]], rng(422), { w: 1.2, amt: 0.2 })]));


  // a mouse lives in the mailbox: click it and it noses out of the box's right end,
  // sniffs, twitches an ear, blinks, and goes back in. It's clipped to what's outside
  // the box, so the box itself hides it: only the part that's poked out shows.
  const mouseId = ids.next(), mLidId = ids.next(), mEarId = ids.next(), mNoseId = ids.next(), mClipId = ids.next();
  // the clip: everything to the right of the box's right-hand end
  s.add(el('Shape', { name: 'mouse clip', id: mClipId }, [polyXml([P(552, 50), P(640, 50), P(640, 150), P(559, 150), P(560, 116), P(561, 92), P(552, 82)], { closed: true })]));
  const head = [P(-9, -5), P(-2, -7), P(5, -5), P(10, -1.5), P(12.5, 1), P(10, 3), P(4, 5.5), P(-4, 6), P(-9, 4)];
  const ear = blobPts(4.6, 4.6, rng(450), { n: 9, wobble: 0.05 }).map((p) => P(p.x, p.y));
  s.add(group({ name: 'mouse', id: mouseId, x: 545, y: 106, opacity: 0 }, [
    el('ClippingShape', { sourceId: mClipId, name: 'Clip' }),
    group({ name: 'ear', id: mEarId, x: -1, y: -6 }, [
      wc(ids, ear, 'A8988A', rng(451), { alpha: 0.95, off: [0, 0], wobble: 0.2, grain: 0.2, soft: false, blend: 'normal' }),
      wc(ids, ear.map((p) => P(p.x * 0.55 + 0.4, p.y * 0.55 + 0.4)), 'E7A9A4', rng(452), { alpha: 0.9, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }),
      ink({ pts: ear, closed: true }, rng(453), { w: 1, amt: 0.15 }),
    ]),
    wc(ids, head, 'B3A598', rng(454), { alpha: 0.95, off: [0.4, 0.4], wobble: 0.3, grain: 0.3, soft: false, blend: 'normal', tension: 0.8 }),
    ink({ pts: head, closed: true, tension: 0.8 }, rng(455), { w: 1.1, amt: 0.2 }),
    el('Shape', { name: 'eye', x: 5, y: -1.5 }, [el('Ellipse', { width: 2.4, height: 2.6, originX: 0.5, originY: 0.5, name: 'E' }), fill(INK)]),
    el('Shape', { name: 'lid', id: mLidId, x: 5, y: -3, scaleY: 0 }, [el('Rectangle', { width: 3.4, height: 3.4, originX: 0.5, originY: 0, name: 'R' }), fill('FFB3A598')]),
    group({ name: 'nose', id: mNoseId, x: 12.5, y: 1 }, [
      el('Shape', { name: 'tip' }, [el('Ellipse', { width: 2.6, height: 2.2, originX: 0.5, originY: 0.5, name: 'E' }), fill('FFD98B86')]),
      ink([[P(-1, 0.6), P(6, -1.6)], [P(-1, 1.2), P(6.5, 1.6)], [P(-1.5, 1.8), P(5, 4)]], rng(456), { w: 0.6, amt: 0.1 }),
    ]),
  ]));

  // mailbox
  const box = [P(500, 116), P(499, 92), P(508, 82), P(552, 82), P(561, 92), P(560, 116)];
  const mailInk = k.boil({ name: 'mail ink', seed: 430, draw: (rr) => [ink([[P(529, 198), P(529, 116)], [P(536, 198), P(536, 116)], { pts: box, closed: true }, [P(506, 92), P(506, 114)]], rr, { w: 1.7, amt: 0.4, fx: fxGate, tension: 0.5 })] });
  s.add(k.in({ name: 'mail in', cx: 530, cy: 198, t0: 20, t1: 66 }, [
    wc(ids, box, 'D07A5A', rng(431), { alpha: 0.95, off: [1.5, 1.5], wobble: 0.8, grain: 0.5, soft: false, blend: 'normal' }),
    wc(ids, [P(529, 116), P(536, 116), P(536, 198), P(529, 198)], 'B89470', rng(432), { alpha: 0.9, off: [1, 0], grain: 0.3, soft: false, blend: 'normal' }),
    mailInk,
  ]));

  // the Yule post: letters standing up out of the lid, and the parcels that wouldn't go in
  // piled at the foot of the post. Click the pile and the top one gets a shake
  s.add(k.in({ name: 'letters in', cx: 530, cy: 84, t0: 40, t1: 76, op: 0, dy: 6 }, [
    ...envelopeKids(ids, fxGate, 517, 76, -0.3, 1500, false, 1.45),
    ...envelopeKids(ids, fxGate, 543, 77, 0.32, 1503, false, 1.45),
    ...envelopeKids(ids, fxGate, 530, 73, 0.05, 1506, true, 1.5),
  ]));
  const rattleId = ids.next();
  s.add(k.in({ name: 'parcels in', cx: 536, cy: 198, t0: 46, t1: 84, op: 0 }, [
    ...parcelKids(ids, fxGate, 497, 175, 526, 198, C.holly, C.gold, 1510),
    ...capOn([P(497, 175), P(511, 174), P(526, 175)], 3),
    ...parcelKids(ids, fxGate, 539, 171, 575, 198, C.kraft, C.holly, 1520),
    group({ name: 'top parcel', id: rattleId, x: 557, y: 171 }, [group({ name: 'top parcel body', x: -557, y: -171 }, [
      ...parcelKids(ids, fxGate, 546, 154, 568, 171, C.fir2, C.holly, 1530),
      ...capOn([P(546, 154), P(557, 153.4), P(568, 154)], 3),
    ])]),
  ]));
  // sprigs of holly: one tucked in the lantern's bracket, one nailed at the board's corner
  const holly = (cx, cy, seed, sc = 1) => {
    const sprig = [[-5, -0.5], [-1, 0.7], [3.5, -0.4]].map(([dx, rot], i) =>
      blobPts(5 * sc, 2.3 * sc, rng(seed + i), { n: 7, wobble: 0.14 }).map((p) => P(cx + dx * sc + p.x * Math.cos(rot) - p.y * Math.sin(rot), cy + p.x * Math.sin(rot) + p.y * Math.cos(rot))));
    return k.in({ name: 'holly in', cx, cy, t0: 56, t1: 86, sc: 0.3, ease: EASE.back }, [
      ...sprig.map((pts, i) => wc(ids, pts, i === 1 ? C.fir2 : C.fir, rng(seed + 5 + i), { alpha: 0.95, off: [0.2, 0.2], wobble: 0.15, grain: 0, soft: false, blend: 'normal' })),
      ink(sprig.map((pts) => ({ pts, closed: true })), rng(seed + 8), { w: 0.8, amt: 0.15 }),
      stippleShape({ name: 'berries', dots: [[-2, -3], [1.5, -3.8], [0, -1]].map(([dx, dy]) => ({ x: cx + dx * sc, y: cy + dy * sc, r: 1.5 * sc })), color: argb(C.berry, 0.95) }),
    ]);
  };
  s.add(holly(466, 82, 1540), holly(52, 50, 1560, 1.25));

  // ground
  const ground = [P(22, 196), P(160, 186), P(320, 192), P(470, 186), P(574, 191), P(584, 199), P(470, 206), P(150, 205), P(30, 203)];
  // the ground line holds still (no boil) and is sparse, so the foot of the page stays calm
  const groundInk = (() => {
    const rr = rng(440);
    const list = [];
    for (const x of [40, 150, 330, 452]) list.push([P(x, 198), P(x + 22, 198 + rr.jit(0.6)), P(x + 44, 198 + rr.jit(0.6))]);
    for (const gx of [92, 284, 520]) list.push([P(gx, 196), P(gx - 4, 187)], [P(gx + 2, 196), P(gx + 2, 185)], [P(gx + 4, 196), P(gx + 8, 188)]);
    return ink(list, rr, { w: 1.4, amt: 0.3, fx: fxBack });
  })();
  s.add(k.in({ name: 'ground in', cx: 300, cy: 200, t0: 0, t1: 40 }, [wc(ids, ground, GROUND[1], rng(441), { alpha: 0.42, off: [0, 0], grain: 0.5, key: 'gground' }), groundInk]));
  for (const t of tintTracks('gground', 'FFFFFF')) seasonP.push({ object: t.object, prop: t.prop, type: 'Color', vals: GROUND.map((c) => tintColor('gground', t.object, c, 1)) });


  // snow caps
  const snowId = ids.next();

  s.add(group({ name: 'snow', id: snowId, opacity: SEASON0 === 3 ? 1 : 0 }, [
    ...capOn([P(34, 41), P(150, 38), P(266, 36)], 4),
    ...capOn([P(298, 60), P(306, 56), P(314, 60)], 4),
    ...capOn([P(446, 60), P(454, 56), P(462, 60)], 4),
    ...capOn([P(499, 91), P(508, 81), P(530, 80), P(552, 81), P(561, 91)], 4),
    ...capOn([P(10, 191), P(160, 186), P(320, 192), P(470, 186), P(590, 190)], 7),
  ]));
  seasonP.push({ object: snowId, prop: 'opacity', vals: [0, 0, 0, 1] });

  // hour glaze and lantern light
  const [glazeXml, glazeTracks] = hourGlaze(ids, W, H, 0.6);
  s.add(glazeXml);
  timeP.push(...glazeTracks);
  const litId = ids.next();
  s.add(group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
    glow({ x: 476, y: 101, w: 90, h: 90, color: C.lamp, alpha: 0.6 }),
    el('Shape', { name: 'flame', x: 476, y: 101 }, [el('Ellipse', { width: 6, height: 10, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
  ]));
  timeP.push({ object: litId, prop: 'opacity', vals: LIT });

  poseLayer(s, 'season', season, 4, seasonP);
  poseLayer(s, 'time', time, 5, timeP);

  // close: the leaf swings shut, bumps, and the latch clicks

  const close = s.input('trigger', 'close');
  const closing = s.anim({ name: 'closing', duration: 90, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 0.74, 'cubic', [0.5, 0, 0.9, 0.6]], [34, 1.02, 'cubic', EASE.out], [44, 0.96, 'cubic', EASE.inOut], [56, 1]] },
    { object: clickId, prop: 'opacity', keys: [[0, 0, 'hold'], [34, 1, 'hold'], [52, 1, 'linear'], [80, 0]] },
  ] });
  const closed = hold(s, 'closed', [{ object: leafId, prop: 'scaleX', keys: [[0, 1]] }, { object: clickId, prop: 'opacity', keys: [[0, 0]] }]);
  const ajar = hold(s, 'ajar', [{ object: leafId, prop: 'scaleX', keys: [[0, 0.74]] }, { object: clickId, prop: 'opacity', keys: [[0, 0]] }]);
  const a = ids.next(), b = ids.next(), c = ids.next();
  s.layers.push(s._layer('close', [
    el('AnyState', { x: 100, y: -120 }),
    el('ExitState', { x: 700, y: -120 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: a })),
    el('AnimationState', { x: 200, y: 0, animationId: ajar, id: a }, [
      el('StateTransition', { stateToId: b }, el('TransitionTriggerCondition', { inputId: close })),
      el('StateTransition', { stateToId: c }, el('TransitionBoolCondition', { inputId: still, opValue: 'equal' })),
    ]),
    el('AnimationState', { x: 400, y: 0, animationId: closing, id: b }, el('StateTransition', { stateToId: c, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 })),
    el('AnimationState', { x: 600, y: 0, animationId: closed, id: c }),
  ]));

  const hMail = ids.next();
  s.add(hit(hMail, 532, 120, 80, 90));
  const mouse = s.input('trigger', 'mouse');
  const blink = (f) => [[f, 0, 'cubic', EASE.in], [f + 3, 1, 'cubic', EASE.out], [f + 6, 0, 'hold']];
  const sniff = (f0, f1) => { const k = []; for (let f = f0; f < f1; f += 6) k.push([f, 0, 'cubic', EASE.inOut], [f + 3, 0.16, 'cubic', EASE.inOut]); return k; };
  s.triggerLayer('mouse', mouse, s.anim({ name: 'mouse', duration: 230, tracks: [
    // creeps out in two goes, has a look round, then whisks back in
    { object: mouseId, prop: 'x', keys: [[0, 545, 'cubic', EASE.inOut], [16, 556, 'hold'], [34, 556, 'cubic', EASE.out], [46, 566, 'hold'], [196, 566, 'cubic', [0.5, 0, 0.9, 0.5]], [206, 540]] },
    { object: mouseId, prop: 'rotation', keys: [[0, 0, 'hold'], [80, 0, 'cubic', EASE.inOut], [92, -0.22, 'hold'], [128, -0.22, 'cubic', EASE.inOut], [140, 0.06, 'cubic', EASE.inOut], [152, 0, 'hold'], [230, 0]] },
    { object: mNoseId, prop: 'rotation', keys: [[0, 0, 'hold'], ...sniff(18, 34), ...sniff(50, 78), ...sniff(144, 176), [230, 0]] },
    { object: mEarId, prop: 'rotation', keys: [[0, 0, 'hold'], [110, 0, 'cubic', EASE.out], [114, -0.35, 'cubic', EASE.inOut], [120, 0.05, 'cubic', EASE.inOut], [126, 0, 'hold'], [230, 0]] },
    { object: mLidId, prop: 'scaleY', keys: [[0, 0, 'hold'], ...blink(64), ...blink(164), [230, 0]] },
    { object: mouseId, prop: 'opacity', keys: [[0, 1, 'hold'], [206, 0, 'hold'], [230, 0]] },
  ] }), { fromAny: false, mix: 0 });
  s.listen(hMail, 'click', [Scene.fire(mouse)]);

  // the top parcel: picked up and given a shake, to guess what's in it (the page writes the rattle)
  const hParcels = ids.next();
  s.add(hit(hParcels, 536, 180, 84, 38));
  const rattle = s.input('trigger', 'rattle');
  s.triggerLayer('rattle', rattle, s.anim({ name: 'rattle', duration: 60, tracks: [
    { object: rattleId, prop: 'y', keys: [[0, 171, 'cubic', EASE.out], [8, 164, 'hold'], [38, 164, 'cubic', EASE.in], [46, 171, 'cubic', EASE.out], [50, 170, 'cubic', EASE.in], [54, 171]] },
    { object: rattleId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [8, 0, 'linear'], [12, 0.12], [16, -0.1], [20, 0.11], [24, -0.09], [28, 0.07], [32, -0.04], [38, 0, 'hold'], [60, 0]] },
  ] }), { fromAny: false, mix: 0 });
  s.listen(hParcels, 'click', [Scene.fire(rattle), Scene.emit(s.event('rattle'))]);

  k.finish(still);
  return s.toXml();
}

export default function () {
  TINT.clear();
  const ids = new Ids(10);
  return document(hill(ids), gate(ids));
}
