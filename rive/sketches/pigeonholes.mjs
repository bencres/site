// Pigeonholes (006, plugins and the registry pattern): the post counter. The day's
// post comes up out of the bag one piece at a time and goes to the pigeonholes for
// its kind (letters, parcels, scrolls), each kind keeping its own. A mushroom turns
// up in the bag too; there's no hole for that, so it's left on the counter.
import { P, washShape, watercolor, EASE } from '../lib/ink.mjs';
import { sketch, group, INK_SOFT, STORY } from './common.mjs';

const PAPER = 'F8F2E4';
const oval = (cx, cy, rx, ry, n = 12) => Array.from({ length: n }, (_, i) => P(cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry));
const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)];
const loop = (pts) => [...pts, pts[0]];
// paper things stay pale against the dark of a pigeonhole
const card = (pts, color, o = {}) => washShape({ pts, color, alpha: 0.95, edge: 0.6, soft: 0.4, blend: 'srcOver', tension: o.t ?? 0.1 });

// the pieces of post, each drawn about its middle
const KINDS = {
  letter: {
    wash: () => [card(rect(-20, -13, 20, 13), 'F1E8D4'), watercolor({ x: 0, y: 1, rx: 4, ry: 4, color: 'B9483A', seed: 7, alpha: 0.9, grain: false })],
    ink: (pen) => [pen(loop(rect(-20, -13, 20, 13)), { t: 0.05, w: 1.2, j: 0.3 }), pen([P(-20, -13), P(0, 2), P(20, -13)], { t: 0.2, w: 1, j: 0.3 })],
  },
  parcel: {
    wash: () => [card(rect(-18, -14, 18, 14), 'D2B07A')],
    ink: (pen) => [
      pen(loop(rect(-18, -14, 18, 14)), { t: 0.05, w: 1.3, j: 0.3 }),
      pen([P(0, -14), P(0, 14)], { w: 0.9, j: 0.2 }),
      pen([P(-18, 0), P(18, 0)], { w: 0.9, j: 0.2 }),
      pen([P(0, -14), P(-7, -21), P(-2, -14), P(4, -21), P(0, -14)], { w: 0.9, j: 0.2 }),
    ],
  },
  scroll: {
    wash: () => [card(rect(-24, -6, 24, 6), 'E8D9B0'), card(rect(-2, -7, 3, 7), '7F9A5A')],
    ink: (pen) => [
      pen([P(-24, -6), P(24, -6)], { w: 1.1, j: 0.3 }),
      pen([P(-24, 6), P(24, 6)], { w: 1.1, j: 0.3 }),
      pen(oval(24, 0, 2.5, 6, 8), { closed: true, w: 1, j: 0.2 }),
      pen(oval(-24, 0, 2.5, 6, 8), { closed: true, w: 1, j: 0.2 }),
    ],
  },
  mushroom: {
    wash: () => [
      card([P(-5, -2), P(5, -2), P(6, 14), P(-6, 14)], 'EFE6D2', { t: 0.4 }),
      card([P(-18, 0), P(-14, -12), P(0, -18), P(14, -12), P(18, 0)], 'C9583A', { t: 0.7 }),
      ...[[-8, -8], [3, -12], [10, -5]].map(([dx, dy], i) => watercolor({ x: dx, y: dy, rx: 2.4, ry: 2, color: 'FFFFFF', seed: 20 + i, alpha: 0.9, grain: false })),
    ],
    ink: (pen) => [
      pen([P(-18, 0), P(-14, -12), P(0, -18), P(14, -12), P(18, 0), P(-18, 0)], { t: 0.7, w: 1.3, j: 0.3 }),
      pen([P(-5, 0), P(-6, 14), P(6, 14), P(5, 0)], { t: 0.4, w: 1.2, j: 0.3 }),
    ],
  },
};

export default function pigeonholes(ids, x = 0) {
  const { s, soak, line, intro } = sketch(ids, { name: 'Pigeonholes', x });

  s.add(soak(0, watercolor({ x: 380, y: 160, rx: 320, ry: 140, color: 'D6CDB4', seed: 3, alpha: 0.3, grain: false }), 70));

  // the rack: three columns, two rows; a painted plate over each column for its kind
  const X0 = 316, CW = 96, Y0 = 58, HEAD = 26, RH = 106;
  const X1 = X0 + 3 * CW, Y1 = Y0 + HEAD + 2 * RH;
  s.add(soak(24, washShape({ pts: rect(X0 - 8, Y0 - 6, X1 + 8, Y1 + 4), color: '8A6A48', alpha: 0.55, edge: 0.7, soft: 0.6, tension: 0.04 }), 50));
  const holes = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) holes.push(rect(X0 + c * CW + 4, Y0 + HEAD + r * RH + 4, X0 + (c + 1) * CW - 4, Y0 + HEAD + (r + 1) * RH - 2));
  s.add(soak(36, holes.map((h) => washShape({ pts: h, color: '3E3228', alpha: 0.48, edge: 0.6, soft: 3, tension: 0.04 })), 50));
  s.add(soak(48, [0, 1, 2].map((c) => washShape({ pts: rect(X0 + c * CW + 24, Y0 + 3, X0 + (c + 1) * CW - 24, Y0 + HEAD - 3), color: 'C99A2E', alpha: 0.55, edge: 0.7, soft: 0.4, tension: 0.05 }))));
  line('Rack', 7, (pen) => {
    const lines = [pen(loop(rect(X0 - 8, Y0 - 6, X1 + 8, Y1 + 4)), { t: 0.03, w: 1.6, j: 0.5 })];
    lines.push(pen([P(X0 - 8, Y0 + HEAD), P(X1 + 8, Y0 + HEAD)], { w: 1.3, j: 0.4 }));
    lines.push(pen([P(X0 - 8, Y0 + HEAD + RH), P(X1 + 8, Y0 + HEAD + RH)], { w: 1.4, j: 0.4 }));
    for (let c = 1; c < 3; c++) lines.push(pen([P(X0 + c * CW, Y0 + HEAD), P(X0 + c * CW, Y1 + 4)], { w: 1.4, j: 0.4 }));
    for (const h of holes) lines.push(pen([h[3], h[0], h[1]], { t: 0.04, color: INK_SOFT, w: 0.9, j: 0.4 }));
    // the plates: an envelope, a tied parcel, a scroll
    const mid = (c) => X0 + (c + 0.5) * CW, py = Y0 + HEAD / 2;
    lines.push(pen(loop(rect(mid(0) - 9, py - 6, mid(0) + 9, py + 6)), { t: 0.05, w: 1, j: 0.2 }), pen([P(mid(0) - 9, py - 6), P(mid(0), py + 1), P(mid(0) + 9, py - 6)], { w: 0.9, j: 0.2 }));
    lines.push(pen(loop(rect(mid(1) - 8, py - 6, mid(1) + 8, py + 6)), { t: 0.05, w: 1, j: 0.2 }), pen([P(mid(1), py - 6), P(mid(1), py + 6)], { w: 0.8, j: 0.1 }), pen([P(mid(1) - 8, py), P(mid(1) + 8, py)], { w: 0.8, j: 0.1 }));
    lines.push(pen([P(mid(2) - 11, py - 4), P(mid(2) + 11, py - 4)], { w: 1, j: 0.2 }), pen([P(mid(2) - 11, py + 4), P(mid(2) + 11, py + 4)], { w: 1, j: 0.2 }), pen(oval(mid(2) + 11, py, 2, 4, 8), { closed: true, w: 0.9, j: 0.1 }), pen(oval(mid(2) - 11, py, 2, 4, 8), { closed: true, w: 0.9, j: 0.1 }));
    return lines;
  });

  // the counter, an inkpot and its quill
  s.add(soak(14, washShape({ pts: [P(52, 296), P(668, 294), P(672, 352), P(48, 354)], color: 'A07A4E', alpha: 0.42, edge: 0.4, soft: 4, tension: 0.04 }), 60));
  s.add(soak(60, watercolor({ x: 276, y: 284, rx: 10, ry: 10, color: '2F4A5A', seed: 31, alpha: 0.7, grain: false })));
  line('Counter', 9, (pen) => [
    pen([P(40, 296), P(360, 293), P(680, 295)], { w: 1.6, j: 0.6 }),
    pen([P(50, 306), P(360, 304), P(670, 306)], { color: INK_SOFT, w: 1.1, j: 0.6 }),
    pen([P(54, 352), P(360, 350), P(668, 353)], { w: 1.3, j: 0.7 }),
    pen([P(266, 293), P(266, 278), P(270, 274), P(282, 274), P(286, 278), P(286, 293)], { t: 0.4, w: 1.2, j: 0.3 }),
    pen([P(278, 276), P(292, 236), P(304, 214)], { w: 1.1, j: 0.3 }),
    pen([P(290, 244), P(306, 214), P(298, 236), P(290, 244)], { w: 0.9, j: 0.2 }),
  ]);

  // the post, in the order it comes out of the bag, and where each piece goes
  const BAG = P(176, 262);
  const hole = (c, r) => ({ x: X0 + (c + 0.5) * CW, y: Y0 + HEAD + (r + 1) * RH - 2 });
  const post = [
    { kind: 'letter', to: P(hole(0, 0).x - 4, hole(0, 0).y - 13), rot: -0.05 },
    { kind: 'parcel', to: P(hole(1, 0).x, hole(1, 0).y - 14) },
    { kind: 'scroll', to: P(hole(2, 0).x, hole(2, 0).y - 7) },
    { kind: 'letter', to: P(hole(0, 1).x, hole(0, 1).y - 13), rot: 0.03 },
    { kind: 'mushroom', to: P(650, 280), stray: true },
    { kind: 'parcel', to: P(hole(1, 1).x + 2, hole(1, 1).y - 14), rot: 0.04 },
    { kind: 'scroll', to: P(hole(2, 1).x, hole(2, 1).y - 7), rot: -0.03 },
    { kind: 'letter', to: P(hole(0, 0).x + 6, hole(0, 0).y - 20), rot: 0.12 },
  ];
  post.forEach((p, i) => {
    p.id = ids.next();
    s.add(group({ name: p.kind, id: p.id, x: BAG.x, y: BAG.y, opacity: 0 }, [
      ...KINDS[p.kind].wash(),
      line(`${p.kind} ${i}`, 40 + i, (pen) => KINDS[p.kind].ink(pen), { add: false, drawn: false }).xml,
    ]));
  });

  // the post bag, in front of whatever's still in it
  const bag = [P(118, 232), P(236, 232), P(242, 290), P(228, 298), P(126, 298), P(112, 290)];
  s.add(soak(40, [card([P(140, 236), P(176, 226), P(182, 240)], 'F1E8D4'), card([P(170, 238), P(206, 222), P(214, 236)], 'F1E8D4')]));
  s.add(soak(50, [
    washShape({ pts: bag, color: PAPER, alpha: 1, edge: 0, soft: 0.5, blend: 'srcOver', tension: 0.4 }),
    washShape({ pts: bag, color: '8A6A48', alpha: 0.6, edge: 0.8, soft: 1, tension: 0.4 }),
    washShape({ pts: [P(150, 248), P(204, 248), P(200, 270), P(154, 270)], color: 'C99A2E', alpha: 0.4, edge: 0.6, soft: 0.5, tension: 0.2 }),
  ]));
  line('Bag', 11, (pen) => [
    pen(loop(bag), { t: 0.4, w: 1.6, j: 0.5 }),
    pen([P(140, 236), P(176, 226), P(182, 240)], { w: 1, j: 0.2 }),
    pen([P(170, 238), P(206, 222), P(214, 236)], { w: 1, j: 0.2 }),
    pen([P(122, 236), P(138, 196), P(176, 182), P(214, 196), P(232, 236)], { w: 1.5, j: 0.5 }),
    pen([P(129, 236), P(143, 202), P(176, 190), P(209, 202), P(225, 236)], { color: INK_SOFT, w: 1, j: 0.4 }),
    pen(loop([P(150, 248), P(204, 248), P(200, 270), P(154, 270)]), { t: 0.2, w: 1.1, j: 0.3 }),
  ]);

  // the story: each piece up out of the bag and across to its kind's hole; the
  // mushroom finds no hole, thinks about it, and hops down onto the counter
  const T0 = 170, STEP = 88, CLEAR = T0 + post.length * STEP + 300, D = CLEAR + 120;
  const tracks = [];
  post.forEach((p, i) => {
    const t = T0 + i * STEP, rot = p.rot || 0, spin = i % 2 ? 0.5 : -0.4;
    const peak = Math.min(p.to.y, 150) - 46;
    if (!p.stray) {
      tracks.push({ object: p.id, prop: 'x', keys: [[0, BAG.x, 'hold'], [t, BAG.x, 'cubic', EASE.out], [t + 18, BAG.x + 6, 'cubic', EASE.inOut], [t + 62, p.to.x]] });
      tracks.push({ object: p.id, prop: 'y', keys: [[0, BAG.y, 'hold'], [t, BAG.y, 'cubic', EASE.out], [t + 18, 196, 'cubic', EASE.inOut], [t + 44, peak, 'cubic', EASE.in], [t + 62, p.to.y]] });
      tracks.push({ object: p.id, prop: 'rotation', keys: [[0, 0, 'hold'], [t + 10, 0, 'cubic', EASE.inOut], [t + 40, spin, 'cubic', EASE.inOut], [t + 62, rot]] });
    } else {
      const H = P(X0 + 1.5 * CW, 124); // in front of the rack, looking for its place
      tracks.push({ object: p.id, prop: 'x', keys: [[0, BAG.x, 'hold'], [t, BAG.x, 'cubic', EASE.out], [t + 18, BAG.x + 6, 'cubic', EASE.inOut], [t + 62, H.x, 'hold'], [t + 130, H.x, 'cubic', EASE.inOut], [t + 176, p.to.x]] });
      tracks.push({ object: p.id, prop: 'y', keys: [[0, BAG.y, 'hold'], [t, BAG.y, 'cubic', EASE.out], [t + 18, 196, 'cubic', EASE.inOut], [t + 62, H.y, 'hold'], [t + 130, H.y, 'cubic', EASE.out], [t + 150, H.y - 36, 'cubic', EASE.in], [t + 176, p.to.y, 'cubic', EASE.out], [t + 184, p.to.y - 5, 'cubic', EASE.in], [t + 192, p.to.y]] });
      tracks.push({ object: p.id, prop: 'rotation', keys: [[0, 0, 'hold'], [t + 62, 0, 'cubic', EASE.inOut], [t + 74, -0.22, 'cubic', EASE.inOut], [t + 88, 0.2, 'cubic', EASE.inOut], [t + 102, -0.14, 'cubic', EASE.inOut], [t + 116, 0, 'hold'], [t + 140, 0, 'cubic', EASE.inOut], [t + 176, 0.08, 'cubic', EASE.inOut], [t + 192, 0]] });
    }
    tracks.push({ object: p.id, prop: 'opacity', keys: [[0, 0, 'hold'], [t, 0, 'cubic', EASE.out], [t + 10, 1, 'hold'], [CLEAR + i * 6, 1, 'cubic', EASE.inOut], [CLEAR + 50 + i * 6, 0]] });
  });
  s.loopLayer('Sorting', s.anim({ name: 'Sorting', duration: D, loop: 'loop', rate: STORY, tracks }));

  intro();
  return s.toXml();
}
