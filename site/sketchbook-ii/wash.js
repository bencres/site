// Static watercolor marks as inline SVG: a hard-edged glaze whose rim darkens
// where pigment pooled as it dried, plus granulation. The filter is rasterised
// once; the page only animates opacity and transform on top of it.
let uid = 0;

function rng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.jit = (k) => (next() * 2 - 1) * k;
  return next;
}

const f = (n) => +n.toFixed(1);

// closed Catmull-Rom through pts, as SVG cubics
function smooth(pts) {
  const n = pts.length;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

// a loose oval, flattened at the ends like a single brush pass
function blob(cx, cy, rx, ry, r, n = 14, wobble = 0.14) {
  const pts = [];
  const start = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const k = 1 + r.jit(wobble);
    const c = Math.cos(a), s = Math.sin(a);
    pts.push([cx + Math.sign(c) * Math.abs(c) ** 0.8 * rx * k, cy + s * ry * k]);
  }
  return pts;
}

// a highlighter band: ragged at both ends, slightly tilted
function band(w, h, r) {
  const top = [], bot = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, end = i === 0 || i === 10;
    top.push([6 + t * (w - 12) + r.jit(2), h * 0.24 - t * 3 + r.jit(1.6) + (end ? 5 : 0)]);
    bot.push([6 + t * (w - 12) + r.jit(2), h * 0.8 - t * 2 + r.jit(1.6) - (end ? 4 : 0)]);
  }
  return [...top, ...bot.reverse()];
}

function filter(id, seed, { warp = 7, rim = 2.4, body = 0.5, grain = 0.32 } = {}) {
  return `<filter id="${id}" x="-12%" y="-30%" width="124%" height="160%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency="0.035 0.06" numOctaves="2" seed="${seed}" result="warp"/>
<feDisplacementMap in="SourceGraphic" in2="warp" scale="${warp}" xChannelSelector="R" yChannelSelector="G" result="shape"/>
<feGaussianBlur in="shape" stdDeviation="${rim}" result="soft"/>
<feComposite in="shape" in2="soft" operator="out" result="rim"/>
<feComponentTransfer in="shape" result="body"><feFuncA type="linear" slope="${body}"/></feComponentTransfer>
<feComponentTransfer in="rim" result="edge"><feFuncA type="linear" slope="0.9"/></feComponentTransfer>
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="${seed + 7}" result="noise"/>
<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 5 0 0 0 -2.75" result="speck"/>
<feComposite in="shape" in2="speck" operator="in" result="grain0"/>
<feComponentTransfer in="grain0" result="grain"><feFuncA type="linear" slope="${grain}"/></feComponentTransfer>
<feMerge><feMergeNode in="body"/><feMergeNode in="edge"/><feMergeNode in="grain"/></feMerge>
</filter>`;
}

const svg = (w, h, cls, inner) =>
  `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" focusable="false">${inner}</svg>`;

/** A swatch to sit behind a heading: a main wash and a smaller wet bloom of a second colour. */
export function swatch(color, accent, seed) {
  const r = rng(seed);
  const a = `wc${++uid}`, b = `wc${++uid}`;
  const W = 180, H = 64;
  const main = smooth(blob(88 + r.jit(4), 33, 74, 18, r));
  const bloom = smooth(blob(70 + r.jit(26), 32 + r.jit(3), 26, 10, r, 10, 0.2));
  return svg(W, H, 'wc swatch', `<defs>${filter(a, seed)}${filter(b, seed + 3, { body: 0.42, warp: 6, rim: 2 })}</defs>
<g filter="url(#${a})"><path d="${main}" fill="#${color}"/></g>
<g filter="url(#${b})" class="bloom"><path d="${bloom}" fill="#${accent}"/></g>`);
}

/** The highlighter wash behind the name. */
export function highlight(color, seed = 7) {
  const r = rng(seed);
  const a = `wc${++uid}`;
  const W = 240, H = 56;
  return svg(W, H, 'wc highlight', `<defs>${filter(a, seed, { body: 0.62, warp: 5, rim: 2 })}</defs>
<g filter="url(#${a})"><path d="${smooth(band(W, H, r))}" fill="#${color}"/></g>`);
}
