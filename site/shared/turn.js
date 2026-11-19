// Page transitions between the hill and its posts (styles in turn.css).
//
// Each post names its effect on <html data-turn="…">; going back to the hill
// replays the effect of the post you're leaving. Effects that spread from a
// point (bloom, burn, ink) start where the link was pressed. Runs as a plain
// script in <head>, before the page is first revealed.
const AT = 'turn:at';
const EFFECT = 'turn:effect';
const EFFECTS = ['bloom', 'burn', 'ink', 'brush', 'lamp'];

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
  const back = !own;
  e.viewTransition.types.add(effect);
  if (back) e.viewTransition.types.add('back');

  html.style.setProperty('--turn-x', `${(at.x * 100).toFixed(2)}vw`);
  html.style.setProperty('--turn-y', `${(at.y * 100).toFixed(2)}vh`);
  const fx = FX[effect] && overlay(effect, FX[effect]);
  e.viewTransition.finished.finally(() => {
    html.style.removeProperty('--turn-x');
    html.style.removeProperty('--turn-y');
    fx?.remove();
  });
});

// Some effects need something drawn over both pages (a burning edge, a flood of
// ink). It's added to the new page for the length of the transition, captured
// as its own layer (view-transition-name: turn-fx) and animated in turn.css.
function overlay(effect, svg) {
  const el = document.createElement('div');
  el.className = `turn-fx ${effect}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = svg;
  (document.body || document.documentElement).append(el);
  return el;
}

// Both use the bloom mask's own wobble (same noise, same seed, same 200-unit box),
// so the burning rim sits exactly on the edge of the hole it burns.
const WOBBLE = `<feTurbulence type='fractalNoise' baseFrequency='0.03' numOctaves='3' seed='7'/><feDisplacementMap in='SourceGraphic' scale='30'/>`;
const FX = {
  burn: `<svg viewBox='0 0 200 200' preserveAspectRatio='none'>
<filter id='turn-w' x='-25%' y='-25%' width='150%' height='150%'>${WOBBLE}</filter>
<filter id='turn-b4' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='3.4'/></filter>
<filter id='turn-b1' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='0.9'/></filter>
<g filter='url(#turn-w)'>
<circle cx='100' cy='100' r='68' fill='none' stroke='#7a4a1c' stroke-opacity='.36' stroke-width='16' filter='url(#turn-b4)'/>
<circle cx='100' cy='100' r='64.5' fill='none' stroke='#3a2412' stroke-opacity='.4' stroke-width='5' filter='url(#turn-b1)'/>
<circle cx='100' cy='100' r='63' fill='none' stroke='#2a1a10' stroke-opacity='.8' stroke-width='3.6' filter='url(#turn-b1)'/>
<circle cx='100' cy='100' r='61' fill='none' stroke='#e8681c' stroke-width='3' filter='url(#turn-b1)'/>
<circle cx='100' cy='100' r='60.6' fill='none' stroke='#ffd58a' stroke-width='1.1'/>
</g></svg>`,
  // the brush's wet edge: a pale glaze trailing behind, a pooled rim at the front, bristle streaks ahead of it
  brush: `<svg viewBox='0 0 100 300' preserveAspectRatio='none'>
<defs><linearGradient id='turn-glaze' x1='0' x2='1'><stop offset='0' stop-color='#e9b93a' stop-opacity='0'/><stop offset='.62' stop-color='#e9b93a' stop-opacity='.22'/><stop offset='.8' stop-color='#d9a63a' stop-opacity='.42'/></linearGradient></defs>
<filter id='turn-r' x='-10%' y='-2%' width='120%' height='104%'><feTurbulence type='fractalNoise' baseFrequency='0.06 0.35' numOctaves='3' seed='4'/><feDisplacementMap in='SourceGraphic' scale='6' xChannelSelector='R'/><feGaussianBlur stdDeviation='0.35'/></filter>
<g filter='url(#turn-r)'>
<rect x='0' y='-10' width='80' height='320' fill='url(#turn-glaze)'/>
<rect x='78' y='-10' width='3.2' height='320' fill='#b8862a' fill-opacity='.55'/>
<path d='M79 14h10v1.4h-10zM80 52h14v1h-14zM78 91h8v1.6h-8zM80 133h12v1h-12zM79 171h16v1h-16zM80 214h9v1.5h-9zM78 252h13v1h-13zM80 287h7v1.4h-7z' fill='#c4922e' fill-opacity='.5'/>
</g></svg>`,
  ink: `<svg viewBox='0 0 200 200' preserveAspectRatio='none'>
<filter id='turn-w' x='-25%' y='-25%' width='150%' height='150%'>${WOBBLE}<feGaussianBlur stdDeviation='1.6'/></filter>
<filter id='turn-g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 .08  0 0 0 0 .06  0 0 0 0 .05  0 0 0 -2.4 1.3'/><feComposite in2='SourceGraphic' operator='in'/></filter>
<g filter='url(#turn-w)'>
<circle cx='100' cy='100' r='60' fill='#231a14' fill-opacity='.97'/>
<circle cx='100' cy='100' r='60' filter='url(#turn-g)' opacity='.5'/>
<circle cx='100' cy='100' r='58' fill='none' stroke='#120c08' stroke-opacity='.6' stroke-width='3'/>
</g></svg>`,
};
