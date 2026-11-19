// The wildlife of winter-iii. Every critter is drawn at its own origin (feet at
// y = 0, facing +x unless noted) and returns the node ids its animations move.
// Each is small and quiet: a few washes, an ink line, no more.
import { P, el, argb, pathXml, fill, stroke, blobPts, inkShape, EASE } from '../lib/ink.mjs';
import { ink, SHADOW } from './kit.mjs';

const FOX = 'C86A35';
const SQUIRREL = 'A94E26';
const RAVEN = '1E252B';
const CREST = 'C9302C';

// a wash with an ink edge, back-to-front
function washInk(pts, { color, alpha = 0.85, width = 1, tension = 1, inkA = 0.9, feather = 1, blend } = {}) {
  return [
    el('Shape', { name: 'w', blendModeValue: blend }, [pathXml(pts, { closed: true, tension }), fill(argb(color, alpha), { feather })]),
    inkShape({ pts, closed: true, tension, color: ink(inkA), width, bleed: 0.1 }),
  ];
}
const node = (attrs, kidsBackToFront) => el('Node', attrs, [...kidsBackToFront].reverse());
const dot = (x, y, r, color) => el('Shape', { name: 'dot', x, y }, [el('Ellipse', { width: r * 2, height: r * 2, originX: 0.5, originY: 0.5, name: 'P' }), fill(color)]);
const shadowPool = (rx, ry, y = 0, a = 0.3) => el('Shape', { name: 'shadow', y }, [el('Ellipse', { width: rx * 2, height: ry * 2, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb(SHADOW, a), { feather: 3 })]);

// ---------------------------------------------------------------- keyframe helpers

// alternating keys between -amp and +amp every `half` frames from t0 to t1
export function swingKeys(t0, t1, half, amp, phase = 0, rest = 0) {
  const keys = t0 > 0 ? [[0, rest, 'hold'], [t0, rest, 'cubic', EASE.inOut]] : [[0, rest, 'cubic', EASE.inOut]];
  let t = t0 + half, s = phase ? -1 : 1;
  while (t < t1) {
    keys.push([t, amp * s, 'cubic', EASE.inOut]);
    s = -s;
    t += half;
  }
  keys.push([t1, rest, 'hold']);
  return keys;
}
// hop/bob: a bump of `amp` every `per` frames from t0 to t1 (negative = up)
export function bobKeys(t0, t1, per, amp, rest = 0) {
  const keys = t0 > 0 ? [[0, rest, 'hold'], [t0, rest, 'cubic', EASE.out]] : [[0, rest, 'cubic', EASE.out]];
  let t = t0;
  while (t + per <= t1) {
    keys.push([t + per / 2, rest + amp, 'cubic', EASE.in], [t + per, rest, 'cubic', EASE.out]);
    t += per;
  }
  keys.push([t1, rest, 'hold']);
  return keys;
}
// keyframes must be in frame order and unique per frame
export const tidy = (keys) => {
  const seen = new Map();
  for (const k of keys) seen.set(k[0], k);
  return [...seen.values()].sort((a, b) => a[0] - b[0]);
};

// ---------------------------------------------------------------- red fox (~64 wide)

export function fox(ids, r, { scale = 1 } = {}) {
  const rootId = ids.next(), bobId = ids.next(), headId = ids.next(), tailId = ids.next();
  const legIds = [ids.next(), ids.next(), ids.next(), ids.next()]; // near-front, far-front, near-back, far-back
  const leg = (id, x, far) => el('Node', { name: 'leg', x, y: -13, id }, [
    el('Shape', { name: 'l' }, [pathXml([P(0, 0), P(0.5, 7), P(1, 13)]), stroke(argb(far ? '7A3C1C' : '2A1A12', far ? 0.7 : 0.95), 2.4)]),
  ]);
  const body = blobPts(21, 8.5, r, { n: 10, wobble: 0.05 }).map((p) => P(p.x, p.y - 17));
  const tail = [P(0, -2), P(-9, -7), P(-20, -6), P(-27, 0), P(-20, 6), P(-8, 5)];
  const head = [P(0, -7), P(6, -5), P(13, -1), P(14, 1), P(8, 4), P(0, 5), P(-6, 2), P(-6, -4)];
  const xml = el('Node', { name: 'fox', id: rootId, scaleX: scale, scaleY: scale, opacity: 0 }, [
    shadowPool(26, 4, 0, 0.28),
    el('Node', { name: 'bob', id: bobId }, [
      // back legs behind the body, far side first
      leg(legIds[3], -11, true), leg(legIds[1], 13, true),
      node({ name: 'tail', x: -17, y: -18, id: tailId }, [
        ...washInk(tail, { color: FOX, alpha: 0.85, width: 0.9, tension: 0.9, feather: 1.4 }),
        el('Shape', { name: 'tip' }, [pathXml([P(-27, 0), P(-22, -4), P(-18, 0), P(-22, 4)], { closed: true }), fill(argb('FFFFFF', 0.95), { feather: 1 })]),
      ]),
      ...washInk(body, { color: FOX, alpha: 0.88, width: 1, tension: 1, feather: 1.2 }),
      el('Shape', { name: 'belly' }, [pathXml(blobPts(13, 3.5, r, { n: 7 }).map((p) => P(p.x, p.y - 11)), { closed: true }), fill(argb('F6EFE4', 0.8), { feather: 1.5 })]),
      leg(legIds[2], -9, false), leg(legIds[0], 15, false),
      node({ name: 'head', x: 21, y: -24, id: headId }, [
        ...washInk(head, { color: FOX, alpha: 0.9, width: 0.9, tension: 0.6, feather: 0.8 }),
        el('Shape', { name: 'cheek' }, [pathXml([P(4, 0), P(13, 1), P(8, 4), P(1, 4)], { closed: true, tension: 0.6 }), fill(argb('FBF7F0', 0.9), { feather: 0.6 })]),
        el('Shape', { name: 'ears' }, [pathXml([P(-4, -5), P(-2, -14), P(2, -6)], { closed: true, tension: 0 }), pathXml([P(1, -6), P(5, -13), P(7, -5)], { closed: true, tension: 0 }), fill(argb('2A1A12', 0.9))]),
        dot(14, 0.5, 1.3, argb('1E1A18', 1)),
        dot(5, -2.5, 0.9, argb('1E1A18', 1)),
      ]),
    ].reverse()),
  ].reverse());
  return { xml, rootId, bobId, headId, tailId, legIds };
}

// trot keys for the fox between t0 and t1 (legs, body bob, tail sway)
export function foxTrot(f, t0, t1, { half = 9 } = {}) {
  return [
    { object: f.legIds[0], prop: 'rotation', keys: swingKeys(t0, t1, half, 0.55, 0) },
    { object: f.legIds[1], prop: 'rotation', keys: swingKeys(t0, t1, half, 0.55, 1) },
    { object: f.legIds[2], prop: 'rotation', keys: swingKeys(t0, t1, half, 0.5, 1) },
    { object: f.legIds[3], prop: 'rotation', keys: swingKeys(t0, t1, half, 0.5, 0) },
    { object: f.bobId, prop: 'y', keys: bobKeys(t0, t1, half, -1.6) },
    { object: f.tailId, prop: 'rotation', keys: swingKeys(t0, t1, half * 2, 0.12, 0, -0.05) },
  ];
}

// ---------------------------------------------------------------- snowshoe hare (~34 wide)

export function hare(ids, r) {
  const rootId = ids.next(), peekId = ids.next(), earL = ids.next(), earR = ids.next(), headId = ids.next();
  const body = blobPts(15, 10, r, { n: 9, wobble: 0.06 }).map((p) => P(p.x - 2, p.y - 10));
  const head = blobPts(7.5, 6.5, r, { n: 8, wobble: 0.05 });
  const ear = (id, x, rot) => node({ name: 'ear', x, y: -5, rotation: rot, id }, [
    el('Shape', { name: 'e' }, [pathXml([P(0, 0), P(-3, -8), P(-1, -17), P(2, -17), P(3.5, -8)], { closed: true, tension: 0.6 }), fill(argb('FFFFFF', 1))]),
    el('Shape', { name: 'in' }, [pathXml([P(0, -2), P(-1, -8), P(0.5, -14), P(2, -8)], { closed: true, tension: 0.6 }), fill(argb('E6C9C4', 0.7), { feather: 0.8 })]),
    inkShape({ pts: [P(0, 0), P(-3, -8), P(-1, -17), P(2, -17), P(3.5, -8)], closed: true, tension: 0.6, color: ink(0.85), width: 0.8, bleed: 0 }),
    el('Shape', { name: 'tip' }, [pathXml([P(-1.5, -14), P(-1, -17.5), P(2.5, -17.5), P(2.2, -14)], { closed: true, tension: 0.4 }), fill(argb('1E252B', 0.9))]),
  ]);
  const xml = el('Node', { name: 'hare', id: rootId }, [
    el('Node', { name: 'peek', id: peekId }, [
      ...washInk(body, { color: 'FFFFFF', alpha: 1, width: 1, feather: 0.6, inkA: 0.85 }),
      el('Shape', { name: 'shade', blendModeValue: 'multiply' }, [pathXml(blobPts(9, 4, r, { n: 7 }).map((p) => P(p.x - 4, p.y - 6)), { closed: true }), fill(argb(SHADOW, 0.3), { feather: 2.5 })]),
      node({ name: 'head', x: 11, y: -20, id: headId }, [
        ear(earL, -2, -0.25), ear(earR, 2, 0.1),
        ...washInk(head, { color: 'FFFFFF', alpha: 1, width: 0.9, feather: 0.5, inkA: 0.85 }),
        dot(3.5, -1.5, 1.3, argb('1E1A18', 1)),
        dot(7.5, 1, 0.9, argb('2A2A2A', 0.8)),
      ]),
    ].reverse()),
  ]);
  return { xml, rootId, peekId, headId, earL, earR };
}

// ---------------------------------------------------------------- red squirrel (~26 wide)

export function squirrel(ids, r) {
  const rootId = ids.next(), poseId = ids.next(), tailId = ids.next();
  const body = blobPts(9.5, 6, r, { n: 8, wobble: 0.08 }).map((p) => P(p.x, p.y - 7));
  const tailPts = [P(0, 0), P(-6, -6), P(-9, -14), P(-5, -22), P(2, -20)];
  const xml = el('Node', { name: 'squirrel', id: rootId, opacity: 0 }, [
    el('Node', { name: 'pose', id: poseId }, [
      el('Node', { name: 'tail', x: -8, y: -6, id: tailId }, [
        el('Shape', { name: 'fur' }, [pathXml(tailPts, { tension: 0.9 }), stroke(argb(SQUIRREL, 0.8), 6, { feather: 1.6 })]),
        el('Shape', { name: 'line' }, [pathXml(tailPts, { tension: 0.9 }), stroke(ink(0.7), 0.8)]),
      ].reverse()),
      ...washInk(body, { color: SQUIRREL, alpha: 0.85, width: 0.9, feather: 1 }),
      el('Shape', { name: 'belly' }, [pathXml(blobPts(5, 2.2, r, { n: 6 }).map((p) => P(p.x, p.y - 4)), { closed: true }), fill(argb('F6EFE4', 0.85), { feather: 1 })]),
      el('Shape', { name: 'legs' }, [pathXml([P(-5, -2), P(-6, 0)]), pathXml([P(5, -2), P(6.5, 0)]), stroke(ink(0.8), 1.2)]),
      node({ name: 'head', x: 9, y: -11 }, [
        ...washInk(blobPts(4.6, 4, r, { n: 7 }), { color: SQUIRREL, alpha: 0.9, width: 0.8, feather: 0.6 }),
        el('Shape', { name: 'ears' }, [pathXml([P(-3, -3), P(-2.5, -7), P(0, -3.5)], { closed: true, tension: 0 }), pathXml([P(0.5, -3.5), P(2, -7), P(3.5, -2.5)], { closed: true, tension: 0 }), fill(argb(SQUIRREL, 0.95))]),
        dot(1.5, -1, 0.9, argb('1E1A18', 1)),
        dot(4.6, 0.5, 0.7, argb('1E1A18', 0.9)),
      ]),
    ].reverse()),
  ]);
  return { xml, rootId, poseId, tailId };
}

// a squirrel run: from x0 to x1 along y, with a sit-up pause in the middle
export function squirrelRun(sq, { x0, x1, y, t0 = 0, run = 70, pause = 70 }) {
  const mid = (x0 + x1) / 2;
  const t1 = t0 + run, t2 = t1 + pause, t3 = t2 + run;
  return [
    { object: sq.rootId, prop: 'x', keys: [[0, x0, 'hold'], [t0, x0, 'linear'], [t1, mid, 'hold'], [t2, mid, 'linear'], [t3, x1, 'hold']] },
    { object: sq.rootId, prop: 'y', keys: tidy([...bobKeys(t0, t1, 10, -5, y), ...bobKeys(t2, t3, 10, -5, y)]) },
    { object: sq.rootId, prop: 'opacity', keys: [[0, 0, 'hold'], [t0, 0, 'linear'], [t0 + 6, 1, 'hold'], [t3 - 8, 1, 'linear'], [t3, 0, 'hold']] },
    { object: sq.poseId, prop: 'rotation', keys: [[0, 0, 'hold'], [t1, 0, 'cubic', EASE.out], [t1 + 8, -0.9, 'hold'], [t2 - 8, -0.9, 'cubic', EASE.out], [t2, 0, 'hold']] },
    { object: sq.tailId, prop: 'rotation', keys: tidy([...swingKeys(t0, t1, 5, 0.25), [t1 + 20, 0.15, 'cubic', EASE.inOut], [t1 + 40, -0.1, 'cubic', EASE.inOut], [t2 - 10, 0.1], ...swingKeys(t2, t3, 5, 0.25)]) },
  ];
}

// ---------------------------------------------------------------- raven (perched, facing -x, ~34 tall)

export function raven(ids, r) {
  const rootId = ids.next(), flyId = ids.next(), bodyId = ids.next(), headId = ids.next(), wingId = ids.next();
  const body = [P(-9, -8), P(-7, -20), P(0, -27), P(8, -24), P(12, -14), P(16, -2), P(10, -3), P(2, -2), P(-6, -3)];
  const head = blobPts(6.5, 6, r, { n: 8, wobble: 0.05 });
  const xml = el('Node', { name: 'raven', id: rootId }, [
    el('Node', { name: 'fly', id: flyId }, [
      el('Node', { name: 'body', id: bodyId }, [
        ...washInk(body, { color: RAVEN, alpha: 0.95, width: 1, tension: 0.8, feather: 0.8, inkA: 1 }),
        el('Shape', { name: 'sheen', blendModeValue: 'screen' }, [pathXml([P(-4, -18), P(2, -23), P(6, -18)], { tension: 0.9 }), stroke(argb('7D8FA3', 0.4), 2.2, { feather: 1.2 })]),
        el('Node', { name: 'wing', x: 0, y: -22, id: wingId }, [
          el('Shape', { name: 'w' }, [pathXml([P(-3, 0), P(4, 4), P(10, 12), P(14, 20), P(8, 14), P(1, 8)], { closed: true, tension: 0.7 }), fill(argb('2A323A', 0.95), { feather: 0.6 })]),
        ]),
        el('Shape', { name: 'feet' }, [pathXml([P(-4, -3), P(-6, 0), P(-9, 1)]), pathXml([P(-4, -3), P(-3, 0), P(0, 1)]), pathXml([P(0, -3), P(1, 0), P(4, 1)]), stroke(ink(0.95), 1)]),
        node({ name: 'head', x: -7, y: -25, id: headId }, [
          ...washInk(head, { color: RAVEN, alpha: 0.98, width: 0.9, feather: 0.5, inkA: 1 }),
          el('Shape', { name: 'beak' }, [pathXml([P(-5, -2.5), P(-17, 0.5), P(-5, 2.5)], { closed: true, tension: 0.2 }), fill(argb('1A1F24', 1))]),
          el('Shape', { name: 'beakline' }, [pathXml([P(-5.5, 0.3), P(-14, 0.6)]), stroke(argb('5A6670', 0.8), 0.5)]),
          dot(-2, -1.5, 1.2, argb('F2EFE8', 0.9)),
          dot(-2, -1.5, 0.7, argb('111416', 1)),
        ]),
      ].reverse()),
    ]),
  ]);
  return { xml, rootId, flyId, bodyId, headId, wingId };
}

// ---------------------------------------------------------------- pileated woodpecker (clinging, facing -x, ~44 tall)

export function woodpecker(ids, r) {
  const rootId = ids.next(), headId = ids.next();
  const body = [P(-4, 0), P(-7, -10), P(-6, -22), P(-2, -30), P(5, -28), P(8, -16), P(9, -4), P(6, 8), P(2, 10)];
  const xml = el('Node', { name: 'woodpecker', id: rootId }, [
    ...washInk(body, { color: RAVEN, alpha: 0.95, width: 1, tension: 0.8, feather: 0.8, inkA: 1 }),
    el('Shape', { name: 'wingstripe' }, [pathXml([P(1, -22), P(4, -14), P(6, -5)], { tension: 0.9 }), stroke(argb('F4F1EA', 0.85), 1.6)]),
    el('Shape', { name: 'feet' }, [pathXml([P(-6, -4), P(-10, -2), P(-11, 1)]), pathXml([P(-5, 2), P(-9, 4), P(-10, 7)]), stroke(ink(0.95), 1)]),
    node({ name: 'head', x: -3, y: -30, id: headId }, [
      // crest, neck stripes, long chisel beak
      el('Shape', { name: 'crest' }, [pathXml([P(-3, -4), P(2, -13), P(9, -16), P(12, -10), P(8, -3)], { closed: true, tension: 0.5 }), fill(argb(CREST, 0.92), { feather: 0.6 })]),
      ...washInk(blobPts(6.5, 5.5, r, { n: 8, wobble: 0.05 }), { color: RAVEN, alpha: 0.98, width: 0.9, feather: 0.5, inkA: 1 }),
      el('Shape', { name: 'cheek' }, [pathXml([P(-5, 1), P(2, -1), P(7, 2), P(9, 8)], { tension: 0.8 }), stroke(argb('F4F1EA', 0.9), 1.6)]),
      el('Shape', { name: 'mal' }, [pathXml([P(-4, 3), P(1, 3.5)]), stroke(argb(CREST, 0.9), 1.4)]),
      el('Shape', { name: 'beak' }, [pathXml([P(-5, -1.5), P(-18, 0.5), P(-5, 2)], { closed: true, tension: 0.1 }), fill(argb('6B6F72', 1))]),
      dot(-1.5, -1.5, 1.2, argb('F7F3EA', 1)),
      dot(-1.5, -1.5, 0.6, argb('111416', 1)),
    ]),
  ].reverse());
  return { xml, rootId, headId };
}

// a burst of n taps starting at t; returns head keys (rotation) with pecking
export function peckKeys(t, n = 5, gap = 5) {
  const keys = [[t, 0, 'cubic', EASE.in]];
  for (let i = 0; i < n; i++) keys.push([t + i * gap + 2, -0.32, 'cubic', EASE.out], [t + i * gap + gap, 0, 'cubic', EASE.in]);
  keys[keys.length - 1][2] = 'hold';
  return keys;
}

// wood chips flying off the beak point at time t
export function chips(ids, r, c, t, tracks, n = 4) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const id = ids.next();
    out.push(el('Shape', { name: 'chip', x: c.x, y: c.y, opacity: 0, id }, [pathXml(blobPts(1.6, 1, r, { n: 5, wobble: 0.3 }), { closed: true }), fill(argb('D9B98E', 0.95))]));
    const t0 = t + Math.round(r.range(0, 10));
    const len = Math.round(r.range(30, 50));
    tracks.push(
      { object: id, prop: 'x', keys: [[t0, c.x, 'cubic', EASE.out], [t0 + len, c.x - r.range(4, 22)]] },
      { object: id, prop: 'y', keys: [[t0, c.y, 'cubic', [0.3, 0, 0.9, 0.5]], [t0 + len, c.y + r.range(24, 44)]] },
      { object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [t0, 0, 'linear'], [t0 + 2, 1, 'hold'], [t0 + len - 8, 1, 'linear'], [t0 + len, 0, 'hold']] },
    );
  }
  return out;
}

// ---------------------------------------------------------------- a small flock in flight (snow buntings)

export function flock(ids, r, n = 7) {
  const groupId = ids.next();
  const birds = [];
  const kids = [];
  for (let i = 0; i < n; i++) {
    const id = ids.next(), wId = ids.next();
    const ox = r.range(-34, 34), oy = r.range(-14, 14);
    birds.push({ id, wId, ox, oy, phase: r.range(0, 1) });
    kids.push(el('Node', { name: 'bird', x: ox, y: oy, id }, [
      el('Node', { name: 'wings', id: wId }, [
        el('Shape', { name: 'w' }, [pathXml([P(-5, -2.5), P(-1.5, 0), P(0, 0.4), P(1.5, 0), P(5, -2.5)], { tension: 0.5 }), stroke(ink(0.8), 1.1)]),
        dot(0, 0.2, 1.1, ink(0.9)),
      ]),
    ]));
  }
  const xml = el('Node', { name: 'flock', id: groupId, opacity: 0 }, kids);
  return { xml, groupId, birds };
}

// a flock crossing: group moves along pts (x,y pairs) between t0 and t1 while wings flap
export function flockFlight(f, { from, to, t0, t1, dip = 30 }) {
  const mid = P((from.x + to.x) / 2, Math.min(from.y, to.y) - dip);
  const tracks = [
    { object: f.groupId, prop: 'x', keys: [[0, from.x, 'hold'], [t0, from.x, 'cubic', [0.3, 0, 0.7, 1]], [t1, to.x, 'hold']] },
    { object: f.groupId, prop: 'y', keys: [[0, from.y, 'hold'], [t0, from.y, 'cubic', EASE.out], [(t0 + t1) / 2, mid.y, 'cubic', EASE.in], [t1, to.y, 'hold']] },
    { object: f.groupId, prop: 'opacity', keys: [[0, 0, 'hold'], [t0, 0, 'linear'], [t0 + 20, 1, 'hold'], [t1 - 25, 1, 'linear'], [t1, 0, 'hold']] },
  ];
  for (const b of f.birds) {
    const half = 7 + Math.round(b.phase * 3);
    tracks.push({ object: b.wId, prop: 'scaleY', keys: swingKeys(t0, t1, half, 0.9, b.phase > 0.5 ? 1 : 0, 1) });
    // each bird wanders a little inside the group
    tracks.push({ object: b.id, prop: 'y', keys: tidy([[0, b.oy, 'hold'], ...bobKeys(t0, t1, 40 + Math.round(b.phase * 30), -8 - b.phase * 6, b.oy)]) });
  }
  return tracks;
}
