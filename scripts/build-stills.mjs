// Renders the finished Hill for every season and time to site/shire-ii/stills/<season>-<time>.webp,
// so the page can show the painting from its first paint while the live one loads.
//
// Each still is drawn by the same web runtime the page uses, from site/riv/shire-ii.riv,
// exactly as it draws the desktop canvas: 1464×650 (the 732 px canvas at 2x) with
// `fit: fill`, so a still and the canvas match pixel for pixel there. It's the drawn pose
// ('still' set before the first frame, so no intro and no cross-fade) with every loop at
// its start: the live canvas's first frame.
//
// The painting is drawn on a transparent ground, then laid on its hour's paper (--paper in
// site/shire-ii/style.css) exactly as the browser lays the canvas on the page, since flat
// paper is all there is under the canvas (the halo has a hole there; the grain is on top).
// That composites to the same pixels as the canvas, at a quarter of the size: kept, the
// alpha has to be lossless (lossy alpha bands the glazes), and the washes' soft, granular
// edges make it ~150 KB a picture. --transparent keeps it anyway.
//
// Needs Playwright (`npm i -D playwright`, or PLAYWRIGHT=/path/to/playwright/index.mjs) and
// Chrome or Playwright's Chromium. Encodes with cwebp when it's installed, else Chrome's encoder.
//   node scripts/build-stills.mjs [--transparent] [spring-dusk ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const root = resolve(import.meta.dirname, '..');
const OUT = join(root, 'site/shire-ii/stills');
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const TIMES = ['morning', 'day', 'afternoon', 'dusk', 'night'];
const W = 1464, H = 650;
// the ink stays crisp and the granulation survives at this quality
const QUALITY = 82;

const argv = process.argv.slice(2);
const transparent = argv.includes('--transparent');
const only = argv.filter((a) => !a.startsWith('--'));
const jobs = SEASONS.flatMap((season, s) => TIMES.map((time, t) => ({ name: `${season}-${time}`, s, t }))).filter((j) => !only.length || only.includes(j.name));

const vendor = ['site/shared/vendor/2.51.0', 'site/shared/vendor'].map((d) => join(root, d)).find((d) => existsSync(join(d, 'rive.js')));
if (!vendor) throw new Error('no vendored Rive runtime: run `npm run vendor` first');
const riv = join(root, 'site/riv/shire-ii.riv');

// the paper for each time: :root's --paper, unless [data-time='...'] sets its own
const css = readFileSync(join(root, 'site/shire-ii/style.css'), 'utf8');
const base = css.match(/:root\s*\{[^}]*--paper:\s*(#[0-9a-f]{6})/i)?.[1];
if (!base) throw new Error('no --paper in site/shire-ii/style.css');
const PAPER = TIMES.map((t) => css.match(new RegExp(`\\[data-time='${t}'\\]\\s*\\{[^}]*--paper:\\s*(#[0-9a-f]{6})`, 'i'))?.[1] || base);

let cwebp = null;
try {
  execFileSync('cwebp', ['-version'], { stdio: 'ignore' });
  cwebp = 'cwebp';
} catch {}

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const args = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const page = await browser.newPage();

// a page of our own, so nothing but the runtime and the painting are on it
const ORIGIN = 'http://stills.local';
const files = {
  '/': ['text/html', '<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent">'],
  '/rive.js': ['text/javascript', readFileSync(join(vendor, 'rive.js'))],
  '/rive.wasm': ['application/wasm', readFileSync(join(vendor, 'rive.wasm'))],
};
await page.route(`${ORIGIN}/**`, (r) => {
  const f = files[new URL(r.request().url()).pathname];
  return f ? r.fulfill({ contentType: f[0], body: f[1] }) : r.fulfill({ status: 404 });
});
await page.goto(`${ORIGIN}/`);
await page.addScriptTag({ url: `${ORIGIN}/rive.js` });
await page.evaluate(async ({ bytes, W, H }) => {
  const R = window.rive;
  R.RuntimeLoader.setWasmUrl('/rive.wasm');
  const rt = await R.RuntimeLoader.awaitInstance();
  const file = await rt.load(new Uint8Array(bytes));
  window.render = ({ s, t, paper, encode }) => {
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const renderer = rt.makeRenderer(canvas, true);
    const ab = file.artboardByName('Hill');
    const sm = new rt.StateMachineInstance(ab.stateMachineByName('Main'), ab);
    const values = { season: s, time: t, still: true };
    for (let i = 0; i < sm.inputCount(); i++) {
      const input = sm.input(i);
      if (!(input.name in values)) continue;
      if (input.type === rt.SMIInput.bool) input.asBool().value = values[input.name];
      else input.asNumber().value = values[input.name];
    }
    sm.advanceAndApply(0);
    ab.advance(0);
    renderer.clear();
    renderer.save();
    renderer.align(rt.Fit.fill, rt.Alignment.center, { minX: 0, minY: 0, maxX: W, maxY: H }, ab.bounds);
    ab.draw(renderer);
    renderer.restore();
    renderer.flush();
    rt.resolveAnimationFrame();
    sm.delete();
    ab.delete();
    renderer.delete?.();
    let out = canvas;
    if (paper) {
      // source-over onto the paper, as the page composites the canvas
      out = Object.assign(document.createElement('canvas'), { width: W, height: H });
      const g = out.getContext('2d');
      g.fillStyle = paper;
      g.fillRect(0, 0, W, H);
      g.drawImage(canvas, 0, 0);
    }
    return out.toDataURL(encode === 'png' ? 'image/png' : 'image/webp', encode);
  };
}, { bytes: [...readFileSync(riv)], W, H });

mkdirSync(OUT, { recursive: true });
const tmp = join(tmpdir(), `stills-${process.pid}.png`);
let total = 0;
for (const j of jobs) {
  const paper = transparent ? null : PAPER[j.t];
  const url = await page.evaluate((a) => window.render(a), { s: j.s, t: j.t, paper, encode: cwebp ? 'png' : QUALITY / 100 });
  const bytes = Buffer.from(url.split(',')[1], 'base64');
  const out = join(OUT, `${j.name}.webp`);
  if (cwebp) {
    writeFileSync(tmp, bytes);
    execFileSync(cwebp, ['-quiet', '-q', String(QUALITY), '-m', '6', '-sharp_yuv', ...(transparent ? ['-alpha_q', '100'] : ['-noalpha']), tmp, '-o', out]);
  } else {
    writeFileSync(out, bytes);
  }
  const size = statSync(out).size;
  total += size;
  console.log(`${j.name}.webp  ${(size / 1024).toFixed(1)} KB${paper ? `  on ${paper}` : ''}`);
}
if (cwebp) rmSync(tmp, { force: true });
console.log(`${jobs.length} stills, ${(total / 1024).toFixed(0)} KB`);
await browser.close();
