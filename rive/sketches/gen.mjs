// Small sketches that head the blog posts, one artboard per post.
//
// Niggle (008, loading EXR/HDR thumbnails during Qt's paint): after Tolkien's
// "Leaf by Niggle", a painter's great tree, done one leaf at a time. Every leaf
// is drawn in ink first (the placeholder) and its colour arrives later, in no
// particular order, the way thumbnails come back from a background loader.
import {
  Ids, Scene, rng, P, TAU, el, argb, document, boil, inkShape, washShape, watercolor,
  blobPts, jitterPts, resample, pathXml, fill, stroke, stippleShape, EASE,
} from '../lib/ink.mjs';

const INK = 'FF2B231C';
const INK_SOFT = argb('2B231C', 0.5);
const BG = process.env.PREVIEW_BG;
// The boils and the flicker step at 15 fps rather than every frame, all on the same
// ticks, so the canvas can rest between them; a boil holds each cel for two steps
// (7.5 fps). The painting itself steps at 30, which still lands on those ticks.
const AMBIENT = 15;
const CEL = 8; // a boil cel, in 60 fps frames

// a pointed leaf, `len` long, pointing along `a`
function leafPts(len, wid, a) {
  const pts = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const s = Math.sin(t * TAU);
    const along = (Math.cos(t * TAU) * -0.5 + 0.5) * len; // 0 → len → 0
    const across = s * wid * (0.55 + 0.45 * Math.sin(Math.PI * (along / len)));
    pts.push(P(Math.cos(a) * along - Math.sin(a) * across, Math.sin(a) * along + Math.cos(a) * across));
  }
  return pts;
}

function niggle(ids) {
  const W = 720, H = 380;
  const s = new Scene(ids, { name: 'Niggle', w: W, h: H, x: 0, y: 0, bg: BG });
  const r = rng(8);
  const fx = ids.next();
  const trim = ids.next();
  s.add(el('GroupEffect', { name: 'Draw', id: fx }, el('TrimPath', { end: 0, id: trim, name: 'Trim' })));

  // a soft wash of afternoon behind everything, kept inside the frame
  // every wash soaks in during the intro, a beat behind the ink that draws it (rather than
  // being on the page from the first frame)
  const soakTracks = [];
  const soak = (t0, xml, len = 46) => {
    const id = ids.next();
    soakTracks.push({ object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [t0, 0, 'cubic', EASE.out], [t0 + len, 1]] });
    return el('Node', { name: 'soak', id, opacity: 0 }, [].concat(xml));
  };
  s.add(soak(0, watercolor({ x: 372, y: 170, rx: 270, ry: 120, color: 'C9D9E6', seed: 3, alpha: 0.32, grain: false }), 70));
  s.add(soak(10, watercolor({ x: 372, y: 352, rx: 300, ry: 22, color: 'B9C48A', seed: 4, alpha: 0.4 }), 60));

  // the easel's frame stands behind the canvas board
  const frame = [
    [P(300, 354), P(338, 196), P(372, 40)],
    [P(446, 354), P(408, 196), P(372, 40)],
    [P(372, 354), P(372, 304)],
  ];
  const easelInk = boil(s, {
    name: 'Easel', seed: 6, hold: CEL, rate: AMBIENT,
    draw: (rr) => frame.map((pts) => inkShape({ pts: jitterPts(pts, 0.8, rr), tension: 0.3, color: INK, width: 1.7, effect: fx })),
  });
  s.add(easelInk.xml);
  s.loopLayer('Easel boil', easelInk.animId);

  // the canvas on the easel, and the tree being painted on it
  const C = { x0: 266, y0: 92, x1: 478, y1: 298 };
  s.add(soak(24, washShape({ pts: [P(C.x0, C.y0), P(C.x1, C.y0 - 2), P(C.x1 + 1, C.y1), P(C.x0 - 1, C.y1 + 1)], color: 'FBF6EA', alpha: 0.95, edge: 0.3, soft: 0.5, blend: 'srcOver', tension: 0 })));

  const cx = 372, cy = 168;
  const branches = [
    [P(372, 292), P(370, 250), P(373, 214), P(371, 186)],
    [P(372, 236), P(352, 214), P(330, 196), P(312, 180)],
    [P(372, 228), P(394, 206), P(418, 190), P(436, 172)],
    [P(371, 204), P(356, 178), P(344, 150), P(338, 128)],
    [P(372, 200), P(388, 172), P(402, 146), P(408, 124)],
    [P(371, 190), P(372, 160), P(370, 128), P(372, 104)],
  ];
  s.add(soak(58, washShape({ pts: [P(366, 292), P(365, 230), P(368, 200), P(376, 200), P(379, 232), P(380, 292)], color: '8A6A48', alpha: 0.5, edge: 0.6, soft: 0.6, tension: 0.4 })));

  // leaves: sprinkled through the crown, a few at each branch's end
  const leaves = [];
  const lr = rng(21);
  while (leaves.length < 46) {
    const a = lr() * TAU;
    const d = Math.sqrt(lr());
    const p = P(cx + Math.cos(a) * 92 * d, cy + Math.sin(a) * 62 * d - 4);
    if (leaves.some((q) => Math.hypot(q.p.x - p.x, q.p.y - p.y) < 13)) continue;
    leaves.push({ p, a: lr.range(0, TAU), len: lr.range(13, 19), wid: lr.range(4, 6), color: lr.pick(['7FA65A', '96B55E', '6C9A57', 'B9B45A', 'D29A45']) });
  }
  const order = leaves.map((_, i) => i).sort(() => lr() - 0.5); // the loader's order, not the eye's
  const leafNodes = leaves.map((lf, i) => {
    const id = ids.next();
    const pts = leafPts(lf.len, lf.wid, lf.a).map((q) => P(q.x - (Math.cos(lf.a) * lf.len) / 2, q.y - (Math.sin(lf.a) * lf.len) / 2));
    s.add(el('Node', { name: `leaf ${i}`, x: lf.p.x, y: lf.p.y, id, opacity: 0, scaleX: 0.5, scaleY: 0.5 }, [
      washShape({ pts: pts.map((q) => P(q.x + 1.2, q.y + 1)), color: lf.color, alpha: 0.78, edge: 0.9, soft: 0.6, tension: 0.8 }),
    ]));
    return { id, pts, ...lf };
  });

  // all the ink: easel, canvas edge, tree, leaf outlines; drawn once, boiling
  const easel = [
    [P(282, 304), P(370, 302), P(462, 305)],
    [P(282, 312), P(372, 310), P(462, 313)],
  ];
  const ink = boil(s, {
    name: 'Ink', seed: 5, hold: CEL, rate: AMBIENT,
    draw: (rr) => [
      ...easel.map((pts) => inkShape({ pts: jitterPts(pts, 0.8, rr), tension: 0.3, color: INK, width: 1.7, effect: fx })),
      inkShape({ pts: jitterPts([P(C.x0, C.y0), P(C.x1, C.y0 - 2), P(C.x1 + 1, C.y1), P(C.x0 - 1, C.y1 + 1)], 0.7, rr), closed: true, tension: 0.05, color: INK, width: 1.6, effect: fx }),
      ...branches.map((pts, i) => inkShape({ pts: jitterPts(pts, 0.6, rr), color: INK, width: i === 0 ? 2.2 : 1.3, bleed: 0.12, effect: fx })),
      ...leafNodes.map((lf) => inkShape({ x: lf.p.x, y: lf.p.y, pts: jitterPts(lf.pts, 0.35, rr), closed: true, tension: 0.8, color: INK_SOFT, width: 0.9, bleed: 0, effect: fx })),
    ],
  });
  s.add(ink.xml);
  s.loopLayer('Boil', ink.animId);

  // a stool to the right, with a jar of brushes and a palette of the tree's colours
  s.add(soak(70, watercolor({ x: 560, y: 300, rx: 34, ry: 9, color: 'B48A5A', seed: 9, alpha: 0.45, grain: false })));
  s.add(soak(74, washShape({ pts: [P(540, 250), P(566, 250), P(568, 292), P(538, 292)], color: '9FB7C4', alpha: 0.45, edge: 0.7, soft: 0.6, tension: 0.2 })));
  const palette = [['7FA65A', 590, 290], ['D29A45', 604, 294], ['B9B45A', 584, 297]];
  palette.forEach(([col, x, y], i) => s.add(soak(80 + i * 6, watercolor({ x, y, rx: 6, ry: 4, color: col, seed: x, alpha: 0.85, grain: false }), 30)));
  const stool = boil(s, {
    name: 'Stool', seed: 11, hold: CEL, rate: AMBIENT,
    draw: (rr) => [
      inkShape({ pts: jitterPts([P(522, 300), P(600, 300)], 0.6, rr), color: INK, width: 1.6, effect: fx }),
      inkShape({ pts: jitterPts([P(530, 300), P(524, 354)], 0.6, rr), color: INK, width: 1.5, effect: fx }),
      inkShape({ pts: jitterPts([P(592, 300), P(598, 354)], 0.6, rr), color: INK, width: 1.5, effect: fx }),
      inkShape({ pts: jitterPts([P(540, 250), P(538, 292), P(568, 292), P(566, 250)], 0.5, rr), tension: 0.2, color: INK, width: 1.4, effect: fx }),
      inkShape({ pts: jitterPts([P(548, 252), P(544, 214)], 0.5, rr), color: INK, width: 1.2, effect: fx }),
      inkShape({ pts: jitterPts([P(556, 252), P(560, 206)], 0.5, rr), color: INK, width: 1.2, effect: fx }),
      inkShape({ pts: jitterPts([P(562, 252), P(572, 220)], 0.5, rr), color: INK, width: 1.2, effect: fx }),
      inkShape({ pts: blobPts(24, 7, rr, { n: 10, wobble: 0.08 }).map((q) => P(q.x + 594, q.y + 294)), closed: true, color: INK, width: 1.2, effect: fx }),
    ],
  });
  s.add(stool.xml);
  s.loopLayer('Stool boil', stool.animId);

  // a candle on the left: the one light in the room that's brighter than white
  const flameId = ids.next(), glowId = ids.next();
  s.add(soak(60, el('Node', { name: 'glow', x: 150, y: 248, id: glowId }, [watercolor({ rx: 46, ry: 46, color: 'F2C66B', seed: 13, alpha: 0.35, grain: false })]), 60));
  s.add(soak(40, washShape({ pts: [P(142, 262), P(158, 262), P(159, 330), P(141, 330)], color: 'EFE6D2', alpha: 0.9, edge: 0.4, soft: 0.5, blend: 'srcOver', tension: 0.2 })));
  s.add(soak(64, el('Node', { name: 'flame', x: 150, y: 250, id: flameId }, [washShape({ pts: [P(0, -14), P(5, -2), P(3, 6), P(-3, 6), P(-5, -2)], color: 'E8993A', alpha: 0.9, edge: 0.8, soft: 0.4, tension: 0.9 })]), 24));
  const candle = boil(s, {
    name: 'Candle', seed: 17, hold: CEL, rate: AMBIENT,
    draw: (rr) => [
      inkShape({ pts: jitterPts([P(142, 262), P(141, 330), P(159, 330), P(158, 262)], 0.4, rr), tension: 0.2, color: INK, width: 1.3, effect: fx }),
      inkShape({ pts: blobPts(30, 7, rr, { n: 10, wobble: 0.08 }).map((q) => P(q.x + 150, q.y + 334)), closed: true, color: INK, width: 1.3, effect: fx }),
      inkShape({ pts: jitterPts([P(150, 262), P(150, 255)], 0.3, rr), color: INK, width: 1, effect: fx }),
    ],
  });
  s.add(candle.xml);
  s.loopLayer('Candle boil', candle.animId);
  s.loopLayer('Flicker', s.anim({
    name: 'Flicker', duration: 96, loop: 'loop', rate: AMBIENT,
    tracks: [
      { object: flameId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [24, 1.12, 'cubic', EASE.inOut], [40, 0.94, 'cubic', EASE.inOut], [70, 1.08, 'cubic', EASE.inOut], [96, 1]] },
      { object: flameId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [30, 0.06, 'cubic', EASE.inOut], [62, -0.05, 'cubic', EASE.inOut], [96, 0]] },
      { object: glowId, prop: 'opacity', keys: [[0, 0.85, 'cubic', EASE.inOut], [36, 1, 'cubic', EASE.inOut], [70, 0.8, 'cubic', EASE.inOut], [96, 0.85]] },
    ],
  }));

  // the ground
  const ground = boil(s, {
    name: 'Ground', seed: 19, hold: CEL, rate: AMBIENT,
    draw: (rr) => [
      inkShape({ pts: jitterPts(resample([P(70, 356), P(360, 352), P(650, 357)], 9), 0.8, rr), color: INK, width: 1.4, effect: fx }),
      ...[100, 230, 486, 630].map((x) => inkShape({ pts: jitterPts([P(x - 4, 355), P(x, 346), P(x + 3, 355), P(x + 7, 348)], 0.4, rr), tension: 0.3, color: INK, width: 1, effect: fx })),
    ],
  });
  s.add(ground.xml);
  s.loopLayer('Ground boil', ground.animId);

  // the brush, which visits each leaf as its colour comes in
  const brushId = ids.next();
  s.add(soak(90, el('Node', { name: 'brush', x: 556, y: 210, rotation: -0.5, id: brushId }, [
    inkShape({ pts: [P(0, 0), P(46, 58)], color: INK, width: 2.6, bleed: 0.1 }),
    washShape({ pts: [P(-2, -3), P(3, 1), P(-4, -12), P(-7, -10)], color: '6C9A57', alpha: 0.9, edge: 0.8, soft: 0.4, tension: 0.6 }),
  ]), 30));

  // the loop: ink draws itself the first time; then the leaves colour in one by
  // one, in the loader's order, hold a while, and fade so it can begin again
  s.loopLayer('Intro', s.anim({ name: 'Intro', duration: 130, tracks: [{ object: trim, prop: 'end', keys: [[0, 0, 'cubic', [0.55, 0.05, 0.25, 1]], [100, 1]] }, ...soakTracks] }));
  const D = 1020, T0 = 110, STEP = 12, HOLD = 860, FADE = 960;
  const tracks = [];
  const bx = [[0, 556], [T0 - 20, 556]], by = [[0, 210], [T0 - 20, 210]];
  order.forEach((li, k) => {
    const lf = leafNodes[li];
    const t = T0 + k * STEP;
    tracks.push({ object: lf.id, prop: 'opacity', keys: [[0, 0, 'hold'], [t, 0, 'cubic', EASE.out], [t + 18, 1, 'hold'], [HOLD, 1, 'cubic', EASE.inOut], [FADE, 0]] });
    for (const prop of ['scaleX', 'scaleY']) tracks.push({ object: lf.id, prop, keys: [[0, 0.5, 'hold'], [t, 0.5, 'cubic', EASE.back], [t + 22, 1, 'hold'], [FADE, 1, 'hold'], [FADE + 1, 0.5]] });
    // the brush tip (its node origin) lands just right of the leaf
    bx.push([t - 4, lf.p.x + 4]);
    by.push([t - 4, lf.p.y + 2]);
  });
  const last = T0 + order.length * STEP;
  bx.push([last + 30, 556], [D, 556]);
  by.push([last + 30, 210], [D, 210]);
  tracks.push({ object: brushId, prop: 'x', keys: bx.map(([f, v]) => [f, v, 'cubic', EASE.inOut]) });
  tracks.push({ object: brushId, prop: 'y', keys: by.map(([f, v]) => [f, v, 'cubic', EASE.inOut]) });
  s.loopLayer('Paint', s.anim({ name: 'Paint', duration: D, loop: 'loop', rate: 2 * AMBIENT, tracks }));
  return s.toXml();
}

export default function () {
  const ids = new Ids();
  return document(niggle(ids));
}
