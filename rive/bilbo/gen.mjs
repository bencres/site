// Shire II, Bilbo and Frodo's birthday (22 September): the same hill in the same hand,
// dressed for the Long-expected Party. Autumn only. The Party Tree is hung with paper
// lanterns and bunting runs from it over the chimney to a pole on the crest; a striped
// pavilion stands in the field below; the bench is a long table with the cake on it;
// presents (mathoms) are stacked by the door with Bilbo beside them; Gandalf's cart of
// fireworks waits on the lane, and at dusk and night his rockets go up over the hill.
// Only the post is drawn at the verge; its arms are HTML links laid over the painting.
//
// Two artboards share one file: Hill (the hero) and Gate (the footer, where the
// hand-lettered sign is HTML laid over a painted board).
//
// Inputs, both artboards: season 0..3 (spring, summer, autumn, winter),
// time 0..4 (morning, day, late afternoon, dusk, night), still (skip the intro).
// Hill also: regular (third visit or later), triggers knock, glint, puff, gust,
// rustle, post, shine; bare (hide the post, for phones, where the page plants
// its own signpost under the painting). Gate: close, mouse.
// Party, Hill: lamps (the tree's lanterns light one by one), rocket-flower,
// rocket-birds, rocket-willow, rocket-dragon (the cart sends one up), unwrap-spoons,
// unwrap-mirror, unwrap-pen, unwrap-basket (a present opens), vanish (Bilbo's trick);
// events cart, present, bilbo. Gate: unwrap (the present by the sign); event present.
//
// Performance: one combined boil animation per artboard, washes are hard-edged
// glazes (feathers only on the few big soft ones), glows are radial gradients,
// season/time are 1-frame hold poses picked once at load, and the particle loops
// only run in the season that shows them.
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, lighten, resample, blobPts, pathXml, polyXml,
  fill, stroke, stippleShape, document, EASE, thin,
} from '../lib/ink.mjs';

// the party is in autumn, whatever the page asks
const SEASON0 = 2;
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
// the party's colours (bunting, lanterns, wrapping paper), all from the hill's own box
const PARTY = [C.rose, C.butter, C.sky, '7FAE57', C.violet, C.terra];
// and the fireworks': the same pigments let down bright, for sparks against a dark sky
const SPARK = { gold: 'F5C451', rose: 'E98BA0', sky: 'A9D2EE', green: 'A6D07A', violet: 'B3ACE6', red: 'E0643F', white: 'FBF3DC' };

// ---------- small helpers ----------

const group = (attrs, kids) => el('Node', attrs, [].concat(kids).filter(Boolean).reverse());
const alphaHex = (a) => Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
const circ = (cx, cy, rx, ry = rx, n = 16, a0 = 0) =>
  Array.from({ length: n }, (_, i) => P(cx + Math.cos(a0 + (i / n) * TAU) * rx, cy + Math.sin(a0 + (i / n) * TAU) * ry));
const lerp = (a, b, t) => a + (b - a) * t;
const EASE_OUT = (t) => 1 - (1 - t) ** 3;

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

// ---------- the party's things ----------

// a sagging string between a and b, at t along it
const sagAt = (a, b, sag) => (t) => P(lerp(a.x, b.x, t), lerp(a.y, b.y, t) + 4 * sag * t * (1 - t));

/**
 * A string of bunting from a to b: pennants in the party's colours hang square to the
 * string and stir on their own; `gust` (the washing's old trigger) sets them flapping.
 * Returns { xml, sway, gust } tracks for the caller's loops.
 */
function bunting(k, { name, a, b, sag, n, seed, fx, size = 1, t0 = 0.07, t1 = 0.93, delay = 0 }) {
  const ids = k.ids;
  const at = sagAt(a, b, sag);
  const r = rng(seed);
  const sway = [], gust = [];
  const kids = [k.boil({ name: `${name} string`, seed, draw: (rr) => ink(Array.from({ length: 11 }, (_, i) => at(i / 10)), rr, { w: 1, amt: 0.35, fx, color: INK_SOFT }) })];
  for (let i = 0; i < n; i++) {
    const t = lerp(t0, t1, n === 1 ? 0.5 : i / (n - 1));
    const p = at(t), q = at(t + 0.01);
    const tilt = Math.atan2(q.y - p.y, q.x - p.x) * 0.8;
    const s = size * r.range(0.9, 1.06);
    const tri = [P(-5 * s, 0), P(5 * s, 0), P(r.jit(0.8), 11.5 * s)];
    const id = ids.next(), gid = ids.next();
    const ph = r.range(0, TAU);
    sway.push(sampled(id, 'rotation', 360, TICK, (u) => tilt + Math.sin(u * TAU + ph) * 0.06));
    const d = delay + i * 2;
    gust.push({ object: gid, prop: 'rotation', keys: [[0, 0, 'hold'], [d, 0, 'cubic', EASE.out], [d + 8, -0.42, 'cubic', EASE.inOut], [d + 28, 0.24, 'cubic', EASE.inOut], [d + 50, -0.09, 'cubic', EASE.inOut], [d + 74, 0]] });
    kids.push(group({ name: 'pennant', id, x: p.x, y: p.y, rotation: tilt }, [group({ name: 'flutter', id: gid }, [
      wc(ids, tri, PARTY[(i + seed) % PARTY.length], rng(seed * 7 + i), { alpha: 0.85, off: [0.6, 0.6], wobble: 0.4, grain: 0, soft: false }),
      k.boil({ name: 'pennant ink', seed: seed * 11 + i, draw: (rr) => ink({ pts: tri, closed: true }, rr, { w: 1, amt: 0.25, fx, tension: 0.2 }) }),
    ])]));
  }
  return { xml: group({ name }, kids), sway, gust };
}

/**
 * A firework's burst drawn about (0, 0), in coloured inks over a flash of glow:
 * 'flower' (petals), 'willow' (strands that droop as they fall), 'star' (straight rays).
 * Returns { xml, flashId } — the caller animates the node it's put in.
 */
function burstXml(ids, { kind, R, cols, seed }) {
  const r = rng(seed);
  const [c1, c2] = cols;
  const flashId = ids.next();
  const n = kind === 'flower' ? 9 : kind === 'willow' ? 13 : 15;
  const strands = [], petals = [], tips = [], dust = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + r.jit(0.14);
    const L = R * r.range(0.8, 1.06);
    const dir = (t, w = 0) => P(Math.cos(a + w) * L * t, Math.sin(a + w) * L * t);
    if (kind === 'flower') {
      petals.push([dir(0.18), dir(0.62, 0.2), dir(1), dir(0.62, -0.2)]);
      tips.push({ ...dir(1.12), r: r.range(1.5, 2.3) });
    } else if (kind === 'willow') {
      const pts = [];
      for (let j = 0; j <= 6; j++) { const t = 0.2 + (j / 6) * 0.8; const p = dir(t); pts.push(P(p.x, p.y + R * 0.55 * t * t)); }
      strands.push(pts);
      tips.push({ ...pts.at(-1), r: r.range(1.4, 2.1) }, { ...P(pts.at(-1).x * 0.96, pts.at(-1).y + 6), r: 1.1 });
    } else {
      strands.push([dir(0.3), dir(0.66, r.jit(0.03)), dir(1)]);
      tips.push({ ...dir(1.08), r: r.range(1.5, 2.4) });
    }
  }
  for (let i = 0; i < 18; i++) { const a = r() * TAU, d = Math.sqrt(r()) * R * 0.7; dust.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: r.range(0.5, 1.1) }); }
  const inkCol = argb(c1, 1);
  const rimCol = argb(darken(c1, 0.3), 0.7);
  const kids = [
    el('Node', { name: 'flash', id: flashId, opacity: 0 }, glow({ x: 0, y: 0, w: R * 3, h: R * 3, color: c1, alpha: 0.7 })),
    ...petals.map((p, i) => wc(ids, p, c1, rng(seed * 3 + i), { alpha: 0.95, off: [0, 0], wobble: 0.6, grain: 0, soft: false, blend: 'normal' })),
    petals.length ? ink(petals.map((p) => ({ pts: p, closed: true })), r, { w: 1.5, amt: 0.4, color: rimCol, tension: 0.7 }) : '',
    strands.length ? ink(strands, r, { w: 2.6, amt: 0.5, color: rimCol }) : '',
    strands.length ? ink(strands, r, { w: 1.6, amt: 0.4, color: inkCol, bleed: 0.4 }) : '',
    stippleShape({ name: 'sparks', dots: tips, color: argb(c2, 1) }),
    stippleShape({ name: 'dust', dots: dust, color: argb(c2, 0.7) }),
  ];
  return { xml: group({ name: `burst ${kind}` }, kids), flashId };
}

// keys for a burst that opens at f0: it swells out, hangs, and sinks as it fades
function burstTracks(id, flashId, x, y, f0, { hold = 34, fade = 70, drop = 12 } = {}) {
  return [
    { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [f0, 1, 'hold'], [f0 + hold, 1, 'cubic', EASE.in], [f0 + hold + fade, 0]] },
    { object: id, prop: 'scaleX', keys: [[0, 0.12, 'hold'], [f0, 0.12, 'cubic', EASE.out], [f0 + 26, 1, 'linear'], [f0 + hold + fade, 1.08]] },
    { object: id, prop: 'scaleY', keys: [[0, 0.12, 'hold'], [f0, 0.12, 'cubic', EASE.out], [f0 + 26, 1, 'linear'], [f0 + hold + fade, 1.08]] },
    { object: id, prop: 'y', keys: [[0, y, 'hold'], [f0 + 10, y, 'cubic', EASE.in], [f0 + hold + fade, y + drop]] },
    { object: flashId, prop: 'opacity', keys: [[0, 0, 'hold'], [f0, 1, 'cubic', EASE.out], [f0 + 40, 0]] },
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
  const shadowsOnHill = [shadow(816, 202, 36, 7, 71), shadow(700, 175, 16, 4, 72), shadow(561, 191, 14, 3, 68)];
  const BX0 = 734; // Bilbo's feet (he's painted further on)
  const shadowsLow = [shadow(PX, 393, 34, 5, 79), shadow(318, 394, 30, 5, 73), shadow(356, 394, 26, 5, 74), shadow(394, 394, 22, 4, 75), shadow(518, 351, 40, 6, 76), shadow(BX0, 342, 16, 4, 77), shadow(886, 385, 30, 6, 78), shadow(518, 391, 26, 5, 70), shadow(704, 343, 18, 4, 69)];
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
  const crownSeason = ids.next(), crownInkSeason = ids.next();
  // paper lanterns hung in the Party Tree: four from the crown's lower edge, two in among
  // the leaves. Each hangs from its own string and swings about where it's tied
  const LANTERNS = [
    { x: 776, y: 168, hang: 153 }, { x: 801, y: 181, hang: 165 }, { x: 838, y: 180, hang: 165 },
    { x: 862, y: 164, hang: 149 }, { x: 795, y: 125, hang: 111 }, { x: 843, y: 113, hang: 99 },
  ].map((l, i) => ({ ...l, id: ids.next(), flareId: ids.next(), col: PARTY[(i * 2 + 1) % PARTY.length], seed: 860 + i * 5 }));
  const lanternShape = (l) => blobPts(4.2, 6, rng(l.seed), { n: 10, wobble: 0.04 }).map((p) => P(p.x, p.y + (l.y - l.hang)));
  const capPts = (dy, s) => [P(-2.4, dy + s * 5.2), P(2.4, dy + s * 5.2), P(2.2, dy + s * 7), P(-2.2, dy + s * 7)];
  const lanternXml = LANTERNS.map((l) => {
    const body = lanternShape(l);
    const dy = l.y - l.hang;
    return group({ name: 'lantern', id: l.id, x: l.x, y: l.hang }, [
      wc(ids, body, l.col, rng(l.seed + 1), { alpha: 0.85, off: [0.5, 0.5], wobble: 0.3, grain: 0.2, soft: false, blend: 'normal' }),
      wc(ids, capPts(dy, -1), '4A3A2C', rng(l.seed + 3), { alpha: 0.9, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }),
      wc(ids, capPts(dy, 1), '4A3A2C', rng(l.seed + 4), { alpha: 0.9, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }),
      k.boil({ name: 'lantern ink', seed: l.seed + 2, draw: (rr) => [
        ink([[P(0, 0), P(0, dy - 7)], { pts: body, closed: true }], rr, { w: 1.1, amt: 0.25, fx: fxTree }),
        ink([[P(-1.6, dy - 5), P(-2.4, dy), P(-1.6, dy + 5)], [P(1.6, dy - 5), P(2.4, dy), P(1.6, dy + 5)], [P(-4, dy - 1.5), P(4, dy - 1.5)], [P(-4, dy + 1.8), P(4, dy + 1.8)], [P(0, dy + 7), P(0, dy + 10)]], rr, { w: 0.7, amt: 0.15, color: INK_SOFT, fx: fxTree }),
      ] }),
      // lit by a click on the tree, whatever the hour
      group({ name: 'flare', id: l.flareId, opacity: 0 }, [
        glow({ x: 0, y: dy, w: 46, h: 46, color: C.lamp, alpha: 0.8 }),
        el('Shape', { name: 'core', x: 0, y: dy + 0.5 }, [el('Ellipse', { width: 5, height: 6.5, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBE08A', 0.85))]),
      ]),
    ]);
  });
  const rustleId = ids.next(), breatheId = ids.next();
  s.add(k.in({ name: 'tree in', cx: tx, cy: tb, t0: 56, t1: 118, sc: 0.88, ease: EASE.back }, [
    wc(ids, [...trunk[0], ...trunk[1].slice().reverse()], C.wood, rng(85), { alpha: 0.4, off: [2, 1], grain: 0.3 }),
    treeInk,
    group({ name: 'breathe', id: breatheId, x: tx, y: tb - 30 }, [
      group({ name: 'rustle', id: rustleId }, [
        group({ name: 'crown body', x: -tx, y: -(tb - 30) }, [
          group({ name: 'crown season', id: crownSeason }, [
            wc(ids, crown, CANOPY[SEASON0], rng(86), { alpha: 0.56, off: [-4, 4], grain: 0.8, key: 'canopy' }),
            wc(ids, scallop(ccx - 12, ccy + 12, 26, rng(87), { bumps: 5 }), CANOPY2[SEASON0], rng(88), { alpha: 0.26, off: [0, 0], grain: 0.3, key: 'canopy2', soft: false }),
          ]),
          group({ name: 'crown ink', id: crownInkSeason }, [crownInk]),
          group({ name: 'lanterns' }, lanternXml),
        ]),
      ]),
    ]),
  ]));
  sp(crownSeason, 'opacity', [1, 1, 1, 0.2]);
  sp(crownInkSeason, 'opacity', [1, 1, 1, 0]);
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

  // --- bunting: from the Party Tree over to the chimney, and on down to a pole on the crest
  const fxBunt = k.fx('bunting', 84, 130);
  const poleTop = P(561, 150);
  const buntA = bunting(k, { name: 'bunting tree', a: P(781, 140), b: P(711, 147), sag: 14, n: 5, seed: 3, fx: fxBunt });
  const buntB = bunting(k, { name: 'bunting crest', a: P(689, 147), b: P(poleTop.x + 1, poleTop.y + 2), sag: 18, n: 7, seed: 8, fx: fxBunt, delay: 10 });
  const crestFlagId = ids.next();
  const crestFlag = [P(0, 0), P(15, 3.5), P(0, 8)];
  s.add(k.in({ name: 'bunting in', t0: 84, t1: 136, op: 0 }, [
    k.boil({ name: 'crest pole ink', seed: 811, draw: (rr) => ink([[P(poleTop.x, 191), P(poleTop.x + 0.6, poleTop.y - 4)]], rr, { w: 1.6, amt: 0.3, fx: fxBunt }) }),
    group({ name: 'crest flag', id: crestFlagId, x: poleTop.x + 1, y: poleTop.y - 4 }, [
      wc(ids, crestFlag, C.terra, rng(812), { alpha: 0.85, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
      k.boil({ name: 'crest flag ink', seed: 813, draw: (rr) => ink({ pts: crestFlag, closed: true }, rr, { w: 1, amt: 0.2, fx: fxBunt, tension: 0.3 }) }),
    ]),
    buntB.xml,
    buntA.xml,
  ]));

  // --- the pavilion in the field: a striped marquee with its front tied back, a long table
  // inside under a hanging lamp, and a pennant on its pole
  const PV = { l: 760, r: 886, ax: 823, ay: 284, eave: 318, val: 326, ground: 385, ol: 804, or: 844 };
  const roof = [P(PV.ax, PV.ay), P(PV.r + 2, PV.eave), P(PV.l - 2, PV.eave)];
  const scallops = [];
  for (let x = PV.r + 2; x > PV.l - 2; x -= 14) scallops.push(P(x, PV.val - 2), P(x - 7, PV.val + 3));
  const valance = [P(PV.l - 2, PV.eave), P(PV.r + 2, PV.eave), ...scallops, P(PV.l - 2, PV.val - 2)];
  const wallL = [P(PV.l + 2, PV.val - 2), P(PV.ol, PV.val - 2), P(PV.ol, PV.ground), P(PV.l, PV.ground)];
  const wallR = [P(PV.or, PV.val - 2), P(PV.r - 2, PV.val - 2), P(PV.r, PV.ground), P(PV.or, PV.ground)];
  const door = [P(PV.ol, PV.val), P(PV.or, PV.val), P(PV.or, PV.ground), P(PV.ol, PV.ground)];
  // the front drawn back to either side, leaving a tall triangle of doorway
  const flapL = [P(PV.ol, PV.val), P(PV.ol + 18, PV.val), P(PV.ol + 3, PV.ground), P(PV.ol, PV.ground)];
  const flapR = [P(PV.or, PV.val), P(PV.or - 18, PV.val), P(PV.or - 3, PV.ground), P(PV.or, PV.ground)];
  const doorway = [P(PV.ol + 18, PV.val), P(PV.or - 18, PV.val), P(PV.or - 3, PV.ground), P(PV.ol + 3, PV.ground)];
  const stripes = [];
  const roofX = [];
  for (let i = 0; i <= 8; i++) roofX.push(lerp(PV.l - 2, PV.r + 2, i / 8));
  for (let i = 1; i < 8; i += 2) stripes.push([P(PV.ax, PV.ay + 1), P(roofX[i], PV.eave), P(roofX[i + 1], PV.eave)]);
  const wallStripes = [];
  for (let x = PV.l + 8; x < PV.ol - 4; x += 14) wallStripes.push([P(x, PV.val), P(x + 6, PV.val), P(x + 6.5, PV.ground), P(x + 0.5, PV.ground)]);
  for (let x = PV.or + 6; x < PV.r - 4; x += 14) wallStripes.push([P(x, PV.val), P(x + 6, PV.val), P(x + 6.5, PV.ground), P(x + 0.5, PV.ground)]);
  const pennantId = ids.next(), pennantGust = ids.next();
  const pennant = [P(0, 0), P(17, 4), P(0, 9)];
  const inTable = [P(PV.ol + 8, 364), P(PV.or - 8, 364), P(PV.or - 7, 370), P(PV.ol + 7, 370)];
  const pavInk = k.boil({
    name: 'pavilion ink', seed: 821, draw: (rr) => [
      ink([{ pts: roof, closed: true }, { pts: [P(PV.l - 2, PV.eave), P(PV.r + 2, PV.eave), ...scallops, P(PV.l - 2, PV.val - 2)], closed: true }], rr, { w: 1.6, amt: 0.45, fx: fxWash, tension: 0.25, bleed: 0.1 }),
      ink([[wallL[0], wallL[3]], [wallR[1], wallR[2]], [P(PV.ol, PV.val), P(PV.ol, PV.ground)], [P(PV.or, PV.val), P(PV.or, PV.ground)], [P(PV.l - 4, PV.ground), P(PV.r + 4, PV.ground)]], rr, { w: 1.5, amt: 0.4, fx: fxWash }),
      ink([{ pts: flapL, closed: true }, { pts: flapR, closed: true }], rr, { w: 1.2, amt: 0.35, fx: fxWash, tension: 0.15 }),
      ink([[P(PV.ax, PV.ay), P(PV.ax + 0.5, 264)], ...roofX.slice(1, -1).map((x) => [P(PV.ax, PV.ay + 2), P(x, PV.eave)]), { pts: inTable, closed: true }, [P(PV.ax, PV.val), P(PV.ax, 341)], [P(PV.ol + 11, 370), P(PV.ol + 11, 382)], [P(PV.or - 11, 370), P(PV.or - 11, 382)]], rr, { w: 0.9, amt: 0.3, color: INK_SOFT, fx: fxWash, tension: 0.3 }),
    ],
  });
  s.add(k.in({ name: 'pavilion in', cx: PV.ax, cy: PV.ground, t0: 70, t1: 126, sc: 0.9, ease: EASE.back }, [
    wc(ids, door, 'B5844A', rng(822), { alpha: 0.5, off: [0, 0], wobble: 0.6, grain: 0.5, soft: false }),
    wc(ids, inTable, C.white, rng(823), { alpha: 0.92, off: [0.5, 0.5], wobble: 0.4, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, wallL, 'F2E6C8', rng(824), { alpha: 0.96, off: [1, 1], wobble: 0.6, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, wallR, 'F2E6C8', rng(825), { alpha: 0.96, off: [1, 1], wobble: 0.6, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, roof, 'F2E6C8', rng(826), { alpha: 0.96, off: [1, 1], wobble: 0.8, grain: 0.3, soft: false, blend: 'normal' }),
    ...stripes.map((st, i) => wc(ids, st, C.rose, rng(827 + i), { alpha: 0.5, off: [0.6, 0.6], wobble: 0.6, grain: 0.3, soft: false })),
    ...wallStripes.map((st, i) => wc(ids, st, C.rose, rng(835 + i), { alpha: 0.45, off: [0.5, 0.5], wobble: 0.5, grain: 0.2, soft: false })),
    wc(ids, flapL, 'F2E6C8', rng(845), { alpha: 0.96, off: [0.5, 0.5], wobble: 0.4, grain: 0.2, soft: false, blend: 'normal', tension: 0.15 }),
    wc(ids, flapR, 'F2E6C8', rng(846), { alpha: 0.96, off: [0.5, 0.5], wobble: 0.4, grain: 0.2, soft: false, blend: 'normal', tension: 0.15 }),
    wc(ids, valance, C.butter, rng(847), { alpha: 0.85, off: [0.5, 0.5], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal', tension: 0.4 }),
    pavInk,
    group({ name: 'pennant', id: pennantId, x: PV.ax + 0.5, y: 264 }, [group({ name: 'flutter', id: pennantGust }, [
      wc(ids, pennant, C.rose, rng(848), { alpha: 0.85, off: [0.5, 0.5], wobble: 0.3, grain: 0, soft: false }),
      k.boil({ name: 'pennant ink', seed: 849, draw: (rr) => ink({ pts: pennant, closed: true }, rr, { w: 1.1, amt: 0.25, fx: fxWash, tension: 0.3 }) }),
    ])]),
  ]));
  const swayTracks = [
    ...buntA.sway, ...buntB.sway,
    sampled(pennantId, 'scaleX', 360, TICK, (u) => 0.9 + Math.sin(u * TAU * 2) * 0.1),
    sampled(pennantId, 'rotation', 360, TICK, (u) => Math.sin(u * TAU * 2 + 1) * 0.06),
    sampled(crestFlagId, 'scaleX', 360, TICK, (u) => 0.9 + Math.sin(u * TAU * 2 + 2) * 0.1),
  ];
  const gustTracks = [
    ...buntA.gust, ...buntB.gust,
    { object: pennantGust, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [8, -0.3, 'cubic', EASE.inOut], [26, 0.22, 'cubic', EASE.inOut], [46, -0.1, 'cubic', EASE.inOut], [70, 0]] },
  ];
  s.loopLayer('sway', ambient(s, { name: 'sway', duration: 360, loop: 'loop', tracks: swayTracks }));

  // --- the long table, where the bench was: a cloth, the birthday cake with its candles,
  // a jug and a mug, and Bilbo's pipe left smoking at the end
  const hem = [];
  for (let x = 575; x >= 465; x -= 9) hem.push(P(x, 335 + (Math.round((575 - x) / 9) % 2) * 3));
  const cloth = [P(466, 319), P(574, 317), ...hem];
  const tiers = [[P(494, 305), P(523, 305), P(523, 319), P(494, 319)], [P(499, 295), P(518, 295), P(518, 305), P(499, 305)]];
  const candles = [502, 506.5, 511, 515.5];
  const jug = [P(476, 304), P(486, 304), P(488, 311), P(486, 319), P(476, 319), P(474, 311)];
  const mug = [P(556, 309), P(564, 309), P(564, 319), P(556, 319)];
  const icing = (y0, x0, x1) => { const pts = []; for (let x = x0; x <= x1; x += 2.4) pts.push(P(x, y0 + (Math.round((x - x0) / 2.4) % 2) * 2.2)); return pts; };
  const tableInk = k.boil({
    name: 'table ink', seed: 141, draw: (rr) => [
      ink([[P(466, 319), P(574, 317)], [P(574, 317), P(575, 334)], hem, [P(465, 335), P(466, 319)], [P(474, 337), P(473, 352)], [P(566, 337), P(567, 350)], [P(474, 345), P(566, 343)]], rr, { w: 1.6, amt: 0.35, fx: fxGarden, tension: 0.5 }),
      ink([...tiers.map((t) => ({ pts: t, closed: true })), [P(490, 319.5), P(527, 319.5)], { pts: jug, closed: true }, [P(476, 307), P(471, 311), P(476, 315)], { pts: mug, closed: true }, [P(564, 311), P(568, 314), P(564, 317)]], rr, { w: 1.3, amt: 0.25, fx: fxGarden, tension: 0.3 }),
      ink([icing(307, 494, 523), icing(297, 499, 518), ...candles.map((x) => [P(x, 295), P(x + rr.jit(0.3), 289)])], rr, { w: 0.9, amt: 0.15, color: INK_SOFT, fx: fxGarden, tension: 0.5 }),
    ],
  });
  const pipeInk = k.boil({ name: 'pipe ink', seed: 142, draw: (rr) => ink([[P(528, 319), P(536, 320), P(542, 319)], { pts: [P(542, 313), P(549, 313), P(548, 320), P(543, 320)], closed: true }], rr, { w: 1.3, amt: 0.2, fx: fxGarden, tension: 0.4 }) });
  const pipeSmoke = ids.next(), ringId = ids.next();
  const pipeCurl = k.boil({
    name: 'pipe curl', seed: 143, draw: (rr) => {
      const pts = [];
      for (let j = 0; j <= 9; j++) { const t = j / 9; pts.push(P(Math.sin(t * 6) * (2 + t * 3), -t * 18)); }
      return ink(pts, rr, { w: 1, amt: 0.3, color: 'FF6A625A' });
    },
  });
  s.add(k.in({ name: 'table in', cx: 520, cy: 350, t0: 84, t1: 132, op: 0 }, [
    wc(ids, cloth, C.white, rng(144), { alpha: 0.95, off: [1, 1], grain: 0.3, soft: false, blend: 'normal', tension: 0.4 }),
    wc(ids, [P(466, 321), P(574, 319), P(575, 324), P(466, 326)], C.rose, rng(145), { alpha: 0.35, off: [0, 0.5], wobble: 0.4, grain: 0, soft: false }),
    wc(ids, tiers[0], C.cream, rng(146), { alpha: 0.95, off: [0.8, 0.8], wobble: 0.5, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, tiers[1], C.cream, rng(147), { alpha: 0.95, off: [0.8, 0.8], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, [P(494, 305), P(523, 305), P(523, 309), P(494, 309)], C.rose, rng(148), { alpha: 0.6, off: [0, 0], wobble: 0.3, grain: 0, soft: false }),
    wc(ids, [P(499, 295), P(518, 295), P(518, 299), P(499, 299)], C.rose, rng(149), { alpha: 0.6, off: [0, 0], wobble: 0.3, grain: 0, soft: false }),
    ...candles.map((x, i) => wc(ids, [P(x - 0.9, 289), P(x + 0.9, 289), P(x + 0.9, 295), P(x - 0.9, 295)], PARTY[(i + 2) % PARTY.length], rng(150 + i), { alpha: 0.9, off: [0, 0], wobble: 0.1, grain: 0, soft: false })),
    ...candles.map((x, i) => wc(ids, blobPts(1.4, 2.4, rng(155 + i), { n: 6, wobble: 0.1 }).map((p) => P(p.x + x, p.y + 285.6)), C.lamp, rng(160 + i), { alpha: 0.95, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' })),
    wc(ids, jug, C.terra, rng(165), { alpha: 0.55, off: [1, 1], wobble: 0.5, grain: 0.3, soft: false }),
    wc(ids, mug, C.butter, rng(166), { alpha: 0.6, off: [0.6, 0.6], wobble: 0.4, grain: 0.2, soft: false }),
    tableInk,
    pipeInk,
    group({ name: 'pipe smoke', id: pipeSmoke, x: 546, y: 311, opacity: 0 }, [pipeCurl]),
    el('Shape', { name: 'ring', id: ringId, x: 546, y: 309, opacity: 0 }, [el('Ellipse', { width: 9, height: 5, originX: 0.5, originY: 0.5, name: 'E' }), stroke('FF6A625A', 1.1)]),
  ]));
  s.loopLayer('pipe', ambient(s, { name: 'pipe', duration: 300, loop: 'loop', tracks: [
    sampled(pipeSmoke, 'y', 300, TICK, (t) => 311 - t * 26),
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
    [568, 334], [578, 340], [560, 344],
    [646, 354], [596, 366], [620, 362], [366, 374],
    [160, 362], [196, 358], [262, 364],
  ];
  const clusters = [[0, 3], [3, 7], [7, 10]];
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

  // fallen leaves under the tree and along the hedge, autumn only
  const fallenId = ids.next();
  const fallen = [];
  const fr0 = rng(180);
  for (let i = 0; i < 14; i++) {
    const x = i < 6 ? 790 + fr0.range(-10, 50) : fr0.range(160, 560);
    const y = i < 6 ? 204 + fr0.range(-2, 10) + (x - 800) * 0.35 : 380 + fr0.range(0, 10);
    fallen.push(wc(ids, blobPts(3.2, 1.8, fr0, { n: 6, wobble: 0.2, start: fr0.range(0, 3) }).map((p) => P(p.x + x, p.y + y)), fr0() < 0.5 ? C.ochre : C.terra, fr0, { alpha: 0.8, off: [0, 0], wobble: 0.3, grain: 0, soft: false }));
  }
  s.add(group({ name: 'fallen', id: fallenId, opacity: SEASON0 === 2 ? 1 : 0 }, fallen));
  sp(fallenId, 'opacity', [0, 0, 1, 0]);

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

  // --- presents by the door, a mathom in each: clicking the front one opens it (main.js
  // picks which, and reads out Bilbo's label)
  const PR = { x: 692, top: 322, bot: 343 };
  const boxA = [P(680, 322), P(704, 322), P(704, 343), P(680, 343)];
  const boxB = [P(707, 328), P(725, 328), P(725, 343), P(707, 343)];
  const lidB = [P(705.5, 324), P(726.5, 324), P(726.5, 328), P(705.5, 328)];
  const boxC = [P(709, 314), P(723, 314), P(723, 324), P(709, 324)];
  const lidA = [P(-13, -6), P(13, -6), P(13, 0), P(-13, 0)];
  const bow = [blobPts(3.6, 2.4, rng(871), { n: 7, wobble: 0.1 }).map((p) => P(p.x - 3.6, p.y - 8.4)), blobPts(3.6, 2.4, rng(872), { n: 7, wobble: 0.1 }).map((p) => P(p.x + 3.6, p.y - 8.4))];
  const band = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
  // the mathoms, each drawn about (0, 0), small enough to sit inside the box
  const MATHOM = {
    spoons: { col: 'C9CCC6', parts: [blobPts(2.2, 3.2, rng(880), { n: 8, wobble: 0.05 }).map((p) => P(p.x - 3.4, p.y - 6)), blobPts(2.2, 3.2, rng(881), { n: 8, wobble: 0.05 }).map((p) => P(p.x + 3.4, p.y - 6))], lines: [[P(-3.2, -2.8), P(2.4, 9)], [P(3.2, -2.8), P(-2.4, 9)]] },
    mirror: { col: C.brass, parts: [circ(0, -4, 6.6, 6.6, 12)], inner: { pts: circ(0, -4, 4.6, 4.6, 10), col: 'DCEBF2' }, lines: [[P(0, 2.6), P(0, 10)]] },
    pen: { col: '3B3550', parts: [[P(-7, 3), P(-7, -2.5), P(-5, -4.5), P(-5, -7), P(-1, -7), P(-1, -4.5), P(1, -2.5), P(1, 3)]], lines: [], pen: [P(0, 5), P(9, -11)] },
    basket: { col: C.ochre, parts: [[P(-7, -8), P(7, -8), P(5, 9), P(-5, 9)]], lines: [[P(-6.5, -5), P(6.5, -5)], [P(-6, 0), P(6, 0)], [P(-5.5, 5), P(5.5, 5)], [P(-3.5, -8), P(-2.5, 9)], [P(0, -8), P(0, 9)], [P(3.5, -8), P(2.5, 9)]] },
  };
  const mathomIds = {};
  const mathomXml = Object.entries(MATHOM).map(([kind, m], i) => {
    const id = ids.next(), wig = ids.next();
    mathomIds[kind] = { id, wig };
    return group({ name: `mathom ${kind}`, id, x: PR.x, y: 334, opacity: 0 }, [group({ name: 'wiggle', id: wig }, [
      ...m.parts.map((p, j) => wc(ids, p, m.col, rng(890 + i * 4 + j), { alpha: 0.9, off: [0.4, 0.4], wobble: 0.2, grain: 0.2, soft: false, blend: 'normal' })),
      m.inner ? wc(ids, m.inner.pts, m.inner.col, rng(899 + i), { alpha: 0.95, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }) : '',
      m.pen ? el('Shape', { name: 'pen' }, [polyXml(m.pen), stroke(argb('D2A23A', 1), 2.4)]) : '',
      ink([...m.parts.map((p) => ({ pts: p, closed: true })), ...m.lines, ...(m.pen ? [m.pen] : [])], rng(905 + i), { w: kind === 'mirror' ? 1.1 : 0.9, amt: 0.12, tension: kind === 'pen' || kind === 'basket' ? 0.3 : 1 }),
      kind === 'mirror' ? el('Shape', { name: 'glint', x: -1.6, y: -5.6 }, [el('Ellipse', { width: 2.2, height: 1.6, originX: 0.5, originY: 0.5, name: 'E' }), fill('FFFFFFFF')]) : '',
      kind === 'spoons' ? stippleShape({ name: 'shine', dots: [{ x: -4, y: -7, r: 0.7 }, { x: 2.8, y: -7, r: 0.7 }], color: 'FFFFFFFF' }) : '',
    ])]);
  });
  const twinkleId = ids.next();
  const lidId = ids.next();
  const presentInk = k.boil({
    name: 'presents ink', seed: 873, draw: (rr) => [
      ink([{ pts: boxA, closed: true }, { pts: boxB, closed: true }, { pts: lidB, closed: true }, { pts: boxC, closed: true }], rr, { w: 1.4, amt: 0.3, fx: fxGarden, tension: 0.2 }),
      ink([[P(692, 322), P(692, 343)], [P(680, 332.5), P(704, 332.5)], [P(716.2, 324), P(716.2, 343)], [P(716, 314), P(716, 324)], [P(709, 319), P(723, 319)]], rr, { w: 0.8, amt: 0.15, color: INK_SOFT, fx: fxGarden }),
    ],
  });
  s.add(k.in({ name: 'presents in', cx: 703, cy: 343, t0: 104, t1: 146, sc: 0.3, ease: EASE.back }, [
    group({ name: 'mathoms' }, mathomXml),
    wc(ids, boxA, C.rose, rng(874), { alpha: 0.95, off: [0.6, 0.6], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, band(690.5, 322, 693.5, 343), C.butter, rng(875), { alpha: 0.95, off: [0, 0], wobble: 0.15, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, band(680, 331, 704, 334), C.butter, rng(876), { alpha: 0.95, off: [0, 0], wobble: 0.15, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, boxB, C.sky, rng(877), { alpha: 0.95, off: [0.6, 0.6], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, lidB, darken(C.sky, 0.1), rng(878), { alpha: 0.95, off: [0.3, 0.3], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, band(715, 324, 717.5, 343), C.rose, rng(879), { alpha: 0.9, off: [0, 0], wobble: 0.15, grain: 0, soft: false }),
    wc(ids, boxC, '7FAE57', rng(882), { alpha: 0.95, off: [0.5, 0.5], wobble: 0.3, grain: 0.2, soft: false, blend: 'normal' }),
    wc(ids, band(715, 314, 717.4, 324), C.butter, rng(883), { alpha: 0.95, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, band(709, 317.8, 723, 320.2), C.butter, rng(884), { alpha: 0.95, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }),
    presentInk,
    // the front present's lid, with its bow: it comes off when the present is opened
    group({ name: 'lid', id: lidId, x: PR.x, y: PR.top }, [
      wc(ids, lidA, darken(C.rose, 0.08), rng(885), { alpha: 0.95, off: [0.3, 0.3], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
      wc(ids, band(-1.5, -6, 1.5, 0), C.butter, rng(886), { alpha: 0.95, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }),
      ...bow.map((b, i) => wc(ids, b, C.butter, rng(887 + i), { alpha: 0.95, off: [0, 0], wobble: 0.15, grain: 0, soft: false, blend: 'normal' })),
      k.boil({ name: 'lid ink', seed: 889, draw: (rr) => ink([{ pts: lidA, closed: true }, ...bow.map((b) => ({ pts: b, closed: true })), [P(-1, -6.5), P(-4, -2.5)], [P(1, -6.5), P(4.5, -3)]], rr, { w: 1.1, amt: 0.2, fx: fxGarden, tension: 0.3 }) }),
    ]),
    group({ name: 'twinkle', id: twinkleId, x: PR.x, y: 300, opacity: 0 }, [
      el('Shape', { name: 'gleam' }, [...[[-12, -4], [11, -8], [13, 6], [-10, 8]].map(([x, y]) => polyXml(starPts(2.6).map((p) => P(p.x + x, p.y + y)), { closed: true })), fill(argb(C.lamp, 0.95)), stroke(INK, 0.6)]),
    ]),
  ]));

  // --- Bilbo, by his presents in his party best (green coat, yellow waistcoat), one hand
  // up as if he were in the middle of his speech
  const BX = 734, BY = 342;
  const skin = 'E2B08A';
  const fig = {
    feet: [blobPts(4.4, 2, rng(920), { n: 8, wobble: 0.08 }).map((p) => P(p.x - 5, p.y - 1.6)), blobPts(4.4, 2, rng(921), { n: 8, wobble: 0.08 }).map((p) => P(p.x + 5.4, p.y - 1.6))],
    legs: [[P(-6.5, -14), P(-1, -14), P(-1.5, -3), P(-6, -3)], [P(1, -14), P(6.5, -14), P(6, -3), P(1.5, -3)]],
    coat: [P(-6, -30), P(6, -30), P(9, -22), P(10.5, -13), P(8, -11.5), P(-8, -11.5), P(-10.5, -13), P(-9, -22)],
    vest: [P(-3.2, -29.5), P(3.2, -29.5), P(4, -16.5), P(0, -13.5), P(-4, -16.5)],
    head: circ(0, -36.4, 5.6, 5.8, 12),
    hair: [P(-6, -35.5), P(-6.8, -39.6), P(-4.4, -43.4), P(0, -44.6), P(4.4, -43.4), P(6.8, -39.6), P(6, -35.5), P(4.2, -38.4), P(0, -39.6), P(-4.2, -38.4)],
  };
  const bilboId = ids.next(), waveId = ids.next();
  const bilboInk = k.boil({
    name: 'bilbo ink', seed: 925, draw: (rr) => [
      ink([...fig.feet.map((p) => ({ pts: p, closed: true })), ...fig.legs.map((p) => ({ pts: p, closed: true, tension: 0.3 })), { pts: fig.coat, closed: true, tension: 0.6 }, { pts: fig.head, closed: true }, [P(-7, -27), P(-10, -20), P(-10.4, -15)]], rr, { w: 1.1, amt: 0.25, fx: fxDoor }),
      ink([{ pts: fig.vest, closed: true, tension: 0.4 }, { pts: fig.hair, closed: true, tension: 0.8 }, [P(-1.9, -33.4), P(0, -32.4), P(1.9, -33.4)], [P(-6.5, -2.8), P(-5.6, -4.4)], [P(-4, -2.9), P(-3.4, -4.6)], [P(4, -2.9), P(4.6, -4.6)], [P(6.6, -2.8), P(7.4, -4.3)], [P(-3, -42), P(-1.6, -40.4)], [P(2.2, -42.4), P(3.4, -40.6)]], rr, { w: 0.75, amt: 0.15, color: INK_SOFT, fx: fxDoor, tension: 0.6 }),
    ],
  });
  s.add(k.in({ name: 'bilbo in', cx: BX, cy: BY, t0: 112, t1: 150, sc: 0.4, ease: EASE.back }, [
    group({ name: 'bilbo', id: bilboId, x: BX, y: BY }, [
      ...fig.feet.map((p, i) => wc(ids, p, skin, rng(930 + i), { alpha: 0.9, off: [0.3, 0.3], wobble: 0.15, grain: 0, soft: false, blend: 'normal' })),
      ...fig.legs.map((p, i) => wc(ids, p, '8A6A4C', rng(932 + i), { alpha: 0.9, off: [0.3, 0.3], wobble: 0.2, grain: 0.2, soft: false, blend: 'normal' })),
      wc(ids, fig.coat, C.door, rng(934), { alpha: 0.92, off: [0.5, 0.5], wobble: 0.3, grain: 0.3, soft: false, blend: 'normal', tension: 0.6 }),
      wc(ids, fig.vest, C.butter, rng(935), { alpha: 0.95, off: [0.3, 0.3], wobble: 0.15, grain: 0.1, soft: false, blend: 'normal', tension: 0.4 }),
      stippleShape({ name: 'buttons', dots: [{ x: 0, y: -25.5, r: 0.7 }, { x: 0, y: -21.6, r: 0.7 }, { x: 0, y: -17.8, r: 0.7 }], color: argb('8A6A1E', 1) }),
      wc(ids, fig.head, skin, rng(936), { alpha: 0.95, off: [0.3, 0.3], wobble: 0.15, grain: 0, soft: false, blend: 'normal' }),
      wc(ids, fig.hair, '9A6A3C', rng(937), { alpha: 0.95, off: [0.2, 0.2], wobble: 0.2, grain: 0.3, soft: false, blend: 'normal', tension: 0.8 }),
      stippleShape({ name: 'eyes', dots: [{ x: -2.1, y: -36.4, r: 0.6 }, { x: 2.1, y: -36.4, r: 0.6 }], color: INK }),
      stippleShape({ name: 'cheeks', dots: [{ x: -3.6, y: -34.2, r: 1.1 }, { x: 3.6, y: -34.2, r: 1.1 }], color: argb(C.rose, 0.45) }),
      el('Shape', { name: 'hand', x: -10.4, y: -14.6 }, [el('Ellipse', { width: 3.2, height: 3.2, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb(skin, 1)), stroke(INK, 0.7)]),
      bilboInk,
      // the speech hand, waving a little
      group({ name: 'wave', id: waveId, x: 7, y: -27 }, [
        ink([[P(0, 0), P(4.6, -5), P(6.6, -11)]], rng(938), { w: 1.1, amt: 0.15, fx: fxDoor }),
        el('Shape', { name: 'hand', x: 7, y: -12.4 }, [el('Ellipse', { width: 3.4, height: 3.4, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb(skin, 1)), stroke(INK, 0.7)]),
      ]),
    ]),
  ]));
  s.loopLayer('bilbo waves', ambient(s, { name: 'bilbo waves', duration: 240, loop: 'loop', tracks: [
    sampled(waveId, 'rotation', 240, TICK, (t) => (t < 0.5 ? Math.sin(t * TAU * 4) * 0.22 : 0)),
  ] }));

  // --- Gandalf's cart of fireworks, on the lane: rockets stood up in it, and his great red G
  // on its side. Clicking it sends one up (main.js picks which)
  const cartBox = [P(428, 352), P(492, 350), P(493, 373), P(428, 374)];
  const wheelC = P(452, 380);
  const cartRockets = [436, 447, 458, 469, 481].map((x, i) => ({ x, top: 322 + [3, -2, -4, 1, 4][i], col: [C.terra, C.sky, C.rose, '7FAE57', C.butter][i] }));
  const gMark = [];
  for (let i = 0; i <= 10; i++) { const a = -0.5 - (i / 10) * 4.6; gMark.push(P(461 + Math.cos(a) * 5.4, 362 + Math.sin(a) * 5.4)); }
  const cartRocketId = ids.next();
  const rocketDraw = (x, top, col, seed) => {
    const tube = [P(x - 2.5, top + 7), P(x + 2.5, top + 7), P(x + 2.5, top + 17), P(x - 2.5, top + 17)];
    const cone = [P(x - 3, top + 7), P(x + 3, top + 7), P(x, top)];
    return [
      wc(ids, tube, col, rng(seed), { alpha: 0.9, off: [0.3, 0.3], wobble: 0.15, grain: 0, soft: false, blend: 'normal' }),
      wc(ids, cone, darken(col, 0.15), rng(seed + 1), { alpha: 0.9, off: [0.2, 0.2], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }),
      ink([{ pts: tube, closed: true }, { pts: cone, closed: true }, [P(x, top + 17), P(x, top + 34)]], rng(seed + 2), { w: 0.9, amt: 0.12, tension: 0.2 }),
    ];
  };
  const cartInk = k.boil({
    name: 'cart ink', seed: 951, draw: (rr) => [
      ink([{ pts: cartBox, closed: true }, [P(492, 364), P(523, 389)], [P(490, 370), P(518, 392)], [P(431, 374), P(431, 391)]], rr, { w: 1.6, amt: 0.35, fx: fxGarden, tension: 0.2 }),
      ink([[P(429, 359), P(492, 357.5)], [P(429, 366), P(492, 365)]], rr, { w: 0.8, amt: 0.3, color: INK_SOFT, fx: fxGarden }),
      ink([{ pts: circ(wheelC.x, wheelC.y, 12, 12, 14), closed: true }, { pts: circ(wheelC.x, wheelC.y, 2.4, 2.4, 6), closed: true }, ...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * Math.PI; return [P(wheelC.x + Math.cos(a) * 11, wheelC.y + Math.sin(a) * 11), P(wheelC.x - Math.cos(a) * 11, wheelC.y - Math.sin(a) * 11)]; })], rr, { w: 1.3, amt: 0.3, fx: fxGarden }),
      ink([gMark, [P(461, 362), P(466.4, 362), P(466, 366)]], rr, { w: 1.7, amt: 0.2, color: 'FFB0382A', fx: fxGarden, tension: 0.8 }),
    ],
  });
  s.add(k.in({ name: 'cart in', cx: 460, cy: 392, t0: 80, t1: 128, sc: 0.85, ease: EASE.back }, [
    ...cartRockets.filter((_, i) => i !== 2).flatMap((c, i) => rocketDraw(c.x, c.top, c.col, 960 + i * 4)),
    group({ name: 'cart rocket', id: cartRocketId }, rocketDraw(cartRockets[2].x, cartRockets[2].top, cartRockets[2].col, 980)),
    wc(ids, cartBox, C.wood, rng(984), { alpha: 0.75, off: [1, 1], wobble: 0.5, grain: 0.5, soft: false, blend: 'normal' }),
    wc(ids, circ(wheelC.x, wheelC.y, 12, 12, 14), C.wood, rng(985), { alpha: 0.35, off: [0.5, 0.5], wobble: 0.4, grain: 0.3, soft: false }),
    cartInk,
  ]));
  s.add(k.in({ name: 'low shadows in', t0: 110, t1: 150 }, shadowsLow));

  // the falling leaves, autumn's weather
  const fallKids = (name, color, shape, seedBase, count, loopName, seasonIdx, spin) => {
    const kids = [];
    const tracks = [];
    const dur = 560;
    for (let i = 0; i < count; i++) {
      const id = ids.next();
      const pr = rng(seedBase + i);
      const x0 = tx + pr.range(-40, 40), y0 = tb - 90 + pr.range(-20, 20);
      const dx = -pr.range(140, 300), dy = pr.range(140, 200);
      kids.push(group({ name, id, x: x0, y: y0, opacity: 0 }, [
        wc(ids, shape, color, pr, { alpha: 0.9, off: [0, 0], wobble: 0.3, grain: 0, soft: false }),
        ink({ pts: shape, closed: true }, pr, { w: 0.8, amt: 0.15 }),
      ]));
      const ph = i / count;
      const at = (t) => (t + ph) % 1;
      tracks.push(
        sampled(id, 'x', dur, TICK, (t) => x0 + at(t) * dx + Math.sin(at(t) * 10 + i) * 12),
        sampled(id, 'y', dur, TICK, (t) => y0 + at(t) * dy),
        sampled(id, 'rotation', dur, TICK, (t) => Math.sin(at(t) * 8 + i) * spin),
        sampled(id, 'opacity', dur, TICK, (t) => { const u = at(t); return u < 0.04 || u > 0.92 ? 0 : u < 0.12 ? (u - 0.04) / 0.08 : u > 0.78 ? (0.92 - u) / 0.14 : 1; })
      );
    }
    gatedLoop(s, loopName, ambient(s, { name: loopName, duration: dur, loop: 'loop', tracks }), [[season, 'equal', seasonIdx]]);
    return kids;
  };
  const leaves = fallKids('leaf', C.ochre, [P(-5, 0), P(0, -3), P(5, 0), P(0, 3)], 240, 4, 'leaves', 2, 1.4);
  s.add(group({ name: 'leaves' }, leaves));

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
      // the Party Tree's lanterns, the pavilion, and the candles on the cake
      ...LANTERNS.map((l) => glow({ x: l.x, y: l.y, w: 36, h: 36, color: C.lamp, alpha: 0.55 })),
      ...LANTERNS.map((l, i) => wc(ids, lanternShape(l).map((p) => P(p.x + l.x, p.y + l.hang)), lighten(l.col, 0.45), rng(l.seed + 3), { alpha: 0.95, off: [0, 0], wobble: 0.2, grain: 0, soft: false, blend: 'normal' })),
      ink(LANTERNS.flatMap((l) => [{ pts: lanternShape(l).map((p) => P(p.x + l.x, p.y + l.hang)), closed: true }, [P(l.x - 1.6, l.y - 5), P(l.x - 2.2, l.y), P(l.x - 1.6, l.y + 5)], [P(l.x + 1.6, l.y - 5), P(l.x + 2.2, l.y), P(l.x + 1.6, l.y + 5)]]), rng(870), { w: 0.8, amt: 0.15 }),
      glow({ x: PV.ax, y: 348, w: 110, h: 84, color: C.lamp, alpha: 0.42 }),
      wc(ids, doorway, 'F3C46A', rng(871), { alpha: 0.8, off: [0, 0], wobble: 0.3, grain: 0.2, soft: false, blend: 'normal', tension: 0.15 }),
      wc(ids, inTable, 'FBF0D8', rng(872), { alpha: 0.95, off: [0, 0], wobble: 0.3, grain: 0, soft: false, blend: 'normal' }),
      ink([{ pts: inTable, closed: true }, [P(PV.ax, PV.val), P(PV.ax, 342)]], rng(873), { w: 0.9, amt: 0.2, color: INK_SOFT }),
      glow({ x: PV.ax, y: 346, w: 30, h: 30, color: 'FFE7A0', alpha: 0.9 }),
      el('Shape', { name: 'flame', x: PV.ax, y: 346 }, [el('Ellipse', { width: 4.5, height: 6.5, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBD56A', 0.95))]),
      glow({ x: 509, y: 292, w: 70, h: 42, color: C.lamp, alpha: 0.4 }),
      ...candles.map((x) => el('Shape', { name: 'candle flame', x, y: 285.6 }, [el('Ellipse', { width: 2.8, height: 4.6, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb('FBE08A', 1))])),
    ]),
  ]));
  tp(litId, 'opacity', LIT);
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

  // --- the party's fire, above the hour's glaze so it glows at night

  // Bilbo's trick: a blinding flash, and he's nowhere to be seen
  const flashId = ids.next();
  const flashRays = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.1; flashRays.push([P(Math.cos(a) * 16, Math.sin(a) * 16), P(Math.cos(a) * (26 + (i % 2) * 6), Math.sin(a) * (26 + (i % 2) * 6))]); }
  s.add(group({ name: 'vanish flash', id: flashId, x: BX, y: BY - 22, opacity: 0 }, [
    glow({ x: 0, y: 0, w: 190, h: 170, color: 'FFF3C8', alpha: 0.95 }),
    ink(flashRays, rng(990), { w: 1.4, amt: 0.4, color: argb('D2A23A', 0.9), bleed: 0.2 }),
  ]));

  // a rocket's trail: a lick of smoke from the cart to where it bursts, drawn on as it climbs
  const L0 = P(458, 333);
  const trail = (to, seed) => {
    const id = ids.next(), trimId = ids.next();
    const tr = rng(seed);
    const pts = Array.from({ length: 7 }, (_, i) => { const t = i / 6; return P(lerp(L0.x, to.x, t) + Math.sin(t * Math.PI) * 8 + tr.jit(1.5), lerp(L0.y, to.y, t) + tr.jit(1)); });
    return { id, trimId, pts, xml: el('Shape', { name: 'trail', id, opacity: 0 }, [pathXml(pts), stroke(argb('8A8078', 0.55), 1.3, { trim: { start: 0, end: 0, id: trimId } })]) };
  };
  // the rocket itself, flying: tube, cone and stick, sparking at the tail
  const flierXml = (id, col, seed) => group({ name: 'flier', id, x: L0.x, y: L0.y, opacity: 0 }, [
    glow({ x: 0, y: 21, w: 22, h: 22, color: SPARK.gold, alpha: 0.85 }),
    stippleShape({ name: 'sparks', dots: [{ x: 0, y: 19, r: 1.5 }, { x: -1.4, y: 23, r: 1 }, { x: 1.2, y: 26, r: 0.9 }, { x: -0.4, y: 30, r: 0.7 }], color: argb(SPARK.gold, 1) }),
    ...rocketDraw(0, -17, col, seed),
  ]);
  const ease2 = (t) => 1 - (1 - t) ** 2.2;
  const flightTracks = (id, tr, to, f1) => {
    const heading = Math.atan2(to.y - L0.y, to.x - L0.x);
    return [
      { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [2, 1, 'hold'], [f1, 0, 'hold']] },
      { object: id, prop: 'rotation', keys: [[0, heading + Math.PI / 2, 'hold']] },
      sampled(id, 'x', f1, 2, (t) => lerp(L0.x, to.x, ease2(t)) + Math.sin(ease2(t) * Math.PI) * 8),
      sampled(id, 'y', f1, 2, (t) => lerp(L0.y, to.y, ease2(t))),
      { object: tr.trimId, prop: 'end', keys: [[0, 0, 'hold'], [2, 0, 'cubic', [0.3, 0.55, 0.5, 1]], [f1, 1]] },
      { object: tr.id, prop: 'opacity', keys: [[0, 0, 'hold'], [2, 0.8, 'hold'], [f1 + 16, 0.8, 'cubic', EASE.in], [f1 + 110, 0]] },
      { object: cartRocketId, prop: 'opacity', keys: [[0, 1, 'hold'], [2, 0, 'hold'], [f1 + 130, 0, 'cubic', EASE.out], [f1 + 160, 1]] },
    ];
  };

  // Gandalf's show: at dusk and at night rockets go up from behind the hill all evening
  const SHOW = [
    { f: 60, kind: 'flower', x: 600, y: 70, from: 190, R: 30, cols: [SPARK.rose, SPARK.gold] },
    { f: 330, kind: 'willow', x: 750, y: 46, from: 156, R: 34, cols: [SPARK.gold, SPARK.white] },
    { f: 560, kind: 'star', x: 474, y: 62, from: 214, R: 30, cols: [SPARK.sky, SPARK.gold] },
    { f: 800, kind: 'flower', x: 686, y: 40, from: 132, R: 24, cols: [SPARK.green, SPARK.gold] },
    { f: 950, kind: 'star', x: 560, y: 36, from: 176, R: 22, cols: [SPARK.violet, SPARK.rose] },
  ];
  const showDur = 1140;
  const showKids = [], showTracks = [];
  const streakXml = () => [
    glow({ x: 0, y: 2, w: 14, h: 14, color: SPARK.gold, alpha: 0.8 }),
    el('Shape', { name: 'tail' }, [polyXml([P(0, 2), P(0.4, 9), P(0, 16)]), stroke(argb(SPARK.gold, 0.6), 1)]),
    stippleShape({ name: 'head', dots: [{ x: 0, y: 0, r: 1.6 }, { x: 0.3, y: 5, r: 1 }, { x: -0.2, y: 10, r: 0.7 }], color: argb(SPARK.white, 1) }),
  ];
  SHOW.forEach((b, i) => {
    const id = ids.next(), streak = ids.next();
    const burst = burstXml(ids, { kind: b.kind, R: b.R, cols: b.cols, seed: 1000 + i * 17 });
    showKids.push(group({ name: 'show burst', id, x: b.x, y: b.y, opacity: 0, scaleX: 0.12, scaleY: 0.12 }, [burst.xml]));
    showKids.push(group({ name: 'show streak', id: streak, x: b.x - 4, y: b.from, opacity: 0 }, streakXml()));
    showTracks.push(
      ...burstTracks(id, burst.flashId, b.x, b.y, b.f),
      { object: streak, prop: 'opacity', keys: [[0, 0, 'hold'], [b.f - 36, 1, 'hold'], [b.f, 0, 'hold']] },
      { object: streak, prop: 'y', keys: [[0, b.from, 'hold'], [b.f - 36, b.from, 'cubic', [0.2, 0.6, 0.4, 1]], [b.f, b.y]] },
      { object: streak, prop: 'x', keys: [[0, b.x - 4, 'hold'], [b.f - 36, b.x - 4, 'cubic', EASE.out], [b.f, b.x]] },
    );
  });
  const showId = ids.next();
  s.add(group({ name: 'show', id: showId, opacity: LIT[TIME0] }, showKids));
  tp(showId, 'opacity', LIT);
  gatedLoop(s, 'show', s.anim({ name: 'show', duration: showDur, loop: 'loop', rate: 30, tracks: showTracks }), [[time, 'greaterThanOrEqual', 3]]);

  // rockets from the cart, one per kind (main.js picks which): a flower, a willow, a flight of birds
  const ROCKETS = {
    flower: { to: P(566, 74), R: 34, cols: [SPARK.rose, SPARK.gold], col: C.rose },
    willow: { to: P(648, 58), R: 40, cols: [SPARK.gold, SPARK.white], col: C.butter },
    birds: { to: P(530, 92), col: C.sky },
  };
  const rocketKids = [];
  for (const [kind, rk] of Object.entries(ROCKETS)) {
    const fl = ids.next();
    const tr = trail(rk.to, 1100 + kind.length);
    const F1 = 44;
    const tracks = flightTracks(fl, tr, rk.to, F1);
    rocketKids.push(tr.xml, flierXml(fl, rk.col, 1110 + kind.length * 3));
    if (kind === 'birds') {
      // "a flight of scintillating birds": they burst out of the flash and fly off, flapping
      const flash = ids.next();
      rocketKids.push(group({ name: 'birds flash', id: flash, x: rk.to.x, y: rk.to.y, opacity: 0 }, [glow({ x: 0, y: 0, w: 110, h: 110, color: SPARK.gold, alpha: 0.6 })]));
      tracks.push({ object: flash, prop: 'opacity', keys: [[0, 0, 'hold'], [F1, 1, 'cubic', EASE.out], [F1 + 50, 0]] });
      const dirs = [-2.75, -2.35, -1.95, -1.57, -1.2, -0.8, -0.4];
      dirs.forEach((a, i) => {
        const id = ids.next(), flap = ids.next();
        const d = 70 + (i % 3) * 18;
        const end = P(rk.to.x + Math.cos(a) * d, rk.to.y + Math.sin(a) * d * 0.7);
        const far = P(end.x + Math.cos(a) * 30 + 20, end.y - 18);
        rocketKids.push(group({ name: 'spark bird', id, x: rk.to.x, y: rk.to.y, opacity: 0, scaleX: 0.9, scaleY: 0.9 }, [
          glow({ x: 0, y: -1, w: 20, h: 14, color: SPARK.gold, alpha: 0.6 }),
          group({ name: 'flap', id: flap }, [ink([P(-8, -4.5), P(-4, -3.4), P(0, 0), P(4, -3.4), P(8, -4.5)], rng(1130 + i), { w: 1.6, amt: 0.3, color: argb('D2A23A', 1), bleed: 0.3 })]),
        ]));
        const f0 = F1 + 2;
        const at = (t, f) => (t * 220 - f0) / f;
        tracks.push(
          { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [f0, 1, 'hold'], [150 + i * 6, 1, 'cubic', EASE.in], [205, 0]] },
          sampled(id, 'x', 220, 2, (t) => { const u = Math.max(0, Math.min(1, at(t, 100))), v = Math.max(0, Math.min(1, at(t, 160))); return lerp(rk.to.x, end.x, ease2(u)) + (far.x - end.x) * Math.max(0, v - 0.6) * 2.5; }),
          sampled(id, 'y', 220, 2, (t) => { const u = Math.max(0, Math.min(1, at(t, 100))), v = Math.max(0, Math.min(1, at(t, 160))); return lerp(rk.to.y, end.y, ease2(u)) + Math.sin(u * 7 + i) * 3 + (far.y - end.y) * Math.max(0, v - 0.6) * 2.5; }),
          sampled(flap, 'scaleY', 220, 2, (t) => 1 - 1.4 * Math.abs(Math.sin(t * TAU * 9 + i))),
        );
      });
    } else {
      const id = ids.next();
      const burst = burstXml(ids, { kind, R: rk.R, cols: rk.cols, seed: 1150 + kind.length * 7 });
      rocketKids.push(group({ name: `${kind} burst`, id, x: rk.to.x, y: rk.to.y, opacity: 0, scaleX: 0.12, scaleY: 0.12 }, [burst.xml]));
      tracks.push(...burstTracks(id, burst.flashId, rk.to.x, rk.to.y, F1, { hold: 44, fade: 90, drop: kind === 'willow' ? 22 : 12 }));
    }
    const trig = s.input('trigger', `rocket-${kind}`);
    s.triggerLayer(`rocket ${kind}`, trig, s.anim({ name: `rocket ${kind}`, duration: 230, tracks }), { fromAny: false, mix: 0 });
  }

  // and the dragon: a big rocket goes straight up out of sight, and then a red-golden dragon
  // comes down out of the east like an express train over the hill, turns a somersault, and
  // bursts with a deafening explosion
  const spine = [P(-56, 0), P(-44, -4), P(-30, -3), P(-16, 1), P(0, 3), P(16, 0), P(30, -4), P(46, -3), P(62, 3), P(78, 2), P(90, -3)];
  const widths = [5, 4, 5.5, 7.5, 8, 7, 5.5, 4, 2.8, 1.6, 0.6];
  const nrm = spine.map((p, i) => { const a = spine[Math.max(0, i - 1)], b = spine[Math.min(spine.length - 1, i + 1)]; const L = Math.hypot(b.x - a.x, b.y - a.y); return P((b.y - a.y) / L, -(b.x - a.x) / L); });
  const top = spine.map((p, i) => P(p.x + nrm[i].x * widths[i], p.y + nrm[i].y * widths[i]));
  const bot = spine.map((p, i) => P(p.x - nrm[i].x * widths[i], p.y - nrm[i].y * widths[i]));
  const body = [...top, ...bot.slice().reverse()];
  const belly = [...spine.slice(2, 9).map((p, i) => P(p.x, p.y + 1)), ...bot.slice(2, 9).reverse()];
  const head = [P(-50, -5), P(-60, -7.5), P(-71, -5), P(-66, -1.4), P(-72, 3.6), P(-61, 6), P(-50, 5)];
  const barb = [P(89, -3), P(96, -10), P(102, -2), P(95, 1)];
  const wingAt = P(-14, -5);
  const wingShape = [P(0, 0), P(-14, -22), P(-4, -40), P(6, -28), P(16, -40), P(20, -22), P(28, -30), P(26, -4)];
  const flame = [P(-70, -1), P(-84, -7), P(-98, -3), P(-90, 0), P(-100, 5), P(-84, 6)];
  const sr = rng(1180);
  const trailDots = Array.from({ length: 22 }, () => ({ x: sr.range(96, 160), y: sr.jit(9), r: sr.range(0.7, 1.7) }));
  const dragonId = ids.next(), wingId = ids.next(), farWingId = ids.next(), flameId = ids.next();
  const dragonInk = k.boil({
    name: 'dragon ink', seed: 1181, draw: (rr) => [
      ink([{ pts: body, closed: true }, { pts: head, closed: true, tension: 0.4 }, { pts: barb, closed: true, tension: 0.3 }, [P(-55, -6), P(-49, -14)], [P(-52, -6), P(-44, -12)], [P(-8, 6), P(-11, 14), P(-15, 15)], [P(22, 3), P(20, 11), P(16, 12)]], rr, { w: 1.5, amt: 0.4, bleed: 0.12 }),
      ink(top.slice(3, 9).map((p, i) => [p, P(p.x + nrm[i + 3].x * 4 + 2, p.y + nrm[i + 3].y * 4)]), rr, { w: 1, amt: 0.2 }),
    ],
  });
  const wingXml = (id, k0, col, a) => group({ name: 'wing', id, x: wingAt.x + k0.dx, y: wingAt.y + k0.dy, scaleX: k0.s, scaleY: k0.s }, [
    wc(ids, wingShape, col, rng(1182 + k0.dx), { alpha: a, off: [0.5, 0.5], wobble: 0.6, grain: 0.3, soft: false, blend: 'normal', tension: 0.4 }),
    ink([{ pts: wingShape, closed: true }, [P(0, 0), P(-4, -40)], [P(0, 0), P(16, -40)], [P(0, 0), P(28, -30)]], rng(1184 + k0.dx), { w: 1.2, amt: 0.3, tension: 0.4 }),
  ]);
  s.add(group({ name: 'dragon', id: dragonId, x: 980, y: 20, opacity: 0, scaleX: 0.95, scaleY: 0.95 }, [
    glow({ x: 0, y: 0, w: 230, h: 100, color: SPARK.gold, alpha: 0.24 }),
    stippleShape({ name: 'spark trail', dots: trailDots, color: argb(SPARK.gold, 0.9) }),
    wingXml(farWingId, { dx: 8, dy: -2, s: 0.78 }, C.terra, 0.75),
    wc(ids, body, 'C4503B', rng(1186), { alpha: 0.92, off: [0.6, 0.6], wobble: 0.5, grain: 0.4, soft: false, blend: 'normal', tension: 0.8 }),
    wc(ids, belly, C.butter, rng(1187), { alpha: 0.85, off: [0, 0], wobble: 0.3, grain: 0.2, soft: false, blend: 'normal', tension: 0.8 }),
    wc(ids, head, 'C4503B', rng(1188), { alpha: 0.95, off: [0.4, 0.4], wobble: 0.2, grain: 0.2, soft: false, blend: 'normal', tension: 0.4 }),
    wc(ids, barb, C.butter, rng(1189), { alpha: 0.9, off: [0.2, 0.2], wobble: 0.2, grain: 0, soft: false, blend: 'normal', tension: 0.3 }),
    dragonInk,
    stippleShape({ name: 'eye', dots: [{ x: -60, y: -3.4, r: 1.5 }], color: argb(SPARK.gold, 1) }),
    stippleShape({ name: 'pupil', dots: [{ x: -59.6, y: -3.4, r: 0.6 }], color: INK }),
    wingXml(wingId, { dx: 0, dy: 0, s: 1 }, 'E3A23A', 0.88),
    group({ name: 'fire', id: flameId, x: -70, y: 1 }, [
      glow({ x: -12, y: 0, w: 48, h: 34, color: SPARK.gold, alpha: 0.8 }),
      wc(ids, flame.map((p) => P(p.x + 70, p.y - 1)), SPARK.gold, rng(1190), { alpha: 0.9, off: [0, 0], wobble: 0.6, grain: 0, soft: false, blend: 'normal', tension: 0.6 }),
      wc(ids, flame.map((p) => P((p.x + 70) * 0.6, (p.y - 1) * 0.6)), SPARK.red, rng(1191), { alpha: 0.85, off: [0, 0], wobble: 0.4, grain: 0, soft: false, blend: 'normal', tension: 0.6 }),
      ink({ pts: flame.map((p) => P(p.x + 70, p.y - 1)), closed: true }, rng(1192), { w: 1, amt: 0.3, color: argb('B0382A', 0.9), tension: 0.6 }),
    ]),
  ]));
  // its flight, as a curve through these points (and once round a loop), at an even speed
  const loopC = P(468, 63), loopR = 28;
  const via = [P(990, 22), P(900, 48), P(790, 94), P(690, 120), P(600, 118), P(530, 100), P(494, 91)];
  for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + (i / 8) * TAU; via.push(P(loopC.x + Math.cos(a) * loopR, loopC.y + Math.sin(a) * loopR)); }
  via.push(P(448, 91), P(434, 90));
  const dense = [];
  for (let i = 0; i < via.length - 1; i++) {
    const p0 = via[Math.max(0, i - 1)], p1 = via[i], p2 = via[i + 1], p3 = via[Math.min(via.length - 1, i + 2)];
    for (let j = 0; j < 16; j++) {
      const t = j / 16, t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push(P(cr(p0.x, p1.x, p2.x, p3.x), cr(p0.y, p1.y, p2.y, p3.y)));
    }
  }
  dense.push(via.at(-1));
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  const along = (u) => {
    const d = u * cum.at(-1);
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const f = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return P(lerp(dense[i - 1].x, dense[i].x, f), lerp(dense[i - 1].y, dense[i].y, f));
  };
  const D0 = 40, D1 = 200, DDUR = 340;
  const flyU = (t) => Math.max(0, Math.min(1, (t * DDUR - D0) / (D1 - D0)));
  let lastRot = null;
  const rotKeys = [];
  for (let f = 0; f <= DDUR; f += 2) {
    const u = flyU(f / DDUR);
    const a = along(Math.max(0, u - 0.004)), b = along(Math.min(1, u + 0.004));
    let rot = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI;
    if (lastRot !== null) { while (rot - lastRot > Math.PI) rot -= TAU; while (rot - lastRot < -Math.PI) rot += TAU; }
    lastRot = rot;
    rotKeys.push([f, rot, 'linear']);
  }
  const dragonEnd = along(1);
  const bigBurst = burstXml(ids, { kind: 'star', R: 64, cols: [SPARK.red, SPARK.gold], seed: 1200 });
  const bigBurst2 = burstXml(ids, { kind: 'flower', R: 40, cols: [SPARK.gold, SPARK.white], seed: 1201 });
  const bb1 = ids.next(), bb2 = ids.next(), boomId = ids.next();
  s.add(group({ name: 'boom', id: boomId, x: dragonEnd.x, y: dragonEnd.y, opacity: 0 }, [glow({ x: 0, y: 0, w: 460, h: 300, color: SPARK.gold, alpha: 0.4 })]));
  s.add(group({ name: 'dragon burst', id: bb1, x: dragonEnd.x, y: dragonEnd.y, opacity: 0, scaleX: 0.12, scaleY: 0.12 }, [bigBurst.xml]));
  s.add(group({ name: 'dragon burst 2', id: bb2, x: dragonEnd.x, y: dragonEnd.y, opacity: 0, scaleX: 0.12, scaleY: 0.12, rotation: 0.3 }, [bigBurst2.xml]));
  const dragonFlier = ids.next();
  const dragonTrail = trail(P(470, -40), 1210);
  s.add(dragonTrail.xml, flierXml(dragonFlier, C.terra, 1212));
  const dragonTracks = [
    ...flightTracks(dragonFlier, dragonTrail, P(470, -40), D0),
    { object: dragonId, prop: 'opacity', keys: [[0, 0, 'hold'], [D0, 1, 'hold'], [D1, 0, 'hold']] },
    sampled(dragonId, 'x', DDUR, 2, (t) => along(flyU(t)).x),
    sampled(dragonId, 'y', DDUR, 2, (t) => along(flyU(t)).y),
    { object: dragonId, prop: 'rotation', keys: thin(rotKeys, 0.002) },
    sampled(wingId, 'scaleY', DDUR, 2, (t) => 1 - 1.3 * Math.abs(Math.sin(t * TAU * 7))),
    sampled(farWingId, 'scaleY', DDUR, 2, (t) => 0.78 * (1 - 1.1 * Math.abs(Math.sin(t * TAU * 7 + 0.3)))),
    sampled(flameId, 'scaleX', DDUR, 2, (t) => 0.8 + 0.3 * Math.abs(Math.sin(t * TAU * 23))),
    sampled(flameId, 'scaleY', DDUR, 2, (t) => 0.85 + 0.2 * Math.abs(Math.sin(t * TAU * 17 + 1))),
    ...burstTracks(bb1, bigBurst.flashId, dragonEnd.x, dragonEnd.y, D1, { hold: 50, fade: 90, drop: 16 }),
    ...burstTracks(bb2, bigBurst2.flashId, dragonEnd.x, dragonEnd.y, D1 + 8, { hold: 40, fade: 90, drop: 20 }),
    { object: boomId, prop: 'opacity', keys: [[0, 0, 'hold'], [D1, 1, 'cubic', EASE.out], [D1 + 70, 0]] },
  ];
  s.add(group({ name: 'rockets' }, rocketKids));
  const dragonTrig = s.input('trigger', 'rocket-dragon');
  s.triggerLayer('rocket dragon', dragonTrig, s.anim({ name: 'rocket dragon', duration: DDUR, tracks: dragonTracks }), { fromAny: false, mix: 0 });

  // --- hit areas
  const hDoor = ids.next(), hBench = ids.next(), hWash = ids.next(), hTree = ids.next(), hMail = ids.next(), hSun = ids.next();
  const hCart = ids.next(), hPresent = ids.next(), hBilbo = ids.next();
  s.add(
    hit(hDoor, D.x, D.y, 108, 104), hit(hBench, 520, 322, 112, 50), hit(hWash, 822, 330, 140, 112), hit(hTree, tx + 4, tb - 64, 124, 142), hit(hMail, 394, 360, 34, 60), hit(hSun, 200, 90, 220, 140),
    hit(hCart, 462, 362, 84, 74), hit(hPresent, 699, 328, 44, 36), hit(hBilbo, BX, BY - 22, 22, 48),
  );

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
    { object: ringId, prop: 'y', keys: [[0, 309, 'cubic', EASE.out], [160, 273]] },
    { object: ringId, prop: 'x', keys: [[0, 546, 'cubic', EASE.inOut], [160, 552]] },
    { object: ringId, prop: 'scaleX', keys: [[0, 0.6, 'cubic', EASE.out], [160, 2.2]] },
    { object: ringId, prop: 'scaleY', keys: [[0, 0.6, 'cubic', EASE.out], [160, 2]] },
  ] }), { fromAny: false });
  s.listen(hBench, 'enter', [Scene.fire(puff)]);
  s.listen(hBench, 'click', [Scene.fire(puff)]);

  const gust = s.input('trigger', 'gust');
  s.triggerLayer('gust', gust, s.anim({ name: 'gust', duration: 100, tracks: gustTracks }), { fromAny: false });
  s.listen(hWash, 'enter', [Scene.fire(gust)]);

  const rustle = s.input('trigger', 'rustle');
  s.triggerLayer('rustle', rustle, s.anim({ name: 'rustle', duration: 170, tracks: [
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
  // a click on the Party Tree lights its lanterns one after another (and shakes a few leaves down)
  const lamps = s.input('trigger', 'lamps');
  s.triggerLayer('lamps', lamps, s.anim({ name: 'lamps', duration: 260, tracks: LANTERNS.flatMap((l, i) => {
    const f = 4 + i * 10;
    return [
      { object: l.flareId, prop: 'opacity', keys: [[0, 0, 'hold'], [f, 0, 'cubic', EASE.out], [f + 8, 1, 'hold'], [170 + i * 6, 1, 'cubic', EASE.in], [230 + i * 6, 0]] },
      { object: l.id, prop: 'rotation', keys: [[0, 0, 'hold'], [f, 0, 'cubic', EASE.out], [f + 8, 0.3, 'cubic', EASE.inOut], [f + 24, -0.2, 'cubic', EASE.inOut], [f + 40, 0.09, 'cubic', EASE.inOut], [f + 58, 0]] },
    ];
  }) }), { fromAny: false, mix: 0 });
  s.listen(hTree, 'click', [Scene.fire(lamps), Scene.fire(shake)]);

  // presents: the front one opens and a mathom comes up out of it, has a moment in the
  // light, and goes back; the lid comes off to lean on the box, then goes back on
  for (const [kind, m] of Object.entries(mathomIds)) {
    const trig = s.input('trigger', `unwrap-${kind}`);
    const bob = sampled(m.id, 'y', 240, 4, (t) => {
      const f = t * 240;
      if (f < 10) return 334;
      if (f < 40) return lerp(334, 302, EASE_OUT((f - 10) / 30));
      if (f < 184) return 302 + Math.sin((f - 40) / 144 * TAU * 2) * 1.4;
      if (f < 214) return lerp(302, 334, ((f - 184) / 30) ** 2);
      return 334;
    });
    s.triggerLayer(`unwrap ${kind}`, trig, s.anim({ name: `unwrap ${kind}`, duration: 240, tracks: [
      { object: lidId, prop: 'x', keys: [[0, PR.x, 'cubic', EASE.out], [12, PR.x - 4, 'cubic', EASE.in], [28, PR.x - 15, 'hold'], [190, PR.x - 15, 'cubic', EASE.inOut], [222, PR.x]] },
      { object: lidId, prop: 'y', keys: [[0, PR.top, 'cubic', EASE.out], [12, PR.top - 17, 'cubic', EASE.in], [28, 337, 'cubic', EASE.out], [33, 335, 'cubic', EASE.in], [38, 337, 'hold'], [190, 337, 'cubic', EASE.inOut], [206, PR.top - 10, 'cubic', EASE.in], [222, PR.top, 'cubic', EASE.out], [228, PR.top - 1, 'cubic', EASE.in], [234, PR.top]] },
      { object: lidId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [12, -0.5, 'cubic', EASE.in], [28, -1.32, 'cubic', EASE.out], [34, -1.2, 'cubic', EASE.inOut], [40, -1.3, 'hold'], [190, -1.3, 'cubic', EASE.inOut], [222, 0]] },
      { object: m.id, prop: 'opacity', keys: [[0, 0, 'hold'], [10, 1, 'hold'], [214, 0, 'hold']] },
      bob,
      { object: m.wig, prop: 'rotation', keys: [[0, 0, 'hold'], [36, 0, 'cubic', EASE.out], [44, 0.16, 'cubic', EASE.inOut], [58, -0.1, 'cubic', EASE.inOut], [72, 0.04, 'cubic', EASE.inOut], [84, 0]] },
      { object: twinkleId, prop: 'opacity', keys: [[0, 0, 'hold'], [38, 0, 'cubic', EASE.out], [48, 1, 'hold'], [120, 1, 'cubic', EASE.in], [150, 0]] },
      { object: twinkleId, prop: 'rotation', keys: [[0, 0, 'hold'], [38, 0, 'linear'], [150, 0.5]] },
    ] }), { fromAny: false, mix: 0 });
  }
  s.listen(hPresent, 'click', [Scene.emit(s.event('present'))]);
  s.listen(hCart, 'click', [Scene.emit(s.event('cart'))]);
  s.listen(hBilbo, 'click', [Scene.emit(s.event('bilbo'))]);

  // Bilbo's trick (main.js has him say goodbye first): a flash, and he's gone; the door opens
  // a moment and shuts as he slips in unseen, and a good while later he's back out again
  const vanish = s.input('trigger', 'vanish');
  const doorAjar = (a, b) => [[a, 1, 'cubic', [0.4, 0, 0.3, 1]], [a + 24, 0.62, 'hold'], [b, 0.62, 'cubic', EASE.inOut], [b + 26, 1.006, 'cubic', EASE.out], [b + 34, 1, 'hold']];
  s.triggerLayer('vanish', vanish, s.anim({ name: 'vanish', duration: 540, tracks: [
    { object: flashId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [5, 1, 'hold'], [12, 1, 'cubic', EASE.in], [56, 0]] },
    { object: flashId, prop: 'scaleX', keys: [[0, 0.4, 'cubic', EASE.out], [14, 1.1, 'linear'], [56, 1.3]] },
    { object: flashId, prop: 'scaleY', keys: [[0, 0.4, 'cubic', EASE.out], [14, 1.1, 'linear'], [56, 1.3]] },
    { object: bilboId, prop: 'opacity', keys: [[0, 1, 'hold'], [5, 0, 'hold'], [472, 0, 'cubic', EASE.out], [500, 1, 'hold'], [540, 1]] },
    { object: leafId, prop: 'scaleX', keys: [[0, 1, 'hold'], ...doorAjar(80, 128), ...doorAjar(440, 488), [540, 1]] },
    { object: insideId, prop: 'opacity', keys: [[0, 0, 'hold'], [82, 0, 'cubic', EASE.out], [102, 1, 'hold'], [128, 1, 'cubic', EASE.in], [150, 0, 'hold'], [442, 0, 'cubic', EASE.out], [462, 1, 'hold'], [488, 1, 'cubic', EASE.in], [510, 0]] },
  ] }), { fromAny: false, mix: 0 });

  const post = s.input('trigger', 'post');
  s.triggerLayer('post', post, s.anim({ name: 'post', duration: 210, tracks: [
    { object: flagId, prop: 'rotation', keys: [[0, 0, 'elastic', { amplitude: 1, period: 0.5 }], [40, -Math.PI / 2, 'hold'], [160, -Math.PI / 2, 'cubic', EASE.inOut], [200, 0]] },
  ] }), { fromAny: false });
  s.listen(hMail, 'enter', [Scene.fire(post)]);

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


  // bunting from post to post over the gate
  const gBunt = bunting(k, { name: 'gate bunting', a: P(306, 58), b: P(454, 58), sag: 9, n: 8, seed: 5, fx: fxGate, size: 0.95 });
  s.add(k.in({ name: 'gate bunting in', t0: 40, t1: 80, op: 0 }, [gBunt.xml]));
  s.loopLayer('bunting', ambient(s, { name: 'bunting', duration: 360, loop: 'loop', tracks: gBunt.sway }));

  // a present by the sign for whoever gets this far: a gold pen and ink inside (main.js
  // reads its label out)
  const gp = { x: 186, top: 176, bot: 196 };
  const gBox = [P(174, 176), P(198, 176), P(198, 196), P(174, 196)];
  const gLid = [P(-13, -6), P(13, -6), P(13, 0), P(-13, 0)];
  const gBow = [blobPts(3.6, 2.4, rng(470), { n: 7, wobble: 0.1 }).map((p) => P(p.x - 3.6, p.y - 8.4)), blobPts(3.6, 2.4, rng(471), { n: 7, wobble: 0.1 }).map((p) => P(p.x + 3.6, p.y - 8.4))];
  const gLidId = ids.next(), gPenId = ids.next(), gWigId = ids.next();
  const bottle = [P(-7, 3), P(-7, -2.5), P(-5, -4.5), P(-5, -7), P(-1, -7), P(-1, -4.5), P(1, -2.5), P(1, 3)];
  s.add(k.in({ name: 'present in', cx: gp.x, cy: gp.bot, t0: 50, t1: 86, sc: 0.3, ease: EASE.back }, [
    group({ name: 'pen and ink', id: gPenId, x: gp.x, y: 188, opacity: 0 }, [group({ name: 'wiggle', id: gWigId }, [
      wc(ids, bottle, '3B3550', rng(472), { alpha: 0.9, off: [0.4, 0.4], wobble: 0.2, grain: 0.2, soft: false, blend: 'normal' }),
      el('Shape', { name: 'pen' }, [polyXml([P(0, 5), P(9, -11)]), stroke(argb('D2A23A', 1), 2.4)]),
      ink([{ pts: bottle, closed: true }, [P(0, 5), P(9, -11)]], rng(473), { w: 0.9, amt: 0.12, tension: 0.3 }),
    ])]),
    wc(ids, gBox, C.butter, rng(474), { alpha: 0.95, off: [0.6, 0.6], wobble: 0.4, grain: 0.3, soft: false, blend: 'normal' }),
    wc(ids, [P(184.5, 176), P(187.5, 176), P(187.5, 196), P(184.5, 196)], C.rose, rng(475), { alpha: 0.95, off: [0, 0], wobble: 0.15, grain: 0, soft: false, blend: 'normal' }),
    wc(ids, [P(174, 184.5), P(198, 184.5), P(198, 187.5), P(174, 187.5)], C.rose, rng(476), { alpha: 0.95, off: [0, 0], wobble: 0.15, grain: 0, soft: false, blend: 'normal' }),
    k.boil({ name: 'present ink', seed: 477, draw: (rr) => ink([{ pts: gBox, closed: true }], rr, { w: 1.4, amt: 0.3, fx: fxSign, tension: 0.2 }) }),
    group({ name: 'lid', id: gLidId, x: gp.x, y: gp.top }, [
      wc(ids, gLid, darken(C.butter, 0.06), rng(478), { alpha: 0.95, off: [0.3, 0.3], wobble: 0.2, grain: 0, soft: false, blend: 'normal' }),
      wc(ids, [P(-1.5, -6), P(1.5, -6), P(1.5, 0), P(-1.5, 0)], C.rose, rng(479), { alpha: 0.95, off: [0, 0], wobble: 0.1, grain: 0, soft: false, blend: 'normal' }),
      ...gBow.map((b, i) => wc(ids, b, C.rose, rng(480 + i * 7), { alpha: 0.95, off: [0, 0], wobble: 0.15, grain: 0, soft: false, blend: 'normal' })),
      k.boil({ name: 'lid ink', seed: 482, draw: (rr) => ink([{ pts: gLid, closed: true }, ...gBow.map((b) => ({ pts: b, closed: true })), [P(-1, -6.5), P(-4, -2.5)], [P(1, -6.5), P(4.5, -3)]], rr, { w: 1.1, amt: 0.2, fx: fxSign, tension: 0.3 }) }),
    ]),
  ]));
  const unwrap = s.input('trigger', 'unwrap');
  s.triggerLayer('unwrap', unwrap, s.anim({ name: 'unwrap', duration: 240, tracks: [
    { object: gLidId, prop: 'x', keys: [[0, gp.x, 'cubic', EASE.out], [12, gp.x + 4, 'cubic', EASE.in], [28, gp.x + 15, 'hold'], [190, gp.x + 15, 'cubic', EASE.inOut], [222, gp.x]] },
    { object: gLidId, prop: 'y', keys: [[0, gp.top, 'cubic', EASE.out], [12, gp.top - 17, 'cubic', EASE.in], [28, 190, 'cubic', EASE.out], [33, 188, 'cubic', EASE.in], [38, 190, 'hold'], [190, 190, 'cubic', EASE.inOut], [206, gp.top - 10, 'cubic', EASE.in], [222, gp.top, 'cubic', EASE.out], [228, gp.top - 1, 'cubic', EASE.in], [234, gp.top]] },
    { object: gLidId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [12, 0.5, 'cubic', EASE.in], [28, 1.32, 'cubic', EASE.out], [34, 1.2, 'cubic', EASE.inOut], [40, 1.3, 'hold'], [190, 1.3, 'cubic', EASE.inOut], [222, 0]] },
    { object: gPenId, prop: 'opacity', keys: [[0, 0, 'hold'], [10, 1, 'hold'], [214, 0, 'hold']] },
    { object: gPenId, prop: 'y', keys: [[0, 188, 'hold'], [10, 188, 'cubic', EASE.out], [40, 158, 'hold'], [184, 158, 'cubic', EASE.in], [214, 188]] },
    { object: gWigId, prop: 'rotation', keys: [[0, 0, 'hold'], [36, 0, 'cubic', EASE.out], [44, 0.16, 'cubic', EASE.inOut], [58, -0.1, 'cubic', EASE.inOut], [72, 0.04, 'cubic', EASE.inOut], [84, 0]] },
  ] }), { fromAny: false, mix: 0 });
  const hPresent = ids.next();
  s.add(hit(hPresent, gp.x, 182, 40, 40));
  s.listen(hPresent, 'click', [Scene.fire(unwrap), Scene.emit(s.event('present'))]);

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
      group({ name: 'leaf body', x: -314, y: 0 }, [wc(ids, gateWash, C.door, rng(421), { alpha: 0.34, off: [2, 2], grain: 0.4, soft: false }), gateInk]),
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
  const fspots = [[20, 186], [44, 190], [94, 184], [222, 188], [242, 184], [262, 190], [338, 190], [400, 188], [496, 186], [584, 188]];
  const cols = [C.rose, C.butter, C.violet, C.terra, C.white];
  fspots.forEach(([x, y], i) => {
    const fr = rng(450 + i);
    fl.push(wc(ids, blobPts(5, 4.4, fr, { n: 7, wobble: 0.2 }).map((p) => P(p.x + x, p.y + y - 12)), cols[i % 5], fr, { alpha: 0.9, off: [0, 0], wobble: 0.4, grain: 0, soft: false }));
    stems.push([P(x, y + 2), P(x + fr.jit(1.4), y - 7)]);
  });
  fl.push(ink(stems, rng(460), { w: 1.1, amt: 0.3, fx: fxBack }));
  s.add(group({ name: 'flowers', id: flowersId }, [k.in({ name: 'flowers in', cx: 300, cy: 186, t0: 40, t1: 84, sc: 0.85, ease: EASE.back }, fl)]));
  seasonP.push({ object: flowersId, prop: 'opacity', vals: [1, 1, 0.4, 0] });

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

  k.finish(still);
  return s.toXml();
}

export default function () {
  TINT.clear();
  const ids = new Ids(10);
  return document(hill(ids), gate(ids));
}
