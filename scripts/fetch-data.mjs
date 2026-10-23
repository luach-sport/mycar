// Refreshes the offline data bundled into MyCar (and served to installed apps from GitHub).
//   - roads.json : real road distances/times between ~120 hub localities (OSRM, OpenStreetMap data)
//   - fuel.json  : the regulated 95-octane price, from the Energy Ministry's monthly PDF
// Every step is best effort: on any failure the committed file is kept as is.
// Usage: node scripts/fetch-data.mjs [--roads] [--fuel]   (no flags = both; roads only if stale)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA = join(process.cwd(), 'www', 'data');
const args = process.argv.slice(2);
const forceRoads = args.includes('--force-roads');
const doRoads = args.length === 0 || args.includes('--roads') || forceRoads;
const doFuel = args.length === 0 || args.includes('--fuel');
const UA = 'MyCar-data-updater/1.0 (+https://github.com/luach-sport/mycar)';

const read = (f) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));
const write = (f, obj) => writeFileSync(join(DATA, f), JSON.stringify(obj));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, { timeout = 45000, binary = false } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: binary ? '*/*' : 'application/json' }, signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return binary ? new Uint8Array(await res.arrayBuffer()) : await res.json();
  } finally { clearTimeout(t); }
}

// ---------------- Roads ----------------
const OSRM = ['https://router.project-osrm.org', 'https://routing.openstreetmap.de/routed-car'];

async function table(coords, sources, destinations) {
  const q = `/table/v1/driving/${coords.join(';')}?sources=${sources.join(';')}&destinations=${destinations.join(';')}&annotations=distance,duration`;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const base of OSRM) {
      try {
        const j = await get(base + q);
        if (j.code !== 'Ok') throw new Error('OSRM ' + j.code);
        return j;
      } catch (e) { lastErr = e; await sleep(2500); }
    }
  }
  throw lastErr;
}

async function updateRoads() {
  const loc = read('localities.json');
  const hubs = loc.places.filter((p) => p[5] === 1);
  const n = hubs.length;
  const path = join(DATA, 'roads.json');
  if (existsSync(path) && !forceRoads) {
    try {
      const cur = JSON.parse(readFileSync(path, 'utf8'));
      const ageDays = (Date.now() - Date.parse(cur.generated)) / 864e5;
      if (cur.hubs && cur.hubs.length === n && ageDays < 120) { console.log('roads: fresh, skipped'); return false; }
    } catch (e) { /* rebuild */ }
  }
  const coords = hubs.map((h) => `${h[3]},${h[2]}`);
  const km = new Float64Array(n * n).fill(-1);
  const min = new Float64Array(n * n).fill(-1);
  const B = 40;
  for (let i = 0; i < n; i += B) {
    for (let j = 0; j < n; j += B) {
      const src = []; for (let k = i; k < Math.min(i + B, n); k++) src.push(k);
      const dst = []; for (let k = j; k < Math.min(j + B, n); k++) dst.push(k);
      const list = src.concat(dst.filter((d) => !src.includes(d)));
      const r = await table(list.map((k) => coords[k]), src.map((k) => list.indexOf(k)), dst.map((k) => list.indexOf(k)));
      src.forEach((a, si) => dst.forEach((b, di) => {
        const d = r.distances && r.distances[si] ? r.distances[si][di] : null;
        const t = r.durations && r.durations[si] ? r.durations[si][di] : null;
        if (d != null) km[a * n + b] = d / 1000;
        if (t != null) min[a * n + b] = t / 60;
      }));
      console.log(`roads: block ${i}/${j} ok`);
      await sleep(1500);
    }
  }
  // Symmetric upper triangle (average of both directions), km*10 and minutes as integers.
  const K = [], M = [];
  let missing = 0;
  for (let a = 0; a < n; a++) {
    for (let b = a + 1; b < n; b++) {
      const d1 = km[a * n + b], d2 = km[b * n + a];
      const t1 = min[a * n + b], t2 = min[b * n + a];
      const d = d1 >= 0 && d2 >= 0 ? (d1 + d2) / 2 : Math.max(d1, d2);
      const t = t1 >= 0 && t2 >= 0 ? (t1 + t2) / 2 : Math.max(t1, t2);
      if (d < 0) missing++;
      K.push(d < 0 ? -1 : Math.round(d * 10));
      M.push(t < 0 ? -1 : Math.round(t));
    }
  }
  if (missing > n) throw new Error('too many missing pairs: ' + missing);
  const today = new Date().toISOString().slice(0, 10);
  write('roads.json', {
    v: Number(today.replace(/-/g, '')),
    generated: new Date().toISOString(),
    source: 'OSRM, נתוני מפה © OpenStreetMap contributors',
    hubs: hubs.map((h) => [h[0], h[2], h[3]]),
    km10: K,
    min: M
  });
  console.log('roads: wrote', n, 'hubs,', K.length, 'pairs, missing', missing);
  return true;
}

// ---------------- Fuel price ----------------
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

async function pdfText(buf) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true, isEvalSupported: false }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    text += tc.items.map((it) => it.str).join(' ') + '\n';
  }
  return text.replace(/\s+/g, ' ');
}

function parsePrice(text) {
  const ok = (v) => v > 4 && v < 15;
  const tries = [
    /לא\s*יעלה\s*על\s*(\d{1,2}\.\d{2})/,
    /(\d{1,2}\.\d{2})\s*על\s*יעלה\s*לא/,
    /(\d{1,2}\.\d{2})\s+\d{1,2}\.\d{2}\s+עצמי\s+בתדלוק/,
    /ויעמוד\s*על\s*(\d{1,2}\.\d{2})/,
    /(\d{1,2}\.\d{2})\s*ח\s*לליטר"?ש/
  ];
  for (const re of tries) {
    const m = text.match(re);
    if (m && ok(+m[1])) return +m[1];
  }
  return null;
}

async function updateFuel() {
  const cur = read('fuel.json');
  const now = new Date();
  for (const add of [1, 0]) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + add, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (key <= cur.month) continue;
    const slug = `fuel-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
    const url = `https://www.gov.il/BlobFolder/news/${slug}/he/${slug}.pdf`;
    try {
      const buf = await get(url, { binary: true });
      const text = await pdfText(buf);
      const price = parsePrice(text);
      if (!price) { console.log('fuel: could not parse', url); continue; }
      if (Math.abs(price - cur.price95) / cur.price95 > 0.35) { console.log('fuel: implausible', price); continue; }
      const svc = text.match(/שירות\s*מלא\s*תעמוד\s*על\s*(\d{1,3})\s*אגורות/);
      write('fuel.json', {
        ...cur,
        v: Number(key.replace('-', '')),
        month: key,
        price95: price,
        fullService: svc ? +svc[1] / 100 : cur.fullService,
        updated: new Date().toISOString().slice(0, 10)
      });
      console.log('fuel: updated', key, price);
      return true;
    } catch (e) {
      console.log('fuel: not available yet', key, e.message);
    }
  }
  return false;
}

// ---------------- Manifest ----------------
function writeManifest() {
  const files = {};
  for (const f of ['localities.json', 'roads.json', 'fuel.json']) {
    if (existsSync(join(DATA, f))) files[f] = read(f).v || 1;
  }
  const prev = existsSync(join(DATA, 'manifest.json')) ? read('manifest.json') : { v: 0, files: {} };
  const changed = JSON.stringify(prev.files) !== JSON.stringify(files);
  write('manifest.json', { v: changed ? (prev.v || 0) + 1 : prev.v, files });
  console.log('manifest', changed ? 'updated' : 'unchanged', files);
}

if (doRoads) { try { await updateRoads(); } catch (e) { console.log('roads: failed, keeping current file:', e.message); } }
if (doFuel) { try { await updateFuel(); } catch (e) { console.log('fuel: failed:', e.message); } }
writeManifest();
