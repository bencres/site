import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

const page = document.getElementById('page');
let n = 0;
const divider = () => h('canvas', { class: 'divider', 'aria-hidden': 'true', 'data-kind': n++ % 2 ? 'FoxTracks' : 'HareTracks' });
const section = (id, title, ...body) =>
  h('section', { id, 'aria-labelledby': `${id}-h` }, divider(), h('h2', { id: `${id}-h` }, title), ...body);

page.append(
  h('header', { class: 'hero' },
    h('p', { class: 'seal', 'aria-hidden': 'true' }, c.initials),
    h('h1', {}, c.name),
    h('p', { class: 'tagline' }, c.tagline)),
  h('div', { class: 'intro' }, c.intro.map((p) => h('p', {}, p)),
    h('p', {}, 'Write to me at ', h('a', { href: `mailto:${c.email}` }, c.email), '.')),
  section('now', 'Now',
    h('p', { class: 'meta' }, `Updated ${c.now.updated}`),
    h('ul', { class: 'plain' }, c.now.items.map((i) => h('li', {}, i)))),
  section('work', 'Work',
    h('ul', { class: 'rows' }, c.work.map((w) =>
      h('li', {}, h('a', { href: w.url }, w.name), h('span', { class: 'role' }, w.role), h('span', { class: 'when' }, w.when))))),
  section('projects', 'Projects',
    h('ul', { class: 'rows' }, c.projects.map((p) =>
      h('li', {}, h('a', { href: p.url }, p.name), h('span', { class: 'role' }, p.blurb))))),
  section('writing', 'Writing',
    h('ul', { class: 'rows' }, c.writing.map((w) =>
      h('li', {}, h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'Favorite' }, '✻') : null, h('span', { class: 'when' }, w.date))))),
  section('elsewhere', 'Elsewhere',
    h('p', { class: 'links' }, c.elsewhere.map((e) => h('a', { href: e.url }, e.name)))),
  h('footer', {}, divider(), h('p', {}, `© ${new Date().getFullYear()} ${c.name}. Drawn in the snow.`)),
);

// the woods: fixed behind the page
const stand = mount(document.getElementById('stand'), { src: 'winter-ii', artboard: 'StandL', align: 'bottomLeft' });
const maple = mount(document.getElementById('maple'), { src: 'winter-ii', artboard: 'MapleTR', align: 'topRight' });
const fir = mount(document.getElementById('fir'), { src: 'winter-ii', artboard: 'FirBR', align: 'bottomRight' });
const sun = mount(document.getElementById('sun'), { src: 'winter-ii', artboard: 'Sun' });
const far = mount(document.getElementById('far'), { src: 'winter-ii', artboard: 'Far', fit: 'cover', align: 'bottomCenter' });
const snow = mount(document.getElementById('snow'), { src: 'winter-ii', artboard: 'Snow', fit: 'cover' });
const fixed = [stand, maple, fir, sun, far, snow];

// Fixed canvases never leave the viewport, so keep them playing. With reduced
// motion, let the trees finish drawing once, then hold still (and no snowfall).
let settled = false;
if (reducedMotion) {
  snow.rive.pause();
  setTimeout(() => { settled = true; for (const m of fixed) m.rive.pause(); }, 7000);
}
for (const m of fixed) m.rive.on(window.rive.EventType.Pause, () => !settled && !(reducedMotion && m === snow) && m.rive.play());

// tracks print themselves into each divider as it scrolls into view
for (const cv of document.querySelectorAll('canvas.divider')) mount(cv, { src: 'winter-ii', artboard: cv.dataset.kind });

// scroll walks the low sun along its arc; the ground's shadows shorten and the
// gold-hour warmth on the page cools as it climbs
const onScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  const p = max > 0 ? Math.min(100, (scrollY / max) * 100) : 0;
  sun.set('scroll', p);
  far.set('scroll', p);
  document.documentElement.style.setProperty('--gold', (1 - p / 100).toFixed(3));
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
