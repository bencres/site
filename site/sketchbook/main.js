import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

const $ = (s) => document.querySelector(s);

// ---- copy
$('#name').textContent = c.name;
$('#elsewhere-nav').append(...c.elsewhere.map((l) => h('li', {}, h('a', { href: l.url }, l.name))));

const intro = $('#intro');
c.intro.forEach((p) => intro.append(h('p', {}, p)));
intro.append(h('p', {}, 'Say hello any time — ', h('a', { href: `mailto:${c.email}` }, c.email), '.'));

const dash = (...kids) => h('li', {}, ...kids);
const sections = [
  {
    id: 'now',
    title: 'Now',
    note: `updated ${c.now.updated}`,
    items: c.now.items.map((t) => dash(t)),
  },
  {
    id: 'work',
    title: 'Work',
    items: c.work.map((w) => dash(h('a', { href: w.url }, w.name), ` (${w.when}) — ${w.role.toLowerCase()}`)),
  },
  {
    id: 'projects',
    title: 'Projects',
    items: c.projects.map((p) => dash(h('a', { href: p.url }, p.name), `: ${p.blurb}`)),
  },
  {
    id: 'writing',
    title: 'Writing',
    items: c.writing.map((w) =>
      dash(h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'A favorite' }, ' ✦') : null, h('span', { class: 'date' }, ` ${w.date}`))
    ),
  },
  {
    id: 'elsewhere',
    title: 'Elsewhere',
    items: c.elsewhere.map((l) => dash(h('a', { href: l.url }, l.name))),
  },
];

const host = $('#sections');
const pending = [];
sections.forEach((s, i) => {
  const canvas = h('canvas', { class: 'swatch', 'aria-hidden': 'true' });
  const heading = h('h2', { id: s.id }, canvas, h('span', {}, s.title), s.note ? h('small', {}, s.note) : null);
  host.append(h('section', { class: 'block', 'aria-labelledby': s.id }, heading, h('ul', { class: 'dash' }, s.items)));
  const sw = mount(canvas, { src: 'sketchbook', artboard: `Swatch${i}`, fit: 'fill', onLoad: () => bloomVisible() });
  pending.push({ heading, sw });
});

// bloom each swatch the first time its heading reaches the lower part of the
// screen; a scroll check rather than an IntersectionObserver so a fast fling
// past a section still paints it
function bloomVisible() {
  const line = reducedMotion ? Infinity : innerHeight * 0.88;
  for (let i = pending.length - 1; i >= 0; i--) {
    const { heading, sw } = pending[i];
    const show = sw.input('show'); // undefined until the file has loaded
    if (show && heading.getBoundingClientRect().top < line) {
      setTimeout(() => (show.value = true), 120);
      pending.splice(i, 1);
    }
  }
  if (!pending.length) removeEventListener('scroll', onScroll);
}
let ticking = false;
const onScroll = () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => ((ticking = false), bloomVisible()));
};
addEventListener('scroll', onScroll, { passive: true });

// each swatch hugs its heading word rather than a fixed width
const fitSwatches = () =>
  document.querySelectorAll('.block h2').forEach((hd) => {
    hd.querySelector('.swatch').style.width = `${hd.querySelector('span').offsetWidth + 58}px`;
  });
document.fonts.ready.then(fitSwatches);
fitSwatches();

// ---- rive
const hero = mount($('#hero'), { src: 'sketchbook', artboard: 'Hero', fit: 'contain' });
const wash = mount($('.name-wash'), { src: 'sketchbook', artboard: 'Highlight', fit: 'fill' });
$('.name').addEventListener('mouseenter', () => wash.fire('swipe'));

// the house light also answers to the keyboard, for anyone not pointing
document.addEventListener('keydown', (e) => {
  if (e.key === 'l' && !e.metaKey && !e.ctrlKey && document.activeElement === document.body) hero.fire('lamp');
});
