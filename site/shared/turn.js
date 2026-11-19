// Page transitions: the next page arrives as a downpour of watercolor drops,
// landing on the page you're leaving wherever either page has content, each
// with a faint wet rim that stops where it meets another drop and dries.
//
// Every arrival is generated for this screen from the settings below (which the
// tuning card, turn-tune.js, can override and keep in localStorage), with a
// little chance in it so no two are quite the same. Runs as a plain script in
// <head>, before the page is first revealed; turn.css holds the fixed parts.
const AT = 'turn:at';
const INK = 'turn:ink';

// the settings, with the ranges the tuning card offers for each
const TURN = (globalThis.TURN = {
  key: 'turn:settings',
  settings: [
    { id: 'duration', label: 'length', min: 400, max: 2500, step: 50, value: 1000, unit: 'ms' },
    { id: 'drops', label: 'drops', min: 0, max: 40, step: 1, value: 10 },
    { id: 'window', label: 'landing over', min: 0.02, max: 0.8, step: 0.01, value: 0.31, unit: '× length' },
    { id: 'land', label: 'landing speed', min: 0.02, max: 0.3, step: 0.01, value: 0.21, unit: '× length' },
    { id: 'first', label: 'first drop', min: 0.02, max: 0.4, step: 0.01, value: 0.05, unit: '× screen' },
    { id: 'size', label: 'drop size', min: 0.01, max: 0.2, step: 0.005, value: 0.1, unit: '× screen' },
    { id: 'spread', label: 'spread', min: 0.4, max: 3, step: 0.05, value: 2.8, unit: '× screen' },
    { id: 'rim', label: 'rim', min: 0, max: 0.4, step: 0.005, value: 0.26 },
    { id: 'dry', label: 'rim dries in', min: 0.03, max: 0.6, step: 0.01, value: 0.1, unit: '× length' },
    { id: 'aim', label: 'on content', min: 0, max: 1, step: 0.05, value: 1, unit: 'of drops' },
  ],
  read() {
    const out = Object.fromEntries(this.settings.map((s) => [s.id, s.value]));
    try {
      Object.assign(out, JSON.parse(localStorage.getItem(this.key)) || {});
    } catch {}
    return out;
  },
});

addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href]');
  if (!a || a.origin !== location.origin || e.defaultPrevented) return;
  // a keyboard "click" has no pointer position; use the link itself
  let x = e.clientX, y = e.clientY;
  if (!e.detail) {
    const r = a.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  }
  try {
    sessionStorage.setItem(AT, JSON.stringify({ x: x / innerWidth, y: y / innerHeight }));
  } catch {}
}, true);

// the page being left notes where its content is, for the drops to aim at
addEventListener('pageswap', (e) => {
  if (!e.viewTransition) return;
  try {
    sessionStorage.setItem(INK, JSON.stringify(inked()));
  } catch {}
});

// Where a page has something on screen (text, headings, pictures, the signpost),
// as fractions of the screen. The drops aim for these on both pages: a drop on bare
// paper changes nothing, and reads as a circle growing rather than a page turning.
function inked() {
  const W = innerWidth, H = innerHeight;
  const out = [];
  for (const el of document.querySelectorAll('h1, h2, h3, h4, p, li, pre, figure, img, canvas, .arm, .badge, .sign, .trail')) {
    const b = el.getBoundingClientRect();
    if (b.width < 8 || b.height < 6 || b.bottom <= 0 || b.top >= H || b.right <= 0 || b.left >= W) continue;
    out.push([Math.max(0, b.left) / W, Math.max(0, b.top) / H, Math.min(W, b.right) / W, Math.min(H, b.bottom) / H].map((v) => +v.toFixed(4)));
    if (out.length >= 90) break;
  }
  return out;
}

addEventListener('pagereveal', (e) => {
  if (!e.viewTransition) return;
  let at = { x: 0.5, y: 0.35 };
  let ink = [];
  try {
    at = JSON.parse(sessionStorage.getItem(AT)) || at;
    ink = JSON.parse(sessionStorage.getItem(INK)) || [];
    for (const k of [AT, INK]) sessionStorage.removeItem(k);
  } catch {}
  ink = ink.concat(inked());

  const S = TURN.read();
  const W = innerWidth, H = innerHeight, M = Math.max(W, H);
  const r = Math.random;
  const spot = onInk(ink, W, H, r);
  const drops = [
    // the first lands where you pressed and spreads to cover the page
    { x: at.x * W, y: at.y * H, t: 0, size: S.first * M, end: 4.8 * M },
    ...Array.from({ length: S.drops }, () => ({
      ...(r() < S.aim ? spot() : { x: r() * W, y: r() * H }),
      t: 0.02 + r() * S.window,
      size: S.size * (0.64 + r() * 0.73) * M,
      end: S.spread * (0.73 + r() * 0.53) * M,
    })),
  ];
  // a drop that lands on bare paper on both pages gets no rim: it's invisible, not a circle
  for (const d of drops) d.inked = inside(ink, d.x / W, d.y / H);
  const { css, layers } = compose(S, drops, W, H);
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const els = layers.map(([name, svg]) => overlay(name, svg));
  e.viewTransition.finished.finally(() => {
    style.remove();
    els.forEach((el) => el.remove());
  });
});

// a point somewhere on either page's content, bigger blocks more likely; if neither
// page reported any, anywhere on the screen
function onInk(rects, W, H, r) {
  return () => {
    if (!rects.length) return { x: r() * W, y: r() * H };
    const weights = rects.map(([x0, y0, x1, y1]) => Math.sqrt((x1 - x0) * (y1 - y0)));
    let pick = r() * weights.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < rects.length - 1 && (pick -= weights[i]) > 0) i++;
    const [x0, y0, x1, y1] = rects[i];
    return { x: (x0 + r() * (x1 - x0)) * W, y: (y0 + r() * (y1 - y0)) * H };
  };
}
const inside = (rects, x, y) => rects.some(([x0, y0, x1, y1]) => x >= x0 - 0.02 && x <= x1 + 0.02 && y >= y0 - 0.02 && y <= y1 + 0.02);

// ---------- the drops' shapes

// every drop is a circle pushed about by noise; each shape has its own noise, and a
// drop's rim is drawn with the same noise so it sits on the drop
const SHAPES = [
  { seed: 7, freq: 0.03, push: 30 },
  { seed: 19, freq: 0.035, push: 34 },
  { seed: 31, freq: 0.04, push: 32 },
  { seed: 43, freq: 0.032, push: 36 },
  { seed: 57, freq: 0.045, push: 28 },
];
const noise = ({ seed, freq, push }) =>
  `<feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' seed='${seed}'/><feDisplacementMap in='SourceGraphic' scale='${push}'/>`;
const uri = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
// the mask: a soft-edged drop, 60% of its box across
const MASKS = SHAPES.map((s) =>
  uri(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'><filter id='w' x='-25%' y='-25%' width='150%' height='150%'>${noise(s)}<feGaussianBlur stdDeviation='3'/></filter><circle cx='100' cy='100' r='60' fill='white' filter='url(#w)'/></svg>`)
);

// the wet rim: water darkening the paper where it stops, a paler band just inside,
// a little granulation; `o` is how strong the rim line is
const rim = (s, k, o) => `<svg viewBox='0 0 200 200' preserveAspectRatio='xMidYMid meet'>
<filter id='tw${k}' x='-25%' y='-25%' width='150%' height='150%'>${noise(s)}</filter>
<filter id='tb${k}' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='2.6'/></filter>
<filter id='tg${k}'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${s.seed}'/><feColorMatrix values='0 0 0 0 .42  0 0 0 0 .34  0 0 0 0 .25  0 0 0 -2.6 1.2'/><feComposite in2='SourceGraphic' operator='in'/></filter>
<g filter='url(#tw${k})'>
<circle cx='100' cy='100' r='56.5' fill='none' stroke='#b9a27f' stroke-opacity='${(o * 0.38).toFixed(4)}' stroke-width='9' filter='url(#tb${k})'/>
<circle cx='100' cy='100' r='59.6' fill='none' stroke='#8f7656' stroke-opacity='${o.toFixed(4)}' stroke-width='2.4'/>
<circle cx='100' cy='100' r='59.5' fill='none' stroke='#000' stroke-width='5' filter='url(#tg${k})' opacity='${(o * 1.06).toFixed(4)}'/>
</g></svg>`;

// ---------- how a drop grows (the same curves the keyframes use, so the script
// can tell when two drops will meet)

function bezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const dx = at(x1, x2, t) - x;
      const d = 3 * x1 * (1 - t) ** 2 + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(dx) < 1e-5 || !d) break;
      t = Math.min(1, Math.max(0, t - dx / d));
    }
    return at(y1, y2, t);
  };
}
const LANDING = bezier(0.2, 0.7, 0.4, 1);
const SPREADING = bezier(0.45, 0, 0.7, 1);
// a drop's box size at time u (0–1)
function sizeAt(d, land, u) {
  if (u <= d.t) return 0;
  const landed = d.t + land;
  if (u < landed) return d.size * LANDING((u - d.t) / land);
  return d.size + (d.end - d.size) * SPREADING((u - landed) / (1 - landed));
}
// when a drop's rim first touches another drop (the drop itself is 60% of its box)
function meets(drops, k, land) {
  const a = drops[k];
  for (let u = a.t; u <= 1; u += 0.005) {
    const ra = 0.29 * sizeAt(a, land, u);
    for (let j = 0; j < drops.length; j++) {
      if (j === k) continue;
      const b = drops[j];
      if (ra + 0.29 * sizeAt(b, land, u) >= Math.hypot(a.x - b.x, a.y - b.y)) return u;
    }
  }
  return 1;
}

// ---------- drops → css

// rims are captured small (40% of the screen's short side) and scaled, so even
// forty of them stay light; at their faintness the softness doesn't show
const RIM_RES = 0.4;

function compose(S, drops, W, H) {
  const D = S.duration;
  const m = Math.min(W, H);
  const pct = (v) => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(2)}%`;
  const px = (v) => `${v.toFixed(1)}px`;
  let css = '';
  const anims = [], masks = [], sizes = [], spots = [];
  const layers = [];
  drops.forEach((d, i) => {
    const k = i + 1;
    const landed = d.t + S.land;
    css += `@property --d${k} { syntax: '<length>'; inherits: false; initial-value: 0px; }\n`;
    // lands quickly, then spreads, slow at first and faster as it runs out
    css += `@keyframes turn-d${k} {
  0%, ${pct(d.t)} { --d${k}: 0px; animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1); }
  ${pct(landed)} { --d${k}: ${px(d.size)}; animation-timing-function: cubic-bezier(0.45, 0, 0.7, 1); }
  100% { --d${k}: ${px(d.end)}; }
}\n`;
    anims.push(`turn-d${k} ${D}ms linear both`);
    masks.push(`${MASKS[i % MASKS.length]} no-repeat`);
    sizes.push(`var(--d${k}) var(--d${k})`);
    spots.push(`calc(${px(d.x)} - var(--d${k}) / 2) calc(${px(d.y)} - var(--d${k}) / 2)`);

    if (!S.rim || !(d.inked || i === 0)) return;
    // a tide line forms where the water stops: the rim spreads with its drop only
    // until it runs into another, then stays put there and dries, while the page
    // keeps spreading past it (merged drops share no edge)
    const name = `turn-o${k}`;
    layers.push([name, rim(SHAPES[i % SHAPES.length], k, S.rim)]);
    const s = (v) => (v / (m * RIM_RES)).toFixed(4);
    const stop = meets(drops, i, S.land);
    const steps = [];
    for (let u = d.t; u < stop; u += 0.02) steps.push(`${pct(u)} { scale: ${s(sizeAt(d, S.land, u))}; }`);
    css += `@keyframes turn-s${k} { 0% { scale: 0; } ${steps.join(' ')} ${pct(stop)}, 100% { scale: ${s(sizeAt(d, S.land, stop))}; } }
@keyframes turn-f${k} { 0%, ${pct(d.t)} { opacity: 0; } ${pct(d.t + 0.02)} { opacity: 1; } ${pct(stop)} { opacity: 1; } ${pct(stop + S.dry)}, 100% { opacity: 0; } }
::view-transition-group(${name}) { animation: none; }
::view-transition-new(${name}) {
  translate: ${px(d.x - W / 2)} ${px(d.y - H / 2)};
  animation: turn-s${k} ${D}ms linear both, turn-f${k} ${D}ms linear both;
}\n`;
  });
  css += `::view-transition-group(root) { animation-duration: ${D}ms; }
::view-transition-old(root) { animation: none; }
::view-transition-new(root) {
  animation: ${anims.join(', ')};
  mask: ${masks.join(', ')};
  mask-size: ${sizes.join(', ')};
  mask-position: ${spots.join(', ')};
}\n`;
  return { css, layers };
}

// a rim drawn over both pages for the length of the transition, captured under its
// own view-transition-name: small and centred on the screen, then moved onto its drop
function overlay(name, svg) {
  const el = document.createElement('div');
  el.className = 'turn-fx';
  el.style.viewTransitionName = name;
  const size = Math.min(innerWidth, innerHeight) * RIM_RES;
  Object.assign(el.style, { width: `${size}px`, height: `${size}px`, left: `${(innerWidth - size) / 2}px`, top: `${(innerHeight - size) / 2}px` });
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = svg;
  (document.body || document.documentElement).append(el);
  return el;
}
