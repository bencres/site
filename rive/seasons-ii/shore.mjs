// The lake edge along the bottom of the page: open water with ripples and
// reflections, frozen over in winter, breaking up in spring; a bank with stones
// and reeds; a dock, the canoe (afloat in summer, flipped on the bank otherwise,
// a hard cut between them) and the cabin whose windows glow by the hour.
import { Scene, P, el, argb, pathXml, fill, stroke, solidId, blobPts, resample, washShape, inkShape, EASE, TAU, darken } from '../lib/ink.mjs';
import { Season, Clock, SHORE_STOPS, NIGHT, DUSK, WINDOWS, MOON, FIREFLY_HOUR } from './season.mjs';
import {
  INK, SNOW, SHADOW, CANOE, NIGHT_INK, BG, YEAR0, HOUR0, ink, appear, seasonal, group, blot, ticks, snowCap, twinkle,
  SNOW_ON_TREES, SNOW_ON_GROUND, EARTH, WILDFLOWERS, ICE, OPEN_WATER, FLOES, REEDS_GREEN, REEDS_DRY, SMOKE, LOON, HERON, FROG, FIREFLIES,
} from './bits.mjs';
import { loon, heron, frog, fireflies } from './critters.mjs';

export const SHORE_W = 2000, SHORE_H = 260, WATERLINE = 132;
const CANOE_UP = [[0, 0], [43.08, 0], [43.22, 1], [74.86, 1], [75.0, 0]];
const CANOE_DOWN = [[0, 1], [43.08, 1], [43.22, 0], [74.86, 0], [75.0, 1]];
// the lake: steel grey at ice-out, bluer and brighter in summer, darker and warmer in autumn
const WATER = [[14, argb('A2B3BD', 0.55)], [22, argb('8FA9B9', 0.58)], [34, argb('93B5C7', 0.58)], [50, argb('8DB5CB', 0.6)], [64, argb('86B0C6', 0.6)], [74, argb('8CA6B0', 0.6)], [82, argb('7E97A4', 0.62)], [90, argb('9AA9B2', 0.58)]];
const TREE_REFL = [[14, argb('4F5F62', 0.3)], [26, argb('4A6A5A', 0.3)], [40, argb('4E7F5A', 0.32)], [64, argb('3E6E50', 0.34)], [74, argb('7A7A3C', 0.32)], [82, argb('8A6A3A', 0.3)], [90, argb('4F5F62', 0.3)]];

function wavy(r, x, y0, y1, amp = 2, n = 6) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(P(x + Math.sin(i * 1.9) * amp + r.jit(amp * 0.4), y0 + ((y1 - y0) * i) / n));
  return pts;
}

// ---------------------------------------------------------------- the cabin (origin: middle of the base)
// seen from the eave side: a log wall, a deep shingled roof with a chimney, a
// door with a lantern, three windows that glow by the hour, a flower box in summer
function cabin(ids, r, yr, hr, { x, y, reflect = false }) {
  const W = 124, H = 54, EAVE = 12, RISE = 40, RIDGE_IN = 22;
  const WOOD = 'A98A5E', ROOF = '6E5E50', GLASS = 'B5C3CC', WARM = 'FFE08A';
  const wall = [P(-W / 2, 0), P(-W / 2 + r.jit(1), -H), P(W / 2 + r.jit(1), -H), P(W / 2, 0)];
  // the roof as a trapezoid: eaves wide and low, the ridge shorter and higher
  const roof = [P(-W / 2 - EAVE, -H + 3), P(-W / 2 + RIDGE_IN, -H - RISE), P(W / 2 - RIDGE_IN, -H - RISE + 1), P(W / 2 + EAVE, -H + 3)];
  const outline = [P(-W / 2, 0), P(-W / 2, -H + 3), ...roof, P(W / 2, -H + 3), P(W / 2, 0)];
  const win = (wx, wy, ww, wh) => ({ pts: [P(wx, wy), P(wx + ww, wy), P(wx + ww, wy + wh), P(wx, wy + wh)], cx: wx + ww / 2, cy: wy + wh / 2, ww, wh });
  const wins = [win(-8, -42, 22, 18), win(32, -42, 22, 18), win(-4, -H - RISE + 12, 12, 11)];
  const door = [P(-46, 0), P(-46, -34), P(-28, -34), P(-28, 0)];
  const logs = [];
  for (let k = 1; k < 8; k++) logs.push([P(-W / 2 + 2, -k * 7 + r.jit(0.5)), P(-20, -k * 7 + r.jit(0.6)), P(W / 2 - 2, -k * 7 + r.jit(0.5))]);
  const shingles = [];
  for (let k = 1; k < 5; k++) {
    const f = k / 5;
    const yy = -H + 3 - (RISE - 3) * f;
    const inset = (EAVE + RIDGE_IN) * f;
    shingles.push([P(-W / 2 - EAVE + inset, yy + r.jit(0.6)), P(0, yy + r.jit(0.8)), P(W / 2 + EAVE - inset, yy + r.jit(0.6))]);
  }
  const glowId = ids.next();
  const glow = el('Node', { name: 'glow', id: glowId }, [
    ...wins.map((w) => el('Shape', { name: 'pane' }, [pathXml(w.pts, { closed: true, tension: 0 }), fill(argb(WARM, 1))])),
    ...wins.map((w) => el('Shape', { name: 'halo' }, [el('Ellipse', { x: w.cx, y: w.cy, width: w.ww * 2.6, height: w.wh * 2.6, originX: 0.5, originY: 0.5, name: 'h' }), fill(argb('FFC86A', reflect ? 0.28 : 0.4), { feather: 14 })])),
    reflect ? '' : el('Shape', { name: 'pool' }, [el('Ellipse', { x: 22, y: 5, width: 120, height: 18, originX: 0.5, originY: 0.5, name: 'p' }), fill(argb('FFC86A', 0.3), { feather: 8 })]),
    el('Shape', { name: 'lantern' }, [el('Ellipse', { x: -54, y: -30, width: 4, height: 5, originX: 0.5, originY: 0.5, name: 'l' }), fill(argb('FFF0B0', 1))]),
    el('Shape', { name: 'lanternGlow' }, [el('Ellipse', { x: -54, y: -30, width: 30, height: 30, originX: 0.5, originY: 0.5, name: 'l' }), fill(argb('FFC86A', 0.42), { feather: 9 })]),
  ].reverse());
  hr.num(glowId, 'opacity', WINDOWS);
  const nightId = ids.next();
  hr.num(nightId, 'opacity', NIGHT.map(([h, v]) => [h, v * 0.42]));
  const kids = [
    // an opaque paper base so the trees behind never show through the walls
    el('Shape', { name: 'base' }, [pathXml(outline, { closed: true, tension: 0 }), fill(argb('F4ECDD', 0.97))]),
    el('Shape', { name: 'wall', blendModeValue: 'multiply' }, [pathXml(wall, { closed: true, tension: 0 }), fill(argb(WOOD, 0.62), { feather: 0.8 })]),
    // the shadow side (light from the upper right): the left third, cool; a warm breath on the right
    el('Shape', { name: 'wallShade', blendModeValue: 'multiply' }, [pathXml([P(-W / 2, 0), P(-W / 2, -H), P(-W / 2 + 40, -H), P(-W / 2 + 30, 0)], { closed: true, tension: 0 }), fill(argb('5E6A86', 0.3), { feather: 8 })]),
    el('Shape', { name: 'wallWarm', blendModeValue: 'multiply' }, [pathXml([P(W / 2 - 36, 0), P(W / 2 - 46, -H), P(W / 2, -H), P(W / 2, 0)], { closed: true, tension: 0 }), fill(argb('E0B070', 0.22), { feather: 8 })]),
    // the eave's shadow across the top of the wall
    el('Shape', { name: 'eaveShadow', blendModeValue: 'multiply' }, [pathXml([P(-W / 2, -H + 3), P(W / 2, -H + 3)], { tension: 0 }), stroke(argb('4E5A70', 0.35), 7, { feather: 4 })]),
    ticks(logs, { width: 0.7, color: ink(0.35), tension: 0.6 }),
    inkShape({ pts: wall, closed: true, tension: 0, color: ink(0.9), width: 1.3, bleed: 0.14 }),
    // door
    el('Shape', { name: 'door', blendModeValue: 'multiply' }, [pathXml(door, { closed: true, tension: 0 }), fill(argb('6B4A30', 0.8))]),
    inkShape({ pts: door, tension: 0, color: ink(0.9), width: 1.1, bleed: 0 }),
    el('Shape', { name: 'knob' }, [el('Ellipse', { x: -32, y: -16, width: 2.2, height: 2.2, originX: 0.5, originY: 0.5, name: 'k' }), fill(argb('2A2F33', 1))]),
    el('Shape', { name: 'step' }, [pathXml([P(-50, 0), P(-24, 0), P(-22, 4), P(-52, 4)], { closed: true, tension: 0 }), fill(argb('8A8078', 0.7)), stroke(ink(0.6), 0.7)]),
    // the roof
    el('Shape', { name: 'roof', blendModeValue: 'multiply' }, [pathXml(roof, { closed: true, tension: 0 }), fill(argb(ROOF, 0.82))]),
    el('Shape', { name: 'roofLit', blendModeValue: 'multiply' }, [pathXml([P(0, -H + 3), P(W / 2 - RIDGE_IN, -H - RISE + 1), P(W / 2 + EAVE, -H + 3)], { closed: true, tension: 0 }), fill(argb('C9A070', 0.22), { feather: 6 })]),
    el('Shape', { name: 'roofShade', blendModeValue: 'multiply' }, [pathXml([P(-W / 2 - EAVE, -H + 3), P(-W / 2 + RIDGE_IN, -H - RISE), P(-W / 2 + RIDGE_IN + 20, -H - RISE), P(-W / 2 + 10, -H + 3)], { closed: true, tension: 0 }), fill(argb('3E4A6A', 0.28), { feather: 8 })]),
    ticks(shingles, { width: 0.7, color: ink(0.4), tension: 0.4 }),
    inkShape({ pts: roof, closed: true, tension: 0, color: ink(0.95), width: 1.5, bleed: 0.14 }),
    // the little dormer window up in the roof
    ...[wins[2]].map((w) => el('Shape', { name: 'dormer' }, [pathXml([P(w.pts[0].x - 4, w.pts[3].y + 1), P(w.pts[0].x - 4, w.pts[0].y - 1), P(w.cx, w.pts[0].y - 7), P(w.pts[1].x + 4, w.pts[0].y - 1), P(w.pts[1].x + 4, w.pts[3].y + 1)], { closed: true, tension: 0 }), fill(argb('8A7A66', 0.9)), stroke(ink(0.85), 1)])),
    // chimney
    el('Shape', { name: 'chimney', blendModeValue: 'multiply' }, [pathXml([P(30, -H - RISE + 14), P(30, -H - RISE - 14), P(44, -H - RISE - 14), P(44, -H - RISE + 8)], { closed: true, tension: 0 }), fill(argb('8A6F5A', 0.9))]),
    inkShape({ pts: [P(30, -H - RISE + 14), P(30, -H - RISE - 14), P(44, -H - RISE - 14), P(44, -H - RISE + 8)], tension: 0, color: ink(0.9), width: 1.1, bleed: 0 }),
    ticks([[P(31, -H - RISE - 6), P(43, -H - RISE - 6)], [P(31, -H - RISE + 1), P(43, -H - RISE + 1)]], { width: 0.6, color: ink(0.4) }),
    // windows: glass by day, then the glow on top
    ...wins.map((w) => el('Shape', { name: 'glass' }, [pathXml(w.pts, { closed: true, tension: 0 }), fill(argb(GLASS, 0.85))])),
    glow,
    ...wins.map((w) => inkShape({ pts: w.pts, closed: true, tension: 0, color: ink(0.9), width: 1.1, bleed: 0 })),
    ...wins.map((w) => ticks([[P(w.cx, w.pts[0].y), P(w.cx, w.pts[2].y)], [P(w.pts[0].x, w.cy), P(w.pts[1].x, w.cy)]], { width: 0.9, color: ink(0.75) })),
    // flower box under the near window, in summer
    seasonal(ids, yr, WILDFLOWERS, [
      el('Shape', { name: 'box', blendModeValue: 'multiply' }, [pathXml([P(-11, -23), P(17, -23), P(16, -17), P(-10, -17)], { closed: true, tension: 0 }), fill(argb('8C5A3A', 0.8)), stroke(ink(0.7), 0.8)]),
      el('Shape', { name: 'blooms' }, [...[-7, -2, 3, 8, 13].map((bx, i) => el('Ellipse', { x: bx + r.jit(1), y: -25 - (i % 2) * 2, width: 4, height: 4, originX: 0.5, originY: 0.5, name: 'b' })), fill(argb('D9534F', 0.9))]),
      el('Shape', { name: 'blooms2' }, [...[-4.5, 0.5, 5.5, 10.5].map((bx, i) => el('Ellipse', { x: bx, y: -26.5 - (i % 2) * 1.5, width: 3.2, height: 3.2, originX: 0.5, originY: 0.5, name: 'b' })), fill(argb('F2C14E', 0.95))]),
      ticks([[P(-9, -22), P(-12, -18)], [P(2, -22), P(1, -17)], [P(12, -22), P(15, -18)]], { width: 0.8, color: argb('4F7F3A', 0.9) }),
    ], { name: 'flowerBox' }),
    // snow: a blanket over the whole roof, a cap on the chimney, icicles at the eave
    seasonal(ids, yr, SNOW_ON_TREES, [
      el('Shape', { name: 'roofSnow' }, [pathXml([P(-W / 2 - EAVE - 1, -H + 1), P(-W / 2 + RIDGE_IN - 2, -H - RISE - 5), P(-W / 2 + RIDGE_IN + 20, -H - RISE - 8 + r.jit(1)), P(0, -H - RISE - 6 + r.jit(1)), P(W / 2 - RIDGE_IN - 10, -H - RISE - 8), P(W / 2 - RIDGE_IN + 2, -H - RISE - 4), P(W / 2 + EAVE + 1, -H + 1), P(W / 2 + EAVE - 10, -H - 2), P(20, -H - 7), P(-30, -H - 4), P(-W / 2 - EAVE + 8, -H - 1)], { closed: true, tension: 0.5 }), fill(argb(SNOW, 1))]),
      el('Shape', { name: 'roofSnowShade', blendModeValue: 'multiply' }, [pathXml([P(-W / 2 - EAVE + 2, -H + 1), P(-W / 2 + RIDGE_IN, -H - RISE - 2), P(-W / 2 + RIDGE_IN + 12, -H - RISE - 2), P(-W / 2 + 6, -H)], { closed: true, tension: 0.3 }), fill(argb(SHADOW, 0.35), { feather: 5 })]),
      el('Shape', { name: 'roofSnowEdge' }, [pathXml([P(-W / 2 - EAVE - 1, -H + 1), P(-W / 2 + RIDGE_IN - 2, -H - RISE - 5), P(-W / 2 + RIDGE_IN + 20, -H - RISE - 8), P(0, -H - RISE - 6), P(W / 2 - RIDGE_IN - 10, -H - RISE - 8), P(W / 2 - RIDGE_IN + 2, -H - RISE - 4), P(W / 2 + EAVE + 1, -H + 1)], { tension: 0.5 }), stroke(argb('7F97AB', 0.55), 0.8)]),
      snowCap(r, [P(30, -H - RISE - 14.5), P(34, -H - RISE - 14.5), P(39, -H - RISE - 14.5), P(44, -H - RISE - 14.5)], 3.5),
      el('Shape', { name: 'icicles' }, [...[-62, -50, -36, 18, 44, 60].map((ix) => pathXml([P(ix, -H + 4), P(ix + 0.4, -H + 9 + r.range(0, 5))])), stroke(argb('CFE1EC', 0.9), 1.4)]),
    ], { name: 'roofSnow' }),
    // night: the walls go indigo
    el('Shape', { name: 'night', blendModeValue: 'multiply', id: nightId }, [pathXml(outline, { closed: true, tension: 0 }), fill(argb(NIGHT_INK, 0.6), { feather: 2 })]),
  ];
  return group({ name: reflect ? 'cabinReflection' : 'cabin', x, y }, kids);
}

// chimney smoke: three puffs that rise, swell and fade, staggered
function smoke(ids, s, r, { x, y, name }) {
  const puffs = [];
  const tracks = [];
  const LOOP = 420;
  for (let i = 0; i < 3; i++) {
    const id = ids.next();
    puffs.push(el('Shape', { name: 'puff', x, y, id, opacity: 0 }, [pathXml(blobPts(7, 5, r, { n: 8, wobble: 0.25 }), { closed: true }), fill(argb('C9CDD2', 0.5), { feather: 4 })]));
    const t0 = i * (LOOP / 3);
    const len = LOOP * 0.9;
    const keys = (prop, from, to, ease = 'linear') => {
      const ks = [];
      for (let c = -1; c <= 1; c++) {
        const a = t0 + c * LOOP;
        ks.push([a, from, ease], [a + len, to, 'hold'], [a + len + 1, from, ease]);
      }
      return ks.filter((k) => k[0] >= 0 && k[0] <= LOOP).filter((k, j, arr) => j === 0 || k[0] > arr[j - 1][0]);
    };
    tracks.push(
      { object: id, prop: 'y', keys: keys('y', y, y - 70) },
      { object: id, prop: 'x', keys: [[0, x + Math.sin(i) * 4, 'cubic', EASE.inOut], [LOOP / 2, x + 10 + Math.cos(i) * 4, 'cubic', EASE.inOut], [LOOP, x + Math.sin(i) * 4]] },
      { object: id, prop: 'scaleX', keys: keys('scaleX', 0.5, 2.2) },
      { object: id, prop: 'scaleY', keys: keys('scaleY', 0.5, 1.8) },
      { object: id, prop: 'opacity', keys: (() => {
        const ks = [];
        for (let c = -1; c <= 1; c++) {
          const a = t0 + c * LOOP;
          ks.push([a, 0, 'linear'], [a + 40, 0.9, 'linear'], [a + len * 0.55, 0.5, 'linear'], [a + len, 0, 'hold'], [a + len + 1, 0]);
        }
        return ks.filter((k) => k[0] >= 0 && k[0] <= LOOP).filter((k, j, arr) => j === 0 || k[0] > arr[j - 1][0]);
      })() },
    );
  }
  s.loopLayer(name, s.anim({ name: 'Smoke', duration: LOOP, loop: 'loop', tracks }));
  return puffs;
}

export function shore(ids) {
  const W = SHORE_W, H = SHORE_H, WL = WATERLINE;
  const s = new Scene(ids, { name: 'Shore', w: W, h: H, x: 0, y: 1100, bg: BG });
  const year = s.input('number', 'year', YEAR0);
  const hour = s.input('number', 'hour', HOUR0);
  const yr = new Season(s, SHORE_STOPS);
  const hr = new Clock(s);
  const r = rngFor(77);
  const grow = [];

  // the shoreline: a long wobbly line, sagging a little mid-way
  const shoreTop = [];
  for (let i = 0; i <= 40; i++) shoreTop.push(P(-10 + (W + 20) * (i / 40), WL + Math.sin(i * 0.9) * 1.6 + r.jit(1.2)));
  const waterPoly = [...shoreTop, P(W + 10, H + 20), P(-10, H + 20)];
  const waterCol = ids.next();
  yr.color(waterCol, WATER);
  const water = [
    el('Shape', { name: 'water' }, [pathXml(waterPoly, { closed: true, tension: 0.7 }), el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [solidId(argb('8DB5CB', 0.6), waterCol), el('Feather', { strength: 3, name: 'F' })])]),
    el('Shape', { name: 'deep', blendModeValue: 'multiply' }, [pathXml([P(-10, WL + 42), P(W + 10, WL + 40), P(W + 10, H + 20), P(-10, H + 20)], { closed: true, tension: 0 }), fill(argb('4E6E82', 0.2), { feather: 12 })]),
    // the shallows: paler along the shore, where the bottom shows
    el('Shape', { name: 'shallows' }, [pathXml([...shoreTop.map((p) => P(p.x, p.y + 1)), P(W + 10, WL + 16), P(-10, WL + 14)], { closed: true, tension: 0.7 }), fill(argb('D7C9A6', 0.22), { feather: 8 })]),
  ];

  // ---- reflections and ripples live in the open-water group
  const open = [];
  const reflCol = ids.next();
  yr.color(reflCol, TREE_REFL);
  const smears = [[60, 26, 70], [120, 40, 95], [205, 30, 80], [280, 18, 60], [1540, 24, 70], [1620, 46, 92], [1700, 30, 76], [1860, 20, 58]];
  open.push(el('Shape', { name: 'treeReflections', blendModeValue: 'multiply' }, [
    ...smears.map(([x, w, h]) => pathXml(wavy(r, x, WL + 2, WL + h, 3), { tension: 1 })),
    el('Stroke', { thickness: 30, cap: 'round', join: 'round', name: 'Stroke' }, [solidId(argb('4E7F5A', 0.32), reflCol), el('Feather', { strength: 14, name: 'F' })]),
  ]));
  // the birch and the maple's pale trunks
  open.push(el('Shape', { name: 'birchReflection' }, [pathXml(wavy(r, 530, WL + 2, WL + 88, 2.5), { tension: 1 }), stroke(argb('F6F6F2', 0.5), 9, { feather: 5 })]));
  // sky light on the water: pale horizontal streaks
  const skyStreaks = [];
  for (let i = 0; i < 18; i++) {
    const x = r.range(0, W), len = r.range(60, 220), y = WL + 6 + Math.pow(r(), 1.6) * 90;
    skyStreaks.push(pathXml([P(x, y), P(x + len * 0.5, y + r.jit(0.8)), P(x + len, y + r.jit(1))], { tension: 1 }));
  }
  open.push(el('Shape', { name: 'skylight' }, [...skyStreaks, stroke(argb('FFFFFF', 0.4), 2.6, { feather: 2 })]));
  // ripples in three groups that shimmer
  const rippleIds = [ids.next(), ids.next(), ids.next()];
  for (let g = 0; g < 3; g++) {
    const lines = [];
    for (let i = 0; i < 34; i++) {
      const y = WL + 4 + Math.pow(r(), 1.5) * (H - WL - 8);
      const x = r.range(-10, W);
      const len = r.range(14, 70) * (0.6 + (y - WL) / 60);
      const pts = [];
      const n = 4;
      for (let k = 0; k <= n; k++) pts.push(P(x + (len * k) / n, y + Math.sin(k * 2.1 + i) * 0.9 + r.jit(0.4)));
      lines.push(pathXml(pts, { tension: 1 }));
    }
    open.push(el('Shape', { name: `ripples${g}`, id: rippleIds[g] }, [...lines, stroke(ink(0.22 + g * 0.04), 0.8 + g * 0.1)]));
  }
  const SH = 720;
  s.loopLayer('shimmer', s.anim({
    name: 'Shimmer', duration: SH, loop: 'loop',
    tracks: rippleIds.flatMap((id, g) => [
      { object: id, prop: 'opacity', keys: [[0, g === 0 ? 1 : 0.45, 'cubic', EASE.inOut], [SH / 3, g === 1 ? 1 : 0.45, 'cubic', EASE.inOut], [(2 * SH) / 3, g === 2 ? 1 : 0.45, 'cubic', EASE.inOut], [SH, g === 0 ? 1 : 0.45]] },
      { object: id, prop: 'x', keys: [[0, 0, 'cubic', EASE.inOut], [SH / 2, (g % 2 ? -1 : 1) * 5, 'cubic', EASE.inOut], [SH, 0]] },
    ]),
  }));

  // ---- the bank: earth whose colour follows the year, snow on top in winter
  const bankTop = shoreTop.map((p) => P(p.x, p.y - 15 + Math.sin(p.x * 0.013) * 2.5 + r.jit(1)));
  const earthCol = ids.next();
  yr.color(earthCol, EARTH.map(([y, c]) => [y, c.slice(0, 2) === '00' ? c : c]));
  const bank = [
    el('Shape', { name: 'bank', blendModeValue: 'multiply' }, [pathXml([...bankTop, ...[...shoreTop].reverse().map((p) => P(p.x, p.y + 2))], { closed: true, tension: 0.7 }), el('Fill', { fillRule: 'clockwise', name: 'Fill' }, [solidId(argb('8A7257', 0.6), earthCol), el('Feather', { strength: 4, name: 'F' })])]),
    el('Shape', { name: 'bankEdge' }, [pathXml(shoreTop, { tension: 0.7 }), stroke(ink(0.5), 0.9, { feather: 0.6 })]),
    // a damp dark line right at the water
    el('Shape', { name: 'wet', blendModeValue: 'multiply' }, [pathXml(shoreTop.map((p) => P(p.x, p.y + 2.5)), { tension: 0.7 }), stroke(argb('5E6E78', 0.35), 3, { feather: 2 })]),
  ];
  const bankSnow = seasonal(ids, yr, SNOW_ON_GROUND, [
    el('Shape', { name: 'snowBank' }, [pathXml([...bankTop.map((p) => P(p.x, p.y - 4 + r.jit(1))), ...[...shoreTop].reverse().map((p) => P(p.x, p.y + 1))], { closed: true, tension: 0.7 }), fill(argb(SNOW, 0.95))]),
    el('Shape', { name: 'snowShade' }, [pathXml(shoreTop.map((p) => P(p.x, p.y - 2)), { tension: 0.7 }), stroke(argb(SHADOW, 0.4), 4, { feather: 3 })]),
    el('Shape', { name: 'snowRidge' }, [pathXml(bankTop.map((p) => P(p.x, p.y - 4)), { tension: 0.7 }), stroke(argb('7F97AB', 0.5), 0.8)]),
  ], { name: 'bankSnow' });

  // stones along the edge, half in the water
  const stoneSpots = [[150, WL - 1, 9, 5], [310, WL + 2, 13, 6], [585, WL + 1, 7, 4], [990, WL - 3, 16, 7], [1030, WL + 3, 8, 4], [1265, WL + 1, 10, 5], [1760, WL + 2, 9, 5], [1930, WL - 1, 12, 6]];
  const stones = stoneSpots.map(([x, y, rx, ry]) => {
    const pts = blobPts(rx, ry, r, { n: 9, wobble: 0.12 });
    return group({ name: 'stone', x, y }, [
      el('Shape', { name: 'stone' }, [pathXml(pts, { closed: true }), fill(argb('9AA0A4', 0.9), { feather: 0.5 })]),
      blot({ x: -rx * 0.3, y: ry * 0.2, rx: rx * 0.7, ry: ry * 0.7, color: '5E6A78', alpha: 0.35, r, soft: 2, name: 'shade' }),
      blot({ x: rx * 0.3, y: -ry * 0.4, rx: rx * 0.45, ry: ry * 0.4, color: 'D9C9A0', alpha: 0.3, r, soft: 1.5, name: 'lit', blend: 'srcOver' }),
      inkShape({ pts, closed: true, color: ink(0.8), width: 0.9, bleed: 0.1 }),
    ]);
  });

  // reeds: green and tall in summer, a few dry bent stalks the rest of the year
  const reedClusters = [[250, WL + 4], [880, WL + 6], [1400, WL + 5]];
  const greenReeds = [], dryReeds = [], reedRefl = [];
  for (const [cx, cy] of reedClusters) {
    const segs = [], heads = [], dry = [], refl = [];
    for (let k = 0; k < 9; k++) {
      const x = cx + r.jit(28);
      const h = r.range(34, 62);
      const lean = r.jit(8);
      const stalk = [P(x, cy), P(x + lean * 0.4, cy - h * 0.55), P(x + lean, cy - h)];
      segs.push(stalk);
      if (k % 3 === 0) heads.push(P(x + lean * 0.9, cy - h * 0.82));
      refl.push([P(x, cy + 2), P(x + lean * 0.3, cy + h * 0.3), P(x + lean * 0.6, cy + h * 0.5)]);
      if (k % 2 === 0) dry.push([P(x, cy), P(x + lean * 0.6 + 3, cy - h * 0.5), P(x + lean + 10, cy - h * 0.72 + 6)]);
    }
    greenReeds.push(
      ticks(segs, { width: 1.4, color: argb('4F7F3A', 0.9), tension: 0.9 }),
      el('Shape', { name: 'cattails' }, [...heads.map((p) => el('Ellipse', { x: p.x, y: p.y, width: 3.6, height: 12, originX: 0.5, originY: 0.5, name: 'c' })), fill(argb('6B4A2A', 0.95))]),
    );
    dryReeds.push(ticks(dry, { width: 1.1, color: argb('A89468', 0.85), tension: 0.9 }));
    reedRefl.push(ticks(refl, { width: 1.2, color: argb('3E6E31', 0.3), tension: 0.9 }));
  }
  open.push(...reedRefl);

  // ---- ice: snow-covered, cracked near the shore, a line of deer tracks across it
  const ice = [
    el('Shape', { name: 'ice' }, [pathXml(waterPoly, { closed: true, tension: 0.7 }), fill(argb('F4F7F9', 0.97))]),
    el('Shape', { name: 'iceShade', blendModeValue: 'multiply' }, [pathXml(shoreTop.map((p) => P(p.x, p.y + 4)), { tension: 0.7 }), stroke(argb(SHADOW, 0.5), 7, { feather: 5 })]),
    ...[[380, WL + 50, 170, 10], [1120, WL + 70, 220, 12], [1700, WL + 40, 140, 9], [800, WL + 90, 300, 14]].map(([x, y, rx, ry]) => blot({ x, y, rx, ry, color: SHADOW, alpha: 0.28, r, soft: 8, n: 10, wobble: 0.2, name: 'drift' })),
    ticks([[P(120, WL + 30), P(260, WL + 24), P(400, WL + 32)], [P(1500, WL + 36), P(1640, WL + 28), P(1800, WL + 34)]], { width: 0.9, color: argb('7F97AB', 0.5), tension: 1 }),
    ticks([[P(60, WL + 8), P(110, WL + 22), P(135, WL + 48)], [P(640, WL + 10), P(660, WL + 30)], [P(1230, WL + 12), P(1290, WL + 26), P(1310, WL + 52)]], { width: 0.7, color: ink(0.35), tension: 0.5 }),
  ];
  // deer tracks: paired crescents walking across the snow
  const prints = [];
  for (let k = 0; k < 11; k++) {
    const px = 560 + k * 42 + r.jit(3), py = WL + 68 + (k % 2 ? 5 : -5) + r.jit(1.5);
    for (const dx of [-1.6, 1.6]) prints.push(el('Shape', { name: 'hoof', x: px + dx, y: py, rotation: dx * 0.18 - 0.15 }, [el('Ellipse', { width: 2.4, height: 4.6, originX: 0.5, originY: 0.5, name: 'h' }), fill(argb('8FA7BC', 0.85), { feather: 0.5 })]));
  }
  ice.push(...prints);
  // floes in spring
  const floes = [];
  const floeIds = [];
  const floeX = [];
  for (let k = 0; k < 7; k++) {
    const id = ids.next();
    floeIds.push(id);
    const x = r.range(80, W - 80), y = WL + r.range(14, 80);
    floeX.push(x);
    const pts = blobPts(r.range(22, 60), r.range(5, 9), r, { n: 7, wobble: 0.3 });
    floes.push(group({ name: 'floe', x, y, id }, [
      el('Shape', { name: 'floe' }, [pathXml(pts, { closed: true, tension: 0.3 }), fill(argb('F4F7F9', 0.95))]),
      el('Shape', { name: 'edge' }, [pathXml(pts, { closed: true, tension: 0.3 }), stroke(argb('8FA7BC', 0.7), 0.8)]),
      el('Shape', { name: 'under', y: 2, blendModeValue: 'multiply' }, [pathXml(pts, { closed: true, tension: 0.3 }), fill(argb('9DB6CC', 0.4), { feather: 2 })]),
    ]));
  }
  const FL = 1500;
  s.loopLayer('floes', s.anim({ name: 'Floes', duration: FL, loop: 'loop', tracks: floeIds.map((id, k) => ({ object: id, prop: 'x', keys: [[0, floeX[k], 'cubic', EASE.inOut], [FL / 2, floeX[k] + (k % 2 ? -1 : 1) * r.range(8, 20), 'cubic', EASE.inOut], [FL, floeX[k]]] })) }));

  // ---- the dock
  const dockX = 1480, dockY = WL - 3;
  const deck = [P(dockX, dockY), P(dockX + 92, dockY + 1), P(dockX + 92, dockY + 9), P(dockX, dockY + 8)];
  const posts = [dockX + 14, dockX + 50, dockX + 86];
  const dock = group({ name: 'dock' }, [
    ...posts.map((px) => el('Shape', { name: 'post' }, [pathXml([P(px, dockY + 6), P(px, dockY + 22)]), stroke(argb('6B5338', 0.95), 3.2)])),
    el('Shape', { name: 'deck', blendModeValue: 'multiply' }, [pathXml(deck, { closed: true, tension: 0 }), fill(argb('B08C5C', 0.85))]),
    ticks([...Array(9)].map((_, i) => [P(dockX + 6 + i * 10, dockY + 0.5), P(dockX + 6 + i * 10, dockY + 8.5)]), { width: 0.6, color: ink(0.35) }),
    inkShape({ pts: deck, closed: true, tension: 0, color: ink(0.9), width: 1.1, bleed: 0.1 }),
    ...posts.map((px) => inkShape({ pts: [P(px - 1.6, dockY + 8), P(px - 1.6, dockY + 22)], color: ink(0.8), width: 0.8, bleed: 0 })),
    ...posts.map((px) => inkShape({ pts: [P(px + 1.6, dockY + 8), P(px + 1.6, dockY + 21)], color: ink(0.6), width: 0.7, bleed: 0 })),
    // snow on the deck
    seasonal(ids, yr, SNOW_ON_TREES, [snowCap(r, resample([P(dockX + 2, dockY - 0.5), P(dockX + 90, dockY + 0.5)], 9), 4)], { name: 'dockSnow' }),
  ]);
  open.push(el('Shape', { name: 'dockReflection', blendModeValue: 'multiply' }, [
    ...posts.map((px) => pathXml(wavy(r, px, dockY + 22, dockY + 50, 1.6, 4), { tension: 1 })),
    stroke(argb('6B5338', 0.35), 3.2, { feather: 1.4 }),
  ]));

  // ---- the canoe, afloat (summer) …
  const cx0 = 1190, cy0 = WL + 22;
  const sheer = [P(0, -16), P(44, -6), P(140, -1), P(236, -6), P(280, -16)];
  const belly = [P(280, -16), P(262, 8), P(200, 18), P(140, 20), P(80, 18), P(20, 8), P(0, -16)];
  const side = [...sheer, ...belly.slice(1)];
  const bobId = ids.next();
  const afloat = seasonal(ids, yr, CANOE_UP, [
    el('Node', { name: 'bob', id: bobId, x: cx0, y: cy0 }, [
      // its reflection: inverted red, wobbled by the ripples
      el('Shape', { name: 'reflection', blendModeValue: 'multiply', y: 14 }, [pathXml([P(8, -2), P(44, 8), P(140, 12), P(236, 8), P(272, -2), P(250, 22), P(140, 30), P(30, 22)], { closed: true, tension: 0.6 }), fill(argb(CANOE, 0.32), { feather: 4 })]),
      washShape({ pts: side.map((p) => P(p.x + 2, p.y + 1.5)), color: CANOE, alpha: 0.9, edge: 0.9, soft: 1.1, tension: 0.5 }),
      el('Shape', { name: 'shine' }, [pathXml([P(50, 6), P(140, 12), P(230, 6)], { tension: 0.9 }), stroke(argb('F2B9A2', 0.45), 2.4, { feather: 1.4 })]),
      el('Shape', { name: 'inside', blendModeValue: 'multiply' }, [pathXml([P(6, -15), P(44, -9), P(140, -6), P(236, -9), P(274, -15), P(236, -11), P(140, -8), P(44, -11)], { closed: true, tension: 0.6 }), fill(argb('8C5A3A', 0.6), { feather: 0.8 })]),
      el('Shape', { name: 'gunwaleWash', blendModeValue: 'multiply' }, [pathXml(sheer, { tension: 0.8 }), stroke(argb('6B3B22', 0.75), 2.6)]),
      inkShape({ pts: side, closed: true, tension: 0.5, color: ink(), width: 1.3, bleed: 0.14 }),
      inkShape({ pts: [P(76, -10), P(78, -1)], color: ink(0.7), width: 0.9, bleed: 0 }),
      inkShape({ pts: [P(208, -10), P(206, -1)], color: ink(0.7), width: 0.9, bleed: 0 }),
      // the paddle laid across
      el('Shape', { name: 'paddle', blendModeValue: 'multiply' }, [pathXml([P(120, -14), P(186, -22)], { tension: 0 }), stroke(argb('C9A268', 0.9), 2.2)]),
      el('Shape', { name: 'blade', blendModeValue: 'multiply' }, [pathXml([P(186, -22), P(200, -27), P(214, -25), P(206, -19), P(192, -18)], { closed: true, tension: 0.7 }), fill(argb('C9A268', 0.85), { feather: 0.5 })]),
      inkShape({ pts: [P(120, -14), P(186, -22)], color: ink(0.8), width: 0.9, bleed: 0 }),
      inkShape({ pts: [P(186, -22), P(200, -27), P(214, -25), P(206, -19), P(192, -18), P(186, -22)], tension: 0.7, color: ink(0.8), width: 0.8, bleed: 0 }),
      // the waterline across the hull and a painter line to the dock
      el('Shape', { name: 'waterline' }, [pathXml([P(14, 6), P(80, 10), P(140, 11), P(200, 10), P(268, 6)], { tension: 1 }), stroke(argb('D9EAF2', 0.55), 1.6, { feather: 0.8 })]),
      inkShape({ pts: [P(280, -14), P(287, -8), P(291, -5)], tension: 1, color: ink(0.6), width: 0.7, bleed: 0 }),
    ].reverse()),
  ], { name: 'canoeAfloat' });
  const BOB = 600;
  s.loopLayer('bob', s.anim({ name: 'Bob', duration: BOB, loop: 'loop', tracks: [
    { object: bobId, prop: 'y', keys: [[0, cy0, 'cubic', EASE.inOut], [BOB / 2, cy0 - 1.6, 'cubic', EASE.inOut], [BOB, cy0]] },
    { object: bobId, prop: 'rotation', keys: [[0, -0.008, 'cubic', EASE.inOut], [BOB / 2, 0.01, 'cubic', EASE.inOut], [BOB, -0.008]] },
  ] }));

  // … and keel-up on the bank the rest of the year
  const dx0 = 1200, dy0 = WL - 2;
  const hull = [P(0, 0), P(26, -14), P(72, -25), P(142, -30), P(212, -27), P(260, -18), P(292, 0), P(242, -6), P(146, -8), P(52, -6)];
  const keel = hull.slice(0, 7);
  const gunwale = [P(8, -2), P(52, -7), P(146, -9), P(242, -7), P(284, -2)];
  const flipped = seasonal(ids, yr, CANOE_DOWN, [
    group({ name: 'flipped', x: dx0, y: dy0 }, [
      blot({ x: 146, y: 2, rx: 150, ry: 6, color: '5E6A78', alpha: 0.25, r, soft: 5, name: 'shadow' }),
      washShape({ pts: hull.map((p) => P(p.x + 3, p.y + 1.5)), color: CANOE, alpha: 0.9, edge: 0.9, soft: 1.1, tension: 0.6 }),
      el('Shape', { name: 'shine' }, [pathXml([P(62, -22), P(142, -27), P(210, -24)], { tension: 0.9 }), stroke(argb('F2B9A2', 0.55), 2.2, { feather: 1.2 })]),
      el('Shape', { name: 'gunwaleWash', blendModeValue: 'multiply' }, [pathXml(gunwale, { tension: 0.8 }), stroke(argb('6B3B22', 0.75), 3)]),
      inkShape({ pts: hull, closed: true, tension: 0.6, color: ink(), width: 1.3, bleed: 0.14 }),
      inkShape({ pts: gunwale, tension: 0.8, color: ink(0.75), width: 0.9, bleed: 0 }),
      seasonal(ids, yr, SNOW_ON_TREES, [snowCap(r, resample(keel, 11).slice(2, -2).map((p) => P(p.x, p.y - 0.4)), 7)], { name: 'canoeSnow' }),
    ]),
  ], { name: 'canoeFlipped' });

  // ---- the cabin, its reflection, its smoke
  const cabX = 1700;
  const house = cabin(ids, r, yr, hr, { x: cabX, y: WL - 4 });
  const houseRefl = el('Node', { name: 'reflWrap', x: 0, y: WL + 2, scaleY: -0.55, opacity: 0.38 }, cabin(ids, r, yr, hr, { x: cabX, y: 0, reflect: true }));
  // (the reflection node is flipped about y = WL + 2, so the cabin's base sits at the shoreline)
  const smokeNode = seasonal(ids, yr, SMOKE, smoke(ids, s, r, { x: cabX + 37, y: WL - 4 - 54 - 40 - 16, name: 'smoke' }), { name: 'smokeSeason' });
  // the warm light from the windows lies on the water too
  const glowReflId = ids.next();
  hr.num(glowReflId, 'opacity', WINDOWS);
  open.push(el('Shape', { name: 'windowLight', id: glowReflId }, [
    ...[cabX + 3, cabX + 41].map((wx) => pathXml(wavy(r, wx, WL + 4, WL + 60, 2.2, 5), { tension: 1 })),
    stroke(argb('FFD27A', 0.62), 16, { feather: 9 }),
  ]));

  // ---- the moon's path on the water, and the dusk and night glazes
  const moonPathId = ids.next();
  hr.num(moonPathId, 'opacity', MOON.map(([h, v]) => [h, v * 0.75]));
  open.push(el('Shape', { name: 'moonPath', id: moonPathId }, [
    pathXml(wavy(r, 1385, WL + 2, WL + 96, 3, 8), { tension: 1 }),
    stroke(argb('FFF4D0', 0.6), 20, { feather: 12 }),
  ]));
  const duskId = ids.next(), nightId = ids.next(), nightBankId = ids.next();
  hr.num(duskId, 'opacity', DUSK.map(([h, v]) => [h, v * 0.8]));
  hr.num(nightId, 'opacity', NIGHT.map(([h, v]) => [h, v * 0.5]));
  hr.num(nightBankId, 'opacity', NIGHT.map(([h, v]) => [h, v * 0.3]));
  const glazes = [
    el('Shape', { name: 'dusk', id: duskId, blendModeValue: 'multiply' }, [pathXml([...shoreTop, P(W + 10, WL + 70), P(-10, WL + 70)], { closed: true, tension: 0.7 }), fill(argb('F0A070', 0.6), { feather: 10 })]),
    el('Shape', { name: 'night', id: nightId, blendModeValue: 'multiply' }, [pathXml(waterPoly, { closed: true, tension: 0.7 }), fill(argb(NIGHT_INK, 0.7), { feather: 3 })]),
    el('Shape', { name: 'nightBank', id: nightBankId, blendModeValue: 'multiply' }, [pathXml([...bankTop.map((p) => P(p.x, p.y - 6)), ...[...shoreTop].reverse().map((p) => P(p.x, p.y + 2))], { closed: true, tension: 0.7 }), fill(argb(NIGHT_INK, 0.6), { feather: 5 })]),
  ];

  // ---- the animals
  const theLoon = seasonal(ids, yr, LOON, [loon(ids, s, r, { x: 760, y: WL + 48, scale: 1.3 })], { name: 'loonSeason' });
  const theHeron = seasonal(ids, yr, HERON, [heron(ids, s, r, { x: 430, y: WL + 10, scale: 1.25 })], { name: 'heronSeason' });
  const theFrog = seasonal(ids, yr, FROG, [frog(ids, s, r, { x: 992, y: WL - 8, scale: 1.1 })], { name: 'frogSeason' });
  const flyHourId = ids.next();
  hr.num(flyHourId, 'opacity', FIREFLY_HOUR);
  const flies = seasonal(ids, yr, FIREFLIES, [el('Node', { name: 'fliesHour', id: flyHourId }, fireflies(ids, s, r, { x0: 820, x1: 1480, y0: 36, y1: WL + 30, n: 18 }))], { name: 'firefliesSeason' });

  // ---- assemble, back to front
  const allId = ids.next();
  grow.push(appear(allId, 10, 70));
  s.add(el('Node', { name: 'shore', id: allId, opacity: 0 }, [
    ...water,
    seasonal(ids, yr, OPEN_WATER, [...open, houseRefl], { name: 'openWater' }),
    ...glazes.slice(0, 1),
    seasonal(ids, yr, ICE, ice, { name: 'ice' }),
    seasonal(ids, yr, FLOES, floes, { name: 'floes' }),
    ...glazes.slice(1, 2),
    ...bank, bankSnow,
    glazes[2],
    house, smokeNode,
    dock,
    flipped, afloat,
    ...stones,
    seasonal(ids, yr, REEDS_GREEN, greenReeds, { name: 'reeds' }),
    seasonal(ids, yr, REEDS_DRY, dryReeds, { name: 'dryReeds' }),
    theHeron, theLoon, theFrog, flies,
  ].reverse()));
  s.loopLayer('rise', s.anim({ name: 'Rise', duration: 100, tracks: grow }));
  yr.build(year);
  hr.build(hour);
  return s.toXml();
}

function rngFor(seed) {
  // local import to keep the top tidy
  return rngImpl(seed);
}
import { rng as rngImpl } from '../lib/ink.mjs';
