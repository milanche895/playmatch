/**
 * Builds the Plejko brand assets (transparent PNGs + PWA icons) from the master logo artwork.
 *
 *   node scripts/build-brand-assets.js <path-to-master-logo.png>
 *
 * Outputs:
 *   public/brand/plejko-logo.png         full stacked lockup (mark + wordmark), transparent
 *   public/brand/plejko-logo-light.png   same, recoloured for dark backgrounds
 *   public/brand/plejko-mark.png         mark only (figure + swoosh + ball), transparent
 *   public/brand/plejko-mark-light.png   mark only, for dark backgrounds
 *   public/brand/plejko-wordmark.png     "Plejko" only, transparent
 *   public/brand/plejko-wordmark-light.png
 *   public/icons/icon-192.png, icon-512.png, apple-touch-icon.png, public/favicon.png  (white tile + mark)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = process.argv[2];
if (!SRC) {
  console.error('Usage: node scripts/build-brand-assets.js <master-logo.png>');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const brandDir = path.join(root, 'public', 'brand');
const iconsDir = path.join(root, 'public', 'icons');
fs.mkdirSync(brandDir, { recursive: true });
fs.mkdirSync(iconsDir, { recursive: true });

// Regions in the 1024x768 master (x0, y0, x1, y1 inclusive)
const LOCKUP = [226, 122, 798, 646];
const MARK = [322, 122, 716, 461];
const WORDMARK = [226, 462, 798, 646];

async function main() {
  const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const idx = (x, y) => (y * w + x) * 4;

  // 1) Outside background = near-white pixels connected to the image border
  const outside = new Uint8Array(w * h);
  const stack = [];
  const isBg = (x, y) => {
    const i = idx(x, y);
    return Math.min(data[i], data[i + 1], data[i + 2]) >= 236;
  };
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = y * w + x;
    if (outside[k] || !isBg(x, y)) return;
    outside[k] = 1;
    stack.push(k);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const k = stack.pop();
    const x = k % w;
    const y = (k - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  // 2) Edge band: pixels within 3px of the outside region get colour-to-alpha (anti-aliased edges)
  // Everything except the ball gets colour-to-alpha, so enclosed white counters (o, e, P) are transparent too;
  // the ball keeps its opaque white panels.
  const BALL = [598, 352, 722, 466];
  const inBallBox = (x, y) => x >= BALL[0] && x <= BALL[2] && y >= BALL[1] && y <= BALL[3];
  const band = new Uint8Array(w * h);
  const R = 3;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (outside[y * w + x] || !inBallBox(x, y)) {
        band[y * w + x] = 1;
        continue;
      }
      let near = false;
      for (let dy = -R; dy <= R && !near; dy++) {
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < w && yy < h && outside[yy * w + xx]) { near = true; break; }
        }
      }
      if (near) band[y * w + x] = 1;
    }
  }

  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      let a = 255;
      if (band[y * w + x]) {
        const alpha = Math.max(255 - r, 255 - g, 255 - b) / 255;
        if (alpha < 0.035) {
          a = 0;
          r = g = b = 255;
        } else {
          a = Math.round(Math.min(1, alpha) * 255);
          r = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - alpha)) / alpha)));
          g = Math.max(0, Math.min(255, Math.round((g - 255 * (1 - alpha)) / alpha)));
          b = Math.max(0, Math.min(255, Math.round((b - 255 * (1 - alpha)) / alpha)));
        }
      }
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a;
    }
  }

  // 3) Light variant for dark backgrounds: navy -> white (the ball keeps its look)
  const light = Buffer.from(out);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = idx(x, y);
      if (light[i + 3] === 0) continue;
      if (inBallBox(x, y)) continue;
      const g = light[i + 1];
      const wgt = Math.max(0, Math.min(1, (125 - g) / 60));
      if (wgt > 0) {
        light[i] = Math.round(light[i] + (255 - light[i]) * wgt);
        light[i + 1] = Math.round(light[i + 1] + (255 - light[i + 1]) * wgt);
        light[i + 2] = Math.round(light[i + 2] + (255 - light[i + 2]) * wgt);
      }
    }
  }

  const raw = { raw: { width: w, height: h, channels: 4 } };
  const crop = (buf, [x0, y0, x1, y1]) =>
    sharp(buf, raw).extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });

  // The "j" dot sits right below the ball: keep the mark crop clean of it
  const cleanMark = (buf) => {
    const copy = Buffer.from(buf);
    for (let y = 440; y <= MARK[3]; y++) {
      for (let x = 470; x <= 610; x++) {
        const i = idx(x, y);
        if (y >= 458) copy[i + 3] = 0;
      }
    }
    return copy;
  };
  const cleanedDark = cleanMark(out);
  const cleanedLight = cleanMark(light);

  // extract and trim must run in separate pipelines
  const trimmed = async (img) => {
    const cropped = await img.png().toBuffer();
    return sharp(cropped).trim({ threshold: 1 });
  };
  const save = async (img, file, pad = 0) => {
    const p = (await trimmed(img)).png();
    const { data: d, info: i } = await p.toBuffer({ resolveWithObject: true });
    let s = sharp(d);
    if (pad) s = s.extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } });
    await s.png({ compressionLevel: 9 }).toFile(file);
    console.log('wrote', path.relative(root, file), i.width + 'x' + i.height);
  };

  await save(crop(out, LOCKUP), path.join(brandDir, 'plejko-logo.png'), 8);
  await save(crop(light, LOCKUP), path.join(brandDir, 'plejko-logo-light.png'), 8);
  await save(crop(cleanedDark, MARK), path.join(brandDir, 'plejko-mark.png'), 6);
  await save(crop(cleanedLight, MARK), path.join(brandDir, 'plejko-mark-light.png'), 6);
  await save(crop(out, WORDMARK), path.join(brandDir, 'plejko-wordmark.png'), 6);
  await save(crop(light, WORDMARK), path.join(brandDir, 'plejko-wordmark-light.png'), 6);

  // 4) PWA / favicon tiles: white full-bleed square + mark (maskable-safe: mark within 62% of the tile)
  const markBuf = await (await trimmed(crop(cleanedDark, MARK))).png().toBuffer();
  for (const [size, file] of [
    [512, 'icon-512.png'],
    [192, 'icon-192.png'],
    [180, 'apple-touch-icon.png'],
  ]) {
    const inner = Math.round(size * 0.62);
    const resized = await sharp(markBuf).resize({ width: inner, height: inner, fit: 'inside' }).png().toBuffer();
    const meta = await sharp(resized).metadata();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#FFFFFF' } })
      .composite([{ input: resized, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2) }])
      .png({ compressionLevel: 9 })
      .toFile(path.join(iconsDir, file));
    console.log('wrote', path.join('public', 'icons', file));
  }
  fs.copyFileSync(path.join(iconsDir, 'icon-192.png'), path.join(root, 'public', 'favicon.png'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
