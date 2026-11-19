// Draft 11 · Winter II — draft 7 pushed toward light, atmosphere and craft.
// Same bright day in the Canadian woods, same trees inking in from the edges,
// but now a low sun rakes long blue shadows across the snow (they shorten as
// you scroll and the sun climbs), a far treeline sits in layered misty washes,
// diamond dust glints, the ink has thick-thin weight, the birch peels, the
// snowfall has depth and gusts, and the maple branch breathes in the wind.
import {
  Ids, Scene, rng, P, el, argb, pathXml, polyXml, fill, stroke, solid, blobPts, resample, jitterPts,
  washShape, document, EASE, TAU, boil, inkShape, stippleShape, lighten,
} from '../lib/ink.mjs';

const INK = '2E3A44'; // cold slate ink
const SNOW = 'FFFFFF';
const SHADOW = '9DB6CC'; // blue snow shadow
const SHADOW2 = '7F9CB8'; // deeper blue where shadows pool
const SPRUCE = '3D5C57';
const FIR = '466B5C';
const RUST = 'B4532E';
const CANOE = 'B8432F';
const LIT = 'FFF3DC'; // low-sun warmth on the lit side of snow
const BG = process.env.WINTER_BG; // paper colour for CLI previews only

const ink = (a = 1) => argb(INK, a);

// ---------------------------------------------------------------- shared bits

// keys that hide something until `t`, then ease it in
const appear = (id, t, len = 30, from = 0) => ({ object: id, prop: 'opacity', keys: [[0, from], [t, from, 'cubic', EASE.out], [t + len, 1]] });
const trimIn = (id, t, len, to = 1) => ({ object: id, prop: 'end', keys: [[0, 0], [t, 0, 'cubic', [0.35, 0, 0.25, 1]], [t + len * to, to]] });

// An ink line that draws on: soft bleed + crisp body, both trimmed together.
// `heavy` is the fraction of the line that gets a thicker overlay, so a stroke
// starts fat where the nib pressed and thins toward the lift, as a dip pen does.
function drawnLine(ids, pts, { width = 1.4, alpha = 1, tension = 1, color = INK, closed = false, heavy = 0 }, t, len, tracks) {
  const a = ids.next();
  const b = ids.next();
  tracks.push(trimIn(a, t, len), trimIn(b, t, len));
  const paints = [
    el('Stroke', { thickness: width * 2.3, cap: 'round', join: 'round', name: 'Bleed' }, [solid(argb(color, alpha * 0.14)), el('TrimPath', { end: 0, id: a, name: 'Trim' }), el('Feather', { strength: width * 1.4, name: 'F' })]),
    el('Stroke', { thickness: width, cap: 'round', join: 'round', name: 'Body' }, [solid(argb(color, alpha)), el('TrimPath', { end: 0, id: b, name: 'Trim' })]),
  ];
  if (heavy) {
    const c = ids.next();
    tracks.push(trimIn(c, t, len, heavy));
    paints.push(el('Stroke', { thickness: width * 1.6, cap: 'round', join: 'round', name: 'Heavy' }, [solid(argb(color, alpha * 0.9)), el('TrimPath', { end: 0, id: c, name: 'Trim' }), el('Feather', { strength: 0.5, name: 'F' })]));
  }
  return el('Shape', { name: 'line' }, [pathXml(pts, { tension, closed }), ...paints]);
}

// many short ticks in one shape (needles, grass, lenticels)
function ticks(segs, { width = 0.8, color, name = 'ticks', id, opacity }) {
  return el('Shape', { name, id, opacity }, [...segs.map((s) => pathXml(s, { tension: 0.6 })), stroke(color, width)]);
}

// lumpy snow sitting on top of a line of points
function capPts(top, r, thick) {
  const n = top.length;
  const upper = top.map((p, i) => {
    const taper = Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 0.55);
    return P(p.x + r.jit(0.6), p.y - (thick * taper * r.range(0.75, 1.25) + 0.6));
  });
  const lower = [...top].reverse().map((p) => P(p.x, p.y + 1.2));
  return [...upper, ...lower];
}

function snowCap(r, top, thick, { id, opacity, name = 'snow' } = {}) {
  const pts = capPts(top, r, thick);
  const ridge = pts.slice(0, top.length);
  // two shapes, each path carrying two paints (the feather's offset does the misregistration)
  return el('Node', { name, id, opacity }, [
    el('Shape', { name: 'ridge' }, [
      pathXml(ridge, { tension: 0.8 }),
      // the low sun catches the crest: a warm hairline just under the ink
      el('Stroke', { thickness: 1.3, cap: 'round', join: 'round', name: 'Lit' }, [solid(argb(LIT, 0.7)), el('Feather', { strength: 0.6, offsetY: 0.9, name: 'F' })]),
      // ink edge on the lit top only, very light
      stroke(argb('7F97AB', 0.5), 0.7),
    ]),
    el('Shape', { name: 'cap' }, [
      pathXml(pts, { closed: true, tension: 0.8 }),
      // cool shadow tucked under the snow, softer and bluer at the underside
      el('Fill', { fillRule: 'clockwise', name: 'Shade' }, [solid(argb(SHADOW, 0.36)), el('Feather', { strength: 3, offsetY: 2.6, name: 'F' })]),
      fill(argb(SNOW, 1)),
    ]),
  ]);
}

// a few flakes of snow that puff out and fall when a cap lets go
function puff(ids, r, c, start, tracks, n = 6, spread = 30) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const id = ids.next();
    const sz = r.range(2.2, 4.6);
    out.push(el('Shape', { name: 'puff', x: c.x, y: c.y, opacity: 0, id }, [
      el('Ellipse', { width: sz, height: sz, originX: 0.5, originY: 0.5, name: 'P' }),
      fill(argb('FFFFFF', 1)),
      stroke(argb('7F97AB', 0.95), 0.7),
    ]));
    const t0 = start + Math.round(r.range(0, 8));
    const len = Math.round(r.range(70, 120));
    const dx = r.jit(spread);
    const dy = r.range(60, 150);
    tracks.push(
      { object: id, prop: 'x', keys: [[t0, c.x + r.jit(spread * 0.3), 'cubic', EASE.out], [t0 + len, c.x + dx]] },
      { object: id, prop: 'y', keys: [[t0, c.y, 'cubic', [0.4, 0, 0.9, 0.6]], [t0 + len, c.y + dy]] },
      { object: id, prop: 'opacity', keys: [[0, 0], [t0, 0, 'linear'], [t0 + 6, 0.95], [t0 + Math.round(len * 0.6), 0.85], [t0 + len, 0]] },
    );
  }
  return out;
}

// a cap that slides off its bough with a puff, then quietly settles back
function slideTracks(capId, start, { drop = 22, back = 260 } = {}) {
  return [
    { object: capId, prop: 'y', keys: [[0, 0], [start, 0, 'cubic', [0.5, 0, 0.9, 0.5]], [start + 26, drop, 'hold'], [start + 27, -4], [start + back, -4, 'cubic', EASE.out], [start + back + 50, 0]] },
    { object: capId, prop: 'opacity', keys: [[0, 1], [start + 8, 1, 'cubic', EASE.in], [start + 26, 0, 'hold'], [start + back, 0, 'cubic', EASE.out], [start + back + 50, 1]] },
  ];
}

// ---------------------------------------------------------------- conifers

/**
 * Black spruce / balsam fir: a trunk, then tiers of drooping boughs from the
 * ground up, each with hanging needles, a misregistered green wash and snow.
 */
function conifer(ids, r, { cx, base, height, maxW, tiers, color, alpha = 1, t0 = 0, club = false, snowiness = 0.75 }, tracks) {
  const back = []; // washes
  const mid = []; // ink
  const front = []; // snow
  const caps = [];
  const top = P(cx + r.jit(4), base - height);
  const trunk = resample([P(cx, base), P(cx + r.jit(3), base - height * 0.4), P(cx + r.jit(3), base - height * 0.75), top], 8).map((p) => P(p.x + r.jit(0.8), p.y));
  mid.push(drawnLine(ids, trunk, { width: 1.7, alpha, heavy: 0.45 }, t0, 70, tracks));
  // a scrap of exposed trunk at the base
  mid.push(drawnLine(ids, [P(cx - 3, base), P(cx - 2.4, base - 26)], { width: 1, alpha: alpha * 0.8 }, t0, 30, tracks));
  // dry-brush bark: a few broken flecks dragged up the shadow side of the trunk
  if (alpha > 0.6) {
    const flecks = [];
    for (let k = 0; k < 14; k++) {
      const y = base - r.range(10, height * 0.5);
      flecks.push([P(cx - 3 + r.jit(1.5), y), P(cx - 2.5 + r.jit(1.5), y - r.range(2, 6))]);
    }
    const fId = ids.next();
    mid.push(ticks(flecks, { width: 0.9, color: ink(alpha * 0.35), id: fId, opacity: 0, name: 'dryBrush' }));
    tracks.push(appear(fId, t0 + 50, 40));
  }

  // a soft columnar body wash unifies the boughs into one silhouette
  const bodyId = ids.next();
  const bodyPts = [];
  for (let k = 0; k <= 8; k++) {
    const f = k / 8;
    const yy = base - height * (0.04 + 0.94 * f);
    const ww = (maxW * Math.pow(1 - f, 0.9) + 5) * 0.75;
    bodyPts.push(P(cx + ww + r.jit(4), yy));
  }
  for (let k = 8; k >= 0; k--) {
    const f = k / 8;
    const yy = base - height * (0.04 + 0.94 * f) + 6;
    const ww = (maxW * Math.pow(1 - f, 0.9) + 5) * 0.75;
    bodyPts.push(P(cx - ww + r.jit(4), yy));
  }
  back.push(el('Node', { name: 'bodyWash', id: bodyId, opacity: 0 }, el('Shape', { name: 'body', x: 3, y: 2, blendModeValue: 'multiply' }, [pathXml(bodyPts, { closed: true, tension: 0.6 }), fill(argb(color, 0.28 * alpha), { feather: 9 })])));
  tracks.push(appear(bodyId, t0 + 60, 90));

  const heavyLow = [], heavyHigh = [];
  for (let i = 0; i < tiers; i++) {
    const f = i / (tiers - 1);
    const y = base - height * (0.05 + 0.93 * f) + r.jit(4);
    let w = maxW * Math.pow(1 - f, 0.85) + 7;
    if (club && f > 0.8) w *= 1.45 + r.range(0, 0.4); // black spruce's shaggy club top
    if (club && f > 0.25 && f < 0.75 && r() < 0.3) w *= 0.45; // gaps, as wind-thinned spruce have
    const tStart = t0 + 18 + Math.round(f * 110);
    for (const side of [-1, 1]) {
      if (r() < 0.08) continue;
      const L = w * r.range(0.6, 1.2);
      const sag = L * r.range(0.12, 0.3);
      const lift = r.range(-2, 4);
      // asymmetry: the windward side (left) hangs lower and shorter
      const droop = side < 0 ? 1.25 : 0.9;
      const b = [P(cx, y - lift), P(cx + side * L * 0.33, y + sag * 0.35 * droop), P(cx + side * L * 0.7, y + sag * 0.95 * droop), P(cx + side * L, y + (sag * 0.75 - 2) * droop)].map((p) => P(p.x + r.jit(1.2), p.y + r.jit(1.2)));
      mid.push(drawnLine(ids, b, { width: 1 + (1 - f) * 0.55, alpha, tension: 0.9 }, tStart, 26, tracks));
      // the bough's thick-thin: a heavier pass over its first third, batched per tree below
      (f < 0.5 ? heavyLow : heavyHigh).push(resample(b, 7).slice(0, 3));
      // a hanging branchlet off the longer boughs, the way old spruce let their lower tiers fray
      if (L > 26 && alpha > 0.6 && r() < 0.45) {
        const at = b[2];
        const bl = [at, P(at.x + side * r.range(3, 8) + r.jit(2), at.y + r.range(7, 13)), P(at.x + side * r.range(4, 10), at.y + r.range(14, 22))];
        mid.push(drawnLine(ids, bl, { width: 0.8, alpha: alpha * 0.85, tension: 0.8 }, tStart + 14, 18, tracks));
      }
      // needles: long ones hanging, short ones bristling up
      const along = resample(b, Math.max(5, Math.round(L / 2.6)));
      const nId = ids.next();
      const segs = [];
      along.slice(1).forEach((p, k) => {
        const ln = r.range(4, 10) * (0.65 + (1 - f) * 0.55) * (1 - (k / along.length) * 0.35);
        segs.push([p, P(p.x + side * ln * r.range(0.2, 0.6) + r.jit(1), p.y + ln)]);
        if (k % 2 === 0) segs.push([p, P(p.x + side * r.range(1, 3), p.y - r.range(2, 4.5))]);
      });
      mid.push(ticks(segs, { width: 0.7, color: ink(alpha * 0.8), id: nId, opacity: 0 }));
      tracks.push(appear(nId, tStart + 10, 22));
      // a wash under each bough, a little off the ink
      const under = [...along.map((p) => P(p.x, p.y - 2)), ...[...along].reverse().map((p, k) => P(p.x - side * 1, p.y + r.range(5, 9) * (0.7 + (1 - f) * 0.5) * (k / along.length + 0.3)))];
      const wId = ids.next();
      back.push(el('Node', { name: 'boughWash', id: wId, opacity: 0, x: r.jit(2) + 2, y: r.jit(2) + 2 }, washShape({ pts: under, color, alpha: 0.55 * alpha, edge: 0.6, soft: 1.6, tension: 0.6 })));
      tracks.push(appear(wId, tStart + 18, 40));
      if (r() < snowiness) {
        const capId = ids.next();
        const capTop = resample(b.slice(0, 4), 7).map((p) => P(p.x, p.y - 0.8));
        front.push(snowCap(r, capTop.slice(1, -1 - (r() < 0.5 ? 1 : 0)), r.range(2.4, 4.4) * (0.65 + (1 - f) * 0.7), { id: capId, opacity: 0 }));
        tracks.push(appear(capId, tStart + 40, 30));
        caps.push({ id: capId, c: along[Math.floor(along.length * 0.55)], L, side, f });
      }
    }
  }
  // thick-thin weight for the boughs: one shape of heavy stubs per half of the tree,
  // fading in as the ink "dries" (far cheaper than a third trimmed stroke per bough)
  for (const [segs, w, t] of [[heavyLow, 1.9, t0 + 60], [heavyHigh, 1.35, t0 + 110]]) {
    if (!segs.length) continue;
    const hid = ids.next();
    mid.push(el('Shape', { name: 'heavy', id: hid, opacity: 0 }, [...segs.map((p) => pathXml(p, { tension: 0.9 })), stroke(ink(alpha * 0.9), w, { feather: 0.5 })]));
    tracks.push(appear(hid, t, 70));
  }
  return { back, mid, front, caps, top };
}

// ---------------------------------------------------------------- white birch

function birch(ids, r, { x, base, height, w, lean = 0, t0 = 0 }, tracks) {
  const center = resample([P(x, base), P(x + lean * 0.3 + r.jit(3), base - height * 0.35), P(x + lean * 0.7 + r.jit(3), base - height * 0.7), P(x + lean, base - height)], 14);
  const half = (i) => (w / 2) * (1 - (i / (center.length - 1)) * 0.45);
  const L = center.map((p, i) => P(p.x - half(i) + r.jit(0.5), p.y));
  const R = center.map((p, i) => P(p.x + half(i) + r.jit(0.5), p.y));
  const body = [...L, ...[...R].reverse()];
  const parts = [];
  const bodyId = ids.next();
  parts.push(el('Node', { name: 'bark', id: bodyId, opacity: 0 }, [
    // roundness: a cool wash down the shadow side
    el('Shape', { name: 'shade' }, [pathXml(R.map((p, i) => P(p.x - half(i) * 0.35, p.y)), { tension: 0.9 }), stroke(argb('8EA0B1', 0.32), w * 0.32, { feather: 2 })]),
    el('Shape', { name: 'white' }, [pathXml(body, { closed: true, tension: 0.9 }), fill(argb('FFFFFF', 1))]),
  ].reverse()));
  tracks.push(appear(bodyId, t0 + 10, 50));
  parts.push(drawnLine(ids, L, { width: 1.3, heavy: 0.3 }, t0, 80, tracks));
  parts.push(drawnLine(ids, R, { width: 1.1, alpha: 0.85 }, t0 + 6, 80, tracks));

  // curls of peeling bark lifting off the trunk, papery and warm on the inside
  const curlId = ids.next();
  const curls = [];
  for (let k = 0; k < 5; k++) {
    const i = Math.floor(r.range(2, center.length - 3));
    const side = k % 2 ? 1 : -1;
    const p = (side > 0 ? R : L)[i];
    const h = r.range(3, 5.5);
    const c = [P(p.x - side * 1.5, p.y + 2), P(p.x + side * 1.2, p.y + 0.5), P(p.x + side * h * 0.9, p.y - h * 0.5), P(p.x + side * h, p.y - h * 1.3), P(p.x + side * h * 0.5, p.y - h * 1.35)];
    curls.push(
      el('Shape', { name: 'curlWash', blendModeValue: 'multiply' }, [pathXml(c, { tension: 0.9 }), stroke(argb('D9B58C', 0.45), 1.8)]),
      el('Shape', { name: 'curl' }, [pathXml(c, { tension: 0.9 }), stroke(ink(0.6), 0.7)]),
    );
  }
  parts.push(el('Node', { name: 'curls', id: curlId, opacity: 0 }, curls.reverse()));
  tracks.push(appear(curlId, t0 + 80, 40));

  // lenticels: dark horizontal dashes, and a few branch-scar "eyes"
  const marks = [];
  for (let k = 0; k < 44; k++) {
    const i = Math.floor(r.range(0.5, center.length - 1.5));
    const p = center[i];
    const hw = half(i);
    const len = hw * r.range(0.5, 1.15);
    const off = r.jit(hw - len / 2);
    const y = p.y + r.jit(6);
    marks.push([P(p.x + off - len / 2, y), P(p.x + off, y + r.jit(0.8)), P(p.x + off + len / 2, y + r.jit(0.8))]);
  }
  const eyes = [];
  for (let k = 0; k < 4; k++) {
    const i = Math.floor(r.range(2, center.length - 3));
    const p = center[i];
    const s = r.range(3, 5.5);
    eyes.push([P(p.x - s * 1.2, p.y - s * 0.4), P(p.x, p.y + s * 0.5), P(p.x + s * 1.2, p.y - s * 0.4)]);
  }
  const mId = ids.next();
  parts.push(el('Node', { name: 'marks', id: mId, opacity: 0 }, [
    ticks(marks.slice(0, 22), { width: 2.2, color: ink(0.85) }),
    ticks(marks.slice(22), { width: 1.2, color: ink(0.75) }),
    ticks(eyes, { width: 1.8, color: ink(0.9) }),
    // peeling warmth
    ...[0, 1, 2].map(() => {
      const i = Math.floor(r.range(2, center.length - 2));
      const p = center[i];
      return el('Shape', { name: 'peel', x: p.x + r.jit(half(i) * 0.4), y: p.y }, [pathXml(blobPts(half(i) * 0.5, 4, r, { n: 7 }), { closed: true }), fill(argb('D7B48E', 0.35), { feather: 1.2 })]);
    }),
  ]));
  tracks.push(appear(mId, t0 + 60, 40));

  // a few bare twigs up top
  const tip = center[center.length - 1];
  for (let k = 0; k < 3; k++) {
    const p = center[center.length - 2 - k * 2];
    const side = k % 2 ? 1 : -1;
    const tw = [p, P(p.x + side * r.range(18, 30), p.y - r.range(14, 26)), P(p.x + side * r.range(30, 50), p.y - r.range(30, 46))];
    parts.push(drawnLine(ids, tw, { width: 1 }, t0 + 70 + k * 10, 40, tracks));
  }
  parts.push(drawnLine(ids, [tip, P(tip.x + r.jit(6), tip.y - 30)], { width: 0.9 }, t0 + 78, 30, tracks));
  return parts;
}

// ground drift: a long lumpy mound, white, with blue shadows pooled under things
function drift(r, { x0, x1, y, h, shadows = [], taperL = false, taperR = false }) {
  const n = 12;
  const top = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    let k = 0.55 + 0.45 * Math.sin(f * Math.PI);
    if (taperL) k *= Math.min(1, f * 3.2);
    if (taperR) k *= Math.min(1, (1 - f) * 3.2);
    top.push(P(x0 + (x1 - x0) * f, y + 26 - (h + 26) * k + (k > 0.05 ? r.jit(h * 0.12) : 0)));
  }
  const pts = [...top, P(x1, y + 200), P(x0, y + 200)];
  return [
    ...shadows.map((s) => el('Node', { name: 'pool', x: s.x, y: s.y }, [
      // a wet-in-wet bloom: the shadow pools, then a backrun pushes the pigment to a crisp lighter rim
      el('Shape', { name: 'backrun', x: s.rx * 0.2, y: -1, blendModeValue: 'multiply' }, [pathXml(blobPts(s.rx * 0.55, s.ry * 0.6, r, { n: 8, wobble: 0.22 }), { closed: true }), fill(argb(lighten(SHADOW, 0.4), 0.3), { feather: 1 }), stroke(argb(SHADOW2, 0.28), 0.8, { feather: 0.6 })]),
      el('Shape', { name: 'pool' }, [pathXml(blobPts(s.rx, s.ry, r, { n: 9, wobble: 0.2 }), { closed: true }), fill(argb(SHADOW, 0.32), { feather: 7 })]),
    ].reverse())),
    el('Shape', { name: 'drift' }, [pathXml(top, { tension: 0.8 }), stroke(argb('7F97AB', 0.5), 0.9)]),
    el('Shape', { name: 'driftBody' }, [pathXml(pts, { closed: true, tension: 0.6 }), fill(argb('FFFFFF', 0.92))]),
  ];
}

// ---------------------------------------------------------------- artboards

function standL(ids) {
  const W = 460, H = 900;
  const s = new Scene(ids, { name: 'StandL', w: W, h: H, x: 0, y: 0, bg: BG });
  const r = rng(31);
  const grow = [];
  const far = coniferAuto(ids, r, { cx: 265, base: 852, height: 600, maxW: 44, tiers: 26, color: '7C9790', alpha: 0.45, t0: 40, club: true });
  const near = coniferAuto(ids, r, { cx: 112, base: 868, height: 740, maxW: 58, tiers: 32, color: SPRUCE, alpha: 1, t0: 0, club: true });
  const bir = birch(ids, r, { x: 356, base: 884, height: 780, w: 22, lean: 14, t0: 90 }, grow);
  // grass tufts poking out of the snow
  const tufts = [];
  for (const gx of [40, 205, 300, 420]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, 866), P(gx + k * 3 + r.jit(6) - 4, 866 - r.range(7, 16))]);
  const tuftId = ids.next();
  grow.push(appear(tuftId, 160, 40));
  const ground = drift(r, { x0: -30, x1: W - 6, y: 878, h: 26, taperR: true, shadows: [{ x: 140, y: 878, rx: 90, ry: 9 }, { x: 290, y: 870, rx: 60, ry: 7 }, { x: 380, y: 884, rx: 50, ry: 7 }] });

  // ambient: every so often a clump lets go of a bough
  const amb = [];
  const ambCaps = near.caps.filter((c) => c.f > 0.25 && c.f < 0.6).slice(0, 1);
  const ambPuffs = [];
  for (const c of ambCaps) {
    amb.push(...slideTracks(c.id, 520));
    ambPuffs.push(...puff(ids, r, c.c, 520, amb, 7, 26));
  }
  const LOOP = 1100;
  // the slide anim also owns the cap's opacity, so its frame 0 must match "settled"
  const slideLoop = s.anim({ name: 'Ambient slide', duration: LOOP, loop: 'loop', tracks: amb });

  // interactive: brush a bough and its snow lets go
  const interactive = near.caps.filter((c) => !ambCaps.includes(c) && c.f > 0.12 && c.f < 0.85).filter((_, i) => i % 3 === 0).slice(0, 5);
  const shakePuffs = [];
  const hits = [];
  interactive.forEach((c, k) => {
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    shakePuffs.push(...puff(ids, r, c.c, 0, tr, 7, 28));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x - c.side * 4, y: c.c.y - 4, id: hid }, [el('Ellipse', { width: c.L * 1.3, height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });

  // back to front
  s.add(
    ...far.back, ...far.mid, ...far.front,
    ...ground,
    ...near.back, ...near.mid, ...near.front,
    ...bir,
    ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts' }),
    ...ambPuffs, ...shakePuffs, ...hits,
  );
  const intro = s.anim({ name: 'Grow', duration: 300, tracks: [...grow, ...gatherTracks()] });
  s.loopLayer('grow', intro);
  const wait = s.anim({ name: 'Wait', duration: 320, tracks: [] });
  s.sequenceLayer('ambient', [wait, slideLoop]);
  return s.toXml();
}

// conifer() pushes its timeline into a module-level buffer; collect it here
let coniferTracks = [];
function gatherTracks() {
  const t = coniferTracks;
  coniferTracks = [];
  return t;
}
// wrap so callers don't thread a tracks array through
function coniferAuto(ids, r, opts) {
  return conifer(ids, r, opts, coniferTracks);
}

// ---------- sugar maple branch reaching in from the top right, with a chickadee

function growBranch(r, { origin, angle, length, thick, depth, speed = 3, bounds }) {
  const segs = [];
  const tips = [];
  function branch(start, ang, len, th, d, t0, bias) {
    const n = Math.max(2, Math.round(len / 50));
    let p = start, t = t0, a = ang;
    for (let i = 0; i < n; i++) {
      a += r.jit(0.3) + bias * 0.1;
      const L = (len / n) * r.range(0.8, 1.2);
      const q = P(p.x + Math.cos(a) * L, p.y + Math.sin(a) * L);
      if (bounds && (q.x < bounds.x0 || q.y < bounds.y0 || q.y > bounds.y1)) break;
      const w0 = th * (1 - (i / n) * 0.5);
      const w1 = th * (1 - ((i + 1) / n) * 0.5);
      const dur = L / speed;
      segs.push({ a: p, b: q, w: (w0 + w1) / 2, t0: t, t1: t + dur });
      if (d > 0 && i < n - 1 && r() < (d > 1 ? 0.6 : 0.4)) {
        const side = r() < 0.5 ? -1 : 1;
        // maple twigs reach upward, as bare deciduous twigs do
        branch(q, a + side * r.range(0.45, 0.85) + (Math.cos(a) < 0 ? 0.25 : -0.25), len * r.range(0.35, 0.55), w1 * 0.6, d - 1, t + dur, -side);
      }
      p = q;
      t += dur;
    }
    tips.push({ p, a, t, th });
    if (d > 0 && th > 3) branch(p, a + r.jit(0.4), len * 0.5, th * 0.5, d - 1, t, 0);
  }
  branch(origin, angle, length, thick, depth, 0, 0);
  return { segs, tips };
}

function mapleLeaf(r) {
  // five lobes, simplified: an ink outline + a rust wash
  const pts = [];
  const lobes = [[0, 13], [0.5, 6], [0.9, 11], [1.35, 5], [1.65, 8], [2.2, 3]];
  for (const side of [1, -1]) {
    const arr = lobes.map(([a, rr]) => {
      const ang = -Math.PI / 2 + side * a;
      return P(Math.cos(ang) * rr * r.range(0.9, 1.1), Math.sin(ang) * rr * r.range(0.9, 1.1) + 2);
    });
    pts.push(...(side === 1 ? arr : arr.reverse()));
  }
  pts.push(P(0, 6));
  return pts;
}

function chickadee(ids, s, r, { headId, wingId, tailId }) {
  // facing left, ~40px long, perched with its feet at (0, 0)
  const ox = 0, oy = -14;
  const bodyPts = blobPts(13, 9.5, r, { n: 10, wobble: 0.05 }).map((p) => P(p.x + ox + 1, p.y + oy));
  const washes = [
    el('Shape', { name: 'belly' }, [pathXml(blobPts(10, 6, r, { n: 8 }).map((p) => P(p.x + ox - 1, p.y + oy + 4)), { closed: true }), fill(argb('F1E7D2', 0.95), { feather: 1.5 })]),
    el('Shape', { name: 'flank', blendModeValue: 'multiply' }, [pathXml(blobPts(7, 4, r, { n: 7 }).map((p) => P(p.x + ox + 6, p.y + oy + 3)), { closed: true }), fill(argb('D9AE7C', 0.75), { feather: 2 })]),
    el('Shape', { name: 'back', blendModeValue: 'multiply' }, [pathXml(blobPts(12, 6, r, { n: 8 }).map((p) => P(p.x + ox + 3, p.y + oy - 3)), { closed: true }), fill(argb('9AA4AB', 0.8), { feather: 1.2 })]),
  ];
  const bodyInk = boil(s, {
    name: 'BirdInk', seed: 61, hold: 8,
    draw: (rr) => [
      inkShape({ pts: jitterPts(bodyPts, 0.5, rr), closed: true, color: ink(), width: 1.2, bleed: 0.12 }),
      inkShape({ pts: [P(-3, -8), P(-3.5, -2), P(-4, 0)], color: ink(), width: 1, bleed: 0 }),
      inkShape({ pts: [P(3, -8), P(3, -2), P(2.5, 0)], color: ink(), width: 1, bleed: 0 }),
      inkShape({ pts: [P(-7, 0), P(-1, 0.4), P(5, 0)], color: ink(0.9), width: 0.9, bleed: 0 }),
    ],
  });
  const wing = el('Node', { name: 'wing', x: 4, y: oy - 2, id: wingId }, [
    el('Shape', { name: 'wingWash', blendModeValue: 'multiply' }, [pathXml([P(-7, -3), P(4, -5), P(11, 0), P(2, 4), P(-6, 3)], { closed: true, tension: 0.7 }), fill(argb('6F7C86', 0.65), { feather: 0.8 })]),
    el('Shape', { name: 'wingInk' }, [pathXml([P(-6, -2), P(4, -4.5), P(11, 0)], { tension: 0.8 }), pathXml([P(-3, 1), P(4, 0.5), P(9, 1.5)], { tension: 0.8 }), stroke(argb('F5F2EA', 0.9), 0.8), stroke(ink(0.9), 0.5)]),
  ].reverse());
  const tail = el('Node', { name: 'tail', x: 12, y: oy + 1, id: tailId }, [
    el('Shape', { name: 'tailWash', blendModeValue: 'multiply' }, [pathXml([P(0, -2.5), P(14, 2), P(13, 5.5), P(0, 2.5)], { closed: true, tension: 0.3 }), fill(argb('7A858D', 0.8))]),
    el('Shape', { name: 'tailInk' }, [pathXml([P(0, -2.5), P(14, 2), P(13, 5.5), P(0, 2.5)], { tension: 0.3 }), stroke(ink(), 1)]),
  ].reverse());
  // head: white cheek, black cap and bib, tiny beak
  const hx = -11, hy = oy - 7;
  const headCircle = blobPts(7.5, 7, r, { n: 9, wobble: 0.04 });
  const capPtsH = [];
  for (let a = 180; a <= 360; a += 30) capPtsH.push(P(Math.cos((a * Math.PI) / 180) * 7.6, Math.sin((a * Math.PI) / 180) * 7.2));
  capPtsH.push(P(5, -0.5), P(-1, 0.6), P(-7.6, 0.2));
  const headInk = boil(s, {
    name: 'HeadInk', seed: 63, hold: 8,
    draw: (rr) => [inkShape({ pts: jitterPts(headCircle, 0.35, rr), closed: true, color: ink(), width: 1.1, bleed: 0.1 })],
  });
  const head = el('Node', { name: 'head', x: hx, y: hy, id: headId }, [
    el('Shape', { name: 'cheek' }, [pathXml(headCircle, { closed: true }), fill(argb('FBFAF6', 1))]),
    el('Shape', { name: 'cap' }, [pathXml(capPtsH, { closed: true, tension: 0.6 }), fill(argb('20262C', 0.95))]),
    el('Shape', { name: 'bib' }, [pathXml(blobPts(4, 3.2, r, { n: 7 }).map((p) => P(p.x - 1, p.y + 6)), { closed: true }), fill(argb('20262C', 0.92))]),
    headInk.xml,
    el('Shape', { name: 'beak' }, [pathXml([P(-7.3, -1.5), P(-11, -0.3), P(-7.2, 0.8)], { closed: true, tension: 0 }), fill(argb('2A2F33', 1))]),
    el('Shape', { name: 'eye' }, [el('Ellipse', { x: -3.6, y: -2.2, width: 1.1, height: 1.1, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFFFFF', 0.9))]),
  ].reverse());
  s.loopLayer('bird boil', bodyInk.animId);
  s.loopLayer('head boil', headInk.animId);
  // back to front
  return [tail, el('Shape', { name: 'bodyBase' }, [pathXml(bodyPts, { closed: true }), fill(argb('F6F2EA', 1))]), ...washes, bodyInk.xml, wing, head];
}

function mapleTR(ids) {
  const W = 640, H = 560;
  const s = new Scene(ids, { name: 'MapleTR', w: W, h: H, x: 520, y: 0, bg: BG });
  const r = rng(14);
  const tree = growBranch(r, { origin: P(W + 30, 120), angle: Math.PI + 0.12, length: 560, thick: 16, depth: 3, bounds: { x0: 14, y0: 10, y1: H - 14 } });
  const grow = [];
  const wood = [];
  const snow = [];
  const caps = [];
  for (const seg of [...tree.segs].sort((a, b) => b.w - a.w)) {
    const pts = [seg.a, P((seg.a.x + seg.b.x) / 2 + r.jit(seg.w * 0.4), (seg.a.y + seg.b.y) / 2 + r.jit(seg.w * 0.4)), seg.b];
    const tone = Math.min(1, 0.55 + seg.w * 0.05);
    const a = ids.next();
    const b = ids.next();
    grow.push(trimIn(a, Math.round(seg.t0), Math.round(seg.t1 - seg.t0) + 2), trimIn(b, Math.round(seg.t0), Math.round(seg.t1 - seg.t0) + 2));
    wood.push(el('Shape', { name: 'wood' }, [
      pathXml(pts, { tension: 0.7 }),
      el('Stroke', { thickness: seg.w * 2, cap: 'round', join: 'round', name: 'Bleed' }, [solid(ink(0.1)), el('TrimPath', { end: 0, id: a, name: 'Trim' }), el('Feather', { strength: seg.w + 2, name: 'F' })]),
      el('Stroke', { thickness: Math.max(0.9, seg.w), cap: 'round', join: 'round', name: 'Body' }, [solid(ink(tone)), el('TrimPath', { end: 0, id: b, name: 'Trim' })]),
    ]));
    // snow settles on the top of anything thick enough and not too steep
    const ang = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
    if (seg.w > 2.4 && Math.abs(Math.sin(ang)) < 0.62 && r() < 0.85) {
      const top = resample(pts, 6).map((p) => P(p.x, p.y - seg.w / 2));
      const capId = ids.next();
      snow.push(snowCap(r, top, Math.min(7, 1.6 + seg.w * 0.55), { id: capId, opacity: 0 }));
      grow.push(appear(capId, Math.round(seg.t1) + 30, 40));
      caps.push({ id: capId, c: top[3], w: seg.w, len: Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y), seg });
    }
  }
  const introLen = Math.round(Math.max(...tree.segs.map((x) => x.t1))) + 80;

  // two dried maple leaves still hanging on, the one warm thing in the woods
  const leafNodes = [];
  const leafTips = tree.tips.filter((t) => t.th < 4 && t.p.x > 40 && t.p.y < H - 40 && t.p.y > 30).slice(0, 2);
  const leafIds = [];
  leafTips.forEach((tp, i) => {
    const id = ids.next();
    leafIds.push(id);
    const lp = mapleLeaf(r);
    leafNodes.push(el('Node', { name: 'leaf', x: tp.p.x, y: tp.p.y, rotation: 0.3 + i * 0.4, id, opacity: 0 }, [
      el('Shape', { name: 'stem' }, [pathXml([P(0, 0), P(1, 5), P(0, 9)]), stroke(ink(0.8), 0.8)]),
      el('Node', { name: 'blade', y: 20 }, [
        washShape({ pts: lp.map((p) => P(p.x + 1.5, p.y + 1)), color: i ? 'C27A3A' : RUST, alpha: 0.75, edge: 0.9, soft: 1, tension: 0.35 }),
        inkShape({ pts: lp, closed: true, tension: 0.35, color: ink(0.85), width: 0.8, bleed: 0 }),
        inkShape({ pts: [P(0, 8), P(0, -10)], color: ink(0.6), width: 0.6, bleed: 0 }),
      ].reverse()),
    ].reverse()));
    grow.push(appear(id, introLen - 40, 40));
  });

  // the chickadee lands on a sturdy, level perch
  const perch = caps.filter((c) => c.w > 3 && c.w < 10 && c.seg.a.x < 500 && c.seg.a.x > 140 && c.seg.a.y > 110 && c.len > 30).sort((a, b) => Math.abs(Math.atan2(a.seg.b.y - a.seg.a.y, a.seg.b.x - a.seg.a.x)) - Math.abs(Math.atan2(b.seg.b.y - b.seg.a.y, b.seg.b.x - b.seg.a.x)))[0] || caps[0];
  const pa = perch.seg.a, pb = perch.seg.b;
  const perchAt = (f) => P(pa.x + (pb.x - pa.x) * f, pa.y + (pb.y - pa.y) * f - perch.w / 2 + 0.5);
  const home = perchAt(0.45);
  const away = perchAt(0.8);
  const birdId = ids.next(), headId = ids.next(), wingId = ids.next(), tailId = ids.next(), bodyId = ids.next();
  const bird = el('Node', { name: 'chickadee', x: home.x, y: home.y, id: birdId, opacity: 0, scaleX: 1.7, scaleY: 1.7 },
    el('Node', { name: 'squash', id: bodyId }, chickadee(ids, s, r, { headId, wingId, tailId }).reverse()));
  // the bird's snow should not sit under its feet
  const land = introLen - 20;
  grow.push(
    { object: birdId, prop: 'opacity', keys: [[0, 0], [land, 0, 'linear'], [land + 10, 1]] },
    { object: birdId, prop: 'y', keys: [[0, home.y - 120], [land, home.y - 120, 'cubic', [0.2, 0.6, 0.4, 1]], [land + 34, home.y]] },
    { object: birdId, prop: 'x', keys: [[0, home.x - 90], [land, home.x - 90, 'cubic', EASE.out], [land + 34, home.x]] },
    { object: wingId, prop: 'scaleY', keys: [[land, -0.8, 'linear'], [land + 4, 1], [land + 8, -0.8], [land + 12, 1], [land + 16, -0.6], [land + 22, 1], [land + 30, 0.7], [land + 34, 1]] },
    { object: bodyId, prop: 'scaleY', keys: [[land + 32, 1, 'cubic', EASE.out], [land + 37, 0.84, 'cubic', EASE.back], [land + 52, 1]] },
  );
  const intro = s.anim({ name: 'Grow', duration: introLen + 60, tracks: grow });

  // idle: head tilts (irregular), a tail flick, leaves twist on their stems
  const IDLE = 720;
  const tilt = s.anim({
    name: 'Bird idle', duration: IDLE, loop: 'loop',
    tracks: [
      { object: headId, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [70, 0, 'cubic', EASE.out], [78, 0.32, 'hold'], [150, 0.32, 'cubic', EASE.out], [158, 0, 'hold'], [300, 0, 'cubic', EASE.out], [306, -0.22, 'hold'], [340, -0.22, 'cubic', EASE.out], [346, 0.18, 'hold'], [380, 0.18, 'cubic', EASE.out], [388, 0, 'hold'], [560, 0, 'cubic', EASE.out], [566, 0.4, 'hold'], [600, 0.4, 'cubic', EASE.out], [608, 0, 'hold'], [IDLE, 0]] },
      { object: tailId, prop: 'rotation', keys: [[0, 0], [220, 0, 'cubic', EASE.out], [225, -0.35, 'cubic', EASE.inOut], [236, 0], [470, 0, 'cubic', EASE.out], [474, -0.3, 'cubic', EASE.inOut], [482, 0.05, 'cubic', EASE.inOut], [490, 0], [IDLE, 0]] },
      ...leafIds.map((id, i) => ({ object: id, prop: 'rotation', keys: [[0, 0.3 + i * 0.4, 'cubic', EASE.inOut], [IDLE / 2, 0.3 + i * 0.4 + (i ? -0.35 : 0.3), 'cubic', EASE.inOut], [IDLE, 0.3 + i * 0.4]] })),
    ],
  });
  const wait = s.anim({ name: 'Wait', duration: introLen + 60, tracks: [] });
  s.sequenceLayer('idle', [wait, tilt]);

  // hop: along the perch and back, with a flutter
  const hop = s.input('trigger', 'hop');
  const hopTracks = [];
  const hopTo = (from, to, t, len, lift) => {
    hopTracks.push(
      { object: birdId, prop: 'x', keys: [[t, from.x, 'cubic', EASE.inOut], [t + len, to.x]] },
      { object: birdId, prop: 'y', keys: [[t, from.y, 'cubic', EASE.out], [t + len / 2, Math.min(from.y, to.y) - lift, 'cubic', EASE.in], [t + len, to.y]] },
    );
  };
  hopTo(home, away, 0, 22, 18);
  hopTo(away, home, 60, 26, 26);
  // keyframes per property must be in order; merge the two hops
  const merged = {};
  for (const tr of hopTracks) (merged[tr.prop] ||= []).push(...tr.keys);
  const hopAnim = s.anim({
    name: 'Hop', duration: 110,
    tracks: [
      { object: birdId, prop: 'x', keys: merged.x },
      { object: birdId, prop: 'y', keys: merged.y },
      { object: birdId, prop: 'scaleX', keys: [[0, 1.7, 'hold'], [41, 1.7, 'hold'], [42, -1.7, 'hold'], [58, -1.7, 'hold'], [59, 1.7, 'hold'], [110, 1.7]] },
      { object: wingId, prop: 'scaleY', keys: [[0, 1], [4, -0.7], [8, 1], [12, -0.7], [18, 1], [60, 1], [64, -0.8], [68, 1], [72, -0.8], [76, 1], [82, -0.5], [88, 1]] },
      { object: bodyId, prop: 'scaleY', keys: [[0, 0.85, 'cubic', EASE.out], [6, 1.08, 'cubic', EASE.inOut], [22, 0.86, 'cubic', EASE.back], [34, 1], [60, 0.86, 'cubic', EASE.out], [66, 1.08], [86, 0.86, 'cubic', EASE.back], [100, 1]] },
      { object: headId, prop: 'rotation', keys: [[24, 0, 'cubic', EASE.out], [30, -0.3, 'hold'], [50, -0.3, 'cubic', EASE.out], [56, 0]] },
    ],
  });
  s.triggerLayer('hop', hop, hopAnim, { fromAny: false, mix: 0 });
  const birdHit = ids.next();

  // brush the branch: snow lets go of the bigger caps
  const shakeCaps = caps.filter((c) => c !== perch && c.w > 3.2).slice(0, 4);
  const puffs = [];
  const hits = [];
  shakeCaps.forEach((c, k) => {
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    puffs.push(...puff(ids, r, c.c, 0, tr, 8, 26));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x, y: c.c.y, id: hid }, [el('Ellipse', { width: Math.max(40, c.len), height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });
  hits.push(el('Shape', { name: 'birdHit', x: home.x - 4, y: home.y - 24, id: birdHit }, [el('Ellipse', { width: 64, height: 54, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
  s.listen(birdHit, 'click', [Scene.fire(hop)]);
  s.listen(birdHit, 'enter', [Scene.fire(hop)]);

  // the whole branch hangs from where it enters the frame; every so often a
  // breath of wind lifts it a hair and lets it settle
  const breathId = ids.next();
  const ox = W + 30, oy = 120;
  s.add(el('Node', { name: 'breath', x: ox, y: oy, id: breathId },
    el('Node', { name: 'branch', x: -ox, y: -oy }, [...wood.reverse(), ...snow, ...leafNodes, bird, ...puffs, ...hits].reverse())));
  const BR = 1500;
  s.loopLayer('breath', s.anim({
    name: 'Breath', duration: BR, loop: 'loop',
    tracks: [{ object: breathId, prop: 'rotation', keys: [
      [0, 0, 'cubic', EASE.inOut], [400, 0, 'cubic', [0.3, 0, 0.2, 1]], [470, -0.0045, 'cubic', EASE.inOut], [560, 0.0012, 'cubic', EASE.inOut], [680, -0.0008, 'cubic', EASE.inOut], [800, 0, 'cubic', EASE.inOut],
      [1050, 0, 'cubic', [0.3, 0, 0.2, 1]], [1110, -0.0028, 'cubic', EASE.inOut], [1260, 0.0006, 'cubic', EASE.inOut], [BR, 0],
    ] }],
  }));
  s.loopLayer('grow', intro);
  return s.toXml();
}

// ---------- balsam fir + an overturned red canoe, bottom right

function firBR(ids) {
  const W = 520, H = 620;
  const s = new Scene(ids, { name: 'FirBR', w: W, h: H, x: 1200, y: 0, bg: BG });
  const r = rng(52);
  const fir = coniferAuto(ids, r, { cx: 392, base: 586, height: 470, maxW: 88, tiers: 26, color: FIR, alpha: 1, t0: 30, snowiness: 0.85 });
  const small = coniferAuto(ids, r, { cx: 486, base: 590, height: 250, maxW: 46, tiers: 15, color: '7C9790', alpha: 0.5, t0: 60 });
  const grow = [];

  // the canoe, keel up, half buried
  // keel up: a long low arch whose pointed ends dip into the snow
  const hull = [P(58, 590), P(84, 576), P(130, 565), P(200, 560), P(270, 563), P(318, 572), P(350, 590), P(300, 584), P(204, 582), P(110, 584)];
  const canoeId = ids.next();
  const keel = hull.slice(0, 7);
  const gunwale = [P(66, 588), P(110, 583), P(204, 581), P(300, 583), P(342, 588)];
  const canoe = el('Node', { name: 'canoe', id: canoeId, opacity: 0 }, [
    washShape({ pts: hull.map((p) => P(p.x + 3, p.y + 1.5)), color: CANOE, alpha: 0.9, edge: 0.9, soft: 1.1, tension: 0.6 }),
    // a highlight where the low sun catches the hull
    el('Shape', { name: 'shine' }, [pathXml([P(120, 568), P(200, 563), P(268, 566)], { tension: 0.9 }), stroke(argb('F2B9A2', 0.55), 2.2, { feather: 1.2 })]),
    el('Shape', { name: 'gunwaleWash', blendModeValue: 'multiply' }, [pathXml(gunwale, { tension: 0.8 }), stroke(argb('6B3B22', 0.75), 3)]),
    inkShape({ pts: hull, closed: true, tension: 0.6, color: ink(), width: 1.3, bleed: 0.14 }),
    inkShape({ pts: gunwale, tension: 0.8, color: ink(0.75), width: 0.9, bleed: 0 }),
    snowCap(r, resample(keel, 11).slice(2, -2).map((p) => P(p.x, p.y - 0.4)), 7),
  ].reverse());
  grow.push(appear(canoeId, 150, 50));
  const ground = drift(r, { x0: 20, x1: W + 30, y: 598, h: 22, taperL: true, shadows: [{ x: 210, y: 598, rx: 140, ry: 9 }, { x: 400, y: 594, rx: 80, ry: 8 }] });
  const tuftId = ids.next();
  const tufts = [];
  for (const gx of [30, 160, 352]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, 597), P(gx + k * 3 + r.jit(6) - 4, 597 - r.range(6, 14))]);
  grow.push(appear(tuftId, 200, 40));

  const hits = [];
  const puffs = [];
  const interactive = fir.caps.filter((c) => c.f > 0.1 && c.f < 0.8).filter((_, i) => i % 3 === 1).slice(0, 4);
  interactive.forEach((c, k) => {
    if (process.env.WINTER_DEBUG) console.error('fir cap', k, Math.round(c.c.x), Math.round(c.c.y));
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    puffs.push(...puff(ids, r, c.c, 0, tr, 7, 26));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x, y: c.c.y - 4, id: hid }, [el('Ellipse', { width: c.L * 1.3, height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });

  s.add(
    ...small.back, ...small.mid, ...small.front,
    ...fir.back, ...fir.mid, ...fir.front,
    ...ground, canoe,
    ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts' }),
    ...puffs, ...hits,
  );
  s.loopLayer('grow', s.anim({ name: 'Grow', duration: 300, tracks: [...grow, ...gatherTracks()] }));
  return s.toXml();
}

// ---------- pale winter sun; scroll slides it along its low arc

function sun(ids) {
  const s = new Scene(ids, { name: 'Sun', w: 420, h: 420, x: 1780, y: 0, bg: BG });
  const r = rng(9);
  const sunId = ids.next();
  const haloId = ids.next();
  const warmId = ids.next();
  const ringId = ids.next();
  const discPts = blobPts(36, 36, r, { n: 12, wobble: 0.03 });
  const disc = el('Node', { name: 'sun', x: 120, y: 300, id: sunId }, [
    // gold hour: a warmer disc and glow that fade out as the sun climbs
    el('Node', { name: 'warm', id: warmId }, [
      el('Shape', { name: 'warmGlow' }, [el('Ellipse', { width: 300, height: 220, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFD9A6', 0.2), { feather: 70 })]),
      el('Shape', { name: 'warmDisc' }, [pathXml(discPts, { closed: true }), fill(argb('FFD89A', 0.22), { feather: 4 })]),
    ].reverse()),
    el('Shape', { name: 'disc' }, [pathXml(discPts, { closed: true }), fill(argb('FFF0C4', 0.85), { feather: 3 })]),
    el('Shape', { name: 'rim' }, [pathXml(discPts, { closed: true }), stroke(argb('E8C98A', 0.35), 1.2, { feather: 1 })]),
    el('Shape', { name: 'glow', id: haloId }, [el('Ellipse', { width: 180, height: 180, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFF4D6', 0.55), { feather: 46 })]),
    // a 22° halo, the ice-crystal ring a cold bright day sometimes hangs around the sun
    el('Shape', { name: 'halo', id: ringId }, [el('Ellipse', { width: 230, height: 230, originX: 0.5, originY: 0.5, name: 'P' }), stroke(argb('E9C9A0', 0.1), 5, { feather: 5 }), stroke(argb('C9D8E6', 0.09), 3, { feather: 4 })]),
  ]);
  s.add(disc);
  const scroll = s.input('number', 'scroll', 0);
  const low = s.anim({ name: 'Morning', duration: 1, tracks: [{ object: sunId, prop: 'x', keys: [[0, 110]] }, { object: sunId, prop: 'y', keys: [[0, 300]] }, { object: warmId, prop: 'opacity', keys: [[0, 1]] }, { object: ringId, prop: 'opacity', keys: [[0, 0.5]] }] });
  const high = s.anim({ name: 'Noon', duration: 1, tracks: [{ object: sunId, prop: 'x', keys: [[0, 300]] }, { object: sunId, prop: 'y', keys: [[0, 150]] }, { object: warmId, prop: 'opacity', keys: [[0, 0]] }, { object: ringId, prop: 'opacity', keys: [[0, 1]] }] });
  s.blendLayer('scroll', scroll, [{ anim: low, value: 0 }, { anim: high, value: 100 }]);
  s.loopLayer('shimmer', s.anim({ name: 'Shimmer', duration: 480, loop: 'pingPong', tracks: [{ object: haloId, prop: 'opacity', keys: [[0, 0.65, 'cubic', EASE.inOut], [480, 1]] }, { object: haloId, prop: 'scaleX', keys: [[0, 0.94, 'cubic', EASE.inOut], [480, 1.06]] }, { object: haloId, prop: 'scaleY', keys: [[0, 0.94, 'cubic', EASE.inOut], [480, 1.06]] }] }));
  s.loopLayer('rise', s.anim({ name: 'Rise', duration: 150, tracks: [{ object: sunId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [150, 1]] }] }));
  return s.toXml();
}

// ---------- snowfall over the whole page (fit cover)

function snowfall(ids) {
  const W = 800, H = 900;
  const s = new Scene(ids, { name: 'Snow', w: W, h: H, x: 2240, y: 0, bg: BG });
  const r = rng(101);
  const LOOP = 1800;
  // three depths: far flakes are small, soft and slow; near ones bigger, crisper, faster
  const depths = [
    { id: ids.next(), n: 34, near: [0, 0.3], name: 'far' },
    { id: ids.next(), n: 28, near: [0.3, 0.72], name: 'mid' },
    { id: ids.next(), n: 14, near: [0.72, 1], name: 'near' },
  ];
  const groups = depths.map(() => []);
  const tracks = [];
  for (let i = 0; i < 76; i++) {
    const d = i < depths[0].n ? 0 : i < depths[0].n + depths[1].n ? 1 : 2;
    const id = ids.next();
    const near = r.range(...depths[d].near);
    const sz = 1.5 + near * 3.8;
    const cycles = near > 0.75 ? 3 : near > 0.35 ? 2 : 1;
    const phase = r();
    const x0 = r.range(-80, W + 80);
    groups[d].push(el('Shape', { name: 'flake', x: x0, y: -20, id, opacity: 0.3 + near * 0.6 }, [
      el('Ellipse', { width: sz, height: sz * r.range(0.85, 1), originX: 0.5, originY: 0.5, name: 'P' }),
      fill(argb('B6C7D5', 0.8), { feather: near < 0.3 ? 1.4 : near < 0.72 ? 0.6 : 0.3 }),
    ]));
    // y: constant fall, wrapping top to bottom `cycles` times per loop
    const per = LOOP / cycles;
    const ys = [];
    const xs = [];
    const span = H + 40;
    for (let c = 0; c < cycles; c++) {
      const t0 = c * per;
      const wrapAt = t0 + (1 - phase) * per;
      const yStart = -20 + phase * span;
      ys.push([Math.round(t0), yStart, 'linear'], [Math.round(wrapAt), H + 20, 'hold'], [Math.round(wrapAt) + 1, -20, 'linear']);
    }
    ys.push([LOOP, -20 + phase * span]);
    // drop duplicate frames created by rounding
    const seen = new Set();
    tracks.push({ object: id, prop: 'y', keys: ys.filter((k) => (seen.has(k[0]) ? false : seen.add(k[0]))).sort((a, b) => a[0] - b[0]) });
    const sway = 8 + near * 16;
    const n = 6;
    for (let k = 0; k <= n; k++) xs.push([Math.round((k / n) * LOOP), x0 + (k === n ? 0 : (k % 2 ? sway : -sway) * (k === 0 ? 0 : 1)) + (k === 0 || k === n ? 0 : r.jit(4)), 'cubic', EASE.inOut]);
    tracks.push({ object: id, prop: 'x', keys: xs });
  }
  s.add(...depths.map((d, k) => el('Node', { name: d.name, id: d.id }, groups[k].reverse())));
  s.loopLayer('fall', s.anim({ name: 'Fall', duration: LOOP, loop: 'loop', tracks }));
  // gusts: now and then the whole fall leans sideways, the near layer most, and drifts back
  const G = 2600;
  const gust = (amt) => [[0, 0, 'cubic', EASE.inOut], [700, 0, 'cubic', [0.4, 0, 0.3, 1]], [880, amt, 'cubic', EASE.inOut], [1300, amt * 0.25, 'cubic', EASE.inOut], [1800, 0, 'cubic', [0.4, 0, 0.3, 1]], [1950, -amt * 0.5, 'cubic', EASE.inOut], [G, 0]];
  s.loopLayer('gust', s.anim({
    name: 'Gust', duration: G, loop: 'loop',
    tracks: depths.map((d, k) => ({ object: d.id, prop: 'x', keys: gust([14, 34, 64][k]) })),
  }));
  return s.toXml();
}

// ---------- far ground: misty treeline, raking sun shadows, diamond dust (fit cover, bottom)

function far(ids) {
  const W = 1600, H = 420;
  const s = new Scene(ids, { name: 'Far', w: W, h: H, x: 0, y: 1100, bg: BG });
  const r = rng(77);
  const horizon = 180;

  // --- the far treeline: three rows of spruce silhouettes, paler with distance (aerial perspective)
  const row = (y, color, alpha, hMin, hMax, step, seed) => {
    const rr = rng(seed);
    const pts = [P(-20, y + 3)];
    let x = -20;
    pts.push(P(x, y));
    while (x < W + 20) {
      const h = rr.range(hMin, hMax) * (rr() < 0.15 ? 1.5 : 1);
      const w = h * rr.range(0.5, 0.8);
      // a spruce silhouette: stepped tiers narrowing to a tip, the lower tiers sagging
      const tier = (fx, fy) => P(x + w * fx + rr.jit(1.5), y - h * fy + rr.jit(1.5));
      pts.push(tier(0.08, 0.1), tier(0.18, 0.08), tier(0.26, 0.38), tier(0.34, 0.36), tier(0.42, 0.68), tier(0.47, 0.66), tier(0.5, 1), tier(0.54, 0.66), tier(0.6, 0.68), tier(0.68, 0.36), tier(0.76, 0.38), tier(0.84, 0.08), tier(0.94, 0.1), P(x + w, y - rr.range(0, 3)));
      x += w + rr.range(0, step);
      if (rr() < 0.2) x += rr.range(14, 50); // a gap in the stand
      pts.push(P(x, y));
    }
    pts.push(P(W + 20, y), P(W + 20, y + 3));
    // granulating pigment settled into the paper
    const dots = [];
    for (let k = 0; k < 110; k++) dots.push({ x: r.range(0, W), y: y - r.range(0, hMax * 0.5) * r(), r: r.range(0.4, 1) });
    return el('Node', { name: 'treeRow' }, [
      el('Shape', { name: 'row', blendModeValue: 'multiply' }, [
        polyXml(pts, { closed: true }),
        el('Fill', { fillRule: 'clockwise', name: 'Soft' }, [solid(argb(color, alpha * 0.45)), el('Feather', { strength: 12, offsetY: 2, name: 'F' })]),
        fill(argb(color, alpha), { feather: 4 }),
      ]),
      stippleShape({ name: 'grain', dots, color: argb(darkenHex(color), alpha * 0.35), x: 0, y: 0 }),
    ].reverse());
  };
  const rows = [
    row(horizon - 20, 'A9BAC6', 0.15, 18, 42, 22, 5),
    row(horizon - 8, '93A8B6', 0.19, 24, 58, 16, 6),
    row(horizon + 3, '7E95A3', 0.23, 30, 72, 12, 7),
  ];
  // the treeline's own pooled shadow on the snow
  const treeShade = el('Shape', { name: 'treeShade', blendModeValue: 'multiply' }, [polyXml([P(-20, horizon), P(W + 20, horizon), P(W + 20, horizon + 18), P(-20, horizon + 22)], { closed: true }), fill(argb(SHADOW, 0.07), { feather: 14 })]);

  // --- ice fog: a band of white lying along the horizon, drifting
  const fogId = ids.next();
  const fog = el('Node', { name: 'fog', id: fogId }, [
    el('Shape', { name: 'fogA' }, [polyXml([P(-200, horizon - 40), P(W + 200, horizon - 48), P(W + 200, horizon + 14), P(-200, horizon + 18)], { closed: true }), fill(argb('F6F8FA', 0.8), { feather: 26 })]),
    el('Shape', { name: 'fogB', x: 300 }, [polyXml([P(-100, horizon - 22), P(700, horizon - 34), P(1100, horizon - 20), P(1100, horizon + 8), P(-100, horizon + 10)], { closed: true }), fill(argb('FFFFFF', 0.7), { feather: 18 })]),
  ].reverse());

  // --- the snow plane: faint contour ridges, long blue shadows raking in from the right, wet blooms
  const ridges = [];
  // drift crests: short broken wind-ridges rather than ruled lines
  for (let k = 0; k < 9; k++) {
    const y = horizon + 34 + k * 26 + r.jit(10);
    const x0 = r.range(-20, W * 0.6);
    const len = r.range(220, 620);
    const pts = [];
    for (let i = 0; i <= 6; i++) pts.push(P(x0 + len * (i / 6), y + Math.sin(i * 1.3 + k) * 4 + r.jit(2.5)));
    ridges.push(el('Shape', { name: 'ridge', opacity: 0.3 + r() * 0.3 }, [pathXml(pts, { tension: 0.9 }), stroke(argb('8EA6BB', 0.22), 1, { feather: 1 })]));
  }
  const shadowsId = ids.next();
  const bands = [];
  // each band is a wedge: wide where the (off-frame) tree stands at the right edge, tapering to the far tip
  const bandSpecs = [
    { y: horizon + 38, len: 1180, w0: 26, tilt: -0.045 },
    { y: horizon + 92, len: 1380, w0: 44, tilt: -0.03 },
    { y: horizon + 150, len: 1050, w0: 36, tilt: -0.05 },
    { y: horizon + 205, len: 1480, w0: 70, tilt: -0.02 },
    { y: horizon + 262, len: 900, w0: 40, tilt: -0.04 },
  ];
  for (const b of bandSpecs) {
    const x1 = W + 60;
    const x0 = x1 - b.len;
    const top = [], bot = [];
    for (let i = 0; i <= 8; i++) {
      const f = i / 8;
      const x = x1 - b.len * f;
      const cy = b.y + b.len * f * b.tilt;
      const hw = (b.w0 / 2) * (1 - f * 0.85) * (1 + 0.12 * Math.sin(f * 9 + b.y));
      top.push(P(x + r.jit(6), cy - hw + r.jit(2)));
      bot.push(P(x + r.jit(6), cy + hw + r.jit(2)));
    }
    const pts = [...top, ...bot.reverse()];
    bands.push(el('Node', { name: 'band' }, [
      el('Shape', { name: 'bandBody', blendModeValue: 'multiply' }, [pathXml(pts, { closed: true, tension: 0.8 }), fill(argb(SHADOW, 0.17), { feather: 11 })]),
      el('Shape', { name: 'bandCore', x: 0, y: 1, blendModeValue: 'multiply' }, [pathXml(pts.map((p) => P(p.x, b.y + (p.y - b.y) * 0.6 + (p.x - x1) * b.tilt * 0.4)), { closed: true, tension: 0.8 }), fill(argb(SHADOW2, 0.09), { feather: 18 })]),
      // wet-in-wet bloom inside the band: a lighter backrun with a crisp pigment rim
      el('Shape', { name: 'bloom', x: x1 - b.len * r.range(0.25, 0.5), y: b.y + b.len * 0.35 * b.tilt, blendModeValue: 'multiply' }, [pathXml(blobPts(b.w0 * 1.3, b.w0 * 0.3, r, { n: 9, wobble: 0.2 }), { closed: true }), fill(argb(lighten(SHADOW, 0.5), 0.22), { feather: 2.5 }), stroke(argb(SHADOW2, 0.14), 0.8, { feather: 0.9 })]),
    ].reverse()));
  }
  // scroll shortens the shadows as the sun climbs: the wedges scale toward their root at the right edge
  const shadows = el('Node', { name: 'shadows', x: W + 60, id: shadowsId }, el('Node', { name: 'inner', x: -(W + 60) }, bands.reverse()));
  // gold hour: the lit snow goes faintly warm at the low sun, then cools
  const warmId = ids.next();
  const warm = el('Node', { name: 'warm', id: warmId }, [
    el('Shape', { name: 'warmWash', blendModeValue: 'multiply' }, [polyXml([P(W * 0.3, horizon + 10), P(W + 40, horizon - 10), P(W + 40, H + 40), P(W * 0.1, H + 40)], { closed: true }), fill(argb('FFE8C4', 0.12), { feather: 60 })]),
  ]);

  // --- diamond dust: tiny glints that catch, a different set lit as the sun moves
  const star = (sz) => polyXml([P(0, -sz), P(sz * 0.22, -sz * 0.22), P(sz, 0), P(sz * 0.22, sz * 0.22), P(0, sz), P(-sz * 0.22, sz * 0.22), P(-sz, 0), P(-sz * 0.22, -sz * 0.22)], { closed: true });
  const TW = 900;
  const twinkle = [];
  const glintGroup = (count, seed) => {
    const rr = rng(seed);
    const id = ids.next();
    const kids = [];
    for (let i = 0; i < count; i++) {
      const gid = ids.next();
      const sz = rr.range(2.2, 4.6);
      kids.push(el('Node', { name: 'glint', x: rr.range(0, W), y: horizon + 24 + rr.range(0, H - horizon - 30) * Math.pow(rr(), 0.7), id: gid, opacity: 0 }, [
        el('Shape', { name: 'star' }, [star(sz), fill(argb('FFFFFF', 1)), stroke(argb('FFF1D0', 0.8), 0.8, { feather: 0.8 })]),
        el('Shape', { name: 'core' }, [el('Ellipse', { width: sz * 0.7, height: sz * 0.7, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFF6E2', 1), { feather: 1.2 })]),
      ].reverse()));
      // a glint catches for a moment once or twice a loop
      const keys = [[0, 0]];
      const hits = rr() < 0.4 ? 2 : 1;
      let t = rr.range(10, 300);
      for (let h = 0; h < hits && t < TW - 60; h++) {
        const on = Math.round(t);
        const peak = rr.range(0.6, 1);
        keys.push([on, 0, 'cubic', EASE.out], [on + 9, peak, 'cubic', EASE.in], [on + 28, 0.15, 'cubic', EASE.in], [on + 40, 0]);
        t += rr.range(220, 480);
      }
      keys.push([TW, 0]);
      twinkle.push({ object: gid, prop: 'opacity', keys });
      twinkle.push({ object: gid, prop: 'rotation', keys: [[0, rr.range(0, 0.6), 'linear'], [TW, rr.range(0, 0.6) + 0.5]] });
    }
    return { id, xml: el('Node', { name: 'glints', id }, kids.reverse()) };
  };
  const gA = glintGroup(18, 81);
  const gB = glintGroup(18, 82);

  // back to front
  s.add(...rows, treeShade, fog, ...ridges, shadows, warm, gA.xml, gB.xml);

  const scroll = s.input('number', 'scroll', 0);
  const low = s.anim({ name: 'Morning', duration: 1, tracks: [
    { object: shadowsId, prop: 'scaleX', keys: [[0, 1]] }, { object: shadowsId, prop: 'opacity', keys: [[0, 1]] },
    { object: warmId, prop: 'opacity', keys: [[0, 1]] }, { object: gA.id, prop: 'opacity', keys: [[0, 1]] }, { object: gB.id, prop: 'opacity', keys: [[0, 0.25]] },
  ] });
  const high = s.anim({ name: 'Noon', duration: 1, tracks: [
    { object: shadowsId, prop: 'scaleX', keys: [[0, 0.5]] }, { object: shadowsId, prop: 'opacity', keys: [[0, 0.8]] },
    { object: warmId, prop: 'opacity', keys: [[0, 0]] }, { object: gA.id, prop: 'opacity', keys: [[0, 0.25]] }, { object: gB.id, prop: 'opacity', keys: [[0, 1]] },
  ] });
  s.blendLayer('scroll', scroll, [{ anim: low, value: 0 }, { anim: high, value: 100 }]);
  s.loopLayer('twinkle', s.anim({ name: 'Twinkle', duration: TW, loop: 'loop', tracks: twinkle }));
  s.loopLayer('fog', s.anim({ name: 'Fog drift', duration: 1400, loop: 'pingPong', tracks: [
    { object: fogId, prop: 'x', keys: [[0, -30, 'cubic', EASE.inOut], [1400, 30]] },
    { object: fogId, prop: 'opacity', keys: [[0, 0.7, 'cubic', EASE.inOut], [1400, 1]] },
  ] }));
  // the whole ground washes in with the rest of the scene
  const allId = ids.next();
  s.drawables = [el('Node', { name: 'all', id: allId, opacity: 0 }, [...s.drawables].reverse())];
  s.loopLayer('in', s.anim({ name: 'In', duration: 240, tracks: [{ object: allId, prop: 'opacity', keys: [[0, 0], [40, 0, 'cubic', EASE.out], [240, 1]] }] }));
  return s.toXml();
}

const darkenHex = (hex) => hex.replace(/../g, (h) => Math.max(0, parseInt(h, 16) - 48).toString(16).padStart(2, '0'));

// ---------- dividers: animal tracks that appear print by print

function printShape(r, x, y, rx, ry, rot = 0) {
  return [
    el('Shape', { name: 'dimple', x, y, rotation: rot }, [pathXml(blobPts(rx, ry, r, { n: 7, wobble: 0.12 }), { closed: true }), fill(argb(SHADOW, 0.7), { feather: 0.8 })]),
    el('Shape', { name: 'edge', x: x + 0.4, y: y - 0.6, rotation: rot }, [pathXml(blobPts(rx, ry, r, { n: 7, wobble: 0.1 }).slice(4), { tension: 0.8 }), stroke(ink(0.55), 0.6)]),
  ];
}

function tracksArtboard(ids, { name, x, kind }) {
  const s = new Scene(ids, { name, w: 240, h: 40, x, y: 1000, bg: BG });
  const r = rng(kind === 'hare' ? 3 : 4);
  const prints = [];
  const tracks = [];
  let t = 6;
  const add = (shapes) => {
    const id = ids.next();
    prints.push(el('Node', { name: 'print', id, opacity: 0 }, shapes));
    tracks.push({ object: id, prop: 'opacity', keys: [[0, 0], [t, 0, 'cubic', EASE.out], [t + 10, 1]] });
  };
  if (kind === 'hare') {
    // snowshoe hare: two small fore prints one behind the other, big hind feet ahead side by side
    for (let g = 0; g < 4; g++) {
      const gx = 24 + g * 50 + r.jit(3);
      add([...printShape(r, gx, 22 + r.jit(1), 2.2, 2.6), ...printShape(r, gx + 7, 19 + r.jit(1), 2.2, 2.6)]);
      t += 6;
      add([...printShape(r, gx + 19, 14 + r.jit(1), 5.5, 2.6, -0.1), ...printShape(r, gx + 19, 27 + r.jit(1), 5.5, 2.6, 0.1)]);
      t += 16;
    }
  } else {
    // red fox: a neat single line of oval prints, each with a dot of toes
    for (let k = 0; k < 9; k++) {
      const px = 22 + k * 23 + r.jit(1.5);
      const py = 20 + (k % 2 ? 2.5 : -2.5);
      add([...printShape(r, px, py, 3, 2.4), ...printShape(r, px + 4.5, py - 1.2, 0.9, 0.9), ...printShape(r, px + 4.5, py + 1.2, 0.9, 0.9)]);
      t += 9;
    }
  }
  s.add(...prints);
  s.loopLayer('walk', s.anim({ name: 'Walk', duration: t + 20, tracks }));
  return s.toXml();
}

export default function () {
  const ids = new Ids(10);
  return document(
    standL(ids),
    mapleTR(ids),
    firBR(ids),
    sun(ids),
    snowfall(ids),
    far(ids),
    tracksArtboard(ids, { name: 'HareTracks', x: 0, kind: 'hare' }),
    tracksArtboard(ids, { name: 'FoxTracks', x: 300, kind: 'fox' }),
  );
}
