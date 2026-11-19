// Page transitions between the hill and its posts: the next page arrives in
// drops of watercolor, landing on the page you're leaving and spreading until
// they run together.
//
// Each post names a recipe on <html data-turn="…">; going back to the hill
// replays the recipe of the post you're leaving. A recipe says how many drops
// land, where (around the point the link was pressed), when, how big, and
// whether they carry pigment or leave a tide line. When a page is revealed the
// recipe is turned into masks and keyframes sized to this screen, with a little
// chance in it so no two arrivals are quite the same. Runs as a plain script in
// <head>, before the page is first revealed; turn.css holds the fixed parts.
const AT = 'turn:at';
const EFFECT = 'turn:effect';

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

// the page being left says which recipe it was entered with, for the way back
addEventListener('pageswap', (e) => {
  if (!e.viewTransition) return;
  try {
    sessionStorage.setItem(EFFECT, document.documentElement.dataset.turn || '');
  } catch {}
});

addEventListener('pagereveal', (e) => {
  if (!e.viewTransition) return;
  let at = { x: 0.5, y: 0.35 };
  let left = '';
  try {
    at = JSON.parse(sessionStorage.getItem(AT)) || at;
    left = sessionStorage.getItem(EFFECT) || '';
    sessionStorage.removeItem(AT);
    sessionStorage.removeItem(EFFECT);
  } catch {}
  const own = document.documentElement.dataset.turn;
  const name = RECIPES[own] ? own : RECIPES[left] ? left : 'drops';
  e.viewTransition.types.add(name);

  const W = innerWidth, H = innerHeight;
  const recipe = RECIPES[name];
  const drops = recipe.plan({ W, H, M: Math.max(W, H), m: Math.min(W, H), x: at.x * W, y: at.y * H, r: Math.random });
  const { css, layers } = compose(recipe, drops, W, H);
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const els = layers.map(([vtName, svg]) => overlay(vtName, svg));
  e.viewTransition.finished.finally(() => {
    style.remove();
    els.forEach((el) => el.remove());
  });
});

// ---------- the drops' shapes

// every drop is a circle pushed about by noise; each shape has its own noise, and a
// drop's tide line or pigment is drawn with the same noise so it sits on the drop
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

// a tide line: pigment pooled at the edge where a wash stops, a paler band inside.
// "blue" is a wash of colour; "wet" is just water darkening the paper at the rim
const TONES = {
  blue: { band: '7f9fbf', rim: '5f86ad', bandO: 0.16, rimO: 0.38, gran: '.27  0 0 0 0 .4  0 0 0 0 .56', granO: 0.45 },
  wet: { band: 'b9a27f', rim: '8f7656', bandO: 0.1, rimO: 0.26, gran: '.42  0 0 0 0 .34  0 0 0 0 .25', granO: 0.3 },
};
const tide = (s, k, t = TONES.blue) => `<svg viewBox='0 0 200 200' preserveAspectRatio='xMidYMid meet'>
<filter id='tw${k}' x='-25%' y='-25%' width='150%' height='150%'>${noise(s)}</filter>
<filter id='tb${k}' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='2.6'/></filter>
<filter id='tg${k}'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${s.seed}'/><feColorMatrix values='0 0 0 0 ${t.gran}  0 0 0 -2.6 1.2'/><feComposite in2='SourceGraphic' operator='in'/></filter>
<g filter='url(#tw${k})'>
<circle cx='100' cy='100' r='56.5' fill='none' stroke='#${t.band}' stroke-opacity='${t.bandO}' stroke-width='9' filter='url(#tb${k})'/>
<circle cx='100' cy='100' r='59.6' fill='none' stroke='#${t.rim}' stroke-opacity='${t.rimO}' stroke-width='2.4'/>
<circle cx='100' cy='100' r='59.5' fill='none' stroke='#000' stroke-width='5' filter='url(#tg${k})' opacity='${t.granO}'/>
</g></svg>`;

// a drop that carries colour: a glaze with a pooled rim and some granulation
const pigment = (s, k, hex) => `<svg viewBox='0 0 200 200' preserveAspectRatio='xMidYMid meet'>
<filter id='pw${k}' x='-25%' y='-25%' width='150%' height='150%'>${noise(s)}<feGaussianBlur stdDeviation='2'/></filter>
<filter id='pg${k}'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' seed='${s.seed + 3}'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.1'/><feComposite in2='SourceGraphic' operator='in'/></filter>
<g filter='url(#pw${k})'>
<circle cx='100' cy='100' r='60' fill='#${hex}' fill-opacity='.22'/>
<circle cx='100' cy='100' r='44' fill='#${hex}' fill-opacity='.12'/>
<circle cx='100' cy='100' r='58.6' fill='none' stroke='#${hex}' stroke-opacity='.5' stroke-width='2.2'/>
<circle cx='100' cy='100' r='60' fill='#${hex}' filter='url(#pg${k})' opacity='.25'/>
</g></svg>`;

// ---------- recipes

// A drop: where it lands (x, y in px), when (t, 0–1 of the transition), how big it
// is the moment it lands and how far it spreads by the end (px, box size: the drop
// itself is 60% of that), which shape, and optionally colour or a tide line.
// The first drop always spreads to 4.8× the long side, so the page is covered.
const PIGMENTS = ['E9B93A', '7FA65A', 'D98C8C', '6F9CC4', 'A89CD6'];
const spot = (r, k) => (r() * 2 - 1) * k;

const RECIPES = {
  // the original: one drop, then three more around it a beat apart
  drops: {
    dur: 1600,
    land: 0.1,
    edge: 'wet',
    plan: ({ W, H, M, x, y }) => [
      { x, y, t: 0, size: 0.26 * M, end: 4.8 * M },
      { x: x + 0.22 * W, y: y - 0.14 * H, t: 0.14, size: 0.2 * M, end: 2.3 * M },
      { x: x - 0.18 * W, y: y + 0.2 * H, t: 0.24, size: 0.18 * M, end: 2.3 * M },
      { x: x + 0.1 * W, y: y + 0.34 * H, t: 0.33, size: 0.16 * M, end: 2.3 * M },
    ],
  },
  // three drops, close together and quick
  drizzle: {
    dur: 1000,
    land: 0.12,
    edge: 'wet',
    plan: ({ M, m, x, y, r }) => [
      { x, y, t: 0, size: 0.2 * M, end: 4.8 * M },
      { x: x + spot(r, 0.14 * m), y: y + spot(r, 0.12 * m), t: 0.07, size: 0.15 * M, end: 2.6 * M },
      { x: x + spot(r, 0.16 * m), y: y + spot(r, 0.14 * m), t: 0.15, size: 0.13 * M, end: 2.6 * M },
    ],
  },
  // a patter of small drops all over the page, the first under your finger
  rain: {
    dur: 1500,
    land: 0.07,
    plan: ({ W, H, M, x, y, r }) => [
      { x, y, t: 0, size: 0.12 * M, end: 4.8 * M },
      ...Array.from({ length: 9 }, (_, i) => ({
        x: r() * W, y: r() * H, t: 0.04 + (i / 9) * 0.4 + r() * 0.04, size: (0.05 + r() * 0.05) * M, end: (1.3 + r() * 0.9) * M,
      })),
    ],
  },
  // rain, quicker and lighter: seven drops, all down in the first third
  shower: {
    dur: 1000,
    land: 0.08,
    plan: ({ W, H, M, x, y, r }) => [
      { x, y, t: 0, size: 0.12 * M, end: 4.8 * M },
      ...Array.from({ length: 7 }, (_, i) => ({
        x: r() * W, y: r() * H, t: 0.03 + (i / 7) * 0.26 + r() * 0.03, size: (0.05 + r() * 0.05) * M, end: (1.4 + r() * 0.9) * M,
      })),
    ],
  },
  // rain coming down hard: eighteen small drops almost at once
  downpour: {
    dur: 1000,
    land: 0.07,
    plan: ({ W, H, M, x, y, r }) => [
      { x, y, t: 0, size: 0.1 * M, end: 4.8 * M },
      ...Array.from({ length: 18 }, () => ({
        x: r() * W, y: r() * H, t: 0.02 + r() * 0.22, size: (0.035 + r() * 0.04) * M, end: (1.1 + r() * 0.8) * M,
      })),
    ],
  },
  // slow rain: nine drops one at a time, each given room to land and spread
  patter: {
    dur: 2200,
    land: 0.06,
    plan: ({ W, H, M, x, y, r }) => [
      { x, y, t: 0, size: 0.1 * M, end: 4.8 * M },
      ...Array.from({ length: 9 }, (_, i) => ({
        x: r() * W, y: r() * H, t: 0.06 + (i / 9) * 0.58 + r() * 0.02, size: (0.05 + r() * 0.04) * M, end: (1.2 + r() * 0.8) * M,
      })),
    ],
  },
  // rain starting up: a few slow, sparse drops, then quicker and thicker
  gathering: {
    dur: 1800,
    land: 0.07,
    plan: ({ W, H, M, x, y, r }) => [
      { x, y, t: 0, size: 0.1 * M, end: 4.8 * M },
      ...Array.from({ length: 14 }, (_, i) => ({
        x: r() * W, y: r() * H, t: 0.06 + 0.56 * Math.sqrt((i + 1) / 14) + r() * 0.015, size: (0.045 + r() * 0.045) * M, end: (1.2 + r() * 0.8) * M,
      })),
    ],
  },
  // a passing shower: the drops move across the page from the side you pressed
  sweep: {
    dur: 1400,
    land: 0.07,
    plan: ({ W, H, M, x, y, r }) => {
      const fromLeft = x < W / 2;
      return [
        { x, y, t: 0, size: 0.11 * M, end: 4.8 * M },
        ...Array.from({ length: 12 }, (_, i) => {
          const u = (i + r() * 0.8) / 12; // how far across the page this drop is
          return { x: (fromLeft ? u : 1 - u) * W, y: r() * H, t: 0.03 + u * 0.42, size: (0.05 + r() * 0.04) * M, end: (1.3 + r() * 0.8) * M };
        }),
      ];
    },
  },
  // four big, slow drops, each leaving a tide line of pigment that dries away
  puddle: {
    dur: 2200,
    land: 0.09,
    edge: 'blue',
    plan: ({ M, m, x, y, r }) => [
      { x, y, t: 0, size: 0.3 * M, end: 4.8 * M },
      { x: x + 0.3 * m + spot(r, 0.06 * m), y: y - 0.18 * m + spot(r, 0.06 * m), t: 0.12, size: 0.26 * M, end: 2.4 * M },
      { x: x - 0.28 * m + spot(r, 0.06 * m), y: y + 0.22 * m + spot(r, 0.06 * m), t: 0.21, size: 0.24 * M, end: 2.4 * M },
      { x: x + 0.12 * m + spot(r, 0.06 * m), y: y + 0.4 * m + spot(r, 0.06 * m), t: 0.29, size: 0.22 * M, end: 2.4 * M },
    ],
  },
  // five drops that carry colour; it blooms, then dries clear to show the page
  pigment: {
    dur: 1900,
    land: 0.1,
    pigment: true,
    plan: ({ M, m, x, y, r }) => {
      const a0 = r() * Math.PI * 2;
      return [
        { x, y, t: 0, size: 0.24 * M, end: 4.8 * M },
        ...Array.from({ length: 4 }, (_, i) => {
          const a = a0 + (i / 4) * Math.PI * 2 + spot(r, 0.4);
          const d = (0.22 + r() * 0.16) * m;
          return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, t: 0.1 + i * 0.07, size: (0.16 + r() * 0.06) * M, end: 2.4 * M };
        }),
      ];
    },
  },
  // flung off a brush: a trail of drops in one direction, smaller as they go, and specks
  flick: {
    dur: 1300,
    land: 0.08,
    plan: ({ W, H, M, m, x, y, r }) => {
      // fling toward the roomier side of the page
      const a = Math.atan2(H / 2 - y, W / 2 - x) + spot(r, 0.5);
      const trail = Array.from({ length: 6 }, (_, i) => {
        const d = (0.1 + i * 0.12 + r() * 0.03) * m;
        return { x: x + Math.cos(a) * d + spot(r, 0.02 * m), y: y + Math.sin(a) * d + spot(r, 0.02 * m), t: 0.03 + i * 0.035, size: (0.18 - i * 0.022) * M, end: (2.4 - i * 0.12) * M };
      });
      const specks = Array.from({ length: 7 }, () => {
        const d = (0.15 + r() * 0.65) * m;
        const b = a + spot(r, 0.28);
        return { x: x + Math.cos(b) * d, y: y + Math.sin(b) * d, t: 0.08 + r() * 0.18, size: (0.012 + r() * 0.018) * M, end: (0.7 + r() * 0.5) * M };
      });
      return [{ x, y, t: 0, size: 0.2 * M, end: 4.8 * M }, ...trail, ...specks];
    },
  },
};

// ---------- recipe → css

function compose(recipe, drops, W, H) {
  const D = recipe.dur;
  const m = Math.min(W, H);
  const pct = (v) => `${(Math.min(1, Math.max(0, v)) * 100).toFixed(2)}%`;
  const px = (v) => `${v.toFixed(1)}px`;
  let css = '';
  const anims = [], masks = [], sizes = [], spots = [];
  const layers = [];
  drops.forEach((d, i) => {
    const k = i + 1;
    const shape = SHAPES[i % SHAPES.length];
    const landed = d.t + recipe.land;
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

    // a layer that rides on the drop: captured filling the screen (the drop is 60%
    // of the short side there), then moved onto the drop and scaled with it
    const wet = recipe.edge ? tide(shape, k, TONES[recipe.edge]) : recipe.pigment ? pigment(shape, k, PIGMENTS[i % PIGMENTS.length]) : null;
    if (!wet) return;
    const name = `turn-o${k}`;
    layers.push([name, wet]);
    const s = (v) => (v / m).toFixed(4);
    // pigment shows as soon as it lands and soon dries clear; a tide line dries later
    const dryFrom = recipe.edge ? Math.max(landed + 0.15, 0.5) : landed + 0.06;
    css += `@keyframes turn-s${k} {
  0%, ${pct(d.t)} { scale: 0; animation-timing-function: cubic-bezier(0.2, 0.7, 0.4, 1); }
  ${pct(landed)} { scale: ${s(d.size)}; animation-timing-function: cubic-bezier(0.45, 0, 0.7, 1); }
  100% { scale: ${s(d.end)}; }
}
@keyframes turn-f${k} { 0%, ${pct(d.t)} { opacity: 0; } ${pct(d.t + 0.02)} { opacity: 1; } ${pct(dryFrom)} { opacity: 1; } 100% { opacity: 0; } }
::view-transition-group(${name}) { animation: none; }
::view-transition-new(${name}) {
  translate: ${px(d.x - W / 2)} ${px(d.y - H / 2)};
  animation: turn-s${k} ${D}ms linear both, turn-f${k} ${D}ms linear both;
  ${recipe.pigment ? 'mix-blend-mode: multiply;' : ''}
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

// a layer drawn over both pages for the length of the transition, captured under
// its own view-transition-name (see turn.css)
function overlay(name, svg) {
  const el = document.createElement('div');
  el.className = 'turn-fx';
  el.style.viewTransitionName = name;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = svg;
  (document.body || document.documentElement).append(el);
  return el;
}
