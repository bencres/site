// A small static server for site/ that behaves like the host: it serves the
// precompressed .br / .gz files written by compress.mjs and applies site/_headers,
// so local measurements reflect production.
// usage: node scripts/serve.mjs [port] [root]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const port = +(process.argv[2] || process.env.PORT || 4173);
const root = path.resolve(process.argv[3] || path.join(import.meta.dirname, '../site'));
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.wasm': 'application/wasm',
  '.riv': 'application/octet-stream', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
};

// _headers: a path pattern (with * wildcards) on its own line, then indented "Name: value" lines
function readHeaders() {
  const rules = [];
  let text = '';
  try { text = fs.readFileSync(path.join(root, '_headers'), 'utf8'); } catch { return rules; }
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const re = new RegExp(`^${line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/:\w+/g, '[^/]+')}$`);
      rules.push({ re, headers: {} });
    } else if (rules.length) {
      const [k, ...v] = line.trim().split(':');
      rules.at(-1).headers[k.trim()] = v.join(':').trim();
    }
  }
  return rules;
}

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
  for (const rule of readHeaders()) if (rule.re.test(url) || rule.re.test(url.endsWith('/') ? `${url}index.html` : url)) Object.assign(headers, rule.headers);
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
  // like a host: anything not given a policy is rechecked, and a recheck of an unchanged
  // file is a 304 (the tag is the file's size and modified time, per encoding)
  headers['Cache-Control'] ??= 'no-cache';
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
