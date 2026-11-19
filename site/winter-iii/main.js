import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

const page = document.getElementById('page');
let n = 0;
const divider = () => h('canvas', { class: 'divider', 'aria-hidden': 'true', 'data-kind': n++ % 2 ? 'FoxTracks' : 'HareTracks' });
// the walk: a landmark the page passes on its way to the next section
const LANDMARKS = { Creek: [720, 200], Cabin: [720, 270], Fence: [720, 210], Lake: [720, 230], Snag: [720, 250] };
const landmark = (name) => h('canvas', { class: 'landmark', 'aria-hidden': 'true', 'data-art': name, style: `aspect-ratio: ${LANDMARKS[name][0]} / ${LANDMARKS[name][1]}` });
const section = (id, title, via, ...body) =>
  h('section', { id, 'aria-labelledby': `${id}-h` }, via ? landmark(via) : null, divider(), h('h2', { id: `${id}-h` }, title), ...body);

page.append(
  h('header', { class: 'hero' },
    h('p', { class: 'seal', 'aria-hidden': 'true' }, c.initials),
    h('h1', {}, c.name),
    h('p', { class: 'tagline' }, c.tagline)),
  h('div', { class: 'intro' }, c.intro.map((p) => h('p', {}, p)),
    h('p', {}, 'Write to me at ', h('a', { href: `mailto:${c.email}` }, c.email), '.')),
  section('now', 'Now', 'Creek',
    h('p', { class: 'meta' }, `Updated ${c.now.updated}`),
    h('ul', { class: 'plain' }, c.now.items.map((i) => h('li', {}, i)))),
  section('work', 'Work', 'Cabin',
    h('ul', { class: 'rows' }, c.work.map((w) =>
      h('li', {}, h('a', { href: w.url }, w.name), h('span', { class: 'role' }, w.role), h('span', { class: 'when' }, w.when))))),
  section('projects', 'Projects', 'Fence',
    h('ul', { class: 'rows' }, c.projects.map((p) =>
      h('li', {}, h('a', { href: p.url }, p.name), h('span', { class: 'role' }, p.blurb))))),
  section('writing', 'Writing', 'Lake',
    h('ul', { class: 'rows' }, c.writing.map((w) =>
      h('li', {}, h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'Favorite' }, '✻') : null, h('span', { class: 'when' }, w.date))))),
  section('elsewhere', 'Elsewhere', 'Snag',
    h('p', { class: 'links' }, c.elsewhere.map((e) => h('a', { href: e.url }, e.name)))),
  h('footer', {}, divider(), h('p', {}, `© ${new Date().getFullYear()} ${c.name}. Drawn in the snow.`)),
);

// the woods: fixed behind the page
const SRC = 'winter-iii';
const treeline = mount(document.getElementById('treeline'), { src: SRC, artboard: 'Treeline', fit: 'cover', align: 'bottomCenter' });
const stand = mount(document.getElementById('stand'), { src: SRC, artboard: 'StandL', align: 'bottomLeft' });
const maple = mount(document.getElementById('maple'), { src: SRC, artboard: 'MapleTR', align: 'topRight' });
const fir = mount(document.getElementById('fir'), { src: SRC, artboard: 'FirBR', align: 'bottomRight' });
const sun = mount(document.getElementById('sun'), { src: SRC, artboard: 'Sun' });
const snow = mount(document.getElementById('snow'), { src: SRC, artboard: 'Snow', fit: 'cover' });
const fixed = [treeline, stand, maple, fir, sun, snow];

// Fixed canvases never leave the viewport, so keep them playing. With reduced
// motion, let the trees finish drawing once, then hold still (and no snowfall).
let settled = false;
if (reducedMotion) {
  snow.rive.pause();
  setTimeout(() => { settled = true; for (const m of fixed) m.rive.pause(); }, 7000);
}
for (const m of fixed) m.rive.on(window.rive.EventType.Pause, () => !settled && !(reducedMotion && m === snow) && m.rive.play());

// tracks print themselves into each divider as it scrolls into view; the
// landmarks draw themselves on the same way, then keep living while in view
for (const cv of document.querySelectorAll('canvas.divider')) mount(cv, { src: SRC, artboard: cv.dataset.kind });
for (const cv of document.querySelectorAll('canvas.landmark')) mount(cv, { src: SRC, artboard: cv.dataset.art, align: 'bottomCenter' });

// scroll walks the low sun along its arc, and the near trees drift a little
// apart, as trees do when you walk in between them
const standEl = document.getElementById('stand'), firEl = document.getElementById('fir'), mapleEl = document.getElementById('maple');
let ticking = false;
const onScroll = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const f = max > 0 ? Math.min(1, scrollY / max) : 0;
    sun.set('scroll', f * 100);
    if (!reducedMotion) {
      const k = Math.min(1, scrollY / 1400);
      standEl.style.transform = `translateX(${(-k * 3.2).toFixed(2)}vw)`;
      firEl.style.transform = `translateX(${(k * 2.6).toFixed(2)}vw)`;
      mapleEl.style.transform = `translate(${(k * 1.4).toFixed(2)}vw, ${(-k * 2.4).toFixed(2)}vh)`;
    }
  });
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// a click on open snow knocks a clump loose from whichever tree is nearest
const shakes = { stand: 5, maple: 4, fir: 4 };
addEventListener('click', (e) => {
  if (e.target.closest('a, button, h1, h2, p, li, .variant-switch, canvas')) return;
  const x = e.clientX / innerWidth;
  const y = e.clientY / innerHeight;
  const name = x < 0.5 ? 'stand' : y < 0.5 ? 'maple' : 'fir';
  ({ stand, maple, fir })[name].fire(`shake${Math.floor(Math.random() * shakes[name])}`);
});
