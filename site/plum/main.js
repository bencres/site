import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

const page = document.getElementById('page');
const divider = () => h('canvas', { class: 'divider', 'aria-hidden': 'true', width: 240, height: 40 });
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
      h('li', {}, h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'Favorite' }, '✿') : null, h('span', { class: 'when' }, w.date))))),
  section('elsewhere', 'Elsewhere',
    h('p', { class: 'links' }, c.elsewhere.map((e) => h('a', { href: e.url }, e.name)))),
  h('footer', {}, divider(), h('p', {}, `© ${new Date().getFullYear()} ${c.name}. Painted by moonlight.`)),
);

// the night: two branches and a moon, fixed behind the page
const tl = mount(document.getElementById('tl'), { src: 'plum', artboard: 'BranchTL' });
const br = mount(document.getElementById('br'), { src: 'plum', artboard: 'BranchBR' });
const moon = mount(document.getElementById('moon'), { src: 'plum', artboard: 'Moon' });

// Fixed canvases never leave the viewport, so keep them playing. With reduced
// motion, let the branches finish growing once, then hold still.
let settled = false;
if (reducedMotion) setTimeout(() => { settled = true; for (const m of [tl, br, moon]) m.rive.pause(); }, 6500);
for (const m of [tl, br, moon]) m.rive.on(window.rive.EventType.Pause, () => !settled && m.rive.play());

// dividers paint themselves as they scroll into view (mount pauses offscreen ones)
for (const cv of document.querySelectorAll('canvas.divider')) mount(cv, { src: 'plum', artboard: 'Divider' });

// scroll lifts the moon and drifts the mist
const onScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  moon.set('scroll', max > 0 ? Math.min(100, (scrollY / max) * 100) : 0);
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// a click on empty night shakes petals loose from the nearer branch
addEventListener('click', (e) => {
  if (e.target.closest('a, button, h1, h2, p, li, .variant-switch')) return;
  const nearTL = Math.hypot(e.clientX, e.clientY) < Math.hypot(innerWidth - e.clientX, innerHeight - e.clientY);
  const tree = nearTL ? tl : br;
  tree.fire(`shed${Math.floor(Math.random() * 6)}`);
});
