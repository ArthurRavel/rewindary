// Builds docs/media/demo.gif from real screenshots of the production build (captured by `e2e.mjs --shots`).
import { readFileSync, readdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';
const { GIFEncoder, quantize, applyPalette } = gifenc;

const MEDIA = new URL('../docs/media/', import.meta.url).pathname;
const FRAMES = join(MEDIA, 'frames');
const files = readdirSync(FRAMES).filter((f) => /^\d+-(home|slide-)/.test(f)).sort();
const gif = GIFEncoder();
let size = '';
for (const f of files) {
  const png = PNG.sync.read(readFileSync(join(FRAMES, f)));
  size ||= `${png.width}x${png.height}`;
  if (`${png.width}x${png.height}` !== size) continue;
  const palette = quantize(png.data, 256);
  gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay: f.includes('home') ? 2200 : 1700 });
}
gif.finish();
writeFileSync(join(MEDIA, 'demo.gif'), gif.bytes());
for (const [src, dst] of [['share', 'share-card-review.png'], ['share-square', 'share-square.png'], ['review-upload', 'review-upload.png']]) {
  const f = readdirSync(FRAMES).find((x) => x.endsWith(`-${src}.png`));
  if (f) copyFileSync(join(FRAMES, f), join(MEDIA, dst));
}
console.log(`demo.gif: ${files.length} frames (${size}), ${(gif.bytes().length / 1024).toFixed(0)} KB`);
