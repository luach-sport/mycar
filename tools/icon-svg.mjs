// MyCar icon artwork: a white fuel drop holding a dashboard fuel gauge.
// Exported helpers build the SVG for every size/shape the app needs.
export const COLORS = { bg: '#1652F0', bgDeep: '#0F43D6', drop: '#FFFFFF', track: '#D9E4FF', fuel: '#F55A00', ink: '#0B1220' };

// Glyph drawn in a 1000x1000 box.
export function glyph({ mono = false } = {}) {
  const c = COLORS;
  const cx = 500, cy = 650, r = 200, sw = 70;
  const pt = (deg, rad) => [cx + rad * Math.cos((deg * Math.PI) / 180), cy - rad * Math.sin((deg * Math.PI) / 180)];
  const [x0, y0] = pt(180, r), [x1, y1] = pt(0, r);
  const fuelTo = 38; // degrees: gauge almost full
  const [fx, fy] = pt(fuelTo, r);
  const [nx, ny] = pt(fuelTo + 6, r - 62);
  const drop = 'M500 70 C500 70 196 410 196 612 A304 304 0 0 0 804 612 C804 410 500 70 500 70 Z';
  if (mono) {
    // single-colour silhouette (for notification icon previews)
    return `<path d="${drop}" fill="#fff"/>`;
  }
  return `
    <path d="${drop}" fill="${c.drop}"/>
    <path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="${c.track}" stroke-width="${sw}" stroke-linecap="round"/>
    <path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${fx.toFixed(1)} ${fy.toFixed(1)}" fill="none" stroke="${c.fuel}" stroke-width="${sw}" stroke-linecap="round"/>
    <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${c.ink}" stroke-width="40" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="54" fill="${c.ink}"/>
    <circle cx="${cx}" cy="${cy}" r="19" fill="${c.drop}"/>`;
}

// shape: 'square' (rounded), 'circle', 'none' (transparent, adaptive foreground)
// scale: glyph size as a fraction of the canvas
export function iconSvg({ size = 1024, shape = 'square', scale = 0.7, bg = true } = {}) {
  const c = COLORS;
  const g = size * scale;
  const off = (size - g) / 2;
  let back = '';
  if (bg && shape === 'square') back = `<rect width="${size}" height="${size}" rx="${size * 0.225}" fill="url(#bgG)"/>`;
  if (bg && shape === 'circle') back = `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="url(#bgG)"/>`;
  if (bg && shape === 'full') back = `<rect width="${size}" height="${size}" fill="url(#bgG)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="bgG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.bg}"/><stop offset="1" stop-color="${c.bgDeep}"/></linearGradient></defs>
  ${back}
  <g transform="translate(${off} ${off}) scale(${g / 1000})">${glyph()}</g>
</svg>`;
}
