import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

// each object on the desk, the section it opens, and how it's captioned
const OBJECTS = {
  about: { label: 'business card', section: 'about', caption: 'a business card — who I am' },
  writing: { label: 'notebook', section: 'writing', caption: 'the notebook — things I’ve written' },
  now: { label: 'coffee', section: 'now', caption: 'a mug of coffee — what I’m up to now' },
  projects: { label: 'graph paper', section: 'projects', caption: 'graph paper — things I’ve built' },
  elsewhere: { label: 'photos', section: 'elsewhere', caption: 'some photos — me, elsewhere' },
  contact: { label: 'envelope', section: 'say hello', caption: 'an envelope — write to me' },
  plant: { caption: 'a plant. it’s doing its best' },
  pencil: { caption: 'a pencil, slightly chewed' },
};
const DEFAULT_CAPTION = 'everything here is on my desk — pick something up';

document.title = `${c.name} — on my desk`;
document.getElementById('name').textContent = c.name;
document.getElementById('tagline').textContent = c.intro[0];
document.getElementById('foot').textContent = `© ${new Date().getFullYear()} ${c.name} · drawn by hand, animated with Rive`;

const caption = document.getElementById('caption');
const canvas = document.getElementById('desk');
const setCaption = (key) => {
  const o = key && OBJECTS[key];
  caption.textContent = o ? o.caption : DEFAULT_CAPTION;
};
setCaption();

// ---------- Rive ----------
const desk = mount(canvas, {
  src: 'desk',
  fit: 'contain',
  onEvent(name) {
    const [kind, key] = name.split(':');
    if (kind === 'hover') {
      setCaption(key);
      canvas.style.cursor = OBJECTS[key]?.section ? 'pointer' : 'grab';
      tagFor(key)?.classList.add('is-lit');
    } else if (kind === 'leave') {
      setCaption();
      canvas.style.cursor = '';
      tagFor(key)?.classList.remove('is-lit');
    } else if (kind === 'open') {
      openSheet(key, canvas);
    }
  },
});

// ---------- tags (keyboard + small screens) ----------
const tags = document.getElementById('tags');
const tagFor = (key) => tags.querySelector(`[data-key="${key}"]`);
Object.entries(OBJECTS)
  .filter(([, o]) => o.section)
  .forEach(([key, o], i) => {
    const btn = h('button', { class: 'tag', type: 'button', 'data-key': key, style: `--tilt:${[-2, 1.5, -1, 2, -1.5, 1][i % 6]}deg` }, o.label, h('small', {}, o.section));
    const lift = (on) => {
      desk.set(`hover_${key}`, on);
      if (on) desk.fire(`wiggle_${key}`);
      setCaption(on ? key : null);
    };
    btn.addEventListener('pointerenter', () => lift(true));
    btn.addEventListener('pointerleave', () => lift(false));
    btn.addEventListener('focus', () => lift(true));
    btn.addEventListener('blur', () => lift(false));
    btn.addEventListener('click', () => openSheet(key, btn));
    tags.append(btn);
  });

// ---------- the sheet ----------
const wrap = document.getElementById('sheet-wrap');
const sheet = document.getElementById('sheet');
const body = document.getElementById('sheet-body');
const scrim = document.getElementById('scrim');
let returnFocus = null;

const link = (item, text) => h('a', { href: item.url }, text);

const SECTIONS = {
  about: () => [
    h('p', { class: 'kicker' }, 'hello, hi'),
    h('h2', { id: 'sheet-title' }, 'About me'),
    ...c.intro.map((p) => h('p', {}, p)),
    h('h3', {}, 'work'),
    h('ul', {}, c.work.map((w) => h('li', {}, link(w, w.name), ' ', h('span', { class: 'meta' }, `${w.role} (${w.when})`)))),
  ],
  writing: () => [
    h('p', { class: 'kicker' }, 'from the notebook'),
    h('h2', { id: 'sheet-title' }, 'Writing'),
    h('ul', {}, c.writing.map((p) => h('li', {}, link(p, p.title), p.starred ? h('span', { class: 'star', title: 'a favorite' }, '★') : null, ' ', h('span', { class: 'meta' }, `(${p.date})`)))),
  ],
  now: () => [
    h('p', { class: 'kicker' }, `updated ${c.now.updated}`),
    h('h2', { id: 'sheet-title' }, 'Now'),
    h('ul', {}, c.now.items.map((t) => h('li', {}, t))),
  ],
  projects: () => [
    h('p', { class: 'kicker' }, 'sketched, then built'),
    h('h2', { id: 'sheet-title' }, 'Projects'),
    h('ul', {}, c.projects.map((p) => h('li', {}, link(p, p.name), `: ${p.blurb}`))),
  ],
  elsewhere: () => [
    h('p', { class: 'kicker' }, 'off this desk'),
    h('h2', { id: 'sheet-title' }, 'Elsewhere'),
    h('ul', {}, c.elsewhere.map((e) => h('li', {}, link(e, e.name)))),
  ],
  contact: () => [
    h('p', { class: 'kicker' }, 'sealed with wax'),
    h('h2', { id: 'sheet-title' }, 'Say hello'),
    h('p', {}, 'I’d love to hear from you, about anything at all. Letters, links, and coffee invitations are all welcome.'),
    h('a', { class: 'mail', href: `mailto:${c.email}` }, c.email),
    h('br'),
    h('span', { class: 'signoff' }, `— ${c.short}`),
  ],
};

// a deckled, hand-torn edge, different every time the sheet comes out
function deckle() {
  const mobile = matchMedia('(max-width: 720px)').matches;
  const pts = [];
  const n = 70;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * 100;
    const d = (Math.random() * 5 + (i % 3 === 0 ? 2 : 0)).toFixed(1);
    pts.push(mobile ? `${t}% ${d}px` : `${d}px ${t}%`);
  }
  sheet.style.clipPath = mobile ? `polygon(${pts.join(',')}, 100% 100%, 0 100%)` : `polygon(${pts.join(',')}, 100% 100%, 100% 0)`;
}

function openSheet(key, from) {
  const render = SECTIONS[key];
  if (!render) return;
  returnFocus = from || document.activeElement;
  body.replaceChildren(...render());
  deckle();
  wrap.hidden = false;
  scrim.hidden = false;
  sheet.scrollTop = 0;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      wrap.classList.add('is-open');
      scrim.classList.add('is-open');
      sheet.focus({ preventScroll: true });
    })
  );
}

function closeSheet() {
  if (wrap.hidden) return;
  wrap.classList.remove('is-open');
  scrim.classList.remove('is-open');
  const done = () => {
    wrap.hidden = true;
    scrim.hidden = true;
  };
  reducedMotion ? done() : setTimeout(done, 450);
  returnFocus?.focus?.({ preventScroll: true });
}

document.getElementById('close').addEventListener('click', closeSheet);
scrim.addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
  // keep focus inside the open sheet
  if (e.key === 'Tab' && !wrap.hidden) {
    const f = [...sheet.querySelectorAll('button, a[href]')];
    if (document.activeElement === sheet) {
      e.preventDefault();
      (e.shiftKey ? f.at(-1) : f[0])?.focus();
      return;
    }
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) {
      e.preventDefault();
      f.at(-1).focus();
    } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
      e.preventDefault();
      f[0].focus();
    }
  }
});
