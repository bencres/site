// Draft 12 · Winter III — winter (draft 7) pushed toward a more immersive,
// more alive woods: the same edge trees, snow and sun, plus a far treeline a
// fox trots along, a second chickadee, and a trail of landmarks (creek, cabin,
// fence, lake, snag) the page walks past, each with its own quiet wildlife.
import {
  Ids, Scene, rng, P, el, argb, pathXml, fill, stroke, solid, blobPts, resample, jitterPts,
  washShape, document, EASE, TAU, boil, inkShape,
} from '../lib/ink.mjs';
import {
  INK, SNOW, SHADOW, SPRUCE, FIR, RUST, CANOE, BG, ink,
  appear, trimIn, drawnLine, ticks, snowCap, puff, slideTracks, birch, drift,
  gatherTracks, coniferAuto, growBranch, mapleLeaf, chickadee, printShape,
} from './kit.mjs';
import { treeline, creek, cabin, fence, lake, snag } from './trail.mjs';

// ---------------------------------------------------------------- artboards

function standL(ids) {
  const W = 460, H = 900;
  const s = new Scene(ids, { name: 'StandL', w: W, h: H, x: 0, y: 0, bg: BG });
  const r = rng(31);
  const grow = [];
  const far = coniferAuto(ids, r, { cx: 265, base: 852, height: 600, maxW: 44, tiers: 26, color: '7C9790', alpha: 0.45, t0: 40, club: true });
  const near = coniferAuto(ids, r, { cx: 112, base: 868, height: 740, maxW: 58, tiers: 32, color: SPRUCE, alpha: 1, t0: 0, club: true });
  const bir = birch(ids, r, { x: 356, base: 884, height: 780, w: 22, lean: 14, t0: 90 }, grow);
  // grass tufts poking out of the snow
  const tufts = [];
  for (const gx of [40, 205, 300, 420]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, 866), P(gx + k * 3 + r.jit(6) - 4, 866 - r.range(7, 16))]);
  const tuftId = ids.next();
  grow.push(appear(tuftId, 160, 40));
  const ground = drift(r, { x0: -30, x1: W - 6, y: 878, h: 26, taperR: true, shadows: [{ x: 140, y: 878, rx: 90, ry: 9 }, { x: 290, y: 870, rx: 60, ry: 7 }, { x: 380, y: 884, rx: 50, ry: 7 }] });

  // ambient: every so often a clump lets go of a bough
  const amb = [];
  const ambCaps = near.caps.filter((c) => c.f > 0.25 && c.f < 0.6).slice(0, 1);
  const ambPuffs = [];
  for (const c of ambCaps) {
    amb.push(...slideTracks(c.id, 520));
    ambPuffs.push(...puff(ids, r, c.c, 520, amb, 7, 26));
  }
  const LOOP = 1100;
  // the slide anim also owns the cap's opacity, so its frame 0 must match "settled"
  const slideLoop = s.anim({ name: 'Ambient slide', duration: LOOP, loop: 'loop', tracks: amb });

  // interactive: brush a bough and its snow lets go
  const interactive = near.caps.filter((c) => !ambCaps.includes(c) && c.f > 0.12 && c.f < 0.85).filter((_, i) => i % 3 === 0).slice(0, 5);
  const shakePuffs = [];
  const hits = [];
  interactive.forEach((c, k) => {
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    shakePuffs.push(...puff(ids, r, c.c, 0, tr, 7, 28));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x - c.side * 4, y: c.c.y - 4, id: hid }, [el('Ellipse', { width: c.L * 1.3, height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });

  // back to front
  s.add(
    ...far.back, ...far.mid, ...far.front,
    ...ground,
    ...near.back, ...near.mid, ...near.front,
    ...bir,
    ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts' }),
    ...ambPuffs, ...shakePuffs, ...hits,
  );
  const intro = s.anim({ name: 'Grow', duration: 300, tracks: [...grow, ...gatherTracks()] });
  s.loopLayer('grow', intro);
  const wait = s.anim({ name: 'Wait', duration: 320, tracks: [] });
  s.sequenceLayer('ambient', [wait, slideLoop]);
  return s.toXml();
}

function mapleTR(ids) {
  const W = 640, H = 560;
  const s = new Scene(ids, { name: 'MapleTR', w: W, h: H, x: 520, y: 0, bg: BG });
  const r = rng(14);
  const tree = growBranch(r, { origin: P(W + 30, 120), angle: Math.PI + 0.12, length: 560, thick: 16, depth: 3, bounds: { x0: 14, y0: 10, y1: H - 14 } });
  const grow = [];
  const wood = [];
  const snow = [];
  const caps = [];
  for (const seg of [...tree.segs].sort((a, b) => b.w - a.w)) {
    const pts = [seg.a, P((seg.a.x + seg.b.x) / 2 + r.jit(seg.w * 0.4), (seg.a.y + seg.b.y) / 2 + r.jit(seg.w * 0.4)), seg.b];
    const tone = Math.min(1, 0.55 + seg.w * 0.05);
    const a = ids.next();
    const b = ids.next();
    grow.push(trimIn(a, Math.round(seg.t0), Math.round(seg.t1 - seg.t0) + 2), trimIn(b, Math.round(seg.t0), Math.round(seg.t1 - seg.t0) + 2));
    wood.push(el('Shape', { name: 'wood' }, [
      pathXml(pts, { tension: 0.7 }),
      el('Stroke', { thickness: seg.w * 2, cap: 'round', join: 'round', name: 'Bleed' }, [solid(ink(0.1)), el('TrimPath', { end: 0, id: a, name: 'Trim' }), el('Feather', { strength: seg.w + 2, name: 'F' })]),
      el('Stroke', { thickness: Math.max(0.9, seg.w), cap: 'round', join: 'round', name: 'Body' }, [solid(ink(tone)), el('TrimPath', { end: 0, id: b, name: 'Trim' })]),
    ]));
    // snow settles on the top of anything thick enough and not too steep
    const ang = Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
    if (seg.w > 2.4 && Math.abs(Math.sin(ang)) < 0.62 && r() < 0.85) {
      const top = resample(pts, 6).map((p) => P(p.x, p.y - seg.w / 2));
      const capId = ids.next();
      snow.push(snowCap(r, top, Math.min(7, 1.6 + seg.w * 0.55), { id: capId, opacity: 0 }));
      grow.push(appear(capId, Math.round(seg.t1) + 30, 40));
      caps.push({ id: capId, c: top[3], w: seg.w, len: Math.hypot(seg.b.x - seg.a.x, seg.b.y - seg.a.y), seg });
    }
  }
  const introLen = Math.round(Math.max(...tree.segs.map((x) => x.t1))) + 80;

  // two dried maple leaves still hanging on, the one warm thing in the woods
  const leafNodes = [];
  const leafTips = tree.tips.filter((t) => t.th < 4 && t.p.x > 40 && t.p.y < H - 40 && t.p.y > 30).slice(0, 2);
  const leafIds = [];
  leafTips.forEach((tp, i) => {
    const id = ids.next();
    leafIds.push(id);
    const lp = mapleLeaf(r);
    leafNodes.push(el('Node', { name: 'leaf', x: tp.p.x, y: tp.p.y, rotation: 0.3 + i * 0.4, id, opacity: 0 }, [
      el('Shape', { name: 'stem' }, [pathXml([P(0, 0), P(1, 5), P(0, 9)]), stroke(ink(0.8), 0.8)]),
      el('Node', { name: 'blade', y: 20 }, [
        washShape({ pts: lp.map((p) => P(p.x + 1.5, p.y + 1)), color: i ? 'C27A3A' : RUST, alpha: 0.75, edge: 0.9, soft: 1, tension: 0.35 }),
        inkShape({ pts: lp, closed: true, tension: 0.35, color: ink(0.85), width: 0.8, bleed: 0 }),
        inkShape({ pts: [P(0, 8), P(0, -10)], color: ink(0.6), width: 0.6, bleed: 0 }),
      ].reverse()),
    ].reverse()));
    grow.push(appear(id, introLen - 40, 40));
  });

  // two chickadees land on sturdy, level perches: the first as in winter, a
  // friend a moment later from the other side
  const level = caps.filter((c) => c.w > 3 && c.w < 10 && c.seg.a.x < 500 && c.seg.a.x > 140 && c.seg.a.y > 110 && c.len > 30).sort((a, b) => Math.abs(Math.atan2(a.seg.b.y - a.seg.a.y, a.seg.b.x - a.seg.a.x)) - Math.abs(Math.atan2(b.seg.b.y - b.seg.a.y, b.seg.b.x - b.seg.a.x)));
  const perch = level[0] || caps[0];
  const perch2 = level.find((c) => c !== perch && Math.hypot(c.c.x - perch.c.x, c.c.y - perch.c.y) > 110) || level[1] || perch;
  const hits = [];
  const birds = [];
  const idleTracks = [];
  const land = introLen - 20;
  const birdRig = ({ perch, land, flip, trig, offset }) => {
    const pa = perch.seg.a, pb = perch.seg.b;
    const perchAt = (f) => P(pa.x + (pb.x - pa.x) * f, pa.y + (pb.y - pa.y) * f - perch.w / 2 + 0.5);
    const home = perchAt(flip ? 0.6 : 0.45);
    const away = perchAt(flip ? 0.25 : 0.8);
    const sx = flip ? -1.7 : 1.7;
    const birdId = ids.next(), headId = ids.next(), wingId = ids.next(), tailId = ids.next(), bodyId = ids.next();
    const bird = el('Node', { name: 'chickadee', x: home.x, y: home.y, id: birdId, opacity: 0, scaleX: sx, scaleY: 1.7 },
      el('Node', { name: 'squash', id: bodyId }, chickadee(ids, s, r, { headId, wingId, tailId }).reverse()));
    const from = flip ? -90 : 90;
    grow.push(
      { object: birdId, prop: 'opacity', keys: [[0, 0], [land, 0, 'linear'], [land + 10, 1]] },
      { object: birdId, prop: 'y', keys: [[0, home.y - 120], [land, home.y - 120, 'cubic', [0.2, 0.6, 0.4, 1]], [land + 34, home.y]] },
      { object: birdId, prop: 'x', keys: [[0, home.x - from], [land, home.x - from, 'cubic', EASE.out], [land + 34, home.x]] },
      { object: wingId, prop: 'scaleY', keys: [[land, -0.8, 'linear'], [land + 4, 1], [land + 8, -0.8], [land + 12, 1], [land + 16, -0.6], [land + 22, 1], [land + 30, 0.7], [land + 34, 1]] },
      { object: bodyId, prop: 'scaleY', keys: [[land + 32, 1, 'cubic', EASE.out], [land + 37, 0.84, 'cubic', EASE.back], [land + 52, 1]] },
    );
    // idle: head tilts (irregular), a tail flick; the friend runs the same score a few beats off
    const IDLE = 720;
    const sh = (t) => (t + offset) % IDLE;
    const headKeys = [[0, 0, 'cubic', EASE.inOut], [70, 0, 'cubic', EASE.out], [78, 0.32, 'hold'], [150, 0.32, 'cubic', EASE.out], [158, 0, 'hold'], [300, 0, 'cubic', EASE.out], [306, -0.22, 'hold'], [340, -0.22, 'cubic', EASE.out], [346, 0.18, 'hold'], [380, 0.18, 'cubic', EASE.out], [388, 0, 'hold'], [560, 0, 'cubic', EASE.out], [566, 0.4, 'hold'], [600, 0.4, 'cubic', EASE.out], [608, 0, 'hold']];
    const tailKeys = [[0, 0], [220, 0, 'cubic', EASE.out], [225, -0.35, 'cubic', EASE.inOut], [236, 0], [470, 0, 'cubic', EASE.out], [474, -0.3, 'cubic', EASE.inOut], [482, 0.05, 'cubic', EASE.inOut], [490, 0]];
    const shift = (keys) => {
      const out = keys.map((k) => [sh(k[0]), ...k.slice(1)]).sort((a, b) => a[0] - b[0]);
      if (out[0][0] !== 0) out.unshift([0, out[out.length - 1][1], 'hold']);
      out.push([IDLE, out[0][1]]);
      return out;
    };
    idleTracks.push({ object: headId, prop: 'rotation', keys: shift(headKeys) }, { object: tailId, prop: 'rotation', keys: shift(tailKeys) });
    // hop: along the perch and back, with a flutter
    const hop = s.input('trigger', trig);
    const hopTracks = [];
    const hopTo = (from, to, t, len, lift) => {
      hopTracks.push(
        { object: birdId, prop: 'x', keys: [[t, from.x, 'cubic', EASE.inOut], [t + len, to.x]] },
        { object: birdId, prop: 'y', keys: [[t, from.y, 'cubic', EASE.out], [t + len / 2, Math.min(from.y, to.y) - lift, 'cubic', EASE.in], [t + len, to.y]] },
      );
    };
    hopTo(home, away, 0, 22, 18);
    hopTo(away, home, 60, 26, 26);
    const merged = {};
    for (const tr of hopTracks) (merged[tr.prop] ||= []).push(...tr.keys);
    const hopAnim = s.anim({
      name: `Hop ${trig}`, duration: 110,
      tracks: [
        { object: birdId, prop: 'x', keys: merged.x },
        { object: birdId, prop: 'y', keys: merged.y },
        { object: birdId, prop: 'scaleX', keys: [[0, sx, 'hold'], [41, sx, 'hold'], [42, -sx, 'hold'], [58, -sx, 'hold'], [59, sx, 'hold'], [110, sx]] },
        { object: wingId, prop: 'scaleY', keys: [[0, 1], [4, -0.7], [8, 1], [12, -0.7], [18, 1], [60, 1], [64, -0.8], [68, 1], [72, -0.8], [76, 1], [82, -0.5], [88, 1]] },
        { object: bodyId, prop: 'scaleY', keys: [[0, 0.85, 'cubic', EASE.out], [6, 1.08, 'cubic', EASE.inOut], [22, 0.86, 'cubic', EASE.back], [34, 1], [60, 0.86, 'cubic', EASE.out], [66, 1.08], [86, 0.86, 'cubic', EASE.back], [100, 1]] },
        { object: headId, prop: 'rotation', keys: [[24, 0, 'cubic', EASE.out], [30, -0.3, 'hold'], [50, -0.3, 'cubic', EASE.out], [56, 0]] },
      ],
    });
    s.triggerLayer(`hop ${trig}`, hop, hopAnim, { fromAny: false, mix: 0 });
    const birdHit = ids.next();
    hits.push(el('Shape', { name: 'birdHit', x: home.x - (flip ? -4 : 4), y: home.y - 24, id: birdHit }, [el('Ellipse', { width: 64, height: 54, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(birdHit, 'click', [Scene.fire(hop)]);
    s.listen(birdHit, 'enter', [Scene.fire(hop)]);
    birds.push(bird);
  };
  birdRig({ perch, land, flip: false, trig: 'hop', offset: 0 });
  birdRig({ perch: perch2, land: land + 80, flip: true, trig: 'hop2', offset: 310 });
  const introEnd = introLen + 140;
  const intro = s.anim({ name: 'Grow', duration: introEnd, tracks: grow });
  const IDLE = 720;
  const tilt = s.anim({
    name: 'Bird idle', duration: IDLE, loop: 'loop',
    tracks: [
      ...idleTracks,
      ...leafIds.map((id, i) => ({ object: id, prop: 'rotation', keys: [[0, 0.3 + i * 0.4, 'cubic', EASE.inOut], [IDLE / 2, 0.3 + i * 0.4 + (i ? -0.35 : 0.3), 'cubic', EASE.inOut], [IDLE, 0.3 + i * 0.4]] })),
    ],
  });
  const wait = s.anim({ name: 'Wait', duration: introEnd, tracks: [] });
  s.sequenceLayer('idle', [wait, tilt]);

  // brush the branch: snow lets go of the bigger caps
  const shakeCaps = caps.filter((c) => c !== perch && c !== perch2 && c.w > 3.2).slice(0, 4);
  const puffs = [];
  shakeCaps.forEach((c, k) => {
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    puffs.push(...puff(ids, r, c.c, 0, tr, 8, 26));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x, y: c.c.y, id: hid }, [el('Ellipse', { width: Math.max(40, c.len), height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });

  s.add(...wood.reverse(), ...snow, ...leafNodes, ...birds, ...puffs, ...hits);
  s.loopLayer('grow', intro);
  return s.toXml();
}

// ---------- balsam fir + an overturned red canoe, bottom right

function firBR(ids) {
  const W = 520, H = 620;
  const s = new Scene(ids, { name: 'FirBR', w: W, h: H, x: 1200, y: 0, bg: BG });
  const r = rng(52);
  const fir = coniferAuto(ids, r, { cx: 392, base: 586, height: 470, maxW: 88, tiers: 26, color: FIR, alpha: 1, t0: 30, snowiness: 0.85 });
  const small = coniferAuto(ids, r, { cx: 486, base: 590, height: 250, maxW: 46, tiers: 15, color: '7C9790', alpha: 0.5, t0: 60 });
  const grow = [];

  // the canoe, keel up, half buried
  // keel up: a long low arch whose pointed ends dip into the snow
  const hull = [P(58, 590), P(84, 576), P(130, 565), P(200, 560), P(270, 563), P(318, 572), P(350, 590), P(300, 584), P(204, 582), P(110, 584)];
  const canoeId = ids.next();
  const keel = hull.slice(0, 7);
  const gunwale = [P(66, 588), P(110, 583), P(204, 581), P(300, 583), P(342, 588)];
  const canoe = el('Node', { name: 'canoe', id: canoeId, opacity: 0 }, [
    washShape({ pts: hull.map((p) => P(p.x + 3, p.y + 1.5)), color: CANOE, alpha: 0.9, edge: 0.9, soft: 1.1, tension: 0.6 }),
    // a highlight where the low sun catches the hull
    el('Shape', { name: 'shine' }, [pathXml([P(120, 568), P(200, 563), P(268, 566)], { tension: 0.9 }), stroke(argb('F2B9A2', 0.55), 2.2, { feather: 1.2 })]),
    el('Shape', { name: 'gunwaleWash', blendModeValue: 'multiply' }, [pathXml(gunwale, { tension: 0.8 }), stroke(argb('6B3B22', 0.75), 3)]),
    inkShape({ pts: hull, closed: true, tension: 0.6, color: ink(), width: 1.3, bleed: 0.14 }),
    inkShape({ pts: gunwale, tension: 0.8, color: ink(0.75), width: 0.9, bleed: 0 }),
    snowCap(r, resample(keel, 11).slice(2, -2).map((p) => P(p.x, p.y - 0.4)), 7),
  ].reverse());
  grow.push(appear(canoeId, 150, 50));
  const ground = drift(r, { x0: 20, x1: W + 30, y: 598, h: 22, taperL: true, shadows: [{ x: 210, y: 598, rx: 140, ry: 9 }, { x: 400, y: 594, rx: 80, ry: 8 }] });
  const tuftId = ids.next();
  const tufts = [];
  for (const gx of [30, 160, 352]) for (let k = 0; k < 5; k++) tufts.push([P(gx + k * 2.5, 597), P(gx + k * 3 + r.jit(6) - 4, 597 - r.range(6, 14))]);
  grow.push(appear(tuftId, 200, 40));

  const hits = [];
  const puffs = [];
  const interactive = fir.caps.filter((c) => c.f > 0.1 && c.f < 0.8).filter((_, i) => i % 3 === 1).slice(0, 4);
  interactive.forEach((c, k) => {
    if (process.env.WINTER_DEBUG) console.error('fir cap', k, Math.round(c.c.x), Math.round(c.c.y));
    const trig = s.input('trigger', `shake${k}`);
    const tr = [...slideTracks(c.id, 0, { back: 220 })];
    puffs.push(...puff(ids, r, c.c, 0, tr, 7, 26));
    s.triggerLayer(`shake ${k}`, trig, s.anim({ name: `Shake ${k}`, duration: 300, tracks: tr }), { fromAny: false, mix: 0 });
    const hid = ids.next();
    hits.push(el('Shape', { name: 'hit', x: c.c.x, y: c.c.y - 4, id: hid }, [el('Ellipse', { width: c.L * 1.3, height: 26, originX: 0.5, originY: 0.5, name: 'P' }), fill('00000000')]));
    s.listen(hid, 'enter', [Scene.fire(trig)]);
  });

  s.add(
    ...small.back, ...small.mid, ...small.front,
    ...fir.back, ...fir.mid, ...fir.front,
    ...ground, canoe,
    ticks(tufts, { width: 0.9, color: ink(0.8), id: tuftId, opacity: 0, name: 'tufts' }),
    ...puffs, ...hits,
  );
  s.loopLayer('grow', s.anim({ name: 'Grow', duration: 300, tracks: [...grow, ...gatherTracks()] }));
  return s.toXml();
}

// ---------- pale winter sun; scroll slides it along its low arc

function sun(ids) {
  const s = new Scene(ids, { name: 'Sun', w: 420, h: 420, x: 1780, y: 0, bg: BG });
  const r = rng(9);
  const sunId = ids.next();
  const haloId = ids.next();
  const disc = el('Node', { name: 'sun', x: 120, y: 300, id: sunId }, [
    el('Shape', { name: 'disc' }, [pathXml(blobPts(36, 36, r, { n: 12, wobble: 0.03 }), { closed: true }), fill(argb('FFF0C4', 0.85), { feather: 3 })]),
    el('Shape', { name: 'rim' }, [pathXml(blobPts(36, 36, r, { n: 12, wobble: 0.03 }), { closed: true }), stroke(argb('E8C98A', 0.35), 1.2, { feather: 1 })]),
    el('Shape', { name: 'glow', id: haloId }, [el('Ellipse', { width: 180, height: 180, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFF4D6', 0.55), { feather: 46 })]),
  ]);
  s.add(disc);
  const scroll = s.input('number', 'scroll', 0);
  const low = s.anim({ name: 'Morning', duration: 1, tracks: [{ object: sunId, prop: 'x', keys: [[0, 110]] }, { object: sunId, prop: 'y', keys: [[0, 300]] }] });
  const high = s.anim({ name: 'Noon', duration: 1, tracks: [{ object: sunId, prop: 'x', keys: [[0, 300]] }, { object: sunId, prop: 'y', keys: [[0, 150]] }] });
  s.blendLayer('scroll', scroll, [{ anim: low, value: 0 }, { anim: high, value: 100 }]);
  s.loopLayer('shimmer', s.anim({ name: 'Shimmer', duration: 480, loop: 'pingPong', tracks: [{ object: haloId, prop: 'opacity', keys: [[0, 0.65, 'cubic', EASE.inOut], [480, 1]] }, { object: haloId, prop: 'scaleX', keys: [[0, 0.94, 'cubic', EASE.inOut], [480, 1.06]] }, { object: haloId, prop: 'scaleY', keys: [[0, 0.94, 'cubic', EASE.inOut], [480, 1.06]] }] }));
  s.loopLayer('rise', s.anim({ name: 'Rise', duration: 150, tracks: [{ object: sunId, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [150, 1]] }] }));
  return s.toXml();
}

// ---------- snowfall over the whole page (fit cover)

function snowfall(ids) {
  const W = 800, H = 900;
  const s = new Scene(ids, { name: 'Snow', w: W, h: H, x: 2240, y: 0, bg: BG });
  const r = rng(101);
  const LOOP = 1800;
  const flakes = [];
  const tracks = [];
  for (let i = 0; i < 70; i++) {
    const id = ids.next();
    const near = r();
    const sz = 1.6 + near * 3.4;
    const cycles = near > 0.75 ? 3 : near > 0.35 ? 2 : 1;
    const phase = r();
    const x0 = r.range(0, W);
    flakes.push(el('Shape', { name: 'flake', x: x0, y: -20, id, opacity: 0.35 + near * 0.55 }, [
      el('Ellipse', { width: sz, height: sz * r.range(0.85, 1), originX: 0.5, originY: 0.5, name: 'P' }),
      fill(argb('B6C7D5', 0.8), { feather: near < 0.3 ? 1.2 : 0.4 }),
    ]));
    // y: constant fall, wrapping top to bottom `cycles` times per loop
    const per = LOOP / cycles;
    const ys = [];
    const xs = [];
    const span = H + 40;
    for (let c = 0; c < cycles; c++) {
      const t0 = c * per;
      const wrapAt = t0 + (1 - phase) * per;
      const yStart = -20 + phase * span;
      ys.push([Math.round(t0), yStart, 'linear'], [Math.round(wrapAt), H + 20, 'hold'], [Math.round(wrapAt) + 1, -20, 'linear']);
    }
    ys.push([LOOP, -20 + phase * span]);
    // drop duplicate frames created by rounding
    const seen = new Set();
    tracks.push({ object: id, prop: 'y', keys: ys.filter((k) => (seen.has(k[0]) ? false : seen.add(k[0]))).sort((a, b) => a[0] - b[0]) });
    const sway = 8 + near * 16;
    const n = 6;
    for (let k = 0; k <= n; k++) xs.push([Math.round((k / n) * LOOP), x0 + (k === n ? 0 : (k % 2 ? sway : -sway) * (k === 0 ? 0 : 1)) + (k === 0 || k === n ? 0 : r.jit(4)), 'cubic', EASE.inOut]);
    tracks.push({ object: id, prop: 'x', keys: xs });
  }
  s.add(...flakes);
  s.loopLayer('fall', s.anim({ name: 'Fall', duration: LOOP, loop: 'loop', tracks }));
  return s.toXml();
}

function tracksArtboard(ids, { name, x, kind }) {
  const s = new Scene(ids, { name, w: 240, h: 40, x, y: 1000, bg: BG });
  const r = rng(kind === 'hare' ? 3 : 4);
  const prints = [];
  const tracks = [];
  let t = 6;
  const add = (shapes) => {
    const id = ids.next();
    prints.push(el('Node', { name: 'print', id, opacity: 0 }, shapes));
    tracks.push({ object: id, prop: 'opacity', keys: [[0, 0], [t, 0, 'cubic', EASE.out], [t + 10, 1]] });
  };
  if (kind === 'hare') {
    // snowshoe hare: two small fore prints one behind the other, big hind feet ahead side by side
    for (let g = 0; g < 4; g++) {
      const gx = 24 + g * 50 + r.jit(3);
      add([...printShape(r, gx, 22 + r.jit(1), 2.2, 2.6), ...printShape(r, gx + 7, 19 + r.jit(1), 2.2, 2.6)]);
      t += 6;
      add([...printShape(r, gx + 19, 14 + r.jit(1), 5.5, 2.6, -0.1), ...printShape(r, gx + 19, 27 + r.jit(1), 5.5, 2.6, 0.1)]);
      t += 16;
    }
  } else {
    // red fox: a neat single line of oval prints, each with a dot of toes
    for (let k = 0; k < 9; k++) {
      const px = 22 + k * 23 + r.jit(1.5);
      const py = 20 + (k % 2 ? 2.5 : -2.5);
      add([...printShape(r, px, py, 3, 2.4), ...printShape(r, px + 4.5, py - 1.2, 0.9, 0.9), ...printShape(r, px + 4.5, py + 1.2, 0.9, 0.9)]);
      t += 9;
    }
  }
  s.add(...prints);
  s.loopLayer('walk', s.anim({ name: 'Walk', duration: t + 20, tracks }));
  return s.toXml();
}

export default function () {
  const ids = new Ids(10);
  return document(
    standL(ids),
    mapleTR(ids),
    firBR(ids),
    sun(ids),
    snowfall(ids),
    treeline(ids),
    tracksArtboard(ids, { name: 'HareTracks', x: 0, kind: 'hare' }),
    tracksArtboard(ids, { name: 'FoxTracks', x: 300, kind: 'fox' }),
    creek(ids),
    cabin(ids),
    fence(ids),
    lake(ids),
    snag(ids),
  );
}
