// Renders the hill page's words into site/index.html from
// site/shared/content.js, so the page reads (and lays out) before any script runs.
// main.js then only enhances it: the arms' paint, the washes, the season's drip,
// and everything that moves. Each generated part sits between a pair of markers,
//   <!-- build:name --> ... <!-- /build:name -->
// so the page stays hand-editable and the build can be run again.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { content as c } from '../site/shared/content.js';
import { upright, splotch, flick, hatch, icon, letter } from '../site/paint.js';

const root = resolve(import.meta.dirname, '..');
const page = join(root, 'site/index.html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const a = (href, text, attrs = '') => `<a href="${esc(href)}"${attrs}>${esc(text)}</a>`;
// a line of copy, where [text](https://…) is a link (opening in a new tab, like the projects)
const prose = (s) => esc(s).replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_, text, url) => `<a href="${url}" target="_blank" rel="noopener">${text}</a>`);
// an ink mark (main.js fades it in); its SVG is drawn now unless the season decides it
const mark = (cls, svg = '') => `<span class="mark ${cls}" aria-hidden="true">${svg}</span>`;

// the rooms of the house, in the order the signpost points to them. `react` (what
// stirs on the hill when you turn the arm) lives in main.js, keyed by id
const ROOMS = [
  { id: 'now', title: 'Now', room: 'by the fire', items: c.now.items.map(prose) },
  { id: 'work', title: 'Work', room: 'the study', mark: mark('m-blot', splotch({ seed: 5, dir: 2.5 })),
    // the places I've worked, named but not linked
    items: c.work.map((w) => `<strong>${esc(w.name)}</strong>, ${esc(w.role)} <span class="when">${esc(w.when)}</span>`) },
  { id: 'projects', title: 'Projects', room: 'the workshop', mark: mark('m-drip'), items: c.projects.map((p) => `${p.url && p.url !== '#' ? a(p.url, p.name, ' target="_blank" rel="noopener"') : `<strong>${esc(p.name)}</strong>`}: ${esc(p.blurb)}`) },
  { id: 'writing', title: 'Writing', room: 'the bookshelves', mark: mark('m-hatch', hatch({ seed: 4, n: 5, cross: true })),
    items: c.writing.map((w) => `${a(w.url, w.title)}${w.starred ? '<span class="star" title="A favorite"> ✦</span>' : ''} <span class="when">${esc(w.date)}</span>`) },
  { id: 'elsewhere', title: 'Elsewhere', room: 'out the back gate', arm: 'yonder', inline: true, mark: mark('m-spatter', splotch({ seed: 12, dir: -0.5, size: 0.6, spatter: 10 })),
    items: c.elsewhere.map((l, i) => `<a href="${esc(l.url)}" class="badge" target="_blank" rel="me noopener"><span class="mark-icon">${icon({ kind: l.name.toLowerCase(), seed: 61 + i * 13 })}</span><span class="label">${esc(l.name)}</span></a>`) },
];
// the signpost: an arm for each room (Elsewhere points back over the hill), and one for the post
const ARMS = [
  ...ROOMS.map((rm) => ({ id: rm.id, title: rm.title, sub: rm.arm || rm.room, dir: rm.id === 'elsewhere' ? 'l' : 'r' })),
  { id: 'callers', title: 'Post', sub: 'at the gate', dir: 'r' },
];
const TILT = [-2.2, 1.6, -1.1, 2.2, -2.6, 5.5];

const parts = {
  name: esc(c.name),
  // saying hello is writing a letter: a sealed packet addressed to the hill, which posts itself (main.js)
  intro: [
    ...c.intro.map((p) => `<p>${prose(p)}</p>`),
    `<p class="hello">Say hello any time: <button type="button" class="copy" data-copy="${esc(c.email)}">or copy the address</button></p>`,
    `<div class="post-desk"><a href="mailto:${esc(c.email)}" class="letter mail" aria-label="Write to me at ${esc(c.email)}">${letter({ seed: 17 })}<span class="addr" aria-hidden="true"><span class="via">by Quick Post</span><span class="to">To <span class="em">${esc(c.email)}</span></span><span class="at">at the round green door, Under-Hill</span></span></a></div>`,
  ].join('\n'),
  rooms: ROOMS.map((rm) => `<section class="room-block" aria-labelledby="${rm.id}"><h2 id="${rm.id}"><span class="wash" aria-hidden="true"></span><span class="title">${esc(rm.title)}</span><span class="room">${esc(rm.room)}</span>${rm.note ? `<small>${esc(rm.note)}</small>` : ''}${rm.mark || ''}</h2><ul class="${rm.inline ? 'knobs inline' : 'knobs'}">
${rm.items.map((it) => `<li>${it}</li>`).join('\n')}
</ul></section>`).join('\n'),
  signpost: [
    `<span class="upright" aria-hidden="true">${upright({ w: 26, h: 262, seed: 7 })}</span>`,
    ...ARMS.map((arm, i) => `<a href="#${arm.id}" class="arm ${arm.dir}" style="--i:${i}; --tilt:${TILT[i]}deg"><b>${esc(arm.title)}</b> <small>${esc(arm.sub)}</small></a>`),
  ].join('\n'),
  flick: mark('m-flick', flick({ seed: 9 })),
  post: a(`mailto:${c.email}`, c.email, ' id="post"'),
  // Before first paint: the visitor's season and hour (when.js, inlined) go on <html>
  // for the paper and inks, and the hill's finished painting is shown as a still
  // until the live one is ready (main.js swaps them)
  early: `<script>(() => {
${readFileSync(join(root, 'site/when.js'), 'utf8').replace(/^\/\/.*\n/gm, '').replace(/^export /gm, '').trim()}
const s = when(new URLSearchParams(location.search));
const root = document.documentElement;
root.dataset.season = SEASONS[s.season];
root.dataset.time = TIMES[s.time];
// whether the still goes up at once: on a phone (where the live painting is a long way
// off on a cold load), or when the hill has already drawn itself in for this visitor
let known = false;
try { known = !!sessionStorage.getItem('shire-ii:drawn'); } catch {}
root.classList.toggle('known', known);
root.classList.toggle('quick', known || matchMedia('(max-width: 600px)').matches);
window.__still = \`stills/\${SEASONS[s.season]}-\${TIMES[s.time]}.webp\`;
document.head.append(Object.assign(document.createElement('link'), { rel: 'preload', as: 'image', href: window.__still, fetchPriority: 'high' }));
})();</script>`,
  still: `<script>(() => {
const still = document.currentScript.previousElementSibling;
still.src = window.__still;
// the still only shows if the live painting isn't there within a moment; on a quick
// load the painting draws itself in, as it always has, with no picture before it.
// On a phone, or coming back, it goes up as soon as it's here (main.js)
const hill = still.closest('.hill');
if (!document.documentElement.classList.contains('quick')) setTimeout(() => still.isConnected && !hill.classList.contains('live') && hill.classList.add('stilled'), 650);
})();</script>`,
};

let html = readFileSync(page, 'utf8');
for (const [name, body] of Object.entries(parts)) {
  const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?(<!-- /build:${name} -->)`);
  if (!re.test(html)) throw new Error(`index.html has no build:${name} markers`);
  html = html.replace(re, (_, open, close) => `${open}${body}${close}`);
}
writeFileSync(page, html);
console.log('rendered site/index.html');
