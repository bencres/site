// Small wrapper around the Rive web runtime (window.rive, vendored webgl2 build).
// Every canvas shares one offscreen WebGL context, and every canvas showing the
// same .riv shares one loaded file, so a page fetches and parses each file once.
// The runtime isn't in the page: the first mount() loads it, so the words and the
// page's own script never wait for it.
const VENDOR = new URL('./vendor/2.51.0/', import.meta.url);

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// drawing above 2x density costs a lot of fill on 3x phones and isn't visible in soft watercolor
const density = () => Math.min(window.devicePixelRatio || 1, 2);

// the next frame, then a fresh task: a gap for the page to paint between heavy steps
const breathe = () => new Promise((go) => requestAnimationFrame(() => setTimeout(go, 0)));

// a page can hold the downloads back until something it needs first has arrived
let hold = Promise.resolve();
export function holdUntil(promise) {
  hold = Promise.all([hold, promise.catch(() => {})]);
}
// and, separately, hold back starting the runtime up (running its script, compiling the
// wasm, reading the file: a long stretch with no frames on a phone) while the files still
// download, e.g. until what's on screen has finished moving
let start = Promise.resolve();
export function holdStart(promise) {
  start = Promise.all([start, promise.catch(() => {})]);
}

let runtime = null;
function loadRuntime() {
  runtime ??= hold.then(() => new Promise((resolve, reject) => {
    // the wasm is fetched alongside the script, rather than after it has run
    const wasm = new URL('rive.wasm', VENDOR).href;
    const js = new URL('rive.js', VENDOR).href;
    document.head.append(Object.assign(document.createElement('link'), { rel: 'preload', as: 'fetch', type: 'application/wasm', crossOrigin: 'anonymous', href: wasm }));
    document.head.append(Object.assign(document.createElement('link'), { rel: 'preload', as: 'script', href: js }));
    const done = () => {
      const R = window.rive;
      R.Rive.suppressDeprecationWarnings = ['rive-events', 'state-machine-inputs'];
      R.RuntimeLoader.setWasmUrl(wasm);
      resolve(R);
    };
    if (window.rive) return done();
    start.then(() => {
      const script = Object.assign(document.createElement('script'), { src: js, async: true });
      script.onload = done;
      script.onerror = () => reject(new Error('the Rive runtime did not load'));
      document.head.append(script);
    });
  }));
  return runtime;
}

const files = new Map();
function fileFor(src) {
  if (!files.has(src)) {
    // the .riv downloads while the runtime does
    const bytes = hold.then(() => fetch(new URL(`../riv/${src}.riv`, import.meta.url))).then((res) => {
      if (!res.ok) throw new Error(`${src}.riv: HTTP ${res.status}`);
      return res.arrayBuffer();
    });
    files.set(src, Promise.all([loadRuntime(), bytes]).then(async ([R, buffer]) => {
      const file = new R.RiveFile({ buffer });
      await file.init();
      return file;
    }));
  }
  return files.get(src);
}

export function mount(canvas, { src, artboard, fit = 'contain', align = 'center', onEvent, onLoad } = {}) {
  let R = null;
  let r = null;
  const layout = () => new R.Layout({ fit: R.Fit[cap(fit)], alignment: R.Alignment[cap(align)] });
  let visible = true;
  let settle = 0;
  let ready = false;
  const pending = new Map(); // inputs set before the file finished loading
  const fired = new Set(); // and triggers fired before then, in order (once each)

  const input = (name) => r?.stateMachineInputs('Main')?.find((i) => i.name === name);
  // a paused canvas (offscreen, or reduced motion) still has to show a change it's asked for
  const wake = () => {
    if (!r || !visible || !r.isPaused) return;
    r.play();
    clearTimeout(settle);
    if (reducedMotion) settle = setTimeout(() => r.pause(), 2000);
  };

  const api = {
    get rive() {
      return r;
    },
    input,
    fire(name) {
      if (!ready) {
        fired.add(name);
        return;
      }
      const i = input(name);
      if (!i) return;
      i.fire();
      wake();
    },
    // re-frame the scene, e.g. a closer crop on phones
    setLayout(nextFit, nextAlign) {
      fit = nextFit;
      align = nextAlign;
      if (!r) return;
      r.layout = layout();
      wake();
    },
    set(name, v) {
      const i = input(name);
      if (!i) {
        pending.set(name, v);
        return;
      }
      if (i.value === v) return;
      i.value = v;
      wake();
    },
  };

  // pause offscreen canvases; resume when they scroll back
  let seen;
  const looked = new Promise((resolve) => (seen = resolve));
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    seen();
    if (!r) return;
    if (!visible) r.pause();
    else if (!reducedMotion) r.play();
    else wake();
  }).observe(canvas);
  new ResizeObserver(() => r?.resizeDrawingSurfaceToCanvas(density())).observe(canvas);

  (async () => {
    const riveFile = await fileFor(src);
    R = window.rive;
    await looked;
    // a canvas out of sight waits for the page's arrival (turn.js) to finish, then for a quiet moment
    if (!visible) {
      await window.turnSettled;
      await new Promise((go) => (window.requestIdleCallback ? requestIdleCallback(go, { timeout: 1500 }) : setTimeout(go, 200)));
    }
    // and every instance gets a frame to itself, so arriving isn't one long task
    await breathe();
    r = new R.Rive({
      riveFile,
      canvas,
      artboard,
      stateMachine: 'Main',
      // out of sight, it waits for the observer to start it
      autoplay: visible,
      useOffscreenRenderer: true,
      // the line boil holds each cel for several frames; only redraw when something moved
      drawingOptions: R.DrawOptimizationOptions?.DrawOnChanged,
      layout: layout(),
      onLoad: () => {
        r.resizeDrawingSurfaceToCanvas(density());
        for (const [name, v] of pending) api.set(name, v);
        pending.clear();
        if (!visible) r.pause();
        else if (reducedMotion) settle = setTimeout(() => r.pause(), 1600);
        ready = true;
        onLoad?.(r);
        for (const name of fired) api.fire(name);
        fired.clear();
      },
    });
    if (onEvent) r.on(R.EventType.RiveEvent, (e) => onEvent(e.data.name, e.data));
  })().catch((err) => console.warn(err));
  return api;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
