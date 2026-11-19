import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

document.getElementById('name').textContent = c.name;
document.getElementById('tagline').textContent = c.tagline;
document.getElementById('intro').append(...c.intro.map((p) => h('p', {}, p)));

const link = (x) => h('a', { href: x.url }, x.name ?? x.title);

// one section per lit window; keys match the inputs/events in rive/nook/gen.mjs
const SECTIONS = [
  { key: 'now', title: 'Now', aside: c.now.updated, win: 'arch', body: () => h('ul', { class: 'dash' }, c.now.items.map((t) => h('li', {}, t))) },
  { key: 'work', title: 'Work', body: () => h('ul', { class: 'dash' }, c.work.map((w) => h('li', {}, link(w), h('span', { class: 'meta' }, `, ${w.role.toLowerCase()}`), h('span', { class: 'date' }, w.when)))) },
  { key: 'projects', title: 'Things I’ve made', body: () => h('ul', { class: 'dash' }, c.projects.map((p) => h('li', {}, link(p), h('span', { class: 'meta' }, ` — ${p.blurb}`)))) },
  { key: 'writing', title: 'Writing', body: () => h('ul', { class: 'dash' }, c.writing.map((w) => h('li', {}, link(w), w.starred ? h('span', { class: 'star', title: 'a favourite' }, '✶') : null, h('span', { class: 'date' }, w.date.toLowerCase())))) },
  { key: 'elsewhere', title: 'Elsewhere', body: () => h('p', { class: 'inline-links' }, c.elsewhere.map(link)) },
  { key: 'hello', title: 'Say hi', win: 'door', body: () => [h('p', {}, 'The door’s open. Write to me at ', h('a', { href: `mailto:${c.email}` }, c.email), '.'), h('p', { class: 'aside' }, 'or just knock on the glass')] },
];

const root = document.getElementById('sections');
const sections = {};
for (const s of SECTIONS) {
  const el = h('section', { id: s.key, 'aria-labelledby': `${s.key}-h` },
    h('span', { class: `win ${s.win || ''}`, 'aria-hidden': 'true' }),
    h('h2', { id: `${s.key}-h` }, s.title, s.aside ? h('small', {}, s.aside) : null),
    s.body(),
  );
  root.append(el);
  sections[s.key] = el;
  // hovering (or tabbing into) a section warms its window in the painting
  el.addEventListener('pointerenter', () => art.set(`warm_${s.key}`, true));
  el.addEventListener('pointerleave', () => art.set(`warm_${s.key}`, false));
  el.addEventListener('focusin', () => art.set(`warm_${s.key}`, true));
  el.addEventListener('focusout', () => art.set(`warm_${s.key}`, false));
}

const hint = document.getElementById('hint');
const cap = document.getElementById('cap');
let hintTimer = 0;
const say = (text, ms = 2600) => {
  hint.textContent = text;
  hint.classList.add('say');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    hint.textContent = HINT;
    hint.classList.remove('say');
  }, ms);
};
const HINT = hint.textContent;
const LABEL = Object.fromEntries(SECTIONS.map((s) => [s.key, s.title.toLowerCase()]));

let litTimer = 0;
const art = mount(document.getElementById('art'), {
  src: 'nook', artboard: 'House',
  onEvent: (name) => {
    const [kind, key] = name.split(':');
    const sec = sections[key];
    if (kind === 'in' && sec) {
      sec.classList.add('lit');
      cap.textContent = LABEL[key];
    } else if (kind === 'out' && sec) {
      sec.classList.remove('lit');
      cap.textContent = CAP;
    } else if (kind === 'go' && sec) {
      sec.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      sec.classList.add('lit');
      clearTimeout(litTimer);
      litTimer = setTimeout(() => sec.classList.remove('lit'), 2200);
    } else if (name === 'cat') {
      say(['Maud blinks at you.', 'Maud is not impressed.', 'Maud flicks her tail.', 'Maud says: mrrp.'][Math.floor(Math.random() * 4)]);
    } else if (name === 'lamp') {
      lampOn = !lampOn;
      document.documentElement.classList.toggle('lamp-off', !lampOn);
      say(lampOn ? 'there we go.' : 'the lamp goes out. the windows keep you company.');
    }
  },
});
const CAP = cap.textContent;
let lampOn = true;

// reduced motion pauses canvases early; let the lamps come on first
if (reducedMotion) {
  setTimeout(() => art.rive.play(), 1700);
  setTimeout(() => art.rive.pause(), 8200);
}
