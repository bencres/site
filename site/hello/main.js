import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

// ---------- static copy ----------
document.querySelectorAll('[data-c="name"]').forEach((n) => (n.textContent = c.name));
document.querySelector('[data-c="intro"]').append(...c.intro.map((p) => h('p', {}, p)));
const mail = document.querySelector('[data-c="mail"]');
mail.textContent = c.email;
mail.href = `mailto:${c.email}`;

// ---------- the character ----------
const canvas = document.getElementById('me');
const me = mount(canvas, { src: 'hello', onLoad: () => setTimeout(() => react('wave'), 700) });

// where the face sits inside the 420×480 artboard
const FACE = { x: 196 / 420, y: 205 / 480 };
const look = { x: 0, y: 0, tx: 0, ty: 0 };
let lastMove = 0;

function aimAt(px, py) {
  const r = canvas.getBoundingClientRect();
  const fx = r.left + r.width * FACE.x;
  const fy = r.top + r.height * FACE.y;
  look.tx = clamp(((px - fx) / Math.max(260, r.width * 0.9)) * 100);
  look.ty = clamp(((py - fy) / Math.max(240, r.height * 0.7)) * 100);
  lastMove = performance.now();
}
const clamp = (v) => Math.max(-100, Math.min(100, v));
addEventListener('pointermove', (e) => aimAt(e.clientX, e.clientY), { passive: true });
addEventListener('pointerdown', (e) => aimAt(e.clientX, e.clientY), { passive: true });

// when nobody is moving the mouse, he glances around on his own
let nextGlance = 0;
function tick(t) {
  if (t - lastMove > 4500 && t > nextGlance) {
    const glances = [[0, 8], [-55, 20], [40, -10], [70, 35], [0, 0], [-30, -25]];
    [look.tx, look.ty] = glances[Math.floor(Math.random() * glances.length)];
    nextGlance = t + 2200 + Math.random() * 3200;
  }
  look.x += (look.tx - look.x) * 0.09;
  look.y += (look.ty - look.y) * 0.09;
  me.set('lookX', look.x);
  me.set('lookY', look.y);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function react(name) {
  if (reducedMotion) {
    me.rive.play();
    clearTimeout(react.t);
    react.t = setTimeout(() => me.rive.pause(), 2800);
  }
  me.fire(name);
}

// ---------- the conversation ----------
const link = (item, label) => h('a', { href: item.url }, label ?? item.name ?? item.title);

const questions = [
  {
    q: 'what are you up to?',
    mood: 'nod',
    a: () => [
      h('p', {}, 'Right now, mostly this:'),
      h('ul', {}, c.now.items.map((i) => h('li', {}, i))),
      h('p', { class: 'meta' }, `(updated ${c.now.updated})`),
    ],
  },
  {
    q: 'what have you made?',
    mood: 'think',
    a: () => [
      h('p', {}, 'Hmm. A few things I still like:'),
      h('ul', {}, c.projects.map((p) => h('li', {}, link(p), ` — ${p.blurb}`))),
    ],
  },
  {
    q: 'what do you write about?',
    mood: 'think',
    a: () => [
      h('p', {}, 'Making things by hand, mostly. And software that takes its time.'),
      h('ul', {}, c.writing.map((w) => h('li', {}, link(w, w.title), ' ', h('span', { class: 'meta' }, `(${w.date})`), w.starred ? h('span', { class: 'star', title: 'a favorite' }, ' ★') : null))),
    ],
  },
  {
    q: 'where have you worked?',
    mood: 'nod',
    a: () => [
      h('ul', {}, c.work.map((w) => h('li', {}, link(w), ` — ${w.role} `, h('span', { class: 'meta' }, `(${w.when})`)))),
    ],
  },
  {
    q: 'where else can I find you?',
    mood: 'wave',
    a: () => [h('p', {}, 'Around! ', ...c.elsewhere.flatMap((e, i) => [i ? ' · ' : '', link(e)]))],
  },
  {
    q: 'how do I say hi?',
    mood: 'laugh',
    a: () => [
      h('p', {}, 'You just did. But for real: ', h('a', { href: `mailto:${c.email}` }, c.email), '.'),
      h('p', {}, 'I read everything, and I usually write back.'),
    ],
  },
];

const chips = document.querySelector('.chips');
const log = document.querySelector('.log');

for (const item of questions) {
  const chip = h('button', { class: 'chip', type: 'button' }, item.q);
  chip.addEventListener('click', () => ask(item, chip));
  chips.append(chip);
}

function ask(item, chip) {
  chip.classList.add('asked');
  react(item.mood);
  const answer = h('div', { class: 'a' }, h('span', { class: 'typing', 'aria-label': 'thinking' }, h('i'), h('i'), h('i')));
  const turn = h('article', { class: 'turn' }, h('p', { class: 'q' }, item.q), answer);
  log.prepend(turn);
  turn.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });

  // let him finish thinking before he answers
  const wait = reducedMotion ? 0 : item.mood === 'think' ? 1500 : 650;
  setTimeout(() => {
    answer.replaceChildren(...item.a());
    answer.classList.add('reveal');
    [...answer.children].forEach((el, i) => (el.style.animationDelay = `${i * 110}ms`));
  }, wait);
}
