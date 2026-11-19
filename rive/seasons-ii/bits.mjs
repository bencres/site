// Shared palette, calendar curves and small drawing helpers for draft 14.
import { P, el, argb, pathXml, fill, stroke, solid, blobPts, resample, EASE } from '../lib/ink.mjs';

export const INK = '2E3A44'; // cold slate ink
export const SNOW = 'FFFFFF';
export const SHADOW = '9DB6CC'; // blue snow shadow
export const SPRUCE = '3D5C57';
export const FIR = '466B5C';
export const RUST = 'B4532E';
export const CANOE = 'B8432F';
export const NIGHT_INK = '2B3A5C'; // indigo for night glazes
export const BG = process.env.SEASONS_BG; // paper colour for CLI previews only
export const YEAR0 = +(process.env.SEASONS_YEAR ?? 0); // initial year input for CLI previews
export const HOUR0 = +(process.env.SEASONS_HOUR ?? 12); // initial (solar) hour for CLI previews

export const ink = (a = 1) => argb(INK, a);

// ---------------------------------------------------------------- the calendar
// 0 = Jan 15 ... 16 = mid March ... 34 = mid May ... 50 = mid July ... 78 = late Oct ... 100 = Jan 15
export const SNOW_ON_TREES = [[0, 1], [12, 1], [19, 0.5], [25, 0], [84, 0], [88, 0.45], [94, 1]];
export const SNOW_ON_GROUND = [[0, 1], [14, 1], [21, 0.55], [27, 0], [84, 0], [87, 0.35], [92, 0.8], [100, 1]];
export const PUDDLES = [[14, 0], [19, 1], [29, 1], [36, 0]];
export const TRILLIUMS = [[27, 0], [32, 1], [42, 1], [47, 0]];
export const WILDFLOWERS = [[43, 0], [49, 1], [66, 1], [72, 0]];
export const FALLEN = [[70, 0], [76, 1], [88, 1], [93, 0]];
export const CATKINS = [[15, 0], [21, 1], [30, 1], [34, 0]];
export const BIRCH_LEAF_OP = [[26, 0], [32, 1], [76, 1], [81, 0.5], [85, 0]];
export const BIRCH_LEAF_SC = [[26, 0.25], [34, 0.85], [42, 1], [86, 1]];
export const BIRCH_LEAF_COL = [[28, 'C9DA6E'], [40, '86B257'], [62, '6E9E48'], [70, 'D9C54A'], [76, 'E9B733'], [84, 'C8912C']];
export const BUDS = [[15, 0], [21, 1], [30, 1], [34, 0]];
export const FLOWERS = [[26, 0], [30, 1], [36, 1], [41, 0]];
export const MAPLE_LEAF_OP = [[30, 0], [35, 1], [77, 1], [81, 0.4], [85, 0]];
export const MAPLE_LEAF_SC = [[30, 0.25], [36, 0.75], [43, 1], [86, 1]];
export const MAPLE_LEAF_COL = [[32, 'B9D65C'], [44, '649A3E'], [62, '4F8236'], [68, '9CA43A'], [72, 'E6A02C'], [76, 'D44A2C'], [86, 'A63E24']];
export const DRIED = [[0, 1], [18, 1], [26, 0], [86, 0], [91, 1]];
export const ROBIN = [[22, 0], [24, 1], [52, 1], [55, 0]];
export const DRAGONFLY = [[44, 0], [48, 1], [62, 1], [67, 0]];
export const HARE = [[0, 1], [9, 1], [15, 0], [91, 0], [96, 1]];
export const OWL = [[0, 1], [7, 1], [13, 0], [92, 0], [97, 1]];
export const SQUIRREL = [[64, 0], [68, 1], [84, 1], [88, 0]];
export const MUSHROOMS = [[62, 0], [66, 1], [78, 1], [83, 0]];
export const FERNS = [[32, 0], [38, 1], [80, 1], [87, 0]];
export const FERN_COL = [[32, argb('8CC46A', 0.75)], [44, argb('4E8A3C', 0.78)], [66, argb('45803A', 0.78)], [74, argb('A8A040', 0.75)], [82, argb('B07A3A', 0.7)]];
export const LOON = [[44, 0], [47, 1], [68, 1], [71, 0]];
export const HERON = [[56, 0], [59, 1], [76, 1], [79, 0]];
export const FROG = [[27, 0], [30, 1], [42, 1], [45, 0]];
export const FIREFLIES = [[45, 0], [49, 1], [62, 1], [66, 0]];
export const ICE = [[0, 1], [13, 1], [18, 0.65], [23, 0], [87, 0], [91, 0.6], [95, 1]];
export const OPEN_WATER = [[14, 0], [21, 1], [89, 1], [95, 0]];
export const FLOES = [[15, 0], [18, 1], [24, 1], [28, 0]];
export const REEDS_GREEN = [[30, 0], [36, 1], [78, 1], [84, 0]];
export const REEDS_DRY = [[0, 1], [22, 1], [34, 0], [76, 0], [84, 1]];
export const SMOKE = [[0, 1], [22, 1], [32, 0], [74, 0], [84, 1]];
export const SAMARAS = [[37, 0], [40, 1], [45, 1], [49, 0]];
export const SPRING_GEESE = [[17, 0], [20, 1], [26, 1], [29, 0]];
// earth under the snow: thaw mud → spring green → summer grass → leaf litter → dun → (snow)
export const EARTH = [[16, argb('7E6A56', 0.6)], [26, argb('8A7257', 0.62)], [34, argb('8FB063', 0.55)], [48, argb('7BA552', 0.55)], [64, argb('8FA85A', 0.52)], [72, argb('C49552', 0.5)], [80, argb('B47F49', 0.5)], [88, argb('9A8B76', 0.45)], [96, argb('9A8B76', 0.45)]];
export const TUFT = [[0, ink(0.8)], [20, argb('8C7A5A', 0.85)], [32, argb('4F7F3A', 0.9)], [66, argb('4F7F3A', 0.9)], [76, argb('A08A4A', 0.9)], [86, argb('7A6E58', 0.85)], [94, ink(0.8)]];
// a seasonal glaze laid over each tree: cool in winter, yellow-green flush in spring, bronze in autumn
export const CONIFER_GLAZE = [[0, argb('6E8FB0', 0.2)], [14, argb('6E8FB0', 0.18)], [26, argb('9AA68A', 0.1)], [36, argb('C9D86A', 0.16)], [48, argb('7FA86A', 0.1)], [64, argb('5E8E62', 0.08)], [76, argb('B6A050', 0.14)], [86, argb('8E8E82', 0.1)], [94, argb('6E8FB0', 0.2)]];

// ---------------------------------------------------------------- shared bits

// keys that hide something until `t`, then ease it in
export const appear = (id, t, len = 30, from = 0) => ({ object: id, prop: 'opacity', keys: [[0, from], [t, from, 'cubic', EASE.out], [t + len, 1]] });
export const trimIn = (id, t, len) => ({ object: id, prop: 'end', keys: [[0, 0], [t, 0, 'cubic', [0.35, 0, 0.25, 1]], [t + len, 1]] });

// an ink line that draws on: soft bleed + crisp body, both trimmed together
export function drawnLine(ids, pts, { width = 1.4, alpha = 1, tension = 1, color = INK, closed = false }, t, len, tracks) {
  const a = ids.next();
  const b = ids.next();
  tracks.push(trimIn(a, t, len), trimIn(b, t, len));
  return el('Shape', { name: 'line' }, [
    pathXml(pts, { tension, closed }),
    el('Stroke', { thickness: width * 2.3, cap: 'round', join: 'round', name: 'Bleed' }, [solid(argb(color, alpha * 0.14)), el('TrimPath', { end: 0, id: a, name: 'Trim' }), el('Feather', { strength: width * 1.4, name: 'F' })]),
    el('Stroke', { thickness: width, cap: 'round', join: 'round', name: 'Body' }, [solid(argb(color, alpha)), el('TrimPath', { end: 0, id: b, name: 'Trim' })]),
  ]);
}

// many short ticks in one shape (needles, grass, lenticels)
export function ticks(segs, { width = 0.8, color, name = 'ticks', id, opacity, colorId, tension = 0.6 }) {
  return el('Shape', { name, id, opacity }, [...segs.map((s) => pathXml(s, { tension })), stroke(color, width, { colorId })]);
}

// lumpy snow sitting on top of a line of points
export function capPts(top, r, thick) {
  const n = top.length;
  const upper = top.map((p, i) => {
    const taper = Math.pow(Math.sin((Math.PI * (i + 0.5)) / n), 0.55);
    return P(p.x + r.jit(0.6), p.y - (thick * taper * r.range(0.75, 1.25) + 0.6));
  });
  const lower = [...top].reverse().map((p) => P(p.x, p.y + 1.2));
  return [...upper, ...lower];
}

export function snowCap(r, top, thick, { id, opacity, name = 'snow' } = {}) {
  const pts = capPts(top, r, thick);
  const ridge = pts.slice(0, top.length);
  return el('Node', { name, id, opacity }, [
    el('Shape', { name: 'ridge' }, [pathXml(ridge, { tension: 0.8 }), stroke(argb('7F97AB', 0.55), 0.7)]),
    el('Shape', { name: 'cap' }, [pathXml(pts, { closed: true, tension: 0.8 }), fill(argb(SNOW, 1))]),
    el('Shape', { name: 'shade', y: 2.2 }, [pathXml(pts, { closed: true, tension: 0.8 }), fill(argb(SHADOW, 0.32), { feather: 2.2 })]),
  ]);
}

// a few flakes of snow that puff out and fall when a cap lets go
export function puff(ids, r, c, start, tracks, n = 6, spread = 30) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const id = ids.next();
    const sz = r.range(2.2, 4.6);
    out.push(el('Shape', { name: 'puff', x: c.x, y: c.y, opacity: 0, id }, [
      el('Ellipse', { width: sz, height: sz, originX: 0.5, originY: 0.5, name: 'P' }),
      fill(argb('FFFFFF', 1)),
      stroke(argb('7F97AB', 0.95), 0.7),
    ]));
    const t0 = start + Math.round(r.range(0, 8));
    const len = Math.round(r.range(70, 120));
    const dx = r.jit(spread);
    const dy = r.range(60, 150);
    tracks.push(
      { object: id, prop: 'x', keys: [[t0, c.x + r.jit(spread * 0.3), 'cubic', EASE.out], [t0 + len, c.x + dx]] },
      { object: id, prop: 'y', keys: [[t0, c.y, 'cubic', [0.4, 0, 0.9, 0.6]], [t0 + len, c.y + dy]] },
      { object: id, prop: 'opacity', keys: [[0, 0], [t0, 0, 'linear'], [t0 + 6, 0.95], [t0 + Math.round(len * 0.6), 0.85], [t0 + len, 0]] },
    );
  }
  return out;
}

// a cap that slides off its bough with a puff, then quietly settles back
export function slideTracks(capId, start, { drop = 22, back = 260 } = {}) {
  return [
    { object: capId, prop: 'y', keys: [[0, 0], [start, 0, 'cubic', [0.5, 0, 0.9, 0.5]], [start + 26, drop, 'hold'], [start + 27, -4], [start + back, -4, 'cubic', EASE.out], [start + back + 50, 0]] },
    { object: capId, prop: 'opacity', keys: [[0, 1], [start + 8, 1, 'cubic', EASE.in], [start + 26, 0, 'hold'], [start + back, 0, 'cubic', EASE.out], [start + back + 50, 1]] },
  ];
}

// wrap drawables in a node whose opacity a blend axis controls (nesting keeps
// the intro's own opacity keys on the inner objects independent)
export function seasonal(ids, yr, curve, kids, { name = 'seasonal', x, y, scaleX, scaleY } = {}) {
  const id = ids.next();
  yr.num(id, 'opacity', curve);
  return el('Node', { name, id, x, y, scaleX, scaleY }, [...kids].reverse());
}

// a plain painter's-order group
export const group = (attrs, kids) => el('Node', attrs, [...kids].reverse());

// a soft watercolor blob (one feathered multiply fill)
export function blot({ x = 0, y = 0, rx, ry, color, alpha = 0.4, r, soft = 3, n = 9, wobble = 0.18, name = 'blot', blend = 'multiply', id, opacity, colorId, rotation }) {
  return el('Shape', { name, x, y, blendModeValue: blend, id, opacity, rotation }, [
    pathXml(blobPts(rx, ry, r, { n, wobble, start: r.range(0, 6.28) }), { closed: true }),
    fill(argb(color, alpha), { feather: soft, colorId }),
  ]);
}

// dark eye dot with a highlight
export function eye(x, y, rr = 1.2, hl = true) {
  return [
    el('Shape', { name: 'eye' }, [el('Ellipse', { x, y, width: rr * 2, height: rr * 2, originX: 0.5, originY: 0.5, name: 'e' }), fill(argb('1E2226', 1))]),
    hl ? el('Shape', { name: 'hl' }, [el('Ellipse', { x: x + rr * 0.35, y: y - rr * 0.35, width: rr * 0.7, height: rr * 0.7, originX: 0.5, originY: 0.5, name: 'h' }), fill(argb('FFFFFF', 0.9))]) : '',
  ];
}

// keys for a looping opacity twinkle with a random phase
export function twinkle(r, LOOP, lo = 0.2, hi = 1, period = 90) {
  const per = period * r.range(0.7, 1.4);
  const off = r.range(0, per);
  const keys = [];
  for (let f = -per + off; f < LOOP + per; f += per) {
    keys.push([Math.round(f), lo, 'cubic', EASE.inOut], [Math.round(f + per / 2), hi, 'cubic', EASE.inOut]);
  }
  return keys.filter((k) => k[0] >= 0 && k[0] <= LOOP).filter((k, i, a) => i === 0 || k[0] > a[i - 1][0]);
}

export { resample };
