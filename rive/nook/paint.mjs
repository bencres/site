// Drawing helpers for the Nook draft: patient ink lines and wet watercolor.
// Where harbor's pen is loose and quick, this one is slow: short even lines,
// no overshoot, a hair of wobble, and washes that bloom softly into each other.
import { P, el, argb, darken, lighten, pathXml, fill, stroke, blobPts, stippleShape, TAU } from '../lib/ink.mjs';

// ---------------------------------------------------------------- ink

/**
 * A patient ruled line from a to b: sampled every ~14px with a small
 * sideways wobble, optional pen-lift, no overshoot. Returns pieces (arrays of points).
 */
export function line(a, b, r, { wob = 0.45, lift = 0, step = 14, short = 0 } = {}) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const s0 = short * r();
  const s1 = short * r();
  const total = L - s0 - s1;
  const cuts = [[0, 1]];
  if (lift && L > 70 && r() < lift) {
    const t = r.range(0.35, 0.65);
    const g = r.range(2.5, 5) / total;
    cuts.splice(0, 1, [0, t - g / 2], [t + g / 2, 1]);
  }
  const piece = (t0, t1) => {
    const n = Math.max(2, Math.round(((t1 - t0) * total) / step));
    const pts = [];
    const bow = r.jit(L * 0.006);
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n;
      const d = s0 + t * total;
      const w = r.jit(wob) + Math.sin(Math.PI * t) * bow;
      pts.push(P(a.x + ux * d + nx * w, a.y + uy * d + ny * w));
    }
    return pts;
  };
  return cuts.map(([t0, t1]) => piece(t0, t1));
}

export function poly(pts, r, opts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) out.push(...line(pts[i], pts[i + 1], r, opts));
  return out;
}
export const rect = (x0, y0, x1, y1) => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1), P(x0, y0)];

// a freehand curve: jittered points, kept smooth
export function curve(pts, r, amt = 0.6) {
  return [pts.map((p) => P(p.x + r.jit(amt), p.y + r.jit(amt)))];
}

// an arc from angle a0 to a1 (radians, y-down) around c
export function arc(c, rx, ry, a0, a1, r, { n = 10, amt = 0.5 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(P(c.x + Math.cos(a) * rx + r.jit(amt), c.y + Math.sin(a) * ry + r.jit(amt)));
  }
  return [pts];
}

/**
 * One ink shape from many pieces: a faint feathered ghost under a crisp line,
 * so the line looks soaked into paper. Pieces are polylines; smooth is the
 * Catmull tension (0 = straight segments).
 */
export function inkXml({ name = 'Ink', pieces, color, width = 1.2, bleed = 0.14, smooth = 0.55, id, opacity, x = 0, y = 0 }) {
  const paths = pieces.filter((p) => p.length > 1).map((p) => pathXml(p, { tension: smooth }));
  const paints = [];
  if (bleed) paints.push(stroke(color.replace(/^../, alphaHex(bleed)), width * 2.4, { feather: width * 1.6 }));
  paints.push(stroke(color, width, { cap: 'round' }));
  return el('Shape', { name, id, opacity, x, y }, [...paths, ...paints]);
}
const alphaHex = (a) => Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();

// ---------------------------------------------------------------- watercolor

// walk a polygon's edges with small wobbles so it reads as a brush edge
export function brushEdge(pts, r, { step = 16, wob = 1.6 } = {}) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(L / step));
    const nx = -(b.y - a.y) / (L || 1);
    const ny = (b.x - a.x) / (L || 1);
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const w = k === 0 ? r.jit(wob * 0.4) : r.jit(wob);
      out.push(P(a.x + (b.x - a.x) * t + nx * w, a.y + (b.y - a.y) * t + ny * w));
    }
  }
  return out;
}

/**
 * A flat wash with a feathered body and a slightly darker pooled rim.
 * Multiply so overlapping glazes darken like real pigment.
 */
export function wash({ name = 'Wash', pts, color, alpha = 0.5, soft = 2.2, edge = 0.6, tension = 0.5, r, x = 0, y = 0, rough = true, blend = 'multiply', id, opacity, wob }) {
  const edgePts = rough && r ? brushEdge(pts, r, { wob }) : pts;
  const kids = [pathXml(edgePts, { closed: true, tension }), fill(argb(color, alpha), { feather: soft })];
  if (edge) kids.push(stroke(argb(darken(color, 0.3), alpha * edge * 0.5), 1.8, { feather: 1.5 }));
  return el('Shape', { name, x, y, id, opacity, blendModeValue: blend }, kids);
}

/**
 * Wet-in-wet: several very soft, overlapping patches of pigment, with no
 * hard edge anywhere. Good for skies, shadows under eaves, lamp light.
 */
export function bloom({ name = 'Bloom', cx, cy, w, h, color, alpha = 0.3, r, count = 4, soft = 0.6, blend = 'multiply', spread = 0.3, id }) {
  const kids = [];
  for (let i = 0; i < count; i++) {
    const rx = (w / 2) * r.range(0.45, 0.8);
    const ry = (h / 2) * r.range(0.45, 0.8);
    kids.push(
      el('Shape', { name: 'patch', x: cx + r.jit(w * spread), y: cy + r.jit(h * spread), blendModeValue: blend }, [
        pathXml(blobPts(rx, ry, r, { n: 9, wobble: 0.22, start: r.range(0, TAU) }), { closed: true }),
        fill(argb(color, alpha * r.range(0.6, 1)), { feather: Math.min(rx, ry) * soft }),
      ])
    );
  }
  return el('Node', { name, id }, kids);
}

// pigment granulation: tiny darker specks settling in the paper's tooth
export function grain({ name = 'Grain', cx, cy, w, h, color, alpha = 0.18, r, count, size = [0.35, 0.95], opacity }) {
  const dots = [];
  const n = count ?? Math.round((w * h) / 260);
  for (let i = 0; i < n; i++) {
    dots.push({ x: cx + r.jit(w / 2), y: cy + r.jit(h / 2), r: r.range(...size) });
  }
  return stippleShape({ name, dots, color: argb(darken(color, 0.3), alpha), opacity });
}

// a hard-edged backrun/cauliflower: a lighter blob with a darker rim, dropped into a wet wash
export function backrun({ name = 'Backrun', cx, cy, rx, ry, color, alpha = 0.35, r }) {
  const pts = blobPts(rx, ry, r, { n: 11, wobble: 0.3 });
  return el('Node', { name, x: cx, y: cy }, [
    el('Shape', { name: 'rim', blendModeValue: 'multiply' }, [pathXml(pts, { closed: true, tension: 0.7 }), stroke(argb(darken(color, 0.25), alpha), 1.6, { feather: 1.1 })]),
    el('Shape', { name: 'lift' }, [pathXml(pts, { closed: true, tension: 0.7 }), fill(argb(lighten(color, 0.55), alpha * 0.5), { feather: 3 })]),
  ]);
}

// warm light: a feathered glow painted over the dark washes (normal blend, so it lightens)
export function glow({ name = 'Glow', cx = 0, cy = 0, rx, ry, color, alpha = 0.45, r, id, opacity, soft = 0.7, n = 10, wobble = 0.16 }) {
  const pts = blobPts(rx, ry, r, { n, wobble, start: r.range(0, TAU) });
  return el('Shape', { name, x: cx, y: cy, id, opacity }, [pathXml(pts, { closed: true }), fill(argb(color, alpha), { feather: Math.min(rx, ry) * soft })]);
}

export { argb, darken, lighten };
