/* Sharing files from the web version and on iPhone: backup, export to Excel and pictures of a trip go to the
   phone's share sheet (save to Files, WhatsApp, mail…), or are downloaded where sharing files isn't possible.
   iPhone opens the share sheet only right after a tap, so when getting a file ready took a moment, a small
   window asks for one more tap. The Android app shares through its own plugin. Loaded after app.js. */
(function () {
  'use strict';
  const MC = window.MC;
  let pending = null;

  MC.downloadFiles = (files) => {
    (files || []).forEach((f, i) => setTimeout(() => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(f); a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, i * 500));
  };

  const canShare = (files) => { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files })); } catch (e) { return false; } };
  const payload = (d) => (d.title ? { files: d.files, title: d.title } : { files: d.files });

  // d: { files, title, preview? (picture shown in the "ready" window) }.
  // Resolves to 'shared', 'cancelled', 'asked' (the "ready" window is open) or 'saved' (downloaded).
  MC.webShare = async (d) => {
    if (canShare(d.files)) {
      try { await navigator.share(payload(d)); return 'shared'; } catch (e) {
        if (e && e.name === 'AbortError') return 'cancelled';
        if (e && e.name === 'NotAllowedError') { pending = d; MC.openSheet('shareReady'); return 'asked'; }
        console.warn('share', e && e.name, e && e.message);
      }
    }
    MC.downloadFiles(d.files);
    return 'saved';
  };

  MC.SHEETS.shareReady = {
    title: () => (pending && pending.title) || 'מוכן לשיתוף',
    render: () => {
      const d = pending || { files: [] };
      const n = (d.files || []).length;
      return (d.preview ? '<img src="' + MC.esc(d.preview) + '" alt="" style="display:block;width:100%;border-radius:16px;border:1px solid var(--line)">' : '') +
        '<div class="notice gray">' + MC.icon('check', 'sm') + '<span class="grow">' + (n > 1 ? n + ' קבצים מוכנים.' : 'מוכן.') + ' לוחצים "שיתוף" ובוחרים לאן לשלוח או איפה לשמור.</span></div>' +
        '<button type="button" class="btn" data-action="share-ready">' + MC.icon('share') + 'שיתוף</button>' +
        '<button type="button" class="btn secondary" data-action="share-ready-save">' + MC.icon('download') + 'הורדה לטלפון</button>';
    }
  };
  MC.A['share-ready'] = () => {
    const d = pending; pending = null; MC.closeSheet();
    if (d) navigator.share(payload(d)).catch((e) => { if (!e || e.name !== 'AbortError') MC.downloadFiles(d.files); });
  };
  MC.A['share-ready-save'] = () => { const d = pending; pending = null; MC.closeSheet(); if (d) MC.downloadFiles(d.files); };
})();
