// Watercolor highlights behind the page's labels, in the spirit of draft 2's
// swipes: an irregular band whose pigment follows the season (icy blue → fresh
// green → gold → rust) and deepens at night, blooming in when first seen.
import { Scene, P, el, argb, pathXml, fill, blobPts, rng, EASE, TAU, stippleShape, darken } from '../lib/ink.mjs';
import { Season, Clock, NIGHT } from './season.mjs';
import { NIGHT_INK, BG, YEAR0, HOUR0, group } from './bits.mjs';

const HI_COL = [[0, 'A4C8DE'], [12, 'B2D1E3'], [20, 'C9D6C0'], [30, 'C3DE86'], [42, 'A6D06A'], [50, 'EFD560'], [60, 'F2C658'], [68, 'EBAE48'], [76, 'D9763A'], [84, 'C98B4E'], [90, 'B8C4CB'], [100, 'A4C8DE']];

export function label(ids, i, { w = 260, h = 64, name = `Hi${i}`, seed = 400 + i * 23, band = [0.3, 0.72] } = {}) {
  const s = new Scene(ids, { name, w, h, x: 2200 + i * 300, y: 1100, bg: BG });
  const year = s.input('number', 'year', YEAR0);
  const hour = s.input('number', 'hour', HOUR0);
  const yr = new Season(s);
  const hr = new Clock(s);
  const r = rng(seed);
  const showId = ids.next(), wetId = ids.next(), dimId = ids.next(), nightId = ids.next();
  const colA = ids.next(), colB = ids.next();
  // the band: ragged ends, a slight tilt, fatter in the middle
  const top = [], bot = [];
  const n = 12;
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const endy = k === 0 || k === n ? 5 : 0;
    const belly = Math.sin(t * Math.PI) * 4;
    top.push(P(10 + t * (w - 20) + r.jit(3), h * band[0] - belly - t * 2 + r.jit(2.2) + endy));
    bot.push(P(10 + t * (w - 20) + r.jit(3), h * band[1] + belly - t * 1.5 + r.jit(2.2) - endy));
  }
  const outline = [...top, ...bot.reverse()];
  const wet = blobPts(w * 0.22, h * 0.2, r, { n: 9, wobble: 0.22 }).map((p) => P(p.x + w * 0.42 + r.jit(w * 0.1), p.y + h * 0.5));
  const dots = [];
  for (let k = 0; k < Math.round(w / 5); k++) dots.push({ x: r.range(14, w - 14), y: r.range(h * band[0], h * band[1]), r: r.range(0.4, 1) });
  yr.color(colA, HI_COL.map(([y, c]) => [y, argb(c, 0.58)]));
  yr.color(colB, HI_COL.map(([y, c]) => [y, argb(darken(c, 0.2), 0.28)]));
  hr.num(nightId, 'opacity', NIGHT.map(([hh, v]) => [hh, v * 0.35]));
  hr.num(dimId, 'opacity', NIGHT.map(([hh, v]) => [hh, 1 - v * 0.25]));
  s.add(el('Node', { name: 'show', id: showId, x: w / 2, y: h / 2, opacity: 0, scaleX: 0.3, scaleY: 0.6 }, el('Node', { name: 'dim', id: dimId, x: -w / 2, y: -h / 2 }, [
    el('Shape', { name: 'glaze', blendModeValue: 'multiply' }, [pathXml(outline, { closed: true, tension: 0.9 }), el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [el('SolidColor', { colorValue: argb('EFD560', 0.58), name: 'C', id: colA }), el('Feather', { strength: 2.2, name: 'F' })])]),
    el('Shape', { name: 'rim', blendModeValue: 'multiply' }, [pathXml(outline, { closed: true, tension: 0.9 }), el('Stroke', { thickness: 1.3, cap: 'round', join: 'round', name: 'S' }, [el('SolidColor', { colorValue: argb('C9A030', 0.28), name: 'C', id: colB }), el('Feather', { strength: 1.4, name: 'F' })])]),
    el('Node', { name: 'wet', id: wetId, x: w * 0.42, y: h * 0.5, scaleX: 0.3, scaleY: 0.3 }, el('Shape', { name: 'wetGlaze', blendModeValue: 'multiply', x: -w * 0.42, y: -h * 0.5 }, [pathXml(wet, { closed: true }), fill(argb(darken('C9A030', 0.1), 0.16), { feather: 6 })])),
    stippleShape({ name: 'grain', dots, color: argb('6B5A30', 0.16) }),
    el('Shape', { name: 'night', blendModeValue: 'multiply', id: nightId }, [pathXml(outline, { closed: true, tension: 0.9 }), fill(argb(NIGHT_INK, 0.7), { feather: 3 })]),
  ].reverse())));
  const show = s.input('bool', 'show', process.env.SEASONS_SHOW ? 1 : 0);
  const hidden = s.anim({ name: 'hidden', duration: 1, tracks: [{ object: showId, prop: 'opacity', keys: [[0, 0, 'hold']] }] });
  const bloom = s.anim({ name: 'bloom', duration: 120, tracks: [
    { object: showId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [36, 1]] },
    { object: showId, prop: 'scaleX', keys: [[0, 0.3, 'cubic', EASE.out], [80, 1]] },
    { object: showId, prop: 'scaleY', keys: [[0, 0.6, 'cubic', EASE.out], [70, 1]] },
    { object: wetId, prop: 'scaleX', keys: [[20, 0.3, 'cubic', EASE.out], [120, 1.15]] },
    { object: wetId, prop: 'scaleY', keys: [[20, 0.3, 'cubic', EASE.out], [120, 1.1]] },
  ] });
  s.boolLayer('bloom', show, hidden, bloom, { mixIn: 0, mixOut: 300 });
  yr.build(year);
  hr.build(hour);
  return s.toXml();
}
