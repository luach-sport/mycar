/* MyCar app: state, sheets, actions, events and start-up. */
(function () {
  'use strict';
  const MC = window.MC;
  const V = MC.views;
  const { esc, icon, fmt, money, km } = MC;
  const $ = (sel, root) => (root || document).querySelector(sel);

  // ================= State =================
  const PRESETS = [
    { id: 'mini', label: 'מיני', sub: 'מנוע עד 1.2', urban: 14, inter: 19, tank: 35 },
    { id: 'small', label: 'קטן', sub: 'מנוע 1.2 עד 1.5', urban: 12, inter: 17, tank: 42 },
    { id: 'family', label: 'משפחתי', sub: 'מנוע 1.6 עד 2.0', urban: 10, inter: 15, tank: 50 },
    { id: 'suv', label: 'גדול / SUV', sub: 'מנוע 2.0 ומעלה', urban: 8, inter: 12, tank: 60 },
    { id: 'hybrid', label: 'היברידי', sub: 'בנזין-חשמל', urban: 20, inter: 18, tank: 43 },
    { id: 'diesel', label: 'סולר', sub: 'מנוע דיזל', urban: 13, inter: 18, tank: 50, fuelType: 'diesel' }
  ];
  const newCar = (o) => Object.assign({ id: MC.uid(), name: 'הרכב שלי', year: '', fuelType: '95', urban: 12, inter: 17, tank: 42, learn: true, price: 0 }, o || {});

  function defaults() {
    return {
      v: 1, createdAt: Date.now(), onboarded: false,
      settings: { theme: 'light', priceMode: 'auto', manualPrice: 0, fullService: false, activeCarId: null, lastTag: '' },
      cars: [], trips: [], fuel: [], places: [], routes: [], recent: [],
      reminders: { test: { on: false, date: '' }, insurance: { on: false, date: '' }, service: { on: false, every: 15000, lastKm: 0 } },
      outbox: [], profile: { name: '', email: '' }, lastCalc: null, lastSync: 0, updateSeen: 0
    };
  }
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  const pos = (v, d) => { const n = MC.num(v); return n > 0 ? n : d; };
  const cleanPlace = (p) => (isObj(p) && isFinite(p.lat) && isFinite(p.lon) ? { name: String(p.name || 'מקום').slice(0, 80), sub: p.sub ? String(p.sub).slice(0, 80) : '', lat: +p.lat, lon: +p.lon, kind: p.kind || 'locality', label: p.label || '' } : null);
  function normalize(raw) {
    const d = defaults();
    if (!isObj(raw)) { d.cars = [newCar()]; d.settings.activeCarId = d.cars[0].id; return d; }
    d.createdAt = raw.createdAt || d.createdAt;
    d.onboarded = !!raw.onboarded;
    if (isObj(raw.settings)) {
      const s = raw.settings;
      if (['light', 'dark', 'system'].includes(s.theme)) d.settings.theme = s.theme;
      if (['auto', 'manual', 'last'].includes(s.priceMode)) d.settings.priceMode = s.priceMode;
      d.settings.manualPrice = pos(s.manualPrice, 0);
      d.settings.fullService = !!s.fullService;
      d.settings.activeCarId = s.activeCarId || null;
      d.settings.lastTag = ['work', 'private'].includes(s.lastTag) ? s.lastTag : '';
    }
    if (Array.isArray(raw.cars)) {
      d.cars = raw.cars.filter(isObj).map((c) => newCar({
        id: c.id || MC.uid(), name: String(c.name || 'הרכב שלי').slice(0, 40), year: String(c.year || '').slice(0, 4),
        fuelType: ['95', '98', 'diesel', 'lpg'].includes(c.fuelType) ? c.fuelType : '95',
        urban: pos(c.urban, 12), inter: pos(c.inter, 17), tank: pos(c.tank, 0), learn: c.learn !== false, price: pos(c.price, 0)
      }));
    }
    if (!d.cars.length) d.cars = [newCar()];
    if (!d.cars.some((c) => c.id === d.settings.activeCarId)) d.settings.activeCarId = d.cars[0].id;
    const carIds = new Set(d.cars.map((c) => c.id));
    if (Array.isArray(raw.trips)) d.trips = raw.trips.filter((t) => isObj(t) && isFinite(t.km) && isFinite(t.cost)).map((t) => Object.assign({}, t, { carId: carIds.has(t.carId) ? t.carId : d.cars[0].id, ts: +t.ts || Date.now() }));
    if (Array.isArray(raw.fuel)) d.fuel = raw.fuel.filter((f) => isObj(f) && (f.amount > 0 || f.liters > 0)).map((f) => Object.assign({}, f, { carId: carIds.has(f.carId) ? f.carId : d.cars[0].id, ts: +f.ts || Date.now(), full: f.full !== false }));
    if (Array.isArray(raw.places)) d.places = raw.places.map((p) => { const c = cleanPlace(p); if (c) c.id = p.id || MC.uid(); return c; }).filter(Boolean);
    if (Array.isArray(raw.routes)) d.routes = raw.routes.filter((r) => isObj(r) && cleanPlace(r.from) && cleanPlace(r.to)).map((r) => ({ id: r.id || MC.uid(), from: cleanPlace(r.from), to: cleanPlace(r.to), round: !!r.round }));
    if (Array.isArray(raw.recent)) d.recent = raw.recent.map(cleanPlace).filter(Boolean).slice(0, 8);
    if (isObj(raw.reminders)) {
      const r = raw.reminders;
      if (isObj(r.test)) d.reminders.test = { on: !!r.test.on, date: String(r.test.date || '') };
      if (isObj(r.insurance)) d.reminders.insurance = { on: !!r.insurance.on, date: String(r.insurance.date || '') };
      if (isObj(r.service)) d.reminders.service = { on: !!r.service.on, every: pos(r.service.every, 15000), lastKm: pos(r.service.lastKm, 0) };
    }
    if (Array.isArray(raw.outbox)) d.outbox = raw.outbox.filter(isObj).slice(-30);
    if (isObj(raw.profile)) d.profile = { name: String(raw.profile.name || '').slice(0, 60), email: String(raw.profile.email || '').slice(0, 100) };
    if (isObj(raw.lastCalc)) d.lastCalc = raw.lastCalc;
    d.lastSync = +raw.lastSync || 0;
    d.updateSeen = +raw.updateSeen || 0;
    return d;
  }
  const save = (now) => MC.saveRaw(MC.state, now);
  MC.activeCar = () => MC.state.cars.find((c) => c.id === MC.state.settings.activeCarId) || MC.state.cars[0];
  MC.carById = (id) => MC.state.cars.find((c) => c.id === id) || null;

  const ui = (MC.ui = {
    tab: 'calc', view: null,
    calc: { from: null, to: null, roundTrip: false, passengers: 1, manual: false, manualKm: '', manualUrbanPct: 30, manualTitle: '' },
    result: null, busy: false,
    tripsMonth: MC.monthKey(Date.now()), tripsFilter: 'all',
    statsMode: 'month', statsRef: Date.now(),
    sheet: null, form: {}, picker: null, pickerItems: [], confirm: null
  });

  // ================= Theme =================
  function resolvedTheme() {
    const t = MC.state.settings.theme;
    if (t === 'system') return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return t;
  }
  function applyTheme() {
    const t = resolvedTheme();
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('mycar.theme', MC.state.settings.theme); } catch (e) { /* ignore */ }
    const bg = t === 'dark' ? '#0B1220' : '#F3F6FC';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bg);
    if (MC.isNative()) {
      MC.call('StatusBar', 'setBackgroundColor', { color: bg });
      MC.call('StatusBar', 'setStyle', { style: t === 'dark' ? 'DARK' : 'LIGHT' });
    }
  }

  // ================= Toast / haptics =================
  let toastTimer;
  function toast(msg, ms) {
    const root = $('#toast-root');
    root.innerHTML = '<div class="toast">' + esc(msg) + '</div>';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { root.innerHTML = ''; }, ms || 2600);
  }
  MC.toast = toast;
  function haptic() { if (MC.isNative()) MC.call('Haptics', 'impact', { style: 'LIGHT' }); }

  // ================= Render =================
  function render(keepScroll) {
    const y = window.scrollY;
    const main = $('#screen');
    const inResult = ui.view === 'result' && ui.result;
    document.body.classList.toggle('no-tabs', !!inResult);
    main.classList.toggle('pushed', !!inResult);
    main.classList.toggle('has-fab', !inResult && ui.tab === 'fuel');
    let html;
    if (inResult) html = V.result();
    else if (ui.tab === 'trips') html = V.trips();
    else if (ui.tab === 'fuel') html = V.fuel();
    else if (ui.tab === 'stats') html = V.stats();
    else if (ui.tab === 'settings') html = V.settings();
    else html = V.calc();
    main.innerHTML = html;
    $('#fab-root').innerHTML = !inResult && ui.tab === 'fuel' ? V.fuelFab() : '';
    document.querySelectorAll('#tabs button[data-tab]').forEach((b) => {
      if (b.getAttribute('data-tab') === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    MC.fitText(main);
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  MC.render = render;

  // ================= Reminders =================
  const daysUntil = (dateStr) => {
    if (!dateStr) return null;
    const t = new Date(dateStr + 'T00:00:00').getTime();
    if (!isFinite(t)) return null;
    return Math.round((t - MC.dayStart(Date.now())) / 864e5);
  };
  function serviceDue() {
    const r = MC.state.reminders.service;
    if (!r.on || !r.lastKm) return null;
    const a = MC.analyzeFuel(MC.activeCar().id);
    if (!a.lastOdo) return null;
    const left = r.lastKm + r.every - a.lastOdo;
    return left <= 500 ? { left, odo: a.lastOdo } : null;
  }
  MC.reminderNotices = () => {
    const r = MC.state.reminders;
    let h = '';
    [['test', 'הטסט'], ['insurance', 'הביטוח']].forEach(([k, label]) => {
      if (!r[k].on) return;
      const d = daysUntil(r[k].date);
      if (d == null || d > 14) return;
      const when = d < 0 ? 'עבר לפני ' + -d + ' ימים' : d === 0 ? 'היום' : d === 1 ? 'מחר' : 'בעוד ' + d + ' ימים';
      h += '<button type="button" class="notice orange" style="border:0;text-align:right" data-action="open-sheet" data-sheet="reminders">' + icon(k === 'test' ? 'shield' : 'calendar', 'sm') + '<span class="grow">' + label + ' ' + when + ' (' + MC.dateFull(new Date(r[k].date + 'T00:00:00')) + ')</span></button>';
    });
    const s = serviceDue();
    if (s) {
      h += '<div class="notice orange">' + icon('wrench', 'sm') + '<span class="grow">' + (s.left <= 0 ? 'הגיע הזמן לטיפול' : 'עוד ' + fmt(s.left) + ' ק״מ לטיפול') + '</span><button type="button" class="link" data-action="service-done">ביצעתי טיפול</button></div>';
    }
    return h;
  };
  MC.reminderSummary = () => {
    const r = MC.state.reminders;
    const parts = [];
    if (r.test.on && r.test.date) parts.push('טסט ' + MC.dateFull(new Date(r.test.date + 'T00:00:00')));
    if (r.insurance.on && r.insurance.date) parts.push('ביטוח ' + MC.dateFull(new Date(r.insurance.date + 'T00:00:00')));
    if (r.service.on) parts.push('טיפול כל ' + fmt(r.service.every) + ' ק״מ');
    return parts.length ? parts.join(' · ') : 'לא הוגדרו תזכורות';
  };
  async function scheduleReminders() {
    if (!MC.isNative()) return;
    const ids = [101, 102, 201, 202];
    await MC.call('LocalNotifications', 'cancel', { notifications: ids.map((id) => ({ id })) });
    const r = MC.state.reminders, car = MC.activeCar();
    const list = [];
    [['test', 'טסט', 100], ['insurance', 'ביטוח', 200]].forEach(([k, label, base]) => {
      if (!r[k].on || !r[k].date) return;
      const day = new Date(r[k].date + 'T09:00:00').getTime();
      [[14, 1], [1, 2]].forEach(([before, n]) => {
        const at = day - before * 864e5;
        if (at > Date.now() + 60e3) list.push({ id: base + n, title: 'MyCar · תזכורת ' + label, body: label + ' ל' + car.name + (before === 1 ? ' מחר' : ' בעוד ' + before + ' ימים') + ' (' + MC.dateFull(day) + ')', schedule: { at: new Date(at), allowWhileIdle: true }, smallIcon: 'ic_stat_mycar', iconColor: '#1652F0' });
      });
    });
    if (!list.length) return;
    const perm = await MC.call('LocalNotifications', 'requestPermissions');
    if (perm && perm.display && perm.display !== 'granted') { toast('כדי לקבל תזכורות צריך לאשר התראות בהגדרות הטלפון'); return; }
    await MC.call('LocalNotifications', 'schedule', { notifications: list });
  }

  // ================= Sheets =================
  const SHEETS = {};
  function openSheet(name, data) {
    ui.sheet = { name, data: data || {} };
    ui.confirm = null;
    if (SHEETS[name].init) SHEETS[name].init(ui.sheet.data);
    renderSheet();
    const first = $('#sheet-root [autofocus]');
    if (first) setTimeout(() => first.focus(), 60);
  }
  function closeSheet() {
    if (!ui.sheet) return;
    if (SHEETS[ui.sheet.name].noClose && SHEETS[ui.sheet.name].noClose()) return;
    ui.sheet = null; ui.picker = null;
    $('#sheet-root').innerHTML = '';
  }
  function renderSheet() {
    const root = $('#sheet-root');
    if (!ui.sheet) { root.innerHTML = ''; return; }
    const def = SHEETS[ui.sheet.name];
    const body = def.render(ui.sheet.data);
    const locked = def.noClose && def.noClose();
    const prev = root.querySelector('.sheet');
    const st = prev ? prev.scrollTop : 0;
    root.innerHTML = '<div class="sheet-wrap"><div class="sheet-backdrop"' + (locked ? '' : ' data-action="close-sheet"') + '></div>' +
      '<div class="sheet' + (def.full ? ' full' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(def.title(ui.sheet.data)) + '">' +
      '<div class="grabber" aria-hidden="true"></div>' +
      '<div class="sheet-head"><h2>' + esc(def.title(ui.sheet.data)) + '</h2>' + (locked ? '' : '<button type="button" class="round-btn" aria-label="סגירה" data-action="close-sheet">' + icon('close') + '</button>') + '</div>' +
      body + '</div></div>';
    if (prev) { const s = root.querySelector('.sheet'); if (s) { s.style.animation = 'none'; s.scrollTop = st; const b = root.querySelector('.sheet-backdrop'); if (b) b.style.animation = 'none'; } }
  }

  // ---------- Place picker ----------
  SHEETS.picker = {
    full: true,
    title: (d) => (d.which === 'from' ? 'מאיפה יוצאים?' : d.which === 'to' ? 'לאן נוסעים?' : 'הוספת מקום שמור'),
    init: (d) => { ui.picker = { which: d.which, q: '', remote: [], remoteState: '' }; },
    render: () => '<div class="search-box"><div class="input-wrap" id="pwrap"><input id="psearch" class="input" type="search" enterkeyhint="search" autocomplete="off" placeholder="עיר, יישוב או כתובת" data-picker="q" autofocus aria-label="חיפוש מקום"><span class="suffix">' + icon('search', 'sm') + '</span>' +
      '<button type="button" class="clear" aria-label="ניקוי החיפוש" data-action="picker-clear">' + icon('close', 'sm') + '</button></div></div>' +
      '<div id="plist">' + pickerList() + '</div>'
  };
  function pickerList() {
    const p = ui.picker, s = MC.state;
    const items = [];
    let h = '';
    const item = (pl, ic, tone, sub) => {
      items.push(pl);
      return '<button type="button" class="result-item" data-action="choose-place" data-i="' + (items.length - 1) + '"><span class="tile ' + (tone || 'gray') + '">' + icon(ic) + '</span><span class="grow"><span class="t">' + esc(pl.name) + '</span>' + (sub ? '<span class="s">' + esc(sub) + '</span>' : '') + '</span></button>';
    };
    if (!p.q.trim()) {
      h += '<button type="button" class="result-item" data-action="picker-gps"><span class="tile">' + icon('locate') + '</span><span class="grow"><span class="t">המיקום הנוכחי שלי</span><span class="s">עובד גם בלי אינטרנט (GPS)</span></span></button>';
      if (p.which !== 'save') {
        s.places.forEach((pl) => { h += item(pl, pl.label === 'home' ? 'home' : pl.label === 'work' ? 'work' : 'star', 'orange', pl.label === 'home' ? 'בית' : pl.label === 'work' ? 'עבודה' : 'מקום שמור'); });
        if (s.recent.length) h += '<div class="day-label" style="margin:12px 4px 0">אחרונים</div>';
        s.recent.forEach((pl) => { h += item(pl, 'clock', 'gray', pl.sub || ''); });
      }
      h += '<p class="fine" style="margin:14px 4px">אפשר לחפש כל יישוב בארץ גם בלי אינטרנט. כתובת מדויקת (רחוב ומספר) מחפשים כשיש חיבור.</p>';
    } else {
      const res = MC.searchPlaces(p.q, 14);
      res.forEach((pl) => { h += item({ name: pl.name, lat: pl.lat, lon: pl.lon, kind: 'locality', pop: pl.pop }, 'city', '', pl.pop ? fmt(pl.pop) + ' תושבים' : 'יישוב'); });
      if (!res.length) h += '<p class="fine" style="margin:10px 4px">לא נמצא יישוב בשם הזה.</p>';
      if (MC.online()) {
        if (p.remoteState === 'loading') h += '<p class="fine" style="margin:10px 4px">מחפש כתובות…</p>';
        else if (p.remoteState === 'done') {
          if (p.remote.length) h += '<div class="day-label" style="margin:12px 4px 0">כתובות</div>';
          p.remote.forEach((pl) => { h += item(pl, 'pin', 'orange', pl.sub); });
          if (!p.remote.length) h += '<p class="fine" style="margin:10px 4px">לא נמצאה כתובת. נסה לכתוב גם את שם העיר.</p>';
        } else if (p.remoteState === 'error') h += '<p class="fine" style="margin:10px 4px">חיפוש הכתובות לא הצליח כרגע.</p>';
        if (p.remoteState !== 'loading') h += '<button type="button" class="btn secondary" style="margin-top:10px" data-action="picker-remote">' + icon('search') + 'חיפוש כתובת מדויקת: ' + esc(p.q.trim().slice(0, 30)) + '</button>';
      } else {
        h += '<p class="fine" style="margin:10px 4px">' + icon('offline', 'sm') + ' אין חיבור: מוצגים יישובים מהמאגר שבמכשיר.</p>';
      }
    }
    ui.pickerItems = items;
    return h;
  }
  function refreshPicker() { const el = $('#plist'); if (el) el.innerHTML = pickerList(); }
  const debouncedPicker = MC.debounce(refreshPicker, 120);

  async function getGps() {
    if (MC.isNative()) {
      try {
        const perm = await MC.callRaw('Geolocation', 'checkPermissions');
        if (!perm || perm.location !== 'granted') {
          const req = await MC.callRaw('Geolocation', 'requestPermissions');
          if (!req || (req.location !== 'granted' && req.coarseLocation !== 'granted')) throw new Error('denied');
        }
        const p = await MC.callRaw('Geolocation', 'getCurrentPosition', { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
        return { lat: p.coords.latitude, lon: p.coords.longitude };
      } catch (e) {
        throw new Error(e && /denied|permission/i.test(e.message || '') ? 'denied' : 'failed');
      }
    }
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('failed'));
      navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        (err) => reject(new Error(err && err.code === 1 ? 'denied' : 'failed')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    });
  }
  async function gpsPlace() {
    toast('מאתר מיקום…', 8000);
    try {
      const pt = await getGps();
      const near = MC.nearestPlace(pt);
      toast(near ? 'המיקום: ' + near.name : 'המיקום נמצא');
      return { name: near ? near.name : 'המיקום שלי', sub: 'המיקום הנוכחי', lat: pt.lat, lon: pt.lon, kind: 'gps' };
    } catch (e) {
      toast(e.message === 'denied' ? 'צריך לאשר גישה למיקום' : 'לא הצלחתי לאתר מיקום. בדוק שה-GPS פועל.');
      return null;
    }
  }
  function choosePlace(pl) {
    const which = ui.picker ? ui.picker.which : 'from';
    if (which === 'save') { openSheet('savePlace', { place: pl }); return; }
    ui.calc[which] = pl;
    const rec = MC.state.recent.filter((x) => x.name !== pl.name);
    rec.unshift({ name: pl.name, sub: pl.sub || '', lat: pl.lat, lon: pl.lon, kind: pl.kind });
    MC.state.recent = rec.slice(0, 8);
    persistCalc();
    closeSheet();
    render(true);
  }
  function persistCalc() {
    const c = ui.calc;
    MC.state.lastCalc = { from: c.from, to: c.to, roundTrip: c.roundTrip, passengers: c.passengers };
    save();
  }

  // ---------- Save place ----------
  SHEETS.savePlace = {
    title: () => 'שמירת מקום',
    init: (d) => { ui.form = { label: 'home', name: d.place.name }; },
    render: (d) => '<div class="notice blue">' + icon('pin', 'sm') + '<span class="grow">' + esc(d.place.name) + (d.place.sub ? ' · ' + esc(d.place.sub) : '') + '</span></div>' +
      V.seg('form-set', [{ v: 'home', label: 'בית', icon: 'home' }, { v: 'work', label: 'עבודה', icon: 'work' }, { v: 'other', label: 'אחר', icon: 'star' }], ui.form.label).replace(/data-action="form-set"/g, 'data-action="form-set" data-k="label"') +
      '<div class="field"><label for="spn">שם</label><input id="spn" class="input" data-f="name" value="' + esc(ui.form.name) + '"></div>' +
      '<button type="button" class="btn" data-action="save-place">' + icon('check') + 'שמור</button>'
  };

  // ---------- Car picker ----------
  SHEETS.carPicker = {
    title: () => 'בחירת רכב',
    render: () => MC.state.cars.map((c) => '<button type="button" class="list-item" data-action="set-car" data-id="' + c.id + '"><span class="tile ' + (c.id === MC.activeCar().id ? 'solid' : 'gray') + '">' + icon('car') + '</span><span class="grow"><span class="t">' + esc(c.name) + (c.year ? ' ' + esc(c.year) : '') + '</span><span class="s">' + esc(MC.FUEL_LABEL[c.fuelType]) + ' · ' + fmt(c.urban, 1) + ' / ' + fmt(c.inter, 1) + ' ק״מ/ל׳</span></span>' + (c.id === MC.activeCar().id ? icon('check') : '') + '</button>').join('') +
      '<button type="button" class="chip dashed" style="justify-content:center;min-height:46px" data-action="edit-car" data-id="">+ הוסף רכב</button>'
  };

  // ---------- Car editor (also used by onboarding) ----------
  function carForm(c) {
    return { id: c ? c.id : '', name: c ? c.name : 'הרכב שלי', year: c ? c.year : '', fuelType: c ? c.fuelType : '95', urban: c ? c.urban : 12, inter: c ? c.inter : 17, tank: c ? c.tank || '' : 42, learn: c ? c.learn : true, price: c && c.price ? c.price : '', preset: c ? '' : 'small' };
  }
  function carFields(onboarding) {
    const f = ui.form;
    let h = '<div class="field"><label for="cn">שם הרכב</label><input id="cn" class="input" data-f="name" value="' + esc(f.name) + '" placeholder="למשל: הונדה ג׳אז"></div>';
    h += '<div class="grid2"><div class="field"><label for="cy">שנת ייצור (לא חובה)</label><input id="cy" class="input num" inputmode="numeric" maxlength="4" data-f="year" value="' + esc(f.year) + '"></div>' +
      '<div class="field"><label for="ct">נפח מיכל</label><div class="input-wrap"><input id="ct" class="input num" inputmode="decimal" data-f="tank" value="' + esc(f.tank) + '"><span class="suffix">ליטר</span></div></div></div>';
    h += '<div class="field"><span class="label">סוג דלק</span>' + V.seg('form-set', [{ v: '95', label: '95' }, { v: '98', label: '98' }, { v: 'diesel', label: 'סולר' }, { v: 'lpg', label: 'גפ״מ' }], f.fuelType, 'small').replace(/data-action="form-set"/g, 'data-action="form-set" data-k="fuelType"') + '</div>';
    h += '<div class="field"><span class="label">' + (onboarding ? 'איזה רכב? (הערכה ראשונית, אפשר לדייק)' : 'הערכה לפי סוג רכב') + '</span><div class="preset-grid">' +
      PRESETS.map((p) => '<button type="button" class="preset" data-action="car-preset" data-v="' + p.id + '" aria-pressed="' + (f.preset === p.id ? 'true' : 'false') + '"><b>' + esc(p.label) + '</b><span>' + esc(p.sub) + ' · ' + p.urban + '/' + p.inter + ' ק״מ/ל׳</span></button>').join('') + '</div></div>';
    h += '<div class="grid2"><div class="field"><label for="cu">צריכה בעיר</label><div class="input-wrap"><input id="cu" class="input big num" inputmode="decimal" data-f="urban" value="' + esc(f.urban) + '"><span class="suffix">ק״מ/ל׳</span></div></div>' +
      '<div class="field"><label for="ci">צריכה בין-עירוני</label><div class="input-wrap"><input id="ci" class="input big num" inputmode="decimal" data-f="inter" value="' + esc(f.inter) + '"><span class="suffix">ק״מ/ל׳</span></div></div></div>';
    if (f.fuelType !== '95') {
      h += '<div class="field"><label for="cp">מחיר לליטר ' + esc(MC.FUEL_LABEL[f.fuelType]) + '</label><div class="input-wrap"><input id="cp" class="input num" inputmode="decimal" data-f="price" value="' + esc(f.price) + '" placeholder="אם ריק: לפי התדלוק האחרון"><span class="suffix">₪</span></div><span class="hint">רק בנזין 95 בפיקוח, לכן את המחיר לסוג הזה מזינים כאן או שהוא נלקח מהתדלוק האחרון.</span></div>';
    }
    h += '<div class="card tight"><div class="row"><div class="grow"><span class="t">ללמוד מהתדלוקים</span><span class="s">החישוב יתאים את עצמו לצריכה האמיתית של הרכב</span></div>' + V.sw('form-toggle', f.learn, 'ללמוד מהתדלוקים', ' data-k="learn"') + '</div></div>';
    return h;
  }
  function readCarForm() {
    const f = ui.form;
    const urban = MC.num(f.urban), inter = MC.num(f.inter);
    if (!(urban > 0 && urban < 60) || !(inter > 0 && inter < 60)) { toast('בדוק את נתוני הצריכה (ק״מ לליטר)'); return null; }
    return {
      name: String(f.name || '').trim().slice(0, 40) || 'הרכב שלי', year: String(f.year || '').replace(/\D/g, '').slice(0, 4),
      fuelType: f.fuelType, urban, inter, tank: MC.num(f.tank) > 0 ? MC.num(f.tank) : 0, learn: !!f.learn, price: MC.num(f.price) > 0 ? MC.num(f.price) : 0
    };
  }
  SHEETS.car = {
    full: true,
    title: (d) => (d.id ? 'עריכת רכב' : 'רכב חדש'),
    init: (d) => { ui.form = carForm(d.id ? MC.carById(d.id) : null); },
    render: (d) => carFields(false) +
      '<button type="button" class="btn" data-action="save-car">' + icon('check') + 'שמור רכב</button>' +
      (d.id && MC.state.cars.length > 1 ? '<button type="button" class="btn danger" data-action="delete-car">' + icon('trash') + (ui.confirm === 'car' ? 'לחץ שוב למחיקה (הנסיעות והתדלוקים שלו יימחקו)' : 'מחיקת הרכב') + '</button>' : '')
  };

  // ---------- Onboarding ----------
  SHEETS.welcome = {
    full: true,
    noClose: () => !MC.state.onboarded,
    title: () => 'ברוכים הבאים',
    init: () => { ui.form = carForm(null); ui.form.name = ''; },
    render: () => '<div class="welcome"><img src="icon-512.png" alt=""><h2>MyCar</h2><span class="slogan">עד הטיפה האחרונה</span>' +
      '<span style="color:var(--muted);font-size:14px">כמה עולה כל נסיעה, יומן נסיעות ותדלוקים, וכמה האוטו באמת צורך. הכל נשמר בטלפון ועובד גם בלי אינטרנט.</span></div>' +
      '<span class="section-label">ספר לנו על הרכב</span>' + carFields(true) +
      '<button type="button" class="btn cta" data-action="finish-onboarding">' + icon('check') + 'יאללה, מתחילים</button>'
  };

  // ---------- Price ----------
  SHEETS.price = {
    title: () => 'מחיר דלק',
    render: () => V.priceControls() + '<button type="button" class="btn" data-action="close-sheet">' + icon('check') + 'סיום</button>'
  };

  // ---------- Fuel form ----------
  function fuelDraft(id) {
    const car = MC.activeCar();
    const f = id ? MC.state.fuel.find((x) => x.id === id) : null;
    if (f) return { id: f.id, carId: f.carId, amount: f.amount ? String(f.amount) : '', price: String(f.price || ''), liters: f.liters ? String(+f.liters.toFixed(2)) : '', litersMode: !!f.litersMode, odo: f.odo ? String(f.odo) : '', full: f.full, station: f.station || '', when: MC.localInput(f.ts) };
    const pr = MC.priceFor(car);
    const last = MC.lastRefuel(car.id);
    return { id: '', carId: car.id, amount: '', price: String(+(last && MC.state.settings.priceMode === 'last' ? last.price : pr.price).toFixed(2)), liters: '', litersMode: false, odo: '', full: true, station: last ? last.station || '' : '', when: MC.localInput(Date.now()) };
  }
  function fuelCalc() {
    const f = ui.form;
    const price = MC.num(f.price);
    let amount = MC.num(f.amount), liters = MC.num(f.liters);
    if (f.litersMode) { amount = liters > 0 && price > 0 ? liters * price : NaN; } else { liters = amount > 0 && price > 0 ? amount / price : NaN; }
    const ts = new Date(f.when).getTime() || Date.now();
    const odo = MC.num(f.odo);
    const draft = { id: f.id || '__draft', carId: f.carId, ts, amount: amount > 0 ? amount : 0, price: price > 0 ? price : 0, liters: liters > 0 ? liters : 0, odo: odo > 0 ? odo : 0, full: !!f.full };
    const others = MC.state.fuel.filter((x) => x.id !== f.id);
    const prevOdo = others.filter((x) => x.carId === f.carId && x.ts <= ts && x.odo > 0).sort((a, b) => b.ts - a.ts)[0];
    const a = MC.analyzeFuel(f.carId, others.concat([draft]));
    const row = a.rows.find((r) => r.f.id === draft.id);
    return { amount, liters, price, odo, prevOdo: prevOdo ? prevOdo.odo : null, row, draft };
  }
  function fuelLiveHtml() {
    const x = fuelCalc();
    let odoHint = '';
    if (x.odo > 0 && x.prevOdo) {
      odoHint = x.odo > x.prevOdo ? '<span class="hint good">' + fmt(x.odo - x.prevOdo) + ' ק״מ מאז התדלוק הקודם</span>' : '<span class="hint bad">הקילומטרז׳ נמוך מהתדלוק הקודם (' + fmt(x.prevOdo) + ')</span>';
    } else if (x.prevOdo) odoHint = '<span class="hint">בתדלוק הקודם: ' + fmt(x.prevOdo) + ' ק״מ</span>';
    else odoHint = '<span class="hint">רושמים את המספר מלוח השעונים. כך נדע כמה נסעת בכל תדלוק.</span>';
    let live = '';
    if (x.row && x.row.cons) live = '<span style="font-size:13px;color:#C3CCDB">בתדלוק הזה</span><span style="font-size:16px;font-weight:700" class="num">' + fmt(x.row.cons, 1) + ' ק״מ/ל׳ · ' + money(x.row.cpk) + ' לק״מ</span>';
    else if (x.liters > 0) live = '<span style="font-size:13px;color:#C3CCDB">' + (ui.form.full ? 'מהתדלוק המלא הבא נחשב צריכה' : 'מיכל חלקי') + '</span><span style="font-size:16px;font-weight:700" class="num">' + fmt(x.liters, 1) + ' ליטר</span>';
    return { odoHint, live, liters: x.liters, amount: x.amount };
  }
  function updateFuelLive() {
    const l = fuelLiveHtml();
    const a = $('#f-calc'); if (a) a.textContent = ui.form.litersMode ? (l.amount > 0 ? money(l.amount) : '–') : (l.liters > 0 ? fmt(l.liters, 1) : '–');
    const o = $('#odo-hint'); if (o) o.innerHTML = l.odoHint;
    const v = $('#fuel-live'); if (v) { v.innerHTML = l.live; v.classList.toggle('hidden', !l.live); }
  }
  SHEETS.fuel = {
    full: true,
    title: (d) => (d.id ? 'עריכת תדלוק' : 'תדלוק חדש'),
    init: (d) => { ui.form = fuelDraft(d.id); },
    render: (d) => {
      const f = ui.form, l = fuelLiveHtml();
      const stations = Array.from(new Set(MC.state.fuel.map((x) => x.station).filter(Boolean))).slice(0, 12);
      let h = '<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px">';
      if (!f.litersMode) {
        h += '<label for="famt" style="font-size:14px;color:var(--muted);font-weight:500">כמה שילמת?</label>' +
          '<div class="ltr" style="display:flex;align-items:baseline;justify-content:center;gap:4px"><span style="font-size:30px;font-weight:700;color:var(--orange)">₪</span>' +
          '<input id="famt" class="num" inputmode="decimal" data-f="amount" value="' + esc(f.amount) + '" placeholder="0" style="width:170px;border:0;background:transparent;font-size:52px;font-weight:800;color:var(--ink);text-align:center;padding:0"' + (d.id ? '' : ' autofocus') + '></div>' +
          '<div class="chips" style="justify-content:center">' + [100, 200, 300].map((v) => '<button type="button" class="chip sm" data-action="fuel-quick" data-v="' + v + '">₪' + v + '</button>').join('') + '</div>';
      } else {
        h += '<label for="flit" style="font-size:14px;color:var(--muted);font-weight:500">כמה ליטרים?</label>' +
          '<input id="flit" class="num" inputmode="decimal" data-f="liters" value="' + esc(f.liters) + '" placeholder="0" style="width:200px;border:0;background:transparent;font-size:52px;font-weight:800;color:var(--ink);text-align:center;padding:0">';
      }
      h += '<button type="button" class="chip sm" data-action="fuel-mode">' + (f.litersMode ? 'הזנה לפי סכום בשקלים' : 'הזנה לפי ליטרים') + '</button></div>';
      h += '<div class="grid2"><div class="field"><label for="fpr">מחיר לליטר</label><div class="input-wrap"><input id="fpr" class="input big num" inputmode="decimal" data-f="price" value="' + esc(f.price) + '"><span class="suffix">₪</span></div></div>' +
        '<div class="mini blue"><span class="l">' + (f.litersMode ? 'סכום' : 'ליטרים') + '</span><span class="b num" id="f-calc">' + (f.litersMode ? (l.amount > 0 ? money(l.amount) : '–') : (l.liters > 0 ? fmt(l.liters, 1) : '–')) + '</span><span class="l" style="font-size:11px">חושב אוטומטית</span></div></div>';
      h += '<div class="field"><label for="fodo">קריאת מד-אוץ (קילומטרז׳)</label><div class="input-wrap"><input id="fodo" class="input big num" inputmode="numeric" data-f="odo" value="' + esc(f.odo) + '" placeholder="למשל 184520"><span class="suffix">ק״מ</span></div><span id="odo-hint">' + l.odoHint + '</span></div>';
      h += '<div class="card tight"><div class="row"><div class="grow"><span class="t">מילאתי מיכל מלא</span><span class="s">כך מחשבים צריכה מדויקת</span></div>' + V.sw('form-toggle', f.full, 'מילאתי מיכל מלא', ' data-k="full"') + '</div>' +
        '<div class="row"><label for="fst" class="t" style="flex-shrink:0">תחנה</label><input id="fst" class="input" style="min-height:44px;border:0;text-align:left;padding:4px" list="stations" data-f="station" value="' + esc(f.station) + '" placeholder="לא חובה"></div>' +
        '<div class="row"><label for="fwhen" class="t" style="flex-shrink:0">מתי</label><input id="fwhen" type="datetime-local" class="input" style="min-height:44px;border:0;text-align:left;padding:4px" data-f="when" value="' + esc(f.when) + '"></div></div>' +
        '<datalist id="stations">' + stations.map((s) => '<option value="' + esc(s) + '"></option>').join('') + '</datalist>';
      h += '<div id="fuel-live" class="' + (l.live ? '' : 'hidden') + '" style="background:#0B1220;border-radius:20px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;color:#fff;gap:10px">' + l.live + '</div>';
      h += '<button type="button" class="btn" data-action="save-fuel">' + icon('check') + 'שמור תדלוק</button>';
      if (d.id) h += '<button type="button" class="btn danger" data-action="delete-fuel">' + icon('trash') + (ui.confirm === 'fuel' ? 'לחץ שוב למחיקה' : 'מחיקת התדלוק') + '</button>';
      return h;
    }
  };

  // ---------- Trip details ----------
  SHEETS.trip = {
    title: (d) => { const t = MC.state.trips.find((x) => x.id === d.id); return t ? t.title : 'נסיעה'; },
    render: (d) => {
      const t = MC.state.trips.find((x) => x.id === d.id);
      if (!t) return '<p>הנסיעה לא נמצאה.</p>';
      const car = MC.carById(t.carId);
      const src = { online: 'מסלול מדויק', cache: 'מסלול שמור', offline: 'הערכה ללא אינטרנט', manual: 'מרחק ידני' }[t.source] || '';
      return '<div class="hero" style="padding:18px"><div class="head"><div style="display:flex;flex-direction:column;gap:4px"><span class="lbl">' + esc(MC.dayLabel(t.ts)) + ' · ' + MC.time(t.ts) + (car ? ' · ' + esc(car.name) : '') + '</span>' +
        '<div class="amount num"><span class="cur">₪</span><span class="val" style="font-size:42px">' + fmt(t.cost, 2) + '</span></div></div></div>' +
        '<div class="stat3"><div><b class="num">' + km(t.km) + '</b><span>קילומטר</span></div><div><b class="num">' + fmt(t.liters, 1) + '</b><span>ליטר</span></div><div><b class="num">' + money(t.price) + '</b><span>לליטר</span></div></div></div>' +
        '<div class="card tight">' +
        (t.roundTrip ? '<div class="row"><span class="grow"><span class="t">הלוך-חזור</span></span>' + icon('check') + '</div>' : '') +
        (t.passengers > 1 ? '<div class="row"><span class="grow"><span class="t">לכל נוסע (' + t.passengers + ')</span></span><span class="v num">' + money(t.cost / t.passengers) + '</span></div>' : '') +
        '<div class="row"><span class="grow"><span class="t">עירוני</span></span><span class="v num">' + km(t.urbanKm || 0) + ' ק״מ</span></div>' +
        (src ? '<div class="row"><span class="grow"><span class="t">מקור המרחק</span></span><span class="s">' + esc(src) + '</span></div>' : '') + '</div>' +
        '<div class="field"><span class="label">סוג הנסיעה</span><div class="chips">' + [['work', 'עבודה'], ['private', 'פרטי'], ['', 'ללא']].map(([v, l]) =>
          '<button type="button" class="chip" data-action="trip-tag" data-v="' + v + '" aria-pressed="' + ((t.tag || '') === v ? 'true' : 'false') + '">' + l + '</button>').join('') + '</div></div>' +
        '<div class="btn-row">' + (t.from && t.to ? '<button type="button" class="btn secondary" data-action="trip-again">' + icon('repeat') + 'חשב שוב</button>' : '') +
        '<button type="button" class="btn secondary" data-action="trip-share">' + icon('share') + 'שתף</button></div>' +
        '<button type="button" class="btn danger" data-action="delete-trip">' + icon('trash') + (ui.confirm === 'trip' ? 'לחץ שוב למחיקה' : 'מחיקת הנסיעה') + '</button>';
    }
  };

  // ---------- Saved places & routes ----------
  SHEETS.saved = {
    title: () => 'מקומות ומסלולים שמורים',
    render: () => {
      const s = MC.state;
      let h = '<span class="section-label">מקומות</span>';
      if (!s.places.length) h += '<p class="fine" style="margin:0 4px">עוד אין מקומות שמורים. שמור את הבית והעבודה כדי לבחור אותם בלחיצה.</p>';
      s.places.forEach((p) => {
        h += '<div class="list-item"><span class="tile orange">' + icon(p.label === 'home' ? 'home' : p.label === 'work' ? 'work' : 'star') + '</span><span class="grow"><span class="t">' + esc(p.name) + '</span><span class="s">' + (p.label === 'home' ? 'בית' : p.label === 'work' ? 'עבודה' : 'מקום שמור') + '</span></span>' +
          '<button type="button" class="round-btn" aria-label="מחיקת ' + esc(p.name) + '" data-action="delete-place" data-id="' + p.id + '">' + icon('trash', 'sm') + '</button></div>';
      });
      h += '<button type="button" class="chip dashed" style="justify-content:center;min-height:46px" data-action="add-place">+ הוסף מקום</button>';
      h += '<span class="section-label">מסלולים</span>';
      if (!s.routes.length) h += '<p class="fine" style="margin:0 4px">במסך החישוב לוחצים "שמור מסלול" אחרי שבוחרים מוצא ויעד.</p>';
      s.routes.forEach((r) => {
        h += '<div class="list-item"><span class="tile">' + icon(r.round ? 'repeat' : 'route') + '</span><span class="grow"><span class="t">' + esc(r.from.name + ' ← ' + r.to.name) + '</span>' + (r.round ? '<span class="s">הלוך-חזור</span>' : '') + '</span>' +
          '<button type="button" class="round-btn" aria-label="מחיקת המסלול" data-action="delete-route" data-id="' + r.id + '">' + icon('trash', 'sm') + '</button></div>';
      });
      return h;
    }
  };

  // ---------- Reminders ----------
  SHEETS.reminders = {
    full: true,
    title: () => 'תזכורות',
    init: () => { const r = MC.state.reminders; ui.form = { testOn: r.test.on, test: r.test.date, insOn: r.insurance.on, ins: r.insurance.date, svcOn: r.service.on, every: String(r.service.every), lastKm: r.service.lastKm ? String(r.service.lastKm) : '' }; },
    render: () => {
      const f = ui.form, a = MC.analyzeFuel(MC.activeCar().id);
      return '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:center;gap:12px"><span class="tile orange">' + icon('shield') + '</span><span style="flex:1"><b>טסט שנתי</b></span>' + V.sw('form-toggle', f.testOn, 'תזכורת טסט', ' data-k="testOn"') + '</div>' +
        '<div class="field"><label for="rt">תאריך הטסט</label><input id="rt" type="date" class="input" data-f="test" value="' + esc(f.test) + '"></div></div>' +
        '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:center;gap:12px"><span class="tile">' + icon('calendar') + '</span><span style="flex:1"><b>חידוש ביטוח</b></span>' + V.sw('form-toggle', f.insOn, 'תזכורת ביטוח', ' data-k="insOn"') + '</div>' +
        '<div class="field"><label for="ri">תאריך החידוש</label><input id="ri" type="date" class="input" data-f="ins" value="' + esc(f.ins) + '"></div></div>' +
        '<div class="card" style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:center;gap:12px"><span class="tile green">' + icon('wrench') + '</span><span style="flex:1"><b>טיפול תקופתי</b></span>' + V.sw('form-toggle', f.svcOn, 'תזכורת טיפול', ' data-k="svcOn"') + '</div>' +
        '<div class="grid2"><div class="field"><label for="re">כל כמה ק״מ</label><input id="re" class="input num" inputmode="numeric" data-f="every" value="' + esc(f.every) + '"></div>' +
        '<div class="field"><label for="rl">קילומטרז׳ בטיפול האחרון</label><input id="rl" class="input num" inputmode="numeric" data-f="lastKm" value="' + esc(f.lastKm) + '"></div></div>' +
        '<span class="hint" style="font-size:12px;color:var(--muted)">' + (a.lastOdo ? 'הקילומטרז׳ האחרון שנרשם בתדלוק: ' + fmt(a.lastOdo) : 'התזכורת מחושבת לפי הקילומטרז׳ שרושמים בתדלוקים.') + '</span></div>' +
        '<p class="fine" style="margin:0 4px">על טסט וביטוח תגיע התראה שבועיים לפני ויום לפני, בשעה 9:00.</p>' +
        '<button type="button" class="btn" data-action="save-reminders">' + icon('check') + 'שמור תזכורות</button>';
    }
  };

  // ---------- Offline data ----------
  SHEETS.offline = {
    title: () => 'נתונים במכשיר',
    render: () => {
      const d = MC.data, f = d.fuel;
      const on = MC.online();
      return '<span class="netline ' + (on ? 'on' : 'off') + '"><span class="led"></span>' + (on ? 'מחובר לאינטרנט' : 'אין חיבור לאינטרנט') + '</span>' +
        '<p style="margin:0;font-size:14px;color:var(--muted)">החישובים, הנסיעות, התדלוקים והנתונים עובדים גם בלי אינטרנט. כשיש חיבור, האפליקציה מורידה לבד מחירי דלק ומרחקי כבישים עדכניים ומחשבת מסלולים מדויקים, ושומרת אותם בטלפון לפעם הבאה.</p>' +
        '<div class="card tight">' +
        '<div class="row"><span class="tile">' + icon('city') + '</span><span class="grow"><span class="t">' + fmt(d.places.length) + ' יישובים</span><span class="s">חיפוש יישוב ומיקום בלי אינטרנט</span></span></div>' +
        '<div class="row"><span class="tile">' + icon('road') + '</span><span class="grow"><span class="t">מרחקי כבישים</span><span class="s">' + (d.roads ? fmt(d.hubs.length) + ' ערים מרכזיות · עודכן ' + MC.dateFull(Date.parse(d.roads.generated)) : 'יורדו בחיבור הבא') + '</span></span></div>' +
        '<div class="row"><span class="tile green">' + icon('fuel') + '</span><span class="grow"><span class="t">מחיר דלק ' + (f ? money(f.price95) : '') + '</span><span class="s">' + (f ? esc(MC.monthLabel(f.month)) + ' · ' + esc(f.source || '') : '') + '</span></span></div>' +
        '<div class="row"><span class="tile orange">' + icon('route') + '</span><span class="grow"><span class="t">' + fmt(Math.round(MC.cachedRoutes())) + ' מסלולים שמורים</span><span class="s">מסלולים מדויקים שחושבו, זמינים גם בלי אינטרנט</span></span></div></div>' +
        '<button type="button" class="btn" data-action="sync-now"' + (on ? '' : ' disabled') + '>' + icon('refresh') + 'עדכן עכשיו</button>' +
        (MC.state.lastSync ? '<p class="fine" style="margin:0;text-align:center">בדיקה אחרונה: ' + esc(MC.dayLabel(MC.state.lastSync)) + ' ' + MC.time(MC.state.lastSync) + '</p>' : '');
    }
  };

  // ---------- Backup ----------
  SHEETS.backup = {
    title: () => 'גיבוי ושחזור',
    render: () => {
      const s = MC.state;
      return '<p style="margin:0;font-size:14px;color:var(--muted)">כל הנתונים שלך נשמרים רק בטלפון. מומלץ לשמור גיבוי מדי פעם (למשל בגוגל דרייב או בוואטסאפ לעצמך).</p>' +
        '<div class="notice gray">' + icon('info', 'sm') + '<span class="grow">' + s.trips.length + ' נסיעות · ' + s.fuel.length + ' תדלוקים · ' + s.cars.length + ' רכבים</span></div>' +
        '<button type="button" class="btn" data-action="export-backup">' + icon('download') + 'שמירת גיבוי</button>' +
        '<button type="button" class="btn secondary" data-action="import-backup">' + icon('upload') + 'שחזור מגיבוי</button>' +
        '<button type="button" class="btn secondary" data-action="export-csv">' + icon('chart') + 'ייצוא לאקסל (נסיעות ותדלוקים)</button>';
    }
  };
  SHEETS.importConfirm = {
    title: () => 'שחזור מגיבוי',
    render: (d) => '<div class="notice orange"><span class="grow">השחזור יחליף את כל הנתונים שבאפליקציה כרגע בנתונים מהגיבוי (' + (d.trips || 0) + ' נסיעות, ' + (d.fuel || 0) + ' תדלוקים).</span></div>' +
      '<button type="button" class="btn" data-action="confirm-import">' + icon('check') + 'כן, לשחזר</button>' +
      '<button type="button" class="btn secondary" data-action="close-sheet">ביטול</button>'
  };

  // ---------- Feedback ----------
  SHEETS.feedback = {
    full: true,
    title: () => 'פנייה / הצעת ייעול',
    init: () => { const p = MC.state.profile; ui.form = { type: 'idea', name: p.name, email: p.email, message: '', err: {} }; },
    render: () => {
      const f = ui.form, e = f.err || {};
      const box = MC.state.outbox.slice().reverse();
      let h = '<p style="margin:0;font-size:14px;color:var(--muted)">יש לך רעיון מה להוסיף? משהו לא עובד? כתוב כאן והפנייה תגיע ישירות למפתח.</p>' +
        V.seg('form-set', [{ v: 'idea', label: 'הצעת ייעול' }, { v: 'bug', label: 'תקלה' }, { v: 'other', label: 'אחר' }], f.type, 'small').replace(/data-action="form-set"/g, 'data-action="form-set" data-k="type"') +
        '<div class="field"><label for="fbn">שם מלא *</label><input id="fbn" class="input" autocomplete="name" data-f="name" value="' + esc(f.name) + '" aria-required="true">' + (e.name ? '<span class="hint bad">' + e.name + '</span>' : '') + '</div>' +
        '<div class="field"><label for="fbe">אימייל *</label><input id="fbe" class="input ltr" style="text-align:left" type="email" inputmode="email" autocomplete="email" data-f="email" value="' + esc(f.email) + '" aria-required="true">' + (e.email ? '<span class="hint bad">' + e.email + '</span>' : '<span class="hint">כדי שנוכל לחזור אליך</span>') + '</div>' +
        '<div class="field"><label for="fbm">מה תרצה להגיד? *</label><textarea id="fbm" class="input" data-f="message" aria-required="true" placeholder="למשל: הייתי רוצה שהאפליקציה תזכיר לי לבדוק לחץ אוויר">' + esc(f.message) + '</textarea>' + (e.message ? '<span class="hint bad">' + e.message + '</span>' : '') + '</div>' +
        '<button type="button" class="btn" data-action="send-feedback"' + (flushing ? ' aria-disabled="true"' : '') + '>' + icon('message') + (flushing ? 'שולח…' : 'שליחת הפנייה') + '</button>' +
        (MC.online() ? '' : '<p class="fine" style="margin:0;text-align:center">אין חיבור כרגע. הפנייה תישמר ותישלח לבד כשיחזור האינטרנט.</p>');
      if (box.length) {
        h += '<span class="section-label">הפניות שלי</span>';
        box.slice(0, 6).forEach((m) => {
          const st = m.status === 'sent' ? { c: 'green', i: 'check', t: 'נשלחה ' + MC.time(m.sentAt || m.ts) }
            : m.status === 'failed' ? { c: 'orange', i: 'alert', t: 'עוד לא נשלחה' + (m.error ? ': ' + m.error : '') }
            : MC.online() ? { c: 'orange', i: 'clock', t: 'בשליחה…' } : { c: 'orange', i: 'clock', t: 'תישלח כשיחזור האינטרנט' };
          h += '<div class="list-item"><span class="tile ' + st.c + '">' + icon(st.i) + '</span><span class="grow"><span class="t" style="font-size:14px">' + esc(String(m.message).slice(0, 60)) + (m.message.length > 60 ? '…' : '') + '</span><span class="s">' + esc(MC.dayLabel(m.ts)) + ' · ' + esc(st.t) + '</span></span></div>';
        });
        if (box.some((m) => m.status !== 'sent') && MC.online() && !flushing) h += '<button type="button" class="btn secondary" data-action="feedback-retry">' + icon('refresh') + 'לנסות לשלוח שוב</button>';
      }
      return h;
    }
  };

  // ---------- About ----------
  SHEETS.about = {
    title: () => 'אודות',
    render: () => '<div class="about-head"><img src="icon-512.png" alt=""><h2>MyCar</h2><span class="slogan">עד הטיפה האחרונה</span><span class="ver">גרסה ' + esc(MC.VERSION.version) + (MC.VERSION.build && MC.VERSION.build !== 'dev' ? ' (בנייה ' + esc(MC.VERSION.build) + ')' : '') + '</span></div>' +
      '<p class="credit" style="font-size:15px">פותח על ידי <b>Itzko</b></p>' +
      '<div class="card tight">' +
      '<div class="row"><span class="tile">' + icon('gauge') + '</span><span class="grow"><span class="t">מחשבון נסיעה</span><span class="s">ק״מ, ליטרים ועלות לפי הרכב, עירוני ובין-עירוני</span></span></div>' +
      '<div class="row"><span class="tile orange">' + icon('fuel') + '</span><span class="grow"><span class="t">יומן תדלוקים</span><span class="s">צריכה אמיתית, ק״מ לכל תדלוק ועלות לק״מ</span></span></div>' +
      '<div class="row"><span class="tile green">' + icon('offline') + '</span><span class="grow"><span class="t">עובד בלי אינטרנט</span><span class="s">הנתונים נשמרים רק בטלפון שלך</span></span></div></div>' +
      '<p class="fine">רשימת היישובים: הלשכה המרכזית לסטטיסטיקה. מסלולים וכתובות: OSRM ו-Nominatim, נתוני מפה © OpenStreetMap contributors. מחיר הדלק: מינהל הדלק והגז, משרד האנרגיה. המחירים והמרחקים הם הערכה, וייתכנו הבדלים מהמציאות.</p>' +
      updateBlock() +
      '<button type="button" class="btn secondary" data-action="share-app">' + icon('share') + 'שיתוף האפליקציה עם חברים</button>' +
      '<button type="button" class="btn secondary" data-action="open-sheet" data-sheet="feedback">' + icon('message') + 'פנייה / הצעת ייעול</button>'
  };
  function updateBlock() {
    const U = MC.update;
    if (!MC.canSelfUpdate()) return '';
    if (U.info) return '<button type="button" class="notice blue" style="border:0;text-align:right" data-action="open-sheet" data-sheet="update">' + icon('sparkle', 'sm') + '<span class="grow">יש גרסה חדשה: ' + esc(U.info.version) + ' (בנייה ' + U.info.build + ')</span><span style="font-weight:700">לעדכון</span></button>';
    return '<button type="button" class="btn secondary" data-action="check-update"' + (U.state === 'checking' ? ' aria-disabled="true"' : '') + '>' + icon('refresh') + (U.state === 'checking' ? 'בודק…' : 'בדיקת עדכונים') + '</button>';
  }

  // ---------- New version ----------
  SHEETS.update = {
    title: () => 'גרסה חדשה',
    render: () => {
      const U = MC.update, i = U.info;
      const mine = 'אצלך: ' + esc(MC.VERSION.version) + ' (בנייה ' + esc(MC.VERSION.build) + ')';
      if (!i) {
        return '<div class="about-head"><img src="icon-512.png" alt=""><h2>MyCar</h2><span class="ver">' + mine + '</span></div>' +
          '<div class="notice green">' + icon('check', 'sm') + '<span class="grow">יש לך את הגרסה האחרונה.</span></div>' +
          '<button type="button" class="btn secondary" data-action="close-sheet">סגירה</button>';
      }
      let h = '<div class="about-head"><img src="icon-512.png" alt=""><h2>MyCar ' + esc(i.version) + '</h2><span class="ver">בנייה ' + i.build + ' · ' + mine + '</span></div>';
      if (i.notes.length) h += '<div class="card"><span class="section-label" style="margin:0 0 8px">מה חדש</span><ul class="note-list">' + i.notes.map((n) => '<li>' + esc(n) + '</li>').join('') + '</ul></div>';
      if (U.state === 'downloading' || U.state === 'applying') {
        h += '<div class="field"><span class="label">' + (U.state === 'applying' ? 'מתקין… האפליקציה תיפתח מחדש' : 'מוריד את העדכון… ' + Math.round(U.progress) + '%') + '</span><div class="progress"><span style="width:' + (U.state === 'applying' ? 100 : Math.max(4, U.progress)) + '%"></span></div></div>';
      } else if (i.inApp) {
        h += '<button type="button" class="btn" data-action="update-now">' + icon('download') + 'עדכון עכשיו</button>' +
          '<p class="fine" style="margin:0;text-align:center">העדכון נכנס בתוך האפליקציה, בלי להתקין קובץ. כל הנתונים שלך נשארים.</p>';
      } else {
        h += '<a class="btn" href="' + esc(MC.APK_URL) + '" target="_blank" rel="noopener">' + icon('download') + 'הורדת הגרסה החדשה</a>' +
          '<p class="fine" style="margin:0;text-align:center">הגרסה הזו כוללת שינוי במנוע של האפליקציה, ולכן מתקינים אותה פעם אחת מעל הקיימת. כל הנתונים נשמרים.</p>';
      }
      if (U.error) h += '<div class="notice orange">' + icon('alert', 'sm') + '<span class="grow">' + esc(U.error) + '</span></div>';
      if (U.state !== 'applying') h += '<button type="button" class="btn secondary" data-action="update-later">אחר כך</button>';
      return h;
    }
  };

  // ---------- Share chooser ----------
  SHEETS.share = {
    title: () => 'שיתוף',
    render: () => '<button type="button" class="btn" data-action="share-image">' + icon('image') + 'שיתוף כתמונה</button>' +
      '<button type="button" class="btn secondary" data-action="share-text">' + icon('message') + 'שיתוף כטקסט</button>'
  };

  // ================= Feedback sending =================
  // Sent to the developer's own Google Apps Script, which e-mails only the developer.
  // The developer's address is not in the app; the sender gets a reply only if the developer answers.
  let flushing = false;
  const FEEDBACK_ERRORS = { 'rate-limit': 'יותר מדי פניות כרגע, ננסה שוב מאוחר יותר', invalid: 'חסר שם, מייל או תוכן', 'bad-key': 'השרת דחה את הפנייה', server: 'תקלה זמנית בשרת' };
  async function flushOutbox() {
    if (flushing || !MC.online() || !MC.FEEDBACK_URL) return 0;
    const pending = MC.state.outbox.filter((m) => m.status !== 'sent');
    if (!pending.length) return 0;
    flushing = true;
    if (ui.sheet && ui.sheet.name === 'feedback') renderSheet();
    let sent = 0;
    try {
      for (const m of pending) {
        const body = {
          key: MC.FEEDBACK_KEY, name: m.name, email: m.email, type: m.type, message: m.message,
          when: MC.dateFull(m.ts) + ' ' + MC.time(m.ts),
          version: MC.VERSION.version + ' (בנייה ' + MC.VERSION.build + ')',
          device: MC.isNative() ? 'אנדרואיד' : 'דפדפן'
        };
        m.tries = (m.tries || 0) + 1;
        try {
          const r = await MC.http(MC.FEEDBACK_URL, { method: 'POST', data: body, plain: true, timeout: 30000 });
          let d = r.data;
          if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
          d = d && typeof d === 'object' ? d : {};
          if ((r.ok && d.ok === true) || r.status === 302 || r.status === 303) {
            m.status = 'sent'; m.sentAt = Date.now(); delete m.error; delete m.detail; sent++;
          } else {
            m.status = 'failed';
            m.error = FEEDBACK_ERRORS[d.error] || 'השרת לא קיבל אותה' + (r.status && !r.ok ? ' (' + r.status + ')' : '');
            m.detail = String(d.error || r.status || '').slice(0, 100);
            console.warn('feedback', r.status, d.error);
            if (d.error === 'rate-limit') break;
          }
        } catch (e) {
          m.status = 'failed'; m.error = 'אין תשובה מהשרת'; m.detail = String(e && e.message || e).slice(0, 200);
          console.warn('feedback send', m.detail);
          break;
        }
      }
    } finally {
      flushing = false;
      save();
      if (ui.sheet && ui.sheet.name === 'feedback') renderSheet();
    }
    return sent;
  }

  // ================= Files =================
  async function shareFile(name, content, mime, title) {
    if (MC.isNative()) {
      const w = await MC.call('Filesystem', 'writeFile', { path: name, data: content, directory: 'CACHE', encoding: 'utf8' });
      if (w && w.uri) {
        try { await MC.callRaw('Share', 'share', { title, files: [w.uri], dialogTitle: title }); return true; } catch (e) {
          try { await MC.callRaw('Share', 'share', { title, url: w.uri, dialogTitle: title }); return true; } catch (e2) { /* cancelled */ }
        }
      }
      return false;
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  }
  async function shareText(text) {
    if (MC.isNative()) { try { await MC.callRaw('Share', 'share', { text, dialogTitle: 'שיתוף' }); return; } catch (e) { /* cancelled */ } return; }
    if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { return; } }
    try { await navigator.clipboard.writeText(text); toast('הועתק ללוח'); } catch (e) { toast(text, 5000); }
  }
  const csvCell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function csv(rows) { return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'); }
  async function exportCsv() {
    const s = MC.state;
    const carName = (id) => { const c = MC.carById(id); return c ? c.name : ''; };
    const trips = [['תאריך', 'שעה', 'מסלול', 'ק״מ', 'מתוכם עירוני', 'ליטרים', 'עלות ₪', 'מחיר לליטר', 'הלוך-חזור', 'נוסעים', 'סוג', 'רכב']]
      .concat(s.trips.slice().sort((a, b) => a.ts - b.ts).map((t) => [MC.dateFull(t.ts), MC.time(t.ts), t.title, t.km.toFixed(1), (t.urbanKm || 0).toFixed(1), t.liters.toFixed(2), t.cost.toFixed(2), (t.price || 0).toFixed(2), t.roundTrip ? 'כן' : '', t.passengers || 1, t.tag === 'work' ? 'עבודה' : t.tag === 'private' ? 'פרטי' : '', carName(t.carId)]));
    const fuelRows = [['תאריך', 'סכום ₪', 'מחיר לליטר', 'ליטרים', 'קילומטרז׳', 'מיכל מלא', 'ק״מ מהתדלוק הקודם', 'צריכה ק״מ/ל׳', 'תחנה', 'רכב']];
    s.cars.forEach((c) => {
      MC.analyzeFuel(c.id).rows.slice().reverse().forEach((r) => {
        fuelRows.push([MC.dateFull(r.f.ts), (r.f.amount || 0).toFixed(2), (r.f.price || 0).toFixed(2), r.liters.toFixed(2), r.f.odo || '', r.f.full ? 'כן' : 'לא', r.kmSince || '', r.cons ? r.cons.toFixed(1) : '', r.f.station || '', c.name]);
      });
    });
    const stamp = MC.dateInput(Date.now());
    const ok1 = await shareFile('MyCar-נסיעות-' + stamp + '.csv', csv(trips), 'text/csv', 'ייצוא נסיעות');
    if (ok1) await shareFile('MyCar-תדלוקים-' + stamp + '.csv', csv(fuelRows), 'text/csv', 'ייצוא תדלוקים');
  }

  // ================= Actions =================
  const A = {};
  A.tab = (el) => { ui.tab = el.dataset.tab; ui.view = null; closeSheet(); render(); };
  A['open-sheet'] = (el) => openSheet(el.dataset.sheet);
  A['close-sheet'] = () => closeSheet();

  // calculator
  A['pick-place'] = (el) => openSheet('picker', { which: el.dataset.which });
  A['use-gps'] = async (el) => { const p = await gpsPlace(); if (p) { ui.calc[el.dataset.which || 'from'] = p; persistCalc(); render(true); } };
  A['picker-gps'] = async () => { const p = await gpsPlace(); if (p) choosePlace(p); };
  A['picker-remote'] = async () => {
    const p = ui.picker; if (!p || !p.q.trim()) return;
    p.remoteState = 'loading'; refreshPicker();
    try { p.remote = await MC.searchAddress(p.q.trim()); p.remoteState = 'done'; } catch (e) { p.remoteState = 'error'; }
    refreshPicker();
  };
  A['picker-clear'] = () => { const i = $('#psearch'); if (i) { i.value = ''; i.focus(); } const w = $('#pwrap'); if (w) w.classList.remove('has-q'); ui.picker.q = ''; ui.picker.remote = []; ui.picker.remoteState = ''; refreshPicker(); };
  A['choose-place'] = (el) => { const pl = ui.pickerItems[+el.dataset.i]; if (pl) choosePlace(pl); };
  A.swap = () => { const c = ui.calc; const t = c.from; c.from = c.to; c.to = t; persistCalc(); haptic(); render(true); };
  A['toggle-round'] = () => { ui.calc.roundTrip = !ui.calc.roundTrip; persistCalc(); render(true); };
  A.pax = (el) => { ui.calc.passengers = MC.clamp(ui.calc.passengers + (+el.dataset.d), 1, 8); persistCalc(); render(true); };
  A['toggle-manual'] = () => { ui.calc.manual = !ui.calc.manual; render(true); };
  A['use-route'] = (el) => {
    const r = MC.state.routes.find((x) => x.id === el.dataset.id); if (!r) return;
    Object.assign(ui.calc, { from: r.from, to: r.to, roundTrip: r.round, manual: false });
    persistCalc(); A.calculate();
  };
  A['save-route'] = () => {
    const c = ui.calc;
    if (!c.from || !c.to) { toast('קודם בוחרים מוצא ויעד'); return; }
    const exists = MC.state.routes.some((r) => r.from.name === c.from.name && r.to.name === c.to.name && r.round === c.roundTrip);
    if (exists) { toast('המסלול כבר שמור'); return; }
    MC.state.routes.unshift({ id: MC.uid(), from: c.from, to: c.to, round: c.roundTrip });
    MC.state.routes = MC.state.routes.slice(0, 20);
    save(); toast('המסלול נשמר'); render(true);
  };
  A.calculate = async () => {
    if (ui.busy) return;
    const c = ui.calc, car = MC.activeCar();
    let route, title, from = null, to = null;
    if (c.manual) {
      const k = MC.num(c.manualKm);
      if (!(k > 0)) { toast('כמה קילומטרים?'); return; }
      route = { km: k, urbanKm: k * MC.clamp(+c.manualUrbanPct, 0, 100) / 100, min: 0, source: 'manual' };
      title = (c.manualTitle || '').trim() || 'נסיעה של ' + km(k) + ' ק״מ';
    } else {
      if (!c.from || !c.to) { toast(!c.from ? 'מאיפה יוצאים?' : 'לאן נוסעים?'); return; }
      ui.busy = true;
      const btn = $('[data-action="calculate"]');
      if (btn) btn.innerHTML = icon('gauge') + (MC.online() ? 'מחשב מסלול…' : 'מחשב…');
      try { route = await MC.getRoute(c.from, c.to); } finally { ui.busy = false; }
      if (!route || route.km < 0.3) { toast('המוצא והיעד כמעט באותו מקום'); render(true); return; }
      from = c.from; to = c.to;
      title = c.from.name + ' ← ' + c.to.name;
    }
    ui.result = { title, from, to, route, roundTrip: c.roundTrip, passengers: c.passengers, carId: car.id, urbanPct: c.manual ? +c.manualUrbanPct : null, tag: MC.state.settings.lastTag || '', savedId: null };
    ui.view = 'result';
    haptic();
    render();
  };
  A['close-result'] = () => { ui.view = null; render(); };
  A['result-tag'] = (el) => { const r = ui.result; r.tag = r.tag === el.dataset.v ? '' : el.dataset.v; render(true); };
  A['save-trip'] = () => {
    const r = ui.result; if (!r || r.savedId) return;
    const x = r.calc || MC.calcTrip({ route: r.route, car: MC.carById(r.carId), roundTrip: r.roundTrip, passengers: r.passengers, urbanPct: r.urbanPct });
    const slim = (p) => (p ? { name: p.name, sub: p.sub || '', lat: p.lat, lon: p.lon, kind: p.kind } : null);
    const t = { id: MC.uid(), ts: Date.now(), carId: r.carId, title: r.title, from: slim(r.from), to: slim(r.to), km: x.km, urbanKm: x.urbanKm, liters: x.liters, cost: x.cost, price: x.price, roundTrip: r.roundTrip, passengers: x.pax, tag: r.tag || '', source: r.route.source, min: x.min };
    MC.state.trips.unshift(t);
    MC.state.settings.lastTag = r.tag || '';
    r.savedId = t.id;
    save(); haptic(); toast('הנסיעה נשמרה'); render(true);
  };
  function tripText(t) {
    const lines = [t.title, km(t.km) + ' ק״מ · ' + fmt(t.liters, 1) + ' ליטר' + (t.roundTrip ? ' · הלוך-חזור' : ''), 'עלות דלק: ' + money(t.cost)];
    if (t.passengers > 1) lines.push('לכל נוסע (' + t.passengers + '): ' + money(t.cost / t.passengers));
    lines.push('', 'חושב ב-MyCar · עד הטיפה האחרונה');
    return lines.join('\n');
  }
  A['share-result'] = () => { const r = ui.result; if (!r || !r.calc) return; openSheet('share', { kind: 'result' }); };
  function shareTarget(d) {
    if (d.kind === 'trip') return MC.state.trips.find((x) => x.id === d.id) || null;
    const r = ui.result;
    return r && r.calc ? { title: r.title, km: r.calc.km, liters: r.calc.liters, cost: r.calc.cost, passengers: r.calc.pax, roundTrip: r.roundTrip } : null;
  }
  // The parts of the screen that go into the picture (buttons and the slider stay out).
  function snapNodes(d) {
    const out = [];
    const clean = (n) => { n.querySelectorAll('button.round-btn, input, .field, [data-action="open-sheet"] > span:last-child').forEach((x) => x.remove()); return n; };
    if (d.kind === 'trip') {
      const t = MC.state.trips.find((x) => x.id === d.id);
      if (!t) return out;
      const head = document.createElement('div');
      head.className = 'bar-top';
      head.innerHTML = '<div class="titles"><span class="kicker">' + esc(MC.dateFull(t.ts)) + (t.roundTrip ? ' · הלוך-חזור' : '') + '</span><h1>' + esc(t.title) + '</h1></div>';
      out.push(head);
      const tmp = document.createElement('div');
      tmp.innerHTML = SHEETS.trip.render({ id: d.id });
      ['.hero', '.card'].forEach((sel) => { const n = tmp.querySelector(sel); if (n) out.push(clean(n)); });
      return out;
    }
    const main = $('#screen');
    ['.bar-top', '.hero', '.card', '.grid2', 'button.notice'].forEach((sel) => { const n = main.querySelector(sel); if (n) out.push(clean(n.cloneNode(true))); });
    return out;
  }
  A['share-text'] = () => { const d = ui.sheet && ui.sheet.data; const t = d && shareTarget(d); closeSheet(); if (t) shareText(tripText(t)); };
  A['share-image'] = async (el) => {
    const d = ui.sheet && ui.sheet.data;
    if (!d || ui.snapping) return;
    ui.snapping = true;
    el.innerHTML = icon('image') + 'מכין תמונה…';
    el.setAttribute('aria-disabled', 'true');
    try {
      const png = await MC.snap(snapNodes(d));
      closeSheet();
      await MC.shareImage(png, 'MyCar-' + MC.dateInput(Date.now()) + '-' + Date.now().toString(36).slice(-4) + '.png', 'שיתוף נסיעה');
    } catch (e) {
      console.warn('share image', e && e.message);
      toast('לא הצלחתי ליצור תמונה. אפשר לשתף כטקסט.');
      if (ui.sheet && ui.sheet.name === 'share') renderSheet();
    } finally { ui.snapping = false; }
  };
  A['share-app'] = () => shareText('MyCar – עד הטיפה האחרונה\nכמה עולה כל נסיעה, יומן נסיעות ותדלוקים, עובד גם בלי אינטרנט.\n\nלהורדה לאנדרואיד:\n' + MC.APK_URL);
  A['check-update'] = async () => {
    const i = await MC.update.check(true);
    if (i) openSheet('update'); else toast(MC.update.error || 'יש לך את הגרסה האחרונה');
  };
  A['update-now'] = () => MC.update.apply();
  A['update-later'] = () => { if (MC.update.info) { MC.state.updateSeen = MC.update.info.build; save(); } closeSheet(); };
  A['open-price'] = () => openSheet('price');
  A['set-price-mode'] = (el) => {
    MC.state.settings.priceMode = el.dataset.v;
    if (el.dataset.v === 'manual' && !MC.state.settings.manualPrice) { const o = MC.officialPrice(); MC.state.settings.manualPrice = o ? +o.price.toFixed(2) : 8.27; }
    if (el.dataset.v === 'last' && !MC.lastRefuel(MC.activeCar().id)) toast('עוד אין תדלוק רשום. בינתיים נשתמש במחיר המפוקח.');
    save(); rerenderAll();
  };
  A['toggle-fullservice'] = () => { MC.state.settings.fullService = !MC.state.settings.fullService; save(); rerenderAll(); };
  function rerenderAll() { render(true); if (ui.sheet) renderSheet(); }
  A['service-done'] = () => { const a = MC.analyzeFuel(MC.activeCar().id); if (a.lastOdo) { MC.state.reminders.service.lastKm = a.lastOdo; save(); toast('מעולה! הטיפול הבא בעוד ' + fmt(MC.state.reminders.service.every) + ' ק״מ'); render(true); } };

  // trips
  A['trips-month'] = (el) => { const [y, m] = ui.tripsMonth.split('-').map(Number); ui.tripsMonth = MC.monthKey(new Date(y, m - 1 + (+el.dataset.d), 1)); render(true); };
  A['trips-filter'] = (el) => { ui.tripsFilter = el.dataset.v; render(true); };
  A['open-trip'] = (el) => openSheet('trip', { id: el.dataset.id });
  A['trip-tag'] = (el) => { const t = MC.state.trips.find((x) => x.id === ui.sheet.data.id); if (t) { t.tag = el.dataset.v; save(); renderSheet(); render(true); } };
  A['trip-share'] = () => { const id = ui.sheet.data.id; if (MC.state.trips.some((x) => x.id === id)) openSheet('share', { kind: 'trip', id }); };
  A['trip-again'] = () => {
    const t = MC.state.trips.find((x) => x.id === ui.sheet.data.id); if (!t || !t.from || !t.to) return;
    Object.assign(ui.calc, { from: t.from, to: t.to, roundTrip: t.roundTrip, passengers: t.passengers || 1, manual: false });
    closeSheet(); ui.tab = 'calc'; persistCalc(); A.calculate();
  };
  A['delete-trip'] = () => {
    if (ui.confirm !== 'trip') { ui.confirm = 'trip'; renderSheet(); return; }
    MC.state.trips = MC.state.trips.filter((x) => x.id !== ui.sheet.data.id);
    save(); closeSheet(); toast('הנסיעה נמחקה'); render(true);
  };
  A['export-csv'] = () => exportCsv();

  // fuel
  A['new-fuel'] = () => openSheet('fuel', {});
  A['edit-fuel'] = (el) => openSheet('fuel', { id: el.dataset.id });
  A['fuel-quick'] = (el) => { ui.form.amount = el.dataset.v; const i = $('#famt'); if (i) i.value = el.dataset.v; updateFuelLive(); };
  A['fuel-mode'] = () => { const l = fuelCalc(); ui.form.litersMode = !ui.form.litersMode; if (ui.form.litersMode && l.liters > 0) ui.form.liters = l.liters.toFixed(2); if (!ui.form.litersMode && l.amount > 0) ui.form.amount = l.amount.toFixed(2); renderSheet(); };
  A['save-fuel'] = () => {
    const f = ui.form, x = fuelCalc();
    if (!(x.price > 0 && x.price < 30)) { toast('בדוק את המחיר לליטר'); return; }
    if (!(x.amount > 0) || !(x.liters > 0)) { toast(f.litersMode ? 'כמה ליטרים תדלקת?' : 'כמה שילמת?'); return; }
    if (x.odo > 0 && x.prevOdo && x.odo <= x.prevOdo) { toast('הקילומטרז׳ צריך להיות גבוה מבתדלוק הקודם'); return; }
    const entry = { id: f.id || MC.uid(), carId: f.carId, ts: x.draft.ts, amount: +x.amount.toFixed(2), price: +x.price.toFixed(3), liters: +x.liters.toFixed(3), litersMode: !!f.litersMode, odo: x.odo > 0 ? Math.round(x.odo) : 0, full: !!f.full, station: String(f.station || '').trim().slice(0, 40) };
    const i = MC.state.fuel.findIndex((y) => y.id === entry.id);
    if (i >= 0) MC.state.fuel[i] = entry; else MC.state.fuel.push(entry);
    save(); haptic(); closeSheet();
    const svc = serviceDue();
    toast(svc && svc.left <= 0 ? 'התדלוק נשמר. שים לב: הגיע הזמן לטיפול' : x.row && x.row.cons ? 'נשמר · ' + fmt(x.row.cons, 1) + ' ק״מ לליטר' : 'התדלוק נשמר');
    render(true);
  };
  A['delete-fuel'] = () => {
    if (ui.confirm !== 'fuel') { ui.confirm = 'fuel'; renderSheet(); return; }
    MC.state.fuel = MC.state.fuel.filter((x) => x.id !== ui.form.id);
    save(); closeSheet(); toast('התדלוק נמחק'); render(true);
  };
  A['apply-real'] = () => {
    const car = MC.activeCar(), a = MC.analyzeFuel(car.id);
    if (!a.avg) return;
    const k = a.avg / MC.mixKmpl(car);
    car.urban = +(car.urban * k).toFixed(1); car.inter = +(car.inter * k).toFixed(1);
    save(); toast('עודכן: ' + fmt(car.urban, 1) + ' בעיר, ' + fmt(car.inter, 1) + ' בין-עירוני'); render(true);
  };

  // stats
  A['stats-mode'] = (el) => { ui.statsMode = el.dataset.v; render(true); };
  A['stats-nav'] = (el) => { const d = new Date(ui.statsRef); const k = +el.dataset.d; ui.statsRef = (ui.statsMode === 'year' ? new Date(d.getFullYear() + k, d.getMonth(), 1) : new Date(d.getFullYear(), d.getMonth() + k, 1)).getTime(); render(true); };

  // settings & cars
  A['set-theme'] = (el) => { MC.state.settings.theme = el.dataset.v; save(); applyTheme(); render(true); };
  A['toggle-learn'] = (el) => { const c = MC.carById(el.dataset.id); if (c) { c.learn = !c.learn; save(); render(true); } };
  A['set-car'] = (el) => { MC.state.settings.activeCarId = el.dataset.id; save(); closeSheet(); toast('נבחר: ' + MC.activeCar().name); render(true); };
  A['edit-car'] = (el) => openSheet('car', { id: el.dataset.id || '' });
  A['car-preset'] = (el) => {
    const p = PRESETS.find((x) => x.id === el.dataset.v); if (!p) return;
    Object.assign(ui.form, { preset: p.id, urban: p.urban, inter: p.inter, tank: p.tank });
    if (p.fuelType) ui.form.fuelType = p.fuelType; else if (ui.form.fuelType === 'diesel') ui.form.fuelType = '95';
    renderSheet();
  };
  A['form-set'] = (el) => { ui.form[el.dataset.k] = el.dataset.v; renderSheet(); };
  A['form-toggle'] = (el) => { const k = el.dataset.k; ui.form[k] = !ui.form[k]; el.setAttribute('aria-checked', ui.form[k] ? 'true' : 'false'); if (ui.sheet && ui.sheet.name === 'fuel') updateFuelLive(); };
  A['save-car'] = () => {
    const v = readCarForm(); if (!v) return;
    const id = ui.form.id;
    if (id) { Object.assign(MC.carById(id), v); }
    else { const c = newCar(v); MC.state.cars.push(c); MC.state.settings.activeCarId = c.id; }
    save(); closeSheet(); toast('הרכב נשמר'); render(true);
  };
  A['delete-car'] = () => {
    if (ui.confirm !== 'car') { ui.confirm = 'car'; renderSheet(); return; }
    const id = ui.form.id;
    MC.state.cars = MC.state.cars.filter((c) => c.id !== id);
    MC.state.trips = MC.state.trips.filter((t) => t.carId !== id);
    MC.state.fuel = MC.state.fuel.filter((f) => f.carId !== id);
    if (MC.state.settings.activeCarId === id) MC.state.settings.activeCarId = MC.state.cars[0].id;
    save(); closeSheet(); toast('הרכב נמחק'); render(true);
  };
  A['finish-onboarding'] = () => {
    const v = readCarForm(); if (!v) return;
    if (!ui.form.name.trim()) v.name = 'הרכב שלי';
    Object.assign(MC.state.cars[0], v);
    MC.state.settings.activeCarId = MC.state.cars[0].id;
    MC.state.onboarded = true;
    save(true); ui.sheet = null; renderSheet(); render();
    toast('הכל מוכן. לאן נוסעים?');
  };
  A['add-place'] = () => openSheet('picker', { which: 'save' });
  A['save-place'] = () => {
    const pl = ui.sheet.data.place, f = ui.form;
    const label = f.label === 'other' ? '' : f.label;
    if (label) MC.state.places = MC.state.places.filter((p) => p.label !== label);
    MC.state.places.push({ id: MC.uid(), name: String(f.name || pl.name).trim().slice(0, 40) || pl.name, sub: pl.sub || '', lat: pl.lat, lon: pl.lon, kind: pl.kind, label });
    save(); toast('המקום נשמר'); openSheet('saved'); render(true);
  };
  A['delete-place'] = (el) => { MC.state.places = MC.state.places.filter((p) => p.id !== el.dataset.id); save(); renderSheet(); };
  A['delete-route'] = (el) => { MC.state.routes = MC.state.routes.filter((r) => r.id !== el.dataset.id); save(); renderSheet(); render(true); };
  A['save-reminders'] = () => {
    const f = ui.form, r = MC.state.reminders;
    if (f.testOn && !f.test) { toast('בחר תאריך לטסט'); return; }
    if (f.insOn && !f.ins) { toast('בחר תאריך לביטוח'); return; }
    r.test = { on: !!f.testOn, date: f.test || '' };
    r.insurance = { on: !!f.insOn, date: f.ins || '' };
    r.service = { on: !!f.svcOn, every: pos(f.every, 15000), lastKm: pos(f.lastKm, 0) };
    if (r.service.on && !r.service.lastKm) { const a = MC.analyzeFuel(MC.activeCar().id); if (a.lastOdo) r.service.lastKm = a.lastOdo; }
    save(); closeSheet(); scheduleReminders(); toast('התזכורות נשמרו'); render(true);
  };
  A['sync-now'] = async () => {
    if (!MC.online()) { toast('אין חיבור לאינטרנט'); return; }
    toast('בודק עדכונים…', 6000);
    const up = await MC.syncData(true);
    MC.state.lastSync = Date.now(); save();
    toast(up.length ? 'עודכן: ' + up.map((n) => ({ 'fuel.json': 'מחיר דלק', 'roads.json': 'מרחקי כבישים', 'localities.json': 'יישובים' }[n])).join(', ') : 'הכל כבר מעודכן');
    rerenderAll();
  };
  A['export-backup'] = async () => {
    const data = JSON.stringify({ app: 'MyCar', v: 1, exportedAt: new Date().toISOString(), version: MC.VERSION.version, state: MC.state }, null, 1);
    await shareFile('MyCar-גיבוי-' + MC.dateInput(Date.now()) + '.json', data, 'application/json', 'גיבוי MyCar');
  };
  A['import-backup'] = () => { const i = $('#import-file'); i.value = ''; i.click(); };
  A['confirm-import'] = () => {
    const d = ui.sheet.data;
    MC.state = normalize(d.raw);
    MC.state.onboarded = true;
    save(true); applyTheme(); closeSheet(); toast('הנתונים שוחזרו'); render();
  };
  function feedbackErrors(f) {
    const err = {};
    if (String(f.name || '').trim().length < 2) err.name = 'צריך לכתוב שם';
    if (!MC.isEmail(f.email)) err.email = 'צריך אימייל תקין';
    if (String(f.message || '').trim().length < 5) err.message = 'כתוב לפחות כמה מילים';
    return err;
  }
  A['feedback-retry'] = async () => {
    if (!MC.online()) { toast('אין חיבור כרגע'); return; }
    const n = await flushOutbox();
    toast(n ? 'נשלח. תודה!' : 'עדיין לא הצלחתי לשלוח. ננסה שוב לבד.');
  };
  A['send-feedback'] = async () => {
    if (flushing) return;
    const f = ui.form, err = feedbackErrors(f);
    f.err = err;
    if (Object.keys(err).length) { renderSheet(); return; }
    MC.state.profile = { name: f.name.trim(), email: f.email.trim() };
    MC.state.outbox.push({ id: MC.uid(), ts: Date.now(), type: f.type, name: f.name.trim(), email: f.email.trim(), message: f.message.trim(), status: 'pending' });
    MC.state.outbox = MC.state.outbox.slice(-30);
    save();
    f.message = ''; f.err = {};
    renderSheet();
    if (MC.online()) {
      toast('שולח…', 8000);
      const n = await flushOutbox();
      toast(n ? 'תודה! הפנייה נשלחה' : 'לא הצלחתי לשלוח כרגע. ננסה שוב לבד.');
    } else toast('נשמר. הפנייה תישלח כשיחזור האינטרנט');
  };

  // ================= Events =================
  function onClick(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const fn = A[el.dataset.action];
    if (!fn) return;
    if (el.tagName === 'A' && el.getAttribute('href')) return;
    e.preventDefault();
    if (el.getAttribute('aria-disabled') === 'true' && el.dataset.action !== 'calculate') return;
    fn(el, e);
  }
  function onInput(e) {
    const el = e.target;
    if (el.dataset.calc) {
      const k = el.dataset.calc;
      ui.calc[k] = el.value;
      if (k === 'manualUrbanPct') { const v = $('#murb-v'); if (v) v.textContent = el.value + '%'; }
      const btn = $('[data-action="calculate"]');
      if (btn) { const ready = ui.calc.manual ? MC.num(ui.calc.manualKm) > 0 : ui.calc.from && ui.calc.to; if (ready) btn.removeAttribute('aria-disabled'); else btn.setAttribute('aria-disabled', 'true'); }
      return;
    }
    if (el.dataset.result) { const v = $('#upct-v'); if (v) v.textContent = el.value + '%'; return; }
    if (el.dataset.setting) { const n = MC.num(el.value); if (n > 0 && n < 40) { MC.state.settings[el.dataset.setting] = n; save(); } return; }
    if (el.dataset.picker) { const w = $('#pwrap'); if (w) w.classList.toggle('has-q', !!el.value); ui.picker.q = el.value; ui.picker.remoteState = ''; ui.picker.remote = []; debouncedPicker(); return; }
    if (el.dataset.f) {
      ui.form[el.dataset.f] = el.value;
      if (ui.sheet && ui.sheet.name === 'fuel') updateFuelLive();
      if (ui.sheet && (ui.sheet.name === 'car' || ui.sheet.name === 'welcome') && (el.dataset.f === 'urban' || el.dataset.f === 'inter')) ui.form.preset = '';
    }
  }
  function onChange(e) {
    const el = e.target;
    if (el.dataset.result && ui.result) { ui.result.urbanPct = +el.value; render(true); return; }
    if (el.dataset.setting) { rerenderAll(); return; }
    if (el.id === 'import-file') {
      const file = el.files && el.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const d = JSON.parse(String(reader.result));
          if (!d || d.app !== 'MyCar' || !d.state) throw new Error('bad');
          openSheet('importConfirm', { raw: d.state, trips: (d.state.trips || []).length, fuel: (d.state.fuel || []).length });
        } catch (err) { toast('הקובץ הזה אינו גיבוי של MyCar'); }
      };
      reader.readAsText(file);
    }
  }
  function onKey(e) {
    if (e.key === 'Escape' && ui.sheet) closeSheet();
    if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.picker) { e.preventDefault(); A['picker-remote'](); }
  }
  function onBack() {
    if (ui.sheet) { if (!(SHEETS[ui.sheet.name].noClose && SHEETS[ui.sheet.name].noClose())) closeSheet(); return; }
    if (ui.view === 'result') { ui.view = null; render(); return; }
    if (ui.tab !== 'calc') { ui.tab = 'calc'; render(); return; }
    MC.call('App', 'exitApp');
  }

  // ================= Background sync =================
  async function backgroundSync() {
    if (!MC.online()) return;
    if (Date.now() - MC.state.lastSync < 3 * 3600e3) return;
    const before = MC.data.fuel ? MC.data.fuel.price95 : null;
    const up = await MC.syncData(false);
    MC.state.lastSync = Date.now(); save();
    if (up.includes('fuel.json') && MC.data.fuel && before !== MC.data.fuel.price95) toast('מחיר הדלק עודכן: ' + money(MC.data.fuel.price95) + ' לליטר', 4000);
    if (up.length && !ui.sheet) render(true);
  }

  // ================= Start =================
  async function init() {
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKey);
    let fitT = 0;
    window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => MC.fitText($('#screen')), 150); });
    await MC.initNetwork();
    MC.state = normalize(await MC.loadRaw());
    applyTheme();
    if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (MC.state.settings.theme === 'system') applyTheme(); }); } catch (e) { /* old webview */ } }
    await MC.loadData();
    await MC.loadRouteCache();
    const lc = MC.state.lastCalc;
    if (lc) Object.assign(ui.calc, { from: lc.from || null, to: lc.to || null, roundTrip: !!lc.roundTrip, passengers: MC.clamp(+lc.passengers || 1, 1, 8) });
    render();
    if (!MC.state.onboarded) openSheet('welcome');
    if (MC.isNative()) {
      MC.listen('App', 'backButton', onBack);
      MC.listen('App', 'appStateChange', (st) => { if (st && st.isActive) { backgroundSync(); flushOutbox(); autoUpdateCheck(); } });
    }
    MC.onUpdate(() => {
      if (ui.sheet && (ui.sheet.name === 'update' || ui.sheet.name === 'about')) renderSheet();
      else if (!ui.sheet && ui.tab === 'settings' && ui.view !== 'result') render(true);
    });
    MC.onNetwork((on) => {
      if (!ui.sheet) render(true); else if (ui.sheet.name === 'offline' || ui.sheet.name === 'feedback' || ui.sheet.name === 'picker') { if (ui.sheet.name === 'picker') refreshPicker(); else renderSheet(); }
      if (on) { backgroundSync(); flushOutbox(); autoUpdateCheck(); }
    });
    backgroundSync();
    flushOutbox();
    autoUpdateCheck();
  }
  // Looks for a new version when the app opens; shows it once per version.
  async function autoUpdateCheck() {
    const info = await MC.update.check(false);
    if (info && info.build > (MC.state.updateSeen || 0) && !ui.sheet && MC.state.onboarded) openSheet('update');
  }

  // Small test surface for automated checks.
  window.__mycar = { normalize, A, get ui() { return ui; }, render, openSheet, closeSheet, flushOutbox };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
