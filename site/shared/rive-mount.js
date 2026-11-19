// Small wrapper around the Rive web runtime (window.rive, vendored webgl2 build).
// Every canvas shares one offscreen WebGL context, so a page can hold many.
const R = window.rive;
R.Rive.suppressDeprecationWarnings = ['rive-events', 'state-machine-inputs'];
R.RuntimeLoader.setWasmUrl(new URL('./vendor/rive.wasm', import.meta.url).href);

export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function mount(canvas, { src, artboard, fit = 'contain', align = 'center', onEvent, onLoad } = {}) {
  const r = new R.Rive({
    src: new URL(`../riv/${src}.riv`, import.meta.url).href,
    canvas,
    artboard,
    stateMachine: 'Main',
    autoplay: true,
    useOffscreenRenderer: true,
    layout: new R.Layout({ fit: R.Fit[cap(fit)], alignment: R.Alignment[cap(align)] }),
    onLoad: () => {
      r.resizeDrawingSurfaceToCanvas();
      if (reducedMotion) setTimeout(() => r.pause(), 1600);
      onLoad?.(r);
    },
  });
  if (onEvent) r.on(R.EventType.RiveEvent, (e) => onEvent(e.data.name, e.data));
  new ResizeObserver(() => r.resizeDrawingSurfaceToCanvas()).observe(canvas);
  // pause offscreen canvases; resume when they scroll back
  new IntersectionObserver(([e]) => (e.isIntersecting ? r.play() : r.pause())).observe(canvas);
  return {
    rive: r,
    input(name) {
      return r.stateMachineInputs('Main')?.find((i) => i.name === name);
    },
    fire(name) {
      this.input(name)?.fire();
    },
    set(name, v) {
      const i = this.input(name);
      if (i) i.value = v;
    },
  };
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);
