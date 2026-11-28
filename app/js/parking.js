/* "Where did I park?" – the data side: the parked car's spot (GPS position, floor, a note and a photo),
   kept only on this phone (MC.kv: a file on Android, browser storage on iPhone).
   Saving takes the best GPS reading of the first seconds (and the phone's last reading, which in an
   underground car park is usually the one from the entrance). Everything works without internet; only
   the street address is looked up when there is a connection. The screens are in parking-ui.js. */
(function () {
  'use strict';
  const MC = window.MC;
  const P = (MC.parking = { spot: null, photo: null, loaded: false, capture: null });
  const KEY = 'parking', PHOTO_KEY = 'parking-photo';
  const UA = 'MyCar/' + MC.VERSION.version + ' (Android; github.com/' + MC.REPO + ')';
  const listeners = [];
  P.onChange = (cb) => listeners.push(cb);
  const changed = () => listeners.forEach((cb) => { try { cb(P.spot); } catch (e) { console.warn(e); } });

  // ================= Floors =================
  P.FLOORS = [
    { v: 'street', label: 'ברחוב' }, { v: '0', label: 'קרקע' },
    { v: '-1', label: '-1' }, { v: '-2', label: '-2' }, { v: '-3', label: '-3' }, { v: '-4', label: '-4' },
    { v: '1', label: '1' }, { v: '2', label: '2' }, { v: '3', label: '3' }
  ];
  // Plain text (messages, live text); the number is isolated so the minus stays on its left in Hebrew text.
  P.floorText = (f) => {
    if (!f) return '';
    if (f === 'street') return 'חניה ברחוב';
    if (f === '0') return 'קומת קרקע';
    return 'קומה \u2066' + f + '\u2069';
  };

  // ================= Storage =================
  function clean(s) {
    if (!s || typeof s !== 'object' || !isFinite(+s.ts)) return null;
    const n = (v) => (v == null || v === '' || !isFinite(+v) ? null : +v);
    const lat = n(s.lat), lon = n(s.lon);
    const has = lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    return {
      id: String(s.id || MC.uid()), ts: +s.ts, carId: String(s.carId || ''),
      lat: has ? lat : null, lon: has ? lon : null, acc: has ? n(s.acc) : null, fixTs: n(s.fixTs) || 0,
      floor: P.FLOORS.some((f) => f.v === s.floor) ? s.floor : '',
      note: String(s.note || '').slice(0, 80), address: String(s.address || '').slice(0, 90), photo: !!s.photo
    };
  }
  P.load = async () => {
    try { const raw = await MC.kv.get(KEY); P.spot = raw ? clean(JSON.parse(raw)) : null; } catch (e) { P.spot = null; }
    P.photo = null;
    if (P.spot && P.spot.photo) {
      try { P.photo = (await MC.kv.get(PHOTO_KEY)) || null; } catch (e) { P.photo = null; }
      if (!P.photo || !/^data:image\//.test(P.photo)) { P.photo = null; P.spot.photo = false; }
    }
    P.loaded = true;
    changed();
  };
  const persist = () => MC.kv.set(KEY, P.spot ? JSON.stringify(P.spot) : '');
  P.update = (patch) => {
    if (!P.spot) return;
    Object.assign(P.spot, patch);
    persist();
    changed();
  };
  // A new parking: replaces the previous one.
  P.start = (carId) => {
    stopCapture();
    P.spot = clean({ ts: Date.now(), carId });
    P.photo = null;
    persist();
    MC.kv.set(PHOTO_KEY, '');
    changed();
    return P.spot;
  };
  P.clear = async () => {
    stopCapture();
    P.spot = null; P.photo = null;
    await MC.kv.set(KEY, '');
    await MC.kv.set(PHOTO_KEY, '');
    changed();
  };

  // ================= Photo =================
  // The camera's picture made smaller (longest side 1280px, JPEG), so it is quick to keep and show.
  P.shrinkPhoto = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.72));
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
    img.src = url;
  });
  P.setPhoto = async (dataUrl) => {
    if (!P.spot) return false;
    const ok = await MC.kv.set(PHOTO_KEY, dataUrl || '');
    if (!ok && dataUrl) return false;
    P.photo = dataUrl || null;
    P.update({ photo: !!dataUrl });
    return true;
  };

  // ================= GPS =================
  async function permission() {
    if (!MC.isNative()) return;
    const ok = (p) => p && (p.location === 'granted' || p.coarseLocation === 'granted');
    if (ok(await MC.callRaw('Geolocation', 'checkPermissions'))) return;
    if (ok(await MC.callRaw('Geolocation', 'requestPermissions'))) return;
    throw new Error('denied');
  }
  const kindOf = (e) => (e && (e.code === 1 || /denied|permission/i.test(e.message || '')) ? 'denied' : 'failed');
  const reading = (p) => ({
    lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy || 999,
    heading: p.coords.heading, speed: p.coords.speed, ts: p.timestamp || Date.now()
  });

  // Follows the phone's position until stop(): onFix(reading) for each new position, onError('denied'|'failed').
  P.watch = (onFix, onError) => {
    const h = { id: null, stopped: false };
    h.stop = () => {
      h.stopped = true;
      if (h.id == null) return;
      if (MC.isNative()) MC.call('Geolocation', 'clearWatch', { id: h.id });
      else if (navigator.geolocation) navigator.geolocation.clearWatch(h.id);
      h.id = null;
    };
    (async () => {
      try {
        await permission();
        if (h.stopped) return;
        const opts = { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 };
        if (MC.isNative()) {
          h.id = await MC.plugin('Geolocation').watchPosition(opts, (p, err) => {
            if (h.stopped) return;
            if (err) { if (onError) onError(kindOf(err)); return; }
            if (p && p.coords) onFix(reading(p));
          });
        } else {
          if (!navigator.geolocation) throw new Error('failed');
          h.id = navigator.geolocation.watchPosition((p) => { if (!h.stopped) onFix(reading(p)); },
            (e) => { if (!h.stopped && onError) onError(kindOf(e)); }, opts);
        }
        if (h.stopped) { h.stopped = false; h.stop(); }
      } catch (e) { if (!h.stopped && onError) onError(kindOf(e)); }
    })();
    return h;
  };
  // The phone's most recent reading, if it is from the last few minutes (no waiting for a new one).
  P.lastKnown = async () => {
    const opts = { enableHighAccuracy: false, timeout: 4000, maximumAge: 5 * 60e3 };
    if (MC.isNative()) { await permission(); return reading(await MC.callRaw('Geolocation', 'getCurrentPosition', opts)); }
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('failed'));
      navigator.geolocation.getCurrentPosition((p) => resolve(reading(p)), reject, opts);
    });
  };

  // Saving the position: the best reading of the next 20 seconds (stops early at ±8 m).
  // P.capture = { state: 'locating' | 'found' | 'denied' | 'failed', done }.
  function stopCapture() {
    const c = P.capture;
    if (!c) return;
    clearTimeout(c.timer);
    if (c.watch) c.watch.stop();
  }
  P.locate = () => {
    stopCapture();
    const spot = P.spot;
    if (!spot) return;
    const c = (P.capture = { state: 'locating', done: false, timer: 0, watch: null });
    const take = (f) => {
      if (P.capture !== c || P.spot !== spot || c.done || !isFinite(f.lat) || !isFinite(f.lon)) return;
      if (Date.now() - f.ts > 10 * 60e3) return;
      if (spot.lat != null && !(f.acc < spot.acc * 0.8)) return;
      Object.assign(spot, { lat: f.lat, lon: f.lon, acc: Math.round(f.acc), fixTs: f.ts });
      c.state = 'found';
      persist();
      changed();
      if (f.acc <= 8) finish();
    };
    const finish = () => {
      if (P.capture !== c || c.done) return;
      clearTimeout(c.timer);
      if (c.watch) c.watch.stop();
      c.done = true;
      if (spot.lat == null && c.state !== 'denied') c.state = 'failed';
      changed();
      lookupAddress(spot);
    };
    P.lastKnown().then(take).catch(() => {});
    c.watch = P.watch(take, (kind) => {
      if (kind === 'denied' && spot.lat == null) { c.state = 'denied'; finish(); }
    });
    c.timer = setTimeout(finish, 20000);
    changed();
  };
  P.locating = () => !!(P.capture && !P.capture.done);

  // "Near Herzl 12, Hadera": one look-up, only when online. The parking itself never needs it.
  async function lookupAddress(spot) {
    if (!spot || spot.lat == null || !MC.online()) return;
    try {
      const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=he&zoom=18&addressdetails=1&lat=' + spot.lat.toFixed(6) + '&lon=' + spot.lon.toFixed(6);
      const r = await MC.http(url, { timeout: 9000, headers: { 'User-Agent': UA, Referer: MC.PAGES_URL } });
      const d = r && r.ok && r.data && typeof r.data === 'object' ? r.data : null;
      if (!d) return;
      const a = d.address || {};
      const street = [a.road || a.pedestrian || a.footway || '', a.house_number || ''].join(' ').trim();
      const city = a.city || a.town || a.village || a.suburb || '';
      const lot = d.category === 'amenity' && d.type === 'parking' && d.name ? d.name : '';
      const text = [lot, street, city].filter(Boolean).join(', ');
      if (text && P.spot === spot) P.update({ address: text.slice(0, 90) });
    } catch (e) { /* the address is a nice extra */ }
  }

  // ================= Directions =================
  const rad = Math.PI / 180;
  P.distance = (a, b) => MC.haversine(a, b) * 1000;
  P.bearing = (a, b) => {
    const f1 = a.lat * rad, f2 = b.lat * rad, dl = (b.lon - a.lon) * rad;
    const y = Math.sin(dl) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (Math.atan2(y, x) / rad + 360) % 360;
  };
  P.distText = (m) => (m < 1000 ? MC.fmt(Math.max(5, Math.round(m / 5) * 5)) + ' מ׳' : MC.fmt(m / 1000, m < 10000 ? 1 : 0) + ' ק״מ');
  P.walkText = (m) => {
    const min = Math.round(m / 1.3 / 60);
    if (min < 1) return 'פחות מדקה הליכה';
    if (min === 1) return 'כדקה הליכה';
    if (min >= 90) return 'יותר משעה וחצי הליכה';
    return 'כ-' + min + ' דקות הליכה';
  };
  // rel: the car's direction compared with where the phone points, clockwise in degrees.
  P.turnText = (rel) => {
    const r = ((rel % 360) + 540) % 360 - 180;
    const a = Math.abs(r);
    if (a <= 20) return 'ישר לפניך';
    if (a >= 140) return 'מאחוריך';
    if (a <= 60) return r > 0 ? 'קצת ימינה' : 'קצת שמאלה';
    return r > 0 ? 'ימינה' : 'שמאלה';
  };
  P.compassText = (b) => ['צפון', 'צפון-מזרח', 'מזרח', 'דרום-מזרח', 'דרום', 'דרום-מערב', 'מערב', 'צפון-מערב'][Math.round(b / 45) % 8];
  P.agoText = (ts) => {
    const min = Math.floor((Date.now() - ts) / 60e3);
    if (min < 1) return 'עכשיו';
    if (min === 1) return 'לפני דקה';
    if (min < 60) return 'לפני ' + min + ' דקות';
    const h = Math.floor(min / 60);
    if (h < 12) return h === 1 ? 'לפני שעה' : h === 2 ? 'לפני שעתיים' : 'לפני ' + h + ' שעות';
    return MC.dayLabel(ts) + ' ב-' + MC.time(ts);
  };
  P.mapsLink = (s) => 'https://maps.google.com/?q=' + s.lat.toFixed(6) + ',' + s.lon.toFixed(6);
  P.walkLink = (s) => (MC.isIOS && MC.isIOS()
    ? 'https://maps.apple.com/?daddr=' + s.lat.toFixed(6) + ',' + s.lon.toFixed(6) + '&dirflg=w'
    : 'https://www.google.com/maps/dir/?api=1&destination=' + s.lat.toFixed(6) + ',' + s.lon.toFixed(6) + '&travelmode=walking');
  P.shareText = (s) => {
    const where = [P.floorText(s.floor), s.note].filter(Boolean).join(', ');
    const lines = ['הרכב שלי חונה כאן' + (where ? ' (' + where + ')' : '') + (s.lat != null ? ':' : '.')];
    if (s.lat != null) lines.push(P.mapsLink(s));
    if (s.address) lines.push('ליד ' + s.address);
    lines.push('נשמר ב-MyCar, ' + MC.dayLabel(s.ts) + ' ב-' + MC.time(s.ts));
    return lines.join('\n');
  };

  P.load();
})();
