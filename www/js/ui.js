/* MyCar UI: screen and sheet templates (pure functions of MC.state + MC.ui). */
(function () {
  'use strict';
  const MC = window.MC;
  const { esc, icon, fmt, money, money0, km } = MC;
  const UI = (MC.views = {});

  const sw = (action, on, label, extra) =>
    '<button type="button" class="switch" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '" data-action="' + action + '"' + (extra || '') + '></button>';
  const seg = (action, items, cur, cls) =>
    '<div class="seg' + (cls ? ' ' + cls : '') + '" role="group">' + items.map((it) =>
      '<button type="button" data-action="' + action + '" data-v="' + esc(it.v) + '" aria-pressed="' + (String(it.v) === String(cur) ? 'true' : 'false') + '">' +
      (it.icon ? icon(it.icon, 'sm') : '') + '<span>' + esc(it.label) + (it.sub ? '<span class="sub">' + esc(it.sub) + '</span>' : '') + '</span></button>').join('') + '</div>';
  UI.sw = sw; UI.seg = seg;
  const kmpl = (v) => (isFinite(v) && v > 0 ? fmt(v, v < 100 ? 1 : 0) : '–');
  const placeName = (p) => (p ? p.name : '');
  MC.placeName = placeName;

  function activeCar() { return MC.activeCar(); }

  // ================= Calculator =================
  UI.calc = () => {
    const s = MC.state, c = MC.ui.calc, car = activeCar();
    const pr = MC.priceFor(car);
    let h = '';
    h += '<div class="top"><div class="titles"><span class="kicker">' + esc(MC.todayTitle()) + '</span><h1 class="h1">לאן נוסעים?</h1></div>' +
      '<button type="button" class="pill-btn" data-action="open-sheet" data-sheet="carPicker">' + icon('car') + '<span>' + esc(car.name) + '</span></button></div>';
    h += MC.reminderNotices();
    if (!MC.online()) h += '<div class="notice gray">' + icon('offline', 'sm') + '<span class="grow">אין חיבור לאינטרנט. החישוב יתבסס על הנתונים שבמכשיר.</span></div>';
    if (c.manual) {
      h += '<div class="card float"><div class="card-head"><h2 class="h2">מרחק ידני</h2><button type="button" class="chip sm" data-action="toggle-manual">בחירת מקומות</button></div>' +
        '<div class="grid2" style="margin-top:12px"><div class="field"><label for="mkm">כמה קילומטרים?</label><div class="input-wrap"><input id="mkm" class="input big num" inputmode="decimal" data-calc="manualKm" value="' + esc(c.manualKm) + '" placeholder="0"><span class="suffix">ק״מ</span></div></div>' +
        '<div class="field"><label for="mtitle">שם (לא חובה)</label><input id="mtitle" class="input" data-calc="manualTitle" value="' + esc(c.manualTitle || '') + '" placeholder="למשל: סידורים"></div></div>' +
        '<div class="field" style="margin-top:12px"><label for="murb">חלק עירוני: <b id="murb-v">' + c.manualUrbanPct + '%</b></label><input id="murb" type="range" min="0" max="100" step="5" value="' + c.manualUrbanPct + '" data-calc="manualUrbanPct"></div></div>';
    } else {
      h += '<div class="card float route"><div class="rail" aria-hidden="true"><span class="dot"></span><span class="road"></span><span class="pin">' + icon('pin') + '</span></div>' +
        '<div class="fields">' +
        '<button type="button" class="place-btn" data-action="pick-place" data-which="from"><span class="lbl">נקודת מוצא</span><span class="val' + (c.from ? '' : ' empty') + '">' + esc(c.from ? placeName(c.from) : 'בחר מאיפה יוצאים') + '</span></button>' +
        '<button type="button" class="place-btn" data-action="pick-place" data-which="to"><span class="lbl">יעד</span><span class="val' + (c.to ? '' : ' empty') + '">' + esc(c.to ? placeName(c.to) : 'בחר לאן נוסעים') + '</span></button>' +
        '</div><div class="side">' +
        '<button type="button" class="round-btn soft" aria-label="המיקום הנוכחי שלי כנקודת מוצא" data-action="use-gps" data-which="from">' + icon('locate') + '</button>' +
        '<button type="button" class="round-btn dark" aria-label="החלף בין מוצא ליעד" data-action="swap">' + icon('swap') + '</button></div></div>';
    }
    // saved routes
    const routes = s.routes.slice(0, 8);
    h += '<div class="field" style="gap:10px"><span class="section-label" style="margin:0">מסלולים שמורים</span><div class="chips scroll">';
    routes.forEach((r) => { h += '<button type="button" class="chip" data-action="use-route" data-id="' + r.id + '">' + (r.round ? icon('repeat', 'sm') : '') + esc(r.from.name + ' ← ' + r.to.name) + '</button>'; });
    if (!c.manual) h += '<button type="button" class="chip dashed" data-action="save-route">+ שמור מסלול</button>';
    h += '<button type="button" class="chip dashed" data-action="toggle-manual">' + icon('ruler', 'sm') + (c.manual ? 'בחירת מקומות' : 'מרחק ידני') + '</button>';
    h += '</div></div>';
    // options
    h += '<div class="card tight">' +
      '<div class="row"><span class="tile">' + icon('repeat') + '</span><div class="grow"><span class="t">הלוך-חזור</span><span class="s">מכפיל את המרחק והעלות</span></div>' + sw('toggle-round', c.roundTrip, 'הלוך-חזור') + '</div>' +
      '<div class="row"><span class="tile orange">' + icon('users') + '</span><div class="grow"><span class="t">חלוקה בין נוסעים</span><span class="s">' + (c.passengers > 1 ? 'כל אחד משלם חלק שווה' : 'כמה משלם כל אחד') + '</span></div>' +
      '<div class="stepper"><button type="button" aria-label="הוסף נוסע" data-action="pax" data-d="1">+</button><span class="n num">' + c.passengers + '</span><button type="button" aria-label="הפחת נוסע" data-action="pax" data-d="-1">−</button></div></div>' +
      '<button type="button" class="row" data-action="open-sheet" data-sheet="price"><span class="tile green">' + icon('fuel') + '</span><div class="grow"><span class="t">מחיר דלק · ' + esc(MC.FUEL_LABEL[car.fuelType] || 'בנזין 95') + '</span><span class="s">' + esc(pr.src) + '</span></div><span class="v num">' + money(pr.price) + '</span><span class="chev">' + icon('chevL', 'sm') + '</span></button>' +
      '</div>';
    const ready = c.manual ? MC.num(c.manualKm) > 0 : c.from && c.to;
    h += '<button type="button" class="btn cta" data-action="calculate"' + (ready ? '' : ' aria-disabled="true"') + '>' + icon('gauge') + 'חשב עלות נסיעה</button>';
    return h;
  };

  // ================= Result =================
  function gaugeSvg(pct) {
    const f = MC.clamp(pct || 0, 0, 1);
    const pt = (deg, r) => [60 + r * Math.cos(deg * Math.PI / 180), 62 - r * Math.sin(deg * Math.PI / 180)];
    const [ex, ey] = pt(180 - 180 * Math.max(f, 0.02), 48);
    const [nx, ny] = pt(180 - 180 * f, 33);
    return '<svg viewBox="0 0 120 74" width="120" height="74" aria-hidden="true">' +
      '<path d="M12 62 A48 48 0 0 1 108 62" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="10" stroke-linecap="round"/>' +
      '<path d="M12 62 A48 48 0 0 1 ' + ex.toFixed(1) + ' ' + ey.toFixed(1) + '" fill="none" stroke="#FF8A3D" stroke-width="10" stroke-linecap="round"/>' +
      '<line x1="60" y1="62" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="60" cy="62" r="6" fill="#fff"/>' +
      '<text x="6" y="74" fill="#DCE6FF" font-size="10" font-weight="700">E</text><text x="106" y="74" fill="#DCE6FF" font-size="10" font-weight="700">F</text></svg>';
  }
  const SOURCE = {
    online: { t: 'מסלול מדויק', i: 'cloud' },
    cache: { t: 'מסלול שמור במכשיר', i: 'check' },
    offline: { t: 'הערכה ללא אינטרנט', i: 'offline' },
    manual: { t: 'מרחק שהזנת', i: 'ruler' }
  };
  UI.result = () => {
    const r = MC.ui.result;
    if (!r) return '';
    const car = MC.carById(r.carId) || activeCar();
    const x = MC.calcTrip({ route: r.route, car, roundTrip: r.roundTrip, passengers: r.passengers, urbanPct: r.urbanPct });
    r.calc = x;
    const src = SOURCE[r.route.source] || SOURCE.offline;
    let h = '<div class="bar-top"><button type="button" class="round-btn" aria-label="חזרה" data-action="close-result">' + icon('back') + '</button>' +
      '<div class="titles"><span class="kicker">' + esc(car.name) + (r.roundTrip ? ' · הלוך-חזור' : '') + '</span><h1>' + esc(r.title) + '</h1></div>' +
      '<button type="button" class="round-btn" aria-label="שתף" data-action="share-result">' + icon('share') + '</button></div>';
    h += '<div class="hero"><div class="head"><div style="display:flex;flex-direction:column;gap:6px">' +
      '<span class="lbl">עלות דלק משוערת</span><div class="amount num"><span class="cur">₪</span><span class="val">' + fmt(x.cost, 2) + '</span></div>' +
      '<span class="source">' + icon(src.i, 'sm') + esc(src.t) + '</span></div>' +
      (x.tankPct != null ? '<div class="gauge">' + gaugeSvg(x.tankPct) + '<span>' + fmt(Math.round(x.tankPct * 100)) + '% מהמיכל</span></div>' : '') +
      '</div><div class="stat3">' +
      '<div><b class="num">' + km(x.km) + '</b><span>קילומטר</span></div>' +
      '<div><b class="num">' + fmt(x.liters, 1) + '</b><span>ליטר דלק</span></div>' +
      (x.min > 0 ? '<div><b class="num">' + MC.dur(x.min) + '</b><span>' + MC.durUnit(x.min) + '</span></div>' : '<div><b class="num">' + money(x.cpk) + '</b><span>לקילומטר</span></div>') +
      '</div></div>';
    if (r.route.source === 'offline') {
      h += '<div class="notice blue">' + icon('info', 'sm') + '<span class="grow">המרחק משוער לפי מרחקי כבישים שנשמרו במכשיר. כשתתחבר לאינטרנט החישוב יהיה לפי המסלול המדויק.</span></div>';
    }
    // breakdown
    const uPct = Math.round(x.share * 100);
    h += '<div class="card" style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="card-head"><h2 class="h2">פירוט המסלול</h2><span class="meta">צריכה משוקללת <strong style="color:var(--ink)">' + kmpl(x.kmpl) + ' ק״מ/ל׳</strong></span></div>' +
      '<div class="splitbar" aria-hidden="true"><span class="u" style="width:' + uPct + '%"></span><span class="x"></span></div>' +
      '<div style="display:flex;align-items:center;gap:12px"><span class="tile orange">' + icon('city') + '</span><div class="grow" style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:15px;font-weight:600">עירוני · ' + km(x.urbanKm) + ' ק״מ</span><span style="font-size:13px;color:var(--muted)">' + kmpl(x.cons.urban) + ' ק״מ/ל׳ · ' + fmt(x.litersU, 1) + ' ליטר</span></div><span style="font-weight:700" class="num">' + money(x.costU) + '</span></div>' +
      '<div style="display:flex;align-items:center;gap:12px"><span class="tile">' + icon('road') + '</span><div class="grow" style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:15px;font-weight:600">בין-עירוני · ' + km(x.interKm) + ' ק״מ</span><span style="font-size:13px;color:var(--muted)">' + kmpl(x.cons.inter) + ' ק״מ/ל׳ · ' + fmt(x.litersI, 1) + ' ליטר</span></div><span style="font-weight:700" class="num">' + money(x.costI) + '</span></div>' +
      '<div class="field"><label for="upct">כמה מהדרך עירונית? <b id="upct-v">' + uPct + '%</b></label><input id="upct" type="range" min="0" max="100" step="1" value="' + uPct + '" data-result="urbanPct"></div>' +
      (x.cons.learned ? '<span class="tag green" style="align-self:flex-start">הצריכה מותאמת לתדלוקים שלך (' + (x.cons.factor > 1 ? '+' : '−') + fmt(Math.abs(x.cons.factor - 1) * 100) + '%)</span>' : '') +
      '</div>';
    h += '<div class="grid2">' +
      '<div class="mini"><span class="l">' + (r.roundTrip ? 'כיוון אחד' : 'הלוך-חזור') + '</span><span class="b num">' + money(r.roundTrip ? x.oneWayCost : x.roundCost) + '</span></div>' +
      (x.pax > 1 ? '<div class="mini orange"><span class="l">לכל נוסע (' + x.pax + ')</span><span class="b num">' + money(x.perPax) + '</span></div>'
        : '<div class="mini"><span class="l">עלות לקילומטר</span><span class="b num">' + money(x.cpk) + '</span></div>') +
      '</div>';
    h += '<button type="button" class="notice gray" style="border:1px solid var(--line);text-align:right" data-action="open-sheet" data-sheet="price">' + icon('fuel', 'sm') + '<span class="grow">' + money(x.price) + ' לליטר · ' + esc(x.priceSrc) + '</span><span style="color:var(--primary-text);font-weight:700">שינוי</span></button>';
    if (!r.savedId) {
      h += '<div class="field" style="gap:8px"><span class="section-label" style="margin:0">סוג הנסיעה</span><div class="chips">' +
        [['work', 'עבודה'], ['private', 'פרטי']].map(([v, l]) => '<button type="button" class="chip" data-action="result-tag" data-v="' + v + '" aria-pressed="' + (r.tag === v ? 'true' : 'false') + '">' + l + '</button>').join('') + '</div></div>';
    }
    h += '<div class="btn-row">' +
      (r.savedId ? '<button type="button" class="btn" data-action="close-result">' + icon('check') + 'נשמר בנסיעות</button>'
        : '<button type="button" class="btn" data-action="save-trip">' + icon('save') + 'שמור לנסיעות</button>') +
      (r.to && isFinite(r.to.lat) ? '<a class="btn secondary" style="flex:0 0 150px" href="https://waze.com/ul?ll=' + r.to.lat.toFixed(5) + ',' + r.to.lon.toFixed(5) + '&navigate=yes" target="_blank" rel="noopener">' + icon('nav') + 'נווט בווייז</a>' : '') +
      '</div>';
    return h;
  };

  // ================= Trips =================
  UI.trips = () => {
    const ui = MC.ui, s = MC.state;
    const mk = ui.tripsMonth;
    const all = s.trips.filter((t) => MC.monthKey(t.ts) === mk);
    const list = all.filter((t) => ui.tripsFilter === 'all' || t.tag === ui.tripsFilter).sort((a, b) => b.ts - a.ts);
    const sum = list.reduce((t, x) => ({ km: t.km + x.km, cost: t.cost + x.cost }), { km: 0, cost: 0 });
    let h = '<div class="top"><h1 class="h1">הנסיעות שלי</h1><div style="display:flex;align-items:center;gap:4px">' +
      '<button type="button" class="round-btn" aria-label="החודש הקודם" data-action="trips-month" data-d="-1">' + icon('chevR', 'sm') + '</button>' +
      '<span style="font-size:14px;font-weight:700;min-width:92px;text-align:center">' + esc(MC.monthLabel(mk)) + '</span>' +
      '<button type="button" class="round-btn" aria-label="החודש הבא" data-action="trips-month" data-d="1">' + icon('chevL', 'sm') + '</button></div></div>';
    h += '<div class="summary"><div><b class="num">' + list.length + '</b><span>נסיעות</span></div><div><b class="num">' + km(sum.km) + '</b><span>קילומטר</span></div><div><b class="num">' + money0(sum.cost) + '</b><span>על דלק</span></div></div>';
    h += '<div class="chips">' + [['all', 'הכל'], ['work', 'עבודה'], ['private', 'פרטי']].map(([v, l]) =>
      '<button type="button" class="chip sm" data-action="trips-filter" data-v="' + v + '" aria-pressed="' + (ui.tripsFilter === v ? 'true' : 'false') + '">' + l + '</button>').join('') +
      (list.length ? '<button type="button" class="chip sm dashed" data-action="export-csv">' + icon('download', 'sm') + 'ייצוא לאקסל</button>' : '') + '</div>';
    if (!list.length) {
      h += '<div class="empty"><span class="tile">' + icon('route') + '</span><b>עוד אין נסיעות ב' + esc(MC.monthLabel(mk).split(' ')[0]) + '</b><span>מחשבים נסיעה ולוחצים "שמור לנסיעות", והיא תופיע כאן עם המרחק והעלות.</span>' +
        '<button type="button" class="btn" style="max-width:260px" data-action="tab" data-tab="calc">' + icon('gauge') + 'לחישוב נסיעה</button></div>';
      return h;
    }
    let lastDay = null;
    list.forEach((t) => {
      const day = MC.dayLabel(t.ts);
      if (day !== lastDay) { h += '<div class="day-label">' + esc(day) + '</div>'; lastDay = day; }
      const tag = t.tag === 'work' ? '<span class="tag">עבודה</span>' : t.tag === 'private' ? '<span class="tag gray">פרטי</span>' : '';
      const rt = t.roundTrip ? '<span class="tag orange">הלוך-חזור</span>' : '';
      h += '<button type="button" class="list-item" data-action="open-trip" data-id="' + t.id + '">' +
        '<span class="tile' + (t.roundTrip ? ' orange' : '') + '">' + icon(t.roundTrip ? 'repeat' : 'route') + '</span>' +
        '<span class="grow"><span class="t">' + esc(t.title) + tag + rt + '</span>' +
        '<span class="s num">' + km(t.km) + ' ק״מ · ' + fmt(t.liters, 1) + ' ל׳ · ' + MC.time(t.ts) + (t.passengers > 1 ? ' · ' + t.passengers + ' נוסעים' : '') + '</span></span>' +
        '<span class="end"><span class="amt num">' + money(t.cost) + '</span>' + (t.passengers > 1 ? '<span class="sub num">' + money(t.cost / t.passengers) + ' לנוסע</span>' : '') + '</span></button>';
    });
    return h;
  };

  // ================= Fuel log =================
  UI.fuel = () => {
    const s = MC.state, car = activeCar();
    const a = MC.analyzeFuel(car.id);
    const setting = MC.mixKmpl(car);
    let h = '<div class="top"><h1 class="h1">יומן תדלוקים</h1>' + (s.cars.length > 1 ? '<button type="button" class="pill-btn" data-action="open-sheet" data-sheet="carPicker">' + icon('car') + '<span>' + esc(car.name) + '</span></button>' : '') + '</div>';
    h += '<div class="card" style="display:flex;flex-direction:column;gap:12px">';
    if (a.avg) {
      const iv = a.intervals.slice(-6);
      const max = Math.max.apply(null, iv.map((x) => x.cons));
      const min = Math.min.apply(null, iv.map((x) => x.cons));
      h += '<div style="display:flex;align-items:flex-end;justify-content:space-between;gap:12px"><div style="display:flex;flex-direction:column;gap:2px">' +
        '<span class="kicker" style="font-size:13px">הצריכה האמיתית שלך</span>' +
        '<span style="font-size:34px;font-weight:800;letter-spacing:-.5px;line-height:1.1" class="num">' + kmpl(a.avg) + ' <span style="font-size:16px;font-weight:600;color:var(--muted)">ק״מ/ל׳</span></span>' +
        '<span style="font-size:12px;color:var(--muted)">' + (a.avgCount === 1 ? 'לפי התדלוק המלא האחרון' : 'ממוצע ' + a.avgCount + ' תדלוקים אחרונים') + '</span></div>' +
        '<div class="spark" aria-hidden="true">' + iv.map((x, i) => '<i class="' + (i === iv.length - 1 ? 'on' : '') + '" style="height:' + (max === min ? 40 : 18 + ((x.cons - min) / (max - min)) * 36).toFixed(0) + 'px"></i>').join('') + '</div></div>';
      const diff = a.avg / setting - 1;
      if (Math.abs(diff) >= 0.06) {
        h += '<div class="notice orange"><span class="grow">' + (diff < 0 ? 'האוטו צורך יותר' : 'האוטו חסכוני יותר') + ' ממה שהוגדר (' + kmpl(setting) + ')</span><button type="button" class="link" data-action="apply-real">לעדכן</button></div>';
      } else {
        h += '<div class="notice green"><span class="grow">ההגדרה של הרכב תואמת את הצריכה האמיתית. מעולה.</span></div>';
      }
    } else {
      h += '<div style="display:flex;gap:12px;align-items:flex-start"><span class="tile orange big">' + icon('drop', 'lg') + '</span><div style="display:flex;flex-direction:column;gap:4px"><b>כמה האוטו באמת צורך?</b>' +
        '<span style="font-size:14px;color:var(--muted)">בכל תדלוק רושמים כמה שילמת ואת הקילומטרז׳. מהתדלוק השני עם מיכל מלא נחשב את הצריכה האמיתית, כמה נסעת בכל תדלוק וכמה עולה לך כל קילומטר.</span></div></div>';
    }
    h += '</div>';
    const st = MC.computeStats(car.id, 'month');
    h += '<div class="grid2"><div class="mini"><span class="l">תדלקת החודש</span><span class="b num">' + money0(st.spent) + '</span></div>' +
      '<div class="mini"><span class="l">עלות לקילומטר</span><span class="b num">' + (a.cpkAll ? money(a.cpkAll) : '–') + '</span></div></div>';
    if (!a.rows.length) {
      h += '<div class="empty" style="padding-top:18px"><b>עוד לא נרשמו תדלוקים</b><span>לוחצים על "תדלוק חדש" אחרי שמתדלקים.</span></div>';
    }
    a.rows.forEach((r) => {
      const f = r.f;
      let pill = '';
      if (r.cons) {
        const good = r.cons >= setting * 0.97;
        pill = '<span class="tag ' + (good ? 'green' : 'orange') + '" style="font-size:12px;padding:4px 10px">' + kmpl(r.cons) + ' ק״מ/ל׳</span>';
      } else if (!f.full) pill = '<span class="tag gray">מיכל חלקי</span>';
      h += '<button type="button" class="list-item col" data-action="edit-fuel" data-id="' + f.id + '">' +
        '<span style="display:flex;align-items:center;gap:12px;width:100%"><span class="tile green">' + icon('fuel') + '</span>' +
        '<span class="grow"><span class="t">' + esc(MC.dateShort(f.ts)) + (f.station ? ' · ' + esc(f.station) : '') + '</span>' +
        '<span class="s num">' + fmt(r.liters, 1) + ' ל׳ · ' + money(f.price) + ' לליטר' + (f.odo ? ' · מד-אוץ ' + fmt(f.odo) : '') + '</span></span>' +
        '<span class="amt num">' + money(f.amount, f.amount % 1 ? 2 : 0) + '</span></span>' +
        (r.kmSince || pill ? '<span class="foot"><span>' + (r.kmSince ? 'נסעת <strong class="num">' + fmt(r.kmSince) + ' ק״מ</strong> מהתדלוק הקודם' : '') + '</span>' + pill + '</span>' : '') +
        '</button>';
    });
    return h;
  };
  UI.fuelFab = () => '<button type="button" class="fab" data-action="new-fuel">' + icon('plus') + 'תדלוק חדש</button>';

  // ================= Stats =================
  function consChart(series, ref) {
    if (series.length < 2) return '<p class="fine" style="margin:0">הגרף יופיע אחרי שני תדלוקים מלאים עם קילומטרז׳.</p>';
    const W = 320, H = 110, pad = 14;
    const vals = series.map((x) => x.cons).concat([ref]);
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
    const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2 - 12);
    const n = series.length;
    const x = (i) => W - pad - (i * (W - pad * 2)) / (n - 1);
    const pts = series.map((s, i) => x(i).toFixed(1) + ',' + y(s.cons).toFixed(1)).join(' ');
    const lastI = n - 1;
    return '<svg role="img" aria-label="צריכה ב-' + n + ' התדלוקים האחרונים" viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="110">' +
      '<line x1="' + pad + '" y1="' + y(ref).toFixed(1) + '" x2="' + (W - pad) + '" y2="' + y(ref).toFixed(1) + '" stroke="var(--faint)" stroke-width="2" stroke-dasharray="5 5"/>' +
      '<polyline points="' + pts + '" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
      series.map((s, i) => i === lastI ? '' : '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(s.cons).toFixed(1) + '" r="4.5" fill="var(--surface)" stroke="var(--primary)" stroke-width="2.5"/>').join('') +
      '<circle cx="' + x(lastI).toFixed(1) + '" cy="' + y(series[lastI].cons).toFixed(1) + '" r="6" fill="var(--orange)" stroke="var(--surface)" stroke-width="2.5"/>' +
      '<text x="' + x(lastI).toFixed(1) + '" y="' + (H - 2) + '" text-anchor="middle" font-size="11" font-weight="700" fill="var(--orange-text)">' + fmt(series[lastI].cons, 1) + '</text></svg>';
  }
  UI.stats = () => {
    const ui = MC.ui, car = activeCar();
    const st = MC.computeStats(car.id, ui.statsMode, ui.statsRef);
    const ref = new Date(ui.statsRef);
    const label = ui.statsMode === 'year' ? String(ref.getFullYear()) : MC.monthLabel(MC.monthKey(ref));
    let h = '<div class="top"><h1 class="h1">נתונים</h1>' + seg('stats-mode', [{ v: 'month', label: 'חודש' }, { v: 'year', label: 'שנה' }], ui.statsMode, 'small') + '</div>';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
      '<button type="button" class="round-btn" aria-label="התקופה הקודמת" data-action="stats-nav" data-d="-1">' + icon('chevR', 'sm') + '</button>' +
      '<b style="font-size:16px">' + esc(label) + ' · ' + esc(car.name) + '</b>' +
      '<button type="button" class="round-btn" aria-label="התקופה הבאה" data-action="stats-nav" data-d="1">' + icon('chevL', 'sm') + '</button></div>';
    h += '<div class="grid2">' +
      '<div class="mini"><span class="l">הוצאה על דלק</span><span class="b num">' + money0(st.spent) + '</span></div>' +
      '<div class="mini"><span class="l">קילומטרים' + (st.km && !st.kmFromOdo ? ' (לפי נסיעות)' : '') + '</span><span class="b num">' + (st.km ? km(st.km) : '–') + '</span></div>' +
      '<div class="mini"><span class="l">צריכה ממוצעת</span><span class="b num">' + (st.avg ? kmpl(st.avg) + ' <small>ק״מ/ל׳</small>' : '–') + '</span></div>' +
      '<div class="mini"><span class="l">עלות לקילומטר</span><span class="b num">' + (st.cpk ? money(st.cpk) : '–') + '</span></div></div>';
    const max = Math.max(1, Math.max.apply(null, st.series.map((s) => s.v)));
    h += '<div class="card" style="display:flex;flex-direction:column;gap:12px"><h2 class="h2">הוצאה חודשית על דלק</h2>' +
      '<div class="bars" role="img" aria-label="' + esc(st.series.map((s) => s.label + ' ' + Math.round(s.v)).join(', ')) + '">' +
      st.series.map((s) => '<div class="b' + (s.key === MC.monthKey(ref) ? ' on' : '') + '"><small class="num">' + (s.v ? fmt(s.v) : '') + '</small><i style="height:' + (s.v ? Math.max(4, (s.v / max) * 110) : 3).toFixed(0) + 'px"></i><span>' + esc(s.label) + '</span></div>').join('') +
      '</div></div>';
    const refK = MC.mixKmpl(car);
    h += '<div class="card" style="display:flex;flex-direction:column;gap:8px"><div class="card-head"><h2 class="h2">צריכה לפי תדלוק</h2><span class="legend"><span class="dash"></span>מוגדר ' + kmpl(refK) + '</span></div>' + consChart(st.consSeries, refK) + '</div>';
    const tg = st.tags;
    if (tg.work.n || tg.private.n) {
      const tr = (g, ic, tone, t) => g.n ? '<div class="row"><span class="tile ' + tone + '">' + icon(ic) + '</span><div class="grow"><span class="t">' + t + '</span><span class="s num">' + (g.n === 1 ? 'נסיעה אחת' : g.n + ' נסיעות') + ' · ' + km(g.km) + ' ק״מ</span></div><span class="v num">' + money0(g.cost) + '</span></div>' : '';
      h += '<div class="card tight">' + tr(tg.work, 'work', '', 'נסיעות עבודה') + tr(tg.private, 'home', 'gray', 'נסיעות פרטיות') + '</div>';
    }
    const c = MC.carConsumption(car), pr = MC.priceFor(car);
    const cu = pr.price / c.urban, ci = pr.price / c.inter;
    if (ci < cu) {
      h += '<div class="notice green">' + icon('road', 'sm') + '<span class="grow">נסיעה בין-עירונית זולה ב-' + fmt((1 - ci / cu) * 100) + '% לקילומטר (' + money(ci) + ' מול ' + money(cu) + ' בעיר)</span></div>';
    }
    return h;
  };

  // ================= Settings =================
  UI.settings = () => {
    const s = MC.state, car = activeCar();
    const off = MC.officialPrice();
    let h = '<h1 class="h1">הגדרות</h1>';
    h += '<span class="section-label">הרכב שלי</span>';
    h += '<div class="card accent" style="display:flex;flex-direction:column;gap:14px">' +
      '<div style="display:flex;align-items:center;gap:12px"><span class="tile big solid">' + icon('car', 'lg') + '</span><div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><b style="font-size:17px">' + esc(car.name) + (car.year ? ' ' + esc(car.year) : '') + '</b>' +
      '<span style="font-size:13px;color:var(--muted)">' + esc(MC.FUEL_LABEL[car.fuelType]) + (car.tank ? ' · מיכל ' + fmt(car.tank) + ' ל׳' : '') + '</span></div>' +
      '<button type="button" class="round-btn" aria-label="עריכת הרכב" data-action="edit-car" data-id="' + car.id + '">' + icon('edit', 'sm') + '</button></div>' +
      '<div class="grid2"><div class="mini orange"><span class="l">עירוני</span><span class="b num">' + kmpl(car.urban) + ' <small>ק״מ/ל׳</small></span></div><div class="mini blue"><span class="l">בין-עירוני</span><span class="b num">' + kmpl(car.inter) + ' <small>ק״מ/ל׳</small></span></div></div>' +
      '<div style="display:flex;align-items:center;gap:10px"><span style="flex:1;font-size:14px;font-weight:500">ללמוד את הצריכה מהתדלוקים</span>' + sw('toggle-learn', car.learn, 'ללמוד את הצריכה מהתדלוקים', ' data-id="' + car.id + '"') + '</div></div>';
    s.cars.filter((c) => c.id !== car.id).forEach((c) => {
      h += '<div class="list-item"><span class="tile gray">' + icon('car') + '</span><span class="grow"><span class="t">' + esc(c.name) + (c.year ? ' ' + esc(c.year) : '') + '</span><span class="s num">' + kmpl(c.urban) + ' / ' + kmpl(c.inter) + ' ק״מ/ל׳</span></span>' +
        '<button type="button" class="chip sm" data-action="set-car" data-id="' + c.id + '">בחר</button><button type="button" class="round-btn" aria-label="עריכה" data-action="edit-car" data-id="' + c.id + '">' + icon('edit', 'sm') + '</button></div>';
    });
    h += '<button type="button" class="chip dashed" style="justify-content:center;min-height:46px" data-action="edit-car" data-id="">+ הוסף רכב נוסף</button>';
    h += '<span class="section-label">מחיר דלק</span>' + UI.priceControls();
    h += '<span class="section-label">מראה</span>' + seg('set-theme', [{ v: 'light', label: 'בהיר', icon: 'sun' }, { v: 'dark', label: 'כהה', icon: 'moon' }, { v: 'system', label: 'לפי המכשיר', icon: 'phone' }], s.settings.theme);
    h += '<div class="card tight" style="margin-top:4px">' +
      row('saved', 'star', 'orange', 'מקומות ומסלולים שמורים', s.places.length + ' מקומות · ' + s.routes.length + ' מסלולים') +
      row('reminders', 'bell', 'orange', 'תזכורות: טסט, ביטוח, טיפול', MC.reminderSummary()) +
      row('offline', 'offline', '', 'נתונים במכשיר (בלי אינטרנט)', MC.data.places.length ? fmt(MC.data.places.length) + ' יישובים' + (MC.data.roads ? ' · מרחקי כבישים' : '') + (off ? ' · מחיר ' + MC.monthLabel(off.month).split(' ')[0] : '') : 'טוען…') +
      row('backup', 'download', 'green', 'גיבוי, שחזור וייצוא לאקסל', 'כל הנתונים נשמרים רק בטלפון שלך') +
      row('feedback', 'message', '', 'פנייה / הצעת ייעול', 'מה להוסיף? מה לשפר? כתוב לנו') +
      row('about', 'info', 'gray', 'אודות MyCar', 'גרסה ' + MC.VERSION.version) + '</div>';
    h += '<p class="credit">MyCar · גרסה ' + esc(MC.VERSION.version) + ' · פותח על ידי <b>Itzko</b></p>';
    return h;
  };
  function row(sheet, ic, tone, t, sub) {
    return '<button type="button" class="row" data-action="open-sheet" data-sheet="' + sheet + '"><span class="tile ' + tone + '">' + icon(ic) + '</span><span class="grow"><span class="t">' + esc(t) + '</span>' + (sub ? '<span class="s">' + esc(sub) + '</span>' : '') + '</span><span class="chev">' + icon('chevL', 'sm') + '</span></button>';
  }
  UI.priceControls = () => {
    const s = MC.state.settings, off = MC.officialPrice();
    const car = activeCar();
    const last = MC.lastRefuel(car.id);
    let h = seg('set-price-mode', [
      { v: 'auto', label: 'אוטומטי', sub: off ? money(off.price) : '' },
      { v: 'last', label: 'תדלוק אחרון', sub: last ? money(last.price) : 'אין עדיין' },
      { v: 'manual', label: 'ידני', sub: s.manualPrice ? money(s.manualPrice) : '' }
    ], s.priceMode);
    if (s.priceMode === 'manual') {
      h += '<div class="field"><label for="mprice">מחיר לליטר</label><div class="input-wrap"><input id="mprice" class="input big num" inputmode="decimal" data-setting="manualPrice" value="' + esc(s.manualPrice || '') + '"><span class="suffix">₪</span></div></div>';
    }
    if (s.priceMode === 'auto') {
      h += '<p class="fine" style="margin:0 4px">' + (off ? 'המחיר המפוקח של בנזין 95 ל' + esc(MC.monthLabel(off.month)) + '. מתעדכן לבד כשיש אינטרנט.' : '') + (car.fuelType !== '95' ? ' לרכב על ' + esc(MC.FUEL_LABEL[car.fuelType]) + ' המחיר נלקח מהגדרות הרכב.' : '') + '</p>';
    }
    h += '<div class="card tight"><div class="row"><div class="grow"><span class="t">תדלוק בשירות מלא</span><span class="s">מוסיף ' + (off ? fmt((off && MC.data.fuel.fullService || 0) * 100) : '26') + ' אגורות לליטר</span></div>' + sw('toggle-fullservice', s.fullService, 'תדלוק בשירות מלא') + '</div></div>';
    return h;
  };
})();
