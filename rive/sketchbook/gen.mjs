// Draft 2 · Sketchbook — an ink + watercolor hillside in the ben.page spirit.
// Ink lines boil; washes sit a few pixels off the lines, like paint laid in
// after the drawing dried. Artboards: Hero, Highlight, Swatch0..4.
import {
  Ids, Scene, rng, P, TAU, el, argb, darken, resample, blobPts, pathXml, polyXml,
  fill, stroke, inkShape, washShape, stippleShape, boil, document, EASE,
} from '../lib/ink.mjs';

const INK = 'FF1F1C1A';
const C = {
  sap: '8DB360',
  leaf: '6E9F4E',
  ochre: 'D9A93F',
  terra: 'C8643B',
  sky: '7FB2D3',
  grey: '8A97A6',
  cream: 'E9D2A0',
  lamp: 'F4C84A',
  rose: 'D9738A',
  violet: '8E86C9',
};

// ---------- local helpers ----------

// children for an el() Node, given back-to-front like Scene.add
const group = (attrs, kids) => el('Node', attrs, [].concat(kids).reverse());

// a hand-traced polyline: resampled, then nudged so no two cels match
function trace(pts, r, amt = 0.8, n) {
  const src = n ? resample(pts, n) : pts;
  return src.map((p) => P(p.x + r.jit(amt), p.y + r.jit(amt)));
}

function ink(pts, r, { w = 2, closed = false, amt = 0.8, n, color = INK, bleed } = {}) {
  return inkShape({ pts: trace(pts, r, amt, n), closed, color, width: w, bleed });
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
 * Watercolor for an arbitrary outline in artboard coords: a glaze with a pooled
 * rim, a shrunken wet-in-wet glaze, and granulation dots inside the outline.
 * `off` misregisters the paint from the ink that traces the same outline.
 */
function paint(pts, color, r, { alpha = 0.55, off = [3, 2.5], wobble = 2.5, grain = 1, soft = 1.6, name = 'paint' } = {}) {
  const shape = pts.map((p) => P(p.x + off[0] + r.jit(wobble), p.y + off[1] + r.jit(wobble)));
  const c = centroid(shape);
  const wet = shape.map((p) => P(c.x + (p.x - c.x) * 0.78 + r.jit(wobble * 2), c.y + (p.y - c.y) * 0.74 + r.jit(wobble * 2)));
  const xs = shape.map((p) => p.x), ys = shape.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const dots = [];
  const want = Math.round((((x1 - x0) * (y1 - y0)) / 70) * grain);
  for (let i = 0, tries = 0; i < want && tries < want * 6; tries++) {
    const d = P(r.range(x0, x1), r.range(y0, y1));
    if (inside(d, shape)) { dots.push({ ...d, r: r.range(0.35, 0.95) }); i++; }
  }
  const softness = Math.max(3, Math.min(x1 - x0, y1 - y0) * 0.12);
  return group({ name }, [
    washShape({ pts: shape, color, alpha: alpha * 0.62, edge: 0.95, soft }),
    el('Shape', { name: 'wet', blendModeValue: 'multiply' }, [pathXml(wet, { closed: true }), fill(argb(color, alpha * 0.42), { feather: softness })]),
    dots.length ? stippleShape({ name: 'grain', dots, color: argb(darken(color, 0.4), alpha * 0.4) }) : '',
  ]);
}

function hit(id, x, y, w, h) {
  return el('Shape', { x, y, name: 'hit', id }, [el('Rectangle', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'R' }), fill('00000000')]);
}

// sample a function of phase into keyframes so loops can be authored as curves
function sampled(object, prop, frames, step, fn) {
  const keys = [];
  for (let f = 0; f <= frames; f += step) keys.push([f, fn(f / frames), 'linear']);
  return { object, prop, keys };
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
  // flat-ish bottom, three or four bumps on top
  const pts = [];
  const bumps = 3 + Math.floor(r() * 2);
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const x = -w / 2 + t * w;
    const env = Math.sin(t * Math.PI);
    const y = -h * env * (0.62 + 0.38 * Math.abs(Math.sin(t * Math.PI * bumps)));
    pts.push(P(x, y));
  }
  for (let i = 1; i < 8; i++) {
    const t = 1 - i / 8;
    pts.push(P(-w / 2 + t * w + r.jit(2), h * 0.12 * Math.sin(t * Math.PI) + r.jit(1)));
  }
  return pts;
}

// ---------- hero ----------

function hero(ids) {
  const W = 900, H = 340;
  const s = new Scene(ids, { name: 'Hero', w: W, h: H, x: 0, y: 0, bg: process.env.SK_BG ? 'FFFBF8F1' : undefined });
  const r = rng(20261118);

  // --- sky: a faint cerulean wash, top-left, and the sun
  s.add(paint(blobPts(120, 44, r, { n: 14, wobble: 0.2 }).map((p) => P(p.x + 190, p.y + 64)), C.sky, r, { alpha: 0.13, grain: 0.4, off: [0, 0] }));

  // a pale far hill behind the fence, for depth
  const far = [P(0, 268), P(80, 236), P(170, 222), P(260, 230), P(360, 252), P(430, 280)];
  s.add(paint([...far, P(430, 300), P(0, 300)], C.sky, r, { alpha: 0.18, off: [0, 3], grain: 0.4 }));
  const farInk = boil(s, { name: 'far ink', seed: 39, draw: (rr) => ink(far.slice(1, 5), rr, { w: 1.3, amt: 0.8, n: 10, color: 'FF5B6470' }) });
  s.add(farInk.xml);
  s.loopLayer('far boil', farInk.animId);

  const sunId = ids.next();
  const sunBoil = boil(s, {
    name: 'sun ink', seed: 3, draw: (rr) => {
      const rays = [];
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + rr.jit(0.06);
        rays.push(ink([P(Math.cos(a) * 34, Math.sin(a) * 34), P(Math.cos(a) * 44, Math.sin(a) * 44)], rr, { w: 1.6, amt: 0.6 }));
      }
      return [ink(blobPts(25, 25, rr, { n: 9, wobble: 0.04 }), rr, { closed: true, w: 1.8, amt: 0.5 }), ...rays];
    },
  });
  s.add(group({ name: 'sun', x: 96, y: 62, id: sunId }, [paint(blobPts(27, 26, r, { n: 10, wobble: 0.08 }), C.ochre, r, { alpha: 0.7, off: [3, 3], wobble: 1.2 }), sunBoil.xml]));
  s.loopLayer('sun boil', sunBoil.animId);
  s.loopLayer('sun turn', s.anim({ name: 'sun turn', duration: 3600, loop: 'loop', tracks: [{ object: sunId, prop: 'rotation', keys: [[0, 0, 'linear'], [3600, TAU]] }] }));

  // --- clouds drifting
  const clouds = [
    { x: 330, y: 74, w: 120, h: 34, seed: 5, dx: 22, dur: 900 },
    { x: 585, y: 48, w: 92, h: 26, seed: 8, dx: -18, dur: 1100 },
  ];
  clouds.forEach((c, i) => {
    const id = ids.next();
    const cr = rng(c.seed);
    const base = cloudPts(c.w, c.h, cr);
    const b = boil(s, { name: `cloud${i} ink`, seed: c.seed + 1, draw: (rr) => ink(base, rr, { closed: true, w: 1.7, amt: 0.7 }) });
    s.add(group({ name: `cloud${i}`, x: c.x, y: c.y, id }, [paint(base, C.grey, cr, { alpha: 0.22, off: [4, 4], grain: 0.5 }), b.xml]));
    s.loopLayer(`cloud${i} boil`, b.animId);
    s.loopLayer(`cloud${i} drift`, s.anim({ name: `cloud${i} drift`, duration: c.dur, loop: 'pingPong', tracks: [{ object: id, prop: 'x', keys: [[0, c.x, 'cubic', EASE.inOut], [c.dur, c.x + c.dx]] }] }));
  });

  // --- flying birds: cross the sky every ~20s, wings flapping
  const flyers = [
    { y: 112, start: 0, scale: 1, seed: 31 },
    { y: 132, start: 50, scale: 0.75, seed: 37 },
  ];
  const flyDur = 1260;
  const flyTracks = [];
  flyers.forEach((f, i) => {
    const id = ids.next();
    const flap = boil(s, {
      name: `flyer${i}`, cels: 2, hold: 11, seed: f.seed, draw: (rr, cel) => {
        const up = cel === 0 ? -7 : 3;
        return ink([P(-12, up), P(-6, up * 0.4 - 3), P(0, 0), P(6, up * 0.4 - 3), P(12, up)], rr, { w: 1.6, amt: 0.3 });
      },
    });
    s.add(group({ name: `flyer${i}`, x: -40, y: f.y, id, scaleX: f.scale, scaleY: f.scale }, [flap.xml]));
    s.loopLayer(`flyer${i} flap`, flap.animId);
    const cross = 620;
    flyTracks.push(
      sampled(id, 'x', flyDur, 15, (t) => {
        const ft = t * flyDur - f.start;
        return ft < 0 || ft > cross ? -40 : -40 + (ft / cross) * (W + 80);
      }),
      sampled(id, 'y', flyDur, 15, (t) => f.y + Math.sin(t * flyDur * 0.02 + i) * 9 - t * 30)
    );
  });
  s.loopLayer('flyers', s.anim({ name: 'flyers', duration: flyDur, loop: 'loop', tracks: flyTracks }));

  // --- the hill
  const ridge = [P(330, 318), P(380, 288), P(440, 246), P(530, 212), P(640, 196), P(760, 204), P(850, 232), P(892, 262)];
  const hillFill = [...ridge, P(896, 300), P(870, 318), P(600, 322), P(340, 320)];
  s.add(paint(hillFill, C.sap, r, { alpha: 0.42, off: [0, 4], grain: 0.6 }));
  s.add(paint([P(520, 230), P(640, 212), P(760, 222), P(850, 256), P(870, 304), P(560, 314)], C.ochre, r, { alpha: 0.2, off: [0, 0], grain: 0.4 }));
  const hillInk = boil(s, { name: 'ridge ink', seed: 41, draw: (rr) => ink(ridge.slice(2, 8), rr, { w: 2, amt: 1, n: 18 }) });
  s.add(hillInk.xml);
  s.loopLayer('ridge boil', hillInk.animId);

  // --- tree beside the cottage
  const treeX = 756, treeBase = 206;
  const trunk = [P(treeX - 4, treeBase), P(treeX - 2, treeBase - 30), P(treeX + 1, treeBase - 58)];
  const trunk2 = [P(treeX + 6, treeBase), P(treeX + 6, treeBase - 32), P(treeX + 9, treeBase - 56)];
  const branch = [P(treeX + 2, treeBase - 38), P(treeX + 16, treeBase - 52), P(treeX + 22, treeBase - 66)];
  s.add(paint([...trunk, ...trunk2.slice().reverse()], C.terra, r, { alpha: 0.35, off: [2, 1], grain: 0.3 }));
  const trunkInk = boil(s, { name: 'trunk ink', seed: 43, draw: (rr) => [ink(trunk, rr, { w: 1.9, amt: 0.5 }), ink(trunk2, rr, { w: 1.9, amt: 0.5 }), ink(branch, rr, { w: 1.5, amt: 0.5 })] });
  s.add(trunkInk.xml);
  s.loopLayer('trunk boil', trunkInk.animId);

  // canopy pivots near the trunk top so a rustle sways it
  const canopyBreathe = ids.next();
  const canopyRustle = ids.next();
  const cx = 4, cy = -46; // canopy centre relative to the pivot
  const crown = scallop(cx, cy, 52, rng(47), { bumps: 8, depth: 0.13, squash: 0.86 });
  const crownInk = boil(s, {
    name: 'crown ink', seed: 48, draw: (rr) => {
      const ticks = [];
      // shading: a broken inner contour on the shadow side, plus two twig marks
      const arc = [];
      for (let k = 0; k <= 8; k++) {
        const a = 0.15 + (k / 8) * 1.5;
        arc.push(P(cx + Math.cos(a) * 38, cy + Math.sin(a) * 31));
      }
      ticks.push(ink(arc, rr, { w: 1.2, amt: 0.5 }));
      ticks.push(ink([P(cx - 2, cy + 30), P(cx - 6, cy + 18)], rr, { w: 1.2, amt: 0.3 }));
      ticks.push(ink([P(cx - 6, cy + 18), P(cx - 16, cy + 10)], rr, { w: 1.1, amt: 0.3 }));
      return [ink(crown, rr, { closed: true, w: 2, amt: 0.7 }), ...ticks];
    },
  });
  s.loopLayer('crown boil', crownInk.animId);
  s.add(
    group({ name: 'canopy', x: treeX + 6, y: treeBase - 60, id: canopyBreathe }, [
      group({ name: 'rustle', id: canopyRustle }, [
        paint(crown, C.leaf, rng(49), { alpha: 0.55, off: [-4, 4], grain: 0.8 }),
        paint(scallop(cx - 10, cy + 10, 26, rng(50), { bumps: 5 }), C.ochre, rng(51), { alpha: 0.22, off: [0, 0], grain: 0.3 }),
        crownInk.xml,
      ]),
    ])
  );
  s.loopLayer('canopy breathe', s.anim({ name: 'canopy breathe', duration: 300, loop: 'pingPong', tracks: [
    { object: canopyBreathe, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [300, 1.025]] },
    { object: canopyBreathe, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [300, 1.035]] },
  ] }));

  // a leaf that only shows when the tree is rustled
  const leafId = ids.next();
  const leafShape = [P(-5, 0), P(0, -3), P(5, 0), P(0, 3)];
  s.add(group({ name: 'falling leaf', x: treeX + 30, y: treeBase - 92, id: leafId, opacity: 0 }, [
    paint(leafShape, C.leaf, rng(52), { alpha: 0.8, off: [1, 1], wobble: 0.4, grain: 0 }),
    inkShape({ pts: leafShape, closed: true, color: INK, width: 1.1, bleed: 0 }),
  ]));

  // --- cottage
  const hx = 560, hy = 214; // bottom-left of the walls
  const walls = [P(hx, hy), P(hx + 1, hy - 46), P(hx + 92, hy - 48), P(hx + 93, hy - 1)];
  const roof = [P(hx - 10, hy - 44), P(hx + 30, hy - 86), P(hx + 74, hy - 88), P(hx + 104, hy - 46)];
  const chimney = [P(hx + 66, hy - 88), P(hx + 66, hy - 104), P(hx + 78, hy - 104), P(hx + 78, hy - 87)];
  const door = [P(hx + 18, hy), P(hx + 18, hy - 28), P(hx + 32, hy - 29), P(hx + 33, hy)];
  const win = [P(hx + 52, hy - 18), P(hx + 52, hy - 34), P(hx + 74, hy - 34), P(hx + 74, hy - 18)];
  s.add(paint(walls, C.cream, r, { alpha: 0.6, off: [4, 2], grain: 0.5 }));
  s.add(paint(roof, C.terra, r, { alpha: 0.6, off: [-3, 3], grain: 0.7 }));
  s.add(paint(chimney, C.terra, r, { alpha: 0.5, off: [2, 1], wobble: 1, grain: 0.4 }));
  s.add(paint(door, C.sky, r, { alpha: 0.55, off: [2, 2], wobble: 1, grain: 0.3 }));
  const glowId = ids.next();
  s.add(group({ name: 'window glow', id: glowId, opacity: 0 }, [
    el('Shape', { name: 'halo', x: hx + 63, y: hy - 26, blendModeValue: 'multiply' }, [el('Ellipse', { width: 64, height: 46, originX: 0.5, originY: 0.5, name: 'E' }), fill(argb(C.lamp, 0.35), { feather: 14 })]),
    paint(win, C.lamp, rng(60), { alpha: 0.95, off: [1, 1], wobble: 0.8, grain: 0.3 }),
  ]));
  s.add(paint(win, C.sky, rng(61), { alpha: 0.28, off: [2, 1], wobble: 0.8, grain: 0.2 }));

  const houseInk = boil(s, {
    name: 'cottage ink', seed: 63, draw: (rr) => [
      ink(walls, rr, { w: 2, amt: 0.6 }),
      ink(roof, rr, { w: 2.1, amt: 0.6 }),
      ink([P(hx + 26, hy - 80), P(hx + 44, hy - 62)], rr, { w: 1.2, amt: 0.5 }),
      ink([P(hx + 50, hy - 84), P(hx + 70, hy - 64)], rr, { w: 1.2, amt: 0.5 }),
      ink(chimney, rr, { w: 1.8, amt: 0.4 }),
      ink(door, rr, { w: 1.7, amt: 0.4 }),
      ink(win, rr, { w: 1.6, amt: 0.4, closed: true }),
      ink([P(hx + 63, hy - 34), P(hx + 63, hy - 18)], rr, { w: 1.1, amt: 0.3 }),
      ink([P(hx + 52, hy - 26), P(hx + 74, hy - 26)], rr, { w: 1.1, amt: 0.3 }),
    ],
  });
  s.add(houseInk.xml);
  s.loopLayer('cottage boil', houseInk.animId);

  // --- chimney smoke: three curls rising on a loop
  const smokeDur = 360;
  const smokeTracks = [];
  for (let i = 0; i < 3; i++) {
    const id = ids.next();
    const curl = boil(s, {
      name: `smoke${i}`, seed: 70 + i, hold: 9, draw: (rr) => {
        const pts = [];
        for (let k = 0; k <= 10; k++) {
          const t = k / 10;
          pts.push(P(Math.sin(t * 5.5) * (5 + t * 4), -t * 22));
        }
        return ink(pts, rr, { w: 1.4, amt: 0.6, color: 'FF4A4642' });
      },
    });
    s.add(group({ name: `smoke${i}`, x: hx + 72, y: hy - 108, id, opacity: 0 }, [curl.xml]));
    s.loopLayer(`smoke${i} boil`, curl.animId);
    const ph = i / 3;
    const at = (t) => (t + ph) % 1;
    smokeTracks.push(
      sampled(id, 'y', smokeDur, 10, (t) => hy - 108 - at(t) * 70),
      sampled(id, 'x', smokeDur, 10, (t) => hx + 72 + at(t) * 26 + Math.sin(at(t) * 6) * 4),
      sampled(id, 'opacity', smokeDur, 10, (t) => { const u = at(t); return u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85); }),
      sampled(id, 'scaleX', smokeDur, 10, (t) => 0.6 + at(t) * 0.8),
      sampled(id, 'scaleY', smokeDur, 10, (t) => 0.6 + at(t) * 0.8)
    );
  }
  s.loopLayer('smoke', s.anim({ name: 'smoke', duration: smokeDur, loop: 'loop', tracks: smokeTracks }));

  // --- foreground ground wash + ink dashes (the ben.page ground)
  s.add(paint([P(20, 300), P(200, 288), P(420, 296), P(640, 286), P(880, 296), P(884, 326), P(620, 332), P(380, 326), P(140, 334), P(16, 324)], C.sap, r, { alpha: 0.5, off: [0, 0], grain: 0.8 }));
  s.add(paint([P(90, 304), P(260, 298), P(330, 312), P(180, 322), P(80, 318)], C.ochre, r, { alpha: 0.35, off: [0, 0], grain: 0.5 }));
  s.add(paint([P(520, 300), P(700, 294), P(760, 310), P(600, 318)], C.ochre, r, { alpha: 0.3, off: [0, 0], grain: 0.5 }));
  const dashSpec = [];
  for (let x = 30; x < 870;) {
    const len = r.range(18, 64);
    dashSpec.push({ x, y: r.range(306, 320), len });
    x += len + r.range(12, 38);
  }
  const ground = boil(s, {
    name: 'ground ink', seed: 80, draw: (rr) => {
      const out = dashSpec.map((d) => ink([P(d.x, d.y), P(d.x + d.len / 2, d.y + rr.jit(1.2)), P(d.x + d.len, d.y + rr.jit(1.5))], rr, { w: 2.2, amt: 0.5 }));
      // grass ticks
      for (const gx of [70, 236, 410, 498, 684, 812]) {
        out.push(ink([P(gx, 301), P(gx - 4, 292)], rr, { w: 1.2, amt: 0.4 }));
        out.push(ink([P(gx + 2, 301), P(gx + 2, 290)], rr, { w: 1.2, amt: 0.4 }));
        out.push(ink([P(gx + 4, 301), P(gx + 8, 294)], rr, { w: 1.2, amt: 0.4 }));
      }
      return out;
    },
  });
  s.add(ground.xml);
  s.loopLayer('ground boil', ground.animId);

  // flowers: dabs of colour with a tiny ink stem
  const flowers = [[118, 296, C.rose], [252, 292, C.violet], [470, 294, C.rose], [722, 290, C.lamp], [846, 293, C.violet]];
  flowers.forEach(([fx, fy, col], i) => {
    const fr = rng(90 + i);
    s.add(paint(blobPts(5, 4.5, fr, { n: 7, wobble: 0.2 }).map((p) => P(p.x + fx, p.y + fy - 10)), col, fr, { alpha: 0.85, off: [0, 0], wobble: 0.5, grain: 0 }));
    s.add(inkShape({ pts: [P(fx, fy + 4), P(fx + fr.jit(1), fy - 4)], color: INK, width: 1.2, bleed: 0 }));
  });

  // --- fence on the left, with a little bird perched on the end post
  const posts = [80, 132, 184, 236];
  const fence = boil(s, {
    name: 'fence ink', seed: 100, draw: (rr) => [
      ...posts.map((px) => ink([P(px, 304), P(px + rr.jit(1), 262)], rr, { w: 2.1, amt: 0.5 })),
      ink([P(72, 274), P(160, 276), P(246, 272)], rr, { w: 1.7, amt: 0.6 }),
      ink([P(74, 290), P(160, 292), P(244, 289)], rr, { w: 1.7, amt: 0.6 }),
    ],
  });
  s.add(paint([P(76, 270), P(244, 268), P(244, 296), P(76, 298)], C.ochre, r, { alpha: 0.12, off: [2, 2], grain: 0.2 }));
  s.add(fence.xml);
  s.loopLayer('fence boil', fence.animId);

  const birdId = ids.next();
  const birdBody = [P(-10, 0), P(-12, -8), P(-6, -14), P(2, -15), P(8, -11), P(14, -12), P(9, -7), P(6, 0)];
  const birdInk = boil(s, {
    name: 'bird ink', seed: 110, draw: (rr) => [
      ink(birdBody, rr, { closed: true, w: 1.7, amt: 0.35 }),
      ink([P(-10, -6), P(-18, -3)], rr, { w: 1.5, amt: 0.3 }),
      ink([P(-2, 0), P(-3, 4)], rr, { w: 1.2, amt: 0.2 }),
      ink([P(2, 0), P(3, 4)], rr, { w: 1.2, amt: 0.2 }),
      stippleShape({ dots: [{ x: 5, y: -11, r: 1.1 }], color: INK }),
    ],
  });
  s.add(group({ name: 'perched bird', x: 236, y: 258, id: birdId, scaleX: 1.25, scaleY: 1.25 }, [
    paint(birdBody, C.sky, rng(111), { alpha: 0.75, off: [1.5, 1], wobble: 0.6, grain: 0.3 }),
    paint([P(-4, -6), P(4, -8), P(7, -2), P(-2, -1)], C.terra, rng(112), { alpha: 0.6, off: [0, 0], wobble: 0.4, grain: 0 }),
    birdInk.xml,
  ]));
  s.loopLayer('bird boil', birdInk.animId);

  // --- hit areas (transparent, on top)
  const hitHouse = ids.next(), hitTree = ids.next(), hitBird = ids.next(), hitSun = ids.next();
  s.add(hit(hitHouse, hx + 46, hy - 50, 120, 100), hit(hitTree, treeX + 8, treeBase - 60, 110, 120), hit(hitBird, 236, 250, 40, 34), hit(hitSun, 96, 62, 90, 90));

  // --- reactions
  const lamp = s.input('trigger', 'lamp');
  s.triggerLayer('lamp', lamp, s.anim({ name: 'lamp', duration: 420, tracks: [{ object: glowId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [24, 1, 'hold'], [330, 1, 'cubic', EASE.inOut], [420, 0]] }] }));
  s.listen(hitHouse, 'click', [Scene.fire(lamp)]);

  const rustle = s.input('trigger', 'rustle');
  s.triggerLayer('rustle', rustle, s.anim({ name: 'rustle', duration: 150, tracks: [
    { object: canopyRustle, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [10, 0.05, 'cubic', EASE.inOut], [24, -0.035, 'cubic', EASE.inOut], [40, 0.018, 'cubic', EASE.inOut], [58, 0]] },
    { object: leafId, prop: 'opacity', keys: [[0, 0, 'linear'], [8, 1, 'hold'], [120, 1, 'linear'], [150, 0]] },
    sampled(leafId, 'y', 150, 10, (t) => treeBase - 92 + t * 104),
    sampled(leafId, 'x', 150, 10, (t) => treeX + 30 + Math.sin(t * 9) * 10 + t * 14),
    sampled(leafId, 'rotation', 150, 10, (t) => Math.sin(t * 9) * 0.7),
  ] }));
  s.listen(hitTree, 'enter', [Scene.fire(rustle)]);
  s.listen(hitTree, 'click', [Scene.fire(rustle)]);

  const hop = s.input('trigger', 'hop');
  s.triggerLayer('hop', hop, s.anim({ name: 'hop', duration: 54, tracks: [
    { object: birdId, prop: 'y', keys: [[0, 258, 'cubic', EASE.out], [10, 240, 'cubic', EASE.in], [20, 258, 'linear'], [24, 258, 'cubic', EASE.out], [31, 249, 'cubic', EASE.in], [38, 258]] },
    { object: birdId, prop: 'scaleY', keys: [[0, 1.02, 'cubic', EASE.out], [8, 1.35, 'linear'], [20, 1.07, 'cubic', EASE.out], [26, 1.3, 'linear'], [38, 1.12, 'cubic', EASE.out], [54, 1.25]] },
    { object: birdId, prop: 'scaleX', keys: [[0, 1.38, 'cubic', EASE.out], [8, 1.19, 'linear'], [20, 1.35, 'cubic', EASE.out], [38, 1.31, 'cubic', EASE.out], [54, 1.25]] },
  ] }));
  s.listen(hitBird, 'enter', [Scene.fire(hop)]);
  s.listen(hitBird, 'click', [Scene.fire(hop)]);

  const spin = s.input('trigger', 'shine');
  s.triggerLayer('shine', spin, s.anim({ name: 'shine', duration: 70, tracks: [
    { object: sunId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [14, 1.18, 'cubic', EASE.inOut], [70, 1]] },
    { object: sunId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [14, 1.18, 'cubic', EASE.inOut], [70, 1]] },
  ] }));
  s.listen(hitSun, 'enter', [Scene.fire(spin)]);

  return s.toXml();
}

// ---------- name highlighter ----------

function highlight(ids) {
  const s = new Scene(ids, { name: 'Highlight', w: 240, h: 56, x: 960, y: 0 });
  const r = rng(7);
  const swipeId = ids.next();
  // a highlighter-ish swipe: long, slightly tilted, ragged at the ends
  const top = [], bot = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    top.push(P(t * 224 + r.jit(2), 14 - t * 3 + r.jit(1.6) + (i === 0 || i === 10 ? 4 : 0)));
    bot.push(P(t * 224 + r.jit(2), 44 - t * 2 + r.jit(1.6) - (i === 0 || i === 10 ? 3 : 0)));
  }
  const outline = [...top, ...bot.reverse()];
  s.add(group({ name: 'swipe', x: 8, y: 0, id: swipeId, scaleX: 0 }, [
    paint(outline, C.lamp, r, { alpha: 0.7, off: [0, 0], wobble: 1.2, grain: 0.7 }),
    paint(outline.map((p) => P(p.x * 0.6 + 30, p.y)), C.ochre, r, { alpha: 0.18, off: [0, 2], wobble: 2, grain: 0 }),
  ]));
  const intro = s.anim({ name: 'swipe in', duration: 50, tracks: [{ object: swipeId, prop: 'scaleX', keys: [[0, 0, 'cubic', EASE.out], [50, 1]] }] });
  s.sequenceLayer('intro', [intro]);
  const again = s.input('trigger', 'swipe');
  s.triggerLayer('again', again, s.anim({ name: 'swipe again', duration: 46, tracks: [
    { object: swipeId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.in], [8, 0.92, 'cubic', EASE.out], [46, 1]] },
    { object: swipeId, prop: 'y', keys: [[0, 0, 'cubic', EASE.out], [8, 1.5, 'cubic', EASE.out], [46, 0]] },
  ] }));
  return s.toXml();
}

// ---------- section swatches ----------

function swatch(ids, i, color, accent) {
  const s = new Scene(ids, { name: `Swatch${i}`, w: 180, h: 64, x: 960, y: 100 + i * 100 });
  const r = rng(300 + i * 17);
  const nodeId = ids.next();
  const wetId = ids.next();
  const outline = blobPts(70, 17, r, { n: 14, wobble: 0.16, start: r.range(0, TAU) }).map((p) => P(p.x, p.y + r.jit(2)));
  s.add(group({ name: 'swatch', x: 84, y: 32, id: nodeId, opacity: 0, scaleX: 0.35, scaleY: 0.5 }, [
    paint(outline, color, r, { alpha: 0.55, off: [0, 0], wobble: 1.5, grain: 1 }),
    group({ name: 'bloom', id: wetId, x: r.jit(20), y: 0, scaleX: 0.3, scaleY: 0.3 }, [
      paint(blobPts(22, 10, r, { n: 9, wobble: 0.2 }), accent, r, { alpha: 0.32, off: [0, 0], wobble: 1, grain: 0.3 }),
    ]),
  ]));
  const show = s.input('bool', 'show', process.env.SK_SHOW ? 1 : 0);
  const hidden = s.anim({ name: 'hidden', duration: 1, tracks: [{ object: nodeId, prop: 'opacity', keys: [[0, 0, 'hold']] }] });
  const bloom = s.anim({ name: 'bloom', duration: 110, tracks: [
    { object: nodeId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [30, 1]] },
    { object: nodeId, prop: 'scaleX', keys: [[0, 0.35, 'cubic', EASE.out], [70, 1]] },
    { object: nodeId, prop: 'scaleY', keys: [[0, 0.5, 'cubic', EASE.out], [60, 1]] },
    { object: wetId, prop: 'scaleX', keys: [[20, 0.3, 'cubic', EASE.out], [110, 1.15]] },
    { object: wetId, prop: 'scaleY', keys: [[20, 0.3, 'cubic', EASE.out], [110, 1.1]] },
  ] });
  s.boolLayer('bloom', show, hidden, bloom, { mixIn: 0, mixOut: 300 });
  return s.toXml();
}

export default function () {
  const ids = new Ids(10);
  const swatches = [
    [C.sap, C.ochre],
    [C.sky, C.violet],
    [C.terra, C.ochre],
    [C.rose, C.violet],
    [C.ochre, C.sap],
  ].map(([c, a], i) => swatch(ids, i, c, a));
  return document(hero(ids), highlight(ids), ...swatches);
}
