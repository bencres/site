// Draft 6 · Harbor — a loose urban-sketch of a boathouse on stilts.
// The pen draws once, confidently, with overshoots and pen-lifts; then the
// washes flood in, loose and saturated, and the reflection keeps shimmering.
import { Ids, Scene, rng, P, TAU, el, argb, document, boil, pathXml, stroke, fill, darken, lighten, blobPts, EASE } from '../lib/ink.mjs';

const W = 1200;
const H = 1000;
const WATER = 640;
const INK = 'FF1F1D24';
const PAL = {
  ochre: 'E3A92B',
  ochreSide: 'EFC56A',
  rust: 'C2452D',
  cerulean: '3E8FCB',
  ultra: '3A55B4',
  sap: '8DB33A',
  lemon: 'E9D23C',
  umber: '5B4636',
  red: 'D23A3A',
  shadow: '4A4F86',
};

// ------------------------------------------------------------ pen marks

/**
 * A sketcher's straight line from a to b: overshoots the corners, bows a hair,
 * and sometimes lifts the pen mid-stroke or goes over itself a second time.
 */
function sketchSeg(a, b, r, { over = [2, 11], lift = 0.3, bow = 0.01, restroke = 0.14 } = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const e0 = r.range(...over) * (r() < 0.55 ? 1 : 0.25);
  const e1 = r.range(...over) * (r() < 0.7 ? 1 : 0.3);
  const s = P(a.x - ux * e0, a.y - uy * e0);
  const total = L + e0 + e1;
  const cuts = [[0, 1]];
  if (L > 70 && r() < lift) {
    const t = r.range(0.3, 0.7);
    const g = r.range(4, 11) / total;
    cuts.splice(0, 1, [0, t - g / 2], [t + g / 2, 1]);
  }
  const bowAmt = L * bow * r.jit(1);
  const piece = (t0, t1, off = 0) => {
    const n = Math.max(2, Math.min(5, Math.round(((t1 - t0) * total) / 60) + 1));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      const d = t * total;
      const b2 = Math.sin(Math.PI * t) * bowAmt + off;
      pts.push(P(s.x + ux * d + nx * (b2 + r.jit(0.5)), s.y + uy * d + ny * (b2 + r.jit(0.5))));
    }
    return pts;
  };
  const out = cuts.map(([t0, t1]) => piece(t0, t1));
  if (L > 40 && r() < restroke) {
    const t0 = r.range(0, 0.4);
    out.push(piece(t0, Math.min(1, t0 + r.range(0.3, 0.6)), r.jit(2.2)));
  }
  return out;
}

// polyline through corner points, each edge its own sketched stroke
function sketchPoly(pts, r, opts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) out.push(...sketchSeg(pts[i], pts[i + 1], r, opts));
  return out;
}
const rectPts = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1), P(x0, y0)];

// a freehand curve (not ruled): just smooth jittered points
function freehand(pts, r, amt = 0.8) {
  return [pts.map((p) => P(p.x + r.jit(amt), p.y + r.jit(amt)))];
}

// ------------------------------------------------------------ washes

// loose polygon wash: corners pushed around so colour misses the lines, and
// every edge re-walked with small wobbles so it reads as a brush edge, not a vector
function loosePts(pts, r, amt = 8) {
  return pts.map((p) => P(p.x + r.jit(amt), p.y + r.jit(amt)));
}

function brushEdge(pts, r, { step = 22, wob = 2.2 } = {}) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(L / step));
    const nx = -(b.y - a.y) / (L || 1);
    const ny = (b.x - a.x) / (L || 1);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const w = k === 0 ? 0 : r.jit(wob);
      out.push(P(a.x + (b.x - a.x) * t + nx * w, a.y + (b.y - a.y) * t + ny * w));
    }
  }
  return out;
}

function washXml({ name, pts, color, alpha = 0.78, r = rng(pts.length * 13 + Math.round(pts[0].x)), soft = 1.3, edge = 0.9, tension = 0.5, x = 0, y = 0, rough = true }) {
  const edgePts = rough ? brushEdge(pts, r) : pts;
  return el('Shape', { name, x, y, blendModeValue: 'multiply' }, [
    pathXml(edgePts, { closed: true, tension }),
    fill(argb(color, alpha), { feather: soft }),
    stroke(argb(darken(color, 0.35), alpha * edge * 0.38), 2.2, { feather: 1.6 }),
  ]);
}

// soft, edgeless wash for sky: several heavily feathered patches
function skyPatch(name, { cx, cy, w, h, color, alpha, r, count = 4 }) {
  const kids = [];
  for (let i = 0; i < count; i++) {
    const rx = w * r.range(0.25, 0.45);
    const ry = h * r.range(0.25, 0.45);
    kids.push(el('Shape', { name: 'patch', x: cx + r.jit(w * 0.35), y: cy + r.jit(h * 0.3), blendModeValue: 'multiply' }, [pathXml(blobPts(rx, ry, r, { n: 9, wobble: 0.25 }), { closed: true }), fill(argb(color, alpha * r.range(0.6, 1)), { feather: Math.min(rx, ry) * 0.7 })]));
  }
  return el('Node', { name }, kids);
}

// streaky glaze following the boards: a few vertical strips of darker pigment
function streaks(name, { x0, x1, y0, y1, color, alpha, r, count = 6 }) {
  const kids = [];
  for (let i = 0; i < count; i++) {
    const x = r.range(x0, x1);
    const w = r.range(6, 18);
    const t = r.range(y0, y0 + (y1 - y0) * 0.4);
    const b = r.range(y0 + (y1 - y0) * 0.6, y1);
    kids.push(washXml({ name: 'streak', pts: [P(x, t), P(x + w, t + r.jit(4)), P(x + w + r.jit(3), b), P(x + r.jit(3), b + r.jit(5))], color, alpha: alpha * r.range(0.5, 1), r, soft: 2.5, edge: 0.4 }));
  }
  return el('Node', { name }, kids);
}

// darker blots and back-runs dropped into a wet wash (the reference's red blooms)
function blots(name, { cx, cy, w, h, color, count, r, alpha = 0.55, size = [5, 13] }) {
  const kids = [];
  for (let i = 0; i < count; i++) {
    const x = cx + r.jit(w / 2);
    const y = cy + r.jit(h / 2);
    const s = r.range(...size);
    kids.push(el('Shape', { name: 'blot', x, y, blendModeValue: 'multiply' }, [pathXml(blobPts(s, s * r.range(0.6, 1.1), r, { n: 8, wobble: 0.3 }), { closed: true }), fill(argb(darken(color, 0.22), alpha * r.range(0.4, 1)), { feather: r.range(1.5, 4) })]));
  }
  return el('Node', { name }, kids);
}

// ------------------------------------------------------------ the sketch

function sketch(ids) {
  const s = new Scene(ids, { name: 'Sketch', w: W, h: H, x: 0, y: 0, bg: process.env.PREVIEW_BG });
  const r = rng(1906);

  const introTracks = [];
  const groups = []; // ink, drawn in order
  const washes = []; // colour, flooded in after

  // an ink group: many sketched pieces in one shape, all trimmed in step
  const ink = (name, pieces, { width = 1.8, start, dur, color = INK, bleed = 0.16 }) => {
    const fx = ids.next();
    const trim = ids.next();
    const paths = pieces.map((p) => pathXml(p, { tension: 1 }));
    const xml = [
      el('GroupEffect', { name: `${name} draw`, id: fx }, el('TrimPath', { start: 0, end: 0, modeValue: 'synchronized', id: trim, name: 'Trim' })),
      el('Shape', { name }, [
        ...paths,
        stroke(color.replace(/^../, Math.round(bleed * 255).toString(16).padStart(2, '0').toUpperCase()), width * 2.1, { feather: width * 1.2, effect: fx }),
        stroke(color, width, { effect: fx, cap: 'round' }),
      ]),
    ];
    introTracks.push({ object: trim, prop: 'end', keys: [[0, 0, 'hold'], [start, 0, 'cubic', [0.4, 0.1, 0.25, 1]], [start + dur, 1]] });
    groups.push(xml);
    return xml;
  };

  // a wash node that blooms: opacity up, a slight swell from where the brush landed
  const flood = (name, kids, { start, dur = 50, ox = 0, oy = 0 }) => {
    const id = ids.next();
    washes.push(el('Node', { name, id, x: ox, y: oy, opacity: 0 }, el('Node', { name: `${name} body`, x: -ox, y: -oy }, kids)));
    introTracks.push({ object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [start, 0, 'cubic', EASE.out], [start + dur, 1]] });
    for (const prop of ['scaleX', 'scaleY']) introTracks.push({ object: id, prop, keys: [[0, 0.94, 'hold'], [start, 0.94, 'cubic', EASE.out], [start + dur + 30, 1]] });
    return id;
  };

  // ---- geometry of the boathouse (front gable facade + side wall receding left)
  const F = { x0: 470, x1: 690, top: 322, bot: 600, apex: P(580, 198), eL: P(452, 330), eR: P(708, 330) };
  const S = { backTop: P(330, 346), backBot: P(330, 592), ridgeBack: P(438, 224), eaveBack: P(314, 352) };
  const LT = { x0: 690, x1: 806, roofL: 408, roofR: 442 };

  // ---- pencil construction lines, faint, under everything
  const pencil = [];
  const pr = r.fork();
  pencil.push(...sketchSeg(P(20, WATER), P(1180, WATER - 2), pr, { over: [0, 0], lift: 0.6 }));
  pencil.push(...sketchSeg(P(580, 150), P(580, 690), pr, { over: [0, 0], lift: 0.5 }));
  pencil.push(...sketchSeg(P(470, 322), P(150, 377), pr, { over: [0, 0], lift: 0 }));
  pencil.push(...sketchSeg(P(470, 600), P(170, 582), pr, { over: [0, 0], lift: 0 }));
  pencil.push(...sketchSeg(P(300, 614), P(1080, 612), pr, { over: [0, 0], lift: 0.4 }));
  const pencilId = ids.next();
  const pencilXml = el('Shape', { name: 'Pencil', id: pencilId, opacity: 0 }, [...pencil.map((p) => pathXml(p)), stroke(argb('8C8780', 0.42), 0.8, { cap: 'round' })]);
  introTracks.push({ object: pencilId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [30, 1]] });

  // ---- ink, in the order a sketcher would put it down
  const T = (f) => Math.round(f * 0.8);
  const ir = r.fork();
  ink('Roof', [
    ...sketchSeg(F.eL, F.apex, ir), ...sketchSeg(F.apex, F.eR, ir),
    ...sketchSeg(P(F.eL.x + 12, F.eL.y + 2), P(F.apex.x, F.apex.y + 14), ir, { lift: 0.5 }),
    ...sketchSeg(P(F.apex.x, F.apex.y + 14), P(F.eR.x - 12, F.eR.y + 2), ir, { lift: 0.5 }),
    ...sketchSeg(F.apex, S.ridgeBack, ir), ...sketchSeg(F.eL, S.eaveBack, ir), ...sketchSeg(S.ridgeBack, S.eaveBack, ir, { lift: 0.6 }),
  ], { width: 2.1, start: T(20), dur: T(55) });
  ink('Walls', [
    ...sketchSeg(P(F.x0, F.top), P(F.x0, F.bot), ir), ...sketchSeg(P(F.x1, F.top), P(F.x1, F.bot), ir),
    ...sketchSeg(P(F.x0, F.bot), P(F.x1, F.bot), ir), ...sketchSeg(P(F.x0, F.top), S.backTop, ir, { lift: 0.7 }),
    ...sketchSeg(S.backTop, S.backBot, ir), ...sketchSeg(S.backBot, P(F.x0, F.bot), ir),
  ], { width: 2, start: T(65), dur: T(50) });

  // board-and-batten: thin verticals, broken, some stopping short
  const battens = [];
  const br = r.fork();
  for (let x = F.x0 + 24; x < F.x1 - 8; x += br.range(24, 30)) {
    const topY = x < F.apex.x ? F.top - ((x - F.x0) / (F.apex.x - F.x0)) * (F.top - F.apex.y - 18) : F.top - ((F.x1 - x) / (F.x1 - F.apex.x)) * (F.top - F.apex.y - 18);
    if (x > 488 && x < 582) battens.push(...sketchSeg(P(x, topY + 8), P(x, 424), br, { over: [0, 4], lift: 0.5, restroke: 0 }));
    else battens.push(...sketchSeg(P(x, topY + 8), P(x, F.bot - br.range(0, 18)), br, { over: [0, 4], lift: 0.55, restroke: 0 }));
  }
  for (let k = 1; k < 6; k++) {
    const t = k / 6;
    const xt = S.backTop.x + (F.x0 - S.backTop.x) * t;
    const yt = S.backTop.y + (F.top - S.backTop.y) * t;
    const yb = S.backBot.y + (F.bot - S.backBot.y) * t;
    battens.push(...sketchSeg(P(xt, yt + 6), P(xt, yb - br.range(4, 30)), br, { over: [0, 3], lift: 0.6, restroke: 0 }));
  }
  ink('Battens', battens, { width: 1.15, start: T(105), dur: T(45), bleed: 0.1 });

  // barn door with X brace, and the windows
  const D = { x0: 490, x1: 582, y0: 428, y1: 600 };
  ink('Door', [
    ...sketchPoly(rectPts(D.x0, D.y0, D.x1, D.y1), ir, { lift: 0.2 }),
    ...sketchSeg(P(536, D.y0), P(536, D.y1), ir),
    ...sketchSeg(P(D.x0 + 4, D.y0 + 6), P(532, D.y1 - 6), ir, { restroke: 0 }),
    ...sketchSeg(P(532, D.y0 + 6), P(D.x0 + 4, D.y1 - 6), ir, { restroke: 0 }),
    ...sketchSeg(P(D.x0 - 6, D.y0 - 8), P(D.x1 + 8, D.y0 - 9), ir),
  ], { width: 1.7, start: T(140), dur: T(35) });
  const WN = { x0: 604, x1: 662, y0: 396, y1: 470 };
  const LW = { x0: 556, x1: 604, y0: 244, y1: 290 };
  ink('Windows', [
    ...sketchPoly(rectPts(WN.x0, WN.y0, WN.x1, WN.y1), ir, { lift: 0.15 }),
    ...sketchSeg(P(633, WN.y0), P(633, WN.y1), ir, { restroke: 0 }), ...sketchSeg(P(WN.x0, 433), P(WN.x1, 433), ir, { restroke: 0 }),
    ...sketchSeg(P(WN.x0 - 8, WN.y1 + 4), P(WN.x1 + 9, WN.y1 + 5), ir),
    ...sketchPoly(rectPts(LW.x0, LW.y0, LW.x1, LW.y1), ir, { lift: 0.1 }),
    ...sketchSeg(P(580, LW.y0), P(580, LW.y1), ir, { restroke: 0 }),
  ], { width: 1.6, start: T(165), dur: T(35) });

  // lean-to with a stovepipe
  ink('Lean-to', [
    ...sketchSeg(P(LT.x0 - 6, LT.roofL - 6), P(LT.x1 + 12, LT.roofR + 2), ir),
    ...sketchSeg(P(LT.x0, LT.roofL), P(LT.x1 + 4, LT.roofR + 8), ir, { lift: 0.5 }),
    ...sketchSeg(P(LT.x1, LT.roofR + 6), P(LT.x1, 600), ir),
    ...sketchSeg(P(LT.x0, 600), P(LT.x1, 600), ir),
    ...sketchPoly([P(752, 424), P(752, 372), P(766, 372), P(766, 428)], ir, { over: [0, 4], lift: 0 }),
    ...sketchSeg(P(748, 372), P(770, 371), ir),
    ...[0, 1, 2].flatMap((k) => sketchSeg(P(714 + k * 28, LT.roofL + 18 + k * 7), P(714 + k * 28, 596), ir, { over: [0, 3], lift: 0.6, restroke: 0 })),
  ], { width: 1.6, start: T(190), dur: T(40) });

  // deck, pilings, cross bracing, hatched shadow under the deck
  const deck = [
    ...sketchSeg(P(296, 600), P(1066, 600), ir, { lift: 0.5 }),
    ...sketchSeg(P(300, 613), P(1062, 615), ir, { lift: 0.6 }),
  ];
  const pil = [];
  for (let x = 318; x <= 1050; x += r.range(52, 64)) pil.push(x);
  for (const x of pil) {
    deck.push(...sketchSeg(P(x - 5, 613), P(x - 5, 664 + r.range(0, 10)), ir, { over: [0, 3], lift: 0.1, restroke: 0 }));
    deck.push(...sketchSeg(P(x + 5, 613), P(x + 5, 660 + r.range(0, 10)), ir, { over: [0, 3], lift: 0.3, restroke: 0 }));
  }
  for (let i = 0; i < pil.length - 1; i += 2) deck.push(...sketchSeg(P(pil[i] + 5, 618), P(pil[i + 1] - 5, 652), ir, { restroke: 0, lift: 0 }));
  ink('Deck', deck, { width: 1.8, start: T(225), dur: T(45) });
  const hatch = [];
  for (let x = 304; x < 1058; x += r.range(5, 9)) hatch.push(...sketchSeg(P(x, 617), P(x - 3, 617 + r.range(10, 30)), ir, { over: [0, 2], lift: 0, restroke: 0 }));
  ink('Hatch', hatch, { width: 0.9, start: T(260), dur: T(30), bleed: 0.08 });

  // ladder down the left side
  const lad = [...sketchSeg(P(318, 602), P(262, 676), ir), ...sketchSeg(P(334, 604), P(280, 680), ir)];
  for (let k = 1; k < 6; k++) lad.push(...sketchSeg(P(318 - k * 10.5, 602 + k * 14), P(334 - k * 10.5, 605 + k * 14), ir, { over: [0, 3], restroke: 0, lift: 0 }));
  ink('Ladder', lad, { width: 1.5, start: T(280), dur: T(25) });

  // dock bollards + lantern pole
  ink('Lantern pole', [
    ...sketchSeg(P(1036, 600), P(1036, 470), ir, { lift: 0 }), ...sketchSeg(P(1043, 600), P(1043, 472), ir, { lift: 0 }),
    ...sketchSeg(P(1028, 470), P(1052, 469), ir),
    ...sketchPoly([P(1030, 466), P(1032, 436), P(1048, 436), P(1050, 466)], ir, { over: [0, 3], lift: 0 }),
    ...sketchSeg(P(1027, 437), P(1040, 424), ir, { over: [0, 2], restroke: 0 }), ...sketchSeg(P(1040, 424), P(1053, 437), ir, { over: [0, 2], restroke: 0 }),
  ], { width: 1.6, start: T(300), dur: T(25) });

  // ---- the rowboat (its own node so it can bob and rock)
  const boatId = ids.next();
  const boatRockId = ids.next();
  const br2 = r.fork();
  const hull = [P(-86, -12), P(-40, -16), P(20, -16), P(84, -20)];
  const keel = [P(-86, -12), P(-70, 6), P(-20, 14), P(40, 12), P(76, 2), P(84, -20)];
  const boatInk = (() => {
    const fx = ids.next();
    const trim = ids.next();
    const pieces = [...freehand(hull, br2), ...freehand(keel, br2), ...freehand([P(-78, -6), P(-20, 2), P(40, 0), P(78, -10)], br2, 0.5), ...sketchSeg(P(-30, -14), P(10, -30), br2), ...sketchSeg(P(-12, -28), P(36, -6), br2)];
    introTracks.push({ object: trim, prop: 'end', keys: [[0, 0, 'hold'], [T(320), 0, 'cubic', [0.4, 0.1, 0.25, 1]], [T(355), 1]] });
    return [
      el('GroupEffect', { name: 'Boat draw', id: fx }, el('TrimPath', { start: 0, end: 0, modeValue: 'synchronized', id: trim, name: 'Trim' })),
      el('Shape', { name: 'Boat ink' }, [...pieces.map((p) => pathXml(p)), stroke(INK, 1.7, { effect: fx })]),
    ];
  })();
  const boatWashId = ids.next();
  // the boat's own broken reflection, right under it
  const boatRefl = el('Shape', { name: 'Boat reflection', y: 30, blendModeValue: 'multiply' }, [
    ...[-60, -20, 26].map((x, k) => pathXml(blobPts(r.range(18, 30), 3.5, r, { n: 7, wobble: 0.25 }).map((p) => P(p.x + x, p.y + k * 7)), { closed: true })),
    fill(argb(PAL.red, 0.5), { feather: 1.5 }),
  ]);
  const boatWash = el('Node', { name: 'Boat wash', id: boatWashId, opacity: 0 }, [
    boatRefl,
    washXml({ name: 'hull', pts: loosePts([...hull, ...[...keel].reverse()], br2, 4), color: PAL.red, alpha: 0.85, tension: 0.6 }),
    washXml({ name: 'inside', pts: loosePts([P(-76, -14), P(70, -19), P(60, -10), P(-60, -6)], br2, 3), color: PAL.umber, alpha: 0.4, tension: 0.4 }),
  ]);
  introTracks.push({ object: boatWashId, prop: 'opacity', keys: [[0, 0, 'hold'], [T(400), 0, 'cubic', EASE.out], [T(450), 1]] });
  const boatXml = el('Node', { name: 'Boat', x: 920, y: 704, id: boatId }, el('Node', { name: 'Boat rock', id: boatRockId }, [...boatInk.reverse(), boatWash].reverse()));
  ink('Rope', freehand([P(1000, 688), P(1018, 672), P(1034, 650), P(1040, 632)], r, 0.6), { width: 1.1, start: T(350), dur: T(15) });

  // ---- washes, loose and bold, flooding in after the pen
  const wr = r.fork();
  const roofPoly = [S.ridgeBack, F.apex, P(F.apex.x - 2, F.apex.y + 16), P(F.eL.x + 14, F.eL.y + 4), F.eL, S.eaveBack];
  flood('Roof wash', [
    washXml({ name: 'roof', pts: loosePts(roofPoly, wr, 7), color: PAL.rust, alpha: 0.82, r: wr }),
    washXml({ name: 'trim', pts: loosePts([F.apex, F.eR, P(F.eR.x - 14, F.eR.y + 3), P(F.apex.x, F.apex.y + 16)], wr, 3), color: PAL.rust, alpha: 0.7, r: wr }),
    blots('roof blots', { cx: 400, cy: 290, w: 120, h: 70, color: PAL.rust, count: 7, r: wr }),
    streaks('roof streaks', { x0: 330, x1: 540, y0: 240, y1: 330, color: darken(PAL.rust, 0.1), alpha: 0.35, r: wr, count: 4 }),
  ], { start: T(330), ox: 420, oy: 280 });
  const facade = [P(F.x0 + 2, F.top + 4), P(F.apex.x, F.apex.y + 20), P(F.x1 - 3, F.top + 6), P(F.x1 - 1, F.bot - 2), P(F.x0 + 1, F.bot)];
  flood('Facade wash', [
    washXml({ name: 'facade', pts: loosePts(facade, wr, 10), color: PAL.ochre, alpha: 0.86, r: wr }),
    streaks('facade streaks', { x0: F.x0, x1: F.x1 - 14, y0: 300, y1: 596, color: darken(PAL.ochre, 0.18), alpha: 0.45, r: wr, count: 9 }),
    washXml({ name: 'facade glaze', pts: loosePts([P(F.x0 + 10, 450), P(F.x1 - 30, 440), P(F.x1 - 10, 590), P(F.x0 + 20, 592)], wr, 12), color: darken(PAL.ochre, 0.15), alpha: 0.4, r: wr, soft: 4 }),
    blots('facade blots', { cx: 590, cy: 500, w: 180, h: 160, color: PAL.ochre, count: 10, r: wr, alpha: 0.5 }),
    washXml({ name: 'eave shadow', pts: loosePts([P(F.x0, F.top + 2), P(F.apex.x, F.apex.y + 22), P(F.x1, F.top + 4), P(F.x1, F.top + 22), P(F.apex.x, F.apex.y + 46), P(F.x0, F.top + 24)], wr, 3), color: PAL.shadow, alpha: 0.45, r: wr, soft: 3 }),
  ], { start: T(345), ox: 580, oy: 460 });
  flood('Side wash', [
    washXml({ name: 'side', pts: loosePts([P(S.backTop.x + 10, S.backTop.y + 8), P(F.x0 - 6, F.top + 4), P(F.x0 - 2, F.bot - 30), P(S.backBot.x + 26, S.backBot.y - 40)], wr, 10), color: PAL.ochreSide, alpha: 0.7, r: wr }),
    streaks('side streaks', { x0: S.backTop.x + 8, x1: F.x0 - 16, y0: 360, y1: 560, color: PAL.ochre, alpha: 0.4, r: wr, count: 5 }),
    washXml({ name: 'side shade', pts: loosePts([S.backTop, P(F.x0 - 30, F.top + 4), P(F.x0 - 40, 520), P(S.backBot.x + 6, 500)], wr, 10), color: PAL.shadow, alpha: 0.18, r: wr, soft: 6 }),
  ], { start: T(360), ox: 400, oy: 470 });
  flood('Door wash', [
    washXml({ name: 'door', pts: loosePts(rectPts(D.x0 + 4, D.y0 + 6, D.x1 - 4, D.y1 - 2).slice(0, 4), wr, 6), color: PAL.red, alpha: 0.62, r: wr }),
    streaks('door streaks', { x0: D.x0 + 4, x1: D.x1 - 12, y0: D.y0 + 8, y1: D.y1 - 4, color: darken(PAL.red, 0.2), alpha: 0.3, r: wr, count: 4 }),
  ], { start: T(380), ox: 536, oy: 520 });
  flood('Lean-to wash', [
    washXml({ name: 'leanto', pts: loosePts([P(LT.x0 + 4, LT.roofL + 10), P(LT.x1 - 8, LT.roofR + 16), P(LT.x1 + 2, 560), P(LT.x1 - 20, 596), P(LT.x0 + 6, 590)], wr, 9), color: PAL.cerulean, alpha: 0.78, r: wr }),
    streaks('leanto streaks', { x0: LT.x0 + 6, x1: LT.x1 - 14, y0: 430, y1: 592, color: PAL.ultra, alpha: 0.35, r: wr, count: 4 }),
    washXml({ name: 'leanto roof', pts: loosePts([P(LT.x0 - 4, LT.roofL - 4), P(LT.x1 + 10, LT.roofR + 2), P(LT.x1 + 6, LT.roofR + 10), P(LT.x0, LT.roofL + 6)], wr, 2), color: PAL.umber, alpha: 0.55, r: wr }),
  ], { start: T(375), ox: 750, oy: 500 });
  flood('Deck wash', [
    washXml({ name: 'deck', pts: loosePts([P(300, 602), P(1060, 602), P(1060, 640), P(300, 646)], wr, 6), color: PAL.umber, alpha: 0.42, r: wr, soft: 3 }),
    washXml({ name: 'under', pts: loosePts([P(306, 616), P(1052, 618), P(1046, 664), P(312, 668)], wr, 6), color: PAL.shadow, alpha: 0.55, r: wr, soft: 3 }),
  ], { start: T(390), ox: 680, oy: 630 });
  flood('Shore', [
    washXml({ name: 'shore L', pts: [P(40, 600), P(90, 580), P(170, 568), P(250, 580), P(296, 598), P(290, 616), P(140, 620), P(70, 614)], color: PAL.sap, alpha: 0.66, r: wr, soft: 2.5, tension: 0.6 }),
    blots('shore blots', { cx: 150, cy: 594, w: 220, h: 26, color: '6F9A3A', count: 6, r: wr, alpha: 0.3, size: [5, 12] }),
    washXml({ name: 'shore R', pts: [P(1070, 600), P(1110, 588), P(1160, 586), P(1150, 604), P(1120, 616), P(1072, 620)], color: PAL.sap, alpha: 0.6, r: wr, soft: 2.5, tension: 0.6 }),
    washXml({ name: 'shore lemon', pts: [P(40, 600), P(140, 584), P(230, 594), P(200, 612), P(60, 614)], color: PAL.lemon, alpha: 0.6, r: wr, soft: 3, tension: 0.6 }),
  ], { start: T(410), ox: 150, oy: 600 });
  flood('Water base', [
    skyPatch('water base', { cx: 640, cy: 700, w: 760, h: 100, color: PAL.cerulean, alpha: 0.16, r: wr, count: 5 }),
    washXml({ name: 'water edge', pts: [P(70, 646), P(300, 646), P(1040, 648), P(1090, 646), P(1070, 662), P(800, 676), P(300, 672), P(110, 660)], color: PAL.cerulean, alpha: 0.22, r: wr, soft: 4, edge: 0.5, tension: 0.6 }),
  ], { start: T(395), dur: 60, ox: 640, oy: 660 });
  flood('Sky', [
    washXml({ name: 'sky R', pts: [P(760, 80), P(870, 50), P(1000, 58), P(1100, 96), P(1080, 160), P(1020, 148), P(960, 196), P(890, 166), P(820, 152)], color: PAL.cerulean, alpha: 0.24, r: wr, soft: 5, edge: 0.6, tension: 0.8 }),
    washXml({ name: 'sky L', pts: [P(70, 110), P(170, 76), P(290, 92), P(330, 130), P(250, 150), P(160, 170), P(90, 150)], color: PAL.cerulean, alpha: 0.16, r: wr, soft: 6, edge: 0.5, tension: 0.8 }),
    skyPatch('sky soft', { cx: 940, cy: 150, w: 360, h: 160, color: PAL.cerulean, alpha: 0.1, r: wr, count: 4 }),
  ], { start: T(430), dur: 70, ox: 950, oy: 150 });

  // ---- water: horizontal dabs, colour borrowed from what's reflected above
  const colorAt = (x, y) => {
    const src = WATER - (y - WATER) / 0.72;
    if (x > 300 && x < 1060 && src > 600) return [PAL.shadow, 0.55];
    if (x > F.x0 - 6 && x < F.x1 + 4 && src > F.top) return x > D.x0 && x < D.x1 && src > D.y0 ? [PAL.red, 0.7] : [PAL.ochre, 0.9];
    if (x > S.backTop.x && x < F.x0 && src > 350) return [PAL.ochre, 0.7];
    if (x > LT.x0 && x < LT.x1 && src > LT.roofR) return [PAL.cerulean, 0.75];
    if (x > 320 && x < F.x1 + 10 && src > F.apex.y + Math.abs(x - 520) * 0.6) return [PAL.rust, 0.85];
    if (x > 1030 && x < 1050 && src > 440) return [PAL.umber, 0.5];
    return null;
  };
  const bandIds = [];
  const water = [];
  const bands = 9;
  const wtr = r.fork();
  const rowYs = [];
  for (let y = WATER + 10; y < 985; y += wtr.range(8, 13)) rowYs.push(y);
  for (let b = 0; b < bands; b++) {
    const rows = rowYs.filter((_, i) => i % bands === b);
    const solo = boil(s, {
      name: `Water ${b}`, seed: 300 + b, hold: 14,
      draw: (cr) => {
        const byColor = new Map();
        const add = (c, a, pts) => {
          const k = `${c}|${a}`;
          if (!byColor.has(k)) byColor.set(k, []);
          byColor.get(k).push(pts);
        };
        for (const y of rows) {
          const depth = (y - WATER) / (H - WATER);
          let x = cr.range(-20, 60);
          while (x < W + 20) {
            const len = cr.range(14, 110) * (1.25 - depth * 0.6) * (cr() < 0.12 ? 1.7 : 1);
                        const cx = x + len / 2;
            const ref = colorAt(cx, y);
            const th = cr.range(2.5, 8.5) * (ref ? 1.2 : 1);
            // the sketch vignettes: the water narrows to a soft U as it comes toward you
            const half = 500 - depth * 260 + cr.jit(50);
            const outside = Math.max(0, Math.abs(cx - 640) - half) / 120;
            const gapP = Math.min(1, (ref ? 0.1 + depth * 0.15 : 0.18 + depth * 0.4) + outside);
            if (cr() > gapP) {
              const col = ref ? ref : cr() < 0.55 ? [PAL.cerulean, 0.66] : [PAL.ultra, 0.5];
              // a tapered, wavering horizontal brush mark
              const m = Math.max(3, Math.round(len / 13));
              const top = [];
              const bot = [];
              const tilt = cr.jit(1.5);
              for (let k = 0; k <= m; k++) {
                const t = k / m;
                const taper = Math.pow(Math.sin(Math.PI * Math.max(0.04, Math.min(0.96, t))), 0.55);
                const wav = Math.sin(t * Math.PI * cr.range(1, 2.5)) * 1.2 + tilt * (t - 0.5);
                top.push(P(x + len * t, y - (th / 2) * taper + wav + cr.jit(0.5)));
                bot.push(P(x + len * t, y + (th / 2) * taper * cr.range(0.7, 1.1) + wav + cr.jit(0.5)));
              }
              const pts = [...top, ...bot.reverse().slice(1, -1)];
              add(col[0], col[1], pts);
            }
            x += len + cr.range(2, 26) * (ref ? 0.5 : 1.2) * (0.5 + depth);
          }
        }
        return [...byColor.entries()].map(([k, list]) => {
          const [c, a] = k.split('|');
          return el('Shape', { name: 'dabs', blendModeValue: 'multiply' }, [...list.map((p) => pathXml(p, { closed: true, tension: 0.8 })), fill(argb(c, +a), { feather: 0.9 })]);
        });
      },
    });
    const id = ids.next();
    bandIds.push({ id, animId: solo.animId, b });
    water.push(el('Node', { name: `Band ${b}`, id, opacity: 0 }, solo.xml));
    introTracks.push({ object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [T(400) + b * 6, 0, 'cubic', EASE.out], [T(460) + b * 6, 1]] });
  }

  // ---- the flag on the gable, a gull on the ridge, a gull crossing the sky
  const flagIds = [ids.next(), ids.next(), ids.next(), ids.next()];
  const flagXml = el('Node', { name: 'Flag', x: F.apex.x, y: F.apex.y - 52 }, [
    el('Shape', { name: 'pennant', blendModeValue: 'multiply' }, [
      el('PointsPath', { isClosed: 'true', isClockwise: 'true', name: 'P' }, [
        el('StraightVertex', { x: 0, y: 0 }),
        el('CubicMirroredVertex', { x: 22, y: 4, rotation: 0.2, distance: 6, id: flagIds[0] }),
        el('StraightVertex', { x: 46, y: 10, id: flagIds[1] }),
        el('CubicMirroredVertex', { x: 22, y: 15, rotation: 3.0, distance: 6, id: flagIds[2] }),
        el('StraightVertex', { x: 0, y: 18 }),
      ]),
      fill(argb(PAL.red, 0.85), { feather: 1 }),
      stroke(INK, 1.2),
    ]),
    el('Shape', { name: 'pole' }, [pathXml([P(0, -6), P(0.5, 26), P(0, 54)]), stroke(INK, 1.6)]),
  ]);
  const flagFlutter = s.anim({
    name: 'Flag', duration: 48, loop: 'loop',
    tracks: [
      { object: flagIds[0], prop: 'y', keys: [[0, 4, 'cubic', EASE.inOut], [12, 1, 'cubic', EASE.inOut], [24, 6, 'cubic', EASE.inOut], [36, 2, 'cubic', EASE.inOut], [48, 4]] },
      { object: flagIds[1], prop: 'y', keys: [[0, 10, 'cubic', EASE.inOut], [16, 15, 'cubic', EASE.inOut], [32, 6, 'cubic', EASE.inOut], [48, 10]] },
      { object: flagIds[1], prop: 'x', keys: [[0, 46, 'cubic', EASE.inOut], [20, 42, 'cubic', EASE.inOut], [48, 46]] },
      { object: flagIds[2], prop: 'y', keys: [[0, 15, 'cubic', EASE.inOut], [12, 18, 'cubic', EASE.inOut], [24, 13, 'cubic', EASE.inOut], [36, 17, 'cubic', EASE.inOut], [48, 15]] },
    ],
  });

  // gull silhouettes: a body tick and two wings, wing nodes flap by scaleY
  const gull = (name, { x, y, scale = 1, perched = false }) => {
    const id = ids.next();
    const wingL = ids.next();
    const wingR = ids.next();
    const g = rng(name.length * 31);
    const wing = (dir) => [P(0, 0), P(dir * 9, -7 + g.jit(0.5)), P(dir * 20, -3), P(dir * 26, 2)];
    const kids = perched
      ? [
          el('Shape', { name: 'body' }, [pathXml([P(-12, 0), P(-4, -8), P(6, -9), P(12, -4), P(8, 4), P(-6, 5)], { closed: true, tension: 0.8 }), fill('FFFDFBF5'), stroke(INK, 1.3)]),
          el('Shape', { name: 'head' }, [el('Ellipse', { x: 10, y: -12, width: 9, height: 8, originX: 0.5, originY: 0.5, name: 'P' }), fill('FFFDFBF5'), stroke(INK, 1.2)]),
          el('Shape', { name: 'beak' }, [pathXml([P(14, -12), P(19, -11)]), stroke(argb(PAL.lemon, 1), 1.6)]),
          el('Shape', { name: 'eye' }, [el('Ellipse', { x: 11, y: -13, width: 1.6, height: 1.6, originX: 0.5, originY: 0.5, name: 'P' }), fill(INK)]),
          el('Node', { name: 'wing', id: wingL, x: -2, y: -4 }, el('Shape', { name: 'w' }, [pathXml([P(0, 0), P(-8, -2), P(-14, 1)]), stroke(INK, 1.2)])),
          el('Node', { name: 'wing2', id: wingR, x: 0, y: -4, scaleY: 0 }, el('Shape', { name: 'w' }, [pathXml([P(0, 0), P(-6, -12), P(-16, -16)]), stroke(INK, 1.2)])),
          el('Shape', { name: 'legs' }, [pathXml([P(-2, 4), P(-2, 10)]), pathXml([P(3, 4), P(4, 10)]), stroke(argb(PAL.lemon, 1), 1.2)]),
        ]
      : [
          el('Node', { name: 'wingL', id: wingL }, el('Shape', { name: 'w' }, [pathXml(wing(-1)), stroke(INK, 1.5)])),
          el('Node', { name: 'wingR', id: wingR }, el('Shape', { name: 'w' }, [pathXml(wing(1)), stroke(INK, 1.5)])),
        ];
    return { xml: el('Node', { name, x, y, id, scaleX: scale, scaleY: scale }, kids.reverse()), id, wingL, wingR };
  };
  const flyer = gull('Gull flying', { x: -80, y: 150, scale: 1.3 });
  const flapTracks = (g, len = 26, amt = 0.55) => [g.wingL, g.wingR].map((w) => ({ object: w, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [len / 2, -amt, 'cubic', EASE.inOut], [len, 1]] }));
  const flyFlap = s.anim({ name: 'Gull flap', duration: 34, loop: 'loop', tracks: flapTracks(flyer, 34, 0.6) });
  const flyPath = s.anim({
    name: 'Gull path', duration: 1500, loop: 'loop',
    tracks: [
      { object: flyer.id, prop: 'x', keys: [[0, -80, 'hold'], [300, -80, 'linear'], [1260, 1300, 'hold'], [1500, 1300]] },
      { object: flyer.id, prop: 'y', keys: [[300, 170, 'cubic', EASE.inOut], [540, 128, 'cubic', EASE.inOut], [800, 160, 'cubic', EASE.inOut], [1050, 112, 'cubic', EASE.inOut], [1260, 140]] },
    ],
  });
  const percher = gull('Gull perched', { x: 450, y: 222, scale: 1.25, perched: true });

  // stovepipe smoke, boiling as it rises
  const smokeId = ids.next();
  const smoke = boil(s, {
    name: 'Smoke', seed: 77, hold: 7,
    draw: (cr) => [el('Shape', { name: 'wisps' }, [
      pathXml([P(0, 0), P(-6 + cr.jit(1.5), -14), P(4 + cr.jit(1.5), -28), P(-3 + cr.jit(1.5), -44), P(6, -58)]),
      pathXml([P(8, -10), P(14 + cr.jit(1.5), -24), P(8 + cr.jit(1.5), -38), P(16, -50)]),
      stroke(argb('6E6A72', 0.7), 1.1),
    ])],
  });
  const smokeXml = el('Node', { name: 'Smoke rig', x: 759, y: 362, id: smokeId, opacity: 0 }, smoke.xml);
  const smokeRise = s.anim({
    name: 'Smoke rise', duration: 200, loop: 'loop',
    tracks: [
      { object: smokeId, prop: 'y', keys: [[0, 366, 'linear'], [200, 350]] },
      { object: smokeId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [60, 0.85, 'linear'], [140, 0.7, 'cubic', EASE.in], [200, 0]] },
    ],
  });

  // lantern glow: a feathered warm disc with a nervous flicker
  const glowIn = ids.next();
  const glowOut = ids.next();
  const glowXml = el('Node', { name: 'Glow', x: 1040, y: 452 }, [
    el('Shape', { name: 'outer', id: glowOut, opacity: 0, blendModeValue: 'multiply' }, [el('Ellipse', { width: 90, height: 90, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb(PAL.lemon, 0.55), { feather: 22 })]),
    el('Shape', { name: 'inner', id: glowIn, blendModeValue: 'multiply' }, [el('Ellipse', { width: 16, height: 22, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('F2B53A', 0.9), { feather: 3 })]),
  ].reverse());
  const flicker = s.anim({
    name: 'Flicker', duration: 140, loop: 'loop',
    tracks: [{ object: glowIn, prop: 'opacity', keys: [[0, 0.9, 'linear'], [9, 0.62, 'linear'], [16, 0.95, 'linear'], [44, 0.8, 'linear'], [52, 1, 'linear'], [90, 0.7, 'linear'], [98, 0.92, 'linear'], [140, 0.9]] }],
  });

  // a warm wash that can light the windows from inside
  const winGlow = ids.next();
  const winXml = el('Node', { name: 'Window glow', id: winGlow, opacity: 0 }, [
    washXml({ name: 'win', pts: loosePts(rectPts(WN.x0 + 2, WN.y0 + 2, WN.x1 - 2, WN.y1 - 2).slice(0, 4), r, 2), color: 'F4C430', alpha: 0.9, soft: 2.5 }),
    washXml({ name: 'loft', pts: loosePts(rectPts(LW.x0 + 2, LW.y0 + 2, LW.x1 - 2, LW.y1 - 2).slice(0, 4), r, 2), color: 'F4C430', alpha: 0.8, soft: 2.5 }),
    el('Shape', { name: 'spill', blendModeValue: 'multiply' }, [el('Ellipse', { x: 633, y: 433, width: 140, height: 120, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('F4C430', 0.25), { feather: 28 })]),
  ]);
  const panesId = ids.next();
  const winPanes = el('Node', { name: 'Window panes', id: panesId }, [
    washXml({ name: 'panes', pts: loosePts(rectPts(WN.x0 + 3, WN.y0 + 3, WN.x1 - 4, WN.y1 - 3).slice(0, 4), r, 3), color: '3B2A44', alpha: 0.5, soft: 2 }),
    washXml({ name: 'loft panes', pts: loosePts(rectPts(LW.x0 + 3, LW.y0 + 3, LW.x1 - 3, LW.y1 - 3).slice(0, 4), r, 3), color: '3B2A44', alpha: 0.45, soft: 2 }),
  ]);

  // the door darkens as if it swung open onto a dim boathouse
  const doorDark = ids.next();
  const doorDarkXml = el('Shape', { name: 'Door interior', id: doorDark, opacity: 0, blendModeValue: 'multiply' }, [pathXml(loosePts([P(538, 432), P(580, 432), P(580, 598), P(538, 598)], r, 2), { closed: true, tension: 0.3 }), fill(argb('2A2440', 0.75), { feather: 2 })]);

  // late arrivals fade in once the pen has reached them
  const reveal = (name, xml, start, dur = 30) => {
    const id = ids.next();
    introTracks.push({ object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [start, 0, 'cubic', EASE.out], [start + dur, 1]] });
    return el('Node', { name, id, opacity: 0 }, xml);
  };

  // ---- assemble, back to front
  s.add(pencilXml);
  s.add(washes[washes.length - 1]); // sky
  s.add(washes[washes.length - 2]); // water base
  s.add(...water);
  s.add(...washes.slice(0, -2));
  s.add(reveal('Panes in', winPanes, T(420)), winXml, doorDarkXml);
  for (const g of groups) s.add(...g);
  s.add(boatXml, reveal('Glow in', glowXml, T(330)), reveal('Smoke in', smokeXml, T(400), 60), reveal('Flag in', flagXml, T(150), 20), reveal('Gull in', percher.xml, T(470), 40), reveal('Flyer in', flyer.xml, T(500), 60));

  // ---- timelines
  const intro = s.anim({ name: 'Sketch', duration: T(560), tracks: introTracks });
  s.loopLayer('Sketch', intro);
  for (const b of bandIds) s.loopLayer(`Water boil ${b.b}`, b.animId);
  const drift = s.anim({
    name: 'Water drift', duration: 600, loop: 'loop',
    tracks: bandIds.map((b) => {
      const amp = 3 + (b.b % 3) * 2;
      const ph = (b.b * 67) % 600;
      const keys = [];
      for (let k = 0; k <= 4; k++) {
        const f = k * 150;
        keys.push([f, Math.sin(((f + ph) / 600) * TAU) * amp, 'cubic', EASE.inOut]);
      }
      return { object: b.id, prop: 'x', keys };
    }),
  });
  s.loopLayer('Water drift', drift);
  s.loopLayer('Flag', flagFlutter);
  s.loopLayer('Gull path', flyPath);
  s.loopLayer('Gull flap', flyFlap);
  s.loopLayer('Smoke boil', smoke.animId);
  s.loopLayer('Smoke rise', smokeRise);
  s.loopLayer('Flicker', flicker);
  const bob = s.anim({
    name: 'Bob', duration: 300, loop: 'loop',
    tracks: [
      { object: boatId, prop: 'y', keys: [[0, 704, 'cubic', EASE.inOut], [150, 708, 'cubic', EASE.inOut], [300, 704]] },
      { object: boatId, prop: 'rotation', keys: [[0, -0.012, 'cubic', EASE.inOut], [150, 0.014, 'cubic', EASE.inOut], [300, -0.012]] },
    ],
  });
  s.loopLayer('Bob', bob);

  // ---- hover parts (bool inputs, also set from the page's annotations)
  const part = (key, hitPts, offTracks, onTracks, { onLoop = false, event }) => {
    const bool = s.input('bool', `hl_${key}`, 0);
    const off = s.anim({ name: `${key} off`, duration: 1, tracks: offTracks });
    const on = s.anim({ name: `${key} on`, duration: onLoop ? onLoop : 1, loop: onLoop ? 'loop' : 'oneShot', tracks: onTracks });
    s.boolLayer(`Hover ${key}`, bool, off, on, { mixIn: 260, mixOut: 500 });
    const hit = ids.next();
    s.add(el('Shape', { name: `Hit ${key}`, id: hit }, [pathXml(hitPts, { closed: true, tension: 0 }), fill('00000000')]));
    const ev = s.event(event);
    s.listen(hit, 'enter', [Scene.setBool(bool, true)]);
    s.listen(hit, 'exit', [Scene.setBool(bool, false)]);
    s.listen(hit, 'click', [Scene.emit(ev)]);
  };
  const box = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];

  part('window', box(548, 236, 672, 480),
    [{ object: winGlow, prop: 'opacity', keys: [[0, 0]] }, { object: panesId, prop: 'opacity', keys: [[0, 1]] }],
    [{ object: winGlow, prop: 'opacity', keys: [[0, 1]] }, { object: panesId, prop: 'opacity', keys: [[0, 0.12]] }],
    { event: 'open:writing' });
  part('boat', box(820, 670, 1010, 740),
    [{ object: boatRockId, prop: 'rotation', keys: [[0, 0]] }, { object: boatRockId, prop: 'y', keys: [[0, 0]] }],
    [
      { object: boatRockId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [20, 0.05, 'cubic', EASE.inOut], [40, -0.035, 'cubic', EASE.inOut], [60, 0]] },
      { object: boatRockId, prop: 'y', keys: [[0, 0, 'cubic', EASE.inOut], [30, 3, 'cubic', EASE.inOut], [60, 0]] },
    ],
    { onLoop: 60, event: 'open:projects' });
  part('lantern', box(1010, 410, 1070, 600),
    [{ object: glowOut, prop: 'opacity', keys: [[0, 0]] }],
    [{ object: glowOut, prop: 'opacity', keys: [[0, 1]] }],
    { event: 'open:now' });
  part('gull', box(425, 196, 480, 236),
    [{ object: percher.wingR, prop: 'scaleY', keys: [[0, 0]] }, { object: percher.wingL, prop: 'scaleY', keys: [[0, 1]] }, { object: percher.id, prop: 'y', keys: [[0, 222]] }],
    [
      { object: percher.wingR, prop: 'scaleY', keys: [[0, 0.2, 'cubic', EASE.inOut], [8, 1, 'cubic', EASE.inOut], [16, 0.2]] },
      { object: percher.wingL, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [8, -0.4, 'cubic', EASE.inOut], [16, 1]] },
      { object: percher.id, prop: 'y', keys: [[0, 222, 'cubic', EASE.out], [8, 212, 'cubic', EASE.in], [16, 222]] },
    ],
    { onLoop: 16, event: 'open:elsewhere' });
  part('door', box(D.x0, D.y0, D.x1, D.y1),
    [{ object: doorDark, prop: 'opacity', keys: [[0, 0]] }],
    [{ object: doorDark, prop: 'opacity', keys: [[0, 1]] }],
    { event: 'open:hello' });

  return s.toXml();
}

// ------------------------------------------------------------ annotation leaders
// A separate, transparent artboard laid exactly over the sketch on wide screens:
// fine pen leader lines from parts of the building out to the page's labels.

export const LEADERS = {
  writing: { from: P(640, 392), to: P(812, 300), via: P(730, 330) },
  now: { from: P(1050, 432), to: P(1092, 352), via: P(1080, 392) },
  projects: { from: P(968, 724), to: P(1040, 820), via: P(1012, 770) },
  elsewhere: { from: P(440, 206), to: P(300, 128), via: P(360, 150) },
  hello: { from: P(496, 520), to: P(250, 470), via: P(370, 482) },
};

function leaders(ids) {
  const s = new Scene(ids, { name: 'Leaders', w: W, h: H, x: 1300, y: 0, bg: process.env.PREVIEW_BG });
  const tracks = [];
  let i = 0;
  for (const [key, l] of Object.entries(LEADERS)) {
    const trim = ids.next();
    const fx = ids.next();
    const dotId = ids.next();
    const r = rng(i + 50);
    s.add(el('GroupEffect', { name: `${key} draw`, id: fx }, el('TrimPath', { end: 0, id: trim, name: 'Trim' })));
    s.add(el('Shape', { name: `${key} leader` }, [pathXml([l.from, P(l.via.x + r.jit(6), l.via.y + r.jit(6)), l.to]), stroke(argb('1F1D24', 0.7), 0.9, { effect: fx })]));
    s.add(el('Shape', { name: `${key} dot`, id: dotId, x: l.from.x, y: l.from.y, scaleX: 0, scaleY: 0 }, [el('Ellipse', { width: 4.5, height: 4.5, originX: 0.5, originY: 0.5, name: 'P' }), fill(INK)]));
    const st = 420 + i * 14;
    tracks.push({ object: trim, prop: 'end', keys: [[0, 0, 'hold'], [st, 0, 'cubic', [0.5, 0, 0.2, 1]], [st + 40, 1]] });
    for (const prop of ['scaleX', 'scaleY']) tracks.push({ object: dotId, prop, keys: [[0, 0, 'hold'], [st - 4, 0, 'cubic', EASE.back], [st + 10, 1]] });
    i++;
  }
  s.loopLayer('Draw', s.anim({ name: 'Draw', duration: 520, tracks }));
  return s.toXml();
}

export default function () {
  const ids = new Ids();
  return document(sketch(ids), leaders(ids));
}
