/* "Where did I park?" – the screens: a card at the top of the calculator ("חניתי כאן" / "הרכב חונה"),
   the save sheet (position, floor, a note, a photo) and the find sheet (an arrow and the distance to the
   car, walking directions in a maps app, sharing the spot, "מצאתי את הרכב"). Data and GPS: parking.js.
   Loaded after app.js. */
(function () {
  'use strict';
  const MC = window.MC, P = MC.parking;
  const { esc, icon } = MC;
  const svg = (d) => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const I = {
    park: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9.5 17V7H13a3 3 0 0 1 0 6H9.5"/>'),
    camera: svg('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3.5"/>'),
    walk: svg('<circle cx="13" cy="4" r="2"/><path d="m9 20 3-6 3 3v4"/><path d="M6 12.5 9 9l4 1 2 3 3 1"/><path d="M12 14 10.5 9.5"/>'),
    compass: svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>'),
    share: svg('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
    trash: svg('<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>')
  };
  const live = { me: null, err: '', watch: null, timer: 0, raf: 0, fixedHeading: null, confirmFound: false };
  const ui = () => (window.__mycar ? window.__mycar.ui : null);
  const sheetName = () => { const u = ui(); return u && u.sheet ? u.sheet.name : ''; };
  const haptic = () => { if (MC.isNative()) MC.call('Haptics', 'impact', { style: 'LIGHT' }); };
  const $ = (id) => document.getElementById(id);

  // "קומה -2" with the minus sign on the correct side in Hebrew.
  const floorHtml = (f) => (!f ? '' : f === 'street' || f === '0' ? esc(P.floorText(f)) : 'קומה <bdi dir="ltr">' + esc(f) + '</bdi>');
  const whereHtml = (s) => [floorHtml(s.floor), esc(s.note)].filter(Boolean).join(' · ');
  const carName = (s) => {
    if (!MC.state || MC.state.cars.length < 2) return '';
    const c = MC.state.cars.find((x) => x.id === s.carId);
    return c ? ' · ' + esc(c.name) : '';
  };

  // ================= Card on the calculator =================
  MC.parkingCard = () => {
    if (!P.loaded) return '';
    const s = P.spot;
    if (!s) {
      return '<button type="button" class="park-strip" data-action="park-save"><span class="tile">' + I.park + '</span>' +
        '<span class="grow"><span class="t">חניתי כאן</span><span class="s">שומרים את מקום החניה, ואחר כך מוצאים את הרכב בקלות</span></span>' +
        '<span class="chev">' + icon('chevL', 'sm') + '</span></button>';
    }
    const where = whereHtml(s) || (s.address ? 'ליד ' + esc(s.address) : s.lat != null ? 'המיקום נשמר' : 'בלי מיקום GPS');
    return '<div class="park-card">' +
      '<button type="button" class="park-main" data-action="park-find"><span class="tile solid">' + I.park + '</span>' +
      '<span class="grow"><span class="t">הרכב חונה' + carName(s) + '</span><span class="s">' + where + '</span><span class="s">חנית ' + esc(P.agoText(s.ts)) + '</span></span>' +
      (P.photo ? '<img class="park-thumb" alt="" src="' + P.photo + '">' : '') + '</button>' +
      '<div class="park-actions"><button type="button" class="btn park-go" data-action="park-find">' + I.compass + 'איפה הרכב?</button>' +
      '<button type="button" class="chip" data-action="park-save">חניתי במקום חדש</button></div></div>';
  };

  // ================= Save sheet =================
  function statusHtml(s, editing) {
    const c = P.capture;
    const busy = P.locating();
    const acc = s.acc != null ? 'דיוק של כ-' + MC.fmt(s.acc) + ' מ׳' : '';
    if (busy && s.lat == null) return '<div class="notice blue"><span class="park-spin" aria-hidden="true"></span><span class="grow">מאתר את המיקום…</span></div>';
    if (s.lat != null) {
      const weak = s.acc > 30;
      let h = '<div class="notice ' + (weak ? 'orange' : 'green') + '">' + (weak ? icon('alert', 'sm') : icon('check', 'sm')) + '<span class="grow">' +
        (weak ? 'המיקום נשמר בערך (' + acc + '). בחניון סגור ה-GPS חלש, לכן כדאי לבחור קומה ולצלם.' : 'המיקום נשמר (' + acc + ')') +
        (busy ? ' משפר את הדיוק…' : '') + '</span></div>';
      if (editing && !busy) h += '<button type="button" class="btn ghost park-relocate" data-action="park-relocate">' + icon('locate', 'sm') + 'אני ליד הרכב: לשמור את המיקום מחדש</button>';
      return h;
    }
    const msg = c && c.state === 'denied'
      ? 'אין הרשאה למיקום. אפשר לאשר אותה בהגדרות הטלפון.'
      : 'לא הצלחתי לאתר מיקום (אולי אין כאן קליטת GPS).';
    return '<div class="notice orange">' + icon('alert', 'sm') + '<span class="grow">' + msg + ' הקומה, ההערה והתמונה נשמרות גם בלי.</span>' +
      '<button type="button" class="link" data-action="park-relocate">נסה שוב</button></div>';
  }
  function photoHtml(s) {
    if (P.photo) {
      return '<figure class="park-photo"><img alt="התמונה של מקום החניה" src="' + P.photo + '">' +
        '<figcaption><button type="button" class="chip sm" data-action="park-photo">' + I.camera + 'צילום מחדש</button>' +
        '<button type="button" class="chip sm" data-action="park-photo-del">' + I.trash + 'מחיקה</button></figcaption></figure>';
    }
    return '<div class="field"><button type="button" class="btn secondary" data-action="park-photo">' + I.camera + 'צלם את המקום</button>' +
      '<span class="hint">תמונה של עמוד, שלט או קיר עוזרת למצוא את הרכב בחניון גדול</span></div>';
  }
  MC.SHEETS.parkSave = {
    full: true,
    title: (d) => (d && d.edit ? 'פרטי החניה' : 'חנית כאן'),
    render: (d) => {
      const s = P.spot;
      if (!s) return '<p class="fine">אין חניה שמורה.</p><button type="button" class="btn" data-action="close-sheet">סגירה</button>';
      return statusHtml(s, d && d.edit) +
        '<div class="field"><span class="label">באיזו קומה?</span><div class="chips scroll park-floors" role="group" aria-label="קומה">' +
        P.FLOORS.map((f) => '<button type="button" class="chip" data-action="park-floor" data-v="' + f.v + '" aria-pressed="' + (s.floor === f.v) + '"><bdi>' + esc(f.label) + '</bdi></button>').join('') +
        '</div></div>' +
        '<div class="field"><label for="park-note">איך תזכור? (לא חובה)</label><input id="park-note" class="input" data-park="note" maxlength="80" autocomplete="off" value="' + esc(s.note) + '" placeholder="למשל: עמוד C4, ליד המעליות"></div>' +
        photoHtml(s) +
        '<button type="button" class="btn" data-action="park-done">' + icon('check') + 'סיום</button>';
    }
  };

  // ================= Find sheet =================
  const DIAL = '<svg class="park-dial-svg" viewBox="0 0 200 200" aria-hidden="true">' +
    '<g id="park-ring"><circle cx="100" cy="100" r="88" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="2"/>' +
    [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => '<line x1="100" y1="' + (a % 90 ? 18 : 14) + '" x2="100" y2="26" stroke="currentColor" stroke-opacity="' + (a % 90 ? '.35' : '.7') + '" stroke-width="2" transform="rotate(' + a + ' 100 100)"/>').join('') +
    '<text x="100" y="27" text-anchor="middle" font-size="17" font-weight="800" fill="currentColor">צ</text></g>' +
    '<g id="park-arrow"><path d="M100 46 L127 130 L100 113 L73 130 Z" fill="currentColor"/></g>' +
    '<circle cx="100" cy="100" r="7" fill="currentColor"/></svg>';
  function findHtml() {
    const s = P.spot;
    if (!s) return '<p class="fine">אין חניה שמורה.</p><button type="button" class="btn" data-action="close-sheet">סגירה</button>';
    const where = whereHtml(s);
    let h = '<section class="park-hero' + (s.lat == null ? ' no-gps' : '') + '">';
    if (where) h += '<div class="park-where">' + where + '</div>';
    if (s.lat != null) {
      h += '<div class="park-dial" id="park-dial">' + DIAL + '</div>' +
        '<div class="park-dist num" id="park-dist" aria-live="polite">…</div><div class="park-sub" id="park-sub">מאתר את המיקום שלך…</div>';
    } else {
      h += '<div class="park-sub">בחניה הזו לא נשמר מיקום GPS, לכן אין חץ. היעזר בפרטים ובתמונה.</div>';
    }
    h += '</section>';
    if (s.lat != null) h += '<p class="fine park-tip" id="park-tip"></p>';
    h += '<div class="card tight">';
    h += '<div class="row"><span class="tile gray">' + icon('calendar') + '</span><span class="grow"><span class="t">חנית ' + esc(P.agoText(s.ts)) + '</span><span class="s">' + esc(MC.dayLabel(s.ts)) + ' ב-' + MC.time(s.ts) + carName(s) + '</span></span></div>';
    if (s.address || s.lat != null) h += '<div class="row"><span class="tile gray">' + icon('pin') + '</span><span class="grow"><span class="t">' + (s.address ? 'ליד ' + esc(s.address) : 'מיקום GPS') + '</span><span class="s">' + (s.acc != null ? 'נשמר בדיוק של כ-' + MC.fmt(s.acc) + ' מ׳' : '') + '</span></span></div>';
    h += '</div>';
    if (P.photo) h += '<figure class="park-photo big"><img alt="התמונה של מקום החניה" src="' + P.photo + '" data-action="park-zoom"></figure>';
    if (s.lat != null) h += '<a class="btn" href="' + P.walkLink(s) + '" target="_blank" rel="noopener">' + I.walk + 'ניווט ברגל ' + (MC.isIOS && MC.isIOS() ? 'במפות' : 'בגוגל מפות') + '</a>';
    h += '<div class="grid2"><button type="button" class="btn secondary" data-action="park-share">' + I.share + 'שיתוף</button>' +
      '<button type="button" class="btn secondary" data-action="park-edit">' + I.edit + 'עריכה</button></div>' +
      '<button type="button" class="btn ' + (live.confirmFound ? 'danger' : 'ghost') + '" data-action="park-found">' + icon('check') +
      (live.confirmFound ? 'לחץ שוב כדי למחוק את החניה' : 'מצאתי את הרכב') + '</button>';
    return h;
  }
  MC.SHEETS.parkFind = {
    full: true,
    title: () => 'איפה הרכב?',
    init: () => { live.confirmFound = false; startLive(); },
    render: findHtml
  };

  // ---------- live arrow and distance ----------
  function heading() {
    if (live.fixedHeading != null) return { deg: live.fixedHeading, src: 'compass' };
    if (MC.compass.fresh()) return { deg: MC.compass.heading, src: 'compass' };
    const m = live.me;
    if (m && m.heading != null && isFinite(m.heading) && m.speed > 0.7) return { deg: m.heading, src: 'walk' };
    return null;
  }
  function paint() {
    const s = P.spot, dist = $('park-dist');
    if (!s || s.lat == null || !dist) return;
    const sub = $('park-sub'), tip = $('park-tip'), arrow = $('park-arrow'), ring = $('park-ring'), dial = $('park-dial');
    const m = live.me;
    if (!m) {
      dist.textContent = '…';
      sub.textContent = live.err === 'denied' ? 'אין הרשאה למיקום. אפשר לאשר אותה בהגדרות הטלפון.' : live.err ? 'מחפש קליטת GPS…' : 'מאתר את המיקום שלך…';
      if (tip) tip.textContent = '';
      dial.classList.add('wait');
      return;
    }
    dial.classList.remove('wait');
    const d = P.distance(m, s), b = P.bearing(m, s), h = heading();
    const near = d <= Math.max(12, Math.min(m.acc, 35));
    const weak = m.acc > 40;
    arrow.setAttribute('transform', 'rotate(' + (h ? b - h.deg : b).toFixed(1) + ' 100 100)');
    ring.setAttribute('transform', 'rotate(' + (h ? -h.deg : 0).toFixed(1) + ' 100 100)');
    dial.classList.toggle('near', near);
    dist.textContent = near ? 'הגעת!' : P.distText(d);
    const where = [P.floorText(s.floor), s.note].filter(Boolean).join(', ');
    sub.textContent = near
      ? 'הרכב ממש כאן' + (where ? ': ' + where : '')
      : P.walkText(d) + ' · ' + (h ? P.turnText(b - h.deg) : 'בכיוון ' + P.compassText(b));
    if (tip) {
      tip.textContent = weak
        ? 'ה-GPS חלש כאן (דיוק של כ-' + MC.fmt(m.acc) + ' מ׳), לכן הכיוון והמרחק בערך. היעזר בקומה ובתמונה.'
        : !h ? 'לא התקבל מצפן מהטלפון, לכן החץ מראה את הכיוון ביחס לצפון (צ). כשתתחיל ללכת, החץ יתאים את עצמו לכיוון ההליכה.'
          : h.src === 'walk' ? 'החץ מכוון לפי כיוון ההליכה שלך.'
            : 'החזק את הטלפון שטוח. אם החץ לא מדויק, נפנף בו בתנועה של הספרה 8.';
    }
  }
  function loop() {
    cancelAnimationFrame(live.raf);
    const tick = () => { if (sheetName() !== 'parkFind') return; paint(); live.raf = requestAnimationFrame(tick); };
    live.raf = requestAnimationFrame(tick);
  }
  function startLive() {
    stopLive();
    live.me = null; live.err = '';
    MC.compass.start(paint);
    live.watch = P.watch((f) => { live.me = f; live.err = ''; }, (kind) => { live.err = kind; });
    live.timer = setInterval(() => { if (sheetName() !== 'parkFind') stopLive(); }, 700);
    loop();
  }
  function stopLive() {
    clearInterval(live.timer); live.timer = 0;
    cancelAnimationFrame(live.raf);
    if (live.watch) { live.watch.stop(); live.watch = null; }
    MC.compass.stop(paint);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopLive();
    else if (sheetName() === 'parkFind') startLive();
  });

  // ================= Actions =================
  const A = MC.A;
  A['park-save'] = () => {
    const car = MC.activeCar ? MC.activeCar() : null;
    P.start(car ? car.id : '');
    P.locate();
    haptic();
    MC.openSheet('parkSave', {});
  };
  A['park-floor'] = (el) => { P.update({ floor: P.spot && P.spot.floor === el.dataset.v ? '' : el.dataset.v }); MC.renderSheet(); };
  A['park-photo'] = () => { const f = $('park-file'); if (f) { f.value = ''; f.click(); } };
  A['park-photo-del'] = async () => { await P.setPhoto(null); MC.renderSheet(); };
  A['park-relocate'] = () => { P.update({ lat: null, lon: null, acc: null, address: '' }); P.locate(); MC.renderSheet(); };
  A['park-done'] = () => {
    MC.closeSheet();
    MC.render(true);
    MC.toast(P.spot && P.spot.lat == null && !P.spot.floor && !P.spot.note && !P.photo ? 'נשמרה חניה בלי מיקום. אפשר להוסיף פרטים בעריכה' : 'החניה נשמרה');
  };
  A['park-find'] = () => {
    MC.compass.permit();
    MC.openSheet('parkFind', {});
  };
  A['park-edit'] = () => MC.openSheet('parkSave', { edit: true });
  A['park-zoom'] = (el) => { const f = el.closest('figure'); if (f) f.classList.toggle('zoom'); };
  A['park-share'] = async () => {
    if (!P.spot) return;
    const text = P.shareText(P.spot);
    if (MC.isNative()) { try { await MC.callRaw('Share', 'share', { text, dialogTitle: 'שיתוף מקום החניה' }); } catch (e) { /* closed */ } return; }
    if (navigator.share) { try { await navigator.share({ text }); } catch (e) { /* closed */ } return; }
    try { await navigator.clipboard.writeText(text); MC.toast('הועתק. אפשר להדביק בהודעה'); } catch (e) { MC.toast(text, 6000); }
  };
  A['park-found'] = async () => {
    if (!live.confirmFound) { live.confirmFound = true; MC.renderSheet(); return; }
    live.confirmFound = false;
    stopLive();
    await P.clear();
    MC.closeSheet();
    MC.render(true);
    MC.toast('יופי! החניה נמחקה');
  };

  // ================= Inputs =================
  document.body.insertAdjacentHTML('beforeend', '<input type="file" id="park-file" accept="image/*" capture="environment" hidden>');
  const saveNote = MC.debounce((v) => P.update({ note: v.trim() }), 300);
  document.addEventListener('input', (e) => { if (e.target && e.target.dataset && e.target.dataset.park === 'note') saveNote(e.target.value); });
  document.addEventListener('change', async (e) => {
    if (!e.target || e.target.id !== 'park-file') return;
    const file = e.target.files && e.target.files[0];
    if (!file || !P.spot) return;
    try {
      const ok = await P.setPhoto(await P.shrinkPhoto(file));
      if (!ok) MC.toast('לא היה מקום לשמור את התמונה');
    } catch (err) { MC.toast('לא הצלחתי לקרוא את התמונה'); }
    if (sheetName() === 'parkSave') MC.renderSheet();
  });

  // The calculator shows the card: refresh it when the parking changes behind a sheet or on load.
  const refresh = MC.debounce(() => {
    const u = ui();
    if (!MC.state || !u || u.view === 'result' || u.tab !== 'calc') return;
    MC.render(true);
  }, 120);
  P.onChange(() => {
    refresh();
    if (sheetName() === 'parkSave' && !(document.activeElement && document.activeElement.id === 'park-note')) MC.renderSheet();
  });

  // For the site's screenshots and the automated test.
  MC.parkingUI = { live, paint, startLive, stopLive };
})();
