// Page transitions between the hill and its posts (styles in turn.css).
//
// Each post names its effect on <html data-turn="…">; going back to the hill
// replays the effect of the post you're leaving. Every effect spreads from (or
// toward) the point where the link was pressed. Runs as a plain script in
// <head>, before the page is first revealed.
const AT = 'turn:at';
const EFFECT = 'turn:effect';
const EFFECTS = ['bloom', 'tide', 'drops', 'burn', 'smolder', 'inward'];

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

// the page being left says which effect it was entered with, for the way back
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
  const html = document.documentElement;
  const own = html.dataset.turn;
  const effect = EFFECTS.includes(own) ? own : EFFECTS.includes(left) ? left : 'bloom';
  e.viewTransition.types.add(effect);

  html.style.setProperty('--turn-x', `${(at.x * 100).toFixed(2)}vw`);
  html.style.setProperty('--turn-y', `${(at.y * 100).toFixed(2)}vh`);
  // overlays are captured whole, centred on the screen (an overlay hanging off the
  // edge would be captured clipped), then moved to the press and scaled from there
  // as if they were 160vmax across, to match the masks
  const W = innerWidth, H = innerHeight;
  html.style.setProperty('--fx-k', ((1.6 * Math.max(W, H)) / Math.min(W, H)).toFixed(4));
  html.style.setProperty('--fx-tx', `${(at.x * W - W / 2).toFixed(1)}px`);
  html.style.setProperty('--fx-ty', `${(at.y * H - H / 2).toFixed(1)}px`);
  const layers = (FX[effect] || []).map(([name, svg]) => overlay(name, svg));
  e.viewTransition.finished.finally(() => {
    for (const v of ['--turn-x', '--turn-y', '--fx-k', '--fx-tx', '--fx-ty']) html.style.removeProperty(v);
    layers.forEach((el) => el.remove());
  });
});

// Some effects draw over both pages (a flame's rim, scorch, embers, a tide line of
// pigment). Each layer is added to the new page for the length of the transition,
// captured under its own view-transition-name and animated in turn.css.
function overlay(name, svg) {
  const el = document.createElement('div');
  el.className = `turn-fx ${name}`;
  el.style.viewTransitionName = name;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = svg;
  (document.body || document.documentElement).append(el);
  return el;
}

// All use the mask's own wobble (same noise, same seed, same 200-unit box), so
// a rim drawn at r=60 sits exactly on the edge of the hole or the bloom.
const WOBBLE = `<feTurbulence type='fractalNoise' baseFrequency='0.03' numOctaves='3' seed='7'/><feDisplacementMap in='SourceGraphic' scale='30'/>`;
const ring = (circles, defs = '') => `<svg viewBox='0 0 200 200' preserveAspectRatio='xMidYMid meet'>
<filter id='tw' x='-25%' y='-25%' width='150%' height='150%'>${WOBBLE}</filter>
<filter id='tb4' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='3.4'/></filter>
<filter id='tb1' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='0.9'/></filter>
${defs}<g filter='url(#tw)'>${circles}</g></svg>`;
const c = (r, stroke, opacity, width, blur) =>
  `<circle cx='100' cy='100' r='${r}' fill='none' stroke='${stroke}' stroke-opacity='${opacity}' stroke-width='${width}'${blur ? ` filter='url(#${blur})'` : ''}/>`;

// a flame eating outward: scorch ahead of it (outside), char, then the burning edge
const FLAME_OUT = ring(
  c(68, '#7a4a1c', 0.36, 16, 'tb4') + c(64.5, '#3a2412', 0.4, 5, 'tb1') + c(63, '#2a1a10', 0.8, 3.6, 'tb1') + c(61, '#e8681c', 1, 3, 'tb1') + c(60.6, '#ffd58a', 1, 1.1)
);
// a flame eating inward: the scorch and char sit inside the edge, on what's left
const FLAME_IN = ring(
  c(52, '#7a4a1c', 0.36, 16, 'tb4') + c(55.5, '#3a2412', 0.4, 5, 'tb1') + c(57, '#2a1a10', 0.8, 3.6, 'tb1') + c(59, '#e8681c', 1, 3, 'tb1') + c(59.4, '#ffd58a', 1, 1.1)
);
// the brown that spreads before a flame breaks through
const SCORCH = `<svg viewBox='0 0 200 200' preserveAspectRatio='xMidYMid meet'>
<filter id='ts' x='-30%' y='-30%' width='160%' height='160%'>${WOBBLE}<feGaussianBlur stdDeviation='7'/></filter>
<radialGradient id='tg'><stop offset='0' stop-color='#2a1a10' stop-opacity='.75'/><stop offset='.55' stop-color='#6a3f1a' stop-opacity='.5'/><stop offset='1' stop-color='#9a6a2c' stop-opacity='0'/></radialGradient>
<circle cx='100' cy='100' r='70' fill='url(#tg)' filter='url(#ts)'/></svg>`;
// sparks scattered round the burning edge
const EMBERS = (() => {
  let a = 11;
  const rnd = () => (a = (a * 16807) % 2147483647) / 2147483647;
  let dots = '';
  for (let i = 0; i < 46; i++) {
    const t = rnd() * Math.PI * 2;
    const r = 61 + rnd() * 16;
    const s = 0.35 + rnd() * 0.9;
    const col = rnd() > 0.35 ? '#ffb347' : '#ffe3a1';
    dots += `<circle cx='${(100 + Math.cos(t) * r).toFixed(1)}' cy='${(100 + Math.sin(t) * r).toFixed(1)}' r='${s.toFixed(2)}' fill='${col}' opacity='${(0.5 + rnd() * 0.5).toFixed(2)}'/>`;
  }
  return `<svg viewBox='0 0 200 200' preserveAspectRatio='xMidYMid meet'><filter id='te'><feGaussianBlur stdDeviation='0.25'/></filter><g filter='url(#te)'>${dots}</g></svg>`;
})();
// the tide line watercolor leaves where a wash stops: pigment pooled at the edge,
// a paler band just inside it, a little granulation
const TIDE = ring(
  c(57, '#7f9fbf', 0.14, 9, 'tb4') + c(59.6, '#5f86ad', 0.5, 2.6, 'tb1') + c(60.2, '#46698f', 0.4, 0.9) +
    `<circle cx='100' cy='100' r='59.5' fill='none' stroke='#000' stroke-width='5' filter='url(#tg2)' opacity='.6'/>`,
  `<filter id='tg2'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='5'/><feColorMatrix values='0 0 0 0 .27  0 0 0 0 .4  0 0 0 0 .56  0 0 0 -2.6 1.2'/><feComposite in2='SourceGraphic' operator='in'/></filter>`
);

const FX = {
  tide: [['turn-tide', TIDE]],
  burn: [['turn-flame', FLAME_OUT]],
  smolder: [['turn-scorch', SCORCH], ['turn-flame', FLAME_OUT], ['turn-embers', EMBERS]],
  inward: [['turn-flame', FLAME_IN]],
};
