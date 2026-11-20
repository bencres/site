// Small sketches that head the blog posts, one artboard per post (named by the
// post's `sketch` front matter), each loosely after its post and set in the
// hill's country. Each lives in its own module here; common.mjs holds what they share.
import { Ids, document } from '../lib/ink.mjs';
import niggle from './niggle.mjs';
import pack from './pack.mjs';
import potting from './potting.mjs';
import hearth from './hearth.mjs';
import pigeonholes from './pigeonholes.mjs';

const SKETCHES = { Niggle: niggle, Pack: pack, Potting: potting, Hearth: hearth, Pigeonholes: pigeonholes };

export default function () {
  const ids = new Ids();
  return document(...Object.values(SKETCHES).map((draw, i) => draw(ids, i * 800)));
}

// each artboard is also built alone (scripts/build-rive.mjs), so a post loads only its own
export const names = Object.keys(SKETCHES);
export const only = (name) => document(SKETCHES[name](new Ids(), 0));
