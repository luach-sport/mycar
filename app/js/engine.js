/* MyCar engine: places search, distance (online / cached / offline), fuel and cost math, refuel analysis, stats. */
(function () {
  'use strict';
  const MC = window.MC;
  const UA = 'MyCar/' + MC.VERSION.version + ' (Android; github.com/' + MC.REPO + ')';

  // ================= Places =================
  const ALIASES = {
    'תלאביב': 'תל אביב - יפו', 'תא': 'תל אביב - יפו', 'יפו': 'תל אביב - יפו', 'telaviv': 'תל אביב - יפו',
    'מודיעין': 'מודיעין-מכבים-רעות', 'ראשלצ': 'ראשון לציון', 'פת': 'פתח תקווה', 'בש': 'באר שבע', 'ים': 'ירושלים',
    'קשמונה': 'קריית שמונה', 'קריתשמונה': 'קריית שמונה', 'נצרתעלית': 'נוף הגליל', 'jerusalem': 'ירושלים'
  };
  let ALIAS_N = null;
  MC.searchPlaces = (q, limit) => {
    limit = limit || 12;
    const qn = MC.norm(q);
    if (!qn) return [];
    if (!ALIAS_N) { ALIAS_N = {}; Object.keys(ALIASES).forEach((k) => { ALIAS_N[MC.norm(k)] = ALIASES[k]; }); }
    const alias = ALIAS_N[qn];
    const out = [];
    for (const p of MC.data.places) {
      let s = -1;
      if (alias && p.name === alias) s = 1200;
      else if (p.n === qn) s = 1000;
      else if (p.n.startsWith(qn)) s = 800 - (p.n.length - qn.length);
      else if (p.name.split(/[\s\-–]+/).some((w) => MC.norm(w).startsWith(qn))) s = 650;
      else if (qn.length >= 2 && p.n.includes(qn)) s = 450;
      else if (p.ne && p.ne.startsWith(qn)) s = 420;
      else if (qn.length >= 3 && p.ne && p.ne.includes(qn)) s = 300;
      if (s < 0) continue;
      out.push({ p, s: s + Math.log10(p.pop + 10) * 18 });
    }
    out.sort((a, b) => b.s - a.s);
    return out.slice(0, limit).map((x) => x.p);
  };
  function flatDist(a, b) {
    const x = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    const y = b.lat - a.lat;
    return x * x + y * y;
  }
  MC.nearestPlace = (pt) => {
    let best = null, bd = Infinity;
    for (const p of MC.data.places) { const d = flatDist(pt, p); if (d < bd) { bd = d; best = p; } }
    return best;
  };
  function nearestHub(pt) {
    let best = null, bd = Infinity;
    for (const h of MC.data.hubs) { const d = flatDist(pt, h); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  function roadBetween(i, j) {
    const R = MC.data.roads;
    if (!R || i === j) return null;
    if (i > j) { const t = i; i = j; j = t; }
    const n = R.hubs.length;
    const idx = i * n - (i * (i + 1)) / 2 + (j - i - 1);
    const k = R.km10[idx], m = R.min[idx];
    if (!(k > 0)) return null;
    return { km: k / 10, min: m > 0 ? m : null };
  }

  // Kilometres driven inside built-up area at one end of a trip, by locality size.
  function endUrbanKm(place) {
    if (!place) return 1.5;
    const pop = place.pop || 0;
    if (pop >= 500000) return 8;
    if (pop >= 200000) return 6;
    if (pop >= 100000) return 5;
    if (pop >= 50000) return 4;
    if (pop >= 20000) return 3;
    if (pop >= 5000) return 2;
    return 1;
  }

  // ================= Distance: offline estimate =================
  MC.estimateRoute = (a, b) => {
    const hav = MC.haversine(a, b);
    const pa = MC.nearestPlace(a), pb = MC.nearestPlace(b);
    if (hav < 0.3) return { km: 0, urbanKm: 0, min: 0, source: 'offline', basis: 'same' };
    let factor = hav < 3 ? 1.5 : hav < 10 ? 1.4 : hav < 40 ? 1.34 : 1.3;
    let speed = null;
    let basis = 'air';
    if (MC.data.roads && MC.data.hubs.length) {
      const ha = nearestHub(a), hb = nearestHub(b);
      if (ha && hb && ha.i !== hb.i) {
        const r = roadBetween(ha.i, hb.i);
        const hh = MC.haversine(ha, hb);
        if (r && hh > 1) {
          const f = MC.clamp(r.km / hh, 1.05, 2.3);
          const off = (MC.haversine(a, ha) + MC.haversine(b, hb)) / Math.max(hav, 1);
          const w = MC.clamp(1 - off * 0.8, 0.3, 1);
          factor = f * w + factor * (1 - w);
          if (r.min) speed = r.km / r.min;
          basis = 'roads';
        }
      }
    }
    const km = hav * factor;
    let urbanKm;
    if (pa && pb && pa === pb) urbanKm = km;
    else {
      urbanKm = Math.min(km * 0.9, endUrbanKm(pa) + endUrbanKm(pb));
      if (km < 8) urbanKm = Math.max(urbanKm, km * 0.7);
    }
    const interKm = Math.max(0, km - urbanKm);
    const min = speed ? km / speed : urbanKm / 0.55 + interKm / 1.2;
    return { km, urbanKm, min, source: 'offline', basis };
  };

  // ================= Distance: online (OSRM, OpenStreetMap) =================
  const OSRM = ['https://router.project-osrm.org/route/v1/driving/', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'];
  async function osrmRoute(a, b) {
    const q = a.lon.toFixed(5) + ',' + a.lat.toFixed(5) + ';' + b.lon.toFixed(5) + ',' + b.lat.toFixed(5) +
      '?overview=false&alternatives=false&steps=false&annotations=distance,duration';
    for (const s of OSRM) {
      try {
        const r = await MC.http(s + q, { timeout: 9000, headers: { 'User-Agent': UA } });
        if (!r.ok || !r.data || r.data.code !== 'Ok' || !r.data.routes || !r.data.routes[0]) continue;
        const route = r.data.routes[0];
        let urban = 0;
        (route.legs || []).forEach((leg) => {
          const ann = leg.annotation;
          if (!ann || !ann.distance) return;
          for (let k = 0; k < ann.distance.length; k++) {
            const d = ann.distance[k], t = ann.duration[k];
            const v = t > 0 ? (d / t) * 3.6 : 40;
            if (v < 56) urban += d;
          }
        });
        return { km: route.distance / 1000, urbanKm: Math.min(urban, route.distance) / 1000, min: route.duration / 60, source: 'online' };
      } catch (e) { /* next server */ }
    }
    return null;
  }

  // ================= Route cache =================
  let cache = {};
  const ck = (a, b) => a.lat.toFixed(3) + ',' + a.lon.toFixed(3) + '|' + b.lat.toFixed(3) + ',' + b.lon.toFixed(3);
  MC.loadRouteCache = async () => {
    const raw = await MC.kv.get('routes');
    if (raw) { try { cache = JSON.parse(raw) || {}; } catch (e) { cache = {}; } }
  };
  const saveCache = MC.debounce(() => { MC.kv.set('routes', JSON.stringify(cache)); }, 500);
  function putCache(a, b, r) {
    const v = { km: r.km, urbanKm: r.urbanKm, min: r.min, ts: Date.now() };
    cache[ck(a, b)] = v;
    cache[ck(b, a)] = v;
    const keys = Object.keys(cache);
    if (keys.length > 800) keys.sort((x, y) => cache[x].ts - cache[y].ts).slice(0, keys.length - 700).forEach((k) => delete cache[k]);
    saveCache();
  }
  MC.cachedRoutes = () => Object.keys(cache).length / 2;

  // Best available route: fresh cache > online > older cache > offline estimate.
  MC.getRoute = async (a, b) => {
    const c = cache[ck(a, b)];
    const fresh = c && Date.now() - c.ts < 60 * 864e5;
    if (fresh) return Object.assign({}, c, { source: 'cache' });
    if (MC.online()) {
      const r = await osrmRoute(a, b);
      if (r) { putCache(a, b, r); return r; }
    }
    if (c) return Object.assign({}, c, { source: 'cache' });
    return MC.estimateRoute(a, b);
  };

  // ================= Address search (online, Nominatim / OpenStreetMap) =================
  MC.searchAddress = async (q) => {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=il&accept-language=he&limit=6&q=' + encodeURIComponent(q);
    const r = await MC.http(url, { timeout: 9000, headers: { 'User-Agent': UA, Referer: MC.PAGES_URL } });
    if (!r.ok || !Array.isArray(r.data)) throw new Error('search failed');
    return r.data.map((x) => {
      const parts = String(x.display_name || '').split(',').map((s) => s.trim()).filter(Boolean);
      return { name: parts.slice(0, 2).join(', '), sub: parts.slice(2, 4).join(', '), lat: +x.lat, lon: +x.lon, kind: 'address' };
    }).filter((x) => isFinite(x.lat) && isFinite(x.lon));
  };

  // ================= Fuel price =================
  const FUEL_LABEL = { '95': 'בנזין 95', '98': 'בנזין 98', diesel: 'סולר', lpg: 'גפ״מ' };
  MC.FUEL_LABEL = FUEL_LABEL;
  MC.lastRefuel = (carId) => {
    const list = (MC.state.fuel || []).filter((f) => f.carId === carId && f.price > 0).sort((a, b) => b.ts - a.ts);
    return list[0] || null;
  };
  MC.officialPrice = () => {
    const f = MC.data.fuel;
    if (!f) return null;
    return { price: f.price95 + (MC.state.settings.fullService ? f.fullService || 0 : 0), month: f.month };
  };
  MC.priceFor = (car) => {
    const s = MC.state.settings;
    const official = MC.officialPrice();
    const monthTxt = official ? MC.monthLabel(official.month) : '';
    if (s.priceMode === 'manual' && s.manualPrice > 0) return { price: s.manualPrice, src: 'מחיר ידני' };
    const last = car ? MC.lastRefuel(car.id) : null;
    if (s.priceMode === 'last' && last) return { price: last.price, src: 'לפי התדלוק האחרון' };
    if (!car || car.fuelType === '95') {
      if (official) return { price: official.price, src: 'מחיר מפוקח · ' + monthTxt + (s.fullService ? ' · שירות מלא' : '') };
    } else {
      if (car.price > 0) return { price: car.price, src: 'המחיר שהגדרת ל' + FUEL_LABEL[car.fuelType] };
      if (last) return { price: last.price, src: 'לפי התדלוק האחרון' };
      if (official) return { price: official.price, src: 'מחיר בנזין 95 (לא הוגדר מחיר ל' + FUEL_LABEL[car.fuelType] + ')' };
    }
    if (last) return { price: last.price, src: 'לפי התדלוק האחרון' };
    return { price: s.manualPrice > 0 ? s.manualPrice : 8.27, src: 'מחיר ברירת מחדל' };
  };

  // ================= Refuel analysis (full-tank to full-tank) =================
  MC.litersOf = (f) => (f.liters > 0 ? f.liters : f.amount > 0 && f.price > 0 ? f.amount / f.price : 0);
  MC.analyzeFuel = (carId, source) => {
    const list = (source || MC.state.fuel || []).filter((f) => f.carId === carId).slice().sort((a, b) => (a.ts - b.ts) || ((a.odo || 0) - (b.odo || 0)));
    const rows = [];
    const intervals = [];
    let prev = null, lastFull = null, accL = 0, accC = 0;
    for (const f of list) {
      const liters = MC.litersOf(f);
      const row = { f, liters, kmSince: null, cons: null, cpk: null };
      if (prev && f.odo > 0 && prev.odo > 0 && f.odo > prev.odo) row.kmSince = f.odo - prev.odo;
      if (!(f.odo > 0)) { lastFull = null; accL = 0; accC = 0; }
      else if (lastFull) {
        accL += liters; accC += f.amount || liters * (f.price || 0);
        if (f.full) {
          const km = f.odo - lastFull.odo;
          if (km > 0 && accL > 0) {
            row.cons = km / accL;
            row.cpk = accC / km;
            intervals.push({ ts: f.ts, km, liters: accL, cost: accC, cons: row.cons });
          }
          lastFull = f; accL = 0; accC = 0;
        }
      } else if (f.full) { lastFull = f; accL = 0; accC = 0; }
      rows.push(row);
      if (f.odo > 0) prev = f;
    }
    const sumOf = (arr) => arr.reduce((t, x) => ({ km: t.km + x.km, l: t.l + x.liters, c: t.c + x.cost }), { km: 0, l: 0, c: 0 });
    const last3 = sumOf(intervals.slice(-3));
    const all = sumOf(intervals);
    const odos = list.filter((f) => f.odo > 0).map((f) => f.odo);
    return {
      rows: rows.reverse(),
      intervals,
      avg: last3.l > 0 ? last3.km / last3.l : null,
      avgCount: Math.min(3, intervals.length),
      avgAll: all.l > 0 ? all.km / all.l : null,
      cpkAll: all.km > 0 ? all.c / all.km : null,
      lastOdo: odos.length ? Math.max.apply(null, odos) : null,
      last: list.length ? list[list.length - 1] : null
    };
  };

  // ================= Consumption =================
  MC.mixKmpl = (car, urbanShare) => {
    const u = urbanShare == null ? 0.35 : urbanShare;
    return 1 / (u / car.urban + (1 - u) / car.inter);
  };
  MC.carConsumption = (car) => {
    let factor = 1, learned = false;
    if (car.learn) {
      const a = MC.analyzeFuel(car.id);
      if (a.avg && a.intervals.length >= 2) {
        factor = MC.clamp(a.avg / MC.mixKmpl(car), 0.6, 1.5);
        learned = Math.abs(factor - 1) >= 0.01;
      }
    }
    return { urban: car.urban * factor, inter: car.inter * factor, factor, learned };
  };

  // ================= Trip math =================
  MC.calcTrip = (o) => {
    const car = o.car;
    const mult = o.roundTrip ? 2 : 1;
    const km = Math.max(0, o.route.km * mult);
    const share = o.urbanPct != null ? MC.clamp(o.urbanPct, 0, 100) / 100 : (o.route.km > 0 ? MC.clamp(o.route.urbanKm / o.route.km, 0, 1) : 0);
    const urbanKm = km * share;
    const interKm = km - urbanKm;
    const c = MC.carConsumption(car);
    const litersU = urbanKm / c.urban;
    const litersI = interKm / c.inter;
    const liters = litersU + litersI;
    const pr = MC.priceFor(car);
    const cost = liters * pr.price;
    const pax = Math.max(1, o.passengers || 1);
    return {
      km, urbanKm, interKm, litersU, litersI, liters, share,
      cost, costU: litersU * pr.price, costI: litersI * pr.price,
      price: pr.price, priceSrc: pr.src,
      kmpl: liters > 0 ? km / liters : null,
      cpk: km > 0 ? cost / km : null,
      perPax: cost / pax, pax,
      min: (o.route.min || 0) * mult,
      tankPct: car.tank > 0 ? liters / car.tank : null,
      cons: c,
      oneWayCost: o.roundTrip ? cost / 2 : cost,
      roundCost: o.roundTrip ? cost : cost * 2
    };
  };

  // ================= Stats =================
  MC.periodRange = (mode, ref) => {
    const d = new Date(ref || Date.now());
    if (mode === 'year') return { from: new Date(d.getFullYear(), 0, 1).getTime(), to: new Date(d.getFullYear() + 1, 0, 1).getTime() };
    return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() };
  };
  MC.computeStats = (carId, mode, ref) => {
    const { from, to } = MC.periodRange(mode, ref);
    const a = MC.analyzeFuel(carId);
    const inP = (ts) => ts >= from && ts < to;
    let spent = 0, liters = 0, kmOdo = 0;
    a.rows.forEach((r) => { if (inP(r.f.ts)) { spent += r.f.amount || 0; liters += r.liters; if (r.kmSince) kmOdo += r.kmSince; } });
    const iv = a.intervals.filter((x) => inP(x.ts));
    const ivKm = iv.reduce((t, x) => t + x.km, 0), ivL = iv.reduce((t, x) => t + x.liters, 0), ivC = iv.reduce((t, x) => t + x.cost, 0);
    const trips = (MC.state.trips || []).filter((t) => t.carId === carId && inP(t.ts));
    const tripKm = trips.reduce((t, x) => t + x.km, 0);
    const tags = { work: { km: 0, cost: 0, n: 0 }, private: { km: 0, cost: 0, n: 0 }, none: { km: 0, cost: 0, n: 0 } };
    trips.forEach((t) => { const g = tags[t.tag] || tags.none; g.km += t.km; g.cost += t.cost; g.n++; });
    const km = kmOdo > 0 ? kmOdo : tripKm;
    // series
    const series = [];
    const d = new Date(ref || Date.now());
    if (mode === 'year') {
      for (let m = 0; m < 12; m++) series.push({ key: d.getFullYear() + '-' + String(m + 1).padStart(2, '0'), label: MC.MONTHS_SHORT[m], v: 0 });
    } else {
      for (let k = 5; k >= 0; k--) {
        const x = new Date(d.getFullYear(), d.getMonth() - k, 1);
        series.push({ key: MC.monthKey(x), label: MC.MONTHS_SHORT[x.getMonth()], v: 0 });
      }
    }
    const idx = {}; series.forEach((s, i) => { idx[s.key] = i; });
    (MC.state.fuel || []).forEach((f) => { if (f.carId !== carId) return; const k = MC.monthKey(f.ts); if (k in idx) series[idx[k]].v += f.amount || 0; });
    return {
      spent, liters, km, kmFromOdo: kmOdo > 0, tripKm, trips: trips.length, tags,
      avg: ivL > 0 ? ivKm / ivL : (a.avg || null),
      avgFromPeriod: ivL > 0,
      cpk: ivKm > 0 ? ivC / ivKm : km > 0 && spent > 0 ? spent / km : (a.cpkAll || null),
      series,
      curKey: MC.monthKey(ref || Date.now()),
      consSeries: a.intervals.slice(-8)
    };
  };
})();
