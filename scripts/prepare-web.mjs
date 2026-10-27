// Prepares www/ for packaging: bundles the Capacitor runtime and stamps the version.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createPublicKey } from 'node:crypto';
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

const version = process.env.APP_VERSION || '1.04';
const buildNo = process.env.GITHUB_RUN_NUMBER || 'dev';
const info = { version, build: buildNo };

// Public half of the release key: the app only accepts in-app updates signed with the matching private key.
const pubFile = process.env.UPDATE_KEY_DIR ? join(process.env.UPDATE_KEY_DIR, 'pub.pem') : '';
if (pubFile && existsSync(pubFile)) {
  const jwk = createPublicKey(readFileSync(pubFile)).export({ format: 'jwk' });
  info.updateKey = Object.fromEntries(Object.entries(jwk).filter(([k]) => ['kty', 'n', 'e', 'crv', 'x', 'y'].includes(k)));
  console.log('update key', jwk.kty, jwk.crv || '');
} else {
  console.log('no update key: in-app updates are off in this build');
}
writeFileSync(join(www, 'js', 'version.js'), 'window.MYCAR_VERSION = ' + JSON.stringify(info) + ';\n');
console.log('version', version, 'build', buildNo);
