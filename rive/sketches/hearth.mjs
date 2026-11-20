// Hearth (004, the UAB's launcher and its one shared server): an inn's fireside
// with a row of pegs. Whoever comes in first lights the fire; everyone after just
// hangs up their things and stays; when the last of them goes, the fire is let
// die and the cat has the room to itself again.
import { P, washShape, watercolor, EASE } from '../lib/ink.mjs';
import { sketch, group, INK_SOFT, AMBIENT, STORY } from './common.mjs';

const oval = (cx, cy, rx, ry, n = 12) => Array.from({ length: n }, (_, i) => P(cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry));
// a round-topped opening from x0 to x1, standing on `base`, its crown at `top`
function arch(x0, x1, base, top, n = 13) {
  const cx = (x0 + x1) / 2, rx = (x1 - x0) / 2, ry = rx * 0.9, spring = top + ry;
  const at = (a, k = 1) => P(cx + Math.cos(a) * rx * k, spring - Math.sin(a) * ry * k);
  const curve = Array.from({ length: n }, (_, i) => at(Math.PI - (i / (n - 1)) * Math.PI));
  return Object.assign([P(x0, base), ...curve, P(x1, base)], { at });
}

export default function hearth(ids, x = 0) {
  const { s, soak, line, intro } = sketch(ids, { name: 'Hearth', x });

  // the room, and the warmth the fire puts into it once it's going
  const warm = ids.next(), glow = ids.next();
  s.add(soak(0, watercolor({ x: 370, y: 170, rx: 320, ry: 150, color: 'D9C7A6', seed: 3, alpha: 0.3, grain: false }), 70));
  s.add(group({ name: 'warmth', id: warm, opacity: 0 }, [watercolor({ x: 300, y: 228, rx: 230, ry: 136, color: 'F2C66B', seed: 6, alpha: 0.28, grain: false })]));
  s.add(soak(10, watercolor({ x: 360, y: 356, rx: 330, ry: 18, color: 'A88B6A', seed: 4, alpha: 0.32 }), 60));

  // the fireplace: a stone arch, its sooty mouth, a mantel with a clock and a jar
  const outer = arch(146, 334, 350, 148);
  const inner = arch(184, 296, 350, 200);
  s.add(soak(30, washShape({ pts: outer, color: 'B8AE9C', alpha: 0.45, edge: 0.6, soft: 0.8, tension: 0.7 }), 50));
  s.add(soak(40, washShape({ pts: inner, color: '3E3228', alpha: 0.7, edge: 0.6, soft: 2, tension: 0.7 }), 50));
  s.add(group({ name: 'glow', id: glow, opacity: 0 }, [washShape({ pts: oval(240, 304, 62, 46, 14), color: 'C9772E', alpha: 0.55, edge: 0, soft: 22, blend: 'screen' })]));
  s.add(soak(50, washShape({ pts: [P(124, 132), P(356, 132), P(358, 146), P(122, 146)], color: '8A6A48', alpha: 0.6, edge: 0.7, soft: 0.5, tension: 0.05 })));
  s.add(soak(60, watercolor({ x: 182, y: 112, rx: 14, ry: 14, color: 'E8D9B0', seed: 14, alpha: 0.8, grain: false })));
  s.add(soak(64, washShape({ pts: [P(300, 104), P(318, 104), P(320, 132), P(298, 132)], color: '9FB7C4', alpha: 0.5, edge: 0.7, soft: 0.5, tension: 0.3 })));
  line('Fireplace', 7, (pen) => [
    pen(outer, { t: 0.7, w: 1.6, j: 0.5 }),
    pen(inner, { t: 0.7, w: 1.4, j: 0.5 }),
    ...Array.from({ length: 9 }, (_, i) => {
      const a = Math.PI - (i / 8) * Math.PI;
      return pen([inner.at(a), outer.at(a)], { color: INK_SOFT, w: 1, j: 0.5 });
    }),
    pen([P(124, 132), P(356, 132), P(358, 146), P(122, 146), P(124, 132)], { t: 0.05, w: 1.4, j: 0.4 }),
    pen(oval(182, 112, 14, 14, 12), { closed: true, w: 1.2, j: 0.3 }),
    pen([P(182, 112), P(182, 103)], { w: 1, j: 0.2 }),
    pen([P(182, 112), P(189, 115)], { w: 1, j: 0.2 }),
    pen([P(174, 126), P(176, 132)], { w: 1.1, j: 0.2 }),
    pen([P(190, 126), P(188, 132)], { w: 1.1, j: 0.2 }),
    pen([P(300, 104), P(298, 132), P(320, 132), P(318, 104), P(300, 104)], { t: 0.3, w: 1.2, j: 0.3 }),
    pen([P(304, 104), P(304, 96), P(314, 96), P(314, 104)], { t: 0.2, w: 1, j: 0.2 }),
    // the logs on the irons, and the floor
    pen([P(206, 342), P(272, 326)], { w: 2, j: 0.4 }),
    pen([P(212, 326), P(276, 342)], { w: 2, j: 0.4 }),
    pen([P(20, 351), P(360, 348), P(700, 352)], { w: 1.4, j: 0.8 }),
  ]);
  s.add(soak(70, [washShape({ pts: [P(204, 338), P(272, 322), P(275, 330), P(207, 346)], color: '6A4A30', alpha: 0.7, edge: 0.6, soft: 0.4, tension: 0.2 }), washShape({ pts: [P(210, 322), P(278, 338), P(276, 346), P(208, 330)], color: '7A5638', alpha: 0.7, edge: 0.6, soft: 0.4, tension: 0.2 })]));
  s.add(soak(76, watercolor({ x: 240, y: 340, rx: 26, ry: 5, color: 'B9483A', seed: 16, alpha: 0.45, grain: false })));

  // the fire: three tongues of flame, lit and let die by the story
  const fire = ids.next();
  const tongues = [[-14, 'D9603A', 30, -0.12], [0, 'E8993A', 42, 0.02], [13, 'F2C66B', 28, 0.14]].map(([dx, color, tall, lean]) => ({ dx, color, tall, lean, id: ids.next() }));
  s.add(group({ name: 'fire', id: fire, x: 240, y: 332, scaleX: 0, scaleY: 0 }, tongues.map((t) =>
    group({ name: 'tongue', id: t.id, x: t.dx, rotation: t.lean }, [
      washShape({ pts: [P(0, -t.tall), P(8, -t.tall * 0.4), P(7, 0), P(-7, 0), P(-8, -t.tall * 0.4)], color: t.color, alpha: 0.9, edge: 0.8, soft: 0.8, tension: 0.9, blend: 'screen' }),
    ]))));
  s.loopLayer('Flicker', s.anim({
    name: 'Flicker', duration: 64, loop: 'loop', rate: AMBIENT,
    tracks: tongues.flatMap((t, i) => [
      { object: t.id, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [16 + i * 4, 1.18 - i * 0.05, 'cubic', EASE.inOut], [36, 0.88, 'cubic', EASE.inOut], [50 - i * 3, 1.1, 'cubic', EASE.inOut], [64, 1]] },
      { object: t.id, prop: 'rotation', keys: [[0, t.lean, 'cubic', EASE.inOut], [24, t.lean + (i - 1 || 1) * 0.08, 'cubic', EASE.inOut], [48, t.lean - 0.05, 'cubic', EASE.inOut], [64, t.lean]] },
    ]),
  }));
  // a curl of smoke, once it's out
  const smoke = ids.next();
  s.add(group({ name: 'smoke', id: smoke, x: 240, y: 320, opacity: 0 }, [
    line('Smoke', 41, (pen) => [pen([P(0, 0), P(-6, -14), P(4, -28), P(-3, -42), P(5, -56)], { color: INK_SOFT, w: 1.1, j: 0.8, drawn: false })], { add: false }).xml,
  ]));

  // the cat, asleep on the rug whatever happens
  const cat = ids.next();
  s.add(soak(80, watercolor({ x: 372, y: 350, rx: 62, ry: 8, color: 'B9483A', seed: 17, alpha: 0.4 })));
  const curl = [P(342, 346), P(344, 330), P(362, 320), P(386, 322), P(400, 334), P(398, 346)];
  s.add(soak(90, group({ name: 'cat', id: cat, x: 372, y: 347 }, [
    washShape({ pts: curl.map((p) => P(p.x - 372, p.y - 347)), color: '7E7468', alpha: 0.6, edge: 0.7, soft: 0.8, tension: 0.8 }),
    line('Cat', 43, (pen) => {
      const at = (pts) => pts.map((p) => P(p.x - 372, p.y - 347));
      return [
        pen(at(curl), { w: 1.4, j: 0.4 }),
        pen(at([P(342, 346), P(398, 346)]), { w: 1.3, j: 0.4 }),
        pen(at([P(344, 332), P(348, 322), P(352, 328), P(358, 320), P(362, 326)]), { t: 0.2, w: 1.2, j: 0.3 }),
        pen(at([P(398, 344), P(410, 344), P(414, 336), P(406, 332)]), { w: 1.3, j: 0.3 }),
        pen(at([P(350, 334), P(354, 335)]), { w: 1, j: 0.1 }),
      ];
    }, { add: false }).xml,
  ])));
  s.loopLayer('Breathe', s.anim({ name: 'Breathe', duration: 150, loop: 'loop', rate: AMBIENT, tracks: [{ object: cat, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [75, 1.05, 'cubic', EASE.inOut], [150, 1]] }] }));

  // the pegs
  const PEGS = [452, 520, 588, 656], RAIL = 128;
  s.add(soak(54, washShape({ pts: [P(420, RAIL - 8), P(690, RAIL - 9), P(690, RAIL + 8), P(420, RAIL + 9)], color: '8A6A48', alpha: 0.6, edge: 0.7, soft: 0.5, tension: 0.05 })));
  line('Rail', 9, (pen) => [
    pen([P(420, RAIL - 8), P(690, RAIL - 9), P(690, RAIL + 8), P(420, RAIL + 9), P(420, RAIL - 8)], { t: 0.05, w: 1.4, j: 0.4 }),
    ...PEGS.map((px) => pen([P(px - 3, RAIL), P(px, RAIL + 12), P(px + 4, RAIL + 11)], { t: 0.4, w: 1.6, j: 0.3 })),
  ]);

  // what people hang up, each drawn hanging from its peg at the origin
  const things = [
    { // a green hooded cloak
      name: 'cloak', peg: 0, seed: 51,
      wash: [washShape({ pts: [P(0, 10), P(-16, 18), P(-24, 60), P(-30, 160), P(-4, 168), P(22, 162), P(28, 60), P(16, 18)], color: '4F7A4A', alpha: 0.6, edge: 0.8, soft: 1, tension: 0.6 })],
      ink: (pen) => [
        pen([P(0, 10), P(-16, 18), P(-24, 60), P(-30, 160), P(-4, 168), P(22, 162), P(28, 60), P(16, 18), P(0, 10)], { t: 0.6, w: 1.4, j: 0.4 }),
        pen([P(-12, 22), P(0, 40), P(12, 22)], { w: 1.1, j: 0.3 }),
        pen([P(-8, 70), P(-12, 150)], { color: INK_SOFT, w: 1, j: 0.4 }),
        pen([P(10, 70), P(12, 150)], { color: INK_SOFT, w: 1, j: 0.4 }),
        pen(oval(0, 46, 3, 3, 6), { closed: true, w: 1, j: 0.1 }),
      ],
    },
    { // a brown felt hat
      name: 'hat', peg: 1, seed: 53,
      wash: [washShape({ pts: [P(-26, 34), P(-14, 30), P(-12, 10), P(0, 6), P(12, 10), P(14, 30), P(26, 34), P(0, 40)], color: '8A6A48', alpha: 0.65, edge: 0.8, soft: 0.6, tension: 0.6 })],
      ink: (pen) => [
        pen([P(-26, 34), P(-14, 30), P(-12, 10), P(0, 6), P(12, 10), P(14, 30), P(26, 34), P(0, 40), P(-26, 34)], { t: 0.6, w: 1.4, j: 0.3 }),
        pen([P(-13, 25), P(0, 28), P(13, 25)], { w: 1.1, j: 0.2 }),
        pen([P(10, 22), P(18, 4), P(16, 0)], { w: 1, j: 0.2 }),
      ],
    },
    { // a long yellow scarf, striped
      name: 'scarf', peg: 2, seed: 55,
      wash: [
        washShape({ pts: [P(-6, 10), P(6, 10), P(14, 120), P(0, 124), P(-10, 92), P(-14, 40)], color: 'E9B93A', alpha: 0.65, edge: 0.8, soft: 0.6, tension: 0.6 }),
        ...[[44, -13, 10], [72, -12, 11], [100, -8, 13]].map(([y, l, r]) => washShape({ pts: [P(l, y), P(r, y + 2), P(r + 1, y + 9), P(l + 1, y + 7)], color: 'B9483A', alpha: 0.7, edge: 0.6, soft: 0.3, tension: 0.2 })),
      ],
      ink: (pen) => [
        pen([P(-6, 10), P(-14, 40), P(-10, 92), P(0, 124), P(14, 120), P(6, 10), P(-6, 10)], { t: 0.6, w: 1.3, j: 0.3 }),
        ...[2, 6, 10].map((dx) => pen([P(dx - 2, 122), P(dx, 132)], { w: 0.9, j: 0.2 })),
      ],
    },
    { // a tall grey hat with a wide brim; someone who comes and goes as he pleases
      name: 'pointed hat', peg: 3, seed: 57,
      wash: [
        washShape({ pts: [P(-38, 64), P(-12, 56), P(-4, 20), P(14, -10), P(6, 22), P(14, 56), P(40, 64), P(0, 72)], color: '8E8C86', alpha: 0.6, edge: 0.8, soft: 0.6, tension: 0.5 }),
      ],
      ink: (pen) => [
        pen([P(-38, 64), P(-12, 56), P(-4, 20), P(14, -10), P(6, 22), P(14, 56), P(40, 64), P(0, 72), P(-38, 64)], { t: 0.5, w: 1.4, j: 0.4 }),
        pen([P(-12, 54), P(2, 58), P(14, 54)], { w: 1.1, j: 0.3 }),
      ],
    },
  ];
  for (const t of things) {
    t.id = ids.next();
    t.x = PEGS[t.peg];
    t.y = RAIL + 4;
    s.add(group({ name: t.name, id: t.id, x: t.x, y: t.y - 40, opacity: 0 }, [
      ...t.wash,
      line(t.name, t.seed, (pen) => t.ink(pen), { add: false, drawn: false }).xml,
    ]));
  }

  // the story: in they come and hang up their things (the first lights the fire),
  // out they go in their own order, and when the last has gone the fire dies
  const ARRIVE = [170, 330, 480, 640], LEAVE = [1300, 1060, 1180, 900]; // by peg
  const lastOut = Math.max(...LEAVE), D = lastOut + 360;
  const tracks = [];
  things.forEach((t, i) => {
    const a = ARRIVE[i], b = LEAVE[i];
    tracks.push({ object: t.id, prop: 'y', keys: [[0, t.y - 40, 'hold'], [a, t.y - 40, 'cubic', EASE.out], [a + 24, t.y, 'hold'], [b, t.y, 'cubic', EASE.in], [b + 30, t.y - 34]] });
    tracks.push({ object: t.id, prop: 'opacity', keys: [[0, 0, 'hold'], [a, 0, 'cubic', EASE.out], [a + 16, 1, 'hold'], [b + 6, 1, 'cubic', EASE.in], [b + 30, 0]] });
    tracks.push({ object: t.id, prop: 'rotation', keys: [[0, 0.2, 'hold'], [a + 16, 0.2, 'cubic', EASE.inOut], [a + 34, -0.1, 'cubic', EASE.inOut], [a + 52, 0.04, 'cubic', EASE.inOut], [a + 68, 0, 'hold'], [b, 0, 'cubic', EASE.in], [b + 20, -0.12]] });
  });
  const lit = ARRIVE[0] + 40;
  for (const prop of ['scaleX', 'scaleY']) {
    tracks.push({ object: fire, prop, keys: [[0, 0, 'hold'], [lit, 0, 'cubic', EASE.back], [lit + 36, 1, 'hold'], [lastOut + 40, 1, 'cubic', EASE.in], [lastOut + 110, 0]] });
  }
  for (const id of [glow, warm]) {
    tracks.push({ object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [lit, 0, 'cubic', EASE.out], [lit + 80, 1, 'hold'], [lastOut + 40, 1, 'cubic', EASE.inOut], [lastOut + 150, 0]] });
  }
  tracks.push({ object: smoke, prop: 'opacity', keys: [[0, 0, 'hold'], [lastOut + 100, 0, 'cubic', EASE.out], [lastOut + 140, 0.9, 'cubic', EASE.inOut], [lastOut + 260, 0]] });
  tracks.push({ object: smoke, prop: 'y', keys: [[0, 320, 'hold'], [lastOut + 100, 320], [lastOut + 260, 270]] });
  s.loopLayer('Evening', s.anim({ name: 'Evening', duration: D, loop: 'loop', rate: STORY, tracks }));

  intro();
  return s.toXml();
}
