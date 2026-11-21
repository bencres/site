<img src="assets/icon.svg" width="64" height="64" alt="">

# personal-rive-site

Ben Cressman's personal site: a round green door in a watercolor hill, with a wooden signpost for navigation. The illustration is a live [Rive](https://rive.app) file drawn in code: hand-jittered ink lines, line boil, ink draw-on and feathered watercolor washes, with small touches that follow the visitor's season and hour.

The other 21 design drafts explored on the way here are kept in git history at the `drafts-archive` tag.

## Run it

```bash
npm install
npm run build     # vendor + minify the Rive runtime, build the .riv files and the hill
                  # stills, render the posts and the hill page, write .br/.gz copies
npm run serve     # http://localhost:4173, serving the compressed copies with vercel.json's headers and redirects
```

The build needs the `rive` CLI, `cwebp` (Homebrew `webp`) for post images, and Chrome for
the stills (rendered with Playwright).

## Deploy

bencres.dev is this repo on Vercel. Vercel can't run the build (no `rive` CLI, `cwebp` or
Chrome there), so `site/` is committed already built: run `npm run build` and commit before
pushing. `vercel.json` tells Vercel to skip install and build and serve `site/` as it is.
It also sets the long cache for the versioned runtime and fonts, adds trailing slashes, and
redirects the old site's addresses: `/shire-ii/…` from the drafts, the posts and snippets
that were taken down, and `/demo/django-angular`. The résumé PDF stays at its old address, `/ben-cressman-software-engineer.pdf`. The `.br`/`.gz` copies are only for
`npm run serve` (Vercel compresses on its own); they're generated, so git ignores them.

Preview any season and time with `?season=winter&time=dusk` (seasons: spring, summer, autumn, winter; times: morning, day, afternoon, dusk, night). Or double-click (double-tap on a phone) the middle cloud over the hill: a card of season and time dials comes up in the bottom-left corner; the same again, or its ×, puts it away.

For a few holidays the hill is painted differently: Lithe (June 19–24), Bilbo and Frodo's birthday (Sept 19–25), Halloween, which is Mordor (Oct 20–31), and Yule (Dec 18 – Jan 3). They come round by the visitor's calendar; the card's holiday row shows any of them on any day, or `?holiday=yule` (`?holiday=none` shows the ordinary hill even on a holiday, and `?day=12-25` previews a date).

## How it's put together

- `site/shared/content.js` holds all the copy.
- `rive/shire-ii/gen.mjs` generates `scene.rml`. The `rive` CLI (`rive <dir> --once`) compiles that to `site/riv/shire-ii.riv`. Preview the scene natively with `rive rive/shire-ii`.
- `rive/lib/ink.mjs` is the shared drawing kit: seeded jitter, smooth paths, ink strokes with bleed, watercolor glazes, stippling, line boil (a `Solo` swapping re-drawn cels), and state machine helpers.
- `site/` is the page (`index.html`, `main.js`, `style.css`). `scripts/build-page.mjs` writes the copy from `content.js` straight into `index.html` (between `<!-- build:… -->` markers), so the words are there on first paint; `main.js` then paints the signpost arms and washes and wires the Rive scenes up. `paint.js` paints the arms and ink marks as SVG. Run `npm run build:page` after changing `content.js` or `when.js`.
- Holidays (`HOLIDAYS` in `site/when.js`): each has a painting, `rive/<name>/gen.mjs` built to `site/riv/<name>.riv` (Halloween's is two takes made one, `tower.mjs` for the hill and `lair.mjs` for the footer), and a page script, `site/holidays/<name>/main.js`, with a stylesheet of its colours laid over `style.css`. The inline script at the top of `index.html` picks the holiday before anything loads, so an ordinary day fetches none of it. Each holiday's `main.js` began as a copy of `site/main.js` and dresses the page's words for the day, so a change to `site/main.js` that a holiday should have too has to be made there as well. Holidays have no stills; their paintings always draw themselves in.
- Loading: `site/shared/rive-mount.js` fetches the Rive runtime itself (from `site/shared/vendor/2.51.0/`), so nothing waits on it. Until the live hill is ready, a still of the finished painting for the visitor's season and hour (`site/stills/`, made by `scripts/build-stills.mjs`) stands in; if it was up long enough to be seen, the live hill skips drawing itself in. Off-screen paintings start after the page transition and stay paused until scrolled to. Fonts are self-hosted (`site/shared/fonts.css`), with fallbacks shaped like them so nothing moves when they arrive.
- The always-running motion in the paintings (clouds, smoke, sway, the line boil) is stepped at 15 fps (`rate` in `anim()`, `rive/lib/ink.mjs`), so an idle hill redraws about 16 times a second instead of 60; interactions and the intro stay at 60.
- Blog posts are Markdown in `posts/` (the bencres.dev front-matter format). `npm run build:posts` renders each one to `site/blog/<slug>/` in the site's hand, with code coloured in inks. Images referenced as `/blog-images/<file>` are read from `posts/images/`, encoded to WebP at 640/960/1280px with `srcset`, and pinned into the page like photos. Only posts with a sketch load the Rive runtime. Two optional front-matter fields add a sketch above the post: `sketch` names an artboard among the sketches in `rive/sketches/` (one module each, listed in `gen.mjs`; each is built to its own `site/riv/sketches/<name>.riv`, so a post loads only its own), and `caption` is the hand-lettered line under it. A post that is local gets `local: true` and a relative `url` in `content.js`.
- Moving between pages, the next page arrives as a downpour of watercolor drops (`site/shared/turn.js` and `turn.css`, using cross-document view transitions; other browsers just navigate). Only with a mouse or trackpad: on phones and tablets pages simply change. The drops land on content on either page, each with a faint wet rim that stops where it meets another drop. Every arrival is generated for the screen from the settings at the top of `turn.js` (the drop shapes are pre-rendered images in `site/shared/turn/`). Add `?tune` to any page to show the tuning card (`turn-tune.js`, bottom-left), which overrides the settings in localStorage, can try the result, and copies the values out; `?tune=0` hides it again.
- A few lines of Tolkien are tucked in: the painting's alt text and its door knob's tooltip, the morning sign's tooltip, the angry door, a password for the console (type `mellon` anywhere to open the door), a tooltip on the ways out, a line under Now, the walking song at the foot of the page, and `site/404.html` (Vercel serves it for any address that leads nowhere, and so does `npm run serve`).
- The icon is the B pressed in red wax that seals the letter on the hill (`waxSeal` in `site/paint.js`). `npm run build:icons` writes `site/shared/favicon.svg` and, for browsers and phones that won't use an SVG, a 32px PNG, `site/favicon.ico` and a 180px home-screen icon.
- The scene is pure RML with no Luau scripts, so the unsigned local build plays in the web runtime (`@rive-app/webgl2`, vendored into `site/shared/vendor`).
