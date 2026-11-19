<img src="assets/icon.svg" width="64" height="64" alt="">

# personal-rive-site

Twenty-two design drafts for a personal site, each illustrated with live [Rive](https://rive.app) files that are drawn in code: hand-jittered ink lines, line boil, ink draw-on, and feathered watercolor washes.

| Draft | Idea |
|---|---|
| `site/margins` | Big italic serif, a stippled dandelion you can make a wish on, doodles in the margin |
| `site/sketchbook` | ben.page-like column under an ink + watercolor hillside; washes bloom behind headings |
| `site/plum` | Dark ink-wash; plum branches grow in from the corners, petals fall, moon rises on scroll |
| `site/desk` | An illustrated desk is the index; each object opens a section |
| `site/hello` | A hand-drawn self-portrait that follows the cursor and answers questions |
| `site/harbor` | Almost no text: a loose architectural pen-and-watercolor sketch with the site annotated into it |
| `site/winter` | Daytime take on `plum`: Canadian spruce, birch and maple in snow, a chickadee, falling snow |
| `site/rings` | A tree cross-section as the map: growth rings and sectors are the site's sections |
| `site/herbarium` | A pressed-flower book you page through, one specimen and section per spread |
| `site/nook` | A second watercolor building: tranquil, cozy, hand-made |
| `site/winter-ii` | Iteration on `winter`: light, atmosphere and craft |
| `site/winter-iii` | Iteration on `winter`: more immersive scene, more life |
| `site/seasons` | `winter` grown into a year: the scene follows the date, with a slider to scrub the seasons |
| `site/seasons-ii` | Iteration on `seasons`: lakeshore, a cabin lit by time of day (second slider), more seasonal life, real content |
| `site/sketchbook-ii` | Iteration on `sketchbook`: redrawn with care, inked and washed in on load, a header in the column, and a few season and time-of-day touches |
| `site/shire` | Iteration on `sketchbook` as a hobbit hole: round door in a painted hill, rooms for sections, a hand-lettered gate sign |
| `site/field-notes` | Iteration on `sketchbook` as a field journal: a frameless lane-and-hedgerow vignette, margin sketches and a dated entry that follow the visitor's season and hour |
| `site/manuscript` | Iteration on `shire` as the owner's memoir in progress: "in which…" chapters, a self-inking map of the work road, margin notes, a quill finishing the last line |
| `site/hearth` | Iteration on `shire` from inside: a round tunnel-hall by the fire, a cat in the armchair, the season through the round window, a mantel clock at the visitor's hour |
| `site/the-lane` | Iteration on `shire` as a walk down the lane: a fingerpost nav, painted signboards for sections, lane vignettes between them, a gate and inn at the end |
| `site/shire-ii` | `shire`'s art with `the-lane`'s signpost nav, plus ink splotches and scratches |
| `site/journey` | Experience as a pen-and-ink map: places are experiences, a dashed path runs between them in order |

## Run it

```bash
npm install
npm run build     # vendor the Rive web runtime + regenerate and build every .riv
npm run serve     # http://localhost:4173
```

`node scripts/build-rive.mjs <draft>` rebuilds a single scene.

## How it's put together

- `site/shared/content.js` holds all copy (currently placeholder). Every draft renders from it.
- `rive/<draft>/gen.mjs` generates `scene.rml`. The `rive` CLI (`rive <dir> --once`) compiles that to `site/riv/<draft>.riv`. Preview a scene natively with `rive rive/<draft>`.
- `rive/lib/ink.mjs` is the shared drawing kit: seeded jitter, smooth paths, ink strokes with bleed, watercolor glazes, stippling, line boil (a `Solo` swapping re-drawn cels), and state machine helpers.
- The scenes are pure RML with no Luau scripts, so the unsigned local build plays in the web runtime (`@rive-app/webgl2`, vendored into `site/shared/vendor`).
- Pages drive the scenes through state machine inputs and listen for Rive events (`site/shared/rive-mount.js`).
