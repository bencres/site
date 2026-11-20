// A post: the same season and light as the hill you came from, its sketch, and
// the hill's watercolor washes behind the section headings, blooming in as you read.
// Only a post with a sketch loads the Rive runtime.
import { SEASONS, TIMES, when } from './when.js';
import { wash, PIGMENTS } from './paint.js';

const state = when();
const season = SEASONS[state.season];
document.documentElement.dataset.season = season;
document.documentElement.dataset.time = TIMES[state.time];

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// "back to the bookshelves", when you came from the hill, really goes back: the browser
// keeps the hill as you left it (painting running, scrolled to where you were), so
// returning is instant rather than loading and starting the painting over
const hill = new URL('../../', location.href).pathname;
for (const home of document.querySelectorAll('a.home')) {
  home.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) return;
    let from = null;
    try { from = new URL(document.referrer); } catch {}
    e.preventDefault();
    if (from?.origin === location.origin && from.pathname === hill && history.length > 1) return history.back();
    // otherwise to the hill without a #writing in its address: it scrolls itself there (main.js)
    try { sessionStorage.setItem('shire-ii:to', 'writing'); } catch {}
    location.href = hill;
  });
}

// the rest waits for the arriving page to finish landing (turn.js), so it never costs the
// transition a frame: the sketch's canvas already holds its place, and the washes bloom on scroll
await (window.turnSettled || Promise.resolve());

const sketch = document.getElementById('sketch');
if (sketch) {
  import('./shared/rive-mount.js')
    .then(({ mount }) => mount(sketch, { src: `sketches/${sketch.dataset.artboard.toLowerCase()}`, artboard: sketch.dataset.artboard, fit: 'contain' }))
    .catch((e) => console.warn('the sketch could not be drawn', e));
}

// each heading gets a swatch sized to its words, in the season's box of paints
const heads = [...document.querySelectorAll('.prose h2')];
heads.forEach((h2, i) => {
  const range = document.createRange();
  range.selectNodeContents(h2);
  const text = Math.min(range.getBoundingClientRect().width, h2.clientWidth);
  const w = Math.round(Math.min(Math.max(text + 70, 150), 460));
  const [color, accent] = PIGMENTS[season][i % 5];
  const swatch = document.createElement('span');
  swatch.className = 'wash';
  swatch.setAttribute('aria-hidden', 'true');
  swatch.style.width = `${w}px`;
  swatch.style.backgroundImage = wash({ w, h: 64, color, accent, seed: 211 + i * 37 });
  h2.prepend(swatch);
});

if (reducedMotion) heads.forEach((h2) => h2.classList.add('bloomed'));
else {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('bloomed'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -12% 0px' });
  heads.forEach((h2) => io.observe(h2));
}
