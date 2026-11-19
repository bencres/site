// Shared drawing kit for winter-iii: everything winter's gen.mjs drew with, exported
// so the trail landmarks and the critters can reuse the same hand.
import {
  Ids, Scene, rng, P, el, argb, pathXml, fill, stroke, solid, blobPts, resample, jitterPts,
  washShape, document, EASE, TAU, boil, inkShape,
} from '../lib/ink.mjs';

export const INK = '2E3A44'; // cold slate ink
export const SNOW = 'FFFFFF';
export const SHADOW = '9DB6CC'; // blue snow shadow
export const SPRUCE = '3D5C57';
export const FIR = '466B5C';
export const RUST = 'B4532E';
export const CANOE = 'B8432F';
export const BG = process.env.WINTER_BG; // paper colour for CLI previews only

export const ink = (a = 1) => argb(INK, a);

// ---------------------------------------------------------------- shared bits

// keys that hide something until `t`, then ease it in
export const appear = (id, t, len = 30, from = 0) => ({ object: id, prop: 'opacity', keys: [[0, from], [t, from, 'cubic', EASE.out], [t + len, 1]] });
export const trimIn = (id, t, len) => ({ object: id, prop: 'end', keys: [[0, 0], [t, 0, 'cubic', [0.35, 0, 0.25, 1]], [t + len, 1]] });

// an ink line that draws on: soft bleed + crisp body, both trimmed together
export function drawnLine(ids, pts, { width = 1.4, alpha = 1, tension = 1, color = INK, closed = false }, t, len, tracks) {
  const a = ids.next();
  const b = ids.next();
  tracks.push(trimIn(a, t, len), trimIn(b, t, len));
  return el('Shape', { name: 'line' }, [
    pathXml(pts, { tension, closed }),
    el('Stroke', { thickness: width * 2.3, cap: 'round', join: 'round', name: 'Bleed' }, [solid(argb(color, alpha * 0.14)), el('TrimPath', { end: 0, id: a, name: 'Trim' }), el('Feather', { strength: width * 1.4, name: 'F' })]),
    el('Stroke', { thickness: width, cap: 'round', join: 'round', name: 'Body' }, [solid(argb(color, alpha)), el('TrimPath', { end: 0, id: b, name: 'Trim' })]),
  ]);
}

// many short ticks in one shape (needles, grass, lenticels)
export function ticks(segs, { width = 0.8, color, name = 'ticks', id, opacity }) {
  return el('Shape', { name, id, opacity }, [...segs.map((s) => pathXml(s, { tension: 0.6 })), stroke(color, width)]);
}

// lumpy snow sitting on top of a line of points
export function capPts(top, r, thick) {
  const n = top.length;
  const upper = top.map((p, i) => {
    const taper = Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 0.55);
    return P(p.x + r.jit(0.6), p.y - (thick * taper * r.range(0.75, 1.25) + 0.6));
  });
  const lower = [...top].reverse().map((p) => P(p.x, p.y + 1.2));
  return [...upper, ...lower];
}

export function snowCap(r, top, thick, { id, opacity, name = 'snow' } = {}) {
  const pts = capPts(top, r, thick);
  const ridge = pts.slice(0, top.length);
  return el('Node', { name, id, opacity }, [
    // ink edge on the lit top only, very light
    el('Shape', { name: 'ridge' }, [pathXml(ridge, { tension: 0.8 }), stroke(argb('7F97AB', 0.55), 0.7)]),
    el('Shape', { name: 'cap' }, [pathXml(pts, { closed: true, tension: 0.8 }), fill(argb(SNOW, 1))]),
    // cool shadow tucked under the snow
    el('Shape', { name: 'shade', y: 2.2 }, [pathXml(pts, { closed: true, tension: 0.8 }), fill(argb(SHADOW, 0.32), { feather: 2.2 })]),
  ]);
}

// a few flakes of snow that puff out and fall when a cap lets go
export function puff(ids, r, c, start, tracks, n = 6, spread = 30) {
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
export function slideTracks(capId, start, { drop = 22, back = 260 } = {}) {
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
export function conifer(ids, r, { cx, base, height, maxW, tiers, color, alpha = 1, t0 = 0, club = false, snowiness = 0.75 }, tracks) {
  const back = []; // washes
  const mid = []; // ink
  const front = []; // snow
  const caps = [];
  const top = P(cx + r.jit(4), base - height);
  const trunk = resample([P(cx, base), P(cx + r.jit(3), base - height * 0.4), P(cx + r.jit(3), base - height * 0.75), top], 8).map((p) => P(p.x + r.jit(0.8), p.y));
  mid.push(drawnLine(ids, trunk, { width: 1.7, alpha }, t0, 70, tracks));
  // a scrap of exposed trunk at the base
  mid.push(drawnLine(ids, [P(cx - 3, base), P(cx - 2.4, base - 26)], { width: 1, alpha: alpha * 0.8 }, t0, 30, tracks));

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
      const b = [P(cx, y - lift), P(cx + side * L * 0.33, y + sag * 0.35), P(cx + side * L * 0.7, y + sag * 0.95), P(cx + side * L, y + sag * 0.75 - 2)].map((p) => P(p.x + r.jit(1.2), p.y + r.jit(1.2)));
      mid.push(drawnLine(ids, b, { width: 1 + (1 - f) * 0.55, alpha, tension: 0.9 }, tStart, 26, tracks));
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
  return { back, mid, front, caps, top };
}

// ---------------------------------------------------------------- white birch

export function birch(ids, r, { x, base, height, w, lean = 0, t0 = 0 }, tracks) {
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
  parts.push(drawnLine(ids, L, { width: 1.3 }, t0, 80, tracks));
  parts.push(drawnLine(ids, R, { width: 1.1, alpha: 0.85 }, t0 + 6, 80, tracks));

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
export function drift(r, { x0, x1, y, h, shadows = [], taperL = false, taperR = false }) {
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
    ...shadows.map((s) => el('Shape', { name: 'pool', x: s.x, y: s.y }, [pathXml(blobPts(s.rx, s.ry, r, { n: 9, wobble: 0.2 }), { closed: true }), fill(argb(SHADOW, 0.32), { feather: 7 })])),
    el('Shape', { name: 'drift' }, [pathXml(top, { tension: 0.8 }), stroke(argb('7F97AB', 0.5), 0.9)]),
    el('Shape', { name: 'driftBody' }, [pathXml(pts, { closed: true, tension: 0.6 }), fill(argb('FFFFFF', 0.92))]),
  ];
}

// conifer() pushes its timeline into a module-level buffer; collect it here
let coniferTracks = [];
export function gatherTracks() {
  const t = coniferTracks;
  coniferTracks = [];
  return t;
}
// wrap so callers don't thread a tracks array through
export function coniferAuto(ids, r, opts) {
  return conifer(ids, r, opts, coniferTracks);
}

// ---------- sugar maple branch reaching in from the top right, with a chickadee

export function growBranch(r, { origin, angle, length, thick, depth, speed = 3, bounds }) {
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

export function mapleLeaf(r) {
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

export function chickadee(ids, s, r, { headId, wingId, tailId }) {
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

// ---------- dividers: animal tracks that appear print by print

export function printShape(r, x, y, rx, ry, rot = 0) {
  return [
    el('Shape', { name: 'dimple', x, y, rotation: rot }, [pathXml(blobPts(rx, ry, r, { n: 7, wobble: 0.12 }), { closed: true }), fill(argb(SHADOW, 0.7), { feather: 0.8 })]),
    el('Shape', { name: 'edge', x: x + 0.4, y: y - 0.6, rotation: rot }, [pathXml(blobPts(rx, ry, r, { n: 7, wobble: 0.1 }).slice(4), { tension: 0.8 }), stroke(ink(0.55), 0.6)]),
  ];
}
