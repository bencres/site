// A small static server for site/ that behaves like the host: it serves the
// precompressed .br / .gz files written by compress.mjs and applies the headers and
// redirects in vercel.json, so local measurements reflect production.
// usage: node scripts/serve.mjs [port] [root]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = +(process.argv[2] || process.env.PORT || 4173);
const root = path.resolve(process.argv[3] || path.join(import.meta.dirname, '../site'));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
  '.riv': 'application/octet-stream', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.pdf': 'application/pdf', '.ico': 'image/x-icon',
};

// vercel.json's sources, in the subset of path-to-regexp it uses: (.*), :name, :name*
// and :name(a|b), each as a regex with its named parts
function pattern(source) {
  const names = [];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const token = /\/:(\w+)\*|:(\w+)(\([^)]*\))?|\(\.\*\)/g;
  let re = '', at = 0;
  for (const m of source.matchAll(token)) {
    re += esc(source.slice(at, m.index));
    at = m.index + m[0].length;
    if (m[1]) re += '(?:/(.*))?', names.push(m[1]);
    else if (m[2]) re += m[3] || '([^/]+)', names.push(m[2]);
    else re += '(.*)', names.push(String(names.length));
  }
  re += esc(source.slice(at));
  return { re: new RegExp(`^${re}/?$`), names };
}
const config = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '../vercel.json'), 'utf8'));
const headerRules = (config.headers || []).map((r) => ({ ...pattern(r.source), headers: Object.fromEntries(r.headers.map((h) => [h.key, h.value])) }));
const redirects = (config.redirects || []).map((r) => ({ ...pattern(r.source), to: r.destination, code: r.permanent ? 308 : 307 }));

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  for (const r of redirects) {
    const m = url.match(r.re);
    if (m) return res.writeHead(r.code, { Location: r.names.reduce((to, n, i) => to.replace(new RegExp(`:${n}\\*?`), m[i + 1] ?? ''), r.to) }).end();
  }
  let file = path.join(root, url);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    if (fs.statSync(file).isDirectory()) {
      if (!url.endsWith('/')) return res.writeHead(301, { Location: `${url}/` }).end();
      file = path.join(file, 'index.html');
    }
  } catch {}
  if (!fs.existsSync(file)) return res.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');

  const headers = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', Vary: 'Accept-Encoding' };
  for (const rule of headerRules) if (rule.re.test(url)) Object.assign(headers, rule.headers);
  const accepts = req.headers['accept-encoding'] || '';
  let body = file;
  for (const [enc, ext] of [['br', '.br'], ['gzip', '.gz']]) {
    // a copy older than its original is stale (edited since the last build), so it's skipped
    if (accepts.includes(enc) && fs.existsSync(file + ext) && fs.statSync(file + ext).mtimeMs >= fs.statSync(file).mtimeMs) {
      body = file + ext;
      headers['Content-Encoding'] = enc;
      break;
    }
  }
  // like Vercel: anything not given a policy is rechecked, and a recheck of an unchanged
  // file is a 304 (the tag is the file's size and modified time, per encoding)
  headers['Cache-Control'] ??= 'public, max-age=0, must-revalidate';
  const st = fs.statSync(body);
  headers.ETag = `"${st.size.toString(36)}-${Math.round(st.mtimeMs).toString(36)}${headers['Content-Encoding'] ? '-' + headers['Content-Encoding'] : ''}"`;
  if (req.headers['if-none-match'] === headers.ETag) {
    delete headers['Content-Length'];
    return res.writeHead(304, headers).end();
  }
  headers['Content-Length'] = st.size;
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(body).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}/`));
