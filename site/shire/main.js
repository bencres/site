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
  if (hm) hours = +hm[1] + +hm[2] / 60;
  // the light keeps different hours through the year
  const dawn = [5.5, 5, 6.5, 7.25][season];
  const golden = [16.5, 17.5, 15.5, 14.5][season];
  const dusk = [18.75, 19.75, 17.5, 16.5][season];
  const night = dusk + 2.25;
  let time = hours >= night || hours < dawn ? 4 : hours >= dusk ? 3 : hours >= golden ? 2 : hours >= 10 ? 1 : 0;
  if (TIMES.includes(t)) time = TIMES.indexOf(t);
  return { season, time, elevenses: hours >= 11 && hours < 12 && !TIMES.includes(t) };
}

// third visit and after: the hill knows you (a doormat appears, the sign changes)
let visits = 0;
try {
  visits = +localStorage.getItem('shire:visits') || 0;
  if (!sessionStorage.getItem('shire:here')) {
    sessionStorage.setItem('shire:here', '1');
    localStorage.setItem('shire:visits', String(++visits));
  }
} catch {}
const regular = visits >= 3 || params.has('regular');

// ---------- watercolor swatches, painted as tiny SVGs (no canvases)

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

function blob(r, cx, cy, rx, ry, n = 12, wob = 0.15) {
  const a0 = r() * 6.28;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    const k = 1 + r.jit(wob);
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  const f = (v) => v.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

const darken = (hex, k) => hex.match(/../g).map((v) => Math.round(parseInt(v, 16) * (1 - k)).toString(16).padStart(2, '0')).join('');

function wash({ w, h: hh, color, accent, seed }) {
  const r = rng(seed);
  const body = blob(r, w / 2, hh / 2, w * 0.42, hh * 0.36, 12, 0.13);
  const inner = blob(r, w / 2 + r.jit(w * 0.06), hh / 2 + r.jit(hh * 0.05), w * 0.3, hh * 0.25, 10, 0.2);
  const bx = w * (0.28 + r() * 0.44);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${hh}' width='${w}' height='${hh}'>
<defs>
<filter id='d' x='-10%' y='-10%' width='120%' height='120%'><feTurbulence type='fractalNoise' baseFrequency='0.05' numOctaves='2' seed='${seed % 97}'/><feDisplacementMap in='SourceGraphic' scale='${(Math.min(w, hh) * 0.14).toFixed(1)}'/></filter>
<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='${seed % 89}'/><feColorMatrix values='0 0 0 0 .33 0 0 0 0 .26 0 0 0 0 .2 -3.2 0 0 0 1.55'/><feComposite in2='SourceGraphic' operator='in'/></filter>
<radialGradient id='b'><stop offset='0' stop-color='#${accent}' stop-opacity='.5'/><stop offset='1' stop-color='#${accent}' stop-opacity='0'/></radialGradient>
</defs>
<g filter='url(#d)'>
<path d='${body}' fill='#${color}' fill-opacity='.34' stroke='#${darken(color, 0.3)}' stroke-opacity='.42' stroke-width='1.3'/>
<path d='${inner}' fill='#${color}' fill-opacity='.24'/>
<ellipse cx='${bx.toFixed(1)}' cy='${(hh * 0.52).toFixed(1)}' rx='${(w * 0.2).toFixed(1)}' ry='${(hh * 0.3).toFixed(1)}' fill='url(#b)'/>
<path d='${body}' filter='url(#g)' opacity='.4'/>
</g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// each room has its own pigment; the season shifts the box of paints
const PIGMENTS = {
  spring: [['E9B93A', 'A6C864'], ['8DBA5E', 'E79CB2'], ['E79CB2', 'E9B93A'], ['86B8DA', 'A6C864'], ['A89CD6', 'E79CB2']],
  summer: [['E9B93A', 'D9738A'], ['5F9447', 'E9B93A'], ['C8643B', 'E9B93A'], ['6FA8D6', '5F9447'], ['8E86C9', 'D9738A']],
  autumn: [['E3A23A', 'C4503B'], ['8E9A48', 'D9A93F'], ['C4503B', 'E3A23A'], ['8AA8C0', 'D9A93F'], ['A0708A', 'C4503B']],
  winter: [['E2B85A', 'B5644A'], ['7E9A88', 'A9C0D6'], ['B5644A', 'E2B85A'], ['8FA7C4', 'C9D6E2'], ['9C8FB4', 'A9C0D6']],
};
const NAME_WASH = { morning: ['F2C66B', 'F2B98A'], day: ['F2C451', 'E9B93A'], afternoon: ['E9A940', 'E8993A'], dusk: ['E9A043', 'C99AB6'], night: ['F5C451', 'E9A646'] };

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
  { id: 'now', title: 'Now', room: 'by the fire', note: `updated ${c.now.updated}`, items: c.now.items.map((t) => item(t)) },
  {
    id: 'work', title: 'Work', room: 'the study',
    items: c.work.map((w) => item(h('a', { href: w.url }, w.name), ', ', w.role, ' ', h('span', { class: 'when' }, w.when))),
  },
  { id: 'projects', title: 'Projects', room: 'the workshop', items: c.projects.map((p) => item(h('a', { href: p.url }, p.name), `: ${p.blurb}`)) },
  {
    id: 'writing', title: 'Writing', room: 'the bookshelves',
    items: c.writing.map((w) => item(h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'A favorite' }, ' ✦') : null, ' ', h('span', { class: 'when' }, w.date))),
  },
  { id: 'elsewhere', title: 'Elsewhere', room: 'out the back gate', items: c.elsewhere.map((l) => item(h('a', { href: l.url }, l.name))), inline: true },
];
const host = $('#rooms');
rooms.forEach((rm) => {
  const heading = h('h2', { id: rm.id }, h('span', { class: 'wash', 'aria-hidden': 'true' }), h('span', { class: 'title' }, rm.title), h('span', { class: 'room' }, rm.room), rm.note ? h('small', {}, rm.note) : null);
  host.append(h('section', { class: 'room-block', 'aria-labelledby': rm.id }, heading, h('ul', { class: rm.inline ? 'knobs inline' : 'knobs' }, rm.items)));
});

// ---------- season & hour on the page: paper warmth, pigments, the sign

const SIGN = {
  morning: 'Good morning! (In whichever sense you mean it.)',
  day: 'Do come in. Mind the step.',
  afternoon: 'Do come in. The bench gets the afternoon sun.',
  dusk: 'The lamps are lit. Do come in.',
  night: 'Late caller? Come in quietly.',
};
const WORD = { morning: 'morning', day: 'day', afternoon: 'afternoon', dusk: 'evening', night: 'night' };

let state = null;
function paint(next) {
  const season = SEASONS[next.season], time = TIMES[next.time];
  const root = document.documentElement;
  root.dataset.season = season;
  root.dataset.time = time;
  let sign = SIGN[time];
  if (next.elevenses && time === 'day') sign = 'Do come in. It is nearly elevenses.';
  if (season === 'winter' && (time === 'day' || time === 'afternoon')) sign = 'Knock the snow off your boots and come in.';
  if (regular) sign = 'Oh, it’s you again. You know the way in.';
  $('#sign').textContent = sign;
  $('#painted').textContent = `Painted for ${season === 'autumn' ? 'an' : 'a'} ${season} ${WORD[time]}, a little crookedly.`;
  const [nc, na] = NAME_WASH[time];
  $('.name .wash').style.backgroundImage = wash({ w: 220, h: 60, color: nc, accent: na, seed: 11 });
  document.querySelectorAll('.room-block .wash').forEach((el, i) => {
    const [col, acc] = PIGMENTS[season][i % 5];
    el.style.backgroundImage = wash({ w: 150, h: 64, color: col, accent: acc, seed: 101 + i * 37 });
  });
}

state = when();
paint(state);

// ---------- rive

const setAll = (m) => {
  m.set('season', state.season);
  m.set('time', state.time);
  if (reducedMotion) m.set('still', true);
};
const hill = mount($('#hill'), {
  src: 'shire', artboard: 'Hill', fit: 'contain',
  onLoad: () => { setAll(hill); hill.set('regular', regular); },
});
const gate = mount($('#gate'), { src: 'shire', artboard: 'Gate', fit: 'contain', onLoad: () => setAll(gate) });

// look at the clock again every few minutes; the hill cross-fades if the hour turned
if (!overridden) {
  setInterval(() => {
    const next = when();
    if (next.season === state.season && next.time === state.time && next.elevenses === state.elevenses) return;
    state = next;
    paint(state);
    for (const m of [hill, gate]) { m.set('season', state.season); m.set('time', state.time); }
  }, 5 * 60 * 1000);
}

// email links raise the mailbox flags
for (const a of [hello, post]) {
  const raise = () => { hill.fire('post'); gate.fire('post'); };
  a.addEventListener('mouseenter', raise);
  a.addEventListener('focus', raise);
}

// k knocks on the door, for anyone not pointing
document.addEventListener('keydown', (e) => {
  if (e.key === 'k' && !e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement === document.body) hill.fire('knock');
});

// the gate swings shut behind you when you reach the bottom
new IntersectionObserver((entries, io) => {
  if (entries.some((e) => e.isIntersecting)) {
    setTimeout(() => gate.fire('close'), 350);
    io.disconnect();
  }
}, { threshold: 0.6 }).observe($('.gate'));

// left alone for a while, the hill gets on with its day
if (!reducedMotion) {
  const idle = ['puff', 'gust', 'glint', 'puff', 'rustle'];
  let n = 0, timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { hill.fire(idle[n++ % idle.length]); arm(); }, 30000);
  };
  for (const ev of ['pointermove', 'scroll', 'keydown']) addEventListener(ev, arm, { passive: true });
  arm();
}

// ---------- washes bloom behind each heading the first time it reaches the screen

$('.porch').classList.add('bloomed');
const blocks = [...document.querySelectorAll('.room-block')];
if (reducedMotion) blocks.forEach((b) => b.classList.add('bloomed'));
else {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      // anything above it bloomed too, even after a fast fling
      const i = blocks.indexOf(e.target);
      blocks.slice(0, i + 1).forEach((b) => { if (!b.classList.contains('bloomed')) { b.classList.add('bloomed'); io.unobserve(b); } });
    }
  }, { rootMargin: '0px 0px -12% 0px' });
  blocks.forEach((b) => io.observe(b));
}
