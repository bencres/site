import { mount } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

document.getElementById('name').textContent = c.name;
document.getElementById('tagline').textContent = c.tagline;
document.getElementById('intro').append(...c.intro.map((p) => h('p', {}, p)));

const link = (x) => h('a', { href: x.url }, x.name ?? x.title);
const sections = [
  {
    id: 'now', title: 'Now', aside: c.now.updated, doodle: 'Cup',
    body: h('ul', { class: 'dash' }, c.now.items.map((t) => h('li', {}, t))),
  },
  {
    id: 'work', title: 'Work', doodle: 'Star',
    body: h('ul', { class: 'dash' }, c.work.map((w) => h('li', {}, link(w), h('span', { class: 'meta' }, `, ${w.role.toLowerCase()} (${w.when})`)))),
  },
  {
    id: 'projects', title: 'Things I’ve made', doodle: 'Snail',
    body: h('ul', { class: 'dash' }, c.projects.map((p) => h('li', {}, link(p), h('span', { class: 'meta' }, `: ${p.blurb}`)))),
  },
  {
    id: 'writing', title: 'Writing', doodle: 'Quill',
    body: h('ul', { class: 'dash' }, c.writing.map((w) => h('li', {}, link(w), w.starred ? h('span', { class: 'star', title: 'a favourite' }, '✶') : null, h('span', { class: 'date' }, w.date.toLowerCase())))),
  },
  {
    id: 'elsewhere', title: 'Elsewhere', doodle: 'Plane',
    body: h('p', { class: 'inline-links' }, c.elsewhere.map(link)),
  },
  {
    id: 'say-hi', title: 'Say hi', doodle: 'Envelope',
    body: h('p', {}, 'I’d love to hear from you — ', h('a', { href: `mailto:${c.email}` }, c.email), '.'),
  },
];

const root = document.getElementById('sections');
for (const s of sections) {
  const canvas = h('canvas', { class: 'doodle', 'aria-hidden': 'true' });
  const el = h('section', { id: s.id, 'aria-labelledby': `${s.id}-h` },
    canvas,
    h('h2', { id: `${s.id}-h` }, s.title, s.aside ? h('small', {}, s.aside) : null),
    s.body,
  );
  root.append(el);
  const d = mount(canvas, { src: 'margins', artboard: s.doodle });
  // the doodle does its little trick when you visit its section
  let cool = 0;
  el.addEventListener('pointerenter', () => {
    const now = performance.now();
    if (now - cool > 1800) { d.fire('poke'); cool = now; }
  });
}

mount(document.getElementById('swash'), { src: 'margins', artboard: 'Swash', fit: 'contain', align: 'centerLeft' });
const dand = mount(document.getElementById('dandelion'), { src: 'margins', artboard: 'Dandelion' });
// keyboard/touch-free fallback: pressing "w" makes a wish
addEventListener('keydown', (e) => { if (e.key === 'w' && !e.metaKey && !e.ctrlKey && document.activeElement === document.body) dand.fire('wish'); });
