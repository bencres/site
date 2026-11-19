// Draft 4 · Desk — a top-down desk where each object is a section of the site.
// Hover lifts an object (bool input `hover_<key>`), entering also wiggles it
// (trigger `wiggle_<key>`), and clicking fires a Rive event `open:<key>`.
import { Ids, Scene, rng, P, TAU, el, pathXml, polyXml, fill, stroke, washShape, watercolor, stippleShape, argb, darken, lighten, jitterPts, blobPts, document, EASE } from '../lib/ink.mjs';
import { INK, PAPER, inkMulti, rectCorners, cornerPts, sketchSides, handCircle, circlePts, leafPts, scribbleLine, paperShape, shadowShape, offWash, hitShape } from './draw.mjs';

const W = 1200;
const H = 780;

export default function () {
  const ids = new Ids();
  const s = new Scene(ids, { name: 'Desk', w: W, h: H });
  const solos = [];
  let seedN = 100;

  // ---- boil: every ink drawing is three slightly different cels ----
  function boilInk(name, drawCel, { cels = 3 } = {}) {
    const soloId = ids.next();
    const celIds = [];
    const seed = seedN++ * 977;
    const kids = [];
    for (let i = 0; i < cels; i++) {
      const cid = ids.next();
      celIds.push(cid);
      kids.push(el('Node', { name: `cel${i}`, id: cid }, [].concat(drawCel(rng(seed + i * 131))).reverse()));
    }
    solos.push({ soloId, celIds });
    return el('Solo', { name, activeComponentId: celIds[0], id: soloId }, kids);
  }

  // jitter a list of {pts} paths per cel
  const jp = (paths, r, a = 0.8) => paths.map((p) => ({ ...p, pts: jitterPts(p.pts, a, r) }));

  // ---- interactive object scaffold ----
  const objects = [];
  function object(key, { x, y, rot = 0, foot, art, open = true, shadow = {} }) {
    const groupId = ids.next();
    const liftId = ids.next();
    const wigId = ids.next();
    const shadowId = ids.next();
    const hitId = ids.next();
    const kids = [
      shadowShape(foot, { id: shadowId, ...shadow }),
      el('Node', { name: 'lift', id: liftId }, [el('Node', { name: 'wiggle', id: wigId }, [].concat(art).reverse())]),
      hitShape(foot, hitId),
    ];
    objects.push({ key, x, y, rot, groupId, liftId, wigId, shadowId, hitId, open, shadow });
    return el('Node', { name: key, x, y, rotation: rot, id: groupId }, kids.reverse());
  }

  // =========================================================
  // DESK
  // =========================================================
  {
    const r = rng(7);
    const corners = rectCorners(1130, 700);
    const outline = cornerPts(corners, r, { jit: 3, bevel: 14, mids: 4 });
    s.add(
      el('Node', { name: 'desk', x: 600, y: 395 }, [
        boilInk('desk ink', (rr) => [
          inkMulti({ paths: jp(sketchSides(corners, rr, { over: 9, jit: 2.5 }), rr, 1), width: 2, color: 'FF3A2C20' }),
          inkMulti({
            name: 'grain',
            width: 1,
            color: 'A0603A1C',
            bleed: 0,
            paths: grainLines(rng(8), rr),
          }),
        ]),
        washShape({ name: 'wood glaze', pts: blobPts(380, 220, r, { n: 9, wobble: 0.1 }), color: 'B07A44', alpha: 0.2, edge: 0.4, soft: 40, x: -20, y: 30 }),
        washShape({ name: 'wood', pts: outline, color: 'C08A55', alpha: 0.5, edge: 0.9, soft: 3 }),
        el('Shape', { name: 'desk base' }, [pathXml(outline, { closed: true }), fill('FFE8CDA6')]),
      ].reverse())
    );
  }

  function grainLines(r, rr) {
    const lines = [];
    for (let i = 0; i < 13; i++) {
      const y0 = -320 + i * 52 + r.jit(10);
      const x0 = -540 + r.range(0, 260);
      const x1 = 540 - r.range(0, 260);
      const pts = [];
      const n = 7;
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n;
        pts.push(P(x, y0 + Math.sin(k * 1.3 + i) * 6 + rr.jit(0.8)));
      }
      lines.push({ pts });
    }
    // a couple of knots
    for (const [kx, ky] of [[-260, -120], [310, 190]]) {
      lines.push(handCircle(26, 9, rr, { start: 0.4 }));
      lines[lines.length - 1].pts = lines[lines.length - 1].pts.map((p) => P(p.x + kx, p.y + ky));
      lines.push({ pts: circlePts(12, 4, 10).map((p) => P(p.x + kx + rr.jit(0.6), p.y + ky)), closed: true });
    }
    return lines;
  }

  // coffee ring stain (decoration)
  {
    const r = rng(41);
    s.add(
      el('Shape', { name: 'stain', x: 770, y: 372, blendModeValue: 'multiply' }, [
        pathXml(handCircle(40, 38, r, { turns: 0.8, n: 14, start: 1.2 }).pts),
        stroke(argb('9C6533', 0.28), 3.2, { feather: 1.6 }),
      ])
    );
    s.add(el('Shape', { name: 'stain 2', x: 774, y: 368, blendModeValue: 'multiply' }, [pathXml(handCircle(39, 37, r, { turns: 0.45, n: 8, start: 3.9 }).pts), stroke(argb('9C6533', 0.2), 2, { feather: 1 })]));
  }

  // paperclip (decoration)
  {
    const clip = [P(-30, 6), P(22, 6), P(28, 0), P(22, -6), P(-24, -6), P(-29, -1), P(-24, 3), P(14, 3), P(18, 0), P(14, -2), P(-14, -2)];
    s.add(el('Node', { name: 'paperclip', x: 352, y: 118, rotation: 0.5 }, [boilInk('clip ink', (rr) => inkMulti({ paths: [{ pts: jitterPts(clip, 0.35, rr), tension: 0.7 }], width: 1.4, color: 'FF6E6A66', bleed: 0.1 }))]));
  }

  // eraser crumbs (decoration)
  {
    const r = rng(77);
    const dots = Array.from({ length: 16 }, () => ({ x: r.jit(30), y: r.jit(14), r: r.range(0.8, 2) }));
    s.add(stippleShape({ name: 'crumbs', x: 470, y: 690, dots, color: argb('C98C8C', 0.55) }));
  }

  // =========================================================
  // OBJECTS
  // =========================================================

  // ---- business card: about ----
  {
    const r = rng(11);
    const c = rectCorners(214, 126);
    const foot = cornerPts(c, r, { jit: 0.6 });
    const bPts = {
      stem: [P(-74, -22), P(-74, 22)],
      top: [P(-75, -22), P(-58, -23), P(-50, -14), P(-58, -2), P(-73, -1)],
      bot: [P(-70, -1), P(-54, 1), P(-47, 11), P(-56, 21), P(-75, 22)],
    };
    const cPts = [];
    for (let i = 0; i <= 12; i++) {
      const a = -0.27 * Math.PI - (i / 12) * 1.46 * Math.PI;
      cPts.push(P(-18 + Math.cos(a) * 20, Math.sin(a) * 22));
    }
    const lines = [0, 1, 2].map((i) => scribbleLine(i === 0 ? 70 : 82 - i * 14, rng(20 + i)).map((w) => ({ pts: w.pts.map((p) => P(p.x + 12, p.y - 24 + i * 18)) })));
    s.add(
      object('about', {
        x: 215, y: 172, rot: -0.12, foot,
        art: [
          paperShape(foot),
          watercolor({ name: 'dot', x: -46, y: 4, rx: 30, ry: 28, color: 'D9774F', seed: 5, alpha: 0.55 }),
          offWash(cornerPts(rectCorners(214, 10), r).map((p) => P(p.x, p.y + 58)), '7FA6C4', r, { alpha: 0.4, off: 1.5 }),
          boilInk('card ink', (rr) => [
            inkMulti({ paths: jp(sketchSides(c, rr, { over: 4 }), rr, 0.5), width: 1.6 }),
            inkMulti({ name: 'monogram', paths: jp([{ pts: bPts.stem }, { pts: bPts.top }, { pts: bPts.bot }, { pts: cPts }], rr, 0.7), width: 2.6 }),
            inkMulti({ name: 'lines', paths: jp(lines.flat(), rr, 0.3), width: 1, bleed: 0.1, color: 'D92E2822' }),
          ]),
        ],
      })
    );
  }

  // ---- graph paper with gears: projects ----
  let gearA;
  let gearB;
  {
    const r = rng(13);
    const c = rectCorners(244, 172);
    const foot = cornerPts(c, r, { jit: 0.7 });
    const grid = [];
    for (let gx = -112; gx <= 112; gx += 14) grid.push([P(gx, -80), P(gx, 80)]);
    for (let gy = -76; gy <= 76; gy += 14) grid.push([P(-116, gy), P(116, gy)]);
    gearA = ids.next();
    gearB = ids.next();
    const gearPts = (teeth, R, root, rr) => {
      const pts = [];
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * TAU;
        const st = TAU / teeth;
        pts.push(P(Math.cos(a) * root, Math.sin(a) * root));
        pts.push(P(Math.cos(a + st * 0.2) * R, Math.sin(a + st * 0.2) * R));
        pts.push(P(Math.cos(a + st * 0.5) * R, Math.sin(a + st * 0.5) * R));
        pts.push(P(Math.cos(a + st * 0.7) * root, Math.sin(a + st * 0.7) * root));
      }
      return jitterPts(pts, 0.6, rr);
    };
    const tape = cornerPts(rectCorners(64, 20), r, { jit: 1 });
    s.add(
      object('projects', {
        x: 588, y: 196, rot: 0.05, foot,
        art: [
          paperShape(foot, { color: 'FFFAF8F2' }),
          el('Shape', { name: 'grid' }, [...grid.map((g) => polyXml(g)), stroke(argb('6C9BC4', 0.28), 0.7, { cap: 'butt' })]),
          watercolor({ name: 'gear wash', x: -54, y: 6, rx: 44, ry: 40, color: 'E3B94B', seed: 3, alpha: 0.45, grain: false }),
          watercolor({ name: 'gear wash 2', x: 4, y: -26, rx: 22, ry: 20, color: '6FA8C9', seed: 4, alpha: 0.4, grain: false }),
          el('Node', { name: 'gearA', x: -50, y: 4, id: gearA }, [
            boilInk('gear a', (rr) => inkMulti({ paths: [{ pts: gearPts(10, 40, 32, rr), closed: true, tension: 0.35 }, handCircle(9, 9, rr), { pts: [P(-20, 0), P(20, 0)] }, { pts: [P(0, -20), P(0, 20)] }], width: 1.6 })),
          ]),
          el('Node', { name: 'gearB', x: 6, y: -27, id: gearB }, [
            boilInk('gear b', (rr) => inkMulti({ paths: [{ pts: gearPts(6, 22, 16, rr), closed: true, tension: 0.35 }, handCircle(5, 5, rr)], width: 1.5 })),
          ]),
          boilInk('notes', (rr) => [
            // dimension line with arrow heads under the big gear
            inkMulti({ name: 'dim', width: 1, bleed: 0.08, paths: jp([{ pts: [P(-90, 58), P(-10, 58)] }, { pts: [P(-84, 54), P(-91, 58), P(-84, 62)] }, { pts: [P(-16, 54), P(-9, 58), P(-16, 62)] }], rr, 0.4) }),
            inkMulti({ name: 'notes', width: 1, bleed: 0.08, color: 'D92E2822', paths: jp([...scribbleLine(70, rng(31)).map((w) => ({ pts: w.pts.map((p) => P(p.x + 34, p.y - 2)) })), ...scribbleLine(56, rng(32)).map((w) => ({ pts: w.pts.map((p) => P(p.x + 34, p.y + 16)) })), ...scribbleLine(40, rng(33)).map((w) => ({ pts: w.pts.map((p) => P(p.x + 34, p.y + 34)) }))], rr, 0.3) }),
            // a check mark and an arrow pointing at the small gear
            inkMulti({ name: 'marks', width: 1.4, paths: jp([{ pts: [P(70, -60), P(76, -52), P(90, -70)] }, { pts: [P(54, -44), P(40, -36), P(26, -32)] }, { pts: [P(32, -38), P(25, -32), P(33, -27)] }], rr, 0.4) }),
            inkMulti({ name: 'edge', paths: jp(sketchSides(c, rr, { over: 4 }), rr, 0.5), width: 1.5 }),
          ]),
          washShape({ name: 'tape', x: 0, y: -86, pts: tape.map((p) => P(p.x * Math.cos(-0.12) - p.y * Math.sin(-0.12), p.x * Math.sin(-0.12) + p.y * Math.cos(-0.12))), color: 'EDD27A', alpha: 0.55, edge: 0.4, soft: 1 }),
        ],
      })
    );
  }

  // ---- mug of coffee: now ----
  let rippleId;
  const steamIds = [];
  {
    const r = rng(17);
    rippleId = ids.next();
    const foot = circlePts(84, 84, 16).map((p) => P(p.x + 6, p.y));
    const handle = [P(56, -18), P(86, -20), P(98, -8), P(98, 8), P(86, 20), P(56, 18)];
    const handleHole = [P(62, -8), P(82, -9), P(87, 0), P(82, 9), P(62, 8)];
    const steam = (rr) => {
      const pts = [];
      for (let i = 0; i <= 8; i++) pts.push(P(Math.sin(i * 0.9) * 7 + rr.jit(0.6), -i * 6));
      return [{ pts }];
    };
    const steamNodes = [0, 1, 2].map((i) => {
      const id = ids.next();
      steamIds.push(id);
      return el('Node', { name: `steam${i}`, id, x: -20 + i * 18, y: -14 + (i % 2) * 8, opacity: 0 }, [boilInk(`steam ink ${i}`, (rr) => inkMulti({ paths: steam(rr), width: 1.7, color: 'C8FFFFFF', bleed: 0.4 }))]);
    });
    s.add(
      object('now', {
        x: 905, y: 218, foot,
        shadow: { strength: 14 },
        art: [
          // cork coaster
          washShape({ name: 'coaster', pts: blobPts(82, 82, r, { n: 14, wobble: 0.02 }), color: 'C49A6C', alpha: 0.75, edge: 0.6, soft: 1.5, blend: 'srcOver' }),
          stippleShape({ name: 'cork', dots: Array.from({ length: 140 }, () => { const a = r() * TAU; const d = Math.sqrt(r()) * 78; return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: r.range(0.5, 1.3) }; }), color: argb('7A5230', 0.45) }),
          // handle (outer minus hole)
          el('Shape', { name: 'handle' }, [pathXml(handle, { closed: true, tension: 0.8 }), pathXml([...handleHole].reverse(), { closed: true, tension: 0.8 }), fill('FFF6EEE0', { rule: 'evenOdd' })]),
          el('Shape', { name: 'handle glaze', x: 2, y: 1, blendModeValue: 'multiply' }, [pathXml(handle, { closed: true, tension: 0.8 }), pathXml([...handleHole].reverse(), { closed: true, tension: 0.8 }), fill(argb('6F9CC0', 0.55), { rule: 'evenOdd' })]),
          // body + glaze
          el('Shape', { name: 'mug' }, [pathXml(circlePts(64, 64, 16), { closed: true }), fill('FFF6EEE0')]),
          washShape({ name: 'glaze', x: 2, y: 2, pts: blobPts(64, 64, r, { n: 16, wobble: 0.025 }), color: '6F9CC0', alpha: 0.6, edge: 0.9, soft: 1.5 }),
          el('Shape', { name: 'rim' }, [pathXml(circlePts(54, 54, 16), { closed: true }), fill('FFF8F2E8')]),
          // coffee
          el('Shape', { name: 'coffee' }, [pathXml(blobPts(47, 47, r, { n: 14, wobble: 0.02 }), { closed: true }), fill('FF7B4B2A')]),
          washShape({ name: 'crema', x: -8, y: -6, pts: blobPts(30, 24, r, { n: 10, wobble: 0.18 }), color: 'D6A16B', alpha: 0.55, edge: 0.3, soft: 6, blend: 'srcOver' }),
          el('Shape', { name: 'ripple', id: rippleId, opacity: 0, scaleX: 0.2, scaleY: 0.2 }, [el('Ellipse', { width: 80, height: 80, originX: 0.5, originY: 0.5, name: 'P' }), stroke(argb('F0DDBE', 0.8), 1.3)]),
          boilInk('mug ink', (rr) => inkMulti({ paths: [handCircle(64, 64, rr), handCircle(54.5, 54.5, rr, { turns: 1.02 }), handCircle(47, 47, rr, { turns: 0.96, jit: 0.4 }), { pts: jitterPts(handle, 0.7, rr), tension: 0.8 }, { pts: jitterPts(handleHole, 0.5, rr), closed: true, tension: 0.8 }], width: 1.8 })),
          ...steamNodes,
        ],
      })
    );
  }

  // ---- plant (decoration, wiggles) ----
  const leafIds = [];
  {
    const r = rng(19);
    const foot = circlePts(92, 92, 16);
    const greens = ['6E9A5B', '86AD6A', '5A8650', '7EA65E'];
    const leaves = [];
    for (let i = 0; i < 9; i++) {
      const id = ids.next();
      leafIds.push({ id, base: (i / 9) * TAU + r.jit(0.18) });
      const len = r.range(66, 92);
      const wid = r.range(26, 34);
      const lp = leafPts(len, wid, r);
      leaves.push(
        el('Node', { name: `leaf${i}`, id, rotation: leafIds[i].base }, [
          el('Node', { name: 'leaf art', x: 18 }, [
            boilInk(`leaf ink ${i}`, (rr) => inkMulti({ paths: [{ pts: jitterPts(lp, 0.7, rr), closed: true }, { pts: jitterPts([P(4, 0), P(len * 0.5, -1.5), P(len * 0.9, 0)], 0.5, rr) }], width: 1.5 })),
            washShape({ name: 'leaf', x: r.jit(2.5), y: r.jit(2.5), pts: jitterPts(lp, 1.5, r), color: greens[i % greens.length], alpha: 0.75, edge: 0.8, soft: 1.5, blend: 'srcOver' }),
          ].reverse()),
        ])
      );
    }
    s.add(
      object('plant', {
        x: 1092, y: 112, foot, open: false,
        shadow: { strength: 16, alpha: 0.26 },
        art: [
          washShape({ name: 'pot', pts: blobPts(56, 56, r, { n: 14, wobble: 0.02 }), color: 'C66A43', alpha: 0.85, edge: 0.8, soft: 1.5, blend: 'srcOver' }),
          el('Shape', { name: 'soil' }, [pathXml(blobPts(44, 44, r, { n: 12, wobble: 0.04 }), { closed: true }), fill('FF5B4332')]),
          stippleShape({ name: 'soil grain', dots: Array.from({ length: 70 }, () => { const a = r() * TAU; const d = Math.sqrt(r()) * 40; return { x: Math.cos(a) * d, y: Math.sin(a) * d, r: r.range(0.6, 1.5) }; }), color: argb('2E2016', 0.5) }),
          boilInk('pot ink', (rr) => inkMulti({ paths: [handCircle(56, 56, rr), handCircle(44, 44, rr)], width: 1.7 })),
          ...leaves,
        ],
      })
    );
  }

  // ---- open notebook: writing ----
  let writeTrim;
  let writeLine;
  let ribbonId;
  {
    const r = rng(23);
    const cover = cornerPts(rectCorners(396, 272), r, { jit: 1, bevel: 6 });
    const left = cornerPts([P(-186, -122), P(-8, -122), P(0, -114), P(0, 124), P(-8, 128), P(-186, 126)], r, { jit: 0.8, bevel: 3, mids: 1 });
    const right = left.map((p) => P(-p.x, p.y)).reverse();
    const ruled = [];
    for (let y = -84; y <= 104; y += 18) {
      ruled.push([P(-176, y), P(-12, y + 1)]);
      ruled.push([P(12, y + 1), P(176, y)]);
    }
    const leftWords = [];
    for (let i = 0; i < 9; i++) for (const w of scribbleLine(i === 8 ? 70 : 140 + r.jit(16), rng(50 + i))) leftWords.push({ pts: w.pts.map((p) => P(p.x - 166, p.y - 92 + i * 18)) });
    const rightWords = [];
    for (let i = 0; i < 3; i++) for (const w of scribbleLine(140 + r.jit(14), rng(70 + i))) rightWords.push({ pts: w.pts.map((p) => P(p.x + 22, p.y - 92 + i * 18)) });
    const live = scribbleLine(132, rng(90), { gap: 6 }).map((w) => ({ pts: w.pts.map((p) => P(p.x + 22, p.y - 92 + 3 * 18)) }));
    writeTrim = ids.next();
    writeLine = ids.next();
    ribbonId = ids.next();
    const star = [];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU;
      const rr = i % 2 ? 6 : 14;
      star.push(P(130 + Math.cos(a) * rr, 80 + Math.sin(a) * rr));
    }
    const ribbon = [P(-4, 0), P(4, 0), P(8, 30), P(3, 52), P(6, 58), P(0, 54), P(-5, 60), P(-3, 30)];
    s.add(
      object('writing', {
        x: 362, y: 468, rot: -0.045, foot: cover,
        shadow: { strength: 14 },
        art: [
          // cover
          el('Shape', { name: 'cover' }, [pathXml(cover, { closed: true }), fill('FF4E7378')]),
          washShape({ name: 'cover wash', pts: blobPts(170, 110, r, { n: 10, wobble: 0.2 }), color: '2F4E54', alpha: 0.35, edge: 0.3, soft: 20 }),
          el('Node', { name: 'ribbon', x: 2, y: 128, id: ribbonId }, [
            boilInk('ribbon ink', (rr) => inkMulti({ paths: [{ pts: jitterPts(ribbon, 0.5, rr), closed: true, tension: 0.6 }], width: 1.3 })),
            el('Shape', { name: 'ribbon fill' }, [pathXml(ribbon, { closed: true, tension: 0.6 }), fill('FFB4473B')]),
          ].reverse()),
          el('Shape', { name: 'left page' }, [pathXml(left, { closed: true, tension: 0.5 }), fill(PAPER)]),
          el('Shape', { name: 'right page' }, [pathXml(right, { closed: true, tension: 0.5 }), fill(PAPER)]),
          el('Shape', { name: 'ruled' }, [...ruled.map((g) => polyXml(g)), stroke(argb('6C9BC4', 0.3), 0.8, { cap: 'butt' })]),
          el('Shape', { name: 'margin' }, [polyXml([P(-150, -118), P(-150, 124)]), stroke(argb('D0675A', 0.35), 0.9, { cap: 'butt' })]),
          el('Shape', { name: 'gutter' }, [el('Rectangle', { width: 16, height: 250, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('5A4430', 0.22), { feather: 9 })]),
          watercolor({ name: 'doodle wash', x: 132, y: 82, rx: 20, ry: 18, color: 'E3B94B', seed: 8, alpha: 0.55, grain: false }),
          boilInk('notebook ink', (rr) => [
            inkMulti({ name: 'cover edge', paths: [{ pts: jitterPts(cover, 0.6, rr), closed: true }], width: 1.8 }),
            inkMulti({ name: 'pages', paths: [{ pts: jitterPts(left, 0.6, rr), closed: true, tension: 0.5 }, { pts: jitterPts(right, 0.6, rr), closed: true, tension: 0.5 }], width: 1.6 }),
            inkMulti({ name: 'words', paths: jp([...leftWords, ...rightWords], rr, 0.25), width: 1.05, color: 'CC2E2822', bleed: 0.12 }),
            inkMulti({ name: 'star', paths: [{ pts: jitterPts(star, 0.6, rr), tension: 0.15 }], width: 1.4 }),
          ]),
          inkMulti({ name: 'writing line', id: writeLine, paths: live, width: 1.15, color: 'E62E2822', bleed: 0.12, trim: { end: 0, id: writeTrim } }),
        ],
      })
    );
  }

  // ---- polaroids: elsewhere ----
  let topPolaroid;
  {
    const r = rng(29);
    const fr = rectCorners(122, 142);
    const photoTop = -62;
    const photo = (sky, ground, sun, kind, rr) => {
      const pw = 104;
      const ph = 96;
      const x0 = -pw / 2;
      const y0 = photoTop;
      const box = cornerPts([P(x0, y0), P(x0 + pw, y0), P(x0 + pw, y0 + ph), P(x0, y0 + ph)], rr, { jit: 0.4, bevel: 2 });
      const hill = [];
      const steps = 8;
      for (let i = 0; i <= steps; i++) {
        const x = x0 + (pw * i) / steps;
        const yy = kind === 'mountain' ? y0 + ph * 0.62 - Math.max(0, 34 - Math.abs(x - 6) * 0.9) + rr.jit(1.5) : y0 + ph * (kind === 'sea' ? 0.55 : 0.6) + Math.sin(i * 0.8) * (kind === 'sea' ? 1.5 : 6);
        hill.push(P(x, yy));
      }
      hill.push(P(x0 + pw, y0 + ph), P(x0, y0 + ph));
      const sunXY = kind === 'sea' ? P(18, y0 + ph * 0.55) : P(-22, y0 + 26);
      return [
        washShape({ name: 'sky', pts: box, color: sky, alpha: 0.75, edge: 0.4, soft: 1, blend: 'srcOver' }),
        washShape({ name: 'sun', x: sunXY.x, y: sunXY.y, pts: blobPts(10, 10, rr, { n: 8, wobble: 0.1 }), color: sun, alpha: 0.85, edge: 0.6, soft: 1.5, blend: 'srcOver' }),
        washShape({ name: 'ground', pts: hill, color: ground, alpha: 0.85, edge: 0.6, soft: 1, blend: 'srcOver' }),
      ];
    };
    const pol = (name, x, y, rot, colors, kind, seed, id) => {
      const rr = rng(seed);
      const frame = cornerPts(fr, rr, { jit: 0.5 });
      return el('Node', { name, x, y, rotation: rot, id }, [
        shadowShape(frame, { x: 2, y: 3, strength: 6, alpha: 0.25 }),
        paperShape(frame, { color: 'FFFDFBF6' }),
        ...photo(...colors, kind, rr),
        boilInk(`${name} ink`, (cr) => [
          inkMulti({ paths: jp(sketchSides(fr, cr, { over: 3 }), cr, 0.5), width: 1.5 }),
          inkMulti({ paths: [{ pts: jitterPts(cornerPts([P(-52, photoTop), P(52, photoTop), P(52, photoTop + 96), P(-52, photoTop + 96)], cr, { jit: 0.4, bevel: 2 }), 0.4, cr), closed: true }], width: 1.2, bleed: 0.1 }),
          inkMulti({ name: 'caption', paths: scribbleLine(54, rng(seed + 1)).map((w) => ({ pts: jitterPts(w.pts.map((p) => P(p.x - 28, p.y + 46)), 0.3, cr) })), width: 1.1, color: 'D92E2822', bleed: 0.1 }),
        ]),
      ].reverse());
    };
    topPolaroid = ids.next();
    const foot = cornerPts(rectCorners(190, 190), r, { jit: 2 });
    s.add(
      object('elsewhere', {
        x: 728, y: 552, foot,
        shadow: { alpha: 0.0001 },
        art: [
          pol('pol c', 32, 12, 0.22, ['C9D7E3', '8C93A8', 'F2E3B3'], 'mountain', 301),
          pol('pol b', -28, 8, -0.2, ['F0B27A', '5E8FB3', 'E07A4F'], 'sea', 302),
          pol('pol a', 4, -6, 0.04, ['9CC3DB', '7FA864', 'E8B84A'], 'hill', 303, topPolaroid),
        ],
      })
    );
  }

  // ---- envelope: contact ----
  let sealId;
  {
    const r = rng(31);
    const c = rectCorners(234, 152);
    const foot = cornerPts(c, r, { jit: 0.8 });
    sealId = ids.next();
    const heart = [P(0, 4), P(-5, -1), P(-4, -5), P(0, -3), P(4, -5), P(5, -1)];
    s.add(
      object('contact', {
        x: 998, y: 548, rot: 0.07, foot,
        art: [
          paperShape(foot, { color: 'FFF7EEDD' }),
          offWash(foot, 'D9B98C', r, { alpha: 0.55, soft: 2 }),
          washShape({ name: 'flap shade', pts: [P(-112, -72), P(112, -72), P(0, 10)], color: 'B89466', alpha: 0.3, edge: 0.2, soft: 6 }),
          boilInk('envelope ink', (rr) => [
            inkMulti({ paths: jp(sketchSides(c, rr, { over: 5 }), rr, 0.5), width: 1.7 }),
            inkMulti({ paths: jp([{ pts: [P(-116, -76), P(-40, -24), P(0, 10), P(40, -24), P(116, -76)], tension: 0.25 }, { pts: [P(-116, 76), P(-60, 34), P(-16, 0)] }, { pts: [P(116, 76), P(60, 34), P(16, 0)] }], rr, 0.6), width: 1.5 }),
          ]),
          el('Node', { name: 'seal', x: 0, y: 12, id: sealId }, [
            watercolor({ name: 'wax', rx: 20, ry: 19, color: 'B23A30', seed: 12, alpha: 0.95, grain: false, wobble: 0.18 }),
            boilInk('seal ink', (rr) => [inkMulti({ paths: [handCircle(11, 11, rr)], width: 1.3, color: 'FF5A1A14' }), inkMulti({ paths: [{ pts: jitterPts(heart, 0.3, rr), closed: true, tension: 0.8 }], width: 1.1, color: 'FF5A1A14', bleed: 0 })]),
          ]),
        ],
      })
    );
  }

  // ---- pencil (decoration, rolls on hover) ----
  {
    const r = rng(37);
    const body = cornerPts([P(-62, -7), P(62, -7), P(62, 7), P(-62, 7)], r, { jit: 0.3, bevel: 1.5 });
    const foot = [P(-92, -9), P(86, -9), P(98, 0), P(86, 9), P(-92, 9)];
    s.add(
      object('pencil', {
        x: 600, y: 698, rot: -0.22, foot, open: false,
        shadow: { strength: 5, alpha: 0.3 },
        art: [
          washShape({ name: 'eraser', pts: cornerPts([P(-90, -6.5), P(-76, -6.5), P(-76, 6.5), P(-90, 6.5)], r, { bevel: 2.5, jit: 0.2 }), color: 'E59A9A', alpha: 0.95, edge: 0.6, soft: 1, blend: 'srcOver' }),
          washShape({ name: 'ferrule', pts: cornerPts([P(-77, -7.5), P(-62, -7.5), P(-62, 7.5), P(-77, 7.5)], r, { bevel: 1, jit: 0.2 }), color: 'B3ADA3', alpha: 0.95, edge: 0.6, soft: 1, blend: 'srcOver' }),
          washShape({ name: 'body', pts: body, color: 'E5B94A', alpha: 0.95, edge: 0.6, soft: 1, blend: 'srcOver' }),
          washShape({ name: 'wood', pts: [P(62, -7), P(84, -2), P(84, 2), P(62, 7)], color: 'E6C99A', alpha: 0.95, edge: 0.5, soft: 0.8, blend: 'srcOver' }),
          el('Shape', { name: 'lead' }, [polyXml([P(82, -2.4), P(94, 0), P(82, 2.4)], { closed: true }), fill('FF3C3836')]),
          boilInk('pencil ink', (rr) => inkMulti({
            width: 1.3,
            paths: jp([{ pts: [P(-90, -7), P(62, -7)] }, { pts: [P(-90, 7), P(62, 7)] }, { pts: [P(-77, -2.2), P(62, -2.2)] }, { pts: [P(-77, 2.4), P(62, 2.4)] }, { pts: [P(-90, -7), P(-91, 0), P(-90, 7)] }, { pts: [P(-77, -7.5), P(-77, 7.5)] }, { pts: [P(-62, -7.5), P(-62, 7.5)] }, { pts: [P(62, -7), P(94, 0), P(62, 7)], tension: 0.2 }], rr, 0.35),
          })),
        ],
      })
    );
  }

  // =========================================================
  // ANIMATION
  // =========================================================

  // boil every ink drawing in step, ~8 swaps a second
  const HOLD = 8;
  s.loopLayer(
    'boil',
    s.anim({ name: 'boil', duration: HOLD * 3, loop: 'loop', tracks: solos.map(({ soloId, celIds }) => ({ object: soloId, prop: 'activeComponentId', type: 'Id', keys: celIds.map((c, i) => [i * HOLD, c, 'hold']) })) })
  );

  // objects settle onto the desk on load, one after another
  const order = ['writing', 'about', 'projects', 'now', 'plant', 'elsewhere', 'contact', 'pencil'];
  const introTracks = [];
  order.forEach((k, i) => {
    const o = objects.find((ob) => ob.key === k);
    const t0 = 6 + i * 8;
    introTracks.push(
      { object: o.groupId, prop: 'opacity', keys: [[0, 0], [t0, 0, 'cubic', EASE.out], [t0 + 26, 1]] },
      { object: o.groupId, prop: 'y', keys: [[0, o.y - 14], [t0, o.y - 14, 'cubic', EASE.out], [t0 + 40, o.y]] },
      { object: o.groupId, prop: 'scaleX', keys: [[0, 1.06], [t0, 1.06, 'cubic', EASE.out], [t0 + 40, 1]] },
      { object: o.groupId, prop: 'scaleY', keys: [[0, 1.06], [t0, 1.06, 'cubic', EASE.out], [t0 + 40, 1]] }
    );
  });
  s.loopLayer('intro', s.anim({ name: 'intro', duration: 6 + order.length * 8 + 44, tracks: introTracks }));

  // ambient life
  s.loopLayer('gears', s.anim({ name: 'gears', duration: 1200, loop: 'loop', tracks: [{ object: gearA, prop: 'rotation', keys: [[0, 0], [1200, TAU]] }, { object: gearB, prop: 'rotation', keys: [[0, 0.3], [1200, 0.3 - TAU * (10 / 6)]] }] }));
  s.loopLayer('ripple', s.anim({ name: 'ripple', duration: 300, loop: 'loop', tracks: [
    { object: rippleId, prop: 'opacity', keys: [[0, 0], [60, 0, 'cubic', EASE.out], [80, 0.9, 'cubic', EASE.soft], [220, 0]] },
    { object: rippleId, prop: 'scaleX', keys: [[0, 0.15], [60, 0.15, 'cubic', EASE.out], [220, 1]] },
    { object: rippleId, prop: 'scaleY', keys: [[0, 0.15], [60, 0.15, 'cubic', EASE.out], [220, 1]] },
  ] }));
  s.loopLayer('steam', s.anim({ name: 'steam', duration: 330, loop: 'loop', tracks: steamIds.flatMap((id, i) => {
    const ph = i * 90;
    const x0 = -20 + i * 18;
    return [
      { object: id, prop: 'opacity', keys: [[0, 0], [ph, 0, 'cubic', EASE.inOut], [ph + 50, 0.85, 'cubic', EASE.inOut], [ph + 160, 0]] },
      { object: id, prop: 'y', keys: [[0, 6], [ph, 6, 'cubic', EASE.soft], [ph + 160, -46]] },
      { object: id, prop: 'x', keys: [[0, x0], [ph, x0, 'cubic', EASE.inOut], [ph + 160, x0 + 10]] },
    ];
  }) }));
  s.loopLayer('leaves', s.anim({ name: 'leaves', duration: 280, loop: 'pingPong', tracks: leafIds.map(({ id, base }, i) => ({ object: id, prop: 'rotation', keys: [[0, base - 0.035 * (i % 2 ? 1 : -1), 'cubic', EASE.inOut], [280, base + 0.035 * (i % 2 ? 1 : -1)]] })) }));
  s.loopLayer('writing', s.anim({ name: 'write', duration: 420, loop: 'loop', tracks: [
    { object: writeTrim, prop: 'end', keys: [[0, 0], [40, 0, 'cubic', [0.4, 0.1, 0.6, 0.9]], [220, 1], [400, 1]] },
    { object: writeLine, prop: 'opacity', keys: [[0, 1], [350, 1, 'cubic', EASE.inOut], [400, 0], [420, 0]] },
  ] }));
  s.loopLayer('ribbon', s.anim({ name: 'ribbon', duration: 240, loop: 'pingPong', tracks: [{ object: ribbonId, prop: 'rotation', keys: [[0, -0.06, 'cubic', EASE.inOut], [240, 0.08]] }] }));
  s.loopLayer('polaroid', s.anim({ name: 'polaroid', duration: 300, loop: 'pingPong', tracks: [{ object: topPolaroid, prop: 'rotation', keys: [[0, 0.02, 'cubic', EASE.inOut], [300, 0.07]] }] }));
  s.loopLayer('seal', s.anim({ name: 'seal', duration: 200, loop: 'pingPong', tracks: [
    { object: sealId, prop: 'scaleX', keys: [[0, 1, 'cubic', EASE.inOut], [200, 1.06]] },
    { object: sealId, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.inOut], [200, 1.06]] },
  ] }));

  // hover lift, wiggle, click → event
  for (const o of objects) {
    const hover = s.input('bool', `hover_${o.key}`, false);
    const wiggle = s.input('trigger', `wiggle_${o.key}`);
    const sx = o.shadow.x ?? 3;
    const sy = o.shadow.y ?? 4;
    const pose = (lift, dy, shx, shy, op) =>
      s.anim({ name: `${o.key} ${lift > 1 ? 'up' : 'down'}`, duration: 1, tracks: [
        { object: o.liftId, prop: 'scaleX', keys: [[0, lift]] },
        { object: o.liftId, prop: 'scaleY', keys: [[0, lift]] },
        { object: o.liftId, prop: 'y', keys: [[0, dy]] },
        { object: o.shadowId, prop: 'x', keys: [[0, shx]] },
        { object: o.shadowId, prop: 'y', keys: [[0, shy]] },
        { object: o.shadowId, prop: 'opacity', keys: [[0, op]] },
      ] });
    s.boolLayer(`${o.key} hover`, hover, pose(1, 0, sx, sy, 0.75), pose(1.035, -5, sx + 7, sy + 11, 1), { mixIn: 220, mixOut: 380 });
    s.triggerLayer(`${o.key} wiggle`, wiggle, s.anim({ name: `${o.key} wiggle`, duration: 42, tracks: [{ object: o.wigId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.out], [9, 0.035, 'cubic', EASE.inOut], [21, -0.025, 'cubic', EASE.inOut], [32, 0.01, 'cubic', EASE.inOut], [42, 0]] }] }));
    const evHover = s.event(`hover:${o.key}`);
    const evLeave = s.event(`leave:${o.key}`);
    s.listen(o.hitId, 'enter', [Scene.setBool(hover, true), Scene.fire(wiggle), Scene.emit(evHover)]);
    s.listen(o.hitId, 'exit', [Scene.setBool(hover, false), Scene.emit(evLeave)]);
    if (o.open) s.listen(o.hitId, 'click', [Scene.emit(s.event(`open:${o.key}`))]);
  }

  return document(s.toXml());
}
