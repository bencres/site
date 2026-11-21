// Halloween · Mordor: the same hand's painting of the Shire, swapped for Barad-dûr. Same
// kit and brushes as rive/shire-ii (hand-jittered ink with bleed, line boil, ink draw-on,
// watercolour glazes with pooled rims and grain); only the subject and pigments change.
// Only the waymark is drawn at the left; its arms are HTML links laid over it.
//
// This file paints Halloween's Hill (see gen.mjs): the Tower and the Eye, Orodruin smoking,
// Gorgoroth, the Ephel Dúath, an orc camp, the Nazgûl. lair.mjs paints its Gate.
//
// Inputs: season (kept for the page; there's one Halloween look), time 0..4 (morning, day,
// late afternoon, dusk, night), still (skip the intro), lookX, lookY 0..100 (50 = straight
// ahead; the page smooths them), narrow (bool), regular (bool), bare (hide the waymark, for
// phones); triggers flare, knock, welcome, slam,
// glint, shake, erupt, ring, screech, forge, post, gust. Events: eye, door, doom, nazgul-0/1.
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, polyXml,
  fill, stroke, stippleShape, document, EASE, thin,
} from '../lib/ink.mjs';

const SEASON0 = +(process.env.SH_SEASON ?? 2);
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

// ---------- palettes ----------

// Mordor's pigments, mixed from the hill's own box: the sepia and indigo go in for soot,
// terra and lamp-yellow are pushed toward fire, and the greens are left in the jar
const M = {
  soot: '43383C', // indigo + sepia: the Tower
  deep: '2C2327',
  slag: '6F5C52', // burnt umber greyed with ash: the mountain, the crags
  rock: '857469',
  ash: 'A79A8F',
  pale: 'D8CDBE', // the road, bleached by ash
  smoke: '6E5E66', // the hill's shadow violet, dirtied
  hide: '9A7656',
  ember: 'D2552B', // terra, hotter
  fire: 'E7832F',
  flame: 'F2B13A', // the lamp's yellow
  core: 'F8DC86',
  blood: 'A63A28',
};
const EMBER_INK = 'FF7A2A16';

// per time: morning, day, late afternoon, dusk, night. Mordor's day is a smoky red-brown
// gloom; its night is black but for fire
const SKY = [['C49A7E', 0.4], ['A8928A', 0.44], ['C3875E', 0.44], ['A84A3C', 0.52], ['3A2630', 0.68]];
const HORIZON = [['E0915A', 0.32], ['C98F6E', 0.22], ['E27C40', 0.4], ['DC542C', 0.56], ['B8401E', 0.52]];
const GLAZE = [['D9AE94', 0.14], ['BCA99A', 0.14], ['D89A6A', 0.2], ['8E4448', 0.3], ['24161E', 0.5]];
const SMOKE = ['7E6A66', '72665F', '7E6252', '623C3A', '3A2A30'];
const SUN = ['E8A27A', 'D9A07E', 'E07C48', 'C8452A', 'C8452A'];
const SUNPOS = [[598, 150, 0.95], [268, 62, 1], [150, 112, 1.05], [70, 238, 1.3], [70, 238, 1.3]];
const LIT = [0.5, 0.38, 0.6, 0.9, 1];

// a flame as a closed outline standing on (0, 0): tongues licking up, highest in the middle
function flamePts(w, h, r, tongues = 3) {
  const pts = [P(-w / 2, 0), P(-w * 0.44, -h * 0.28)];
  for (let i = 0; i < tongues; i++) {
    const u = (i + 0.5) / tongues;
    const th = h * (1 - Math.abs(u - 0.5) * 0.9) * r.range(0.78, 1.05);
    pts.push(P(-w / 2 + u * w + r.jit(w * 0.1), -th));
    if (i < tongues - 1) pts.push(P(-w / 2 + ((i + 1) / tongues) * w + r.jit(w * 0.04), -th * r.range(0.32, 0.5)));
  }
  pts.push(P(w * 0.44, -h * 0.28), P(w / 2, 0), P(0, h * 0.1));
  return pts;
}

// the fire round the Eye: tongues licking up off its rim, bending upward as flames do,
// tallest over the top, short and lazy underneath
function rimPts(rx, ry, r, n = 22) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r.jit(0.06);
    const c = Math.cos(a), s = Math.sin(a);
    const up = Math.max(0, -s), low = Math.max(0, s);
    if (i % 2) {
      pts.push(P(c * rx * 0.98, s * ry * 0.98 - up * 1.5));
      continue;
    }
    const bend = 0.3 + 0.55 * (1 - low);
    let dx = c * (1 - bend), dy = s * (1 - bend) - bend;
    const d = Math.hypot(dx, dy);
    const L = r.range(7, 13) * (0.45 + 0.95 * up + 0.5 * Math.abs(c)) * (low > 0.6 ? 0.45 : 1);
    pts.push(P(c * rx + (dx / d) * L + r.jit(1.6), s * ry + (dy / d) * L));
  }
  return pts;
}

// a lens: the Eye's almond (wide) or its slit (tall)
function lens(w, h, n = 10, tilt = 0) {
  const top = [], bot = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = -w / 2 + t * w;
    const y = (h / 2) * Math.sin(Math.PI * t) ** 0.85;
    top.push(P(x, -y + x * tilt));
    if (i > 0 && i < n) bot.unshift(P(x, y + x * tilt));
  }
  return [...top, ...bot];
}
const slit = (w, h, n = 8) => lens(h, w, n).map((p) => P(p.y, p.x));

// ---------- hero: the Hill (Barad-dûr, for Halloween) ----------

function hill(ids) {
  const W = 900, H = 400;
  const s = new Scene(ids, { name: 'Hill', w: W, h: H, x: 0, y: 0, bg: process.env.SH_BG ? 'FFE6DDD0' : undefined });
  const k = new Kit(s);
  const r = rng(1954);
  // season stays an input so the page can set it as it always does; Mordor has the one look
  s.input('number', 'season', SEASON_IN);
  const time = s.input('number', 'time', TIME_IN);
  const still = s.input('bool', 'still', 0);
  const timeP = [];
  const tp = (object, prop, vals, type) => timeP.push({ object, prop, vals, type });

  // draw-on order: the land and mountain first, then the Tower climbs, and the Eye opens last
  const fxLand = k.fx('land', 4, 70);
  const fxSky = k.fx('sky', 30, 95);
  const fxDoom = k.fx('doom', 10, 80);
  const fxTower = k.fx('tower', 24, 104);
  const fxCamp = k.fx('camp', 58, 124);
  const fxPost = k.fx('post', 62, 116);
  const fxEye = k.fx('eye', 104, 150);
  const PX = 164, PT = 104; // the waymark's centre line and the top of its cap

  // --- sky: a big soft wash of smoke, and the fire-glow low along the horizon
  const skyPts = blobPts(290, 84, rng(2), { n: 16, wobble: 0.1 }).map((p) => P(p.x + 400, p.y + 128));
  const sky2Pts = blobPts(118, 40, rng(6), { n: 12, wobble: 0.14 }).map((p) => P(p.x + 752, p.y + 62));
  const horPts = blobPts(330, 40, rng(3), { n: 16, wobble: 0.14 }).map((p) => P(p.x + 440, p.y + 262));
  s.add(k.in({ name: 'sky', cx: 420, cy: 140, t0: 0, t1: 60, sc: 0.94 }, [
    wc(ids, skyPts, SKY[1][0], rng(4), { alpha: 0.36, off: [0, 0], grain: 0.12, soft: true, key: 'sky', hazy: true }),
    wc(ids, sky2Pts, SKY[1][0], rng(7), { alpha: 0.36, off: [0, 0], grain: 0.12, soft: true, key: 'sky', hazy: true }),
    wc(ids, horPts, HORIZON[1][0], rng(5), { alpha: 0.34, off: [0, 0], grain: 0.15, soft: true, key: 'horizon', hazy: true }),
  ]));
  for (const t of tintTracks('sky', 'FFFFFF')) tp(t.object, t.prop, SKY.map(([c, a]) => tintColor('sky', t.object, c, a / 0.36)), 'Color');
  for (const t of tintTracks('horizon', 'FFFFFF')) tp(t.object, t.prop, HORIZON.map(([c, a]) => tintColor('horizon', t.object, c, a / 0.34)), 'Color');

  // --- the sun, a dull disc through the reek with a bar of smoke across its face; gone by night
  const sunId = ids.next();
  const sunDisc = blobPts(25, 24, rng(13), { n: 10, wobble: 0.07 });
  const sunInk = k.boil({ name: 'sun ink', seed: 12, draw: (rr) => ink({ pts: blobPts(24, 24, rr, { n: 9, wobble: 0.04 }), closed: true }, rr, { w: 1.5, amt: 0.4, fx: fxSky, color: 'FF4A3A34' }) });
  s.add(k.in({ name: 'sun in', t0: 24, t1: 70 }, [
    group({ name: 'sun', id: sunId, x: SUNPOS[TIME0][0], y: SUNPOS[TIME0][1] }, [
      glow({ name: 'halo', x: 0, y: 0, w: 130, h: 130, color: 'E9A070', alpha: 0.26 }),
      wc(ids, sunDisc, SUN[1], rng(14), { alpha: 0.62, off: [2, 2], wobble: 1, grain: 0.5, key: 'sun', soft: false }),
      sunInk,
      wc(ids, [P(-42, 3), P(-14, -3), P(24, -2), P(46, 4), P(22, 10), P(-18, 9)], '6E5E5C', rng(15), { alpha: 0.34, off: [0, 0], wobble: 1, grain: 0.3, soft: false, tension: 1 }),
    ]),
  ]));
  tp(sunId, 'x', SUNPOS.map((p) => p[0]));
  tp(sunId, 'y', SUNPOS.map((p) => p[1]));
  tp(sunId, 'scaleX', SUNPOS.map((p) => p[2]));
  tp(sunId, 'scaleY', SUNPOS.map((p) => p[2]));
  tp(sunId, 'opacity', [0.9, 0.8, 0.9, 0.95, 0]);
  for (const t of tintTracks('sun', 'FFFFFF')) tp(t.object, t.prop, SUN.map((c) => tintColor('sun', t.object, c, 1)), 'Color');

  // --- the Ephel Dúath, jagged, behind the waymark (kept pale and quiet: the arms lie over it)
  const ephel = [P(18, 338), P(34, 306), P(52, 292), P(70, 260), P(86, 282), P(104, 262), P(122, 230), P(140, 256), P(158, 246), P(180, 218), P(198, 244), P(220, 236), P(246, 210), P(266, 240), P(290, 232), P(312, 256), P(336, 250), P(360, 276), P(384, 292), P(412, 314)];
  const ephel2 = [P(20, 354), P(48, 332), P(80, 318), P(104, 298), P(130, 316), P(170, 302), P(206, 320), P(240, 298), P(270, 316), P(310, 306), P(350, 324), P(392, 338)];
  const lithui = [P(800, 300), P(824, 284), P(846, 292), P(866, 276), P(884, 290), P(892, 300)];
  const crags = [];
  for (const [x, y] of [[70, 260], [122, 230], [180, 218], [246, 210], [290, 232]]) {
    crags.push([P(x + 2, y + 4), P(x + 7, y + 16)], [P(x - 3, y + 8), P(x - 1, y + 20)]);
  }
  s.add(k.in({ name: 'mountains in', cx: 220, cy: 300, t0: 8, t1: 66 }, [
    wc(ids, [...ephel, P(412, 344), P(140, 346), P(24, 346)], M.smoke, rng(52), { alpha: 0.32, off: [0, 3], grain: 0.4, key: 'far', tension: 0.25 }),
    wc(ids, [...ephel2, P(392, 350), P(120, 356), P(26, 358)], M.slag, rng(53), { alpha: 0.34, off: [0, 3], grain: 0.4, tension: 0.3 }),
    wc(ids, [...lithui, P(892, 320), P(800, 320)], M.smoke, rng(54), { alpha: 0.26, off: [0, 2], grain: 0.3, tension: 0.25 }),
    k.boil({ name: 'mountain ink', seed: 51, draw: (rr) => [
      ink({ pts: ephel.slice(1), tension: 0.2 }, rr, { w: 1.3, amt: 0.5, color: 'FF4E4248', fx: fxLand }),
      ink({ pts: ephel2.slice(2), tension: 0.3 }, rr, { w: 1.3, amt: 0.5, color: 'FF55474A', fx: fxLand }),
      ink({ pts: lithui, tension: 0.2 }, rr, { w: 1.1, amt: 0.4, color: 'FF5A4E52', fx: fxLand }),
      ink(crags, rr, { w: 0.9, amt: 0.3, color: 'FF6A5C5E', fx: fxLand }),
    ] }),
  ]));

  // --- Orodruin: the cone, a lava-run down its east flank, the road climbing to the
  // Sammath Naur, and the reek going up out of the crater
  const doomL = [P(362, 338), P(394, 308), P(424, 274), P(452, 238), P(472, 208), P(486, 188)];
  const crater = [P(493, 181), P(500, 188), P(508, 181)];
  const doomR = [P(516, 187), P(530, 210), P(548, 238), P(568, 260), P(590, 280), P(608, 296), P(626, 314), P(652, 338)];
  const doomPts = [...doomL, ...crater, ...doomR, P(510, 344)];
  const lava = [P(510, 188), P(516, 202), P(524, 214), P(520, 228), P(532, 242), P(542, 258), P(540, 272), P(554, 290), P(566, 310)];
  const lava2 = [P(488, 190), P(482, 204), P(486, 218), P(476, 236)];
  const gullies = [[P(456, 250), P(446, 276)], [P(478, 232), P(472, 262)], [P(566, 274), P(578, 300)], [P(590, 292), P(598, 316)], [P(430, 290), P(418, 314)]];
  const road = [P(420, 338), P(470, 320), P(436, 300), P(480, 280), P(456, 262), P(500, 244), P(520, 226), P(530, 214)];
  const doomId = ids.next(), doomShake = ids.next();
  const doomInk = k.boil({ name: 'doom ink', seed: 61, draw: (rr) => [
    ink({ pts: [...doomL.slice(1), ...crater, ...doomR.slice(0, -1)], tension: 0.5 }, rr, { w: 1.9, amt: 0.6, fx: fxDoom, bleed: 0.12 }),
    ink(gullies, rr, { w: 1, amt: 0.4, color: INK_SOFT, fx: fxDoom }),
    ink({ pts: road, tension: 0.4 }, rr, { w: 0.9, amt: 0.4, color: 'FF8A7868', fx: fxDoom }),
    ink({ pts: lava, tension: 0.6 }, rr, { w: 2.4, amt: 0.4, color: 'FFD2552B', bleed: 0.3, fx: fxDoom }),
    ink({ pts: lava2, tension: 0.6 }, rr, { w: 1.8, amt: 0.3, color: 'FFD2552B', bleed: 0.3, fx: fxDoom }),
  ] });
  s.add(group({ name: 'doom', id: doomId, x: 0 }, [group({ name: 'doom shake', id: doomShake }, [k.in({ name: 'doom in', cx: 506, cy: 340, t0: 10, t1: 76, sc: 0.94 }, [
    wc(ids, doomPts, M.slag, rng(62), { alpha: 0.6, off: [0, 3], grain: 0.6, tension: 0.5 }),
    wc(ids, [...doomL, P(492, 186), P(484, 240), P(470, 300), P(450, 340)], M.deep, rng(63), { alpha: 0.24, off: [1, 2], grain: 0.3, tension: 0.5 }),
    wc(ids, [P(520, 200), P(560, 250), P(610, 300), P(560, 300), P(530, 250)], M.ember, rng(64), { alpha: 0.18, off: [0, 0], grain: 0.2, hazy: true }),
    doomInk,
  ])])]));

  // the reek: a hazy column leaning off west, and curls of smoke boiling up it
  const plumeId = ids.next();
  const plume = [P(490, 184), P(480, 152), P(466, 122), P(448, 94), P(426, 70), P(404, 52), P(436, 40), P(472, 56), P(496, 88), P(508, 122), P(514, 156), P(510, 184)];
  s.add(group({ name: 'plume', id: plumeId }, [k.in({ name: 'plume in', cx: 500, cy: 182, t0: 60, t1: 120, sc: 0.6 }, [
    wc(ids, plume, SMOKE[1], rng(66), { alpha: 0.56, off: [0, 0], grain: 0.2, soft: true, hazy: true, key: 'cloud' }),
  ])]));
  const reekDur = 600;
  const reekKids = [];
  const reekTracks = [];
  for (let i = 0; i < 4; i++) {
    const id = ids.next();
    const curl = k.boil({ name: `reek${i}`, seed: 70 + i, draw: (rr) => {
      const pts = [];
      for (let j = 0; j <= 10; j++) { const t = j / 10; pts.push(P(Math.sin(t * 5.5) * (6 + t * 5), -t * 24)); }
      return ink(pts, rr, { w: 1.4, amt: 0.5, color: 'FF4E4446' });
    } });
    reekKids.push(group({ name: `reek${i}`, x: 500, y: 182, id, opacity: 0 }, [curl]));
    const at = (t) => (t + i / 4) % 1;
    const op = (u) => (u < 0.04 || u > 0.94 ? 0 : u < 0.16 ? (u - 0.04) / 0.12 : Math.max(0, 1 - (u - 0.16) / 0.78));
    reekTracks.push(
      sampled(id, 'y', reekDur, TICK, (t) => 182 - at(t) * 124),
      sampled(id, 'x', reekDur, TICK, (t) => 500 - at(t) * at(t) * 80 + Math.sin(at(t) * 7) * 5),
      sampled(id, 'opacity', reekDur, TICK, (t) => op(at(t))),
      sampled(id, 'scaleX', reekDur, TICK, (t) => 0.7 + at(t) * 1.4),
      sampled(id, 'scaleY', reekDur, TICK, (t) => 0.7 + at(t) * 1.4),
    );
  }
  s.add(k.in({ name: 'reek in', t0: 110, t1: 160 }, reekKids));
  s.loopLayer('reek', ambient(s, { name: 'reek', duration: reekDur, loop: 'loop', tracks: reekTracks }));

  // spat out of the crater when the mountain is clicked: gobbets of lava, and now and then
  // a ring of gold going up in the smoke
  const spits = [];
  for (let i = 0; i < 6; i++) {
    const id = ids.next();
    const sr = rng(80 + i);
    const blob = blobPts(3.2, 2.6, sr, { n: 7, wobble: 0.2 });
    spits.push({ id, vx: sr.range(-70, 76), vy: sr.range(-150, -110), delay: i * 4 + sr.range(0, 4) });
    s.add(group({ name: 'spit', id, x: 500, y: 184, opacity: 0 }, [
      wc(ids, blob, M.fire, sr, { alpha: 1, off: [0, 0], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
      ink({ pts: blob, closed: true }, sr, { w: 0.9, amt: 0.15, color: EMBER_INK }),
    ]));
  }
  const oneRing = ids.next();
  s.add(group({ name: 'the ring', id: oneRing, x: 500, y: 176, opacity: 0 }, [
    glow({ x: 0, y: 0, w: 40, h: 30, color: 'F5C451', alpha: 0.6 }),
    el('Shape', { name: 'band' }, [el('Ellipse', { width: 14, height: 9, originX: 0.5, originY: 0.5, name: 'E' }), stroke(argb('E9B93A', 1), 2.6)]),
    ink({ pts: circ(0, 0, 8.4, 5.8, 12), closed: true }, rng(88), { w: 0.9, amt: 0.15, color: 'FF8A5A1E' }),
  ]));

  // --- smoke clouds (the middle one is the reek's own; it hides the almanac)
  const clouds = [
    { x: 112, y: 66, w: 120, h: 30, seed: 21, dx: -16, dur: 1300 },
    { x: 404, y: 52, w: 110, h: 28, seed: 24, dx: -20, dur: 1600 },
    { x: 606, y: 84, w: 90, h: 24, seed: 27, dx: 16, dur: 1450 },
  ];
  const cloudKids = [];
  clouds.forEach((c, i) => {
    const id = ids.next();
    const cr = rng(c.seed);
    const base = cloudPts(c.w, c.h, cr);
    const b = k.boil({ name: `cloud${i} ink`, seed: c.seed + 1, draw: (rr) => ink({ pts: base, closed: true }, rr, { w: 1.6, amt: 0.6, fx: fxSky, color: 'FF3A3034' }) });
    cloudKids.push(group({ name: `cloud${i}`, x: c.x, y: c.y, id }, [wc(ids, base, SMOKE[1], cr, { alpha: 0.42, off: [4, 4], grain: 0.4, soft: false, key: 'cloud' }), b]));
    s.loopLayer(`cloud${i} drift`, ambient(s, { name: `cloud${i} drift`, duration: c.dur, loop: 'pingPong', tracks: [{ object: id, prop: 'x', keys: [[0, c.x, 'cubic', EASE.inOut], [c.dur, c.x + c.dx]] }] }));
  });
  s.add(k.in({ name: 'clouds in', t0: 50, t1: 110 }, [group({ name: 'clouds' }, cloudKids)]));
  for (const t of tintTracks('cloud', 'FFFFFF')) tp(t.object, t.prop, SMOKE.map((c) => tintColor('cloud', t.object, c, 1)), 'Color');

  // --- the plain of Gorgoroth: ash, and cracks with fire in them
  const plain = [P(24, 336), P(140, 328), P(300, 336), P(420, 332), P(560, 338), P(660, 332), P(800, 338), P(888, 332), P(892, 392), P(620, 398), P(380, 396), P(140, 398), P(28, 396)];
  const fissures = [
    [P(208, 374), P(222, 369), P(236, 375), P(252, 370), P(266, 374)],
    [P(470, 358), P(484, 363), P(496, 357), P(508, 361)],
    [P(548, 382), P(566, 377), P(580, 383), P(598, 378)],
    [P(632, 352), P(644, 356), P(656, 351)],
  ];
  const dashSpec = [];
  for (let x = 24; x < 880;) {
    const len = r.range(16, 56);
    if ((x + len < 300 || x > 470) && (x + len < 590 || x > 880) && x + len < 876) dashSpec.push({ x, y: r.range(390, 395), len });
    x += len + r.range(14, 40);
  }
  const plainInk = k.boil({ name: 'plain ink', seed: 201, draw: (rr) => {
    const list = dashSpec.map((d) => [P(d.x, d.y), P(d.x + d.len / 2, d.y + rr.jit(1.1)), P(d.x + d.len, d.y + rr.jit(1.4))]);
    // stones rather than tufts
    const stones = [[60, 388], [120, 386], [520, 372], [480, 388], [690, 388]].map(([x, y]) => ({ pts: blobPts(4, 2.4, rr, { n: 6, wobble: 0.2 }).map((p) => P(p.x + x, p.y + y)), closed: true, tension: 0.4 }));
    return [ink([...list, ...stones], rr, { w: 1.5, amt: 0.4, fx: fxLand }), ink(fissures.map((f) => ({ pts: f, tension: 0.2 })), rr, { w: 1.3, amt: 0.3, color: 'FFB8461E', fx: fxLand })];
  } });
  s.add(k.in({ name: 'plain in', cx: 450, cy: 392, t0: 4, t1: 60 }, [
    wc(ids, plain, M.ash, rng(202), { alpha: 0.44, off: [0, 0], grain: 0.8 }),
    plainInk,
  ]));

  // --- crags at the verge, low behind the waymark
  const crag = [P(120, 395), P(128, 374), P(140, 368), P(152, 354), P(168, 362), P(186, 348), P(204, 358), P(222, 344), P(240, 356), P(258, 350), P(274, 364), P(290, 370), P(302, 395)];
  s.add(k.in({ name: 'crags in', cx: 210, cy: 390, t0: 30, t1: 90, sc: 0.96 }, [
    wc(ids, crag, M.slag, rng(56), { alpha: 0.62, off: [2, 3], grain: 0.9, tension: 0.25 }),
    k.boil({ name: 'crag ink', seed: 55, draw: (rr) => [
      ink({ pts: crag.slice(1, -1), tension: 0.25 }, rr, { w: 1.6, amt: 0.5, fx: fxLand }),
      ink([[P(186, 350), P(192, 372)], [P(222, 346), P(216, 366)], [P(152, 356), P(158, 374)], [P(258, 352), P(262, 370)]], rr, { w: 1, amt: 0.3, color: INK_SOFT, fx: fxLand }),
    ] }),
  ]));

  // --- the waymark at the verge: a charred stake bound with iron, the Eye daubed on it in red.
  // The arms are HTML (real links) laid over it at PX, from y 122 down.
  const postBody = [P(PX - 5.5, PT + 8), P(PX + 5.5, PT + 8), P(PX + 6, 393), P(PX - 6.2, 393)];
  const postCap = [P(PX - 7.5, PT + 8), P(PX + 7.5, PT + 8), P(PX + 1, PT - 9), P(PX - 1.5, PT - 8)];
  const bands = [156, 248, 340].map((y) => [P(PX - 7, y), P(PX + 7, y + 1)]);
  const daub = lens(9, 5, 8).map((p) => P(p.x + PX, p.y + PT + 14));
  const postInk = k.boil({
    name: 'post ink', seed: 131, draw: (rr) => [
      ink([[postBody[0], postBody[3]], [postBody[1], postBody[2]]], rr, { w: 1.9, amt: 0.45, n: 12, fx: fxPost }),
      ink({ pts: postCap, closed: true }, rr, { w: 1.6, amt: 0.3, fx: fxPost, tension: 0.2 }),
      ink(bands, rr, { w: 1.6, amt: 0.3, fx: fxPost }),
      ink([[P(PX - 1.5, 176), P(PX - 1, 200)], [P(PX + 2, 214), P(PX + 2.4, 232)], [P(PX - 2, 268), P(PX - 1.6, 300)]], rr, { w: 0.9, amt: 0.3, color: INK_SOFT, fx: fxPost }),
      ink([[P(PX - 12, 393), P(PX - 15, 386)], [P(PX + 9, 393), P(PX + 13, 387)]], rr, { w: 1.2, amt: 0.3, fx: fxPost }),
    ],
  });
  const postId = ids.next();
  s.add(group({ name: 'waymark', id: postId }, [k.in({ name: 'post in', cx: PX, cy: 393, t0: 58, t1: 112 }, [
    wc(ids, postBody, '5E4C42', rng(132), { alpha: 0.9, off: [1, 0], wobble: 0.6, grain: 0.6, soft: false, blend: 'normal' }),
    wc(ids, postCap, '3C3436', rng(133), { alpha: 0.92, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, daub, M.blood, rng(134), { alpha: 0.95, off: [0.4, 0.3], wobble: 0.3, grain: 0, soft: false, blend: 'normal', tension: 1 }),
    stippleShape({ name: 'pupil', dots: [{ x: PX, y: PT + 14, r: 1 }], color: INK }),
    postInk,
  ])]));

  // --- the orc camp: two hide tents, the Red Eye on a pole, and a watch-fire
  const tent1 = [P(312, 393), P(336, 356), P(362, 393)];
  const tent2 = [P(364, 393), P(382, 366), P(400, 393)];
  const POLE = P(412, 318), FIRE = P(450, 388);
  const campInk = k.boil({ name: 'camp ink', seed: 191, draw: (rr) => [
    ink([{ pts: tent1, tension: 0.15 }, { pts: tent2, tension: 0.15 }, [P(336, 356), P(332, 346)], [P(336, 356), P(341, 347)], [P(382, 366), P(379, 358)], [P(382, 366), P(386, 359)], [P(336, 362), P(331, 393)], [P(382, 371), P(386, 393)]], rr, { w: 1.5, amt: 0.35, fx: fxCamp }),
    ink([[P(412, 395), P(POLE.x, POLE.y - 2)], [P(436, 393), P(462, 384)], [P(438, 385), P(464, 393)]], rr, { w: 1.7, amt: 0.35, fx: fxCamp }),
  ] });
  const bannerId = ids.next(), bannerFlap = ids.next();
  const banner = [P(0, 0), P(24, 2), P(22, 12), P(26, 22), P(12, 19), P(1, 24)];
  s.add(k.in({ name: 'camp in', cx: 380, cy: 393, t0: 70, t1: 126 }, [
    wc(ids, tent1, M.hide, rng(192), { alpha: 0.6, off: [1, 1], wobble: 0.8, grain: 0.6, soft: false }),
    wc(ids, tent2, M.hide, rng(193), { alpha: 0.52, off: [1, 1], wobble: 0.8, grain: 0.6, soft: false }),
    campInk,
    group({ name: 'banner', id: bannerId, x: POLE.x, y: POLE.y, rotation: 0.5 }, [group({ name: 'flap', id: bannerFlap }, [
      wc(ids, banner, M.blood, rng(194), { alpha: 0.88, off: [0.5, 0.5], wobble: 0.4, grain: 0.3, soft: false, tension: 0.3 }),
      wc(ids, lens(10, 5, 8).map((p) => P(p.x + 12, p.y + 10)), M.flame, rng(195), { alpha: 0.95, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal', tension: 1 }),
      ink([{ pts: banner, closed: true, tension: 0.3 }, [P(12, 7.6), P(12, 12.4)]], rng(196), { w: 1.1, amt: 0.15, fx: fxCamp }),
    ])]),
  ]));

  // --- the Tower's rock, and the road from its gate across the plain toward the Mountain
  const CX = 744;
  const mound = [P(584, 396), P(598, 380), P(620, 372), P(638, 360), P(654, 364), P(668, 372), P(824, 372), P(838, 360), P(856, 366), P(872, 352), P(886, 362), P(894, 380), P(896, 396)];
  const roadL = [P(728, 375), P(690, 372), P(640, 364), P(596, 352), P(562, 343)];
  const roadR = [P(760, 380), P(716, 386), P(660, 380), P(604, 364), P(566, 348)];
  s.add(k.in({ name: 'road in', cx: 650, cy: 372, t0: 70, t1: 124 }, [
    wc(ids, [...roadL, ...roadR.slice().reverse()], M.pale, rng(152), { alpha: 0.85, off: [0, 0], grain: 0.6, blend: 'normal' }),
    k.boil({ name: 'road ink', seed: 151, draw: (rr) => {
      const cut = (pts) => resample(pts, 12).reduce((acc, p, i, a) => (i % 3 === 0 && a[i + 1] ? [...acc, [p, a[i + 1], a[i + 2] || a[i + 1]]] : acc), []);
      return ink([...cut(roadL), ...cut(roadR)], rr, { w: 1.2, amt: 0.4, fx: fxLand });
    } }),
  ]));
  s.add(k.in({ name: 'mound in', cx: 740, cy: 396, t0: 16, t1: 70, sc: 0.96 }, [
    wc(ids, mound, M.slag, rng(141), { alpha: 0.7, off: [1, 3], grain: 0.8, tension: 0.25 }),
    k.boil({ name: 'mound ink', seed: 142, draw: (rr) => [
      ink([{ pts: mound.slice(1, 6), tension: 0.25 }, { pts: mound.slice(7, -1), tension: 0.25 }], rr, { w: 1.7, amt: 0.4, fx: fxTower }),
      ink([[P(640, 364), P(646, 384)], [P(856, 368), P(850, 388)], [P(874, 356), P(880, 374)]], rr, { w: 1, amt: 0.3, color: INK_SOFT, fx: fxTower }),
    ] }),
  ]));

  // --- Barad-dûr: tier on tier of black stone, spiked at every ledge, two horns at the top
  // and the Eye between them. Built as one silhouette, then inked tier by tier.
  const TIERS = [
    { y0: 372, y1: 304, hb: 84, ht: 74, ledge: 92, spike: 22 },
    { y0: 300, y1: 214, hb: 62, ht: 50, ledge: 68, spike: 18 },
    { y0: 210, y1: 134, hb: 42, ht: 32, ledge: 48, spike: 15 },
    { y0: 130, y1: 102, hb: 30, ht: 26 },
  ];
  const side = (sg) => {
    const pts = [];
    for (const t of TIERS) {
      pts.push(P(CX + sg * t.hb, t.y0), P(CX + sg * t.ht, t.y1 + 4));
      if (t.ledge) pts.push(P(CX + sg * t.ledge, t.y1 + 2), P(CX + sg * (t.ledge + 3), t.y1 - t.spike), P(CX + sg * (t.ledge - 7), t.y1 - 2));
    }
    return pts;
  };
  const hornL = [P(717, 102), P(709, 78), P(703, 52), P(706, 30), P(713, 12), P(718, 34), P(717, 52), P(724, 74), P(731, 102)];
  const hornR = [P(757, 102), P(764, 74), P(771, 52), P(772, 32), P(780, 10), P(785, 32), P(784, 54), P(779, 78), P(771, 102)];
  const towerPts = [...side(-1), ...hornL, P(744, 107), ...hornR, ...side(1).reverse()];
  // the cruel pinnacles: spires standing up along every ledge, and a turret either side
  const pinnacles = [];
  TIERS.forEach((t, i) => {
    if (!t.ledge) return;
    const inner = TIERS[i + 1].hb;
    for (const sg of [-1, 1]) {
      const x = CX + sg * (inner + (t.ledge - inner) * 0.45), h = t.spike * (sg < 0 ? 0.7 : 0.85);
      pinnacles.push([P(x - 3, t.y1 + 1), P(x - 1, t.y1 - h * 0.6), P(x + sg * 0.5, t.y1 - h), P(x + 1.5, t.y1 - h * 0.6), P(x + 3, t.y1 + 1)]);
    }
  });
  const turret = (cx, top, hw) => [P(cx - hw, 374), P(cx - hw, top + 8), P(cx - hw - 4, top + 6), P(cx - hw + 2, top - 2), P(cx, top - 30), P(cx + hw - 2, top - 2), P(cx + hw + 4, top + 6), P(cx + hw, top + 8), P(cx + hw, 374)];
  const turrets = [turret(652, 262, 13), turret(842, 226, 15)];
  const ledges = TIERS.filter((t) => t.ledge).map((t) => [P(CX - t.ledge, t.y1 + 2), P(CX + t.ledge, t.y1 + 2)]);
  const buttress = TIERS.slice(0, 3).flatMap((t) => [-1, 1].map((sg) => [P(CX + sg * (t.hb - 16), t.y0), P(CX + sg * (t.ht - 14), t.y1 + 6)]));
  // arrow-slits, which burn red after dark
  const SLITS = [[714, 336], [774, 330], [696, 262], [736, 250], [788, 270], [722, 176], [762, 184], [744, 118], [652, 300], [842, 270], [842, 320]];
  const slitInk = SLITS.map(([x, y]) => [P(x, y - 4), P(x, y + 4)]);
  const towerInk = k.boil({ name: 'tower ink', seed: 161, draw: (rr) => [
    ink({ pts: towerPts.slice(1, -1), tension: 0.15 }, rr, { w: 2, amt: 0.5, fx: fxTower, bleed: 0.14 }),
    ink(ledges, rr, { w: 1.6, amt: 0.4, fx: fxTower }),
    ink(buttress, rr, { w: 1.1, amt: 0.4, fx: fxTower }),
    ink(slitInk, rr, { w: 1.6, amt: 0.2, fx: fxTower, color: 'FF1C1416' }),
    ink(pinnacles.map((p) => ({ pts: p, tension: 0.2 })), rr, { w: 1.2, amt: 0.2, fx: fxTower }),
  ] });
  s.add(k.in({ name: 'turrets in', cx: CX, cy: 372, t0: 16, t1: 84, sc: 0.95, ease: EASE.out }, [
    ...turrets.map((t, i) => wc(ids, t, M.soot, rng(165 + i), { alpha: 0.8, off: [2, 2], wobble: 1, grain: 0.6, tension: 0.15 })),
    k.boil({ name: 'turret ink', seed: 167, draw: (rr) => ink(turrets.map((t) => ({ pts: t, tension: 0.15 })), rr, { w: 1.8, amt: 0.4, fx: fxTower, bleed: 0.12 }) }),
  ]));
  s.add(k.in({ name: 'tower in', cx: CX, cy: 372, t0: 20, t1: 100, sc: 0.95, ease: EASE.out }, [
    wc(ids, towerPts, M.soot, rng(162), { alpha: 0.86, off: [2, 2], wobble: 1.2, grain: 0.7, tension: 0.15 }),
    ...pinnacles.map((p, i) => wc(ids, p, M.soot, rng(180 + i), { alpha: 0.86, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false, tension: 0.2 })),
    // the shadowed east face, and Orodruin's light catching the west
    wc(ids, [P(CX + 4, 372), P(CX + 4, 106), P(760, 102), P(CX + 30, 134), P(CX + 60, 216), P(CX + 78, 306), P(CX + 78, 372)], M.deep, rng(163), { alpha: 0.4, off: [0, 0], wobble: 1, grain: 0.3, tension: 0.2 }),
    wc(ids, [P(668, 370), P(674, 310), P(694, 300), P(698, 220), P(706, 214), P(708, 140), P(720, 134), P(714, 300), P(690, 372)], M.ember, rng(164), { alpha: 0.22, off: [0, 0], wobble: 1, grain: 0.2, hazy: true, tension: 0.4 }),
    towerInk,
  ]));

  // --- the Tower's gate, at its foot: the door you knock on
  const D = P(744, 372), DW = 32, DH = 52;
  const arch = [P(D.x - DW / 2, D.y), P(D.x - DW / 2, D.y - 30), P(D.x - 11, D.y - 44), P(D.x, D.y - DH), P(D.x + 11, D.y - 44), P(D.x + DW / 2, D.y - 30), P(D.x + DW / 2, D.y)];
  const archOuter = arch.map((p) => P(D.x + (p.x - D.x) * 1.34, D.y + (p.y - D.y) * 1.16));
  const doorBars = [-8, 0, 8].map((dx) => [P(D.x + dx, D.y - (dx ? 40 : 48)), P(D.x + dx, D.y - 1)]);
  const leafId = ids.next(), insideId = ids.next(), spillId = ids.next(), glintId = ids.next();
  const doorInk = k.boil({ name: 'door ink', seed: 112, draw: (rr) => [
    ink({ pts: arch, tension: 0.3 }, rr, { w: 1.8, amt: 0.4, fx: fxTower }),
    ink(doorBars, rr, { w: 1, amt: 0.3, color: 'FF1C1416', fx: fxTower }),
    ink([[P(D.x - 15, D.y - 20), P(D.x + 15, D.y - 20)]], rr, { w: 1.3, amt: 0.3, fx: fxTower }),
  ] });
  s.add(k.in({ name: 'door in', cx: D.x, cy: D.y, t0: 60, t1: 110 }, [
    wc(ids, archOuter, M.rock, rng(113), { alpha: 0.6, off: [1, 1], wobble: 0.8, grain: 0.6, tension: 0.3 }),
    ink({ pts: archOuter, tension: 0.3 }, rng(114), { w: 1.6, amt: 0.4, fx: fxTower }),
    group({ name: 'inside', id: insideId, opacity: 0 }, [
      wc(ids, arch, 'C8452A', rng(115), { alpha: 1, off: [0, 0], wobble: 0, grain: 0.2, soft: false, blend: 'normal', tension: 0.3 }),
      glow({ x: D.x + 4, y: D.y - 22, w: 60, h: 70, color: 'F5A04A', alpha: 0.85 }),
    ]),
    group({ name: 'leaf', id: leafId, x: D.x - DW / 2, y: D.y }, [
      group({ name: 'leaf body', x: -(D.x - DW / 2), y: -D.y }, [
        wc(ids, arch, '3A3032', rng(116), { alpha: 0.96, off: [1, 1], wobble: 0.6, grain: 0.7, blend: 'normal', tension: 0.3 }),
        stippleShape({ name: 'rivets', dots: [-11, -4, 4, 11].flatMap((dx) => [{ x: D.x + dx, y: D.y - 27, r: 0.9 }, { x: D.x + dx, y: D.y - 13, r: 0.9 }]), color: argb('8A7A70', 0.9) }),
        doorInk,
        // the grille in the door, where a red light shows when you come near
        el('Shape', { name: 'glint', id: glintId, x: D.x, y: D.y - 34, opacity: 0.2 }, [el('Rectangle', { width: 7, height: 4, originX: 0.5, originY: 0.5, name: 'R' }), fill('FFF06A2E')]),
      ]),
    ]),
  ]));
  // a hide mat at the step for regulars: they're expected
  const matId = ids.next();
  const mat = [P(726, 374), P(762, 374), P(766, 380), P(722, 380)];
  s.add(group({ name: 'mat', id: matId, opacity: REGULAR0 }, [
    wc(ids, mat, M.hide, rng(198), { alpha: 0.75, off: [0.5, 0.5], wobble: 0.4, grain: 0.6, soft: false }),
    ink([{ pts: mat, closed: true }, [P(730, 377), P(758, 377)]], rng(199), { w: 1.1, amt: 0.2, tension: 0.3 }),
  ]));
  const regular = s.input('bool', 'regular', REGULAR0);
  s.boolLayer('regular', regular, hold(s, 'no mat', [{ object: matId, prop: 'opacity', keys: [[0, 0]] }]), hold(s, 'mat', [{ object: matId, prop: 'opacity', keys: [[0, 1]] }]), { mixIn: 600, mixOut: 300 });

  // stones shaken loose from the ledges when the gate is slammed
  const stones = [
    { x: CX - 84, y: 300, dx: -10, len: 70, delay: 0 },
    { x: CX + 60, y: 210, dx: 8, len: 150, delay: 6 },
    { x: CX - 44, y: 130, dx: -6, len: 230, delay: 12 },
  ].map((st, i) => ({ ...st, id: ids.next(), seed: 170 + i }));
  for (const st of stones) {
    const pts = blobPts(3, 2.4, rng(st.seed), { n: 6, wobble: 0.2 });
    s.add(group({ name: 'stone', id: st.id, x: st.x, y: st.y, opacity: 0 }, [
      wc(ids, pts, M.rock, rng(st.seed + 1), { alpha: 0.95, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
      ink({ pts, closed: true }, rng(st.seed + 2), { w: 0.9, amt: 0.15 }),
    ]));
  }

  // --- the Nazgûl, circling the Tower on their fell beasts
  const beastCels = [
    [P(0, -4), P(3, -2), P(9, -8), P(16, -13), P(23, -10), P(18, -8), P(17, -4), P(12, -4), P(9, -1), P(4, 2), P(1, 8), P(-1, 8), P(-4, 2), P(-9, -1), P(-12, -4), P(-17, -4), P(-18, -8), P(-23, -10), P(-16, -13), P(-9, -8), P(-3, -2)],
    [P(0, -4), P(3, -2), P(9, -1), P(16, 2), P(23, 8), P(17, 6), P(14, 8), P(10, 5), P(6, 4), P(3, 4), P(1, 9), P(-1, 9), P(-3, 4), P(-6, 4), P(-10, 5), P(-14, 8), P(-17, 6), P(-23, 8), P(-16, 2), P(-9, -1), P(-3, -2)],
  ];
  const beast = (name, seed, extra = []) => {
    const flapId = ids.next();
    const cels = beastCels.map((pts, cel) => {
      const cid = ids.next();
      const br = rng(seed + cel);
      return { cid, xml: el('Node', { name: `wings${cel}`, id: cid }, [
        wc(ids, pts, M.deep, br, { alpha: 0.85, off: [0.6, 0.6], wobble: 0.4, grain: 0, soft: false, tension: 0.35 }),
        ink({ pts, closed: true, tension: 0.35 }, br, { w: 1.2, amt: 0.25 }),
      ].reverse()) };
    });
    // a hooded rider, hunched on its neck
    const rider = [P(-2.5, -3), P(-1.5, -8), P(0, -10), P(1.5, -8), P(2.5, -3)];
    const xml = [
      el('Solo', { name: 'flap', id: flapId, activeComponentId: cels[0].cid }, cels.map((c) => c.xml)),
      wc(ids, rider, M.deep, rng(seed + 5), { alpha: 0.9, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal', tension: 0.5 }),
      ink({ pts: rider, tension: 0.5 }, rng(seed + 6), { w: 1, amt: 0.15 }),
      ...extra,
    ];
    return { flapId, cels, xml: group({ name }, xml) };
  };
  const orbitDur = 1500;
  const orbits = [
    { cx: 744, cy: 112, rx: 172, ry: 34, ph: 0, sc: 0.85, seed: 31 },
    { cx: 716, cy: 150, rx: 236, ry: 48, ph: 0.55, sc: 0.7, seed: 37 },
  ];
  const orbitTracks = [];
  const nazKids = [];
  const nazHits = [];
  orbits.forEach((o, i) => {
    const id = ids.next(), hitId = ids.next();
    nazHits.push(hitId);
    const b = beast(`nazgul${i}`, o.seed, [hit(hitId, 0, 0, 50, 30)]);
    s.loopLayer(`nazgul${i} flap`, ambient(s, { name: `naz flap${i}`, duration: 28 + i * 4, loop: 'loop', tracks: [{ object: b.flapId, prop: 'activeComponentId', type: 'Id', keys: [[0, b.cels[0].cid, 'hold'], [14 + i * 2, b.cels[1].cid, 'hold']] }] }));
    nazKids.push(group({ name: `nazgul${i}`, id, x: o.cx + o.rx, y: o.cy, scaleX: o.sc, scaleY: o.sc }, [b.xml]));
    const th = (t) => (t + o.ph) * TAU;
    // nearer (lower, bigger) on the front of the circle; it banks as it turns
    orbitTracks.push(
      sampled(id, 'x', orbitDur, TICK, (t) => o.cx + Math.cos(th(t)) * o.rx),
      sampled(id, 'y', orbitDur, TICK, (t) => o.cy + Math.sin(th(t)) * o.ry),
      sampled(id, 'scaleX', orbitDur, TICK, (t) => o.sc * (0.82 + 0.3 * (Math.sin(th(t)) + 1) / 2)),
      sampled(id, 'scaleY', orbitDur, TICK, (t) => o.sc * (0.82 + 0.3 * (Math.sin(th(t)) + 1) / 2)),
      sampled(id, 'rotation', orbitDur, TICK, (t) => -Math.sin(th(t)) * 0.22),
    );
  });
  s.add(k.in({ name: 'nazgul in', t0: 120, t1: 170 }, nazKids));
  s.loopLayer('nazgul', ambient(s, { name: 'nazgul circle', duration: orbitDur, loop: 'loop', tracks: orbitTracks }));
  // and one that stoops out of the sky at you, screeching
  const swoopId = ids.next();
  const swooper = beast('swooper', 43);
  s.loopLayer('swooper flap', ambient(s, { name: 'swoop flap', duration: 16, loop: 'loop', tracks: [{ object: swooper.flapId, prop: 'activeComponentId', type: 'Id', keys: [[0, swooper.cels[0].cid, 'hold'], [8, swooper.cels[1].cid, 'hold']] }] }));
  s.add(group({ name: 'swoop', id: swoopId, x: 900, y: 20, opacity: 0, scaleX: 0.5, scaleY: 0.5 }, [swooper.xml]));

  // --- ash, always falling, drifting west; and a gust that carries it off
  const ashId = ids.next();
  const sheets = [];
  const ashTracks = [];
  const aDur = 960;
  for (let j = 0; j < 2; j++) {
    const id = ids.next();
    const fr = rng(250 + j);
    const dots = [], embers = [];
    for (let i = 0; i < 34; i++) dots.push({ x: fr.range(10, 890), y: fr.range(-60, 330), r: fr.range(0.7, 1.6) });
    for (let i = 0; i < 6; i++) embers.push({ x: fr.range(380, 890), y: fr.range(-20, 320), r: fr.range(0.7, 1.2) });
    sheets.push(group({ name: `ash${j}`, id, opacity: 0 }, [stippleShape({ dots, color: argb('5C524E', 0.62) }), stippleShape({ name: 'embers', dots: embers, color: argb('E7832F', 0.85) })]));
    const at = (t) => (t + j / 2) % 1;
    ashTracks.push(
      sampled(id, 'y', aDur, TICK, (t) => at(t) * 80),
      sampled(id, 'x', aDur, TICK, (t) => -at(t) * 30 + Math.sin(at(t) * TAU) * 6),
      sampled(id, 'opacity', aDur, TICK, (t) => { const u = at(t); return u < 0.03 || u > 0.97 ? 0 : Math.min(1, (u - 0.03) / 0.25, (0.97 - u) / 0.25); }),
    );
  }
  s.add(group({ name: 'ash', id: ashId }, sheets));
  s.loopLayer('ashfall', ambient(s, { name: 'ashfall', duration: aDur, loop: 'loop', tracks: ashTracks }));

  // --- the light of the hour, one even glaze over the whole painting
  const [glazeXml, glazeTracks] = hourGlaze(ids, W, H, 1);
  s.add(glazeXml);
  for (const t of glazeTracks) tp(t.object, t.prop, t.vals, t.type);

  // --- by night, one white star above a tor of the Ephel Dúath, as Sam saw it
  const starId = ids.next(), starTw = ids.next();
  s.add(k.in({ name: 'star in', cx: 96, cy: 190, t0: 80, t1: 120, sc: 0.3, ease: EASE.back }, [group({ name: 'star', id: starId, x: 96, y: 190, opacity: TIME0 === 4 ? 1 : 0 }, [
    glow({ x: 0, y: 0, w: 34, h: 34, color: 'F4ECD8', alpha: 0.5 }),
    group({ name: 'twinkle', id: starTw }, [el('Shape', { name: 'star' }, [polyXml(starPts(5.5), { closed: true }), fill(argb('F8F2DE', 0.98)), stroke(INK, 0.9)])]),
  ])]));
  tp(starId, 'opacity', [0, 0, 0, 0, 1]);
  gatedLoop(s, 'twinkle', ambient(s, { name: 'twinkle', duration: 240, loop: 'loop', tracks: [
    sampled(starTw, 'scaleX', 240, TICK, (t) => 1 + 0.25 * Math.sin(t * TAU)), sampled(starTw, 'scaleY', 240, TICK, (t) => 1 + 0.25 * Math.sin(t * TAU)),
  ] }), [[time, 'equal', 4]]);

  // --- firelight, which sits above the glaze: the crater, the lava, the cracks, the Tower's
  // slits, the camp's fire and the watch-fires up on the mountains
  const litId = ids.next(), craterGlow = ids.next();
  const glowLine = (pts, w, alpha, name) => el('Shape', { name }, [pathXml(pts, { tension: 0.6 }), stroke(argb('F0803A', alpha), w, { feather: w * 0.8 })]);
  s.add(k.in({ name: 'lit in', t0: 90, t1: 150 }, [
    group({ name: 'lit', id: litId, opacity: LIT[TIME0] }, [
      group({ name: 'crater glow', id: craterGlow }, [glow({ x: 500, y: 186, w: 96, h: 56, color: 'F07A3A', alpha: 0.7 })]),
      glowLine(lava, 7, 0.55, 'lava glow'),
      glowLine(lava2, 5, 0.45, 'lava glow'),
      ...fissures.map((f) => glowLine(f, 5, 0.5, 'crack glow')),
      ...SLITS.map(([x, y]) => el('Shape', { name: 'slit', x, y }, [el('Rectangle', { width: 2.6, height: 8, originX: 0.5, originY: 0.5, name: 'R' }), fill(argb('F28A3A', 0.95))])),
      ...SLITS.map(([x, y]) => glow({ x, y, w: 16, h: 20, color: 'F07A3A', alpha: 0.5 })),
      glow({ x: D.x, y: D.y - 2, w: 44, h: 10, color: 'F07A3A', alpha: 0.6 }),
      ...[[122, 232], [246, 212], [336, 254], [612, 352]].map(([x, y]) => glow({ x, y, w: 14, h: 14, color: 'F5A04A', alpha: 0.95 })),
      glow({ x: FIRE.x, y: FIRE.y - 8, w: 80, h: 64, color: 'F5A04A', alpha: 0.6 }),
    ]),
  ]));
  tp(litId, 'opacity', LIT);

  // the watch-fire itself, bright at any hour, with sparks going up
  const fireId = ids.next();
  const fireKids = [k.boil({ name: 'watch-fire', seed: 181, draw: (rr) => {
    const outer = flamePts(18, 20, rr, 3), inner = flamePts(9, 11, rr, 2);
    return [
      wc(ids, outer, M.fire, rr, { alpha: 0.95, off: [0, 0], wobble: 0.4, grain: 0, soft: false, blend: 'normal', tension: 0.5 }),
      wc(ids, inner, M.core, rr, { alpha: 0.95, off: [0, 0], wobble: 0.3, grain: 0, soft: false, blend: 'normal', tension: 0.5 }),
      ink({ pts: outer, closed: true, tension: 0.5 }, rr, { w: 1.1, amt: 0.2, color: EMBER_INK }),
    ];
  } })];
  const sparkTracks = [];
  for (let i = 0; i < 4; i++) {
    const id = ids.next();
    fireKids.push(el('Shape', { name: 'spark', id, x: 0, y: -12, opacity: 0 }, [el('Ellipse', { width: 2, height: 2, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('F8C45A', 1))]));
    const at = (t) => (t + i / 4) % 1;
    sparkTracks.push(
      sampled(id, 'y', 240, TICK, (t) => -12 - at(t) * 40),
      sampled(id, 'x', 240, TICK, (t) => Math.sin(at(t) * 9 + i * 2) * 5 + (i - 1.5) * 2),
      sampled(id, 'opacity', 240, TICK, (t) => (at(t) < 0.05 ? 0 : Math.max(0, 1 - at(t)))),
    );
  }
  s.add(k.in({ name: 'fire in', cx: FIRE.x, cy: FIRE.y, t0: 96, t1: 140, sc: 0.2, ease: EASE.back }, [group({ name: 'fire', id: fireId, x: FIRE.x, y: FIRE.y - 4 }, fireKids)]));
  s.loopLayer('sparks', ambient(s, { name: 'sparks', duration: 240, loop: 'loop', tracks: sparkTracks }));

  // --- the Eye. "The Eye was rimmed with fire, but was itself glazed, yellow as a cat's,
  // watchful and intent, and the black slit of its pupil opened on a pit, a window into nothing."
  // lookX / lookY (0..100, 50 ahead) blend its gaze; narrow squints it; flare makes it blaze
  const E = P(744, 62);
  const flareId = ids.next(), lookId = ids.next(), squintId = ids.next(), pupilId = ids.next(), clipId = ids.next(), rimId = ids.next(), nightGlow = ids.next(), hotId = ids.next();
  const almond = lens(52, 25, 14, -0.03);
  const rimInk = k.boil({ name: 'eye rim', seed: 221, draw: (rr) => {
    const rim = rimPts(34, 19, rr);
    return [
      wc(ids, rim, M.ember, rr, { alpha: 0.8, off: [0, 0], wobble: 0.6, grain: 0.2, soft: false, blend: 'normal', tension: 0.7 }),
      wc(ids, rimPts(29, 16, rr, 18), M.fire, rr, { alpha: 0.85, off: [0, 0], wobble: 0.4, grain: 0, soft: false, blend: 'normal', tension: 0.7 }),
      wc(ids, rimPts(25, 13.5, rr, 14).map((p) => P(p.x * 0.95, p.y * 0.9)), M.flame, rr, { alpha: 0.6, off: [0, 0], wobble: 0.4, grain: 0, soft: false, blend: 'normal', tension: 0.7 }),
      ink({ pts: rim, closed: true, tension: 0.7 }, rr, { w: 1.2, amt: 0.3, color: EMBER_INK, fx: fxEye, bleed: 0.15 }),
    ];
  } });
  const almondInk = k.boil({ name: 'eye ink', seed: 222, draw: (rr) => ink({ pts: almond, closed: true, tension: 0.8 }, rr, { w: 1.5, amt: 0.25, color: 'FF5A1E10', fx: fxEye }) });
  const pupil = slit(6.5, 25);
  s.add(k.in({ name: 'eye in', cx: E.x, cy: E.y, t0: 100, t1: 150, sc: 0.1, ease: EASE.back }, [
    group({ name: 'eye', x: E.x, y: E.y }, [
      group({ name: 'night glow', id: nightGlow, opacity: LIT[TIME0] }, [glow({ x: 0, y: 4, w: 260, h: 190, color: 'E9682E', alpha: 0.42 })]),
      group({ name: 'flare', id: flareId }, [
        glow({ x: 0, y: 0, w: 150, h: 100, color: 'F08A3A', alpha: 0.6 }),
        group({ name: 'rim', id: rimId }, [rimInk]),
        group({ name: 'look', id: lookId }, [
          group({ name: 'squint', id: squintId }, [
            wc(ids, almond, M.flame, rng(223), { alpha: 1, off: [0, 0], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal', tension: 0.8 }),
            wc(ids, lens(34, 15, 10), M.core, rng(224), { alpha: 0.9, off: [0, 0], wobble: 0.5, grain: 0, soft: false, blend: 'normal', tension: 0.8 }),
            el('Shape', { name: 'eye clip', id: clipId }, [pathXml(almond, { closed: true, tension: 0.8 })]),
            group({ name: 'pupil', id: pupilId }, [
              el('ClippingShape', { sourceId: clipId, name: 'Clip' }),
              ink(Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * TAU + 0.2; return [P(Math.cos(a) * 5, Math.sin(a) * 4.5), P(Math.cos(a) * 14, Math.sin(a) * 9)]; }), rng(227), { w: 0.7, amt: 0.6, color: 'FFB0601E' }),
              group({ name: 'hot', id: hotId, opacity: 0 }, [glow({ x: 0, y: 0, w: 22, h: 30, color: 'FFF4C0', alpha: 0.9 })]),
              wc(ids, pupil, '1A1012', rng(225), { alpha: 1, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal', tension: 0.8 }),
              ink({ pts: pupil, closed: true, tension: 0.8 }, rng(226), { w: 1, amt: 0.1, color: 'FF120A0C' }),
            ]),
            almondInk,
          ]),
        ]),
      ]),
    ]),
  ]));
  tp(nightGlow, 'opacity', [0.5, 0.35, 0.6, 0.9, 1]);

  // --- hit areas
  const hDoor = ids.next(), hDoom = ids.next(), hEye = ids.next(), hFire = ids.next(), hBanner = ids.next();
  s.add(hit(hDoom, 500, 260, 170, 160), hit(hDoor, D.x, D.y - 26, 46, 60), hit(hEye, E.x, E.y, 100, 80), hit(hFire, FIRE.x, FIRE.y - 10, 34, 34), hit(hBanner, POLE.x + 12, POLE.y + 12, 44, 44));

  // --- poses: the hour
  poseLayer(s, 'time', time, 5, timeP);

  // --- the Eye's gaze: two blend axes, each a pose at either side and one straight ahead
  const look = (name, tracks) => s.anim({ name, duration: 1, tracks: tracks.map(([object, prop, v]) => ({ object, prop, keys: [[0, v]] })) });
  const lookX = s.input('number', 'lookX', 50), lookY = s.input('number', 'lookY', 50);
  s.blendLayer('lookX', lookX, [-1, 0, 1].map((d, i) => ({ value: i * 50, anim: look(`look x ${d}`, [
    [pupilId, 'x', d * 11.5], [lookId, 'x', d * 3.4], [squintId, 'scaleX', 1 - Math.abs(d) * 0.07], [rimId, 'rotation', -d * 0.07], [rimId, 'x', d * 1.5],
  ]) })));
  s.blendLayer('lookY', lookY, [-1, 0, 1].map((d, i) => ({ value: i * 50, anim: look(`look y ${d}`, [
    [pupilId, 'y', d * 5.5], [lookId, 'y', d * 2.6], [rimId, 'y', d * 1.2],
  ]) })));
  // narrowed, when you reach for something
  const narrow = s.input('bool', 'narrow', 0);
  s.boolLayer('narrow', narrow,
    hold(s, 'wide', [{ object: squintId, prop: 'scaleY', keys: [[0, 1]] }, { object: pupilId, prop: 'scaleX', keys: [[0, 1]] }, { object: hotId, prop: 'opacity', keys: [[0, 0]] }]),
    hold(s, 'narrowed', [{ object: squintId, prop: 'scaleY', keys: [[0, 0.48]] }, { object: pupilId, prop: 'scaleX', keys: [[0, 0.55]] }, { object: hotId, prop: 'opacity', keys: [[0, 0.8]] }]),
    { mixIn: 260, mixOut: 700 });
  // the Eye blazes up
  const flare = s.input('trigger', 'flare');
  s.triggerLayer('flare', flare, s.anim({ name: 'flare', duration: 110, tracks: [
    { object: flareId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [10, 1.32, 'cubic', EASE.inOut], [44, 1.08, 'cubic', EASE.inOut], [110, 1]] },
    { object: flareId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [10, 1.4, 'cubic', EASE.inOut], [44, 1.1, 'cubic', EASE.inOut], [110, 1]] },
  ] }), { fromAny: false });
  s.listen(hEye, 'enter', [Scene.fire(flare)]);
  s.listen(hEye, 'click', [Scene.emit(s.event('eye'))]);

  // the door: a knock rattles it; the page decides what comes of it
  const knock = s.input('trigger', 'knock');
  s.triggerLayer('knock', knock, s.anim({ name: 'knock', duration: 16, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [3, 0.97, 'cubic', EASE.out], [7, 1.004, 'cubic', EASE.inOut], [16, 1]] },
  ] }), { mix: 0 });
  const welcome = s.input('trigger', 'welcome');
  s.triggerLayer('welcome', welcome, s.anim({ name: 'welcome', duration: 300, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', [0.4, 0, 0.3, 1]], [50, 0.45, 'hold'], [228, 0.45, 'cubic', [0.45, 0, 0.35, 1]], [288, 1.006, 'cubic', EASE.out], [300, 1]] },
    { object: insideId, prop: 'opacity', keys: [[0, 0, 'hold'], [4, 0, 'cubic', EASE.out], [40, 1, 'hold'], [236, 1, 'cubic', EASE.in], [284, 0]] },
  ] }), { fromAny: false, mix: 0 });
  const slam = s.input('trigger', 'slam');
  const jolt = [[88, 0], [91, 2.2], [94, -1.8], [97, 1.2], [100, -0.7], [104, 0.3], [110, 0]].map(([f, dx]) => [f, D.x - DW / 2 + dx, 'cubic', EASE.inOut]);
  s.triggerLayer('slam', slam, s.anim({ name: 'slam', duration: 120, tracks: [
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'cubic', [0.2, 0.9, 0.3, 1]], [7, 0.14, 'cubic', EASE.inOut], [12, 0.2, 'hold'], [80, 0.2, 'cubic', [0.7, 0, 1, 0.6]], [88, 1.03, 'cubic', EASE.out], [93, 0.985, 'cubic', EASE.inOut], [100, 1]] },
    { object: leafId, prop: 'x', keys: [[0, D.x - DW / 2, 'hold'], ...jolt, [120, D.x - DW / 2]] },
    { object: insideId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [6, 1, 'hold'], [82, 1, 'linear'], [88, 0]] },
  ] }), { fromAny: false, mix: 0 });
  s.listen(hDoor, 'click', [Scene.emit(s.event('door'))]);
  const glint = s.input('trigger', 'glint');
  s.triggerLayer('glint', glint, s.anim({ name: 'glint', duration: 70, tracks: [
    { object: glintId, prop: 'opacity', keys: [[0, 0.2, 'cubic', EASE.out], [8, 1, 'hold'], [14, 0.5, 'hold'], [18, 1, 'cubic', EASE.inOut], [70, 0.2]] },
  ] }), { fromAny: false });
  s.listen(hDoor, 'enter', [Scene.fire(glint)]);

  // the slam shakes stones off the ledges
  const shake = s.input('trigger', 'shake');
  s.triggerLayer('shake', shake, s.anim({ name: 'shake', duration: 120, tracks: stones.flatMap((st) => {
    const end = st.delay + Math.round(Math.sqrt(st.len) * 4.2);
    return [
      { object: st.id, prop: 'opacity', keys: [[0, 0, 'hold'], [st.delay, 1, 'hold'], [end - 4, 1, 'linear'], [end, 0, 'hold'], [120, 0]] },
      { object: st.id, prop: 'y', keys: [[0, st.y, 'hold'], [st.delay, st.y, 'cubic', [0.5, 0, 1, 1]], [end, st.y + st.len, 'hold'], [120, st.y + st.len]] },
      { object: st.id, prop: 'x', keys: [[0, st.x, 'hold'], [st.delay, st.x, 'linear'], [end, st.x + st.dx, 'hold'], [120, st.x + st.dx]] },
      { object: st.id, prop: 'rotation', keys: [[0, 0, 'hold'], [st.delay, 0, 'linear'], [end, 2.4, 'hold'], [120, 2.4]] },
    ];
  }) }), { fromAny: false, mix: 0 });

  // Orodruin, clicked: it rumbles, the crater flares and spits
  const erupt = s.input('trigger', 'erupt');
  const g = 180; // the fall, in units a second squared
  s.triggerLayer('erupt', erupt, s.anim({ name: 'erupt', duration: 150, tracks: [
    { object: doomShake, prop: 'x', keys: [[0, 0, 'linear'], ...Array.from({ length: 12 }, (_, i) => [3 + i * 3, (i % 2 ? -1 : 1) * (1.6 - i * 0.12), 'linear']), [40, 0]] },
    { object: craterGlow, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [14, 1.8, 'cubic', EASE.inOut], [150, 1]] },
    { object: craterGlow, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [14, 2.2, 'cubic', EASE.inOut], [150, 1]] },
    { object: plumeId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [30, 1.06, 'cubic', EASE.inOut], [150, 1]] },
    ...spits.flatMap((sp) => {
      const T = (f) => Math.max(0, (f - sp.delay) / 60);
      return [
        { object: sp.id, prop: 'opacity', keys: [[0, 0, 'hold'], [Math.round(sp.delay), 1, 'hold'], [Math.round(sp.delay) + 80, 1, 'linear'], [Math.round(sp.delay) + 100, 0, 'hold'], [150, 0]] },
        sampled(sp.id, 'x', 150, 3, (u) => 500 + sp.vx * T(u * 150)),
        sampled(sp.id, 'y', 150, 3, (u) => 184 + sp.vy * T(u * 150) + 0.5 * g * T(u * 150) ** 2),
      ];
    }),
  ] }), { fromAny: false, mix: 0 });
  s.listen(hDoom, 'click', [Scene.emit(s.event('doom'))]);
  // and now and then it gives up a ring of gold, which goes up in the smoke
  const ringUp = s.input('trigger', 'ring');
  s.triggerLayer('ring', ringUp, s.anim({ name: 'ring', duration: 240, tracks: [
    { object: oneRing, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [20, 1, 'hold'], [150, 1, 'cubic', EASE.in], [240, 0]] },
    { object: oneRing, prop: 'y', keys: [[0, 178, 'cubic', EASE.out], [240, 92]] },
    { object: oneRing, prop: 'x', keys: [[0, 500, 'cubic', EASE.inOut], [240, 474]] },
    sampled(oneRing, 'rotation', 240, 6, (t) => Math.sin(t * 7) * 0.5),
    { object: oneRing, prop: 'scaleX', keys: [[0, 0.6, 'cubic', EASE.out], [40, 1.3, 'cubic', EASE.inOut], [240, 1.1]] },
    { object: oneRing, prop: 'scaleY', keys: [[0, 0.6, 'cubic', EASE.out], [40, 1.3, 'cubic', EASE.inOut], [240, 1.1]] },
  ] }), { fromAny: false, mix: 0 });

  // a Nazgûl stoops: out of the top right, low over the plain, and away west
  const screech = s.input('trigger', 'screech');
  s.triggerLayer('screech', screech, s.anim({ name: 'screech', duration: 170, tracks: [
    { object: swoopId, prop: 'opacity', keys: [[0, 0, 'hold'], [2, 1, 'hold'], [150, 1, 'linear'], [168, 0, 'hold'], [170, 0]] },
    sampled(swoopId, 'x', 170, 3, (t) => 900 - 560 * t - Math.sin(t * Math.PI) * 40),
    sampled(swoopId, 'y', 170, 3, (t) => 20 + Math.sin(t * Math.PI) ** 1.4 * 190 - t * 30),
    sampled(swoopId, 'scaleX', 170, 3, (t) => -(0.55 + Math.sin(t * Math.PI) * 1.05)),
    sampled(swoopId, 'scaleY', 170, 3, (t) => 0.55 + Math.sin(t * Math.PI) * 1.05),
    sampled(swoopId, 'rotation', 170, 3, (t) => 0.5 - t * 0.9),
  ] }), { fromAny: false, mix: 0 });
  for (const h of nazHits) s.listen(h, 'click', [Scene.emit(s.event(`nazgul-${nazHits.indexOf(h)}`))]);

  // the watch-fire roars up
  const forge = s.input('trigger', 'forge');
  s.triggerLayer('forge', forge, s.anim({ name: 'forge', duration: 120, tracks: [
    { object: fireId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [10, 1.35, 'cubic', EASE.inOut], [120, 1]] },
    { object: fireId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [10, 1.9, 'cubic', EASE.inOut], [40, 1.4, 'cubic', EASE.inOut], [120, 1]] },
  ] }), { fromAny: false });
  s.listen(hFire, 'enter', [Scene.fire(forge)]);

  // the Red Eye run up its pole, and flapping
  const post = s.input('trigger', 'post');
  s.triggerLayer('post', post, s.anim({ name: 'post', duration: 220, tracks: [
    { object: bannerId, prop: 'rotation', keys: [[0, 0.5, 'elastic', { amplitude: 1, period: 0.5 }], [40, -0.12, 'hold'], [170, -0.12, 'cubic', EASE.inOut], [212, 0.5]] },
    sampled(bannerFlap, 'scaleX', 220, 4, (t) => (t < 0.15 || t > 0.8 ? 1 : 1 - Math.abs(Math.sin(t * 40)) * 0.18)),
    sampled(bannerFlap, 'scaleY', 220, 4, (t) => (t < 0.15 || t > 0.8 ? 1 : 1 + Math.sin(t * 40) * 0.08)),
  ] }), { fromAny: false });
  s.listen(hBanner, 'enter', [Scene.fire(post)]);

  // a gust off the mountains: the ash goes sideways and the banner snaps
  const gust = s.input('trigger', 'gust');
  s.triggerLayer('gust', gust, s.anim({ name: 'gust', duration: 110, tracks: [
    { object: ashId, prop: 'x', keys: [[0, 0, 'cubic', EASE.out], [30, -46, 'cubic', EASE.inOut], [110, 0]] },
    { object: ashId, prop: 'y', keys: [[0, 0, 'cubic', EASE.out], [30, 10, 'cubic', EASE.inOut], [110, 0]] },
    { object: bannerFlap, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [12, -0.3, 'cubic', EASE.inOut], [36, 0.12, 'cubic', EASE.inOut], [60, -0.05, 'cubic', EASE.inOut], [90, 0]] },
  ] }), { fromAny: false });

  // on a phone the page plants its own post under the painting
  const bare = s.input('bool', 'bare', 0);
  s.boolLayer('bare', bare, hold(s, 'post up', [{ object: postId, prop: 'opacity', keys: [[0, 1]] }]), hold(s, 'post down', [{ object: postId, prop: 'opacity', keys: [[0, 0]] }]), { mixIn: 0, mixOut: 300 });

  k.finish(still);
  return s.toXml();
}

// pose colour for one registered tint id: (re)derive from the role
function tintColor(key, id, color, k) {
  const t = TINT.get(key).find((x) => x.id === id);
  return argb(t.role === 'rim' ? darken(color, 0.28) : color, Math.min(1, t.alpha * k));
}

// ---------- footer: the Black Gate ----------


// gen.mjs paints Halloween's two artboards from two hands' work: the Hill from tower.mjs, the Gate from lair.mjs
export function paintHill(ids) {
  TINT.clear();
  return hill(ids);
}
