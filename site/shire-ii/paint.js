// Small SVG paintings in the hill's hand, for things that have to be HTML:
// the signpost's arms (real links), its upright on phones, and a few stray
// marks from the pen (splotches, a flick, hatching, a thumbprint, a drip).
// Ink is the hill's iron-gall brown; lines boil through three re-traced cels
// and draw themselves on; paint is a pale glaze with a pooled rim and grain.

export const INK = '2b231c';

export function rng(seed = 1) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.jit = (k) => (r() * 2 - 1) * k;
  r.range = (lo, hi) => lo + (hi - lo) * r();
  return r;
}

const f = (v) => (Math.round(v * 10) / 10).toString();

// closed Catmull-Rom through [x, y] points
export function smooth(pts, closed = true) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

export function blobPts(r, cx, cy, rx, ry, n = 12, wob = 0.15) {
  const a0 = r() * 6.28;
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    const k = 1 + r.jit(wob);
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
}
export const blob = (r, cx, cy, rx, ry, n, wob) => smooth(blobPts(r, cx, cy, rx, ry, n, wob));

// a hand-ruled polyline: each straight edge gets a midpoint nudged off the line
function ruled(pts, r, amt) {
  const out = [];
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    out.push([p[0] + r.jit(amt * 0.5), p[1] + r.jit(amt * 0.5)]);
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (len > 30) out.push([(p[0] + q[0]) / 2 + r.jit(amt), (p[1] + q[1]) / 2 + r.jit(amt)]);
  });
  return out;
}
const poly = (pts) => 'M' + pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';

const DEFS = (id, seed, wet = 2) => `<defs>
<filter id='d${id}' x='-6%' y='-20%' width='112%' height='140%'><feTurbulence type='fractalNoise' baseFrequency='0.06' numOctaves='2' seed='${seed % 97}'/><feDisplacementMap in='SourceGraphic' scale='${wet}'/></filter>
<filter id='g${id}'><feTurbulence type='fractalNoise' baseFrequency='0.9 0.12' numOctaves='2' seed='${seed % 89}'/><feColorMatrix values='0 0 0 0 .37 0 0 0 0 .29 0 0 0 0 .21 -3 0 0 0 1.4'/><feComposite in2='SourceGraphic' operator='in'/></filter>
<filter id='b${id}' x='-10%' y='-30%' width='120%' height='160%'><feGaussianBlur stdDeviation='1.1'/></filter>
</defs>`;

// three re-traced cels of the same line; CSS shows one at a time (the boil)
function cels(id, r, make, { w = 1.5, bleed = 0.18 } = {}) {
  return [0, 1, 2].map((i) => {
    const d = make(i);
    return `<g class='cel c${i}'><path class='o' pathLength='1' d='${d}' fill='none' stroke='#${INK}' stroke-opacity='${bleed}' stroke-width='${w * 2.4}' filter='url(#b${id})' stroke-linejoin='round' stroke-linecap='round'/><path class='o' pathLength='1' d='${d}' fill='none' stroke='#${INK}' stroke-width='${w}' stroke-linejoin='round' stroke-linecap='round'/></g>`;
  }).join('');
}

let uid = 0;

/**
 * A painted arm, `w` units long by 40 tall (the caller sizes the viewBox to the
 * link's own aspect, so the ink keeps its weight). Points right or left.
 */
export function arm({ w = 200, dir = 'r', tint = 'E9B93A', seed = 1 }) {
  const id = `a${++uid}`;
  const r = rng(seed);
  const H = 40;
  const X = (x) => (dir === 'r' ? x : w - x);
  const shape = [[3, 6], [w - 23, 4.5], [w - 3, 20.5], [w - 23, 36], [3.5, 34.5]].map(([x, y]) => [X(x), y]);
  const board = poly(ruled(shape, rng(seed + 1), 0.9));
  const glaze = blob(r, X(w * 0.42), 21 + r.jit(2), w * 0.36, 11, 12, 0.18);
  const nail = [X(11), 20 + r.jit(1)];
  const grainLine = `M${f(X(9))} ${f(10 + r.jit(1))}C${f(X(w * 0.3))} ${f(9 + r.jit(1.4))} ${f(X(w * 0.6))} ${f(11 + r.jit(1.4))} ${f(X(w - 30))} ${f(9.5 + r.jit(1))}`;
  return `<svg class='paint' viewBox='0 0 ${f(w)} ${H}' preserveAspectRatio='none' aria-hidden='true' focusable='false'>${DEFS(id, seed)}
<g class='soak' filter='url(#d${id})'>
<path d='${board}' fill='#F1E6CB' fill-opacity='.96' stroke='#9C7C58' stroke-opacity='.5' stroke-width='1.2'/>
<path class='tint' d='${glaze}' fill='#${tint}' fill-opacity='.26' style='mix-blend-mode:multiply'/>
<path d='${board}' filter='url(#g${id})' opacity='.42'/>
<path d='${grainLine}' fill='none' stroke='#5E554C' stroke-opacity='.3' stroke-width='.8'/>
</g>
<g class='ink'>${cels(id, r, () => poly(ruled(shape, r, 1.1)))}</g>
<circle class='nail' cx='${f(nail[0])}' cy='${f(nail[1])}' r='1.8' fill='#${INK}'/>
</svg>`;
}

/** The upright, for when the signpost stands on its own (phones): w × h px. */
export function upright({ w = 26, h = 260, seed = 7 }) {
  const id = `u${++uid}`;
  const r = rng(seed);
  const cx = w / 2;
  const body = [[cx - 5.5, 12], [cx + 5.5, 12], [cx + 6, h - 6], [cx - 6.2, h - 6]];
  const cap = [[cx - 8, 12], [cx + 8, 12], [cx + 4, 4], [cx - 4, 4]];
  const tuft = [[-12, -4, -16, -13], [-9, -3, -9, -15], [8, -3, 9, -16], [11, -4, 16, -12]].map(([x0, y0, x1, y1]) => `M${f(cx + x0)} ${f(h + y0)}L${f(cx + x1 + r.jit(1))} ${f(h + y1)}`).join('');
  const bank = blob(r, cx, h - 4, 22, 5, 10, 0.18);
  const ticks = [0.2, 0.42, 0.66, 0.84].map((t, i) => `M${f(cx + (i % 2 ? 2 : -1.6))} ${f(h * t)}L${f(cx + (i % 2 ? 2.4 : -1.2))} ${f(h * t + 18)}`).join('');
  return `<svg class='paint' viewBox='0 0 ${w} ${h}' width='${w}' height='${h}' overflow='visible' aria-hidden='true' focusable='false'>${DEFS(id, seed, 1.4)}
<g class='soak'>
<path d='${poly(body)}' fill='#B89470' fill-opacity='.92' filter='url(#d${id})'/>
<path d='${poly(body)}' filter='url(#g${id})' opacity='.5'/>
<path d='${poly(cap)}' fill='#8A6A4A' fill-opacity='.92'/>
<path d='${ticks}' stroke='#5E554C' stroke-opacity='.55' stroke-width='.9' fill='none'/>
<path class='bank' d='${bank}' fill='#86B35B' fill-opacity='.4' filter='url(#d${id})' style='mix-blend-mode:multiply'/>
</g>
<g class='ink'>${cels(id, r, () => {
    const L = [[cx - 5.5 + r.jit(0.4), 12], [cx - 6 + r.jit(0.5), h * 0.5], [cx - 6.2 + r.jit(0.4), h - 6]];
    const R = [[cx + 5.5 + r.jit(0.4), 12], [cx + 5.8 + r.jit(0.5), h * 0.5], [cx + 6 + r.jit(0.4), h - 6]];
    return smooth(L, false) + smooth(R, false) + poly(cap.map(([x, y]) => [x + r.jit(0.3), y + r.jit(0.3)])) + tuft;
  }, { w: 1.7 })}</g>
</svg>`;
}

// ---------- stray marks ----------

const wrap = (id, seed, vb, body, wet = 3) => `<svg class='paint' viewBox='${vb}' aria-hidden='true' focusable='false'><defs>
<filter id='d${id}' x='-20%' y='-20%' width='140%' height='140%'><feTurbulence type='fractalNoise' baseFrequency='0.09' numOctaves='2' seed='${seed % 97}'/><feDisplacementMap in='SourceGraphic' scale='${wet}'/></filter>
<filter id='b${id}' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='2.2'/></filter>
</defs>${body}</svg>`;

/** A dropped blot of ink with satellites and spatter thrown off in one direction. */
export function splotch({ seed = 1, dir = 0.3, size = 1, spatter = 14 }) {
  const id = `s${++uid}`;
  const r = rng(seed);
  const cx = 50, cy = 50, R = 13 * size;
  const main = blob(r, cx, cy, R, R * 0.86, 15, 0.32);
  const sats = Array.from({ length: 3 }, (_, i) => {
    const a = dir + r.jit(0.8), d = R * (1.25 + i * 0.35 + r() * 0.3), s = R * (0.32 - i * 0.07);
    return blob(r, cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s * 0.8, 8, 0.25);
  });
  let dots = '';
  for (let i = 0; i < spatter; i++) {
    const a = dir + r.jit(0.9), d = R * (1.5 + r() * 2.2), s = 0.5 + r() * 1.7 * (1.4 - d / (R * 3.7));
    dots += `<circle cx='${f(cx + Math.cos(a) * d)}' cy='${f(cy + Math.sin(a) * d)}' r='${f(Math.max(0.45, s))}'/>`;
  }
  return wrap(id, seed, '0 0 100 100', `
<path d='${main}' fill='#${INK}' opacity='.16' filter='url(#b${id})' transform='translate(1.5 1.5) scale(1.06)' transform-origin='50 50'/>
<g fill='#${INK}' filter='url(#d${id})'><path d='${main}' opacity='.86'/>${sats.map((d) => `<path d='${d}' opacity='.8'/>`).join('')}</g>
<g fill='#${INK}' opacity='.8'>${dots}</g>
<path d='${blob(r, cx - R * 0.25, cy - R * 0.2, R * 0.38, R * 0.28, 8, 0.2)}' fill='#fff' opacity='.07'/>`);
}

/** A pen flicked off the page: a tapering stroke, a bead at the end, a couple of drops. */
export function flick({ seed = 1 }) {
  const id = `f${++uid}`;
  const r = rng(seed);
  const pts = [];
  const n = 18;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([8 + t * 104 + r.jit(0.4), 30 - Math.sin(t * 2.6) * 14 + t * 6 + r.jit(0.3)]);
  }
  const side = (s) => pts.map((p, i) => {
    const q = pts[Math.min(n, i + 1)], o = pts[Math.max(0, i - 1)];
    const nx = -(q[1] - o[1]), ny = q[0] - o[0], L = Math.hypot(nx, ny) || 1;
    const wdt = (0.7 + 3.9 * Math.sin(Math.min(1, (i / n) * 1.25) * Math.PI * 0.95)) * (1 - (i / n) * 0.55);
    return [p[0] + (nx / L) * wdt * s, p[1] + (ny / L) * wdt * s];
  });
  const outline = [...side(1), ...side(-1).reverse()];
  const end = pts[n];
  return wrap(id, seed, '0 0 130 50', `
<g fill='#${INK}' opacity='.82'><path d='${smooth(outline)}' filter='url(#d${id})'/>
<circle cx='${f(end[0] + 1)}' cy='${f(end[1])}' r='1.9'/><circle cx='${f(end[0] + 8)}' cy='${f(end[1] + 2.5)}' r='1.1'/><circle cx='${f(end[0] + 13)}' cy='${f(end[1] + 4)}' r='.7'/></g>`, 1.4);
}

/** Quick hatching, as if the nib were tried on the margin. `cross` adds a stroke through. */
export function hatch({ seed = 1, n = 5, cross = false }) {
  const id = `h${++uid}`;
  const r = rng(seed);
  let d = '';
  for (let i = 0; i < n; i++) {
    const x = 10 + i * 8 + r.jit(1.4), y0 = 8 + r.jit(3), y1 = 40 + r.jit(4);
    d += `M${f(x + 6)} ${f(y0)}Q${f(x + 2 + r.jit(2))} ${f((y0 + y1) / 2)} ${f(x - 3)} ${f(y1)}`;
  }
  if (cross) d += `M${f(4)} ${f(30 + r.jit(2))}Q${f(30)} ${f(20 + r.jit(3))} ${f(14 + n * 8)} ${f(14 + r.jit(2))}`;
  return wrap(id, seed, `0 0 ${20 + n * 8} 50`, `<path d='${d}' fill='none' stroke='#${INK}' stroke-width='1.7' stroke-linecap='round' opacity='.72' filter='url(#d${id})'/>`, 1.2);
}

/** A smudged thumbprint: broken whorls, very faint, pressed in a little off true. */
export function thumb({ seed = 1 }) {
  const id = `t${++uid}`;
  const r = rng(seed);
  let rings = '';
  for (let i = 0; i < 11; i++) {
    const rx = 4 + i * 2.6, ry = rx * 1.3;
    const pts = blobPts(r, 50 + r.jit(0.6) - i * 0.25, 50 + i * 0.4, rx, ry, 14, 0.04);
    const gap = 3 + r() * 8, dash = 10 + r() * 30;
    rings += `<path d='${smooth(pts)}' stroke-dasharray='${f(dash)} ${f(gap)} ${f(dash * 0.6)} ${f(gap * 0.5)}' stroke-dashoffset='${f(r() * 40)}'/>`;
  }
  return wrap(id, seed, '0 0 100 100', `
<ellipse cx='50' cy='52' rx='30' ry='38' fill='#${INK}' opacity='.05' filter='url(#b${id})'/>
<g fill='none' stroke='#${INK}' stroke-width='1.25' opacity='.5' filter='url(#d${id})'>${rings}</g>`, 2.4);
}

/** A wash that ran: a drip down from a heading's watercolor, pooled in a bead. */
export function drip({ seed = 1, color = 'C8643B', len = 70 }) {
  const id = `r${++uid}`;
  const r = rng(seed);
  const L = [], R = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, y = 4 + t * len, wdt = 5.5 - t * 3.2 + r.jit(0.4);
    const x = 12 + Math.sin(t * 2.2) * 1.6;
    L.push([x - wdt, y]);
    R.push([x + wdt * 0.8, y]);
  }
  const bead = blob(r, 12.6, len + 7, 5, 5.6, 9, 0.12);
  const run = smooth([...L, ...R.reverse()]);
  return wrap(id, seed, `0 0 26 ${len + 16}`, `
<g filter='url(#d${id})'><path d='${run}' fill='#${color}' fill-opacity='.46'/>
<path d='${bead}' fill='#${color}' fill-opacity='.5' stroke='#${color}' stroke-opacity='.75' stroke-width='1.2'/></g>`, 1.6);
}

/**
 * A little painted badge for a service in Elsewhere, 56 × 56: GitHub's cat on
 * an ink-washed coin, or LinkedIn's "in" on a blue-washed board. Same ink, same
 * three-cel boil and pooled wash as the signpost arms.
 */
export function icon({ kind, seed = 1 }) {
  const id = `i${++uid}`;
  const r = rng(seed);
  const S = 56;
  const glyph = (d, w) => `<path d='${d}' fill='none' stroke='#${INK}' stroke-width='${w}' stroke-linecap='round' stroke-linejoin='round'/>`;
  if (kind === 'github') {
    const coin = blobPts(r, 28, 28, 22.5, 22.5, 14, 0.05);
    const cat = [[18, 12.5], [22.5, 19], [28, 17.5], [33.5, 19], [38, 12.5], [40.5, 22], [39.5, 29.5], [35.5, 34], [32, 35.5], [32.5, 49.5], [23.5, 49.5], [24, 35.5], [20.5, 34], [16.5, 29.5], [15.5, 22]].map(([x, y]) => [x + r.jit(0.4), y + r.jit(0.4)]);
    return `<svg class='paint' viewBox='0 0 ${S} ${S}' aria-hidden='true' focusable='false'>${DEFS(id, seed, 1.6)}
<clipPath id='k${id}'><path d='${smooth(coin)}'/></clipPath>
<g class='soak' filter='url(#d${id})'>
<path d='${smooth(coin)}' fill='#3a2f26' fill-opacity='.82'/>
<path d='${blob(r, 24, 24, 14, 12, 10, 0.2)}' fill='#5a4a3c' fill-opacity='.5'/>
<path d='${smooth(coin)}' filter='url(#g${id})' opacity='.5'/>
<g clip-path='url(#k${id})'>
<path d='${smooth(cat)}' fill='#F1E6CB' fill-opacity='.95'/>
<path d='M24.5 42C20 42 17.5 40.5 15 36.5' fill='none' stroke='#F1E6CB' stroke-opacity='.95' stroke-width='2.6' stroke-linecap='round'/>
</g>
</g>
<g class='ink'>${cels(id, r, () => smooth(coin.map(([x, y]) => [x + r.jit(0.5), y + r.jit(0.5)])), { w: 1.4 })}</g>
</svg>`;
  }
  // linkedin
  const board = [[7, 8], [48, 7], [49, 48], [7.5, 49]];
  return `<svg class='paint' viewBox='0 0 ${S} ${S}' aria-hidden='true' focusable='false'>${DEFS(id, seed, 1.6)}
<g class='soak' filter='url(#d${id})'>
<path d='${poly(ruled(board, rng(seed + 1), 0.8))}' fill='#F1E6CB' fill-opacity='.96'/>
<path d='${blob(r, 28, 28, 19, 18, 12, 0.14)}' fill='#5C86B4' fill-opacity='.5' style='mix-blend-mode:multiply'/>
<path d='${blob(r, 25, 31, 12, 10, 10, 0.2)}' fill='#3F6C9E' fill-opacity='.32' style='mix-blend-mode:multiply'/>
<path d='${poly(board)}' filter='url(#g${id})' opacity='.35'/>
</g>
<g class='ink'>${cels(id, r, () => poly(ruled(board, r, 1)), { w: 1.4 })}</g>
<circle cx='${f(18.5 + r.jit(0.3))}' cy='${f(17.5 + r.jit(0.3))}' r='2.5' fill='#${INK}'/>
${glyph(`M18.6 24.5L18.4 39.5`, 3.4)}
${glyph(`M26.5 39.5L26.6 25M26.7 30C28.2 25.8 31.5 24.6 34 24.8C37.2 25.1 38.4 27.6 38.3 31L38.2 39.5`, 3.2)}
</svg>`;
}
