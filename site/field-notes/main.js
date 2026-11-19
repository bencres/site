import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';
import * as sk from './sketches.js';

const $ = (s) => document.querySelector(s);

// ------------------------------------------------------------ when is it?
// Season and time of day come from the visitor's own clock, once at load and
// again every few minutes. For review: ?season=winter&time=dusk, or
// ?day=12-24&time=17:40 (either half works on its own).

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TIMES = ['morning', 'midday', 'afternoon', 'evening', 'night'];
const SEASON_ALIAS = { fall: 'autumn' };
const TIME_ALIAS = { dawn: 'morning', am: 'morning', day: 'midday', noon: 'midday', late: 'afternoon', pm: 'afternoon', golden: 'afternoon', dusk: 'evening', eve: 'evening' };
// a representative day and hour, so an override still reads as a real entry
const SEASON_DAY = [[3, 18], [6, 12], [9, 21], [0, 14]];
const TIME_HOUR = [[8, 10], [12, 40], [16, 30], [18, 50], [22, 20]];
// evening and night start earlier in winter, later in summer
const DUSK = [[19, 21, 6], [20, 22, 5], [18, 20, 6], [17, 19, 7]];

const q = new URLSearchParams(location.search);
const overridden = ['season', 'time', 'day'].some((k) => q.has(k));

function resolve() {
  const d = new Date();
  const seasonQ = SEASONS.indexOf(SEASON_ALIAS[q.get('season')] || q.get('season'));
  const day = q.get('day')?.match(/^(\d{1,2})-(\d{1,2})$/);
  if (day) d.setMonth(+day[1] - 1, +day[2]);
  else if (seasonQ >= 0) d.setMonth(...SEASON_DAY[seasonQ]);
  const season = seasonQ >= 0 ? seasonQ : [3, 3, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3][d.getMonth()];

  const tq = q.get('time');
  const clock = tq?.match(/^(\d{1,2}):(\d{2})$/);
  const named = TIMES.indexOf(TIME_ALIAS[tq] || tq);
  if (clock) d.setHours(+clock[1], +clock[2]);
  else if (named >= 0) d.setHours(...TIME_HOUR[named]);
  const hr = d.getHours() + d.getMinutes() / 60;
  const [eve, night, morn] = DUSK[season];
  const time = named >= 0 ? named : hr < morn || hr >= night ? 4 : hr < 10 ? 0 : hr < (season === 1 ? 16 : 15) ? 1 : hr < eve ? 2 : 3;
  return { d, season, time };
}

// the dated journal heading: wording only, nothing claimed about Ben
const MONTH_NOTE = ['frost on the gate', 'the days drawing out', 'first blossom in the hedge', 'showers, then sun', 'the hedgerow in flower', 'long light', 'bees in the clover', 'late summer haze', 'blackberries ripe', 'leaves turning', 'first frost', 'lamps lit by four'];
const TIME_WORD = ['morning', 'midday', 'late afternoon', 'evening', 'night'];
function entryNote({ d, season, time }) {
  if (time === 0) return season === 1 ? 'dew on the grass' : 'mist on the fields';
  if (time === 2) return 'long shadows across the lane';
  if (time === 4) return 'a lamp in the window, a few stars';
  return MONTH_NOTE[d.getMonth()];
}
function entryText(w) {
  const day = w.d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return { day: day.replace(',', ''), rest: `, ${TIME_WORD[w.time]} — ${entryNote(w)}` };
}

// ------------------------------------------------------------ copy

$('#name').textContent = c.name;
$('#mast-rule').innerHTML = sk.rule(17, 600, { amp: 1.1, w: 1 });

const intro = $('#intro');
c.intro.forEach((p) => intro.append(h('p', {}, p)));
intro.append(h('p', {}, 'Say hello any time: ', h('a', { href: `mailto:${c.email}` }, c.email), '.'));

const li = (...kids) => h('li', {}, ...kids);
const sections = [
  {
    id: 'now', title: 'Now', note: `updated ${c.now.updated}`, side: 'right',
    sketch: (w) => sk.teacup(w.season, w.time),
    caption: (w) => ['fig. 1', ['first cup of the day', 'tea, still warm', 'four o’clock tea', 'one more cup', 'chamomile, then bed'][w.time]],
    body: () => h('ul', { class: 'notes' }, c.now.items.map((t) => li(t))),
  },
  {
    id: 'work', title: 'Work', side: 'left',
    sketch: (w) => sk.acorn(w.season),
    caption: () => ['fig. 2', 'acorn & oak leaf', 'idea → launch, given time'],
    body: () => h('ul', { class: 'notes work' }, c.work.map((x) => li(h('a', { href: x.url }, x.name), h('span', { class: 'role' }, ` — ${x.role.toLowerCase()}`), h('span', { class: 'when' }, x.when)))),
  },
  {
    id: 'projects', title: 'Projects', side: 'right',
    sketch: (w) => sk.snail(w.season),
    caption: (w) => w.season === 3 ? ['fig. 3', 'snail, sealed in till spring', 'vfxdirs: still a work in progress'] : ['fig. 3', 'snail, slow & steady', 'vfxdirs: still a work in progress'],
    body: () => h('ul', { class: 'notes' }, c.projects.map((p) => li(h('a', { href: p.url }, p.name), `: ${p.blurb}`))),
  },
  {
    id: 'writing', title: 'Writing', side: 'left',
    sketch: () => sk.feather(),
    caption: () => ['fig. 4', 'a found feather, for writing with', '✦ marks the favourites'],
    body: () => h('ul', { class: 'notes writing' }, c.writing.map((x) => li(h('a', { href: x.url }, x.title), x.starred ? h('span', { class: 'star', title: 'A favourite' }, ' ✦') : null, h('span', { class: 'when' }, x.date)))),
  },
  {
    id: 'elsewhere', title: 'Elsewhere', side: 'right',
    sketch: (w) => sk.sprig(w.season),
    caption: (w) => ['fig. 5', ['blackthorn, in flower', 'dog rose', 'hawthorn berries', 'holly'][w.season], 'from the hedge by the gate'],
    body: () => h('p', { class: 'elsewhere' }, c.elsewhere.flatMap((l, i) => [i ? h('span', { class: 'sep', 'aria-hidden': 'true' }, ' · ') : null, h('a', { href: l.url }, l.name)])),
  },
];

const host = $('#sections');
const specimens = [];
sections.forEach((s, i) => {
  const fig = h('figure', { class: `specimen ${s.side}` });
  const heading = h('h2', { id: s.id }, h('span', { class: 'title' }, s.title), s.note ? h('small', {}, s.note) : null);
  const rule = h('div', { class: 'h-rule' });
  rule.innerHTML = sk.rule(30 + i, 90, { amp: 1.4, w: 1.2 });
  const sec = h('section', { class: 'block', 'aria-labelledby': s.id }, fig, heading, rule, s.body());
  host.append(sec);
  specimens.push({ sec, fig, s });
});

// colophon: a lantern that is lit (with a moth) in the evening
const lanternFig = h('figure', { class: 'specimen footer-sketch' });
$('#colophon').append(
  lanternFig,
  h('p', { class: 'sign' }, 'kept like a field journal: inked, painted, a little crooked'),
  h('p', { class: 'small' }, h('a', { href: c.site }, 'bencres.dev'), ' · ', h('a', { href: `mailto:${c.email}` }, c.email)),
);

// ------------------------------------------------------------ season and time

let now = resolve();

function drawMarginalia(w, { inked = false } = {}) {
  for (const { fig, s } of specimens) {
    const [figNo, ...lines] = s.caption(w);
    fig.innerHTML = s.sketch(w);
    fig.append(h('figcaption', {}, h('span', { class: 'fig' }, figNo), ' ', lines[0], ...lines.slice(1).map((l) => h('span', { class: 'l2' }, l))));
    if (inked) fig.classList.add('inked');
  }
  lanternFig.innerHTML = sk.lantern(w.season, w.time);
  lanternFig.append(h('figcaption', {}, h('span', { class: 'fig' }, 'fig. 6'), ' ', w.time >= 3 ? 'a moth at the lamp' : 'lantern, for later'));
  if (inked) lanternFig.classList.add('inked');
}

function applyPage(w) {
  const root = document.documentElement;
  root.dataset.season = SEASONS[w.season];
  root.dataset.time = TIMES[w.time];
  const t = entryText(w);
  const entry = $('#entry');
  entry.replaceChildren(h('time', { datetime: w.d.toISOString().slice(0, 10) }, t.day), t.rest);
  const marks = visits();
  if (marks >= 2) {
    const tl = h('span', { class: 'tally', title: `your visits, tallied: ${marks}` });
    tl.innerHTML = sk.tally(Math.min(marks, 20));
    entry.append(tl);
  }
}

// visits, tallied once per browser session; a per-viewer nicety, so any
// storage failure just means no tally
function visits() {
  try {
    let n = +(localStorage.getItem('fn-visits') || 0);
    if (!sessionStorage.getItem('fn-counted')) {
      n += 1;
      localStorage.setItem('fn-visits', String(n));
      sessionStorage.setItem('fn-counted', '1');
    }
    return n;
  } catch {
    return 0;
  }
}

applyPage(now);
drawMarginalia(now, { inked: reducedMotion });

// ------------------------------------------------------------ rive: the vignette

const hero = mount($('#hero'), {
  src: 'field-notes',
  artboard: 'Hero',
  fit: 'contain',
  onLoad: () => {
    hero.set('season', now.season);
    hero.set('time', now.time);
    if (reducedMotion) hero.set('still', true);
    // the third time round, the rabbit comes out to say hello
    if (!reducedMotion && visits() >= 3 && now.time !== 4) setTimeout(() => hero.fire('peek'), 3600);
  },
});

if (!overridden) {
  setInterval(() => {
    const next = resolve();
    if (next.season === now.season && next.time === now.time) return;
    now = next;
    hero.set('season', now.season);
    hero.set('time', now.time);
    applyPage(now);
    drawMarginalia(now, { inked: true });
  }, 4 * 60 * 1000);
}

// ------------------------------------------------------------ ink in on scroll

// a sketch inks itself in once its section comes up the page (or has been
// scrolled past already, so a fast fling or a jump link still paints it);
// idle motion only runs while it is actually on screen
const inkIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting || e.boundingClientRect.bottom < 0) {
        e.target.classList.add('inked');
        inkIO.unobserve(e.target);
      }
    }
  },
  { rootMargin: '100% 0px -12% 0px' }
);
const awakeIO = new IntersectionObserver((entries) => entries.forEach((e) => e.target.classList.toggle('awake', e.isIntersecting)));
for (const el of [...document.querySelectorAll('.block'), $('#colophon')]) {
  if (!reducedMotion) inkIO.observe(el);
  else el.classList.add('inked');
  awakeIO.observe(el);
}
document.querySelector('.masthead').classList.add('inked');

// nav: a pencil tick beside whichever section you are reading
const navLinks = [...document.querySelectorAll('.masthead nav a')];
const navIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const id = e.target.querySelector('h2').id;
      navLinks.forEach((a) => (a.getAttribute('href') === `#${id}` ? a.setAttribute('aria-current', 'location') : a.removeAttribute('aria-current')));
    }
  },
  { rootMargin: '-40% 0px -55% 0px' }
);
document.querySelectorAll('.block').forEach((b) => navIO.observe(b));

// hover surprises in the margin: the snail pulls its eyes in, the sprig drops
// something; both reset on their own
document.addEventListener('pointerover', (e) => {
  const fig = e.target.closest?.('.specimen');
  if (!fig || fig.classList.contains('poked') || reducedMotion) return;
  fig.classList.add('poked');
  setTimeout(() => fig.classList.remove('poked'), 3200);
});
