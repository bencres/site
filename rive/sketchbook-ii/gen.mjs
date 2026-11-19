// Draft 15 · Sketchbook II — draft 2's hillside, finished.
// The same cottage world redrawn with more care. On load the pen draws every
// line on, washes flood in wet and dry back a touch lighter (granulation
// settles last), the bird lands and the chimney starts to smoke.
// Two number inputs, `season` (0 spring .. 3 winter) and `time` (0 morning,
// 1 day, 2 golden, 3 dusk, 4 night), pick a few quiet touches; the page sets
// them once from the visitor's clock. One artboard, no Luau, no feathered
// fills: watercolor bodies are hard-edged glazes with a pooled rim, and the
// wet-in-wet layer is a radial gradient.
import { Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, fill, stroke, solidId, stippleShape, document, EASE } from '../lib/ink.mjs';

const W = 900, H = 360;
const INK = 'FF1F1C1A';
const envNum = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? +process.env[k] : d);
// baked input defaults, for native `rive --screenshot` frames only
const SEASON0 = envNum('SK2_SEASON', -1);
const TIME0 = envNum('SK2_TIME', -1);
const FRIEND0 = envNum('SK2_FRIEND', 0);
const SETTLED = !!process.env.SK2_SETTLED;

const C = {
  sap: '8DB360', leaf: '6E9F4E', ochre: 'D9A93F', terra: 'C8643B', sky: '7FB2D3', grey: '8A97A6',
  cream: 'E9D2A0', lamp: 'F4C84A', rose: 'D9738A', violet: '8E86C9', shadow: '7E7AAE', snowInk: '8FA6BD',
};

let ids;

// ---------- small helpers ----------

// children given back-to-front, like Scene.add
const group = (attrs, kids) => el('Node', attrs, [].concat(kids).filter(Boolean).reverse());

function trace(pts, r, amt = 0.8, n) {
  const src = n ? resample(pts, n) : pts;
  return src.map((p) => P(p.x + r.jit(amt), p.y + r.jit(amt)));
}

// a pen line; `fx` is a shared GroupEffect (the pen's trim), so every boil cel
// of the same stroke draws on together
function ink(pts, r, { w = 2, closed = false, amt = 0.8, n, color = INK, bleed = 0, fx, tension = 1 } = {}) {
  const kids = [pathXml(trace(pts, r, amt, n), { closed, tension })];
  if (bleed) kids.push(stroke(argb(color.slice(2), bleed), w * 2.2, { feather: w * 1.3, effect: fx }));
  kids.push(stroke(color, w, { effect: fx }));
  return el('Shape', { name: 'ink' }, kids);
}

const centroid = (pts) => {
  const s = pts.reduce((a, p) => P(a.x + p.x, a.y + p.y), P(0, 0));
  return P(s.x / pts.length, s.y / pts.length);
};

function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

function hit(id, x, y, w, h) {
  return el('Shape', { x, y, name: 'hit', id }, [el('Rectangle', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'R' }), fill('00000000')]);
}

// sample fn(frame) between f0 and f1 into keys, holding `outside` before/after
function window_(f0, f1, step, fn, dur, interp = 'linear') {
  const keys = [];
  if (f0 > 0) keys.push([0, fn(f0), 'hold']);
  for (let f = f0; f < f1; f += step) keys.push([f, fn(f), interp]);
  keys.push([f1, fn(f1), 'hold']);
  if (dur > f1) keys.push([dur, fn(f1), 'hold']);
  return keys;
}

function sampled(object, prop, frames, step, fn) {
  const keys = [];
  for (let f = 0; f <= frames; f += step) keys.push([f, fn(f / frames), 'linear']);
  return { object, prop, keys };
}

// a soft glow: one radial-gradient circle, squashed by its node for ellipses
function softDisc({ name = 'glow', x = 0, y = 0, r, sy = 1, color, alpha, id, opacity, blend }) {
  const stopIds = [ids.next(), ids.next(), ids.next(), ids.next()];
  const stops = [[0, 1], [0.3, 0.68], [0.6, 0.28], [0.82, 0.07]];
  const xml = el('Node', { name, x, y, id, opacity, scaleY: sy }, [
    el('Shape', { name: 'disc', blendModeValue: blend }, [
      el('Ellipse', { width: r * 2, height: r * 2, originX: 0.5, originY: 0.5, name: 'E' }),
      el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: 0, startY: 0, endX: r, endY: 0, name: 'G' }, [
        ...stops.map(([p, k], i) => el('GradientStop', { colorValue: argb(color, alpha * k), position: p, id: stopIds[i] })),
        el('GradientStop', { colorValue: argb(color, 0), position: 1 }),
      ])),
    ]),
  ]);
  return { xml, colors: stops.map(([, k], i) => ({ id: stopIds[i], a: alpha * k })) };
}

// ---------- the intro (pen + washes), collected as one animation ----------

class Intro {
  constructor(s) { this.s = s; this.tracks = []; }
  key(object, prop, keys) { this.tracks.push({ object, prop, keys }); }
  // a pen: one trim shared by every cel of a stroke
  trim(at, dur) {
    const fx = ids.next(), tr = ids.next();
    this.s.add(el('GroupEffect', { name: 'pen', id: fx }, el('TrimPath', { start: 0, end: 0, id: tr, name: 'Trim' })));
    this.key(tr, 'end', [[0, 0, 'hold'], [at, 0, 'cubic', [0.4, 0, 0.3, 1]], [at + dur, 1]]);
    return fx;
  }
  pens(at, step, dur) {
    const fx = [];
    return (k = 0) => (fx[k] ??= this.trim(at + k * step, dur));
  }
  build() {
    const s = this.s;
    const end = Math.max(...this.tracks.map((t) => t.keys.at(-1)[0])) + 1;
    const intro = s.anim({ name: 'intro', duration: end, tracks: this.tracks });
    const settled = s.anim({ name: 'settled', duration: 1, tracks: this.tracks.map((t) => ({ ...t, keys: [[0, t.keys.at(-1)[1], 'linear']] })) });
    return { intro, settled };
  }
}

// ---------- line boil, all cels in one animation per period ----------

class Boils {
  constructor(s) { this.s = s; this.by = new Map(); }
  add({ name = 'boil', cels = 3, hold = 7, seed = 1, draw, opacity, id }) {
    const r = rng(seed);
    const solo = id || ids.next();
    const celIds = [];
    const kids = [];
    for (let i = 0; i < cels; i++) {
      const cid = ids.next();
      celIds.push(cid);
      kids.push(el('Node', { name: `cel${i}`, id: cid }, [].concat(draw(r.fork(), i)).filter(Boolean).reverse()));
    }
    const dur = hold * cels;
    if (!this.by.has(dur)) this.by.set(dur, []);
    this.by.get(dur).push({ object: solo, prop: 'activeComponentId', type: 'Id', keys: celIds.map((c, i) => [i * hold, c, 'hold']) });
    return el('Solo', { name, activeComponentId: celIds[0], id: solo, opacity }, kids);
  }
  build() {
    for (const [dur, tracks] of this.by) this.s.loopLayer(`boil ${dur}`, this.s.anim({ name: `boil ${dur}`, duration: dur, loop: 'loop', tracks }));
  }
}

// ---------- held poses picked by a number input, cross-mixed when it changes ----------

class Poses {
  constructor(name, n) { Object.assign(this, { name, n, ch: [] }); }
  set(object, prop, values, type = 'Double') {
    if (values.length !== this.n) throw new Error(`${this.name}: ${prop} needs ${this.n} values`);
    this.ch.push({ object, prop, values, type });
  }
  colors(targets, palette) {
    for (const t of targets) this.set(t.id, 'colorValue', palette.map((c) => argb(t.dk ? darken(c, t.dk) : c, t.a)), 'Color');
  }
  build(s, inputId, mix) {
    const anims = [...Array(this.n)].map((_, k) => s.anim({
      name: `${this.name} ${k}`, duration: 1,
      tracks: this.ch.map((c) => ({ object: c.object, prop: c.prop, type: c.type, keys: [[0, c.values[k], 'linear']] })),
    }));
    const unset = ids.next();
    const st = anims.map(() => ids.next());
    const cond = (k) => el('TransitionNumberCondition', { inputId, opValue: 'equal', value: k });
    s.layers.push(s._layer(this.name, [
      el('AnyState', { x: 100, y: -140 }),
      el('ExitState', { x: 600, y: -140 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: unset })),
      el('AnimationState', { x: 160, y: 0, animationId: s.empty(), id: unset }, st.map((to, k) => el('StateTransition', { stateToId: to }, cond(k)))),
      ...st.map((id, k) => el('AnimationState', { x: 320 + k * 140, y: 0, animationId: anims[k], id },
        st.filter((_, j) => j !== k).map((to) => el('StateTransition', { stateToId: to, duration: mix }, cond(st.indexOf(to)))))),
    ]));
  }
}

// ---------- watercolor ----------

/**
 * A wash for an outline in artboard coords, with no feathers: a hard-edged
 * glaze with a darker pooled rim (how watercolor actually dries), a shrunken
 * wet-in-wet glaze as a radial gradient, and granulation dots.
 * Returns colour targets so poses can re-tint it.
 */
function paint(pts, color, r, { alpha = 0.55, off = [3, 2.5], wobble = 2.5, grain = 1, wetK = 0.72, rim = 0.6, name = 'paint', maxDots = 150 } = {}) {
  const shape = pts.map((p) => P(p.x + off[0] + r.jit(wobble), p.y + off[1] + r.jit(wobble)));
  const c = centroid(shape);
  const wet = shape.map((p) => P(c.x + (p.x - c.x) * wetK + r.jit(wobble * 2), c.y + (p.y - c.y) * (wetK - 0.05) + r.jit(wobble * 2)));
  const xs = shape.map((p) => p.x), ys = shape.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const wc = centroid(wet);
  const R = Math.max(6, Math.max(x1 - x0, y1 - y0) * 0.5 * wetK);
  const bodyId = ids.next(), rimId = ids.next(), s0 = ids.next(), s1 = ids.next();
  const dots = [];
  const want = Math.min(maxDots, Math.round((((x1 - x0) * (y1 - y0)) / 80) * grain));
  for (let i = 0, tries = 0; i < want && tries < want * 8; tries++) {
    const d = P(r.range(x0, x1), r.range(y0, y1));
    if (inside(d, shape)) { dots.push({ ...d, r: r.range(0.35, 0.95) }); i++; }
  }
  const grainId = dots.length ? ids.next() : null;
  const xml = group({ name }, [
    el('Shape', { name: 'glaze', blendModeValue: 'multiply' }, [
      pathXml(shape, { closed: true }),
      el('Fill', { name: 'Fill' }, solidId(argb(color, alpha * 0.7), bodyId)),
      rim ? stroke(argb(darken(color, 0.3), alpha * rim), 1.2, { colorId: rimId }) : '',
    ]),
    el('Shape', { name: 'wet', blendModeValue: 'multiply' }, [
      pathXml(wet, { closed: true }),
      el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: wc.x, startY: wc.y, endX: wc.x + R, endY: wc.y, name: 'G' }, [
        el('GradientStop', { colorValue: argb(color, alpha * 0.5), position: 0, id: s0 }),
        el('GradientStop', { colorValue: argb(color, alpha * 0.26), position: 0.6, id: s1 }),
        el('GradientStop', { colorValue: argb(color, 0), position: 1 }),
      ])),
    ]),
    dots.length ? stippleShape({ name: 'grain', id: grainId, dots, color: argb(darken(color, 0.4), alpha * 0.42), opacity: 0 }) : '',
  ]);
  const colors = [{ id: bodyId, a: alpha * 0.7 }, { id: s0, a: alpha * 0.5 }, { id: s1, a: alpha * 0.26 }];
  if (rim) colors.push({ id: rimId, a: alpha * rim, dk: 0.3 });
  return { xml, colors, grainId, c };
}

// a paint that floods in during the intro: fades up wet, blooms a touch past
// its edge, dries back lighter; the granulation settles in last
function wash(intro, pts, color, r, { at = 60, dry = 0.86, bloom = 0.93, id, ...o } = {}) {
  const p = paint(pts, color, r, { ...o, alpha: (o.alpha ?? 0.55) * 1.1 });
  const outer = id || ids.next();
  const xml = group({ name: o.name || 'wash', x: p.c.x, y: p.c.y, id: outer, opacity: 0 }, [group({ name: 'at', x: -p.c.x, y: -p.c.y }, [p.xml])]);
  intro.key(outer, 'opacity', [[0, 0, 'hold'], [at, 0, 'cubic', EASE.out], [at + 12, 1, 'cubic', EASE.inOut], [at + 84, dry]]);
  intro.key(outer, 'scaleX', [[0, bloom, 'hold'], [at, bloom, 'cubic', EASE.out], [at + 36, 1.014, 'cubic', EASE.inOut], [at + 96, 1]]);
  intro.key(outer, 'scaleY', [[0, bloom + 0.02, 'hold'], [at, bloom + 0.02, 'cubic', EASE.out], [at + 30, 1.02, 'cubic', EASE.inOut], [at + 92, 1]]);
  if (p.grainId) intro.key(p.grainId, 'opacity', [[0, 0, 'hold'], [at + 40, 0, 'cubic', EASE.inOut], [at + 110, 1]]);
  return { ...p, xml, id: outer };
}

// fade a node in (used for things that arrive rather than get painted)
function appear(intro, id, at, dur = 30) {
  intro.key(id, 'opacity', [[0, 0, 'hold'], [at, 0, 'cubic', EASE.inOut], [at + dur, 1]]);
}

// ---------- shapes ----------

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

function crescent(R = 15) {
  // outer circle at the origin minus a circle of radius R*0.87 shifted left
  const pts = [];
  for (let i = 0; i <= 10; i++) { const a = (-120 + i * 24) * (Math.PI / 180); pts.push(P(Math.cos(a) * R, Math.sin(a) * R)); }
  for (let i = 1; i < 8; i++) { const a = (97 - i * 24.25) * (Math.PI / 180); pts.push(P(-R * 0.4 + Math.cos(a) * R * 0.87, Math.sin(a) * R * 0.87)); }
  return pts;
}

const birdBody = [P(-10, 0), P(-12, -8), P(-6, -14), P(2, -15), P(8, -11), P(14, -12), P(9, -7), P(6, 0)];

// a little bird: body wash, breast dab, ink that boils; pen-drawn in the intro
function birdXml(boils, intro, { seed, pen }) {
  return [
    paint(birdBody, C.sky, rng(seed), { alpha: 0.8, off: [1.5, 1], wobble: 0.6, grain: 0.3, rim: 0.4 }).xml,
    paint([P(-4, -6), P(4, -8), P(7, -2), P(-2, -1)], C.terra, rng(seed + 1), { alpha: 0.65, off: [0, 0], wobble: 0.4, grain: 0, rim: 0 }).xml,
    boils.add({
      name: 'bird ink', seed: seed + 2, draw: (rr) => [
        ink(birdBody, rr, { closed: true, w: 1.7, amt: 0.35, fx: pen(0) }),
        ink([P(-10, -6), P(-18, -3)], rr, { w: 1.5, amt: 0.3, fx: pen(1) }),
        ink([P(-2, 0), P(-3, 4)], rr, { w: 1.2, amt: 0.2, fx: pen(1) }),
        ink([P(2, 0), P(3, 4)], rr, { w: 1.2, amt: 0.2, fx: pen(1) }),
        stippleShape({ dots: [{ x: 5, y: -11, r: 1.1 }], color: INK }),
      ],
    }),
  ];
}

// ---------- hero ----------

function hero() {
  const s = new Scene(ids, { name: 'Hero', w: W, h: H, bg: process.env.SK2_BG ? 'FFFBF8F1' : undefined });
  const intro = new Intro(s);
  const boils = new Boils(s);
  const season = new Poses('season', 4); // spring, summer, autumn, winter
  const time = new Poses('time', 5); // morning, day, golden, dusk, night
  const r = rng(20261119);
  const add = (...x) => s.add(...x);

  // ===== sky
  const skyA = wash(intro, blobPts(150, 42, r, { n: 14, wobble: 0.18 }).map((p) => P(p.x + 300, p.y + 78)), C.sky, r, { at: 26, alpha: 0.16, grain: 0.3, off: [0, 0], name: 'sky a' });
  const skyB = wash(intro, blobPts(110, 30, r, { n: 12, wobble: 0.2 }).map((p) => P(p.x + 640, p.y + 52)), C.sky, r, { at: 34, alpha: 0.12, grain: 0.2, off: [0, 0], name: 'sky b' });
  const skyCol = ['B5D3E4', '7FB2D3', 'E7B46A', 'D98A8F', '5C6698'];
  time.colors([...skyA.colors, ...skyB.colors], skyCol);
  add(skyA.xml, skyB.xml);

  // a low glow along the horizon: dawn peach, golden hour, dusk rose
  const glowNode = ids.next();
  const glow = softDisc({ name: 'horizon glow', x: 330, y: 250, r: 300, sy: 0.42, color: 'F2B66A', alpha: 0.5 });
  const glowIn = ids.next();
  add(group({ name: 'horizon in', id: glowIn, opacity: 0 }, [group({ name: 'horizon', id: glowNode, opacity: 0 }, [glow.xml])]));
  appear(intro, glowIn, 20, 70);
  time.set(glowNode, 'opacity', [0.55, 0, 0.8, 1, 0]);
  time.colors(glow.colors, ['F4C9A2', 'F2B66A', 'F0AE55', 'E8846A', '6E78A8']);

  // ===== moon & stars (night)
  const moonNode = ids.next(), moonInner = ids.next();
  const moonPts = crescent(15);
  const moonGlow = softDisc({ name: 'moon halo', r: 46, color: 'F3E3AE', alpha: 0.38 });
  const nightIn = ids.next();
  add(group({ name: 'night sky in', id: nightIn, opacity: 0 }, [group({ name: 'moon', x: 236, y: 66, id: moonNode, opacity: 0, rotation: -0.35 }, [
    moonGlow.xml,
    group({ name: 'moon body', id: moonInner }, [
      paint(moonPts, 'EED48A', rng(150), { alpha: 0.9, off: [1, 1], wobble: 0.5, grain: 0.4, rim: 0.4 }).xml,
      boils.add({ name: 'moon ink', seed: 151, draw: (rr) => ink(moonPts, rr, { closed: true, w: 1.6, amt: 0.4 }) }),
    ]),
  ])]));
  appear(intro, nightIn, 40, 60);
  time.set(moonNode, 'opacity', [0, 0, 0, 0.45, 1]);

  const starsNode = ids.next();
  const starSpots = [[150, 44, 1], [372, 34, 0.8], [470, 96, 0.65], [560, 30, 0.9], [790, 58, 0.75], [860, 112, 0.6]];
  const starIds = starSpots.map(() => ids.next());
  const starsIn = ids.next();
  add(group({ name: 'stars in', id: starsIn, opacity: 0 }, [group({ name: 'stars', id: starsNode, opacity: 0 }, starSpots.map(([x, y, k], i) => group({ name: 'star', x, y, id: starIds[i], scaleX: k, scaleY: k }, [
    softDisc({ r: 9, color: 'F6DE8A', alpha: 0.55 }).xml,
    boils.add({ name: 'star ink', seed: 160 + i, draw: (rr) => [ink([P(-5, 0), P(5, 0)], rr, { w: 1.3, amt: 0.5 }), ink([P(0, -5), P(0, 5)], rr, { w: 1.3, amt: 0.5 })] }),
  ])))]));
  appear(intro, starsIn, 160, 60);
  time.set(starsNode, 'opacity', [0, 0, 0, 0.35, 1]);
  const twinkleDur = 300;
  s.loopLayer('stars twinkle', s.anim({ name: 'stars twinkle', duration: twinkleDur, loop: 'loop', tracks: starIds.flatMap((id, i) => {
    const k = starSpots[i][2];
    const fn = (t) => k * (0.85 + 0.25 * Math.max(0, Math.sin((t * 2 + i * 0.37) * TAU)) ** 3);
    return [sampled(id, 'scaleX', twinkleDur, 25, fn), sampled(id, 'scaleY', twinkleDur, 25, fn)];
  }) }));

  // ===== sun: position, colour and presence follow the hour
  const sunPos = ids.next(), sunTurn = ids.next(), sunShine = ids.next(), hitSun = ids.next();
  const sunPen = intro.pens(44, 3, 16);
  const sunPaint = paint(blobPts(25, 24, r, { n: 10, wobble: 0.08 }), C.ochre, r, { alpha: 0.75, off: [3, 3], wobble: 1.2 });
  const sunReveal = ids.next();
  add(group({ name: 'sun', x: 236, y: 64, id: sunPos }, [
    group({ name: 'sun shine', id: sunShine }, [
      group({ name: 'sun paint', id: sunReveal, opacity: 0 }, [sunPaint.xml]),
      group({ name: 'sun turn', id: sunTurn }, [boils.add({
        name: 'sun ink', seed: 3, draw: (rr) => {
          const rays = [];
          for (let i = 0; i < 9; i++) {
            const a = (i / 9) * TAU + rr.jit(0.06);
            rays.push(ink([P(Math.cos(a) * 32, Math.sin(a) * 32), P(Math.cos(a) * 41, Math.sin(a) * 41)], rr, { w: 1.6, amt: 0.6, fx: sunPen(1 + (i % 3)) }));
          }
          return [ink(blobPts(23, 23, rr, { n: 9, wobble: 0.04 }), rr, { closed: true, w: 1.8, amt: 0.5, fx: sunPen(0) }), ...rays];
        },
      })]),
    ]),
    hit(hitSun, 0, 0, 84, 84),
  ]));
  appear(intro, sunReveal, 58, 24);
  intro.key(sunPaint.grainId, 'opacity', [[0, 0, 'hold'], [80, 0], [140, 1]]);
  time.set(sunPos, 'x', [170, 236, 318, 338, 338]);
  time.set(sunPos, 'y', [104, 62, 112, 176, 200]);
  time.set(sunPos, 'opacity', [1, 1, 1, 0.5, 0]);
  time.colors(sunPaint.colors, ['EDC860', 'D9A93F', 'E68A36', 'D9614A', 'D9614A']);
  s.loopLayer('sun turn', s.anim({ name: 'sun turn', duration: 4800, loop: 'loop', tracks: [{ object: sunTurn, prop: 'rotation', keys: [[0, 0, 'linear'], [4800, TAU]] }] }));

  // ===== clouds
  const clouds = [
    { x: 448, y: 78, w: 122, h: 34, seed: 5, dx: 22, dur: 960, at: 70 },
    { x: 668, y: 44, w: 92, h: 26, seed: 8, dx: -18, dur: 1200, at: 84 },
  ];
  const cloudTargets = [];
  clouds.forEach((c, i) => {
    const id = ids.next();
    const cr = rng(c.seed);
    const base = cloudPts(c.w, c.h, cr);
    const pen = intro.pens(c.at, 0, 30);
    const p = wash(intro, base, C.grey, cr, { at: c.at + 14, alpha: 0.24, off: [4, 4], grain: 0.4 });
    cloudTargets.push(...p.colors);
    add(group({ name: `cloud${i}`, x: c.x, y: c.y, id }, [p.xml, boils.add({ name: `cloud${i} ink`, seed: c.seed + 1, draw: (rr) => ink(base, rr, { closed: true, w: 1.7, amt: 0.7, fx: pen(0) }) })]));
    s.loopLayer(`cloud${i} drift`, s.anim({ name: `cloud${i} drift`, duration: c.dur, loop: 'pingPong', tracks: [{ object: id, prop: 'x', keys: [[0, c.x, 'cubic', EASE.inOut], [c.dur, c.x + c.dx]] }] }));
  });
  time.colors(cloudTargets, ['A2B0C0', '8A97A6', 'C49C7C', 'BC8796', '58607E']);

  // ===== flying birds. Each crossing starts and ends off-canvas on its own
  // side, and between crossings the bird is held there invisible, so the loop
  // wraps with no return trip across the sky.
  const flyNode = ids.next();
  const flyDur = 1560; // 26 s
  const cross = 660;
  const flyers = [
    { y: 116, start: 380, scale: 1, seed: 31 },
    { y: 134, start: 424, scale: 0.74, seed: 37 },
  ];
  const flyTracks = [];
  const flyXml = flyers.map((f, i) => {
    const id = ids.next();
    const t0 = f.start, t1 = f.start + cross;
    const x = (fr) => -50 + ((fr - t0) / cross) * (W + 100);
    const y = (fr) => f.y + Math.sin((fr - t0) * 0.021 + i) * 8 - ((fr - t0) / cross) * 28;
    flyTracks.push(
      { object: id, prop: 'x', keys: [[0, -50, 'hold'], [t0, -50, 'linear'], [t1, W + 50, 'hold'], [flyDur, W + 50, 'hold']] },
      { object: id, prop: 'y', keys: window_(t0, t1, 22, y, flyDur) },
      { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [t0, 1, 'hold'], [t1, 0, 'hold'], [flyDur, 0, 'hold']] },
    );
    return group({ name: `flyer${i}`, x: -50, y: f.y, id, scaleX: f.scale, scaleY: f.scale, opacity: 0 }, [boils.add({
      name: `flyer${i}`, cels: 2, hold: 10, seed: f.seed, draw: (rr, cel) => {
        const up = cel === 0 ? -7 : 3;
        return ink([P(-12, up), P(-6, up * 0.4 - 3), P(0, 0), P(6, up * 0.4 - 3), P(12, up)], rr, { w: 1.6, amt: 0.3 });
      },
    })]);
  });
  add(group({ name: 'flyers', id: flyNode }, flyXml));
  s.loopLayer('flyers', s.anim({ name: 'flyers', duration: flyDur, loop: 'loop', tracks: flyTracks }));
  time.set(flyNode, 'opacity', [1, 1, 1, 0.7, 0]);

  // ===== far hill, pale and cool, for depth
  const far = [P(40, 276), P(120, 246), P(210, 232), P(300, 238), P(390, 256), P(470, 284)];
  add(wash(intro, [...far, P(470, 306), P(40, 306)], C.sky, r, { at: 50, alpha: 0.2, off: [0, 3], grain: 0.35 }).xml);
  const farPen = intro.pens(10, 0, 40);
  add(boils.add({ name: 'far ink', seed: 39, draw: (rr) => ink(far.slice(1, 5), rr, { w: 1.3, amt: 0.8, n: 10, color: 'FF5B6470', fx: farPen(0) }) }));

  // ===== the hill
  const ridge = [P(330, 324), P(380, 296), P(440, 256), P(520, 222), P(620, 206), P(720, 212), P(806, 234), P(868, 262)];
  const hill = wash(intro, [...ridge, P(878, 300), P(858, 324), P(600, 330), P(340, 328)], C.sap, r, { at: 60, alpha: 0.44, off: [0, 4], grain: 0.6 });
  const hillPatch = wash(intro, [P(500, 238), P(620, 220), P(740, 230), P(820, 260), P(840, 310), P(540, 320)], C.ochre, r, { at: 74, alpha: 0.2, off: [0, 0], grain: 0.35 });
  season.colors(hill.colors, ['A4C86A', '7FAF55', 'BBA14E', 'B9CBDC']);
  season.colors(hillPatch.colors, ['E2C760', 'D9A93F', 'C9733E', 'A8BBD0']);
  add(hill.xml, hillPatch.xml);
  // late light: a warm glaze over the hill that only golden hour (and a little dawn) brings out
  const goldNode = ids.next();
  add(group({ name: 'golden glaze', id: goldNode, opacity: 0 }, [
    wash(intro, [P(360, 300), P(450, 248), P(560, 214), P(700, 206), P(826, 248), P(846, 300), P(380, 322)], 'F0A84A', r, { at: 80, alpha: 0.3, off: [0, 0], grain: 0, rim: 0 }).xml,
  ]));
  time.set(goldNode, 'opacity', [0.3, 0, 1, 0.45, 0]);
  const ridgePen = intro.pens(16, 0, 46);
  add(boils.add({ name: 'ridge ink', seed: 41, draw: (rr) => ink(ridge.slice(2, 8), rr, { w: 2, amt: 1, n: 18, bleed: 0.14, fx: ridgePen(0) }) }));

  // ===== cast shadows, long in the late afternoon (the sun is always to the left)
  const hx = 520, hy = 226; // cottage walls, bottom-left
  const treeX = 694, treeBase = 216;
  const shadowsNode = ids.next();
  const shadowSpec = [
    { x: hx + 94, y: hy - 1, len: 64, th: 9, seed: 120, rot: 0.04 },
    { x: treeX + 6, y: treeBase + 1, len: 58, th: 8, seed: 121, rot: 0.2 },
    { x: 344, y: 306, len: 40, th: 5, seed: 122, rot: 0.02 },
  ];
  const shadowIds = shadowSpec.map(() => ids.next());
  add(group({ name: 'shadows', id: shadowsNode, opacity: 0 }, shadowSpec.map((sh, i) => {
    const sr = rng(sh.seed);
    const pts = [P(-4, -2), P(sh.len * 0.3, -sh.th * 0.3), P(sh.len * 0.75, -sh.th * 0.15), P(sh.len, sh.th * 0.2), P(sh.len * 0.7, sh.th * 0.75), P(sh.len * 0.25, sh.th * 0.8), P(-4, sh.th * 0.4)];
    return group({ name: 'shadow', x: sh.x, y: sh.y, rotation: sh.rot }, [group({ name: 'len', id: shadowIds[i] }, [paint(pts, C.shadow, sr, { alpha: 0.42, off: [0, 0], wobble: 1.2, grain: 0, rim: 0 }).xml])]);
  })));
  appear(intro, shadowsNode, 130, 40);
  // the reveal keys the outer node; the hour keys an inner one
  const shadowLen = [[1.5, 1.4, 1.2], [0.55, 0.5, 0.5], [2.6, 2.4, 2.1], [3.2, 3, 2.6], [1, 1, 1]];
  shadowIds.forEach((id, i) => time.set(id, 'scaleX', shadowLen.map((row) => row[i])));
  shadowIds.forEach((id) => time.set(id, 'opacity', [0.5, 0.42, 0.75, 0.3, 0]));

  // ===== garden path from the door down the hill
  const pathL = [P(hx + 20, hy + 2), P(hx + 6, hy + 26), P(hx - 30, hy + 52), P(hx - 70, hy + 76), P(hx - 96, hy + 92)];
  const pathR = [P(hx + 34, hy + 2), P(hx + 28, hy + 28), P(hx - 2, hy + 56), P(hx - 34, hy + 80), P(hx - 50, hy + 94)];
  add(wash(intro, [...pathL, ...pathR.slice().reverse()], C.ochre, r, { at: 98, alpha: 0.34, off: [1, 1], wobble: 1.5, grain: 0.6 }).xml);
  const pathPen = intro.pens(88, 8, 26);
  add(boils.add({ name: 'path ink', seed: 44, draw: (rr) => [
    ink(pathL.slice(1, 4), rr, { w: 1.2, amt: 0.6, color: 'FF4A4642', fx: pathPen(0) }),
    ink(pathR.slice(1, 4), rr, { w: 1.2, amt: 0.6, color: 'FF4A4642', fx: pathPen(1) }),
  ] }));

  // ===== tree
  const trunk = [P(treeX - 4, treeBase), P(treeX - 2, treeBase - 30), P(treeX + 1, treeBase - 58)];
  const trunk2 = [P(treeX + 6, treeBase), P(treeX + 6, treeBase - 32), P(treeX + 9, treeBase - 56)];
  add(wash(intro, [...trunk, ...trunk2.slice().reverse()], C.terra, r, { at: 96, alpha: 0.4, off: [2, 1], grain: 0.3, rim: 0.3 }).xml);
  const trunkPen = intro.pens(56, 5, 22);
  add(boils.add({ name: 'trunk ink', seed: 43, draw: (rr) => [ink(trunk, rr, { w: 1.9, amt: 0.5, fx: trunkPen(0) }), ink(trunk2, rr, { w: 1.9, amt: 0.5, fx: trunkPen(1) })] }));

  // bare branches: always there, showing through the leaves as they thin;
  // the whole drawing in winter
  const branchesNode = ids.next();
  const twigs = [
    [P(treeX + 1, treeBase - 56), P(treeX - 14, treeBase - 78), P(treeX - 30, treeBase - 94)],
    [P(treeX - 14, treeBase - 78), P(treeX - 16, treeBase - 98)],
    [P(treeX + 4, treeBase - 58), P(treeX + 6, treeBase - 88), P(treeX + 2, treeBase - 112)],
    [P(treeX + 6, treeBase - 86), P(treeX + 20, treeBase - 104)],
    [P(treeX + 8, treeBase - 56), P(treeX + 26, treeBase - 74), P(treeX + 42, treeBase - 84)],
    [P(treeX + 26, treeBase - 74), P(treeX + 32, treeBase - 96)],
    [P(treeX - 30, treeBase - 94), P(treeX - 40, treeBase - 98)],
    [P(treeX + 42, treeBase - 84), P(treeX + 50, treeBase - 80)],
  ];
  const branchPen = intro.pens(72, 4, 18);
  add(group({ name: 'branches', id: branchesNode, opacity: 0.3 }, [boils.add({
    name: 'branch ink', seed: 46, draw: (rr) => twigs.map((t, i) => ink(t, rr, { w: i < 6 ? 1.5 : 1.1, amt: 0.45, fx: branchPen(i % 4) })),
  })]));
  season.set(branchesNode, 'opacity', [0.32, 0.18, 0.55, 1]);

  // canopy pivots near the trunk top so a rustle sways it
  const canopySeason = ids.next(), canopyBreathe = ids.next(), canopyRustle = ids.next();
  const cx = 4, cy = -46;
  const crown = scallop(cx, cy, 52, rng(47), { bumps: 8, depth: 0.13, squash: 0.86 });
  const crownPen = intro.pens(70, 10, 34);
  const crownMain = wash(intro, crown, C.leaf, rng(49), { at: 112, alpha: 0.56, off: [-4, 4], grain: 0.7 });
  const crownWarm = wash(intro, scallop(cx - 12, cy + 12, 26, rng(50), { bumps: 5 }), C.ochre, rng(51), { at: 124, alpha: 0.24, off: [0, 0], grain: 0.3 });
  season.colors(crownMain.colors, ['9CC266', '5F9447', 'D88C38', '8A97A6']);
  season.colors(crownWarm.colors, ['E39AAE', 'D9A93F', 'C8643B', 'A9BCD0']);
  // spring blossom: a scatter of pink dabs
  const blossomNode = ids.next(), blossomSeason = ids.next();
  const br = rng(52);
  const blossoms = [];
  for (let i = 0; i < 13; i++) {
    const a = br.range(0, TAU), d = Math.sqrt(br()) * 42;
    const bx = cx + Math.cos(a) * d, by = cy + Math.sin(a) * d * 0.8;
    blossoms.push(paint(blobPts(3.4, 3, br, { n: 7, wobble: 0.2 }).map((p) => P(p.x + bx, p.y + by)), i % 3 ? 'F0A9BC' : 'F6C9D4', br, { alpha: 0.8, off: [0, 0], wobble: 0.4, grain: 0, rim: 0.5 }).xml);
  }
  const crownInk = boils.add({
    name: 'crown ink', seed: 48, draw: (rr) => {
      // shading: short hatching on the shadow side, low right
      const hatch = [];
      for (let k = 0; k < 5; k++) {
        const a = 0.25 + k * 0.22;
        const px = cx + Math.cos(a) * 34, py = cy + Math.sin(a) * 30;
        hatch.push(ink([P(px - 4, py + 4), P(px + 4, py - 4)], rr, { w: 1.1, amt: 0.3, fx: crownPen(1) }));
      }
      return [ink(crown, rr, { closed: true, w: 2, amt: 0.7, bleed: 0.12, fx: crownPen(0) }), ...hatch];
    },
  });
  add(group({ name: 'canopy season', id: canopySeason }, [
    group({ name: 'canopy', x: treeX + 6, y: treeBase - 60, id: canopyBreathe }, [
      group({ name: 'rustle', id: canopyRustle }, [
        crownMain.xml, crownWarm.xml,
        group({ name: 'blossom season', id: blossomSeason, opacity: 0 }, [group({ name: 'blossom', id: blossomNode, opacity: 0 }, blossoms)]),
        crownInk,
      ]),
    ]),
  ]));
  appear(intro, blossomNode, 150, 50);
  season.set(blossomSeason, 'opacity', [1, 0, 0, 0]);
  season.set(canopySeason, 'opacity', [1, 1, 1, 0]);
  s.loopLayer('canopy breathe', s.anim({ name: 'canopy breathe', duration: 300, loop: 'pingPong', tracks: [
    { object: canopyBreathe, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [300, 1.022]] },
    { object: canopyBreathe, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [300, 1.032]] },
  ] }));

  // ===== cottage
  const walls = [P(hx, hy), P(hx + 1, hy - 48), P(hx + 94, hy - 50), P(hx + 95, hy - 1)];
  const roof = [P(hx - 12, hy - 46), P(hx + 28, hy - 90), P(hx + 76, hy - 92), P(hx + 108, hy - 48)];
  const chimney = [P(hx + 66, hy - 91), P(hx + 66, hy - 110), P(hx + 79, hy - 110), P(hx + 79, hy - 90)];
  const door = [P(hx + 18, hy), P(hx + 18, hy - 27), P(hx + 21, hy - 33), P(hx + 26, hy - 35), P(hx + 31, hy - 33), P(hx + 34, hy - 27), P(hx + 34, hy)];
  const win = [P(hx + 52, hy - 20), P(hx + 52, hy - 37), P(hx + 76, hy - 37), P(hx + 76, hy - 20)];
  const box = [P(hx + 49, hy - 19), P(hx + 79, hy - 19), P(hx + 77, hy - 13), P(hx + 51, hy - 13)];
  add(wash(intro, walls, C.cream, r, { at: 92, alpha: 0.62, off: [4, 2], grain: 0.5 }).xml);
  add(wash(intro, roof, C.terra, r, { at: 100, alpha: 0.62, off: [-3, 3], grain: 0.7 }).xml);
  add(wash(intro, chimney, C.terra, r, { at: 104, alpha: 0.52, off: [2, 1], wobble: 1, grain: 0.4 }).xml);
  add(wash(intro, door, C.sky, r, { at: 106, alpha: 0.58, off: [2, 2], wobble: 1, grain: 0.3 }).xml);
  add(wash(intro, win, C.sky, rng(61), { at: 110, alpha: 0.3, off: [2, 1], wobble: 0.8, grain: 0.2 }).xml);
  add(wash(intro, box, C.leaf, rng(62), { at: 118, alpha: 0.5, off: [1, 1], wobble: 0.5, grain: 0, rim: 0.4 }).xml);
  // window-box flowers
  [[hx + 55, C.rose], [hx + 62, C.lamp], [hx + 69, C.rose], [hx + 75, C.violet]].forEach(([fx, col], i) => {
    const fr = rng(63 + i);
    add(wash(intro, blobPts(3.2, 2.8, fr, { n: 7, wobble: 0.2 }).map((p) => P(p.x + fx, p.y + hy - 22)), col, fr, { at: 140 + i * 5, alpha: 0.9, off: [0, 0], wobble: 0.3, grain: 0, rim: 0.4 }).xml);
  });

  // winter: a cap of snow on the roof and chimney (paper-white, normal blend)
  const snowCapNode = ids.next();
  const capTop = [P(hx - 13, hy - 47), P(hx + 27, hy - 91), P(hx + 77, hy - 93), P(hx + 109, hy - 49)];
  const capBot = [P(hx + 100, hy - 50), P(hx + 86, hy - 66), P(hx + 74, hy - 72), P(hx + 50, hy - 76), P(hx + 30, hy - 74), P(hx + 14, hy - 62), P(hx - 4, hy - 50)];
  const capShape = [...resample(capTop, 12), ...capBot];
  const chimCap = [P(hx + 64, hy - 111), P(hx + 72, hy - 115), P(hx + 81, hy - 111), P(hx + 79, hy - 107), P(hx + 66, hy - 107)];
  const snowFill = (pts) => el('Shape', { name: 'snow' }, [pathXml(pts, { closed: true }), fill('FFFCFAF5'), stroke(argb(C.snowInk, 0.7), 1.2)]);
  add(group({ name: 'roof snow', id: snowCapNode, opacity: 0 }, [snowFill(capShape), snowFill(chimCap)]));
  season.set(snowCapNode, 'opacity', [0, 0, 0, 1]);

  // the lamp: lit by evening, and by a click any time
  const nightGlow = ids.next(), lampGlow = ids.next();
  const glowXml = (id) => group({ name: 'window glow', id, opacity: 0 }, [
    softDisc({ x: hx + 64, y: hy - 28, r: 34, sy: 0.8, color: 'F6C34E', alpha: 0.42 }).xml,
    paint(win, C.lamp, rng(60), { alpha: 0.95, off: [1, 1], wobble: 0.8, grain: 0.3, rim: 0.5 }).xml,
  ]);
  const housePen = intro.pens(34, 6, 20);
  const cottageInk = boils.add({
    name: 'cottage ink', seed: 63, draw: (rr) => [
      ink(walls, rr, { w: 2, amt: 0.6, bleed: 0.12, fx: housePen(0) }),
      ink(roof, rr, { w: 2.1, amt: 0.6, bleed: 0.12, fx: housePen(1) }),
      ink([P(hx + 22, hy - 78), P(hx + 38, hy - 62)], rr, { w: 1.1, amt: 0.5, fx: housePen(2) }),
      ink([P(hx + 44, hy - 84), P(hx + 62, hy - 66)], rr, { w: 1.1, amt: 0.5, fx: housePen(2) }),
      ink([P(hx + 70, hy - 86), P(hx + 84, hy - 72)], rr, { w: 1.1, amt: 0.5, fx: housePen(3) }),
      ink(chimney, rr, { w: 1.8, amt: 0.4, fx: housePen(3) }),
      ink(door, rr, { w: 1.7, amt: 0.4, fx: housePen(4) }),
      stippleShape({ dots: [{ x: hx + 30, y: hy - 14, r: 1.2 }], color: INK }),
      ink(win, rr, { w: 1.6, amt: 0.4, closed: true, fx: housePen(5) }),
      ink([P(hx + 64, hy - 37), P(hx + 64, hy - 20)], rr, { w: 1.1, amt: 0.3, fx: housePen(6) }),
      ink([P(hx + 52, hy - 28), P(hx + 76, hy - 28)], rr, { w: 1.1, amt: 0.3, fx: housePen(6) }),
      ink(box, rr, { w: 1.2, amt: 0.3, closed: true, fx: housePen(7) }),
      ink([P(hx + 14, hy + 2), P(hx + 38, hy + 2)], rr, { w: 1.3, amt: 0.4, fx: housePen(7) }),
    ],
  });
  add(cottageInk);

  // woodpile against the right wall
  const logs = [[hx + 104, hy - 4], [hx + 115, hy - 4], [hx + 126, hy - 4], [hx + 110, hy - 13], [hx + 121, hy - 13], [hx + 115, hy - 22]];
  add(wash(intro, [P(hx + 98, hy + 1), P(hx + 132, hy + 1), P(hx + 130, hy - 18), P(hx + 116, hy - 28), P(hx + 102, hy - 18)], C.terra, rng(66), { at: 128, alpha: 0.36, off: [1, 1], wobble: 0.8, grain: 0.5, rim: 0.3 }).xml);
  const logPen = intro.pens(108, 3, 12);
  add(boils.add({ name: 'log ink', seed: 67, draw: (rr) => logs.map(([lx, ly], i) => ink(blobPts(5, 4.6, rr, { n: 7, wobble: 0.1 }).map((p) => P(p.x + lx, p.y + ly)), rr, { closed: true, w: 1.3, amt: 0.3, fx: logPen(i) })) }));
  const logSnow = ids.next();
  add(group({ name: 'log snow', id: logSnow, opacity: 0 }, [snowFill([P(hx + 99, hy - 17), P(hx + 108, hy - 23), P(hx + 115, hy - 29), P(hx + 124, hy - 24), P(hx + 132, hy - 17), P(hx + 122, hy - 19), P(hx + 110, hy - 19)])]));
  season.set(logSnow, 'opacity', [0, 0, 0, 1]);

  // chimney smoke, which starts last
  const smokeNode = ids.next();
  const smokeDur = 400;
  const smokeTracks = [];
  const smokeXml = [];
  for (let i = 0; i < 3; i++) {
    const id = ids.next();
    smokeXml.push(group({ name: `smoke${i}`, x: hx + 73, y: hy - 114, id, opacity: 0 }, [boils.add({
      name: `smoke${i}`, seed: 70 + i, draw: (rr) => {
        const pts = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(P(Math.sin(t * 5.5) * (5 + t * 4), -t * 22)); }
        return ink(pts, rr, { w: 1.4, amt: 0.6, color: 'FF4A4642' });
      },
    })]));
    const at = (t) => (t + i / 3) % 1;
    smokeTracks.push(
      sampled(id, 'y', smokeDur, 10, (t) => hy - 114 - at(t) * 72),
      sampled(id, 'x', smokeDur, 10, (t) => hx + 73 + at(t) * 28 + Math.sin(at(t) * 6) * 4),
      sampled(id, 'opacity', smokeDur, 10, (t) => { const u = at(t); return u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85); }),
      sampled(id, 'scaleX', smokeDur, 10, (t) => 0.6 + at(t) * 0.8),
      sampled(id, 'scaleY', smokeDur, 10, (t) => 0.6 + at(t) * 0.8),
    );
  }
  add(group({ name: 'smoke', id: smokeNode, opacity: 0 }, smokeXml));
  appear(intro, smokeNode, 190, 60);
  s.loopLayer('smoke', s.anim({ name: 'smoke', duration: smokeDur, loop: 'loop', tracks: smokeTracks }));

  // ===== foreground ground
  const ground = wash(intro, [P(20, 306), P(200, 294), P(420, 302), P(640, 292), P(862, 302), P(868, 332), P(620, 340), P(380, 334), P(140, 342), P(16, 332)], C.sap, r, { at: 68, alpha: 0.5, off: [0, 0], grain: 0.7 });
  const gPatchA = wash(intro, [P(90, 310), P(260, 304), P(330, 318), P(180, 328), P(80, 324)], C.ochre, r, { at: 82, alpha: 0.34, off: [0, 0], grain: 0.5 });
  const gPatchB = wash(intro, [P(560, 306), P(720, 300), P(780, 316), P(620, 324)], C.ochre, r, { at: 88, alpha: 0.3, off: [0, 0], grain: 0.5 });
  season.colors(ground.colors, ['98C063', '6E9F4E', 'B39446', 'C2D1DF']);
  season.colors([...gPatchA.colors, ...gPatchB.colors], ['E2C760', 'D9A93F', 'C8643B', 'A9BCD0']);
  add(ground.xml, gPatchA.xml, gPatchB.xml);
  const dashSpec = [];
  for (let x = 34; x < 848;) {
    const len = r.range(18, 64);
    dashSpec.push({ x, y: r.range(312, 326), len });
    x += len + r.range(12, 38);
  }
  const groundPen = intro.pens(2, 4, 16);
  const tufts = [70, 236, 410, 498, 664, 812];
  add(boils.add({
    name: 'ground ink', seed: 80, draw: (rr) => {
      const out = dashSpec.map((d, i) => ink([P(d.x, d.y), P(d.x + d.len / 2, d.y + rr.jit(1.2)), P(d.x + d.len, d.y + rr.jit(1.5))], rr, { w: 2.2, amt: 0.5, fx: groundPen(Math.floor(i / 2)) }));
      tufts.forEach((gx, i) => {
        const fx = groundPen(Math.round((gx / 870) * (dashSpec.length / 2)) + 1);
        out.push(ink([P(gx, 307), P(gx - 4, 298)], rr, { w: 1.2, amt: 0.4, fx }));
        out.push(ink([P(gx + 2, 307), P(gx + 2, 296)], rr, { w: 1.2, amt: 0.4, fx }));
        out.push(ink([P(gx + 4, 307), P(gx + 8, 300)], rr, { w: 1.2, amt: 0.4, fx }));
        void i;
      });
      return out;
    },
  }));

  // flowers in the grass, fewest in autumn and gone under winter snow
  const flowersNode = ids.next();
  const flowerSpec = [[118, 302, C.rose], [262, 298, C.violet], [380, 304, C.lamp], [470, 300, C.rose], [612, 296, C.violet], [740, 298, C.lamp], [846, 299, C.rose]];
  add(group({ name: 'flowers', id: flowersNode }, flowerSpec.flatMap(([fx, fy, col], i) => {
    const fr = rng(90 + i);
    return [
      wash(intro, blobPts(5, 4.5, fr, { n: 7, wobble: 0.2 }).map((p) => P(p.x + fx, p.y + fy - 10)), col, fr, { at: 142 + i * 6, alpha: 0.85, off: [0, 0], wobble: 0.5, grain: 0, rim: 0.4 }).xml,
      ink([P(fx, fy + 4), P(fx + fr.jit(1), fy - 4)], fr, { w: 1.2, amt: 0.2, fx: intro.trim(132 + i * 6, 10) }),
    ];
  })));
  season.set(flowersNode, 'opacity', [1, 1, 0.35, 0]);

  // ===== fence, with the perched bird (and, for returning visitors, a friend)
  const posts = [196, 244, 292, 340];
  add(wash(intro, [P(192, 276), P(344, 274), P(344, 302), P(192, 304)], C.ochre, r, { at: 96, alpha: 0.12, off: [2, 2], grain: 0.2, rim: 0.2 }).xml);
  const fencePen = intro.pens(30, 5, 16);
  add(boils.add({
    name: 'fence ink', seed: 100, draw: (rr) => [
      ...posts.map((px, i) => ink([P(px, 310), P(px + rr.jit(1), 266)], rr, { w: 2.1, amt: 0.5, fx: fencePen(i) })),
      ink([P(188, 278), P(270, 280), P(350, 276)], rr, { w: 1.7, amt: 0.6, fx: fencePen(4) }),
      ink([P(190, 294), P(270, 296), P(348, 293)], rr, { w: 1.7, amt: 0.6, fx: fencePen(5) }),
    ],
  }));
  const fenceSnow = ids.next();
  add(group({ name: 'fence snow', id: fenceSnow, opacity: 0 }, posts.map((px) => snowFill([P(px - 4, 266), P(px - 2, 261), P(px + 3, 260), P(px + 5, 266)]))));
  season.set(fenceSnow, 'opacity', [0, 0, 0, 1]);

  // the bird lands at the end of the intro
  const birdLand = ids.next(), birdHop = ids.next();
  const birdPen = intro.pens(150, 6, 14);
  add(group({ name: 'perched bird', x: 340, y: 262, id: birdLand, opacity: 0 }, [
    group({ name: 'hop', id: birdHop, scaleX: 1.25, scaleY: 1.25 }, birdXml(boils, intro, { seed: 110, pen: birdPen })),
  ]));
  intro.key(birdLand, 'opacity', [[0, 0, 'hold'], [146, 0, 'linear'], [156, 1]]);
  intro.key(birdLand, 'x', [[0, 392, 'hold'], [146, 392, 'cubic', EASE.out], [178, 340]]);
  intro.key(birdLand, 'y', [[0, 214, 'hold'], [146, 214, 'cubic', [0.3, 0, 0.6, 1]], [172, 266, 'cubic', EASE.out], [184, 262]]);

  const friendOn = ids.next(), friendLand = ids.next();
  const friendPen = intro.pens(168, 6, 14);
  add(group({ name: 'friend', x: 196, y: 262, id: friendLand, opacity: 0 }, [
    group({ name: 'friend on', id: friendOn, opacity: FRIEND0 ? 1 : 0, scaleX: -1.1, scaleY: 1.1 }, birdXml(boils, intro, { seed: 114, pen: friendPen })),
  ]));
  intro.key(friendLand, 'opacity', [[0, 0, 'hold'], [168, 0, 'linear'], [178, 1]]);
  intro.key(friendLand, 'x', [[0, 150, 'hold'], [168, 150, 'cubic', EASE.out], [200, 196]]);
  intro.key(friendLand, 'y', [[0, 220, 'hold'], [168, 220, 'cubic', [0.3, 0, 0.6, 1]], [194, 266, 'cubic', EASE.out], [206, 262]]);

  // ===== night: a cool veil over everything below the lights
  const veilNode = ids.next();
  const veilIn = ids.next();
  add(group({ name: 'veil in', id: veilIn, opacity: 0 }, [group({ name: 'night veil', id: veilNode, opacity: 0 }, [
    softDisc({ x: 450, y: 168, r: 430, sy: 0.38, color: '3E4A84', alpha: 0.46, blend: 'multiply' }).xml,
  ])]));
  appear(intro, veilIn, 10, 80);
  time.set(veilNode, 'opacity', [0, 0, 0, 0.55, 1]);

  // the lit window sits above the veil
  const litIn = ids.next();
  add(group({ name: 'lit in', id: litIn, opacity: 0 }, [glowXml(nightGlow)]), glowXml(lampGlow));
  appear(intro, litIn, 176, 24);
  time.set(nightGlow, 'opacity', [0, 0, 0, 0.85, 1]);

  // ===== summer-night fireflies (season wrapper x hour wrapper)
  const flySeason = ids.next(), flyHour = ids.next();
  const ffSpots = [[150, 270], [262, 248], [392, 280], [470, 258], [610, 268], [800, 262]];
  const ffIds = ffSpots.map(() => ids.next());
  add(group({ name: 'fireflies', id: flySeason, opacity: 0 }, [group({ name: 'at night', id: flyHour, opacity: 0 }, ffSpots.map(([x, y], i) => group({ name: 'firefly', x, y, id: ffIds[i] }, [
    softDisc({ r: 7, color: 'EEF29A', alpha: 0.9 }).xml,
    softDisc({ r: 2, color: 'FFFBE0', alpha: 1 }).xml,
  ])))]));
  season.set(flySeason, 'opacity', [0.5, 1, 0, 0]);
  time.set(flyHour, 'opacity', [0, 0, 0, 0.6, 1]);
  const ffDur = 480;
  s.loopLayer('fireflies', s.anim({ name: 'fireflies', duration: ffDur, loop: 'loop', tracks: ffIds.flatMap((id, i) => {
    const [x0, y0] = ffSpots[i];
    const ph = i * 1.7;
    return [
      sampled(id, 'x', ffDur, 24, (t) => x0 + Math.sin(t * TAU + ph) * 16),
      sampled(id, 'y', ffDur, 24, (t) => y0 + Math.sin(t * TAU * 2 + ph) * 7),
      sampled(id, 'opacity', ffDur, 24, (t) => Math.max(0, Math.sin(t * TAU * 3 + ph)) ** 1.5),
    ];
  }) }));

  // ===== winter: a light flurry, two tiles of flakes sliding down forever
  const snowNode = ids.next(), snowFall = ids.next(), snowSway = ids.next();
  const sr = rng(140);
  const tile = (oy) => {
    const out = [];
    for (let i = 0; i < 11; i++) {
      const fx = sr.range(20, W - 20), fy = sr.range(0, H) + oy, fr = sr.range(1.4, 2.4);
      out.push(el('Shape', { name: 'flake', x: fx, y: fy }, [el('Ellipse', { width: fr * 2, height: fr * 2, originX: 0.5, originY: 0.5, name: 'E' }), fill('FFFFFFFF'), stroke(argb(C.snowInk, 0.85), 0.9)]));
    }
    return out;
  };
  add(group({ name: 'snowfall', id: snowNode, opacity: 0 }, [group({ name: 'sway', id: snowSway }, [group({ name: 'fall', id: snowFall }, [...tile(0), ...tile(-H)])])]));
  season.set(snowNode, 'opacity', [0, 0, 0, 1]);
  appear(intro, snowSway, 120, 60);
  s.loopLayer('snow fall', s.anim({ name: 'snow fall', duration: 1500, loop: 'loop', tracks: [{ object: snowFall, prop: 'y', keys: [[0, 0, 'linear'], [1500, H]] }] }));
  s.loopLayer('snow sway', s.anim({ name: 'snow sway', duration: 260, loop: 'pingPong', tracks: [{ object: snowSway, prop: 'x', keys: [[0, -9, 'cubic', EASE.inOut], [260, 9]] }] }));

  // ===== drifting petals (spring) and leaves (autumn), now and then
  const driftNode = ids.next();
  const driftDur = 960;
  const drifters = [
    { x: 672, y: 150, start: 260, life: 250, dx: -70, seed: 170 },
    { x: 730, y: 140, start: 520, life: 270, dx: -96, seed: 171 },
    { x: 700, y: 176, start: 690, life: 240, dx: -54, seed: 172 },
  ];
  const leafShape = [P(-5, 0), P(-1, -3), P(5, 0), P(0, 3)];
  const driftTargets = [];
  const driftTracks = [];
  const driftXml = drifters.map((d) => {
    const id = ids.next();
    const p = paint(leafShape, C.terra, rng(d.seed), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.3, grain: 0, rim: 0.6 });
    driftTargets.push(...p.colors);
    const t0 = d.start, t1 = d.start + d.life;
    const u = (f) => (f - t0) / d.life;
    driftTracks.push(
      { object: id, prop: 'x', keys: window_(t0, t1, 16, (f) => d.x + u(f) * d.dx + Math.sin(u(f) * 9) * 12, driftDur) },
      { object: id, prop: 'y', keys: window_(t0, t1, 16, (f) => d.y + u(f) * (300 - d.y), driftDur) },
      { object: id, prop: 'rotation', keys: window_(t0, t1, 16, (f) => Math.sin(u(f) * 9) * 0.8, driftDur) },
      { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [t0, 0, 'linear'], [t0 + 14, 1, 'hold'], [t1 - 30, 1, 'linear'], [t1, 0, 'hold'], [driftDur, 0, 'hold']] },
    );
    return group({ name: 'drifter', x: d.x, y: d.y, id, opacity: 0 }, [p.xml, ink(leafShape, rng(d.seed + 9), { closed: true, w: 1, amt: 0.2 })]);
  });
  add(group({ name: 'drifters', id: driftNode, opacity: 0 }, driftXml));
  season.set(driftNode, 'opacity', [1, 0, 1, 0]);
  season.colors(driftTargets, ['EBA3B5', '6E9F4E', 'D27A32', 'DCE6EE']);
  s.loopLayer('drift', s.anim({ name: 'drift', duration: driftDur, loop: 'loop', tracks: driftTracks }));

  // the one a rustle shakes loose: a petal, a leaf, a leaf, or a clump of snow
  const dropId = ids.next();
  const dropPaint = paint(leafShape, C.leaf, rng(53), { alpha: 0.9, off: [0.5, 0.5], wobble: 0.3, grain: 0, rim: 0.6 });
  season.colors(dropPaint.colors, ['EBA3B5', '6E9F4E', 'D9862F', 'E4ECF3']);
  add(group({ name: 'falling leaf', x: treeX + 30, y: treeBase - 92, id: dropId, opacity: 0, scaleX: 1.2, scaleY: 1.2 }, [
    dropPaint.xml, ink(leafShape, rng(54), { closed: true, w: 1.1, amt: 0.2 }),
  ]));

  // ===== hit areas (transparent, on top)
  const hitHouse = ids.next(), hitTree = ids.next(), hitBird = ids.next(), hitMoon = ids.next();
  add(hit(hitHouse, hx + 46, hy - 50, 120, 104), hit(hitTree, treeX + 8, treeBase - 62, 110, 124), hit(hitBird, 340, 254, 40, 34), hit(hitMoon, 236, 66, 50, 50));

  // ===== state machine
  // the intro first, so its layer exists before anything mixes against it
  const calm = s.input('bool', 'calm', 0);
  const { intro: introId, settled } = intro.build();
  {
    const a = ids.next(), b = ids.next();
    s.layers.push(s._layer('intro', [
      el('AnyState', { x: 100, y: -140 }),
      el('ExitState', { x: 500, y: -140 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: SETTLED ? b : a })),
      el('AnimationState', { x: 200, y: 0, animationId: introId, id: a }, [
        el('StateTransition', { stateToId: b, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 }),
        el('StateTransition', { stateToId: b }, el('TransitionBoolCondition', { inputId: calm, opValue: 'equal' })),
      ]),
      el('AnimationState', { x: 400, y: 0, animationId: settled, id: b }),
    ]));
  }
  boils.build();
  const seasonIn = s.input('number', 'season', SEASON0);
  const timeIn = s.input('number', 'time', TIME0);
  season.build(s, seasonIn, 2400);
  time.build(s, timeIn, 2400);

  const friend = s.input('bool', 'friend', FRIEND0);
  s.boolLayer('friend', friend,
    s.anim({ name: 'friend away', duration: 1, tracks: [{ object: friendOn, prop: 'opacity', keys: [[0, 0]] }] }),
    s.anim({ name: 'friend here', duration: 1, tracks: [{ object: friendOn, prop: 'opacity', keys: [[0, 1]] }] }),
    { mixIn: 0, mixOut: 600 });

  const lamp = s.input('trigger', 'lamp');
  s.triggerLayer('lamp', lamp, s.anim({ name: 'lamp', duration: 420, tracks: [{ object: lampGlow, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [20, 1, 'hold'], [330, 1, 'cubic', EASE.inOut], [420, 0]] }] }), { fromAny: false });
  s.listen(hitHouse, 'click', [Scene.fire(lamp)]);

  const rustle = s.input('trigger', 'rustle');
  s.triggerLayer('rustle', rustle, s.anim({ name: 'rustle', duration: 160, tracks: [
    { object: canopyRustle, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [10, 0.05, 'cubic', EASE.inOut], [24, -0.035, 'cubic', EASE.inOut], [40, 0.018, 'cubic', EASE.inOut], [58, 0]] },
    { object: dropId, prop: 'opacity', keys: [[0, 0, 'linear'], [8, 1, 'hold'], [128, 1, 'linear'], [160, 0]] },
    sampled(dropId, 'y', 160, 10, (t) => treeBase - 92 + t * 112),
    sampled(dropId, 'x', 160, 10, (t) => treeX + 30 + Math.sin(t * 9) * 10 + t * 14),
    sampled(dropId, 'rotation', 160, 10, (t) => Math.sin(t * 9) * 0.7),
  ] }), { fromAny: false });
  s.listen(hitTree, 'enter', [Scene.fire(rustle)]);
  s.listen(hitTree, 'click', [Scene.fire(rustle)]);

  const hop = s.input('trigger', 'hop');
  s.triggerLayer('hop', hop, s.anim({ name: 'hop', duration: 54, tracks: [
    { object: birdHop, prop: 'y', keys: [[0, 0, 'cubic', EASE.out], [10, -18, 'cubic', EASE.in], [20, 0, 'linear'], [24, 0, 'cubic', EASE.out], [31, -9, 'cubic', EASE.in], [38, 0]] },
    { object: birdHop, prop: 'scaleY', keys: [[0, 1.02, 'cubic', EASE.out], [8, 1.35, 'linear'], [20, 1.07, 'cubic', EASE.out], [26, 1.3, 'linear'], [38, 1.12, 'cubic', EASE.out], [54, 1.25]] },
    { object: birdHop, prop: 'scaleX', keys: [[0, 1.38, 'cubic', EASE.out], [8, 1.19, 'linear'], [20, 1.35, 'cubic', EASE.out], [38, 1.31, 'cubic', EASE.out], [54, 1.25]] },
  ] }), { fromAny: false });
  s.listen(hitBird, 'enter', [Scene.fire(hop)]);
  s.listen(hitBird, 'click', [Scene.fire(hop)]);

  const shine = s.input('trigger', 'shine');
  s.triggerLayer('shine', shine, s.anim({ name: 'shine', duration: 70, tracks: [
    { object: sunShine, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [14, 1.16, 'cubic', EASE.inOut], [70, 1]] },
    { object: sunShine, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [14, 1.16, 'cubic', EASE.inOut], [70, 1]] },
  ] }), { fromAny: false });
  s.listen(hitSun, 'enter', [Scene.fire(shine)]);

  // hover the moon and it rocks, a little pleased with itself
  const nod = s.input('trigger', 'nod');
  s.triggerLayer('nod', nod, s.anim({ name: 'nod', duration: 90, tracks: [
    { object: moonInner, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [16, 0.22, 'cubic', EASE.inOut], [40, -0.12, 'cubic', EASE.inOut], [64, 0.05, 'cubic', EASE.inOut], [90, 0]] },
  ] }), { fromAny: false });
  s.listen(hitMoon, 'enter', [Scene.fire(nod)]);

  return s.toXml();
}

export default function () {
  ids = new Ids(10);
  return document(hero());
}
