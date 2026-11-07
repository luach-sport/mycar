/* MyCar in a browser and on iPhone (added to the home screen from Safari). Does nothing in the Android app.
   - Keeps a full copy of the app on the phone (sw.js), so it opens and works without internet.
   - A new version downloads quietly and switches in the next time the app comes back to the screen.
   - Asks the browser to keep the app's data (trips, refuels) even when the phone runs low on space.
   Loaded after app.js. */
(function () {
  'use strict';
  const MC = window.MC;
  const native = MC.isNative();
  const ua = navigator.userAgent || '';
  const iOS = !native && (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const standalone = !native && (navigator.standalone === true || !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches));

  MC.isIOS = () => iOS;
  MC.isStandalone = () => standalone;
  MC.deviceName = () => (native ? 'אנדרואיד' : iOS ? (standalone ? 'אייפון (מסך הבית)' : 'אייפון (ספארי)') : standalone ? 'אפליקציית רשת' : 'דפדפן');
  if (native) return;

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* not supported */ }

  // The website's screenshots are taken in an automated browser: no offline copy there.
  if (!('serviceWorker' in navigator) || navigator.webdriver || !window.isSecureContext) return;
  const hadCopy = !!navigator.serviceWorker.controller;
  let fresh = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCopy) fresh = true; });
  // Switch to the new version only when nothing is half done on screen (an open window or a result).
  const quiet = () => { const m = window.__mycar; return !m || (!m.ui.sheet && m.ui.view !== 'result'); };

  const start = () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { if (MC.state) MC.saveRaw(MC.state, true); return; }
        if (fresh && quiet()) { location.reload(); return; }
        reg.update().catch(() => {});
      });
    }).catch((e) => console.warn('offline copy', e && e.message));
  };
  if (document.readyState === 'complete') start(); else window.addEventListener('load', start);
})();
