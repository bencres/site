import { mount, reducedMotion } from '../shared/rive-mount.js';
import { content as c, h } from '../shared/content.js';

const R = window.rive;
const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const link = (x) => h('a', { href: x.url }, x.name ?? x.title);

// one spread per section; the plate on the left is drawn by the Rive file in this order
const spreads = [
  { slug: 'contents', title: 'Contents', latin: 'Polypodium vulgare', common: 'common polypody' },
  {
    slug: 'now', title: 'Now', latin: 'Viola odorata', common: 'sweet violet',
    note: 'Flowers early and keeps on flowering; a fair likeness of the present tense.',
    body: () => [
      h('p', { class: 'dropcap' }, `Lately, as of ${c.now.updated}:`),
      h('ul', {}, c.now.items.map((t) => h('li', {}, t))),
    ],
  },
  {
    slug: 'work', title: 'Work', latin: 'Ginkgo biloba', common: 'maidenhair tree',
    note: 'Slow-growing and very hard to kill. Turns gold, eventually.',
    body: () => [
      h('p', { class: 'dropcap' }, 'Where I have put down roots, most recent first.'),
      h('ul', {}, c.work.map((w) => h('li', {}, link(w), h('span', { class: 'meta' }, `, ${w.role.toLowerCase()}`), h('span', { class: 'date' }, w.when)))),
    ],
  },
  {
    slug: 'made', title: 'Things I’ve made', latin: 'Acer saccharum', common: 'sugar maple, with keys',
    note: 'Seeds with wings: small things sent off to see how far they go.',
    body: () => [
      h('p', { class: 'dropcap' }, 'Some of the things I have built and let go of.'),
      h('ul', {}, c.projects.map((p) => h('li', {}, link(p), h('span', { class: 'meta' }, ` — ${p.blurb}`)))),
    ],
  },
  {
    slug: 'writing', title: 'Writing', latin: 'Lavandula angustifolia', common: 'English lavender',
    note: 'Pressed between pages for centuries, to keep them sweet.',
    body: () => [
      h('p', { class: 'dropcap' }, 'Essays and notes, newest at the top. The marked one is a favourite.'),
      h('ul', {}, c.writing.map((w) => h('li', {}, link(w), w.starred ? h('span', { class: 'date', title: 'a favourite' }, '✿') : null, h('span', { class: 'date' }, w.date.toLowerCase())))),
    ],
  },
  {
    slug: 'elsewhere', title: 'Elsewhere', latin: 'Quercus rubra', common: 'red oak, and an acorn',
    note: 'Sends its acorns far afield, with help from squirrels and jays.',
    body: () => [
      h('p', { class: 'dropcap' }, 'Other places you can find me growing:'),
      h('ul', {}, c.elsewhere.map((e) => h('li', {}, link(e)))),
    ],
  },
  {
    slug: 'hello', title: 'Say hello', latin: 'Myosotis sylvatica', common: 'forget-me-not',
    note: 'Self-explanatory.',
    body: () => [
      h('p', { class: 'dropcap' }, 'Letters are always welcome. Write to me at ', h('a', { href: `mailto:${c.email}` }, c.email), ', and I will write back.'),
      h('p', { class: 'meta' }, 'Thank you for leafing through.'),
    ],
  },
];

const pageEl = document.getElementById('page');
const labelEl = document.getElementById('label');
const whereEl = document.getElementById('where');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');

function renderPage(i) {
  const s = spreads[i];
  const runhead = h('header', { class: 'runhead' }, h('span', {}, c.name), h('span', {}, i ? `Plate ${roman[i]} · ${s.title}` : 'A Herbarium'));
  const caption = h('p', { class: 'caption' }, `No. ${roman[i]} — `, h('em', {}, s.latin), ` — ${s.common}`);
  let body;
  if (i === 0) {
    body = [
      h('p', { class: 'kicker' }, 'A herbarium of things made & kept'),
      h('h1', {}, c.name),
      h('p', { class: 'tagline' }, c.tagline),
      caption,
      h('p', { class: 'dropcap' }, c.intro[0]),
      h('ol', { class: 'toc', 'aria-label': 'Contents' }, spreads.slice(1).map((sp, k) => h('li', {},
        h('button', { type: 'button', onclick: () => go(k + 1) },
          h('span', { class: 'num' }, roman[k + 1]), h('span', {}, sp.title), h('span', { class: 'dots', 'aria-hidden': 'true' }), h('span', { class: 'pg' }, String(2 * (k + 1) + 1)))))),
    ];
  } else {
    body = [h('h2', { id: 'title' }, s.title), caption, h('p', { class: 'note' }, h('em', {}, s.latin), `. ${s.note}`), ...s.body()];
  }
  pageEl.replaceChildren(runhead, h('div', { class: 'page-body' }, body), h('footer', { class: 'folio' }, String(2 * i + 1)));
  labelEl.replaceChildren(h('span', { class: 'no' }, `No. ${roman[i]}`), h('em', { class: 'latin' }, s.latin), h('span', { class: 'sec' }, i ? s.title.toLowerCase() : 'frontispiece'));
  whereEl.textContent = `plate ${roman[i]} of ${roman[spreads.length - 1]}`;
  prevBtn.disabled = i === 0;
  nextBtn.disabled = i === spreads.length - 1;
  document.title = i ? `${s.title} · ${c.name} · herbarium` : `${c.name} · herbarium`;
}

// ---------- the book itself
const narrow = matchMedia('(max-width: 760px)');
const layoutFor = () => new R.Layout(narrow.matches
  ? { fit: R.Fit.Cover, alignment: R.Alignment.CenterLeft }
  : { fit: R.Fit.Contain, alignment: R.Alignment.Center });

let cur = Math.max(0, spreads.findIndex((s) => `#${s.slug}` === location.hash));
let busy = false;

const book = mount(document.getElementById('bookcanvas'), {
  src: 'herbarium',
  artboard: 'Book',
  onLoad: (r) => {
    r.layout = layoutFor();
    book.set('spread', cur);
    syncCorners();
  },
  onEvent: (name) => (name === 'next' ? go(cur + 1) : name === 'prev' ? go(cur - 1) : null),
});
narrow.addEventListener('change', () => { book.rive.layout = layoutFor(); book.rive.resizeDrawingSurfaceToCanvas(); });

function syncCorners() {
  book.set('hasPrev', cur > 0);
  book.set('hasNext', cur < spreads.length - 1);
}

// a turn: the words lift off, the leaf crosses the gutter, the next plate is
// swapped in while the leaf covers the left page, then the words settle again
function go(target) {
  if (busy || target === cur || target < 0 || target >= spreads.length) return;
  busy = true;
  const forward = target > cur;
  if (reducedMotion) book.rive.play();
  pageEl.classList.add('out');
  labelEl.classList.add('out');
  setTimeout(() => {
    book.fire(forward ? 'turnNext' : 'turnBack');
    setTimeout(() => book.set('spread', target), forward ? 880 : 190);
    setTimeout(() => {
      cur = target;
      renderPage(cur);
      syncCorners();
      pageEl.classList.remove('out');
      labelEl.classList.remove('out');
      history.replaceState(null, '', cur ? `#${spreads[cur].slug}` : location.pathname);
      busy = false;
      if (narrow.matches) pageEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (reducedMotion) setTimeout(() => book.rive.pause(), 3200);
    }, forward ? 1140 : 1110);
  }, 170);
}

prevBtn.addEventListener('click', () => go(cur - 1));
nextBtn.addEventListener('click', () => go(cur + 1));
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'ArrowRight') go(cur + 1);
  if (e.key === 'ArrowLeft') go(cur - 1);
});

// swipe, like a real page: drag right-to-left to go forward
let touch = null;
const stage = document.getElementById('stage');
stage.addEventListener('touchstart', (e) => { touch = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
stage.addEventListener('touchend', (e) => {
  if (!touch) return;
  const dx = e.changedTouches[0].clientX - touch.x;
  const dy = e.changedTouches[0].clientY - touch.y;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(cur + (dx < 0 ? 1 : -1));
  touch = null;
});

renderPage(cur);
