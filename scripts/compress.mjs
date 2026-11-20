// The last build step: writes a brotli (.br) and a gzip (.gz) copy beside every
// text-like file and Rive asset in site/, for hosts (and scripts/serve.mjs) that
// serve precompressed files. Unchanged files keep their copies.
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const site = resolve(import.meta.dirname, '../site');
const EXT = new Set(['.wasm', '.riv', '.js', '.css', '.html', '.json', '.svg']);

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const files = walk(site);
let n = 0, raw = 0, br = 0;
for (const file of files) {
  // a copy whose original is gone goes too
  if (/\.(br|gz)$/.test(file)) {
    if (!existsSync(file.slice(0, -3))) rmSync(file);
    continue;
  }
  if (!EXT.has(extname(file))) continue;
  const mtime = statSync(file).mtimeMs;
  const fresh = (out) => existsSync(out) && statSync(out).mtimeMs >= mtime;
  const buf = readFileSync(file);
  if (!fresh(`${file}.br`)) {
    writeFileSync(`${file}.br`, brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }));
    n++;
  }
  if (!fresh(`${file}.gz`)) writeFileSync(`${file}.gz`, gzipSync(buf, { level: 9 }));
  raw += buf.length;
  br += statSync(`${file}.br`).size;
}
console.log(`compressed ${n} changed files; ${(raw / 1024).toFixed(0)} KB → ${(br / 1024).toFixed(0)} KB brotli`);
