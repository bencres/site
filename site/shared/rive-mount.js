// Small wrapper around the Rive web runtime (window.rive, vendored webgl2 build).
// Every canvas shares one offscreen WebGL context, and every canvas showing the
// same .riv shares one loaded file, so a page fetches and parses each file once.
const R = window.rive;
R.Rive.suppressDeprecationWarnings = ['rive-events', 'state-machine-inputs'];
R.RuntimeLoader.setWasmUrl(new URL('./vendor/rive.wasm', import.meta.url).href);

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// drawing above 2x density costs a lot of fill on 3x phones and isn't visible in soft watercolor
const density = () => Math.min(window.devicePixelRatio || 1, 2);

const files = new Map();
function fileFor(src) {
  if (!files.has(src)) {
    const file = new R.RiveFile({ src: new URL(`../riv/${src}.riv`, import.meta.url).href });
    files.set(src, file.init().then(() => file));
  }
  return files.get(src);
}

export function mount(canvas, { src, artboard, fit = 'contain', align = 'center', onEvent, onLoad } = {}) {
  let r = null;
  const layout = () => new R.Layout({ fit: R.Fit[cap(fit)], alignment: R.Alignment[cap(align)] });
  let visible = true;
  let settle = 0;
  const pending = new Map(); // inputs set before the file finished loading

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

  fileFor(src).then((riveFile) => {
    r = new R.Rive({
      riveFile,
      canvas,
      artboard,
      stateMachine: 'Main',
      autoplay: true,
      useOffscreenRenderer: true,
      // the line boil holds each cel for several frames; only redraw when something moved
      drawingOptions: R.DrawOptimizationOptions?.DrawOnChanged,
      layout: layout(),
      onLoad: () => {
        r.resizeDrawingSurfaceToCanvas(density());
        for (const [name, v] of pending) api.set(name, v);
        pending.clear();
        if (reducedMotion) settle = setTimeout(() => r.pause(), 1600);
        onLoad?.(r);
      },
    });
    if (onEvent) r.on(R.EventType.RiveEvent, (e) => onEvent(e.data.name, e.data));
  });

  new ResizeObserver(() => r?.resizeDrawingSurfaceToCanvas(density())).observe(canvas);
  // pause offscreen canvases; resume when they scroll back
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!r) return;
    if (!visible) r.pause();
    else if (!reducedMotion) r.play();
    else wake();
  }).observe(canvas);
  return api;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
