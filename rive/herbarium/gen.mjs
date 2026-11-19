// Draft 9 · Herbarium — an antique pressed-plant book. One artboard holds the
// open spread: cloth boards, deckled pages with foxing, a silk ribbon, a dog-eared
// corner on each page, a ladybird that wanders the margins, one specimen per spread,
// and the leaf that turns between them. The text of each right-hand page is HTML.
import {
  Ids, Scene, rng, P, TAU, el, argb, document, boil, inkShape, washShape, pathXml, polyXml,
  stroke, fill, solid, solidId, resample, jitterPts, EASE,
} from '../lib/ink.mjs';
import { fern, violet, ginkgo, maple, lavender, oak, forgetMeNot } from './plants.mjs';

const W = 1400;
const H = 920;
const GX = 700; // gutter
const INK = 'FF3B2F27';
const INK_SOFT = argb('3B2F27', 0.6);
const PAPER = 'F3EAD5';

// page geometry: tops and bottoms bow toward the gutter
const TOP_OUT = 46, TOP_IN = 56, BOT_OUT = 874, BOT_IN = 866;
const OUT_L = 66, OUT_R = 1334;

function pageOutline(side, r, { dx = 0, dy = 0, deckle = 1.4 } = {}) {
  const out = side < 0 ? OUT_L : OUT_R;
  const pts = [];
  const steps = 8;
  // top edge: outer -> gutter
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = out + (GX - out) * t;
    const y = TOP_OUT + (TOP_IN - TOP_OUT) * Math.pow(t, 3);
    pts.push(P(x + dx, y + dy));
  }
  // the gutter itself, densely, so the smoothing has nothing to overshoot
  for (let y = TOP_IN + 30; y < BOT_IN - 20; y += 30) pts.push(P(GX + dx, y + dy));
  // bottom edge: gutter -> outer
  for (let i = 0; i <= steps; i++) {
    const t = 1 - i / steps;
    const x = out + (GX - out) * t;
    const y = BOT_OUT + (BOT_IN - BOT_OUT) * Math.pow(t, 3);
    pts.push(P(x + dx, y + dy));
  }
  // deckled fore-edge: bottom -> top
  for (let y = BOT_OUT - 24; y > TOP_OUT + 20; y -= 24) pts.push(P(out + dx + r.jit(deckle), y + dy));
  return side < 0 ? pts.reverse() : pts;
}

function rect(x, y, w, h, kids, { name = 'Rect', id, rid, rx } = {}) {
  return el('Shape', { x, y, name, id }, [el('Rectangle', { width: w, height: h, originX: 0, originY: 0, cornerRadiusTL: rx, name: 'P', id: rid }), ...kids]);
}

function hgrad(x0, x1, stops) {
  return el('Fill', { name: 'Fill' }, el('LinearGradient', { startX: x0, startY: 0, endX: x1, endY: 0, name: 'G' }, stops.map(([c, p]) => el('GradientStop', { colorValue: c, position: p }))));
}

// ---------------------------------------------------------------- plate (specimen)

function scaleSpec(spec, k) {
  if (k === 1) return spec;
  const sp = (pts) => pts.map((p) => P(p.x * k, p.y * k));
  const parts = (arr) => arr.map((x) => ({ ...x, pts: sp(x.pts) }));
  return {
    ...spec,
    ink: parts(spec.ink), wash: parts(spec.wash),
    tapes: spec.tapes.map((t) => ({ ...t, x: t.x * k, y: t.y * k })),
    loose: { ...spec.loose, x: spec.loose.x * k, y: spec.loose.y * k },
  };
}

function plate(s, ids, spec, index, center) {
  const r = rng(100 + index);
  const rootId = ids.next();
  const trimId = ids.next();
  const fxId = ids.next();
  const washNode = ids.next();
  const tapesNode = ids.next();
  const looseId = ids.next();
  s.add(el('GroupEffect', { name: `Draw ${index}`, id: fxId }, el('TrimPath', { start: 0, end: 0, id: trimId, name: 'Trim' })));

  const washXml = spec.wash.map((w) => (w.plain
    ? el('Shape', { name: 'w', blendModeValue: 'multiply' }, [pathXml(w.pts, { closed: true, tension: 0.9 }), fill(argb(w.color, w.alpha))])
    : washShape({ pts: w.pts, color: w.color, alpha: w.alpha, edge: 0.75, soft: 1.3, tension: 0.9 })));
  const inkXml = spec.ink.map((k) => inkShape({ pts: k.pts, closed: k.closed, tension: k.tension ?? 1, color: k.soft ? INK_SOFT : INK, width: k.width ?? 1, bleed: k.soft ? 0 : 0.14, effect: fxId }));

  // gummed paper tape: jagged torn ends, a faint shadow that grows when lifted
  const hoverTracks = { on: [], off: [] };
  const tapeXml = spec.tapes.map((t) => {
    const hw = t.w / 2;
    const tear = (x, dir) => [0, 1, 2, 3, 4].map((k) => P(x + dir * (k % 2 ? 2.4 : 0) + r.jit(0.8), -7 + k * 3.5));
    const pts = [P(-hw + 2, -7), P(hw - 2, -7.5), ...tear(hw, 1).slice(1, -1), P(hw - 1, 7), P(-hw + 1, 7.4), ...tear(-hw, -1).slice(1, -1).reverse()];
    const shadowId = ids.next();
    const stripId = ids.next();
    hoverTracks.on.push({ object: stripId, prop: 'y', keys: [[0, -2.2]] }, { object: shadowId, prop: 'opacity', keys: [[0, 0.9]] }, { object: shadowId, prop: 'y', keys: [[0, 4]] });
    hoverTracks.off.push({ object: stripId, prop: 'y', keys: [[0, 0]] }, { object: shadowId, prop: 'opacity', keys: [[0, 0.35]] }, { object: shadowId, prop: 'y', keys: [[0, 1.2]] });
    return el('Node', { name: 'Tape', x: t.x, y: t.y, rotation: t.rot }, [
      el('Shape', { name: 'Strip', id: stripId }, [polyXml(pts, { closed: true }), fill(argb('EEE4C8', 0.9)), stroke(argb('A39577', 0.45), 0.6)]),
      el('Shape', { name: 'TapeShadow', id: shadowId, y: 1.2, opacity: 0.35 }, [polyXml(pts, { closed: true }), fill(argb('5A4630', 0.35), { feather: 3 })]),
    ]);
  });

  const L = spec.loose;
  const looseXml = el('Node', { name: 'Loose', x: L.x, y: L.y, rotation: L.rot, id: looseId, opacity: 0 }, [
    ...L.ink.map((k) => inkShape({ pts: k.pts, closed: k.closed, tension: k.tension ?? 1, color: k.soft ? INK_SOFT : INK, width: k.width ?? 1, bleed: 0.1 })),
    ...L.wash.map((w) => washShape({ pts: w.pts, color: w.color, alpha: w.alpha, edge: 0.75, soft: 1.3, tension: 0.9 })),
  ]);

  const dx = r.range(2.5, 4.5) * (r() > 0.5 ? 1 : -1);
  const dy = r.range(1.5, 3.5);
  s.add(
    el('Node', { name: `Plate ${index}`, x: center.x, y: center.y, id: rootId, opacity: 0 }, [
      el('Node', { name: 'Tapes', id: tapesNode, opacity: 0 }, tapeXml),
      looseXml,
      el('Node', { name: 'Ink' }, [...inkXml].reverse()),
      el('Node', { name: 'Washes', x: dx, y: dy, id: washNode, opacity: 0 }, washXml),
    ])
  );

  const hidden = s.anim({
    name: `Plate ${index} hidden`, duration: 1,
    tracks: [
      { object: rootId, prop: 'opacity', keys: [[0, 0]] },
      { object: trimId, prop: 'end', keys: [[0, 0]] },
      { object: washNode, prop: 'opacity', keys: [[0, 0]] },
      { object: tapesNode, prop: 'opacity', keys: [[0, 0]] },
      { object: looseId, prop: 'opacity', keys: [[0, 0]] },
    ],
  });
  const fr = rng(7 + index);
  const shown = s.anim({
    name: `Plate ${index} draw`, duration: 190,
    tracks: [
      { object: rootId, prop: 'opacity', keys: [[0, 1]] },
      { object: trimId, prop: 'end', keys: [[0, 0, 'cubic', [0.45, 0.05, 0.3, 1]], [95, 1]] },
      { object: washNode, prop: 'opacity', keys: [[0, 0, 'hold'], [40, 0, 'cubic', EASE.out], [120, 1]] },
      { object: tapesNode, prop: 'opacity', keys: [[0, 0, 'hold'], [96, 0, 'cubic', EASE.out], [108, 1]] },
      { object: tapesNode, prop: 'scaleX', keys: [[0, 1.1, 'hold'], [96, 1.1, 'cubic', EASE.out], [112, 1]] },
      { object: tapesNode, prop: 'scaleY', keys: [[0, 1.1, 'hold'], [96, 1.1, 'cubic', EASE.out], [112, 1]] },
      // the loose piece drifts down and settles with a little flutter
      { object: looseId, prop: 'opacity', keys: [[0, 0, 'hold'], [70, 0, 'cubic', EASE.out], [90, 1]] },
      { object: looseId, prop: 'rotation', keys: [[0, L.rot + 0.9, 'hold'], [70, L.rot + 0.9, 'cubic', EASE.inOut], [110, L.rot - 0.35, 'cubic', EASE.inOut], [140, L.rot + 0.18, 'cubic', EASE.inOut], [165, L.rot - 0.05, 'cubic', EASE.inOut], [190, L.rot]] },
      { object: looseId, prop: 'x', keys: [[0, L.x - 30, 'hold'], [70, L.x - 30, 'cubic', EASE.inOut], [120, L.x + 8 + fr.jit(4), 'cubic', EASE.inOut], [190, L.x]] },
      { object: looseId, prop: 'y', keys: [[0, L.y - 40, 'hold'], [70, L.y - 40, 'cubic', EASE.out], [190, L.y]] },
    ],
  });
  return { hidden, shown, hoverTracks };
}

// ---------------------------------------------------------------- page turn

const ease = (t) => 0.5 - 0.5 * Math.cos(Math.PI * t);

function leafGeom(theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const lift = 30 * s;
  const ox = GX + (OUT_R - GX) * c;
  const top = P(ox, TOP_OUT - lift);
  const bot = P(ox, BOT_OUT + lift);
  // the free half of the leaf lags behind the hinge half, which reads as a curl
  const lag = 70 * s * Math.sign(c || 1) * (1 - Math.abs(c)) ;
  const midTop = P(GX + (ox - GX) * 0.5 + lag * 0.3, (TOP_IN + top.y) / 2 - lift * 0.35);
  const midBot = P(GX + (ox - GX) * 0.5 + lag * 0.3, (BOT_IN + bot.y) / 2 + lift * 0.35);
  const dTop = Math.atan2(top.y - TOP_IN, ox - GX || 0.001);
  const dBot = Math.atan2(BOT_IN - bot.y, GX - ox || 0.001);
  const len = Math.abs(ox - GX) * 0.22 + 2;
  return { c, s, top, bot, midTop, midBot, dTop, dBot, len, ox };
}

const mix = (a, b, t) => {
  const ch = (h, i) => parseInt(h.slice(i, i + 2), 16);
  return [0, 2, 4].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
};

function unwrap(vals) {
  const out = [vals[0]];
  for (let i = 1; i < vals.length; i++) {
    let v = vals[i];
    while (v - out[i - 1] > Math.PI) v -= TAU;
    while (v - out[i - 1] < -Math.PI) v += TAU;
    out.push(v);
  }
  return out;
}

function pageTurn(s, ids) {
  const v = Array.from({ length: 6 }, () => ids.next());
  const leafId = ids.next();
  const colorId = ids.next();
  const shRId = ids.next();
  const shLId = ids.next();
  const shRRect = ids.next();
  const shLRect = ids.next();
  const g0 = leafGeom(0);
  const verts = [
    el('StraightVertex', { x: GX, y: TOP_IN, id: v[0] }),
    el('CubicMirroredVertex', { x: g0.midTop.x, y: g0.midTop.y, rotation: g0.dTop, distance: g0.len, id: v[1] }),
    el('StraightVertex', { x: g0.top.x, y: g0.top.y, id: v[2] }),
    el('StraightVertex', { x: g0.bot.x, y: g0.bot.y, id: v[3] }),
    el('CubicMirroredVertex', { x: g0.midBot.x, y: g0.midBot.y, rotation: g0.dBot, distance: g0.len, id: v[4] }),
    el('StraightVertex', { x: GX, y: BOT_IN, id: v[5] }),
  ];
  // shadow the lifted leaf throws on the page beneath it
  const shadow = (id, rid, originX) => el('Shape', { name: 'TurnShadow', x: GX, y: (TOP_IN + BOT_IN) / 2, id, opacity: 0 }, [
    el('Rectangle', { width: 0, height: BOT_IN - TOP_IN - 20, originX, originY: 0.5, name: 'P', id: rid }),
    fill(argb('2A1E12', 0.55), { feather: 22 }),
  ]);
  s.add(shadow(shRId, shRRect, 0), shadow(shLId, shLRect, 1));
  s.add(el('Shape', { name: 'Leaf', id: leafId, opacity: 0 }, [
    el('PointsPath', { isClosed: 'true', isClockwise: 'true', name: 'Path' }, verts),
    el('Fill', { name: 'Fill' }, solidId('FF' + PAPER, colorId)),
    stroke(argb('8F826C', 0.55), 1),
  ]));

  const build = (name, from, to, { pre = 0, fadeIn = 0 }) => {
    const span = 54;
    const N = 18;
    const frames = [];
    for (let i = 0; i <= N; i++) frames.push(pre + Math.round((i / N) * span));
    const gs = frames.map((f, i) => leafGeom(from + (to - from) * ease(i / N)));
    const rotTop = unwrap(gs.map((g) => g.dTop));
    const rotBot = unwrap(gs.map((g) => g.dBot));
    const k = (fn) => gs.map((g, i) => [frames[i], fn(g, i), 'linear']);
    const end = pre + span;
    const tracks = [
      { object: v[1], prop: 'x', keys: k((g) => g.midTop.x) },
      { object: v[1], prop: 'y', keys: k((g) => g.midTop.y) },
      { object: v[1], prop: 'rotation', keys: k((g, i) => rotTop[i]) },
      { object: v[1], prop: 'distance', keys: k((g) => g.len) },
      { object: v[2], prop: 'x', keys: k((g) => g.top.x) },
      { object: v[2], prop: 'y', keys: k((g) => g.top.y) },
      { object: v[3], prop: 'x', keys: k((g) => g.bot.x) },
      { object: v[3], prop: 'y', keys: k((g) => g.bot.y) },
      { object: v[4], prop: 'x', keys: k((g) => g.midBot.x) },
      { object: v[4], prop: 'y', keys: k((g) => g.midBot.y) },
      { object: v[4], prop: 'rotation', keys: k((g, i) => rotBot[i]) },
      { object: v[4], prop: 'distance', keys: k((g) => g.len) },
      { object: colorId, prop: 'colorValue', type: 'Color', keys: gs.map((g, i) => [frames[i], 'FF' + mix(PAPER, 'C4B597', g.s * 0.55 + (g.c < 0 ? 0.12 * -g.c : 0)), 'linear']) },
      { object: shRRect, prop: 'width', keys: k((g) => (g.c > 0 ? (OUT_R - GX) * g.c + 16 : 0)) },
      { object: shLRect, prop: 'width', keys: k((g) => (g.c < 0 ? (OUT_R - GX) * -g.c + 16 : 0)) },
      { object: shRId, prop: 'opacity', keys: k((g) => (g.c > 0 ? g.s * 0.9 : 0)) },
      { object: shLId, prop: 'opacity', keys: k((g) => (g.c < 0 ? g.s * 0.9 : 0)) },
      {
        object: leafId, prop: 'opacity',
        keys: fadeIn ? [[0, 0, 'cubic', EASE.out], [pre, 1, 'hold'], [end, 1, 'cubic', EASE.inOut], [end + 18, 0]] : [[0, 1, 'hold'], [end, 1, 'cubic', EASE.inOut], [end + 20, 0]],
      },
    ];
    return s.anim({ name, duration: end + 20, tracks });
  };
  const next = build('Turn next', 0, Math.PI, {});
  const back = build('Turn back', Math.PI, 0, { pre: 10, fadeIn: true });
  return { next, back };
}

// ---------------------------------------------------------------- the rest of the book

function ladybird(s, ids) {
  const nodeId = ids.next();
  const r = rng(31);
  const legs = boil(s, {
    name: 'Legs', seed: 5, hold: 4, cels: 3,
    draw: (rr) => [-1, 1].flatMap((side) => [-5, 0, 5].map((x) => inkShape({
      pts: [P(x, side * 5), P(x + rr.jit(2.5), side * 9), P(x + rr.jit(3.5) + 1, side * 11.5)], color: INK, width: 0.8, bleed: 0,
    }))),
  });
  const body = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    body.push(P(Math.cos(a) * 8.5 - 1, Math.sin(a) * 7));
  }
  const spots = [P(-4, -3.2), P(-4, 3.2), P(1.5, -4), P(1.5, 4), P(-7, 0)];
  s.add(el('Node', { name: 'Ladybird', id: nodeId, x: -40, y: 892 }, [
    legs.xml,
    washShape({ pts: body, color: 'C23A2B', alpha: 0.95, edge: 0.6, soft: 0.8, tension: 0.9 }),
    ...spots.map((p) => el('Shape', { x: p.x, y: p.y, name: 'Spot' }, [el('Ellipse', { width: 2.6, height: 2.6, originX: 0.5, originY: 0.5, name: 'P' }), fill(INK)])),
    el('Shape', { x: 8, name: 'Head' }, [el('Ellipse', { width: 6, height: 8, originX: 0.5, originY: 0.5, name: 'P' }), fill(INK)]),
    inkShape({ pts: [P(7, 0), P(-9, 0)], color: INK, width: 0.7, bleed: 0 }),
    inkShape({ pts: body, closed: true, tension: 0.9, color: INK, width: 0.9, bleed: 0 }),
  ].reverse()));
  s.loopLayer('Ladybird legs', legs.animId);
  // an occasional stroll along the foot of the spread, with two pauses
  const route = [
    [0, P(-40, 892)], [420, P(-40, 892)], [570, P(130, 872)], [710, P(300, 862)], [820, P(300, 862)],
    [1000, P(560, 868)], [1140, P(760, 864)], [1280, P(760, 864)], [1460, P(1060, 870)], [1640, P(1440, 893)], [2400, P(1440, 893)],
  ];
  const keysX = route.map(([f, p]) => [f, p.x, 'cubic', [0.35, 0, 0.65, 1]]);
  const keysY = route.map(([f, p]) => [f, p.y + r.jit(0), 'cubic', [0.35, 0, 0.65, 1]]);
  const keysR = route.map(([f, p], i) => {
    const nxt = route[Math.min(route.length - 1, i + 1)][1];
    const prv = route[Math.max(0, i - 1)][1];
    const dx = nxt.x - prv.x || 1;
    return [f, Math.atan2(nxt.y - prv.y, dx) * 0.8, 'cubic', EASE.inOut];
  });
  s.loopLayer('Ladybird walk', s.anim({ name: 'Stroll', duration: 2400, loop: 'loop', tracks: [{ object: nodeId, prop: 'x', keys: keysX }, { object: nodeId, prop: 'y', keys: keysY }, { object: nodeId, prop: 'rotation', keys: keysR }] }));
}

function ribbon(s, ids) {
  const r = rng(12);
  const tailId = ids.next();
  const left = resample([P(716, 30), P(722, 260), P(715, 560), P(724, 876)], 14).map((p) => P(p.x + r.jit(0.5), p.y));
  const right = left.map((p) => P(p.x + 10, p.y + r.jit(0.5))).reverse();
  const strip = [...left, ...right];
  const tail = [P(-5, 0), P(5, 0), P(6, 40), P(0.5, 32), P(-4.5, 42)];
  s.add(el('Node', { name: 'Ribbon' }, [
    el('Node', { name: 'Tail', x: 729, y: 874, id: tailId }, [
      inkShape({ pts: tail, closed: true, tension: 0.15, color: argb('5E1B14', 0.8), width: 0.8, bleed: 0 }),
      el('Shape', { name: 'TailSilk' }, [polyXml(tail, { closed: true }), hgrad(-5, 5, [['FF7E2C25', 0], ['FFA2483B', 0.45], ['FF7A2A23', 1]])]),
    ]),
    inkShape({ pts: strip, closed: true, tension: 0.4, color: argb('5E1B14', 0.6), width: 0.7, bleed: 0 }),
    el('Shape', { name: 'Silk' }, [pathXml(strip, { closed: true, tension: 0.4 }), hgrad(715, 734, [['FF7E2C25', 0], ['FFA2483B', 0.45], ['FF7A2A23', 1]])]),
    el('Shape', { name: 'RibbonShadow', x: 3, y: 2 }, [pathXml(strip, { closed: true, tension: 0.4 }), fill(argb('3A2416', 0.25), { feather: 3 })]),
  ]));
  s.loopLayer('Ribbon sway', s.anim({ name: 'Ribbon sway', duration: 260, loop: 'pingPong', tracks: [{ object: tailId, prop: 'rotation', keys: [[0, -0.07, 'cubic', EASE.inOut], [260, 0.08]] }] }));
}

function corner(s, ids, side, { event, boolId }) {
  // a dog-eared corner: the next page shows through where the corner has peeled up
  const nodeId = ids.next();
  const flapId = ids.next();
  const hitId = ids.next();
  const x = side > 0 ? OUT_R : OUT_L;
  const y = BOT_OUT;
  const sx = side > 0 ? 1 : -1;
  const m = (p) => P(p.x * sx, p.y);
  const under = [P(0, 0), P(-44, 0), P(0, -44)].map(m);
  const flap = [P(-44, 0), P(-14, -18), P(0, -44), P(-22, -26), P(-27, -22)].map(m);
  s.add(el('Node', { name: side > 0 ? 'Corner R' : 'Corner L', x, y, id: nodeId }, [
    el('Node', { name: 'Flap', id: flapId }, [
      inkShape({ pts: flap, closed: true, tension: 0.2, color: argb('7A6A50', 0.7), width: 0.7, bleed: 0 }),
      el('Shape', { name: 'FlapPaper' }, [pathXml(flap, { closed: true, tension: 0.2 }), fill('FFF8F1E0')]),
      el('Shape', { name: 'FlapShadow', x: -2 * sx, y: -2 }, [pathXml(flap, { closed: true, tension: 0.2 }), fill(argb('3A2A1A', 0.18))]),
    ]),
    el('Shape', { name: 'Under' }, [pathXml(under, { closed: true, tension: 0.1 }), fill('FFE6DABF'), stroke(argb('A89878', 0.5), 0.6)]),
  ]));
  s.add(rect(side > 0 ? x - 110 : x, y - 100, 110, 110, [fill('00000000')], { name: 'CornerHit', id: hitId }));
  const rest = s.anim({ name: `corner ${side} rest`, duration: 1, tracks: ['scaleX', 'scaleY'].map((p) => ({ object: nodeId, prop: p, keys: [[0, 1]] })) });
  const lift = s.anim({ name: `corner ${side} lift`, duration: 1, tracks: ['scaleX', 'scaleY'].map((p) => ({ object: nodeId, prop: p, keys: [[0, 1.6]] })) });
  s.boolLayer(`Corner ${side}`, boolId, rest, lift, { mixIn: 220, mixOut: 300 });
  s.listen(hitId, 'enter', [Scene.setBool(boolId, true)]);
  s.listen(hitId, 'exit', [Scene.setBool(boolId, false)]);
  s.listen(hitId, 'click', [Scene.emit(event)]);
  return nodeId;
}

function book(ids) {
  const s = new Scene(ids, { name: 'Book', w: W, h: H });
  const r = rng(9);
  const spread = s.input('number', 'spread', +(process.env.HB_SPREAD || 0));
  const turnNext = s.input('trigger', 'turnNext');
  const turnBack = s.input('trigger', 'turnBack');
  const hover = s.input('bool', 'hover', 0);
  const cornerR = s.input('bool', 'cornerR', 0);
  const cornerL = s.input('bool', 'cornerL', 0);
  const hasPrev = s.input('bool', 'hasPrev', 0);
  const hasNext = s.input('bool', 'hasNext', 1);
  const evNext = s.event('next');
  const evPrev = s.event('prev');

  // boards: oxblood book cloth, a soft shadow on the table
  s.add(rect(30, 22, W - 60, H - 34, [fill(argb('0E1410', 0.55), { feather: 26 })], { name: 'BookShadow', rx: 14 }));
  s.add(rect(24, 14, W - 48, H - 30, [fill('FF5B2A25'), stroke(argb('2A1210', 0.9), 1.2)], { name: 'Cover', rx: 12 }));
  s.add(rect(24, 14, W - 48, H - 30, [hgrad(24, W - 24, [['22000000', 0], ['00000000', 0.2], ['30000000', 0.5], ['00000000', 0.8], ['22000000', 1]])], { name: 'CoverShade', rx: 12 }));
  // page block thickness
  for (const side of [-1, 1]) {
    for (let k = 4; k >= 1; k--) {
      const pts = pageOutline(side, r, { dx: side * k * 1.7, dy: k * 1.6, deckle: 1 });
      s.add(el('Shape', { name: 'Leaves' }, [pathXml(pts, { closed: true, tension: 0.35 }), fill('FFE9DDC2'), stroke(argb('A99876', 0.6), 0.6)]));
    }
  }
  // the two visible pages
  for (const side of [-1, 1]) {
    const pts = pageOutline(side, r);
    const out = side < 0 ? OUT_L : OUT_R;
    s.add(el('Shape', { name: side < 0 ? 'Page L' : 'Page R' }, [
      pathXml(pts, { closed: true, tension: 0.35 }),
      hgrad(out, GX, [['FFEDE1C7', 0], ['FF' + PAPER, 0.18], ['FFF5EDDA', 0.6], ['FFEADFC4', 1]]),
      stroke(argb('A39272', 0.55), 0.7),
    ]));
  }
  // foxing: age spots that bloom slowly after the book opens
  const fox = [];
  const foxTracks = [];
  for (let i = 0; i < 46; i++) {
    const side = i % 2 ? 1 : -1;
    const edge = r() < 0.6;
    const x = edge ? (side < 0 ? OUT_L + r.range(6, 90) : OUT_R - r.range(6, 90)) : r.range(side < 0 ? 90 : 720, side < 0 ? 680 : 1310);
    const y = r() < 0.5 ? r.range(60, 160) : r.range(TOP_OUT + 20, BOT_OUT - 20);
    const id = ids.next();
    const d = r.range(1.5, edge ? 7 : 4);
    fox.push(el('Shape', { name: 'Fox', x, y, id, opacity: 0 }, [el('Ellipse', { width: d * 2, height: d * 1.7, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('9C7444', r.range(0.12, 0.3)), { feather: d * 0.8 })]));
    const at = Math.round(r.range(30, 600));
    foxTracks.push({ object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [at, 0, 'cubic', EASE.out], [at + 160, 1]] });
  }
  s.add(el('Node', { name: 'Foxing' }, fox));
  s.loopLayer('Foxing', s.anim({ name: 'Foxing bloom', duration: 800, tracks: foxTracks }));

  // gutter shade on both pages and a faint darkening at the fore-edges
  s.add(rect(GX - 90, TOP_IN - 8, 90, BOT_IN - TOP_IN + 14, [hgrad(0, 90, [['003A2A1A', 0], ['143A2A1A', 0.55], ['5A3A2A1A', 1]])], { name: 'Gutter L' }));
  s.add(rect(GX, TOP_IN - 8, 70, BOT_IN - TOP_IN + 14, [hgrad(0, 70, [['4A3A2A1A', 0], ['123A2A1A', 0.4], ['003A2A1A', 1]])], { name: 'Gutter R' }));
  s.add(rect(GX - 1, TOP_IN - 6, 2, BOT_IN - TOP_IN + 10, [fill(argb('4A3826', 0.35))], { name: 'Fold' }));

  // specimen label card on the left page; the words on it are HTML
  const card = [P(452, 774), P(652, 772), P(654, 850), P(450, 852)];
  s.add(el('Shape', { name: 'CardShadow', x: 2, y: 3 }, [polyXml(card, { closed: true }), fill(argb('3A2A1A', 0.22), { feather: 4 })]));
  s.add(el('Shape', { name: 'Card' }, [polyXml(card, { closed: true }), fill('FFF7F0DE'), stroke(argb('6B5A44', 0.7), 0.8)]));
  s.add(inkShape({ name: 'CardRule', pts: [P(462, 784), P(642, 783), P(643, 840), P(461, 842), P(462, 784)], tension: 0.05, color: argb('7C3B2E', 0.55), width: 0.6, bleed: 0 }));

  // plates
  const builders = [fern, violet, ginkgo, maple, lavender, oak, forgetMeNot];
  const center = P(372, 404);
  const hoverOn = [];
  const hoverOff = [];
  builders.forEach((b, i) => {
    const p = plate(s, ids, scaleSpec(b(), [1, 1.04, 1, 1.25, 1, 1.12, 1.32][i]), i, center);
    hoverOn.push(...p.hoverTracks.on);
    hoverOff.push(...p.hoverTracks.off);
    const hid = ids.next();
    const sh = ids.next();
    const cond = (op) => el('TransitionNumberCondition', { inputId: spread, opValue: op, value: i });
    s.layers.push(s._layer(`Plate ${i}`, [
      el('AnyState', { x: 200, y: -140 }),
      el('ExitState', { x: 500, y: -140 }),
      el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: hid })),
      el('AnimationState', { x: 200, y: 0, animationId: p.hidden, id: hid }, el('StateTransition', { stateToId: sh }, cond('equal'))),
      el('AnimationState', { x: 400, y: 0, animationId: p.shown, id: sh }, el('StateTransition', { stateToId: hid }, cond('notEqual'))),
    ]));
  });
  const hOff = s.anim({ name: 'Tapes down', duration: 1, tracks: hoverOff });
  const hOn = s.anim({ name: 'Tapes lifted', duration: 1, tracks: hoverOn });
  s.boolLayer('Tape lift', hover, hOff, hOn, { mixIn: 260, mixOut: 420 });
  const plateHit = ids.next();
  s.add(rect(110, 70, 540, 690, [fill('00000000')], { name: 'PlateHit', id: plateHit }));
  s.listen(plateHit, 'enter', [Scene.setBool(hover, true)]);
  s.listen(plateHit, 'exit', [Scene.setBool(hover, false)]);

  ribbon(s, ids);
  const cR = corner(s, ids, 1, { event: evNext, boolId: cornerR });
  const cL = corner(s, ids, -1, { event: evPrev, boolId: cornerL });
  for (const [b, node, name] of [[hasNext, cR, 'next'], [hasPrev, cL, 'prev']]) {
    const off = s.anim({ name: `${name} off`, duration: 1, tracks: [{ object: node, prop: 'opacity', keys: [[0, 0]] }] });
    const on = s.anim({ name: `${name} on`, duration: 1, tracks: [{ object: node, prop: 'opacity', keys: [[0, 1]] }] });
    s.boolLayer(`Has ${name}`, b, off, on, { mixIn: 300, mixOut: 300 });
  }

  ladybird(s, ids);

  const turn = pageTurn(s, ids);
  const idle = ids.next();
  const tn = ids.next();
  const tb = ids.next();
  const done = (to) => el('StateTransition', { stateToId: to, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 });
  s.layers.push(s._layer('Turn', [
    el('AnyState', { x: 200, y: -140 }),
    el('ExitState', { x: 600, y: -140 }),
    el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: idle })),
    el('AnimationState', { x: 200, y: 0, animationId: s.empty(), id: idle }, [
      el('StateTransition', { stateToId: tn }, el('TransitionTriggerCondition', { inputId: turnNext })),
      el('StateTransition', { stateToId: tb }, el('TransitionTriggerCondition', { inputId: turnBack })),
    ]),
    el('AnimationState', { x: 400, y: -60, animationId: turn.next, reset: 'true', id: tn }, done(idle)),
    el('AnimationState', { x: 400, y: 60, animationId: turn.back, reset: 'true', id: tb }, done(idle)),
  ]));

  if (process.env.HB_BG) s.bg = 'FF26332B';
  return s.toXml();
}

export default function () {
  const ids = new Ids();
  return document(book(ids));
}

void solid; void jitterPts;
