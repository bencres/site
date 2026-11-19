// Draft 5 · Hello — an ink self-portrait that watches the cursor and reacts
// to the questions a visitor asks. Pupils/head follow `lookX`/`lookY`
// (-100..100) through two blend layers; reactions are triggers.
import {
  Ids, Scene, rng, P, TAU, el, argb, blobPts, inkShape, watercolor, washShape,
  stippleShape, pathXml, fill, stroke, boil, document, EASE,
} from '../lib/ink.mjs';

const INK = 'FF2B2622';
const SKIN = 'EFC3A0';
const SWEATER = '4E8C88';
const HAIR = '6B4A36';
const BLUSH = 'E58C86';
const PAPER = 'FFF6EFE4';

// back-to-front children -> RML order (first child paints on top)
const node = (attrs, kids) => el('Node', attrs, [...kids].reverse());
// an ink outline over a flat tint (inkShape's `extra` would paint the tint on top)
function inkFilled({ name, pts, tint, color = INK, width = 1.9, tension = 1, effect }) {
  const ghost = argb('2B2622', 0.16);
  return el('Shape', { name }, [
    pathXml(pts, { closed: true, tension }),
    fill(tint),
    stroke(ghost, width * 2.2, { feather: width * 1.4, effect }),
    stroke(color, width, { effect }),
  ]);
}
// watercolor() centres its wet glaze and grain on the node origin, so a wash
// built from explicit points is re-centred on their bounding box first
function wcAt({ pts, dx = 0, dy = 0, ...rest }) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const rx = (Math.max(...xs) - Math.min(...xs)) / 2 * 0.85, ry = (Math.max(...ys) - Math.min(...ys)) / 2 * 0.85;
  return watercolor({ ...rest, x: cx + dx, y: cy + dy, rx, ry, pts: pts.map((p) => P(p.x - cx, p.y - cy)) });
}
const jit = (pts, r, a) => pts.map((p) => P(p.x + r.jit(a), p.y + r.jit(a)));

// a capsule-ish closed loop, for fingers
function capsule(cx, cy, w, h, rot, r) {
  return blobPts(w, h, r, { n: 8, wobble: 0.05 }).map((p) => {
    const c = Math.cos(rot), s = Math.sin(rot);
    return P(cx + p.x * c - p.y * s, cy + p.x * s + p.y * c);
  });
}

export default function () {
  const ids = new Ids();
  const s = new Scene(ids, { name: 'Hello', w: 420, h: 480, bg: PAPER });
  const R = rng(20261118);

  // ---------------------------------------------------------------- ids
  const id = {};
  for (const k of ['root', 'headLook', 'headNod', 'features', 'eyesLook', 'eyesBlink', 'hairBack', 'hairFront',
    'brows', 'cheeks', 'hand', 'handWave', 'bubble', 'bubbleTrim', 'hit', 'mouthL', 'mouthM', 'mouthR', 'dot0', 'dot1', 'dot2', 'trail0', 'trail1'])
    id[k] = ids.next();

  // ---------------------------------------------------------------- face geometry (head-local, origin = face centre)
  const facePts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const sin = Math.sin(a);
    const jaw = sin > 0 ? 1 - 0.2 * sin * sin : 1; // narrower toward the chin
    facePts.push(P(Math.cos(a) * 76 * jaw, sin * (sin > 0 ? 94 : 88)));
  }
  const faceBoil = boil(s, {
    name: 'face', seed: 11, cels: 3,
    draw: (r) => [
      inkShape({ name: 'outline', pts: jit(facePts, r, 1.3), closed: true, color: INK, width: 2.2 }),
      inkShape({ name: 'earL', pts: jit([P(-74, -12), P(-90, -10), P(-92, 10), P(-76, 22)], r, 1), color: INK, width: 2 }),
      inkShape({ name: 'earR', pts: jit([P(74, -12), P(90, -10), P(92, 10), P(76, 22)], r, 1), color: INK, width: 2 }),
      inkShape({ name: 'earInL', pts: jit([P(-84, -2), P(-86, 8), P(-80, 12)], r, 0.8), color: INK, width: 1.4, bleed: 0 }),
      inkShape({ name: 'earInR', pts: jit([P(84, -2), P(86, 8), P(80, 12)], r, 0.8), color: INK, width: 1.4, bleed: 0 }),
    ],
  });

  // skin: misregistered a few px from the line, like a quick sketchbook wash
  const skin = [
    wcAt({ name: 'skin', dx: 4, dy: 5, pts: facePts.map((p) => P(p.x * 0.97, p.y * 0.97)), color: SKIN, alpha: 0.55, seed: 4 }),
    watercolor({ name: 'earSkinL', x: -84, y: 6, rx: 9, ry: 15, color: SKIN, alpha: 0.5, seed: 5, grain: false }),
    watercolor({ name: 'earSkinR', x: 86, y: 6, rx: 9, ry: 15, color: SKIN, alpha: 0.5, seed: 6, grain: false }),
  ];

  const cheeks = node({ name: 'cheeks', id: id.cheeks, opacity: 0.35, y: 26 }, [
    watercolor({ name: 'cheekL', x: -46, rx: 16, ry: 9, color: BLUSH, alpha: 0.7, seed: 31, grain: false }),
    watercolor({ name: 'cheekR', x: 48, rx: 16, ry: 9, color: BLUSH, alpha: 0.7, seed: 32, grain: false }),
  ]);

  const fr = rng(77);
  const freckleDots = [];
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) freckleDots.push({ x: side * fr.range(14, 50), y: fr.range(10, 26), r: fr.range(0.7, 1.3) });
  const freckles = stippleShape({ name: 'freckles', dots: freckleDots, color: argb('7A4B32', 0.75) });

  // ---------------------------------------------------------------- hair
  const hr = rng(303);
  const hairMassPts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI; // top half, left -> right
    hairMassPts.push(P(Math.cos(a) * 88 * (1 + hr.jit(0.05)), Math.sin(a) * 104 * (1 + hr.jit(0.06)) - 4));
  }
  // fringe line back across the forehead, right -> left
  for (const [x, y] of [[66, -30], [40, -50], [14, -44], [-12, -56], [-38, -46], [-66, -28]]) hairMassPts.push(P(x + hr.jit(3), y + hr.jit(3)));

  const strands = [];
  // mop silhouette: short curly flicks along the top contour
  for (let i = 0; i < 12; i++) {
    const a = Math.PI * 1.06 + (i / 11) * Math.PI * 0.88;
    const bx = Math.cos(a) * 86, by = Math.sin(a) * 102 - 4;
    const out = hr.range(7, 13);
    const nx = Math.cos(a), ny = Math.sin(a);
    const curl = hr.pick([-1, 1]) * hr.range(6, 10);
    strands.push([P(bx - nx * 6, by - ny * 6), P(bx + nx * out * 0.6 - ny * curl, by + ny * out * 0.6 + nx * curl), P(bx + nx * out + ny * curl * 0.4, by + ny * out - nx * curl * 0.4)]);
  }
  // fringe strands sweeping from the crown to the forehead
  for (let i = 0; i < 8; i++) {
    const ex = -58 + i * 16 + hr.jit(4);
    const ey = -46 + hr.jit(6) - (i === 3 ? 10 : 0);
    strands.push([P(hr.jit(12) - 8, -96), P(ex * 0.55 + hr.jit(6), -78 + hr.jit(5)), P(ex, ey), P(ex + hr.jit(8) + 6, ey + 7)]);
  }
  // two cowlicks
  strands.push([P(-6, -104), P(-14, -122), P(-2, -130), P(4, -122)]);
  strands.push([P(10, -105), P(18, -124), P(28, -126)]);

  const hairInk = boil(s, {
    name: 'hair', seed: 21, cels: 3,
    draw: (r) => [
      inkShape({ name: 'hairline', pts: jit(hairMassPts, r, 1.2), closed: true, color: INK, width: 2, bleed: 0.12 }),
      ...strands.map((st, k) => inkShape({ name: `strand${k}`, pts: jit(st, r, 1.4), color: INK, width: k % 3 ? 1.6 : 2.1, bleed: 0.1 })),
    ],
  });
  const hairWash = wcAt({ name: 'hairWash', dx: 3, dy: 4, pts: hairMassPts, color: HAIR, alpha: 0.75, seed: 8 });
  const hairBackWash = watercolor({ name: 'hairBack', x: 0, y: -30, rx: 94, ry: 84, color: HAIR, alpha: 0.45, seed: 9, grain: false });
  // opaque paper under the face so the hair behind it doesn't muddy the skin
  const faceBase = el('Shape', { name: 'faceBase' }, [pathXml(facePts, { closed: true }), fill(PAPER)]);

  // ---------------------------------------------------------------- features
  const glasses = boil(s, {
    name: 'glasses', seed: 41, cels: 3,
    draw: (r) => [
      inkShape({ name: 'lensL', pts: jit(blobPts(24, 22, r, { n: 9, wobble: 0.03 }).map((p) => P(p.x - 33, p.y - 6)), r, 0.6), closed: true, color: INK, width: 2.3 }),
      inkShape({ name: 'lensR', pts: jit(blobPts(24, 22, r, { n: 9, wobble: 0.03 }).map((p) => P(p.x + 33, p.y - 6)), r, 0.6), closed: true, color: INK, width: 2.3 }),
      inkShape({ name: 'bridge', pts: jit([P(-9, -9), P(0, -14), P(9, -9)], r, 0.6), color: INK, width: 2 }),
      inkShape({ name: 'templeL', pts: jit([P(-57, -9), P(-68, -8), P(-78, -5)], r, 0.6), color: INK, width: 1.8 }),
      inkShape({ name: 'templeR', pts: jit([P(57, -9), P(68, -8), P(78, -5)], r, 0.6), color: INK, width: 1.8 }),
      // a glint on each lens, drawn in paper white
      inkShape({ name: 'glintL', pts: [P(-48, -16), P(-44, -21), P(-38, -24)], color: argb('FFFFFF', 0.85), width: 2, bleed: 0 }),
      inkShape({ name: 'glintR', pts: [P(18, -16), P(22, -21), P(28, -24)], color: argb('FFFFFF', 0.85), width: 2, bleed: 0 }),
    ],
  });

  const pupil = (x) => [
    el('Shape', { name: 'pupil', x, y: 0 }, [el('Ellipse', { width: 10, height: 12, originX: 0.5, originY: 0.5, name: 'P' }), fill(INK)]),
    el('Shape', { name: 'shine', x: x + 2, y: -2.5 }, [el('Ellipse', { width: 3, height: 3, originX: 0.5, originY: 0.5, name: 'P' }), fill(PAPER)]),
  ];
  const eyes = node({ name: 'eyesLook', id: id.eyesLook, y: -4 }, [
    node({ name: 'eyesBlink', id: id.eyesBlink }, [...pupil(-33).reverse(), ...pupil(33).reverse()]),
  ]);

  const brows = node({ name: 'brows', id: id.brows }, [
    inkShape({ name: 'browL', pts: [P(-48, -38), P(-35, -44), P(-20, -41)], color: INK, width: 2.6 }),
    inkShape({ name: 'browR', pts: [P(20, -41), P(35, -45), P(49, -39)], color: INK, width: 2.6 }),
  ]);

  const nose = inkShape({ name: 'nose', pts: [P(3, 4), P(-4, 15), P(1, 20), P(7, 18)], color: INK, width: 2 });

  // mouth: three animatable vertices (neutral is a small, closed smile)
  const MOUTH = { neutral: [[-14, 40], [0, 44], [14, 39]], smile: [[-19, 36], [0, 49], [19, 35]], hmm: [[-12, 42], [2, 41], [12, 39]], laugh: [[-21, 34], [0, 52], [21, 33]] };
  const mouth = el('Shape', { name: 'mouth' }, [
    el('PointsPath', { isClockwise: 'true', name: 'Path' }, [
      el('CubicMirroredVertex', { x: -14, y: 40, rotation: 0.5, distance: 4, id: id.mouthL }),
      el('CubicMirroredVertex', { x: 0, y: 44, rotation: 0, distance: 6, id: id.mouthM }),
      el('CubicMirroredVertex', { x: 14, y: 39, rotation: -0.5, distance: 4, id: id.mouthR }),
    ]),
    stroke(argb('2B2622', 0.18), 5, { feather: 3 }),
    stroke(INK, 2.4),
  ]);
  const mouthKeys = (pose, f = 0, interp = 'cubic', ease = EASE.inOut) =>
    ['mouthL', 'mouthM', 'mouthR'].flatMap((k, i) => [
      { object: id[k], prop: 'x', at: [f, MOUTH[pose][i][0], interp, ease] },
      { object: id[k], prop: 'y', at: [f, MOUTH[pose][i][1], interp, ease] },
    ]);

  const features = node({ name: 'features', id: id.features }, [eyes, glasses.xml, brows, nose, mouth]);

  // ---------------------------------------------------------------- body
  // the sketch trails off before the artboard edge instead of being cropped
  const sweaterPts = [P(-168, 252), P(-164, 200), P(-130, 160), P(-60, 134), P(-30, 128), P(0, 140), P(30, 128), P(60, 134), P(130, 160), P(164, 200), P(168, 250)];
  const sweaterWashPts = [...sweaterPts, P(130, 262), P(80, 252), P(30, 266), P(-30, 256), P(-90, 266), P(-140, 258)];
  const body = [
    wcAt({ name: 'sweaterWash', dx: 5, dy: 6, pts: sweaterWashPts.map((p) => P(p.x * 0.98, p.y)), color: SWEATER, alpha: 0.5, seed: 51 }),
    boil(s, {
      name: 'sweater', seed: 61, cels: 3,
      draw: (r) => [
        inkShape({ name: 'shoulders', pts: jit(sweaterPts, r, 1.4), color: INK, width: 2.2 }),
        inkShape({ name: 'collar', pts: jit([P(-34, 134), P(0, 152), P(34, 134)], r, 1), color: INK, width: 1.8 }),
        inkShape({ name: 'rib', pts: jit([P(-28, 140), P(0, 157), P(28, 140)], r, 1), color: INK, width: 1.2, bleed: 0 }),
        ...[[-110, 206], [-80, 232], [-132, 236], [96, 214], [126, 238], [64, 240], [-40, 222], [30, 228]].map(([x, y], k) =>
          inkShape({ name: `knit${k}`, pts: jit([P(x - 4, y - 4), P(x, y + 2), P(x + 4, y - 4)], r, 0.6), color: argb('2B2622', 0.55), width: 1.2, bleed: 0 })),
      ],
    }).xml,
  ];
  const neck = [
    watercolor({ name: 'neckWash', x: 3, y: 112, rx: 26, ry: 30, color: SKIN, alpha: 0.5, seed: 71, grain: false }),
    inkShape({ name: 'neckL', pts: [P(-26, 82), P(-25, 108), P(-29, 132)], color: INK, width: 2 }),
    inkShape({ name: 'neckR', pts: [P(26, 82), P(25, 108), P(29, 132)], color: INK, width: 2 }),
  ];

  // ---------------------------------------------------------------- head assembly
  const hit = el('Shape', { name: 'faceHit', id: id.hit }, [el('Ellipse', { width: 170, height: 200, originX: 0.5, originY: 0.5, name: 'P' }), fill('00FFFFFF')]);
  const head = node({ name: 'headLook', id: id.headLook }, [
    node({ name: 'headNod', id: id.headNod }, [
      node({ name: 'hairBackNode', id: id.hairBack }, [hairBackWash]),
      faceBase,
      ...skin,
      faceBoil.xml,
      cheeks,
      freckles,
      features,
      node({ name: 'hairFront', id: id.hairFront }, [hairWash, hairInk.xml]),
      hit,
    ]),
  ]);

  // ---------------------------------------------------------------- waving hand (parked below the artboard)
  const hand = node({ name: 'hand', id: id.hand, x: 160, y: 420 }, [
    node({ name: 'handWave', id: id.handWave }, [
      // opaque paper first, so the raised arm hides the shoulder behind it
      el('Shape', { name: 'sleeveBase' }, [pathXml([P(-29, 128), P(-30, 60), P(-25, 6), P(25, 6), P(30, 60), P(31, 128)], { closed: true }), fill(PAPER)]),
      watercolor({ name: 'sleeve', x: 2, y: 64, rx: 27, ry: 58, color: SWEATER, alpha: 0.5, seed: 81 }),
      inkShape({ name: 'sleeveL', pts: [P(-28, 122), P(-30, 60), P(-24, 6)], color: INK, width: 2.2 }),
      inkShape({ name: 'sleeveR', pts: [P(30, 118), P(30, 60), P(24, 6)], color: INK, width: 2.2 }),
      inkShape({ name: 'cuff', pts: [P(-25, 8), P(0, 13), P(25, 8)], color: INK, width: 1.8 }),
      watercolor({ name: 'palmWash', x: 2, y: -22, rx: 20, ry: 24, color: SKIN, alpha: 0.6, seed: 82, grain: false }),
      inkShape({ name: 'palm', pts: [P(-18, 4), P(-21, -22), P(-14, -38), P(14, -40), P(20, -22), P(18, 4)], color: INK, width: 2 }),
      ...[[-12, -52, -0.12], [-3, -57, -0.03], [6, -56, 0.05], [15, -50, 0.16]].map(([x, y, rot], k) =>
        inkFilled({ name: `finger${k}`, pts: capsule(x, y, 5, 13, rot, rng(90 + k)), tint: argb(SKIN, 0.55) })),
      inkFilled({ name: 'thumb', pts: capsule(-25, -26, 5, 12, -0.85, rng(99)), tint: argb(SKIN, 0.55) }),
    ]),
  ]);

  // ---------------------------------------------------------------- thought bubble
  const cloud = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const k = i % 2 ? 0.86 : 1.04;
    cloud.push(P(Math.cos(a) * 50 * k + R.jit(1.5), Math.sin(a) * 32 * k + R.jit(1.5)));
  }
  const dot = (i, x) => el('Shape', { name: `dot${i}`, x, y: 0, id: id[`dot${i}`], scaleX: 0, scaleY: 0 }, [el('Ellipse', { width: 8, height: 8, originX: 0.5, originY: 0.5, name: 'P' }), fill(INK)]);
  const trail = (k, x, y, r) => el('Shape', { name: `trail${k}`, x, y, id: id[`trail${k}`], scaleX: 0, scaleY: 0 }, [el('Ellipse', { width: r * 2, height: r * 2, originX: 0.5, originY: 0.5, name: 'P' }), fill(argb('FFFFFF', 0.6)), stroke(INK, 1.8)]);
  s.add(el('GroupEffect', { name: 'bubbleDraw', id: ids.next() }, el('TrimPath', { start: 0, end: 0, id: id.bubbleTrim, name: 'Trim' })));
  const groupEffectId = s.drawables.at(-1).match(/id="(0:\d+)"/)[1];
  const bubble = node({ name: 'bubble', id: id.bubble, x: 150, y: -150, opacity: 0 }, [
    trail(1, -76, 66, 4),
    trail(0, -58, 44, 7),
    inkFilled({ name: 'cloud', pts: cloud, tension: 1.25, width: 2, effect: groupEffectId, tint: argb('FFFFFF', 0.55) }),
    dot(0, -18), dot(1, 0), dot(2, 18),
  ]);

  // ---------------------------------------------------------------- assemble
  const root = node({ name: 'character', id: id.root, x: 196, y: 205 }, [...body, ...neck, head, hand, bubble]);
  s.add(root);

  // ---------------------------------------------------------------- idle: breath, boil, blink
  s.loopLayer('breath', s.anim({
    name: 'breath', duration: 210, loop: 'pingPong',
    tracks: [{ object: id.root, prop: 'y', keys: [[0, 205, 'cubic', EASE.inOut], [210, 202.5]] }],
  }));
  for (const b of [faceBoil, hairInk, glasses]) s.loopLayer(`boil`, b.animId);
  // the sweater boil was created inline; its animation is the last boil anim declared
  s.loopLayer('boil sweater', s.anims.map((a) => a.match(/name="sweater boil" id="(0:\d+)"/)?.[1]).find(Boolean));

  const blinkAt = [70, 250, 268, 470, 640];
  const blinkKeys = [[0, 1, 'hold']];
  for (const f of blinkAt) blinkKeys.push([f, 1, 'cubic', EASE.in], [f + 4, 0.08, 'hold'], [f + 7, 0.08, 'cubic', EASE.out], [f + 12, 1, 'hold']);
  s.loopLayer('blink', s.anim({ name: 'blink', duration: 720, loop: 'loop', tracks: [{ object: id.eyesBlink, prop: 'scaleY', keys: blinkKeys }] }));

  // ---------------------------------------------------------------- look-at blends
  const lookX = s.input('number', 'lookX', 0);
  const lookY = s.input('number', 'lookY', 0);
  const pose = (name, tracks) => s.anim({ name, duration: 1, tracks: tracks.map(([object, prop, v]) => ({ object, prop, keys: [[0, v]] })) });
  const px = (t) => [
    [id.headLook, 'x', 5 * t], [id.headLook, 'rotation', 0.045 * t],
    [id.features, 'x', 6 * t], [id.eyesLook, 'x', 5 * t],
    [id.hairFront, 'x', 3 * t], [id.hairBack, 'x', -4 * t],
  ];
  s.blendLayer('look x', lookX, [-1, 0, 1].map((t) => ({ anim: pose(`lookX ${t}`, px(t)), value: t * 100 })));
  const py = (t) => [
    [id.headLook, 'y', 3 * t], [id.features, 'y', 4 * t], [id.eyesLook, 'y', -4 + 4 * t],
    [id.hairFront, 'y', 1.5 * t], [id.hairBack, 'y', -3 * t], [id.brows, 'y', 1.5 * t],
  ];
  s.blendLayer('look y', lookY, [-1, 0, 1].map((t) => ({ anim: pose(`lookY ${t}`, py(t)), value: t * 100 })));

  // ---------------------------------------------------------------- hover: smile + blush
  const hover = s.input('bool', 'hover', false);
  const moodTracks = (mouthPose, blush, cheekScale) => {
    const t = [{ object: id.cheeks, prop: 'opacity', keys: [[0, blush]] }, { object: id.cheeks, prop: 'scaleX', keys: [[0, cheekScale]] }, { object: id.cheeks, prop: 'scaleY', keys: [[0, cheekScale]] }];
    for (const m of mouthKeys(mouthPose)) t.push({ object: m.object, prop: m.prop, keys: [m.at] });
    return t;
  };
  s.boolLayer('hover', hover,
    s.anim({ name: 'calm', duration: 1, tracks: moodTracks('neutral', 0.35, 0.85) }),
    s.anim({ name: 'pleased', duration: 1, tracks: moodTracks('smile', 1, 1.12) }),
    { mixIn: 260, mixOut: 520 });
  s.listen(id.hit, 'enter', [Scene.setBool(hover, true)]);
  s.listen(id.hit, 'exit', [Scene.setBool(hover, false)]);

  // ---------------------------------------------------------------- reactions
  const mouthTrack = (frames) =>
    ['mouthL', 'mouthM', 'mouthR'].flatMap((k, i) => ['x', 'y'].map((prop, j) => ({
      object: id[k], prop, keys: frames.map(([f, p]) => [f, MOUTH[p][i][j], 'cubic', EASE.inOut]),
    })));

  // nod: two little bows of the head, then a smile
  const nod = s.input('trigger', 'nod');
  s.triggerLayer('nod', nod, s.anim({
    name: 'nod', duration: 84,
    tracks: [
      { object: id.headNod, prop: 'y', keys: [[0, 0, 'cubic', EASE.inOut], [12, 7, 'cubic', EASE.inOut], [24, -1, 'cubic', EASE.inOut], [36, 6, 'cubic', EASE.inOut], [50, 0]] },
      { object: id.headNod, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [12, 0.03, 'cubic', EASE.inOut], [36, 0.02, 'cubic', EASE.inOut], [50, 0]] },
      { object: id.cheeks, prop: 'opacity', keys: [[0, 0.35, 'cubic', EASE.inOut], [30, 0.85, 'cubic', EASE.inOut], [84, 0.35]] },
      ...mouthTrack([[0, 'neutral'], [16, 'smile'], [64, 'smile'], [84, 'neutral']]),
    ],
  }));

  // think: brows up, mouth goes "hmm", a thought bubble draws itself on
  const think = s.input('trigger', 'think');
  const dotPop = (k, f) => ['scaleX', 'scaleY'].map((prop) => ({
    object: id[`dot${k}`], prop, keys: [[0, 0, 'hold'], [f, 0, 'elastic', { amplitude: 1, period: 0.5 }], [f + 20, 1, 'hold'], [132, 1, 'cubic', EASE.in], [150, 0]],
  }));
  const trailPop = (k, f) => ['scaleX', 'scaleY'].map((prop) => ({
    object: id[`trail${k}`], prop, keys: [[0, 0, 'hold'], [f, 0, 'cubic', EASE.back], [f + 12, 1, 'hold'], [132, 1, 'cubic', EASE.in], [150, 0]],
  }));
  s.triggerLayer('think', think, s.anim({
    name: 'think', duration: 156,
    tracks: [
      { object: id.brows, prop: 'y', keys: [[0, 0, 'cubic', EASE.out], [14, -7, 'hold'], [120, -7, 'cubic', EASE.inOut], [146, 0]] },
      { object: id.headNod, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [20, -0.06, 'hold'], [120, -0.06, 'cubic', EASE.inOut], [146, 0]] },
      { object: id.eyesBlink, prop: 'y', keys: [[0, 0, 'cubic', EASE.out], [14, -3, 'hold'], [120, -3, 'cubic', EASE.inOut], [146, 0]] },
      { object: id.bubble, prop: 'opacity', keys: [[0, 0, 'cubic', EASE.out], [14, 1, 'hold'], [132, 1, 'cubic', EASE.in], [150, 0]] },
      { object: id.bubbleTrim, prop: 'end', keys: [[0, 0, 'hold'], [16, 0, 'cubic', EASE.out], [52, 1, 'hold'], [150, 1, 'hold'], [156, 0]] },
      ...trailPop(0, 4), ...trailPop(1, 0),
      ...dotPop(0, 48), ...dotPop(1, 60), ...dotPop(2, 72),
      ...mouthTrack([[0, 'neutral'], [14, 'hmm'], [120, 'hmm'], [146, 'neutral']]),
    ],
  }));

  // wave: the hand comes up from below and waves hello
  const wave = s.input('trigger', 'wave');
  const w = [[0, 0], [14, -0.32], [26, 0.18], [38, -0.32], [50, 0.18], [62, -0.22], [74, 0]];
  s.triggerLayer('wave', wave, s.anim({
    name: 'wave', duration: 120,
    tracks: [
      { object: id.hand, prop: 'y', keys: [[0, 420, 'cubic', EASE.out], [24, 118, 'hold'], [86, 118, 'cubic', EASE.in], [116, 420]] },
      { object: id.hand, prop: 'x', keys: [[0, 160, 'cubic', EASE.out], [22, 138, 'hold'], [86, 138, 'cubic', EASE.in], [116, 160]] },
      { object: id.handWave, prop: 'rotation', keys: w.map(([f, v]) => [f + 18, v, 'cubic', EASE.inOut]) },
      { object: id.brows, prop: 'y', keys: [[0, 0, 'cubic', EASE.out], [16, -4, 'hold'], [86, -4, 'cubic', EASE.inOut], [110, 0]] },
      { object: id.headNod, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [20, 0.05, 'hold'], [86, 0.05, 'cubic', EASE.inOut], [110, 0]] },
      { object: id.cheeks, prop: 'opacity', keys: [[0, 0.35, 'cubic', EASE.inOut], [20, 0.9, 'hold'], [90, 0.9, 'cubic', EASE.inOut], [120, 0.35]] },
      ...mouthTrack([[0, 'neutral'], [16, 'smile'], [94, 'smile'], [116, 'neutral']]),
    ],
  }));

  // laugh: eyes squeeze into happy arcs, shoulders bob
  const laugh = s.input('trigger', 'laugh');
  const bob = [];
  for (let i = 0; i < 5; i++) bob.push([8 + i * 9, -4, 'cubic', EASE.inOut], [12 + i * 9, 1, 'cubic', EASE.inOut]);
  s.triggerLayer('laugh', laugh, s.anim({
    name: 'laugh', duration: 96,
    tracks: [
      { object: id.eyesBlink, prop: 'scaleY', keys: [[0, 1, 'cubic', EASE.out], [8, 0.3, 'hold'], [62, 0.3, 'cubic', EASE.inOut], [78, 1]] },
      { object: id.headNod, prop: 'y', keys: [[0, 0, 'cubic', EASE.inOut], ...bob, [62, 0]] },
      { object: id.headNod, prop: 'rotation', keys: [[0, 0, 'cubic', EASE.inOut], [10, -0.05, 'cubic', EASE.inOut], [62, -0.03, 'cubic', EASE.inOut], [80, 0]] },
      { object: id.cheeks, prop: 'opacity', keys: [[0, 0.35, 'cubic', EASE.inOut], [12, 1, 'hold'], [70, 1, 'cubic', EASE.inOut], [96, 0.35]] },
      ...mouthTrack([[0, 'neutral'], [8, 'laugh'], [66, 'laugh'], [90, 'neutral']]),
    ],
  }));
  s.listen(id.hit, 'click', [Scene.fire(laugh)]);

  return document(s.toXml());
}
