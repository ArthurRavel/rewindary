// Static privacy scan of the production build: no remote URLs, no network APIs, strict CSP present.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = walk(DIST);
const problems = [];

// URLs that are data, not requests: SVG/XML namespaces, the synthetic export data in the demo generator,
// the one link to the source code (src/site.ts), which is only followed if the visitor clicks it, and the
// app's own address and preview image in the link-preview tags, which only link unfurlers read.
const APP_URL = 'https://arthurravel.github.io/rewindary/';
const ALLOWED_URL = /^https?:\/\/(www\.w3\.org\/|www\.youtube\.com\/(watch\?v=demo|channel\/demo|results\?search_query=demo)|music\.youtube\.com\/watch\?v=demo)|^https:\/\/github\.com\/ArthurRavel\/rewindary$/;
const PREVIEW_URL = /^https:\/\/arthurravel\.github\.io\/rewindary\/(og\.jpg)?$/; // index.html only
const NETWORK = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /new WebSocket/, /EventSource/, /RTCPeerConnection/, /importScripts/, /serviceWorker\.register/];

for (const f of files) {
  if (!/\.(js|css|html|svg)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) if (!ALLOWED_URL.test(m[0]) && !(f.endsWith('/index.html') && PREVIEW_URL.test(m[0]))) problems.push(`${f}: remote URL ${m[0]}`);
  for (const re of NETWORK) if (re.test(text)) problems.push(`${f}: network API ${re}`);
  if (/\/\/[a-z0-9.-]+\.(com|net|io|org|dev|app)\//i.test(text.replace(/https?:\/\/[^\s"'`]+/g, ''))) problems.push(`${f}: protocol-relative URL`);
}
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!/http-equiv="Content-Security-Policy"[^>]*connect-src 'none'/.test(html)) problems.push('index.html: missing CSP with connect-src none');
if (/<script(?![^>]*src=)/.test(html)) problems.push('index.html: inline script');
if (/<link[^>]+href="https?:/.test(html)) problems.push('index.html: remote stylesheet/font');
// Link previews: absolute URLs only inside og:url / og:image, both on the app's own address, and the image ships.
const meta = (key) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1];
if (meta('og:url') !== APP_URL || meta('og:image') !== APP_URL + 'og.jpg' || meta('twitter:card') !== 'summary_large_image' || !meta('og:title') || !meta('og:description')) problems.push('index.html: link-preview tags missing or not on the app address');
const urlsInHtml = [...html.matchAll(/https:\/\/arthurravel\.github\.io[^\s"]*/g)].length;
if (urlsInHtml !== 2) problems.push(`index.html: the app address appears ${urlsInHtml} times, expected only og:url and og:image`);
try {
  const jpg = readFileSync(join(DIST, 'og.jpg'));
  let size = null; // width × height from the first SOF marker
  for (let i = 2; i + 9 < jpg.length && !size; ) {
    const marker = jpg[i + 1];
    if (jpg[i] !== 0xff) break;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) size = `${jpg.readUInt16BE(i + 7)}x${jpg.readUInt16BE(i + 5)}`;
    else i += 2 + jpg.readUInt16BE(i + 2);
  }
  if (jpg[0] !== 0xff || jpg[1] !== 0xd8 || size !== '1200x630') problems.push(`og.jpg: expected a 1200x630 JPEG, got ${size}`);
  if (jpg.length > 300_000) problems.push(`og.jpg: ${jpg.length} bytes, keep it under 300 KB so messengers still unfurl it`);
} catch {
  problems.push('og.jpg: missing from the build');
}

if (problems.length) {
  console.error('Privacy scan FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Privacy scan passed: ${files.length} files, no remote URLs or network APIs, strict CSP present.`);
