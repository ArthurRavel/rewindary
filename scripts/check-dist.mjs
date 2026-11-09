// Static privacy scan of the production build: no remote URLs, no network APIs, strict CSP present.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const files = walk(DIST);
const problems = [];

// URLs that are data, not requests: SVG/XML namespaces and the synthetic export data in the demo generator.
const ALLOWED_URL = /^https?:\/\/(www\.w3\.org\/|www\.youtube\.com\/(watch\?v=demo|channel\/demo|results\?search_query=demo))/;
const NETWORK = [/\bfetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /new WebSocket/, /EventSource/, /RTCPeerConnection/, /importScripts/, /serviceWorker\.register/];

for (const f of files) {
  if (!/\.(js|css|html|svg)$/.test(f)) continue;
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) if (!ALLOWED_URL.test(m[0])) problems.push(`${f}: remote URL ${m[0]}`);
  for (const re of NETWORK) if (re.test(text)) problems.push(`${f}: network API ${re}`);
  if (/\/\/[a-z0-9.-]+\.(com|net|io|org|dev|app)\//i.test(text.replace(/https?:\/\/[^\s"'`]+/g, ''))) problems.push(`${f}: protocol-relative URL`);
}
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
if (!/http-equiv="Content-Security-Policy"[^>]*connect-src 'none'/.test(html)) problems.push('index.html: missing CSP with connect-src none');
if (/<script(?![^>]*src=)/.test(html)) problems.push('index.html: inline script');
if (/<link[^>]+href="https?:/.test(html)) problems.push('index.html: remote stylesheet/font');

if (problems.length) {
  console.error('Privacy scan FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log(`Privacy scan passed: ${files.length} files, no remote URLs or network APIs, strict CSP present.`);
