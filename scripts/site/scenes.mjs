// The screenshots on MyCar's site, taken by the Itzko site kit (kit/lib/shots.mjs in luach-sport/itzko).
// prepare() fills the app with example data (dated relative to today, so the pictures always look current);
// every scene's `set` then runs inside the app page (sent as is), with { info }.
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

export async function prepare(page, { info }) {
  await page.evaluate((seed) => { localStorage.setItem('mycar.theme', 'light'); localStorage.setItem('mycar.state.v1', JSON.stringify(eval(seed))); }, SEED);
  await page.reload();
  await page.waitForTimeout(1500);
  return { info };
}
export const reset = () => { window.__mycar.closeSheet(); window.scrollTo(0, 0); };

const tab = (t) => "const m = window.__mycar; m.closeSheet(); m.ui.view = null; m.ui.tab = '" + t + "'; window.MC.render();";
const scene = (name, body, extra) => Object.assign({ name, set: new Function('arg', body) }, extra || {});

export const SCENES = [
  scene('calc', tab('calc')),
  scene('result', `const m = window.__mycar, ui = m.ui;
    ui.result = { title: 'חדרה ← ירושלים', from: { name: 'חדרה', lat: 32.434, lon: 34.919 }, to: { name: 'ירושלים', lat: 31.778, lon: 35.2 }, route: { km: 109, urbanKm: 9, min: 84, source: 'online' }, roundTrip: true, passengers: 3, carId: 'c1', urbanPct: null, tag: 'private', savedId: null };
    ui.view = 'result'; window.MC.render();`),
  scene('share', "window.__mycar.openSheet('share', { kind: 'result' });", { wait: 700, scroll: null }),
  scene('trips', tab('trips')),
  scene('fuel', tab('fuel')),
  scene('stats', tab('stats')),
  scene('settings', tab('settings')),
  scene('feedback', tab('settings') + " window.MC.state.profile = { name: 'דני כהן', email: 'dani@example.com' }; m.openSheet('feedback');",
    { fill: ['#fbm', 'הייתי רוצה תזכורת לבדוק לחץ אוויר בצמיגים'], wait: 600 }),
  scene('share-app', tab('settings') + " m.openSheet('shareApp');", { wait: 700 }),
  scene('update', tab('settings') + `
    const b = parseInt(arg.info.build, 10) || 1;
    window.MC.VERSION.build = String(b - 1 > 0 ? b - 1 : b);
    window.MC.update.info = { version: arg.info.version, build: b, notes: arg.info.notes.slice(0, 4), inApp: true };
    m.openSheet('update');`, { wait: 700 })
];
