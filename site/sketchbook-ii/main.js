import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';
import { swatch, highlight } from './wash.js';

const $ = (s) => document.querySelector(s);
const root = document.documentElement;

// ---------- season and hour, read once from the visitor's clock ----------
// Overrides for review: ?season=winter&time=dusk, or ?day=12-24&time=17:40

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TIMES = ['morning', 'day', 'golden', 'dusk', 'night'];
const ALIAS = { fall: 'autumn', noon: 'day', midday: 'day', afternoon: 'golden', evening: 'dusk', dawn: 'morning', sunrise: 'morning', sunset: 'dusk' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function readClock() {
  const q = new URLSearchParams(location.search);
  const now = new Date();
  let month = now.getMonth() + 1, day = now.getDate(), mins = now.getHours() * 60 + now.getMinutes();
  let dated = true;
  const qd = q.get('day')?.match(/^(\d{1,2})-(\d{1,2})$/);
  if (qd) [month, day] = [+qd[1], +qd[2]];
  const qhm = q.get('time')?.match(/^(\d{1,2}):(\d{2})$/);
  if (qhm) mins = +qhm[1] * 60 + +qhm[2];

  // rough daylight for the mid-latitudes: long June evenings, short December days
  const doy = (Date.UTC(2026, month - 1, day) - Date.UTC(2026, 0, 0)) / 864e5;
  const k = Math.cos((2 * Math.PI * (doy - 172)) / 365);
  const sunrise = 390 - 45 * k, sunset = 1140 + 90 * k;
  let time = mins < sunrise - 40 || mins >= sunset + 60 ? 4 : mins < sunrise + 200 ? 0 : mins < sunset - 150 ? 1 : mins < sunset - 10 ? 2 : 3;
  let season = month >= 3 && month <= 5 ? 0 : month >= 6 && month <= 8 ? 1 : month >= 9 && month <= 11 ? 2 : 3;

  const qs = q.get('season')?.toLowerCase();
  if (SEASONS.includes(ALIAS[qs] || qs)) {
    season = SEASONS.indexOf(ALIAS[qs] || qs);
    dated = !!qd;
  }
  const qt = q.get('time')?.toLowerCase();
  const named = TIMES.includes(ALIAS[qt] || qt);
  if (named) time = TIMES.indexOf(ALIAS[qt] || qt);

  const words = named || qhm ? null : mins;
  const when = [
    'morning',
    words == null ? 'midday' : words < 720 ? 'late morning' : 'early afternoon',
    'late afternoon',
    'dusk',
    words != null && words < 300 ? 'the small hours' : 'night',
  ][time];
  const label = dated ? `${day} ${MONTHS[month - 1]} · ${when}` : `${SEASONS[season]} · ${when}`;
  return { season, time, label, when };
}

let clock = readClock();

function applyClock() {
  root.dataset.season = SEASONS[clock.season];
  root.dataset.time = TIMES[clock.time];
  $('#dated').textContent = clock.label;
  $('#weather').textContent = `${clock.when} in ${SEASONS[clock.season]}`;
}
applyClock();

// visits, for things you only notice on a third look
let visits = 1;
try {
  visits = (+localStorage.getItem('sk2-visits') || 0) + 1;
  localStorage.setItem('sk2-visits', visits);
} catch {}

// ---------- copy ----------

$('#name').textContent = c.name;
$('.name-wash').innerHTML = highlight('F4C84A');

const intro = $('#intro');
c.intro.forEach((p) => intro.append(h('p', {}, p)));
intro.append(h('p', {}, 'Say hello any time: ', h('a', { href: `mailto:${c.email}` }, c.email), '.'));

const dash = (...kids) => h('li', {}, ...kids);
const sections = [
  { id: 'now', title: 'Now', note: `updated ${c.now.updated}`, items: c.now.items.map((t) => dash(t)) },
  { id: 'work', title: 'Work', items: c.work.map((w) => dash(h('a', { href: w.url }, w.name), ` (${w.when}): ${w.role}`)) },
  { id: 'projects', title: 'Projects', items: c.projects.map((p) => dash(h('a', { href: p.url }, p.name), `: ${p.blurb}`)) },
  {
    id: 'writing',
    title: 'Writing',
    items: c.writing.map((w) =>
      dash(h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'A favorite' }, ' ✦') : null, h('span', { class: 'date' }, ` ${w.date}`))
    ),
  },
  { id: 'elsewhere', title: 'Elsewhere', items: c.elsewhere.map((l) => dash(h('a', { href: l.url }, l.name))) },
];

// swatch colours follow the season, quietly
const C = { sap: '8DB360', leaf: '6E9F4E', ochre: 'D9A93F', terra: 'C8643B', sky: '7FB2D3', grey: '8A97A6', lamp: 'F4C84A', rose: 'D9738A', violet: '8E86C9', blossom: 'E8A0B4', olive: 'A8A04A', ice: '9DB7CF' };
const PALETTES = [
  [[C.sap, C.blossom], [C.sky, C.violet], [C.blossom, C.lamp], [C.lamp, C.sap], [C.violet, C.sky]],
  [[C.sap, C.ochre], [C.sky, C.violet], [C.terra, C.ochre], [C.rose, C.violet], [C.ochre, C.sap]],
  [[C.ochre, C.terra], [C.terra, C.ochre], [C.olive, C.ochre], [C.rose, C.terra], [C.ochre, C.olive]],
  [[C.ice, C.violet], [C.grey, C.sky], [C.violet, C.rose], [C.sky, C.sap], [C.terra, C.ochre]],
];

const host = $('#sections');
const heads = [];
sections.forEach((s, i) => {
  const [col, acc] = PALETTES[clock.season][i];
  const wrap = h('span', { class: 'swatch-wrap' });
  wrap.innerHTML = swatch(col, acc, 300 + i * 17);
  const heading = h('h2', { id: s.id }, wrap, h('span', { class: 'label' }, s.title), s.note ? h('small', {}, s.note) : null);
  host.append(h('section', { class: 'block', 'aria-labelledby': s.id }, heading, h('ul', { class: 'dash' }, s.items)));
  heads.push(heading);
});

// each swatch hugs its heading word
const fit = () => heads.forEach((hd) => (hd.querySelector('.swatch-wrap').style.width = `${hd.querySelector('.label').offsetWidth + 58}px`));
document.fonts.ready.then(fit);
fit();

// bloom a swatch the first time its heading comes up the page (or is flung past)
const bloom = (hd, delay = 0) => setTimeout(() => hd.classList.add('wet'), delay);
if (reducedMotion) heads.forEach((hd) => hd.classList.add('wet', 'still'));
else {
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    for (const e of entries) {
      if (e.isIntersecting || e.boundingClientRect.top < 0) {
        bloom(e.target, 140 + n++ * 160);
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -10% 0px' });
  heads.forEach((hd) => io.observe(hd));
}

// ---------- the hillside ----------

const narrow = matchMedia('(max-width: 640px)');
const hero = mount($('#hero'), {
  src: 'sketchbook-ii',
  artboard: 'Hero',
  fit: narrow.matches ? 'cover' : 'contain',
  onLoad: () => {
    if (reducedMotion) hero.set('calm', true);
    hero.set('season', clock.season);
    hero.set('time', clock.time);
    hero.set('friend', visits >= 3);
  },
});
narrow.addEventListener('change', () => {
  const R = window.rive;
  hero.rive.layout = new R.Layout({ fit: narrow.matches ? R.Fit.Cover : R.Fit.Contain, alignment: R.Alignment.Center });
});

// re-read the clock every few minutes; the scene mixes slowly to the new hour
setInterval(() => {
  const next = readClock();
  if (next.season === clock.season && next.time === clock.time && next.label === clock.label) return;
  clock = next;
  applyClock();
  hero.set('season', clock.season);
  hero.set('time', clock.time);
}, 5 * 60 * 1000);

// the name's wash swipes again when you come back to it
const nameWash = $('.name-wash svg');
let swiping = null;
$('.name').addEventListener('mouseenter', () => {
  if (reducedMotion || swiping?.playState === 'running') return;
  swiping = nameWash.animate(
    [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(0 0 0 92%)', offset: 0.22 }, { clipPath: 'inset(0 100% 0 0)', offset: 0.23 }, { clipPath: 'inset(0 0 0 0)' }],
    { duration: 900, easing: 'ease-in-out' }
  );
});

// the lamp also answers to the keyboard
document.addEventListener('keydown', (e) => {
  if (e.key === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement === document.body) hero.fire('lamp');
});
