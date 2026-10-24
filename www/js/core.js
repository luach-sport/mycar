/* MyCar core: helpers, icons, native bridge, storage, offline data and sync. */
(function () {
  'use strict';
  const MC = (window.MC = window.MC || {});
  const VER = window.MYCAR_VERSION || { version: '1.03', build: 'dev' };
  MC.VERSION = VER;
  MC.REPO = 'luach-sport/mycar';
  MC.PAGES_URL = 'https://luach-sport.github.io/mycar/';
  MC.DATA_URLS = [
    'https://raw.githubusercontent.com/luach-sport/mycar/main/www/data/',
    'https://cdn.jsdelivr.net/gh/luach-sport/mycar@main/www/data/'
  ];
  // Feedback goes to a small Google Apps Script in the developer's own Google account, which e-mails
  // only the developer. No e-mail address ships in the app; the key just keeps generic bots out.
  MC.FEEDBACK_URL = 'https://script.google.com/macros/s/AKfycbwuxeoRQSIFoCfTrJqJ_QUeF1JANm0H4PY5Mc00Ns8hBm9K8lvJ2S5hBYQOVtA3lZX1lw/exec';
  MC.FEEDBACK_KEY = 'mc_9-ATPT_LPmYj188PGtCksaLh';

  // ================= Helpers =================
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  MC.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  MC.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  MC.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  MC.num = (v) => {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    const s = String(v == null ? '' : v).replace(/[₪,\s]/g, '').replace(/[٫]/g, '.');
    return s === '' ? NaN : Number(s);
  };
  const nf = {};
  MC.fmt = (n, d = 0) => {
    if (!isFinite(n)) return '–';
    const k = d;
    if (!nf[k]) nf[k] = new Intl.NumberFormat('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d });
    return nf[k].format(n);
  };
  MC.money = (n, d) => (isFinite(n) ? '₪' + MC.fmt(n, d == null ? (Math.abs(n) >= 1000 ? 0 : 2) : d) : '–');
  MC.money0 = (n) => MC.money(n, 0);
  MC.km = (n) => (isFinite(n) ? MC.fmt(n, n < 10 && n % 1 ? 1 : 0) : '–');
  MC.dur = (min) => {
    if (!isFinite(min)) return '–';
    const m = Math.max(1, Math.round(min));
    const h = Math.floor(m / 60), r = m % 60;
    return h ? h + ':' + String(r).padStart(2, '0') : String(r);
  };
  MC.durUnit = (min) => (Math.round(min) >= 60 ? 'שעות נסיעה' : 'דקות נסיעה');

  const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳'];
  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  MC.MONTHS = MONTHS; MC.MONTHS_SHORT = MONTHS_SHORT;
  MC.monthKey = (d) => { d = new Date(d); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
  MC.monthLabel = (key) => { const [y, m] = key.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; };
  MC.dayStart = (d) => { d = new Date(d); d.setHours(0, 0, 0, 0); return d.getTime(); };
  MC.dayLabel = (ts) => {
    const t = MC.dayStart(ts), today = MC.dayStart(Date.now());
    if (t === today) return 'היום';
    if (t === today - 864e5) return 'אתמול';
    const d = new Date(ts);
    const y = d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '';
    return d.getDate() + ' ב' + MONTHS[d.getMonth()] + y;
  };
  MC.dateShort = (ts) => { const d = new Date(ts); return d.getDate() + ' ב' + MONTHS[d.getMonth()]; };
  MC.dateFull = (ts) => { const d = new Date(ts); return d.getDate() + '.' + (d.getMonth() + 1) + '.' + d.getFullYear(); };
  MC.time = (ts) => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  MC.todayTitle = () => { const d = new Date(); return 'יום ' + DAYS[d.getDay()] + ', ' + d.getDate() + ' ב' + MONTHS[d.getMonth()]; };
  MC.localInput = (ts) => {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  };
  MC.dateInput = (ts) => MC.localInput(ts).slice(0, 10);

  // Hebrew-aware search normalisation: no nikud/punctuation, final letters folded, doubled yod/vav folded.
  const FINALS = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
  MC.norm = (s) => String(s || '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c])
    .replace(/[^a-z0-9א-ת]/g, '')
    .replace(/יי+/g, 'י')
    .replace(/וו+/g, 'ו');

  MC.haversine = (a, b) => {
    const R = 6371, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  };
  MC.debounce = (fn, ms) => { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); }; };
  MC.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  MC.isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || '').trim());

  // Shrinks big numbers that do not fit (large system font sizes, long amounts) instead of letting the page spill sideways.
  MC.fitText = (root) => {
    (root || document).querySelectorAll('.fit').forEach((el) => {
      el.style.fontSize = '';
      const box = (el.dataset.fitBox && el.closest(el.dataset.fitBox)) || el.parentElement;
      if (!box) return;
      let fs = parseFloat(getComputedStyle(el).fontSize) || 16;
      const min = fs * 0.5;
      const tight = () => box.scrollWidth > box.clientWidth + 1 || (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1);
      for (let n = 0; n < 16 && tight() && fs > min; n++) {
        fs *= 0.93;
        el.style.fontSize = fs.toFixed(1) + 'px';
      }
    });
  };

  // ================= Icons =================
  const P = {
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    fuel: '<path d="M3 22h12"/><path d="M4 9h10"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M8 17v-6"/><path d="M13 17V6"/><path d="M18 17v-4"/>',
    sliders: '<path d="M4 6h9"/><path d="M17 6h3"/><circle cx="15" cy="6" r="2"/><path d="M4 12h3"/><path d="M11 12h9"/><circle cx="9" cy="12" r="2"/><path d="M4 18h11"/><circle cx="17" cy="18" r="2"/>',
    car: '<path d="M19 17h2v-4l-2.5-5.5A2 2 0 0 0 16.7 6H7.3a2 2 0 0 0-1.8 1.5L3 13v4h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M9 17h6"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    swap: '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
    back: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    city: '<path d="M3 21h18"/><path d="M5 21V7l7-4v18"/><path d="M19 21V11l-7-4"/><path d="M9 9v.01M9 13v.01M9 17v.01"/>',
    road: '<path d="M4 21 8 3"/><path d="m20 21-4-18"/><path d="M12 5v2M12 11v2M12 17v2"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
    nav: '<path d="m3 11 19-9-9 19-2-8-8-2Z"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/><path d="M8 9h8M8 13h5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
    cloud: '<path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4.5 13 3.5 3.5 0 0 0 6 19Z"/>',
    offline: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 4.2-2.6"/><path d="M19 12.9a10 10 0 0 0-2.4-1.7"/><path d="M12 20h.01"/>',
    refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    work: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    ruler: '<path d="M21.3 15.3 8.7 2.7a1 1 0 0 0-1.4 0L2.7 7.3a1 1 0 0 0 0 1.4l12.6 12.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4Z"/><path d="m7.5 10.5 2-2M10.5 13.5l2-2M13.5 16.5l2-2"/>',
    wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    drop: '<path d="M12 2.7s-7 7.6-7 12.3a7 7 0 0 0 14 0c0-4.7-7-12.3-7-12.3Z"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
    sparkle: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>'
  };
  MC.icon = (name, cls) => '<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>';

  // ================= Native bridge =================
  MC.capacitor = () => { const rt = window.MyCarCap; return (rt && rt.Capacitor) || window.Capacitor || null; };
  MC.isNative = () => {
    const C = MC.capacitor();
    if (!C) return false;
    try { return typeof C.isNativePlatform === 'function' ? !!C.isNativePlatform() : C.platform === 'android'; } catch (e) { return false; }
  };
  const pluginCache = {};
  MC.plugin = (name) => {
    if (!MC.isNative()) return null;
    if (Object.prototype.hasOwnProperty.call(pluginCache, name)) return pluginCache[name];
    let p = null;
    try {
      const rt = window.MyCarCap;
      if (rt && typeof rt.registerPlugin === 'function') p = rt.registerPlugin(name);
      else if (window.Capacitor && window.Capacitor.Plugins) p = window.Capacitor.Plugins[name] || null;
    } catch (e) { p = null; }
    pluginCache[name] = p;
    return p;
  };
  MC.callRaw = async (name, method, args) => {
    const p = MC.plugin(name);
    if (!p || typeof p[method] !== 'function') throw new Error('no-plugin ' + name + '.' + method);
    return p[method](args);
  };
  MC.call = async (name, method, args) => {
    try { return await MC.callRaw(name, method, args); } catch (e) { console.warn('[native]', name, method, e && (e.message || e)); return undefined; }
  };
  MC.listen = async (name, event, cb) => {
    const p = MC.plugin(name);
    if (!p) return;
    try { await p.addListener(event, cb); } catch (e) { console.warn('[native] listen', name, event, e && e.message); }
  };

  // HTTP: native requests on Android (no CORS, custom headers), fetch on the web.
  MC.http = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    const timeout = opts.timeout || 12000;
    const rt = window.MyCarCap;
    if (MC.isNative() && rt && rt.CapacitorHttp) {
      if (opts.data != null) headers['Content-Type'] = 'application/json';
      const req = rt.CapacitorHttp.request({ url, method, headers, data: opts.data, connectTimeout: timeout, readTimeout: timeout, responseType: opts.text ? 'text' : 'json' });
      const res = await Promise.race([req, MC.sleep(timeout + 2000).then(() => { throw new Error('timeout'); })]);
      let data = res.data;
      if (typeof data === 'string' && !opts.text) { try { data = JSON.parse(data); } catch (e) { /* keep text */ } }
      return { status: res.status, ok: res.status >= 200 && res.status < 300, data };
    }
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), timeout);
    try {
      const webHeaders = Object.assign({}, headers);
      delete webHeaders['User-Agent']; delete webHeaders.Referer; delete webHeaders.Origin;
      const init = { method, headers: webHeaders, signal: ctl ? ctl.signal : undefined };
      if (opts.data != null) { init.body = JSON.stringify(opts.data); init.headers['Content-Type'] = opts.plain ? 'text/plain;charset=utf-8' : 'application/json'; }
      const res = await fetch(url, init);
      const txt = await res.text();
      let data = txt;
      if (!opts.text) { try { data = JSON.parse(txt); } catch (e) { /* text */ } }
      return { status: res.status, ok: res.ok, data };
    } finally { clearTimeout(t); }
  };

  // ================= Network =================
  let online = typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  const netListeners = [];
  MC.online = () => online;
  MC.onNetwork = (cb) => netListeners.push(cb);
  function setOnline(v) {
    v = !!v;
    if (v === online) return;
    online = v;
    netListeners.forEach((cb) => { try { cb(v); } catch (e) { console.warn(e); } });
  }
  MC.initNetwork = async () => {
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));
    if (MC.isNative()) {
      const st = await MC.call('Network', 'getStatus');
      if (st && typeof st.connected === 'boolean') online = st.connected;
      MC.listen('Network', 'networkStatusChange', (s) => setOnline(s && s.connected));
    }
  };

  // ================= Storage =================
  const STORE_KEY = 'mycar.state.v1';
  MC.loadRaw = async () => {
    let raw = null;
    if (MC.isNative()) {
      const r = await MC.call('Preferences', 'get', { key: STORE_KEY });
      if (r && typeof r.value === 'string' && r.value) raw = r.value;
    }
    if (!raw) { try { raw = localStorage.getItem(STORE_KEY); } catch (e) { raw = null; } }
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  };
  let saveTimer = null;
  MC.saveRaw = (obj, now) => {
    const write = () => {
      saveTimer = null;
      const raw = JSON.stringify(obj);
      try { localStorage.setItem(STORE_KEY, raw); } catch (e) { /* quota */ }
      if (MC.isNative()) MC.call('Preferences', 'set', { key: STORE_KEY, value: raw });
    };
    if (now) { clearTimeout(saveTimer); write(); return; }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(write, 250);
  };

  // Larger blobs (downloaded data files, route cache) live in files on Android, localStorage on the web.
  MC.kv = {
    async get(key) {
      if (MC.isNative()) {
        try {
          const r = await MC.callRaw('Filesystem', 'readFile', { path: 'mycar/' + key + '.json', directory: 'DATA', encoding: 'utf8' });
          return r && typeof r.data === 'string' ? r.data : null;
        } catch (e) { return null; }
      }
      try { return localStorage.getItem('mycar.kv.' + key); } catch (e) { return null; }
    },
    async set(key, value) {
      if (MC.isNative()) {
        try {
          await MC.callRaw('Filesystem', 'writeFile', { path: 'mycar/' + key + '.json', directory: 'DATA', encoding: 'utf8', data: value, recursive: true });
          return true;
        } catch (e) { console.warn('kv write', key, e && e.message); return false; }
      }
      try { localStorage.setItem('mycar.kv.' + key, value); return true; } catch (e) { return false; }
    }
  };

  // ================= Offline data =================
  const DATA_FILES = ['localities.json', 'roads.json', 'fuel.json'];
  MC.data = { localities: null, roads: null, fuel: null, places: [], hubs: [], hubIndex: null };

  async function fetchBundled(name) {
    try {
      const res = await fetch('data/' + name, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }
  async function fetchStored(name) {
    const raw = await MC.kv.get('data-' + name.replace('.json', ''));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function validData(name, d) {
    if (!d || typeof d !== 'object') return false;
    if (name === 'localities.json') return Array.isArray(d.places) && d.places.length > 100;
    if (name === 'roads.json') return Array.isArray(d.hubs) && Array.isArray(d.km10) && d.km10.length === d.hubs.length * (d.hubs.length - 1) / 2;
    if (name === 'fuel.json') return isFinite(d.price95) && d.price95 > 3 && d.price95 < 20;
    return false;
  }
  function applyData(name, d) {
    if (name === 'localities.json') {
      MC.data.localities = d;
      MC.data.places = d.places.map((p) => ({ name: p[0], en: p[1], lat: p[2], lon: p[3], pop: p[4], hub: p[5], n: MC.norm(p[0]), ne: MC.norm(p[1]) }));
    } else if (name === 'roads.json') {
      MC.data.roads = d;
      MC.data.hubs = d.hubs.map((h, i) => ({ name: h[0], lat: h[1], lon: h[2], i }));
    } else if (name === 'fuel.json') {
      MC.data.fuel = d;
    }
  }
  MC.loadData = async () => {
    for (const name of DATA_FILES) {
      const [b, s] = await Promise.all([fetchBundled(name), fetchStored(name)]);
      let best = validData(name, b) ? b : null;
      if (validData(name, s) && (!best || (s.v || 0) > (best.v || 0))) best = s;
      if (best) applyData(name, best);
    }
  };
  MC.dataVersion = (name) => {
    const d = name === 'localities.json' ? MC.data.localities : name === 'roads.json' ? MC.data.roads : MC.data.fuel;
    return d ? d.v || 0 : 0;
  };

  // Download newer data files when there is a connection. Returns the list of updated file names.
  let syncing = null;
  MC.syncData = (force) => {
    if (syncing) return syncing;
    syncing = (async () => {
      const updated = [];
      if (!MC.online()) return updated;
      for (const base of MC.DATA_URLS) {
        try {
          const m = await MC.http(base + 'manifest.json?t=' + Date.now(), { timeout: 10000 });
          if (!m.ok || !m.data || !m.data.files) continue;
          for (const name of DATA_FILES) {
            const remoteV = m.data.files[name];
            if (!remoteV || (!force && remoteV <= MC.dataVersion(name))) continue;
            if (remoteV <= MC.dataVersion(name)) continue;
            const r = await MC.http(base + name + '?v=' + remoteV, { timeout: 25000 });
            if (r.ok && validData(name, r.data)) {
              await MC.kv.set('data-' + name.replace('.json', ''), JSON.stringify(r.data));
              applyData(name, r.data);
              updated.push(name);
            }
          }
          break;
        } catch (e) { console.warn('sync', base, e && e.message); }
      }
      return updated;
    })().finally(() => { setTimeout(() => { syncing = null; }, 0); });
    return syncing;
  };
})();
