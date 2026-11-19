// Renders posts/*.md into site/shire-ii/blog/<slug>/index.html, in the hill's
// hand: same paper, type and palette, a sketch at the top, and code coloured
// in inks. Front matter is the bencres.dev format plus two optional fields:
//   sketch:  the artboard in site/riv/sketches.riv drawn above the post
//   caption: a hand-lettered line under the sketch
// Images referenced as /blog-images/<file> (as on bencres.dev) are read from
// posts/images/ and copied beside the posts.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { Marked } from 'marked';
import hljs from 'highlight.js';

const root = resolve(import.meta.dirname, '..');
const srcDir = join(root, 'posts');
const outDir = join(root, 'site/shire-ii/blog');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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
      const src = href.replace(/^\/blog-images\//, '../images/');
      return `<figure class="pinned"><img src="${esc(src)}" alt="${esc(text)}" loading="lazy" decoding="async"${title ? ` title="${esc(title)}"` : ''}>${text ? `<figcaption>${esc(text)}</figcaption>` : ''}</figure>`;
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
  <link rel="icon" href="../../../shared/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400;0,500;0,700;1,400&family=Caveat:wght@500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../../shared/base.css">
  <link rel="stylesheet" href="../../../shared/turn.css">
  <link rel="stylesheet" href="../../post.css">
  <script src="../../../shared/turn.js"></script>
</head>
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
  <script src="../../../shared/vendor/rive.js"></script>
  <script type="module" src="../../post.js"></script>
  <script type="module" src="../../../shared/turn-tune.js"></script>
</body>
</html>
`;
}

mkdirSync(outDir, { recursive: true });
const images = join(srcDir, 'images');
if (existsSync(images)) {
  mkdirSync(join(outDir, 'images'), { recursive: true });
  for (const f of readdirSync(images)) copyFileSync(join(images, f), join(outDir, 'images', f));
}
for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.md'))) {
  const slug = basename(file, '.md');
  const { meta, body } = frontMatter(readFileSync(join(srcDir, file), 'utf8'));
  const html = marked.parse(body);
  mkdirSync(join(outDir, slug), { recursive: true });
  writeFileSync(join(outDir, slug, 'index.html'), page({ slug, meta, html }));
  console.log(`post ${slug}`);
}
