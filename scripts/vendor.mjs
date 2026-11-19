// Copies the Rive web runtime out of node_modules so the site has no CDN dependency.
import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const src = join(root, 'node_modules/@rive-app/webgl2');
const out = join(root, 'site/shared/vendor');
mkdirSync(out, { recursive: true });
for (const f of ['rive.js', 'rive.wasm']) copyFileSync(join(src, f), join(out, f));
console.log('vendored @rive-app/webgl2');
