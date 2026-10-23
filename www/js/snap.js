/* MyCar screen snapshots: draws a piece of the screen into a PNG for sharing.
   Works offline and never sends anything anywhere; the picture is only handed to the share sheet. */
(function () {
  'use strict';
  const MC = window.MC;
  let cssCache = null;

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }
  async function fileDataUrl(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error('fetch ' + path);
    return blobToDataUrl(await r.blob());
  }

  // The app stylesheet with its font embedded, so the picture looks exactly like the screen.
  async function styles() {
    if (cssCache) return cssCache;
    let css = await (await fetch('styles.css')).text();
    const urls = [...new Set([...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]).filter((u) => !/^data:/.test(u)))];
    for (const u of urls) {
      try { css = css.split(u).join(await fileDataUrl(u)); } catch (e) { /* fall back to system font */ }
    }
    cssCache = css.replace(/\]\]>/g, '');
    return cssCache;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('image'));
      img.src = src;
    });
  }

  // nodes: elements to place in the picture, top to bottom. Returns a PNG data URL.
  MC.snap = async (nodes, opts) => {
    opts = opts || {};
    const width = opts.width || 400;
    const scale = opts.scale || 2.5;
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const css = await styles();

    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;top:0;left:-20000px;width:' + width + 'px;pointer-events:none;';
    const card = document.createElement('div');
    card.className = 'snap';
    card.setAttribute('dir', 'rtl');
    nodes.forEach((n) => card.appendChild(n));
    const foot = document.createElement('div');
    foot.className = 'snap-foot';
    foot.innerHTML = '<img alt="" src="icon.png"><span><b>MyCar</b> · עד הטיפה האחרונה</span>';
    card.appendChild(foot);
    host.appendChild(card);
    document.body.appendChild(host);
    try {
      for (const img of card.querySelectorAll('img')) {
        try { img.setAttribute('src', await fileDataUrl(img.getAttribute('src'))); } catch (e) { img.remove(); }
      }
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* ignore */ } }
      MC.fitText(card);
      const height = Math.ceil(card.getBoundingClientRect().height);
      const xhtml = new XMLSerializer().serializeToString(card);
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" data-theme="' + theme + '">' +
        '<style><![CDATA[' + css + ']]></style>' +
        '<foreignObject x="0" y="0" width="' + width + '" height="' + height + '">' + xhtml + '</foreignObject></svg>';
      const img = await loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
      await MC.sleep(60); // let the embedded font settle before drawing
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      return canvas.toDataURL('image/png');
    } finally {
      host.remove();
    }
  };

  // Hands a PNG data URL to the phone's share sheet (WhatsApp, gallery, etc.).
  MC.shareImage = async (dataUrl, name, title) => {
    const b64 = dataUrl.split(',')[1];
    if (MC.isNative()) {
      const w = await MC.callRaw('Filesystem', 'writeFile', { path: name, data: b64, directory: 'CACHE' });
      try { await MC.callRaw('Share', 'share', { title, files: [w.uri], dialogTitle: title }); } catch (e) {
        if (!/cancel/i.test(String(e && e.message))) throw e;
      }
      return true;
    }
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); } catch (e) { /* cancelled */ }
      return true;
    }
    const a = document.createElement('a');
    a.href = dataUrl; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return true;
  };
})();
