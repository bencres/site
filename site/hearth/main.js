import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

const $ = (s) => document.querySelector(s);
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TIMES = ['morning', 'day', 'afternoon', 'dusk', 'night'];

// ---------- when is it? picked from the visitor's clock, or ?season=&time= / ?day=MM-DD&time=HH:MM

const params = new URLSearchParams(location.search);
const overridden = ['season', 'time', 'day'].some((k) => params.has(k));

function when(now = new Date()) {
  let month = now.getMonth();
  let hours = now.getHours() + now.getMinutes() / 60;
  const day = params.get('day')?.match(/^(\d{1,2})-(\d{1,2})$/);
  if (day) month = Math.min(11, Math.max(0, +day[1] - 1));
  let season = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][month];
  if (SEASONS.includes(params.get('season'))) season = SEASONS.indexOf(params.get('season'));
  const t = params.get('time') || '';
  const hm = t.match(/^(\d{1,2}):(\d{2})$/);
  if (hm) hours = Math.min(23.99, +hm[1] + +hm[2] / 60);
  // the light keeps different hours through the year
  const dawn = [5.5, 5, 6.5, 7.25][season];
  const golden = [16.5, 17.5, 15.5, 14.5][season];
  const dusk = [18.75, 19.75, 17.5, 16.5][season];
  const night = dusk + 2.25;
  let time = hours >= night || hours < dawn ? 4 : hours >= dusk ? 3 : hours >= golden ? 2 : hours >= 10 ? 1 : 0;
  if (TIMES.includes(t)) {
    time = TIMES.indexOf(t);
    // a named time sets the mantel clock to an hour that suits it
    hours = [8.25, 12.6, golden + 0.6, dusk + 0.5, 22.5][time];
  }
  return { season, time, hours, elevenses: hours >= 11 && hours < 12 };
}

// a returning visitor finds their coat on a peg
let visits = 0;
try {
  visits = +localStorage.getItem('hearth:visits') || 0;
  if (!sessionStorage.getItem('hearth:here')) {
    sessionStorage.setItem('hearth:here', '1');
    localStorage.setItem('hearth:visits', String(++visits));
  }
} catch {}
const regular = visits >= 2 || params.has('regular');

// ---------- watercolor, painted as tiny SVGs (no canvases)

function rng(seed) {
  let a = seed >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.jit = (k) => (r() * 2 - 1) * k;
  return r;
}

const f1 = (v) => v.toFixed(1);
// a smooth (Catmull-Rom) path through points, open or closed
function smooth(pts, closed) {
  const n = pts.length;
  const at = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

function blob(r, cx, cy, rx, ry, n = 12, wob = 0.15) {
  const a0 = r() * 6.28;
  return smooth(Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    const k = 1 + r.jit(wob);
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  }), true);
}

const darken = (hex, k) => hex.match(/../g).map((v) => Math.round(parseInt(v, 16) * (1 - k)).toString(16).padStart(2, '0')).join('');

// the soft wash behind the name (a data-URI background, as in the gate draft)
function wash({ w, h: hh, color, accent, seed }) {
  const r = rng(seed);
  const body = blob(r, w / 2, hh / 2, w * 0.42, hh * 0.36, 12, 0.13);
  const inner = blob(r, w / 2 + r.jit(w * 0.06), hh / 2 + r.jit(hh * 0.05), w * 0.3, hh * 0.25, 10, 0.2);
  const bx = w * (0.28 + r() * 0.44);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${hh}' width='${w}' height='${hh}'>
<defs>
<filter id='d' x='-10%' y='-10%' width='120%' height='120%'><feTurbulence type='fractalNoise' baseFrequency='0.05' numOctaves='2' seed='${seed % 97}'/><feDisplacementMap in='SourceGraphic' scale='${(Math.min(w, hh) * 0.14).toFixed(1)}'/></filter>
<radialGradient id='b'><stop offset='0' stop-color='#${accent}' stop-opacity='.5'/><stop offset='1' stop-color='#${accent}' stop-opacity='0'/></radialGradient>
</defs>
<g filter='url(#d)'>
<path d='${body}' fill='#${color}' fill-opacity='.34' stroke='#${darken(color, 0.3)}' stroke-opacity='.42' stroke-width='1.3'/>
<path d='${inner}' fill='#${color}' fill-opacity='.24'/>
<ellipse cx='${bx.toFixed(1)}' cy='${(hh * 0.52).toFixed(1)}' rx='${(w * 0.2).toFixed(1)}' ry='${(hh * 0.3).toFixed(1)}' fill='url(#b)'/>
</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// small inked things for each room: a dab of paint, then lines that draw on
const ICONS = {
  kettle: {
    paint: ['C0703E', 20, 23, 13, 9],
    lines: [
      { pts: [[9, 31], [6, 23], [10, 16], [20, 13], [30, 16], [34, 23], [31, 31]], closed: true },
      { pts: [[8, 23], [3, 18], [1, 12]] },
      { pts: [[12, 15], [13, 7], [20, 4], [27, 7], [28, 15]] },
      { pts: [[17, 13], [20, 10], [23, 13]] },
      { pts: [[3, 9], [5, 6], [3, 3], [5, 0]] },
    ],
  },
  study: {
    paint: ['4E6E8E', 18, 27, 10, 7],
    lines: [
      { pts: [[10, 33], [9, 25], [13, 21], [23, 21], [27, 25], [26, 33]], closed: true },
      { pts: [[14, 21], [14, 17], [22, 17], [22, 21]] },
      { pts: [[18, 19], [26, 9], [37, 1]] },
      { pts: [[25, 11], [28, 4], [37, 1], [32, 8], [25, 11]] },
    ],
  },
  jar: {
    paint: ['E0A23A', 20, 23, 10, 10],
    lines: [
      { pts: [[10, 34], [9, 15], [12, 12], [28, 12], [31, 15], [30, 34]], closed: true },
      { pts: [[8, 12], [11, 5], [29, 5], [32, 12]] },
      { pts: [[10, 10], [30, 10]] },
      { pts: [[13, 20], [27, 20], [27, 27], [13, 27]], closed: true },
    ],
  },
  books: {
    paint: ['5E8A5A', 18, 22, 11, 11],
    lines: [
      { pts: [[6, 34], [6, 10], [13, 10], [13, 34]], closed: true },
      { pts: [[14, 34], [14, 6], [21, 6], [21, 34]], closed: true },
      { pts: [[23, 34], [29, 34], [36, 13], [30, 11]], closed: true },
      { pts: [[6, 15], [13, 15]] },
      { pts: [[14, 28], [21, 28]] },
    ],
  },
  window: {
    paint: ['86B8DA', 20, 18, 11, 11],
    lines: [
      { pts: Array.from({ length: 14 }, (_, i) => [20 + Math.cos((i / 14) * 6.283) * 14, 18 + Math.sin((i / 14) * 6.283) * 14]), closed: true },
      { pts: [[20, 4], [20, 32]] },
      { pts: [[6, 18], [34, 18]] },
      { pts: [[4, 35], [36, 35]] },
    ],
  },
};

function icon(name, seed) {
  const { paint: [col, cx, cy, rx, ry], lines } = ICONS[name];
  const r = rng(seed);
  const paths = lines.map((l) => {
    const pts = l.pts.map(([x, y]) => [x + r.jit(0.6), y + r.jit(0.6)]);
    return `<path pathLength='1' d='${smooth(pts, l.closed)}'/>`;
  }).join('');
  const dab = blob(r, cx + 2, cy + 2, rx, ry, 9, 0.18);
  const span = document.createElement('span');
  span.className = 'thing';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox='-2 -3 42 40' width='42' height='40'><path class='dab' d='${dab}' fill='#${col}' fill-opacity='.4' stroke='#${darken(col, 0.3)}' stroke-opacity='.35' stroke-width='1.1'/><g class='lines'>${paths}</g></svg>`;
  return span;
}

// ---------- copy

$('#name').textContent = c.name;
const intro = $('#intro');
c.intro.forEach((p) => intro.append(h('p', {}, p)));
const hello = h('a', { href: `mailto:${c.email}`, class: 'mail' }, c.email);
intro.append(h('p', {}, 'Say hello any time: ', hello, '.'));
const post = $('#post');
post.href = `mailto:${c.email}`;
post.textContent = c.email;

const item = (...kids) => h('li', {}, ...kids);
const rooms = [
  { id: 'now', title: 'Now', room: 'by the hearth', icon: 'kettle', note: `updated ${c.now.updated}`, items: c.now.items.map((t) => item(t)) },
  {
    id: 'work', title: 'Work', room: 'the study', icon: 'study',
    items: c.work.map((w) => item(h('a', { href: w.url }, w.name), ', ', w.role, ' ', h('span', { class: 'when' }, w.when))),
  },
  { id: 'projects', title: 'Projects', room: 'on the pantry shelves', icon: 'jar', items: c.projects.map((p) => item(h('a', { href: p.url }, p.name), `: ${p.blurb}`)) },
  {
    id: 'writing', title: 'Writing', room: 'the bookshelf', icon: 'books',
    items: c.writing.map((w) => item(h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'A favorite' }, ' ✦') : null, ' ', h('span', { class: 'when' }, w.date))),
  },
  { id: 'elsewhere', title: 'Elsewhere', room: 'out the round window', icon: 'window', items: c.elsewhere.map((l) => item(h('a', { href: l.url }, l.name))), inline: true },
];
const host = $('#rooms');
rooms.forEach((rm, i) => {
  const heading = h('h2', { id: rm.id }, icon(rm.icon, 31 + i * 17), h('span', { class: 'title' }, rm.title), h('span', { class: 'room' }, rm.room), rm.note ? h('small', {}, rm.note) : null);
  host.append(h('section', { class: 'room-block', 'aria-labelledby': rm.id }, heading, h('ul', { class: rm.inline ? 'pegs inline' : 'pegs' }, rm.items)));
});

// ---------- season & hour on the page: paper warmth, the note under the picture

const NOTE = {
  morning: 'Come in, come in. The kettle’s only just on.',
  day: 'Come in, come in. Mind the step.',
  afternoon: 'Come in. There’s tea in the pot.',
  dusk: 'Come in. The candles are lit.',
  night: 'Late caller? Come in by the fire.',
};
const WORD = { morning: 'morning', day: 'day', afternoon: 'afternoon', dusk: 'evening', night: 'night' };
const NAME_WASH = { morning: ['F2C66B', 'F2B98A'], day: ['F2C451', 'E9B93A'], afternoon: ['E9A940', 'E8993A'], dusk: ['E9A043', 'D98A5A'], night: ['F5B451', 'E98A46'] };

let state = null;
function paint(next) {
  const season = SEASONS[next.season], time = TIMES[next.time];
  const root = document.documentElement;
  root.dataset.season = season;
  root.dataset.time = time;
  let note = NOTE[time];
  if (next.elevenses && time === 'day') note = 'Come in. It’s nearly elevenses.';
  if (season === 'winter' && (time === 'day' || time === 'afternoon')) note = 'Come in out of the cold. There’s room by the fire.';
  if (regular) note = 'Back again? Your coat’s on its peg.';
  $('#note').textContent = note;
  const by = next.time >= 3 ? 'by firelight ' : '';
  $('#painted').textContent = `Painted ${by}on ${season === 'autumn' ? 'an' : 'a'} ${season} ${WORD[time]}, a little crookedly.`;
  const [nc, na] = NAME_WASH[time];
  $('.name .wash').style.backgroundImage = wash({ w: 220, h: 60, color: nc, accent: na, seed: 11 });
}

state = when();
paint(state);

// ---------- rive

const clock = (m, hrs) => {
  m.set('hour', hrs);
  m.set('minute', (hrs % 1) * 60);
};
const setAll = (m) => {
  m.set('season', state.season);
  m.set('time', state.time);
  if (reducedMotion) m.set('still', true);
};
const hall = mount($('#hall'), {
  src: 'hearth', artboard: 'Hall', fit: 'contain',
  onLoad: () => {
    setAll(hall);
    hall.set('regular', regular);
    clock(hall, state.hours);
  },
});
const door = mount($('#door'), { src: 'hearth', artboard: 'Door', fit: 'contain', onLoad: () => setAll(door) });

// look at the clock again every half minute: the hands move, and if the hour turned
// (or the season did) the room cross-fades
if (!overridden) {
  setInterval(() => {
    const next = when();
    clock(hall, next.hours);
    if (next.season === state.season && next.time === state.time && next.elevenses === state.elevenses) return;
    state = next;
    paint(state);
    for (const m of [hall, door]) { m.set('season', state.season); m.set('time', state.time); }
  }, 30 * 1000);
}

// email links put a letter through the door
for (const a of [hello, post]) {
  const send = () => door.fire('post');
  a.addEventListener('mouseenter', send);
  a.addEventListener('focus', send);
}

// the door opens to see you out when you reach the bottom
new IntersectionObserver((entries, io) => {
  if (entries.some((e) => e.isIntersecting)) {
    setTimeout(() => door.fire('seeout'), 300);
    io.disconnect();
  }
}, { threshold: 0.6 }).observe($('.door'));

if (!reducedMotion) {
  // linger a little and the kettle comes to the boil
  setTimeout(() => hall.set('steaming', true), 20000);
  // left alone for a while, the house gets on with its day
  const idle = ['stir', 'pop', 'rattle', 'stir', 'peek'];
  let n = 0, timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { hall.fire(idle[n++ % idle.length]); arm(); }, 30000);
  };
  for (const ev of ['pointermove', 'scroll', 'keydown']) addEventListener(ev, arm, { passive: true });
  arm();
}

// ---------- the things by each heading paint and ink themselves in as they reach the screen

$('.porch').classList.add('bloomed');
const blocks = [...document.querySelectorAll('.room-block')];
if (reducedMotion) blocks.forEach((b) => b.classList.add('bloomed'));
else {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const i = blocks.indexOf(e.target);
      blocks.slice(0, i + 1).forEach((b) => { if (!b.classList.contains('bloomed')) { b.classList.add('bloomed'); io.unobserve(b); } });
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  blocks.forEach((b) => io.observe(b));
}
