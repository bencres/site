import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';
import { stops } from './journey.js';

// layout.json is written by rive/journey/gen.mjs with the .riv: where each
// stop, label and title sits in artboard units, and when the road reaches it
const L = await (await fetch(new URL('./layout.json', import.meta.url))).json();
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const still = reducedMotion || params.has('still');
const where = new Map(L.stops.map((s) => [s.id, s]));

// ---------- the head

$('#home').textContent = c.name;
$('#home').href = c.site;
$('#intro').textContent = "Each red landmark is somewhere I worked, studied or made something. The dashed road runs between them, oldest first, and stops where I am now.";
$('#mail').href = `mailto:${c.email}`;
$('#mail').textContent = c.email;
$('#elsewhere').append(...c.elsewhere.map((l) => h('li', {}, h('a', { href: l.url }, l.name))));

// ---------- the lettering over the map

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}, ...kids) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  n.append(...kids.flat().filter((k) => k != null));
  return n;
};
const map = $('#map');
const overlay = $('#overlay');
overlay.setAttribute('viewBox', `0 0 ${L.W} ${L.H}`);
map.style.setProperty('--ar', `${L.W} / ${L.H}`);
document.documentElement.style.setProperty('--ar-n', (L.W / L.H).toFixed(3));

const cue = new Map(); // Rive event name -> elements to letter in
const title = s('g', { class: 'ink-lbl' },
  s('text', { x: L.title.x, y: L.title.y, 'text-anchor': 'middle', 'font-size': 33 }, 'A Map of the Road So Far'),
  s('text', { x: L.title.x, y: L.title.sub, 'text-anchor': 'middle', 'font-size': 17, 'font-family': "'EB Garamond', serif", 'font-style': 'italic' }, `as walked by ${c.name}`),
  s('text', { x: L.scale.label.x, y: L.scale.label.y, 'text-anchor': 'middle', 'font-size': 13, 'letter-spacing': '0.08em' }, 'a scale of years'),
  ...L.scale.years.map((y) => s('text', { x: y.x, y: y.y, 'text-anchor': 'middle', 'font-size': 14 }, y.text)),
);
overlay.append(title);
cue.set('title', [title]);

const north = s('text', { class: 'red-lbl', x: L.compass.x, y: L.compass.y, 'text-anchor': 'middle', 'font-size': 20 }, 'N');
const onward = s('text', { class: 'red-lbl', x: L.onward.x, y: L.onward.y, 'text-anchor': 'end', 'font-size': 20 }, 'the road goes on');
overlay.append(north, onward);
cue.set('compass', [north]);
cue.set('onward', [onward]);

const labels = [];
const lastId = stops.at(-1)?.id;
stops.forEach((st, i) => {
  const p = where.get(st.id);
  if (!p) return; // added to journey.js but not rebuilt yet
  const lb = p.label;
  const lines = () => lb.lines.map((t, k) => s('tspan', { x: lb.x, dy: k ? L.label.lineH : null }, t));
  const text = s('text', { class: 'ink', x: lb.x, y: lb.y, 'text-anchor': lb.anchor, 'font-size': L.label.size }, lines());
  // a little paper behind the letters, so a river running under them doesn't cut through
  const halo = s('text', { class: 'halo', x: lb.x, y: lb.y, 'text-anchor': lb.anchor, 'font-size': L.label.size }, lines());
  const g = s('g', { class: 'lbl' }, halo, text);
  if (st.id === lastId) {
    const at = { x: lb.x, y: lb.y + lb.lines.length * L.label.lineH - 4, 'text-anchor': lb.anchor };
    g.append(s('text', { class: 'halo now', ...at }, 'here I am now'), s('text', { class: 'ink now', ...at }, 'here I am now'));
  }
  const hit = s('circle', { class: 'hit', cx: p.x, cy: p.y - 24, r: 34 });
  overlay.append(g, hit);
  labels[i] = g;
  for (const el of [g, hit]) {
    el.addEventListener('pointerenter', () => show(i));
    el.addEventListener('pointerleave', hideSoon);
    el.addEventListener('click', (e) => { e.stopPropagation(); show(i, { pin: true }); });
  }
  cue.set(`stop:${st.id}`, [g]);
});

// ---------- the scene

const letterAll = () => cue.forEach((els) => els.forEach((el) => el.classList.add('on')));
const m = mount($('#canvas'), {
  src: 'journey',
  onLoad: () => {
    if (still) {
      m.set('still', true);
      letterAll();
    }
  },
  onEvent: (name) => {
    cue.get(name)?.forEach((el) => el.classList.add('on'));
    if (name === 'done') letterAll();
    const id = name.startsWith('stop:') && name.slice(5);
    const next = id && L.stops[L.stops.findIndex((p) => p.id === id) + 1];
    if (next) follow(next.x);
  },
});
// reduced motion pauses the scene once drawn; wake it briefly to lift a stop
const nudge = () => {
  if (!reducedMotion) return;
  m.rive.play();
  clearTimeout(nudge.t);
  nudge.t = setTimeout(() => m.rive.pause(), 700);
};

// on a narrow screen the map scrolls sideways: keep the walker in view while
// the road is drawn, until the reader takes over
const scroller = $('#scroller');
let steered = false;
['pointerdown', 'wheel', 'touchstart'].forEach((e) => scroller.addEventListener(e, () => (steered = true), { passive: true }));
function centerOn(x, smooth = true) {
  const scale = map.clientWidth / L.W;
  scroller.scrollTo({ left: x * scale - scroller.clientWidth / 2, behavior: smooth ? 'smooth' : 'auto' });
}
function follow(x) {
  if (!steered && scroller.scrollWidth > scroller.clientWidth + 4) centerOn(x);
}

// ---------- the note card

const card = $('#card');
const KIND = { work: 'a place I worked', project: 'a thing I made', school: 'a place I studied', milestone: 'a milestone' };
let current = -1, pinned = false, hideT;
function show(i, { pin = false, card: withCard = true } = {}) {
  clearTimeout(hideT);
  pinned = pin || (pinned && current === i);
  if (current !== i) labels[current]?.classList.remove('hot');
  document.querySelectorAll('.stop.hot').forEach((li) => li.classList.remove('hot'));
  current = i;
  labels[i]?.classList.add('hot');
  listItems[i]?.classList.add('hot');
  m.set('spot', i + 1);
  nudge();
  if (!withCard || !where.get(stops[i].id)) { card.classList.remove('on'); return; }
  const st = stops[i];
  const p = where.get(st.id);
  $('#card-kind').textContent = KIND[st.kind] || st.kind;
  $('#card-title').textContent = st.title;
  $('#card-role').textContent = st.role || '';
  $('#card-when').textContent = st.when;
  $('#card-note').textContent = st.note;
  const link = $('#card-link');
  const real = st.url && st.url !== '#';
  link.hidden = !real;
  if (real) {
    link.href = st.url;
    link.textContent = `${new URL(st.url).hostname.replace(/^www\./, '')} →`;
  }
  card.hidden = false;
  // beside the landmark and its label, on whichever side has room
  const k = map.clientWidth / L.W;
  const cw = card.offsetWidth, ch = card.offsetHeight;
  const lb = p.label, lw = Math.max(...lb.lines.map((t) => t.length)) * L.label.charW;
  const lx0 = lb.anchor === 'start' ? lb.x : lb.anchor === 'end' ? lb.x - lw : lb.x - lw / 2;
  const x0 = Math.min(p.x - 38, lx0) * k - 14, x1 = Math.max(p.x + 38, lx0 + lw) * k + 14;
  const py = (p.y - 22) * k;
  const right = x1 + cw < map.clientWidth - 8 || x0 - cw < 8;
  card.style.left = `${right ? Math.min(x1, map.clientWidth - cw - 8) : x0 - cw}px`;
  card.style.top = `${Math.max(8, Math.min(map.clientHeight - ch - 8, py - ch * 0.4))}px`;
  card.style.setProperty('--tilt', `${(i % 2 ? 0.9 : -0.9) * (right ? 1 : -1)}deg`);
  card.classList.add('on');
  card.classList.toggle('pinned', pinned);
}
function hide() {
  if (current < 0) return;
  labels[current]?.classList.remove('hot');
  listItems[current]?.classList.remove('hot');
  current = -1;
  pinned = false;
  m.set('spot', 0);
  nudge();
  card.classList.remove('on', 'pinned');
}
function hideSoon() {
  if (pinned) return;
  clearTimeout(hideT);
  hideT = setTimeout(hide, 260);
}
card.addEventListener('pointerenter', () => clearTimeout(hideT));
card.addEventListener('pointerleave', hideSoon);
document.addEventListener('click', (e) => { if (!card.contains(e.target) && !e.target.closest?.('.stop')) hide(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

// ---------- the list: the same stops, in the same order

const GLYPH = {
  work: '<path d="M16 34 L16.8 15 H27.2 L28 34 Z M15.5 15 V10.5 H18.8 V13 H21 V10.5 H23 V13 H25.2 V10.5 H28.5 V15 M19.6 34 V28.5 Q22 25.8 24.4 28.5 V34 M22 10.5 V4 L27 5.2 L22 6.6"/>',
  school: '<path d="M8 34 H36 M10 31 H34 M12 31 V20 M18 31 V20 M26 31 V20 M32 31 V20 M10 20 H34 M8 18.5 L22 10 L36 18.5 Z"/>',
  project: '<path d="M10 34 L22 14 L34 34 Z M22 14 L18.5 34 M22 14 L26 34 M22 14 V6 L29 7.6 L22 9.4"/>',
  milestone: '<path d="M15 33 a5 3.4 0 1 0 0.1 0 M25 33 a5 3.4 0 1 0 0.1 0 M22 26 V4 L29 5.5 L35 4 L34 9 L36 13 L29 13.5 L22 12"/>',
};
const listItems = [];
const ol = $('#stops');
stops.forEach((st, i) => {
  const real = st.url && st.url !== '#';
  const glyph = h('span', { class: 'glyph', 'aria-hidden': 'true' });
  glyph.innerHTML = `<svg viewBox="0 0 44 44"><g fill="#fbf6e8" stroke="#c3392a" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${GLYPH[st.kind] || GLYPH.project}</g><circle cx="22" cy="40" r="3" fill="#c3392a"/></svg>`;
  const btn = where.get(st.id) ? h('button', { class: 'show', type: 'button' }, 'show it on the map') : null;
  const li = h('li', { class: `stop${st.id === lastId ? ' now' : ''}`, id: `stop-${st.id}` },
    glyph,
    h('h3', {}, real ? h('a', { href: st.url }, st.title) : st.title),
    h('p', { class: 'meta' }, st.role ? `${st.role} · ` : '', h('span', { class: 'when' }, st.when)),
    h('p', { class: 'note' }, st.note),
    btn,
  );
  const mapInView = () => {
    const r = map.getBoundingClientRect();
    return r.top < innerHeight * 0.55 && r.bottom > innerHeight * 0.3;
  };
  li.addEventListener('pointerenter', () => show(i, { card: mapInView() }));
  li.addEventListener('pointerleave', hideSoon);
  li.addEventListener('focusin', () => show(i, { card: mapInView() }));
  li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget)) hideSoon(); });
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    map.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    steered = true;
    centerOn(where.get(st.id).x, !reducedMotion);
    setTimeout(() => show(i, { pin: true }), reducedMotion ? 0 : 450);
  });
  ol.append(li);
  listItems[i] = li;
});
