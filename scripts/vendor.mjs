// Copies the Rive web runtime out of node_modules so the site has no CDN dependency.
// It goes in a folder named for its version, so it can be cached forever, and
// rive.js is minified with terser (esbuild's wrapper would break window.rive).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { minify } from 'terser';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'node_modules/@rive-app/webgl2');
const { version } = JSON.parse(readFileSync(join(src, 'package.json'), 'utf8'));
const vendor = join(root, 'site/shared/vendor');
// older versions (and the unversioned copy from before) go, so only one is ever published
for (const f of readdirSync(vendor, { withFileTypes: true }).filter((f) => f.name !== version)) rmSync(join(vendor, f.name), { recursive: true, force: true });
const out = join(vendor, version);
mkdirSync(out, { recursive: true });

copyFileSync(join(src, 'rive.wasm'), join(out, 'rive.wasm'));
const { code } = await minify(readFileSync(join(src, 'rive.js'), 'utf8'), {
  compress: { passes: 2 },
  mangle: true,
  format: { comments: false },
});
writeFileSync(join(out, 'rive.js'), code);
console.log(`vendored @rive-app/webgl2 ${version} (rive.js ${(code.length / 1024).toFixed(0)} KB minified)`);
