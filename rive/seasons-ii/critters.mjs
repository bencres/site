// The animals and small plants that visit through the year. Each returns xml
// (painter's order inside a group) and registers its own idle loop on the scene.
import { P, el, argb, pathXml, fill, stroke, blobPts, jitterPts, inkShape, boil, EASE, TAU, resample, darken } from '../lib/ink.mjs';
import { ink, group, blot, eye, ticks, twinkle } from './bits.mjs';

// ---------------------------------------------------------------- a goose in profile, flying left
// body + long neck + head, two wings that beat about the shoulder (never inverting),
// line boil on the body so the skein feels hand-traced. The wingbeat is its own
// short loop; the skein's long crossing only keys the flock's position.
export const FLAP = 36;
export function goose(ids, s, r, { seed, phase = 0, far = false }) {
  const nearId = ids.next(), farId = ids.next(), bobId = ids.next();
  const a = far ? 0.55 : 0.85;
  const bodyPts = [P(-6, 0.2), P(-3, -1.6), P(2, -1.8), P(7, -0.4), P(9.5, 0.6), P(6, 1.8), P(0, 2.1), P(-4, 1.5)];
  const neck = [P(-5, -0.4), P(-8.5, -1.4), P(-12, -2.3)];
  const wingPts = [P(-0.5, -0.2), P(2.4, -4.8), P(5.8, -9.2), P(10, -12.6), P(9.6, -9.4), P(6.8, -5.2), P(3.8, -1.6), P(2, 1.2)];
  const wing = (id, alpha, off) => el('Node', { name: 'wing', x: 0.6 + off, y: -0.8, id, rotation: 0 }, [
    el('Shape', { name: 'w' }, [pathXml(wingPts, { closed: true, tension: 0.55 }), fill(ink(alpha)), stroke(ink(alpha * 0.9), 0.6)]),
  ]);
  const body = boil(s, {
    name: `goose${seed}`, seed, hold: 9,
    draw: (rr) => [
      el('Shape', { name: 'body' }, [pathXml(jitterPts(bodyPts, 0.35, rr), { closed: true, tension: 0.6 }), fill(ink(a))]),
      inkShape({ pts: jitterPts(neck, 0.3, rr), tension: 0.9, color: ink(a), width: 1.3, bleed: 0 }),
      el('Shape', { name: 'head' }, [el('Ellipse', { x: -12.8, y: -2.5, width: 3.2, height: 2.3, rotation: -0.2, originX: 0.5, originY: 0.5, name: 'h' }), fill(ink(a))]),
      inkShape({ pts: [P(-14, -2.5), P(-16, -2.2)], color: ink(a), width: 0.8, bleed: 0 }),
    ],
  });
  s.loopLayer(`goose ${seed} boil`, body.animId);
  const xml = el('Node', { name: 'goose', id: bobId }, [wing(farId, a * 0.55, -0.8), body.xml, wing(nearId, a, 0)].reverse());
  // one wingbeat: a quick downstroke, a slower lift; the wings stay between raised and a little below level
  const ph = Math.round(phase) % FLAP;
  const cyc = (ks) => {
    const out = ks.map(([f, v, i, e]) => [(f + ph) % FLAP, v, i, e]).sort((p, q) => p[0] - q[0]);
    if (out[0][0] !== 0) {
      // wrap: the value at frame 0 is the interpolation of the last and first keys
      const last = out[out.length - 1], first = out[0];
      const span = FLAP - last[0] + first[0];
      const v0 = last[1] + ((first[1] - last[1]) * (FLAP - last[0])) / span;
      out.unshift([0, v0, 'cubic', EASE.inOut]);
    }
    out.push([FLAP, out[0][1]]);
    return out;
  };
  const down = Math.round(FLAP * 0.42);
  return {
    xml,
    tracks: [
      { object: nearId, prop: 'rotation', keys: cyc([[0, -1.0, 'cubic', [0.4, 0, 0.6, 1]], [down, 0.75, 'cubic', [0.35, 0, 0.5, 1]]]) },
      { object: farId, prop: 'rotation', keys: cyc([[2, -0.95, 'cubic', [0.4, 0, 0.6, 1]], [down + 2, 0.62, 'cubic', [0.35, 0, 0.5, 1]]]) },
      { object: bobId, prop: 'y', keys: cyc([[0, 0.6, 'cubic', EASE.inOut], [down, -0.6, 'cubic', EASE.inOut]]) },
    ],
  };
}

// a V of geese; `dir` = -1 flies left (south, autumn), +1 flies right (north, spring)
export function skein(ids, s, r, { seed, LOOP, W, y0, y1, dir = -1, count = 8, scale = 1 }) {
  const vId = ids.next();
  const slots = [[0, 0]];
  for (let i = 1; i < count; i++) {
    const k = Math.ceil(i / 2);
    slots.push([k * 15 + r.jit(2), (i % 2 ? -1 : 1) * k * 8.5 + r.jit(2)]);
  }
  const geese = [];
  const flap = [];
  slots.forEach(([dx, dy], i) => {
    const g = goose(ids, s, r, { seed: seed * 10 + i, phase: r.range(0, FLAP), far: i > 0 && r() < 0.35 });
    geese.push(el('Node', { name: 'slot', x: dx, y: dy, scaleX: 1 - (i > 0 ? 0.06 : 0) }, g.xml));
    flap.push(...g.tracks);
  });
  s.loopLayer(`flap ${seed}`, s.anim({ name: `Flap ${seed}`, duration: FLAP, loop: 'loop', tracks: flap }));
  const xStart = dir < 0 ? W + 160 : -220;
  const xEnd = dir < 0 ? -220 : W + 160;
  const v = el('Node', { name: 'skein', id: vId, x: xStart, y: y0, scaleX: scale * -dir, scaleY: scale }, geese.reverse());
  const travel = Math.round(LOOP * 0.74);
  const tracks = [
    { object: vId, prop: 'x', keys: [[0, xStart, 'linear'], [travel, xEnd, 'hold'], [LOOP, xStart]] },
    { object: vId, prop: 'y', keys: [[0, y0, 'linear'], [travel, y1, 'hold'], [LOOP, y0]] },
  ];
  return { xml: v, tracks };
}

// ---------------------------------------------------------------- a hare in its white coat, sitting, facing left
export function hare(ids, s, r, { x, y, scale = 1 }) {
  const earId = ids.next();
  const body = blobPts(15, 11, r, { n: 10, wobble: 0.06 }).map((p) => P(p.x + 2, p.y - 11));
  const head = blobPts(6.5, 6, r, { n: 9, wobble: 0.05 }).map((p) => P(p.x - 13, p.y - 18));
  const xml = group({ name: 'hare', x, y, scaleX: scale, scaleY: scale }, [
    blot({ x: 2, y: 1, rx: 17, ry: 4, color: '7F97AB', alpha: 0.35, r, soft: 4, name: 'shadow' }),
    el('Shape', { name: 'body' }, [pathXml(body, { closed: true }), fill(argb('FFFFFF', 1))]),
    blot({ x: 6, y: -6, rx: 10, ry: 5, color: '9DB6CC', alpha: 0.3, r, soft: 3, name: 'shade' }),
    inkShape({ pts: body, closed: true, color: ink(0.85), width: 1.1, bleed: 0.12 }),
    // haunch and a tucked foreleg
    inkShape({ pts: [P(9, -14), P(13, -8), P(10, -2)], tension: 0.9, color: ink(0.6), width: 0.8, bleed: 0 }),
    inkShape({ pts: [P(-7, -2), P(-11, -1), P(-13, 0.5)], color: ink(0.7), width: 0.8, bleed: 0 }),
    el('Shape', { name: 'head' }, [pathXml(head, { closed: true }), fill(argb('FFFFFF', 1))]),
    inkShape({ pts: head, closed: true, color: ink(0.9), width: 1.1, bleed: 0.1 }),
    el('Node', { name: 'ears', x: -11, y: -23, id: earId }, [
      el('Shape', { name: 'ear' }, [el('Ellipse', { x: 1, y: -8, width: 5, height: 16, rotation: 0.25, originX: 0.5, originY: 0.5, name: 'e' }), fill(argb('FFFFFF', 1)), stroke(ink(0.85), 1)]),
      el('Shape', { name: 'inner' }, [el('Ellipse', { x: 1, y: -8, width: 2.2, height: 11, rotation: 0.25, originX: 0.5, originY: 0.5, name: 'e' }), fill(argb('E8B9B0', 0.8))]),
      el('Shape', { name: 'ear2' }, [el('Ellipse', { x: -3.5, y: -8, width: 5, height: 15, rotation: -0.1, originX: 0.5, originY: 0.5, name: 'e' }), fill(argb('FFFFFF', 1)), stroke(ink(0.85), 1)]),
    ].reverse()),
    ...eye(-15.5, -19, 1.3),
    el('Shape', { name: 'nose' }, [el('Ellipse', { x: -19.5, y: -16.5, width: 1.8, height: 1.4, originX: 0.5, originY: 0.5, name: 'n' }), fill(argb('5A4A4A', 0.9))]),
    ticks([[P(-19, -15.5), P(-23, -14.8)], [P(-19, -15), P(-23, -13.5)], [P(-19, -16), P(-23, -17)]], { width: 0.45, color: ink(0.5) }),
  ]);
  const LOOP = 540;
  s.loopLayer(`hare ${x}`, s.anim({
    name: 'Hare twitch', duration: LOOP, loop: 'loop',
    tracks: [{ object: earId, prop: 'rotation', keys: [[0, 0], [200, 0, 'cubic', EASE.out], [206, -0.3, 'cubic', EASE.out], [214, 0.1, 'cubic', EASE.inOut], [222, 0], [420, 0, 'cubic', EASE.out], [426, -0.2, 'cubic', EASE.out], [436, 0], [LOOP, 0]] }],
  }));
  return xml;
}

// ---------------------------------------------------------------- a snowy owl, perched, looking at you
export function owl(ids, s, r, { x, y, scale = 1 }) {
  const lidL = ids.next(), lidR = ids.next(), headId = ids.next();
  const body = blobPts(11, 16, r, { n: 10, wobble: 0.05 }).map((p) => P(p.x, p.y - 16));
  const bars = [];
  for (let k = 0; k < 14; k++) {
    const yy = -26 + k * 1.9 + r.jit(0.5);
    const side = k % 2 ? 1 : -1;
    const bx = side * r.range(3, 8);
    bars.push([P(bx - 1.5, yy), P(bx + 1.5, yy + 0.4)]);
  }
  const xml = group({ name: 'owl', x, y, scaleX: scale, scaleY: scale }, [
    el('Shape', { name: 'body' }, [pathXml(body, { closed: true }), fill(argb('FFFFFF', 1))]),
    blot({ x: 4, y: -12, rx: 7, ry: 12, color: '9DB6CC', alpha: 0.28, r, soft: 3, name: 'shade' }),
    inkShape({ pts: body, closed: true, color: ink(0.85), width: 1.1, bleed: 0.12 }),
    ticks(bars, { width: 1, color: ink(0.5) }),
    // folded wing edge
    inkShape({ pts: [P(8, -24), P(11, -14), P(9, -5)], tension: 0.9, color: ink(0.55), width: 0.8, bleed: 0 }),
    // feet gripping
    ticks([[P(-4, -1), P(-5, 2)], [P(-2, -1), P(-2, 2.5)], [P(2, -1), P(2, 2.5)], [P(4, -1), P(5, 2)]], { width: 1, color: ink(0.8) }),
    el('Node', { name: 'head', y: -28, id: headId }, [
      el('Shape', { name: 'head' }, [pathXml(blobPts(9.5, 8.5, r, { n: 10, wobble: 0.04 }), { closed: true }), fill(argb('FFFFFF', 1))]),
      inkShape({ pts: blobPts(9.5, 8.5, r, { n: 10, wobble: 0.04 }), closed: true, color: ink(0.85), width: 1.1, bleed: 0.1 }),
      // facial disc
      inkShape({ pts: [P(-7.5, 0), P(-4.5, -4), P(0, -2), P(4.5, -4), P(7.5, 0)], tension: 0.9, color: ink(0.45), width: 0.7, bleed: 0 }),
      ...[-3.6, 3.6].flatMap((ex, i) => [
        el('Shape', { name: 'iris' }, [el('Ellipse', { x: ex, y: -0.5, width: 4.6, height: 4.6, originX: 0.5, originY: 0.5, name: 'i' }), fill(argb('F2C94C', 1)), stroke(ink(0.8), 0.6)]),
        el('Shape', { name: 'pupil' }, [el('Ellipse', { x: ex, y: -0.5, width: 2.2, height: 2.2, originX: 0.5, originY: 0.5, name: 'p' }), fill(argb('1E2226', 1))]),
        el('Shape', { name: 'glint' }, [el('Ellipse', { x: ex + 0.7, y: -1.2, width: 0.9, height: 0.9, originX: 0.5, originY: 0.5, name: 'g' }), fill(argb('FFFFFF', 0.95))]),
        el('Shape', { name: 'lid', x: ex, y: -2.8, id: i ? lidR : lidL, scaleY: 0.05 }, [el('Ellipse', { y: 2.3, width: 5.2, height: 5.2, originX: 0.5, originY: 0.5, name: 'l' }), fill(argb('FFFFFF', 1)), stroke(ink(0.5), 0.6)]),
      ]),
      el('Shape', { name: 'beak' }, [pathXml([P(-1.2, 1.5), P(0, 4.5), P(1.2, 1.5)], { closed: true, tension: 0 }), fill(argb('2A2F33', 1))]),
    ].reverse()),
  ]);
  const LOOP = 620;
  const blink = [[0, 0.05], [250, 0.05, 'cubic', EASE.in], [256, 1, 'hold'], [262, 1, 'cubic', EASE.out], [270, 0.05], [520, 0.05, 'cubic', EASE.in], [526, 1, 'hold'], [530, 1, 'cubic', EASE.out], [538, 0.05], [LOOP, 0.05]];
  s.loopLayer(`owl ${x}`, s.anim({
    name: 'Owl blink', duration: LOOP, loop: 'loop',
    tracks: [
      { object: lidL, prop: 'scaleY', keys: blink },
      { object: lidR, prop: 'scaleY', keys: blink },
      { object: headId, prop: 'rotation', keys: [[0, 0], [120, 0, 'cubic', EASE.out], [130, 0.18, 'hold'], [330, 0.18, 'cubic', EASE.out], [340, -0.1, 'hold'], [450, -0.1, 'cubic', EASE.out], [460, 0], [LOOP, 0]] },
    ],
  }));
  return xml;
}

// ---------------------------------------------------------------- a red squirrel with an acorn, sitting up on a limb, facing left
export function squirrel(ids, s, r, { x, y, scale = 1 }) {
  const tailId = ids.next();
  const C = '9A6A44';
  // the body: a bean sitting up, rump at the back; the head a round at the front
  const body = [P(-8, 0), P(-11, -6), P(-10, -14), P(-6, -19), P(0, -20), P(6, -17), P(9, -10), P(9, -3), P(6, 0)];
  const head = blobPts(5.8, 5.2, r, { n: 10, wobble: 0.04 }).map((p) => P(p.x - 8, p.y - 23));
  const tailPts = [P(7, -4), P(14, -12), P(15, -24), P(9, -33), P(0, -36), P(-6, -34)];
  const xml = group({ name: 'squirrel', x, y, scaleX: scale, scaleY: scale }, [
    el('Node', { name: 'tail', x: 7, y: -4, id: tailId }, [
      el('Shape', { name: 'tailWash', blendModeValue: 'multiply' }, [pathXml(tailPts.map((p) => P(p.x - 7, p.y + 4)), { tension: 0.9 }), stroke(argb(C, 0.72), 9, { feather: 2.6 })]),
      el('Shape', { name: 'tailCore', blendModeValue: 'multiply' }, [pathXml(tailPts.map((p) => P(p.x - 7, p.y + 4)), { tension: 0.9 }), stroke(argb(darken(C, 0.3), 0.5), 3, { feather: 2 })]),
      el('Shape', { name: 'tailInk' }, [pathXml(tailPts.map((p) => P(p.x - 7 + 3, p.y + 4)), { tension: 0.9 }), stroke(ink(0.5), 0.8)]),
      ticks([[P(4, -14), P(9, -16)], [P(4, -20), P(9, -22)], [P(2, -26), P(6, -29)], [P(-3, -30), P(-1, -34)]], { width: 0.7, color: ink(0.45) }),
    ].reverse()),
    el('Shape', { name: 'bodyBase' }, [pathXml(body, { closed: true, tension: 0.7 }), fill(argb('F3E6D2', 1))]),
    el('Shape', { name: 'bodyWash', blendModeValue: 'multiply' }, [pathXml(body.map((p) => P(p.x + 1, p.y + 0.5)), { closed: true, tension: 0.7 }), fill(argb(C, 0.62), { feather: 1.6 })]),
    el('Shape', { name: 'belly' }, [pathXml(blobPts(3.5, 7, r, { n: 8 }).map((p) => P(p.x - 5, p.y - 9)), { closed: true }), fill(argb('F6EBD8', 0.9), { feather: 1.5 })]),
    inkShape({ pts: body, closed: true, tension: 0.7, color: ink(0.9), width: 1.1, bleed: 0.12 }),
    // hind leg and foot on the limb
    inkShape({ pts: [P(2, -9), P(7, -6), P(5, -1)], tension: 0.8, color: ink(0.55), width: 0.8, bleed: 0 }),
    inkShape({ pts: [P(-4, 0), P(-11, 0.5)], color: ink(0.85), width: 1.2, bleed: 0 }),
    // the head
    el('Shape', { name: 'headBase' }, [pathXml(head, { closed: true }), fill(argb('F3E6D2', 1))]),
    el('Shape', { name: 'headWash', blendModeValue: 'multiply' }, [pathXml(head.map((p) => P(p.x + 0.6, p.y + 0.4)), { closed: true }), fill(argb(C, 0.6), { feather: 1.2 })]),
    inkShape({ pts: head, closed: true, color: ink(0.9), width: 1, bleed: 0.1 }),
    ticks([[P(-10.5, -27.5), P(-11.5, -32)], [P(-6, -28), P(-5.5, -32.5)]], { width: 1.8, color: ink(0.85) }),
    el('Shape', { name: 'earIn' }, [...[[-11, -30.5], [-5.8, -31]].map(([ex, ey]) => el('Ellipse', { x: ex, y: ey, width: 1.4, height: 2.6, originX: 0.5, originY: 0.5, name: 'e' })), fill(argb('E0B0A0', 0.9))]),
    ...eye(-11.2, -24, 1.2),
    el('Shape', { name: 'nose' }, [el('Ellipse', { x: -13.9, y: -22.4, width: 1.6, height: 1.3, originX: 0.5, originY: 0.5, name: 'n' }), fill(argb('2A2F33', 1))]),
    // forepaws holding the acorn up to the mouth
    el('Shape', { name: 'acorn' }, [el('Ellipse', { x: -13, y: -16.5, width: 4.2, height: 5.2, originX: 0.5, originY: 0.5, name: 'a' }), fill(argb('A9793E', 1)), stroke(ink(0.7), 0.6)]),
    el('Shape', { name: 'cap' }, [pathXml([P(-15.4, -18.6), P(-13, -20.4), P(-10.6, -18.6)], { tension: 0.8 }), stroke(argb('5B3E22', 1), 2)]),
    inkShape({ pts: [P(-7, -16), P(-11.5, -14.5)], color: ink(0.8), width: 1, bleed: 0 }),
    inkShape({ pts: [P(-8, -19), P(-11, -18.5)], color: ink(0.8), width: 1, bleed: 0 }),
  ]);
  const LOOP = 480;
  s.loopLayer(`squirrel ${x}`, s.anim({
    name: 'Tail flick', duration: LOOP, loop: 'loop',
    tracks: [{ object: tailId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [90, 0.12, 'cubic', EASE.inOut], [150, -0.1, 'cubic', EASE.out], [160, 0.2, 'cubic', EASE.inOut], [220, 0, 'cubic', EASE.inOut], [400, 0.08, 'cubic', EASE.inOut], [LOOP, 0]] }],
  }));
  return xml;
}

// ---------------------------------------------------------------- a common loon on the water, facing left
export function loon(ids, s, r, { x, y, scale = 1 }) {
  const id = ids.next(), headId = ids.next();
  const body = [P(-17, 0), P(-11, -4.5), P(-2, -5.5), P(8, -4), P(16, -1), P(10, 1.5), P(-8, 1.8)];
  const spots = [];
  for (let k = 0; k < 16; k++) spots.push([P(-9 + k * 1.3 + r.jit(0.4), -3.4 + (k % 2) * 1.4 + r.jit(0.3)), P(-8.4 + k * 1.3 + r.jit(0.4), -3.4 + (k % 2) * 1.4 + r.jit(0.3))]);
  const xml = group({ name: 'loon', x, y, id, scaleX: scale, scaleY: scale }, [
    // the wake
    ticks([[P(16, 1.5), P(30, 2.5), P(44, 2)], [P(14, 2.6), P(26, 4.4), P(38, 4.2)]], { width: 0.6, color: ink(0.3), tension: 1 }),
    el('Shape', { name: 'body' }, [pathXml(body, { closed: true, tension: 0.7 }), fill(argb('1F2429', 0.95))]),
    ticks(spots, { width: 1.2, color: argb('FFFFFF', 0.85) }),
    el('Shape', { name: 'flank' }, [pathXml([P(-10, 0), P(0, -0.5), P(10, 0.2), P(6, 1.5), P(-6, 1.6)], { closed: true, tension: 0.6 }), fill(argb('F1F1EC', 0.95))]),
    el('Node', { name: 'head', x: -14, y: -3, id: headId }, [
      el('Shape', { name: 'neck' }, [pathXml([P(0, 0), P(-1.5, -5), P(-2, -10)], { tension: 0.9 }), stroke(argb('1F2429', 0.95), 4.2)]),
      el('Shape', { name: 'necklace' }, [pathXml([P(-1.6, -6.5), P(-0.4, -5.2)]), stroke(argb('FFFFFF', 0.9), 1.6)]),
      ticks([[P(-3.2, -6.2), P(-3.2, -4)], [P(0.4, -7), P(0.6, -4.6)]], { width: 0.5, color: argb('FFFFFF', 0.85) }),
      el('Shape', { name: 'head' }, [el('Ellipse', { x: -2.5, y: -12, width: 8.5, height: 5.6, rotation: -0.15, originX: 0.5, originY: 0.5, name: 'h' }), fill(argb('1F2429', 1))]),
      el('Shape', { name: 'bill' }, [pathXml([P(-6, -12.6), P(-13.5, -11.6), P(-6, -10.6)], { closed: true, tension: 0 }), fill(argb('2A2F33', 1))]),
      el('Shape', { name: 'eye' }, [el('Ellipse', { x: -3.6, y: -12.6, width: 1.4, height: 1.4, originX: 0.5, originY: 0.5, name: 'e' }), fill(argb('C0392B', 1))]),
    ].reverse()),
    // the water line where it sits
    inkShape({ pts: [P(-20, 1.2), P(-10, 2.4), P(4, 2.2), P(18, 1.4)], tension: 1, color: ink(0.35), width: 0.6, bleed: 0 }),
  ]);
  const LOOP = 900;
  s.loopLayer(`loon ${x}`, s.anim({
    name: 'Loon', duration: LOOP, loop: 'loop',
    tracks: [
      { object: id, prop: 'y', keys: [[0, y, 'cubic', EASE.inOut], [110, y - 1.2, 'cubic', EASE.inOut], [230, y + 0.8, 'cubic', EASE.inOut], [360, y - 1, 'cubic', EASE.inOut], [480, y + 0.6, 'cubic', EASE.inOut], [600, y - 1.1, 'cubic', EASE.inOut], [760, y + 0.7, 'cubic', EASE.inOut], [LOOP, y]] },
      { object: id, prop: 'x', keys: [[0, x, 'cubic', EASE.inOut], [450, x - 34, 'cubic', EASE.inOut], [LOOP, x]] },
      { object: headId, prop: 'rotation', keys: [[0, 0], [300, 0, 'cubic', EASE.out], [312, -0.35, 'hold'], [380, -0.35, 'cubic', EASE.out], [392, 0], [640, 0, 'cubic', EASE.out], [650, 0.25, 'hold'], [700, 0.25, 'cubic', EASE.out], [712, 0], [LOOP, 0]] },
    ],
  }));
  return xml;
}

// ---------------------------------------------------------------- a great blue heron standing in the shallows, facing left
export function heron(ids, s, r, { x, y, scale = 1 }) {
  const neckId = ids.next();
  const C = '6F8292';
  const body = blobPts(13, 6.5, r, { n: 10, wobble: 0.05 }).map((p) => P(p.x * Math.cos(-0.25) - p.y * Math.sin(-0.25) + 4, p.x * Math.sin(-0.25) + p.y * Math.cos(-0.25) - 40));
  const neck = [P(0, 0), P(-6, -6), P(-9, -14), P(-6, -21), P(-4, -25)];
  const xml = group({ name: 'heron', x, y, scaleX: scale, scaleY: scale }, [
    // legs, one slightly raised
    inkShape({ pts: [P(2, -34), P(1, -16), P(0, 0)], color: ink(0.8), width: 1.1, bleed: 0 }),
    inkShape({ pts: [P(7, -34), P(7, -18), P(9, -3)], color: ink(0.7), width: 1, bleed: 0 }),
    ticks([[P(-3, 0), P(3, 0)], [P(6, -3), P(12, -3)]], { width: 0.8, color: ink(0.6) }),
    el('Shape', { name: 'bodyBase' }, [pathXml(body, { closed: true }), fill(argb('EEF0F2', 1))]),
    blot({ x: 4, y: -40, rx: 13, ry: 6.5, color: C, alpha: 0.8, r, soft: 1.4, name: 'bodyWash', rotation: -0.25 }),
    inkShape({ pts: body, closed: true, color: ink(0.85), width: 1.1, bleed: 0.12 }),
    // wing edge and tail
    inkShape({ pts: [P(0, -44), P(8, -42), P(16, -37)], tension: 0.9, color: ink(0.5), width: 0.8, bleed: 0 }),
    ticks([[P(16, -36), P(21, -33)], [P(15, -38), P(21, -36)]], { width: 0.9, color: ink(0.7) }),
    el('Node', { name: 'neck', x: -6, y: -44, id: neckId }, [
      el('Shape', { name: 'neckWash', blendModeValue: 'multiply' }, [pathXml(neck, { tension: 0.9 }), stroke(argb(C, 0.75), 4.2, { feather: 0.8 })]),
      el('Shape', { name: 'neckInk' }, [pathXml(neck, { tension: 0.9 }), stroke(ink(0.85), 1)]),
      el('Shape', { name: 'neckInk2' }, [pathXml(neck.map((p) => P(p.x + 3.2, p.y + 0.5)), { tension: 0.9 }), stroke(ink(0.6), 0.8)]),
      el('Shape', { name: 'head' }, [el('Ellipse', { x: -4, y: -27, width: 9, height: 5, rotation: 0.05, originX: 0.5, originY: 0.5, name: 'h' }), fill(argb('F1F1EC', 1)), stroke(ink(0.85), 0.9)]),
      el('Shape', { name: 'stripe' }, [pathXml([P(-6.5, -28.5), P(0, -28.5), P(6, -27)], { tension: 0.8 }), stroke(ink(0.9), 1.6)]),
      el('Shape', { name: 'bill' }, [pathXml([P(-8, -28), P(-20, -26.2), P(-8, -25.5)], { closed: true, tension: 0 }), fill(argb('D9B24A', 1)), stroke(ink(0.7), 0.5)]),
      ...eye(-5.5, -27.2, 1, false),
    ].reverse()),
  ]);
  const LOOP = 780;
  s.loopLayer(`heron ${x}`, s.anim({
    name: 'Heron', duration: LOOP, loop: 'loop',
    tracks: [{ object: neckId, prop: 'rotation', keys: [[0, 0], [280, 0, 'cubic', EASE.inOut], [330, -0.55, 'cubic', EASE.inOut], [420, -0.55, 'cubic', EASE.inOut], [480, 0], [LOOP, 0]] }],
  }));
  return xml;
}

// ---------------------------------------------------------------- a leopard frog on a stone, facing left
export function frog(ids, s, r, { x, y, scale = 1 }) {
  const throatId = ids.next();
  const G = '6B9A3F';
  const body = [P(-9, 0), P(-10, -3.5), P(-6, -6.5), P(0, -7), P(6, -5.5), P(9, -2), P(8, 0)];
  const xml = group({ name: 'frog', x, y, scaleX: scale, scaleY: scale }, [
    el('Shape', { name: 'body' }, [pathXml(body, { closed: true, tension: 0.7 }), fill(argb(G, 0.9), { feather: 0.4 })]),
    blot({ x: 1, y: -4.5, rx: 6, ry: 2, color: '3E6E31', alpha: 0.55, r, soft: 1, name: 'back' }),
    el('Shape', { name: 'throat', x: -7, y: -1.5, id: throatId }, [el('Ellipse', { y: 1, width: 5, height: 3.4, originX: 0.5, originY: 0.5, name: 't' }), fill(argb('E9E2C2', 0.95))]),
    inkShape({ pts: body, closed: true, tension: 0.7, color: ink(0.8), width: 0.9, bleed: 0 }),
    // folded hind leg
    inkShape({ pts: [P(4, -5), P(10, -5.5), P(11, -1), P(6, 0.5)], tension: 0.8, color: ink(0.7), width: 0.8, bleed: 0 }),
    inkShape({ pts: [P(-6, 0), P(-9, 1.5), P(-12, 1.6)], color: ink(0.7), width: 0.7, bleed: 0 }),
    ...[-6.5, -2.5].flatMap((ex) => [
      el('Shape', { name: 'eyeBulge' }, [el('Ellipse', { x: ex, y: -7.5, width: 3.4, height: 3.2, originX: 0.5, originY: 0.5, name: 'b' }), fill(argb(G, 1)), stroke(ink(0.8), 0.7)]),
      el('Shape', { name: 'pupil' }, [el('Ellipse', { x: ex - 0.5, y: -7.6, width: 1.5, height: 1.5, originX: 0.5, originY: 0.5, name: 'p' }), fill(argb('1E2226', 1))]),
    ]),
    ticks([[P(-2, -3), P(-1, -2.5)], [P(2, -4), P(3, -3.6)], [P(4.5, -2.5), P(5.5, -2)]], { width: 1, color: argb('2E4A20', 0.7) }),
  ]);
  const LOOP = 420;
  s.loopLayer(`frog ${x}`, s.anim({
    name: 'Frog', duration: LOOP, loop: 'loop',
    tracks: [{ object: throatId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [30, 1.6, 'cubic', EASE.inOut], [60, 1, 'cubic', EASE.inOut], [90, 1.5, 'cubic', EASE.inOut], [120, 1], [LOOP, 1]] }],
  }));
  return xml;
}

// ---------------------------------------------------------------- fireflies over the reeds
export function fireflies(ids, s, r, { x0, x1, y0, y1, n = 16, name = 'fireflies' }) {
  const LOOP = 1200;
  const flies = [];
  const tracks = [];
  for (let i = 0; i < n; i++) {
    const id = ids.next();
    const x = r.range(x0, x1), y = r.range(y0, y1);
    flies.push(el('Node', { name: 'fly', x, y, id, opacity: 0 }, [
      el('Shape', { name: 'glow' }, [el('Ellipse', { width: 11, height: 11, originX: 0.5, originY: 0.5, name: 'g' }), fill(argb('E6F08A', 0.5), { feather: 4 })]),
      el('Shape', { name: 'dot' }, [el('Ellipse', { width: 2.4, height: 2.4, originX: 0.5, originY: 0.5, name: 'd' }), fill(argb('F4F7A8', 1))]),
    ]));
    // blinks: dark, then a soft pulse, at irregular intervals
    const keys = [[0, 0]];
    let t = Math.round(r.range(0, 160));
    while (t < LOOP - 60) {
      keys.push([t, 0, 'cubic', EASE.out], [t + 10, 1, 'cubic', EASE.inOut], [t + 26, 0.9, 'cubic', EASE.in], [t + 44, 0]);
      t += Math.round(r.range(90, 260));
    }
    keys.push([LOOP, 0]);
    tracks.push({ object: id, prop: 'opacity', keys });
    const sway = r.range(6, 16);
    tracks.push(
      { object: id, prop: 'x', keys: [[0, x, 'cubic', EASE.inOut], [LOOP / 3, x + sway, 'cubic', EASE.inOut], [(2 * LOOP) / 3, x - sway * 0.6, 'cubic', EASE.inOut], [LOOP, x]] },
      { object: id, prop: 'y', keys: [[0, y, 'cubic', EASE.inOut], [LOOP / 4, y - sway * 0.5, 'cubic', EASE.inOut], [LOOP / 2, y + sway * 0.3, 'cubic', EASE.inOut], [(3 * LOOP) / 4, y - sway * 0.7, 'cubic', EASE.inOut], [LOOP, y]] },
    );
  }
  s.loopLayer(name, s.anim({ name: 'Fireflies', duration: LOOP, loop: 'loop', tracks }));
  return flies;
}

// ---------------------------------------------------------------- a few mushrooms at a tree's foot
export function mushrooms(r, spots) {
  return spots.map(([x, y, sz, kind]) => {
    const cap = kind ? 'C84B3A' : 'B8783E';
    const h = 7 * sz, w = 9 * sz;
    return group({ name: 'mushroom', x, y }, [
      el('Shape', { name: 'stem' }, [pathXml([P(-1.6 * sz, 0), P(-1.3 * sz, -h), P(1.3 * sz, -h), P(1.8 * sz, 0)], { closed: true, tension: 0.4 }), fill(argb('F1E8D6', 1)), stroke(ink(0.6), 0.6)]),
      el('Shape', { name: 'cap' }, [pathXml([P(-w, -h + 1), P(-w * 0.7, -h - 4 * sz), P(0, -h - 5.5 * sz), P(w * 0.7, -h - 4 * sz), P(w, -h + 1)], { closed: true, tension: 0.7 }), fill(argb(cap, 0.9), { feather: 0.5 }), stroke(ink(0.7), 0.7)]),
      kind ? el('Shape', { name: 'dots' }, [...[-4, 0, 3.5].map((dx, i) => el('Ellipse', { x: dx * sz, y: -h - (2.2 + (i % 2) * 1.4) * sz, width: 1.6 * sz, height: 1.4 * sz, originX: 0.5, originY: 0.5, name: 'd' })), fill(argb('FFFFFF', 0.9))]) : '',
      blot({ x: 1, y: 0.5, rx: w, ry: 1.6, color: '7A6A50', alpha: 0.3, r, soft: 1.5, name: 'shadow' }),
    ]);
  });
}

// ---------------------------------------------------------------- ferns: fronds whose colour follows the year (one shared colour id)
export function ferns(ids, s, r, { x, y, n = 4, colorId, swayId }) {
  const segs = [];
  const stems = [];
  for (let k = 0; k < n; k++) {
    const ang = -Math.PI / 2 + (k - (n - 1) / 2) * 0.5 + r.jit(0.15);
    const L = r.range(26, 40);
    const stem = [P(0, 0), P(Math.cos(ang) * L * 0.5 + r.jit(3), Math.sin(ang) * L * 0.5), P(Math.cos(ang) * L + (k - (n - 1) / 2) * 6, Math.sin(ang) * L + 6)];
    stems.push(stem);
    const along = resample(stem, 9);
    along.slice(1, -1).forEach((p, i) => {
      const f = i / 8;
      const pl = (1 - f) * 7 + 2;
      const nx = -Math.sin(ang), ny = Math.cos(ang);
      segs.push([p, P(p.x + nx * pl + Math.cos(ang) * 2, p.y + ny * pl + Math.sin(ang) * 2)], [p, P(p.x - nx * pl + Math.cos(ang) * 2, p.y - ny * pl + Math.sin(ang) * 2)]);
    });
  }
  return group({ name: 'ferns', x, y, id: swayId }, [
    ticks(segs, { width: 1.7, color: argb('4E8A3C', 0.78), colorId, tension: 0.4 }),
    ticks(stems, { width: 0.8, color: ink(0.5), tension: 0.9 }),
  ]);
}

// a maple key (samara): two wings around a seed, for the spring weather group
export function samara(r) {
  return [
    el('Ellipse', { x: 4, y: 0, width: 8.5, height: 3.2, rotation: 0.1, originX: 0.5, originY: 0.5, name: 'w' }),
    el('Ellipse', { x: -4, y: 0, width: 8.5, height: 3.2, rotation: -0.1, originX: 0.5, originY: 0.5, name: 'w' }),
    el('Ellipse', { x: 0, y: 0.4, width: 3, height: 2.6, originX: 0.5, originY: 0.5, name: 's' }),
  ];
}
