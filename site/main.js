import { mount, holdUntil, holdStart, reducedMotion } from './shared/rive-mount.js';
import { h } from './shared/content.js';
import { arm, drip, wash, bubble, PIGMENTS } from './paint.js';
import { SEASONS, TIMES, when as whenAt } from './when.js';

const when = () => whenAt(params);

const $ = (s) => document.querySelector(s);

// ---------- when is it? the visitor's clock, or a ?season=&time= preview (see when.js)

const params = new URLSearchParams(location.search);
const urlPreview = ['season', 'time', 'day'].some((k) => params.has(k));

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


// ---------- the words are already on the page (scripts/build-page.mjs renders them
// from content.js); this wires them up

const hello = $('#intro .mail');
const post = $('#post');

// ---------- the signpost at the verge: an arm for each room, and one for the post.
// Turning an arm stirs something on the hill:
const REACT = { now: 'puff', work: 'glint', projects: 'shine', writing: 'rustle', elsewhere: 'gust', callers: 'post' };
// on a phone the post stands at the left edge of the painting, and on narrow screens there's
// no room left of the post, so every arm points right
const phone = matchMedia('(max-width: 600px)');
const narrow = matchMedia('(max-width: 860px)');
const signpost = $('#signpost');
const arms = [...signpost.querySelectorAll('.arm')];
const ARMS = arms.map((a) => ({ id: a.hash.slice(1), react: REACT[a.hash.slice(1)], dir: a.classList.contains('l') ? 'l' : 'r' }));
const dirOf = (i) => (narrow.matches ? 'r' : ARMS[i].dir);
const pointArms = () => arms.forEach((a, i) => { a.classList.toggle('l', dirOf(i) === 'l'); a.classList.toggle('r', dirOf(i) === 'r'); });
pointArms();
arms.forEach((link) => link.addEventListener('animationend', () => link.classList.add('settled'), { once: true }));
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

// ---------- a few marks the pen left behind (in the page already; the drip takes the season's colour)

const hillFig = $('.hill');
const dripMark = $('.m-drip');

// ---------- the still: from the first paint, index.html shows the finished painting for
// this season and hour, until the live one is ready to take over. If that took a while,
// the live painting skips drawing itself in (it has been looked at already).

// On a phone, or when the hill has already drawn itself in for this visitor ('quick',
// set in index.html's <head>), the still goes up the moment it's here, the arms go up
// on it straight away, and the live painting takes over later without drawing itself
// in again: it waits until the arms have finished moving and the page is idle, since
// starting it up costs a phone a few frames.

const still = hillFig.querySelector('.still');
const root = document.documentElement;
const quick = root.classList.contains('quick');
// shown: loaded, and put up because the live painting hadn't come yet (index.html)
const stillShown = () => !!still?.isConnected && still.complete && still.naturalWidth > 0 && hillFig.classList.contains('stilled');
const LATE = 1200;
const sinceFirstPaint = () => performance.now() - (performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0);
let live = false;
let armsUp;
const armsDone = new Promise((go) => (armsUp = go));
if (quick) {
  holdStart(Promise.race([
    Promise.all([armsDone, window.turnSettled]).then(() => new Promise((go) => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 1200 }) : setTimeout(go, 300)))),
    new Promise((go) => setTimeout(go, 6000)),
  ]));
}
if (still) {
  const wait = () => (quick ? 0 : Math.max(0, 650 - sinceFirstPaint()));
  const up = () => {
    if (live) return;
    hillFig.classList.add('stilled', 'glazed');
    // if the live painting hasn't come by the time it would have finished drawing in, the arms go up on the still
    if (quick) plant(0);
    else setTimeout(() => !live && stillShown() && plant(0), Math.max(0, LATE - sinceFirstPaint()));
  };
  if (still.complete && still.naturalWidth > 0) setTimeout(up, wait());
  else {
    still.addEventListener('load', () => setTimeout(up, wait()), { once: true });
    // the live painting's downloads (the runtime is most of a megabyte) wait for the still, so
    // on a slow connection the picture comes first; not for long, if the still is slow too
    holdUntil(new Promise((go) => {
      still.addEventListener('load', go, { once: true });
      still.addEventListener('error', go, { once: true });
      setTimeout(go, 2500);
    }));
  }
}
function goLive() {
  live = true;
  if (!stillShown()) return still?.remove();
  // after the live painting's first frame, the still fades from over it
  requestAnimationFrame(() => requestAnimationFrame(() => {
    hillFig.classList.add('live');
    still.addEventListener('transitionend', () => still.remove(), { once: true });
    setTimeout(() => still.remove(), 1500);
  }));
}

// ---------- season & hour on the page: paper warmth, pigments, the sign

const SIGN = {
  morning: 'Good morning! (In whichever sense you mean it.)',
  day: 'Do come in. Mind the step.',
  afternoon: 'Do come in. The bench gets the afternoon sun.',
  dusk: 'The lamps are lit. Do come in.',
  night: 'Late caller? Come in quietly.',
};
// and the sign keeps a hobbit's day: whichever of the seven meals is on, or next
const MEALS = [
  [5, 'Supper’s long cleared away, but there’s always a little something.'],
  [7, 'Breakfast at seven.'],
  [8.5, 'Breakfast is on the table.'],
  [9, 'Second breakfast at nine.'],
  [10.5, 'You’re just in time for second breakfast.'],
  [11, 'Elevenses is at eleven.'],
  [12, 'It is elevenses; there’s a cup for you.'],
  [13, 'Luncheon at one.'],
  [14.5, 'Luncheon is on; pull up a chair.'],
  [16, 'Afternoon tea at four.'],
  [17.5, 'Afternoon tea is poured.'],
  [18, 'Dinner at six.'],
  [20, 'Stay for dinner?'],
  [21, 'Supper at nine.'],
  [23, 'There’s supper, if you’re peckish.'],
  [24, 'Supper’s long cleared away, but there’s always a little something.'],
];
// a named hour (?time=day) stands for the meal that suits it
const MEAL_HOUR = { morning: 9.5, day: 11.5, afternoon: 16.5, dusk: 18.5, night: 21.5 };
const meal = (hour, time) => {
  const h = hour ?? MEAL_HOUR[time];
  return MEALS.find(([until]) => h < until)[1];
};
const SCHEDULE = 'A hobbit’s day: breakfast, second breakfast, elevenses, luncheon, afternoon tea, dinner and supper.';

let state = null;
function paint(next) {
  const season = SEASONS[next.season], time = TIMES[next.time];
  const root = document.documentElement;
  root.dataset.season = season;
  root.dataset.time = time;
  let sign = SIGN[time];
  if (season === 'winter' && (time === 'day' || time === 'afternoon')) sign = 'Knock the snow off your boots and come in.';
  if (regular) sign = 'Oh, it’s you again. You know the way in.';
  $('#sign-text').textContent = `${sign} ${meal(next.hour, time)}`;
  $('#sign').title = SCHEDULE;
  document.querySelectorAll('.room-block .wash').forEach((el, i) => {
    const [col, acc] = PIGMENTS[season][i % 5];
    el.style.backgroundImage = wash({ w: 150, h: 64, color: col, accent: acc, seed: 101 + i * 37 });
  });
  paintArms(next.season);
  dripMark.innerHTML = drip({ seed: 21, color: PIGMENTS[season][2][0], len: 64 });
  // (only on a change: setting even the same src again would restart its loading)
  if (still?.isConnected && still.getAttribute('src') !== `stills/${season}-${time}.webp`) still.src = `stills/${season}-${time}.webp`;
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
// 'fill' rather than 'contain': the canvas is the artboard's shape to within a pixel, and
// filling it exactly keeps the hour's glaze flush with the page's halo around it
const frame = () => (phone.matches ? ['cover', 'centerRight'] : ['fill', 'center']);
const hill = mount($('#hill'), {
  src: 'shire-ii', artboard: 'Hill', fit: frame()[0], align: frame()[1],
  onEvent: (name) => hillEvents[name]?.(),
  onLoad: () => {
    setAll(hill);
    hill.set('regular', regular);
    hill.set('bare', phone.matches);
    const late = stillShown() && (quick || sinceFirstPaint() > LATE);
    if (late) hill.set('still', true);
    try { sessionStorage.setItem('shire-ii:drawn', '1'); } catch {}
    plant(reducedMotion || late ? 0 : 1750);
    hillFig.classList.add('glazed');
    goLive();
  },
});
const gate = mount($('#gate'), { src: 'shire-ii', artboard: 'Gate', fit: 'fill', onLoad: () => { setAll(gate); $('.gate').classList.add('glazed'); } });
narrow.addEventListener('change', () => {
  pointArms();
  paintArms(state.season);
});
phone.addEventListener('change', () => {
  hill.set('bare', phone.matches);
  hill.setLayout(...frame());
  pointArms();
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
    // the last arm has swung up and its lettering is in (style.css), or at once if they don't move
    setTimeout(armsUp, root.classList.contains('known') || reducedMotion ? 0 : 1400);
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
  a.addEventListener('pointerdown', (e) => e.pointerType !== 'mouse' && stir());
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
// A preview (?season= / ?time= / ?day=) holds.
setInterval(() => {
  if (urlPreview) return;
  const next = when();
  if (next.season === state.season && next.time === state.time && meal(next.hour, TIMES[next.time]) === meal(state.hour, TIMES[state.time])) return;
  apply(next);
}, 5 * 60 * 1000);

// email links raise the mailbox flags
for (const a of [hello, post]) {
  const raise = () => { hill.fire('post'); gate.fire('post'); };
  a.addEventListener('mouseenter', raise);
  a.addEventListener('focus', raise);
}

// writing to me is posting a letter: the envelope is taken up and away to the post,
// the flags go up, and then the mail app opens; a moment later there's a fresh one
hello.addEventListener('click', (e) => {
  if (reducedMotion || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || hello.classList.contains('posting')) return;
  e.preventDefault();
  hill.fire('post');
  gate.fire('post');
  hello.classList.add('posting');
  const desk = hello.parentElement;
  sfx(desk, { x: hello.offsetLeft + hello.offsetWidth * 0.78, y: hello.offsetTop + 6, k: 1 }, 'posted!', { spread: 10 });
  setTimeout(() => (location.href = hello.href), 650);
  setTimeout(() => hello.classList.remove('posting'), 2200);
});
// or just take the address. The button keeps its words; "copied!" pops up somewhere around it
// and floats away, the way a knock rises off the door (sfx)
const copy = $('.hello .copy');
// the clipboard API, or the old way for browsers that don't allow it here
async function take(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0;pointer-events:none' }, text);
    document.body.append(field);
    field.select();
    const ok = document.execCommand?.('copy');
    field.remove();
    return !!ok;
  }
}
// the smoke is for the eye; a screen reader is told in words
const heard = h('span', { class: 'visually-hidden', role: 'status' });
copy?.after(heard);
let lastTurn = Math.random();
copy?.addEventListener('click', async () => {
  const ok = await take(copy.dataset.copy);
  const word = ok ? 'copied!' : 'couldn’t copy';
  // somewhere around the link, just clear of it: anywhere on a ring about its middle, never
  // twice in the same quarter, and kept on the page at the sides
  const line = copy.parentElement, half = word.length * 4.5;
  const cx = copy.offsetLeft + copy.offsetWidth / 2, cy = copy.offsetTop + copy.offsetHeight / 2;
  const turn = (lastTurn + 0.25 + Math.random() * 0.5) % 1;
  lastTurn = turn;
  const ring = turn * 2 * Math.PI;
  let x = cx + Math.cos(ring) * (copy.offsetWidth / 2 + half + 4);
  let y = cy + Math.sin(ring) * (copy.offsetHeight / 2 + 12);
  const kept = Math.min(Math.max(x, half + 4), line.clientWidth - half - 4);
  // pulled back over the link by the page's edge: lift it above, or drop it below, instead
  if (Math.abs(kept - x) > 8) y = cy + Math.sign(Math.sin(ring) || 1) * (copy.offsetHeight / 2 + 12);
  x = kept;
  const at = { x, y, k: 1 };
  sfx(line, at, word, { spread: 0 });
  heard.textContent = ok ? `Copied ${copy.dataset.copy}` : 'Couldn’t copy the address';
});

// ---------- knocking at the door
// A knock rattles the door and a little "knock" rises off it. Then someone inside
// calls out, and if you wait, opens up kindly; if you keep knocking, they fling
// the door open, shout, and slam it. (k knocks too, for anyone not pointing.)

const hillFigEl = $('.hill');
// where the door is on screen, inside .hill: the painting is 900×400 and fills its
// canvas on desktop; on phones it's cropped to cover, anchored right
function paintAt(px, py) {
  const c = $('#hill');
  const w = c.clientWidth, h = c.clientHeight;
  let k = w / 900, ox = 0, oy = 0;
  if (phone.matches) {
    k = Math.max(w / 900, h / 400);
    ox = w - 900 * k;
    oy = (h - 400 * k) / 2;
  }
  return { x: c.offsetLeft + ox + px * k, y: c.offsetTop + oy + py * k, k };
}
// a sound, written rather than heard: a word that pops off a spot and floats away
function sfx(host, at, text, { spread = 30, cls = '' } = {}) {
  const el = h('span', { class: `say sfx ${cls}`, 'aria-hidden': 'true' }, text);
  el.style.left = `${at.x + (Math.random() - 0.5) * spread * at.k}px`;
  el.style.top = `${at.y + (Math.random() - 0.5) * spread * 0.5 * at.k}px`;
  el.style.setProperty('--tilt', `${(Math.random() * 16 - 8).toFixed(1)}deg`);
  host.append(el);
  setTimeout(() => el.remove(), 1400);
}
// whoever answers speaks in the same painted bubble, its tail always on the same spot just
// up and right of the door (TAIL px in from the bubble's left edge, unless it had to slide)
const mouthAt = () => paintAt(642, 254);
const TAIL = 18;
const VOICE = { speech: { ink: '2b231c', tint: 'E9B93A', tintA: 0.14 }, angry: { ink: '8e2a18', tint: 'C4503B', tintA: 0.22 } };
let said = 0;
function say(text, { kind = 'speech', ms = 2600 } = {}) {
  const at = mouthAt();
  const el = h('span', { class: `say ${kind}`, role: 'status' }, text);
  el.style.left = `${at.x - TAIL}px`;
  el.style.top = `${at.y}px`;
  hillFigEl.append(el);
  // keep it on the page: slide it left if it would run off the painting's right side
  let tail = TAIL;
  const over = el.offsetLeft + el.offsetWidth - (hillFigEl.clientWidth - 8);
  if (over > 0) {
    el.style.left = `${el.offsetLeft - over}px`;
    tail += over;
  }
  el.style.setProperty('--tail', `${tail}px`);
  el.style.backgroundImage = bubble({ w: el.offsetWidth, h: el.offsetHeight, tail, seed: 7 + said++ * 13, ...VOICE[kind] });
  const gone = setTimeout(() => el.classList.add('gone'), ms);
  const removed = setTimeout(() => el.remove(), ms + 600);
  // take it down early, e.g. when what's said next would sit on top of it
  el.hush = () => {
    clearTimeout(gone);
    clearTimeout(removed);
    el.classList.add('gone', 'hushed');
    setTimeout(() => el.remove(), 250);
  };
  return el;
}
const knockWord = () => sfx(hillFigEl, paintAt(608, 288), 'knock', { spread: 36 });

// idle → (knock) → coming → (wait) welcome, or (knock, knock) angry → idle
let door = { state: 'idle', knocks: 0, timer: 0 };
function knockAt() {
  hill.fire('knock');
  knockWord();
  if (door.state === 'idle') {
    door = { state: 'coming', knocks: 0, timer: setTimeout(answer, 3600), regular: knockedThisWeek() >= 3 };
    setTimeout(() => door.state === 'coming' && (door.bubble = say('I’m coming!', { ms: 2200 })), 500);
  } else if (door.state === 'coming' && ++door.knocks >= 2) {
    clearTimeout(door.timer);
    door.state = 'angry';
    door.bubble?.hush();
    setTimeout(() => {
      hill.fire('slam');
      say('WHAT?!', { kind: 'angry', ms: 1100 });
      // the slam shakes a few leaves off the tree
      setTimeout(() => hill.fire('shake'), 1450);
      setTimeout(() => (door = { state: 'idle', knocks: 0, timer: 0 }), 2600);
    }, 350);
  }
}
// counts this visit's knock, and returns how many times they've knocked in the past week
function knockedThisWeek() {
  const week = 7 * 24 * 3600 * 1000, now = Date.now();
  let times = [];
  try {
    times = (JSON.parse(localStorage.getItem('shire-ii:knocks')) || []).filter((t) => now - t < week);
    times.push(now);
    localStorage.setItem('shire-ii:knocks', JSON.stringify(times.slice(-12)));
  } catch {}
  return times.length;
}
function answer() {
  door.state = 'open';
  hill.fire('welcome');
  const line = door.regular ? 'Back again? The kettle’s on.' : 'Oh, it’s just you. Welcome in, welcome in…';
  setTimeout(() => say(line, { ms: 3200 }), 500);
  setTimeout(() => (door = { state: 'idle', knocks: 0, timer: 0 }), 5200);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'k' && !e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement === document.body) knockAt();
});

// ---------- small things to find
// the chimney blows smoke rings, wobblier the more you ask, and every fifth a heart
let rings = 0, ringsCool = 0;
function chimney() {
  clearTimeout(ringsCool);
  ringsCool = setTimeout(() => (rings = 0), 4000);
  rings++;
  const kind = rings % 5 === 0 ? 'heart' : rings >= 3 ? 'wobble' : 'ring';
  hill.fire(`ring-${kind}`);
  sfx(hillFigEl, paintAt(712, 128), kind === 'heart' ? 'pff ♥' : 'puff', { spread: 20 });
}
const hillEvents = { door: () => knockAt(), chimney };

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

// the painting's season and time layers switch on whole-number poses (spring = 0 ...
// winter = 3, morning = 0 ... night = 4) and cross-fade between them
function apply(next) {
  state = next;
  paint(state);
  for (const m of [hill, gate]) { m.set('season', state.season); m.set('time', state.time); }
}

// ---------- getting about: the signpost's arms (and "back to the signpost") jump within
// the page without writing #room into the address, so the address stays the hill's own and
// Back leaves the hill rather than retracing every jump. A #room someone links to still
// works: the browser goes there, then the address is tidied. Coming back from a post
// (post.js leaves a note) lands on the bookshelves the same way.

function goTo(id, { smooth = true } = {}) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'start' });
  // keyboard and screen-reader users land where they jumped, as with a real #link
  if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
  target.focus({ preventScroll: true });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest?.('a[href^="#"]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const id = a.getAttribute('href').slice(1);
  if (!document.getElementById(id)) return;
  e.preventDefault();
  goTo(id);
});
let returnTo = null;
try {
  returnTo = sessionStorage.getItem('shire-ii:to');
  sessionStorage.removeItem('shire-ii:to');
} catch {}
if (returnTo) goTo(returnTo, { smooth: false });
const tidy = () => location.hash && history.replaceState(history.state, '', location.pathname + location.search);

// once the page has arrived (and any #section in the URL is in place), the signpost's jumps glide
addEventListener('load', () => requestAnimationFrame(() => {
  document.documentElement.classList.add('settled');
  // the fonts may have moved things since the first jump; land on it again, then tidy the address
  if (returnTo) goTo(returnTo, { smooth: false });
  tidy();
}));
addEventListener('hashchange', tidy);
