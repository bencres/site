// The year as one number, 0..100 from midwinter to midwinter (Jan 15 → Jan 15).
// Every artboard keys its season-dependent properties on piecewise-linear
// curves over that axis; `Season.build` samples the curves at STOPS, writes one
// one-frame pose animation per stop, and wires them into a BlendState1D driven
// by the `year` input, so scrubbing the year is a continuous blend.
export const STOPS = [0, 8, 16, 22, 28, 34, 40, 50, 60, 68, 74, 80, 86, 92, 100];

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

// shift a curve along the year axis (wrapping is not needed: curves are clamped)
export const shift = (curve, d) => curve.map(([y, v]) => [y + d, v]);

export class Season {
  constructor(scene) {
    this.s = scene;
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
    const stops = STOPS.map((y) => ({
      value: y,
      anim: this.s.anim({
        name: `Year ${y}`,
        duration: 1,
        tracks: this.tracks.map((t) => ({ object: t.object, prop: t.prop, type: t.type, keys: [[0, t.color ? atColor(t.curve, y) : at(t.curve, y), 'hold']] })),
      }),
    }));
    this.s.blendLayer('year', inputId, stops);
  }
}
