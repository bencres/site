// Draft 10 · Nook — a narrow old townhouse on a quiet rainy evening.
// Frontal, patient ink over soft blue-grey washes; the windows warm up one by
// one as the lamps go on, rain falls faintly, smoke curls, a cat watches.
// Each lit window belongs to a section of the site (see site/nook/main.js).
import { Ids, Scene, rng, P, TAU, el, argb, document, boil, pathXml, fill, stroke, blobPts, EASE, darken, lighten } from '../lib/ink.mjs';
import { line, poly, rect, curve, arc, inkXml, wash, bloom, grain, backrun, glow, brushEdge } from './paint.mjs';

export const W = 640;
export const H = 960;
const INK = 'FF3B3733';
const INK_SOFT = argb('3B3733', 0.55);
const INK_FAINT = argb('3B3733', 0.32);

const PAL = {
  sky: 'B3BBC9',
  indigo: '5F6A8C',
  dusk: 'D9BFA6',
  street: 'A9A7B5',
  streetDeep: '6F6E82',
  wall: 'C7A48F',
  wallDeep: '9E7F6D',
  gable: 'D8C6B3',
  slate: '6D7488',
  door: '4C6B64',
  fascia: '3F5A55',
  frame: '5A5F6A',
  pane: '8A97AB',
  warm: 'EFC572',
  warmCore: 'FBE7B0',
  lamp: 'F3D48A',
  leaf: '7E9A6B',
  smoke: '8D8E98',
  rain: 'A5B0C2',
};

// window geometry: the site's sections live in these
const GROUND = 792;
const EAVE = 266;
const APEX = P(320, 118);
export const WINDOWS = {
  now: { x0: 296, y0: 170, x1: 344, y1: 232, arch: 24 }, // attic, with the desk lamp
  work: { x0: 204, y0: 310, x1: 262, y1: 388 },
  projects: { x0: 378, y0: 310, x1: 436, y1: 388 }, // the cat's window
  writing: { x0: 204, y0: 456, x1: 262, y1: 534 }, // the one with the curtain
  elsewhere: { x0: 378, y0: 456, x1: 436, y1: 534 },
  hello: { x0: 296, y0: 644, x1: 344, y1: GROUND, arch: 24, door: true },
};
const SHOP = [
  { x0: 196, y0: 648, x1: 272, y1: 756 },
  { x0: 368, y0: 648, x1: 444, y1: 756 },
];
const ORDER = ['now', 'work', 'projects', 'writing', 'elsewhere', 'hello'];
const WALL = { x0: 172, x1: 468 };
const LAMP = { x: 562, top: 522, base: GROUND, glass: { y0: 524, y1: 558 } };
const CHIMNEY = { x0: 386, x1: 418, top: 136 };

// y of the roof slope at a given x
const roofY = (x) => APEX.y + (Math.abs(x - APEX.x) / (APEX.x - 150)) * (EAVE + 6 - APEX.y);

// a window outline as points (rect, or rect with a round-arched top)
function winPts(w, inset = 0) {
  const { x0, y0, x1, y1, arch } = w;
  const a = x0 + inset, b = x1 - inset, t = y0 + inset, bt = y1 - inset;
  if (!arch) return [P(a, t), P(b, t), P(b, bt), P(a, bt)];
  const cx = (a + b) / 2;
  const rr = (b - a) / 2;
  const cy = t + rr;
  const pts = [P(a, bt), P(a, cy)];
  for (let i = 1; i < 10; i++) {
    const ang = Math.PI + (Math.PI * i) / 10;
    pts.push(P(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr));
  }
  pts.push(P(b, cy), P(b, bt));
  return pts;
}

function house(ids) {
  const s = new Scene(ids, { name: 'House', w: W, h: H, bg: process.env.PREVIEW_BG });
  const r = rng(1010);
  const intro = []; // tracks for the load animation
  const fadeIn = (id, start, dur, from = 0) => intro.push({ object: id, prop: 'opacity', keys: [[0, from, 'hold'], [start, from, 'cubic', EASE.soft], [start + dur, 1]] });

  // ------------------------------------------------------------ paper + sky
  // the painting sits inside a ragged edge so paper shows all around it
  const paperEdge = brushEdge([P(28, 30), P(W - 28, 26), P(W - 26, H - 28), P(30, H - 26)], r, { step: 34, wob: 7 });
  const skyId = ids.next();
  const sr = r.fork();
  s.add(
    el('Node', { name: 'Sky', id: skyId, opacity: 0 }, [
      wash({ name: 'skyBase', pts: paperEdge, color: PAL.sky, alpha: 0.5, soft: 9, edge: 0.3, tension: 0.5, r: sr, rough: false }),
      bloom({ name: 'indigo', cx: 320, cy: 90, w: 700, h: 260, color: PAL.indigo, alpha: 0.34, r: sr, count: 5, soft: 0.8 }),
      bloom({ name: 'indigoSide', cx: 80, cy: 330, w: 220, h: 500, color: PAL.indigo, alpha: 0.22, r: sr, count: 4, soft: 0.8 }),
      bloom({ name: 'indigoSide2', cx: 580, cy: 300, w: 180, h: 420, color: PAL.indigo, alpha: 0.18, r: sr, count: 3, soft: 0.8 }),
      bloom({ name: 'dusk', cx: 330, cy: 480, w: 560, h: 260, color: PAL.dusk, alpha: 0.26, r: sr, count: 4, soft: 0.9 }),
      backrun({ cx: 120, cy: 200, rx: 46, ry: 30, color: PAL.sky, alpha: 0.16, r: sr }),
      backrun({ cx: 540, cy: 160, rx: 30, ry: 22, color: PAL.sky, alpha: 0.14, r: sr }),
      grain({ cx: 320, cy: 200, w: 560, h: 330, color: PAL.indigo, alpha: 0.2, r: sr, count: 520 }),
      // street: cool violet-grey, darker at the kerb, with a wet shine left as lighter paper
      wash({ name: 'street', pts: [P(40, GROUND + 6), P(600, GROUND + 4), P(606, 926), P(36, 930)], color: PAL.street, alpha: 0.52, soft: 7, edge: 0.4, r: sr, wob: 4 }),
      bloom({ name: 'kerbShadow', cx: 320, cy: GROUND + 24, w: 560, h: 50, color: PAL.streetDeep, alpha: 0.22, r: sr, count: 5, soft: 0.9, spread: 0.4 }),
      bloom({ name: 'streetDeep', cx: 110, cy: 900, w: 240, h: 90, color: PAL.streetDeep, alpha: 0.12, r: sr, count: 3, soft: 0.9 }),
      bloom({ name: 'streetDeep2', cx: 560, cy: 905, w: 160, h: 80, color: PAL.streetDeep, alpha: 0.1, r: sr, count: 3, soft: 0.9 }),
      grain({ cx: 320, cy: 870, w: 560, h: 130, color: PAL.streetDeep, alpha: 0.22, r: sr, count: 420 }),
    ])
  );
  fadeIn(skyId, 0, 110);

  // ------------------------------------------------------------ the house in colour
  const wr = r.fork();
  const wallPts = [P(WALL.x0, EAVE), P(WALL.x1, EAVE), P(WALL.x1, GROUND), P(WALL.x0, GROUND)];
  const gablePts = [P(WALL.x0 + 2, EAVE + 2), P(APEX.x, APEX.y + 14), P(WALL.x1 - 2, EAVE + 2)];
  const stainStreaks = [];
  for (let i = 0; i < 7; i++) {
    const x = wr.range(WALL.x0 + 10, WALL.x1 - 10);
    const w = wr.range(8, 22);
    const t = wr.range(EAVE + 4, EAVE + 60);
    const b = t + wr.range(80, 220);
    stainStreaks.push(wash({ name: 'stain', pts: [P(x, t), P(x + w, t + wr.jit(3)), P(x + w + wr.jit(4), b), P(x + wr.jit(4), b)], color: PAL.wallDeep, alpha: wr.range(0.05, 0.13), soft: 5, edge: 0.2, r: wr }));
  }
  const houseWashId = ids.next();
  s.add(
    el('Node', { name: 'HouseWash', id: houseWashId, opacity: 0 }, [
      wash({ name: 'wall', pts: wallPts, color: PAL.wall, alpha: 0.5, soft: 2.4, edge: 0.7, r: wr, wob: 2.2 }),
      wash({ name: 'gable', pts: gablePts, color: PAL.gable, alpha: 0.5, soft: 2.2, edge: 0.6, r: wr, wob: 2 }),
      bloom({ name: 'eaveShadow', cx: 320, cy: EAVE + 16, w: 250, h: 30, color: PAL.wallDeep, alpha: 0.3, r: wr, count: 4, soft: 0.9, spread: 0.15 }),
      bloom({ name: 'wallLow', cx: 320, cy: 740, w: 300, h: 110, color: PAL.wallDeep, alpha: 0.2, r: wr, count: 4, soft: 0.9, spread: 0.4 }),
      ...stainStreaks,
      grain({ cx: 320, cy: 530, w: 290, h: 520, color: PAL.wallDeep, alpha: 0.2, r: wr, count: 700 }),
      // slate roof edges, chimney, shop fascia and door
      wash({ name: 'roofL', pts: [P(146, EAVE + 10), P(APEX.x, APEX.y - 4), P(APEX.x, APEX.y + 16), P(158, EAVE + 16)], color: PAL.slate, alpha: 0.62, soft: 1.6, edge: 0.6, r: wr, wob: 1.2 }),
      wash({ name: 'roofR', pts: [P(APEX.x, APEX.y - 4), P(494, EAVE + 10), P(482, EAVE + 16), P(APEX.x, APEX.y + 16)], color: PAL.slate, alpha: 0.62, soft: 1.6, edge: 0.6, r: wr, wob: 1.2 }),
      wash({ name: 'chimney', pts: [P(CHIMNEY.x0, CHIMNEY.top), P(CHIMNEY.x1, CHIMNEY.top), P(CHIMNEY.x1, roofY(CHIMNEY.x1) + 2), P(CHIMNEY.x0, roofY(CHIMNEY.x0) + 2)], color: PAL.wallDeep, alpha: 0.55, soft: 1.6, edge: 0.6, r: wr, wob: 1.2 }),
      wash({ name: 'fascia', pts: rect(WALL.x0 + 6, 586, WALL.x1 - 6, 614).slice(0, 4), color: PAL.fascia, alpha: 0.72, soft: 1.6, edge: 0.6, r: wr, wob: 1.2 }),
      wash({ name: 'door', pts: winPts(WINDOWS.hello, 1), color: PAL.door, alpha: 0.7, soft: 1.4, edge: 0.6, tension: 0.3, r: wr, wob: 1 }),
      // dark glass for every window (lit panes paint over this)
      ...ORDER.filter((k) => k !== 'hello').map((k) => wash({ name: `glass ${k}`, pts: winPts(WINDOWS[k], 1), color: PAL.pane, alpha: 0.5, soft: 1.3, edge: 0.5, tension: 0.3, r: wr, wob: 1 })),
      ...SHOP.map((w, i) => wash({ name: `glass shop${i}`, pts: winPts(w, 1), color: PAL.pane, alpha: 0.5, soft: 1.3, edge: 0.5, tension: 0.3, r: wr, wob: 1 })),
      // window boxes under the first-floor windows
      ...['writing', 'elsewhere'].flatMap((k) => {
        const w = WINDOWS[k];
        const pr = wr.fork();
        return [
          wash({ name: 'box', pts: rect(w.x0 - 4, w.y1 + 2, w.x1 + 4, w.y1 + 16).slice(0, 4), color: PAL.wallDeep, alpha: 0.55, soft: 1.4, edge: 0.5, r: pr, wob: 1 }),
          bloom({ name: 'leaves', cx: (w.x0 + w.x1) / 2, cy: w.y1 - 2, w: 70, h: 26, color: PAL.leaf, alpha: 0.5, r: pr, count: 6, soft: 0.5, spread: 0.45, blend: 'srcOver' }),
        ];
      }),
      // steps and a doormat
      wash({ name: 'steps', pts: rect(284, GROUND, 356, GROUND + 16).slice(0, 4), color: PAL.street, alpha: 0.55, soft: 1.6, edge: 0.5, r: wr, wob: 1 }),
      // pot by the door
      wash({ name: 'pot', pts: [P(254, 760), P(282, 760), P(278, GROUND), P(258, GROUND)], color: PAL.wallDeep, alpha: 0.6, soft: 1.2, edge: 0.6, r: wr, wob: 0.8 }),
      bloom({ name: 'potLeaves', cx: 268, cy: 744, w: 48, h: 40, color: PAL.leaf, alpha: 0.5, r: wr, count: 6, soft: 0.5, spread: 0.4, blend: 'srcOver' }),
    ])
  );
  fadeIn(houseWashId, 20, 110);

  // ------------------------------------------------------------ lamps and lit windows
  // Each section's window: Lit (intro) > Breath (idle) > [Halo (hover), pane]
  const win = {};
  const refl = {};
  const lr = r.fork();
  const litKids = [];
  const reflKids = [];
  ORDER.forEach((k, i) => {
    const w = WINDOWS[k];
    const cx = (w.x0 + w.x1) / 2;
    const cy = (w.y0 + w.y1) / 2;
    const litId = ids.next();
    const breathId = ids.next();
    const haloId = ids.next();
    const paneInset = w.door ? 4 : 2;
    const panePts = w.door ? winPts({ ...w, y0: w.y0, y1: w.y0 + 2 * w.arch + 4 }, 4) : winPts(w, paneInset);
    const core = w.door ? P(cx, w.y0 + 20) : P(cx + lr.jit(6), cy + lr.jit(10));
    const kids = [
      glow({ name: 'halo', cx, cy: w.door ? w.y0 + 30 : cy, rx: w.door ? 80 : 74, ry: w.door ? 70 : 80, color: PAL.warm, alpha: 0.62, r: lr, id: haloId, opacity: 0.7, soft: 0.6 }),
      el('Shape', { name: 'pane' }, [pathXml(panePts, { closed: true, tension: 0.3 }), fill(argb(PAL.warm, 0.92), { feather: 1.2 })]),
      glow({ name: 'core', cx: core.x, cy: core.y, rx: (w.x1 - w.x0) * 0.42, ry: (w.door ? 26 : (w.y1 - w.y0) * 0.36), color: PAL.warmCore, alpha: 0.9, r: lr, soft: 0.8 }),
      // a thin warm spill onto the sill and the wall around the frame
      glow({ name: 'spill', cx, cy: w.door ? GROUND + 10 : w.y1 + 6, rx: (w.x1 - w.x0) * 0.9, ry: w.door ? 18 : 10, color: PAL.warm, alpha: 0.32, r: lr, soft: 0.9 }),
    ];
    if (w.door) {
      // the shop windows glow with the door
      for (const sw of SHOP) {
        kids.push(el('Shape', { name: 'shopPane' }, [pathXml(winPts(sw, 3), { closed: true, tension: 0.3 }), fill(argb(PAL.warm, 0.88), { feather: 1.4 })]));
        kids.push(glow({ name: 'shopCore', cx: (sw.x0 + sw.x1) / 2, cy: sw.y0 + 36, rx: 30, ry: 26, color: PAL.warmCore, alpha: 0.85, r: lr, soft: 0.8 }));
        kids.push(glow({ name: 'shopSpill', cx: (sw.x0 + sw.x1) / 2, cy: GROUND + 8, rx: 60, ry: 16, color: PAL.warm, alpha: 0.3, r: lr, soft: 0.9 }));
      }
    }
    litKids.push(el('Node', { name: `Lit ${k}`, id: litId, opacity: 0 }, el('Node', { name: 'breath', id: breathId }, kids.reverse())));
    // a reflection on the wet street
    const rx = w.door ? 54 : 22;
    const reflId = ids.next();
    reflKids.push(
      el('Node', { name: `Refl ${k}`, id: reflId, opacity: 0 }, [
        glow({ name: 'streak', cx: cx + lr.jit(4), cy: 866, rx, ry: 52, color: PAL.warm, alpha: w.door ? 0.3 : 0.2, r: lr, soft: 0.9, n: 8, wobble: 0.3 }),
      ])
    );
    const start = 150 + i * 34;
    fadeIn(litId, start, 56);
    fadeIn(reflId, start + 24, 70);
    win[k] = { litId, breathId, haloId, w, cx, cy };
    refl[k] = reflId;
  });

  // street lamp: a soft pool of light on the wall, the pavement and the rain
  const lampLitId = ids.next();
  const lampBreathId = ids.next();
  const lampGlowKids = [
    glow({ name: 'lampHalo', cx: LAMP.x, cy: 542, rx: 120, ry: 130, color: PAL.lamp, alpha: 0.4, r: lr, soft: 0.95, n: 12 }),
    glow({ name: 'lampCore', cx: LAMP.x, cy: 541, rx: 22, ry: 26, color: PAL.warmCore, alpha: 0.95, r: lr, soft: 0.7 }),
    glow({ name: 'lampWall', cx: WALL.x1 - 10, cy: 600, rx: 60, ry: 160, color: PAL.lamp, alpha: 0.16, r: lr, soft: 0.95 }),
    glow({ name: 'lampPool', cx: LAMP.x - 10, cy: GROUND + 40, rx: 110, ry: 40, color: PAL.lamp, alpha: 0.3, r: lr, soft: 0.9 }),
    glow({ name: 'lampRefl', cx: LAMP.x + 2, cy: 880, rx: 18, ry: 60, color: PAL.lamp, alpha: 0.22, r: lr, soft: 0.9, n: 8, wobble: 0.3 }),
  ];
  s.add(el('Node', { name: 'LampLight', id: lampLitId, opacity: 0 }, el('Node', { name: 'lampBreath', id: lampBreathId }, lampGlowKids.reverse())));
  fadeIn(lampLitId, 100, 70);

  s.add(el('Node', { name: 'Reflections' }, reflKids.reverse()));
  s.add(el('Node', { name: 'Windows' }, litKids.reverse()));

  // ------------------------------------------------------------ the cat, the curtain, the sign
  const cat = (() => {
    const w = WINDOWS.projects;
    const bx = w.x1 - 22; // sits on the right of the sill
    const by = w.y1 - 1;
    const bodyId = ids.next();
    const tailId = ids.next();
    const eyesId = ids.next();
    const cr = r.fork();
    // silhouette: a sitting cat seen from behind-ish, ears up, looking out at us
    const body = [P(-13, 0), P(-14, -12), P(-11, -22), P(-6, -27), P(-7, -34), P(-4, -37), P(0, -34), P(4, -34), P(8, -37), P(9, -30), P(6, -25), P(9, -18), P(11, -8), P(11, 0)].map((p) => P(p.x + cr.jit(0.4), p.y + cr.jit(0.4)));
    const tail = [P(10, -2), P(18, -3), P(24, -9), P(25, -18), P(22, -24)];
    const ink = argb('2B2826', 0.92);
    return {
      xml: el('Node', { name: 'Cat', x: bx, y: by, id: bodyId }, [
        el('Node', { name: 'eyes', id: eyesId, y: -29 }, [
          el('Shape', { name: 'eye', x: -3.4, y: 0 }, [el('Ellipse', { width: 2.6, height: 2, originX: 0.5, originY: 0.5, name: 'e' }), fill(argb(PAL.warmCore, 0.95))]),
          el('Shape', { name: 'eye', x: 3.4, y: 0 }, [el('Ellipse', { width: 2.6, height: 2, originX: 0.5, originY: 0.5, name: 'e' }), fill(argb(PAL.warmCore, 0.95))]),
        ]),
        el('Shape', { name: 'body' }, [pathXml(body, { closed: true, tension: 0.5 }), fill(ink, { feather: 0.9 })]),
        el('Node', { name: 'tail', id: tailId, x: 10, y: -2 }, el('Shape', { name: 'tailInk', x: -10, y: 2 }, [pathXml(tail, { tension: 0.9 }), stroke(ink, 3.2, { cap: 'round' })])),
      ]),
      bodyId, tailId, eyesId, bx, by,
    };
  })();
  s.add(cat.xml);

  const curtainId = ids.next();
  {
    const w = WINDOWS.writing;
    const cr = r.fork();
    const pts = [P(0, 0), P(22, 0), P(20, 20), P(24, 44), P(19, 62), P(21, 76), P(0, 76)].map((p) => P(p.x + cr.jit(0.6), p.y + cr.jit(0.6)));
    s.add(
      el('Node', { name: 'Curtain', id: curtainId, x: w.x0 + 1, y: w.y0 + 1 }, [
        el('Shape', { name: 'cloth' }, [pathXml(pts, { closed: true, tension: 0.5 }), fill(argb('F2E7D2', 0.82), { feather: 1 })]),
        el('Shape', { name: 'fold', blendModeValue: 'multiply' }, [pathXml([P(14, 2), P(12, 30), P(15, 74)], { tension: 0.6 }), stroke(argb('B9A98C', 0.5), 2.2, { feather: 1.4 })]),
      ])
    );
  }

  const signId = ids.next();
  {
    const sr2 = r.fork();
    const plate = rect(-19, 8, 19, 40).slice(0, 4);
    s.add(
      el('Node', { name: 'Sign', id: signId, x: 148, y: 560 }, [
        wash({ name: 'plate', pts: plate, color: PAL.fascia, alpha: 0.7, soft: 1.2, edge: 0.6, r: sr2, wob: 0.8 }),
        inkXml({ name: 'signInk', color: INK, width: 1.1, pieces: [
          ...poly([...plate, plate[0]], sr2, { wob: 0.35 }),
          ...line(P(-8, 8), P(-8, 0), sr2), ...line(P(8, 8), P(8, 0), sr2),
          // a tiny steaming cup on the sign
          ...curve([P(-7, 22), P(-6, 32), P(6, 32), P(7, 22)], sr2, 0.3),
          ...curve([P(-8, 22), P(8, 22)], sr2, 0.2),
          ...curve([P(7, 24), P(12, 25), P(11, 30), P(7, 30)], sr2, 0.2),
        ] }),
        inkXml({ name: 'signSteam', color: INK_SOFT, width: 0.9, bleed: 0, pieces: [...curve([P(-3, 19), P(-4, 15), P(-2, 12)], sr2, 0.3), ...curve([P(2, 19), P(1, 15), P(3, 12)], sr2, 0.3)] }),
      ].reverse())
    );
  }

  // ------------------------------------------------------------ ink (boiling, patiently)
  const inkId = ids.next();
  const inkBoil = boil(s, {
    name: 'Ink', seed: 77, cels: 3, hold: 13, id: inkId, opacity: 0,
    draw: (rr) => {
      const main = []; // the house
      const fine = []; // details, softer
      const faint = []; // brick hints, cobbles
      // roof edges and gable
      main.push(...line(P(148, EAVE + 8), APEX, rr, { lift: 0.3 }), ...line(APEX, P(492, EAVE + 8), rr, { lift: 0.3 }));
      main.push(...line(P(158, EAVE + 16), P(APEX.x, APEX.y + 16), rr, { lift: 0.4, short: 6 }), ...line(P(APEX.x, APEX.y + 16), P(482, EAVE + 16), rr, { lift: 0.4, short: 6 }));
      fine.push(...line(P(WALL.x0, EAVE + 2), P(WALL.x1, EAVE + 2), rr, { lift: 0.5 }));
      // walls
      main.push(...line(P(WALL.x0, EAVE), P(WALL.x0, GROUND), rr, { lift: 0.4 }), ...line(P(WALL.x1, EAVE), P(WALL.x1, GROUND), rr, { lift: 0.4 }));
      // chimney and its pot
      main.push(...line(P(CHIMNEY.x0, roofY(CHIMNEY.x0) - 2), P(CHIMNEY.x0, CHIMNEY.top), rr), ...line(P(CHIMNEY.x0 - 3, CHIMNEY.top), P(CHIMNEY.x1 + 3, CHIMNEY.top), rr), ...line(P(CHIMNEY.x1, CHIMNEY.top), P(CHIMNEY.x1, roofY(CHIMNEY.x1) - 2), rr));
      fine.push(...line(P(CHIMNEY.x0 - 3, CHIMNEY.top + 7), P(CHIMNEY.x1 + 3, CHIMNEY.top + 7), rr));
      fine.push(...poly([P(396, CHIMNEY.top), P(397, CHIMNEY.top - 12), P(409, CHIMNEY.top - 12), P(410, CHIMNEY.top)], rr));
      // string course between floors
      fine.push(...line(P(WALL.x0 + 2, 422), P(WALL.x1 - 2, 422), rr, { lift: 0.6, short: 8 }));
      // windows: frame, mullions, sill
      for (const k of ORDER) {
        const w = WINDOWS[k];
        const pts = winPts(w);
        if (w.arch) {
          const cx = (w.x0 + w.x1) / 2;
          const rr2 = (w.x1 - w.x0) / 2;
          main.push(...line(P(w.x0, w.y1), P(w.x0, w.y0 + rr2), rr), ...arc(P(cx, w.y0 + rr2), rr2, rr2, Math.PI, TAU, rr), ...line(P(w.x1, w.y0 + rr2), P(w.x1, w.y1), rr));
          if (w.door) {
            // door: panels, fanlight spokes, a knob, a letter slot, and the step
            main.push(...line(P(w.x0, w.y0 + rr2), P(w.x1, w.y0 + rr2), rr));
            for (const a of [1.25, 1.57, 1.9]) fine.push(...line(P(cx, w.y0 + rr2), P(cx + Math.cos(Math.PI + a) * (rr2 - 2), w.y0 + rr2 + Math.sin(Math.PI + a) * (rr2 - 2)), rr));
            fine.push(...poly(rect(w.x0 + 8, w.y0 + 36, w.x1 - 8, w.y0 + 86), rr, { wob: 0.3 }), ...poly(rect(w.x0 + 8, w.y0 + 98, w.x1 - 8, w.y1 - 10), rr, { wob: 0.3 }));
            fine.push(...arc(P(w.x1 - 11, w.y0 + 92), 2.2, 2.2, 0, TAU, rr, { n: 8, amt: 0.2 }));
            fine.push(...line(P(cx - 7, w.y0 + 92), P(cx + 7, w.y0 + 92), rr));
            main.push(...line(P(284, GROUND), P(356, GROUND), rr), ...line(P(280, GROUND + 16), P(360, GROUND + 16), rr), ...line(P(284, GROUND), P(280, GROUND + 16), rr), ...line(P(356, GROUND), P(360, GROUND + 16), rr));
          } else {
            main.push(...line(P(w.x0, w.y1), P(w.x1, w.y1), rr));
            fine.push(...line(P(cx, w.y0 + rr2 + 2), P(cx, w.y1 - 2), rr), ...line(P(w.x0 + 2, w.y0 + rr2 + 14), P(w.x1 - 2, w.y0 + rr2 + 14), rr));
            fine.push(...line(P(w.x0 - 6, w.y1 + 5), P(w.x1 + 6, w.y1 + 5), rr));
          }
        } else {
          main.push(...poly([...pts, pts[0]], rr, { lift: 0.2 }));
          const cx = (w.x0 + w.x1) / 2;
          const my = w.y0 + (w.y1 - w.y0) * 0.45;
          fine.push(...line(P(cx, w.y0 + 2), P(cx, w.y1 - 2), rr), ...line(P(w.x0 + 2, my), P(w.x1 - 2, my), rr));
          main.push(...line(P(w.x0 - 6, w.y1 + 5), P(w.x1 + 6, w.y1 + 5), rr));
          fine.push(...line(P(w.x0 - 3, w.y0 - 4), P(w.x1 + 3, w.y0 - 4), rr, { short: 2 }));
        }
      }
      // window boxes
      for (const k of ['writing', 'elsewhere']) {
        const w = WINDOWS[k];
        fine.push(...poly([P(w.x0 - 4, w.y1 + 6), P(w.x0 - 3, w.y1 + 18), P(w.x1 + 3, w.y1 + 18), P(w.x1 + 4, w.y1 + 6)], rr));
      }
      // shop front: fascia, big windows with a mullion, the pot
      main.push(...poly(rect(WALL.x0 + 6, 586, WALL.x1 - 6, 614), rr, { lift: 0.3 }));
      fine.push(...line(P(WALL.x0 + 10, 622), P(WALL.x1 - 10, 622), rr, { lift: 0.5, short: 4 }));
      for (const sw of SHOP) {
        const pts = winPts(sw);
        main.push(...poly([...pts, pts[0]], rr, { lift: 0.2 }));
        fine.push(...poly(rect(sw.x0 + 5, sw.y0 + 5, sw.x1 - 5, sw.y1 - 5), rr, { wob: 0.3 }));
        fine.push(...line(P(sw.x0 + 5, sw.y0 + 28), P(sw.x1 - 5, sw.y0 + 28), rr));
        main.push(...line(P(sw.x0 - 4, sw.y1 + 6), P(sw.x1 + 4, sw.y1 + 6), rr));
        // things in the window: a stack of books and a jar
        fine.push(...poly(rect(sw.x0 + 14, sw.y1 - 26, sw.x0 + 36, sw.y1 - 20), rr, { wob: 0.3 }), ...poly(rect(sw.x0 + 16, sw.y1 - 32, sw.x0 + 34, sw.y1 - 26), rr, { wob: 0.3 }));
        fine.push(...curve([P(sw.x1 - 30, sw.y1 - 20), P(sw.x1 - 31, sw.y1 - 36), P(sw.x1 - 28, sw.y1 - 40), P(sw.x1 - 16, sw.y1 - 40), P(sw.x1 - 13, sw.y1 - 36), P(sw.x1 - 14, sw.y1 - 20)], rr, 0.3));
      }
      main.push(...poly([P(254, 760), P(258, GROUND), P(278, GROUND), P(282, 760)], rr), ...line(P(250, 760), P(286, 760), rr));
      for (let i = 0; i < 5; i++) fine.push(...curve([P(268, 758), P(268 + rr.jit(14), 746 + rr.jit(6)), P(268 + rr.jit(22), 732 + rr.jit(8))], rr, 0.5));
      // downpipe with a hopper
      fine.push(...line(P(461, EAVE + 14), P(461, GROUND - 4), rr, { lift: 0.5 }), ...line(P(466, EAVE + 14), P(466, GROUND - 4), rr, { lift: 0.5 }));
      fine.push(...poly([P(456, EAVE + 2), P(457, EAVE + 14), P(470, EAVE + 14), P(471, EAVE + 2)], rr));
      // sign bracket
      main.push(...line(P(WALL.x0, 556), P(132, 556), rr), ...line(P(WALL.x0, 572), P(150, 557), rr));
      // kerb, cobbles that get coarser toward us, a puddle edge
      main.push(...line(P(42, GROUND + 2), P(600, GROUND), rr, { lift: 0.5, short: 10 }));
      fine.push(...line(P(48, GROUND + 18), P(596, GROUND + 17), rr, { lift: 0.6, short: 14 }));
      let y = GROUND + 36;
      let len = 10;
      while (y < 930) {
        for (let x = 50 + rr.range(0, len); x < 590; x += len * rr.range(1.3, 2.3)) if (rr() < 0.55) faint.push(...line(P(x, y + rr.jit(1.2)), P(x + len * rr.range(0.6, 1), y + rr.jit(1.2)), rr, { wob: 0.3 }));
        y += 18 + (y - GROUND) * 0.12;
        len += 3;
      }
      faint.push(...curve([P(120, 870), P(170, 858), P(250, 862), P(300, 876), P(250, 888), P(160, 886)], rr, 0.6));
      // brick hints: short dashes scattered thin on the wall
      for (let i = 0; i < 90; i++) {
        const x = rr.range(WALL.x0 + 8, WALL.x1 - 20);
        const yy = rr.range(EAVE + 8, GROUND - 230);
        const inWin = ORDER.some((k) => { const w = WINDOWS[k]; return x > w.x0 - 10 && x < w.x1 + 10 && yy > w.y0 - 8 && yy < w.y1 + 10; });
        if (inWin) continue;
        faint.push(...line(P(x, yy), P(x + rr.range(5, 12), yy + rr.jit(0.4)), rr, { wob: 0.25 }));
        if (rr() < 0.5) faint.push(...line(P(x + rr.range(5, 12), yy + 5), P(x + rr.range(14, 20), yy + 5 + rr.jit(0.4)), rr, { wob: 0.25 }));
      }
      // street lamp
      main.push(...line(P(LAMP.x - 2, LAMP.base), P(LAMP.x - 2, LAMP.top + 2), rr, { lift: 0.3 }), ...line(P(LAMP.x + 2, LAMP.base), P(LAMP.x + 2, LAMP.top + 2), rr, { lift: 0.3 }));
      main.push(...poly([P(LAMP.x - 12, LAMP.glass.y1), P(LAMP.x - 9, LAMP.glass.y0), P(LAMP.x + 9, LAMP.glass.y0), P(LAMP.x + 12, LAMP.glass.y1), P(LAMP.x - 12, LAMP.glass.y1)], rr));
      main.push(...poly([P(LAMP.x - 11, LAMP.glass.y0), P(LAMP.x, LAMP.glass.y0 - 12), P(LAMP.x + 11, LAMP.glass.y0)], rr));
      fine.push(...line(P(LAMP.x, LAMP.glass.y0 - 12), P(LAMP.x, LAMP.glass.y0 - 18), rr), ...line(P(LAMP.x - 8, LAMP.base - 24), P(LAMP.x + 8, LAMP.base - 24), rr), ...poly([P(LAMP.x - 9, LAMP.base), P(LAMP.x - 7, LAMP.base - 22), P(LAMP.x + 7, LAMP.base - 22), P(LAMP.x + 9, LAMP.base)], rr));
      fine.push(...line(P(LAMP.x - 8, LAMP.glass.y1 + 1), P(LAMP.x + 8, LAMP.glass.y1 + 1), rr));
      // wisps rising from the chimney
      const wisp = [];
      for (let i = 0; i < 2; i++) wisp.push(...curve([P(402 + i * 6, CHIMNEY.top - 14), P(398 + i * 8 + rr.jit(2), CHIMNEY.top - 30), P(406 + i * 4 + rr.jit(3), CHIMNEY.top - 46), P(400 + rr.jit(4), CHIMNEY.top - 62)], rr, 1.1));
      return [
        inkXml({ name: 'faint', pieces: faint, color: INK_FAINT, width: 0.85, bleed: 0 }),
        inkXml({ name: 'fine', pieces: fine, color: INK_SOFT, width: 1, bleed: 0.08 }),
        inkXml({ name: 'main', pieces: main, color: INK, width: 1.35, bleed: 0.16 }),
        inkXml({ name: 'wisp', pieces: wisp, color: INK_FAINT, width: 0.9, bleed: 0, smooth: 0.9 }),
      ];
    },
  });
  s.add(inkBoil.xml);
  fadeIn(inkId, 40, 100);
  s.loopLayer('Ink boil', inkBoil.animId);

  // ------------------------------------------------------------ smoke, rain, drips
  const smokeIds = [];
  {
    const mr = r.fork();
    const kids = [];
    for (let i = 0; i < 4; i++) {
      const id = ids.next();
      smokeIds.push(id);
      kids.push(el('Node', { name: `puff${i}`, id, x: 402, y: CHIMNEY.top - 10, opacity: 0 }, bloom({ name: 'p', cx: 0, cy: 0, w: 38, h: 32, color: PAL.smoke, alpha: 0.36, r: mr, count: 3, soft: 0.9, spread: 0.2, blend: 'srcOver' })));
    }
    s.add(el('Node', { name: 'Smoke' }, kids));
  }
  smokeIds.forEach((id, i) => {
    const dur = 300 + i * 40;
    const off = Math.round((i * dur) / 4);
    const drift = [8, -6, 12, -4][i];
    const a = s.anim({
      name: `Smoke ${i}`, duration: dur, loop: 'loop',
      tracks: [
        { object: id, prop: 'y', keys: [[0, CHIMNEY.top - 10, 'cubic', [0.3, 0, 0.6, 1]], [dur, CHIMNEY.top - 150]] },
        { object: id, prop: 'x', keys: [[0, 402, 'cubic', EASE.inOut], [dur * 0.35, 402 + drift, 'cubic', EASE.inOut], [dur * 0.7, 402 - drift * 0.5, 'cubic', EASE.inOut], [dur, 402 + drift * 1.4]] },
        { object: id, prop: 'scaleX', keys: [[0, 0.35, 'cubic', EASE.out], [dur, 2.2]] },
        { object: id, prop: 'scaleY', keys: [[0, 0.35, 'cubic', EASE.out], [dur, 1.9]] },
        { object: id, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [dur * 0.25, 0.9, 'linear'], [dur * 0.6, 0.6, 'cubic', EASE.in], [dur, 0]] },
      ],
    });
    // stagger by starting each loop at a different speed-independent offset: an entry-only "delay" state
    s.sequenceLayer(`Smoke ${i}`, [s.anim({ name: `Smoke wait ${i}`, duration: Math.max(1, off), tracks: [{ object: id, prop: 'opacity', keys: [[0, 0]] }] }), a]);
  });

  // rain: two tiles of faint streaks sliding down and wrapping
  const rainLayer = (name, { n, len, alpha, width, dur, seed }) => {
    const rr = rng(seed);
    const streaks = [];
    for (let i = 0; i < n; i++) {
      const x = rr.range(34, 606);
      const y = rr.range(0, H);
      const L = len * rr.range(0.6, 1.3);
      streaks.push([P(x, y), P(x - L * 0.08, y + L)]);
    }
    const tile = (dy) => el('Shape', { name: 'tile', y: dy }, [...streaks.map((p) => pathXml(p, { tension: 0 })), stroke(argb(PAL.rain, alpha), width, { cap: 'round' })]);
    const id = ids.next();
    s.add(el('Node', { name, id, y: 0 }, [tile(0), tile(-H)]));
    const a = s.anim({ name: `${name} fall`, duration: dur, loop: 'loop', tracks: [{ object: id, prop: 'y', keys: [[0, 0, 'linear'], [dur, H]] }] });
    s.loopLayer(name, a);
    return id;
  };
  const rainId = ids.next();
  // rain fades in with the sky so the page does not start busy
  const rainA = rainLayer('Rain near', { n: 60, len: 20, alpha: 0.22, width: 0.9, dur: 150, seed: 5 });
  const rainB = rainLayer('Rain far', { n: 80, len: 10, alpha: 0.12, width: 0.7, dur: 210, seed: 6 });
  void rainId;

  // drips from the eave corners and the sign, with a ripple where they land
  const dripSpecs = [
    { x: 150, y0: EAVE + 14, y1: GROUND, dur: 230, delay: 40 },
    { x: 490, y0: EAVE + 14, y1: GROUND, dur: 290, delay: 150 },
    { x: 135, y0: 602, y1: GROUND, dur: 260, delay: 100 },
  ];
  for (const [i, d] of dripSpecs.entries()) {
    const dropId = ids.next();
    const ringId = ids.next();
    const fall = 42;
    s.add(
      el('Node', { name: `Drip${i}` }, [
        el('Shape', { name: 'ring', id: ringId, x: d.x, y: d.y1 + 2, opacity: 0, scaleX: 0.2, scaleY: 0.2 }, [el('Ellipse', { width: 26, height: 7, originX: 0.5, originY: 0.5, name: 'r' }), stroke(argb(PAL.streetDeep, 0.5), 0.9)]),
        el('Shape', { name: 'drop', id: dropId, x: d.x, y: d.y0, opacity: 0 }, [el('Ellipse', { width: 3.2, height: 6, originX: 0.5, originY: 0.5, name: 'd' }), fill(argb(PAL.rain, 0.75), { feather: 0.6 })]),
      ])
    );
    const t0 = d.delay;
    const a = s.anim({
      name: `Drip ${i}`, duration: d.dur, loop: 'loop',
      tracks: [
        { object: dropId, prop: 'y', keys: [[0, d.y0, 'hold'], [t0 - 30, d.y0, 'cubic', EASE.inOut], [t0, d.y0 + 3, 'cubic', [0.5, 0, 0.85, 0.6]], [t0 + fall, d.y1, 'hold'], [d.dur, d.y0]] },
        { object: dropId, prop: 'opacity', keys: [[0, 0, 'hold'], [t0 - 30, 0, 'cubic', EASE.out], [t0, 1, 'hold'], [t0 + fall - 2, 1, 'hold'], [t0 + fall, 0, 'hold'], [d.dur, 0]] },
        { object: dropId, prop: 'scaleY', keys: [[0, 0.3, 'hold'], [t0 - 30, 0.3, 'cubic', EASE.out], [t0, 1, 'cubic', EASE.in], [t0 + fall, 1.8, 'hold'], [d.dur, 0.3]] },
        { object: ringId, prop: 'opacity', keys: [[0, 0, 'hold'], [t0 + fall, 0.9, 'cubic', EASE.out], [t0 + fall + 40, 0, 'hold'], [d.dur, 0]] },
        { object: ringId, prop: 'scaleX', keys: [[0, 0.2, 'hold'], [t0 + fall, 0.2, 'cubic', EASE.out], [t0 + fall + 40, 1, 'hold'], [d.dur, 0.2]] },
        { object: ringId, prop: 'scaleY', keys: [[0, 0.2, 'hold'], [t0 + fall, 0.2, 'cubic', EASE.out], [t0 + fall + 40, 1, 'hold'], [d.dur, 0.2]] },
      ],
    });
    s.loopLayer(`Drip ${i}`, a);
  }

  // ------------------------------------------------------------ hit areas, inputs, events
  const hits = {};
  for (const k of ORDER) {
    const { w } = win[k];
    const id = ids.next();
    const pad = 8;
    const y1 = k === 'projects' ? w.y1 - 44 : w.y1 + pad; // leave the sill to the cat
    s.add(el('Shape', { name: `Hit ${k}`, id }, [pathXml(k === 'hello' ? [P(WALL.x0 + 8, 586), P(WALL.x1 - 8, 586), P(WALL.x1 - 8, GROUND + 14), P(WALL.x0 + 8, GROUND + 14)] : [P(w.x0 - pad, w.y0 - pad), P(w.x1 + pad, w.y0 - pad), P(w.x1 + pad, y1), P(w.x0 - pad, y1)], { closed: true, tension: 0 }), fill('00000000')]));
    hits[k] = id;
  }
  const catHit = ids.next();
  s.add(el('Shape', { name: 'Hit cat', id: catHit, x: cat.bx, y: cat.by }, [el('Rectangle', { x: 6, y: -20, width: 46, height: 46, originX: 0.5, originY: 0.5, name: 'r' }), fill('00000000')]));
  const lampHit = ids.next();
  s.add(el('Shape', { name: 'Hit lamp', id: lampHit, x: LAMP.x, y: 538 }, [el('Rectangle', { width: 44, height: 70, originX: 0.5, originY: 0.5, name: 'r' }), fill('00000000')]));

  // --- intro
  s.loopLayer('Intro', s.anim({ name: 'Intro', duration: 420, tracks: intro }));

  // --- idle breathing: each lamp glows a little unevenly, like a filament
  ORDER.forEach((k, i) => {
    const { breathId } = win[k];
    const dur = 360 + i * 47;
    s.loopLayer(`Breath ${k}`, s.anim({
      name: `Breath ${k}`, duration: dur, loop: 'pingPong',
      tracks: [{ object: breathId, prop: 'opacity', keys: [[0, 0.86, 'cubic', EASE.inOut], [dur * 0.4, 1, 'cubic', EASE.inOut], [dur * 0.65, 0.93, 'cubic', EASE.inOut], [dur, 1]] }],
    }));
  });
  s.loopLayer('Lamp breath', s.anim({
    name: 'Lamp breath', duration: 300, loop: 'pingPong',
    tracks: [{ object: lampBreathId, prop: 'opacity', keys: [[0, 0.82, 'cubic', EASE.inOut], [120, 1, 'cubic', EASE.inOut], [190, 0.9, 'cubic', EASE.inOut], [300, 1]] }],
  }));

  // --- hover: warm a window (from the page or from the pointer)
  for (const k of ORDER) {
    const { haloId } = win[k];
    const warm = s.input('bool', `warm_${k}`, 0);
    const off = s.anim({ name: `Cool ${k}`, duration: 1, tracks: [{ object: haloId, prop: 'opacity', keys: [[0, 0.75]] }, { object: haloId, prop: 'scaleX', keys: [[0, 1]] }, { object: haloId, prop: 'scaleY', keys: [[0, 1]] }] });
    const on = s.anim({ name: `Warm ${k}`, duration: 1, tracks: [{ object: haloId, prop: 'opacity', keys: [[0, 1]] }, { object: haloId, prop: 'scaleX', keys: [[0, 1.35]] }, { object: haloId, prop: 'scaleY', keys: [[0, 1.3]] }] });
    s.boolLayer(`Warm ${k}`, warm, off, on, { mixIn: 420, mixOut: 900 });
    const inEv = s.event(`in:${k}`);
    const outEv = s.event(`out:${k}`);
    const goEv = s.event(`go:${k}`);
    s.listen(hits[k], 'enter', [Scene.setBool(warm, true), Scene.emit(inEv)]);
    s.listen(hits[k], 'exit', [Scene.setBool(warm, false), Scene.emit(outEv)]);
    s.listen(hits[k], 'click', [Scene.emit(goEv)]);
  }

  // --- the street lamp can be switched off (and on again)
  const lampOff = s.input('bool', 'lamp_off', 0);
  const lampOn = s.anim({ name: 'Lamp on', duration: 1, tracks: [{ object: lampLitId, prop: 'opacity', keys: [[0, 1]] }] });
  const lampDark = s.anim({ name: 'Lamp off', duration: 1, tracks: [{ object: lampLitId, prop: 'opacity', keys: [[0, 0]] }] });
  // the intro fades the lamp in; this layer takes over afterwards (later layers win)
  const lampIntro = s.anim({ name: 'Lamp wait', duration: 170, tracks: [{ object: lampLitId, prop: 'opacity', keys: [[0, 0, 'hold'], [100, 0, 'cubic', EASE.soft], [170, 1]] }] });
  {
    // sequence: wait (fade) -> bool layer behaviour
    const idle = ids.next();
    const on = ids.next();
    const dark = ids.next();
    s.layers.push(
      el('StateMachineLayer', { name: 'Lamp', id: ids.next() }, [
        el('AnyState', { x: 200, y: -140 }),
        el('ExitState', { x: 600, y: -140 }),
        el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: idle })),
        el('AnimationState', { x: 200, y: 0, animationId: lampIntro, id: idle }, el('StateTransition', { stateToId: on, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 })),
        el('AnimationState', { x: 400, y: 0, animationId: lampOn, id: on }, el('StateTransition', { stateToId: dark, duration: 500 }, el('TransitionBoolCondition', { inputId: lampOff, opValue: 'equal' }))),
        el('AnimationState', { x: 600, y: 0, animationId: lampDark, id: dark }, el('StateTransition', { stateToId: on, duration: 700 }, el('TransitionBoolCondition', { inputId: lampOff, opValue: 'notEqual' }))),
      ])
    );
  }
  const lampEv = s.event('lamp');
  s.listen(lampHit, 'click', [el('ListenerBoolChange', { inputId: lampOff, value: 2 }), Scene.emit(lampEv)]);

  // --- the cat: tail flicks now and then; blink and a stretch when poked
  s.loopLayer('Tail', s.anim({
    name: 'Tail', duration: 520, loop: 'loop',
    tracks: [{ object: cat.tailId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [40, 0.16, 'cubic', EASE.inOut], [90, -0.06, 'cubic', EASE.inOut], [130, 0.02, 'cubic', EASE.inOut], [300, 0, 'cubic', EASE.inOut], [340, 0.22, 'cubic', EASE.inOut], [380, 0.1, 'cubic', EASE.inOut], [430, 0]] }],
  }));
  s.loopLayer('Blink idle', s.anim({
    name: 'Slow blink', duration: 540, loop: 'loop',
    tracks: [{ object: cat.eyesId, prop: 'scaleY', keys: [[0, 1, 'hold'], [250, 1, 'cubic', EASE.in], [256, 0.08, 'cubic', EASE.out], [266, 1, 'hold'], [540, 1]] }],
  }));
  const poke = s.input('trigger', 'poke');
  const pokeA = s.anim({
    name: 'Poke', duration: 90,
    tracks: [
      { object: cat.eyesId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.in], [5, 0.08, 'cubic', EASE.out], [14, 1, 'hold'], [22, 1, 'cubic', EASE.in], [27, 0.08, 'cubic', EASE.out], [36, 1]] },
      { object: cat.bodyId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [20, 1.05, 'cubic', EASE.inOut], [70, 1]] },
      { object: cat.tailId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [18, 0.35, 'cubic', EASE.inOut], [50, -0.08, 'cubic', EASE.inOut], [90, 0]] },
    ],
  });
  s.triggerLayer('Poke', poke, pokeA, { fromAny: false, mix: 60 });
  const catEv = s.event('cat');
  s.listen(catHit, 'click', [Scene.fire(poke), Scene.emit(catEv)]);

  // --- the curtain stirs, the sign swings
  s.loopLayer('Curtain', s.anim({
    name: 'Curtain', duration: 420, loop: 'pingPong',
    tracks: [
      { object: curtainId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [200, 1.09, 'cubic', EASE.inOut], [300, 1.03, 'cubic', EASE.inOut], [420, 1.07]] },
      { object: curtainId, prop: 'x', keys: [[0, WINDOWS.writing.x0 + 1, 'cubic', EASE.inOut], [420, WINDOWS.writing.x0 + 3]] },
    ],
  }));
  s.loopLayer('Sign', s.anim({
    name: 'Sign', duration: 260, loop: 'pingPong',
    tracks: [{ object: signId, prop: 'rotation', keys: [[0, -0.025, 'cubic', EASE.inOut], [260, 0.03]] }],
  }));

  return s.toXml();
}

export default function () {
  const ids = new Ids();
  return document(house(ids));
}
