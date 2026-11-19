// Two axes drive every scene: the year (0..100, midwinter → midwinter) and the
// hour (0..24 of a "solar" day the page warps to the real sunrise/sunset).
// Each is a BlendState1D between one-frame poses sampled from piecewise-linear
// curves; `Blend.build` writes the poses and wires the layer.
export const STOPS = [0, 8, 16, 22, 28, 34, 40, 50, 60, 68, 74, 80, 86, 92, 100];
// the Shore adds two tight pairs so the canoe hard-cuts between flipped and afloat
// (each pair sits between two consecutive slider days, so no day lands inside)
export const SHORE_STOPS = [0, 8, 16, 22, 28, 34, 40, 43.08, 43.22, 50, 60, 68, 74.86, 75.0, 80, 86, 92, 100];
export const HOURS = [0, 4.5, 5.5, 6.5, 7.5, 9, 12, 15, 17.5, 18.5, 19.5, 20.5, 22, 24];

export function at(curve, y) {
  if (y <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [y0, v0] = curve[i - 1];
    const [y1, v1] = curve[i];
    if (y <= y1) return v0 + ((v1 - v0) * (y - y0)) / (y1 - y0);
  }
  return curve[curve.length - 1][1];
}

const chans = (hex) => [0, 2, 4, 6].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hex = (c) => c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

// curve values are ARGB hex strings (as produced by argb())
export function atColor(curve, y) {
  if (y <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [y0, c0] = curve[i - 1];
    const [y1, c1] = curve[i];
    if (y <= y1) {
      const f = (y - y0) / (y1 - y0);
      const a = chans(c0), b = chans(c1);
      return hex(a.map((v, k) => v + (b[k] - v) * f));
    }
  }
  return curve[curve.length - 1][1];
}

export const shift = (curve, d) => curve.map(([y, v]) => [y + d, v]);
export const scaleCurve = (curve, k) => curve.map(([y, v]) => [y, v * k]);

export class Blend {
  constructor(scene, stops, label) {
    this.s = scene;
    this.stops = stops;
    this.label = label;
    this.tracks = [];
  }
  num(object, prop, curve) {
    this.tracks.push({ object, prop, curve });
    return this;
  }
  scale(object, curve) {
    return this.num(object, 'scaleX', curve).num(object, 'scaleY', curve);
  }
  color(object, curve) {
    this.tracks.push({ object, prop: 'colorValue', type: 'Color', curve, color: true });
    return this;
  }
  build(inputId) {
    if (!this.tracks.length) return;
    const stops = this.stops.map((y) => ({
      value: y,
      anim: this.s.anim({
        name: `${this.label} ${y}`,
        duration: 1,
        tracks: this.tracks.map((t) => ({ object: t.object, prop: t.prop, type: t.type, keys: [[0, t.color ? atColor(t.curve, y) : at(t.curve, y), 'hold']] })),
      }),
    }));
    this.s.blendLayer(this.label, inputId, stops);
  }
}
export class Season extends Blend {
  constructor(scene, stops = STOPS) { super(scene, stops, 'year'); }
}
export class Clock extends Blend {
  constructor(scene) { super(scene, HOURS, 'hour'); }
}

// ---------------------------------------------------------------- the clock's curves (solar hours: rise ≈ 6.5, set ≈ 19)
export const NIGHT = [[0, 1], [4.5, 1], [5.5, 0.75], [6.5, 0.3], [7.5, 0], [18.5, 0], [19.5, 0.45], [20.5, 0.85], [22, 1]];
export const DUSK = [[0, 0], [5, 0], [6.3, 0.9], [7.5, 0.15], [9, 0], [17.5, 0], [18.7, 0.7], [19.5, 1], [20.5, 0.35], [22, 0]];
export const DAYLIGHT = [[0, 0], [5.5, 0], [6.5, 0.6], [7.5, 1], [18, 1], [19, 0.7], [20, 0.1], [20.5, 0]];
export const WINDOWS = [[0, 0.85], [3, 0.55], [5, 0.9], [6.5, 0.75], [7.5, 0.25], [8.5, 0], [16.5, 0], [17.5, 0.4], [18.5, 0.9], [19.5, 1], [22, 1], [24, 0.85]];
export const MOON = [[0, 1], [4.5, 1], [5.5, 0.6], [6.5, 0], [18.5, 0], [19.5, 0.35], [20.5, 0.8], [22, 1]];
export const STARS = [[0, 1], [4.5, 1], [5.5, 0.5], [6.5, 0], [19, 0], [20.5, 0.4], [22, 1]];
export const FIREFLY_HOUR = [[0, 0.85], [3, 0.5], [4.5, 0.3], [5.5, 0], [18.5, 0], [19.5, 0.5], [20.5, 1], [22, 1], [24, 0.85]];
