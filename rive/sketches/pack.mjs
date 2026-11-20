// Pack (001, how to make a Houdini package): packing for the road. Everything for the
// journey is laid out on the grass, and each thing goes to its own place on the pack,
// as a package's files each go in their own folder: the apples into the main
// compartment under the flap, the pipe into the front pocket, the map into the side
// pocket, the rope strapped on top, the lantern on its ring. Then out it all comes
// again. Somewhere back over the hill is a round door.
import { P, el, washShape, watercolor, blobPts, resample, EASE, rng } from '../lib/ink.mjs';
import { sketch, group, INK_SOFT, AMBIENT, STORY } from './common.mjs';

const PAPER = 'F8F2E4';
// an ellipse as a closed run of points
const oval = (cx, cy, rx, ry, n = 12) => Array.from({ length: n }, (_, i) => P(cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry));
const shift = (pts, dx, dy) => pts.map((p) => P(p.x + dx, p.y + dy));

export default function pack(ids, x = 0) {
  const { s, soak, line, intro } = sketch(ids, { name: 'Pack', x });

  // the afternoon, the far hill with its door, and the grass
  s.add(soak(0, watercolor({ x: 380, y: 150, rx: 300, ry: 112, color: 'C9D9E6', seed: 3, alpha: 0.3, grain: false }), 70));
  const hill = [P(14, 330), P(60, 286), P(130, 252), P(214, 244), P(292, 266), P(380, 292), P(500, 298), P(620, 286), P(706, 296)];
  s.add(soak(8, washShape({ pts: [...hill, P(706, 344), P(14, 344)], color: 'A9C08A', alpha: 0.34, edge: 0.5, soft: 2.4, tension: 0.6 }), 60));
  s.add(soak(14, watercolor({ x: 360, y: 354, rx: 330, ry: 22, color: 'B9C48A', seed: 4, alpha: 0.42 }), 60));
  s.add(soak(36, watercolor({ x: 146, y: 282, rx: 12, ry: 12, color: '8A6A48', seed: 11, alpha: 0.5, grain: false }), 40));
  s.add(soak(40, watercolor({ x: 146, y: 282, rx: 8.5, ry: 8.5, color: '3F6E45', seed: 12, alpha: 0.85, grain: false }), 40));
  s.add(soak(44, washShape({ pts: [P(140, 292), P(152, 292), P(176, 318), P(150, 320)], color: 'D8C79A', alpha: 0.5, edge: 0.4, soft: 1.2, tension: 0.6 }), 40));
  s.add(soak(36, [70, 92, 196].map((hx, i) => watercolor({ x: hx, y: 262 + (i === 2 ? -14 : 8), rx: 13, ry: 9, color: '6C9A57', seed: 30 + i, alpha: 0.5, grain: false }))));
  line('Far', 5, (pen) => [
    pen(resample(hill, 14), { color: INK_SOFT, w: 1.1, j: 0.7 }),
    pen(oval(146, 282, 9, 9, 10), { closed: true, color: INK_SOFT, w: 1, j: 0.3 }),
    pen(oval(146, 282, 12.5, 12.5, 12), { closed: true, color: INK_SOFT, w: 0.9, j: 0.3 }),
    pen(oval(146, 283, 1.3, 1.3, 6), { closed: true, w: 1, j: 0.1 }),
    ...[70, 92, 196].map((hx, i) => pen(blobPts(13, 9, rng(40 + i), { n: 9, wobble: 0.14 }).map((p) => P(p.x + hx, p.y + 262 + (i === 2 ? -14 : 8))), { closed: true, color: INK_SOFT, w: 0.9, j: 0.3 })),
  ]);
  line('Ground', 19, (pen) => [
    pen(resample([P(30, 349), P(360, 345), P(690, 350)], 11), { w: 1.4, j: 0.8 }),
    ...[64, 168, 404, 470, 676].map((gx) => pen([P(gx - 4, 348), P(gx, 338), P(gx + 3, 348), P(gx + 7, 340)], { t: 0.3, w: 1, j: 0.4 })),
  ]);

  // the pack, and where each thing goes: the apples into the main compartment, under the
  // flap; the pipe into the front pocket; the map, rolled, into the side pocket; the rope
  // strapped on top once the flap is down; the lantern on its ring at the side
  const PX = 300, PY = 346; // the pack stands on its middle
  const HINGE = { x: 300, y: 213 };
  const openFlap = ids.next(), shutFlap = ids.next(), front = ids.next(), pocketId = ids.next(), sideId = ids.next(), straps = ids.next();
  const lid = [P(-48, 0), P(-45, -26), P(-30, -38), P(30, -38), P(45, -26), P(48, 0)];
  s.add(soak(60, group({ name: 'open flap', id: openFlap, x: HINGE.x, y: HINGE.y }, [
    washShape({ pts: lid, color: '7A8850', alpha: 0.55, edge: 0.7, soft: 0.6, tension: 0.6 }),
    line('Open flap', 21, (pen) => [pen(lid, { t: 0.6, w: 1.4, j: 0.4 })], { add: false }).xml,
  ])));
  s.add(soak(64, watercolor({ x: HINGE.x, y: HINGE.y - 3, rx: 50, ry: 10, color: '4A3C2C', seed: 8, alpha: 0.9, grain: false })));

  // the things for the road, each drawn about its own middle where it lies on the grass
  // (the lantern about the top of its handle, which is what it hangs by)
  const thing = (t) => {
    t.id = ids.next();
    return soak(70 + t.n * 6, group({ name: t.name, id: t.id, x: t.at.x, y: t.at.y, rotation: t.rot }, [
      ...t.wash,
      line(t.name, 70 + t.n, (pen) => t.ink(pen), { add: false }).xml,
    ]), 36);
  };
  const apples = {
    n: 0, name: 'apples', at: P(432, 338), to: P(PX, PY - 62), via: P(PX, HINGE.y - 40), turn: 0.35,
    wash: [watercolor({ x: -8, y: 0, rx: 9, ry: 9, color: 'B9483A', seed: 51, alpha: 0.75, grain: false }), watercolor({ x: 9, y: 2, rx: 8.5, ry: 8, color: 'A9B04F', seed: 52, alpha: 0.75, grain: false })],
    ink: (pen) => [
      pen(oval(-8, 0, 9, 9, 10), { closed: true, w: 1.2, j: 0.3 }),
      pen(oval(9, 2, 8.5, 8, 10), { closed: true, w: 1.2, j: 0.3 }),
      pen([P(-8, -8), P(-7, -14)], { w: 1, j: 0.2 }),
      pen([P(-7, -12), P(-2, -16), P(1, -13)], { w: 0.9, j: 0.2 }),
      pen([P(9, -5), P(11, -10)], { w: 1, j: 0.2 }),
    ],
  };
  const pipe = {
    n: 1, name: 'pipe', at: P(530, 360), rot: 0.04, to: P(PX + 4, PY - 45), via: P(PX + 4, PY - 104), turn: Math.PI / 2,
    wash: [washShape({ pts: [P(-34, -15), P(-20, -15), P(-21, -3), P(-27, 1), P(-33, -3)], color: '8A6A48', alpha: 0.7, edge: 0.7, soft: 0.4, tension: 0.6 })],
    ink: (pen) => [
      pen([P(-34, -15), P(-33, -3), P(-27, 1), P(-21, -3), P(-20, -15)], { t: 0.6, w: 1.2, j: 0.3 }),
      pen(oval(-27, -15, 7, 2, 8), { closed: true, w: 1, j: 0.2 }),
      pen([P(-21, -6), P(0, -2), P(22, 0), P(38, -1)], { w: 2.1, j: 0.4 }),
    ],
  };
  const map = {
    n: 2, name: 'map', at: P(572, 338), rot: -0.08, to: P(PX + 68, PY - 76), via: P(PX + 68, PY - 128), turn: Math.PI / 2,
    wash: [
      washShape({ pts: [P(-28, -7), P(28, -7), P(28, 7), P(-28, 7)], color: 'E8D9B0', alpha: 0.8, edge: 0.6, soft: 0.5, tension: 0.1 }),
      washShape({ pts: [P(-3, -8), P(3, -8), P(3, 8), P(-3, 8)], color: 'B9483A', alpha: 0.75, edge: 0.6, soft: 0.4, tension: 0.1 }),
    ],
    ink: (pen) => [
      pen([P(-28, -7), P(28, -7)], { w: 1.2, j: 0.3 }),
      pen([P(-28, 7), P(28, 7)], { w: 1.2, j: 0.3 }),
      pen(oval(28, 0, 3, 7, 10), { closed: true, w: 1.1, j: 0.2 }),
      pen(oval(-28, 0, 3, 7, 10), { closed: true, w: 1.1, j: 0.2 }),
      pen([P(1, 7), P(4, 15), P(2, 20)], { w: 0.9, j: 0.2 }),
      pen([P(-1, 7), P(-6, 14), P(-7, 19)], { w: 0.9, j: 0.2 }),
    ],
  };
  const rope = {
    n: 3, name: 'rope', at: P(504, 338), to: P(PX, HINGE.y - 6), via: P(PX, HINGE.y - 52), turn: 0,
    wash: [0, 1, 2].map((k) => washShape({ pts: oval(0, -12 + k * 6, 22, 7), color: 'C8A46A', alpha: 0.4, edge: 0.6, soft: 0.6 })),
    ink: (pen) => [
      ...[0, 1, 2].map((k) => pen(oval(0, -12 + k * 6, 22 - k, 7, 12), { closed: true, w: 1.1, j: 0.35 })),
      pen([P(20, 0), P(30, 5), P(40, 3), P(46, 7)], { w: 1.1, j: 0.3 }),
    ],
  };
  const RING = P(PX - 62, PY - 92);
  const lantern = {
    n: 4, name: 'lantern', at: P(636, 293), to: RING, via: P(RING.x - 6, RING.y - 46), turn: 0, swing: true,
    wash: [
      watercolor({ x: 0, y: 35, rx: 12, ry: 13, color: 'F2C66B', seed: 61, alpha: 0.7, grain: false }),
      washShape({ pts: [P(-13, 21), P(0, 11), P(13, 21)], color: '5B4F43', alpha: 0.6, edge: 0.6, soft: 0.4, tension: 0.2 }),
    ],
    ink: (pen) => [
      pen([P(-11, 21), P(-13, 49), P(13, 49), P(11, 21)], { t: 0.1, w: 1.2, j: 0.3 }),
      pen([P(-14, 21), P(0, 11), P(14, 21), P(-14, 21)], { t: 0.1, w: 1.2, j: 0.3 }),
      pen([P(-6, 13), P(-6, 4), P(0, 0), P(6, 4), P(6, 13)], { w: 1.1, j: 0.3 }),
      pen([P(-14, 49), P(14, 49), P(14, 53), P(-14, 53)], { t: 0.1, w: 1.1, j: 0.3 }),
      pen([P(0, 29), P(2, 37), P(0, 41), P(-2, 37), P(0, 29)], { w: 0.8, j: 0.2 }),
    ],
  };
  const things = [apples, pipe, map, rope, lantern];

  s.add(thing(apples));
  // the pack's front: paper behind its wash, so whatever has gone in is out of sight
  const body = [P(-52, -133), P(-61, -112), P(-64, -50), P(-57, -10), P(-30, 0), P(30, 0), P(57, -10), P(64, -50), P(61, -112), P(52, -133)];
  // low on the front, so the pipe's bowl shows between it and the flap once that's down
  const pocket = [P(-34, -62), P(34, -62), P(36, -14), P(26, -5), P(-26, -5), P(-36, -14)];
  const side = [P(55, -84), P(74, -82), P(80, -48), P(76, -18), P(57, -14)];
  s.add(soak(52, group({ name: 'front', id: front, x: PX, y: PY }, [
    washShape({ pts: body, color: PAPER, alpha: 1, edge: 0, soft: 0.5, blend: 'srcOver', tension: 0.7 }),
    washShape({ pts: body, color: '8C9A5E', alpha: 0.6, edge: 0.8, soft: 1.2, tension: 0.7 }),
    watercolor({ x: -36, y: -60, rx: 16, ry: 40, color: '5E6B3A', seed: 77, alpha: 0.25, grain: false }),
    // the dark of the front pocket's mouth, and the side pocket's
    watercolor({ x: 0, y: -63, rx: 33, ry: 4, color: '3E3424', seed: 78, alpha: 0.7, grain: false }),
    watercolor({ x: 65, y: -84, rx: 10, ry: 3.5, color: '3E3424', seed: 79, alpha: 0.7, grain: false }),
    line('Pack', 23, (pen) => [
      pen(body, { closed: true, t: 0.7, w: 1.7, j: 0.5 }),
      pen([P(-24, -133), P(-26, -62)], { w: 1.2, j: 0.3 }),
      pen([P(24, -133), P(26, -62)], { w: 1.2, j: 0.3 }),
      pen([P(-40, -4), P(-44, -40)], { color: INK_SOFT, w: 0.9, j: 0.3 }),
      pen(oval(RING.x - PX, RING.y - PY + 1, 3.4, 3.4, 8), { closed: true, w: 1.3, j: 0.15 }),
    ], { add: false }).xml,
  ])));
  s.add(thing(pipe));
  // the front pocket, over the pipe
  s.add(soak(54, group({ name: 'front pocket', id: pocketId, x: PX, y: PY }, [
    washShape({ pts: pocket, color: PAPER, alpha: 1, edge: 0, soft: 0.4, blend: 'srcOver', tension: 0.4 }),
    washShape({ pts: pocket, color: '6E7C46', alpha: 0.62, edge: 0.7, soft: 0.8, tension: 0.4 }),
    line('Pocket', 25, (pen) => [
      pen(pocket, { closed: true, t: 0.4, w: 1.3, j: 0.4 }),
      pen([P(-34, -46), P(0, -42), P(34, -46)], { w: 1.1, j: 0.3 }),
    ], { add: false }).xml,
  ])));
  s.add(thing(map));
  // the side pocket, over the map
  s.add(soak(56, group({ name: 'side pocket', id: sideId, x: PX, y: PY }, [
    washShape({ pts: side, color: PAPER, alpha: 1, edge: 0, soft: 0.4, blend: 'srcOver', tension: 0.5 }),
    washShape({ pts: side, color: '76844E', alpha: 0.62, edge: 0.7, soft: 0.8, tension: 0.5 }),
    line('Side', 26, (pen) => [
      pen(side, { closed: true, t: 0.5, w: 1.3, j: 0.35 }),
      pen([P(57, -70), P(77, -68)], { color: INK_SOFT, w: 0.9, j: 0.3 }),
    ], { add: false }).xml,
  ])));

  // the flap once it's down, buckled across the front
  const flap = [P(-56, 0), P(56, 0), P(58, 30), P(40, 48), P(0, 53), P(-40, 48), P(-58, 30)];
  s.add(group({ name: 'shut flap', id: shutFlap, x: HINGE.x, y: HINGE.y, scaleY: 0, opacity: 0 }, [
    washShape({ pts: flap, color: PAPER, alpha: 1, edge: 0, soft: 0.5, blend: 'srcOver', tension: 0.6 }),
    washShape({ pts: flap, color: '7A8850', alpha: 0.62, edge: 0.8, soft: 1, tension: 0.6 }),
    washShape({ pts: [P(-6, 42), P(6, 42), P(6, 54), P(-6, 54)], color: 'C99A2E', alpha: 0.8, edge: 0.7, soft: 0.3, tension: 0.1 }),
    line('Shut flap', 29, (pen) => [
      pen(flap, { closed: true, t: 0.6, w: 1.6, j: 0.45 }),
      pen([P(-6, 42), P(6, 42), P(6, 54), P(-6, 54), P(-6, 42)], { t: 0.1, w: 1.1, j: 0.2 }),
      pen([P(-46, 10), P(0, 16), P(46, 10)], { color: INK_SOFT, w: 0.9, j: 0.3 }),
    ], { add: false, drawn: false }).xml,
  ]));
  // the rope sits on the shut flap, and two straps go over it
  s.add(thing(rope));
  s.add(group({ name: 'straps', id: straps, x: HINGE.x, y: HINGE.y, opacity: 0 }, [
    line('Straps', 30, (pen) => [-14, 14].flatMap((dx) => [
      pen([P(dx - 1, -26), P(dx, -14), P(dx + 1, 4)], { w: 2.4, j: 0.3, drawn: false }),
      pen([P(dx - 3.5, -13), P(dx + 3.5, -13)], { w: 1.1, j: 0.2, drawn: false }),
    ]), { add: false }).xml,
  ]));
  // a stick for the road, leant on the pack
  s.add(soak(80, washShape({ pts: [P(127, 351), P(240, 228), P(245, 232), P(133, 352)], color: '8A6A48', alpha: 0.55, edge: 0.6, soft: 0.5, tension: 0.2 })));
  line('Stick', 31, (pen) => [
    pen([P(130, 352), P(168, 311), P(206, 270), P(243, 229)], { w: 2.3, j: 0.5 }),
    pen(blobPts(6, 5, rng(32), { n: 8, wobble: 0.2 }).map((p) => P(p.x + 244, p.y + 227)), { closed: true, w: 1.3, j: 0.3 }),
    pen([P(178, 300), P(170, 296)], { w: 1, j: 0.2 }),
  ]);
  s.add(thing(lantern));


  // a butterfly with somewhere to be
  const fly = ids.next(), wingL = ids.next(), wingR = ids.next();
  s.add(soak(120, group({ name: 'butterfly', id: fly, x: 520, y: 120 }, [
    group({ name: 'left wing', id: wingL }, [watercolor({ x: -5, y: -2, rx: 5, ry: 6, color: 'E9B93A', seed: 81, alpha: 0.85, grain: false })]),
    group({ name: 'right wing', id: wingR }, [watercolor({ x: 5, y: -2, rx: 5, ry: 6, color: 'E9B93A', seed: 82, alpha: 0.85, grain: false })]),
    line('Butterfly', 33, (pen) => [pen([P(0, -5), P(0, 4)], { w: 1.3, j: 0.2, drawn: false })], { add: false }).xml,
  ]), 40));
  s.loopLayer('Flutter', s.anim({
    name: 'Flutter', duration: 16, loop: 'loop', rate: AMBIENT,
    tracks: [wingL, wingR].map((w) => ({ object: w, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [8, 0.25, 'cubic', EASE.inOut], [16, 1]] })),
  }));
  const route = [[0, 520, 120], [160, 610, 92], [300, 664, 150], [430, 590, 196], [560, 470, 150], [700, 430, 96], [840, 486, 70], [960, 520, 120]];
  s.loopLayer('Wander', s.anim({
    name: 'Wander', duration: 960, loop: 'loop', rate: STORY,
    tracks: [
      { object: fly, prop: 'x', keys: route.map(([f, vx]) => [f, vx, 'cubic', EASE.inOut]) },
      { object: fly, prop: 'y', keys: route.map(([f, , vy], i) => [f, vy + (i % 2 ? -10 : 8), 'cubic', EASE.inOut]) },
    ],
  }));
  // the story: each thing up off the grass and over to its own place (the flap comes
  // down once the apples are in, and the rope is strapped on top of it); a pause to be
  // ready; then all of it back out again, last in first out
  const IN = [160, 230, 300, 430, 500];
  const SHUT = 372, READY = 880;
  const OUT = [1170, 1110, 1050, 940, 880]; // by thing; the flap opens before the map comes out
  const OPEN = 990;
  const D = 1360;
  const tracks = [];
  const squash = [[0, 1, 'hold']];
  const bump = (f, k = 0.965) => squash.push([f, 1, 'cubic', EASE.out], [f + 6, k, 'cubic', EASE.inOut], [f + 22, 1, 'hold']);
  things.forEach((t, k) => {
    const a = IN[k], b = OUT[k];
    const rot = t.rot || 0, tip = t.turn + (k % 2 ? 0.2 : -0.2);
    tracks.push({ object: t.id, prop: 'x', keys: [[0, t.at.x, 'hold'], [a, t.at.x, 'cubic', EASE.inOut], [a + 34, t.via.x, 'cubic', EASE.inOut], [a + 52, t.to.x, 'hold'], [b, t.to.x, 'cubic', EASE.inOut], [b + 16, t.via.x, 'cubic', EASE.inOut], [b + 46, t.at.x]] });
    tracks.push({ object: t.id, prop: 'y', keys: [
      [0, t.at.y, 'hold'], [a, t.at.y, 'cubic', EASE.out], [a + 16, t.at.y - 46, 'cubic', EASE.inOut], [a + 34, t.via.y, 'cubic', EASE.in], [a + 52, t.to.y, 'hold'],
      [b, t.to.y, 'cubic', EASE.out], [b + 18, t.via.y - 6, 'cubic', EASE.inOut], [b + 40, t.at.y - 22, 'cubic', EASE.in], [b + 50, t.at.y],
    ] });
    const settle = t.swing
      // a lantern on a ring swings, and settles
      ? [[a + 34, tip, 'cubic', EASE.inOut], [a + 52, 0.32, 'cubic', EASE.inOut], [a + 70, -0.2, 'cubic', EASE.inOut], [a + 88, 0.09, 'cubic', EASE.inOut], [a + 104, -0.03, 'cubic', EASE.inOut], [a + 118, 0, 'hold'], [b, 0, 'cubic', EASE.inOut]]
      : [[a + 34, tip, 'cubic', EASE.inOut], [a + 50, t.turn, 'hold'], [b, t.turn, 'cubic', EASE.inOut]];
    tracks.push({ object: t.id, prop: 'rotation', keys: [[0, rot, 'hold'], [a, rot, 'cubic', EASE.inOut], ...settle, [b + 46, rot]] });
    if (!t.swing) bump(a + 52);
  });
  bump(SHUT + 30, 0.975);
  squash.sort((p, q) => p[0] - q[0]);
  for (const id of [front, pocketId, sideId]) {
    tracks.push({ object: id, prop: 'scaleY', keys: squash });
    tracks.push({ object: id, prop: 'scaleX', keys: squash.map(([f, v, ...e]) => [f, 2 - v, ...e]) });
  }
  // the flap folds forward over the top, and back again
  tracks.push({ object: openFlap, prop: 'scaleY', keys: [[0, 1, 'hold'], [SHUT, 1, 'cubic', EASE.in], [SHUT + 14, 0, 'hold'], [OPEN + 16, 0, 'cubic', EASE.out], [OPEN + 32, 1]] });
  tracks.push({ object: shutFlap, prop: 'scaleY', keys: [[0, 0, 'hold'], [SHUT + 14, 0, 'cubic', EASE.out], [SHUT + 32, 1, 'hold'], [OPEN, 1, 'cubic', EASE.in], [OPEN + 16, 0]] });
  tracks.push({ object: shutFlap, prop: 'opacity', keys: [[0, 0, 'hold'], [SHUT + 14, 1, 'hold'], [OPEN + 16, 0]] });
  // the straps buckle over the rope once it's down, and come undone before it goes
  tracks.push({ object: straps, prop: 'opacity', keys: [[0, 0, 'hold'], [IN[3] + 54, 0, 'cubic', EASE.out], [IN[3] + 66, 1, 'hold'], [OUT[3] - 12, 1, 'cubic', EASE.in], [OUT[3], 0]] });
  s.loopLayer('Packing', s.anim({ name: 'Packing', duration: D, loop: 'loop', rate: STORY, tracks }));

  intro();
  return s.toXml();
}
