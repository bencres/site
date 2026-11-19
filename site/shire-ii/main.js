import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';
import { rng, blob, arm, upright, splotch, flick, hatch, drip } from './paint.js';

const $ = (s) => document.querySelector(s);
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TIMES = ['morning', 'day', 'afternoon', 'dusk', 'night'];

// ---------- when is it? picked from the visitor's clock, or ?season=&time= / ?day=MM-DD&time=HH:MM

const params = new URLSearchParams(location.search);

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

// third visit and after: the hill knows you (a doormat appears, the sign changes,
// and the arm you took last time has a tick inked beside it)
let visits = 0, lastArm = null;
try {
  visits = +localStorage.getItem('shire-ii:visits') || 0;
  lastArm = localStorage.getItem('shire-ii:arm');
  if (!sessionStorage.getItem('shire-ii:here')) {
    sessionStorage.setItem('shire-ii:here', '1');
    localStorage.setItem('shire-ii:visits', String(++visits));
  }
} catch {}
const regular = visits >= 3 || params.has('regular') || params.has('returning');

// ---------- watercolor swatches, painted as tiny SVGs (no canvases)

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
  { id: 'now', title: 'Now', room: 'by the fire', react: 'puff', note: `updated ${c.now.updated}`, items: c.now.items.map((t) => item(t)) },
  {
    id: 'work', title: 'Work', room: 'the study', react: 'glint',
    items: c.work.map((w) => item(h('a', { href: w.url }, w.name), ', ', w.role, ' ', h('span', { class: 'when' }, w.when))),
  },
  { id: 'projects', title: 'Projects', room: 'the workshop', react: 'shine', items: c.projects.map((p) => item(h('a', { href: p.url }, p.name), `: ${p.blurb}`)) },
  {
    id: 'writing', title: 'Writing', room: 'the bookshelves', react: 'rustle',
    items: c.writing.map((w) => item(h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'A favorite' }, ' ✦') : null, ' ', h('span', { class: 'when' }, w.date))),
  },
  { id: 'elsewhere', title: 'Elsewhere', room: 'out the back gate', arm: 'yonder', react: 'gust', items: c.elsewhere.map((l) => item(h('a', { href: l.url }, l.name))), inline: true },
];
const host = $('#rooms');
rooms.forEach((rm) => {
  const heading = h('h2', { id: rm.id }, h('span', { class: 'wash', 'aria-hidden': 'true' }), h('span', { class: 'title' }, rm.title), h('span', { class: 'room' }, rm.room), rm.note ? h('small', {}, rm.note) : null);
  host.append(h('section', { class: 'room-block', 'aria-labelledby': rm.id }, heading, h('ul', { class: rm.inline ? 'knobs inline' : 'knobs' }, rm.items)));
});

// ---------- the signpost at the verge: an arm for each room, and one for the post

const ARMS = [
  ...rooms.map((rm) => ({ id: rm.id, title: rm.title, sub: rm.arm || rm.room, react: rm.react, dir: rm.id === 'elsewhere' ? 'l' : 'r' })),
  { id: 'callers', title: 'Post', sub: 'at the gate', react: 'post', dir: 'r' },
];
const TILT = [-2.2, 1.6, -1.1, 2.2, -2.6, 5.5];
// on a phone the post stands at the left edge of the painting, so every arm points right
const phone = matchMedia('(max-width: 600px)');
const dirOf = (i) => (phone.matches ? 'r' : ARMS[i].dir);
const signpost = $('#signpost');
const foot = h('span', { class: 'upright', 'aria-hidden': 'true' });
foot.innerHTML = upright({ w: 26, h: 262, seed: 7 });
signpost.append(foot);
const arms = ARMS.map((a, i) => {
  const link = h('a', { href: `#${a.id}`, class: `arm ${dirOf(i)}`, style: `--i:${i}; --tilt:${TILT[i]}deg` }, h('b', {}, a.title), ' ', h('small', {}, a.sub));
  link.addEventListener('animationend', () => link.classList.add('settled'), { once: true });
  signpost.append(link);
  return link;
});
const back = $('#back');

// regulars find a tick inked beside the arm they took last time
if (regular && lastArm) {
  const i = ARMS.findIndex((a) => a.id === lastArm);
  if (i >= 0) arms[i].append(h('span', { class: 'tick', 'aria-hidden': 'true', title: 'Your way, last time' }), h('span', { class: 'visually-hidden' }, ' (your way last time)'));
}

// each arm is painted to its own length, so the ink keeps its weight
const ARM_TINT = (season, i) => (i < 5 ? PIGMENTS[season][i][0] : 'C0603E');
function paintArms(season) {
  const at = (el) => (el.offsetHeight ? (el.offsetWidth / el.offsetHeight) * 40 : 200);
  arms.forEach((a, i) => {
    a.querySelector('svg.paint')?.remove();
    a.insertAdjacentHTML('afterbegin', arm({ w: at(a), dir: dirOf(i), tint: ARM_TINT(SEASONS[season], i), seed: 31 + i * 7 }));
  });
  back.querySelector('svg.paint')?.remove();
  back.insertAdjacentHTML('afterbegin', arm({ w: at(back), dir: 'l', tint: PIGMENTS[SEASONS[season]][0][0], seed: 91 }));
}

// ---------- a few marks the pen left behind

const mark = (host, cls, svg = '') => {
  const m = h('span', { class: `mark ${cls}`, 'aria-hidden': 'true' });
  m.innerHTML = svg;
  host.append(m);
  return m;
};
const hillFig = $('.hill');
const heads = [...document.querySelectorAll('.room-block h2')];
mark($('#sign'), 'm-flick', flick({ seed: 9 }));
mark(heads[1], 'm-blot', splotch({ seed: 5, dir: 2.5 }));
const dripMark = mark(heads[2], 'm-drip');
mark(heads[3], 'm-hatch', hatch({ seed: 4, n: 5, cross: true }));
mark($('.colophon'), 'm-spatter', splotch({ seed: 12, dir: -0.5, size: 0.6, spatter: 10 }));

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
  $('#sign-text').textContent = sign;
  $('#painted').textContent = `Painted for ${season === 'autumn' ? 'an' : 'a'} ${season} ${WORD[time]}, a little crookedly.`;
  document.querySelectorAll('.room-block .wash').forEach((el, i) => {
    const [col, acc] = PIGMENTS[season][i % 5];
    el.style.backgroundImage = wash({ w: 150, h: 64, color: col, accent: acc, seed: 101 + i * 37 });
  });
  paintArms(next.season);
  dripMark.innerHTML = drip({ seed: 21, color: PIGMENTS[season][2][0], len: 64 });
}

state = when();
paint(state);

// ---------- rive

const setAll = (m) => {
  m.set('season', state.season);
  m.set('time', state.time);
  if (reducedMotion) m.set('still', true);
};
// on a phone the painting is cropped close around the door, and the HTML post stands in
// for the painted one at its left edge
const frame = () => (phone.matches ? ['cover', 'centerRight'] : ['contain', 'center']);
const hill = mount($('#hill'), {
  src: 'shire-ii', artboard: 'Hill', fit: frame()[0], align: frame()[1],
  onLoad: () => {
    setAll(hill);
    hill.set('regular', regular);
    hill.set('bare', phone.matches);
    plant(reducedMotion ? 0 : 1750);
  },
});
const gate = mount($('#gate'), { src: 'shire-ii', artboard: 'Gate', fit: 'contain', onLoad: () => setAll(gate) });
phone.addEventListener('change', () => {
  hill.set('bare', phone.matches);
  hill.setLayout(...frame());
  arms.forEach((a, i) => { a.classList.toggle('l', dirOf(i) === 'l'); a.classList.toggle('r', dirOf(i) === 'r'); });
  paintArms(state.season);
});

// the arms go up once the post is inked in (or anyway, if the painting never loads)
let planted = false;
function plant(delay) {
  if (planted) return;
  planted = true;
  setTimeout(() => {
    signpost.classList.add('planted');
    setTimeout(() => hillFig.classList.add('inked'), 900);
  }, delay);
}
setTimeout(() => plant(0), 5000);
document.fonts?.ready.then(() => paintArms(state.season));

// an arm turned (hover or focus) stirs something on the hill; taking it re-wets that room's wash
arms.forEach((a, i) => {
  const { react, id } = ARMS[i];
  const stir = () => { hill.fire(react); if (react === 'post') gate.fire('post'); };
  a.addEventListener('mouseenter', stir);
  a.addEventListener('focus', stir);
  a.addEventListener('click', () => {
    try { localStorage.setItem('shire-ii:arm', id); } catch {}
    const block = document.getElementById(id)?.closest('.room-block');
    if (!block) return;
    block.classList.remove('called');
    void block.offsetWidth;
    block.classList.add('called', 'bloomed');
  });
});

// look at the clock again every few minutes; the hill cross-fades if the hour turned.
// A preview (the dials, or ?season= / ?time= / ?day=) holds until "back to now".
setInterval(() => {
  if (previewing || ['season', 'time', 'day'].some((k) => params.has(k))) return;
  const next = when();
  if (next.season === state.season && next.time === state.time && next.elevenses === state.elevenses) return;
  apply(next);
}, 5 * 60 * 1000);

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

// ---------- the almanac: preview the hill in any season and light.
// The painting's season and time layers switch on whole-number poses (spring = 0 ...
// winter = 3, morning = 0 ... night = 4) and cross-fade between them, so the dials
// step through those poses rather than sending in-between values the painting ignores.

let previewing = false;
const seasonDial = $('#season-dial'), timeDial = $('#time-dial');
const SEASON_WORD = ['spring', 'summer', 'autumn', 'winter'];
const TIME_WORD = ['morning', 'midday', 'afternoon', 'dusk', 'night'];
function showDials({ season, time }) {
  seasonDial.value = season;
  timeDial.value = time;
  $('#season-word').textContent = SEASON_WORD[season];
  $('#time-word').textContent = TIME_WORD[time];
  seasonDial.setAttribute('aria-valuetext', SEASON_WORD[season]);
  timeDial.setAttribute('aria-valuetext', TIME_WORD[time]);
}
function apply(next) {
  state = next;
  paint(state);
  for (const m of [hill, gate]) { m.set('season', state.season); m.set('time', state.time); }
  showDials(state);
}
function scrub() {
  const next = { season: +seasonDial.value, time: +timeDial.value, elevenses: false };
  previewing = true;
  $('#almanac').classList.add('moved');
  if (next.season === state.season && next.time === state.time) return;
  apply(next);
  const q = new URLSearchParams(location.search);
  q.set('season', SEASONS[next.season]);
  q.set('time', TIMES[next.time]);
  history.replaceState(null, '', `?${q}`);
}
seasonDial.addEventListener('input', scrub);
timeDial.addEventListener('input', scrub);
$('#almanac-now').addEventListener('click', () => {
  previewing = false;
  for (const k of ['season', 'time', 'day']) params.delete(k);
  history.replaceState(null, '', location.pathname);
  apply(when());
  $('#almanac').classList.remove('moved');
});
showDials(state);
// on a phone the almanac folds away until asked for, so it never sits on the text
if (phone.matches) $('#almanac-box').open = false;
