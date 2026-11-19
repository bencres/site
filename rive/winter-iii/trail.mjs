// The walk: a far treeline fixed at the foot of the page, and five landmarks
// laid into the page flow between sections (creek, cabin, fence, lake, snag).
// Each draws itself on as it scrolls into view, then lives quietly.
import { Scene, rng, P, el, argb, pathXml, fill, stroke, blobPts, resample, inkShape, washShape, EASE } from '../lib/ink.mjs';
import { INK, SHADOW, FIR, SPRUCE, BG, ink, appear, trimIn, drawnLine, ticks, snowCap, drift, coniferAuto, gatherTracks, printShape } from './kit.mjs';
import { fox, foxTrot, hare, squirrel, squirrelRun, raven, woodpecker, peckKeys, chips, flock, flockFlight, swingKeys, tidy } from './critters.mjs';

const hit = (ids, x, y, w, h, name = 'hit') => {
  const id = ids.next();
  return { id, xml: el('Shape', { name, x, y, id }, [el('Ellipse', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]) };
};

// a far spruce: a jagged silhouette wash, no ink
function paleSpruce(r, x, base, h, w, color, alpha) {
  const pts = [P(x - w * 0.5, base)];
  const tiers = Math.max(3, Math.round(h / 18));
  for (let i = 0; i < tiers; i++) {
    const f = i / tiers;
    const y = base - h * f;
    const ww = w * (1 - f) * 0.5 + 1;
    pts.push(P(x - ww + r.jit(1.5), y - r.range(0, 3)), P(x - ww * 0.55 + r.jit(1), y - h / tiers * 0.6));
  }
  pts.push(P(x + r.jit(1), base - h - r.range(2, 6)));
  for (let i = tiers - 1; i >= 0; i--) {
    const f = i / tiers;
    const y = base - h * f;
    const ww = w * (1 - f) * 0.5 + 1;
    pts.push(P(x + ww * 0.55 + r.jit(1), y - h / tiers * 0.6), P(x + ww + r.jit(1.5), y - r.range(0, 3)));
  }
  pts.push(P(x + w * 0.5, base));
  return el('Shape', { name: 'far', blendModeValue: 'multiply' }, [pathXml(pts, { closed: true, tension: 0.25 }), fill(argb(color, alpha), { feather: 1.4 })]);
}

function treelineRow(r, { x0, x1, base, hMin, hMax, color, alpha, gap = 22 }) {
  const out = [];
  for (let x = x0; x < x1; x += gap * r.range(0.6, 1.4)) {
    const h = r.range(hMin, hMax);
    out.push(paleSpruce(r, x, base + r.jit(3), h, h * r.range(0.3, 0.45), color, alpha * r.range(0.8, 1.15)));
  }
  return out;
}

// four-point ice glint
function glint(ids, x, y, s = 1) {
  const id = ids.next();
  const star = [P(0, -6), P(1.2, -1.2), P(6, 0), P(1.2, 1.2), P(0, 6), P(-1.2, 1.2), P(-6, 0), P(-1.2, -1.2)];
  return { id, xml: el('Shape', { name: 'glint', x, y, scaleX: s, scaleY: s, opacity: 0, id }, [pathXml(star, { closed: true, tension: 0 }), fill(argb('FFFFFF', 0.95)), stroke(argb('BFD2E2', 0.6), 0.6, { feather: 1 })]) };
}

// twinkle keys: a few glints sparkle one after another inside [t0, t1]
function twinkleTracks(glints, t0, t1, r) {
  const tracks = [];
  glints.forEach((g, i) => {
    const t = Math.round(t0 + ((i + r.range(0.1, 0.8)) / glints.length) * (t1 - t0));
    tracks.push(
      { object: g.id, prop: 'opacity', keys: [[0, 0, 'hold'], [t, 0, 'cubic', EASE.out], [t + 14, 1, 'cubic', EASE.inOut], [t + 40, 0, 'hold']] },
      { object: g.id, prop: 'rotation', keys: [[t, -0.3, 'cubic', EASE.inOut], [t + 40, 0.3]] },
    );
  });
  return tracks;
}

// glints that come on under the pointer, plus a rare twinkle on their own
function glintLayer(s, ids, r, spots) {
  const groupId = ids.next();
  const gl = spots.map(([x, y, k]) => glint(ids, x, y, k));
  const xml = el('Node', { name: 'glints', id: groupId }, gl.map((g) => g.xml));
  const over = s.input('bool', 'glint', false);
  const off = s.anim({ name: 'Glint off', duration: 1, tracks: [] });
  const LOOP = 420;
  const on = s.anim({ name: 'Glint on', duration: LOOP, loop: 'loop', tracks: gl.map((g, i) => ({ object: g.id, prop: 'opacity', keys: swingKeys(0, LOOP, 50 + i * 9, 0.45, i % 2, 0.5) })) });
  s.boolLayer('glint', over, off, on, { mixIn: 90, mixOut: 400 });
  return { xml, gl, groupId, over };
}

// a drift mound in front of something
const mound = (r, x, y, rx, ry) => el('Node', { name: 'mound' }, [
  el('Shape', { name: 'shade', x: x + 2, y: y + 3 }, [pathXml(blobPts(rx, ry, r, { n: 9, wobble: 0.1 }), { closed: true }), fill(argb(SHADOW, 0.35), { feather: 6 })]),
  el('Shape', { name: 'snow', x, y }, [pathXml(blobPts(rx, ry, r, { n: 9, wobble: 0.08 }), { closed: true }), fill(argb('FFFFFF', 1))]),
  el('Shape', { name: 'edge', x, y }, [pathXml(blobPts(rx, ry, r, { n: 9, wobble: 0.08 }).slice(4, 9), { tension: 0.8 }), stroke(argb('7F97AB', 0.5), 0.7)]),
].reverse());

// snowshoe print: a long oval dimple with a few webbing ticks
function snowshoePrint(r, x, y, rot, k = 1) {
  return el('Node', { name: 'shoe', x, y, rotation: rot, scaleX: k, scaleY: k }, [
    el('Shape', { name: 'dimple' }, [pathXml(blobPts(5.5, 11, r, { n: 8, wobble: 0.08 }), { closed: true }), fill(argb(SHADOW, 0.5), { feather: 1.2 })]),
    ticks([[P(-3, -5), P(3, -5)], [P(-3.5, 0), P(3.5, 0)], [P(-3, 5), P(3, 5)]], { width: 0.5, color: ink(0.35) }),
  ].reverse());
}

// the first `n` prints of a walk along pts, each appearing in turn
function shoeTrail(ids, r, pts, n, t0, tracks, { shrink = 0 } = {}) {
  const along = resample(pts, n);
  return along.map((p, i) => {
    const q = along[Math.min(i + 1, n - 1)], o = along[Math.max(i - 1, 0)];
    const rot = Math.atan2(q.y - o.y, q.x - o.x) + Math.PI / 2;
    const id = ids.next();
    tracks.push(appear(id, t0 + i * 7, 12));
    return el('Node', { name: 'step', id, opacity: 0 }, snowshoePrint(r, p.x + (i % 2 ? 5 : -5) * Math.cos(rot), p.y + (i % 2 ? 5 : -5) * Math.sin(rot), rot, 1 - shrink * (i / n)));
  });
}

const ambient = (s, tracks, LOOP, name = 'Ambient') => s.loopLayer('ambient', s.anim({ name, duration: LOOP, loop: 'loop', tracks }));

// ---------------------------------------------------------------- treeline (fixed, foot of the viewport)

export function treeline(ids) {
  const W = 1400, H = 170;
  const s = new Scene(ids, { name: 'Treeline', w: W, h: H, x: 3100, y: 0, bg: BG });
  const r = rng(77);
  const far = treelineRow(r, { x0: -10, x1: W + 10, base: H - 26, hMin: 36, hMax: 92, color: '9AB0AC', alpha: 0.26, gap: 24 });
  const nearer = treelineRow(r, { x0: -10, x1: W + 10, base: H - 18, hMin: 26, hMax: 64, color: '7F9A94', alpha: 0.22, gap: 56 });
  const ground = drift(r, { x0: -40, x1: W + 40, y: H - 22, h: 8 });
  const f = fox(ids, r, { scale: 0.85 });
  const LOOP = 3300;
  const y = H - 7;
  const tr = [
    { object: f.rootId, prop: 'y', keys: [[0, y]] },
    { object: f.rootId, prop: 'x', keys: [[0, -80, 'hold'], [600, -80, 'linear'], [880, 560, 'hold'], [980, 560, 'linear'], [1300, W + 80, 'hold'], [2300, W + 80, 'linear'], [2860, -80, 'hold']] },
    { object: f.rootId, prop: 'opacity', keys: [[0, 0, 'hold'], [600, 0, 'linear'], [620, 1, 'hold'], [1280, 1, 'linear'], [1300, 0, 'hold'], [2300, 0, 'linear'], [2320, 1, 'hold'], [2840, 1, 'linear'], [2860, 0, 'hold']] },
    { object: f.rootId, prop: 'scaleX', keys: [[0, 0.85, 'hold'], [1800, 0.85, 'hold'], [1801, -0.85, 'hold'], [3000, -0.85, 'hold'], [3001, 0.85, 'hold']] },
    { object: f.headId, prop: 'rotation', keys: [[0, 0, 'hold'], [884, 0, 'cubic', EASE.out], [896, 0.28, 'hold'], [940, 0.28, 'cubic', EASE.out], [952, -0.12, 'hold'], [970, -0.12, 'cubic', EASE.out], [980, 0, 'hold']] },
  ];
  const trot = [...foxTrot(f, 600, 880), ...foxTrot(f, 980, 1300), ...foxTrot(f, 2300, 2860)];
  const byObj = new Map();
  for (const t of trot) {
    const k = `${t.object}:${t.prop}`;
    if (!byObj.has(k)) byObj.set(k, { ...t, keys: [] });
    byObj.get(k).keys.push(...t.keys);
  }
  for (const t of byObj.values()) tr.push({ ...t, keys: tidy(t.keys) });
  s.add(...far, ...ground, ...nearer, f.xml);
  ambient(s, tr, LOOP, 'Fox');
  s.loopLayer('rise', s.anim({ name: 'Rise', duration: 200, tracks: [] }));
  return s.toXml();
}

// ---------------------------------------------------------------- creek

export function creek(ids) {
  const W = 720, H = 200;
  const s = new Scene(ids, { name: 'Creek', w: W, h: H, x: 0, y: 1300, bg: BG });
  const r = rng(201);
  const grow = [];
  const farBank = [];
  for (let x = -20; x <= W + 20; x += 40) farBank.push(P(x, 86 + Math.sin(x / 110) * 11 + r.jit(2)));
  const nearBank = [];
  for (let x = -20; x <= W + 20; x += 40) nearBank.push(P(x, 136 + Math.sin(x / 110 + 0.6) * 10 + r.jit(2)));
  const farRowId = ids.next();
  const farRow = el('Node', { name: 'farRow', id: farRowId, opacity: 0 }, treelineRow(r, { x0: -10, x1: W + 10, base: 78, hMin: 28, hMax: 70, color: '8FA6A1', alpha: 0.3, gap: 20 }));
  grow.push(appear(farRowId, 0, 80));
  const bankShade = el('Node', { name: 'bankShade' }, [
    el('Shape', { name: 'farShade', blendModeValue: 'multiply' }, [pathXml(farBank.map((p) => P(p.x, p.y + 5)), { tension: 0.9 }), stroke(argb(SHADOW, 0.35), 9, { feather: 6 })]),
    el('Shape', { name: 'nearShade', blendModeValue: 'multiply' }, [pathXml(nearBank.map((p) => P(p.x, p.y - 4)), { tension: 0.9 }), stroke(argb(SHADOW, 0.25), 7, { feather: 5 })]),
  ]);
  const boulderId = ids.next();
  const boulder = el('Node', { name: 'boulder', id: boulderId, opacity: 0, x: 612, y: 124 }, [
    el('Shape', { name: 'rockShade' }, [pathXml(blobPts(20, 8, r, { n: 9 }).map((p) => P(p.x + 3, p.y + 6)), { closed: true }), fill(argb(SHADOW, 0.4), { feather: 4 })]),
    el('Shape', { name: 'rock', blendModeValue: 'multiply' }, [pathXml(blobPts(17, 9, r, { n: 9, wobble: 0.14 }), { closed: true, tension: 0.7 }), fill(argb('7D8A94', 0.6), { feather: 0.8 })]),
    inkShape({ pts: blobPts(17, 9, r, { n: 9, wobble: 0.14 }), closed: true, tension: 0.7, color: ink(0.85), width: 1, bleed: 0.1 }),
    snowCap(r, resample([P(-14, -5), P(-4, -9), P(6, -9), P(14, -5)], 6), 6),
  ].reverse());
  grow.push(appear(boulderId, 80, 40));
  // ice between the banks, with a dark open lead
  const iceId = ids.next();
  const icePts = [...farBank.map((p) => P(p.x, p.y + 1)), ...[...nearBank].reverse().map((p) => P(p.x, p.y - 1))];
  const lead = blobPts(52, 9, r, { n: 10, wobble: 0.18 }).map((p) => P(p.x + 540, p.y + 108));
  const rippleA = ids.next(), rippleB = ids.next();
  const ice = el('Node', { name: 'ice', id: iceId, opacity: 0 }, [
    el('Shape', { name: 'iceWash', blendModeValue: 'multiply' }, [pathXml(icePts, { closed: true, tension: 0.8 }), fill(argb('C4D6E3', 0.5), { feather: 2 })]),
    el('Shape', { name: 'streak', blendModeValue: 'multiply' }, [pathXml([P(90, 112), P(240, 104), P(420, 112)], { tension: 0.9 }), stroke(argb('AFC6D8', 0.45), 5, { feather: 4 })]),
    el('Shape', { name: 'lead', blendModeValue: 'multiply' }, [pathXml(lead, { closed: true, tension: 0.8 }), fill(argb('3B5062', 0.55), { feather: 1.6 })]),
    el('Shape', { name: 'leadEdge' }, [pathXml(lead, { closed: true, tension: 0.8 }), stroke(argb('FFFFFF', 0.9), 1.6, { feather: 1 })]),
    el('Shape', { name: 'ripple', id: rippleA }, [pathXml([P(512, 108), P(530, 105), P(548, 108)], { tension: 0.9 }), stroke(argb('DCE8F0', 0.8), 0.8)]),
    el('Shape', { name: 'ripple', id: rippleB }, [pathXml([P(540, 113), P(560, 110), P(576, 113)], { tension: 0.9 }), stroke(argb('DCE8F0', 0.7), 0.7)]),
  ].reverse());
  grow.push(appear(iceId, 20, 60));
  const banks = [
    drawnLine(ids, farBank, { width: 1.1, alpha: 0.6, tension: 0.9 }, 0, 90, grow),
    drawnLine(ids, nearBank, { width: 1.2, alpha: 0.7, tension: 0.9 }, 10, 90, grow),
  ];
  // near bank snow, far bank snow
  const nearSnow = el('Shape', { name: 'nearSnow' }, [pathXml([...nearBank, P(W + 20, H + 40), P(-20, H + 40)], { closed: true, tension: 0.8 }), fill(argb('FFFFFF', 0.9))]);
  const farSnow = el('Shape', { name: 'farSnow' }, [pathXml([P(-20, -20), P(W + 20, -20), ...[...farBank].reverse()], { closed: true, tension: 0.8 }), fill(argb('FFFFFF', 0.85))]);
  // red osier dogwood on the far bank: a warm note
  const dogwood = [];
  for (const [bx, n] of [[110, 9], [128, 6], [600, 8], [640, 7]]) {
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + r.jit(0.5);
      const L = r.range(18, 40);
      const p0 = P(bx + r.jit(6), 84 + r.jit(3));
      const p1 = P(p0.x + Math.cos(a) * L * 0.6, p0.y + Math.sin(a) * L * 0.6);
      const p2 = P(p1.x + Math.cos(a + r.jit(0.4)) * L * 0.4, p1.y + Math.sin(a) * L * 0.4);
      dogwood.push(drawnLine(ids, [p0, p1, p2], { width: r.range(0.7, 1.2), color: 'A83A2C', alpha: 0.8, tension: 0.8 }, 60 + k * 4, 30, grow));
    }
  }
  // the log crossing, with snow along its top
  const logA = P(318, 150), logB = P(372, 74);
  const logN = P(-(logB.y - logA.y), logB.x - logA.x);
  const nl = Math.hypot(logN.x, logN.y);
  const nx = (logN.x / nl) * 6, ny = (logN.y / nl) * 6;
  const logId = ids.next();
  const logBody = [P(logA.x + nx, logA.y + ny), P(logB.x + nx, logB.y + ny), P(logB.x - nx, logB.y - ny), P(logA.x - nx, logA.y - ny)];
  const log = el('Node', { name: 'log', id: logId, opacity: 0 }, [
    el('Shape', { name: 'logShadow' }, [pathXml(logBody.map((p) => P(p.x + 3, p.y + 4)), { closed: true, tension: 0.2 }), fill(argb(SHADOW, 0.4), { feather: 4 })]),
    el('Shape', { name: 'logWash', blendModeValue: 'multiply' }, [pathXml(logBody, { closed: true, tension: 0.2 }), fill(argb('8B6B4E', 0.55), { feather: 0.8 })]),
    inkShape({ pts: logBody, closed: true, tension: 0.2, color: ink(0.9), width: 1.1, bleed: 0.12 }),
    ticks([[P(330, 134), P(336, 126)], [P(344, 118), P(350, 110)], [P(356, 100), P(362, 92)]], { width: 0.7, color: ink(0.5) }),
    el('Shape', { name: 'end' }, [el('Ellipse', { x: logA.x, y: logA.y, width: 12, height: 9, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('D9B98E', 0.9)), stroke(ink(0.9), 1)]),
    snowCap(r, resample([P(logA.x - nx * 0.8, logA.y - ny * 0.8), P(logB.x - nx * 0.8, logB.y - ny * 0.8)], 7).slice(1, -1), 4),
  ].reverse());
  grow.push(appear(logId, 90, 50));
  // snowshoe prints walk in from the bottom left, cross the log, and go on
  const steps = shoeTrail(ids, r, [P(150, 196), P(230, 178), P(300, 156), P(345, 112), P(372, 72), P(430, 48), P(520, 24)], 11, 110, grow, { shrink: 0.35 });
  // glints under the pointer
  const g = glintLayer(s, ids, r, [[180, 104, 0.8], [290, 118, 0.6], [460, 100, 0.9], [620, 120, 0.7], [400, 124, 0.5]]);
  const over = hit(ids, W / 2, 108, W, 60, 'iceHit');
  s.listen(over.id, 'enter', [Scene.setBool(g.over, true)]);
  s.listen(over.id, 'exit', [Scene.setBool(g.over, false)]);

  s.add(farSnow, farRow, ice, bankShade, ...banks, nearSnow, ...dogwood, boulder, log, ...steps, g.xml, over.xml);
  s.loopLayer('grow', s.anim({ name: 'Grow', duration: 260, tracks: grow }));
  const LOOP = 1400;
  ambient(s, [
    { object: rippleA, prop: 'x', keys: [[0, 0, 'cubic', EASE.inOut], [LOOP / 2, 10, 'cubic', EASE.inOut], [LOOP, 0]] },
    { object: rippleA, prop: 'opacity', keys: [[0, 0.3, 'cubic', EASE.inOut], [LOOP / 4, 1, 'cubic', EASE.inOut], [LOOP / 2, 0.4, 'cubic', EASE.inOut], [(3 * LOOP) / 4, 0.9, 'cubic', EASE.inOut], [LOOP, 0.3]] },
    { object: rippleB, prop: 'x', keys: [[0, 6, 'cubic', EASE.inOut], [LOOP / 2, -6, 'cubic', EASE.inOut], [LOOP, 6]] },
    { object: rippleB, prop: 'opacity', keys: [[0, 0.8, 'cubic', EASE.inOut], [LOOP / 3, 0.2, 'cubic', EASE.inOut], [(2 * LOOP) / 3, 0.9, 'cubic', EASE.inOut], [LOOP, 0.8]] },
    ...twinkleTracks(g.gl.slice(0, 2), 400, 1300, r),
  ], LOOP);
  return s.toXml();
}

// ---------------------------------------------------------------- cabin

// a column of rising smoke puffs, phase-shifted copies of one cycle
function smoke(ids, r, { x, y, tracks, LOOP = 300, n = 4 }) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const id = ids.next();
    const sz = r.range(9, 14);
    out.push(el('Shape', { name: 'puff', x, y, opacity: 0, id }, [pathXml(blobPts(sz, sz * 0.8, r, { n: 8, wobble: 0.15 }), { closed: true }), fill(argb('B8C2C9', 0.55), { feather: 5 })]));
    const off = Math.round((k / n) * LOOP);
    const drift = r.range(14, 30);
    const f = {
      x: (u) => x + (u / LOOP) * drift + Math.sin((u / LOOP) * 6) * 3,
      y: (u) => y - (u / LOOP) * 78,
      scaleX: (u) => 0.4 + (u / LOOP) * 1.3,
      scaleY: (u) => 0.4 + (u / LOOP) * 1.3,
      opacity: (u) => Math.max(0, Math.min(1, (u / LOOP) * 5)) * Math.max(0, 1 - (u / LOOP) * 1.15) * 0.9,
    };
    for (const [prop, fn] of Object.entries(f)) {
      const keys = [];
      for (let u = 0; u <= LOOP; u += 15) {
        const t = (u + off) % LOOP;
        keys.push([t, fn(u), 'linear']);
      }
      keys.push([0, fn((LOOP - off) % LOOP), 'linear'], [LOOP, fn((LOOP - off) % LOOP), 'linear']);
      tracks.push({ object: id, prop, keys: tidy(keys) });
    }
  }
  return out;
}

export function cabin(ids) {
  const W = 720, H = 270;
  const s = new Scene(ids, { name: 'Cabin', w: W, h: H, x: 0, y: 1560, bg: BG });
  const r = rng(305);
  const grow = [];
  const base = 226;
  const tree = coniferAuto(ids, r, { cx: 150, base: base + 2, height: 200, maxW: 44, tiers: 10, color: SPRUCE, alpha: 0.85, t0: 20, club: true });
  const backId = ids.next();
  const backRow = el('Node', { name: 'backRow', id: backId, opacity: 0 }, [
    ...treelineRow(r, { x0: 560, x1: 740, base: base - 4, hMin: 60, hMax: 130, color: '8FA6A1', alpha: 0.32, gap: 26 }),
    ...treelineRow(r, { x0: -10, x1: 120, base: base - 6, hMin: 50, hMax: 110, color: '8FA6A1', alpha: 0.28, gap: 26 }),
  ]);
  grow.push(appear(backId, 0, 80));
  // the cabin: front elevation with a gable roof
  const x0 = 262, x1 = 446, wallTop = 128, ridge = P(354, 62), eaveL = P(240, 136), eaveR = P(468, 136);
  const wallId = ids.next();
  const wall = el('Node', { name: 'wall', id: wallId, opacity: 0 }, [
    el('Shape', { name: 'wash', blendModeValue: 'multiply' }, [pathXml([P(x0, wallTop), P(x1, wallTop), P(x1, base), P(x0, base)], { closed: true, tension: 0 }), fill(argb('B58B62', 0.42), { feather: 1 })]),
    el('Shape', { name: 'gableWash', blendModeValue: 'multiply' }, [pathXml([P(x0, wallTop), ridge, P(x1, wallTop)], { closed: true, tension: 0 }), fill(argb('B58B62', 0.36), { feather: 1 })]),
    el('Shape', { name: 'shade', blendModeValue: 'multiply' }, [pathXml([P(x0, wallTop + 6), P(x1, wallTop + 6), P(x1, wallTop + 26), P(x0, wallTop + 26)], { closed: true, tension: 0 }), fill(argb('5B6A74', 0.3), { feather: 6 })]),
  ].reverse());
  grow.push(appear(wallId, 40, 60));
  const lines = [];
  for (let y = base - 8; y > wallTop; y -= 12) lines.push(drawnLine(ids, [P(x0, y + r.jit(0.6)), P((x0 + x1) / 2, y + r.jit(0.8)), P(x1, y + r.jit(0.6))], { width: 1, alpha: 0.55, tension: 0.8 }, 50 + (base - y) * 0.6, 40, grow));
  // log ends at the corners
  const ends = [];
  for (let y = base - 8; y > wallTop; y -= 12) for (const ex of [x0 - 3, x1 + 3]) ends.push(el('Shape', { name: 'end', x: ex, y }, [el('Ellipse', { width: 7, height: 7, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('D9B98E', 0.9)), stroke(ink(0.75), 0.8)]));
  const endsId = ids.next();
  grow.push(appear(endsId, 90, 50));
  const outline = [
    drawnLine(ids, [P(x0, base), P(x0, wallTop), ridge, P(x1, wallTop), P(x1, base)], { width: 1.5, tension: 0 }, 20, 90, grow),
    // roof: the planks overhang the gable
    drawnLine(ids, [eaveL, P(ridge.x, ridge.y - 8), eaveR], { width: 1.7, tension: 0 }, 60, 70, grow),
  ];
  // door, window
  const door = el('Node', { name: 'door' }, [
    el('Shape', { name: 'doorWash', blendModeValue: 'multiply' }, [pathXml([P(284, 170), P(312, 170), P(312, base), P(284, base)], { closed: true, tension: 0 }), fill(argb('5A4634', 0.55))]),
    drawnLine(ids, [P(284, base), P(284, 170), P(312, 170), P(312, base)], { width: 1.2, tension: 0 }, 110, 40, grow),
    drawnLine(ids, [P(298, 171), P(298, base)], { width: 0.7, alpha: 0.6 }, 130, 20, grow),
    el('Shape', { name: 'knob' }, [el('Ellipse', { x: 306, y: 200, width: 2.6, height: 2.6, originX: 0.5, originY: 0.5, name: 'P' }), fill(ink(0.9))]),
  ].reverse());
  const win = { x: 356, y: 156, w: 52, h: 40 };
  const paneCold = el('Shape', { name: 'paneCold', blendModeValue: 'multiply' }, [pathXml([P(win.x, win.y), P(win.x + win.w, win.y), P(win.x + win.w, win.y + win.h), P(win.x, win.y + win.h)], { closed: true, tension: 0 }), fill(argb('A9BCCB', 0.6))]);
  const lampId = ids.next();
  const warm = el('Node', { name: 'warm', id: lampId, opacity: 0 }, [
    el('Shape', { name: 'pane' }, [pathXml([P(win.x, win.y), P(win.x + win.w, win.y), P(win.x + win.w, win.y + win.h), P(win.x, win.y + win.h)], { closed: true, tension: 0 }), fill(argb('F6C46A', 0.95))]),
    el('Shape', { name: 'glow' }, [el('Ellipse', { x: win.x + win.w / 2, y: win.y + win.h / 2, width: 120, height: 100, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('F9D48C', 0.35), { feather: 24 })]),
    // light thrown onto the snow outside
    el('Shape', { name: 'spill' }, [pathXml([P(win.x - 10, base), P(win.x + win.w + 10, base), P(win.x + win.w + 60, base + 30), P(win.x - 40, base + 30)], { closed: true, tension: 0.2 }), fill(argb('F9D48C', 0.3), { feather: 14 })]),
    el('Shape', { name: 'lamp' }, [el('Ellipse', { x: win.x + 16, y: win.y + 24, width: 9, height: 9, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFF3D0', 0.95), { feather: 2 })]),
  ].reverse());
  const windowInk = el('Node', { name: 'windowInk' }, [
    drawnLine(ids, [P(win.x, win.y), P(win.x + win.w, win.y), P(win.x + win.w, win.y + win.h), P(win.x, win.y + win.h), P(win.x, win.y)], { width: 1.3, tension: 0 }, 120, 40, grow),
    drawnLine(ids, [P(win.x + win.w / 2, win.y), P(win.x + win.w / 2, win.y + win.h)], { width: 0.9, alpha: 0.8 }, 150, 16, grow),
    drawnLine(ids, [P(win.x, win.y + win.h / 2), P(win.x + win.w, win.y + win.h / 2)], { width: 0.9, alpha: 0.8 }, 150, 16, grow),
  ]);
  // deep snow on the roof, icicles along the eaves
  const roofId = ids.next();
  const slopeL = resample([P(eaveL.x + 4, eaveL.y - 2), P(ridge.x, ridge.y - 10)], 7);
  const slopeR = resample([P(ridge.x, ridge.y - 10), P(eaveR.x - 4, eaveR.y - 2)], 7);
  const roof = el('Node', { name: 'roofSnow', id: roofId, opacity: 0 }, [
    el('Shape', { name: 'roofShade', blendModeValue: 'multiply' }, [pathXml([eaveL, P(ridge.x, ridge.y - 8), eaveR, P(eaveR.x - 6, eaveR.y + 6), P(eaveL.x + 6, eaveL.y + 6)], { closed: true, tension: 0 }), fill(argb('5B6A74', 0.35), { feather: 2 })]),
    snowCap(r, slopeL.slice(0, -1), 11),
    snowCap(r, slopeR.slice(1), 11),
    el('Shape', { name: 'icicles' }, [
      ...[0, 1, 2, 3, 4, 5].map((k) => pathXml([P(eaveL.x + 10 + k * 14, eaveL.y + 5), P(eaveL.x + 12 + k * 14, eaveL.y + 5 + r.range(6, 16)), P(eaveL.x + 14 + k * 14, eaveL.y + 5)], { closed: true, tension: 0 })),
      ...[0, 1, 2, 3, 4, 5].map((k) => pathXml([P(eaveR.x - 10 - k * 14, eaveR.y + 5), P(eaveR.x - 12 - k * 14, eaveR.y + 5 + r.range(6, 16)), P(eaveR.x - 14 - k * 14, eaveR.y + 5)], { closed: true, tension: 0 })),
      fill(argb('DCEAF3', 0.9)), stroke(argb('8EA6B8', 0.7), 0.6),
    ]),
  ].reverse());
  grow.push(appear(roofId, 130, 60));
  // chimney and smoke
  const chim = { x: 404, y: 70, w: 18 };
  const chimId = ids.next();
  const chimney = el('Node', { name: 'chimney', id: chimId, opacity: 0 }, [
    el('Shape', { name: 'stone', blendModeValue: 'multiply' }, [pathXml([P(chim.x, chim.y), P(chim.x + chim.w, chim.y), P(chim.x + chim.w, chim.y + 42), P(chim.x, chim.y + 36)], { closed: true, tension: 0 }), fill(argb('8E9AA3', 0.5))]),
    inkShape({ pts: [P(chim.x, chim.y + 36), P(chim.x, chim.y), P(chim.x + chim.w, chim.y), P(chim.x + chim.w, chim.y + 42)], color: ink(0.9), width: 1.2, bleed: 0.1 }),
    ticks([[P(chim.x + 3, chim.y + 10), P(chim.x + 9, chim.y + 10)], [P(chim.x + 10, chim.y + 20), P(chim.x + 16, chim.y + 20)], [P(chim.x + 2, chim.y + 28), P(chim.x + 8, chim.y + 28)]], { width: 0.7, color: ink(0.5) }),
    snowCap(r, [P(chim.x + 1, chim.y - 1), P(chim.x + 6, chim.y - 1), P(chim.x + 12, chim.y - 1), P(chim.x + 17, chim.y - 1)], 4),
  ].reverse());
  grow.push(appear(chimId, 150, 40));
  const amb = [];
  const puffs = smoke(ids, r, { x: chim.x + chim.w / 2, y: chim.y - 6, tracks: amb, LOOP: 320, n: 4 });
  // the woodpile: rounds stacked three high, snow on top, a split log leaning
  const pile = { x: 500, y: base, rows: [6, 5, 4], rr: 9 };
  const pileId = ids.next();
  const rounds = [];
  pile.rows.forEach((n, row) => {
    for (let k = 0; k < n; k++) {
      const cx = pile.x + 10 + row * 9 + k * 18 + r.jit(1);
      const cy = pile.y - 9 - row * 15.5 + r.jit(0.6);
      const rad = pile.rr * r.range(0.85, 1.1);
      rounds.push(el('Node', { name: 'round', x: cx, y: cy }, [
        el('Shape', { name: 'face' }, [pathXml(blobPts(rad, rad, r, { n: 9, wobble: 0.05 }), { closed: true }), fill(argb('D9B98E', 0.92)), stroke(ink(0.85), 1)]),
        el('Shape', { name: 'rings' }, [pathXml(blobPts(rad * 0.55, rad * 0.5, r, { n: 8, wobble: 0.08 }), { closed: true }), stroke(ink(0.4), 0.6)]),
        ticks([[P(0, 0), P(rad * 0.9 * Math.cos(0.8), rad * 0.9 * Math.sin(0.8))], [P(0, 0), P(rad * 0.9 * Math.cos(3.3), rad * 0.9 * Math.sin(3.3))]], { width: 0.6, color: ink(0.45) }),
      ].reverse()));
    }
  });
  const pileTop = pile.y - 9 - 2 * 15.5 - 9;
  const woodpile = el('Node', { name: 'woodpile', id: pileId, opacity: 0 }, [
    el('Shape', { name: 'pileShadow' }, [pathXml(blobPts(60, 8, r, { n: 9 }).map((p) => P(p.x + pile.x + 56, p.y + pile.y)), { closed: true }), fill(argb(SHADOW, 0.35), { feather: 5 })]),
    ...rounds,
    snowCap(r, resample([P(pile.x + 30, pileTop + 1), P(pile.x + 96, pileTop + 1)], 7), 6),
  ].reverse());
  grow.push(appear(pileId, 160, 60));
  // two red squirrels: one runs the pile on its own now and then, the other when you brush it
  const sqA = squirrel(ids, r), sqB = squirrel(ids, r);
  const runY = pileTop - 4;
  const LOOP = 2200;
  amb.push(...squirrelRun(sqA, { x0: pile.x + 20, x1: pile.x + 110, y: runY, t0: 360, run: 50, pause: 90 }));
  const sqBtrack = squirrelRun(sqB, { x0: pile.x + 110, x1: pile.x + 20, y: runY, t0: 0, run: 50, pause: 70 });
  const dash = s.input('trigger', 'dash');
  // snowshoe prints up to the door
  const steps = shoeTrail(ids, r, [P(120, 262), P(200, 250), P(270, 240), P(296, 230)], 6, 170, grow);
  // ground
  const ground = drift(r, { x0: -30, x1: W + 30, y: base + 10, h: 18, shadows: [{ x: 354, y: base + 2, rx: 120, ry: 8 }] });
  const tufts = [];
  for (const gx of [40, 230, 480, 640]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, base + 6), P(gx + k * 3 + r.jit(6) - 4, base + 6 - r.range(6, 14))]);
  const tuftId = ids.next();
  grow.push(appear(tuftId, 180, 40));

  // the lamp: click the window to light it
  const lamp = s.input('bool', 'lamp', false);
  const lampOff = s.anim({ name: 'Lamp off', duration: 1, tracks: [{ object: lampId, prop: 'opacity', keys: [[0, 0]] }] });
  const lampOn = s.anim({ name: 'Lamp on', duration: 1, tracks: [{ object: lampId, prop: 'opacity', keys: [[0, 1]] }] });
  const winHit = hit(ids, win.x + win.w / 2, win.y + win.h / 2, win.w + 16, win.h + 16, 'windowHit');
  s.listen(winHit.id, 'click', [el('ListenerBoolChange', { inputId: lamp, value: 2 })]);
  const pileHit = hit(ids, pile.x + 60, pileTop + 8, 130, 40, 'pileHit');
  s.listen(pileHit.id, 'enter', [Scene.fire(dash)]);

  s.add(
    backRow,
    ...tree.back, ...tree.mid, ...tree.front,
    ...puffs, chimney,
    wall, ...lines, el('Node', { name: 'ends', id: endsId, opacity: 0 }, ends), ...outline, door, paneCold, warm, windowInk, roof,
    ...ground, ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts' }),
    ...steps, woodpile, sqA.xml, sqB.xml, winHit.xml, pileHit.xml,
  );
  s.loopLayer('grow', s.anim({ name: 'Grow', duration: 300, tracks: [...grow, ...gatherTracks()] }));
  s.boolLayer('lamp', lamp, lampOff, lampOn, { mixIn: 500, mixOut: 700 });
  ambient(s, amb, LOOP, 'Smoke and squirrel');
  s.triggerLayer('dash', dash, s.anim({ name: 'Dash', duration: 180, tracks: sqBtrack }), { fromAny: false, mix: 0 });
  return s.toXml();
}

// ---------------------------------------------------------------- split-rail fence

export function fence(ids) {
  const W = 720, H = 210;
  const s = new Scene(ids, { name: 'Fence', w: W, h: H, x: 0, y: 1860, bg: BG });
  const r = rng(411);
  const grow = [];
  const base = 168;
  const ground = drift(r, { x0: -30, x1: W + 30, y: base + 8, h: 16, shadows: [{ x: 360, y: base + 2, rx: 220, ry: 7 }] });
  // the fence zigzags a little, rails stacked two high, stakes at the joints
  const joints = [];
  for (let k = 0; k <= 6; k++) joints.push(P(40 + k * 108 + r.jit(4), 118 + (k % 2 ? 7 : -7) + r.jit(2)));
  const rails = [];
  const caps = [];
  for (let k = 0; k < joints.length - 1; k++) {
    const a = joints[k], b = joints[k + 1];
    for (const [dy, w, t] of [[0, 1.5, 0], [22, 1.3, 15]]) {
      const pts = [P(a.x, a.y + dy), P((a.x + b.x) / 2 + r.jit(3), (a.y + b.y) / 2 + dy + r.jit(1.5)), P(b.x, b.y + dy)];
      const railId = ids.next();
      rails.push(el('Node', { name: 'rail', id: railId, opacity: 0 }, [
        el('Shape', { name: 'railWash', blendModeValue: 'multiply' }, [pathXml(pts, { tension: 0.8 }), stroke(argb('A98A68', 0.45), 6, { feather: 1 })]),
        el('Shape', { name: 'railShade', blendModeValue: 'multiply' }, [pathXml(pts.map((p) => P(p.x, p.y + 2)), { tension: 0.8 }), stroke(argb('6E5B47', 0.35), 2.2, { feather: 1.2 })]),
      ].reverse()));
      grow.push(appear(railId, 30 + k * 22 + t, 40));
      rails.push(drawnLine(ids, pts.map((p) => P(p.x, p.y - 3)), { width: w, tension: 0.8 }, 20 + k * 22 + t, 40, grow));
      rails.push(drawnLine(ids, pts.map((p) => P(p.x, p.y + 3)), { width: w * 0.8, alpha: 0.8, tension: 0.8 }, 26 + k * 22 + t, 40, grow));
      if (dy === 0) {
        const capId = ids.next();
        caps.push(snowCap(r, resample(pts, 9).slice(1, -1).map((p) => P(p.x, p.y - 3.5)), r.range(4, 6), { id: capId, opacity: 0 }));
        grow.push(appear(capId, 70 + k * 22, 40));
      }
    }
  }
  const stakes = [];
  joints.forEach((j, k) => {
    if (k === 0 || k === joints.length - 1) return;
    stakes.push(drawnLine(ids, [P(j.x - 4, base + 2), P(j.x - 2, j.y - 12)], { width: 1.4 }, 10 + k * 22, 30, grow));
    stakes.push(drawnLine(ids, [P(j.x + 5, base + 2), P(j.x + 3, j.y - 10)], { width: 1.2, alpha: 0.85 }, 14 + k * 22, 30, grow));
  });
  // the end post, where the raven sits
  const post = joints[0];
  const postTop = P(post.x - 2, post.y - 42);
  const postId = ids.next();
  stakes.push(drawnLine(ids, [P(post.x - 5, base + 2), P(post.x - 4, postTop.y)], { width: 1.8 }, 0, 40, grow));
  stakes.push(drawnLine(ids, [P(post.x + 5, base + 2), P(post.x + 4, postTop.y)], { width: 1.4 }, 4, 40, grow));
  stakes.push(el('Node', { name: 'postTop', id: postId, opacity: 0 }, [
    el('Shape', { name: 'postWash', blendModeValue: 'multiply' }, [pathXml([P(post.x - 5, base), P(post.x - 4, postTop.y), P(post.x + 4, postTop.y), P(post.x + 5, base)], { closed: true, tension: 0 }), fill(argb('A98A68', 0.4))]),
    snowCap(r, [P(post.x - 4, postTop.y - 1), P(post.x, postTop.y - 1), P(post.x + 4, postTop.y - 1)], 4),
  ].reverse()));
  grow.push(appear(postId, 30, 40));
  // the raven
  const rv = raven(ids, r);
  const ravenId = ids.next();
  const ravenRoot = el('Node', { name: 'ravenAt', x: post.x + 1, y: postTop.y - 3, id: ravenId, opacity: 0 }, rv.xml);
  grow.push(appear(ravenId, 120, 30));
  // deer walked under the rails and off into the trees
  const deer = [];
  const deerPath = resample([P(640, 206), P(600, 180), P(560, 150), P(520, 122), P(500, 100)], 8);
  deerPath.forEach((p, i) => {
    const k = 1 - i * 0.08;
    const id = ids.next();
    const side = i % 2 ? 4 : -4;
    const hoof = el('Node', { name: 'hoof', x: p.x + side, y: p.y, scaleX: k, scaleY: k, rotation: -0.6 }, [
      ...printShape(r, -2.6, 0, 2, 4, -0.15), ...printShape(r, 2.6, 0, 2, 4, 0.15),
    ]);
    deer.push(el('Node', { name: 'deerStep', id, opacity: 0 }, hoof));
    grow.push(appear(id, 150 + i * 9, 14, 0));
  });
  // a snowshoe hare behind a drift, right of centre
  const hr = hare(ids, r);
  const hx = 452, hy = base + 2;
  const hareRoot = el('Node', { name: 'hareAt', x: hx, y: hy }, hr.xml);
  const hareMound = mound(r, hx + 2, hy, 46, 22);
  const tufts = [];
  for (const gx of [120, 300, 560, 680]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, base + 6), P(gx + k * 3 + r.jit(6) - 4, base + 6 - r.range(6, 14))]);
  const tuftId = ids.next();
  grow.push(appear(tuftId, 160, 40));

  // ambient: the raven ruffles and looks about; the hare peeks twice a loop
  const LOOP = 1800;
  const peek = (t) => [[t, 26, 'cubic', EASE.out], [t + 18, -1, 'cubic', EASE.inOut], [t + 26, 0, 'hold'], [t + 150, 0, 'cubic', EASE.in], [t + 164, 26, 'hold']];
  const amb = [
    { object: hr.peekId, prop: 'y', keys: tidy([[0, 26, 'hold'], ...peek(420), ...peek(1300)]) },
    { object: hr.earL, prop: 'rotation', keys: [[0, -0.25, 'hold'], [480, -0.25, 'cubic', EASE.out], [486, -0.55, 'cubic', EASE.out], [496, -0.2, 'cubic', EASE.out], [504, -0.25, 'hold'], [1380, -0.25, 'cubic', EASE.out], [1386, -0.6, 'cubic', EASE.out], [1400, -0.25, 'hold']] },
    { object: hr.earR, prop: 'rotation', keys: [[0, 0.1, 'hold'], [520, 0.1, 'cubic', EASE.out], [526, 0.4, 'cubic', EASE.out], [540, 0.1, 'hold']] },
    { object: hr.headId, prop: 'rotation', keys: [[0, 0, 'hold'], [460, 0, 'cubic', EASE.out], [468, -0.15, 'hold'], [540, -0.15, 'cubic', EASE.out], [548, 0.1, 'hold'], [580, 0.1, 'cubic', EASE.out], [588, 0, 'hold']] },
    { object: rv.headId, prop: 'rotation', keys: [[0, 0, 'hold'], [200, 0, 'cubic', EASE.out], [208, 0.35, 'hold'], [330, 0.35, 'cubic', EASE.out], [338, 0, 'hold'], [900, 0, 'cubic', EASE.out], [906, -0.3, 'hold'], [980, -0.3, 'cubic', EASE.out], [988, 0.2, 'hold'], [1040, 0.2, 'cubic', EASE.out], [1050, 0, 'hold']] },
    { object: rv.bodyId, prop: 'scaleY', keys: [[0, 1, 'hold'], [600, 1, 'cubic', EASE.out], [608, 1.08, 'cubic', EASE.inOut], [620, 0.96, 'cubic', EASE.out], [640, 1, 'hold'], [1500, 1, 'cubic', EASE.out], [1508, 1.08, 'cubic', EASE.inOut], [1520, 0.96, 'cubic', EASE.out], [1540, 1, 'hold']] },
    { object: rv.wingId, prop: 'rotation', keys: [[0, 0, 'hold'], [604, 0, 'cubic', EASE.out], [610, -0.5, 'cubic', EASE.inOut], [618, 0.1, 'cubic', EASE.out], [628, 0, 'hold']] },
  ];
  // the hare bolts when brushed: three bounds right, gone behind the fence, back later
  const bolt = s.input('trigger', 'bolt');
  const hop = (t, x0, x1, len = 22, lift = 24) => ({ x: [[t, x0, 'cubic', EASE.inOut], [t + len, x1]], y: [[t, -26, 'cubic', EASE.out], [t + len / 2, -26 - lift, 'cubic', EASE.in], [t + len, -26]] });
  const h1 = hop(0, 0, 55), h2 = hop(24, 55, 115, 22, 26), h3 = hop(48, 115, 180, 24, 20);
  const boltAnim = s.anim({
    name: 'Bolt', duration: 700,
    tracks: [
      { object: hr.rootId, prop: 'x', keys: tidy([...h1.x, ...h2.x, ...h3.x, [72, 180, 'hold'], [640, 180, 'hold'], [641, 0, 'hold']]) },
      { object: hr.rootId, prop: 'y', keys: tidy([...h1.y, ...h2.y, ...h3.y, [72, -26, 'hold'], [640, -26, 'hold'], [641, 0, 'hold']]) },
      { object: hr.rootId, prop: 'opacity', keys: [[0, 1, 'hold'], [56, 1, 'linear'], [72, 0, 'hold'], [641, 0, 'linear'], [700, 1]] },
      { object: hr.earL, prop: 'rotation', keys: [[0, -0.25, 'cubic', EASE.out], [6, 0.5, 'hold'], [70, 0.5, 'hold'], [71, -0.25]] },
      { object: hr.earR, prop: 'rotation', keys: [[0, 0.1, 'cubic', EASE.out], [6, 0.9, 'hold'], [70, 0.9, 'hold'], [71, 0.1]] },
    ],
  });
  const hareHit = hit(ids, hx + 8, hy - 26, 90, 70, 'hareHit');
  s.listen(hareHit.id, 'enter', [Scene.fire(bolt)]);
  // the raven lifts off when clicked, circles out of frame, and comes back
  const fly = s.input('trigger', 'fly');
  const flap = (t0, t1) => swingKeys(t0, t1, 5, 0.9, 0, 1).map((k) => [k[0], k[1] < 1 ? -0.7 : 1.2, k[2], k[3]]);
  const flyAnim = s.anim({
    name: 'Fly', duration: 760,
    tracks: [
      { object: rv.flyId, prop: 'x', keys: [[0, 0, 'cubic', EASE.in], [60, -60, 'cubic', EASE.out], [130, -220, 'hold'], [600, 160, 'cubic', EASE.out], [700, 0]] },
      { object: rv.flyId, prop: 'y', keys: [[0, 0, 'cubic', EASE.out], [40, -60, 'cubic', EASE.inOut], [130, -200, 'hold'], [600, -180, 'cubic', [0.2, 0.6, 0.4, 1]], [700, 0]] },
      { object: rv.flyId, prop: 'opacity', keys: [[0, 1, 'hold'], [100, 1, 'linear'], [130, 0, 'hold'], [600, 0, 'linear'], [620, 1]] },
      { object: rv.flyId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [20, -0.4, 'cubic', EASE.inOut], [100, -0.2, 'hold'], [600, 0.25, 'cubic', EASE.out], [700, 0]] },
      { object: rv.wingId, prop: 'scaleY', keys: tidy([...flap(0, 110), [111, 1, 'hold'], ...flap(600, 700), [705, 1]]) },
      { object: rv.bodyId, prop: 'scaleY', keys: [[700, 1, 'cubic', EASE.out], [706, 0.86, 'cubic', EASE.back], [726, 1]] },
    ],
  });
  const ravenHit = hit(ids, post.x, postTop.y - 20, 56, 56, 'ravenHit');
  s.listen(ravenHit.id, 'click', [Scene.fire(fly)]);

  s.add(...ground, ...deer, ...rails, ...caps, ...stakes, ravenRoot, hareRoot, hareMound, ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts' }), hareHit.xml, ravenHit.xml);
  s.loopLayer('grow', s.anim({ name: 'Grow', duration: 300, tracks: grow }));
  ambient(s, amb, LOOP, 'Raven and hare');
  s.triggerLayer('bolt', bolt, boltAnim, { fromAny: false, mix: 0 });
  s.triggerLayer('fly', fly, flyAnim, { fromAny: false, mix: 0 });
  return s.toXml();
}

// ---------------------------------------------------------------- frozen lake

export function lake(ids) {
  const W = 720, H = 230;
  const s = new Scene(ids, { name: 'Lake', w: W, h: H, x: 0, y: 2140, bg: BG });
  const r = rng(523);
  const grow = [];
  const shoreY = 84;
  const far = treelineRow(r, { x0: -10, x1: W + 10, base: shoreY - 2, hMin: 24, hMax: 62, color: '8FA6A1', alpha: 0.3, gap: 22 });
  const point = treelineRow(r, { x0: -10, x1: 150, base: shoreY + 10, hMin: 34, hMax: 70, color: '6E8A84', alpha: 0.4, gap: 20 });
  const shore = [];
  for (let x = -20; x <= W + 20; x += 36) shore.push(P(x, shoreY + Math.sin(x / 150) * 3 + r.jit(1.5)));
  const iceId = ids.next();
  const ice = el('Node', { name: 'ice', id: iceId, opacity: 0 }, [
    el('Shape', { name: 'iceWash', blendModeValue: 'multiply' }, [pathXml([...shore, P(W + 20, H + 30), P(-20, H + 30)], { closed: true, tension: 0.8 }), fill(argb('CFDDE7', 0.42), { feather: 2 })]),
    ...[[60, 150, 320, 10], [380, 180, 300, 8], [160, 205, 260, 7]].map(([x, y, w, h]) => el('Shape', { name: 'streak', blendModeValue: 'multiply', x, y }, [el('Ellipse', { width: w, height: h, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('A9C0D2', 0.3), { feather: 5 })])),
    ...[[120, 130, 50, 10], [500, 120, 70, 9], [640, 190, 60, 12]].map(([x, y, w, h]) => el('Shape', { name: 'snowPatch', x, y }, [pathXml(blobPts(w / 2, h / 2, r, { n: 9, wobble: 0.2 }), { closed: true }), fill(argb('FFFFFF', 0.95), { feather: 1.5 })])),
    el('Shape', { name: 'shoreLine' }, [pathXml(shore, { tension: 0.8 }), stroke(argb('7F97AB', 0.45), 0.9)]),
  ].reverse());
  grow.push(appear(iceId, 10, 70));
  // someone skated loops here
  const skate = [];
  const loopPts = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    loopPts.push(P(330 + Math.sin(t) * 110 + Math.sin(t * 2) * 10, 160 + Math.sin(2 * t) * 24 + r.jit(0.6)));
  }
  skate.push(drawnLine(ids, loopPts, { width: 0.9, alpha: 0.45, color: '5E7488', tension: 1 }, 60, 150, grow));
  skate.push(drawnLine(ids, loopPts.map((p) => P(p.x + 3, p.y + 2.5)), { width: 0.7, alpha: 0.3, color: '5E7488', tension: 1 }, 66, 150, grow));
  const curl = [];
  for (let i = 0; i <= 20; i++) {
    const t = (i / 20) * Math.PI * 1.6;
    curl.push(P(560 + Math.cos(t) * 38, 150 + Math.sin(t) * 16));
  }
  skate.push(drawnLine(ids, curl, { width: 0.8, alpha: 0.4, color: '5E7488' }, 180, 70, grow));
  // ice-fishing hole with a tip-up
  const holeId = ids.next();
  const hole = P(142, 182);
  const flagId = ids.next();
  const fishing = el('Node', { name: 'fishing', id: holeId, opacity: 0 }, [
    el('Shape', { name: 'chunks' }, [pathXml(blobPts(16, 9, r, { n: 10, wobble: 0.25 }).map((p) => P(p.x + hole.x, p.y + hole.y)), { closed: true }), fill(argb('FFFFFF', 1)), stroke(argb('8EA6B8', 0.6), 0.7)]),
    el('Shape', { name: 'hole' }, [pathXml(blobPts(7.5, 4, r, { n: 9, wobble: 0.1 }).map((p) => P(p.x + hole.x, p.y + hole.y)), { closed: true }), fill(argb('2E3A44', 0.75), { feather: 0.8 })]),
    el('Shape', { name: 'sheen' }, [pathXml([P(hole.x - 4, hole.y - 1), P(hole.x + 2, hole.y - 2)], { tension: 0.5 }), stroke(argb('AFC6D8', 0.6), 0.8)]),
    // the tip-up: a stick across the hole with a flag arm that springs up on a bite
    inkShape({ pts: [P(hole.x - 14, hole.y - 1), P(hole.x + 14, hole.y - 3)], color: ink(0.9), width: 1.6, bleed: 0.1 }),
    el('Node', { name: 'flagArm', x: hole.x + 6, y: hole.y - 2, rotation: 1.35, id: flagId }, [
      el('Shape', { name: 'arm' }, [pathXml([P(0, 0), P(0, -26)]), stroke(ink(0.9), 1)]),
      el('Shape', { name: 'flag' }, [pathXml([P(0, -26), P(10, -22), P(0, -17)], { closed: true, tension: 0 }), fill(argb('C9302C', 0.9)), stroke(ink(0.6), 0.5)]),
    ].reverse()),
    el('Shape', { name: 'pailShadow', x: hole.x + 34, y: hole.y + 6 }, [el('Ellipse', { width: 22, height: 6, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb(SHADOW, 0.4), { feather: 3 })]),
    // an upturned pail to sit on
    el('Shape', { name: 'pail', blendModeValue: 'multiply' }, [pathXml([P(hole.x + 27, hole.y - 14), P(hole.x + 43, hole.y - 14), P(hole.x + 45, hole.y + 4), P(hole.x + 25, hole.y + 4)], { closed: true, tension: 0 }), fill(argb('5E7488', 0.55))]),
    inkShape({ pts: [P(hole.x + 27, hole.y - 14), P(hole.x + 43, hole.y - 14), P(hole.x + 45, hole.y + 4), P(hole.x + 25, hole.y + 4)], closed: true, tension: 0, color: ink(0.9), width: 1, bleed: 0.1 }),
    snowCap(r, [P(hole.x + 27, hole.y - 15), P(hole.x + 35, hole.y - 15), P(hole.x + 43, hole.y - 15)], 3),
  ].reverse());
  grow.push(appear(holeId, 120, 50));
  // boot prints out to the hole
  const steps = shoeTrail(ids, r, [P(40, 226), P(80, 212), P(112, 198), P(132, 190)], 5, 150, grow);
  // snow buntings swirl across now and then
  const fl = flock(ids, r, 8);
  const LOOP = 2600;
  const amb = [
    ...flockFlight(fl, { from: P(-70, 118), to: P(W + 70, 96), t0: 520, t1: 880, dip: 34 }),
    ...flockFlight(fl, { from: P(W + 70, 110), to: P(-70, 128), t0: 1800, t1: 2180, dip: 26 }),
    // a bite: the flag springs up, holds, and is reset
    { object: flagId, prop: 'rotation', keys: [[0, 1.35, 'hold'], [1200, 1.35, 'cubic', EASE.back], [1210, 0.05, 'cubic', EASE.out], [1230, -0.08, 'cubic', EASE.inOut], [1250, 0, 'hold'], [1700, 0, 'cubic', EASE.inOut], [1730, 1.35, 'hold']] },
  ];
  // merge the two flights per object/prop
  const merged = new Map();
  for (const t of amb) {
    const k = `${t.object}:${t.prop}`;
    if (!merged.has(k)) merged.set(k, { ...t, keys: [] });
    merged.get(k).keys.push(...t.keys);
  }
  const ambTracks = [...merged.values()].map((t) => ({ ...t, keys: tidy(t.keys) }));
  const g = glintLayer(s, ids, r, [[250, 140, 0.9], [420, 196, 0.7], [600, 150, 0.8], [330, 210, 0.6], [520, 120, 0.5], [680, 206, 0.7]]);
  const over = hit(ids, W / 2, 158, W, 150, 'iceHit');
  s.listen(over.id, 'enter', [Scene.setBool(g.over, true)]);
  s.listen(over.id, 'exit', [Scene.setBool(g.over, false)]);
  ambTracks.push(...twinkleTracks(g.gl.slice(2, 4), 200, 2400, r));

  s.add(...far, ...point, ice, ...skate, ...steps, fishing, g.xml, fl.xml, over.xml);
  s.loopLayer('grow', s.anim({ name: 'Grow', duration: 300, tracks: grow }));
  ambient(s, ambTracks, LOOP, 'Buntings');
  return s.toXml();
}

// ---------------------------------------------------------------- the snag, with a pileated woodpecker

export function snag(ids) {
  const W = 720, H = 250;
  const s = new Scene(ids, { name: 'Snag', w: W, h: H, x: 0, y: 2440, bg: BG });
  const r = rng(617);
  const grow = [];
  const base = 218;
  const fir = coniferAuto(ids, r, { cx: 560, base: base + 4, height: 200, maxW: 56, tiers: 11, color: FIR, alpha: 0.9, t0: 40, snowiness: 0.85 });
  const farId = ids.next();
  const far = el('Node', { name: 'farRow', id: farId, opacity: 0 }, treelineRow(r, { x0: 20, x1: 230, base: base - 2, hMin: 60, hMax: 150, color: '8FA6A1', alpha: 0.3, gap: 30 }));
  grow.push(appear(farId, 0, 80));
  // the snag: a dead birch, broken off, bark peeling
  const sx = 318, topY = 24;
  const center = resample([P(sx, base + 4), P(sx + 4, base - 90), P(sx + 2, topY)], 12);
  const half = (i) => 11 - i * 0.35;
  const L = center.map((p, i) => P(p.x - half(i) + r.jit(0.5), p.y));
  const R = center.map((p, i) => P(p.x + half(i) + r.jit(0.5), p.y));
  const breakTop = [P(L[L.length - 1].x, topY), P(sx - 4, topY - 12), P(sx + 1, topY - 2), P(sx + 5, topY - 16), P(R[R.length - 1].x, topY)];
  const trunkId = ids.next();
  const trunk = el('Node', { name: 'trunk', id: trunkId, opacity: 0 }, [
    el('Shape', { name: 'shade' }, [pathXml(R.map((p, i) => P(p.x - half(i) * 0.35, p.y)), { tension: 0.9 }), stroke(argb('8EA0B1', 0.32), 7, { feather: 2 })]),
    el('Shape', { name: 'white' }, [pathXml([...L, ...breakTop, ...[...R].reverse()], { closed: true, tension: 0.6 }), fill(argb('FFFFFF', 1))]),
    el('Shape', { name: 'weather', blendModeValue: 'multiply' }, [pathXml([P(sx - 6, base - 20), P(sx - 2, base - 80), P(sx + 1, base - 140), P(sx - 3, base - 20)], { closed: true, tension: 0.8 }), fill(argb('B9A48E', 0.25), { feather: 4 })]),
  ].reverse());
  grow.push(appear(trunkId, 10, 50));
  const lines = [
    drawnLine(ids, L, { width: 1.3 }, 0, 90, grow),
    drawnLine(ids, R, { width: 1.1, alpha: 0.85 }, 6, 90, grow),
    drawnLine(ids, breakTop, { width: 1.1, tension: 0.2 }, 90, 20, grow),
  ];
  // lenticels, peels, and the woodpecker's old excavations
  const marks = [];
  for (let k = 0; k < 30; k++) {
    const i = Math.floor(r.range(0.5, center.length - 1.5));
    const p = center[i];
    const len = half(i) * r.range(0.5, 1.1);
    const off = r.jit(half(i) - len / 2);
    const y = p.y + r.jit(7);
    marks.push([P(p.x + off - len / 2, y), P(p.x + off, y + r.jit(0.8)), P(p.x + off + len / 2, y + r.jit(0.8))]);
  }
  const mId = ids.next();
  const holes = [[sx + 1, base - 150, 5, 9], [sx - 3, base - 118, 4, 7]];
  const detail = el('Node', { name: 'marks', id: mId, opacity: 0 }, [
    ticks(marks.slice(0, 16), { width: 2, color: ink(0.8) }),
    ticks(marks.slice(16), { width: 1.1, color: ink(0.7) }),
    ...[0, 1, 2].map(() => {
      const i = Math.floor(r.range(2, center.length - 2));
      const p = center[i];
      return el('Shape', { name: 'peel', x: p.x + r.jit(half(i) * 0.4), y: p.y }, [pathXml(blobPts(half(i) * 0.5, 4, r, { n: 7 }), { closed: true }), fill(argb('D7B48E', 0.4), { feather: 1.2 })]);
    }),
    ...holes.map(([x, y, w, h]) => el('Shape', { name: 'hole', x, y }, [pathXml(blobPts(w, h, r, { n: 8, wobble: 0.15 }), { closed: true }), fill(argb('2A2520', 0.85), { feather: 0.6 }), stroke(argb('D9B98E', 0.8), 1.2)])),
  ]);
  grow.push(appear(mId, 60, 50));
  // a broken stub
  lines.push(drawnLine(ids, [P(sx + 10, base - 100), P(sx + 30, base - 112), P(sx + 42, base - 110)], { width: 1.6, tension: 0.8 }, 70, 30, grow));
  lines.push(drawnLine(ids, [P(sx + 11, base - 96), P(sx + 30, base - 106), P(sx + 42, base - 108)], { width: 1.2, alpha: 0.8, tension: 0.8 }, 74, 30, grow));
  const stubCapId = ids.next();
  const stubCap = snowCap(r, [P(sx + 14, base - 104), P(sx + 24, base - 110), P(sx + 34, base - 114), P(sx + 42, base - 113)], 4, { id: stubCapId, opacity: 0 });
  grow.push(appear(stubCapId, 110, 30));
  // chips on the snow below the work
  const chipBed = el('Node', { name: 'chipBed' }, [0, 1, 2, 3, 4, 5, 6, 7].map(() => el('Shape', { name: 'c', x: sx + r.range(-26, 30), y: base + r.range(-2, 6) }, [pathXml(blobPts(2, 1.2, r, { n: 5, wobble: 0.3 }), { closed: true }), fill(argb('D9B98E', 0.9))])));
  // the bird
  const wp = woodpecker(ids, r);
  const wx = sx + 28, wy = base - 72;
  const birdId = ids.next();
  const bird = el('Node', { name: 'birdAt', x: wx, y: wy, id: birdId, opacity: 0 }, wp.xml);
  grow.push(appear(birdId, 130, 30));
  const beak = P(wx - 21, wy - 30);
  const amb = [];
  const LOOP = 1100;
  const ambChips = [...chips(ids, r, beak, 160, amb, 4), ...chips(ids, r, beak, 640, amb, 3)];
  amb.push({ object: wp.headId, prop: 'rotation', keys: tidy([[0, 0, 'hold'], ...peckKeys(150, 6, 5), ...peckKeys(630, 4, 6), [900, 0, 'cubic', EASE.out], [910, 0.25, 'hold'], [980, 0.25, 'cubic', EASE.out], [990, 0, 'hold']]) });
  // click: a proper drum roll
  const drum = s.input('trigger', 'drum');
  const dr = [];
  const drumChips = chips(ids, r, beak, 4, dr, 6);
  dr.push({ object: wp.headId, prop: 'rotation', keys: peckKeys(0, 12, 4) });
  const birdHit = hit(ids, wx - 4, wy - 14, 60, 70, 'birdHit');
  s.listen(birdHit.id, 'click', [Scene.fire(drum)]);
  const ground = drift(r, { x0: -30, x1: W + 30, y: base + 8, h: 18, shadows: [{ x: sx, y: base + 2, rx: 60, ry: 8 }, { x: 560, y: base + 4, rx: 70, ry: 8 }] });
  const tufts = [];
  for (const gx of [60, 220, 420, 660]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, base + 6), P(gx + k * 3 + r.jit(6) - 4, base + 6 - r.range(6, 14))]);
  const tuftId = ids.next();
  grow.push(appear(tuftId, 160, 40));

  s.add(
    far,
    ...ground, chipBed,
    trunk, ...lines, detail, stubCap, bird, ...ambChips, ...drumChips,
    ...fir.back, ...fir.mid, ...fir.front,
    ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts' }),
    birdHit.xml,
  );
  s.loopLayer('grow', s.anim({ name: 'Grow', duration: 300, tracks: [...grow, ...gatherTracks()] }));
  ambient(s, amb, LOOP, 'Tapping');
  s.triggerLayer('drum', drum, s.anim({ name: 'Drum', duration: 80, tracks: dr }), { fromAny: false, mix: 0 });
  return s.toXml();
}
