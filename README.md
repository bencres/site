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
- Moving between the hill and a post, the next page arrives in drops of watercolor (`site/shared/turn.js` and `turn.css`, using cross-document view transitions; other browsers just navigate). Each post picks a recipe with a `turn` front-matter field, and going back to the hill replays it: `drops` (one drop where you clicked, then three around it), `drizzle` (three, close and quick), `rain` (a patter of small drops all over the page), `puddle` (four big slow drops leaving tide lines), `pigment` (five drops carrying colour that dries clear) or `flick` (a trail flung off a brush). A recipe is a small function in `turn.js` that places the drops; each arrival is generated for the screen size, with a little chance in it.
- The scene is pure RML with no Luau scripts, so the unsigned local build plays in the web runtime (`@rive-app/webgl2`, vendored into `site/shared/vendor`).
