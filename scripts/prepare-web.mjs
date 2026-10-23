// Prepares www/ for packaging: bundles the Capacitor runtime and stamps the version.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const www = join(root, 'www');

await build({
  entryPoints: [join(root, 'scripts', 'cap-entry.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['chrome80'],
  outfile: join(www, 'cap-runtime.js')
});
console.log('cap-runtime.js built');

const version = process.env.APP_VERSION || '1.01';
const buildNo = process.env.GITHUB_RUN_NUMBER || 'dev';
writeFileSync(join(www, 'js', 'version.js'), 'window.MYCAR_VERSION = ' + JSON.stringify({ version, build: buildNo }) + ';\n');
console.log('version', version, 'build', buildNo);
