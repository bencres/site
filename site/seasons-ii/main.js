import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

// ---------------------------------------------------------------- the calendar
// Two numbers drive everything: the year (0 at midwinter, Jan 15, to 100 at the
// next midwinter) and the hour (0..24, local time). The scenes blend between
// keyed poses along both; the page palette follows them.
const DAYS = 365;
const MIDWINTER = 14; // Jan 15 as a 0-based day of year (non-leap)
const dayOfYear = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 864e5);
const todayDay = Math.min(DAYS - 1, dayOfYear(new Date()));
const dayToYear = (day) => (((day - MIDWINTER + DAYS) % DAYS) / DAYS) * 100;
const dayToDate = (day) => new Date(2026, 0, 1 + day);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const nowHour = () => { const d = new Date(); return d.getHours() + d.getMinutes() / 60; };
const STEP = 5; // the time slider moves in five-minute steps
const roundHour = (hh) => Math.round((hh * 60) / STEP) * STEP / 60;

const seasonName = (y) =>
  y < 10 ? 'deep winter' : y < 20 ? 'late winter' : y < 30 ? 'early spring' : y < 40 ? 'spring' : y < 50 ? 'early summer'
  : y < 60 ? 'midsummer' : y < 67 ? 'late summer' : y < 72 ? 'early autumn' : y < 82 ? 'autumn' : y < 92 ? 'late autumn' : 'early winter';

// one quiet line per half-month, for the almanac under the name
const LINES = [
  'the lake is loud with ice', 'deep snow and bright sun', 'the days are getting longer', 'chickadees have started their spring song',
  'the sap is running', 'the ice is going grey and soft', 'the creeks are up and the roads are mud', 'the robins are back',
  'trilliums in the hardwoods', 'the woods are suddenly green', 'the canoe is in the water', 'fireflies over the reeds',
  'the long warm evenings', 'thunder most afternoons', 'the lake is finally warm', 'the first cool nights',
  'the maples are turning', 'the geese are going', 'the woods are gold and scarlet', 'the leaves are nearly down',
  'bare woods and grey skies', 'the first snow is coming', 'the lake has frozen over', 'the shortest days',
];
const lineFor = (day) => {
  const d = dayToDate(day);
  const half = d.getMonth() * 2 + (d.getDate() > 15 ? 1 : 0);
  const when = `${d.getDate() <= 10 ? 'early' : d.getDate() <= 20 ? 'mid' : 'late'} ${MONTHS[d.getMonth()]}`;
  return { when, line: LINES[half] };
};

// ---------------------------------------------------------------- the sun's day
// Daylight runs from about 9 hours at midwinter to 15½ at midsummer. The Rive
// scenes key their hour on a fixed "solar" day (sunrise 6.5, sunset 19), so the
// real clock is warped onto it: real sunrise ↦ 6.5, real sunset ↦ 19.
const daylight = (y) => 12.2 - 3.3 * Math.cos((2 * Math.PI * y) / 100);
const sunrise = (y) => 12.4 - daylight(y) / 2;
const sunset = (y) => 12.4 + daylight(y) / 2;
function solarHour(hh, y) {
  const rise = sunrise(y), set = sunset(y);
  if (hh < rise) return (hh / rise) * 6.5;
  if (hh < set) return 6.5 + ((hh - rise) / (set - rise)) * 12.5;
  return 19 + ((hh - set) / (24 - set)) * 5;
}
const at = (curve, x) => {
  if (x <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) if (x <= curve[i][0]) return curve[i - 1][1] + ((curve[i][1] - curve[i - 1][1]) * (x - curve[i - 1][0])) / (curve[i][0] - curve[i - 1][0]);
  return curve[curve.length - 1][1];
};
// the same curves the scenes use (solar hours)
const NIGHT = [[0, 1], [4.5, 1], [5.5, 0.75], [6.5, 0.3], [7.5, 0], [18.5, 0], [19.5, 0.45], [20.5, 0.85], [22, 1]];
const DUSK = [[0, 0], [5, 0], [6.3, 0.9], [7.5, 0.15], [9, 0], [17.5, 0], [18.7, 0.7], [19.5, 1], [20.5, 0.35], [22, 0]];
const timeName = (sh) => sh < 4.8 ? 'night' : sh < 6.6 ? 'dawn' : sh < 11 ? 'morning' : sh < 14 ? 'midday' : sh < 17.6 ? 'afternoon' : sh < 19.6 ? 'dusk' : sh < 21.2 ? 'evening' : 'night';
const clock = (hh) => {
  const m = Math.round(hh * 60) % 1440;
  const H = Math.floor(m / 60), M = m % 60;
  return `${((H + 11) % 12) + 1}:${String(M).padStart(2, '0')} ${H < 12 ? 'am' : 'pm'}`;
};

// ---------------------------------------------------------------- palette by year, then by hour
const STOPS = [
  [0, { bg: '#f3f5f6', ink: '#26323b', dim: '#5f6d78', faint: '#93a1ac', red: '#b8432f', shadow: '#9db6cc', ground: '#9db6cc', groundA: 0, hue: 170, sat: 0.4 }],
  [18, { bg: '#f1f1ed', ink: '#2c3337', dim: '#636a6c', faint: '#979c9b', red: '#a9553a', shadow: '#a6b2b4', ground: '#8a7257', groundA: 0.5, hue: 120, sat: 0.4 }],
  [30, { bg: '#f4f6ee', ink: '#2b3832', dim: '#5c6b60', faint: '#93a092', red: '#c75d78', shadow: '#b6cf9a', ground: '#8fb063', groundA: 0.6, hue: 60, sat: 0.5 }],
  [50, { bg: '#f8f5e8', ink: '#2a332c', dim: '#5f6a5c', faint: '#9aa08f', red: '#c96a3b', shadow: '#c9d59a', ground: '#7ba552', groundA: 0.6, hue: 0, sat: 0.6 }],
  [68, { bg: '#f7f1e3', ink: '#35302a', dim: '#6b625a', faint: '#a1988c', red: '#c2651f', shadow: '#e0b56a', ground: '#9fa85a', groundA: 0.55, hue: 0, sat: 0.7 }],
  [80, { bg: '#f6ede0', ink: '#3a2f28', dim: '#6e5f55', faint: '#a39285', red: '#b8432f', shadow: '#d9a35a', ground: '#b47f49', groundA: 0.6, hue: 0, sat: 0.7 }],
  [90, { bg: '#eff0ee', ink: '#2e353b', dim: '#626b71', faint: '#969ea4', red: '#a4442f', shadow: '#aeb9c2', ground: '#9a8b76', groundA: 0.3, hue: 150, sat: 0.4 }],
  [100, { bg: '#f3f5f6', ink: '#26323b', dim: '#5f6d78', faint: '#93a1ac', red: '#b8432f', shadow: '#9db6cc', ground: '#9db6cc', groundA: 0, hue: 170, sat: 0.4 }],
];
// dusk and dawn: rose and amber; night: a moonlit blue-grey the dark ink still sits on
const DUSK_P = { bg: '#f0d8c2', ink: '#3a2c28', dim: '#6c564c', faint: '#9d8578', red: '#c0492c', shadow: '#dba878', ground: '#b08a58', groundA: 0.55, hue: 20, sat: 0.7 };
const NIGHT_W = { bg: '#8290a4', ink: '#111a24', dim: '#222d3a', faint: '#2f3b48', red: '#e2755c', shadow: '#5e7290', ground: '#60708a', groundA: 0.2, hue: 210, sat: 0.4 };
const NIGHT_S = { bg: '#6f7f95', ink: '#0f1720', dim: '#1e2934', faint: '#2b3744', red: '#e2755c', shadow: '#526682', ground: '#4b5e5a', groundA: 0.35, hue: 200, sat: 0.4 };
const hex2 = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const mixHex = (a, b, f) => '#' + hex2(a).map((v, i) => Math.round(v + (hex2(b)[i] - v) * f).toString(16).padStart(2, '0')).join('');
const mixP = (a, b, f) => { const o = {}; for (const k of Object.keys(a)) o[k] = typeof a[k] === 'number' ? a[k] + (b[k] - a[k]) * f : mixHex(a[k], b[k], f); return o; };
function palette(y) {
  let i = 1;
  while (i < STOPS.length - 1 && STOPS[i][0] < y) i++;
  const [y0, a] = STOPS[i - 1];
  const [y1, b] = STOPS[i];
  return mixP(a, b, Math.max(0, Math.min(1, (y - y0) / (y1 - y0))));
}
function applyPalette(y, sh) {
  const night = at(NIGHT, sh), dusk = at(DUSK, sh);
  const summer = (1 - Math.cos((2 * Math.PI * y) / 100)) / 2;
  const p = mixP(mixP(palette(y), DUSK_P, dusk * 0.65), mixP(NIGHT_W, NIGHT_S, summer), night);
  const st = document.body.style;
  st.setProperty('--bg', p.bg); st.setProperty('--ink', p.ink); st.setProperty('--dim', p.dim); st.setProperty('--faint', p.faint);
  st.setProperty('--red', p.red); st.setProperty('--shadow', p.shadow); st.setProperty('--ground', p.ground);
  st.setProperty('--ground-a', p.groundA.toFixed(2)); st.setProperty('--grain-hue', `${Math.round(p.hue)}deg`); st.setProperty('--grain-sat', p.sat.toFixed(2));
  st.setProperty('--rule', `${p.ink}14`);
  st.setProperty('--night', night.toFixed(3));
  // the drawings dim and cool a little at night (the shore handles its own night in Rive)
  st.setProperty('--woods-filter', night > 0.01 ? `brightness(${(1 - 0.18 * night).toFixed(3)}) saturate(${(1 - 0.3 * night).toFixed(3)})` : 'none');
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', p.bg);
}

// ---------------------------------------------------------------- the page
const page = document.getElementById('page');
let n = 0;
const divider = () => h('canvas', { class: 'divider', 'aria-hidden': 'true', 'data-kind': n++ % 2 ? 'FoxTracks' : 'HareTracks' });
// a label with a watercolor wash behind it (the canvas is sized to the word by fitLabels)
const labels = [];
const washed = (tag, attrs, text, artboard) => {
  const canvas = h('canvas', { class: 'hl', 'aria-hidden': 'true' });
  const el = h(tag, { ...attrs, class: `${attrs.class || ''} washed`.trim() }, canvas, h('span', {}, text));
  labels.push({ el, canvas, artboard });
  return el;
};
const section = (id, title, ...body) =>
  h('section', { id, 'aria-labelledby': `${id}-h` }, divider(), washed('h2', { id: `${id}-h` }, title, `Hi${labels.length % 3}`), ...body);

const almanac = h('p', { class: 'almanac' });
page.append(
  h('header', { class: 'hero' },
    h('p', { class: 'seal', 'aria-hidden': 'true' }, c.initials),
    washed('h1', {}, c.name, 'HiName'),
    h('p', { class: 'tagline' }, c.tagline),
    almanac),
  h('div', { class: 'intro' }, c.intro.map((p) => h('p', {}, p)),
    h('p', {}, 'Write to me at ', h('a', { href: `mailto:${c.email}` }, c.email), '.')),
  section('now', 'Now',
    h('p', { class: 'meta' }, `Updated ${c.now.updated}`),
    h('ul', { class: 'plain' }, c.now.items.map((i) => h('li', {}, i)))),
  section('work', 'Work',
    h('ul', { class: 'rows' }, c.work.map((w) =>
      h('li', {}, h('a', { href: w.url }, w.name), h('span', { class: 'role' }, w.role), h('span', { class: 'when' }, w.when),
        w.blurb ? h('p', { class: 'blurb' }, w.blurb) : null)))),
  section('projects', 'Projects',
    h('ul', { class: 'rows' }, c.projects.map((p) =>
      h('li', {}, h('a', { href: p.url }, p.name), h('span', { class: 'role' }, p.blurb),
        p.tags ? h('span', { class: 'tags' }, p.tags.slice(0, 4).join(' · ')) : null)))),
  section('writing', 'Writing',
    h('ul', { class: 'rows' }, c.writing.map((w) =>
      h('li', {}, h('a', { href: w.url }, w.title), w.starred ? h('span', { class: 'star', title: 'Favorite' }, '✻') : null, h('span', { class: 'when' }, w.date))))),
  section('elsewhere', 'Elsewhere',
    h('p', { class: 'links' }, c.elsewhere.map((e) => h('a', { href: e.url }, e.name)))),
  h('footer', {}, divider(), h('p', {}, `© ${new Date().getFullYear()} ${c.name}. Drawn through the year.`)),
);

// ---------------------------------------------------------------- the scenes
const scenes = [];
const mountScene = (cv, opts) => {
  const m = mount(cv, { src: 'seasons-ii', ...opts, onLoad: (r) => { m.set('year', year); m.set('hour', solar); opts.onLoad?.(r); } });
  scenes.push(m);
  return m;
};
const stand = mountScene(document.getElementById('stand'), { artboard: 'StandL', align: 'bottomLeft' });
const maple = mountScene(document.getElementById('maple'), { artboard: 'MapleTR', align: 'topRight' });
const fir = mountScene(document.getElementById('fir'), { artboard: 'FirBR', align: 'bottomRight' });
const sun = mountScene(document.getElementById('sun'), { artboard: 'Sun' });
const shore = mountScene(document.getElementById('shore'), { artboard: 'Shore', fit: 'fill' });
const weather = mountScene(document.getElementById('weather'), { artboard: 'Weather', fit: 'cover' });
const fixed = [stand, maple, fir, sun, shore, weather];
for (const cv of document.querySelectorAll('canvas.divider')) mountScene(cv, { artboard: cv.dataset.kind });

// Fixed canvases never leave the viewport, so keep them playing. With reduced
// motion, let the trees finish drawing once, then hold still (and no weather).
let settled = false;
if (reducedMotion) {
  weather.rive.pause();
  setTimeout(() => { settled = true; for (const m of fixed) m.rive.pause(); }, 7000);
}
for (const m of fixed) m.rive.on(window.rive.EventType.Pause, () => !settled && !(reducedMotion && m === weather) && m.rive.play());

// scroll walks the sun along its arc
const onScroll = () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  sun.set('scroll', max > 0 ? Math.min(100, (scrollY / max) * 100) : 0);
};
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// a click on open ground knocks a clump loose from whichever tree is nearest (when there is snow)
const shakes = { stand: 5, maple: 4, fir: 4 };
addEventListener('click', (e) => {
  if (e.target.closest('a, button, input, h1, h2, p, li, .variant-switch, .almanac-panel, canvas')) return;
  const x = e.clientX / innerWidth;
  const y = e.clientY / innerHeight;
  const name = x < 0.5 ? 'stand' : y < 0.5 ? 'maple' : 'fir';
  ({ stand, maple, fir })[name].fire(`shake${Math.floor(Math.random() * shakes[name])}`);
});

// ---------------------------------------------------------------- the washes behind the labels
// each one blooms the first time its label is seen; the name and the card's labels right after load
const pending = [];
for (const l of labels) {
  const m = mount(l.canvas, { src: 'seasons-ii', artboard: l.artboard, fit: 'fill', onLoad: () => { m.set('year', year); m.set('hour', solar); bloomVisible(); } });
  scenes.push(m);
  pending.push({ el: l.el, m, delay: l.el.tagName === 'H1' ? 1500 : 150 });
}
function bloomVisible() {
  const line = innerHeight * 0.9;
  for (let i = pending.length - 1; i >= 0; i--) {
    const { el, m, delay } = pending[i];
    const show = m.input('show');
    if (show && el.getBoundingClientRect().top < line) {
      setTimeout(() => (show.value = true), reducedMotion ? 0 : delay);
      pending.splice(i, 1);
    }
  }
}
let ticking = false;
addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => ((ticking = false), bloomVisible())); }, { passive: true });
const fitLabels = () => {
  for (const { el, canvas } of labels) {
    const w = el.querySelector('span').offsetWidth;
    const big = el.tagName === 'H1';
    canvas.style.width = `${w + (big ? 56 : 44)}px`;
    canvas.style.height = big ? `${Math.round(el.offsetHeight * 0.92)}px` : '34px';
  }
};
document.fonts.ready.then(fitLabels);
fitLabels();
addEventListener('resize', fitLabels);

// ---------------------------------------------------------------- the year and the hour, and their sliders
const params = new URLSearchParams(location.search);
function parseDay(v) {
  if (!v) return null;
  const md = /^(\d{1,2})-(\d{1,2})$/.exec(v);
  if (md) return Math.max(0, Math.min(DAYS - 1, dayOfYear(new Date(2026, +md[1] - 1, +md[2]))));
  const num = Number(v);
  return Number.isFinite(num) ? Math.max(0, Math.min(DAYS - 1, Math.round(num) - 1)) : null;
}
function parseTime(v) {
  if (!v) return null;
  const hm = /^(\d{1,2})(?::(\d{1,2}))?$/.exec(v);
  if (!hm) return null;
  const hh = Math.min(23, +hm[1]) + Math.min(59, +(hm[2] || 0)) / 60;
  return roundHour(hh) % 24;
}
let day = parseDay(params.get('day')) ?? todayDay;
let year = dayToYear(day);
let hour = parseTime(params.get('time')) ?? roundHour(nowHour()) % 24;
let solar = solarHour(hour, year);

const svgEl = (tag) => document.createElementNS('http://www.w3.org/2000/svg', tag);
const glyph = (d) => { const s = svgEl('svg'); s.setAttribute('viewBox', '0 0 16 16'); s.innerHTML = d; return s; };
const SUN = '<circle cx="8" cy="8" r="3"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>';
const MOON = '<path d="M10.5 2.5a6 6 0 1 0 3 9.5 5 5 0 0 1-3-9.5z"/>';

// the year row
const whenEl = h('span', { class: 'when' });
const seasonEl = h('span', { class: 'season' });
const playBtn = h('button', { class: 'play', type: 'button', 'aria-label': 'Play through the year', title: 'Play through the year' }, '▶');
const todayBtn = h('button', { class: 'today', type: 'button', title: 'Back to today' }, 'today');
const range = h('input', { type: 'range', min: 0, max: DAYS - 1, step: 1, value: day, 'aria-label': 'Day of the year' });
const rail = svgEl('svg');
rail.setAttribute('class', 'rail');
rail.setAttribute('aria-hidden', 'true');
const glyphs = [
  glyph('<path d="M8 2v12M3 5l10 6M3 11l10-6M8 2l-2 2M8 2l2 2M8 14l-2-2M8 14l2-2"/>'), // snow
  glyph('<path d="M8 14V7M8 7c-3 0-4-2-4-4 2 0 4 1 4 4M8 9c3 0 4-2 4-4-2 0-4 1-4 4"/>'), // sprout
  glyph(SUN),
  glyph('<path d="M3 13C3 7 7 3 13 3c0 6-4 10-10 10zM3 13l6-6"/>'), // leaf
];
// the hour row
const timeEl = h('span', { class: 'when' });
const timeNameEl = h('span', { class: 'season' });
const playDayBtn = h('button', { class: 'play', type: 'button', 'aria-label': 'Play through the day', title: 'Play through the day' }, '▶');
const nowBtn = h('button', { class: 'today', type: 'button', title: 'Back to now' }, 'now');
const hrange = h('input', { type: 'range', min: 0, max: 1440 - STEP, step: STEP, value: Math.round(hour * 60), 'aria-label': 'Time of day' });
const hrail = svgEl('svg');
hrail.setAttribute('class', 'rail');
hrail.setAttribute('aria-hidden', 'true');
const hglyphs = [glyph(MOON), glyph(SUN), glyph(MOON)];

const panel = h('aside', { class: 'almanac-panel', 'aria-label': 'Time of year and time of day' },
  h('div', { class: 'row' }, washedInline(whenEl, 'Hi1'), seasonEl, todayBtn, playBtn),
  h('div', { class: 'glyphs', 'aria-hidden': 'true' }, ...glyphs),
  h('div', { class: 'track' }, rail, range),
  h('div', { class: 'months', 'aria-hidden': 'true' }, ...'JFMAMJJASOND'.split('').map((m) => h('span', {}, m))),
  h('div', { class: 'row hours' }, washedInline(timeEl, 'Hi2'), timeNameEl, nowBtn, playDayBtn),
  h('div', { class: 'glyphs hourglyphs', 'aria-hidden': 'true' }, ...hglyphs),
  h('div', { class: 'track' }, hrail, hrange),
  h('div', { class: 'months hourlabels', 'aria-hidden': 'true' }, ...['12 am', '6', 'noon', '6', '12'].map((m) => h('span', {}, m))),
);
function washedInline(span, artboard) {
  const canvas = h('canvas', { class: 'hl', 'aria-hidden': 'true' });
  const wrap = h('span', { class: 'washed inline' }, canvas, span);
  const m = mount(canvas, { src: 'seasons-ii', artboard, fit: 'fill', onLoad: () => { m.set('year', year); m.set('hour', solar); setTimeout(() => { const s = m.input('show'); if (s) s.value = true; }, reducedMotion ? 0 : 2600); } });
  scenes.push(m);
  return wrap;
}
document.body.append(panel);

// the rails: wobbly ink lines; month ticks and a red mark for today; hour ticks
// with the sun's rise and set for the chosen day, and a red mark for now
const wobble = (x0, x1, yMid) => {
  let d = `M${x0} ${yMid}`;
  for (let i = 1; i <= 24; i++) d += ` L${(x0 + ((x1 - x0) * i) / 24).toFixed(1)} ${(yMid + Math.sin(i * 1.7) * 0.7 + Math.cos(i * 0.9) * 0.5).toFixed(2)}`;
  return d;
};
function drawRails() {
  const w = range.clientWidth || 272;
  const pad = 7; // half the thumb
  const yMid = 15;
  const x = (d) => pad + (d / (DAYS - 1)) * (w - pad * 2);
  const d = wobble(x(0), x(DAYS - 1), yMid);
  const monthStarts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const ticks = monthStarts.map((m, i) => { const t = x((m - MIDWINTER + DAYS) % DAYS); return `<line class="tick" x1="${t.toFixed(1)}" y1="${yMid + 4}" x2="${t.toFixed(1)}" y2="${yMid + (i % 3 === 0 ? 9 : 7)}"/>`; }).join('');
  const tx = x((todayDay - MIDWINTER + DAYS) % DAYS);
  rail.innerHTML = `<path class="bleed" d="${d}"/><path class="ink" d="${d}"/>${ticks}<path class="todayMark" d="M${tx} ${yMid - 6} l-3 -5 h6 z"/>`;

  const hx = (hh) => pad + (hh / 24) * (w - pad * 2);
  const hd = wobble(hx(0), hx(24), yMid);
  let hticks = '';
  for (let i = 0; i <= 24; i++) hticks += `<line class="tick" x1="${hx(i).toFixed(1)}" y1="${yMid + 4}" x2="${hx(i).toFixed(1)}" y2="${yMid + (i % 6 === 0 ? 9 : i % 3 === 0 ? 7 : 5.5)}"/>`;
  const rise = hx(sunrise(year)), set = hx(sunset(year));
  const nx = hx(roundHour(nowHour()) % 24);
  hrail.innerHTML = `<path class="bleed" d="${hd}"/><path class="ink" d="${hd}"/>${hticks}` +
    `<path class="day" d="M${rise.toFixed(1)} ${yMid - 3.5} L${set.toFixed(1)} ${yMid - 3.5}"/>` +
    `<path class="sunMark" d="M${rise.toFixed(1)} ${yMid - 2} l-2.5 -4 h5 z"/><path class="sunMark" d="M${set.toFixed(1)} ${yMid - 2} l-2.5 -4 h5 z"/>` +
    `<path class="todayMark" d="M${nx.toFixed(1)} ${yMid - 6} l-3 -5 h6 z"/>`;
}

function describe() {
  const { when, line } = lineFor(day);
  const date = dayToDate(day);
  const season = seasonName(year);
  whenEl.textContent = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  seasonEl.textContent = season;
  range.setAttribute('aria-valuetext', `${date.getDate()} ${MONTHS[date.getMonth()]}, ${season}`);
  todayBtn.hidden = day === todayDay;
  const tn = timeName(solar);
  timeEl.textContent = clock(hour);
  timeNameEl.textContent = tn;
  hrange.setAttribute('aria-valuetext', `${clock(hour)}, ${tn}`);
  nowBtn.hidden = Math.abs(hour - roundHour(nowHour()) % 24) < 0.01;
  almanac.replaceChildren(h('em', {}, when), ` — ${line}.`);
  const g = year < 16 || year >= 92 ? 0 : year < 42 ? 1 : year < 68 ? 2 : 3;
  glyphs.forEach((s, i) => s.classList.toggle('on', i === g));
  const night = at(NIGHT, solar) > 0.5;
  hglyphs.forEach((s, i) => s.classList.toggle('on', i === 1 ? !night : night && (i === 0 ? hour < 12 : hour >= 12)));
}

let urlTimer;
function syncUrl() {
  clearTimeout(urlTimer);
  urlTimer = setTimeout(() => {
    const u = new URL(location.href);
    if (day === todayDay) u.searchParams.delete('day');
    else { const dt = dayToDate(day); u.searchParams.set('day', `${dt.getMonth() + 1}-${dt.getDate()}`); }
    if (nowBtn.hidden) u.searchParams.delete('time');
    else { const m = Math.round(hour * 60); u.searchParams.set('time', `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`); }
    history.replaceState(null, '', u);
  }, 250);
}
function apply({ fromUser = true } = {}) {
  solar = solarHour(hour, year);
  for (const m of scenes) { m.set('year', year); m.set('hour', solar); }
  applyPalette(year, solar);
  describe();
  if (fromUser) syncUrl();
}
function setDay(d, opts) {
  day = ((Math.round(d) % DAYS) + DAYS) % DAYS;
  year = dayToYear(day);
  // the slider runs winter → winter, i.e. from Jan 15; map the day onto that axis
  range.value = (day - MIDWINTER + DAYS) % DAYS;
  drawHourRail();
  apply(opts);
}
function setHour(hh, opts) {
  hour = ((hh % 24) + 24) % 24;
  hrange.value = Math.round(hour * 60 / STEP) * STEP % 1440;
  apply(opts);
}
let railTimer;
const drawHourRail = () => { clearTimeout(railTimer); railTimer = setTimeout(drawRails, 40); };
range.addEventListener('input', () => { stopPlay(); setDay((+range.value + MIDWINTER) % DAYS); });
hrange.addEventListener('input', () => { stopPlay(); setHour(+hrange.value / 60); });
todayBtn.addEventListener('click', () => { stopPlay(); setDay(todayDay); range.focus(); });
nowBtn.addEventListener('click', () => { stopPlay(); setHour(roundHour(nowHour()) % 24); hrange.focus(); });

// play: the year in ~24s from wherever we are, back to the same day; or the day in ~9s
let playing = null;
function stopPlay() {
  if (!playing) return;
  cancelAnimationFrame(playing.raf);
  const btn = playing.btn;
  playing = null;
  btn.textContent = '▶';
  btn.setAttribute('aria-label', btn === playBtn ? 'Play through the year' : 'Play through the day');
  syncUrl();
}
function startPlay(btn) {
  const start = performance.now();
  const fromDay = day, fromHour = hour;
  const dur = btn === playBtn ? 24000 : 9000;
  playing = { raf: 0, btn };
  btn.textContent = '■';
  btn.setAttribute('aria-label', 'Stop');
  const step = (t) => {
    const f = (t - start) / dur;
    if (f >= 1) { btn === playBtn ? setDay(fromDay, { fromUser: false }) : setHour(fromHour, { fromUser: false }); stopPlay(); return; }
    if (btn === playBtn) setDay(fromDay + f * DAYS, { fromUser: false });
    else setHour(fromHour + f * 24, { fromUser: false });
    playing.raf = requestAnimationFrame(step);
  };
  playing.raf = requestAnimationFrame(step);
}
playBtn.addEventListener('click', () => (playing ? stopPlay() : startPlay(playBtn)));
playDayBtn.addEventListener('click', () => (playing ? stopPlay() : startPlay(playDayBtn)));

drawRails();
addEventListener('resize', drawRails);
setDay(day, { fromUser: false });
