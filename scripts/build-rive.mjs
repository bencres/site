// Regenerates each rive/<scene>/scene.rml from its gen.mjs, builds it with the
// Rive CLI and copies the .riv into site/riv. Pure RML, no scripts, so the
// unsigned --once build is what the web runtime plays.
// A gen.mjs that exports `names` and `only(name)` (the post sketches) is built one
// artboard per file instead, into site/riv/<scene>/<name>.riv, so a page fetches
// only the artboard it shows; scene.rml keeps them all for previewing.
import { readdirSync, existsSync, writeFileSync, copyFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const only = process.argv.slice(2);
const scenes = readdirSync(join(root, 'rive')).filter(
  (d) => existsSync(join(root, 'rive', d, 'gen.mjs')) && (!only.length || only.includes(d))
);
mkdirSync(join(root, 'site/riv'), { recursive: true });

function build(dir, label) {
  execFileSync('rive', [dir, '--once', '--quiet'], { stdio: 'inherit' });
  const problems = JSON.parse(execFileSync('rive', ['inspect', dir, '--json'], { maxBuffer: 1 << 28 }).toString()).problems || [];
  for (const p of problems) console.log(`  ${label}: ${p.severity} ${p.kind} (line ${p.line}) ${p.message}`);
}

let failed = false;
for (const name of scenes) {
  const dir = join(root, 'rive', name);
  const mod = await import(pathToFileURL(join(dir, 'gen.mjs')).href + `?t=${Date.now()}`);
  writeFileSync(join(dir, 'scene.rml'), mod.default());
  try {
    if (mod.names) {
      const out = join(root, 'site/riv', name);
      rmSync(out, { recursive: true, force: true });
      mkdirSync(out, { recursive: true });
      rmSync(join(root, 'site/riv', `${name}.riv`), { force: true });
      for (const board of mod.names) {
        const file = board.toLowerCase();
        const sub = join(dir, 'build', 'one', file);
        mkdirSync(sub, { recursive: true });
        writeFileSync(join(sub, 'scene.rml'), mod.only(board));
        writeFileSync(join(sub, 'rive.yaml'), `name: ${file}\nmain: ${board}\n`);
        build(sub, `${name}/${file}`);
        copyFileSync(join(sub, 'build', `${file}.riv`), join(out, `${file}.riv`));
      }
    } else {
      build(dir, name);
      copyFileSync(join(dir, 'build', `${name}.riv`), join(root, 'site/riv', `${name}.riv`));
    }
    console.log(`built ${name}`);
  } catch (e) {
    failed = true;
    console.error(`FAILED ${name}`);
  }
}
process.exit(failed ? 1 : 0);
