// This file paints Halloween's Gate (see gen.mjs), from the second Mordor take: Torech
// Ungol, Shelob's tunnel mouth webbed across under a jagged, hatched crag, her eyes in the
// dark, a skull by the mouth and Gollum's boulder, with the notice board for the HTML sign.
// The same kit and brushes as rive/shire-ii; only the subject and pigments change.
//
// Inputs: season (kept for the page), time 0..4, still (skip the intro); triggers close
// (Shelob's eyes open), lunge, gollum; bool spider.
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, polyXml,
  fill, stroke, stippleShape, document, EASE, thin,
} from '../lib/ink.mjs';

const TIME0 = +(process.env.SH_TIME ?? 1);
const REGULAR0 = process.env.SH_REGULAR ? 1 : 0;
// as in Shire II: unset (-1) until the page sets it, so the pose layer waits at Entry
const TIME_IN = process.env.SH_TIME ? TIME0 : -1;
const SEASON_IN = process.env.SH_SEASON ? +process.env.SH_SEASON : -1;
// a native screenshot can't set inputs, so these bake where the Eye looks
const LOOKX0 = +(process.env.SH_LOOKX ?? 50);
const LOOKY0 = +(process.env.SH_LOOKY ?? 50);
const SPEED = 0.9;
const AMBIENT = 15;
const TICK = 60 / AMBIENT;

const INK = 'FF2B231C';
const INK_SOFT = 'FF5E554C';
// the same box of pigments, mixed darker and hotter for Mordor
const C = {
  ash: 'B5AA98',
  ash2: 'A39C92',
  slag: '7A6E66',
  clinker: '5E534E',
  iron: '4E4656',
  iron2: '3A3342',
  fume: '8C8478',
  ember: 'D9573A',
  fire: 'E8843A',
  flame: 'F5C451',
  rust: 'A8432C',
  blood: 'C8463B',
  bone: 'EAE0C8',
  cloak: '7E9A88',
  cloak2: '8C99AA',
  stone: 'B8A88A',
  wood: '8A7766',
  shadow: '6D6890',
  night: '1E1626',
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

// an almond, pointed at both ends: the Eye, and (stood on end) its slit
function almond(w, h, n = 9) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const t = -1 + (2 * i) / n;
    top.push(P((t * w) / 2, (-h / 2) * (1 - t * t)));
    if (i > 0 && i < n) bot.unshift(P((t * w) / 2, (h / 2) * (1 - t * t)));
  }
  return [...top, ...bot];
}
const slit = (w, h, n) => almond(h, w, n).map((p) => P(p.y, p.x));
const at = (pts, x, y) => pts.map((p) => P(p.x + x, p.y + y));

// a slag heap: a lumpy dome on a flat foot
function heap(cx, cy, rx, ry, r, n = 12) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = Math.PI * (1 - t);
    pts.push(P(cx + Math.cos(a) * rx + r.jit(2), cy - Math.sin(a) * ry * (1 + r.jit(0.12))));
  }
  return pts;
}

// ---------- palettes ----------

// per time: morning, day, late afternoon, dusk, night. Mordor's day is a smoky gloom; the
// light only warms where fire is under it
const SKY = [['C9A27A', 0.36], ['A09A9A', 0.36], ['B8906A', 0.4], ['8E5A6E', 0.5], ['2E2658', 0.7]];
const HORIZON = [['E0905A', 0.36], ['C9B27A', 0.22], ['D98A4A', 0.4], ['D9573A', 0.55], ['C0503A', 0.5]];
const GLAZE = [['E8C8A0', 0.12], ['C8BCA8', 0.1], ['D9A066', 0.16], ['8A4A62', 0.26], ['261C40', 0.5]];
const SUN = ['E8B070', 'E3D3AE', 'E8993A', 'C8463B', 'C8463B'];
const SUNPOS = [[588, 150, 0.8], [318, 64, 0.85], [252, 92, 0.95], [92, 214, 1.15], [92, 214, 1.15]];
// the tower's west face catching what light there is
const FLANK = ['E0905A', 'B5AA98', 'D98A4A', 'D9573A', 'A8432C'];
const FUME = [0.75, 0.8, 0.95, 1, 0.85];
const LIT = [0.2, 0, 0.3, 0.85, 1];
const NIGHTFIRE = [0, 0, 0.15, 0.7, 1];

// ---------- hero: the Hill (here, Barad-dûr over the slag-hills) ----------


// pose colour for one registered tint id: (re)derive from the role
function tintColor(key, id, color, k) {
  const t = TINT.get(key).find((x) => x.id === id);
  return argb(t.role === 'rim' ? darken(color, 0.28) : color, Math.min(1, t.alpha * k));
}

// ---------- footer: the Gate (here, Torech Ungol, Shelob's lair) ----------

function gate(ids) {
  const W = 600, H = 210;
  const s = new Scene(ids, { name: 'Gate', w: W, h: H, x: 960, y: 0, bg: process.env.SH_BG ? 'FFEDE6DA' : undefined });
  const k = new Kit(s);
  s.input('number', 'season', SEASON_IN);
  const time = s.input('number', 'time', TIME_IN);
  const still = s.input('bool', 'still', 0);
  const timeP = [];
  const fxBack = k.fx('back', 0, 50);
  const fxRock = k.fx('rock', 10, 70);
  const fxSign = k.fx('sign', 6, 56);
  const fxWeb = k.fx('web', 40, 100);

  // the crag of the Ephel Dúath, with the tunnel mouth in it
  const crag = [P(250, 199), P(260, 172), P(274, 154), P(290, 144), P(302, 120), P(320, 110), P(336, 86), P(354, 80), P(370, 62), P(390, 58), P(408, 40), P(426, 48), P(444, 32), P(464, 44), P(486, 26), P(504, 40), P(524, 34), P(542, 56), P(558, 60), P(572, 86), P(586, 100), P(592, 138), P(596, 199)];
  const crack = [[P(300, 146), P(314, 162), P(308, 184)], [P(530, 70), P(540, 96), P(556, 110)], [P(512, 150), P(522, 172)], [P(338, 104), P(352, 118)], [P(470, 56), P(476, 76)], [P(404, 62), P(398, 80)]];
  // the shadow side, hatched
  const hatch = [];
  for (let i = 0; i < 16; i++) {
    const x = 508 + i * 5.2, y = 60 + Math.abs(i - 8) * 3 + (i % 3) * 7;
    hatch.push([P(x, y + 30), P(x + 9, y + 12)]);
  }
  const cragInk = k.boil({ name: 'crag ink', seed: 601, draw: (rr) => [ink(crag.slice(0, -1), rr, { w: 1.8, amt: 0.5, fx: fxRock, tension: 0.2, bleed: 0.1 }), ink(crack, rr, { w: 1, amt: 0.4, color: INK_SOFT, fx: fxRock }), ink(hatch, rr, { w: 0.8, amt: 0.4, color: INK_SOFT, fx: fxRock })] });
  // the tunnel: Torech Ungol
  const mouth = [P(366, 199), P(367, 160), P(378, 124), P(400, 98), P(430, 86), P(458, 96), P(481, 120), P(493, 158), P(495, 199)];
  const mouthInk = k.boil({ name: 'mouth ink', seed: 602, draw: (rr) => ink(mouth, rr, { w: 2, amt: 0.5, fx: fxRock, bleed: 0.15 }) });
  s.add(k.in({ name: 'crag in', cx: 420, cy: 198, t0: 0, t1: 50, sc: 0.98 }, [
    wc(ids, [...crag, P(250, 200)], '6E6878', rng(603), { alpha: 0.55, off: [0, 3], grain: 1, key: 'crag', tension: 0.2 }),
    wc(ids, [P(486, 30), P(504, 42), P(524, 36), P(542, 58), P(558, 62), P(572, 88), P(586, 102), P(592, 140), P(594, 197), P(500, 197), P(494, 120)], '4E4656', rng(604), { alpha: 0.34, off: [0, 0], grain: 0.5, tension: 0.2, hazy: true }),
    wc(ids, mouth, C.night, rng(605), { alpha: 0.92, off: [1, 1], wobble: 0.8, grain: 0.3, blend: 'normal', tension: 0.9 }),
    wc(ids, blobPts(36, 34, rng(606), { n: 10, wobble: 0.12 }).map((p) => P(p.x + 438, p.y + 158)), '0E0A12', rng(607), { alpha: 0.6, off: [0, 0], grain: 0, soft: true, hazy: true }),
    cragInk, mouthInk,
  ]));
  for (const t of tintTracks('crag', 'FFFFFF')) timeP.push({ object: t.object, prop: t.prop, type: 'Color', vals: [['7A6E84', 1], ['6E6878', 1], ['7A6A7A', 1], ['6A4A5E', 1.1], ['3E3448', 1.3]].map(([c, a]) => tintColor('crag', t.object, c, a)) });

  // Shelob's eyes in the dark: shut at first; they open as you reach the foot of the page
  const eyesId = ids.next(), blinkId = ids.next(), lungeEyes = ids.next();
  const cluster = [[440, 158, 5], [457, 158, 5], [431, 149, 2.6], [466, 149, 2.6], [448, 145, 2.2], [434, 168, 2], [463, 168, 2], [448.5, 170, 1.8]];
  const eyeKids = cluster.map(([x, y, R], i) => {
    const id = ids.next();
    return { id, xml: group({ name: 'shelob eye', id, x, y, opacity: 0 }, [
      glow({ x: 0, y: 0, w: R * 6, h: R * 5, color: 'D8E08A', alpha: 0.5 }),
      el('Shape', { name: 'eye' }, [el('Ellipse', { width: R * 2, height: R * 1.6, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('E8EEA8', 0.95))]),
      el('Shape', { name: 'shine', x: -R * 0.3, y: -R * 0.25 }, [el('Ellipse', { width: R * 0.6, height: R * 0.5, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FFFFF4', 0.9))]),
    ]) };
  });
  s.add(group({ name: 'shelob', id: eyesId }, [group({ name: 'lunge', id: lungeEyes, x: 448, y: 158 }, [group({ name: 'blink', id: blinkId, x: -448, y: -158 }, eyeKids.map((e) => e.xml))])]));

  // the leg she reaches out with
  const legId = ids.next();
  const leg = [P(0, 0), P(-26, -22), P(-50, -12), P(-72, 8)];
  const hairs = resample(leg, 9).slice(1, -1).map((p, i) => [p, P(p.x + (i % 2 ? 2 : -2), p.y - 4)]);
  s.add(group({ name: 'leg', id: legId, x: 384, y: 150, opacity: 0, scaleX: 0.2, scaleY: 0.2 }, [
    ink(leg, rng(610), { w: 4.2, amt: 0.3, color: argb('2A2230', 1), tension: 0.4, bleed: 0.2 }),
    ink(hairs, rng(611), { w: 0.9, amt: 0.2, color: argb('2A2230', 1) }),
  ]));

  // her webs, in white gouache across the dark of the mouth
  const WC = P(426, 128);
  const spokes = [P(372, 196), P(368, 160), P(380, 124), P(402, 98), P(432, 88), P(460, 98), P(480, 120), P(492, 156), P(492, 196), P(440, 199)];
  const spiral = [];
  for (let ring = 1; ring <= 4; ring++) {
    const t = ring / 5;
    spiral.push({ pts: spokes.map((p) => P(WC.x + (p.x - WC.x) * t + rng(620 + ring)() * 1.5, WC.y + (p.y - WC.y) * t + 2 * Math.sin(ring))), closed: true, tension: 0.2 });
  }
  const webInk = k.boil({
    name: 'web', seed: 621, draw: (rr) => [
      ink(spokes.map((p) => [WC, p]), rr, { w: 0.9, amt: 0.3, color: argb('F2ECE0', 0.8), fx: fxWeb }),
      ink(spiral, rr, { w: 0.8, amt: 0.4, color: argb('F2ECE0', 0.7), fx: fxWeb }),
    ],
  });
  s.add(group({ name: 'web', id: ids.next() }, [webInk]));

  // a little spider lets itself down on a thread while you hover the web
  const spiderId = ids.next(), threadId = ids.next(), spLegs = ids.next();
  s.add(group({ name: 'thread', id: threadId, x: 452, y: 92, scaleY: 0 }, [el('Shape', { name: 'silk' }, [polyXml([P(0, 0), P(0, 1)]), stroke(argb('F2ECE0', 0.85), 0.7)])]));
  const spLegPts = [-1, 1].flatMap((sx) => [[P(0, 0), P(sx * 4, -3), P(sx * 6, -1)], [P(0, 0.6), P(sx * 4.5, -0.5), P(sx * 7, 2)], [P(0, 1.2), P(sx * 4, 1.5), P(sx * 6, 4.5)], [P(0, 1.6), P(sx * 3, 3.4), P(sx * 4, 6)]]);
  s.add(group({ name: 'spider', id: spiderId, x: 452, y: 92, opacity: 0 }, [
    group({ name: 'legs', id: spLegs }, [ink(spLegPts, rng(630), { w: 0.9, amt: 0.15, color: argb('F2ECE0', 0.95) })]),
    el('Shape', { name: 'body' }, [el('Ellipse', { y: 1.5, width: 5, height: 6, originX: 0.5, originY: 0.5, name: 'E' }), el('Ellipse', { y: -1.5, width: 3, height: 3, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('F2ECE0', 0.95))]),
  ]));

  // the notice board on its stake: the words are HTML laid over it. A cobweb has the corner
  const board = [P(34, 42), P(266, 37), P(270, 126), P(38, 131)];
  const signInk = k.boil({
    name: 'sign ink', seed: 403, draw: (rr) => [
      ink({ pts: board, closed: true }, rr, { w: 1.9, amt: 0.6, fx: fxSign, tension: 0.15 }),
      ink([[P(150, 131), P(151, 194)], [P(160, 130), P(160, 194)]], rr, { w: 1.8, amt: 0.4, fx: fxSign }),
      ink([[P(42, 46), P(262, 42)]], rr, { w: 0.8, amt: 0.6, color: INK_SOFT, fx: fxSign }),
    ],
  });
  const cob = P(266, 38);
  const cobSpokes = [P(232, 39), P(236, 50), P(248, 62), P(262, 70), P(268, 72)];
  const cobInk = ink([...cobSpokes.map((p) => [cob, p]), ...[0.4, 0.7, 1].map((t) => cobSpokes.map((p) => P(cob.x + (p.x - cob.x) * t, cob.y + (p.y - cob.y) * t + 1.5 * t)))], rng(640), { w: 0.7, amt: 0.2, color: INK_SOFT, fx: fxWeb, tension: 0.4 });
  s.add(k.in({ name: 'sign in', cx: 150, cy: 90, t0: 4, t1: 50 }, [
    wc(ids, [P(148, 128), P(162, 128), P(162, 194), P(148, 194)], '8A7462', rng(404), { alpha: 0.9, off: [1, 0], grain: 0.6, soft: false, blend: 'normal' }),
    wc(ids, board, C.bone, rng(405), { alpha: 1, off: [2, 2], wobble: 1.5, grain: 0.4, soft: false, blend: 'normal' }),
    stippleShape({ name: 'nails', dots: [{ x: 44, y: 50, r: 1.6 }, { x: 258, y: 46, r: 1.6 }, { x: 46, y: 122, r: 1.6 }, { x: 260, y: 118, r: 1.6 }], color: INK }),
    signInk, cobInk,
  ]));

  // Gollum, behind a boulder by the tunnel: click it and he peeps over, looks about, blinks
  // and sinks out of sight again. Clipped to what's above the rock.
  const GB = P(546, 186);
  const boulder = blobPts(30, 16, rng(650), { n: 10, wobble: 0.1 }).map((p) => P(p.x + GB.x, p.y + GB.y));
  const gClip = ids.next(), gollumId = ids.next(), gLids = ids.next(), gHead = ids.next();
  s.add(el('Shape', { name: 'gollum clip', id: gClip }, [polyXml([P(500, 100), P(600, 100), P(600, GB.y - 10), P(GB.x + 20, GB.y - 13), P(GB.x, GB.y - 15), P(GB.x - 20, GB.y - 13), P(500, GB.y - 10)], { closed: true })]));
  const gHeadPts = [P(-10, 6), P(-11, -2), P(-7, -9), P(0, -11), P(7, -9), P(11, -2), P(10, 6)];
  s.add(group({ name: 'gollum', id: gollumId, x: GB.x - 2, y: GB.y + 4 }, [
    el('ClippingShape', { sourceId: gClip, name: 'Clip' }),
    group({ name: 'head', id: gHead }, [
      wc(ids, gHeadPts, 'C8C0A8', rng(651), { alpha: 0.98, off: [0, 0], wobble: 0.3, grain: 0.3, soft: false, blend: 'normal', tension: 0.8 }),
      ink([{ pts: gHeadPts, closed: true, tension: 0.8 }, [P(-11, -2), P(-15, -5)], [P(11, -2), P(15, -5)], [P(-3, -11), P(-4, -14)], [P(2, -11), P(3, -15)]], rng(652), { w: 1.1, amt: 0.2 }),
      el('Shape', { name: 'eyes' }, [el('Ellipse', { x: -4.4, y: -2.5, width: 6.4, height: 7, originX: 0.5, originY: 0.5, name: 'E' }), el('Ellipse', { x: 4.4, y: -2.5, width: 6.4, height: 7, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('DCE6B0', 1))]),
      el('Shape', { name: 'pupils' }, [el('Ellipse', { x: -4.4, y: -2.2, width: 2.8, height: 3.4, originX: 0.5, originY: 0.5, name: 'E' }), el('Ellipse', { x: 4.4, y: -2.2, width: 2.8, height: 3.4, originX: 0.5, originY: 0.5, name: 'E' }), fill(INK)]),
      el('Shape', { name: 'lids', id: gLids, y: -6, scaleY: 0 }, [el('Rectangle', { width: 16, height: 7.5, originX: 0.5, originY: 0, name: 'R' }), fill(argb('C8C0A8', 1))]),
    ]),
  ]));
  s.add(k.in({ name: 'boulder in', cx: GB.x, cy: GB.y + 10, t0: 14, t1: 56 }, [
    wc(ids, boulder, '8A8078', rng(653), { alpha: 0.95, off: [0.5, 0.5], wobble: 0.6, grain: 0.7, soft: false, blend: 'normal' }),
    k.boil({ name: 'boulder ink', seed: 654, draw: (rr) => ink([{ pts: boulder, closed: true }, [P(GB.x - 12, GB.y - 2), P(GB.x - 2, GB.y + 5)]], rr, { w: 1.6, amt: 0.4, fx: fxRock }) }),
  ]));

  // bones by the mouth (what's left of her last caller)
  const skull = [P(-6, 2), P(-7, -3), P(-4, -7), P(1, -8), P(5, -6), P(7, -2), P(6, 2), P(3, 4), P(3, 6), P(-3, 6), P(-3, 4)];
  s.add(k.in({ name: 'bones in', cx: 508, cy: 196, t0: 50, t1: 80, sc: 0.6, ease: EASE.back }, [
    wc(ids, at(skull, 508, 190), C.bone, rng(660), { alpha: 1, off: [0, 0], wobble: 0.3, grain: 0.2, soft: false, blend: 'normal', tension: 0.7 }),
    ink([{ pts: at(skull, 508, 190), closed: true, tension: 0.7 }, [P(484, 197), P(500, 194)], [P(482, 195), P(485, 199)], [P(499, 192), P(502, 196)]], rng(661), { w: 1.1, amt: 0.2, fx: fxRock }),
    stippleShape({ name: 'sockets', dots: [{ x: 505.5, y: 188.5, r: 1.6 }, { x: 510.5, y: 188.5, r: 1.6 }], color: INK }),
  ]));

  // ground: ash and grit, the line holding still so the foot of the page stays calm
  const ground = [P(22, 196), P(160, 188), P(320, 193), P(470, 188), P(574, 192), P(584, 199), P(470, 206), P(150, 205), P(30, 203)];
  const groundInk = (() => {
    const rr = rng(440);
    const list = [];
    for (const x of [40, 180, 300]) list.push([P(x, 198), P(x + 22, 198 + rr.jit(0.6)), P(x + 44, 198 + rr.jit(0.6))]);
    for (const gx of [92, 238]) list.push([P(gx, 196), P(gx - 4, 189)], [P(gx + 3, 196), P(gx + 6, 190)]);
    return ink(list, rr, { w: 1.4, amt: 0.3, fx: fxBack });
  })();
  s.add(k.in({ name: 'ground in', cx: 300, cy: 200, t0: 0, t1: 40 }, [wc(ids, ground, C.ash2, rng(441), { alpha: 0.42, off: [0, 0], grain: 0.6, key: 'gground' }), groundInk]));

  // hour glaze; Shelob's eyes and the webs are over it, so they show at night
  const [glazeXml, glazeTracks] = hourGlaze(ids, W, H, 0.6);
  s.add(glazeXml);
  timeP.push(...glazeTracks);
  poseLayer(s, 'time', time, 5, timeP);

  // close: reaching the bottom, her eyes open in the dark, one after another
  const open = (f0) => s.anim({ name: 'eyes open', duration: f0 + 120, tracks: eyeKids.map((e, i) => {
    const t = f0 + [0, 6, 30, 36, 50, 64, 70, 84][i];
    return { object: e.id, prop: 'opacity', keys: [[0, 0, 'hold'], [t, 0, 'cubic', EASE.out], [t + 18, 1]] };
  }) });
  const opened = hold(s, 'eyes opened', eyeKids.map((e) => ({ object: e.id, prop: 'opacity', keys: [[0, 1]] })));
  const shut = hold(s, 'eyes shut', eyeKids.map((e) => ({ object: e.id, prop: 'opacity', keys: [[0, 0]] })));
  const close = s.input('trigger', 'close');
  const a = ids.next(), b = ids.next(), c = ids.next();
  s.layers.push(s._layer('close', [
    el('AnyState', { x: 100, y: -120 }),
    el('ExitState', { x: 700, y: -120 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: a })),
    el('AnimationState', { x: 200, y: 0, animationId: shut, id: a }, [
      el('StateTransition', { stateToId: b }, el('TransitionTriggerCondition', { inputId: close })),
      el('StateTransition', { stateToId: c }, el('TransitionBoolCondition', { inputId: still, opValue: 'equal' })),
    ]),
    el('AnimationState', { x: 400, y: 0, animationId: open(0), id: b }, el('StateTransition', { stateToId: c, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 })),
    el('AnimationState', { x: 600, y: 0, animationId: opened, id: c }),
  ]));
  // and now and then they blink, all together
  s.loopLayer('blink', ambient(s, { name: 'shelob blink', duration: 420, loop: 'loop', tracks: [
    { object: blinkId, prop: 'scaleY', keys: [[0, 1, 'hold'], [300, 1, 'cubic', EASE.in], [306, 0.1, 'cubic', EASE.out], [314, 1, 'hold'], [420, 1]] },
  ] }));

  // hover the web: the spider comes down; leave it, and it climbs back
  const spiderOn = s.input('bool', 'spider', 0);
  const down = hold(s, 'spider down', [
    { object: spiderId, prop: 'opacity', keys: [[0, 1]] }, { object: spiderId, prop: 'y', keys: [[0, 134]] }, { object: threadId, prop: 'scaleY', keys: [[0, 42]] },
  ]);
  const up = hold(s, 'spider up', [
    { object: spiderId, prop: 'opacity', keys: [[0, 0]] }, { object: spiderId, prop: 'y', keys: [[0, 92]] }, { object: threadId, prop: 'scaleY', keys: [[0, 0]] },
  ]);
  s.boolLayer('spider', spiderOn, up, down, { mixIn: 900, mixOut: 1200 });
  s.loopLayer('spider dangle', ambient(s, { name: 'spider dangle', duration: 180, loop: 'pingPong', tracks: [
    { object: spLegs, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [90, 0.8, 'cubic', EASE.inOut], [180, 1]] },
  ] }));
  const hWeb = ids.next(), hRock = ids.next();
  s.add(hit(hWeb, 430, 140, 120, 110), hit(hRock, GB.x, GB.y - 8, 70, 44));
  s.listen(hWeb, 'enter', [Scene.setBool(spiderOn, true)]);
  s.listen(hWeb, 'exit', [Scene.setBool(spiderOn, false)]);

  // click the dark: something reaches out, and the eyes come forward
  const lunge = s.input('trigger', 'lunge');
  s.triggerLayer('lunge', lunge, s.anim({ name: 'lunge', duration: 130, tracks: [
    { object: legId, prop: 'opacity', keys: [[0, 0, 'hold'], [4, 1, 'hold'], [100, 1, 'linear'], [110, 0]] },
    { object: legId, prop: 'scaleX', keys: [[0, 0.2, 'cubic', [0.2, 0.9, 0.3, 1]], [12, 1, 'hold'], [70, 1, 'cubic', EASE.in], [104, 0.2]] },
    { object: legId, prop: 'scaleY', keys: [[0, 0.2, 'cubic', [0.2, 0.9, 0.3, 1]], [12, 1, 'hold'], [70, 1, 'cubic', EASE.in], [104, 0.2]] },
    { object: legId, prop: 'rotation', keys: [[0, 0.3, 'cubic', EASE.out], [14, -0.05, 'cubic', EASE.inOut], [40, 0.06, 'cubic', EASE.inOut], [70, 0]] },
    { object: lungeEyes, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [10, 1.3, 'hold'], [60, 1.3, 'cubic', EASE.inOut], [110, 1]] },
    { object: lungeEyes, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [10, 1.3, 'hold'], [60, 1.3, 'cubic', EASE.inOut], [110, 1]] },
  ] }), { fromAny: false, mix: 0 });
  s.listen(hWeb, 'click', [Scene.fire(lunge), Scene.emit(s.event('shelob'))]);

  const gollum = s.input('trigger', 'gollum');
  const blink = (f) => [[f, 0, 'cubic', EASE.in], [f + 3, 1, 'cubic', EASE.out], [f + 7, 0, 'hold']];
  s.triggerLayer('gollum', gollum, s.anim({ name: 'gollum', duration: 220, tracks: [
    { object: gollumId, prop: 'y', keys: [[0, GB.y + 4, 'cubic', EASE.inOut], [20, GB.y - 10, 'hold'], [36, GB.y - 10, 'cubic', EASE.out], [48, GB.y - 18, 'hold'], [186, GB.y - 18, 'cubic', [0.5, 0, 0.9, 0.5]], [198, GB.y + 4]] },
    { object: gHead, prop: 'rotation', keys: [[0, 0, 'hold'], [60, 0, 'cubic', EASE.inOut], [72, -0.25, 'hold'], [110, -0.25, 'cubic', EASE.inOut], [124, 0.22, 'hold'], [150, 0.22, 'cubic', EASE.inOut], [162, 0, 'hold'], [220, 0]] },
    { object: gHead, prop: 'x', keys: [[0, 0, 'hold'], [60, 0, 'cubic', EASE.inOut], [72, -3, 'hold'], [110, -3, 'cubic', EASE.inOut], [124, 3, 'hold'], [150, 3, 'cubic', EASE.inOut], [162, 0, 'hold'], [220, 0]] },
    { object: gLids, prop: 'scaleY', keys: [[0, 0, 'hold'], ...blink(90), ...blink(168), [220, 0]] },
  ] }), { fromAny: false, mix: 0 });
  s.listen(hRock, 'click', [Scene.fire(gollum), Scene.emit(s.event('gollum'))]);

  k.finish(still);
  return s.toXml();
}

// gen.mjs paints Halloween's two artboards from two hands' work: the Hill from tower.mjs, the Gate from lair.mjs
export function paintGate(ids) {
  TINT.clear();
  return gate(ids);
}
