import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

const $ = (s) => document.querySelector(s);
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TIMES = ['morning', 'day', 'afternoon', 'dusk', 'night'];

// ---------- when is it? the visitor's clock, or ?season=&time= / ?day=MM-DD&time=HH:MM

const params = new URLSearchParams(location.search);
const overridden = ['season', 'time', 'day'].some((k) => params.has(k));

function when(now = new Date()) {
  const date = new Date(now);
  let hours = now.getHours() + now.getMinutes() / 60;
  const day = params.get('day')?.match(/^(\d{1,2})-(\d{1,2})$/);
  if (day) date.setMonth(Math.min(11, Math.max(0, +day[1] - 1)), Math.min(31, Math.max(1, +day[2])));
  let season = [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][date.getMonth()];
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
  return { season, time, date, hours };
}

// returning readers get a ribbon that keeps their place
let visits = 0;
let place = null;
try {
  visits = +localStorage.getItem('manuscript:visits') || 0;
  place = localStorage.getItem('manuscript:place');
  if (!sessionStorage.getItem('manuscript:here')) {
    sessionStorage.setItem('manuscript:here', '1');
    localStorage.setItem('manuscript:visits', String(++visits));
  }
} catch {}
const returning = visits >= 2 || params.has('returning');

// ---------- a few hand-made marks, painted as tiny SVGs

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
function blobPath(r, cx, cy, rx, ry, n = 12, wob = 0.15) {
  const a0 = r() * 6.28;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2;
    const k = 1 + r.jit(wob);
    return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
  });
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d + 'Z';
}
const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// an ink blot with a few spatters
function blot(seed) {
  const r = rng(seed);
  let paths = `<path d='${blobPath(r, 30, 30, 15, 13, 14, 0.32)}'/>`;
  for (let i = 0; i < 6; i++) {
    const a = r() * 6.28, d = 20 + r() * 9;
    paths += `<circle cx='${f1(30 + Math.cos(a) * d)}' cy='${f1(30 + Math.sin(a) * d)}' r='${f1(0.8 + r() * 2)}'/>`;
  }
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'><g fill='#2a2230' fill-opacity='.82'>${paths}</g><path d='${blobPath(r, 27, 27, 6, 4, 8, 0.2)}' fill='#fff' fill-opacity='.12'/></svg>`);
}

// a hand-drawn strike for crossed-out words
function strike(seed) {
  const r = rng(seed);
  const y = () => f1(6 + r.jit(1.6));
  return svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 12' preserveAspectRatio='none'><path d='M1 ${y()} C30 ${y()} 60 ${y()} 99 ${y()}' stroke='#3a2c22' stroke-width='1.6' fill='none' stroke-linecap='round' vector-effect='non-scaling-stroke'/></svg>`);
}

// ---------- the book

$('#name').textContent = c.name;
$('#tagline').textContent = c.tagline;
$('#sig').textContent = c.short;
const post = $('#post');
post.href = `mailto:${c.email}`;
post.textContent = c.email;

const NUM = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const x = (word) => h('s', { class: 'x' }, word); // a crossed-out word
const note = (text, cls = '') => h('span', { class: `note hand ${cls}`.trim() }, text);

// work, oldest first: this is a road, and the map follows it
const chron = [...c.work].reverse();
const SPOT = { 'The Axle Group': 7, HytaleModding: 6, 'Pixel Foundry': 5, 'Multimodal Interaction Lab': 4, 'Unlimited Fries Studios': 3, 'The University of Texas at Dallas': 2 };
const workId = (w) => `w-${chron.indexOf(w)}`;
const WORK_NOTES = {
  'The Axle Group': 'here I am now',
  'Multimodal Interaction Lab': 'CHI 2026!',
  'Unlimited Fries Studios': 'I built an ocean',
};
const PROJECT_NOTES = { SensoryBlox: 'CHI 2026', vfxdirs: 'still being written, like this book' };

const chapters = [
  {
    id: 'hello', name: 'Hello', which: ['in which I introduce myself'],
    body: () => [
      ...c.intro.map((p, i) => h('p', { class: i === 0 ? 'opening' : null }, p)),
      h('p', {}, 'Say hello any time: ', h('a', { href: `mailto:${c.email}`, class: 'mail' }, c.email), '.'),
    ],
  },
  {
    id: 'now', name: 'Now', which: ['in which I say what I am ', x('doing'), ' up to these days'],
    note: `as of ${c.now.updated}`,
    body: () => [h('ul', { class: 'tilde' }, c.now.items.map((t) => h('li', {}, t)))],
  },
  {
    id: 'work', name: 'Work', which: ['in which I set out, come back again, and set out once more'],
    body: () => [
      h('p', {}, 'Here is a map of the road so far, drawn from memory. It is not to scale, nor true to any compass but my own; the red line is the way I went.'),
      mapFigure(),
      h('ol', { class: 'road' }, chron.map((w, i) => {
        const n = WORK_NOTES[w.name] ? note(WORK_NOTES[w.name], w.name === 'The Axle Group' ? 'red' : '') : null;
        return h('li', { id: workId(w), 'data-spot': SPOT[w.name] },
          n,
          h('p', { class: 'stop' }, h('a', { href: w.url }, w.name), h('span', { class: 'role' }, `, ${w.role}`)),
          h('p', { class: 'when' }, w.when, i === 2 ? h('span', { class: 'aside hand' }, ' and back again') : null),
          h('p', { class: 'blurb' }, w.blurb),
          h('p', { class: 'tags' }, w.tags.join(' · ')),
        );
      })),
    ],
  },
  {
    id: 'projects', name: 'Projects', which: ['in which I ', x('boast'), ' list the things I made along the way'],
    blot: true,
    body: () => [h('ul', { class: 'tilde things' }, c.projects.map((p) => h('li', {},
      PROJECT_NOTES[p.name] ? note(PROJECT_NOTES[p.name]) : null,
      h('a', { href: p.url }, p.name), `: ${p.blurb}.`,
      p.links ? h('span', { class: 'also' }, ' (', ...p.links.flatMap((l, i) => [i ? ' · ' : '', h('a', { href: l.url }, l.label)]), ')') : null,
    )))],
  },
  {
    id: 'writing', name: 'Writing', which: ['in which I ', x('ramble'), ' write it all down'],
    body: () => [
      h('p', { class: 'small' }, 'The ones marked with a star are my favourites.'),
      h('ul', { class: 'tilde' }, c.writing.map((w) => h('li', {},
        h('a', { href: w.url }, w.title),
        w.starred ? h('span', { class: 'star', title: 'A favourite' }, ' ✦') : null,
        ' ', h('span', { class: 'date' }, w.date),
      ))),
    ],
  },
  {
    id: 'elsewhere', name: 'Elsewhere', which: ['in which you may find me in other places'],
    body: () => [h('ul', { class: 'inline' }, c.elsewhere.map((l) => h('li', {}, h('a', { href: l.url }, l.name))))],
  },
];

const host = $('#chapters');
const toc = $('#contents');
chapters.forEach((ch, i) => {
  const head = h('h2', { id: ch.id },
    h('span', { class: 'num' }, `Chapter the ${NUM[i]}`),
    h('span', { class: 'name' }, ch.name),
    h('span', { class: 'which' }, ...ch.which),
    ch.note ? note(ch.note, 'head-note') : null,
  );
  const sec = h('section', { class: 'chapter', 'aria-labelledby': ch.id }, head, ...ch.body());
  if (ch.blot) sec.append(h('span', { class: 'blot', 'aria-hidden': 'true', style: `background-image:${blot(31)}` }, h('span', { class: 'hand' }, 'sorry')));
  host.append(sec);
  toc.append(h('li', {}, h('a', { href: `#${ch.id}` },
    h('span', { class: 'n' }, ROMAN[i]), h('span', { class: 't' }, ch.name), h('i', { class: 'lead' }), h('span', { class: 'w' }, ...ch.which.map((w) => (typeof w === 'string' ? w : w.cloneNode(true)))),
  )));
});
document.querySelectorAll('s.x, .struck s').forEach((el, i) => el.style.setProperty('--strike', strike(70 + i * 13)));

// ---------- the map, with its labels laid over in two hands

// station arrival frames (60 fps after `go`), from rive/manuscript/gen.mjs
const MAP_TIMES = [90, 135, 189, 241, 282, 330, 375, 420, 483];
function mapFigure() {
  const L = (x, y, cls, kids, { at = 0, spot, href, anchor = 'c' } = {}) => {
    const tag = href ? 'a' : 'span';
    return h(tag, {
      class: `label ${cls} a-${anchor}`, href, 'data-spot': spot, 'data-at': at,
      style: `left:${((x / 720) * 100).toFixed(2)}%;top:${((y / 540) * 100).toFixed(2)}%`,
    }, ...kids);
  };
  const byName = (n, role) => chron.find((w) => w.name === n && (!role || w.role.includes(role)));
  const wid = (n, role) => `#${workId(byName(n, role))}`;
  return h('figure', { class: 'map', id: 'map' },
    h('canvas', { id: 'mapc', 'aria-hidden': 'true' }),
    h('div', { class: 'labels' },
      L(100, 470, 'hand', ['Here the road began'], { at: 0, anchor: 'l' }),
      L(240, 357, 'place', ['UT Dallas'], { at: 1, spot: 2, href: wid('The University of Texas at Dallas', 'Lead'), anchor: 'l' }),
      L(150, 148, 'place', ['Unlimited Fries', h('br'), 'Studios'], { at: 2, spot: 3, href: wid('Unlimited Fries Studios'), anchor: 'c' }),
      L(234, 300, 'hand', ['& back again,', h('br'), 'to teach'], { at: 3, spot: 2, href: wid('The University of Texas at Dallas', 'teaching'), anchor: 'l' }),
      L(330, 226, 'place', ['Multimodal', h('br'), 'Interaction Lab'], { at: 4, spot: 4, href: wid('Multimodal Interaction Lab'), anchor: 'b' }),
      L(452, 410, 'place', ['Pixel Foundry'], { at: 5, spot: 5, href: wid('Pixel Foundry'), anchor: 't' }),
      L(514, 204, 'place', ['HytaleModding'], { at: 6, spot: 6, href: wid('HytaleModding'), anchor: 'b' }),
      L(608, 384, 'place', ['The Axle Group'], { at: 7, spot: 7, href: wid('The Axle Group'), anchor: 't' }),
      L(612, 412, 'hand red', ['here I am now'], { at: 7, anchor: 't' }),
      L(652, 262, 'hand onward', ['and onward…'], { at: 8, anchor: 'r' }),
      L(552, 156, 'hand faint', ['here be no dragons', h('br'), '(so far)'], { at: -1, anchor: 'c' }),
      h('button', { class: 'moon', type: 'button', 'aria-label': 'Hold the map up to the moon', style: 'left:8.6%;top:11.5%' }),
      h('span', { class: 'moonletters hand', style: 'left:13%;top:9.4%' }, 'for those who read late:', h('br'), 'thank you for staying up with me'),
    ),
    h('figcaption', {}, 'The road so far. Hover a place to find it in the list below, or follow the link to its entry.'),
  );
}

// ---------- season & hour on the page: the date at the top, the light on the desk

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const PHRASE = ['in the early morning', 'by daylight', 'late in the afternoon', 'by candlelight', 'late at night, by candlelight'];
const WORD = ['morning', 'day', 'afternoon', 'evening', 'night'];

let state = when();
function paint(s) {
  const root = document.documentElement;
  root.dataset.season = SEASONS[s.season];
  root.dataset.time = TIMES[s.time];
  const d = s.date;
  $('#dateline').textContent = `${DAYS[d.getDay()]}, the ${ord(d.getDate())} of ${MONTHS[d.getMonth()]}, ${PHRASE[s.time]}`;
  const sn = SEASONS[s.season];
  $('#written').textContent = `Written in ${sn === 'autumn' ? 'an' : 'a'} ${sn} ${WORD[s.time]}, in ink, a little crookedly.`;
}
paint(state);

// ---------- rive

const still = reducedMotion;
const frontis = mount($('#frontis'), {
  src: 'manuscript', artboard: 'Frontis',
  onLoad: () => { frontis.set('season', state.season); frontis.set('time', state.time); if (still) frontis.set('still', true); },
});
const map = mount($('#mapc'), { src: 'manuscript', artboard: 'Map', onLoad: () => { if (still) map.set('still', true); mapReady = true; maybeDrawMap(); } });
const coda = mount($('#coda'), {
  src: 'manuscript', artboard: 'Coda',
  onLoad: () => { coda.set('season', state.season); coda.set('time', state.time); if (still) coda.set('still', true); codaReady = true; maybeWrite(); },
});

if (!overridden) {
  setInterval(() => {
    const next = when();
    if (next.season === state.season && next.time === state.time && next.date.getDate() === state.date.getDate()) return;
    state = next;
    paint(state);
    for (const m of [frontis, coda]) { m.set('season', state.season); m.set('time', state.time); }
  }, 5 * 60 * 1000);
}

// the map draws itself when it comes into view; its labels are written on as the road reaches them
const mapEl = $('#map');
let mapSeen = false, mapReady = false, mapDrawn = false;
function maybeDrawMap() {
  if (!mapSeen || !mapReady || mapDrawn) return;
  mapDrawn = true;
  map.set('go', true);
  mapEl.classList.add('drawing');
  mapEl.querySelectorAll('.label').forEach((l) => {
    const at = +l.dataset.at;
    const ms = still ? 0 : at < 0 ? 1400 : (MAP_TIMES[at] / 60) * 1000;
    setTimeout(() => l.classList.add('shown'), ms);
  });
}
new IntersectionObserver((es, io) => {
  if (es.some((e) => e.isIntersecting)) { mapSeen = true; maybeDrawMap(); io.disconnect(); }
}, { threshold: 0.35 }).observe(mapEl);

// places on the map and entries in the list point at each other
const spotOn = (n) => map.set('spot', n);
for (const el of document.querySelectorAll('[data-spot]')) {
  const n = +el.dataset.spot;
  el.addEventListener('pointerenter', () => spotOn(n));
  el.addEventListener('pointerleave', () => spotOn(0));
  el.addEventListener('focusin', () => spotOn(n));
  el.addEventListener('focusout', () => spotOn(0));
}

// moon-letters: plain to see late at night, or for a moment when the map is held to the moon
const moonBtn = mapEl.querySelector('.moon');
let moonTimer;
moonBtn.addEventListener('pointerenter', () => { clearTimeout(moonTimer); mapEl.classList.add('moonlit'); });
moonBtn.addEventListener('pointerleave', () => { moonTimer = setTimeout(() => mapEl.classList.remove('moonlit'), 2600); });
moonBtn.addEventListener('click', () => { clearTimeout(moonTimer); mapEl.classList.add('moonlit'); moonTimer = setTimeout(() => mapEl.classList.remove('moonlit'), 5000); });

// the last line is written as you reach it, then the quill signs off and the ink dries
const codaEl = $('.coda');
let codaSeen = false, codaReady = false, written = false;
function maybeWrite() {
  if (!codaSeen || !codaReady || written) return;
  written = true;
  codaEl.classList.add('writing');
  setTimeout(() => coda.set('go', true), still ? 0 : 700);
}
new IntersectionObserver((es, io) => {
  if (es.some((e) => e.isIntersecting)) { codaSeen = true; maybeWrite(); io.disconnect(); }
}, { threshold: 0.45 }).observe($('.coda-fig'));

// email links: the quill dips, ready to answer
for (const a of [post, ...document.querySelectorAll('a.mail')]) {
  a.addEventListener('mouseenter', () => coda.fire('dip'));
  a.addEventListener('focus', () => coda.fire('dip'));
}

// k knocks on the round door, for anyone not pointing
document.addEventListener('keydown', (e) => {
  if (e.key === 'k' && !e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement === document.body) frontis.fire('knock');
});

// ---------- keep the reader's place with a ribbon

const ribbon = $('#ribbon');
if (returning) {
  const target = place && document.getElementById(place) ? place : 'hello';
  ribbon.href = `#${target}`;
  ribbon.title = place ? 'Where you left off last time' : 'A ribbon, to keep your place';
  ribbon.hidden = false;
}
let lastPlace = place;
const placeIO = new IntersectionObserver((es) => {
  for (const e of es) {
    if (!e.isIntersecting || e.target.id === lastPlace) continue;
    lastPlace = e.target.id;
    try { localStorage.setItem('manuscript:place', lastPlace); } catch {}
  }
}, { rootMargin: '0px 0px -60% 0px' });
document.querySelectorAll('.chapter h2').forEach((el) => placeIO.observe(el));
