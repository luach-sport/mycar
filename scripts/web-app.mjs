// Finishes the web version of MyCar on the website (_site/app/, built by the Itzko site kit) for iPhone and
// browsers: writes the list of the app's files and a version made from their contents into sw.js, so the
// app is kept whole on the phone and works without internet; a change in any file is a new version.
// Run after the kit build:  node scripts/web-app.mjs [_site/app]
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

const dir = process.argv[2] || join(process.cwd(), '_site', 'app');
if (!existsSync(join(dir, 'sw.js'))) throw new Error('no sw.js in ' + dir);

// The native runtime only exists in the Android build; the web version gets an empty file, so nothing is missing offline.
const rt = join(dir, 'cap-runtime.js');
if (!existsSync(rt)) writeFileSync(rt, '/* Web version: no native runtime (Android only). */\n');

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const SKIP = new Set(['sw.js', 'fonts/OFL.txt']);
const files = walk(dir).map((p) => relative(dir, p).split('\\').join('/')).filter((f) => !SKIP.has(f) && !f.startsWith('.')).sort();

const h = createHash('sha256');
for (const f of files) { h.update(f); h.update(readFileSync(join(dir, f))); }
const version = h.digest('hex').slice(0, 12);

const sw = join(dir, 'sw.js');
let src = readFileSync(sw, 'utf8');
const before = src;
src = src.replace("const VERSION = 'dev';", 'const VERSION = ' + JSON.stringify(version) + ';')
  .replace('const FILES = [];', 'const FILES = ' + JSON.stringify(files) + ';');
if (src === before || !src.includes(version)) throw new Error('sw.js placeholders not found');
writeFileSync(sw, src);
const size = files.reduce((n, f) => n + statSync(join(dir, f)).size, 0);
console.log('web app', version, files.length, 'files', Math.round(size / 1024) + ' KB');
