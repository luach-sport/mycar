// Generates every MyCar icon from tools/icon-svg.mjs.
// Run: node tools/make-icons.mjs   (uses sharp; outputs are committed, CI does not need it)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconSvg, COLORS } from './icon-svg.mjs';

const require = createRequire(process.env.SHARP_FROM || '/opt/npm-tools/node_modules/');
const sharp = require('sharp');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android-res');

async function png(svg, file) {
  mkdirSync(dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
}
function text(file, content) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, content); }

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, m] of Object.entries(DENS)) {
  const legacy = Math.round(48 * m), fg = Math.round(108 * m);
  await png(iconSvg({ size: legacy, shape: 'square', scale: 0.76 }), join(RES, 'mipmap-' + name, 'ic_launcher.png'));
  await png(iconSvg({ size: legacy, shape: 'circle', scale: 0.7 }), join(RES, 'mipmap-' + name, 'ic_launcher_round.png'));
  await png(iconSvg({ size: fg, shape: 'none', scale: 0.64, bg: false }), join(RES, 'mipmap-' + name, 'ic_launcher_foreground.png'));
}
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
text(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
text(join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
text(join(RES, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${COLORS.bg}</color>
</resources>
`);
text(join(RES, 'drawable', 'splash.xml'), `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item>
        <color android:color="${COLORS.bg}" />
    </item>
    <item
        android:width="180dp"
        android:height="180dp"
        android:gravity="center"
        android:drawable="@mipmap/ic_launcher_foreground" />
</layer-list>
`);
// Status-bar notification icon: the drop, white on transparent.
text(join(RES, 'drawable', 'ic_stat_mycar.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- MyCar notification icon: fuel drop with a gauge window -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFFFF"
        android:fillType="evenOdd"
        android:pathData="M12,1.7C12,1.7 4.7,9.8 4.7,14.7A7.3,7.3 0,0 0,19.3 14.7C19.3,9.8 12,1.7 12,1.7Z M8.2,15.6A3.8,3.8 0,0 1,15.8 15.6L14.2,15.6A2.2,2.2 0,0 0,9.8 15.6Z" />
</vector>
`);
await png(iconSvg({ size: 192, shape: 'square', scale: 0.76 }), join(ROOT, 'www', 'icon.png'));
await png(iconSvg({ size: 512, shape: 'square', scale: 0.76 }), join(ROOT, 'www', 'icon-512.png'));
await png(iconSvg({ size: 1024, shape: 'square', scale: 0.76 }), join(ROOT, 'assets', 'icon-1024.png'));
writeFileSync(join(ROOT, 'www', 'logo.svg'), iconSvg({ size: 256, shape: 'square', scale: 0.76 }));
console.log('icons done');
