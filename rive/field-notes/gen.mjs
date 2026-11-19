// Draft 17 · Field notes — a loose ink-and-watercolor vignette at the top of a
// naturalist's field journal: a lane, a hedgerow, a five-bar gate, an oak, and
// a cottage roof far off. No frame: the paint just stops, like it does in a
// sketchbook. One artboard, one canvas.
//
// The ink draws itself on and the washes bloom once at load (or snap straight
// to the end when the page asks for stillness). Two number inputs, set once by
// the page from the visitor's clock, pick a season (0 spring · 1 summer ·
// 2 autumn · 3 winter) and a time of day (0 morning · 1 midday · 2 late
// afternoon · 3 evening · 4 night). Each pose keys every property it touches,
// so changing state later cross-fades cleanly.
import { Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, stroke, solidId, document, EASE } from '../lib/ink.mjs';

const W = 760, H = 320;
const INK = 'FF2B2420'; // sepia-black, like an iron-gall pen
const HOLD = 9; // boil: frames per cel

const env = (k, d) => (process.env[k] != null && process.env[k] !== '' ? +process.env[k] : d);
const SEASON0 = env('FN_SEASON', 2);
const TIME0 = env('FN_TIME', 1);
const STILL0 = env('FN_STILL', 0);

const C = {
  sky: '8FBAD6', sand: 'C2A273', sap: '8DB360', leaf: '5E9446', ochre: 'D9A93F', terra: 'C8643B',
  rust: 'B5532E', rose: 'E6A0B4', lamp: 'F4C84A', grey: '8A97A6', haw: 'A8322A', snow: 'FFFFFF',
};

// ---------------------------------------------------------------- helpers

const hexA = (a) => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0').toUpperCase();
const group = (attrs, kids) => el('Node', attrs, [].concat(kids).filter(Boolean).reverse());
const centroid = (pts) => { const s = pts.reduce((a, p) => P(a.x + p.x, a.y + p.y), P(0, 0)); return P(s.x / pts.length, s.y / pts.length); };
const bbox = (pts) => { const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; };
const lerp = (a, b, t) => a + (b - a) * t;
const shift = (pts, dx, dy) => pts.map((p) => P(p.x + dx, p.y + dy));

function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (a.y > pt.y !== b.y > pt.y && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

// a scalloped line: resample, then push each point "up" by a bumpy amount
function bumpy(pts, n, amp, bumps, r) {
  const src = resample(pts, n);
  return src.map((p, i) => {
    const t = i / (n - 1);
    const a = typeof amp === 'function' ? amp(t) : amp;
    return P(p.x + r.jit(0.6), p.y - a * Math.abs(Math.sin(t * Math.PI * bumps)) + r.jit(0.8));
  });
}

function scallop(cx, cy, R, r, { n = 40, bumps = 8, depth = 0.12, squash = 1 } = {}) {
  const pts = [];
  const ph = r.range(0, TAU);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + depth * Math.abs(Math.sin(a * bumps * 0.5 + ph)) + r.jit(0.025);
    pts.push(P(cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k * squash));
  }
  return pts;
}

const dots = (list, color, name = 'dots') =>
  el('Shape', { name }, [...list.map((d) => el('Ellipse', { x: d.x, y: d.y, width: d.r * 2, height: (d.ry ?? d.r) * 2, originX: 0.5, originY: 0.5, name: 'd' })), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: color, name: 'C' }))]);

// ---------------------------------------------------------------- the scene

function hero(ids) {
  const s = new Scene(ids, { name: 'Hero', w: W, h: H, x: 0, y: 0, bg: process.env.FN_BG ? 'FFFBF7EE' : undefined });
  const id = () => ids.next();
  const r = rng(1119);

  // ---- pose registries: every pose keys the same list of properties
  const seasonT = [];
  const timeT = [];
  const bySeason = (object, prop, values, type = 'Double') => seasonT.push({ object, prop, type, values });
  const byTime = (object, prop, values, type = 'Double') => timeT.push({ object, prop, type, values });

  // ---- intro bookkeeping
  const intro = [];
  const done = [];
  const INTRO = 180;
  const drawOn = (trim, start, dur) => {
    intro.push({ object: trim, prop: 'end', keys: [[0, 0, 'hold'], [start, 0, 'cubic', [0.45, 0.05, 0.25, 1]], [start + dur, 1, 'hold'], [INTRO, 1]] });
    done.push({ object: trim, prop: 'end', keys: [[0, 1]] });
  };
  const inkFx = (name, start, dur) => {
    const fx = id(), trim = id();
    s.add(el('GroupEffect', { name: `${name} draw`, id: fx }, el('TrimPath', { start: 0, end: 0, modeValue: 'synchronized', id: trim, name: 'Trim' })));
    drawOn(trim, start, dur);
    return fx;
  };
  // a wash that blooms from where the brush landed, then settles
  const bloom = (name, kids, { start, dur = 60, at, from = 0.9 }) => {
    const nid = id();
    intro.push({ object: nid, prop: 'opacity', keys: [[0, 0, 'hold'], [start, 0, 'cubic', EASE.out], [start + dur * 0.6, 1, 'hold'], [INTRO, 1]] });
    for (const prop of ['scaleX', 'scaleY'])
      intro.push({ object: nid, prop, keys: [[0, from, 'hold'], [start, from, 'cubic', EASE.out], [start + dur, 1.015, 'cubic', EASE.inOut], [start + dur + 30, 1, 'hold'], [INTRO, 1]] });
    done.push({ object: nid, prop: 'opacity', keys: [[0, 1]] }, { object: nid, prop: 'scaleX', keys: [[0, 1]] }, { object: nid, prop: 'scaleY', keys: [[0, 1]] });
    return el('Node', { name, id: nid, x: at.x, y: at.y, opacity: 0, scaleX: from, scaleY: from }, group({ name: `${name} body`, x: -at.x, y: -at.y }, kids));
  };

  // ---- ink: one Shape per call, any number of paths, all trimmed together
  const inkPaths = (paths, rr, { w = 1.6, amt = 0.6, color = INK, fx, ghost = 0.1, name = 'ink' } = {}) => {
    const xml = paths.map((p) => {
      const pts = p.n ? resample(p.pts, p.n) : p.pts;
      return pathXml(pts.map((q) => P(q.x + rr.jit(p.amt ?? amt), q.y + rr.jit(p.amt ?? amt))), { closed: p.closed, tension: p.tension ?? 1 });
    });
    const paints = [];
    if (ghost) paints.push(stroke(color.replace(/^../, hexA(ghost)), w * 2.4, { effect: fx }));
    paints.push(stroke(color, w, { effect: fx }));
    return el('Shape', { name }, [...xml, ...paints]);
  };

  // ---- boil: re-traced cels swapped by a Solo; every Solo shares one clock
  const boilTracks = [];
  const boil = (name, cels, draw, attrs = {}) => {
    const solo = id();
    const celIds = [];
    const kids = [];
    const rr = rng(name.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0);
    for (let i = 0; i < cels; i++) {
      const cid = id();
      celIds.push(cid);
      kids.push(el('Node', { name: `${name} ${i}`, id: cid }, [].concat(draw(rr.fork(), i)).reverse()));
    }
    boilTracks.push({ object: solo, prop: 'activeComponentId', type: 'Id', keys: [0, 1, 2].map((k) => [k * HOLD, celIds[k % cels], 'hold']) });
    return el('Solo', { name, activeComponentId: celIds[0], id: solo, ...attrs }, kids);
  };

  /**
   * Watercolor: a crisp glaze with a pooled darker rim (the way a wash dries),
   * a wet-in-wet bloom done with a radial gradient rather than a feather, and
   * granulation. `seasons` / `times` take a colour per pose to key it.
   */
  const wash = (pts, color, rr, o = {}) => {
    const { alpha = 0.5, off = [0, 0], wobble = 2, grain = 0.5, name = 'wash', wet = 0.8, rim = 0.5, seasons, times, specks = 0 } = o;
    const shape = pts.map((p) => P(p.x + off[0] + rr.jit(wobble), p.y + off[1] + rr.jit(wobble)));
    const c = centroid(shape);
    const [x0, x1, y0, y1] = bbox(shape);
    const wetPts = shape.map((p) => P(c.x + (p.x - c.x) * 0.8 + rr.jit(wobble * 1.6), c.y + (p.y - c.y) * 0.72 + rr.jit(wobble * 1.6)));
    const gc = P(c.x + rr.jit((x1 - x0) * 0.12), c.y + rr.jit((y1 - y0) * 0.12));
    const rad = Math.max(x1 - x0, y1 - y0) * 0.46;
    const keyed = seasons || times;
    const ids6 = keyed ? [id(), id(), id(), id(), id(), id()] : [];
    const cols = (col) => [argb(col, alpha * 0.66), argb(darken(col, 0.32), alpha * rim), argb(col, alpha * 0.6 * wet), argb(col, alpha * 0.36 * wet), argb(col, 0), argb(darken(col, 0.4), alpha * 0.5)];
    const base = cols(color);
    const grainDots = [];
    const want = Math.round((((x1 - x0) * (y1 - y0)) / 130) * grain);
    for (let i = 0, tries = 0; i < want && tries < want * 6; tries++) {
      const d = P(rr.range(x0, x1), rr.range(y0, y1));
      if (inside(d, shape)) { grainDots.push({ ...d, r: rr.range(0.35, 0.9) }); i++; }
    }
    for (let i = 0; i < specks; i++) {
      // dry-brush flecks just past the edge
      const p = shape[Math.floor(rr() * shape.length)];
      grainDots.push({ x: p.x + (p.x - c.x) * rr.range(0.03, 0.12), y: p.y + (p.y - c.y) * rr.range(0.03, 0.15), r: rr.range(0.5, 1.3) });
    }
    if (keyed) {
      const reg = seasons ? bySeason : byTime;
      const per = (seasons || times).map(cols);
      ids6.forEach((cid, k) => reg(cid, 'colorValue', per.map((p) => p[k]), 'Color'));
    }
    const kids = [
      el('Shape', { name: `${name} glaze`, blendModeValue: 'multiply' }, [
        pathXml(shape, { closed: true }),
        el('Fill', { name: 'Fill' }, solidId(base[0], ids6[0])),
        stroke(base[1], 1.1, { colorId: ids6[1] }),
      ]),
      el('Shape', { name: `${name} wet`, blendModeValue: 'multiply' }, [
        pathXml(wetPts, { closed: true }),
        el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: gc.x, startY: gc.y, endX: gc.x + rad, endY: gc.y, name: 'G' }, [
          el('GradientStop', { colorValue: base[2], position: 0, id: ids6[2] }),
          el('GradientStop', { colorValue: base[3], position: 0.55, id: ids6[3] }),
          el('GradientStop', { colorValue: base[4], position: 1, id: ids6[4] }),
        ])),
      ]),
    ];
    if (grainDots.length) {
      kids.push(el('Shape', { name: `${name} grain` }, [
        ...grainDots.map((d) => el('Ellipse', { x: d.x, y: d.y, width: d.r * 2, height: d.r * 2, originX: 0.5, originY: 0.5, name: 'd' })),
        el('Fill', { name: 'Fill' }, solidId(base[5], ids6[5])),
      ]));
    }
    return group({ name }, kids);
  };

  // seasonal / time-of-day dressing waits for the drawing under it to arrive
  const LATE = { 'hedge spring': 125, 'hedge summer': 125, 'hedge autumn': 125, 'hedge winter': 120, 'gate snow': 130, 'branch snow': 130, 'tree shadow': 110, 'gate shadow': 115, 'hedge shadow': 105, 'window glow': 120, mist: 100, smoke: 130 };
  const add0 = s.add.bind(s);
  s.add = (...xs) => add0(...xs.map((x) => {
    const m = /^<Node name="([^"]+)"/.exec(x);
    return m && LATE[m[1]] != null ? bloom(`${m[1]} in`, x, { start: LATE[m[1]], dur: 50, at: P(0, 0), from: 1 }) : x;
  }));

  // a soft round glow/glaze from a radial gradient: no feather needed
  const glow = (name, x, y, rx, ry, stops, { blend, gid, stopIds = [] } = {}) =>
    el('Node', { name, x, y, scaleY: ry / rx, id: gid }, el('Shape', { name: `${name} shape`, blendModeValue: blend }, [
      el('Ellipse', { width: rx * 2, height: rx * 2, originX: 0.5, originY: 0.5, name: 'E' }),
      el('Fill', { name: 'Fill' }, el('RadialGradient', { startX: 0, startY: 0, endX: rx, endY: 0, name: 'G' }, stops.map(([p, c], i) => el('GradientStop', { colorValue: c, position: p, id: stopIds[i] })))),
    ]));

  // ================================================================ geometry

  const laneL = [P(238, 312), P(290, 288), P(360, 250), P(410, 218), P(445, 192), P(463, 175)];
  const laneR = [P(552, 314), P(522, 290), P(490, 258), P(476, 228), P(473, 200), P(474, 176)];
  const hedgeTopBase = [P(22, 236), P(40, 214), P(80, 202), P(140, 194), P(210, 197), P(270, 198), P(320, 195), P(365, 190), P(405, 184), P(436, 179), P(459, 175)];
  const hedgeTop = bumpy(hedgeTopBase, 46, (t) => 10 - 8 * t, 15, rng(5));
  const hedgeBot = [P(460, 176), P(446, 190), P(414, 214), P(368, 244), P(322, 266), P(262, 280), P(180, 287), P(90, 291), P(34, 290), P(18, 262)];
  const farL = [P(40, 182), P(120, 165), P(210, 156), P(300, 160), P(380, 169), P(446, 177)];
  const farR = [P(472, 173), P(540, 161), P(612, 149), P(690, 145), P(754, 153)];
  const hx = 522, hb = 163; // distant cottage, left wall foot
  const tx = 668, tb = 236; // tree foot
  const gH = 520, gL = 612; // gate hinge and latch posts

  // ================================================================ sky

  // sky glaze, coloured by the hour
  const skyTimes = ['F3C29A', '8FBAD6', 'E9C27A', 'C27F9A', '2F3F74'];
  s.add(bloom('sky', [
    wash(blobPts(150, 34, rng(11), { n: 18, wobble: 0.3 }).map((p) => P(p.x + 210, p.y + 80)), C.sky, rng(12), { alpha: 0.28, grain: 0.15, wobble: 5, name: 'sky a', specks: 8, rim: 0.3, times: skyTimes }),
    wash(blobPts(110, 26, rng(13), { n: 16, wobble: 0.32 }).map((p) => P(p.x + 420, p.y + 50)), C.sky, rng(14), { alpha: 0.24, grain: 0.15, wobble: 5, name: 'sky b', specks: 6, rim: 0.3, times: skyTimes }),
    wash(blobPts(120, 30, rng(17), { n: 16, wobble: 0.3 }).map((p) => P(p.x + 600, p.y + 78)), C.sky, rng(18), { alpha: 0.26, grain: 0.15, wobble: 5, name: 'sky c', specks: 6, rim: 0.3, times: skyTimes }),
  ], { start: 26, dur: 80, at: P(386, 86) }));

  // the time-of-day glaze over everything, a soft radial wash (no feather)
  const tintStops = [id(), id(), id()];
  const tint = (col, a) => [argb(col, a), argb(col, a * 0.7), argb(col, 0)];
  const tints = [tint('F6CFA6', 0.12), tint('FFFFFF', 0), tint('EBB55E', 0.16), tint('B9789A', 0.26), tint('2E3F7A', 0.34)];
  tintStops.forEach((sid, k) => byTime(sid, 'colorValue', tints.map((t) => t[k]), 'Color'));

  // ---- sun, which travels with the hour, and the moon and a few stars
  const sunId = id();
  const skyFx = inkFx('sky', 60, 50);
  const sunInk = boil('sun ink', 3, (rr) => {
    const rays = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + rr.jit(0.08);
      rays.push({ pts: [P(Math.cos(a) * 18, Math.sin(a) * 18), P(Math.cos(a) * 24, Math.sin(a) * 24)], amt: 0.4 });
    }
    return inkPaths([{ pts: blobPts(13, 13, rr, { n: 9, wobble: 0.05 }), closed: true, amt: 0.4 }, ...rays], rr, { w: 1.3, fx: skyFx });
  });
  const sunWash = wash(blobPts(14, 14, rng(14), { n: 9, wobble: 0.07 }), C.ochre, rng(15), { alpha: 0.75, off: [2, 2], wobble: 0.8, grain: 0.4, times: ['F2C46B', 'EFC24A', 'E8A33C', 'E0703F', 'E0703F'] });
  const sunPos = [P(112, 126), P(300, 48), P(566, 78), P(461, 160), P(461, 186)];
  s.add(bloom('sun', group({ name: 'sun', id: sunId, x: sunPos[TIME0].x, y: sunPos[TIME0].y }, [sunWash, sunInk]), { start: 70, dur: 50, at: P(0, 0), from: 1 }));
  byTime(sunId, 'x', sunPos.map((p) => p.x));
  byTime(sunId, 'y', sunPos.map((p) => p.y));
  byTime(sunId, 'opacity', [1, 1, 1, 0.95, 0]);

  const moonId = id();
  const moonPts = [];
  for (let i = 0; i <= 12; i++) { const a = -2.1 + (i / 12) * 4.2; moonPts.push(P(Math.cos(a) * 12, Math.sin(a) * 12)); }
  for (let i = 0; i <= 10; i++) { const a = 1.75 - (i / 10) * 3.5; moonPts.push(P(-5 + Math.cos(a) * 10, Math.sin(a) * 10.5)); }
  s.add(bloom('moon wrap', group({ name: 'moon', id: moonId, x: 600, y: 58, opacity: TIME0 === 4 ? 1 : 0 }, [
    glow('moon glow', 0, 0, 40, 40, [[0, argb('F6EBC0', 0.35)], [0.5, argb('F6EBC0', 0.12)], [1, argb('F6EBC0', 0)]]),
    wash(moonPts, 'EFE2A8', rng(16), { alpha: 0.85, off: [1.5, 1], wobble: 0.5, grain: 0.3 }),
    boil('moon ink', 3, (rr) => inkPaths([{ pts: moonPts, closed: true, amt: 0.35 }], rr, { w: 1.3, fx: skyFx })),
  ]), { start: 70, dur: 50, at: P(0, 0), from: 1 }));
  byTime(moonId, 'opacity', [0, 0, 0, 0, 1]);

  const twinkle = [];
  const stars = [[452, 40, 1.1, [0, 0, 0, 1, 1]], [236, 52, 0.9, [0, 0, 0, 0, 1]], [712, 34, 0.8, [0, 0, 0, 0, 1]], [330, 88, 0.6, [0, 0, 0, 0, 0.9]]];
  const starNodes = stars.map(([sx, sy, sc, vis], i) => {
    const sid = id();
    const inner = id();
    byTime(sid, 'opacity', vis);
    twinkle.push(inner);
    return group({ name: `star${i}`, id: sid, x: sx, y: sy, opacity: vis[TIME0] }, group({ name: 'twinkle', id: inner, scaleX: sc, scaleY: sc }, [
      glow('star glow', 0, 0, 9, 9, [[0, argb(C.lamp, 0.5)], [1, argb(C.lamp, 0)]]),
      boil(`star${i} ink`, 2, (rr) => inkPaths([{ pts: [P(0, -6), P(0, 6)], amt: 0.3 }, { pts: [P(-5, 0), P(5, 0)], amt: 0.3 }, { pts: [P(-2.5, -2.5), P(2.5, 2.5)], amt: 0.2 }, { pts: [P(-2.5, 2.5), P(2.5, -2.5)], amt: 0.2 }], rr, { w: 1, ghost: 0.06, fx: skyFx })),
    ]));
  });
  s.add(bloom('stars', starNodes, { start: 110, dur: 50, at: P(0, 0), from: 1 }));

  // one small cloud drifting, ink-and-grey
  const cloudId = id();
  const cloudPts = (() => {
    const pts = [];
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      pts.push(P(-44 + t * 88, -14 * Math.sin(t * Math.PI) * (0.6 + 0.4 * Math.abs(Math.sin(t * Math.PI * 3)))));
    }
    for (let i = 1; i < 6; i++) pts.push(P(44 - (i / 6) * 88, 2.5 * Math.sin((i / 6) * Math.PI)));
    return pts;
  })();
  s.add(bloom('cloud wrap', group({ name: 'cloud', id: cloudId, x: 196, y: 78 }, [
    wash(cloudPts, C.grey, rng(21), { alpha: 0.26, off: [3, 3], grain: 0.4, times: ['C9A7A0', '8A97A6', 'A69A86', '9C7E92', '5A6386'] }),
    boil('cloud ink', 3, (rr) => inkPaths([{ pts: cloudPts.slice(0, 23), n: 16, amt: 0.6 }], rr, { w: 1.3, fx: skyFx })),
  ]), { start: 50, dur: 60, at: P(196, 78) }));
  byTime(cloudId, 'opacity', [1, 1, 1, 0.85, 0.45]);
  const cloudAnim = s.anim({ name: 'cloud drift', duration: 1400, loop: 'pingPong', tracks: [{ object: cloudId, prop: 'x', keys: [[0, 196, 'cubic', EASE.inOut], [1400, 236]] }] });

  // ================================================================ far distance

  const farFx = inkFx('far', 18, 60);
  s.add(bloom('far wash', [
    wash([...farL, P(446, 190), P(300, 196), P(120, 204), P(40, 200)], '8FA9BF', rng(30), { alpha: 0.22, grain: 0.3, rim: 0.12, wobble: 3, seasons: ['8FA9BF', '8FA9BF', '9FA3B5', 'A8B4C2'] }),
    wash([...farR.slice(0, 4), P(730, 150), P(720, 186), P(612, 190), P(472, 190)], '8FA9BF', rng(31), { alpha: 0.22, grain: 0.3, rim: 0.12, wobble: 3, seasons: ['8FA9BF', '8FA9BF', '9FA3B5', 'A8B4C2'] }),
    // copse beside the cottage
    wash(scallop(578, 150, 16, rng(32), { bumps: 5, squash: 0.62 }), '6E8F7A', rng(33), { alpha: 0.5, grain: 0.3, seasons: ['7FA37A', '5F8466', 'A0894E', '8A8F94'] }),
    wash(scallop(500, 160, 9, rng(34), { bumps: 4, squash: 0.7 }), '6E8F7A', rng(35), { alpha: 0.45, grain: 0.2, seasons: ['7FA37A', '5F8466', 'A0894E', '8A8F94'] }),
  ], { start: 40, dur: 70, at: P(380, 165) }));
  s.add(boil('far ink', 3, (rr) => inkPaths([
    { pts: farL.slice(1), n: 12, amt: 0.6 },
    { pts: farR.slice(0, 4), n: 10, amt: 0.6 },
  ], rr, { w: 1.1, color: 'FF6B6F78', ghost: 0.05, fx: farFx })));

  // ---- the cottage, far off: a roof, a chimney, a lit window at dusk
  const walls = [P(hx, hb), P(hx, hb - 12), P(hx + 26, hb - 13), P(hx + 27, hb)];
  const roof = [P(hx - 4, hb - 11), P(hx + 5, hb - 22), P(hx + 22, hb - 23), P(hx + 31, hb - 12)];
  const chimney = [P(hx + 18, hb - 22), P(hx + 18, hb - 30), P(hx + 23, hb - 30), P(hx + 23, hb - 23)];
  const win = [P(hx + 15, hb - 9), P(hx + 15, hb - 4), P(hx + 21, hb - 4), P(hx + 21, hb - 9)];
  const glowId = id();
  s.add(bloom('cottage paint', [
    wash(walls, 'E9D2A0', rng(40), { alpha: 0.6, off: [1.5, 1], wobble: 0.6, grain: 0.4, seasons: ['E9D2A0', 'E9D2A0', 'E9D2A0', 'E2D6C2'] }),
    wash([...roof, P(hx + 31, hb - 10), P(hx - 4, hb - 9)], C.terra, rng(41), { alpha: 0.62, off: [-1, 1], wobble: 0.6, grain: 0.5 }),
    wash(chimney, C.terra, rng(42), { alpha: 0.5, off: [0.6, 0.4], wobble: 0.3, grain: 0 }),
  ], { start: 70, dur: 50, at: P(hx + 13, hb - 12) }));
  s.add(group({ name: 'window glow', id: glowId, opacity: TIME0 >= 3 ? 1 : 0 }, [
    glow('window halo', hx + 18, hb - 6, 34, 30, [[0, argb('FFD866', 0.75)], [0.35, argb(C.lamp, 0.3)], [1, argb(C.lamp, 0)]]),
    el('Shape', { name: 'lit window' }, [pathXml(win, { closed: true }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb('F7D35E', 0.95), name: 'C' }))]),
  ]));
  byTime(glowId, 'opacity', [0, 0, 0, 1, 1]);
  const cotFx = inkFx('cottage', 34, 50);
  s.add(boil('cottage ink', 3, (rr) => inkPaths([
    { pts: walls, amt: 0.3 }, { pts: roof, amt: 0.35 }, { pts: chimney, amt: 0.25 },
    { pts: win, closed: true, amt: 0.2 }, { pts: [P(hx + 5, hb), P(hx + 5, hb - 6), P(hx + 9, hb - 6), P(hx + 9, hb)], amt: 0.2 },
  ], rr, { w: 1.1, fx: cotFx, ghost: 0.06 })));

  // chimney smoke: autumn and winter only
  const smokeIds = [];
  const smokeWrap = id();
  s.add(group({ name: 'smoke', id: smokeWrap, opacity: SEASON0 >= 2 ? 1 : 0 }, [0, 1].map((i) => {
    const sid = id();
    smokeIds.push(sid);
    return group({ name: `smoke${i}`, id: sid, x: hx + 20, y: hb - 32, opacity: 0 }, boil(`smoke${i} ink`, 2, (rr) => {
      const pts = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(P(Math.sin(t * 5.5) * (2.5 + t * 2.5), -t * 13)); }
      return inkPaths([{ pts, amt: 0.35 }], rr, { w: 0.9, color: 'FF6A625C', ghost: 0 });
    }));
  })));
  bySeason(smokeWrap, 'opacity', [0, 0, 1, 1]);
  const smokeDur = 420;
  const smokeTracks = [];
  smokeIds.forEach((sid, i) => {
    const ph = i / 2;
    const at = (f) => ((f / smokeDur) + ph) % 1;
    const keys = (fn) => { const k = []; for (let f = 0; f <= smokeDur; f += 20) k.push([f, fn(at(f)), 'linear']); return k; };
    smokeTracks.push(
      { object: sid, prop: 'y', keys: keys((u) => hb - 32 - u * 34) },
      { object: sid, prop: 'x', keys: keys((u) => hx + 20 + u * 16 + Math.sin(u * 6) * 2) },
      { object: sid, prop: 'opacity', keys: keys((u) => (u < 0.12 ? u / 0.12 : Math.max(0, 1 - (u - 0.12) / 0.88)) * 0.9) },
      { object: sid, prop: 'scaleX', keys: keys((u) => 0.7 + u * 0.9) },
      { object: sid, prop: 'scaleY', keys: keys((u) => 0.7 + u * 0.9) },
    );
  });

  // ================================================================ field, lane, verges

  const fieldPts = [P(476, 176), P(540, 168), P(620, 160), P(700, 157), P(738, 166), P(748, 210), P(736, 252), P(700, 258), P(600, 262), P(520, 266), P(490, 258), P(477, 228), P(473, 200)];
  const fieldSeasons = ['B5CF84', 'CDBF66', 'C9A866', 'C7D2D8'];
  s.add(bloom('field', [
    wash(fieldPts, 'B5CF84', rng(50), { alpha: 0.4, grain: 0.35, specks: 8, seasons: fieldSeasons }),
    // a few furrow strokes of darker colour
    wash([P(560, 196), P(680, 186), P(750, 190), P(744, 204), P(600, 214), P(540, 212)], '8DB360', rng(51), { alpha: 0.22, grain: 0.2, seasons: ['8DB360', 'B9A24C', 'B07F45', 'B4C3CC'] }),
  ], { start: 54, dur: 70, at: P(620, 214) }));

  const laneFill = [...laneL, ...laneR.slice().reverse()];
  s.add(bloom('lane', [
    wash(laneFill, C.sand, rng(52), { alpha: 0.42, grain: 0.7, specks: 12, seasons: ['C2A273', 'C9A877', 'B8946A', 'C9C2B6'] }),
    // the grass crown down the middle of the lane
    wash([P(388, 320), P(420, 280), P(450, 230), P(466, 186), P(469, 186), P(462, 230), P(440, 282), P(414, 320)], C.sap, rng(53), { alpha: 0.38, grain: 0.3, wobble: 1.4, seasons: ['8DB360', '7FA855', 'A39A55', 'C8D0D2'] }),
  ], { start: 40, dur: 70, at: P(400, 280) }));

  // morning: the hedge throws its shadow across the lane
  const hedgeShadowId = id();
  s.add(group({ name: 'hedge shadow', id: hedgeShadowId, opacity: [1, 0.35, 0, 0, 0][TIME0] }, wash(
    [P(460, 176), P(446, 190), P(414, 214), P(368, 244), P(322, 266), P(292, 284), P(326, 288), P(392, 254), P(438, 222), P(462, 196), P(470, 178)],
    '6A6F92', rng(54), { alpha: 0.3, grain: 0.2, wobble: 1.5 },
  )));
  byTime(hedgeShadowId, 'opacity', [1, 0.35, 0, 0, 0]);

  const verge = [P(20, 284), P(90, 290), P(180, 287), P(262, 280), P(322, 266), P(358, 252), P(290, 288), P(240, 310), P(170, 304), P(100, 312), P(40, 304), P(14, 296)];
  const vergeR = [P(490, 258), P(560, 263), P(660, 259), P(736, 262), P(748, 284), P(730, 304), P(660, 298), P(600, 310), P(552, 312), P(522, 290)];
  const vergeSeasons = ['A6C873', '7FA855', 'B3A25A', 'C9D1D5'];
  s.add(bloom('verges', [
    wash(verge, 'A6C873', rng(55), { alpha: 0.42, grain: 0.5, specks: 10, seasons: vergeSeasons }),
    wash(vergeR, 'A6C873', rng(56), { alpha: 0.4, grain: 0.5, specks: 10, seasons: vergeSeasons }),
  ], { start: 70, dur: 70, at: P(380, 300) }));

  const laneFx = inkFx('lane', 4, 56);
  s.add(boil('lane ink', 3, (rr) => {
    const ruts = [];
    for (const [a, b] of [[P(312, 320), P(455, 184)], [P(486, 320), P(470, 184)]]) {
      // broken dashes that shorten into the distance
      for (let t = 0; t < 0.92;) {
        const len = lerp(0.12, 0.05, t) + rr.range(0, 0.04);
        const t2 = Math.min(0.95, t + len);
        ruts.push({ pts: [P(lerp(a.x, b.x, t), lerp(a.y, b.y, t)), P(lerp(a.x, b.x, t2), lerp(a.y, b.y, t2))], amt: 0.5 });
        t = t2 + lerp(0.08, 0.04, t) + rr.range(0, 0.04);
      }
    }
    return [
      inkPaths([{ pts: laneL.slice(1), n: 14, amt: 0.7 }, { pts: laneR.slice(1), n: 14, amt: 0.7 }], rr, { w: 1.6, fx: laneFx }),
      inkPaths(ruts, rr, { w: 1.2, fx: laneFx, ghost: 0.05 }),
    ];
  }));

  // ================================================================ hedgerow

  const hedgeSeasons = ['8DB360', '5F8F45', '9A8A3E', '8E8C7A'];
  s.add(bloom('hedge', [
    wash([...hedgeTop, ...hedgeBot], C.sap, rng(60), { alpha: 0.5, grain: 0.6, specks: 14, seasons: hedgeSeasons }),
    // depth: darker pockets low in the hedge
    ...[[60, 262, 34, 14], [150, 258, 30, 12], [238, 252, 26, 11], [318, 236, 18, 9], [378, 214, 12, 6]].map(([x, y, rx, ry], i) =>
      wash(blobPts(rx, ry, rng(61 + i), { n: 9, wobble: 0.22 }).map((p) => P(p.x + x, p.y + y)), '4E7A3A', rng(66 + i), { alpha: 0.32, grain: 0.3, wobble: 1.5, seasons: ['5F8F45', '3F6B34', '7A5A2E', '6B6A60'] })),
    // a warm note along the top where the light catches it
    wash([...hedgeTop.slice(4, 30), ...shift(hedgeTop.slice(4, 30), 0, 14).reverse()], C.ochre, rng(72), { alpha: 0.18, grain: 0.2, wobble: 1.5, seasons: ['D9C26A', 'D9A93F', 'D27F3A', 'B8B4A8'] }),
  ], { start: 60, dur: 80, at: P(200, 240) }));

  const hedgeFx = inkFx('hedge', 14, 70);
  s.add(boil('hedge ink', 3, (rr) => {
    const marks = [];
    // leafy "m" scribbles inside the hedge, smaller into the distance
    for (let i = 0; i < 16; i++) {
      const t = i / 16;
      const x = lerp(30, 420, t) + rr.jit(10);
      const y = lerp(232, 194, t) + rr.range(4, 40) * (1 - t * 0.7);
      const sc = lerp(1, 0.35, t);
      const m = [];
      for (let k = 0; k <= 4; k++) m.push(P(x + k * 3.2 * sc, y - (k % 2 ? 3.5 : 0) * sc));
      marks.push({ pts: m, amt: 0.3, tension: 0.6 });
    }
    // stems at the foot
    for (let i = 0; i < 10; i++) {
      const x = lerp(20, 300, i / 10) + rr.jit(8);
      const y = lerp(289, 270, i / 10);
      marks.push({ pts: [P(x, y), P(x + rr.jit(3), y - rr.range(8, 16))], amt: 0.4 });
    }
    return [
      inkPaths([{ pts: hedgeTop.slice(0, 44), amt: 0.5 }], rr, { w: 1.7, fx: hedgeFx }),
      inkPaths(marks, rr, { w: 1.05, fx: hedgeFx, ghost: 0.05 }),
    ];
  }));

  // seasonal hedge dressing
  const hedgeDots = (seed, count, rFn, near = 0) => {
    const rr = rng(seed);
    const out = [];
    for (let i = 0; out.length < count && i < count * 10; i++) {
      const t = rr();
      const k = Math.min(hedgeTop.length - 1, Math.floor(t * 0.92 * hedgeTop.length));
      const top = hedgeTop[k];
      const p = P(top.x + rr.jit(4), top.y + rr.range(3, 34) * (1 - t * 0.75) + near);
      if (inside(p, [...hedgeTop, ...hedgeBot])) out.push({ ...p, r: rFn(rr, t) });
    }
    return out;
  };
  const springId = id(), summerId = id(), autumnId = id(), winterId = id();
  s.add(group({ name: 'hedge spring', id: springId, opacity: SEASON0 === 0 ? 1 : 0 }, [
    dots(hedgeDots(80, 46, (rr, t) => rr.range(1.1, 2.1) * (1 - t * 0.5)), argb('FFFFFF', 0.95), 'blackthorn'),
    dots(hedgeDots(81, 22, (rr, t) => rr.range(0.9, 1.6) * (1 - t * 0.5)), argb('E9A3B5', 0.8), 'pink'),
  ]));
  s.add(group({ name: 'hedge summer', id: summerId, opacity: SEASON0 === 1 ? 1 : 0 }, [
    dots(hedgeDots(82, 14, (rr, t) => rr.range(1.8, 2.8) * (1 - t * 0.5)), argb('E58FA6', 0.85), 'dog roses'),
    dots(hedgeDots(83, 14, (rr, t) => rr.range(0.6, 1)), argb('F2D25A', 0.9), 'rose hearts'),
  ]));
  s.add(group({ name: 'hedge autumn', id: autumnId, opacity: SEASON0 === 2 ? 1 : 0 }, [
    dots(hedgeDots(84, 40, (rr, t) => rr.range(0.9, 1.7) * (1 - t * 0.5)), argb(C.haw, 0.85), 'haws'),
    dots(hedgeDots(85, 14, (rr, t) => rr.range(1.4, 2.2) * (1 - t * 0.5)), argb('5B3A6E', 0.6), 'sloes'),
  ]));
  // winter: snow lying along the hedge top (opaque white so it reads on the wash)
  const snowCap = (pts, th, rr) => [...pts, ...pts.slice().reverse().map((p, i) => P(p.x + rr.jit(0.6), p.y + th * (0.5 + 0.5 * Math.abs(Math.sin(i * 0.9))) ))];
  const snowFill = (name, pts) => el('Shape', { name }, [pathXml(pts, { closed: true }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb('FFFFFF', 0.92), name: 'C' })), stroke(argb('8796AE', 0.55), 0.8)]);
  const winterBits = [
    snowFill('hedge snow', snowCap(shift(hedgeTop.slice(0, 44), 0, -1), 4, rng(86))),
    snowFill('roof snow', [P(hx - 4, hb - 11), P(hx + 5, hb - 22), P(hx + 22, hb - 23), P(hx + 31, hb - 12), P(hx + 24, hb - 15), P(hx + 8, hb - 16)]),
    snowFill('lane snow', [P(300, 314), P(380, 260), P(430, 220), P(460, 182), P(452, 206), P(410, 246), P(350, 286)]),
    snowFill('far snow', [...farR.slice(0, 4), ...shift(farR.slice(0, 4), 0, 3).reverse()]),
  ];
  s.add(group({ name: 'hedge winter', id: winterId, opacity: SEASON0 === 3 ? 1 : 0 }, winterBits));
  bySeason(springId, 'opacity', [1, 0, 0, 0]);
  bySeason(summerId, 'opacity', [0, 1, 0, 0]);
  bySeason(autumnId, 'opacity', [0, 0, 1, 0]);
  bySeason(winterId, 'opacity', [0, 0, 0, 1]);

  // ================================================================ the rabbit, who sometimes looks out

  const rabbitId = id(), rabbitTimeId = id(), earsId = id();
  const rbx = 286, rby = 284;
  const body = [P(-9, 0), P(-11, -6), P(-6, -11), P(2, -12), P(7, -16), P(12, -14), P(13, -9), P(9, -5), P(6, 0)];
  const rabbit = group({ name: 'rabbit time', id: rabbitTimeId, opacity: TIME0 === 4 ? 0 : 1 }, group({ name: 'rabbit', id: rabbitId, x: rbx, y: rby + 10, opacity: 0 }, [
    wash(body, 'A88B6E', rng(90), { alpha: 0.7, off: [1, 1], wobble: 0.5, grain: 0.4 }),
    group({ name: 'ears', id: earsId, x: 8, y: -14 }, [
      wash([P(-1, 0), P(-3, -9), P(0, -12), P(2, -2)], 'A88B6E', rng(91), { alpha: 0.6, wobble: 0.3, grain: 0 }),
      boil('ears ink', 2, (rr) => inkPaths([{ pts: [P(-1, 0), P(-3, -9), P(0, -12), P(2, -2)], amt: 0.25 }, { pts: [P(2, 0), P(3, -9), P(6, -10), P(5, -1)], amt: 0.25 }], rr, { w: 1, ghost: 0 })),
    ]),
    boil('rabbit ink', 2, (rr) => inkPaths([{ pts: body, amt: 0.3 }, { pts: [P(-9, -4), P(-12, -3)], amt: 0.2 }], rr, { w: 1.1, ghost: 0 })),
    dots([{ x: 9, y: -12, r: 0.9 }], INK, 'eye'),
    dots([{ x: -11.5, y: -4, r: 2.4 }], argb('FFFFFF', 0.95), 'tail'),
  ]));
  s.add(rabbit);
  byTime(rabbitTimeId, 'opacity', [1, 1, 1, 1, 0]);
  const rabbitKeys = (t0, up, sit, down) => [
    { object: rabbitId, prop: 'y', keys: [[0, rby + 10, 'hold'], [t0, rby + 10, 'cubic', EASE.out], [t0 + up, rby, 'hold'], [sit, rby, 'cubic', EASE.in], [down, rby + 10, 'hold']] },
    { object: rabbitId, prop: 'opacity', keys: [[0, 0, 'hold'], [t0, 0, 'cubic', EASE.out], [t0 + up * 0.7, 1, 'hold'], [sit, 1, 'cubic', EASE.in], [down, 0, 'hold']] },
    { object: earsId, prop: 'rotation', keys: [[0, 0, 'hold'], [t0 + up + 40, 0, 'cubic', EASE.inOut], [t0 + up + 48, -0.35, 'cubic', EASE.inOut], [t0 + up + 60, 0.05, 'cubic', EASE.inOut], [t0 + up + 70, 0, 'hold'], [sit - 50, 0, 'cubic', EASE.inOut], [sit - 42, -0.3, 'cubic', EASE.inOut], [sit - 30, 0, 'hold']] },
  ];
  const rabbitIdle = s.anim({ name: 'rabbit idle', duration: 2700, loop: 'loop', tracks: rabbitKeys(1700, 34, 2080, 2120) });
  const rabbitPeek = s.anim({ name: 'rabbit peek', duration: 330, tracks: rabbitKeys(6, 26, 280, 320) });

  // ================================================================ gate, fence, tree

  // tree shadow and gate shadow: long in the late afternoon, gone at night
  const treeShadowId = id(), gateShadowId = id();
  s.add(group({ name: 'tree shadow', id: treeShadowId, x: tx, y: tb + 2, scaleX: [0.9, 0.4, -2.3, -3.2, 0][TIME0] }, wash(
    [P(-14, -3), P(30, -6), P(90, -4), P(96, 3), P(40, 7), P(-12, 5)], '5E5F86', rng(100), { alpha: 0.36, grain: 0.2, wobble: 1 },
  )));
  s.add(group({ name: 'gate shadow', id: gateShadowId, x: gL, y: 266, scaleX: [-0.6, 0.9, 2, 2.7, 0][TIME0] }, [
    wash([P(0, -2), P(-96, -3), P(-98, 1), P(0, 2)], '5E5F86', rng(101), { alpha: 0.32, grain: 0, wobble: 0.6 }),
    wash([P(0, 4), P(-96, 4), P(-98, 7), P(0, 8)], '5E5F86', rng(102), { alpha: 0.26, grain: 0, wobble: 0.6 }),
  ]));
  byTime(treeShadowId, 'scaleX', [0.9, 0.4, -2.3, -3.2, -1]);
  byTime(treeShadowId, 'opacity', [0.9, 1, 1, 0.55, 0]);
  byTime(gateShadowId, 'scaleX', [-0.6, 0.9, 2, 2.7, 1]);
  byTime(gateShadowId, 'scaleY', [1, 0.7, 1.1, 1.2, 1]);
  byTime(gateShadowId, 'opacity', [0.8, 0.9, 1, 0.55, 0]);

  // fence beyond the latch post, and a bush by the hinge post
  s.add(bloom('bush', wash(scallop(500, 256, 18, rng(110), { bumps: 6, squash: 0.62 }), C.sap, rng(111), { alpha: 0.5, grain: 0.5, seasons: hedgeSeasons }), { start: 80, dur: 60, at: P(500, 256) }));
  const gateFx = inkFx('gate', 36, 56);
  s.add(boil('fence ink', 3, (rr) => inkPaths([
    { pts: [P(gH, 268), P(gH + rr.jit(1), 210)], amt: 0.4 },
    { pts: [P(gL, 264), P(gL + rr.jit(1), 212)], amt: 0.4 },
    { pts: [P(704, 260), P(704, 226)], amt: 0.4 },
    { pts: [P(738, 258), P(738, 230)], amt: 0.4 },
    { pts: [P(gL, 230), P(680, 232), P(740, 235)], n: 7, amt: 0.5 },
    { pts: [P(gL, 247), P(680, 248), P(740, 250)], n: 7, amt: 0.5 },
    { pts: [P(492, 248), P(500, 236)], amt: 0.3 }, { pts: [P(514, 252), P(516, 238)], amt: 0.3 }, { pts: [P(526, 250), P(532, 240)], amt: 0.3 },
  ], rr, { w: 1.7, fx: gateFx })));
  s.add(bloom('posts', [
    wash([P(gH - 3, 268), P(gH - 3, 208), P(gH + 4, 208), P(gH + 4, 268)], '9C7650', rng(112), { alpha: 0.5, wobble: 0.6, grain: 0.4 }),
    wash([P(gL - 3, 264), P(gL - 3, 210), P(gL + 4, 210), P(gL + 4, 264)], '9C7650', rng(113), { alpha: 0.5, wobble: 0.6, grain: 0.4 }),
  ], { start: 90, dur: 50, at: P(588, 240) }));

  // the gate itself pivots on its hinge post so it can creak open a touch
  const gateId = id();
  const bars = [218, 227, 236, 245, 254];
  s.add(group({ name: 'gate', id: gateId, x: gH, y: 0 }, [
    bloom('gate paint', wash([P(3, 215), P(93, 215), P(93, 257), P(3, 257)], 'B9A27E', rng(114), { alpha: 0.22, grain: 0.2, wobble: 1 }), { start: 96, dur: 50, at: P(48, 236) }),
    boil('gate ink', 3, (rr) => inkPaths([
      ...bars.map((y) => ({ pts: [P(3, y + rr.jit(0.6)), P(48, y + rr.jit(0.8)), P(92, y - 1 + rr.jit(0.6))], amt: 0.4 })),
      { pts: [P(92, 214), P(92, 258)], amt: 0.35 },
      { pts: [P(3, 254), P(48, 236), P(92, 218)], amt: 0.4 },
      { pts: [P(86, 230), P(96, 230), P(96, 234)], amt: 0.2 }, // latch
    ], rr, { w: 1.4, fx: gateFx })),
  ]));
  // winter: snow on the top bar and the post caps
  const gateSnowId = id();
  s.add(group({ name: 'gate snow', id: gateSnowId, opacity: SEASON0 === 3 ? 1 : 0 }, [
    snowFill('bar snow', [P(gH + 3, 217), P(gH + 50, 216), P(gH + 92, 215), P(gH + 92, 213), P(gH + 50, 213.5), P(gH + 3, 214.5)]),
    snowFill('post caps', [P(gH - 4, 209), P(gH - 1, 205), P(gH + 4, 205), P(gH + 6, 209)]),
    snowFill('post caps 2', [P(gL - 4, 211), P(gL - 1, 207), P(gL + 4, 207), P(gL + 6, 211)]),
    snowFill('rail snow', [P(gL, 229), P(680, 231), P(740, 234), P(740, 232), P(680, 229), P(gL, 227)]),
  ]));
  bySeason(gateSnowId, 'opacity', [0, 0, 0, 1]);

  // ---- the oak
  const trunkFx = inkFx('tree', 28, 60);
  const trunkL = [P(tx - 6, tb), P(tx - 4, tb - 30), P(tx - 2, tb - 60), P(tx - 6, tb - 76)];
  const trunkR = [P(tx + 6, tb), P(tx + 5, tb - 30), P(tx + 6, tb - 56), P(tx + 12, tb - 74)];
  const limbs = [
    [P(tx - 3, tb - 54), P(tx - 18, tb - 70), P(tx - 30, tb - 86), P(tx - 42, tb - 96)],
    [P(tx + 6, tb - 58), P(tx + 22, tb - 76), P(tx + 32, tb - 90), P(tx + 44, tb - 100)],
    [P(tx - 4, tb - 72), P(tx - 2, tb - 96), P(tx, tb - 118), P(tx - 4, tb - 134)],
    [P(tx + 10, tb - 72), P(tx + 16, tb - 100), P(tx + 22, tb - 120)],
  ];
  const twigs = [
    [P(tx - 30, tb - 86), P(tx - 40, tb - 82), P(tx - 50, tb - 84)], [P(tx - 42, tb - 96), P(tx - 46, tb - 108)], [P(tx - 18, tb - 70), P(tx - 30, tb - 68)],
    [P(tx + 32, tb - 90), P(tx + 46, tb - 86), P(tx + 54, tb - 90)], [P(tx + 44, tb - 100), P(tx + 46, tb - 112)], [P(tx + 22, tb - 76), P(tx + 34, tb - 74)],
    [P(tx, tb - 118), P(tx - 12, tb - 126)], [P(tx - 4, tb - 134), P(tx + 4, tb - 144)], [P(tx + 22, tb - 120), P(tx + 30, tb - 132)], [P(tx + 16, tb - 100), P(tx + 30, tb - 110)],
    [P(tx - 2, tb - 96), P(tx - 18, tb - 106)], [P(tx - 46, tb - 108), P(tx - 52, tb - 116)], [P(tx + 46, tb - 112), P(tx + 56, tb - 118)],
  ];
  s.add(bloom('trunk paint', wash([...trunkL, ...trunkR.slice().reverse()], '8A6A4E', rng(120), { alpha: 0.45, off: [1.5, 0], wobble: 1, grain: 0.4 }), { start: 70, dur: 50, at: P(tx, tb - 30) }));
  s.add(boil('tree ink', 3, (rr) => [
    inkPaths([{ pts: trunkL, amt: 0.45 }, { pts: trunkR, amt: 0.45 }, ...limbs.map((pts) => ({ pts, amt: 0.5 }))], rr, { w: 1.7, fx: trunkFx }),
    inkPaths(twigs.map((pts) => ({ pts, amt: 0.4 })), rr, { w: 1, fx: trunkFx, ghost: 0.05 }),
    inkPaths([{ pts: [P(tx - 2, tb - 22), P(tx + 1, tb - 30)], amt: 0.2 }, { pts: [P(tx + 2, tb - 10), P(tx + 3, tb - 16)], amt: 0.2 }, { pts: [P(tx - 20, tb + 1), P(tx + 22, tb + 1)], amt: 0.6 }], rr, { w: 0.9, fx: trunkFx, ghost: 0 }),
  ]));
  // winter: snow along the upper sides of the limbs
  const branchSnowId = id();
  s.add(group({ name: 'branch snow', id: branchSnowId, opacity: SEASON0 === 3 ? 1 : 0 }, limbs.slice(0, 2).map((l, i) => snowFill(`limb snow ${i}`, [...l.slice(1).map((p) => P(p.x, p.y - 1.5)), ...l.slice(1).reverse().map((p) => P(p.x + 1, p.y - 4))]))));
  bySeason(branchSnowId, 'opacity', [0, 0, 0, 1]);

  // canopy: hidden in winter; colour follows the season; it can be rustled
  const canopyId = id(), rustleId = id(), crownBlossom = id(), canopyFx = inkFx('canopy', 52, 60);
  const ccx = 0, ccy = -44; // canopy centre relative to its pivot (top of the trunk)
  const crown = scallop(ccx, ccy, 56, rng(130), { bumps: 9, depth: 0.12, squash: 0.8 });
  s.add(group({ name: 'canopy', id: canopyId, x: tx, y: tb - 98, opacity: SEASON0 === 3 ? 0 : 1 }, group({ name: 'rustle', id: rustleId }, [
    bloom('crown', [
      wash(crown, C.leaf, rng(131), { alpha: 0.55, off: [-3, 3], grain: 0.6, specks: 10, seasons: ['A3C96E', '5E9446', 'D08A3A', 'D08A3A'] }),
      wash(scallop(ccx + 14, ccy - 10, 28, rng(132), { bumps: 6 }), C.ochre, rng(133), { alpha: 0.22, grain: 0.3, seasons: ['E9E08A', 'B8C46A', 'C8643B', 'C8643B'] }),
      wash(scallop(ccx - 16, ccy + 18, 26, rng(134), { bumps: 5 }), '3F6B34', rng(135), { alpha: 0.28, grain: 0.3, seasons: ['7FAE5A', '3F6B34', '9C5A2E', '9C5A2E'] }),
    ], { start: 84, dur: 70, at: P(0, -30) }),
    boil('crown ink', 3, (rr) => {
      const arc = [];
      for (let k = 0; k <= 8; k++) { const a = 0.2 + (k / 8) * 1.4; arc.push(P(ccx + Math.cos(a) * 44, ccy + Math.sin(a) * 34)); }
      return inkPaths([
        { pts: crown, closed: true, amt: 0.6 },
        { pts: arc, amt: 0.5 },
        { pts: [P(ccx - 22, ccy - 8), P(ccx - 16, ccy - 14), P(ccx - 9, ccy - 10)], amt: 0.3 },
        { pts: [P(ccx + 10, ccy + 4), P(ccx + 17, ccy - 1), P(ccx + 24, ccy + 3)], amt: 0.3 },
      ], rr, { w: 1.6, fx: canopyFx });
    }),
    // spring blossom in the crown
    bloom('blossom in', group({ name: 'crown blossom', id: crownBlossom, opacity: SEASON0 === 0 ? 1 : 0 },
      dots(Array.from({ length: 30 }, (_, i) => { const rr = rng(140 + i); const a = rr() * TAU, d = Math.sqrt(rr()) * 0.85; return { x: ccx + Math.cos(a) * 58 * d, y: ccy + Math.sin(a) * 46 * d, r: rr.range(1.1, 2) }; }), argb('F3C3CF', 0.9), 'blossom')), { start: 130, dur: 50, at: P(0, 0), from: 1 }),
  ])));
  bySeason(crownBlossom, 'opacity', [1, 0, 0, 0]);
  bySeason(canopyId, 'opacity', [1, 1, 1, 0]);

  // a leaf / petal / clump of snow that drops when the tree is rustled
  const dropId = id(), dropColor = id();
  const dropShape = [P(-4, 0), P(0, -2.6), P(4, 0), P(0, 2.6)];
  s.add(group({ name: 'dropped', id: dropId, x: tx + 26, y: tb - 120, opacity: 0 }, [
    el('Shape', { name: 'drop' }, [pathXml(dropShape, { closed: true }), el('Fill', { name: 'Fill' }, solidId(argb('6E9F4E', 0.85), dropColor)), stroke(argb('2B2420', 0.7), 0.7)]),
  ]));
  bySeason(dropColor, 'colorValue', [argb('F3C3CF', 0.95), argb('6E9F4E', 0.85), argb('C8643B', 0.9), argb('FFFFFF', 0.95)], 'Color');

  // ================================================================ foreground

  const foreFx = inkFx('fore', 70, 50);
  s.add(boil('fore ink', 3, (rr) => {
    const tufts = [];
    for (const [gx, gy, sc] of [[30, 300, 1], [96, 306, 0.9], [176, 300, 1.1], [250, 306, 0.8], [600, 296, 1], [664, 304, 1.1], [726, 296, 0.9], [540, 312, 0.8]]) {
      tufts.push({ pts: [P(gx, gy), P(gx - 5 * sc, gy - 10 * sc)], amt: 0.4 });
      tufts.push({ pts: [P(gx + 2, gy), P(gx + 2, gy - 13 * sc)], amt: 0.4 });
      tufts.push({ pts: [P(gx + 4, gy), P(gx + 9 * sc, gy - 9 * sc)], amt: 0.4 });
    }
    return inkPaths(tufts, rr, { w: 1.1, fx: foreFx, ghost: 0.05 });
  }));
  // wildflowers: primrose, poppy, seedheads, nothing much
  const flowerIds = [id(), id()];
  const flowerSpots = [[60, 292], [138, 296], [214, 290], [620, 286], [700, 290], [580, 300]];
  s.add(bloom('flowers', [
    el('Shape', { name: 'flowers a' }, [...flowerSpots.filter((_, i) => i % 2 === 0).map(([x, y]) => el('Ellipse', { x, y, width: 5, height: 4.4, originX: 0.5, originY: 0.5, name: 'f' })), el('Fill', { name: 'Fill' }, solidId(argb('F0D46A', 0.9), flowerIds[0]))]),
    el('Shape', { name: 'flowers b' }, [...flowerSpots.filter((_, i) => i % 2 === 1).map(([x, y]) => el('Ellipse', { x, y, width: 4.6, height: 4.2, originX: 0.5, originY: 0.5, name: 'f' })), el('Fill', { name: 'Fill' }, solidId(argb('FFFFFF', 0.9), flowerIds[1]))]),
  ], { start: 120, dur: 40, at: P(380, 294), from: 0.98 }));
  bySeason(flowerIds[0], 'colorValue', [argb('F0D46A', 0.9), argb('D9573B', 0.85), argb('C9963A', 0.7), argb('B9A99A', 0)], 'Color');
  bySeason(flowerIds[1], 'colorValue', [argb('FFFFFF', 0.95), argb('6F86C9', 0.8), argb('A86A3A', 0.6), argb('B9A99A', 0)], 'Color');

  // ================================================================ seasonal life, one small loop each

  const LIFE = 720;
  const lifeTracks = [];
  const sampleKeys = (step, fn) => { const k = []; for (let f = 0; f <= LIFE; f += step) k.push([f, fn(f / LIFE), 'linear']); return k; };

  const mkGate = (vals) => { const g = id(); bySeason(g, 'opacity', vals); return g; };
  // spring: petals drifting off the hedge
  const petalGate = mkGate([1, 0, 0, 0]);
  const petals = [0, 1, 2, 3].map((i) => {
    const pid = id();
    const x0 = 120 + i * 80, y0 = 196 - i * 4;
    const ph = i / 4;
    lifeTracks.push(
      { object: pid, prop: 'x', keys: sampleKeys(24, (t) => { const u = (t + ph) % 1; return x0 + u * 120 + Math.sin(u * 9) * 6; }) },
      { object: pid, prop: 'y', keys: sampleKeys(24, (t) => { const u = (t + ph) % 1; return y0 + u * 70; }) },
      { object: pid, prop: 'rotation', keys: sampleKeys(24, (t) => Math.sin(((t + ph) % 1) * 12) * 0.9) },
      { object: pid, prop: 'opacity', keys: sampleKeys(24, (t) => { const u = (t + ph) % 1; return u < 0.1 ? u / 0.1 : u > 0.8 ? Math.max(0, (1 - u) / 0.2) : 1; }) },
    );
    return el('Shape', { name: `petal${i}`, id: pid, x: x0, y: y0 }, [el('Ellipse', { width: 4, height: 2.6, originX: 0.5, originY: 0.5, name: 'E' }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb('F1BFCB', 0.95), name: 'C' })), stroke(argb('B0697B', 0.6), 0.5)]);
  });
  // summer: a brimstone butterfly over the hedge
  const flyGate = mkGate([0, 1, 0, 0]);
  const bfId = id(), wingA = id(), wingB = id();
  const wing = (wid, dir) => el('Shape', { name: 'wing', id: wid }, [pathXml([P(0, 0), P(dir * 4, -4), P(dir * 6, -1), P(dir * 4, 2), P(0, 1)], { closed: true }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb('F2E07A', 0.95), name: 'C' })), stroke(argb('2B2420', 0.75), 0.6)]);
  const butterfly = group({ name: 'butterfly', id: bfId, x: 200, y: 180 }, [wing(wingA, -1), wing(wingB, 1)]);
  lifeTracks.push(
    { object: bfId, prop: 'x', keys: sampleKeys(12, (t) => 230 + Math.sin(t * TAU) * 120 + Math.sin(t * TAU * 3) * 16) },
    { object: bfId, prop: 'y', keys: sampleKeys(12, (t) => 178 + Math.sin(t * TAU * 2 + 1) * 14 + Math.sin(t * TAU * 7) * 5) },
  );
  // autumn: leaves letting go of the oak
  const leafGate = mkGate([0, 0, 1, 0]);
  const leafCols = ['D08A3A', 'C8643B', 'D9A93F', 'B5532E'];
  const leaves = leafCols.map((col, i) => {
    const lid = id();
    const x0 = tx - 40 + i * 26, y0 = tb - 110 + (i % 2) * 18;
    const ph = i / 4 + 0.1;
    lifeTracks.push(
      { object: lid, prop: 'x', keys: sampleKeys(20, (t) => { const u = (t + ph) % 1; return x0 + Math.sin(u * 8) * 10 - u * 40; }) },
      { object: lid, prop: 'y', keys: sampleKeys(20, (t) => { const u = (t + ph) % 1; return y0 + u * (tb + 20 - y0); }) },
      { object: lid, prop: 'rotation', keys: sampleKeys(20, (t) => Math.sin(((t + ph) % 1) * 8) * 1.1) },
      { object: lid, prop: 'opacity', keys: sampleKeys(20, (t) => { const u = (t + ph) % 1; return u < 0.08 ? u / 0.08 : u > 0.85 ? Math.max(0, (1 - u) / 0.15) : 1; }) },
    );
    return el('Shape', { name: `leaf${i}`, id: lid, x: x0, y: y0 }, [pathXml([P(-4, 0), P(0, -2.6), P(4, 0), P(0, 2.6)], { closed: true }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb(col, 0.9), name: 'C' })), stroke(argb('2B2420', 0.6), 0.6)]);
  });
  // winter: a few flakes, falling slowly
  const flakeGate = mkGate([0, 0, 0, 1]);
  const flakes = Array.from({ length: 12 }, (_, i) => {
    const fr = rng(160 + i);
    const fid = id();
    const x0 = 40 + i * 58 + fr.jit(16);
    const ph = fr();
    const top = 40 + fr.range(0, 30), bot = 230 + fr.range(0, 70);
    const wrapF = Math.round((1 - ph) * LIFE);
    const yAt = (u) => top + u * (bot - top);
    const yKeys = wrapF > 0 && wrapF < LIFE
      ? [[0, yAt(ph), 'linear'], [wrapF - 1, yAt(1), 'hold'], [wrapF, yAt(0), 'linear'], [LIFE, yAt(ph)]]
      : [[0, yAt(0), 'linear'], [LIFE, yAt(1)]];
    const oKeys = wrapF > 0 && wrapF < LIFE
      ? [[0, ph < 0.1 ? ph / 0.1 : ph > 0.85 ? (1 - ph) / 0.15 : 1, 'linear'], ...(ph < 0.85 ? [[Math.round(wrapF - 0.15 * LIFE), 1, 'linear']] : []), [wrapF - 1, 0, 'hold'], [wrapF, 0, 'linear'], ...(ph > 0.1 ? [[Math.round(wrapF + 0.1 * LIFE), 1, 'linear']] : []), [LIFE, ph < 0.1 ? ph / 0.1 : ph > 0.85 ? (1 - ph) / 0.15 : 1]]
      : [[0, 1, 'linear'], [LIFE, 1]];
    lifeTracks.push(
      { object: fid, prop: 'y', keys: yKeys },
      { object: fid, prop: 'opacity', keys: oKeys.sort((a, b) => a[0] - b[0]) },
      { object: fid, prop: 'x', keys: sampleKeys(60, (t) => x0 + Math.sin((t + ph) * TAU * 2) * 6) },
    );
    const sz = fr.range(1.8, 3);
    return el('Shape', { name: `flake${i}`, id: fid, x: x0, y: yAt(ph) }, [el('Ellipse', { width: sz, height: sz, originX: 0.5, originY: 0.5, name: 'E' }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: argb('FFFFFF', 0.95), name: 'C' })), stroke(argb('7C8CA6', 0.75), 0.6)]);
  });
  // the evening star breathes
  lifeTracks.push({ object: twinkle[0], prop: 'scaleX', keys: [[0, 1.1, 'cubic', EASE.inOut], [180, 1.4, 'cubic', EASE.inOut], [360, 1.1, 'hold'], [LIFE, 1.1]] });
  lifeTracks.push({ object: twinkle[0], prop: 'scaleY', keys: [[0, 1.1, 'cubic', EASE.inOut], [180, 1.4, 'cubic', EASE.inOut], [360, 1.1, 'hold'], [LIFE, 1.1]] });
  lifeTracks.push({ object: twinkle[2], prop: 'scaleX', keys: [[0, 0.8, 'hold'], [400, 0.8, 'cubic', EASE.inOut], [520, 1.15, 'cubic', EASE.inOut], [640, 0.8, 'hold'], [LIFE, 0.8]] });
  lifeTracks.push({ object: twinkle[2], prop: 'scaleY', keys: [[0, 0.8, 'hold'], [400, 0.8, 'cubic', EASE.inOut], [520, 1.15, 'cubic', EASE.inOut], [640, 0.8, 'hold'], [LIFE, 0.8]] });

  const lifeDay = id(); // butterflies and petals rest at night
  byTime(lifeDay, 'opacity', [1, 1, 1, 0.6, 0]);
  s.add(bloom('life', [
    group({ name: 'petals', id: petalGate, opacity: SEASON0 === 0 ? 1 : 0 }, petals),
    group({ name: 'leaves', id: leafGate, opacity: SEASON0 === 2 ? 1 : 0 }, leaves),
    group({ name: 'flakes', id: flakeGate, opacity: SEASON0 === 3 ? 1 : 0 }, flakes),
    group({ name: 'day life', id: lifeDay, opacity: [1, 1, 1, 0.6, 0][TIME0] }, group({ name: 'butterflies', id: flyGate, opacity: SEASON0 === 1 ? 1 : 0 }, butterfly)),
  ], { start: 140, dur: 40, at: P(0, 0), from: 1 }));
  const lifeAnim = s.anim({ name: 'life', duration: LIFE, loop: 'loop', tracks: lifeTracks });

  // ================================================================ birds: a short crossing, then nothing

  // The crossing is keyed explicitly and held at both ends, with the birds
  // faded out before the loop wraps, so there is never a visible trip home.
  const BIRDS = 1560, B0 = 240, B1 = 900;
  const flockId = id(), flockTime = id(), geeseId = id();
  const flapTracks = [];
  const birdAt = (bx, by, sc, seed, i) => {
    const solo = boil(`bird${i}`, 2, (rr, cel) => {
      const up = cel === 0 ? -5 : 2.5;
      return inkPaths([{ pts: [P(-8, up), P(-4, up * 0.4 - 2), P(0, 0), P(4, up * 0.4 - 2), P(8, up)], amt: 0.25 }], rr, { w: 1.2, ghost: 0.05 });
    });
    return group({ name: `bird${i}`, x: bx, y: by, scaleX: sc, scaleY: sc }, solo);
  };
  const flock = group({ name: 'flock time', id: flockTime, opacity: TIME0 === 4 ? 0 : 1 }, group({ name: 'flock', id: flockId, x: 140, y: 92, opacity: 0 }, [
    birdAt(0, 0, 1, 1, 0),
    birdAt(-22, 10, 0.8, 2, 1),
    group({ name: 'geese', id: geeseId, opacity: SEASON0 === 2 ? 1 : 0 }, [birdAt(-20, -10, 0.85, 3, 2), birdAt(-40, -20, 0.75, 4, 3), birdAt(-42, 20, 0.7, 5, 4)]),
  ]));
  s.add(flock);
  byTime(flockTime, 'opacity', [1, 1, 1, 1, 0]);
  bySeason(geeseId, 'opacity', [0, 0, 1, 0]);
  const flyY = []; for (let f = B0; f <= B1; f += 30) flyY.push([f, 92 - ((f - B0) / (B1 - B0)) * 26 + Math.sin((f - B0) * 0.03) * 5, 'cubic', EASE.inOut]);
  const birdsAnim = s.anim({ name: 'birds', duration: BIRDS, loop: 'loop', tracks: [
    { object: flockId, prop: 'x', keys: [[0, 140, 'hold'], [B0, 140, 'linear'], [B1, 640, 'hold'], [BIRDS, 640, 'hold']] },
    { object: flockId, prop: 'y', keys: [[0, 92, 'hold'], ...flyY, [BIRDS, 92, 'hold']] },
    { object: flockId, prop: 'opacity', keys: [[0, 0, 'hold'], [B0, 0, 'linear'], [B0 + 70, 1, 'hold'], [B1 - 80, 1, 'linear'], [B1, 0, 'hold'], [BIRDS, 0, 'hold']] },
  ] });

  // ================================================================ glazes and atmosphere, on top

  // morning (and evening) mist lying along the far fields
  const mistId = id();
  s.add(group({ name: 'mist', id: mistId, opacity: [1, 0, 0, 0.45, 0.3][TIME0] }, glow('mist band', 400, 178, 360, 20, [[0, argb('FFFFFF', 0.7)], [0.6, argb('FFFFFF', 0.35)], [1, argb('FFFFFF', 0)]])));
  byTime(mistId, 'opacity', [1, 0, 0, 0.45, 0.3]);

  s.add(bloom('tint', glow('time tint', 380, 172, 400, 160, [[0, tints[TIME0][0]], [0.55, tints[TIME0][1]], [0.88, tints[TIME0][2]]], { blend: 'multiply', stopIds: tintStops }), { start: 20, dur: 100, at: P(380, 172), from: 1 }));

  // ================================================================ hit areas and reactions

  const hit = (hid, x, y, w, h) => el('Shape', { x, y, name: 'hit', id: hid }, [el('Rectangle', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'R' }), el('Fill', { name: 'Fill' }, el('SolidColor', { colorValue: '00000000', name: 'C' }))]);
  const hitTree = id(), hitGate = id(), hitHedge = id();
  s.add(hit(hitTree, tx, tb - 130, 140, 120), hit(hitGate, gH + 48, 238, 104, 60), hit(hitHedge, rbx - 6, rby - 14, 80, 46));

  // ---- state machine (layer order matters: later layers win)
  const still = s.input('bool', 'still', STILL0);
  const seasonIn = s.input('number', 'season', SEASON0);
  const timeIn = s.input('number', 'time', TIME0);

  const introAnim = s.anim({ name: 'intro', duration: INTRO, tracks: intro });
  const doneAnim = s.anim({ name: 'intro done', duration: 1, tracks: done });
  {
    const a = id(), b = id();
    s.layers.push(s._layer('intro', [
      el('AnyState', { x: 200, y: -140 }, el('StateTransition', { stateToId: b, duration: 0 }, el('TransitionBoolCondition', { inputId: still, opValue: 'equal' }))),
      el('ExitState', { x: 500, y: -140 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: a })),
      el('AnimationState', { x: 200, y: 0, animationId: introAnim, id: a }),
      el('AnimationState', { x: 400, y: 0, animationId: doneAnim, id: b }),
    ]));
  }

  const poseLayer = (name, inputId, tracks, n, mix) => {
    const animIds = [...Array(n)].map((_, k) => s.anim({ name: `${name} ${k}`, duration: 1, tracks: tracks.map((t) => ({ object: t.object, prop: t.prop, type: t.type, keys: [[0, t.values[k], t.type === 'Double' ? 'linear' : 'hold']] })) }));
    const init = id();
    const sts = animIds.map(() => id());
    const cond = (k) => el('TransitionNumberCondition', { inputId, opValue: 'equal', value: k });
    s.layers.push(s._layer(name, [
      el('AnyState', { x: 200, y: -160 }),
      el('ExitState', { x: 700, y: -160 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: init })),
      el('AnimationState', { x: 200, y: 0, animationId: s.empty(), id: init }, sts.map((st, k) => el('StateTransition', { stateToId: st, duration: 0 }, cond(k)))),
      ...sts.map((st, k) => el('AnimationState', { x: 100 + k * 160, y: 180, animationId: animIds[k], id: st }, sts.map((st2, j) => (j === k ? '' : el('StateTransition', { stateToId: st2, duration: mix }, cond(j)))).filter(Boolean))),
    ]));
  };
  poseLayer('season', seasonIn, seasonT, 4, 2500);
  poseLayer('time', timeIn, timeT, 5, 2500);

  s.loopLayer('boil', s.anim({ name: 'boil', duration: HOLD * 3, loop: 'loop', tracks: boilTracks }));
  s.loopLayer('cloud', cloudAnim);
  s.loopLayer('smoke', s.anim({ name: 'smoke', duration: smokeDur, loop: 'loop', tracks: smokeTracks }));
  s.loopLayer('life', lifeAnim);
  s.loopLayer('birds', birdsAnim);
  s.loopLayer('flap', s.anim({ name: 'butterfly flap', duration: 16, loop: 'loop', tracks: [
    { object: wingA, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [8, 0.25, 'cubic', EASE.inOut], [16, 1]] },
    { object: wingB, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [8, 0.25, 'cubic', EASE.inOut], [16, 1]] },
  ] }));

  const peek = s.input('trigger', 'peek');
  s.triggerLayer('rabbit', peek, rabbitPeek, { idleId: rabbitIdle, fromAny: false, mix: 150 });
  s.listen(hitHedge, 'enter', [Scene.fire(peek)]);
  s.listen(hitHedge, 'click', [Scene.fire(peek)]);

  const rustle = s.input('trigger', 'rustle');
  s.triggerLayer('rustle', rustle, s.anim({ name: 'rustle', duration: 170, tracks: [
    { object: rustleId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [10, 0.045, 'cubic', EASE.inOut], [26, -0.03, 'cubic', EASE.inOut], [42, 0.014, 'cubic', EASE.inOut], [60, 0]] },
    { object: dropId, prop: 'opacity', keys: [[0, 0, 'linear'], [8, 1, 'hold'], [140, 1, 'linear'], [170, 0]] },
    { object: dropId, prop: 'y', keys: (() => { const k = []; for (let f = 0; f <= 170; f += 10) k.push([f, tb - 120 + (f / 170) * 118, 'linear']); return k; })() },
    { object: dropId, prop: 'x', keys: (() => { const k = []; for (let f = 0; f <= 170; f += 10) k.push([f, tx + 26 + Math.sin(f * 0.06) * 9 - (f / 170) * 18, 'linear']); return k; })() },
    { object: dropId, prop: 'rotation', keys: (() => { const k = []; for (let f = 0; f <= 170; f += 10) k.push([f, Math.sin(f * 0.06) * 0.8, 'linear']); return k; })() },
  ] }), { fromAny: false });
  s.listen(hitTree, 'enter', [Scene.fire(rustle)]);
  s.listen(hitTree, 'click', [Scene.fire(rustle)]);

  const creak = s.input('trigger', 'creak');
  s.triggerLayer('gate', creak, s.anim({ name: 'creak', duration: 200, tracks: [
    { object: gateId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [40, 0.82, 'hold'], [110, 0.82, 'cubic', EASE.inOut], [150, 1.02, 'cubic', EASE.out], [164, 0.99, 'cubic', EASE.out], [176, 1]] },
  ] }), { fromAny: false });
  s.listen(hitGate, 'enter', [Scene.fire(creak)]);
  s.listen(hitGate, 'click', [Scene.fire(creak)]);

  return s.toXml();
}

export default function () {
  return document(hero(new Ids(10)));
}
