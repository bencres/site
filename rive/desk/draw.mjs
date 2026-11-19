// Drawing helpers specific to the desk scene: sketchy rectangles whose sides
// overshoot their corners, hand-drawn circles that overlap themselves, leaves,
// and cursive "handwriting" scribbles.
import { el, P, TAU, pathXml, fill, stroke, washShape, argb, jitterPts, rng } from '../lib/ink.mjs';

export const INK = 'FF2E2822';
export const PAPER = 'FFFBF6EC';

const alphaHex = (a) => Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();

/** One shape holding many ink paths, with a soft bleed under the crisp line. */
export function inkMulti({ name = 'ink', paths, width = 1.7, color = INK, bleed = 0.16, x, y, rotation, id, opacity, trim }) {
  const geo = paths.map((p) => pathXml(p.pts, { closed: p.closed, tension: p.tension ?? 1 }));
  const paints = [];
  if (bleed) paints.push(stroke(color.replace(/^../, alphaHex(bleed * (parseInt(color.slice(0, 2), 16) / 255))), width * 2.2, { feather: width * 1.4, trim: trim && { ...trim, id: undefined } }));
  paints.push(stroke(color, width, { trim }));
  return el('Shape', { name, id, x, y, rotation, opacity }, [...geo, ...paints]);
}

export const rectCorners = (w, h) => [P(-w / 2, -h / 2), P(w / 2, -h / 2), P(w / 2, h / 2), P(-w / 2, h / 2)];

/** closed outline that hugs the corners (bevelled by a few px) with slightly bowed edges */
export function cornerPts(corners, r, { jit = 0.8, bevel = 3, mids = 2 } = {}) {
  const out = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    out.push(P(a.x + dx * bevel, a.y + dy * bevel));
    for (let k = 1; k <= mids; k++) {
      const t = k / (mids + 1);
      const off = r.jit(jit);
      out.push(P(a.x + (b.x - a.x) * t - dy * off, a.y + (b.y - a.y) * t + dx * off));
    }
    out.push(P(b.x - dx * bevel, b.y - dy * bevel));
  }
  return out;
}

/** each side its own stroke, running a little past the corners like a quick pen sketch */
export function sketchSides(corners, r, { over = 5, jit = 0.9, closed = true } = {}) {
  const n = corners.length;
  const sides = [];
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = corners[i];
    const b = corners[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const dx = (b.x - a.x) / len;
    const dy = (b.y - a.y) / len;
    const o1 = r.range(0.2, 1) * over;
    const o2 = r.range(0.2, 1) * over;
    const bow = r.jit(jit * 1.6);
    const pts = [P(a.x - dx * o1 + r.jit(jit), a.y - dy * o1 + r.jit(jit))];
    const mids = len > 120 ? 2 : 1;
    for (let k = 1; k <= mids; k++) {
      const t = k / (mids + 1);
      const off = bow * Math.sin(t * Math.PI) + r.jit(jit * 0.4);
      pts.push(P(a.x + (b.x - a.x) * t - dy * off, a.y + (b.y - a.y) * t + dx * off));
    }
    pts.push(P(b.x + dx * o2 + r.jit(jit), b.y + dy * o2 + r.jit(jit)));
    sides.push({ pts });
  }
  return sides;
}

/** a circle drawn in one go: it overshoots its start and drifts in radius */
export function handCircle(rx, ry, r, { turns = 1.07, n = 16, drift = 0.03, jit = 0.5, start } = {}) {
  const a0 = start ?? r.range(0, TAU);
  const pts = [];
  const steps = Math.round(n * turns);
  const d = r.jit(drift);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + t * turns * TAU;
    const k = 1 + d * (t - 0.5) * 2;
    pts.push(P(Math.cos(a) * rx * k + r.jit(jit), Math.sin(a) * ry * k + r.jit(jit)));
  }
  return { pts };
}

export function circlePts(rx, ry, n = 14) {
  return Array.from({ length: n }, (_, i) => P(Math.cos((i / n) * TAU) * rx, Math.sin((i / n) * TAU) * ry));
}

/** pointed leaf from (0,0) to (len,0) */
export function leafPts(len, wid, r) {
  const j = (v) => v + r.jit(wid * 0.06);
  return [
    P(0, 0),
    P(len * 0.22, j(-wid * 0.42)),
    P(len * 0.55, j(-wid * 0.5)),
    P(len * 0.85, j(-wid * 0.26)),
    P(len, 0),
    P(len * 0.82, j(wid * 0.28)),
    P(len * 0.52, j(wid * 0.5)),
    P(len * 0.2, j(wid * 0.4)),
  ];
}

/** a line of cursive "words": looping strokes that read as handwriting from afar */
export function scribbleLine(len, r, { amp = 3.2, step = 5.5, gap = 7 } = {}) {
  const words = [];
  let x = 0;
  while (x < len - 12) {
    const wlen = Math.min(len - x, r.range(18, 48));
    const pts = [];
    const heights = [];
    const loops = Math.max(2, Math.round(wlen / step));
    const N = loops * 4;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const w = t * loops * TAU;
      // every loop gets its own height: some letters rise, a few dip below the line
      const li = Math.floor(w / TAU);
      if (!heights[li]) heights[li] = r() < 0.22 ? 2.3 : r() < 0.12 ? -1.6 : r.range(0.7, 1.15);
      const k = heights[li];
      const top = -Math.cos(w);
      const yy = k < 0 ? (top < 0 ? top * amp * 0.5 : top * amp * -k) : top < 0 ? top * amp * k : top * amp * 0.5;
      pts.push(P(x + t * wlen - Math.sin(w) * step * r.range(0.3, 0.45), -yy + r.jit(0.35)));
    }
    words.push({ pts });
    x += wlen + gap;
  }
  return words;
}

export function paperShape(pts, { name = 'paper', color = PAPER, x, y } = {}) {
  return el('Shape', { name, x, y }, [pathXml(pts, { closed: true }), fill(color)]);
}

export function shadowShape(pts, { id, x = 3, y = 4, strength = 10, alpha = 0.32, opacity } = {}) {
  return el('Shape', { name: 'shadow', id, x, y, opacity }, [pathXml(pts, { closed: true }), fill(argb('3A2614', alpha), { feather: strength })]);
}

/** wash that is deliberately a few px off the ink, like quick watercolor over a drawing */
export function offWash(pts, color, r, { alpha = 0.5, soft = 2, off = 3, name, blend } = {}) {
  return washShape({ name, x: r.jit(off), y: r.jit(off), pts: jitterPts(pts, 1.5, r), color, alpha, soft, blend });
}

export function hitShape(pts, id) {
  return el('Shape', { name: 'hit', id }, [pathXml(pts, { closed: true }), fill('00FFFFFF')]);
}

export { rng };
