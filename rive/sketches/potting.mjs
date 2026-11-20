// Potting (003, the browser's resize algorithm): a potting shed's shelves under a
// round window. A dozen pots stand in a grid that keeps its middle where it is: as
// they grow, fewer fit to a row and they reflow onto more shelves, every board
// the same width as its pot; then they shrink back down and it starts over.
import { P, el, washShape, watercolor, blobPts, rng, EASE } from '../lib/ink.mjs';
import { sketch, group, INK_SOFT, AMBIENT, STORY } from './common.mjs';

const oval = (cx, cy, rx, ry, n = 12) => Array.from({ length: n }, (_, i) => P(cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry));
const FLOWERS = ['E9B93A', 'D97A5A', 'B98BC0', 'F2C66B', 'C9583A', 'E8DCC0'];

// a grid of n cells `cols` wide, each `cell` wide and 0.8 as tall, about a fixed middle
const MID = { x: 360, y: 204 };
function layout(n, cols, cell) {
  const rows = Math.ceil(n / cols), h = cell * 0.8;
  const x0 = MID.x - (cols * cell) / 2, y0 = MID.y - (rows * h) / 2;
  return Array.from({ length: n }, (_, k) => P(x0 + cell * ((k % cols) + 0.5), y0 + h * (Math.floor(k / cols) + 1)));
}
const N = 12, BIG = 108;
const SMALL = layout(N, 6, 72), LARGE = layout(N, 4, BIG);

export default function potting(ids, x = 0) {
  const { s, soak, line, intro } = sketch(ids, { name: 'Potting', x });

  // the shed: limewashed wall, the round window and the light it lets in, the floor
  s.add(soak(0, watercolor({ x: 380, y: 170, rx: 320, ry: 150, color: 'E3D2B4', seed: 3, alpha: 0.32, grain: false }), 70));
  s.add(soak(20, washShape({ pts: [P(44, 76), P(98, 66), P(300, 330), P(150, 352)], color: 'F2DFA0', alpha: 0.3, edge: 0, soft: 18, tension: 0.2 }), 80));
  s.add(soak(10, watercolor({ x: 360, y: 356, rx: 330, ry: 18, color: 'A88B6A', seed: 4, alpha: 0.32 }), 60));
  s.add(soak(30, watercolor({ x: 72, y: 84, rx: 30, ry: 30, color: 'BFD3DF', seed: 5, alpha: 0.6, grain: false }), 50));
  s.add(soak(34, washShape({ pts: oval(72, 84, 37, 37, 14), color: '8A6A48', alpha: 0.18, edge: 1, soft: 0.6 }), 50));
  line('Shed', 7, (pen) => [
    pen(oval(72, 84, 31, 31, 14), { closed: true, w: 1.5, j: 0.5 }),
    pen(oval(72, 84, 38, 38, 16), { closed: true, w: 1.2, j: 0.6 }),
    pen([P(72, 54), P(72, 114)], { w: 1.2, j: 0.4 }),
    pen([P(42, 84), P(102, 84)], { w: 1.2, j: 0.4 }),
    pen([P(20, 352), P(360, 349), P(700, 353)], { w: 1.4, j: 0.8 }),
  ]);

  // a watering can by the door, and a sack of seed potatoes
  s.add(soak(60, washShape({ pts: [P(36, 302), P(84, 302), P(88, 348), P(32, 348)], color: '7E949C', alpha: 0.55, edge: 0.7, soft: 0.6, tension: 0.2 })));
  s.add(soak(66, washShape({ pts: [P(664, 350), P(660, 300), P(672, 270), P(690, 262), P(704, 274), P(712, 304), P(708, 350)], color: 'C2A878', alpha: 0.55, edge: 0.7, soft: 0.8, tension: 0.6 })));
  line('Things', 9, (pen) => [
    pen([P(36, 302), P(32, 348), P(88, 348), P(84, 302), P(36, 302)], { t: 0.15, w: 1.4, j: 0.5 }),
    pen([P(84, 318), P(110, 300), P(118, 288)], { w: 1.4, j: 0.4 }),
    pen([P(112, 286), P(124, 290), P(120, 282)], { w: 1.1, j: 0.3 }),
    pen([P(40, 302), P(52, 278), P(68, 278), P(80, 302)], { w: 1.3, j: 0.4 }),
    pen([P(664, 350), P(660, 300), P(672, 270), P(690, 262), P(704, 274), P(712, 304), P(708, 350)], { t: 0.6, w: 1.3, j: 0.5 }),
    pen([P(676, 270), P(688, 274), P(700, 268)], { w: 1, j: 0.3 }),
  ]);
  s.add(soak(70, [P(678, 300), P(694, 314), P(684, 330)].map((q, i) => watercolor({ x: q.x, y: q.y, rx: 6, ry: 5, color: '8A6A48', seed: 90 + i, alpha: 0.5, grain: false }))));

  // the pots, each standing on its own length of board, drawn at the larger size
  const half = BIG / 2;
  const pots = [];
  for (let k = 0; k < N; k++) {
    const r = rng(100 + k);
    const id = ids.next(), plant = ids.next(), bloom = ids.next();
    const color = FLOWERS[k % FLOWERS.length];
    const lean = r.jit(0.12);
    const tall = r.range(30, 38);
    const top = P(Math.sin(lean) * tall, -44 - Math.cos(lean) * tall);
    const petals = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + r.jit(0.2);
      return P(Math.cos(a) * 6, Math.sin(a) * 6);
    });
    const leaves = [[-1, 0.45], [1, 0.62]].map(([side, f]) => ({ at: P(top.x * f, -44 + (top.y + 44) * f), side }));
    const rim = [P(-27, -44), P(27, -44), P(27, -36), P(-27, -36)];
    const body = [P(-23, -36), P(23, -36), P(18, 0), P(-18, 0)];
    s.add(soak(54 + k * 3, group({ name: `pot ${k}`, id, x: SMALL[k].x, y: SMALL[k].y, scaleX: 2 / 3, scaleY: 2 / 3 }, [
      washShape({ pts: [P(-half, 0), P(half, 0), P(half, 9), P(-half, 9)], color: 'A07A4E', alpha: 0.5, edge: 0.4, soft: 0.5, tension: 0.05 }),
      washShape({ pts: body, color: 'C46F45', alpha: 0.6, edge: 0.8, soft: 0.6, tension: 0.15 }),
      washShape({ pts: rim, color: 'B15F3A', alpha: 0.65, edge: 0.8, soft: 0.5, tension: 0.1 }),
      watercolor({ x: 0, y: -44, rx: 23, ry: 3, color: '4A3C2C', seed: 140 + k, alpha: 0.7, grain: false }),
      line(`Pot ${k}`, 120 + k, (pen) => [
        pen([P(-half, 0), P(half, 0)], { w: 1.4, j: 0.5 }),
        pen([P(-half, 9), P(half, 9)], { w: 1.2, j: 0.5 }),
        pen([P(half - 1, 1), P(half, 8)], { color: INK_SOFT, w: 0.9, j: 0.3 }),
        pen([...rim, rim[0]], { t: 0.1, w: 1.3, j: 0.4 }),
        pen([P(-23, -36), P(-18, 0)], { w: 1.3, j: 0.4 }),
        pen([P(23, -36), P(18, 0)], { w: 1.3, j: 0.4 }),
        pen([P(-12, -30), P(-10, -6)], { color: INK_SOFT, w: 0.9, j: 0.4 }),
      ], { add: false, cels: 2 }).xml,
      group({ name: 'plant', id: plant, y: -44 }, [
        ...leaves.map(({ at, side }) => washShape({ pts: [P(at.x, at.y + 44), P(at.x + side * 7, at.y + 37), P(at.x + side * 15, at.y + 40), P(at.x + side * 8, at.y + 46)], color: '6C9A57', alpha: 0.7, edge: 0.8, soft: 0.4, tension: 0.8 })),
        line(`Stem ${k}`, 160 + k, (pen) => [
          pen([P(0, 0), P(top.x * 0.4 + r.jit(2), (top.y + 44) * 0.5), P(top.x, top.y + 44)], { w: 1.2, j: 0.3 }),
          ...leaves.map(({ at, side }) => pen([P(at.x, at.y + 44), P(at.x + side * 7, at.y + 37), P(at.x + side * 15, at.y + 40), P(at.x + side * 8, at.y + 46), P(at.x, at.y + 44)], { t: 0.8, w: 1, j: 0.2 })),
        ], { add: false, cels: 2 }).xml,
        // the flower: a bud while the pots are small, open once they've grown
        group({ name: 'bloom', id: bloom, x: top.x, y: top.y + 44, scaleX: 0.35, scaleY: 0.35 }, [
          ...petals.map((q, i) => watercolor({ x: q.x, y: q.y, rx: 5.5, ry: 5.5, color, seed: 200 + k * 7 + i, alpha: 0.8, grain: false })),
          watercolor({ x: 0, y: 0, rx: 3.2, ry: 3.2, color: '8A5A2A', seed: 260 + k, alpha: 0.85, grain: false }),
          line(`Bloom ${k}`, 180 + k, (pen) => petals.map((q) => pen(blobPts(5.5, 5.5, rng(k * 9 + q.x), { n: 7, wobble: 0.1 }).map((p) => P(p.x + q.x, p.y + q.y)), { closed: true, w: 0.8, j: 0.2 })), { add: false, cels: 1 }).xml,
        ]),
      ]),
    ]), 40));
    pots.push({ id, plant, bloom, phase: r.range(0, Math.PI * 2) });
  }

  // a bumblebee doing the rounds
  const bee = ids.next(), wings = ids.next();
  s.add(soak(140, group({ name: 'bee', id: bee, x: 600, y: 90 }, [
    watercolor({ x: 0, y: 0, rx: 5, ry: 3.6, color: 'E9B93A', seed: 301, alpha: 0.9, grain: false }),
    line('Bee', 33, (pen) => [
      pen(oval(0, 0, 5, 3.6, 10), { closed: true, w: 1, j: 0.15, drawn: false }),
      pen([P(-1, -3.4), P(-1, 3.4)], { w: 1.2, j: 0.1, drawn: false }),
      pen([P(2, -3), P(2, 3)], { w: 1.2, j: 0.1, drawn: false }),
    ], { add: false }).xml,
    group({ name: 'wings', id: wings, y: -3 }, [washShape({ pts: [P(-1, 0), P(-5, -7), P(1, -8), P(3, 0)], color: 'DCE6EC', alpha: 0.7, edge: 0.8, soft: 0.3 })]),
  ]), 40));
  s.loopLayer('Buzz', s.anim({ name: 'Buzz', duration: 8, loop: 'loop', rate: AMBIENT, tracks: [{ object: wings, prop: 'scaleY', keys: [[0, 1], [4, 0.4], [8, 1]] }] }));
  const route = [[0, 600, 90], [140, 470, 60], [280, 330, 96], [420, 200, 60], [560, 150, 120], [700, 300, 50], [840, 520, 70], [960, 600, 90]];
  s.loopLayer('Rounds', s.anim({
    name: 'Rounds', duration: 960, loop: 'loop', rate: STORY,
    tracks: [
      { object: bee, prop: 'x', keys: route.map(([f, v]) => [f, v, 'cubic', EASE.inOut]) },
      { object: bee, prop: 'y', keys: route.map(([f, , v]) => [f, v, 'cubic', EASE.inOut]) },
    ],
  }));

  // every plant nods a little, each in its own time
  const SW = 160;
  s.loopLayer('Nod', s.anim({
    name: 'Nod', duration: SW, loop: 'loop', rate: AMBIENT,
    tracks: pots.map((p) => ({ object: p.plant, prop: 'rotation', keys: [0, 1, 2, 3, 4].map((i) => [(i * SW) / 4, 0.05 * Math.sin(p.phase + (i * Math.PI) / 2), 'cubic', EASE.inOut]) })),
  }));

  // the story: they grow and reflow, four to a row; bloom; close; shrink back to six
  const GROW = 300, SHRINK = 860, MOVE = 64, STAG = 5, D = 1300;
  const tracks = [];
  pots.forEach((p, k) => {
    const a = GROW + k * STAG, b = SHRINK + 30 + (N - 1 - k) * STAG;
    for (const [prop, small, large] of [['x', SMALL[k].x, LARGE[k].x], ['y', SMALL[k].y, LARGE[k].y], ['scaleX', 2 / 3, 1], ['scaleY', 2 / 3, 1]]) {
      tracks.push({ object: p.id, prop, keys: [[0, small, 'hold'], [a, small, 'cubic', EASE.inOut], [a + MOVE, large, 'hold'], [b, large, 'cubic', EASE.inOut], [b + MOVE, small]] });
    }
    const open = GROW + MOVE + 20 + k * 9, shut = SHRINK + k * 2;
    for (const prop of ['scaleX', 'scaleY']) tracks.push({ object: p.bloom, prop, keys: [[0, 0.35, 'hold'], [open, 0.35, 'cubic', EASE.back], [open + 34, 1, 'hold'], [shut, 1, 'cubic', EASE.inOut], [shut + 30, 0.35]] });
  });
  s.loopLayer('Reflow', s.anim({ name: 'Reflow', duration: D, loop: 'loop', rate: STORY, tracks }));

  intro();
  return s.toXml();
}
