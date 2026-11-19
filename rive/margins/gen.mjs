// Draft 1 · Margins — a stippled ink dandelion you can make a wish on,
// a name swash, and small boiling doodles that live in the page margin.
import {
  Ids, Scene, rng, P, TAU, el, argb, document, boil, inkShape, pathXml, stroke, fill,
  stippleShape, washShape, watercolor, blobPts, resample, jitterPts, EASE,
} from '../lib/ink.mjs';

const INK = 'FF2B2826';
const INK_SOFT = argb('2B2826', 0.55);

// ---------------------------------------------------------------- dandelion

function dandelion(ids) {
  const W = 420, H = 640;
  const s = new Scene(ids, { name: 'Dandelion', w: W, h: H, x: 0, y: 0, bg: process.env.PREVIEW_BG });
  const r = rng(42);

  const plantId = ids.next();
  const headId = ids.next();
  const stemTrim = ids.next();
  const kids = []; // plant children, back to front

  // leaves: lobed, with backward-pointing teeth, washed in sap green slightly off the line
  const leaf = (dir, len, wid, seed) => {
    const lr = rng(seed);
    const top = [];
    const bot = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const tooth = i % 3 === 1 ? 0.55 : 1; // notch every third step
      const w = Math.pow(Math.sin(Math.PI * Math.min(0.98, t * 0.95 + 0.04)), 0.8) * wid * tooth;
      top.push(P(t * len + (i % 3 === 1 ? -6 : 0), -w + lr.jit(1.5)));
      bot.push(P(t * len + (i % 3 === 2 ? -6 : 0), w * 0.8 + lr.jit(1.5)));
    }
    const outline = [...top, ...bot.reverse().slice(1, -1)];
    const rot = (p) => P(Math.cos(dir) * p.x - Math.sin(dir) * p.y, Math.sin(dir) * p.x + Math.cos(dir) * p.y);
    const pts = outline.map(rot);
    const rib = resample([P(0, 0), P(len * 0.5, 2), P(len * 0.9, 0)], 5).map(rot);
    return { pts, rib, wash: jitterPts(pts, 2.5, lr).map((p) => P(p.x + 3, p.y + 2)) };
  };
  const leaves = [leaf(-2.6, 150, 26, 7), leaf(-0.45, 130, 22, 9), leaf(-2.05, 105, 18, 11)];
  for (const lf of leaves) kids.push(washShape({ pts: lf.wash, color: '8FAF6E', alpha: 0.45, edge: 0.8, soft: 1.5, tension: 0.5 }));
  const leafBoil = boil(s, {
    name: 'Leaves', seed: 3, hold: 9,
    draw: (rr) => leaves.flatMap((lf) => [
      inkShape({ pts: jitterPts(lf.pts, 0.8, rr), closed: true, tension: 0.45, color: INK, width: 1.2, bleed: 0.12 }),
      inkShape({ pts: jitterPts(lf.rib, 0.6, rr), color: INK_SOFT, width: 0.8, bleed: 0 }),
    ]),
  });
  kids.push(leafBoil.xml);

  // stem: two hairline edges, drawn on from the ground up
  const stemPts = [P(0, 0), P(4, -110), P(13, -230), P(23, -340), P(30, -430)];
  const stemFx = ids.next();
  s.add(el('GroupEffect', { name: 'StemDraw', id: stemFx }, el('TrimPath', { start: 0, end: 0, id: stemTrim, name: 'Trim' })));
  kids.push(inkShape({ name: 'StemL', x: -1.6, pts: stemPts, color: INK, width: 1.3, effect: stemFx }));
  kids.push(inkShape({ name: 'StemR', x: 2, pts: jitterPts(stemPts, 1.2, r), color: INK, width: 1, bleed: 0.1, effect: stemFx }));

  // seed head: points on a sphere, projected, so the clock has real depth
  const R = 98;
  const seeds = [];
  for (let i = 0; i < 92; i++) {
    const z = r() * 2 - 1;
    const phi = r() * TAU;
    const k = Math.sqrt(1 - z * z);
    seeds.push({ a: phi, L: R * Math.max(0.28, k), z, k });
  }
  seeds.sort((a, b) => a.z - b.z); // back seeds first
  const headKids = [];
  const seedNodes = [];
  for (const sd of seeds) {
    const sr = r.fork();
    const paths = [];
    const persp = 0.65 + 0.35 * sd.k;
    // filament from the receptacle to the pappus, faintly curved
    paths.push(pathXml([P(9, 0), P(sd.L * 0.55, sr.jit(1.5)), P(sd.L, sr.jit(1))]));
    // the pappus: a fan of fine hairs
    const fan = 9;
    for (let f = 0; f < fan; f++) {
      const ang = (-0.5 + f / (fan - 1)) * 2.5 + sr.jit(0.08);
      const len = 15 * persp * (1 + sr.jit(0.22));
      const mx = sd.L + Math.cos(ang) * len * 0.55;
      const my = Math.sin(ang) * len * 0.55 + sr.jit(0.8);
      paths.push(pathXml([P(sd.L, 0), P(mx, my), P(sd.L + Math.cos(ang) * len, Math.sin(ang) * len * 1.05)]));
    }
    const shapeId = ids.next();
    const nodeId = ids.next();
    const back = sd.z < 0;
    const col = back ? argb('2B2826', 0.38) : argb('2B2826', 0.85);
    headKids.push(
      el('Node', { name: 'seed', rotation: sd.a, id: nodeId }, el('Shape', { name: 'seedInk', id: shapeId, scaleX: 0, scaleY: 0 }, [...paths, stroke(col, back ? 0.55 : 0.75)]))
    );
    seedNodes.push({ nodeId, shapeId, ...sd, back });
  }
  // receptacle: dense stipple ring
  const dots = [];
  for (let i = 0; i < 190; i++) {
    const a = r() * TAU;
    const d = Math.pow(r(), 0.6) * 13;
    dots.push({ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9, r: r.range(0.4, 1.15) });
  }
  const receptacleId = ids.next();
  headKids.push(stippleShape({ name: 'Receptacle', id: receptacleId, dots, color: INK }));
  // invisible hit area for hover + click
  const hitId = ids.next();
  headKids.push(el('Shape', { name: 'Hit', id: hitId }, [el('Ellipse', { width: 230, height: 230, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));

  kids.push(el('Node', { name: 'Head', x: 30, y: -430, id: headId }, headKids.reverse()));
  s.add(el('Node', { name: 'Plant', x: 196, y: 628, id: plantId }, kids.reverse()));

  // annotation arrow, swept in after the plant finishes drawing
  const arrowTrim = ids.next();
  const arrowFx = ids.next();
  s.add(el('GroupEffect', { name: 'ArrowDraw', id: arrowFx }, el('TrimPath', { start: 0, end: 0, id: arrowTrim, name: 'Trim' })));
  s.add(inkShape({ name: 'Arrow', pts: [P(70, 418), P(78, 380), P(100, 340), P(132, 305), P(148, 292)], color: INK, width: 1.4, effect: arrowFx }));
  s.add(inkShape({ name: 'ArrowHead', pts: [P(133, 290), P(149, 291), P(143, 306)], tension: 0.2, color: INK, width: 1.4, effect: arrowFx }));

  // --- intro: stem draws, seeds pop out from the centre in a ripple, arrow sweeps
  const introTracks = [{ object: stemTrim, prop: 'end', keys: [[0, 0, 'cubic', EASE.out], [70, 1]] }];
  seedNodes.forEach((sd, i) => {
    const d = 40 + Math.round(((sd.a + Math.PI) / TAU) * 40) + (i % 5);
    for (const prop of ['scaleX', 'scaleY']) introTracks.push({ object: sd.shapeId, prop, keys: [[0, 0, 'hold'], [d, 0, 'cubic', EASE.back], [d + 26, 1]] });
  });
  introTracks.push({ object: arrowTrim, prop: 'end', keys: [[0, 0, 'hold'], [110, 0, 'cubic', EASE.out], [160, 1]] });
  const intro = s.anim({ name: 'Intro', duration: 160, tracks: introTracks });
  s.loopLayer('Intro', intro);

  // --- idle: the whole plant leans in a breeze
  const sway = s.anim({
    name: 'Sway', duration: 420, loop: 'pingPong',
    tracks: [{ object: plantId, prop: 'rotation', keys: [[0, -0.018, 'cubic', EASE.inOut], [420, 0.022]] }],
  });
  s.loopLayer('Sway', sway);
  s.loopLayer('Leaf boil', leafBoil.animId);

  // --- hover: the head trembles like it's holding its breath
  const hover = s.input('bool', 'hover', 0);
  const still = s.anim({ name: 'Still', duration: 1, tracks: [{ object: headId, prop: 'rotation', keys: [[0, 0]] }] });
  const tremble = s.anim({
    name: 'Tremble', duration: 24, loop: 'loop',
    tracks: [{ object: headId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [6, 0.03, 'cubic', EASE.inOut], [12, -0.004, 'cubic', EASE.inOut], [18, 0.026, 'cubic', EASE.inOut], [24, 0]] }],
  });
  s.boolLayer('Hover', hover, still, tremble, { mixIn: 300, mixOut: 600 });

  // --- wish: a gust carries off a handful of seeds, then the clock regrows
  const wish = s.input('trigger', 'wish');
  const flyers = seedNodes.filter((sd, i) => i % 3 !== 0 && Math.cos(sd.a) > -0.4);
  const wishTracks = [];
  const fr = rng(77);
  flyers.forEach((sd, i) => {
    const d = Math.round(i * 1.6 + fr.range(0, 8));
    const end = d + Math.round(fr.range(180, 250));
    // drift in head space (parent of the seed node), up and to the right, with flutter
    const tx = fr.range(260, 520);
    const ty = -fr.range(180, 420);
    const wob = fr.range(18, 40);
    wishTracks.push({ object: sd.nodeId, prop: 'x', keys: [[d, 0, 'cubic', [0.5, 0, 0.6, 1]], [end, tx], [end + 1, 0, 'hold'], [400, 0]] });
    wishTracks.push({ object: sd.nodeId, prop: 'y', keys: [[d, 0, 'cubic', EASE.inOut], [Math.round((d + end) / 2), ty * 0.45 + wob, 'cubic', EASE.inOut], [end, ty], [end + 1, 0, 'hold'], [400, 0]] });
    wishTracks.push({ object: sd.nodeId, prop: 'rotation', keys: [[d, sd.a, 'cubic', EASE.inOut], [end, sd.a - fr.range(0.6, 1.6)], [end + 1, sd.a, 'hold'], [400, sd.a]] });
    wishTracks.push({ object: sd.nodeId, prop: 'opacity', keys: [[0, 1, 'hold'], [end - 70, 1, 'cubic', EASE.in], [end, 0], [end + 1, 0, 'hold'], [320, 0, 'cubic', EASE.out], [400, 1]] });
    for (const prop of ['scaleX', 'scaleY']) wishTracks.push({ object: sd.nodeId, prop, keys: [[end + 1, 0.2, 'hold'], [320, 0.2, 'cubic', EASE.back], [400, 1]] });
  });
  // the head nods back as if blown
  wishTracks.push({ object: headId, prop: 'x', keys: [[0, 30, 'cubic', EASE.out], [14, 37, 'cubic', EASE.inOut], [60, 30]] });
  const wishAnim = s.anim({ name: 'Wish', duration: 400, tracks: wishTracks });
  s.triggerLayer('Wish', wish, wishAnim, { fromAny: false, mix: 0 });

  s.listen(hitId, 'enter', [Scene.setBool(hover, true)]);
  s.listen(hitId, 'exit', [Scene.setBool(hover, false)]);
  s.listen(hitId, 'click', [Scene.fire(wish), Scene.setBool(hover, false)]);
  return s.toXml();
}

// ---------------------------------------------------------------- name swash

function swash(ids) {
  const s = new Scene(ids, { name: 'Swash', w: 720, h: 60, x: 500, y: 0 });
  const r = rng(12);
  const trim = ids.next();
  const fx = ids.next();
  s.add(el('GroupEffect', { name: 'Draw', id: fx }, el('TrimPath', { end: 0, id: trim, name: 'Trim' })));
  const pts = [P(8, 38), P(120, 30), P(260, 33), P(420, 27), P(560, 30), P(650, 24), P(700, 14), P(668, 30), P(600, 44)];
  const b = boil(s, {
    name: 'Line', seed: 4, hold: 8,
    draw: (rr) => [inkShape({ pts: jitterPts(pts, 0.9, rr), color: INK, width: 2.2, bleed: 0.2, effect: fx })],
  });
  s.add(b.xml);
  void r;
  const draw = s.anim({ name: 'Draw', duration: 80, tracks: [{ object: trim, prop: 'end', keys: [[0, 0, 'hold'], [20, 0, 'cubic', [0.6, 0.05, 0.2, 1]], [80, 1]] }] });
  s.loopLayer('Draw', draw);
  s.loopLayer('Boil', b.animId);
  return s.toXml();
}

// ---------------------------------------------------------------- margin doodles

/**
 * One 120x120 doodle: an ink drawing that draws itself in, boils, sits on a dab
 * of watercolor, and does a small trick when poked.
 * `parts` returns [{ name, pts, closed, tension, width }] in doodle space.
 * `trick(ctx)` returns animation tracks for the poke, using node ids it created.
 */
function doodle(ids, { name, x, wash, parts, extra, trick, idle }) {
  const s = new Scene(ids, { name, w: 120, h: 120, x, y: 700, clip: false, bg: process.env.PREVIEW_BG });
  const r = rng(name.length * 97);
  const trim = ids.next();
  const fx = ids.next();
  s.add(el('GroupEffect', { name: 'Draw', id: fx }, el('TrimPath', { end: 0, id: trim, name: 'Trim' })));

  const washId = ids.next();
  s.add(el('Node', { name: 'WashBloom', x: wash.x, y: wash.y, id: washId, scaleX: 0.4, scaleY: 0.4, opacity: 0 }, watercolor({ rx: wash.rx, ry: wash.ry, color: wash.color, seed: r() * 1e6 | 0, alpha: 0.55 })));

  const rigId = ids.next();
  const ctx = { ids, s, fx, rigId, r, extraIds: {} };
  const drawPart = (rr, p) => inkShape({ name: p.name, pts: jitterPts(p.pts, p.jit ?? 0.9, rr), closed: p.closed, tension: p.tension ?? 1, color: p.color || INK, width: p.width ?? 1.6, bleed: 0.16, effect: p.noTrim ? undefined : fx });
  const b = boil(s, { name: 'Ink', seed: r() * 1e6 | 0, hold: 8, draw: (rr) => parts.map((p) => drawPart(rr, p)) });
  const rigKids = [b.xml];
  if (extra) rigKids.push(...[].concat(extra(ctx, drawPart)));
  s.add(el('Node', { name: 'Rig', x: 60, y: 60, id: rigId }, [...rigKids].reverse().map((k) => k)));
  s.loopLayer('Boil', b.animId);

  const intro = s.anim({
    name: 'Intro', duration: 110,
    tracks: [
      { object: trim, prop: 'end', keys: [[0, 0, 'cubic', [0.55, 0.05, 0.25, 1]], [75, 1]] },
      { object: washId, prop: 'opacity', keys: [[0, 0, 'hold'], [50, 0, 'cubic', EASE.out], [110, 1]] },
      { object: washId, prop: 'scaleX', keys: [[0, 0.4, 'hold'], [50, 0.4, 'cubic', EASE.out], [110, 1]] },
      { object: washId, prop: 'scaleY', keys: [[0, 0.4, 'hold'], [50, 0.4, 'cubic', EASE.out], [110, 1]] },
    ],
  });
  s.loopLayer('Intro', intro);
  if (idle) for (const spec of [].concat(idle(ctx))) s.loopLayer(spec.name, s.anim(spec));

  const poke = s.input('trigger', 'poke');
  const t = trick(ctx);
  const pokeAnim = s.anim({ name: 'Poke', duration: t.duration, tracks: t.tracks });
  s.triggerLayer('Poke', poke, pokeAnim, { fromAny: false, mix: 0 });

  const hit = ids.next();
  s.add(el('Shape', { name: 'Hit', id: hit, x: 60, y: 60 }, [el('Rectangle', { width: 120, height: 120, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
  s.listen(hit, 'enter', [Scene.fire(poke)]);
  return s.toXml();
}

const wiggle = (obj, amt = 0.14, len = 50) => ({
  object: obj, prop: 'rotation',
  keys: [[0, 0, 'cubic', EASE.out], [len * 0.2, amt, 'cubic', EASE.inOut], [len * 0.45, -amt * 0.7, 'cubic', EASE.inOut], [len * 0.7, amt * 0.35, 'cubic', EASE.inOut], [len, 0]],
});

function cup(ids) {
  const steamA = ids.next();
  return doodle(ids, {
    name: 'Cup', x: 0,
    wash: { x: 58, y: 80, rx: 30, ry: 20, color: 'C9A15A' },
    parts: [
      { name: 'body', pts: [P(-25, -5), P(-23, 22), P(-14, 33), P(14, 33), P(23, 22), P(25, -5)], tension: 0.8 },
      { name: 'rim', pts: blobPts(25, 6, rng(5), { n: 8, wobble: 0.04 }).map((p) => P(p.x, p.y - 5)), closed: true },
      { name: 'handle', pts: [P(24, 3), P(35, 4), P(37, 14), P(24, 22)] },
      { name: 'saucer', pts: [P(-36, 36), P(-20, 41), P(20, 41), P(36, 35)] },
    ],
    extra: (ctx, drawPart) => {
      const b = boil(ctx.s, {
        name: 'Steam', seed: 9, hold: 6,
        draw: (rr) => [
          drawPart(rr, { pts: [P(-8, -16), P(-12, -26), P(-6, -36), P(-10, -46)], width: 1.2, jit: 1.4 }),
          drawPart(rr, { pts: [P(7, -15), P(11, -25), P(5, -34), P(9, -44)], width: 1.2, jit: 1.4 }),
        ],
      });
      ctx.s.loopLayer('Steam boil', b.animId);
      return el('Node', { name: 'SteamRig', id: steamA }, b.xml);
    },
    idle: () => ({
      name: 'Steam rise', duration: 150, loop: 'loop',
      tracks: [
        { object: steamA, prop: 'y', keys: [[0, 2, 'linear'], [150, -6]] },
        { object: steamA, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [40, 0.9, 'linear'], [110, 0.8, 'cubic', EASE.in], [150, 0]] },
      ],
    }),
    trick: (ctx) => ({ duration: 50, tracks: [wiggle(ctx.rigId, 0.1, 50)] }),
  });
}

function star(ids) {
  const pts = [];
  const order = [0, 2, 4, 1, 3, 0];
  order.forEach((k, i) => {
    const a = -Math.PI / 2 + (k * TAU) / 5;
    const rr = 36 - (i === order.length - 1 ? 3 : 0);
    pts.push(P(Math.cos(a) * rr, Math.sin(a) * rr));
  });
  pts.push(P(pts[pts.length - 1].x + 9, pts[pts.length - 1].y + 6));
  return doodle(ids, {
    name: 'Star', x: 140,
    wash: { x: 60, y: 62, rx: 30, ry: 28, color: 'E8C547' },
    parts: [{ name: 'star', pts: resample(pts, 28), tension: 0.35, width: 1.7, jit: 0.7 }],
    trick: (ctx) => ({
      duration: 70,
      tracks: [
        { object: ctx.rigId, prop: 'rotation', keys: [[0, 0, 'cubic', [0.3, 0, 0.2, 1]], [70, TAU / 5]] },
        { object: ctx.rigId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.out], [14, 1.14, 'cubic', EASE.inOut], [70, 1]] },
        { object: ctx.rigId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [14, 1.14, 'cubic', EASE.inOut], [70, 1]] },
      ],
    }),
  });
}

function snail(ids) {
  const spiral = [];
  for (let t = 0; t <= 4.3 * Math.PI; t += 0.35) spiral.push(P(-6 + Math.cos(t) * (2 + t * 2.1), -2 + Math.sin(t) * (2 + t * 2.1)));
  const stalks = ids.next();
  return doodle(ids, {
    name: 'Snail', x: 280,
    wash: { x: 52, y: 58, rx: 28, ry: 26, color: '8FAF7E' },
    parts: [
      { name: 'shell', pts: spiral, width: 1.5, jit: 0.5 },
      { name: 'body', pts: [P(-38, 26), P(-10, 28), P(20, 27), P(36, 18), P(40, 6), P(32, 4), P(26, 14)], tension: 0.7 },
    ],
    extra: (ctx, drawPart) => {
      const b = boil(ctx.s, {
        name: 'Stalks', seed: 6, hold: 8,
        draw: (rr) => [
          drawPart(rr, { pts: [P(0, 0), P(2, -10), P(4, -18)], width: 1.3, jit: 0.6 }),
          drawPart(rr, { pts: [P(4, 0), P(10, -8), P(14, -15)], width: 1.3, jit: 0.6 }),
        ],
      });
      ctx.s.loopLayer('Stalk boil', b.animId);
      ctx.extraIds.stalks = stalks;
      return el('Node', { name: 'StalkRig', x: 32, y: 6, id: stalks }, b.xml);
    },
    trick: (ctx) => ({
      duration: 90,
      tracks: [
        { object: stalks, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [10, 0.2, 'hold'], [45, 0.2, 'cubic', EASE.back], [70, 1]] },
        { object: ctx.rigId, prop: 'x', keys: [[0, 60, 'cubic', EASE.inOut], [40, 65, 'cubic', EASE.inOut], [90, 60]] },
      ],
    }),
  });
}

function quill(ids) {
  // feather: a curved spine, an asymmetric vane outline with a couple of splits, and a nib
  const spine = [P(-30, 40), P(-10, 16), P(10, -10), P(30, -38)];
  const S = resample(spine, 20);
  const nrm = (i) => {
    const a = S[Math.max(0, i - 1)];
    const b = S[Math.min(S.length - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    return P(-(b.y - a.y) / l, (b.x - a.x) / l);
  };
  const left = [];
  const right = [];
  for (let i = 5; i < 20; i++) {
    const t = (i - 5) / 14;
    const w = Math.sin(Math.PI * Math.pow(t, 0.75)) * 13 + 1;
    const n = nrm(i);
    left.push(P(S[i].x + n.x * w * 1.15, S[i].y + n.y * w * 1.15));
    right.push(P(S[i].x - n.x * w * 0.8, S[i].y - n.y * w * 0.8));
  }
  const vane = [S[5], ...left.slice(1, 9), P(left[9].x - 3, left[9].y + 1), ...left.slice(9), S[19], ...right.slice(1).reverse(), S[5]];
  const barbs = [7, 10, 13, 16].map((i, k) => {
    const n = nrm(i);
    const w = k % 2 ? -8 : 10;
    return { name: 'barb', pts: [S[i], P(S[i].x + n.x * w + 3, S[i].y + n.y * w - 4)], width: 0.8, jit: 0.3, tension: 0.6, color: INK_SOFT };
  });
  const scribTrim = ids.next();
  return doodle(ids, {
    name: 'Quill', x: 420,
    wash: { x: 66, y: 52, rx: 26, ry: 30, color: '6F9CC4' },
    parts: [{ name: 'spine', pts: spine, width: 1.5 }, { name: 'vane', pts: vane, closed: true, tension: 0.55, width: 1.4, jit: 0.6 }, { name: 'nib', pts: [P(-30, 40), P(-33, 46)], width: 1.8 }, ...barbs],
    extra: (ctx) => {
      const fx2 = ctx.ids.next();
      ctx.s.add(el('GroupEffect', { name: 'Scribble', id: fx2 }, el('TrimPath', { end: 0, id: scribTrim, name: 'Trim' })));
      const pts = [];
      for (let i = 0; i <= 18; i++) pts.push(P(-44 + i * 3.4, 46 + Math.sin(i * 1.3) * 3 - (i % 2) * 1.5));
      return inkShape({ name: 'Scribble', pts, color: INK, width: 1.1, bleed: 0.1, effect: fx2 });
    },
    trick: (ctx) => ({
      duration: 120,
      tracks: [
        wiggle(ctx.rigId, 0.08, 60),
        { object: scribTrim, prop: 'end', keys: [[0, 0, 'linear'], [60, 1, 'hold'], [120, 1]] },
        { object: scribTrim, prop: 'start', keys: [[0, 0, 'hold'], [70, 0, 'cubic', EASE.inOut], [118, 1, 'hold'], [120, 0]] },
      ],
    }),
  });
}

function plane(ids) {
  return doodle(ids, {
    name: 'Plane', x: 560,
    wash: { x: 54, y: 62, rx: 30, ry: 22, color: 'D98C8C' },
    parts: [
      { name: 'outline', pts: [P(36, -16), P(-38, -24), P(-12, -4), P(-22, 24), P(36, -16)], tension: 0.15, width: 1.6, jit: 0.6 },
      { name: 'fold', pts: [P(-12, -4), P(36, -16)], tension: 0.2, width: 1.1, jit: 0.4 },
      { name: 'trail', pts: [P(-24, 28), P(-34, 32), P(-40, 26), P(-34, 20), P(-29, 28), P(-46, 42)], width: 0.9, color: INK_SOFT },
    ],
    extra: () => [],
    idle: (ctx) => ({ name: 'Bob', duration: 180, loop: 'pingPong', tracks: [{ object: ctx.rigId, prop: 'y', keys: [[0, 58, 'cubic', EASE.inOut], [180, 63]] }] }),
    trick: (ctx) => {
      // a loop-the-loop around a circle, then home
      const xs = [], ys = [], rs = [];
      const N = 12;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const a = Math.PI / 2 - t * TAU;
        const f = Math.round(t * 80);
        xs.push([f, 60 + Math.cos(a) * 26, 'linear']);
        ys.push([f, 34 + Math.sin(a) * 26, 'linear']);
        rs.push([f, -t * TAU, 'linear']);
      }
      return { duration: 80, tracks: [{ object: ctx.rigId, prop: 'x', keys: xs }, { object: ctx.rigId, prop: 'y', keys: ys }, { object: ctx.rigId, prop: 'rotation', keys: rs }] };
    },
  });
}

function envelope(ids) {
  const flapId = ids.next();
  const heartId = ids.next();
  return doodle(ids, {
    name: 'Envelope', x: 700,
    wash: { x: 62, y: 66, rx: 34, ry: 22, color: 'D9895B' },
    parts: [
      { name: 'box', pts: [P(-36, -18), P(36, -20), P(38, 26), P(-37, 27), P(-36, -18)], tension: 0.12, width: 1.6, jit: 0.6 },
      { name: 'v', pts: [P(-36, 27), P(0, 4), P(38, 26)], tension: 0.25, width: 1, jit: 0.5, color: INK_SOFT },
    ],
    extra: (ctx, drawPart) => {
      const flap = boil(ctx.s, { name: 'Flap', seed: 2, hold: 8, draw: (rr) => [drawPart(rr, { pts: [P(-36, 0), P(0, 24), P(36, -2)], tension: 0.25, width: 1.5, jit: 0.6 })] });
      ctx.s.loopLayer('Flap boil', flap.animId);
      const heart = [P(0, 8), P(-9, -1), P(-8, -8), P(-3, -9), P(0, -4), P(3, -9), P(8, -8), P(9, -1)];
      return [
        el('Node', { name: 'Heart', id: heartId, y: 0, opacity: 0 }, [washShape({ pts: heart, color: 'C9483C', alpha: 0.8, tension: 0.8 }), inkShape({ pts: heart, closed: true, tension: 0.8, color: INK, width: 1.1, bleed: 0 })].reverse()),
        el('Node', { name: 'FlapRig', y: -19, id: flapId }, flap.xml),
      ];
    },
    trick: () => ({
      duration: 130,
      tracks: [
        { object: flapId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [18, -1, 'hold'], [100, -1, 'cubic', EASE.inOut], [124, 1]] },
        { object: heartId, prop: 'opacity', keys: [[0, 0, 'hold'], [14, 0, 'cubic', EASE.out], [26, 1, 'hold'], [80, 1, 'cubic', EASE.in], [104, 0]] },
        { object: heartId, prop: 'y', keys: [[0, 0, 'hold'], [14, 0, 'cubic', EASE.out], [60, -34, 'cubic', EASE.in], [104, -46]] },
      ],
    }),
  });
}

export default function () {
  const ids = new Ids();
  return document(dandelion(ids), swash(ids), cup(ids), star(ids), snail(ids), quill(ids), plane(ids), envelope(ids));
}
