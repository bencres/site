import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

const geo = await (await fetch('./geometry.json')).json();

document.getElementById('name').textContent = c.name;

const link = (x) => h('a', { href: x.url }, x.name ?? x.title);
const BANDS = {
  about: {
    title: 'The pith', where: 'ring 1 · the seed of it', short: 'who I am',
    body: () => [h('p', {}, h('i', {}, c.tagline)), ...c.intro.map((p) => h('p', {}, p))],
  },
  work: {
    title: 'Heartwood', where: 'rings 2–5 · oldest', short: 'work',
    body: () => [h('ul', {}, c.work.map((w) => h('li', {}, link(w), h('span', { class: 'meta' }, ` — ${w.role.toLowerCase()}, ${w.when}`))))],
  },
  projects: {
    title: 'Things I’ve made', where: 'rings 6–8', short: 'projects',
    body: () => [h('ul', {}, c.projects.map((p) => h('li', {}, link(p), h('span', { class: 'meta' }, ` — ${p.blurb}`))))],
  },
  writing: {
    title: 'Writing', where: 'rings 9–11', short: 'writing',
    body: () => [h('ul', {}, c.writing.map((w) => h('li', {}, link(w), h('span', { class: 'meta' }, ` · ${w.date}`))))],
  },
  now: {
    title: 'Sapwood · now', where: `rings 12–14 · ${c.now.updated}`, short: 'now',
    body: () => [h('ul', {}, c.now.items.map((t) => h('li', {}, t)))],
  },
  elsewhere: {
    title: 'The bark', where: 'facing outward', short: 'elsewhere',
    body: () => [
      h('p', {}, c.elsewhere.flatMap((e, i) => [i ? ' · ' : '', link(e)])),
      h('p', {}, 'Write to me: ', h('a', { href: `mailto:${c.email}` }, c.email)),
    ],
  },
};
const order = geo.bands.map((b) => b.id);

// ---------- labels around the slice, keyed with plate letters
const labelEls = {};
for (const l of geo.labels) {
  const el = h('span', { class: `label ${l.side}` }, h('b', {}, `${l.letter}.`), l.label);
  el.style.left = `${l.x * 100}%`;
  el.style.top = `${l.y * 100}%`;
  document.getElementById('labels').append(el);
  labelEls[l.id] = el;
}

// ---------- key (the keyboard path to every band)
const keyBtns = {};
const key = document.getElementById('key');
for (const l of geo.labels) {
  const b = h('button', { type: 'button', 'aria-pressed': 'false', 'aria-controls': 'card' }, h('i', {}, `${l.letter}.`), BANDS[l.id].title, h('small', {}, BANDS[l.id].short));
  b.addEventListener('pointerenter', () => setHover(l.id));
  b.addEventListener('pointerleave', () => setHover(null));
  b.addEventListener('focus', () => setHover(l.id));
  b.addEventListener('blur', () => setHover(null));
  b.addEventListener('click', () => select(l.id));
  keyBtns[l.id] = b;
  key.append(h('li', {}, b));
}

// ---------- the slice
const canvas = document.getElementById('slice');
const slice = mount(canvas, {
  src: 'rings',
  onLoad: () => {
    if (reducedMotion) slice.set('still', true);
    paint();
  },
});

let hovered = null;
let selected = null;
function paint() {
  for (const id of order) {
    const on = id === hovered || id === selected;
    slice.set(`hl_${id}`, on);
    labelEls[id]?.classList.toggle('on', on);
    keyBtns[id]?.classList.toggle('on', id === hovered);
  }
}
function setHover(id) {
  if (id === hovered) return;
  hovered = id;
  paint();
}

const card = document.getElementById('card');
function renderCard(id) {
  card.replaceChildren();
  if (!id) {
    card.append(
      h('header', {}, h('h3', {}, 'How to read this'), h('span', {}, 'no. 1')),
      h('p', {}, 'Each ring is a year. The middle is where I started; the pale outer rings are now.'),
      h('p', { class: 'hint' }, 'hover a ring, then click to read it ↓'),
    );
  } else {
    const b = BANDS[id];
    const l = geo.labels.find((x) => x.id === id);
    card.append(h('header', {}, h('h3', {}, `${l.letter}. ${b.title}`), h('span', {}, b.where)), ...b.body());
  }
  card.classList.remove('fresh');
  void card.offsetWidth;
  card.classList.add('fresh');
}
function select(id) {
  selected = selected === id ? null : id;
  for (const k of order) keyBtns[k].setAttribute('aria-pressed', String(k === selected));
  renderCard(selected);
  paint();
}
renderCard(null);

// ---------- hit-test the pointer against the same ring geometry the scene was drawn from
const shape = (th) => 1 + geo.harmonics.reduce((s, k) => s + k.a * Math.sin(k.k * th + k.p), 0);
function bandAt(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = ((clientX - r.left) / r.width) * geo.size;
  const y = ((clientY - r.top) / r.height) * geo.size;
  for (const b of geo.bands) {
    const t = Math.min(b.t, 1);
    const cx = geo.center.x + geo.pith.x * (1 - t);
    const cy = geo.center.y + geo.pith.y * (1 - t);
    const th = Math.atan2(y - cy, x - cx);
    if (Math.hypot(x - cx, y - cy) <= b.t * geo.R * shape(th)) return b.id;
  }
  return null;
}
canvas.addEventListener('pointermove', (e) => {
  const id = bandAt(e.clientX, e.clientY);
  canvas.classList.toggle('over-band', !!id);
  setHover(id);
});
canvas.addEventListener('pointerleave', () => {
  canvas.classList.remove('over-band');
  setHover(null);
});
canvas.addEventListener('click', (e) => {
  const id = bandAt(e.clientX, e.clientY);
  if (id) select(id);
});
