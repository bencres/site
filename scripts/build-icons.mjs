// The site's icon: the B pressed in red wax (paint.js waxSeal, the same seal that closes
// the letter on the hill). Writes site/shared/favicon.svg, and for the browsers and
// phones that won't take an SVG: a 32px PNG, a favicon.ico holding it, and a 180px
// home-screen icon on a square of paper (iOS fills transparency with black).
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { waxSeal } from '../site/paint.js';

const root = resolve(import.meta.dirname, '..');
const shared = join(root, 'site/shared');

const filters = (seed) => `<defs>
<filter id='wet' x='-10%' y='-10%' width='120%' height='120%'><feTurbulence type='fractalNoise' baseFrequency='0.09' numOctaves='2' seed='${seed}'/><feDisplacementMap in='SourceGraphic' scale='2.4'/></filter>
<filter id='grain'><feTurbulence type='fractalNoise' baseFrequency='0.75 0.4' numOctaves='2' seed='${seed + 3}'/><feColorMatrix values='0 0 0 0 .3 0 0 0 0 .24 0 0 0 0 .18 -3 0 0 0 1.5'/><feComposite in2='SourceGraphic' operator='in'/></filter>
<filter id='soft' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='2.2'/></filter>
</defs>`;
const seal = (scale = 1) => waxSeal({ seed: 4, x: 32, y: 33, scale, wet: 'wet', grain: 'grain', blur: 'soft' });
const icon = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${filters(40)}${seal(1.14)}</svg>\n`;
const home = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${filters(40)}<rect width='64' height='64' fill='#F4EBD6'/>${seal(0.92)}</svg>\n`;
writeFileSync(join(shared, 'favicon.svg'), icon);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style><img src="data:image/svg+xml,${encodeURIComponent(svg)}" width="${size}" height="${size}">`);
  await page.waitForTimeout(200);
  return page.screenshot({ omitBackground: true });
}
const png32 = await png(icon, 32);
writeFileSync(join(shared, 'favicon-32.png'), png32);
writeFileSync(join(shared, 'apple-touch-icon.png'), await png(home, 180));
await browser.close();

// favicon.ico, at the site's root where browsers look by default: one 32px image, stored as PNG
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(1, 4);
head.writeUInt8(32, 6);
head.writeUInt8(32, 7);
head.writeUInt16LE(1, 10);
head.writeUInt16LE(32, 12);
head.writeUInt32LE(png32.length, 14);
head.writeUInt32LE(22, 18);
writeFileSync(join(root, 'site/favicon.ico'), Buffer.concat([head, png32]));
console.log('wrote favicon.svg, favicon-32.png, apple-touch-icon.png, favicon.ico');
