// Pressed botanical specimens, drawn as fine sepia ink with faded watercolor.
// Each builder returns parts in specimen space (origin at the plate centre):
//   ink:   [{ pts, closed, tension, width }]     drawn on with the plate's trim
//   wash:  [{ pts, color, alpha, dx, dy }]        faded colour, a little off the line
//   tapes: [{ x, y, rot, w }]                     gummed paper strips holding it down
//   loose: { ink, wash, x, y }                    one petal/leaf that has come unstuck
import { rng, P, TAU, resample } from '../lib/ink.mjs';

const rot = (p, a) => P(p.x * Math.cos(a) - p.y * Math.sin(a), p.x * Math.sin(a) + p.y * Math.cos(a));
const add = (p, q) => P(p.x + q.x, p.y + q.y);
const place = (pts, at, a = 0, s = 1) => pts.map((p) => add(rot(P(p.x * s, p.y * s), a), at));

// a leaf outline along +x: length L, half-width W, shape exponent, optional teeth
export function leafOutline(L, W, { n = 16, tip = 1, teeth = 0, toothDepth = 0.12, base = 0.6, r } = {}) {
  const top = [];
  const bot = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let w = Math.pow(Math.sin(Math.PI * Math.pow(t, base)), tip) * W;
    if (teeth) w *= 1 - toothDepth * (Math.sin(t * teeth * TAU) > 0 ? 1 : 0) * (t > 0.08 && t < 0.95 ? 1 : 0);
    const j = r ? r.jit(W * 0.03) : 0;
    top.push(P(t * L, -w + j));
    bot.push(P(t * L, w * 0.92 - j));
  }
  return [...top, ...bot.reverse().slice(1, -1)];
}

// heart-shaped leaf (violet), pointing along +x from its petiole
function cordate(L, W, r) {
  const pts = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    // cardioid-ish: notch at the base (a = PI), point at the tip (a = 0)
    const k = 1 - 0.28 * Math.pow(Math.max(0, Math.cos((a - Math.PI) / 2) ** 8), 1) + r.jit(0.03);
    const x = (Math.cos(a) * 0.5 + 0.5) * L * k;
    const y = Math.sin(a) * W * (0.75 + 0.25 * Math.cos(a)) * k;
    pts.push(P(x + (Math.abs(Math.cos(a)) > 0.95 && Math.cos(a) < 0 ? L * 0.08 : 0), y));
  }
  return pts;
}

// ---------------------------------------------------------------- fern
export function fern(seed = 1) {
  const r = rng(seed);
  const ink = [];
  const wash = [];
  const rachis = resample([P(-20, 320), P(-6, 160), P(4, 0), P(18, -160), P(42, -300)], 40);
  ink.push({ pts: rachis, width: 1.4 });
  // root fibres
  for (let i = 0; i < 6; i++) ink.push({ pts: [P(-20, 320), P(-20 + r.jit(16), 334), P(-20 + r.jit(30), 346 + r.range(0, 14))], width: 0.6 });
  for (let i = 4; i < 38; i++) {
    const t = i / 39;
    const side = i % 2 ? 1 : -1;
    const at = rachis[i];
    const next = rachis[Math.min(39, i + 1)];
    const dir = Math.atan2(next.y - at.y, next.x - at.x);
    const len = Math.sin(Math.PI * Math.min(1, (1 - t) * 1.25)) * 120 * (0.85 + r.jit(0.08)) + 12;
    const a = dir + side * (Math.PI / 2 - 0.55);
    // scalloped pinna: lobes along both edges
    const lob = leafOutline(len, 9 + len * 0.05, { n: 18, teeth: Math.max(3, Math.round(len / 13)), toothDepth: 0.35, base: 0.75, r });
    const pts = place(lob, at, a);
    ink.push({ pts, closed: true, tension: 0.55, width: 0.8 });
    ink.push({ pts: place([P(2, 0), P(len * 0.85, 0)], at, a), width: 0.5, soft: true });
    wash.push({ pts, color: '7E9467', alpha: 0.42 });
  }
  return {
    latin: 'Polypodium vulgare',
    ink, wash,
    tapes: [{ x: -14, y: 250, rot: 0.12, w: 70 }, { x: 10, y: -40, rot: -0.2, w: 58 }, { x: 34, y: -250, rot: 0.3, w: 46 }],
    loose: (() => {
      const lob = leafOutline(46, 8, { n: 14, teeth: 4, toothDepth: 0.35, base: 0.75, r });
      return { x: 150, y: 190, rot: 0.6, ink: [{ pts: lob, closed: true, tension: 0.55, width: 0.8 }], wash: [{ pts: lob, color: '7E9467', alpha: 0.42 }] };
    })(),
  };
}

// ---------------------------------------------------------------- violet
export function violet(seed = 2) {
  const r = rng(seed);
  const ink = [];
  const wash = [];
  const stems = [
    { path: [P(0, 320), P(-30, 200), P(-70, 90), P(-90, -20)], flower: true },
    { path: [P(0, 320), P(20, 210), P(60, 120), P(110, 40)], flower: true },
    { path: [P(0, 320), P(-6, 200), P(10, 60), P(30, -150)], flower: true },
    { path: [P(0, 320), P(-40, 260), P(-120, 220)], leaf: 1.1 },
    { path: [P(0, 320), P(40, 270), P(130, 250)], leaf: 1 },
    { path: [P(0, 320), P(-10, 250), P(-60, 140)], leaf: 0.85 },
  ];
  const flowerAt = [];
  for (const s of stems) {
    const pts = resample(s.path, 8).map((p) => P(p.x + r.jit(1.5), p.y + r.jit(1.5)));
    ink.push({ pts, width: 1 });
    const end = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const dir = Math.atan2(end.y - prev.y, end.x - prev.x);
    if (s.leaf) {
      const lf = place(cordate(90 * s.leaf, 52 * s.leaf, r), end, dir);
      ink.push({ pts: lf, closed: true, tension: 0.9, width: 0.9 });
      // palmate veins
      for (const va of [-0.7, -0.3, 0, 0.3, 0.7]) ink.push({ pts: place([P(8, 0), P(40 * s.leaf, va * 18 * s.leaf), P(70 * s.leaf, va * 34 * s.leaf)], end, dir), width: 0.45, soft: true });
      wash.push({ pts: lf, color: '7F9A5C', alpha: 0.5 });
    }
    if (s.flower) flowerAt.push({ at: end, dir });
  }
  // flowers: nodding, five petals, two upper, two lateral, one lower with dark guide lines
  for (const f of flowerAt) {
    const c = add(f.at, rot(P(6, 22), f.dir - Math.PI / 2));
    const petals = [
      { a: -2.2, L: 34, W: 15 }, { a: -0.95, L: 34, W: 15 },
      { a: -2.9, L: 28, W: 12 }, { a: -0.25, L: 28, W: 12 },
      { a: 1.57, L: 32, W: 17, guide: true },
    ];
    for (const p of petals) {
      const a = p.a + r.jit(0.1);
      const pts = place(leafOutline(p.L, p.W, { n: 10, base: 0.55, tip: 0.8, r }), c, a);
      ink.push({ pts, closed: true, tension: 0.9, width: 0.85 });
      wash.push({ pts, color: '6E5BA6', alpha: 0.52 });
      if (p.guide) for (const g of [-4, 0, 4]) ink.push({ pts: place([P(4, g * 0.5), P(16, g)], c, a), width: 0.5 });
    }
    ink.push({ pts: [add(c, P(-2, -2)), add(c, P(3, 1))], width: 2.2 });
  }
  const lp = leafOutline(30, 13, { n: 10, base: 0.55, tip: 0.8, r });
  return {
    latin: 'Viola odorata',
    ink, wash,
    tapes: [{ x: 2, y: 300, rot: -0.1, w: 74 }, { x: -64, y: 110, rot: 0.5, w: 50 }, { x: 72, y: 110, rot: -0.4, w: 50 }],
    loose: { x: 150, y: -160, rot: 2.4, ink: [{ pts: lp, closed: true, tension: 0.9, width: 0.85 }], wash: [{ pts: lp, color: '6E5BA6', alpha: 0.52 }] },
  };
}

// ---------------------------------------------------------------- ginkgo
function ginkgoLeaf(r, size = 1) {
  // a fan: two lobes with a notch at the top centre, wedge narrowing to the petiole
  const R = 78 * size;
  const out = [P(0, 0)];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = -Math.PI / 2 - 0.95 + t * 1.9;
    const notch = Math.abs(t - 0.5) < 0.06 ? 0.72 : 1;
    const wav = 1 + Math.sin(t * 34) * 0.02 + r.jit(0.015);
    out.push(P(Math.cos(a) * R * notch * wav, Math.sin(a) * R * notch * wav));
  }
  const veins = [];
  for (let i = 1; i < 12; i++) {
    const a = -Math.PI / 2 - 0.88 + (i / 12) * 1.76;
    veins.push([P(Math.cos(a) * 6, Math.sin(a) * 6), P(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92)]);
  }
  return { outline: out, veins };
}

export function ginkgo(seed = 3) {
  const r = rng(seed);
  const ink = [];
  const wash = [];
  const leaves = [
    { base: P(-10, 300), tip: P(-70, 40), size: 1.25 },
    { base: P(-10, 300), tip: P(40, 10), size: 1.1 },
    { base: P(-10, 300), tip: P(-140, 150), size: 0.95 },
    { base: P(-10, 300), tip: P(110, 130), size: 1 },
    { base: P(-10, 300), tip: P(-20, -150), size: 1.15 },
  ];
  // a short spur twig the leaves come from
  ink.push({ pts: [P(-24, 340), P(-14, 312), P(-8, 296)], width: 2.2 });
  for (const l of leaves) {
    const pet = resample([l.base, P((l.base.x + l.tip.x) / 2 + r.jit(14), (l.base.y + l.tip.y) / 2), l.tip], 6);
    ink.push({ pts: pet, width: 0.9 });
    const dir = Math.atan2(l.tip.y - pet[4].y, l.tip.x - pet[4].x) + Math.PI / 2;
    const g = ginkgoLeaf(r, l.size);
    const o = place(g.outline, l.tip, dir);
    ink.push({ pts: o, closed: true, tension: 0.7, width: 1 });
    for (const v of g.veins) ink.push({ pts: place(v, l.tip, dir), width: 0.4, soft: true });
    wash.push({ pts: o, color: 'D6AE3E', alpha: 0.55 });
  }
  const g = ginkgoLeaf(r, 0.55);
  return {
    latin: 'Ginkgo biloba',
    ink, wash,
    tapes: [{ x: -14, y: 312, rot: 0.25, w: 64 }, { x: -80, y: 70, rot: -0.6, w: 48 }, { x: 70, y: 70, rot: 0.5, w: 48 }],
    loose: { x: 140, y: -200, rot: 0.5, ink: [{ pts: g.outline, closed: true, tension: 0.7, width: 1 }, ...g.veins.filter((_, i) => i % 2).map((v) => ({ pts: v, width: 0.4, soft: true }))], wash: [{ pts: g.outline, color: 'D6AE3E', alpha: 0.55 }] },
  };
}

// ---------------------------------------------------------------- maple + samaras
function samara(r, s = 1) {
  // seed at origin, wing sweeping along +x and curving up
  const wing = [P(0, -6), P(20, -14), P(52, -20), P(86, -20), P(104, -12), P(100, 0), P(70, 4), P(36, 6), P(10, 7)].map((p) => P(p.x * s, p.y * s + r.jit(0.6)));
  const seed = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    seed.push(P(Math.cos(a) * 11 * s - 2, Math.sin(a) * 8 * s));
  }
  const veins = [0.25, 0.45, 0.65, 0.85].map((t) => [P(8 * s, 0), P(104 * s * t, -18 * s * t + 4 * s)]);
  return { wing, seed, veins };
}

export function maple(seed = 4) {
  const r = rng(seed);
  const ink = [];
  const wash = [];
  // palmate leaf: five pointed lobes with rounded sinuses and fine teeth, in polar form
  const c = P(-30, 30);
  const R = 120;
  const lobes = [[-Math.PI / 2, 1], [-Math.PI / 2 - 0.92, 0.88], [-Math.PI / 2 + 0.92, 0.88], [-Math.PI / 2 - 1.85, 0.55], [-Math.PI / 2 + 1.85, 0.55]];
  const outline = [];
  const N = 120;
  for (let i = 0; i < N; i++) {
    const th = -Math.PI / 2 + Math.PI - (i / N) * TAU; // start at the petiole, go round
    let rr = 0.3;
    for (const [ca, L] of lobes) {
      let d = Math.abs(th - ca);
      d = Math.min(d, TAU - d);
      rr = Math.max(rr, L * (0.36 + 0.64 * Math.pow(Math.max(0, 1 - d / 0.62), 1.35)));
    }
    const teeth = 1 + 0.045 * Math.sin(i * 1.7) * (rr > 0.42 ? 1 : 0);
    const notch = Math.abs(((th - Math.PI / 2 + TAU * 3) % TAU) - Math.PI) > Math.PI - 0.25 ? 0.55 : 1;
    outline.push(add(c, P(Math.cos(th) * R * rr * teeth * notch, Math.sin(th) * R * rr * teeth * notch + r.jit(0.6))));
  }
  for (const [ca, L] of lobes) ink.push({ pts: [c, add(c, P(Math.cos(ca) * R * L * 0.55, Math.sin(ca) * R * L * 0.55 + 3)), add(c, P(Math.cos(ca) * R * L * 0.92, Math.sin(ca) * R * L * 0.92))], width: 0.5, soft: true });
  ink.push({ pts: outline, closed: true, tension: 0.35, width: 1 });
  ink.push({ pts: [add(c, P(0, 16)), add(c, P(-6, 90)), add(c, P(-22, 170))], width: 1.1 });
  wash.push({ pts: outline, color: 'C25B39', alpha: 0.5 });
  wash.push({ pts: outline.filter((_, i) => i % 4 === 0).map((p) => P((p.x - c.x) * 0.55 + c.x + 6, (p.y - c.y) * 0.55 + c.y - 6)), color: 'D9A441', alpha: 0.35 });

  // a pair of samaras joined at the seeds, and a single one
  const pairAt = P(80, 230);
  for (const [a, flip] of [[-0.5, 1], [-2.5, -1]]) {
    const sm = samara(r, 0.95);
    const tf = (pts) => place(pts.map((p) => P(p.x, p.y * flip)), pairAt, a);
    ink.push({ pts: tf(sm.wing), closed: true, tension: 0.8, width: 0.9 });
    ink.push({ pts: tf(sm.seed), closed: true, width: 0.9 });
    for (const v of sm.veins) ink.push({ pts: tf(v), width: 0.4, soft: true });
    wash.push({ pts: tf(sm.wing), color: 'B98A57', alpha: 0.4 });
    wash.push({ pts: tf(sm.seed), color: '8C6239', alpha: 0.55 });
  }
  ink.push({ pts: [pairAt, P(pairAt.x + 4, pairAt.y + 30), P(pairAt.x - 2, pairAt.y + 58)], width: 0.8 });
  const one = samara(r, 0.8);
  return {
    latin: 'Acer saccharum',
    ink, wash,
    tapes: [{ x: -50, y: 180, rot: 0.15, w: 60 }, { x: 86, y: 250, rot: -0.35, w: 52 }, { x: -110, y: -60, rot: 0.9, w: 44 }],
    loose: {
      x: -110, y: 260, rot: -0.4,
      ink: [{ pts: one.wing, closed: true, tension: 0.8, width: 0.9 }, { pts: one.seed, closed: true, width: 0.9 }, ...one.veins.map((v) => ({ pts: v, width: 0.4, soft: true }))],
      wash: [{ pts: one.wing, color: 'B98A57', alpha: 0.4 }, { pts: one.seed, color: '8C6239', alpha: 0.55 }],
    },
  };
}

// ---------------------------------------------------------------- lavender
export function lavender(seed = 5) {
  const r = rng(seed);
  const ink = [];
  const wash = [];
  const stems = [
    [P(0, 330), P(-14, 100), P(-40, -150), P(-60, -300)],
    [P(4, 330), P(10, 90), P(18, -170), P(30, -320)],
    [P(8, 330), P(30, 120), P(70, -100), P(110, -240)],
  ];
  for (const s of stems) {
    const pts = resample(s, 24);
    ink.push({ pts: pts.map((p) => P(p.x + r.jit(0.8), p.y)), width: 1 });
    // flower spike: whorls of small calyces up the top third
    for (let i = 13; i < 24; i++) {
      const at = pts[i];
      const t = (i - 13) / 10;
      const size = 1 - t * 0.45;
      for (const side of [-1, 1]) {
        for (let k = 0; k < 2; k++) {
          const a = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x) + side * (0.5 + k * 0.5) + r.jit(0.15);
          const fl = place(leafOutline(13 * size, 4.5 * size, { n: 6, base: 0.5, r }), at, a);
          ink.push({ pts: fl, closed: true, tension: 0.9, width: 0.6 });
          wash.push({ pts: fl.map((p) => P(p.x * 1.08 - at.x * 0.08, p.y * 1.08 - at.y * 0.08)), color: '8673B6', alpha: 0.55 });
        }
      }
    }
    // narrow grey-green leaves low on the stem
    for (const i of [3, 6]) {
      const at = pts[i];
      for (const side of [-1, 1]) {
        const lf = place(leafOutline(70, 5, { n: 10, base: 0.7, r }), at, -Math.PI / 2 + side * 0.45 + r.jit(0.1));
        ink.push({ pts: lf, closed: true, tension: 0.8, width: 0.7 });
        wash.push({ pts: lf, color: '8FA48B', alpha: 0.5 });
      }
    }
  }
  const loose = [];
  const lwash = [];
  for (let k = 0; k < 3; k++) {
    const fl = place(leafOutline(12, 4.5, { n: 6, base: 0.5, r }), P(k * 14, r.jit(5)), r.range(0, TAU));
    loose.push({ pts: fl, closed: true, tension: 0.9, width: 0.6 });
    lwash.push({ pts: fl, color: '8673B6', alpha: 0.55 });
  }
  return {
    latin: 'Lavandula angustifolia',
    ink, wash,
    tapes: [{ x: 6, y: 280, rot: -0.08, w: 70 }, { x: -18, y: 20, rot: 0.25, w: 60 }],
    loose: { x: 130, y: 90, rot: 0.3, ink: loose, wash: lwash },
  };
}

// ---------------------------------------------------------------- oak
export function oak(seed = 6) {
  const r = rng(seed);
  const ink = [];
  const wash = [];
  // lobed leaf along -y: rounded lobes alternate, deep sinuses
  const L = 300;
  const side = (s) => {
    const pts = [];
    const lobesN = 5;
    for (let i = 0; i <= lobesN * 4; i++) {
      const t = i / (lobesN * 4);
      const env = Math.sin(Math.PI * Math.pow(t, 0.8)) * 70 + 8;
      const lobe = 0.45 + 0.55 * Math.pow(Math.abs(Math.sin(t * lobesN * Math.PI + (s > 0 ? 0.6 : 0))), 0.7);
      pts.push(P(s * env * lobe + r.jit(2), -t * L));
    }
    return pts;
  };
  const left = side(-1);
  const right = side(1).reverse();
  const outline = [...left, ...right.slice(1)].map((p) => P(p.x - 40, p.y + 140));
  ink.push({ pts: outline, closed: true, tension: 0.8, width: 1 });
  ink.push({ pts: [P(-40, 210), P(-40, 140), P(-36, 0), P(-40, -150)], width: 1 });
  for (let i = 1; i < 6; i++) {
    const y = 140 - i * 52;
    ink.push({ pts: [P(-39, y), P(-80, y - 30)], width: 0.45, soft: true });
    ink.push({ pts: [P(-39, y + 10), P(2, y - 18)], width: 0.45, soft: true });
  }
  wash.push({ pts: outline, color: 'A97C43', alpha: 0.5 });
  wash.push({ pts: outline.filter((_, i) => i % 2).map((p) => P(p.x * 0.7 - 12, p.y * 0.85 + 10)), color: '8D9A55', alpha: 0.3 });
  // acorn: nut + cap with cross-hatched scales, on a short stalk
  const ac = P(110, 210);
  const nut = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    nut.push(P(ac.x + Math.cos(a) * 22, ac.y + 14 + Math.sin(a) * 30 * (Math.sin(a) > 0 ? 1.1 : 0.8)));
  }
  const cap = [P(ac.x - 27, ac.y + 2), P(ac.x - 24, ac.y - 14), P(ac.x, ac.y - 22), P(ac.x + 24, ac.y - 14), P(ac.x + 27, ac.y + 2), P(ac.x, ac.y + 8)];
  ink.push({ pts: nut, closed: true, width: 1 });
  ink.push({ pts: cap, closed: true, tension: 0.7, width: 1 });
  for (let i = -3; i <= 3; i++) {
    ink.push({ pts: [P(ac.x + i * 7 - 6, ac.y - 16), P(ac.x + i * 7 + 4, ac.y + 4)], width: 0.45, soft: true });
    ink.push({ pts: [P(ac.x + i * 7 + 6, ac.y - 16), P(ac.x + i * 7 - 4, ac.y + 4)], width: 0.45, soft: true });
  }
  ink.push({ pts: [P(ac.x, ac.y - 22), P(ac.x + 4, ac.y - 34), P(ac.x - 2, ac.y - 44)], width: 1.2 });
  wash.push({ pts: nut, color: 'B68B4C', alpha: 0.55 });
  wash.push({ pts: cap, color: '7C6A45', alpha: 0.55 });
  const lone = cap.map((p) => P(p.x - ac.x, p.y - ac.y));
  return {
    latin: 'Quercus rubra',
    ink, wash,
    tapes: [{ x: -40, y: 180, rot: 0.1, w: 60 }, { x: -40, y: -110, rot: -0.3, w: 56 }, { x: 110, y: 170, rot: 0.4, w: 46 }],
    loose: { x: 130, y: -120, rot: 2.2, ink: [{ pts: lone, closed: true, tension: 0.7, width: 1 }], wash: [{ pts: lone, color: '7C6A45', alpha: 0.55 }] },
  };
}

// ---------------------------------------------------------------- forget-me-not
function tinyFlower(r, at, size = 1) {
  const ink = [];
  const wash = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU + r.jit(0.12);
    const pet = [];
    for (let i = 0; i < 7; i++) {
      const b = (i / 7) * TAU;
      pet.push(P(Math.cos(b) * 6.5 * size + 8 * size, Math.sin(b) * 6 * size));
    }
    const pts = place(pet, at, a);
    ink.push({ pts, closed: true, width: 0.55 });
    wash.push({ pts, color: '5E8FCB', alpha: 0.6 });
  }
  const eye = [];
  for (let i = 0; i < 6; i++) eye.push(add(at, P(Math.cos((i / 6) * TAU) * 2.6 * size, Math.sin((i / 6) * TAU) * 2.6 * size)));
  wash.push({ pts: eye, color: 'E3B53C', alpha: 0.9 });
  return { ink, wash };
}

export function forgetMeNot(seed = 7) {
  const r = rng(seed);
  const ink = [];
  const wash = [];
  const branches = [
    [P(0, 330), P(-6, 200), P(-20, 60), P(-50, -60), P(-70, -180)],
    [P(-10, 170), P(40, 70), P(90, -20), P(100, -140)],
    [P(-30, 30), P(-110, -40), P(-150, -120)],
  ];
  for (const b of branches) {
    const pts = resample(b, 20);
    ink.push({ pts, width: 0.95 });
    // the cyme coils at the tip, flowers open from the bottom up
    for (let i = 8; i < 20; i += 2) {
      const at = pts[i];
      const off = P(r.jit(14) + (i % 4 ? 12 : -12), r.jit(6));
      const fat = add(at, off);
      ink.push({ pts: [at, fat], width: 0.5 });
      const f = tinyFlower(r, fat, 1 - (i - 8) / 26);
      ink.push(...f.ink);
      wash.push(...f.wash);
    }
    const tip = pts[19];
    ink.push({ pts: [tip, add(tip, P(6, -8)), add(tip, P(12, -4)), add(tip, P(9, 2))], width: 0.7 });
    // lance leaves along the lower stem
    for (const i of [3, 7]) {
      const at = pts[i];
      const lf = place(leafOutline(64, 12, { n: 10, base: 0.6, r }), at, (i % 2 ? -0.6 : -2.5) + r.jit(0.2));
      ink.push({ pts: lf, closed: true, tension: 0.8, width: 0.8 });
      wash.push({ pts: lf, color: '7E9A5E', alpha: 0.48 });
    }
  }
  const lf = tinyFlower(r, P(0, 0), 1.1);
  return {
    latin: 'Myosotis sylvatica',
    ink, wash,
    tapes: [{ x: -2, y: 290, rot: 0.06, w: 66 }, { x: 40, y: 80, rot: -0.55, w: 48 }, { x: -96, y: -60, rot: 0.6, w: 44 }],
    loose: { x: 120, y: 200, rot: 0.2, ink: lf.ink, wash: lf.wash },
  };
}
