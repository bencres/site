// Draft 8 · Rings — the site as a transverse section of a tree trunk.
// Growth rings are years: the pith is "about", older heartwood is work,
// then projects, writing, the pale sapwood is "now", and the bark faces the
// outside world ("elsewhere"). Hover/click is resolved in page JS against the
// same ring geometry, which this generator exports to site/rings/geometry.json.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  Ids, Scene, rng, P, TAU, el, argb, document, boil, inkShape, pathXml, stroke, fill,
  stippleShape, washShape, watercolor, blobPts, jitterPts, EASE,
} from '../lib/ink.mjs';

const W = 900;
const C = P(450, 452); // centre of the outer ring
const R = 300; // face radius (outer edge of sapwood)
const PITH = P(-24, -16); // pith offset: real trunks grow eccentric
const INK = '3B2A1E';
const SKIP = (process.env.SKIP || '').split(',');
const skip = (k) => (SKIP.includes(k) ? 0 : undefined);
const RING_INK = '5E3F27';

// one smooth wobble shared by every ring keeps them concentric-coherent
const HARM = [
  { k: 2, a: 0.03, p: 0.7 },
  { k: 3, a: 0.02, p: 2.1 },
  { k: 5, a: 0.009, p: 4.0 },
  { k: 7, a: 0.005, p: 1.3 },
];
const shape = (th) => 1 + HARM.reduce((s, h) => s + h.a * Math.sin(h.k * th + h.p), 0);
const centerAt = (t) => P(C.x + PITH.x * (1 - t), C.y + PITH.y * (1 - t));

function ringPts(t, r, { n = 60, own = 0.008 } = {}) {
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  const c = centerAt(t);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    const wob = own * (Math.sin(4 * th + ph[0]) + 0.6 * Math.sin(9 * th + ph[1]) + 0.4 * Math.sin(13 * th + ph[2]));
    const rr = t * R * shape(th) * (1 + wob);
    pts.push(P(c.x + Math.cos(th) * rr, c.y + Math.sin(th) * rr));
  }
  return pts;
}

// the sections, from the pith outward; `t` is each band's outer boundary
const BANDS = [
  { id: 'about', letter: 'a', label: 'pith — who I am', t: 0.11, rings: 1, color: 'C9483C', angle: -112 },
  { id: 'work', letter: 'b', label: 'heartwood — work', t: 0.42, rings: 4, color: '5F8DB8', angle: 206 },
  { id: 'projects', letter: 'c', label: 'things I’ve made', t: 0.64, rings: 3, color: '7FA35E', angle: 152 },
  { id: 'writing', letter: 'd', label: 'writing', t: 0.84, rings: 3, color: 'D29A35', angle: 18 },
  { id: 'now', letter: 'e', label: 'sapwood — now', t: 1.0, rings: 3, color: 'C8664E', angle: -34 },
  { id: 'elsewhere', letter: 'f', label: 'bark — elsewhere', t: 1.085, rings: 0, color: '4E6B3A', angle: 64 },
];

export default function () {
  const ids = new Ids();
  const s = new Scene(ids, { name: 'Slice', w: W, h: W, bg: process.env.PREVIEW_BG });
  const r = rng(808);

  // ---------- ring radii: years of uneven growth inside each band
  const ringTs = [];
  let prev = 0;
  for (const b of BANDS.slice(0, 5)) {
    const span = b.t - prev;
    const ws = Array.from({ length: b.rings }, () => r.range(0.7, 1.3));
    const sum = ws.reduce((a, x) => a + x, 0);
    let acc = prev;
    ws.forEach((w, i) => {
      acc += (span * w) / sum;
      ringTs.push(i === ws.length - 1 ? b.t : acc);
    });
    prev = b.t;
  }
  // a couple of extra hairline rings inside wide years, for texture
  const fineTs = [];
  for (let i = 1; i < ringTs.length; i++) if (r() < 0.6) fineTs.push((ringTs[i - 1] + ringTs[i]) / 2 + r.jit(0.01));

  const ringGeo = ringTs.map((t) => ({ t, pts: ringPts(t, rng(Math.round(t * 1e5))) }));
  const facePts = ringGeo[ringGeo.length - 1].pts;
  const barkR = rng(31);
  const barkPts = facePts.map((p, i) => {
    const th = (i / facePts.length) * TAU;
    const k = 1.085 + 0.02 * Math.sin(th * 11 + 1) + barkR.jit(0.012);
    return P(C.x + (p.x - C.x) * k, C.y + (p.y - C.y) * k);
  });

  // ---------- cast shadow + bark
  s.add(el('Shape', { name: 'Shadow', x: 16, y: 26, opacity: skip('shadow') }, [pathXml(barkPts, { closed: true }), fill(argb('3A2A1E', 0.28), { feather: 34 })]));
  // bark: a full disc underneath; the sapwood face is painted opaque over it
  s.add(washShape({ opacity: skip('bark'), name: 'BarkWash', pts: barkPts, color: '6B4A32', alpha: 0.85, edge: 0.9, soft: 1.4, blend: 'srcOver' }));
  s.add(washShape({ opacity: skip('bark'), name: 'BarkWash2', pts: jitterPts(barkPts, 3, r).map((p) => P(p.x + 3, p.y - 2)), color: '8A6A4A', alpha: 0.4, edge: 0.4, soft: 4 }));

  // ---------- wood face: pale sapwood, darker heartwood, warmer core
  const faceId = ids.next();
  s.add(washShape({ opacity: skip('sap'), id: faceId, name: 'Sapwood', pts: facePts, color: 'ECCD9B', alpha: 1, edge: 0.6, soft: 0.8, blend: 'srcOver' }));
  s.add(washShape({ opacity: skip('heart'), name: 'Heartwood', pts: jitterPts(ringGeo[10].pts, 2.5, r).map((p) => P(p.x + 2, p.y + 2)), color: 'CD9358', alpha: 0.55, edge: 0.9, soft: 2.2 }));
  s.add(washShape({ opacity: skip('core'), name: 'Core', pts: jitterPts(ringPts(0.36, rng(4)), 3, r), color: 'B9783F', alpha: 0.32, edge: 0.5, soft: 8 }));
  // grain: a faint radial stipple
  const grain = [];
  for (let i = 0; i < 900; i++) {
    const th = r() * TAU;
    const t = Math.sqrt(r()) * 0.98;
    const c = centerAt(t);
    grain.push({ x: c.x + Math.cos(th) * t * R * shape(th), y: c.y + Math.sin(th) * t * R * shape(th), r: r.range(0.35, 0.8) });
  }
  s.add(stippleShape({ opacity: skip('grain'), name: 'Grain', dots: grain, color: argb('7A5232', 0.32) }));

  // ---------- light dapple drifting across the cut face (kept well inside it)
  const dapples = [];
  for (let i = 0; i < 5; i++) {
    const id = ids.next();
    const light = i < 3;
    const x = C.x + r.jit(110);
    const y = C.y + r.jit(110);
    dapples.push({ id, x, y, dx: r.jit(60), dy: r.jit(50), dur: Math.round(r.range(600, 900)) });
    s.add(el('Shape', { name: light ? 'Sun' : 'LeafShadow', id, x, y, opacity: skip('dapple') }, [
      pathXml(blobPts(r.range(50, 85), r.range(35, 65), r, { n: 9, wobble: 0.25 }), { closed: true }),
      fill(light ? argb('FFF3D2', 0.3) : argb('3A2A1E', 0.08), { feather: 38 }),
    ]));
  }
  dapples.forEach((d, i) => s.loopLayer(`Dapple ${i}`, s.anim({
    name: `Dapple ${i}`, duration: d.dur, loop: 'pingPong',
    tracks: [
      { object: d.id, prop: 'x', keys: [[0, d.x, 'cubic', EASE.inOut], [d.dur, d.x + d.dx]] },
      { object: d.id, prop: 'y', keys: [[0, d.y, 'cubic', EASE.inOut], [d.dur, d.y + d.dy]] },
    ],
  })));

  // ---------- band highlights (driven by bools from page JS)
  const hl = BANDS.map((b, i) => {
    const id = ids.next();
    const outer = b.id === 'elsewhere' ? barkPts : ringGeo[ringTs.indexOf(b.t)].pts;
    const innerT = i === 0 ? null : BANDS[i - 1].t;
    const contours = [pathXml(outer, { closed: true })];
    if (innerT) contours.push(pathXml([...(innerT === 1 ? facePts : ringGeo[ringTs.indexOf(innerT)].pts)].reverse(), { closed: true }));
    s.add(el('Shape', { name: `HL ${b.id}`, id, opacity: 0, blendModeValue: 'multiply' }, [...contours, fill(argb(b.id === 'elsewhere' ? 'A9C27A' : b.color, SKIP.includes('hl') ? 0 : b.id === 'elsewhere' ? 0.85 : 0.3), { rule: 'evenOdd' })]));
    return { ...b, hlId: id };
  });

  // latewood: a soft dark band just inside each ring line (static, not boiled)
  for (const g of ringGeo) {
    if (g.t > 1) continue;
    const pts = g.pts.map((p) => {
      const c = centerAt(g.t);
      return P(c.x + (p.x - c.x) * 0.985, c.y + (p.y - c.y) * 0.985);
    });
    s.add(el('Shape', { name: 'Latewood', blendModeValue: 'multiply' }, [pathXml(pts, { closed: true }), stroke(argb('9A6436', 0.22), 5, { feather: 3 })]));
  }

  // ---------- ring lines: each draws on from its own random start, pith outward
  const ringFx = ringGeo.map(() => ({ fx: ids.next(), trim: ids.next(), offset: r() }));
  ringFx.forEach((f) => s.add(el('GroupEffect', { name: 'RingDraw', id: f.fx }, el('TrimPath', { start: 0, end: 0, offset: f.offset, id: f.trim, name: 'Trim' }))));
  const fineFx = ids.next();
  const fineTrim = ids.next();
  s.add(el('GroupEffect', { name: 'FineDraw', id: fineFx }, el('TrimPath', { end: 0, id: fineTrim, name: 'Trim' })));
  const ringBoil = boil(s, {
    name: 'Rings', seed: 12, hold: 9,
    draw: (rr) => [
      ...ringGeo.map((g, i) => inkShape({ name: 'Ring', pts: jitterPts(g.pts, 0.7, rr), closed: true, color: argb(RING_INK, 0.8), width: i % 3 === 2 ? 1.5 : 1.1, bleed: 0.12, effect: ringFx[i].fx })),
      ...fineTs.map((t) => inkShape({ name: 'Fine', pts: jitterPts(ringPts(t, rng(Math.round(t * 1e5))), 0.6, rr), closed: true, color: argb(RING_INK, 0.35), width: 0.7, bleed: 0, effect: fineFx })),
    ],
  });
  s.add(ringBoil.xml);
  s.loopLayer('Ring boil', ringBoil.animId);

  // pith: a dark speck with a stippled halo
  const pc = centerAt(0);
  const pithDots = [];
  for (let i = 0; i < 70; i++) {
    const th = r() * TAU;
    const d = Math.pow(r(), 0.7) * 11;
    pithDots.push({ x: pc.x + Math.cos(th) * d, y: pc.y + Math.sin(th) * d, r: r.range(0.4, 1.2) });
  }
  s.add(stippleShape({ name: 'Pith', dots: pithDots, color: argb(INK, 0.85) }));

  // knots: little swirls where branches once were
  for (const [t, th] of [[0.55, 2.4], [0.74, 5.6]]) {
    const c = centerAt(t);
    const kx = c.x + Math.cos(th) * t * R * shape(th);
    const ky = c.y + Math.sin(th) * t * R * shape(th);
    s.add(watercolor({ name: 'Knot', x: kx, y: ky, rx: 11, ry: 7, color: '6B4127', seed: Math.round(t * 99), alpha: 0.75, n: 9, grain: false }));
    const kb = boil(s, {
      name: 'KnotInk', x: kx, y: ky, seed: Math.round(th * 10), hold: 9,
      draw: (rr) => [0.5, 0.9, 1.35].map((k) => inkShape({ pts: blobPts(11 * k, 7 * k, rr, { n: 8, wobble: 0.1 }), closed: true, color: argb(RING_INK, 0.7), width: 0.9, bleed: 0.1 })),
    });
    s.add(kb.xml);
    s.loopLayer('Knot boil', kb.animId);
  }

  // ---------- checking cracks: jagged radial splits from the bark inward
  const crackFx = ids.next();
  const crackTrim = ids.next();
  s.add(el('GroupEffect', { name: 'CrackDraw', id: crackFx }, el('TrimPath', { end: 0, id: crackTrim, name: 'Trim' })));
  const cracks = [[0.4, 0.46], [1.95, 0.3], [3.5, 0.38], [4.6, 0.22], [5.35, 0.27]].map(([th, depth], i) => {
    const cr = rng(70 + i);
    const drift = cr.jit(0.05);
    const pts = [];
    const steps = 7;
    for (let k = 0; k <= steps; k++) {
      const t = 1.05 - (k / steps) * depth;
      const a = th + cr.jit(0.008) + (k / steps) * drift;
      const c = centerAt(t);
      pts.push(P(c.x + Math.cos(a) * t * R * shape(a), c.y + Math.sin(a) * t * R * shape(a)));
    }
    return { pts, th };
  });
  // each split is a thin dark wedge, widest at the bark, closing to nothing inside
  for (const ck of cracks) {
    const n = ck.pts.length - 1;
    const nx = Math.cos(ck.th + Math.PI / 2);
    const ny = Math.sin(ck.th + Math.PI / 2);
    const side = (sgn) => ck.pts.map((p, k) => P(p.x + nx * sgn * (1 - k / n) * 3.2, p.y + ny * sgn * (1 - k / n) * 3.2));
    const wedge = [...side(1), ...side(-1).reverse().slice(1)];
    s.add(el('Shape', { name: 'CrackShade' }, [pathXml(wedge, { closed: true, tension: 0.3 }), fill(argb('2E1C10', 0.85))]));
  }
  const crackBoil = boil(s, {
    name: 'Cracks', seed: 41, hold: 8,
    draw: (rr) => cracks.map((ck) => inkShape({ pts: jitterPts(ck.pts, 0.5, rr), tension: 0.6, color: argb(INK, 0.9), width: 0.9, bleed: 0.2, effect: crackFx })),
  });
  s.add(crackBoil.xml);
  s.loopLayer('Crack boil', crackBoil.animId);

  // ---------- bark: outline + fissures
  const barkFx = ids.next();
  const barkTrim = ids.next();
  s.add(el('GroupEffect', { name: 'BarkDraw', id: barkFx }, el('TrimPath', { end: 0, offset: 0.3, id: barkTrim, name: 'Trim' })));
  const fiss = [];
  for (let i = 0; i < 92; i++) {
    const th = (i / 92) * TAU + r.jit(0.02);
    const a = Math.round((th / TAU) * facePts.length) % facePts.length;
    const p0 = facePts[a];
    const p1 = barkPts[a];
    const f0 = r.range(0.15, 0.4);
    const f1 = r.range(0.7, 1.0);
    fiss.push([P(p0.x + (p1.x - p0.x) * f0, p0.y + (p1.y - p0.y) * f0), P(p0.x + (p1.x - p0.x) * f1 + r.jit(2), p0.y + (p1.y - p0.y) * f1 + r.jit(2))]);
  }
  const barkBoil = boil(s, {
    name: 'Bark', seed: 52, hold: 8,
    draw: (rr) => [
      inkShape({ name: 'BarkOuter', pts: jitterPts(barkPts, 0.9, rr), closed: true, color: argb(INK, 1), width: 1.8, bleed: 0.2, effect: barkFx }),
      inkShape({ name: 'BarkInner', pts: jitterPts(facePts, 0.6, rr), closed: true, color: argb(INK, 0.9), width: 1.2, bleed: 0.1, effect: barkFx }),
      el('Shape', { name: 'Fissures' }, [...fiss.map((f) => pathXml(jitterPts(f, 0.6, rr))), stroke(argb(INK, 0.75), 1, { effect: barkFx })]),
    ],
  });
  s.add(barkBoil.xml);
  s.loopLayer('Bark boil', barkBoil.animId);

  // ---------- moss on the bark, breathing
  const mossId = ids.next();
  const mth = 3.95;
  const mp = barkPts[Math.round((mth / TAU) * barkPts.length)];
  const mossDots = Array.from({ length: 120 }, () => ({ x: r.jit(34), y: r.jit(18), r: r.range(0.5, 1.3) }));
  s.add(el('Node', { name: 'Moss', id: mossId, x: mp.x + 4, y: mp.y + 6, rotation: mth + Math.PI / 2 }, [
    stippleShape({ name: 'MossDots', dots: mossDots, color: argb('3F5A2C', 0.65) }),
    watercolor({ name: 'MossWash2', x: 14, y: 4, rx: 18, ry: 10, color: 'A9B860', seed: 6, alpha: 0.7, grain: false }),
    watercolor({ name: 'MossWash', rx: 34, ry: 15, color: '6E8F43', seed: 5, alpha: 0.8 }),
  ]));
  s.loopLayer('Moss', s.anim({
    name: 'Moss breathe', duration: 260, loop: 'pingPong',
    tracks: [
      { object: mossId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [260, 1.05]] },
      { object: mossId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [260, 1.08]] },
    ],
  }));

  // ---------- seedling sprouting from the widest crack
  const sproutId = ids.next();
  const stemTrim = ids.next();
  const stemFx = ids.next();
  const leafL = ids.next();
  const leafR = ids.next();
  const sp = cracks[1].pts[1];
  s.add(el('GroupEffect', { name: 'StemDraw', id: stemFx }, el('TrimPath', { end: 0, id: stemTrim, name: 'Trim' })));
  const cotyledon = (id, side) => el('Node', { name: 'Cotyledon', id, x: 3, y: -34, scaleX: 0, scaleY: 0, rotation: side * 0.5 }, [
    inkShape({ pts: [P(0, 0), P(side * 8, -5), P(side * 16, -3), P(side * 9, 2), P(0, 0)], closed: true, tension: 0.8, color: argb(INK, 1), width: 1.1, bleed: 0.1 }),
    washShape({ x: side * 1.5, y: 1, pts: [P(0, 0), P(side * 8, -5), P(side * 16, -3), P(side * 9, 2)], color: '8DBA5A', alpha: 0.9, tension: 0.8, edge: 0.6 }),
  ]);
  s.add(el('Node', { name: 'Sprout', id: sproutId, x: sp.x, y: sp.y }, [
    cotyledon(leafR, 1),
    cotyledon(leafL, -1),
    inkShape({ name: 'Stem', pts: [P(0, 0), P(-3, -12), P(1, -24), P(3, -34)], color: argb('3F5A2C', 1), width: 1.5, bleed: 0.15, effect: stemFx }),
  ]));
  const sway = s.anim({ name: 'Sprout sway', duration: 200, loop: 'pingPong', tracks: [{ object: sproutId, prop: 'rotation', keys: [[0, -0.06, 'cubic', EASE.inOut], [200, 0.07]] }] });
  s.loopLayer('Sprout sway', sway);

  // ---------- sawdust on the paper below the slice
  const dust = [];
  for (let i = 0; i < 140; i++) {
    const th = r.range(0.35, 2.6);
    const d = R * 1.12 + Math.pow(r(), 2) * 70;
    dust.push({ x: C.x + Math.cos(th) * d + r.jit(12), y: C.y + Math.sin(th) * d * 0.98, r: r.range(0.5, 1.6) });
  }
  s.add(stippleShape({ name: 'Sawdust', dots: dust, color: argb('B98A55', 0.75) }));
  for (let i = 0; i < 6; i++) {
    const th = r.range(0.6, 2.4);
    const d = R * 1.16 + r() * 40;
    s.add(inkShape({ name: 'Curl', x: C.x + Math.cos(th) * d, y: C.y + Math.sin(th) * d, pts: [P(-5, 0), P(0, -3), P(4, 0), P(1, 3), P(-1, 1)], tension: 0.9, color: argb('8A6038', 0.8), width: 0.8, bleed: 0 }));
  }

  // ---------- leader lines out to the plate letters
  const leaderFx = ids.next();
  const leaderTrim = ids.next();
  s.add(el('GroupEffect', { name: 'LeaderDraw', id: leaderFx }, el('TrimPath', { end: 0, id: leaderTrim, name: 'Trim' })));
  const labels = [];
  hl.forEach((b, i) => {
    const th = (b.angle * Math.PI) / 180;
    const innerT = i === 0 ? 0 : BANDS[i - 1].t;
    const midT = i === 0 ? 0.02 : (innerT + b.t) / 2;
    const c = centerAt(midT);
    const start = P(c.x + Math.cos(th) * midT * R * shape(th), c.y + Math.sin(th) * midT * R * shape(th));
    const endR = R * 1.24;
    const end = P(C.x + Math.cos(th) * endR, C.y + Math.sin(th) * endR);
    const tail = P(end.x + (Math.cos(th) >= 0 ? 16 : -16), end.y);
    const mid = P((start.x + end.x) / 2 + r.jit(8), (start.y + end.y) / 2 + r.jit(8));
    const dotId = ids.next();
    s.add(inkShape({ name: `Leader ${b.id}`, pts: [start, mid, end, tail], tension: 0.5, color: argb(INK, 0.85), width: 0.9, bleed: 0.1, effect: leaderFx }));
    s.add(el('Shape', { name: `Dot ${b.id}`, id: dotId, x: start.x, y: start.y, scaleX: 0, scaleY: 0 }, [el('Ellipse', { width: 5, height: 5, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb(INK, 1))]));
    b.dotId = dotId;
    labels.push({ id: b.id, letter: b.letter, label: b.label, x: tail.x / W, y: tail.y / W, side: Math.cos(th) >= 0 ? 'right' : 'left' });
  });

  // ---------- ant, wandering the cut face with a tripod gait
  const antId = ids.next();
  const antBody = [
    el('Ellipse', { x: 7, width: 5.4, height: 4.6, originX: 0.5, originY: 0.5, name: 'head' }),
    el('Ellipse', { x: 1, width: 5.6, height: 3.6, originX: 0.5, originY: 0.5, name: 'thorax' }),
    el('Ellipse', { x: -7, width: 10, height: 6.6, originX: 0.5, originY: 0.5, name: 'gaster' }),
  ];
  const legs = (phase) => {
    const paths = [];
    for (const side of [-1, 1]) {
      [-1, 0, 1].forEach((k, j) => {
        const swing = ((j + (side > 0 ? 1 : 0) + phase) % 2 ? 1 : -1) * 2.4;
        paths.push(pathXml([P(1 + k * 1.5, 0), P(1 + k * 3 + swing * 0.5, side * 4.5), P(1 + k * 5.5 + swing, side * 8)], { tension: 0.4 }));
      });
    }
    paths.push(pathXml([P(9, -1), P(13, -4), P(16, -3)], { tension: 0.6 }));
    paths.push(pathXml([P(9, 1), P(13, 4), P(16, 3)], { tension: 0.6 }));
    return paths;
  };
  const gaitIds = [ids.next(), ids.next()];
  const gaitSolo = ids.next();
  s.add(el('Node', { name: 'Ant', id: antId, x: C.x, y: C.y, opacity: 0, scaleX: 1.15, scaleY: 1.15 }, [
    el('Shape', { name: 'AntBody' }, [...antBody, fill(argb('2A1D14', 1))]),
    el('Solo', { name: 'Gait', id: gaitSolo, activeComponentId: gaitIds[0] }, gaitIds.map((gid, ph) => el('Node', { name: `step${ph}`, id: gid }, el('Shape', { name: 'Legs' }, [...legs(ph), stroke(argb('2A1D14', 1), 0.9)])))),
  ]));
  s.loopLayer('Gait', s.anim({ name: 'Gait', duration: 10, loop: 'loop', tracks: [{ object: gaitSolo, prop: 'activeComponentId', type: 'Id', keys: [[0, gaitIds[0], 'hold'], [5, gaitIds[1], 'hold']] }] }));
  // a closed wandering route; the ant pauses now and then
  const ar = rng(5150);
  const way = [];
  for (let i = 0; i < 9; i++) {
    const th = (i / 9) * TAU + ar.jit(0.35);
    const t = ar.range(0.35, 0.88);
    way.push(P(C.x + Math.cos(th) * t * R, C.y + Math.sin(th) * t * R * 0.95));
  }
  const route = [];
  const N = way.length;
  for (let i = 0; i < N; i++) {
    const p0 = way[(i - 1 + N) % N], p1 = way[i], p2 = way[(i + 1) % N], p3 = way[(i + 2) % N];
    for (let k = 0; k < 6; k++) {
      const u = k / 6;
      const u2 = u * u, u3 = u2 * u;
      const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
      route.push(P(cr(p0.x, p1.x, p2.x, p3.x), cr(p0.y, p1.y, p2.y, p3.y)));
    }
  }
  route.push(route[0]);
  const xs = [], ys = [], rs = [];
  let f = 0;
  let prevA = 0;
  const speed = 0.55; // px per frame
  for (let i = 0; i < route.length; i++) {
    const nx = route[Math.min(i + 1, route.length - 1)];
    const p = route[i];
    let a = Math.atan2(nx.y - p.y, nx.x - p.x);
    if (i === route.length - 1) a = rs[0][1];
    while (a - prevA > Math.PI) a -= TAU;
    while (a - prevA < -Math.PI) a += TAU;
    prevA = a;
    xs.push([Math.round(f), p.x, 'linear']);
    ys.push([Math.round(f), p.y, 'linear']);
    rs.push([Math.round(f), a, 'linear']);
    if (i < route.length - 1) {
      const d = Math.hypot(nx.x - p.x, nx.y - p.y);
      if (i % 13 === 7) {
        // pause to sniff the air
        f += 70;
        xs.push([Math.round(f), p.x, 'linear']);
        ys.push([Math.round(f), p.y, 'linear']);
        rs.push([Math.round(f), a, 'linear']);
      }
      f += d / speed;
    }
  }
  // the route closes, so the last heading equals the first up to whole turns:
  // the loop's wrap jump is invisible.
  const antDur = Math.round(f);
  s.loopLayer('Ant walk', s.anim({
    name: 'Ant walk', duration: antDur, loop: 'loop',
    tracks: [{ object: antId, prop: 'x', keys: xs }, { object: antId, prop: 'y', keys: ys }, { object: antId, prop: 'rotation', keys: rs }],
  }));

  // ---------- intro (with a "still" escape hatch for reduced motion)
  const introTracks = [];
  ringFx.forEach((fx, i) => introTracks.push({ object: fx.trim, prop: 'end', keys: [[0, 0, 'hold'], [8 + i * 7, 0, 'cubic', [0.5, 0.05, 0.25, 1]], [8 + i * 7 + 46, 1]] }));
  introTracks.push({ object: fineTrim, prop: 'end', keys: [[0, 0, 'hold'], [60, 0, 'cubic', EASE.out], [150, 1]] });
  introTracks.push({ object: barkTrim, prop: 'end', keys: [[0, 0, 'hold'], [96, 0, 'cubic', EASE.out], [160, 1]] });
  introTracks.push({ object: crackTrim, prop: 'end', keys: [[0, 0, 'hold'], [140, 0, 'cubic', EASE.out], [185, 1]] });
  introTracks.push({ object: leaderTrim, prop: 'end', keys: [[0, 0, 'hold'], [170, 0, 'cubic', EASE.out], [235, 1]] });
  hl.forEach((b, i) => {
    for (const prop of ['scaleX', 'scaleY']) introTracks.push({ object: b.dotId, prop, keys: [[0, 0, 'hold'], [168 + i * 4, 0, 'cubic', EASE.back], [188 + i * 4, 1]] });
  });
  introTracks.push({ object: antId, prop: 'opacity', keys: [[0, 0, 'hold'], [210, 0, 'cubic', EASE.out], [250, 1]] });
  introTracks.push({ object: stemTrim, prop: 'end', keys: [[0, 0, 'hold'], [215, 0, 'cubic', EASE.out], [260, 1]] });
  for (const lf of [leafL, leafR]) for (const prop of ['scaleX', 'scaleY']) introTracks.push({ object: lf, prop, keys: [[0, 0, 'hold'], [250, 0, 'cubic', EASE.back], [280, 1]] });
  const intro = s.anim({ name: 'Intro', duration: 290, tracks: introTracks });
  // final pose: every intro track at its last value
  const doneId = s.anim({ name: 'Drawn', duration: 1, tracks: introTracks.map((t) => ({ ...t, keys: [[0, t.keys[t.keys.length - 1][1], 'hold']] })) });
  const still = s.input('bool', 'still', 0);
  const stIntro = ids.next();
  const stDone = ids.next();
  s.layers.push(el('StateMachineLayer', { name: 'Intro', id: ids.next() }, [
    el('AnyState', { x: 200, y: -140 }, el('StateTransition', { stateToId: stDone, duration: 0 }, el('TransitionBoolCondition', { inputId: still, opValue: 'equal' }))),
    el('ExitState', { x: 500, y: -140 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: stIntro })),
    el('AnimationState', { x: 200, y: 0, animationId: intro, id: stIntro }),
    el('AnimationState', { x: 400, y: 0, animationId: doneId, id: stDone }),
  ]));

  // ---------- highlight layers: one bool per band
  hl.forEach((b) => {
    const input = s.input('bool', `hl_${b.id}`, 0);
    const off = s.anim({ name: `${b.id} off`, duration: 1, tracks: [{ object: b.hlId, prop: 'opacity', keys: [[0, 0]] }] });
    const on = s.anim({
      name: `${b.id} on`, duration: 90, loop: 'pingPong',
      tracks: [{ object: b.hlId, prop: 'opacity', keys: [[0, 0.85, 'cubic', EASE.inOut], [90, 1]] }],
    });
    s.boolLayer(`HL ${b.id}`, input, off, on, { mixIn: 260, mixOut: 520 });
  });

  // geometry for page JS: band hit-testing + label placement
  const geo = {
    size: W, center: C, R, pith: PITH, harmonics: HARM,
    bands: BANDS.map((b) => ({ id: b.id, t: b.t })),
    labels,
  };
  writeFileSync(fileURLToPath(new URL('../../site/rings/geometry.json', import.meta.url)), JSON.stringify(geo, null, 1));

  return document(s.toXml());
}
