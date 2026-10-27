// "Share the app" as an APK file, with a pretend phone: finds the installed APK, copies it to the cache and
// opens the share menu; falls back to downloading it; explains when there's no internet.
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_FROM || '/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');

const URL = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const errors = [];
const check = (cond, msg) => { if (!cond) errors.push('FAIL: ' + msg); else console.log('ok -', msg); };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, locale: 'he-IL' });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL);
await page.waitForTimeout(500);

// A pretend phone: Filesystem and Share answer like Capacitor does.
const run = (mode) => page.evaluate(async (mode) => {
  const MC = window.MC, calls = [];
  MC.isNative = () => true;
  MC.online = () => mode.online !== false;
  MC.callRaw = async (plugin, method, args) => {
    calls.push(plugin + '.' + method + (args && (args.from || args.url || args.path) ? ' ' + (args.from || args.url || args.path) : ''));
    if (plugin === 'Filesystem' && method === 'readFile') {
      if (mode.noMaps) throw new Error('denied');
      return { data: '7f00-7f10 r--p 00000000 fd:05 123 /system/lib64/libc.so\n7a00-7a90 r--s 0001a000 fd:05 456 /data/app/~~Xy12==/com.luachsport.mycar-Ab9==/base.apk\n' };
    }
    if (plugin === 'Filesystem' && method === 'copy') { if (mode.noCopy) throw new Error('copy failed'); return {}; }
    if (plugin === 'Filesystem' && method === 'downloadFile') return { path: args.path };
    if (plugin === 'Filesystem' && method === 'stat') return { size: 4500000 };
    if (plugin === 'Filesystem' && method === 'getUri') return { uri: 'file:///data/user/0/x/cache/' + args.path };
    if (plugin === 'Share' && method === 'share') { window.__shared = args; return {}; }
    return {};
  };
  window.__shared = null;
  const ok = await MC.shareApp.apk();
  return { ok, calls, shared: window.__shared, toast: (document.querySelector('#toast-root') || {}).textContent || '' };
}, mode);

let r = await run({});
check(r.ok && r.calls.some((c) => c === 'Filesystem.copy /data/app/~~Xy12==/com.luachsport.mycar-Ab9==/base.apk'), 'installed APK found and copied to the cache');
check(r.shared && r.shared.files[0].endsWith('share/mycar.apk') && /MyCar/.test(r.shared.text) && r.shared.text.includes('https://luach-sport.github.io/mycar/'), 'share menu opens with the APK file and the message');
check(!r.calls.some((c) => c.startsWith('Filesystem.downloadFile')), 'nothing downloaded when the installed copy works');

r = await run({ noCopy: true });
check(r.ok && r.calls.some((c) => c.startsWith('Filesystem.downloadFile https://github.com/luach-sport/mycar/releases/latest/download/mycar.apk')), 'falls back to downloading the latest APK');

r = await run({ noMaps: true, online: false });
check(!r.ok && /אין אינטרנט/.test(r.toast), 'no installed copy and no internet: clear message');

await browser.close();
console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nERRORS: none');
process.exit(errors.length ? 1 : 0);
