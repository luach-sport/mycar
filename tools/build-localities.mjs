// Builds www/data/localities.json from the CBS 2023 list of localities
// (tools/cbs-localities-2023.json: lat/lon already converted from ITM).
// Run: node tools/build-localities.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(readFileSync(join(ROOT, 'tools', 'cbs-localities-2023.json'), 'utf8'));
const F = Object.fromEntries(src.fields.map((f, i) => [f, i]));

// Regional anchors kept as routing hubs even when small, so every region has one.
const ANCHORS = ['קצרין', 'מצפה רמון', 'ירוחם', 'בית שאן', 'מעלות-תרשיחא', 'זכרון יעקב', 'יקנעם עילית', 'מגדל העמק',
  'ראש פינה', 'מטולה', 'שדרות', 'אופקים', 'קריית שמונה', 'צפת', 'ערד', 'דימונה', 'אילת', 'עין גדי', 'יטבתה', 'מצפה רמון',
  'כרמיאל', 'עפולה', 'בית שמש', 'אריאל', 'קריית ארבע', 'מעלה אדומים', 'גבעת זאב', 'שלומי', 'חצור הגלילית', 'קריית טבעון',
  'אור עקיבא', 'פרדס חנה-כרכור', 'גדרה', 'קריית מלאכי', 'באר יעקב', 'ערערה-בנגב', 'כסיפה', 'מבשרת ציון', 'אבן יהודה', 'נווה זוהר'];

const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/(\S)\s+-(\S)/g, '$1 - $2').replace(/(\S)-\s+(\S)/g, '$1 - $2').trim();

const out = [];
const seen = new Set();
for (const p of src.places) {
  const name = clean(p[F.name_he]);
  if (!name || seen.has(name)) continue;
  const lat = +p[F.lat], lon = +p[F.lon];
  if (!(lat > 29 && lat < 34) || !(lon > 34 && lon < 36.5)) continue;
  seen.add(name);
  const pop = +p[F.total] || 0;
  const hub = pop >= 15000 || ANCHORS.includes(name) ? 1 : 0;
  out.push([name, clean(p[F.name_en]), +lat.toFixed(5), +lon.toFixed(5), pop, hub]);
}
out.sort((a, b) => b[4] - a[4]);
const data = {
  v: 1,
  source: 'הלשכה המרכזית לסטטיסטיקה – רשימת יישובים 2023',
  fields: ['name', 'en', 'lat', 'lon', 'pop', 'hub'],
  places: out
};
writeFileSync(join(ROOT, 'www', 'data', 'localities.json'), JSON.stringify(data));
console.log('localities', out.length, 'hubs', out.filter((x) => x[5]).length,
  'missing anchors', ANCHORS.filter((a) => !out.some((x) => x[0] === a)));
