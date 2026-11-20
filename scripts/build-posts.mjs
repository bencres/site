// Renders posts/*.md into site/blog/<slug>/index.html, in the hill's
// hand: same paper, type and palette, a sketch at the top, and code coloured
// in inks. Front matter is the bencres.dev format plus two optional fields:
//   sketch:  the artboard in site/riv/sketches.riv drawn above the post
//   caption: a hand-lettered line under the sketch
// Images referenced as /blog-images/<file> (as on bencres.dev) are read from
// posts/images/ and written beside the posts as WebP at a few widths (cwebp).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { join, resolve, basename, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Marked } from 'marked';
import hljs from 'highlight.js';

const root = resolve(import.meta.dirname, '..');
const srcDir = join(root, 'posts');
const outDir = join(root, 'site/blog');
const SITE = 'https://www.bencres.dev'; // for the canonical and link-preview addresses

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- images: screenshots, pinned in the column
const WIDTHS = [640, 960, 1280];
// the image's width: the column less its padding and the pinned frame, at most 596px
const SIZES = '(max-width: 640px) calc(100vw - 44px), 596px';
const QUALITY = 85; // UI text stays crisp; sharp_yuv keeps coloured edges clean

// pixel size from a PNG or JPEG header
function imageSize(file) {
  const b = readFileSync(file);
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length; ) {
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  throw new Error(`can't read the size of ${file} (PNG or JPEG only)`);
}

// each source image as WebP at every width up to its own, encoded only when the source changed
function buildImages(src, out) {
  const made = new Map();
  if (!existsSync(src)) return made;
  mkdirSync(out, { recursive: true });
  const keep = new Set();
  for (const f of readdirSync(src).filter((f) => /\.(png|jpe?g)$/i.test(f))) {
    const file = join(src, f);
    const { w, h } = imageSize(file);
    const name = basename(f, extname(f));
    const widths = WIDTHS.filter((x) => x < w);
    if (widths.length < WIDTHS.length) widths.push(Math.min(w, WIDTHS.at(-1)));
    const variants = widths.map((x) => ({ w: x, file: `${name}-${x}.webp` }));
    for (const v of variants) {
      const dest = join(out, v.file);
      keep.add(v.file);
      if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(file).mtimeMs) continue;
      const resize = v.w < w ? ['-resize', String(v.w), '0'] : [];
      try {
        execFileSync('cwebp', ['-quiet', '-q', String(QUALITY), '-m', '6', '-sharp_yuv', '-metadata', 'none', ...resize, file, '-o', dest]);
      } catch (e) {
        throw new Error(`cwebp couldn't encode ${f} (brew install webp): ${e.message}`);
      }
    }
    const big = variants.at(-1);
    made.set(f, { variants, w: big.w, h: Math.round((h * big.w) / w) });
  }
  // drop anything a renamed or removed image left behind
  for (const f of readdirSync(out)) if (!keep.has(f)) rmSync(join(out, f));
  return made;
}

const images = buildImages(join(srcDir, 'images'), join(outDir, 'images'));
let imageIndex = 0; // within a post: the first image loads straight away, the rest as you near them

function frontMatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('[')) v = JSON.parse(v);
    else if (v.startsWith('"')) v = JSON.parse(v);
    meta[kv[1]] = v;
  }
  return { meta, body: text.slice(m[0].length) };
}

const marked = new Marked({
  gfm: true,
  renderer: {
    // the post's own title is the page's h1, so its sections start at h2
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const level = Math.min(6, depth + 1);
      const id = text.replace(/<[^>]+>/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return `<h${level} id="${id}">${text}</h${level}>\n`;
    },
    code({ text, lang }) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      const html = hljs.highlight(text, { language }).value;
      // pinned to the page like the screenshots, its language pencilled underneath
      const label = language === 'plaintext' ? '' : `<figcaption>${language}</figcaption>`;
      return `<figure class="pinned code"><pre class="ink-code" tabindex="0"><code class="hljs language-${language}">${html}</code></pre>${label}</figure>\n`;
    },
    // an image is pinned to the page like a photo, its alt text as the caption
    image({ href, title, text }) {
      const local = href.match(/^\/blog-images\/(.+)$/);
      const img = local && images.get(local[1]);
      if (local && !img) throw new Error(`no image posts/images/${local[1]}`);
      const lazy = imageIndex++ > 0 ? ' loading="lazy"' : '';
      const attrs = img
        ? `src="../images/${img.variants.at(-1).file}" srcset="${img.variants.map((v) => `../images/${v.file} ${v.w}w`).join(', ')}" sizes="${SIZES}" width="${img.w}" height="${img.h}"`
        : `src="${esc(href)}"`;
      return `<figure class="pinned"><img ${attrs} alt="${esc(text)}"${lazy} decoding="async"${title ? ` title="${esc(title)}"` : ''}>${text ? `<figcaption>${esc(text)}</figcaption>` : ''}</figure>`;
    },
    // a paragraph holding only an image shouldn't wrap the figure in <p>
    paragraph({ tokens }) {
      const inner = this.parser.parseInline(tokens);
      return tokens.length === 1 && tokens[0].type === 'image' ? `${inner}\n` : `<p>${inner}</p>\n`;
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:/.test(href);
      return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${external ? ' rel="noopener"' : ''}>${text}</a>`;
    },
  },
});

// the body face (upright Alegreya at 400), fetched alongside the CSS rather than after it,
// but queued behind the render-blocking files so it never delays the first paint
function bodyFont() {
  const css = join(root, 'site/shared/fonts.css');
  if (!existsSync(css)) return null;
  for (const face of readFileSync(css, 'utf8').match(/@font-face\s*{[^}]*}/g) || []) {
    const weights = face.match(/font-weight:\s*(\d+)(?:\s+(\d+))?/);
    const src = face.match(/url\(['"]?([^'")]+\.woff2)/);
    if (!/font-family:\s*['"]?Alegreya['"]?\s*;/.test(face) || /font-style:\s*italic/.test(face) || !weights || !src) continue;
    if (+weights[1] <= 400 && 400 <= +(weights[2] || weights[1])) return new URL(src[1], 'https://x/shared/').pathname.slice(1);
  }
  return null;
}
const font = bodyFont();
const FONT_PRELOAD = font ? `  <link rel="preload" href="../../${font}" as="font" type="font/woff2" crossorigin>\n` : '';
if (!font) console.warn('no upright Alegreya 400 in site/shared/fonts.css yet: posts go without the font preload');

const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function page({ slug, meta, html }) {
  const title = esc(meta.title);
  const tags = (meta.tags || []).map((t) => `<li>${esc(t)}</li>`).join('');
  const sketch = meta.sketch
    ? `<figure class="sketch"><canvas id="sketch" data-artboard="${esc(meta.sketch)}" aria-hidden="true"></canvas>${meta.caption ? `<figcaption>${esc(meta.caption)}</figcaption>` : ''}</figure>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Ben Cressman</title>
  <meta name="description" content="${esc(meta.excerpt || '')}">
  <link rel="canonical" href="${SITE}/blog/${slug}/">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${esc(meta.excerpt || '')}">
  <meta property="og:url" content="${SITE}/blog/${slug}/">
  <meta property="og:image" content="${SITE}/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="../../shared/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="../../shared/fonts.css">
  <link rel="stylesheet" href="../../shared/base.css">
  <link rel="stylesheet" href="../../shared/turn.css">
  <link rel="stylesheet" href="../../post.css">
  <link rel="stylesheet" href="../../wash.css">
  <script src="../../shared/turn.js"></script>
${FONT_PRELOAD}${meta.sketch ? '  <link rel="modulepreload" href="../../shared/rive-mount.js">\n' : ''}</head>
<body class="paper">
  <div class="col">
    <nav class="trail"><a href="../../#writing" class="home">← back to the bookshelves</a></nav>
    ${sketch}
    <header class="title">
      <p class="kicker">from the bookshelves · <time datetime="${esc(meta.date)}">${longDate(meta.date)}</time></p>
      <h1>${title}</h1>
      ${meta.excerpt ? `<p class="excerpt">${esc(meta.excerpt)}</p>` : ''}
      ${tags ? `<ul class="tags" aria-label="Tags">${tags}</ul>` : ''}
    </header>
    <article class="prose">
${html}
    </article>
    <footer class="end">
      <p><a href="../../#writing" class="home">← back to the bookshelves</a></p>
      <p class="write">Thoughts on this one? <a href="mailto:hello@bencres.dev?subject=${encodeURIComponent(meta.title)}">Write to me</a>.</p>
    </footer>
  </div>
  <script type="module" src="../../post.js"></script>
  <script type="module" src="../../shared/turn-tune.js"></script>
</body>
</html>
`;
}

for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.md'))) {
  const slug = basename(file, '.md');
  const { meta, body } = frontMatter(readFileSync(join(srcDir, file), 'utf8'));
  imageIndex = 0;
  const html = marked.parse(body);
  mkdirSync(join(outDir, slug), { recursive: true });
  writeFileSync(join(outDir, slug, 'index.html'), page({ slug, meta, html }));
  console.log(`post ${slug}`);
}
