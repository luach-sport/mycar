/* The phone's compass, for the arrow that points to the parked car (parking-ui.js).
   Android: the "absolute" orientation event (north-based). iPhone: webkitCompassHeading, after the
   user allows motion & orientation access (C.permit(), called from a tap). No internet needed. */
(function () {
  'use strict';
  const MC = window.MC;
  const C = (MC.compass = { heading: null, source: '' });
  let listeners = [];
  let active = false;
  let gotAbsolute = false;
  let last = 0;

  const screenAngle = () => {
    try { return (screen.orientation && screen.orientation.angle) || +window.orientation || 0; } catch (e) { return 0; }
  };
  const norm = (d) => ((d % 360) + 360) % 360;

  // Smooths the needle: moves part of the way to each new reading, the short way round.
  function set(h, src) {
    h = norm(h + screenAngle());
    if (C.heading == null || src !== C.source) C.heading = h;
    else C.heading = norm(C.heading + (norm(h - C.heading + 180) - 180) * 0.3);
    C.source = src;
    last = Date.now();
    listeners.forEach((cb) => { try { cb(C.heading); } catch (e) { console.warn(e); } });
  }
  function onAbsolute(e) {
    if (e.alpha == null) return;
    gotAbsolute = true;
    set(360 - e.alpha, 'absolute');
  }
  function onOrientation(e) {
    if (typeof e.webkitCompassHeading === 'number' && e.webkitCompassHeading >= 0) { set(e.webkitCompassHeading, 'ios'); return; }
    if (!gotAbsolute && e.absolute === true && e.alpha != null) set(360 - e.alpha, 'absolute');
  }

  // iPhone asks once before giving orientation; it must be asked from a tap. Resolves true when allowed.
  C.permit = () => {
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') return D.requestPermission().then((r) => r === 'granted').catch(() => false);
    } catch (e) { /* older phones need no permission */ }
    return Promise.resolve(true);
  };

  C.start = (cb) => {
    if (cb && !listeners.includes(cb)) listeners.push(cb);
    if (active) return;
    active = true;
    window.addEventListener('deviceorientationabsolute', onAbsolute, true);
    window.addEventListener('deviceorientation', onOrientation, true);
  };
  C.stop = (cb) => {
    listeners = cb ? listeners.filter((x) => x !== cb) : [];
    if (listeners.length || !active) return;
    active = false;
    window.removeEventListener('deviceorientationabsolute', onAbsolute, true);
    window.removeEventListener('deviceorientation', onOrientation, true);
    C.heading = null; C.source = ''; gotAbsolute = false; last = 0;
  };
  // True while readings keep coming (a phone without a compass never sends any).
  C.fresh = () => C.heading != null && Date.now() - last < 3000;
})();
