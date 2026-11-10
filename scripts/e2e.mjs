// End-to-end test of the production build in real Chromium.
// Fails on: any request outside the app's own URL, CSP violations, page errors, unredacted card output.
// By default it serves dist/ under /rewindary/ like GitHub Pages. Set E2E_URL to test a deployed copy instead,
// e.g. E2E_URL=https://arthurravel.github.io/rewindary/ node scripts/e2e.mjs
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zipSync } from 'fflate';
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = process.argv.includes('--shots') ? join(ROOT, 'docs/media/frames') : null;
const fx = (p) => readFileSync(join(ROOT, 'tests/fixtures', p));
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? '  ✓' : '  ✗'} ${msg}`); if (!ok) failures++; };

const local = process.env.E2E_URL ? null : await serve(join(ROOT, 'dist'), 0, '/rewindary/');
// App root URL; a bare directory like ".../rewindary" is treated as ".../rewindary/" so the request allow-list stays narrow.
const remote = process.env.E2E_URL ? new URL(process.env.E2E_URL) : null;
if (remote && !/\.[a-z0-9]+$/i.test(remote.pathname)) remote.pathname = remote.pathname.replace(/\/?$/, '/');
const app = remote ? new URL('./', remote).href : local.url;
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: 400, height: 760 }, deviceScaleFactor: 1, acceptDownloads: true });
const page = await ctx.newPage();
const external = [];
const errors = [];
page.on('request', (r) => { if (!r.url().startsWith(app) && !/^(blob|data):/.test(r.url())) external.push(r.url()); });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.addInitScript(() => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
});
let shot = 0;
const snap = async (name) => {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${String(shot++).padStart(2, '0')}-${name}.png`) });
};

console.log('Demo flow');
await page.goto(app);
await page.getByTestId('demo').waitFor();
await snap('home');
await page.getByTestId('demo').click();
await page.getByTestId('reports').waitFor();
check((await page.getByTestId('reports').locator('li').count()) === 4, 'demo produces 4 parsed export files');
const receipt = page.getByTestId('receipt');
check(/No requests to other sites recorded/.test(await receipt.innerText()) && (await page.getByTestId('receipt-external').innerText()) === 'none' && (await page.getByTestId('receipt-blocked').innerText()) === 'none', 'privacy receipt reports no external or blocked requests after the demo');
await page.getByTestId('play').click();
const slideIds = [];
let changeText = '';
for (let i = 0; i < 20; i++) {
  const id = await page.locator('.story').getAttribute('data-slide');
  slideIds.push(id);
  await page.waitForTimeout(1100);
  await snap(`slide-${id}`);
  if (id === 'change') changeText = `${await page.getByTestId('change-total').innerText()}\n${await page.locator('.slide').innerText()}`;
  if (id === 'end') break;
  await page.locator('.tap.next').click();
}
check(['intro', 'total', 'change', 'clock', 'seasons', 'busiest', 'spotify', 'youtube', 'netflix', 'rhythm', 'persona', 'end'].every((s) => slideIds.includes(s)), `story slides: ${slideIds.join(', ')}`);
check(/Compared with 2024/.test(changeText) && /^\+\d+%\n/.test(changeText) && /from Jan 1 to Dec \d+ in both years/.test(changeText) && (changeText.match(/ → /g) ?? []).length === 3, `year-over-year slide compares 2025 with the same dates of 2024, per source: ${JSON.stringify(changeText.split('\n').slice(0, 3))}`);
await page.getByText('Create share card').click();
await page.setViewportSize({ width: 1280, height: 860 });
await page.getByTestId('card-preview').waitFor();
await page.waitForFunction(() => document.querySelector('[data-testid=card-preview]')?.complete);
await snap('share');
const review = await page.getByTestId('review').locator('ul').innerText();
check((review.match(/•••••/g) ?? []).length === 3, 'review lists 3 hidden names by default');
check(!/(January|February|March|April|May|June|July|August|September|October|November|December) \d/.test(review), 'no exact dates listed by default');
const dl1 = page.waitForEvent('download');
check(await page.getByText('Download PNG').isDisabled(), 'download disabled until the review is confirmed');
await page.getByTestId('confirm-review').check();
await page.getByText('Download PNG').click();
const png = readFileSync(await (await dl1).path());
check(png.subarray(1, 4).toString() === 'PNG' && png.length > 20_000, `PNG exported (${png.length} bytes)`);
check(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1920, 'PNG is 1080×1920');
const dl2 = page.waitForEvent('download');
await page.getByRole('button', { name: 'SVG' }).click();
const svg = readFileSync(await (await dl2).path(), 'utf8');
const demoNames = ['Velvet Static', 'Mira Calloway', 'Bench Lab Builds', 'Slow Kitchen', 'Lighthouse Accord', 'Copper Valley', 'Harbor Lights', 'Sam', 'Guest'];
check(!demoNames.some((n) => svg.includes(n)), 'default SVG card contains no artist, channel, show or profile names');
await page.locator('.reveal input').first().check();
const dl3 = page.waitForEvent('download');
await page.getByRole('button', { name: 'SVG' }).click();
const svg2 = readFileSync(await (await dl3).path(), 'utf8');
check(demoNames.some((n) => svg2.includes(n)), 'opting in reveals exactly the chosen name');
await page.getByRole('button', { name: 'Square 1:1' }).click();
await page.getByRole('button', { name: 'Paper' }).click();
await page.waitForTimeout(400);
await snap('share-square');

console.log('Real-format fixture upload');
const dir = mkdtempSync(join(tmpdir(), 'rewindary-e2e-'));
writeFileSync(join(dir, 'takeout-synthetic.zip'), zipSync({
  'Takeout/YouTube and YouTube Music/history/watch-history.html': fx('google/watch-history.html'),
  'Takeout/YouTube and YouTube Music/history/search-history.json': fx('google/search-history.json'),
  'Takeout/My Activity/Search/MyActivity.json': fx('google/MyActivity-search.json'),
  'Takeout/YouTube and YouTube Music/videos/holiday.mp4': new Uint8Array(50_000),
}));
writeFileSync(join(dir, 'my_spotify_data.zip'), zipSync({ 'Spotify Extended Streaming History/Streaming_History_Audio_2024-2025_0.json': fx('spotify/Streaming_History_Audio_2024-2025_0.json') }));
writeFileSync(join(dir, 'ViewingActivity.csv'), fx('netflix/ViewingActivity.csv'));
await page.setViewportSize({ width: 400, height: 760 });
await page.goto(app);
await page.getByTestId('file-input').setInputFiles(['takeout-synthetic.zip', 'my_spotify_data.zip', 'ViewingActivity.csv'].map((f) => join(dir, f)));
await page.getByTestId('reports').waitFor();
const reports = await page.getByTestId('reports').innerText();
check(/Spotify extended/.test(reports) && /Takeout activity \(HTML\)/.test(reports) && /Takeout activity \(JSON\)/.test(reports) && /Netflix viewing activity/.test(reports), 'all three adapters recognised the uploaded files (zip + csv, HTML + JSON)');
check(!/Not recognised/.test(reports), 'no files rejected');
check((await page.getByTestId('receipt-external').innerText()) === 'none', 'privacy receipt reports no external requests after parsing real-format files');
await snap('review-upload');
await page.getByTestId('play').click();
await page.locator('.story').waitFor();
const ids = [];
for (let i = 0; i < 15; i++) {
  const id = await page.locator('.story').getAttribute('data-slide');
  ids.push(id);
  if (id === 'end') break;
  await page.locator('.tap.next').click();
}
check(['spotify', 'youtube', 'netflix', 'google'].every((s) => ids.includes(s)), `uploaded data produces source slides: ${ids.join(', ')}`);

console.log('Privacy invariants');
const blocked = await page.evaluate(() => fetch('https://example.com/collect').then(() => 'sent', () => 'blocked'));
check(blocked === 'blocked', 'CSP blocks a deliberate fetch() to a remote host');
await page.waitForFunction(() => window.__csp.length > 0, null, { timeout: 3000 }).catch(() => {});
const csp = await page.evaluate(() => window.__csp);
check(csp.length === 1 && csp[0].startsWith('connect-src'), `only the deliberate request violated CSP (${csp.join(' | ')})`);
await page.getByRole('button', { name: 'Close story' }).click();
await page.getByTestId('receipt-recheck').click();
const blockedLine = await page.getByTestId('receipt-blocked').innerText();
check(/^1 attempt \(example\.com\)$/.test(blockedLine) && !/collect/.test(blockedLine), `privacy receipt surfaces the blocked attempt by host only (${blockedLine})`);
check((await page.getByTestId('receipt-external').innerText()) === 'none' && (await page.getByTestId('receipt-stored').innerText()) === 'nothing', 'privacy receipt still shows no external requests and nothing stored');
check(external.length === 0, `no request left ${app} (${external.length} external${external.length ? ': ' + external.join(' | ') : ''})`);
const storage = await page.evaluate(() => [localStorage.length, sessionStorage.length, document.cookie.length, indexedDB.databases ? 'idb' : '']);
check(storage[0] === 0 && storage[1] === 0 && storage[2] === 0, 'nothing written to localStorage, sessionStorage or cookies');
const unexpected = errors.filter((e) => !/example\.com|Content Security Policy|Failed to fetch/.test(e));
check(unexpected.length === 0, `no page errors${unexpected.length ? ': ' + unexpected.join(' | ') : ''}`);

await browser.close();
local?.server.close();
if (failures) {
  console.error(`\n${failures} e2e check(s) failed`);
  process.exit(1);
}
console.log('\nAll e2e checks passed.');
