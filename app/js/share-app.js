/* Sharing MyCar with friends (אודות ← שיתוף האפליקציה עם חברים): a short personal message with the link to
   MyCar's site, or the app itself as an APK file (Bluetooth, WhatsApp, Nearby Share, file manager…).
   The APK file is the one installed on this phone, so it works without internet; if that copy can't be
   reached, the latest APK is downloaded from GitHub instead. Loaded after app.js. */
(function () {
  'use strict';
  const MC = window.MC;
  const S = (MC.shareApp = {});
  const FILE = 'share/mycar.apk';
  const SITE = MC.PAGES_URL;
  const svg = (d) => '<svg class="i" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const ICON_LINK = svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>');
  const ICON_COPY = svg('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>');

  S.text = 'היי! אני משתמש באפליקציה MyCar. היא מחשבת כמה עולה כל נסיעה בדלק ושומרת יומן נסיעות ותדלוקים, גם בלי אינטרנט. אשמח מאוד לשתף אותך:';
  S.message = () => S.text + '\n' + SITE;

  S.link = async () => {
    const text = S.message();
    if (MC.isNative()) { try { await MC.callRaw('Share', 'share', { text, title: 'MyCar', dialogTitle: 'שיתוף MyCar' }); } catch (e) { /* closed */ } return; }
    if (navigator.share) { try { await navigator.share({ text }); } catch (e) { /* closed */ } return; }
    S.copy(text);
  };
  S.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); MC.toast('הועתק'); } catch (e) { MC.toast(text, 5000); }
  };

  // Where Android installed this app: the line with base.apk in the process memory map.
  async function installedApk() {
    const r = await MC.callRaw('Filesystem', 'readFile', { path: '/proc/self/maps', encoding: 'utf8' });
    const m = String((r && r.data) || '').match(/(\/data\/app\/\S+?\/base\.apk)/);
    if (!m) throw new Error('no base.apk');
    return m[1];
  }
  async function prepareFile() {
    try { await MC.callRaw('Filesystem', 'deleteFile', { path: FILE, directory: 'CACHE' }); } catch (e) { /* not there */ }
    try { await MC.callRaw('Filesystem', 'mkdir', { path: 'share', directory: 'CACHE', recursive: true }); } catch (e) { /* exists */ }
    try {
      await MC.callRaw('Filesystem', 'copy', { from: await installedApk(), to: FILE, toDirectory: 'CACHE' });
    } catch (e) {
      console.warn('apk copy', e && (e.message || e));
      if (!MC.online()) throw new Error('offline');
      MC.toast('מוריד את הקובץ…', 30000);
      await MC.callRaw('Filesystem', 'downloadFile', { url: MC.APK_URL, path: FILE, directory: 'CACHE', recursive: true });
    }
    const st = await MC.callRaw('Filesystem', 'stat', { path: FILE, directory: 'CACHE' });
    if (!st || st.size < 500000) throw new Error('small file');
    return (await MC.callRaw('Filesystem', 'getUri', { path: FILE, directory: 'CACHE' })).uri;
  }
  S.apk = async () => {
    if (!MC.isNative()) { window.open(MC.APK_URL, '_blank'); return true; }
    if (S.busy) return false;
    S.busy = true;
    MC.toast('מכין את הקובץ…', 8000);
    try {
      const uri = await prepareFile();
      const t = document.getElementById('toast-root'); if (t) t.innerHTML = '';
      await MC.callRaw('Share', 'share', { title: 'MyCar', text: S.message(), files: [uri], dialogTitle: 'שליחת האפליקציה כקובץ' });
      return true;
    } catch (e) {
      const msg = String(e && (e.message || e));
      if (/cancel/i.test(msg)) return false;
      console.warn('share apk', msg);
      MC.toast(msg === 'offline' ? 'אין אינטרנט כרגע. אפשר לשלוח קישור לאתר במקום' : 'לא הצלחתי להכין את הקובץ. אפשר לשלוח קישור לאתר במקום', 4000);
      return false;
    } finally {
      S.busy = false;
    }
  };

  // The sheet and its buttons.
  const row = (action, ic, cls, label, sub) => '<button type="button" class="row" data-action="' + action + '"><span class="tile' + (cls ? ' ' + cls : '') + '">' + ic + '</span>' +
    '<span class="grow"><span class="t">' + MC.esc(label) + '</span><span class="s">' + MC.esc(sub) + '</span></span>' + MC.icon('chevL', 'sm') + '</button>';
  MC.SHEETS.shareApp = {
    title: () => 'שיתוף האפליקציה',
    render: () => '<p class="fine" style="font-size:14px;margin-top:0">אפשר לשלוח לחברים קישור לאתר של MyCar, עם הסבר והורדה, או את האפליקציה עצמה כקובץ.</p>' +
      '<div class="card tight">' +
      row('share-app-link', ICON_LINK, '', 'שליחת קישור לאתר', 'הודעה קצרה עם הקישור, לוואטסאפ ולכל מקום') +
      row('share-app-apk', MC.icon('download'), 'green', 'שליחת האפליקציה כקובץ (APK)', 'בבלוטות\', בוואטסאפ או במנהל הקבצים. עובד גם בלי אינטרנט') +
      row('share-app-copy', ICON_COPY, 'orange', 'העתקת הקישור לאתר', SITE.replace(/^https:\/\//, '').replace(/\/$/, '')) +
      '</div>' +
      '<div class="card tight"><p class="fine" style="margin:6px 0">ההודעה שנשלחת:<br>' + MC.esc(S.text) + '<br><span dir="ltr">' + MC.esc(SITE) + '</span></p></div>'
  };
  MC.A['share-app'] = () => MC.openSheet('shareApp');
  MC.A['share-app-link'] = () => { MC.closeSheet(); S.link(); };
  MC.A['share-app-apk'] = () => { MC.closeSheet(); S.apk(); };
  MC.A['share-app-copy'] = () => { MC.closeSheet(); S.copy(SITE); };
})();
