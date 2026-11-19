import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

document.getElementById('name').textContent = c.name;
document.getElementById('tagline').textContent = 'sketches, software & small things';

// each note points at a part of the building; positions are artboard coords (1200 x 1000)
// and must match LEADERS in rive/harbor/gen.mjs
const NOTES = [
  { key: 'writing', part: 'window', label: 'writing', at: [812, 300], side: 'right', tilt: -3, wash: '#f4c430' },
  { key: 'now', part: 'lantern', label: 'now', at: [1092, 352], side: 'right', tilt: 2, wash: '#e9d23c' },
  { key: 'projects', part: 'boat', label: 'things I’ve made', at: [1040, 820], side: 'right', tilt: -2, wash: '#d23a3a' },
  { key: 'elsewhere', part: 'gull', label: 'elsewhere', at: [300, 128], side: 'left', tilt: -4, wash: '#3e8fcb' },
  { key: 'hello', part: 'door', label: 'say hi', at: [250, 470], side: 'left', tilt: 1, wash: '#c2452d' },
];

const link = (x) => h('a', { href: x.url }, x.name ?? x.title);
const CARDS = {
  writing: () => ['writing', h('ul', {}, c.writing.map((w) => h('li', {}, link(w), h('span', { class: 'meta' }, ` · ${w.date}`))))],
  now: () => [`now`, h('ul', {}, c.now.items.map((t) => h('li', {}, t))), h('p', { class: 'meta' }, `updated ${c.now.updated}`)],
  projects: () => ['things I’ve made', h('ul', {}, c.projects.map((p) => h('li', {}, link(p), h('span', { class: 'meta' }, ` — ${p.blurb}`))))],
  elsewhere: () => ['elsewhere', h('ul', {}, c.elsewhere.map((e) => h('li', {}, link(e))))],
  hello: () => [
    'say hi',
    h('p', {}, c.intro[0]),
    h('p', {}, 'Write to me at ', h('a', { href: `mailto:${c.email}` }, c.email), '.'),
    h('ul', {}, c.work.map((w) => h('li', {}, link(w), h('span', { class: 'meta' }, ` — ${w.role.toLowerCase()}, ${w.when}`)))),
  ],
};

const art = mount(document.getElementById('art'), { src: 'harbor', artboard: 'Sketch', onEvent: (name) => name.startsWith('open:') && open(name.slice(5)) });
const wide = matchMedia('(min-width: 761px)');
if (wide.matches) mount(document.getElementById('leaders'), { src: 'harbor', artboard: 'Leaders' });

// the reduced-motion default freezes canvases early; let the sketch finish drawing first
if (reducedMotion) {
  setTimeout(() => art.rive.play(), 1700);
  setTimeout(() => art.rive.pause(), 9000);
}

const notes = document.getElementById('notes');
const byKey = {};
for (const n of NOTES) {
  const b = h('button', { class: `note ${n.side}`, type: 'button', style: `left:${(n.at[0] / 12).toFixed(2)}%;top:${(n.at[1] / 10).toFixed(2)}%;--tilt:${n.tilt}deg;--wash:${n.wash}` }, n.label);
  const on = () => art.set(`hl_${n.part}`, true);
  const off = () => art.set(`hl_${n.part}`, false);
  b.addEventListener('pointerenter', on);
  b.addEventListener('pointerleave', off);
  b.addEventListener('focus', on);
  b.addEventListener('blur', off);
  b.addEventListener('click', () => open(n.key));
  notes.append(b);
  byKey[n.key] = { ...n, el: b };
}
// notes appear one by one as their leader lines finish drawing
NOTES.forEach((n, i) => setTimeout(() => byKey[n.key].el.classList.add('in'), reducedMotion ? 0 : 7600 + i * 230));

const card = document.getElementById('card');
const title = document.getElementById('card-title');
const body = document.getElementById('card-body');
let current = null;
function open(key) {
  if (!CARDS[key]) return;
  if (current === key && !card.hidden) return close();
  const [t, ...kids] = CARDS[key]();
  title.replaceChildren(h('span', { class: 'dot', style: `--wash:${byKey[key].wash}` }), t);
  body.replaceChildren(...kids);
  card.hidden = false;
  current = key;
  for (const n of NOTES) n.el?.classList.remove('lit');
  byKey[key].el.classList.add('lit');
}
function close() {
  card.hidden = true;
  byKey[current]?.el.classList.remove('lit');
  current = null;
}
document.getElementById('close').addEventListener('click', close);
addEventListener('keydown', (e) => e.key === 'Escape' && close());
addEventListener('pointerdown', (e) => {
  if (!card.hidden && !card.contains(e.target) && !e.target.closest('.note') && e.target.id !== 'art') close();
});
