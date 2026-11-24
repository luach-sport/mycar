// "Where did I park?" in a pretend phone with a fake GPS and compass: save (position, floor, note, photo),
// keep it after a restart, find the car (distance, arrow, directions), share, edit, "found", no permission,
// and no sideways scrolling at phone width in light and dark.
// Run with the app served at APP_URL:  node tests/parking.test.mjs
import { createRequire } from 'node:module';
const require = createRequire(process.env.PW_FROM || '/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');

const URL = process.env.APP_URL || 'http://127.0.0.1:8765/index.html';
const SHOTS = process.env.SHOTS || '';
const errors = [];
const check = (cond, msg) => { if (!cond) errors.push('FAIL: ' + msg); else console.log('ok -', msg); };
const CAR = { latitude: 32.434, longitude: 34.919, accuracy: 6 };

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem', geolocation: CAR, permissions: ['geolocation'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const start = async () => {
  await page.waitForFunction(() => window.MC && window.MC.state && window.MC.parking && window.MC.parking.loaded);
  await page.evaluate(() => { window.MC.state.onboarded = true; window.__mycar.closeSheet(); window.MC.render(); });
};
const sheetText = () => page.evaluate(() => (document.querySelector('#sheet-root .sheet') || {}).innerText || '');
const screenText = () => page.evaluate(() => document.querySelector('#screen').innerText);
const noOverflow = () => page.evaluate(() => {
  const s = document.querySelector('#sheet-root .sheet');
  return document.documentElement.scrollWidth <= innerWidth && (!s || s.scrollWidth <= s.clientWidth + 1);
});
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + name + '.png' }); };

await page.goto(URL);
await start();
check((await screenText()).includes('חניתי כאן'), 'the calculator shows "חניתי כאן"');
await shot('card-empty');

// ---------- Save ----------
await page.click('[data-action="park-save"]');
await page.waitForFunction(() => window.MC.parking.spot && window.MC.parking.spot.lat != null, null, { timeout: 15000 });
let spot = await page.evaluate(() => window.MC.parking.spot);
check(Math.abs(spot.lat - CAR.latitude) < 1e-5 && Math.abs(spot.lon - CAR.longitude) < 1e-5 && spot.acc <= 6, 'the GPS position is saved with its accuracy');
await page.waitForFunction(() => document.querySelector('#sheet-root .notice.green'));
check((await sheetText()).includes('המיקום נשמר'), 'the save sheet says the position was saved');
await page.click('[data-action="park-floor"][data-v="-2"]');
await page.fill('#park-note', 'עמוד C4, ליד המעליות');
await page.waitForTimeout(500);
spot = await page.evaluate(() => window.MC.parking.spot);
check(spot.floor === '-2' && spot.note === 'עמוד C4, ליד המעליות', 'floor and note are saved');
const png = Buffer.from((await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1200;
  const g = c.getContext('2d'); g.fillStyle = '#8a8f98'; g.fillRect(0, 0, 1600, 1200); g.fillStyle = '#1652F0'; g.fillRect(600, 200, 400, 300);
  return c.toDataURL('image/png');
})).split(',')[1], 'base64');
await page.setInputFiles('#park-file', { name: 'spot.png', mimeType: 'image/png', buffer: png });
await page.waitForFunction(() => window.MC.parking.photo && document.querySelector('#sheet-root .park-photo img'));
const photoInfo = await page.evaluate(() => new Promise((r) => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight, len: window.MC.parking.photo.length, jpeg: window.MC.parking.photo.startsWith('data:image/jpeg') }); i.src = window.MC.parking.photo; }));
check(photoInfo.jpeg && photoInfo.w === 1280 && photoInfo.h === 960, 'the photo is kept as a smaller JPEG (' + photoInfo.w + 'x' + photoInfo.h + ', ' + Math.round(photoInfo.len / 1024) + ' KB)');
check(await noOverflow(), 'save sheet fits a 360px screen');
await shot('save');
await page.click('[data-action="park-done"]');
await page.waitForTimeout(300);
let st = await screenText();
check(st.includes('הרכב חונה') && st.includes('קומה') && st.includes('עמוד C4'), 'the card shows the parked car with floor and note');
check(await page.evaluate(() => !!document.querySelector('.park-card .park-thumb')), 'the card shows the photo');
await shot('card-parked');

// ---------- After a restart ----------
await page.reload();
await start();
st = await screenText();
check(st.includes('הרכב חונה') && st.includes('עמוד C4'), 'the parking is still there after reopening the app');
check(await page.evaluate(() => !!window.MC.parking.photo), 'the photo is still there after reopening the app');

// ---------- Find ----------
await ctx.setGeolocation({ latitude: CAR.latitude - 0.00135, longitude: CAR.longitude, accuracy: 5 }); // ~150 m south of the car
await page.click('.park-go');
await page.waitForFunction(() => { const d = document.getElementById('park-dist'); return d && d.textContent !== '…'; }, null, { timeout: 15000 });
let dist = await page.evaluate(() => document.getElementById('park-dist').textContent);
let sub = await page.evaluate(() => document.getElementById('park-sub').textContent);
check(dist === '150 מ׳', 'distance to the car: ' + dist);
check(sub.includes('בכיוון צפון') && sub.includes('דקות הליכה'), 'without a compass: direction by north and walking time (' + sub + ')');
check((await page.evaluate(() => document.querySelector('#sheet-root a.btn').href)).includes('travelmode=walking'), 'walking directions open in Google Maps');
// Compass: phone pointing east, the car is north, so it is to the left.
await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 270, beta: 0, gamma: 0, absolute: true })));
await page.waitForTimeout(150);
sub = await page.evaluate(() => document.getElementById('park-sub').textContent);
const rot = await page.evaluate(() => document.getElementById('park-arrow').getAttribute('transform'));
check(sub.includes('שמאלה') && /rotate\(-90/.test(rot), 'with a compass the arrow turns to the car (' + sub + ', ' + rot + ')');
await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 0, beta: 0, gamma: 0, absolute: true })));
await page.waitForTimeout(150);
await page.evaluate(() => { for (let i = 0; i < 30; i++) window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 0, beta: 0, gamma: 0, absolute: true })); });
await page.waitForTimeout(150);
sub = await page.evaluate(() => document.getElementById('park-sub').textContent);
check(sub.includes('ישר לפניך'), 'facing north: "ישר לפניך"');
check(await noOverflow(), 'find sheet fits a 360px screen');
await shot('find');
// Walk to the car.
await ctx.setGeolocation({ latitude: CAR.latitude - 0.00004, longitude: CAR.longitude, accuracy: 5 });
await page.waitForFunction(() => document.getElementById('park-dist').textContent === 'הגעת!', null, { timeout: 10000 });
sub = await page.evaluate(() => document.getElementById('park-sub').textContent);
check(sub.includes('הרכב ממש כאן') && sub.includes('קומה'), 'next to the car it says so, with the floor (' + sub + ')');

// ---------- Share ----------
await page.evaluate(() => { window.__shared = null; navigator.share = async (d) => { window.__shared = d; }; });
await page.click('[data-action="park-share"]');
const shared = await page.evaluate(() => window.__shared && window.__shared.text);
check(shared && shared.includes('https://maps.google.com/?q=32.434000,34.919000') && shared.includes('קומה') && shared.includes('עמוד C4'), 'sharing sends a map link with floor and note');

// ---------- Edit ----------
await page.click('[data-action="park-edit"]');
check((await sheetText()).startsWith('פרטי החניה') && (await page.evaluate(() => !!document.querySelector('[data-action="park-relocate"]'))), 'edit opens the details with "save the position again"');
await page.click('#sheet-root [data-action="close-sheet"].round-btn');

// ---------- Dark mode ----------
await page.evaluate(() => { document.documentElement.setAttribute('data-theme', 'dark'); });
await page.click('.park-go');
await page.waitForTimeout(500);
check(await noOverflow(), 'find sheet fits in dark mode');
await shot('find-dark');
await page.click('#sheet-root [data-action="close-sheet"].round-btn');
await page.evaluate(() => { window.MC.openSheet('parkSave', { edit: true }); });
await page.waitForTimeout(300);
await shot('save-dark');
await page.evaluate(() => { window.__mycar.closeSheet(); document.documentElement.setAttribute('data-theme', 'light'); });

// ---------- Found ----------
await page.click('.park-go');
await page.waitForTimeout(300);
await page.click('[data-action="park-found"]');
check((await sheetText()).includes('לחץ שוב'), '"מצאתי את הרכב" asks for a second tap');
await page.click('[data-action="park-found"]');
await page.waitForTimeout(300);
check(await page.evaluate(() => window.MC.parking.spot === null && !window.MC.parking.photo), 'the parking and photo are deleted');
check((await screenText()).includes('חניתי כאן'), 'the calculator is back to "חניתי כאן"');
await page.reload();
await start();
check((await screenText()).includes('חניתי כאן'), 'still deleted after reopening');

// ---------- No location permission ----------
const ctx2 = await browser.newContext({ viewport: { width: 360, height: 760 }, locale: 'he-IL' });
const p2 = await ctx2.newPage();
p2.on('pageerror', (e) => errors.push('pageerror (no permission): ' + e.message));
await p2.goto(URL);
await p2.waitForFunction(() => window.MC && window.MC.state && window.MC.parking && window.MC.parking.loaded);
await p2.evaluate(() => { window.MC.state.onboarded = true; window.__mycar.closeSheet(); window.MC.render(); });
await p2.click('[data-action="park-save"]');
await p2.waitForFunction(() => window.MC.parking.capture && window.MC.parking.capture.done, null, { timeout: 25000 });
const t2 = await p2.evaluate(() => document.querySelector('#sheet-root .sheet').innerText);
check(/אין הרשאה|לא הצלחתי לאתר/.test(t2) && t2.includes('נשמרות גם בלי'), 'without permission it explains, and floor/note/photo still work');
await p2.click('[data-action="park-floor"][data-v="1"]');
await p2.click('[data-action="park-done"]');
await p2.waitForTimeout(300);
check((await p2.evaluate(() => document.querySelector('#screen').innerText)).includes('קומה'), 'a parking without GPS still shows its floor');
await p2.click('.park-go');
await p2.waitForTimeout(300);
check((await p2.evaluate(() => document.querySelector('#sheet-root .sheet').innerText)).includes('לא נשמר מיקום GPS'), 'the find sheet explains there is no arrow without GPS');

await browser.close();
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('all parking checks passed');
