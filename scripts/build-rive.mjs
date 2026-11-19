// Regenerates each rive/<scene>/scene.rml from its gen.mjs, builds it with the
// Rive CLI and copies the .riv into site/riv. Pure RML, no scripts, so the
// unsigned --once build is what the web runtime plays.
import { readdirSync, existsSync, writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const only = process.argv.slice(2);
const scenes = readdirSync(join(root, 'rive')).filter(
  (d) => existsSync(join(root, 'rive', d, 'gen.mjs')) && (!only.length || only.includes(d))
);
mkdirSync(join(root, 'site/riv'), { recursive: true });

let failed = false;
for (const name of scenes) {
  const dir = join(root, 'rive', name);
  const mod = await import(pathToFileURL(join(dir, 'gen.mjs')).href + `?t=${Date.now()}`);
  writeFileSync(join(dir, 'scene.rml'), mod.default());
  try {
    execFileSync('rive', [dir, '--once', '--quiet'], { stdio: 'inherit' });
    const problems = JSON.parse(execFileSync('rive', ['inspect', dir, '--json'], { maxBuffer: 1 << 28 }).toString()).problems || [];
    for (const p of problems) console.log(`  ${name}: ${p.severity} ${p.kind} (line ${p.line}) ${p.message}`);
    copyFileSync(join(dir, 'build', `${name}.riv`), join(root, 'site/riv', `${name}.riv`));
    console.log(`built ${name}`);
  } catch (e) {
    failed = true;
    console.error(`FAILED ${name}`);
  }
}
process.exit(failed ? 1 : 0);
