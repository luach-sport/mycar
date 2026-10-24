// Builds the public website (GitHub Pages) from the app itself:
//   _site/index.html   the user guide (site/index.html) with the current version and release notes
//   _site/shots/*.jpg  fresh screenshots of the real app with example data
//   _site/og.jpg       link preview picture (WhatsApp, etc.)
//   _site/app/         the web version of the app
// Run: node scripts/site-build.mjs   (needs the `playwright` package and its Chromium)
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const out = join(root, '_site');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'shots'), { recursive: true });

// ---------- version and release notes ----------
let info = { version: '', build: '', notes: [] };
try {
  const doc = JSON.parse(readFileSync(join(root, 'update.json'), 'utf8'));
  const p = JSON.parse(doc.payload);
  info = { version: String(p.version), build: String(p.build), notes: Array.isArray(p.notes) ? p.notes.map(String) : [] };
} catch (e) { console.log('no update.json, using the workflow version'); }
if (!info.version) {
  const wf = readFileSync(join(root, '.github/workflows/build.yml'), 'utf8');
  info.version = (wf.match(/APP_VERSION:\s*'([^']+)'/) || [])[1] || '';
  info.build = '';
  info.notes = existsSync(join(root, 'release-notes.txt')) ? readFileSync(join(root, 'release-notes.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean) : [];
}
console.log('version', info.version, 'build', info.build, 'notes', info.notes.length);

// ---------- the web app (served for screenshots, and published under /app/) ----------
cpSync(join(root, 'www'), join(out, 'app'), { recursive: true });
writeFileSync(join(out, 'app', 'js', 'version.js'), 'window.MYCAR_VERSION = ' + JSON.stringify({ version: info.version || 'dev', build: info.build || 'dev' }) + ';\n');
cpSync(join(root, 'www', 'icon-512.png'), join(out, 'icon.png'));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.endsWith('/')) path += 'index.html';
  const file = normalize(join(out, path));
  if (!file.startsWith(out) || !existsSync(file) || statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;

// ---------- example data (relative to today, so the screenshots always look current) ----------
const SEED = `(() => {
  const day = 864e5, now = Date.now();
  const ymd = (t) => new Date(t).toISOString().slice(0, 10);
  const P = (name, lat, lon) => ({ name, sub: '', lat, lon, kind: 'locality' });
  const hadera = P('חדרה', 32.434, 34.919), tlv = P('תל אביב-יפו', 32.08, 34.78), jlm = P('ירושלים', 31.778, 35.2), hfa = P('חיפה', 32.794, 34.99), ntn = P('נתניה', 32.33, 34.86);
  const trip = (d, from, to, km, urb, tag, round, pax) => { const kmT = round ? km * 2 : km, u = round ? urb * 2 : urb; const liters = u / 12 + (kmT - u) / 17;
    return { id: 't' + d + from.name + to.name, ts: now - d * day - 2 * 3600e3, carId: 'c1', title: from.name + ' ← ' + to.name, from, to, km: kmT, urbanKm: u, liters, cost: liters * 8.27, price: 8.27, roundTrip: !!round, passengers: pax || 1, tag, source: 'online', min: kmT * 0.85 }; };
  const trips = [trip(0, hadera, tlv, 48, 12, 'work', true, 1), trip(1, hadera, ntn, 22, 8, 'private', false, 1), trip(3, hadera, hfa, 47, 10, 'work', false, 2),
    trip(6, hadera, jlm, 109, 9, 'private', true, 3), trip(9, hadera, tlv, 48, 12, 'work', true, 1), trip(13, hadera, ntn, 22, 8, 'private', true, 1),
    trip(17, hadera, tlv, 48, 12, 'work', true, 1), trip(21, hadera, hfa, 47, 10, 'private', false, 1)];
  const fuel = []; let odo = 184520;
  [[58, 31.2, 8.08], [44, 33.8, 8.08], [31, 35.1, 8.15], [18, 32.6, 8.15], [5, 34.4, 8.27]].forEach(([d, l, p], i) => {
    odo += i ? Math.round(l * (15.4 + i * 0.3)) : 0;
    fuel.push({ id: 'f' + i, carId: 'c1', ts: now - d * day, amount: +(l * p).toFixed(2), price: p, liters: l, litersMode: false, odo, full: true, station: i % 2 ? 'פז' : 'דלק' });
  });
  return { v: 1, createdAt: now - 70 * day, onboarded: true,
    settings: { theme: 'light', priceMode: 'auto', manualPrice: 0, fullService: false, activeCarId: 'c1', lastTag: 'work' },
    cars: [{ id: 'c1', name: 'הונדה ג׳אז', year: '', fuelType: '95', urban: 12, inter: 17, tank: 42, learn: true, price: 0 }], trips, fuel,
    places: [Object.assign(P('הרצל 10, חדרה', 32.437, 34.917), { id: 'p1', kind: 'home', label: 'בית' })],
    routes: [{ id: 'r1', from: hadera, to: tlv, round: true }, { id: 'r2', from: hadera, to: jlm, round: false }],
    recent: [], reminders: { test: { on: true, date: ymd(now + 60 * day) }, insurance: { on: true, date: ymd(now + 120 * day) }, service: { on: true, every: 15000, lastKm: 180000 } },
    outbox: [], profile: { name: '', email: '' }, lastCalc: { from: hadera, to: jlm, roundTrip: true, passengers: 3 }, lastSync: now, updateSeen: 999999 };
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
// The app checks the network for data and updates; keep the screenshots offline and stable.
await ctx.route((url) => !url.href.startsWith(base), (route) => route.abort());
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base + '/app/index.html');
await page.evaluate((seed) => { localStorage.setItem('mycar.theme', 'light'); localStorage.setItem('mycar.state.v1', JSON.stringify(eval(seed))); }, SEED);
await page.reload();
await page.waitForTimeout(1500);

async function shot(name, fn, arg, wait = 500) {
  if (fn) await page.evaluate(fn, arg);
  await page.waitForTimeout(wait);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(out, 'shots', name + '.jpg'), type: 'jpeg', quality: 86 });
  console.log('shot', name);
}
const tab = (t) => { const m = window.__mycar; m.closeSheet(); m.ui.view = null; m.ui.tab = t; window.MC.render(); };
await shot('calc', tab, 'calc');
await shot('result', () => {
  const m = window.__mycar, ui = m.ui;
  ui.result = { title: 'חדרה ← ירושלים', from: { name: 'חדרה', lat: 32.434, lon: 34.919 }, to: { name: 'ירושלים', lat: 31.778, lon: 35.2 }, route: { km: 109, urbanKm: 9, min: 84, source: 'online' }, roundTrip: true, passengers: 3, carId: 'c1', urbanPct: null, tag: 'private', savedId: null };
  ui.view = 'result'; window.MC.render();
});
await shot('share', () => window.__mycar.openSheet('share', { kind: 'result' }), null, 700);
await shot('trips', tab, 'trips');
await shot('fuel', tab, 'fuel');
await shot('stats', tab, 'stats');
await shot('settings', tab, 'settings');
await page.evaluate(() => { const m = window.__mycar; m.closeSheet(); window.MC.state.profile = { name: 'דני כהן', email: 'dani@example.com' }; m.openSheet('feedback'); });
await page.fill('#fbm', 'הייתי רוצה תזכורת לבדוק לחץ אוויר בצמיגים');
await shot('feedback', null, null, 300);
await shot('update', (i) => {
  const m = window.__mycar; m.closeSheet();
  const b = parseInt(i.build, 10) || 1;
  window.MC.VERSION.build = String(b - 1 > 0 ? b - 1 : b);
  window.MC.update.info = { version: i.version, build: b, notes: i.notes.slice(0, 4), inApp: true };
  m.openSheet('update');
}, info, 600);

// ---------- the guide page ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const date = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Jerusalem' }).format(new Date());
const news = info.notes.length
  ? '  <section class="news" aria-labelledby="news-h">\n    <div class="news-head"><h2 id="news-h">מה חדש</h2><span class="badge">גרסה ' + esc(info.version) + '</span></div>\n    <ul>' +
    info.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul>\n  </section>\n'
  : '';
let html = readFileSync(join(root, 'site', 'index.html'), 'utf8');
html = html.split('{{VERSION}}').join(esc(info.version)).split('{{BUILD}}').join(esc(info.build || '–')).split('{{DATE}}').join(esc(date)).split('{{WHATS_NEW}}').join(news);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error('unfilled placeholder in site/index.html');
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, '.nojekyll'), '');

// Link preview picture: the top of the guide at desktop size.
const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, colorScheme: 'light' });
await og.goto(base + '/index.html');
await og.waitForTimeout(2600);
await og.screenshot({ path: join(out, 'og.jpg'), type: 'jpeg', quality: 85 });
const overflow = await og.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
const phone = await browser.newPage({ viewport: { width: 360, height: 740 } });
await phone.goto(base + '/index.html');
await phone.waitForTimeout(500);
const phoneOverflow = await phone.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

await browser.close();
server.close();
if (errors.length) console.log('page errors:', errors.slice(0, 5));
if (overflow || phoneOverflow) throw new Error('the guide scrolls sideways');
console.log('site ready:', out);
