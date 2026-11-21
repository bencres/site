// Lithe: the Shire's Midsummer (the Lithedays and Midyear's Day), painted over draft 21
// (rive/shire-ii/gen.mjs) in the same hand. Same hill, door, signpost and layout; the
// day is a holiday: a bonfire on the hilltop with a ring of dancers, a crown of flowers
// on the round door, bunting where the washing was, paper lanterns, and the Midyear's
// feast laid on a trestle table. The light lingers golden late into the evening.
// Only summer is painted; the season input stays so the page code is unchanged.
//
// Two artboards share one file: Hill (the hero) and Gate (the footer, where the
// hand-lettered sign is HTML laid over a painted board).
//
// Inputs, both artboards: season 0..3 (only summer is painted), time 0..4 (morning,
// day, late afternoon, dusk, night), still (skip the intro).
// Hill also: regular, bare, and the triggers knock, welcome, slam, glint, puff, gust,
// rustle, shake, post, shine, ring-*, as on the everyday hill; and for Lithe: flare (the
// bonfire leaps and throws sparks), dance (the ring of dancers twirls), petals (the door's
// garland sheds a few), cheers (mugs clink at the feast), scatter (the fireflies scatter).
// Events: door, chimney, fire, dance, feast. Gate: close, mouse, flutter.
//
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, polyXml,
  fill, stroke, stippleShape, document, EASE, thin,
} from '../lib/ink.mjs';

const SEASON0 = +(process.env.SH_SEASON ?? 1);
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
function glow({ name = 'glow', x, y, w, h, color, alpha, id, opacity, blend }) {
  const stops = [[0, alpha], [0.3, alpha * 0.66], [0.6, alpha * 0.26], [1, 0]];
  return el('Shape', { name, x, y, id, opacity, blendModeValue: blend }, [
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

// the same, with a looser tolerance and step, for small things (sparks, fireflies, far dancers)
function sampledLoose(object, prop, frames, step, fn, eps) {
  const keys = [];
  for (let f = 0; f <= frames; f += step) keys.push([Math.min(f, frames), fn(Math.min(f, frames) / frames), 'linear']);
  if (keys.at(-1)[0] !== frames) keys.push([frames, fn(1), 'linear']);
  return { object, prop, keys: thin(keys, eps ?? { x: 0.35, y: 0.35, scaleX: 0.008, scaleY: 0.008, opacity: 0.03, rotation: 0.01 }[prop]) };
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
const SKY = [['A9CDEB', 0.4], ['7DB5E0', 0.42], ['A3C3D8', 0.34], ['CFA0B4', 0.4], ['3B5899', 0.56]];
const HORIZON = [['F2B98A', 0.34], ['E9DCAE', 0.14], ['EFB24E', 0.4], ['EE9A48', 0.56], ['8A6E9A', 0.34]];
// Lithe's light: the afternoon goes gold early and dusk stays gold-rose (the long midsummer
// evening) where the everyday hill turns violet; the short night is a lighter blue
const GLAZE = [['F4CFA8', 0.1], ['F4E3B0', 0], ['EDB24E', 0.17], ['D7895A', 0.22], ['26326C', 0.38]];
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

  // --- the tree on the shoulder of the hill
  const tx = 815, tb = 201;
  const trunk = [[P(tx - 5, tb), P(tx - 3, tb - 30), P(tx, tb - 60)], [P(tx + 6, tb), P(tx + 7, tb - 30), P(tx + 9, tb - 58)]];
  const branches = [
    [P(tx, tb - 40), P(tx - 16, tb - 58), P(tx - 26, tb - 76)],
    [P(tx + 6, tb - 50), P(tx + 22, tb - 70), P(tx + 30, tb - 84)],
    [P(tx + 3, tb - 58), P(tx + 4, tb - 82), P(tx, tb - 100)],
    [P(tx - 16, tb - 58), P(tx - 34, tb - 62)],
    [P(tx + 22, tb - 70), P(tx + 40, tb - 70)],
    [P(tx + 1, tb - 82), P(tx - 12, tb - 96)],
  ];
  const treeInk = k.boil({
    name: 'trunk ink', seed: 81, draw: (rr) => [
      ink(trunk, rr, { w: 1.9, amt: 0.4, fx: fxTree }),
      ink(branches, rr, { w: 1.2, amt: 0.5, fx: fxTree }),
    ],
  });
  const ccx = tx + 3, ccy = tb - 74;
  const crown = scallop(ccx, ccy, 52, rng(82), { bumps: 8, depth: 0.13, squash: 0.84 });
  const crownInk = k.boil({
    name: 'crown ink', seed: 83, draw: (rr) => {
      const arc = [];
      for (let i = 0; i <= 8; i++) {
        const a = 0.2 + (i / 8) * 1.4;
        arc.push(P(ccx + Math.cos(a) * 38, ccy + Math.sin(a) * 30));
      }
      return [ink({ pts: crown, closed: true }, rr, { w: 1.9, amt: 0.7, fx: fxTree, bleed: 0.1 }), ink(arc, rr, { w: 1.1, amt: 0.4, fx: fxTree })];
    },
  });
  const crownSeason = ids.next(), crownInkSeason = ids.next(), blossomId = ids.next();
  const blossoms = [];
  const br = rng(84);
  for (let i = 0; i < 16; i++) {
    const a = br() * TAU, d = Math.sqrt(br()) * 40;
    blossoms.push({ x: ccx + Math.cos(a) * d, y: ccy + Math.sin(a) * d * 0.8, r: br.range(1.8, 3) });
  }
  const rustleId = ids.next(), breatheId = ids.next();
  s.add(k.in({ name: 'tree in', cx: tx, cy: tb, t0: 56, t1: 118, sc: 0.88, ease: EASE.back }, [
    wc(ids, [...trunk[0], ...trunk[1].slice().reverse()], C.wood, rng(85), { alpha: 0.4, off: [2, 1], grain: 0.3 }),
    treeInk,
    group({ name: 'breathe', id: breatheId, x: tx, y: tb - 30 }, [
      group({ name: 'rustle', id: rustleId }, [
        group({ name: 'crown body', x: -tx, y: -(tb - 30) }, [
          group({ name: 'crown season', id: crownSeason }, [
            wc(ids, crown, CANOPY[1], rng(86), { alpha: 0.56, off: [-4, 4], grain: 0.8, key: 'canopy' }),
            wc(ids, scallop(ccx - 12, ccy + 12, 26, rng(87), { bumps: 5 }), CANOPY2[1], rng(88), { alpha: 0.26, off: [0, 0], grain: 0.3, key: 'canopy2', soft: false }),
          ]),
          group({ name: 'blossom', id: blossomId, opacity: SEASON0 === 0 ? 1 : 0 }, [stippleShape({ dots: blossoms, color: argb('E48AA6', 0.8) })]),
          group({ name: 'crown ink', id: crownInkSeason }, [crownInk]),
        ]),
      ]),
    ]),
  ]));
  sp(crownSeason, 'opacity', [1, 1, 1, 0.2]);
  sp(crownInkSeason, 'opacity', [1, 1, 1, 0]);
  sp(blossomId, 'opacity', [1, 0, 0, 0]);
  for (const t of tintTracks('canopy', 'FFFFFF')) sp(t.object, t.prop, CANOPY.map((c) => tintColor('canopy', t.object, c, 1)), 'Color');
  for (const t of tintTracks('canopy2', 'FFFFFF')) sp(t.object, t.prop, CANOPY2.map((c) => tintColor('canopy2', t.object, c, 1)), 'Color');
  s.loopLayer('breathe', ambient(s, { name: 'breathe', duration: 330, loop: 'pingPong', tracks: [
    { object: breatheId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [330, 1.02]] },
    { object: breatheId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [330, 1.03]] },
  ] }));

  // a thing that drops when the tree is rustled: petal, leaf, leaf, or a puff of snow
  const dropId = ids.next();
  const dropShape = [P(-5, 0), P(0, -3), P(5, 0), P(0, 3)];
  s.add(group({ name: 'drop', x: tx + 30, y: tb - 92, id: dropId, opacity: 0 }, [
    wc(ids, dropShape, DROP[SEASON0], rng(89), { alpha: 0.9, off: [1, 1], wobble: 0.4, grain: 0, key: 'drop', soft: false }),
    ink({ pts: dropShape, closed: true }, rng(90), { w: 1, amt: 0.2 }),
  ]));
  const fall = [
    { dx: -26, dy: -84, sx: 0.9, drift: -30, len: 150, delay: 4 },
    { dx: 12, dy: -100, sx: 1.1, drift: 24, len: 165, delay: 10 },
    { dx: -6, dy: -70, sx: 0.8, drift: -14, len: 140, delay: 16 },
    { dx: 34, dy: -78, sx: 1, drift: 36, len: 155, delay: 22 },
    { dx: -38, dy: -96, sx: 0.85, drift: -40, len: 170, delay: 28 },
  ].map((f, i) => ({ ...f, id: ids.next(), x: tx + f.dx, y: tb + f.dy, seed: 300 + i }));
  for (const f of fall) {
    const shape = dropShape.map((p) => P(p.x * f.sx, p.y * f.sx));
    s.add(group({ name: 'fall', x: f.x, y: f.y, id: f.id, opacity: 0 }, [
      wc(ids, shape, DROP[SEASON0], rng(f.seed), { alpha: 0.9, off: [1, 1], wobble: 0.4, grain: 0, key: 'drop', soft: false }),
      ink({ pts: shape, closed: true }, rng(f.seed + 50), { w: 1, amt: 0.2 }),
    ]));
  }
  for (const t of tintTracks('drop', 'FFFFFF')) sp(t.object, t.prop, DROP.map((c) => tintColor('drop', t.object, c, 1)), 'Color');

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
      { object: id, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [170, name === 'heart' ? 0.1 : 0.3]] },
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

  // --- Lithe: a bonfire on the crown of the hill, with a ring of dancers going round it.
  // The ring sits just in front of the crest, so the far dancers stand on the turf rather
  // than float above the skyline. Each dancer is drawn twice, once behind the fire and once
  // in front of it, and shows whichever copy matches its side of the ring.
  const FX = 628, FY = 192, RX = 50, RY = 11;
  const fxFire = k.fx('fire', 70, 126);
  // logs stacked as a cone, and two laid across its foot
  const logs = [-15, -9, -3, 4, 10, 15].map((dx, i) => {
    const apex = P(FX + (i - 2.5) * 0.9, FY - 22);
    const base = P(FX + dx, FY + 1);
    return [base, P(apex.x + (apex.x - base.x) * 0.16, apex.y - 3.5)];
  });
  const crossLogs = [[P(FX - 20, FY + 3), P(FX + 6, FY - 1)], [P(FX - 5, FY - 1), P(FX + 21, FY + 3)]];
  const logsInk = k.boil({ name: 'logs ink', seed: 801, draw: (rr) => ink(logs, rr, { w: 1.4, amt: 0.3, fx: fxFire }) });
  const crossInk = k.boil({ name: 'cross logs ink', seed: 804, draw: (rr) => ink(crossLogs, rr, { w: 1.7, amt: 0.3, fx: fxFire }) });
  // a flame: five tongues, the middle one tallest, drawn about its foot at (0, 0)
  const flamePts = (r, w, h, lean = 0) => {
    const tips = [[-0.38, 0.42], [-0.2, 0.74], [0.03, 1], [0.24, 0.68], [0.4, 0.4]];
    const pts = [P(-w / 2, 0), P(-w * 0.5, -h * 0.14)];
    tips.forEach(([tx, th], j) => {
      const hh = h * (th + r.jit(0.07));
      pts.push(P(w * tx + r.jit(w * 0.04) + lean * th, -hh));
      if (j < tips.length - 1) pts.push(P(w * (tx + tips[j + 1][0]) / 2 + lean * th * 0.5, -hh * 0.52 - h * 0.06));
    });
    pts.push(P(w * 0.5, -h * 0.14), P(w / 2, 0), P(0, h * 0.06));
    return pts;
  };
  // four re-drawn flames, swapped faster and less regularly than the line boil: the flicker
  const flameCels = [];
  const flameSolo = ids.next();
  const flr = rng(810);
  for (let c = 0; c < 4; c++) {
    const cid = ids.next();
    const lean = flr.jit(2.2);
    const outer = flamePts(flr, 30, 46, lean), mid = flamePts(flr, 20, 31, lean * 0.7), core = flamePts(flr, 10, 16, lean * 0.4);
    flameCels.push({ cid, xml: el('Node', { name: `flame${c}`, id: cid }, [
      ink({ pts: outer, closed: true }, flr, { w: 1.15, amt: 0.3, tension: 0.5, fx: fxFire }),
      wc(ids, core.map((p) => P(p.x, p.y - 1)), 'FBE6A2', flr, { alpha: 0.95, off: [0, 0], wobble: 0.4, grain: 0, soft: false, blend: 'normal', tension: 0.55 }),
      wc(ids, mid, 'F2A93A', flr, { alpha: 0.95, off: [0.5, 0], wobble: 0.5, grain: 0.1, soft: false, blend: 'normal', tension: 0.55 }),
      wc(ids, outer, 'E0602E', flr, { alpha: 0.9, off: [1, 0.5], wobble: 0.6, grain: 0.2, soft: false, blend: 'normal', tension: 0.55 }),
    ]) });
  }
  const flameSizeId = ids.next(), flareId = ids.next();
  const FLAME = [0.8, 0.74, 0.88, 1.06, 1.12]; // a modest fire by day; built up as the light goes
  const flames = group({ name: 'flame size', id: flameSizeId, x: FX, y: FY - 1, scaleX: FLAME[TIME0], scaleY: FLAME[TIME0] }, [
    group({ name: 'flare', id: flareId }, [el('Solo', { name: 'flicker', id: flameSolo, activeComponentId: flameCels[0].cid }, flameCels.map((c) => c.xml))]),
  ]);
  tp(flameSizeId, 'scaleX', FLAME);
  tp(flameSizeId, 'scaleY', FLAME);
  const order = [0, 2, 1, 3, 0, 1, 3, 2, 1, 0, 2, 3];
  s.loopLayer('flicker', ambient(s, { name: 'flicker', duration: order.length * 4, loop: 'loop', tracks: [
    { object: flameSolo, prop: 'activeComponentId', type: 'Id', keys: order.map((c, i) => [i * 4, flameCels[c].cid, 'hold']) },
  ] }));
  // firelight on the turf round the fire, under the dancers
  const turfLightId = ids.next();
  const TURF = [0.25, 0.15, 0.45, 1, 1];
  const turfLight = group({ name: 'turf light', id: turfLightId, opacity: TURF[TIME0] }, [glow({ x: FX, y: FY + 2, w: 170, h: 40, color: 'F6C25A', alpha: 0.6 })]);
  tp(turfLightId, 'opacity', TURF);
  // a thread of smoke off the fire, which shows by day and is lost in the dark
  const fireSmokeId = ids.next(), fsTracks = [], fsKids = [];
  for (let i = 0; i < 2; i++) {
    const id = ids.next();
    const curl = k.boil({ name: `fire smoke${i}`, seed: 820 + i, draw: (rr) => {
      const pts = [];
      for (let j = 0; j <= 10; j++) { const t = j / 10; pts.push(P(Math.sin(t * 5 + i) * (4 + t * 4), -t * 24)); }
      return ink(pts, rr, { w: 1.2, amt: 0.5, color: 'FF6E6660' });
    } });
    fsKids.push(group({ name: `fire smoke${i}`, id, x: FX, y: FY - 34, opacity: 0 }, [curl]));
    const at = (t) => (t + i / 2) % 1;
    const op = (u) => (u < 0.05 || u > 0.94 ? 0 : u < 0.2 ? (u - 0.05) / 0.15 : Math.max(0, 1 - (u - 0.2) / 0.74));
    fsTracks.push(
      sampled(id, 'y', 360, TICK, (t) => FY - 34 - at(t) * 64),
      sampled(id, 'x', 360, TICK, (t) => FX - at(t) * 22 + Math.sin(at(t) * 6) * 3),
      sampled(id, 'opacity', 360, TICK, (t) => op(at(t)) * 0.8),
      sampled(id, 'scaleX', 360, TICK, (t) => 0.7 + at(t) * 0.8),
      sampled(id, 'scaleY', 360, TICK, (t) => 0.7 + at(t) * 0.8)
    );
  }
  s.loopLayer('fire smoke', ambient(s, { name: 'fire smoke', duration: 360, loop: 'loop', tracks: fsTracks }));
  tp(fireSmokeId, 'opacity', [0.85, 0.9, 0.7, 0.35, 0.15]);

  // the dancers: small hobbits in their holiday colours, hand in hand, skipping
  const DRESS = [C.rose, C.sky, C.butter, '7FA65A', C.terra, C.violet];
  const HAIR = ['6B4A2A', '8A5A2E', '4E3826', 'A0703A', '5E4030', '7A5232'];
  const dancerCel = (i, c, rr) => {
    const m = c ? -1 : 1; // the other cel kicks the other leg
    const body = [P(-2.8, -14.4), P(2.8, -14.4), P(5.6, -5.2), P(-5.6, -5.4)];
    const head = circ(0, -18.4, 3.3, 3.4, 9);
    const hair = blobPts(3.6, 2.2, rng(830 + i), { n: 8, wobble: 0.2 }).map((p) => P(p.x, p.y - 20.4));
    // at this size a single dab of colour does what a full wash would (and keeps the file small)
    const dab = (pts, color, alpha, off, tension) => el('Shape', { name: 'dab' }, [pathXml(pts.map((p) => P(p.x + off + rr.jit(0.2), p.y + off + rr.jit(0.2))), { closed: true, tension }), fill(argb(color, alpha))]);
    return [
      dab(hair, HAIR[i], 0.9, 0, 1),
      dab(head, 'EBC6A0', 0.95, 0.3, 1),
      dab(body, DRESS[i], 0.92, 0.4, 0.3),
      ink([
        { pts: head, closed: true }, { pts: body, closed: true, tension: 0.3 },
        [P(-1.8 * m, -5.3), P(-2.4 * m, 0)], [P(1.8 * m, -5.3), P(3.4 * m, -2.6), P(5.4 * m, -2.2)],
        [P(-2.6, -13.4), P(-6.4, -12.6 + m * 0.8), P(-9.6, -13.6 + m * 1.2)], [P(2.6, -13.4), P(6.4, -12.6 - m * 0.8), P(9.6, -13.6 - m * 1.2)],
      ], rr, { w: 1.05, amt: 0.15, tension: 0.8, fx: fxFire }),
    ];
  };
  const N = 6, RING = 720; // 12 s a turn
  const ringTracks = [], jigTracks = [];
  const twirls = [];
  const dancerCopies = { back: [], front: [] };
  for (let i = 0; i < N; i++) {
    for (const side of ['back', 'front']) {
      const pos = ids.next(), hop = ids.next(), twirl = ids.next(), solo = ids.next();
      const rr = rng(840 + i);
      const cels = [0, 1].map((c) => ({ cid: ids.next(), c }));
      const phi = (t) => -TAU * t + (i / N) * TAU + 0.3;
      const front = (t) => Math.sin(phi(t)) > 0;
      const depth = (t) => (Math.sin(phi(t)) + 1) / 2;
      dancerCopies[side].push(group({ name: `dancer${i} ${side}`, id: pos, x: FX + RX * Math.cos(phi(0)), y: FY + RY * Math.sin(phi(0)), opacity: front(0) === (side === 'front') ? 1 : 0 }, [
        group({ name: 'hop', id: hop }, [group({ name: 'twirl', id: twirl }, [
          el('Solo', { name: 'jig', id: solo, activeComponentId: cels[0].cid }, cels.map(({ cid, c }) => el('Node', { name: `step${c}`, id: cid }, dancerCel(i, c, rr).reverse()))),
        ])]),
      ]));
      ringTracks.push(
        sampledLoose(pos, 'x', RING, TICK, (t) => FX + RX * Math.cos(phi(t))),
        sampledLoose(pos, 'y', RING, TICK, (t) => FY + RY * Math.sin(phi(t))),
        sampledLoose(pos, 'scaleX', RING, TICK, (t) => 0.98 + 0.16 * depth(t)),
        sampledLoose(pos, 'scaleY', RING, TICK, (t) => 0.98 + 0.16 * depth(t)),
      );
      // which side of the fire: a hold key each time it changes
      const vis = [];
      for (let f = 0; f <= RING; f += TICK) {
        const v = front(f / RING) === (side === 'front') ? 1 : 0;
        if (!vis.length || vis.at(-1)[1] !== v) vis.push([f, v, 'hold']);
      }
      if (vis.at(-1)[0] !== RING) vis.push([RING, vis.at(-1)[1], 'hold']);
      ringTracks.push({ object: pos, prop: 'opacity', keys: vis });
      const off = (i % 2) * 16;
      jigTracks.push(
        { object: solo, prop: 'activeComponentId', type: 'Id', keys: i % 2 ? [[0, cels[1].cid, 'hold'], [16, cels[0].cid, 'hold']] : [[0, cels[0].cid, 'hold'], [16, cels[1].cid, 'hold']] },
        sampled(hop, 'y', 32, TICK, (t) => -1.7 * Math.abs(Math.sin(TAU * (t + off / 32)))),
      );
      twirls.push({ id: twirl, i });
    }
  }
  s.loopLayer('ring', ambient(s, { name: 'ring', duration: RING, loop: 'loop', tracks: ringTracks }));
  s.loopLayer('jig', ambient(s, { name: 'jig', duration: 32, loop: 'loop', tracks: jigTracks }));
  s.add(k.in({ name: 'bonfire in', cx: FX, cy: FY, t0: 74, t1: 128, op: 0, sc: 0.85, ease: EASE.back }, [
    turfLight,
    group({ name: 'back dancers' }, dancerCopies.back),
    wc(ids, [P(FX - 17, FY + 1), P(FX + 17, FY + 1), P(FX + 1, FY - 23)], C.wood, rng(802), { alpha: 0.55, off: [1, 0], wobble: 0.6, grain: 0.4, soft: false }),
    logsInk,
    flames,
    wc(ids, [P(FX - 21, FY + 1), P(FX + 22, FY + 1), P(FX + 22, FY + 5), P(FX - 21, FY + 5)], '8A6A4A', rng(803), { alpha: 0.6, off: [0, 0], wobble: 0.5, grain: 0.3, soft: false }),
    crossInk,
    group({ name: 'fire smoke', id: fireSmokeId }, fsKids),
    group({ name: 'front dancers' }, dancerCopies.front),
  ]));

  // sparks go up off the fire all the time (they show once the light goes); these sit
  // above the hour's glaze with the firelight, added further down
  const sparkKids = [], sparkTracks = [];
  for (let i = 0; i < 8; i++) {
    const id = ids.next();
    const sr = rng(860 + i);
    const x0 = FX + sr.jit(8), y0 = FY - 24 - sr.range(0, 8), rise = sr.range(60, 96), dx = sr.jit(20), dur = 150;
    sparkKids.push(el('Shape', { name: 'spark', id, x: x0, y: y0, opacity: 0 }, [el('Ellipse', { width: 2.4, height: 2.4, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FFD46A', 1))]));
    const at = (t) => (t + i / 8 + sr() * 0.05) % 1;
    sparkTracks.push(
      sampledLoose(id, 'y', dur * 2, 8, (t) => y0 - at(t) * rise),
      sampledLoose(id, 'x', dur * 2, 8, (t) => x0 + at(t) * dx + Math.sin(at(t) * 9 + i) * 4),
      sampledLoose(id, 'opacity', dur * 2, 8, (t) => { const u = at(t); return u < 0.04 ? u / 0.04 : Math.max(0, 1 - (u - 0.04) / 0.8) ** 1.5; }),
    );
  }
  s.loopLayer('sparks', ambient(s, { name: 'sparks', duration: 300, loop: 'loop', tracks: sparkTracks }));
  // the burst when the fire flares
  const burst = Array.from({ length: 14 }, (_, i) => {
    const br = rng(880 + i);
    const a = -Math.PI / 2 + br.jit(1.15);
    return { id: ids.next(), vx: Math.cos(a) * br.range(26, 62), vy: Math.sin(a) * br.range(60, 110), end: Math.round(br.range(60, 110)), r: br.range(1.6, 3) };
  });
  const burstKids = burst.map((b) => el('Shape', { name: 'burst', id: b.id, x: FX, y: FY - 26, opacity: 0 }, [el('Ellipse', { width: b.r, height: b.r, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FFDC78', 1))]));
  const sparksId = ids.next(), fireLightId = ids.next(), flareLightId = ids.next();
  const FIRELIGHT = [0.12, 0.06, 0.3, 0.85, 1];
  const fireAbove = [
    group({ name: 'firelight', id: fireLightId, opacity: FIRELIGHT[TIME0] }, [glow({ x: FX, y: FY - 20, w: 230, h: 150, color: 'FFB048', alpha: 0.6, blend: 'screen' })]),
    group({ name: 'flare light', id: flareLightId, opacity: 0 }, [glow({ x: FX, y: FY - 24, w: 230, h: 160, color: 'FFC060', alpha: 0.5, blend: 'screen' })]),
    group({ name: 'sparks', id: sparksId, opacity: [0.45, 0.4, 0.65, 1, 1][TIME0] }, sparkKids),
    group({ name: 'burst' }, burstKids),
  ];
  tp(fireLightId, 'opacity', FIRELIGHT);
  tp(sparksId, 'opacity', [0.45, 0.4, 0.65, 1, 1]);

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
        el('Shape', { name: 'glint', id: glintId, x: D.x - 1.6, y: D.y - 1.8, opacity: 0.35 }, [el('Ellipse', { width: 2.6, height: 2.2, originX: 0.5, originY: 0.5, name: 'E' }), fill('FFFFF6DC')]),
      ]),
    ]),
    surroundInk,
  ]));

  // --- Lithe: a crown of flowers over the door, along the top of the stone ring, with a
  // posy at the top and two ribbons hanging from its ends. A knock shakes petals off it.
  const GR = RR + 3, ga0 = Math.PI * 1.12, ga1 = Math.PI * 1.87;
  const gAt = (u, dr = 0) => { const a = lerp(ga0, ga1, u); return P(D.x + Math.cos(a) * (GR + dr), D.y + Math.sin(a) * (GR + dr)); };
  const gr0 = rng(900);
  const garlandLeaves = [], garlandFlowers = [], garlandDots = [];
  for (let j = 0; j < 22; j++) {
    const u = (j + 0.5) / 22, p = gAt(u, gr0.jit(2.5)), a = lerp(ga0, ga1, u) + Math.PI / 2 + (j % 2 ? 0.7 : -0.7);
    garlandLeaves.push(wc(ids, blobPts(4.6, 2.3, gr0, { n: 7, wobble: 0.12, start: a }).map((q) => P(q.x + p.x, q.y + p.y)), j % 3 ? '6F9E4E' : '8DB86A', gr0, { alpha: 0.85, off: [0, 0], wobble: 0.3, grain: 0, soft: false }));
  }
  const GCOL = [C.rose, C.butter, 'F7F1E4', C.violet, C.terra, C.rose, 'F7F1E4', C.butter];
  const petalFrom = [];
  for (let j = 0; j < 12; j++) {
    const u = (j + 0.3 + gr0.jit(0.2)) / 12, p = gAt(u, gr0.jit(1.5)), R = gr0.range(3.4, 4.6);
    const col = GCOL[j % GCOL.length];
    garlandFlowers.push(wc(ids, blobPts(R, R * 0.9, gr0, { n: 7, wobble: 0.24 }).map((q) => P(q.x + p.x, q.y + p.y)), col, gr0, { alpha: 1, off: [0, 0], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }));
    garlandDots.push({ x: p.x + 0.4, y: p.y + 0.3, r: 1 });
    petalFrom.push({ p, col });
  }
  // the posy at the top
  const top = gAt(0.5, -1);
  for (const [dx, dy, R, col] of [[-5, -2, 4.8, C.rose], [4.5, -2.5, 4.4, C.butter], [0, -7, 4.6, 'F7F1E4'], [-1, 2, 3.6, C.violet]]) {
    garlandFlowers.push(wc(ids, blobPts(R, R * 0.92, gr0, { n: 8, wobble: 0.22 }).map((q) => P(q.x + top.x + dx, q.y + top.y + dy)), col, gr0, { alpha: 1, off: [0, 0], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }));
    garlandDots.push({ x: top.x + dx + 0.4, y: top.y + dy + 0.3, r: 1.2 });
  }
  const vine = Array.from({ length: 16 }, (_, j) => gAt(j / 15, Math.sin(j * 1.7) * 1.2));
  const vineInk = k.boil({ name: 'garland ink', seed: 901, draw: (rr) => ink([vine, ...[0.18, 0.39, 0.61, 0.82].map((u) => { const p = gAt(u, 2); return [P(p.x - 2, p.y - 1), P(p.x + 2, p.y + 1.5)]; })], rr, { w: 1.1, amt: 0.4, fx: fxDoor }) });
  // ribbons from both ends of the crown, lifting a little in the air
  const ribbonIds = [];
  const ribbon = (end, col, seed, flip) => {
    const id = ids.next();
    ribbonIds.push({ id, ph: seed });
    const rr = rng(seed);
    const spine = Array.from({ length: 7 }, (_, j) => P(Math.sin(j * 0.9 + seed) * 2.2 * flip, j * 5));
    const left = spine.map((p, j) => P(p.x - 1.7 + j * 0.05, p.y)), right = spine.map((p, j) => P(p.x + 1.7 - j * 0.05, p.y)).reverse();
    const tail = [...left, P(spine[6].x, spine[6].y - 2.2), ...right];
    return group({ name: 'ribbon', id, x: end.x, y: end.y }, [
      wc(ids, tail, col, rr, { alpha: 0.85, off: [0.4, 0.4], wobble: 0.2, grain: 0, soft: false, blend: 'normal', tension: 0.6 }),
      ink([spine.map((p) => P(p.x - 1.8, p.y)), spine.map((p) => P(p.x + 1.8, p.y))], rr, { w: 0.8, amt: 0.15, fx: fxDoor }),
    ]);
  };
  const ribbons = [ribbon(gAt(0, 1), C.rose, 910, 1), ribbon(gAt(1, 1), C.sky, 913, -1)];
  s.add(k.in({ name: 'garland in', cx: D.x, cy: D.y - GR, t0: 100, t1: 146, op: 0, sc: 0.9, ease: EASE.back }, [
    ...ribbons,
    ...garlandLeaves,
    vineInk,
    ...garlandFlowers,
    stippleShape({ name: 'flower eyes', dots: garlandDots, color: argb('B07A2A', 0.85) }),
  ]));
  s.loopLayer('ribbons', ambient(s, { name: 'ribbons', duration: 300, loop: 'loop', tracks: ribbonIds.map((r) => sampled(r.id, 'rotation', 300, TICK, (t) => Math.sin(t * TAU + r.ph) * 0.09)) }));
  // the petals a knock shakes loose
  const shedPetals = [1, 3, 5, 6, 8, 10].map((j, n) => {
    const { p, col } = petalFrom[j];
    const id = ids.next();
    const shape = [P(-2.6, 0), P(0, -1.9), P(2.6, 0), P(0, 1.9)];
    s.add(group({ name: 'petal', id, x: p.x, y: p.y, opacity: 0 }, [
      wc(ids, shape, col === 'F7F1E4' ? 'F3E9D2' : col, rng(920 + n), { alpha: 1, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
      ink({ pts: shape, closed: true }, rng(930 + n), { w: 0.7, amt: 0.1 }),
    ]));
    return { id, p, delay: n * 5 + (n % 2) * 3, drift: (p.x - D.x) * 0.5 + rng(940 + n).jit(10), seed: n };
  });

  // --- round windows, and the lantern by the door
  const wins = [P(528, 286), P(712, 282)];
  const winInk = k.boil({
    name: 'window ink', seed: 121, draw: (rr) => wins.flatMap((w) => [
      ink([{ pts: circ(w.x, w.y, 19, 19, 14), closed: true }, { pts: circ(w.x, w.y, 13.5, 13.5, 12), closed: true }], rr, { w: 1.6, amt: 0.4, fx: fxDoor }),
      ink([[P(w.x, w.y - 13), P(w.x, w.y + 13)], [P(w.x - 13, w.y), P(w.x + 13, w.y)]], rr, { w: 1, amt: 0.25, fx: fxDoor }),
    ]),
  });
  const lantern = [P(677, 256), P(687, 256), P(688, 270), P(676, 270)];
  const lanternInk = k.boil({
    name: 'lantern ink', seed: 122, draw: (rr) => ink([[P(668, 248), P(684, 248), P(682, 256)], { pts: lantern, closed: true }, [P(675, 256), P(682, 251), P(689, 256)]], rr, { w: 1.3, amt: 0.3, fx: fxDoor }),
  });
  s.add(k.in({ name: 'windows in', t0: 60, t1: 110 }, [
    ...wins.map((w, i) => wc(ids, circ(w.x, w.y, 19, 19, 14), C.terra, rng(123 + i), { alpha: 0.4, off: [1.5, 1.5], wobble: 0.8, grain: 0.4, soft: false })),
    ...wins.map((w, i) => wc(ids, circ(w.x, w.y, 13.5, 13.5, 12), C.sky, rng(125 + i), { alpha: 0.4, off: [1.5, 1], wobble: 0.8, grain: 0.3, soft: false })),
    wc(ids, lantern, C.ochre, rng(127), { alpha: 0.5, off: [1, 1], wobble: 0.4, grain: 0, soft: false }),
    winInk,
    lanternInk,
  ]));

  // --- bunting where the washing was: nobody does the washing at Lithe. Pennants in the
  // paint box's brightest colours on the old line, a paper lantern at its dip, and a
  // shorter run from the chimney to the tree over the dancers
  const washSeason = ids.next();
  const lineL = P(754, 294), lineR = P(872, 286);
  const linePts = [lineL, P(790, 302), P(813, 304), P(840, 300), lineR];
  const lineAt = (x) => { const t = (x - lineL.x) / (lineR.x - lineL.x); return lerp(lineL.y, lineR.y, t) + Math.sin(t * Math.PI) * 11; };
  const lineInk = k.boil({ name: 'line ink', seed: 131, draw: (rr) => [ink([[P(754, 342), P(754, 290)], [P(872, 334), P(872, 282)]], rr, { w: 1.9, amt: 0.4, fx: fxWash }), ink(linePts, rr, { w: 1, amt: 0.3, fx: fxWash })] });
  const swagL = P(711, 150), swagR = P(808, 161);
  const swagPts = [swagL, P(735, 160), P(760, 165), P(786, 165), swagR];
  const swagAt = (x) => { const t = (x - swagL.x) / (swagR.x - swagL.x); return lerp(swagL.y, swagR.y, t) + Math.sin(t * Math.PI) * 9; };
  const swagInk = k.boil({ name: 'swag ink', seed: 136, draw: (rr) => ink(swagPts, rr, { w: 1, amt: 0.3, fx: fxTree }) });
  const FLAGS = [C.rose, C.butter, C.sky, '86B35B', C.terra, C.violet];
  const swayTracks = [];
  const gustTracks = [];
  const pennants = (xs, at, size, seed0, fx, t0) => xs.map((x, i) => {
    const y0 = at(x);
    const sway = ids.next(), gust = ids.next();
    const fr = rng(seed0 + i);
    const outline = [P(-size * 0.42, 0), P(size * 0.42, 0), P(fr.jit(0.8), size * 1.08)];
    const ph = i * 1.3 + seed0;
    swayTracks.push(sampled(sway, 'rotation', 360, TICK, (t) => Math.sin(t * TAU + ph) * 0.07 + Math.sin(t * TAU * 2 + ph) * 0.025));
    gustTracks.push({ object: gust, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [8 + i * 2, -0.42 - (i % 3) * 0.06, 'cubic', EASE.inOut], [26 + i * 2, 0.22, 'cubic', EASE.inOut], [46 + i * 2, -0.1, 'cubic', EASE.inOut], [72 + i * 2, 0]] });
    return k.in({ name: 'pennant in', cx: x, cy: y0, t0: t0 + i * 3, t1: t0 + 34 + i * 3, sc: 0.3, ease: EASE.back }, [
      group({ name: 'pennant', x, y: y0, id: sway }, [
        group({ name: 'gust', id: gust }, [
          wc(ids, outline, FLAGS[(i + seed0) % FLAGS.length], fr, { alpha: 0.78, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false, tension: 0.2 }),
          ink({ pts: outline, closed: true }, fr, { w: 1.1, amt: 0.25, fx, tension: 0.25 }),
        ]),
      ]),
    ]);
  });
  // a paper lantern on a string: body is drawn round (cx, 0), the string runs up from it
  const lanternSways = [];
  const paperLantern = (x, y0, drop, color, seed, fx) => {
    const id = ids.next();
    const lr = rng(seed);
    const body = blobPts(6, 7, lr, { n: 12, wobble: 0.04 }).map((p) => P(p.x, p.y + drop + 7));
    const ribs = [-3, 0, 3].map((dx) => [P(dx * 0.8, drop + 1.2), P(dx * 1.25, drop + 7), P(dx * 0.8, drop + 12.8)]);
    const swing = ids.next(), lit = ids.next();
    lanternSways.push({ id, ph: seed * 0.7 });
    tp(lit, 'opacity', LIT);
    return { id, swing, xml: group({ name: 'paper lantern', id, x, y: y0 }, [group({ name: 'swing', id: swing }, [
      wc(ids, body, color, lr, { alpha: 0.7, off: [0.6, 0.6], wobble: 0.4, grain: 0.3, soft: false }),
      // lit from inside once the light goes
      group({ name: 'lantern lit', id: lit, opacity: LIT[TIME0] }, [wc(ids, body.map((p) => P(p.x * 0.86, (p.y - drop - 7) * 0.86 + drop + 7)), 'FCDD7E', lr, { alpha: 0.95, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' })]),
      ink([[P(0, 0), P(0, drop)], { pts: body, closed: true }, ...ribs, [P(-2.4, drop), P(2.4, drop)], [P(-2.2, drop + 14), P(2.2, drop + 14)]], lr, { w: 1, amt: 0.15, fx }),
    ])]), at: P(x, y0 + drop + 7) };
  };
  const lineLantern = paperLantern(813, lineAt(813), 4, C.rose, 140, fxWash);
  const treeLanterns = [paperLantern(785, 166, 9, C.butter, 141, fxTree), paperLantern(851, 158, 12, C.rose, 142, fxTree), paperLantern(830, 170, 6, C.sky, 143, fxTree)];
  const lanterns = [lineLantern, ...treeLanterns];
  s.add(group({ name: 'bunting', id: washSeason }, [
    k.in({ name: 'line in', t0: 70, t1: 110 }, [lineInk]),
    ...pennants([764, 776, 788, 801, 826, 839, 851, 862], lineAt, 12, 0, fxWash, 100),
    k.in({ name: 'line lantern in', cx: 813, cy: 300, t0: 118, t1: 150, sc: 0.4, ease: EASE.back }, [lineLantern.xml]),
  ]));
  s.add(k.in({ name: 'swag in', t0: 84, t1: 120 }, [swagInk]), ...pennants([724, 736, 748, 760, 772, 784, 796], swagAt, 9, 3, fxTree, 108));
  s.add(k.in({ name: 'tree lanterns in', t0: 112, t1: 150 }, treeLanterns.map((l) => l.xml)));
  s.loopLayer('sway', ambient(s, { name: 'sway', duration: 360, loop: 'loop', tracks: [
    ...swayTracks,
    ...lanternSways.map((l) => sampled(l.id, 'rotation', 360, TICK, (t) => Math.sin(t * TAU + l.ph) * 0.05)),
  ] }));

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

  // --- flowers: by the door, under the right window, along the path
  const flowerSeason = ids.next();
  const cols = [C.rose, C.violet, C.butter, C.terra, C.white];
  const fspots = [
    [568, 334], [578, 340], [663, 336], [672, 330], [684, 337],
    [694, 308], [704, 312], [716, 309], [728, 313], [740, 309],
    [454, 356], [470, 352], [596, 366], [620, 362], [366, 374],
    [160, 362], [196, 358], [262, 364],
  ];
  const clusters = [[0, 5], [5, 10], [10, 15], [15, 18]];
  const flowerXml = clusters.map(([a, b], ci) => {
    const kids = [];
    const stems = [];
    let sx = 0, sy = 0;
    for (let i = a; i < b; i++) {
      const [fx, fy] = fspots[i];
      sx += fx; sy += fy;
      const fr = rng(160 + i);
      kids.push(wc(ids, blobPts(5.4, 4.6, fr, { n: 7, wobble: 0.22 }).map((p) => P(p.x + fx, p.y + fy - 9)), cols[i % cols.length], fr, { alpha: 1, off: [0, 0], wobble: 0.4, grain: 0, soft: false, blend: 'normal' }));
      stems.push([P(fx, fy + 3), P(fx + fr.jit(1.2), fy - 5)]);
    }
    kids.push(ink(stems, rng(170 + ci), { w: 1.1, amt: 0.3, fx: fxGarden }));
    return k.in({ name: `flowers${ci}`, cx: sx / (b - a), cy: sy / (b - a), t0: 108 + ci * 9, t1: 150 + ci * 9, sc: 0.2, ease: EASE.back }, kids);
  });
  s.add(group({ name: 'flowers', id: flowerSeason }, flowerXml));
  sp(flowerSeason, 'opacity', [1, 1, 0.4, 0]);

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

  // --- Lithe: the Midyear's feast, laid on a trestle table where the kitchen garden was:
  // a pie still steaming, strawberries, a cake with a flower on it, a jug and two mugs
  // of ale (which clink when you click the table)
  const TB = { x0: 722, x1: 866, y: 352 };
  const clothTop = [P(TB.x0 + 4, TB.y - 6), P(TB.x1 - 4, TB.y - 7), P(TB.x1, TB.y), P(TB.x0, TB.y + 1)];
  const hem = [];
  for (let x = TB.x1 + 1, j = 0; x >= TB.x0 - 1; x -= 9, j++) hem.push(P(x, TB.y + 14 + (j % 2 ? 3 : 0)));
  const clothFront = [P(TB.x0, TB.y + 1), P(TB.x1, TB.y), ...hem];
  const trestles = [742, 846].flatMap((x) => [[P(x - 7, TB.y + 15), P(x + 6, 388)], [P(x + 6, TB.y + 15), P(x - 7, 388)]]);
  const pie = { x: 746, y: TB.y - 4 };
  const pieDome = [P(pie.x - 13, pie.y), P(pie.x - 9, pie.y - 6), P(pie.x, pie.y - 8.5), P(pie.x + 9, pie.y - 6), P(pie.x + 13, pie.y)];
  const lattice = [-7, -2, 3, 8].map((dx) => [P(pie.x + dx - 2, pie.y - 1), P(pie.x + dx + 2, pie.y - 7.5 + Math.abs(dx) * 0.35)]);
  const bowl = [P(762, TB.y - 9), P(780, TB.y - 9), P(777, TB.y - 4), P(771, TB.y - 3), P(765, TB.y - 4)];
  const berries = [[765, -10.5], [769.5, -11.5], [774, -10.8], [778, -10], [767.5, -13.5], [772, -14]].map(([x, dy]) => ({ x, y: TB.y + dy, r: 2.1 }));
  const cake = { x: 798 };
  const tier1 = [P(cake.x - 13, TB.y - 5), P(cake.x - 13, TB.y - 16), P(cake.x + 13, TB.y - 16), P(cake.x + 13, TB.y - 5)];
  const tier2 = [P(cake.x - 8, TB.y - 16), P(cake.x - 8, TB.y - 25), P(cake.x + 8, TB.y - 25), P(cake.x + 8, TB.y - 16)];
  const drips = (x0, x1, y) => { const pts = []; for (let x = x0, j = 0; x <= x1; x += 2.6, j++) pts.push(P(x, y + (j % 3 === 1 ? 3 : 0.6))); return pts; };
  const jug = [P(818, TB.y - 5), P(816, TB.y - 13), P(819, TB.y - 20), P(818, TB.y - 24), P(828, TB.y - 24), P(827, TB.y - 20), P(830, TB.y - 13), P(828, TB.y - 5)];
  const feastInk = k.boil({
    name: 'feast ink', seed: 960, draw: (rr) => [
      ink([{ pts: clothTop, closed: true, tension: 0.2 }, { pts: clothFront, closed: true, tension: 0.4 }], rr, { w: 1.4, amt: 0.35, fx: fxGarden }),
      ink(trestles, rr, { w: 1.6, amt: 0.3, fx: fxGarden }),
      ink([pieDome, [P(pie.x - 15, pie.y + 0.5), P(pie.x + 15, pie.y)], { pts: bowl, closed: true, tension: 0.5 }, { pts: tier1, closed: true, tension: 0.15 }, { pts: tier2, closed: true, tension: 0.15 }, { pts: jug, closed: true, tension: 0.5 }, [P(828, TB.y - 20), P(833, TB.y - 17), P(829, TB.y - 11)], [P(818, TB.y - 24), P(815.5, TB.y - 26)]], rr, { w: 1.2, amt: 0.25, fx: fxGarden }),
      ink([...lattice, drips(cake.x - 13, cake.x + 13, TB.y - 16), drips(cake.x - 8, cake.x + 8, TB.y - 25)], rr, { w: 0.8, amt: 0.15, color: INK_SOFT, fx: fxGarden }),
    ],
  });
  // the mugs, each pivoting at its foot so they can be raised and clinked
  const mugIds = [ids.next(), ids.next()];
  const mugBody = [P(-3.6, 0), P(-3.8, -9.5), P(3.8, -9.5), P(3.6, 0)];
  const mugs = [[842, 1], [855, -1]].map(([x, flip], i) => group({ name: 'mug', id: mugIds[i], x, y: TB.y - 5 }, [
    wc(ids, mugBody, 'B88A52', rng(970 + i), { alpha: 0.85, off: [0.4, 0.4], wobble: 0.2, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, [P(-3.9, -9.4), P(-2.5, -11.6), P(0, -12.2), P(2.6, -11.5), P(3.9, -9.4)], 'F7EFDC', rng(972 + i), { alpha: 1, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
    ink([{ pts: mugBody, closed: true, tension: 0.2 }, [P(3.6 * flip, -7.5), P(6.4 * flip, -6.5), P(6.2 * flip, -2.8), P(3.6 * flip, -2)], [P(-3.9, -9.4), P(-2.5, -11.6), P(0, -12.2), P(2.6, -11.5), P(3.9, -9.4)]], rng(974 + i), { w: 1.1, amt: 0.15, fx: fxGarden }),
  ]));
  const clinkId = ids.next();
  const pieSteam = ids.next();
  const steamCurl = k.boil({ name: 'pie steam', seed: 976, draw: (rr) => {
    const pts = [];
    for (let j = 0; j <= 9; j++) { const t = j / 9; pts.push(P(Math.sin(t * 6) * (1.5 + t * 2.5), -t * 16)); }
    return ink(pts, rr, { w: 1, amt: 0.3, color: 'FF8A817A' });
  } });
  s.add(k.in({ name: 'feast in', cx: 794, cy: 388, t0: 80, t1: 134, sc: 0.94 }, [
    wc(ids, clothFront, 'F4EAD0', rng(961), { alpha: 1, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, [P(TB.x0, TB.y + 8), P(TB.x1, TB.y + 7), P(TB.x1, TB.y + 10.5), P(TB.x0, TB.y + 11.5)], C.rose, rng(962), { alpha: 0.6, off: [0, 0], wobble: 0.4, grain: 0.2, soft: false }),
    wc(ids, clothTop, 'F8F0DC', rng(963), { alpha: 1, off: [0.5, 0.5], wobble: 0.4, grain: 0.2, soft: false, blend: 'normal' }),
    wc(ids, [...pieDome, P(pie.x + 14, pie.y + 0.5), P(pie.x - 14, pie.y + 0.5)], C.ochre, rng(964), { alpha: 0.85, off: [0.5, 0.5], wobble: 0.4, grain: 0.5, soft: false }),
    wc(ids, bowl, C.sky, rng(965), { alpha: 0.6, off: [0.4, 0.4], wobble: 0.3, grain: 0, soft: false }),
    stippleShape({ name: 'strawberries', dots: berries, color: argb('D9473A', 0.92) }),
    wc(ids, tier1, 'F7EFDC', rng(966), { alpha: 1, off: [0.5, 0.5], wobble: 0.3, grain: 0.1, soft: false, blend: 'normal' }),
    wc(ids, tier2, 'F7EFDC', rng(967), { alpha: 1, off: [0.5, 0.5], wobble: 0.3, grain: 0.1, soft: false, blend: 'normal' }),
    wc(ids, [P(cake.x - 13, TB.y - 16), P(cake.x + 13, TB.y - 16), P(cake.x + 13, TB.y - 13), P(cake.x - 13, TB.y - 13)], C.rose, rng(968), { alpha: 0.5, off: [0, 0], wobble: 0.3, grain: 0, soft: false }),
    wc(ids, blobPts(3.6, 3.2, rng(969), { n: 7, wobble: 0.25 }).map((q) => P(q.x + cake.x, q.y + TB.y - 28)), C.rose, rng(969), { alpha: 1, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, jug, C.terra, rng(975), { alpha: 0.8, off: [0.6, 0.6], wobble: 0.3, grain: 0.3, soft: false }),
    feastInk,
    ...mugs,
    group({ name: 'pie steam', id: pieSteam, x: pie.x, y: pie.y - 9, opacity: 0 }, [steamCurl]),
    group({ name: 'clink', id: clinkId, opacity: 0 }, [ink([[P(846, 330), P(844, 325)], [P(849.5, 329.5), P(850, 324)], [P(852.5, 331), P(856, 327.5)]], rng(978), { w: 1.1, amt: 0.15 })]),
  ]));
  s.loopLayer('pie steam', ambient(s, { name: 'pie steam', duration: 280, loop: 'loop', tracks: [
    sampled(pieSteam, 'y', 280, TICK, (t) => pie.y - 9 - t * 18),
    sampled(pieSteam, 'opacity', 280, TICK, (t) => (t < 0.05 || t > 0.95 ? 0 : t < 0.25 ? (t - 0.05) * 3.5 : Math.max(0, 0.7 * (1 - (t - 0.25) / 0.7)))),
  ] }));
  shadowsLow.push(shadow(794, 388, 46, 6, 979));
  tp(shadowIds.at(-1), 'scaleX', SHADOW.map((v) => v[0]));
  tp(shadowIds.at(-1), 'opacity', SHADOW.map((v) => v[1]));
  s.add(k.in({ name: 'low shadows in', t0: 110, t1: 150 }, shadowsLow));

  // (Lithe is only ever summer: the other seasons' weather, snow and fallen leaves are left out)
  // summer's warmth: a golden haze lying over the far hills
  const hazeId = ids.next();
  s.add(group({ name: 'summer haze', id: hazeId, opacity: SEASON0 === 1 ? 1 : 0 }, [
    wc(ids, blobPts(300, 60, rng(275), { n: 14, wobble: 0.12 }).map((p) => P(p.x + 420, p.y + 250)), 'F0CF78', rng(276), { alpha: 0.3, off: [0, 0], grain: 0.1, soft: true, hazy: true }),
  ]));
  sp(hazeId, 'opacity', [0, 1, 0, 0]);
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
  s.add(k.in({ name: 'lit in', t0: 96, t1: 150 }, [
    group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
      ...wins.map((w) => glow({ x: w.x, y: w.y + 4, w: 100, h: 86, color: C.lamp, alpha: 0.42 })),
      ...wins.map((w, i) => el('Shape', { name: 'pane', x: w.x, y: w.y }, [el('Ellipse', { width: 26, height: 26, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('F7CB5C', 0.88))])),
      ...wins.map((w, i) => ink([[P(w.x, w.y - 13), P(w.x, w.y + 13)], [P(w.x - 13, w.y), P(w.x + 13, w.y)]], rng(270 + i), { w: 1.1, amt: 0.2 })),
      glow({ x: 682, y: 264, w: 70, h: 70, color: C.lamp, alpha: 0.6 }),
      el('Shape', { name: 'flame', x: 682, y: 264 }, [el('Ellipse', { width: 6, height: 9, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
      glow({ x: 560, y: 368, w: 200, h: 46, color: C.lamp, alpha: 0.22 }),
      ...lanterns.map((l) => glow({ x: l.at.x, y: l.at.y, w: 46, h: 46, color: C.lamp, alpha: 0.5, blend: 'screen' })),
      glow({ x: 794, y: 352, w: 170, h: 40, color: C.lamp, alpha: 0.2 }),
    ]),
  ]));
  tp(litId, 'opacity', LIT);
  // the bonfire's light and its sparks (from further up)
  s.add(k.in({ name: 'firelight in', t0: 96, t1: 140 }, fireAbove));
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

  // fireflies on midsummer evenings, over the feast and the hill's foot; brush past them
  // and they scatter, then drift back
  const flyKids = [];
  const ffTracks = [];
  const ffDur = 480;
  const scatters = [];
  for (let i = 0; i < 9; i++) {
    const id = ids.next(), sc = ids.next();
    const fr = rng(380 + i);
    const x0 = i < 7 ? fr.range(600, 884) : fr.range(560, 700), y0 = i < 7 ? fr.range(300, 384) : fr.range(196, 236);
    flyKids.push(group({ name: 'scatter', id: sc }, [group({ name: 'firefly', id, x: x0, y: y0, opacity: 0 }, [glow({ x: 0, y: 0, w: 14, h: 14, color: 'F9E27A', alpha: 0.95 })])]));
    const d = Math.hypot(x0 - 745, y0 - 330) || 1;
    scatters.push({ id: sc, dx: ((x0 - 745) / d) * fr.range(24, 40), dy: ((y0 - 330) / d) * fr.range(14, 26) - 10, delay: Math.round(fr.range(0, 6)) });
    const ph = fr();
    ffTracks.push(
      sampledLoose(id, 'x', ffDur, TICK, (t) => x0 + Math.sin((t + ph) * TAU) * 14),
      sampledLoose(id, 'y', ffDur, TICK, (t) => y0 + Math.sin((t + ph) * TAU * 2) * 6),
      sampledLoose(id, 'opacity', ffDur, TICK, (t) => Math.max(0, Math.sin(((t * 3 + ph) % 1) * TAU)) ** 2)
    );
  }
  const ffId = ids.next();
  s.add(group({ name: 'fireflies', id: ffId, opacity: TIME0 >= 3 ? 1 : 0 }, flyKids));
  tp(ffId, 'opacity', [0, 0, 0, 1, 1]);
  gatedLoop(s, 'fireflies', ambient(s, { name: 'fireflies', duration: ffDur, loop: 'loop', tracks: ffTracks }), [[time, 'greaterThanOrEqual', 3]]);

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
  const hDoor = ids.next(), hBench = ids.next(), hWash = ids.next(), hTree = ids.next(), hMail = ids.next(), hSun = ids.next();
  s.add(hit(hDoor, D.x, D.y, 108, 104), hit(hBench, 519, 328, 92, 40), hit(hWash, 813, 312, 130, 66), hit(hTree, tx + 4, tb - 70, 116, 130), hit(hMail, 394, 360, 34, 60), hit(hSun, 200, 90, 220, 140));

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

  const gust = s.input('trigger', 'gust');
  s.triggerLayer('gust', gust, s.anim({ name: 'gust', duration: 100, tracks: [...gustTracks, { object: lineLantern.swing, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [12, -0.3, 'cubic', EASE.inOut], [32, 0.16, 'cubic', EASE.inOut], [56, -0.06, 'cubic', EASE.inOut], [84, 0]] }] }), { fromAny: false });
  s.listen(hWash, 'enter', [Scene.fire(gust)]);

  const rustle = s.input('trigger', 'rustle');
  s.triggerLayer('rustle', rustle, s.anim({ name: 'rustle', duration: 170, tracks: [
    ...treeLanterns.map((l, i) => ({ object: l.swing, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [10 + i * 3, 0.22 * (i % 2 ? -1 : 1), 'cubic', EASE.inOut], [28 + i * 3, 0.121 * (i % 2 ? 1 : -1), 'cubic', EASE.inOut], [46 + i * 3, 0.048 * (i % 2 ? -1 : 1), 'cubic', EASE.inOut], [70 + i * 3, 0]] })),
    { object: rustleId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [10, 0.045, 'cubic', EASE.inOut], [24, -0.03, 'cubic', EASE.inOut], [40, 0.015, 'cubic', EASE.inOut], [58, 0]] },
    { object: dropId, prop: 'opacity', keys: [[0, 0, 'linear'], [8, 1, 'hold'], [140, 1, 'linear'], [170, 0]] },
    sampled(dropId, 'y', 170, 10, (t) => tb - 92 + t * 150),
    sampled(dropId, 'x', 170, 10, (t) => tx + 30 + Math.sin(t * 9) * 10 - t * 40),
    sampled(dropId, 'rotation', 170, 10, (t) => Math.sin(t * 9) * 0.8),
  ] }), { fromAny: false });
  s.listen(hTree, 'enter', [Scene.fire(rustle)]);
  const shake = s.input('trigger', 'shake');
  const groundY = tb + 4;
  s.triggerLayer('shake', shake, s.anim({ name: 'shake', duration: 210, tracks: [
    ...treeLanterns.map((l, i) => ({ object: l.swing, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [6 + i * 3, 0.36 * (i % 2 ? -1 : 1), 'cubic', EASE.inOut], [20 + i * 3, 0.198 * (i % 2 ? 1 : -1), 'cubic', EASE.inOut], [34 + i * 3, 0.079 * (i % 2 ? -1 : 1), 'cubic', EASE.inOut], [54 + i * 3, 0]] })),
    { object: rustleId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [5, 0.05, 'cubic', EASE.inOut], [11, -0.045, 'cubic', EASE.inOut], [17, 0.035, 'cubic', EASE.inOut], [24, -0.022, 'cubic', EASE.inOut], [34, 0.01, 'cubic', EASE.inOut], [46, 0]] },
    ...fall.flatMap((f) => {
      const end = Math.min(210, f.delay + f.len);
      const t = (u) => Math.max(0, Math.min(1, (u * 210 - f.delay) / f.len));
      return [
        { object: f.id, prop: 'opacity', keys: [[0, 0, 'hold'], [f.delay, 1, 'hold'], [end - 22, 1, 'linear'], [end, 0]] },
        sampled(f.id, 'y', 210, 10, (u) => f.y + t(u) * (groundY - f.y)),
        sampled(f.id, 'x', 210, 10, (u) => f.x + Math.sin(t(u) * 8 + f.seed) * 9 + t(u) * f.drift),
        sampled(f.id, 'rotation', 210, 10, (u) => Math.sin(t(u) * 8 + f.seed) * 0.9),
      ];
    }),
  ] }), { fromAny: false, mix: 0 });
  s.listen(hTree, 'click', [Scene.fire(shake)]);

  const post = s.input('trigger', 'post');
  s.triggerLayer('post', post, s.anim({ name: 'post', duration: 210, tracks: [
    { object: flagId, prop: 'rotation', keys: [[0, 0, 'elastic', { amplitude: 1, period: 0.5 }], [40, -Math.PI / 2, 'hold'], [160, -Math.PI / 2, 'cubic', EASE.inOut], [200, 0]] },
  ] }), { fromAny: false });
  s.listen(hMail, 'enter', [Scene.fire(post)]);

  // --- Lithe's own reactions
  const hFire = ids.next(), hRingL = ids.next(), hRingR = ids.next(), hFeast = ids.next(), hFlies = ids.next();
  s.add(hit(hFire, FX, FY - 17, 34, 42), hit(hRingL, FX - 37, FY - 10, 30, 36), hit(hRingR, FX + 37, FY - 10, 30, 36), hit(hFeast, 794, 350, 150, 46), hit(hFlies, 745, 344, 300, 92));
  // the bonfire leaps up and throws a shower of sparks
  const flare = s.input('trigger', 'flare');
  s.triggerLayer('flare', flare, s.anim({ name: 'flare', duration: 120, tracks: [
    { object: flareId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [9, 1.75, 'cubic', EASE.inOut], [28, 1.3, 'cubic', EASE.inOut], [48, 1.45, 'cubic', EASE.inOut], [100, 1]] },
    { object: flareId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [9, 1.3, 'cubic', EASE.inOut], [40, 1.15, 'cubic', EASE.inOut], [100, 1]] },
    { object: flareLightId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [8, 1, 'cubic', EASE.inOut], [110, 0]] },
    ...burst.flatMap((b) => {
      const at = (u) => Math.min(1, (u * 120) / b.end);
      return [
        { object: b.id, prop: 'opacity', keys: [[0, 0, 'hold'], [3, 1, 'hold'], [Math.round(b.end * 0.6), 1, 'linear'], [b.end, 0, 'hold'], [120, 0, 'hold']] },
        sampledLoose(b.id, 'x', 120, 4, (u) => FX + b.vx * at(u) + Math.sin(at(u) * 7 + b.r) * 3),
        sampledLoose(b.id, 'y', 120, 4, (u) => FY - 26 + b.vy * at(u) + 70 * at(u) * at(u)),
      ];
    }),
  ] }), { fromAny: false, mix: 0 });
  s.listen(hFire, 'click', [Scene.fire(flare), Scene.emit(s.event('fire'))]);
  // the dancers each turn about in place, one after another round the ring
  const dance = s.input('trigger', 'dance');
  s.triggerLayer('dance', dance, s.anim({ name: 'dance', duration: 120, tracks: twirls.flatMap(({ id, i }) => {
    const d = i * 8;
    return [
      { object: id, prop: 'scaleX', keys: [[0, 1, 'hold'], [d, 1, 'cubic', EASE.inOut], [d + 9, -1, 'cubic', EASE.inOut], [d + 18, 1, 'cubic', EASE.inOut], [d + 27, -1, 'cubic', EASE.inOut], [d + 36, 1, 'hold'], [120, 1]] },
      { object: id, prop: 'y', keys: [[0, 0, 'hold'], [d, 0, 'cubic', EASE.out], [d + 9, -6, 'cubic', EASE.in], [d + 18, 0, 'cubic', EASE.out], [d + 27, -5, 'cubic', EASE.in], [d + 36, 0, 'hold'], [120, 0]] },
    ];
  }) }), { fromAny: false, mix: 0 });
  const danceEv = s.event('dance');
  s.listen(hRingL, 'click', [Scene.fire(dance), Scene.emit(danceEv)]);
  s.listen(hRingR, 'click', [Scene.fire(dance), Scene.emit(danceEv)]);
  // a knock (or a slam) shakes petals off the garland onto the step
  const shed = s.input('trigger', 'petals');
  s.triggerLayer('shed', shed, s.anim({ name: 'shed petals', duration: 150, tracks: [
    ...ribbonIds.map((r, i) => ({ object: r.id, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [6, i ? -0.3 : 0.3, 'cubic', EASE.inOut], [18, i ? 0.18 : -0.18, 'cubic', EASE.inOut], [34, 0]] })),
    ...shedPetals.flatMap((f) => {
      const len = 150 - f.delay - 6;
      const t = (u) => Math.max(0, Math.min(1, (u * 150 - f.delay) / len));
      const floor = 338 + (f.seed % 3) * 2;
      return [
        { object: f.id, prop: 'opacity', keys: [[0, 0, 'hold'], [f.delay, 1, 'hold'], [f.delay + len - 24, 1, 'linear'], [f.delay + len, 0, 'hold'], [150, 0, 'hold']] },
        sampled(f.id, 'y', 150, 6, (u) => f.p.y + t(u) * (floor - f.p.y)),
        sampled(f.id, 'x', 150, 6, (u) => f.p.x + Math.sin(t(u) * 7 + f.seed) * 6 + t(u) * f.drift),
        sampled(f.id, 'rotation', 150, 6, (u) => Math.sin(t(u) * 7 + f.seed) * 1.1),
      ];
    }),
  ] }), { fromAny: false, mix: 0 });
  // the mugs at the feast are raised and clinked
  const cheers = s.input('trigger', 'cheers');
  s.triggerLayer('cheers', cheers, s.anim({ name: 'cheers', duration: 70, tracks: [
    ...mugIds.flatMap((id, i) => {
      const m = i ? -1 : 1, x0 = i ? 855 : 842;
      return [
        { object: id, prop: 'y', keys: [[0, TB.y - 5, 'cubic', EASE.out], [12, TB.y - 13, 'hold'], [40, TB.y - 13, 'cubic', EASE.inOut], [58, TB.y - 5]] },
        { object: id, prop: 'x', keys: [[0, x0, 'cubic', EASE.inOut], [13, x0 + m * 2.4, 'cubic', EASE.out], [16, x0 + m * 1.4, 'hold'], [40, x0 + m * 1.4, 'cubic', EASE.inOut], [58, x0]] },
        { object: id, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [13, 0.34 * m, 'cubic', EASE.out], [16, 0.26 * m, 'hold'], [40, 0.26 * m, 'cubic', EASE.inOut], [58, 0]] },
      ];
    }),
    { object: clinkId, prop: 'opacity', keys: [[0, 0, 'hold'], [13, 1, 'hold'], [26, 1, 'linear'], [38, 0]] },
  ] }), { fromAny: false, mix: 0 });
  s.listen(hFeast, 'click', [Scene.fire(cheers), Scene.emit(s.event('feast'))]);
  // brush past the fireflies and they scatter
  const scatter = s.input('trigger', 'scatter');
  s.triggerLayer('scatter', scatter, s.anim({ name: 'scatter', duration: 170, tracks: scatters.flatMap((f) => [
    { object: f.id, prop: 'x', keys: [[0, 0, 'hold'], [f.delay, 0, 'cubic', EASE.out], [f.delay + 22, f.dx, 'cubic', EASE.inOut], [170, 0]] },
    { object: f.id, prop: 'y', keys: [[0, 0, 'hold'], [f.delay, 0, 'cubic', EASE.out], [f.delay + 22, f.dy, 'cubic', EASE.inOut], [170, 0]] },
  ]) }), { fromAny: false, mix: 0 });
  s.listen(hFlies, 'enter', [Scene.fire(scatter)]);

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
  // a wreath of leaves and flowers hung on the gate for Lithe, with a ribbon bow
  const W0 = P(392, 132), wr = rng(990);
  const wreathLeaves = [], wreathFlowers = [], wreathDots = [];
  for (let j = 0; j < 16; j++) {
    const a = (j / 16) * TAU, p = P(W0.x + Math.cos(a) * 13, W0.y + Math.sin(a) * 13);
    wreathLeaves.push(wc(ids, blobPts(4.4, 2.2, wr, { n: 7, wobble: 0.12, start: a + Math.PI / 2 + (j % 2 ? 0.6 : -0.6) }).map((q) => P(q.x + p.x, q.y + p.y)), j % 3 ? '6F9E4E' : '8DB86A', wr, { alpha: 0.88, off: [0, 0], wobble: 0.3, grain: 0, soft: false }));
  }
  for (let j = 0; j < 7; j++) {
    const a = (j / 7) * TAU + 0.4, p = P(W0.x + Math.cos(a) * 13, W0.y + Math.sin(a) * 13);
    wreathFlowers.push(wc(ids, blobPts(3.6, 3.2, wr, { n: 7, wobble: 0.22 }).map((q) => P(q.x + p.x, q.y + p.y)), [C.rose, C.butter, 'F7F1E4', C.violet, C.terra, C.rose, C.butter][j], wr, { alpha: 1, off: [0, 0], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }));
    wreathDots.push({ x: p.x + 0.3, y: p.y + 0.3, r: 0.9 });
  }
  const bow = [P(W0.x, W0.y + 14), P(W0.x - 7, W0.y + 10), P(W0.x - 7, W0.y + 17), P(W0.x, W0.y + 14), P(W0.x + 7, W0.y + 10), P(W0.x + 7, W0.y + 17)];
  const tails = [[P(W0.x - 1, W0.y + 15), P(W0.x - 4, W0.y + 22), P(W0.x - 3, W0.y + 29)], [P(W0.x + 1, W0.y + 15), P(W0.x + 4, W0.y + 23), P(W0.x + 6, W0.y + 29)]];
  const wreath = group({ name: 'wreath' }, [
    ink({ pts: circ(W0.x, W0.y, 13, 13, 14), closed: true }, wr, { w: 1, amt: 0.4, color: 'FF4F7F36', fx: fxGate }),
    ...wreathLeaves,
    ...wreathFlowers,
    stippleShape({ name: 'wreath eyes', dots: wreathDots, color: argb('B07A2A', 0.9) }),
    wc(ids, [P(W0.x, W0.y + 14), P(W0.x - 7, W0.y + 10), P(W0.x - 7, W0.y + 17)], C.rose, wr, { alpha: 0.9, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, [P(W0.x, W0.y + 14), P(W0.x + 7, W0.y + 10), P(W0.x + 7, W0.y + 17)], C.rose, wr, { alpha: 0.9, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
    ink([{ pts: [bow[0], bow[1], bow[2]], closed: true }, { pts: [bow[3], bow[4], bow[5]], closed: true }, ...tails], wr, { w: 1, amt: 0.15, tension: 0.4, fx: fxGate }),
  ]);
  s.add(k.in({ name: 'gate in', t0: 14, t1: 60 }, [
    group({ name: 'leaf', id: leafId, x: 314, y: 0, scaleX: 0.74 }, [
      group({ name: 'leaf body', x: -314, y: 0 }, [wc(ids, gateWash, C.door, rng(421), { alpha: 0.34, off: [2, 2], grain: 0.4, soft: false }), gateInk, wreath]),
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

  // ground, flowers
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

  const flowersId = ids.next();
  const fl = [];
  const stems = [];
  const fspots = [[20, 186], [44, 190], [94, 184], [190, 188], [236, 184], [262, 190], [338, 190], [400, 188], [496, 186], [584, 188]];
  const cols = [C.rose, C.butter, C.violet, C.terra, C.white];
  fspots.forEach(([x, y], i) => {
    const fr = rng(450 + i);
    fl.push(wc(ids, blobPts(5, 4.4, fr, { n: 7, wobble: 0.2 }).map((p) => P(p.x + x, p.y + y - 12)), cols[i % 5], fr, { alpha: 0.9, off: [0, 0], wobble: 0.4, grain: 0, soft: false }));
    stems.push([P(x, y + 2), P(x + fr.jit(1.4), y - 7)]);
  });
  fl.push(ink(stems, rng(460), { w: 1.1, amt: 0.3, fx: fxBack }));
  s.add(group({ name: 'flowers', id: flowersId }, [k.in({ name: 'flowers in', cx: 300, cy: 186, t0: 40, t1: 84, sc: 0.85, ease: EASE.back }, fl)]));
  seasonP.push({ object: flowersId, prop: 'opacity', vals: [1, 1, 0.4, 0] });

  // --- Lithe at the gate: bunting between the gateposts, a wreath on the gate, a daisy
  // chain along the top of the sign, and fireflies along the hedge in the evening
  const GFLAGS = [C.rose, C.butter, C.sky, '86B35B', C.terra, C.violet];
  const gBunt = { l: P(307, 60), r: P(453, 60) };
  const gAt = (x) => { const t = (x - gBunt.l.x) / (gBunt.r.x - gBunt.l.x); return lerp(gBunt.l.y, gBunt.r.y, t) + Math.sin(t * Math.PI) * 14; };
  const gLine = Array.from({ length: 9 }, (_, j) => { const x = lerp(gBunt.l.x, gBunt.r.x, j / 8); return P(x, gAt(x)); });
  const gFlutter = [], gSway = [];
  const gPennants = [322, 338, 354, 370, 386, 402, 418, 434].map((x, i) => {
    const y0 = gAt(x), sway = ids.next(), gust = ids.next(), fr = rng(1000 + i);
    const outline = [P(-5, 0), P(5, 0), P(fr.jit(0.8), 13)];
    gSway.push(sampled(sway, 'rotation', 360, TICK, (t) => Math.sin(t * TAU + i * 1.3) * 0.07));
    gFlutter.push({ object: gust, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [8 + i * 2, -0.4 - (i % 3) * 0.05, 'cubic', EASE.inOut], [26 + i * 2, 0.2, 'cubic', EASE.inOut], [46 + i * 2, -0.08, 'cubic', EASE.inOut], [72 + i * 2, 0]] });
    return group({ name: 'pennant', id: sway, x, y: y0 }, [group({ name: 'gust', id: gust }, [
      wc(ids, outline, GFLAGS[i % GFLAGS.length], fr, { alpha: 0.78, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false, tension: 0.2 }),
      ink({ pts: outline, closed: true }, fr, { w: 1.1, amt: 0.25, fx: fxGate, tension: 0.25 }),
    ])]);
  });
  const gLineInk = k.boil({ name: 'gate bunting ink', seed: 1010, draw: (rr) => ink(gLine, rr, { w: 1, amt: 0.3, fx: fxGate }) });
  s.add(k.in({ name: 'gate bunting in', cx: 380, cy: 70, t0: 40, t1: 80, op: 0, dy: -6 }, [gLineInk, ...gPennants]));
  s.loopLayer('gate bunting', ambient(s, { name: 'gate bunting', duration: 360, loop: 'loop', tracks: gSway }));
  const flutter = s.input('trigger', 'flutter');
  s.triggerLayer('flutter', flutter, s.anim({ name: 'flutter', duration: 100, tracks: gFlutter }), { fromAny: false });
  const hBunt = ids.next();
  s.add(hit(hBunt, 380, 72, 150, 34));
  s.listen(hBunt, 'enter', [Scene.fire(flutter)]);

  // a daisy chain along the sign's top edge, drooping at the corners
  const chain = [];
  const cr = rng(1020);
  for (let j = 0; j < 17; j++) {
    const t = j / 16, x = lerp(40, 262, t), y = lerp(44, 40, t) + Math.sin(t * Math.PI * 4) * 1.6 + (t < 0.06 || t > 0.94 ? 4 : 0);
    chain.push(P(x, y));
  }
  const daisies = chain.filter((_, j) => j % 2 === 0).map((p, j) => wc(ids, blobPts(4, 3.6, cr, { n: 7, wobble: 0.22 }).map((q) => P(q.x + p.x, q.y + p.y)), j % 3 === 1 ? C.butter : j % 3 === 2 ? C.rose : 'F7F1E4', cr, { alpha: 1, off: [0, 0], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }));
  s.add(k.in({ name: 'daisy chain in', cx: 150, cy: 42, t0: 50, t1: 86, op: 0, sc: 0.9 }, [
    ink(chain, rng(1021), { w: 1, amt: 0.4, color: 'FF4F7F36', fx: fxSign }),
    ...daisies,
    stippleShape({ name: 'daisy eyes', dots: chain.filter((_, j) => j % 2 === 0).map((p) => ({ x: p.x + 0.3, y: p.y + 0.2, r: 1.1 })), color: argb('B07A2A', 0.9) }),
  ]));

  // fireflies along the hedge on midsummer evenings
  const gFly = [], gFlyTracks = [];
  for (let i = 0; i < 6; i++) {
    const id = ids.next(), fr = rng(1030 + i);
    const x0 = fr.range(40, 580), y0 = fr.range(120, 178);
    gFly.push(group({ name: 'firefly', id, x: x0, y: y0, opacity: 0 }, [glow({ x: 0, y: 0, w: 13, h: 13, color: 'F9E27A', alpha: 0.95 })]));
    const ph = fr();
    gFlyTracks.push(
      sampledLoose(id, 'x', 480, TICK, (t) => x0 + Math.sin((t + ph) * TAU) * 12),
      sampledLoose(id, 'y', 480, TICK, (t) => y0 + Math.sin((t + ph) * TAU * 2) * 5),
      sampledLoose(id, 'opacity', 480, TICK, (t) => Math.max(0, Math.sin(((t * 3 + ph) % 1) * TAU)) ** 2),
    );
  }
  const gFlyId = ids.next();
  s.add(group({ name: 'fireflies', id: gFlyId, opacity: TIME0 >= 3 ? 1 : 0 }, gFly));
  timeP.push({ object: gFlyId, prop: 'opacity', vals: [0, 0, 0, 1, 1] });
  gatedLoop(s, 'fireflies', ambient(s, { name: 'fireflies', duration: 480, loop: 'loop', tracks: gFlyTracks }), [[time, 'greaterThanOrEqual', 3]]);

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

  k.finish(still);
  return s.toXml();
}

export default function () {
  TINT.clear();
  const ids = new Ids(10);
  return document(hill(ids), gate(ids));
}
