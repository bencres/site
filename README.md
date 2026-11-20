<img src="assets/icon.svg" width="64" height="64" alt="">

# personal-rive-site

Ben Cressman's personal site: a round green door in a watercolor hill, with a wooden signpost for navigation. The illustration is a live [Rive](https://rive.app) file drawn in code: hand-jittered ink lines, line boil, ink draw-on and feathered watercolor washes, with small touches that follow the visitor's season and hour.

The other 21 design drafts explored on the way here are kept in git history at the `drafts-archive` tag.

## Run it

```bash
npm install
npm run build     # vendor + minify the Rive runtime, build the .riv files and the hill
                  # stills, render the posts and the hill page, write .br/.gz copies
npm run serve     # http://localhost:4173, serving the compressed copies and site/_headers
```

The build needs the `rive` CLI, `cwebp` (Homebrew `webp`) for post images, and Chrome for
the stills (rendered with Playwright). Deploy the `site/` folder as it is after a build:
`site/_headers` sets caching and content types (Netlify / Cloudflare Pages format), and the
`.br`/`.gz` copies sit next to their originals for hosts that serve precompressed files.
They're generated, so git ignores them.

Preview any season and time with `?season=winter&time=dusk` (seasons: spring, summer, autumn, winter; times: morning, day, afternoon, dusk, night), or use the season and time card in the corner of the page.

## How it's put together

- `site/shared/content.js` holds all the copy.
- `rive/shire-ii/gen.mjs` generates `scene.rml`. The `rive` CLI (`rive <dir> --once`) compiles that to `site/riv/shire-ii.riv`. Preview the scene natively with `rive rive/shire-ii`.
- `rive/lib/ink.mjs` is the shared drawing kit: seeded jitter, smooth paths, ink strokes with bleed, watercolor glazes, stippling, line boil (a `Solo` swapping re-drawn cels), and state machine helpers.
- `site/shire-ii/` is the page. `scripts/build-page.mjs` writes the copy from `content.js` straight into `index.html` (between `<!-- build:… -->` markers), so the words are there on first paint; `main.js` then paints the signpost arms and washes and wires the Rive scenes up. `paint.js` paints the arms and ink marks as SVG. Run `npm run build:page` after changing `content.js` or `when.js`.
- Loading: `site/shared/rive-mount.js` fetches the Rive runtime itself (from `site/shared/vendor/2.51.0/`), so nothing waits on it. Until the live hill is ready, a still of the finished painting for the visitor's season and hour (`site/shire-ii/stills/`, made by `scripts/build-stills.mjs`) stands in; if it was up long enough to be seen, the live hill skips drawing itself in. Off-screen paintings start after the page transition and stay paused until scrolled to. Fonts are self-hosted (`site/shared/fonts.css`), with fallbacks shaped like them so nothing moves when they arrive.
- The always-running motion in the paintings (clouds, smoke, sway, the line boil) is stepped at 15 fps (`rate` in `anim()`, `rive/lib/ink.mjs`), so an idle hill redraws about 16 times a second instead of 60; interactions and the intro stay at 60.
- Blog posts are Markdown in `posts/` (the bencres.dev front-matter format). `npm run build:posts` renders each one to `site/shire-ii/blog/<slug>/` in the site's hand, with code coloured in inks. Images referenced as `/blog-images/<file>` are read from `posts/images/`, encoded to WebP at 640/960/1280px with `srcset`, and pinned into the page like photos. Only posts with a sketch load the Rive runtime. Two optional front-matter fields add a sketch above the post: `sketch` names an artboard among the sketches in `rive/sketches/` (one module each, listed in `gen.mjs`; each is built to its own `site/riv/sketches/<name>.riv`, so a post loads only its own), and `caption` is the hand-lettered line under it. A post that is local gets `local: true` and a relative `url` in `content.js`.
- Moving between pages, the next page arrives as a downpour of watercolor drops (`site/shared/turn.js` and `turn.css`, using cross-document view transitions; other browsers just navigate). The drops land on content on either page, each with a faint wet rim that stops where it meets another drop. Every arrival is generated for the screen from the settings at the top of `turn.js` (the drop shapes are pre-rendered images in `site/shared/turn/`). Add `?tune` to any page to show the tuning card (`turn-tune.js`, bottom-left), which overrides the settings in localStorage, can try the result, and copies the values out; `?tune=0` hides it again.
- The scene is pure RML with no Luau scripts, so the unsigned local build plays in the web runtime (`@rive-app/webgl2`, vendored into `site/shared/vendor`).
