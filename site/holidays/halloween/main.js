import { mount, reducedMotion } from '../../shared/rive-mount.js';
import { h } from '../../shared/content.js';
import { arm, drip, wash, bubble } from '../../paint.js';
import { SEASONS, TIMES, when as whenAt } from '../../when.js';

const when = () => whenAt(params);

const $ = (s) => document.querySelector(s);

// ---------- the page dressed for Mordor (it's the same page as every other day's): the
// rooms and the signpost's arms are Mordor's places, the letter goes by fell beast, and
// the footer is Shelob's lair
$('#hill').setAttribute('aria-label', 'Barad-dûr in watercolor: the Dark Tower with the lidless Eye burning at its top, Orodruin smoking across the plain of Gorgoroth, and an orc waymark at the verge.');
document.head.append(h('meta', { name: 'theme-color', content: '#2a1f1c' }));
const PLACES = { now: 'the Sammath Naur', work: 'Barad-dûr', projects: 'the pits of Udûn', writing: 'Minas Morgul', elsewhere: ['Ithilien', 'over in Ithilien'], callers: 'by fell beast' };
for (const [id, place] of Object.entries(PLACES)) {
  const [arm, room] = [].concat(place);
  const a = document.querySelector(`#signpost a[href="#${id}"] small`);
  if (a) a.textContent = arm;
  const r = document.querySelector(`#${id} .room`);
  if (r) r.textContent = room || arm;
}
$('#signpost a[href="#elsewhere"]').title = '“There is another way. Dark it is, and difficult to find, and secret.”';
$('.addr .via').textContent = 'by fell beast';
$('.addr .at').textContent = 'at the Dark Tower, Barad-dûr';
$('.board p').replaceChildren('Callers welcome.', h('br'), 'Do stay for dinner.');
$('.road').replaceChildren('In the Land of Mordor', h('br'), 'where the Shadows lie.');

// ---------- when is it? the visitor's clock, or a ?season=&time= preview (see when.js)

const params = new URLSearchParams(location.search);
const urlPreview = ['season', 'time', 'day'].some((k) => params.has(k));

// third visit and after: the hill knows you (a doormat appears, and the arm you took
// last time has a tick inked beside it). Only the door says so out loud, when a regular
// knocks (answer()), so that's the one place it's said
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
// (in Mordor: the Eye blazes, the watch-fire roars, Orodruin spits, a Nazgûl stoops, a gust
// drives the ash, the Red Eye goes up its pole)
const REACT = { now: 'flare', work: 'forge', projects: 'erupt', writing: 'screech', elsewhere: 'gust', callers: 'post' };
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
// Halloween paints with Mordor's box whatever the season: the same pigments pushed toward
// fire and soot (ember, ash, sulphur, old blood, the smoke's dirty violet); the arms are
// boards of ash, and the bubbles grey paper
const BOX = [['D2552B', 'E9A23A'], ['8A7C74', 'C4502A'], ['E2A43A', 'B5402C'], ['9A3424', 'D9852F'], ['6E5E78', 'C4502A']];
const WOOD = { face: 'E9DCC2', faceA: 0.97, edge: '5E3E2C', edgeA: 0.55, edgeW: 1.4, tintA: 0.3 };
const ARM_TINT = (season, i) => (i < 5 ? BOX[i][0] : 'B5402C');
function paintArms(season) {
  const at = (el) => (el.offsetHeight ? (el.offsetWidth / el.offsetHeight) * 40 : 200);
  arms.forEach((a, i) => {
    a.querySelector('svg.paint')?.remove();
    a.insertAdjacentHTML('afterbegin', arm({ w: at(a), dir: dirOf(i), tint: ARM_TINT(SEASONS[season], i), seed: 31 + i * 7, wood: WOOD }));
  });
  back.querySelector('svg.paint')?.remove();
  back.insertAdjacentHTML('afterbegin', arm({ w: at(back), dir: 'l', tint: BOX[0][0], seed: 91, wood: WOOD }));
}

// ---------- a few marks the pen left behind (in the page already; the drip takes the season's colour)

const hillFig = $('.hill');
const dripMark = $('.m-drip');

// (the Shire's site puts up a still of the finished painting until the live one is ready;
// Mordor has no stills, so the live painting simply draws itself in)
const root = document.documentElement;
const stillShown = () => false;
let armsUp;
new Promise((go) => (armsUp = go));
function goLive() {}

// ---------- season & hour on the page: paper warmth, pigments, the sign

const SIGN = {
  morning: 'Another grey morning under the Shadow.',
  day: 'The Eye is upon you. Do come in.',
  afternoon: 'The reek of Orodruin drifts west. Do come in.',
  dusk: 'The watch-fires are lit. Do come in.',
  night: 'Late caller? The Eye does not sleep.',
};
// and the sign keeps the Tower's watches: whichever is on, or next
const WATCHES = [
  [5, 'The dead watch. Something is always awake.'],
  [7, 'The dawn watch takes the walls at seven.'],
  [9, 'The dawn watch is on the walls.'],
  [12, 'The forges of Udûn are lit. Mind the sparks.'],
  [13, 'Rations at one: maggoty bread, as ever.'],
  [15, 'Rations are out. Don’t ask what’s in them.'],
  [18, 'The Nazgûl ride out at six.'],
  [20, 'The Nazgûl are abroad. Keep your head down.'],
  [22, 'The night watch takes the Gate at ten.'],
  [24, 'The night watch has the Gate.'],
];
// a named hour (?time=day) stands for the watch that suits it
const WATCH_HOUR = { morning: 8, day: 11, afternoon: 16, dusk: 19, night: 23 };
const meal = (hour, time) => {
  const h = hour ?? WATCH_HOUR[time];
  return WATCHES.find(([until]) => h < until)[1];
};
const GOOD_MORNING = '“One Ring to rule them all, One Ring to find them, One Ring to bring them all and in the darkness bind them, in the Land of Mordor where the Shadows lie.”';
const SCHEDULE = 'The watches of the Tower: dawn, forge, rations, the riding of the Nine, and the night.';

let state = null;
function paint(next) {
  const season = SEASONS[next.season], time = TIMES[next.time];
  const root = document.documentElement;
  root.dataset.season = season;
  root.dataset.time = time;
  const sign = SIGN[time];
  // the morning sign has the Ring-verse under it for anyone who hovers
  $('#sign-text').replaceChildren(h('span', { title: time === 'morning' ? GOOD_MORNING : null }, sign), ` ${meal(next.hour, time)}`);
  $('#sign').title = SCHEDULE;
  document.querySelectorAll('.room-block .wash').forEach((el, i) => {
    const [col, acc] = BOX[i % 5];
    el.style.backgroundImage = wash({ w: 150, h: 64, color: col, accent: acc, seed: 101 + i * 37 });
  });
  paintArms(next.season);
  dripMark.innerHTML = drip({ seed: 21, color: BOX[3][0], len: 64 });
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
  src: 'halloween', artboard: 'Hill', fit: frame()[0], align: frame()[1],
  onEvent: (name) => hillEvents[name]?.(),
  onLoad: () => {
    setAll(hill);
    hill.set('regular', regular);
    hill.set('bare', phone.matches);
    const late = false;
    try { sessionStorage.setItem('shire-ii:drawn', '1'); } catch {}
    plant(reducedMotion || late ? 0 : 1750);
    hillFig.classList.add('glazed');
    goLive();
  },
});
const gate = mount($('#gate'), { src: 'halloween', artboard: 'Gate', fit: 'fill', onEvent: (name) => gateEvents[name]?.(), onLoad: () => { setAll(gate); $('.gate').classList.add('glazed'); } });
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
  const stir = () => (react === 'screech' ? nazgul(true) : hill.fire(react));
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
// A preview (?season= / ?time= / ?day=, or the almanac's dials) holds.
setInterval(() => {
  if (previewing || ['season', 'time', 'day'].some((k) => params.has(k))) return;
  const next = when();
  if (next.season === state.season && next.time === state.time && meal(next.hour, TIMES[next.time]) === meal(state.hour, TIMES[state.time])) return;
  apply(next);
}, 5 * 60 * 1000);

// email links run the Red Eye up the camp's pole (the one at the gate has none)
for (const a of [hello, post]) {
  const raise = () => hill.fire('post');
  a.addEventListener('mouseenter', raise);
  a.addEventListener('focus', raise);
}

// writing to me is posting a letter: the envelope is taken up and away to the post,
// the hill's flag goes up, and then the mail app opens; a moment later there's a fresh one
hello.addEventListener('click', (e) => {
  if (reducedMotion || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || hello.classList.contains('posting')) return;
  e.preventDefault();
  hill.fire('post');
  hello.classList.add('posting');
  const desk = hello.parentElement;
  sfx(desk, { x: hello.offsetLeft + hello.offsetWidth * 0.78, y: hello.offsetTop + 6, k: 1 }, 'away by fell beast!', { spread: 10 });
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

// ---------- knocking at the Tower's gate
// A knock rattles the iron door and a little "knock" rises off it. Then someone inside
// calls out, and if you wait, the Mouth of Sauron opens up; if you keep knocking, they
// fling the door open, shout, and slam it. (k knocks too, for anyone not pointing.)

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
const mouthAt = () => paintAt(770, 318);
const TAIL = 18;
const VOICE = { speech: { ink: '2b231c', tint: 'D2552B', tintA: 0.16 }, angry: { ink: '8e2a18', tint: 'C4503B', tintA: 0.26 } };
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
  el.style.backgroundImage = bubble({ w: el.offsetWidth, h: el.offsetHeight, tail, seed: 7 + said++ * 13, paper: 'F3EADB', ...VOICE[kind] });
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
const knockWord = () => sfx(hillFigEl, paintAt(744, 338), 'knock', { spread: 30 });

// idle → (knock) → coming → (wait) welcome, or (knock, knock) angry → idle
let door = { state: 'idle', knocks: 0, timer: 0 };
const ANGRY = ['SILENCE!', 'Begone, ere the Eye turns upon you!', 'WHAT?!', 'SILENCE!', 'Back to your hole, maggot!', 'You might try Minas Tirith. They take visitors.'];
let angry = 0;
function knockAt() {
  hill.fire('knock');
  knockWord();
  if (door.state === 'idle') {
    door = { state: 'coming', knocks: 0, timer: setTimeout(answer, 3600), regular: knockedThisWeek() >= 3 };
    setTimeout(() => door.state === 'coming' && (door.bubble = say('Who knocks at the Tower?', { ms: 2200 })), 500);
  } else if (door.state === 'coming' && ++door.knocks >= 2) {
    clearTimeout(door.timer);
    door.state = 'angry';
    door.bubble?.hush();
    setTimeout(() => {
      hill.fire('slam');
      // mostly a bare WHAT?!, sometimes Bilbo's own way of seeing off a caller
      const line = ANGRY[angry++ % ANGRY.length];
      say(line, { kind: 'angry', ms: line.length > 8 ? 2400 : 1100 });
      // the slam shakes a few stones off the ledges
      setTimeout(() => hill.fire('shake'), 1450);
      setTimeout(() => (door = { state: 'idle', knocks: 0, timer: 0 }), line.length > 8 ? 3400 : 2600);
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
  const line = door.regular ? 'Back again? The Eye has seen you.' : 'The Mouth of Sauron bids you welcome… for now.';
  setTimeout(() => say(line, { ms: 3200 }), 500);
  setTimeout(() => (door = { state: 'idle', knocks: 0, timer: 0 }), 5200);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'k' && !e.metaKey && !e.ctrlKey && !e.altKey && document.activeElement === document.body) knockAt();
});

// the hill's password is still in the console, but this door won't have it: say "mellon"
// (friend) anywhere on the page and the Tower only sneers
console.info('%cSpeak, friend, and enter.', "font: 600 22px 'Caveat', cursive; color: #9a3214;");
console.info('%cAsh nazg durbatulûk, ash nazg gimbatul, ash nazg thrakatulûk agh burzum-ishi krimpatul.', "font: italic 15px 'Alegreya', serif; color: #b5402c;");
let spoken = '';
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1 || e.target.closest?.('input, textarea, [contenteditable]')) return;
  spoken = (spoken + e.key.toLowerCase()).slice(-6);
  if (spoken !== 'mellon' || door.state !== 'idle') return;
  spoken = '';
  door = { state: 'open', knocks: 0, timer: 0 };
  hill.fire('knock');
  hill.fire('flare');
  setTimeout(() => say('Elvish? We speak no Elvish here.', { kind: 'angry', ms: 2600 }), 400);
  setTimeout(() => (door = { state: 'idle', knocks: 0, timer: 0 }), 3400);
});

// a line of the book on a few spots: the Eye, the grille in the Tower's door, and (by night)
// the star over the mountains
const SPOTS = [
  { at: [744, 62], r: 26, line: 'The Eye was rimmed with fire, but was itself glazed, yellow as a cat’s, watchful and intent, and the black slit of its pupil opened on a pit, a window into nothing.' },
  { at: [744, 338], r: 9, line: '…the cruel pinnacles and iron crown of the topmost tower of Barad-dûr.' },
  { at: [96, 190], r: 12, line: 'There, peeping among the cloud-wrack above a dark tor high up in the mountains, Sam saw a white star twinkle for a while.', night: true },
];
hillFigEl.addEventListener('pointermove', (e) => {
  const r = hillFigEl.getBoundingClientRect();
  const spot = SPOTS.find((s) => {
    if (s.night && TIMES[state.time] !== 'night') return false;
    const at = paintAt(...s.at);
    return Math.hypot(e.clientX - r.left - at.x, e.clientY - r.top - at.y) < s.r * at.k;
  });
  if (!!spot !== hillFigEl.hasAttribute('title')) hillFigEl.toggleAttribute('title', !!spot);
  if (spot) hillFigEl.title = spot.line;
});

// ---------- small things to find
// Orodruin rumbles when clicked, louder the more you ask, and spits fire; every fifth time
// a ring of gold goes up in its smoke (the ring speaks for itself: no word with it)
let rumbles = 0, rumbleCool = 0;
function doom() {
  clearTimeout(rumbleCool);
  rumbleCool = setTimeout(() => (rumbles = 0), 4000);
  rumbles++;
  hill.fire('erupt');
  if (rumbles % 5 === 0) return setTimeout(() => hill.fire('ring'), 300);
  sfx(hillFigEl, paintAt(500, 160), rumbles >= 3 ? 'BOOM!' : rumbles === 2 ? 'RUMBLE' : 'rumble', { spread: 26, cls: rumbles >= 2 ? 'wide hot' : 'hot' });
}
// click a Nazgûl and it screams, and another stoops at you out of the sky
const SCREAMS = ['SKREEE!', 'skreee…', 'SKRAAAH!'];
let screams = 0;
let screamed = 0;
function nazgul(fromArm) {
  hill.fire('screech');
  if (performance.now() - screamed < 2500) return;
  screamed = performance.now();
  const word = SCREAMS[screams++ % SCREAMS.length];
  // from a click, it rises off where you clicked; called up by an arm, off the stooping beast
  if (fromArm !== true && lastTap) sfx(hillFigEl, lastTap, word, { spread: 14, cls: 'wide cold' });
  else setTimeout(() => sfx(hillFigEl, paintAt(650, 140), word, { spread: 14, cls: 'wide cold' }), 700);
}
// click the Eye and it flares, and you feel it
function eye() {
  hill.fire('flare');
  sfx(hillFigEl, paintAt(744, 104), '…I see you…', { spread: 10, cls: 'whisper' });
}
// where the last click on the painting landed, for the Nazgûl's scream
let lastTap = null;
hillFigEl.addEventListener('pointerdown', (e) => {
  const r = hillFigEl.getBoundingClientRect();
  lastTap = { x: e.clientX - r.left, y: e.clientY - r.top - 18, k: paintAt(0, 0).k };
});
const hillEvents = { door: () => knockAt(), doom, eye, 'nazgul-0': () => nazgul(), 'nazgul-1': () => nazgul() };

// the foot of the page is Shelob's lair: her eyes open in the dark when you reach the bottom.
// The web lets a spider down if you hover it and Shelob reaches out if you click it; behind
// his boulder, Gollum peeps out
const gateFig = $('.gate');
// where something is on the footer's painting (600×210, filling its canvas)
const gateAt = (px, py) => {
  const c = $('#gate'), k = c.clientWidth / 600;
  return { x: c.offsetLeft + px * k, y: c.offsetTop + py * k, k };
};
const gateEvents = {
  shelob: () => sfx(gateFig, gateAt(400, 120), 'hsss…', { spread: 20 }),
  gollum: () => setTimeout(() => sfx(gateFig, gateAt(560, 150), 'gollum!', { spread: 16 }), 500),
};
new IntersectionObserver((entries, io) => {
  if (entries.some((e) => e.isIntersecting)) {
    setTimeout(() => gate.fire('close'), 350);
    io.disconnect();
  }
}, { threshold: 0.6 }).observe($('.gate'));

// ---------- the Eye follows you, anywhere on the page, not only over the painting. The page
// drives the painting's lookX / lookY (0..100, 50 straight ahead; Rive blends the gaze between
// poses at either side) through a critically damped spring, so it turns with a heavy,
// deliberate weight and settles without a wobble. A click snaps it round. On a touch screen it
// looks at what you touch, lingers there, then goes back to slowly scanning, its search
// drifting out from the last place you tapped. With reduced motion it holds still.
const EYE = [744, 62];
(() => {
  const canvas = $('#hill');
  if (reducedMotion) {
    hill.set('lookX', 50);
    hill.set('lookY', 58);
    return;
  }
  const pos = { x: 50, y: 56 }, vel = { x: 0, y: 0 }, sent = { x: -1, y: -1 };
  let pointer = null, moved = -1e9; // a mouse or pen: where, and when it last moved
  let tap = null, tapAt = -1e9; // a touch: where, and when
  let snapUntil = 0, raf = 0, last = 0, lastSend = 0, visible = true;
  // a point on the screen as the Eye sees it: tanh keeps far-off points at the edge of its turn
  const toward = ({ x, y }) => {
    const f = hillFigEl.getBoundingClientRect(), e = paintAt(...EYE);
    return { x: 50 + 50 * Math.tanh((x - f.left - e.x) / 280), y: 50 + 50 * Math.tanh((y - f.top - e.y) / 220) };
  };
  // the slow search, in seconds; it starts out round the last tap and widens back to the plain
  const scan = (s, now) => {
    const u = Math.min(1, Math.max(0, (now - tapAt - 2800) / 7000));
    const home = tap ? toward(tap) : { x: 50, y: 60 };
    const cx = home.x + (50 - home.x) * u, cy = home.y + (60 - home.y) * u, k = 0.35 + 0.65 * u;
    return { x: cx + k * (34 * Math.sin(s * 0.21) + 8 * Math.sin(s * 0.53)), y: cy + k * 13 * Math.sin(s * 0.33 + 1) };
  };
  function target(now) {
    if (now - tapAt < 2800 && tap) return { aim: toward(tap), scanning: false };
    if (pointer && now - moved < 8000) return { aim: toward(pointer), scanning: false };
    return { aim: scan(now / 1000, now), scanning: true };
  }
  function step(now) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    const { aim, scanning } = target(now);
    const snap = now < snapUntil;
    const w = snap ? 9 : 2.4, cap = snap ? 520 : 95;
    for (const a of ['x', 'y']) {
      vel[a] += (w * w * (aim[a] - pos[a]) - 2 * w * vel[a]) * dt;
      vel[a] = Math.max(-cap, Math.min(cap, vel[a]));
      pos[a] += vel[a] * dt;
    }
    // following you, every frame; scanning, at the painting's own 15 a second
    if (!scanning || now - lastSend > 66) {
      lastSend = now;
      for (const [a, name] of [['x', 'lookX'], ['y', 'lookY']]) {
        const v = Math.round(pos[a] * 10) / 10;
        if (Math.abs(v - sent[a]) >= 0.1) hill.set(name, (sent[a] = v));
      }
    }
    const settled = Math.abs(aim.x - pos.x) + Math.abs(aim.y - pos.y) < 0.1 && Math.abs(vel.x) + Math.abs(vel.y) < 0.1;
    if (scanning || !settled) kick();
    else last = 0;
  }
  function kick() {
    if (!raf && visible) raf = requestAnimationFrame(step);
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    last = 0;
    kick();
  }).observe(canvas);
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pointer = { x: e.clientX, y: e.clientY };
    moved = e.timeStamp;
    kick();
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') [tap, tapAt] = [{ x: e.clientX, y: e.clientY }, e.timeStamp];
    else [pointer, moved] = [{ x: e.clientX, y: e.clientY }, e.timeStamp];
    snapUntil = e.timeStamp + 550;
    kick();
  }, { passive: true });
  // the page moving under a still pointer changes where it is from the Eye
  addEventListener('scroll', kick, { passive: true });
  kick();
})();

// it narrows on whatever you reach for: a link, an arm, a button
const reach = (e) => e.target.closest?.('a, button');
let unnarrow = 0;
const squint = (on) => {
  clearTimeout(unnarrow);
  hill.set('narrow', on);
};
document.addEventListener('pointerover', (e) => e.pointerType !== 'touch' && reach(e) && squint(true));
document.addEventListener('pointerout', (e) => e.pointerType !== 'touch' && reach(e) && !reach({ target: e.relatedTarget ?? document.body }) && squint(false));
document.addEventListener('focusin', (e) => reach(e) && squint(true));
document.addEventListener('focusout', () => squint(false));
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch' || !reach(e)) return;
  squint(true);
  unnarrow = setTimeout(() => hill.set('narrow', false), 1200);
});

// left alone for a while, the hill gets on with its day
if (!reducedMotion) {
  const idle = ['gust', 'forge', 'screech', 'gust', 'post', 'erupt'];
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
  almanac?.show(state);
}

// ---------- the almanac, for anyone who finds it: double-click (or double-tap) the middle
// cloud and a card of dials comes up in the corner to paint the hill in any season and light.
// The dials step through the painting's whole-number poses. The same again, or its ×, puts
// it away; "back to now" goes back to the visitor's own clock.
const CLOUDS = [{ x: 404, y: 52, w: 110, h: 28, dx: -20 }, { x: 606, y: 84, w: 90, h: 24, dx: 16 }];
// the middle one of the three (where Orodruin's reek goes up), or on a phone (cropped to the
// Tower, the middle one only just showing at the edge) the one left of the Tower
const cloud = () => CLOUDS[phone.matches ? 1 : 0];
function onCloud(e) {
  const c = cloud(), r = hillFigEl.getBoundingClientRect();
  const a = paintAt(Math.min(c.x, c.x + c.dx) - c.w / 2 - 10, c.y - c.h - 12), b = paintAt(Math.max(c.x, c.x + c.dx) + c.w / 2 + 10, c.y + 12);
  const x = e.clientX - r.left, y = e.clientY - r.top;
  return x >= a.x && x <= b.x && y >= a.y && y <= b.y;
}
let tapped = null;
hillFigEl.addEventListener('pointerup', (e) => {
  if (e.target.closest('a, button') || !onCloud(e)) return (tapped = null);
  if (tapped && e.timeStamp - tapped.t < 450 && Math.hypot(e.clientX - tapped.x, e.clientY - tapped.y) < 40) {
    tapped = null;
    almanac.toggle();
  } else tapped = { t: e.timeStamp, x: e.clientX, y: e.clientY };
});

let previewing = false;
const almanac = (() => {
  const SEASON_WORD = ['spring', 'summer', 'autumn', 'winter'];
  const TIME_WORD = ['morning', 'midday', 'afternoon', 'dusk', 'night'];
  let card = null;
  const dial = (name, max) => {
    const word = h('b');
    const input = h('input', { type: 'range', min: 0, max, step: 1, 'aria-label': name });
    input.addEventListener('input', scrub);
    return { word, input, label: h('label', {}, h('span', {}, `${name} `, word), input) };
  };
  let season, time, now;
  function build() {
    season = dial('season', 3);
    time = dial('time', 4);
    now = h('button', { type: 'button', class: 'now' }, 'back to now');
    now.addEventListener('click', () => {
      // a holiday picked (or put away) in the almanac takes loading the page again
      if (params.has('holiday')) return location.assign(location.pathname);
      previewing = false;
      for (const k of ['season', 'time', 'day']) params.delete(k);
      history.replaceState(history.state, '', location.pathname);
      apply(when());
      card.classList.remove('moved');
    });
    const shut = h('button', { type: 'button', class: 'shut', 'aria-label': 'Put the almanac away' }, '×');
    shut.addEventListener('click', () => toggle(false));
    card = h('aside', { class: 'almanac', 'aria-label': 'Preview a season and time' }, shut, h('p', { class: 'head' }, 'season & time'), season.label, time.label, now);
    card.addEventListener('keydown', (e) => e.key === 'Escape' && toggle(false));
    if (urlPreview || params.has('holiday')) card.classList.add('moved');
    // and the holidays, on any day of the year (fetched only once the card is wanted)
    import('../pick.js').then(({ holidayRow }) => now.before(holidayRow()));
    document.body.append(card);
    show(state);
    void card.offsetWidth;
  }
  function show(s) {
    if (!card) return;
    for (const [d, v, words] of [[season, s.season, SEASON_WORD], [time, s.time, TIME_WORD]]) {
      d.input.value = v;
      d.word.textContent = words[v];
      d.input.setAttribute('aria-valuetext', words[v]);
    }
  }
  function scrub() {
    const next = { season: +season.input.value, time: +time.input.value, hour: null };
    previewing = true;
    card.classList.add('moved');
    if (next.season === state.season && next.time === state.time) return;
    apply(next);
    const q = new URLSearchParams(location.search);
    q.set('season', SEASONS[next.season]);
    q.set('time', TIMES[next.time]);
    q.delete('day');
    history.replaceState(history.state, '', `?${q}`);
  }
  function toggle(open = !card?.classList.contains('open')) {
    if (!card) build();
    card.classList.toggle('open', open);
    card.inert = !open;
  }
  return { show, toggle };
})();

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
