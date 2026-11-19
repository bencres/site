// Draft 3 · Night plum — sumi-e plum branches that paint themselves in from the
// corners of a dark page, blossoms that open after the brush passes, a moon that
// rises with scroll, and brush-stroke dividers.
//
// Ink here is pale on near-black (an inverted ink painting), so nothing uses the
// multiply blend the paper-toned drafts rely on.
import { Ids, Scene, rng, P, el, argb, pathXml, fill, solid, blobPts, document, EASE, TAU } from '../lib/ink.mjs';

const INK = 'CFC4B8'; // warm moonlit grey
const NIGHT = '121110';
const mix = (a, b, t) => [0, 2, 4].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * t + parseInt(b.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('').toUpperCase();
const PETAL = 'F6DCE0';
const PETAL_DEEP = 'E9B3BE';
const HEART = 'B8475A';
const MOON = 'F1E6CF';

// ---------- branch growth ----------

/**
 * Grows a plum branch as a list of segments. Plum wood is angular: each
 * segment kinks hard, and twigs leave at joints at sharp angles.
 */
function growTree(r, { origin, angle, length, thick, depth, speed = 3.2 }) {
  const segs = [];
  const blooms = [];
  const buds = [];

  function branch(start, ang, len, th, d, t0, bias) {
    const n = Math.max(2, Math.round(len / 55));
    let p = start;
    let t = t0;
    let a = ang;
    for (let i = 0; i < n; i++) {
      a += r.jit(0.45) + bias * 0.12;
      const L = (len / n) * r.range(0.75, 1.25);
      const q = P(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L);
      const f0 = i / n;
      const f1 = (i + 1) / n;
      const w0 = th * (1 - f0 * 0.55);
      const w1 = th * (1 - f1 * 0.55);
      const dur = L / (speed * (0.6 + 0.4 / Math.max(1, th / 3)));
      segs.push({ a: p, b: q, w: (w0 + w1) / 2, t0: t, t1: t + dur });
      // twigs leave from joints
      if (d > 0 && i < n - 1 && r() < 0.7) {
        const side = r() < 0.5 ? -1 : 1;
        branch(q, a + side * r.range(0.5, 1.05), len * r.range(0.4, 0.62), w1 * 0.6, d - 1, t + dur, -side);
      }
      // blossoms cling to thinner wood, buds near tips
      if (th < 7 && r() < 0.55) blooms.push({ x: q.x + r.jit(6), y: q.y + r.jit(6), t: t + dur + r.range(10, 50), s: r.range(0.75, 1.15) });
      else if (th < 4 && r() < 0.5) buds.push({ x: q.x + r.jit(4), y: q.y + r.jit(4), t: t + dur + 10 });
      p = q;
      t += dur;
    }
    if (th < 5) blooms.push({ x: p.x, y: p.y, t: t + 12, s: r.range(0.85, 1.25), tip: true });
    else if (d > 0) {
      branch(p, a + r.jit(0.5), len * 0.55, th * 0.5, d - 1, t, 0);
    }
  }
  branch(origin, angle, length, thick, depth, 0, 0);
  return { segs, blooms, buds };
}

// one segment of wood: soft ink bleed, the brush body, and dry-brush streaks
function segmentXml(ids, seg, r, timeline) {
  const { a, b, w } = seg;
  const mid = P((a.x + b.x) / 2 + r.jit(w * 0.6), (a.y + b.y) / 2 + r.jit(w * 0.6));
  const pts = [a, mid, b];
  const tone = Math.min(0.5, 0.2 + w * 0.02);
  const out = [];
  const trims = [];
  const trimmed = (color, width, extra = []) => {
    const id = ids.next();
    trims.push(id);
    return el('Stroke', { thickness: width, cap: 'round', join: 'round', name: 'S' }, [
      solid(color),
      el('TrimPath', { start: 0, end: 1, name: 'Trim', id }),
      ...extra,
    ]);
  };
  // bleed + body share one path; the body is opaque so overlapping joints stay even
  out.push(
    el('Shape', { name: 'wood' }, [
      pathXml(pts, { tension: 0.7 }),
      trimmed(argb(INK, 0.07), w * 2.2, [el('Feather', { strength: w * 1.2 + 2, name: 'F' })]),
      trimmed('FF' + mix(INK, NIGHT, tone), w),
    ])
  );
  // dry brush: night showing through the bristle gaps of thick strokes
  if (w > 4.5) {
    const nx = -(b.y - a.y);
    const ny = b.x - a.x;
    const nl = Math.hypot(nx, ny) || 1;
    const streaks = w > 9 ? [-0.22, 0.05, 0.3] : [r.jit(0.2)];
    for (const k of streaks) {
      const off = w * k + r.jit(0.6);
      const dash = [r.range(8, 26), r.range(10, 40), r.range(4, 14), r.range(16, 50)];
      out.push(
        el('Shape', { name: 'dry', x: (nx / nl) * off, y: (ny / nl) * off }, [
          pathXml(pts.map((p) => P(p.x + r.jit(0.8), p.y + r.jit(0.8))), { tension: 0.7 }),
          trimmed(argb(NIGHT, r.range(0.45, 0.8)), Math.max(0.8, w * r.range(0.08, 0.16)), [
            el('DashPath', { offset: r.range(0, 30), name: 'Dry' }, dash.map((d) => el('Dash', { length: d, name: 'd' }))),
          ]),
        ])
      );
    }
  }
  for (const id of trims) {
    timeline.push({ object: id, prop: 'end', keys: [[0, 0], [Math.round(seg.t0), 0, 'cubic', [0.3, 0, 0.7, 1]], [Math.round(seg.t1) + 1, 1]] });
  }
  return out;
}

const lighten = (hex) => {
  const c = [0, 2, 4].map((i) => Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * 1.08)));
  return c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
};

// five soft petals, a crimson heart, a few stamens
function blossomXml(ids, r, { scale = 1, rot = 0 }) {
  const kids = [];
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * TAU + r.jit(0.15);
    const d = 6.2 * scale;
    const petal = blobPts(5.4 * scale, 4.6 * scale, r, { n: 7, wobble: 0.12 });
    kids.push(
      el('Shape', { name: 'petal', x: Math.cos(a) * d, y: Math.sin(a) * d, rotation: a }, [
        pathXml(petal, { closed: true }),
        fill(argb(PETAL_DEEP, 0.35), { feather: 2.2 }),
        fill(argb(PETAL, r.range(0.5, 0.68)), { feather: 1 }),
      ])
    );
  }
  const stamens = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + r.jit(0.3);
    const L = r.range(4.5, 7) * scale;
    stamens.push(P(Math.cos(a) * L, Math.sin(a) * L));
  }
  kids.push(
    el('Shape', { name: 'stamens' }, [
      ...stamens.map((p) => el('Ellipse', { x: p.x, y: p.y, width: 1.6 * scale, height: 1.6 * scale, originX: 0.5, originY: 0.5, name: 'd' })),
      fill(argb('E8C78A', 0.85)),
    ]),
    el('Shape', { name: 'heart' }, [
      el('Ellipse', { width: 4.2 * scale, height: 4.2 * scale, originX: 0.5, originY: 0.5, name: 'P' }),
      fill(argb(HEART, 0.9), { feather: 0.8 }),
    ])
  );
  return kids.reverse();
}

function petalXml(r, id, x, y) {
  return el('Shape', { name: 'falling petal', x, y, opacity: 0, id }, [
    pathXml(blobPts(5.6, 4.2, r, { n: 6, wobble: 0.15 }), { closed: true }),
    fill(argb(PETAL_DEEP, 0.45), { feather: 1.6 }),
    fill(argb(PETAL, 0.78), { feather: 0.7 }),
  ]);
}

// a petal letting go: drift, sway, tumble, fade
function fallTrack(r, id, from, start, len, { dist = 260, drift = 60 } = {}) {
  const x0 = from.x;
  const y0 = from.y;
  const dx = r.jit(drift) + drift * 0.4;
  const sway = r.range(10, 22);
  const steps = 4;
  const xs = [];
  const ys = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const t = Math.round(start + f * len);
    xs.push([t, x0 + dx * f + (i % 2 ? sway : -sway) * (i && i < steps ? 1 : 0), 'cubic', EASE.inOut]);
    ys.push([t, y0 + dist * f * f * 0.4 + dist * f * 0.6, 'linear']);
  }
  const spin = r.jit(5);
  return [
    { object: id, prop: 'x', keys: xs },
    { object: id, prop: 'y', keys: ys },
    { object: id, prop: 'rotation', keys: [[start, 0], [start + len, spin]] },
    {
      object: id,
      prop: 'opacity',
      keys: [[0, 0], [start, 0], [start + 18, 0.85], [Math.round(start + len * 0.7), 0.7], [start + len, 0]],
    },
  ];
}

// ---------- artboards ----------

function branchArtboard(ids, { name, x, seed, origin, angle, length, thick, depth }) {
  const W = 620;
  const H = 620;
  const s = new Scene(ids, { name, w: W, h: H, x, y: 0 });
  const r = rng(seed);
  const tree = growTree(r, { origin, angle, length, thick, depth });

  // keep only blossoms that land inside the artboard
  const inside = (b) => b.x > 12 && b.y > 12 && b.x < W - 12 && b.y < H - 12;
  tree.blooms = tree.blooms.filter(inside).slice(0, 17);
  tree.buds = tree.buds.filter(inside).slice(0, 12);

  const grow = [];
  const wood = [];
  // thick wood first (behind), twigs on top
  for (const seg of [...tree.segs].sort((a, b) => b.w - a.w)) wood.push(...segmentXml(ids, seg, r, grow));

  const flowers = [];
  const bloomIds = [];
  for (const b of tree.blooms) {
    const id = ids.next();
    const rot = r.range(0, TAU);
    bloomIds.push({ id, b, rot });
    flowers.push(el('Node', { name: 'blossom', x: b.x, y: b.y, rotation: rot, id }, blossomXml(ids, r, { scale: b.s, rot: 0 })));
    const t = Math.round(b.t);
    grow.push(
      { object: id, prop: 'scaleX', keys: [[0, 0], [t, 0, 'cubic', EASE.back], [t + 46, 1]] },
      { object: id, prop: 'scaleY', keys: [[0, 0], [t, 0, 'cubic', EASE.back], [t + 46, 1]] },
      { object: id, prop: 'opacity', keys: [[0, 0], [t, 0, 'cubic', EASE.out], [t + 30, 1]] },
      { object: id, prop: 'rotation', keys: [[0, rot - 0.5], [t, rot - 0.5, 'cubic', EASE.out], [t + 60, rot]] }
    );
  }
  for (const b of tree.buds) {
    const id = ids.next();
    flowers.push(
      el('Shape', { name: 'bud', x: b.x, y: b.y, id }, [
        pathXml(blobPts(2.6, 3.2, r, { n: 6, wobble: 0.1 }), { closed: true }),
        fill(argb(HEART, 0.85), { feather: 0.6 }),
      ])
    );
    const t = Math.round(b.t);
    grow.push({ object: id, prop: 'opacity', keys: [[0, 0], [t, 0], [t + 24, 1]] });
  }

  const introLen = Math.round(Math.max(...grow.flatMap((g) => g.keys.map((k) => k[0])))) + 10;
  if (process.env.PLUM_DEBUG) console.error(name, 'intro frames', introLen);
  const intro = s.anim({ name: 'Grow', duration: introLen, tracks: grow });

  // the whole tree sways about its corner, imperceptibly
  const treeId = ids.next();
  const sway = s.anim({
    name: 'Sway',
    duration: 540,
    loop: 'pingPong',
    tracks: [{ object: treeId, prop: 'rotation', keys: [[0, -0.006, 'cubic', EASE.inOut], [540, 0.008]] }],
  });

  // ambient petal fall, sourced from random blossoms
  const ambientPetals = [];
  const fall = [];
  const LOOP = 1080;
  for (let i = 0; i < 6; i++) {
    const id = ids.next();
    const src = r.pick(bloomIds).b;
    ambientPetals.push(petalXml(r, id, src.x, src.y));
    const len = Math.round(r.range(380, 520));
    const start = Math.round((i / 6) * (LOOP - len) + r.range(0, 60));
    fall.push(...fallTrack(r, id, src, start, len));
  }
  const fallAnim = s.anim({ name: 'Petals', duration: LOOP, loop: 'loop', tracks: fall });
  const wait = s.anim({ name: 'Wait', duration: introLen, tracks: [] });

  // interactive blossoms: brush one (or click the page) and it sheds
  const shedPetals = [];
  const hits = [];
  const interactive = [...bloomIds].sort((a, b) => b.b.s - a.b.s).slice(0, 6);
  interactive.forEach(({ id: bid, b, rot }, k) => {
    const trig = s.input('trigger', `shed${k}`);
    const tracks = [
      { object: bid, prop: 'rotation', keys: [[0, rot, 'cubic', EASE.out], [8, rot + 0.22, 'cubic', EASE.inOut], [22, rot - 0.12, 'cubic', EASE.inOut], [40, rot]] },
    ];
    for (let j = 0; j < 4; j++) {
      const pid = ids.next();
      shedPetals.push(petalXml(r, pid, b.x, b.y));
      tracks.push(...fallTrack(r, pid, b, 2 + j * 7, Math.round(r.range(170, 230)), { dist: 180, drift: 40 }));
    }
    const react = s.anim({ name: `Shed ${k}`, duration: 260, tracks });
    s.triggerLayer(`shed ${k}`, trig, react, { mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: b.x, y: b.y, id: hid }, [el('Ellipse', { width: 34, height: 34, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });

  s.add(el('Node', { name: 'tree', x: 0, y: 0, id: treeId }, [...flowers.reverse(), ...wood.reverse()]));
  s.add(...ambientPetals, ...shedPetals, ...hits);
  s.loopLayer('grow', intro);
  s.loopLayer('sway', sway);
  s.sequenceLayer('petals', [wait, fallAnim]);
  return s.toXml();
}

function moonArtboard(ids) {
  const s = new Scene(ids, { name: 'Moon', w: 420, h: 420, x: 1360, y: 0 });
  const r = rng(77);
  const moonId = ids.next();
  const haloId = ids.next();
  const mistId = ids.next();
  const mistOpId = ids.next();

  const maria = [];
  for (let i = 0; i < 5; i++) {
    maria.push(
      el('Shape', { name: 'mare', x: r.jit(26), y: r.jit(26) }, [
        pathXml(blobPts(r.range(8, 18), r.range(6, 14), r, { n: 8, wobble: 0.2 }), { closed: true }),
        fill(argb('9C8F7C', 0.16), { feather: 5 }),
      ])
    );
  }
  const moon = el('Node', { name: 'moon', x: 230, y: 262, id: moonId }, [
    ...maria,
    el('Shape', { name: 'disc' }, [el('Ellipse', { width: 112, height: 112, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb(MOON, 0.22), { feather: 2 })]),
    el('Shape', { name: 'glow' }, [el('Ellipse', { width: 150, height: 150, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb(MOON, 0.06), { feather: 22 })]),
    el('Shape', { name: 'halo', id: haloId }, [el('Ellipse', { width: 200, height: 200, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb(MOON, 0.045), { feather: 38 })]),
  ]);

  const bands = [];
  for (let i = 0; i < 4; i++) {
    bands.push(
      el('Shape', { name: 'mist', x: r.range(180, 240), y: 190 + i * 40 + r.jit(10) }, [
        pathXml(blobPts(r.range(70, 110), r.range(7, 12), r, { n: 10, wobble: 0.18 }), { closed: true }),
        fill(argb('B9B2A6', r.range(0.05, 0.09)), { feather: 14 }),
      ])
    );
  }
  const mist = el('Node', { name: 'mist', id: mistId }, [el('Node', { name: 'mistFade', id: mistOpId }, bands)]);
  s.add(moon, mist);

  // scroll scrubs the moon up the sky and the mist sideways
  const scroll = s.input('number', 'scroll', 0);
  const low = s.anim({ name: 'Low', duration: 1, tracks: [
    { object: moonId, prop: 'y', keys: [[0, 262]] },
    { object: mistId, prop: 'x', keys: [[0, -25]] },
  ] });
  const high = s.anim({ name: 'High', duration: 1, tracks: [
    { object: moonId, prop: 'y', keys: [[0, 165]] },
    { object: mistId, prop: 'x', keys: [[0, 30]] },
  ] });
  s.blendLayer('scroll', scroll, [{ anim: low, value: 0 }, { anim: high, value: 100 }]);

  const breathe = s.anim({ name: 'Breathe', duration: 600, loop: 'pingPong', tracks: [
    { object: haloId, prop: 'opacity', keys: [[0, 0.7, 'cubic', EASE.inOut], [600, 1]] },
    { object: mistOpId, prop: 'opacity', keys: [[0, 1, 'cubic', EASE.inOut], [600, 0.55]] },
    { object: mistOpId, prop: 'x', keys: [[0, -12, 'cubic', EASE.inOut], [600, 12]] },
  ] });
  const rise = s.anim({ name: 'Rise', duration: 120, tracks: [
    { object: moonId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [120, 1]] },
  ] });
  s.loopLayer('breathe', breathe);
  s.loopLayer('rise', rise);
  return s.toXml();
}

// a single brush stroke: three trims of falling width stack into a taper
function dividerArtboard(ids) {
  const s = new Scene(ids, { name: 'Divider', w: 240, h: 40, x: 1820, y: 0 });
  const r = rng(12);
  const pts = [P(28, 22), P(80, 18 + r.jit(1)), P(150, 20 + r.jit(1)), P(212, 17)];
  const tracks = [];
  const layers = [
    { w: 5.5, end: 0.38, a: 0.55, feather: 1.2 },
    { w: 3, end: 0.7, a: 0.5 },
    { w: 1.3, end: 1, a: 0.55 },
  ];
  const shapes = layers.map((L, i) => {
    const tid = ids.next();
    tracks.push({ object: tid, prop: 'end', keys: [[0, 0], [8, 0, 'cubic', [0.5, 0, 0.3, 1]], [8 + Math.round(70 * L.end) + 6, L.end]] });
    const kids = [solid(argb(INK, L.a)), el('TrimPath', { start: 0, end: L.end, name: 'Trim', id: tid })];
    if (L.feather) kids.push(el('Feather', { strength: L.feather, name: 'F' }));
    return el('Shape', { name: `brush${i}`, y: i * 0.4 }, [pathXml(pts.map((p) => P(p.x, p.y + r.jit(0.6))), { tension: 0.9 }), el('Stroke', { thickness: L.w, cap: 'round', name: 'S' }, kids)]);
  });
  const dotId = ids.next();
  const dot = el('Shape', { name: 'dot', x: 226, y: 15, opacity: 0, id: dotId }, [
    el('Ellipse', { width: 3.6, height: 3.4, originX: 0.5, originY: 0.5, name: 'P' }),
    fill(argb(HEART, 0.85), { feather: 0.5 }),
  ]);
  tracks.push({ object: dotId, prop: 'opacity', keys: [[0, 0], [88, 0, 'cubic', EASE.out], [104, 1]] });
  s.add(...shapes, dot);
  s.loopLayer('draw', s.anim({ name: 'Draw', duration: 110, tracks }));
  return s.toXml();
}

export default function () {
  const ids = new Ids(10);
  return document(
    branchArtboard(ids, { name: 'BranchTL', x: 0, seed: 21, origin: P(-30, 120), angle: 0.42, length: 430, thick: 15, depth: 3 }),
    branchArtboard(ids, { name: 'BranchBR', x: 680, seed: 8, origin: P(650, 540), angle: Math.PI + 0.5, length: 430, thick: 14, depth: 3 }),
    moonArtboard(ids),
    dividerArtboard(ids)
  );
}
