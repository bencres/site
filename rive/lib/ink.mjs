// Generator helpers that emit RML for hand-drawn ink + watercolor scenes.
// Every scene is built in code so paths can be jittered by a seeded RNG:
// the "hand" is the noise, and re-running the generator reproduces it exactly.

// ---------- randomness ----------

export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.jit = (amt) => (next() * 2 - 1) * amt;
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.fork = () => rng(Math.floor(next() * 2 ** 31));
  return next;
}

// ---------- xml ----------

const fmt = (v) => (typeof v === 'number' ? +v.toFixed(3) : v);

export function el(tag, attrs = {}, children = '') {
  const a = Object.entries(attrs)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${fmt(v)}"`)
    .join(' ');
  const open = a ? `<${tag} ${a}` : `<${tag}`;
  const body = Array.isArray(children) ? children.join('\n') : children;
  return body ? `${open}>\n${body}\n</${tag}>` : `${open}/>`;
}

// ARGB hex from a 6-digit rgb hex plus alpha 0..1
export function argb(hex, alpha = 1) {
  const h = hex.replace('#', '');
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return (a + h).toUpperCase();
}

// ---------- ids ----------

export class Ids {
  constructor(start = 10) {
    this.n = start;
  }
  next() {
    return `0:${this.n++}`;
  }
}

// ---------- geometry ----------

export const P = (x, y) => ({ x, y });
export const TAU = Math.PI * 2;

export function signedArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2; // y-down: positive = clockwise on screen
}

export function jitterPts(pts, amt, r) {
  return pts.map((p) => P(p.x + r.jit(amt), p.y + r.jit(amt)));
}

// resample a polyline into n roughly even points
export function resample(pts, n) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(d);
    total += d;
  }
  const out = [];
  for (let k = 0; k < n; k++) {
    let t = (k / (n - 1)) * total;
    let i = 0;
    while (i < segs.length - 1 && t > segs[i]) {
      t -= segs[i];
      i++;
    }
    const f = segs[i] ? t / segs[i] : 0;
    out.push(P(pts[i].x + (pts[i + 1].x - pts[i].x) * f, pts[i].y + (pts[i + 1].y - pts[i].y) * f));
  }
  return out;
}

// irregular closed loop: a "hand-drawn circle" or a watercolor blob
export function blobPts(rx, ry, r, { n = 10, wobble = 0.12, start = 0 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = start + (i / n) * TAU;
    const k = 1 + r.jit(wobble);
    pts.push(P(Math.cos(a) * rx * k, Math.sin(a) * ry * k));
  }
  return pts;
}

// Catmull-Rom tangents expressed as mirrored cubic vertices (rotation/distance)
export function smoothVertices(pts, { closed = false, tension = 1, ids } = {}) {
  const n = pts.length;
  return pts.map((p, i) => {
    let prev = pts[i - 1];
    let next = pts[i + 1];
    if (closed) {
      prev = pts[(i - 1 + n) % n];
      next = pts[(i + 1) % n];
    }
    if (!prev) prev = p;
    if (!next) next = p;
    const tx = (next.x - prev.x) / 2;
    const ty = (next.y - prev.y) / 2;
    const rot = Math.atan2(ty, tx);
    const dist = (Math.hypot(tx, ty) / 3) * tension;
    return { x: p.x, y: p.y, rotation: rot, distance: dist, id: ids ? ids[i] : undefined };
  });
}

export function vertexXml(v) {
  if (v.distance < 0.01) return el('StraightVertex', { x: v.x, y: v.y, id: v.id });
  return el('CubicMirroredVertex', { x: v.x, y: v.y, rotation: v.rotation, distance: v.distance, id: v.id });
}

export function pathXml(pts, { closed = false, tension = 1, ids, id, name = 'Path' } = {}) {
  const verts = smoothVertices(pts, { closed, tension, ids });
  const cw = closed ? signedArea(pts) >= 0 : true;
  return el(
    'PointsPath',
    { isClosed: closed ? 'true' : undefined, isClockwise: cw ? 'true' : 'false', name, id },
    verts.map(vertexXml)
  );
}

// straight-segment polygon (for hatching ticks, stars, etc.)
export function polyXml(pts, { closed = false, name = 'Path' } = {}) {
  const cw = closed ? signedArea(pts) >= 0 : true;
  return el(
    'PointsPath',
    { isClosed: closed ? 'true' : undefined, isClockwise: cw ? 'true' : 'false', name },
    pts.map((p) => el('StraightVertex', { x: p.x, y: p.y }))
  );
}

// ---------- paints ----------

export function solid(color) {
  return el('SolidColor', { colorValue: color, name: 'C' });
}
export function solidId(color, id) {
  return el('SolidColor', { colorValue: color, name: 'C', id });
}

export function fill(color, { feather, inner, rule, id, colorId } = {}) {
  const kids = [colorId ? solidId(color, colorId) : solid(color)];
  if (feather) kids.push(el('Feather', { strength: feather, inner: inner ? 'true' : undefined, name: 'F' }));
  return el('Fill', { fillRule: feather ? 'clockwise' : rule, name: 'Fill', id }, kids);
}

export function stroke(color, width, { cap = 'round', join = 'round', feather, trim, effect, colorId, id } = {}) {
  const kids = [colorId ? solidId(color, colorId) : solid(color)];
  if (trim) kids.push(el('TrimPath', { start: trim.start ?? 0, end: trim.end ?? 1, offset: trim.offset, modeValue: trim.mode, id: trim.id, name: 'Trim' }));
  if (effect) kids.push(el('TargetEffect', { targetId: effect, name: 'Use' }));
  if (feather) kids.push(el('Feather', { strength: feather, name: 'F' }));
  return el('Stroke', { thickness: width, cap, join, name: 'Stroke', id }, kids);
}

// ---------- drawing primitives ----------

/**
 * A pen line. `bleed` adds a soft feathered ghost under the crisp line so it
 * reads as ink soaking into paper rather than vector stroke.
 */
export function inkShape({ id, name = 'Ink', x = 0, y = 0, pts, closed = false, tension = 1, color, width = 2, bleed = 0.18, trim, effect, opacity, extra = [] }) {
  const paints = [];
  if (bleed) paints.push(stroke(color.replace(/^../, alphaHex(bleed)), width * 2.2, { feather: width * 1.4, trim: trim && { ...trim, id: undefined }, effect }));
  paints.push(stroke(color, width, { trim, effect }));
  return el('Shape', { x, y, name, id, opacity }, [pathXml(pts, { closed, tension }), ...paints, ...extra]);
}

const alphaHex = (a) => Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();

/**
 * Watercolor wash: translucent pigment with a soft body, a darker pooled edge,
 * and a slightly offset second glaze. Multiply makes overlaps darken like paint.
 * Returns { xml, vertexIds } so callers can animate the edge breathing.
 */
export function washShape({ id, name = 'Wash', x = 0, y = 0, pts, color, alpha = 0.45, edge = 0.5, soft = 3, vertexIds, opacity, blend = 'multiply', tension = 1 }) {
  const body = fill(argb(color, alpha), { feather: soft });
  const pooled = stroke(argb(darken(color, 0.25), alpha * edge), 1.4, { feather: 1.2 });
  return el(
    'Shape',
    { x, y, name, id, opacity, blendModeValue: blend },
    [pathXml(pts, { closed: true, tension, ids: vertexIds }), body, pooled]
  );
}

export function darken(hex, f) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => Math.max(0, Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - f))));
  return c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function lighten(hex, f) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    return Math.min(255, Math.round(v + (255 - v) * f));
  });
  return c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// stipple: one shape, many tiny ellipses compounded into one path
export function stippleShape({ id, name = 'Stipple', x = 0, y = 0, dots, color, opacity }) {
  return el(
    'Shape',
    { x, y, name, id, opacity },
    [...dots.map((d) => el('Ellipse', { x: d.x, y: d.y, width: d.r * 2, height: d.r * 2, originX: 0.5, originY: 0.5, name: 'd' })), fill(color)]
  );
}

// ---------- animation ----------

export function kf(type, frame, value, interp = 'linear', ease) {
  const kids = [];
  if (interp === 'cubic') {
    const [x1, y1, x2, y2] = ease || [0.42, 0, 0.58, 1];
    kids.push(el('CubicEaseInterpolator', { x1, y1, x2, y2 }));
  }
  if (interp === 'elastic') {
    kids.push(el('ElasticInterpolator', { easingValue: 1, amplitude: ease?.amplitude ?? 1, period: ease?.period ?? 0.4 }));
  }
  return el(`KeyFrame${type}`, { frame, value, interpolationType: interp }, kids);
}

export const EASE = {
  out: [0.16, 1, 0.3, 1],
  inOut: [0.45, 0, 0.55, 1],
  in: [0.5, 0, 0.75, 0],
  soft: [0.33, 0, 0.2, 1],
  back: [0.34, 1.56, 0.64, 1],
};

/**
 * tracks: [{ object, prop, type = 'Double', keys: [[frame, value, interp?, ease?], ...] }]
 */
export function anim({ id, name, duration, loop = 'oneShot', fps = 60, tracks }) {
  const byObj = new Map();
  for (const t of tracks) {
    if (!byObj.has(t.object)) byObj.set(t.object, []);
    byObj.get(t.object).push(t);
  }
  const objs = [...byObj.entries()].map(([obj, ts]) =>
    el(
      'KeyedObject',
      { objectId: obj },
      ts.map((t) => {
        const keyAttr = /^\d+$/.test(String(t.prop)) ? { propertyKey: t.prop } : { property: t.prop };
        return el('KeyedProperty', keyAttr, t.keys.map(([f, v, i, e]) => kf(t.type || 'Double', f, v, i ?? (t.type && t.type !== 'Double' ? 'hold' : 'linear'), e)));
      })
    )
  );
  return el('LinearAnimation', { loopValue: loop, duration, fps, name, id }, objs);
}

// ---------- scene ----------

/**
 * Collects drawables, animations and a state machine for one artboard.
 * `add` takes drawables back-to-front (painter's order); emit reverses them,
 * since Rive paints the first-declared child on top.
 */
export class Scene {
  constructor(ids, { name, w, h, bg, x = 0, y = 0, clip = true }) {
    Object.assign(this, { ids, name, w, h, bg, x, y, clip });
    this.id = ids.next();
    this.styleId = ids.next();
    this.smId = ids.next();
    this.drawables = [];
    this.anims = [];
    this.layers = [];
    this.inputs = [];
    this.listeners = [];
    this.events = [];
    this.emptyAnimId = null;
  }
  add(...xml) {
    this.drawables.push(...xml);
  }
  anim(spec) {
    const id = spec.id || this.ids.next();
    this.anims.push(anim({ ...spec, id }));
    return id;
  }
  empty() {
    if (!this.emptyAnimId) this.emptyAnimId = this.anim({ name: 'Rest', duration: 1, tracks: [] });
    return this.emptyAnimId;
  }
  input(kind, name, value) {
    const id = this.ids.next();
    const tag = { bool: 'StateMachineBool', number: 'StateMachineNumber', trigger: 'StateMachineTrigger' }[kind];
    this.inputs.push(el(tag, { name, id, value: kind === 'trigger' ? undefined : value }));
    return id;
  }
  event(name, url) {
    const id = this.ids.next();
    this.events.push(url ? el('OpenUrlEvent', { name, url, targetValue: 'self', id }) : el('Event', { name, id }));
    return id;
  }
  _layer(name, states) {
    return el('StateMachineLayer', { name, id: this.ids.next() }, states);
  }
  // a looping (or one-shot) animation that just plays from load
  loopLayer(name, animId, { speed } = {}) {
    const st = this.ids.next();
    this.layers.push(
      this._layer(name, [
        el('AnyState', { x: 100, y: -120 }),
        el('ExitState', { x: 400, y: -120 }),
        el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: st })),
        el('AnimationState', { x: 200, y: 0, animationId: animId, speed, id: st }),
      ])
    );
  }
  // plays `introId` once, then holds/loops `thenId`
  sequenceLayer(name, animIds) {
    const sts = animIds.map(() => this.ids.next());
    const states = animIds.map((a, i) =>
      el(
        'AnimationState',
        { x: 200 + i * 200, y: 0, animationId: a, id: sts[i] },
        i < animIds.length - 1 ? el('StateTransition', { stateToId: sts[i + 1], enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100 }) : ''
      )
    );
    this.layers.push(
      this._layer(name, [
        el('AnyState', { x: 100, y: -120 }),
        el('ExitState', { x: 200 + animIds.length * 200, y: -120 }),
        el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: sts[0] })),
        ...states,
      ])
    );
  }
  // idle -> (trigger) -> one-shot reaction -> back to idle
  // fromAny=false lets a running reaction finish instead of restarting on every trigger
  triggerLayer(name, triggerId, reactId, { idleId, mix = 120, fromAny = true } = {}) {
    const idle = this.ids.next();
    const act = this.ids.next();
    const go = el('StateTransition', { stateToId: act, duration: mix }, el('TransitionTriggerCondition', { inputId: triggerId }));
    this.layers.push(
      this._layer(name, [
        el('AnyState', { x: 200, y: -140 }, fromAny ? go : ''),
        el('ExitState', { x: 500, y: -140 }),
        el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: idle })),
        el('AnimationState', { x: 200, y: 0, animationId: idleId || this.empty(), id: idle }, fromAny ? '' : go),
        el(
          'AnimationState',
          { x: 400, y: 0, animationId: reactId, reset: 'true', id: act },
          el('StateTransition', { stateToId: idle, enableExitTime: 'true', exitTimeIsPercetange: 'true', exitTime: 100, duration: mix })
        ),
      ])
    );
  }
  // two hold-poses mixed by a bool
  boolLayer(name, boolId, offId, onId, { mixIn = 240, mixOut = 400 } = {}) {
    const off = this.ids.next();
    const on = this.ids.next();
    this.layers.push(
      this._layer(name, [
        el('AnyState', { x: 200, y: -140 }),
        el('ExitState', { x: 500, y: -140 }),
        el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: off })),
        el('AnimationState', { x: 200, y: 0, animationId: offId, id: off }, el('StateTransition', { stateToId: on, duration: mixIn }, el('TransitionBoolCondition', { inputId: boolId, opValue: 'equal' }))),
        el('AnimationState', { x: 400, y: 0, animationId: onId, id: on }, el('StateTransition', { stateToId: off, duration: mixOut }, el('TransitionBoolCondition', { inputId: boolId, opValue: 'notEqual' }))),
      ])
    );
  }
  // a number input scrubs between animations (e.g. scroll progress 0..100)
  blendLayer(name, numberId, stops) {
    const st = this.ids.next();
    this.layers.push(
      this._layer(name, [
        el('AnyState', { x: 100, y: -120 }),
        el('ExitState', { x: 400, y: -120 }),
        el('EntryState', { x: 0, y: 0 }, el('StateTransition', { stateToId: st })),
        el('BlendState1DInput', { x: 200, y: 0, inputId: numberId, id: st }, stops.map((s) => el('BlendAnimation1D', { animationId: s.anim, value: s.value }))),
      ])
    );
  }
  listen(targetId, type, actions) {
    this.listeners.push(el('StateMachineListenerSingle', { targetId, listenerTypeValue: type, name: `${type}`, id: this.ids.next() }, actions));
  }
  static fire(triggerId) {
    return el('ListenerTriggerChange', { inputId: triggerId });
  }
  static setBool(boolId, v) {
    return el('ListenerBoolChange', { inputId: boolId, value: v ? 1 : 0 });
  }
  static emit(eventId) {
    return el('ListenerFireEvent', { eventId });
  }
  toXml() {
    const bg = this.bg ? el('Fill', { name: 'Background' }, solid(this.bg)) : '';
    const sm = el('StateMachine', { name: 'Main', id: this.smId }, [...this.inputs, ...this.listeners, ...this.layers]);
    return el(
      'Artboard',
      { defaultStateMachineId: this.smId, styleId: this.styleId, width: this.w, height: this.h, x: this.x, y: this.y, clip: this.clip ? 'true' : 'false', name: this.name, id: this.id },
      [el('LayoutComponentStyle', { name: 'Style', id: this.styleId }), ...this.events, bg, ...[...this.drawables].reverse(), sm, ...this.anims]
    );
  }
}

export function document(...artboards) {
  return `<Rive version="1" kind="fragment">\n${artboards.join('\n\n')}\n</Rive>\n`;
}

// ---------- higher-level effects ----------

/**
 * Line boil: N slightly different redraws of the same drawing, swapped by a Solo
 * at ~8 fps, like re-traced animation cels. `draw(r)` returns the shapes for one cel.
 */
export function boil(scene, { name = 'Boil', x = 0, y = 0, cels = 3, seed = 1, hold = 7, draw, id, opacity }) {
  const r = rng(seed);
  const soloId = id || scene.ids.next();
  const celIds = [];
  const kids = [];
  for (let i = 0; i < cels; i++) {
    const cid = scene.ids.next();
    celIds.push(cid);
    kids.push(el('Node', { name: `cel${i}`, id: cid }, [].concat(draw(r.fork(), i)).reverse()));
  }
  const xml = el('Solo', { name, x, y, activeComponentId: celIds[0], id: soloId, opacity }, kids);
  const animId = scene.anim({
    name: `${name} boil`,
    duration: hold * cels,
    loop: 'loop',
    tracks: [{ object: soloId, prop: 'activeComponentId', type: 'Id', keys: celIds.map((c, i) => [i * hold, c, 'hold']) }],
  });
  return { xml, soloId, animId };
}

/**
 * A fuller watercolor patch: two glazes (one crisp-edged with a pooled rim, one
 * wet-in-wet and softer), plus pigment granulation. Returns a Node xml string.
 * Pass `vertexIds` (n ids) to let the main glaze's edge be animated.
 */
export function watercolor({ id, name = 'Watercolor', x = 0, y = 0, rx, ry, color, seed = 1, alpha = 0.5, n = 12, wobble = 0.14, grain = true, vertexIds, pts, opacity }) {
  const r = rng(seed);
  const main = pts || blobPts(rx, ry, r, { n, wobble, start: r.range(0, TAU) });
  const wet = blobPts(rx * 0.82, ry * 0.8, r, { n: n - 2, wobble: wobble * 1.3, start: r.range(0, TAU) });
  const kids = [
    washShape({ name: 'glaze', pts: main, color, alpha: alpha * 0.62, edge: 0.95, soft: 1.6, vertexIds }),
    el('Shape', { name: 'wet', x: r.jit(rx * 0.12), y: r.jit(ry * 0.12), blendModeValue: 'multiply' }, [pathXml(wet, { closed: true }), fill(argb(color, alpha * 0.4), { feather: Math.max(4, rx * 0.12) })]),
  ];
  if (grain) {
    const dots = [];
    const count = Math.round((rx * ry) / 90);
    for (let i = 0; i < count; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 0.9;
      dots.push({ x: Math.cos(a) * rx * d, y: Math.sin(a) * ry * d, r: r.range(0.35, 0.9) });
    }
    kids.push(stippleShape({ name: 'grain', dots, color: argb(darken(color, 0.35), alpha * 0.35) }));
  }
  return el('Node', { name, x, y, id, opacity }, kids.reverse());
}
