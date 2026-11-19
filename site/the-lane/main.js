import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';
import { strip, arm, board, post, rng } from './strips.js';

const $ = (s) => document.querySelector(s);
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TIMES = ['morning', 'day', 'afternoon', 'dusk', 'night'];

// ---------- when is it? the visitor's clock, or ?season=&time= / ?day=MM-DD&time=HH:MM

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
  return { season, time };
}

// second visit and after, the lane remembers you: a chalked board at the gate
let visits = 0;
try {
  visits = +localStorage.getItem('lane:visits') || 0;
  if (!sessionStorage.getItem('lane:here')) {
    sessionStorage.setItem('lane:here', '1');
    localStorage.setItem('lane:visits', String(++visits));
  }
} catch {}
const returning = visits >= 2 || params.has('returning');

// ---------- a watercolor swatch behind the name (tiny SVG, no canvas)

function blobPath(r, cx, cy, rx, ry, n = 12, wob = 0.15) {
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
function wash({ w, h: hh, color, seed }) {
  const r = rng(seed);
  const body = blobPath(r, w / 2, hh / 2, w * 0.42, hh * 0.36, 12, 0.13);
  const inner = blobPath(r, w / 2 + r.jit(w * 0.06), hh / 2 + r.jit(hh * 0.05), w * 0.3, hh * 0.25, 10, 0.2);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${hh}'><defs><filter id='d' x='-10%' y='-10%' width='120%' height='120%'><feTurbulence type='fractalNoise' baseFrequency='0.05' numOctaves='2' seed='${seed % 97}'/><feDisplacementMap in='SourceGraphic' scale='${(Math.min(w, hh) * 0.14).toFixed(1)}'/></filter></defs>
<g filter='url(#d)'><path d='${body}' fill='#${color}' fill-opacity='.34' stroke='#${color}' stroke-opacity='.5' stroke-width='1.3'/><path d='${inner}' fill='#${color}' fill-opacity='.24'/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// ---------- copy

$('#name').textContent = c.name;
$('#tagline').textContent = c.tagline;
const intro = $('#intro');
c.intro.forEach((p) => intro.append(h('p', {}, p)));
const hello = h('a', { href: `mailto:${c.email}`, class: 'mail' }, c.email);
intro.append(h('p', {}, 'Say hello any time: ', hello, '.'));
const post$ = $('#post');
post$.href = `mailto:${c.email}`;
post$.textContent = c.email;

// the stops along the lane, top to bottom; each has a painted board and a stretch of lane
const item = (...kids) => h('li', {}, ...kids);
const stops = [
  {
    id: 'now', title: 'Now', notice: 'What I’m about these days', chalk: `chalked up ${c.now.updated}`,
    arm: 'a few steps', lane: 'stile', paint: 'F2E6C8',
    items: c.now.items.map((t) => item(t)),
  },
  {
    id: 'work', title: 'Work', notice: 'Where I’ve put in the hours', arm: 'past the stile', lane: 'door', paint: 'E4E9D2',
    items: c.work.map((w) => item(h('a', { href: w.url }, w.name), ', ', w.role, ' ', h('span', { class: 'when' }, w.when))),
  },
  {
    id: 'projects', title: 'Projects', notice: 'Things I’ve built. Mind the sawdust.', arm: 'by the mill', lane: 'mill', paint: 'F2E1C4',
    items: c.projects.map((p) => item(h('a', { href: p.url }, p.name), `: ${p.blurb}`)),
  },
  {
    id: 'writing', title: 'Writing', notice: 'Notes left by the wayside. Help yourself.', arm: '½ mile', lane: 'bridge', paint: 'E6E4DA',
    items: c.writing.map((w) => item(h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'A favourite' }, ' ✦') : null, ' ', h('span', { class: 'when' }, w.date))),
  },
  {
    id: 'elsewhere', title: 'Elsewhere', notice: 'Other roads lead on from here', arm: 'over the bridge', lane: 'wall', paint: 'EFE3CF',
    items: c.elsewhere.map((l) => item(h('a', { href: l.url }, l.name))), inline: true,
  },
];

// the fingerpost at the top of the lane: one arm for each stop, pointing either way
const fp = $('#fingerpost');
fp.append(h('span', { class: 'upright', 'aria-hidden': 'true', style: `background-image:${post(7)}` }));
stops.forEach((st, i) => {
  const dir = [1, 3].includes(i) ? 'l' : 'r';
  const a = h('a', { href: `#${st.id}`, class: `arm ${dir}`, style: `--tilt:${[-2.5, 3, -1, 2.2, -3.2][i]}deg; background-image:${arm({ dir, color: st.paint, seed: 31 + i * 7 })}` },
    h('b', {}, st.title), h('small', {}, st.arm));
  a.addEventListener('animationend', () => a.classList.add('settled'), { once: true });
  fp.append(a);
});
$('#back').style.backgroundImage = arm({ dir: 'l', color: 'F2E6C8', seed: 91 });

const walk = $('#walk');
const lanes = [];
stops.forEach((st, i) => {
  const art = h('div', { class: 'strip', 'aria-hidden': 'true' });
  lanes.push({ el: art, kind: st.lane, seed: 500 + i * 31 });
  const sign = h('div', { class: 'board', style: `--tilt:${[-1.2, 0.8, -0.6, 1.1, -0.9][i]}deg; background-image:${board({ color: st.paint, seed: 61 + i * 13 })}` },
    h('h2', { id: st.id }, st.title),
    h('p', {}, st.notice),
    st.chalk ? h('small', {}, st.chalk) : null);
  walk.append(h('section', { class: 'stop', 'aria-labelledby': st.id },
    h('div', { class: 'milestone' }, art, sign),
    h('ul', { class: st.inline ? 'stones inline' : 'stones' }, st.items)));
});

// ---------- season & hour on the page

const GREETING = {
  morning: 'Good morning. Follow the signs down the lane.',
  day: 'Do come down the lane. The signs will see you right.',
  afternoon: 'A fine afternoon for it. Follow the signs down the lane.',
  dusk: 'The lamps are lit along the lane. Follow them down.',
  night: 'Late on the lane? The lamps will see you down.',
};
const WORD = { morning: 'morning', day: 'day', afternoon: 'afternoon', dusk: 'evening', night: 'night' };
const NAME_WASH = { morning: 'F2C66B', day: 'E9B93A', afternoon: 'E9A940', dusk: 'E9A043', night: 'F5C451' };

let state = when();
function paint(next) {
  const season = SEASONS[next.season], time = TIMES[next.time];
  const root = document.documentElement;
  root.dataset.season = season;
  root.dataset.time = time;
  let greet = GREETING[time];
  if (season === 'winter' && next.time < 3) greet = 'Mind the ice on the lane. Follow the signs down.';
  if (returning) greet = 'Back again? You know the way down.';
  $('#greeting').textContent = greet;
  $('#painted').textContent = `Painted for ${season === 'autumn' ? 'an' : 'a'} ${season} ${WORD[time]}, a little crookedly.`;
  $('.name .wash').style.backgroundImage = wash({ w: 220, h: 60, color: NAME_WASH[time], seed: 11 });
  for (const ln of lanes) {
    ln.el.innerHTML = strip(ln.kind, next, ln.seed);
  }
}
paint(state);

const chalk = $('#chalk');
if (returning) {
  chalk.hidden = false;
  chalk.textContent = 'welcome back!';
}

// ---------- rive

const setAll = (m) => {
  m.set('season', state.season);
  m.set('time', state.time);
  if (reducedMotion) m.set('still', true);
};
const hill = mount($('#lane'), { src: 'the-lane', artboard: 'Lane', fit: 'contain', onLoad: () => setAll(hill) });
const gate = mount($('#gate'), { src: 'the-lane', artboard: 'Gate', fit: 'contain', onLoad: () => { setAll(gate); if (arrived) gate.set('open', true); } });

// look at the clock again every few minutes, in case the hour turned
if (!overridden) {
  setInterval(() => {
    const next = when();
    if (next.season === state.season && next.time === state.time) return;
    state = next;
    paint(state);
    for (const m of [hill, gate]) { m.set('season', state.season); m.set('time', state.time); }
  }, 5 * 60 * 1000);
}

// the neighbour peeks out when you go for the email; your own door opens at the gate
hello.addEventListener('mouseenter', () => hill.fire('peek'));
hello.addEventListener('focus', () => hill.fire('peek'));
for (const ev of ['mouseenter', 'focus']) post$.addEventListener(ev, () => { gate.set('open', true); gate.fire('knock'); });

// the gate swings open as you arrive at the bottom of the lane
let arrived = false;
new IntersectionObserver((entries, io) => {
  if (entries.some((e) => e.isIntersecting)) {
    arrived = true;
    setTimeout(() => gate.set('open', true), 400);
    io.disconnect();
  }
}, { threshold: 0.55 }).observe($('.gate'));

// ---------- each stretch of lane inks itself in the first time it reaches the screen

$('.top').classList.add('bloomed');
const strips = [...document.querySelectorAll('.stop')];
if (reducedMotion) strips.forEach((b) => b.classList.add('walked'));
else {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      // anything above it is walked too, even after a fast fling
      const i = strips.indexOf(e.target);
      strips.slice(0, i + 1).forEach((b) => { if (!b.classList.contains('walked')) { b.classList.add('walked'); io.unobserve(b); } });
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  strips.forEach((b) => io.observe(b));
}
