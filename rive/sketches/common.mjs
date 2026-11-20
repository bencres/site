// What every post sketch shares: the page's ink, the paper behind a preview, the
// 15 fps ambient step, and the way a sketch arrives (ink drawing itself on, each
// wash soaking in a beat behind it).
import { Scene, el, argb, boil, inkShape, jitterPts, EASE } from '../lib/ink.mjs';

export const W = 720, H = 380;
export const INK = 'FF2B231C';
export const INK_SOFT = argb('2B231C', 0.5);
export const BG = process.env.PREVIEW_BG;
// The boils and the flicker step at 15 fps rather than every frame, all on the same
// ticks, so the canvas can rest between them; a boil holds each cel for two steps
// (7.5 fps). The stories themselves step at 30, which still lands on those ticks.
export const AMBIENT = 15;
export const STORY = 2 * AMBIENT;
export const CEL = 8; // a boil cel, in 60 fps frames
export const DRAW = 100; // frames for the ink to draw itself on

// a group whose children are listed back to front, like Scene.add (Rive paints the
// first child on top)
export const group = (attrs, kids) => el('Node', attrs, [...kids].reverse());

/**
 * A sketch's artboard, with:
 * - `fx`: the draw-on effect; ink that's there from the start passes it as `effect`
 * - `soak(t0, xml, len)`: wraps a wash (or several, back to front) so it soaks in from frame t0
 * - `pen(rr)`: an ink line drawn with that boil cel's jitter, `pen(rr)(pts, opts)`
 * - `line(name, seed, draw)`: a boiling group of ink, drawn once and added
 * - `intro()`: call last; draws the ink on and soaks every wash in
 */
export function sketch(ids, { name, x = 0 }) {
  const s = new Scene(ids, { name, w: W, h: H, x, y: 0, bg: BG });
  const fx = ids.next();
  const trim = ids.next();
  s.add(el('GroupEffect', { name: 'Draw', id: fx }, el('TrimPath', { end: 0, id: trim, name: 'Trim' })));

  const soakTracks = [];
  let last = DRAW;
  const soak = (t0, xml, len = 46) => {
    const id = ids.next();
    soakTracks.push({ object: id, prop: 'opacity', keys: [[0, 0, 'hold'], [t0, 0, 'cubic', EASE.out], [t0 + len, 1]] });
    last = Math.max(last, t0 + len);
    return group({ name: 'soak', id, opacity: 0 }, [].concat(xml));
  };
  const pen = (rr, { drawn = true } = {}) => (pts, o = {}) =>
    inkShape({
      x: o.x, y: o.y, pts: jitterPts(pts, o.j ?? 0.6, rr), closed: o.closed, tension: o.t ?? 1,
      color: o.color ?? INK, width: o.w ?? 1.4, bleed: o.bleed, effect: drawn && o.drawn !== false ? fx : undefined,
    });
  const line = (lineName, seed, draw, { x: bx, y: by, add = true, drawn = true, cels = 3 } = {}) => {
    const b = boil(s, { name: lineName, seed, cels, hold: CEL, rate: AMBIENT, x: bx, y: by, draw: (rr, i) => draw(pen(rr, { drawn }), rr, i) });
    if (add) s.add(b.xml);
    if (cels > 1) s.loopLayer(`${lineName} boil`, b.animId);
    return b;
  };
  const intro = () =>
    s.loopLayer('Intro', s.anim({ name: 'Intro', duration: last, tracks: [{ object: trim, prop: 'end', keys: [[0, 0, 'cubic', [0.55, 0.05, 0.25, 1]], [DRAW, 1]] }, ...soakTracks] }));
  return { s, fx, soak, pen, line, intro };
}
