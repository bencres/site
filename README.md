<img src="assets/icon.svg" width="64" height="64" alt="">

# personal-rive-site

Ben Cressman's personal site: a round green door in a watercolor hill, with a wooden signpost for navigation. The illustration is a live [Rive](https://rive.app) file drawn in code: hand-jittered ink lines, line boil, ink draw-on and feathered watercolor washes, with small touches that follow the visitor's season and hour.

The other 21 design drafts explored on the way here are kept in git history at the `drafts-archive` tag.

## Run it

```bash
npm install
npm run build     # vendor the Rive runtime, build the .riv files, render the posts
npm run serve     # http://localhost:4173
```

Preview any season and time with `?season=winter&time=dusk` (seasons: spring, summer, autumn, winter; times: morning, day, afternoon, dusk, night), or use the season and time card in the corner of the page.

## How it's put together

- `site/shared/content.js` holds all the copy.
- `rive/shire-ii/gen.mjs` generates `scene.rml`. The `rive` CLI (`rive <dir> --once`) compiles that to `site/riv/shire-ii.riv`. Preview the scene natively with `rive rive/shire-ii`.
- `rive/lib/ink.mjs` is the shared drawing kit: seeded jitter, smooth paths, ink strokes with bleed, watercolor glazes, stippling, line boil (a `Solo` swapping re-drawn cels), and state machine helpers.
- `site/shire-ii/` is the page: `main.js` wires the copy, the signpost and the Rive scenes together, and `paint.js` paints the signpost arms and ink marks as SVG.
- Blog posts are Markdown in `posts/` (the bencres.dev front-matter format). `npm run build:posts` renders each one to `site/shire-ii/blog/<slug>/` in the site's hand, with code coloured in inks. Images referenced as `/blog-images/<file>` are read from `posts/images/` and pinned into the page like photos. Two optional front-matter fields add a sketch above the post: `sketch` names an artboard in `rive/sketches/gen.mjs` (built to `site/riv/sketches.riv`), and `caption` is the hand-lettered line under it. A post that is local gets `local: true` and a relative `url` in `content.js`.
- Moving between pages, the next page arrives as a downpour of watercolor drops (`site/shared/turn.js` and `turn.css`, using cross-document view transitions; other browsers just navigate). The drops land on content on either page, each with a faint wet rim that stops where it meets another drop. Every arrival is generated for the screen from the settings at the top of `turn.js`; the tuning card in the bottom-left corner (`turn-tune.js`) overrides them in localStorage, can try the result, and copies the values out.
- The scene is pure RML with no Luau scripts, so the unsigned local build plays in the web runtime (`@rive-app/webgl2`, vendored into `site/shared/vendor`).
