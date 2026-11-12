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
// The copy check reads the card back from the clipboard; this only affects the test browser.
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(app).origin });
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
const SOURCE_URL = 'https://github.com/ArthurRavel/rewindary';
const SITE_ADDRESS = 'arthurravel.github.io/rewindary';
const linkOk = async (l) => (await l.getAttribute('href')) === SOURCE_URL && (await l.getAttribute('target')) === '_blank' && (await l.getAttribute('rel')) === 'noopener noreferrer';
check(await linkOk(page.getByTestId('source-link')), 'start page links to the source code in a new tab, without referrer or opener');
const og = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]')].map((m) => [m.getAttribute('property') ?? m.getAttribute('name'), m.content])));
check(og['og:url'] === `https://${SITE_ADDRESS}/` && og['og:image'] === `https://${SITE_ADDRESS}/og.jpg` && og['twitter:card'] === 'summary_large_image' && /Apple Music/.test(og['og:description']), `link-preview tags point at the app's own address (${og['og:image']})`);
// Crawlers fetch the image from the deployed address; here it is fetched from wherever this run serves the app.
const ogImage = await page.request.get(new URL('og.jpg', app).href);
const ogBody = await ogImage.body();
check(ogImage.ok() && ogImage.headers()['content-type'] === 'image/jpeg' && ogBody[0] === 0xff && ogBody[1] === 0xd8 && ogBody.length < 300_000, `the preview image is served next to the app (${ogBody.length} bytes)`);
check(!(await page.evaluate(() => performance.getEntriesByType('resource').some((e) => e.name.includes('og.jpg')))), 'the page itself never loads the preview image');
await page.getByTestId('demo').click();
await page.getByTestId('reports').waitFor();
check((await page.getByTestId('reports').locator('li').count()) === 5, 'demo produces 5 parsed export files (Spotify, Apple Music, 2 Takeout, Netflix)');
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
  if (id === 'end') {
    check(await linkOk(page.locator('.slide.end').getByTestId('source-link')), 'the end of the story links to the source code in a new tab');
    break;
  }
  await page.locator('.tap.next').click();
}
check(['intro', 'total', 'change', 'clock', 'seasons', 'busiest', 'spotify', 'applemusic', 'youtube', 'netflix', 'rhythm', 'persona', 'end'].every((s) => slideIds.includes(s)), `story slides: ${slideIds.join(', ')}`);
check(/Compared with 2024/.test(changeText) && /^\+\d+%\n/.test(changeText) && /from Jan 1 to Dec \d+ in both years/.test(changeText) && (changeText.match(/ → /g) ?? []).length === 4, `year-over-year slide compares 2025 with the same dates of 2024, for each of the 4 sources: ${JSON.stringify(changeText.split('\n').slice(0, 3))}`);
await page.getByText('Create share card').click();
await page.setViewportSize({ width: 1280, height: 860 });
await page.getByTestId('card-preview').waitFor();
await page.waitForFunction(() => document.querySelector('[data-testid=card-preview]')?.complete);
await snap('share');
const review = await page.getByTestId('review').locator('ul').innerText();
check((review.match(/•••••/g) ?? []).length === 3, 'review lists 3 hidden names by default');
check(!/(January|February|March|April|May|June|July|August|September|October|November|December) \d/.test(review), 'no exact dates listed by default');
check((await page.getByTestId('review-footer').innerText()).includes(SITE_ADDRESS), 'the review lists the card footer with the app address');
const dl1 = page.waitForEvent('download');
check(await page.getByText('Download PNG').isDisabled() && await page.getByTestId('copy-image').isDisabled(), 'download and copy disabled until the review is confirmed');
await page.getByTestId('confirm-review').check();
await page.getByTestId('copy-image').click();
await page.getByTestId('export-note').filter({ hasText: 'Copied' }).waitFor();
// Read the card back from the clipboard, as a paste into a chat would.
const copied = await page.evaluate(async () => {
  const item = (await navigator.clipboard.read()).find((i) => i.types.includes('image/png'));
  if (!item) return null;
  const bmp = await createImageBitmap(await item.getType('image/png'));
  return [bmp.width, bmp.height];
});
check(copied?.[0] === 1080 && copied?.[1] === 1920, `Copy image puts the 1080×1920 PNG card on the clipboard (${copied})`);
await page.getByText('Download PNG').click();
const png = readFileSync(await (await dl1).path());
check(png.subarray(1, 4).toString() === 'PNG' && png.length > 20_000, `PNG exported (${png.length} bytes)`);
check(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1920, 'PNG is 1080×1920');
const dl2 = page.waitForEvent('download');
await page.getByRole('button', { name: 'SVG' }).click();
const svg = readFileSync(await (await dl2).path(), 'utf8');
const demoNames = ['Velvet Static', 'Mira Calloway', 'Marrow Coast', 'Bench Lab Builds', 'Slow Kitchen', 'Lighthouse Accord', 'Copper Valley', 'Harbor Lights', 'Sam', 'Guest'];
check(!demoNames.some((n) => svg.includes(n)), 'default SVG card contains no artist, channel, show or profile names');
check(svg.split(SITE_ADDRESS).length === 2 && !svg.includes('github.com'), 'the SVG card carries the app address once, and no other link');
await page.locator('.reveal input').first().check();
const dl3 = page.waitForEvent('download');
await page.getByRole('button', { name: 'SVG' }).click();
const svg2 = readFileSync(await (await dl3).path(), 'utf8');
check(demoNames.some((n) => svg2.includes(n)), 'opting in reveals exactly the chosen name');
await page.getByRole('button', { name: 'Square 1:1' }).click();
await page.getByRole('button', { name: 'Paper' }).click();
await page.waitForTimeout(400);
await snap('share-square');
check((await page.getByTestId('export-note').innerText()) === '', 'the "Copied" note is cleared once the card changes');

console.log('Phone layout');
// The share screen and the export guides once scrolled sideways on every phone: a long address or file path set the width.
await page.setViewportSize({ width: 320, height: 640 });
const wide = [];
const sideways = async (where) => {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  if (sw > cw) wide.push(`${where} ${sw}>${cw}`);
};
await page.goto(app);
await page.getByTestId('demo').waitFor();
await page.locator('.guides details').evaluateAll((all) => all.forEach((d) => { d.open = true; }));
await sideways('start page with every guide open');
await page.getByTestId('demo').click();
await page.getByTestId('play').waitFor();
await sideways('review');
await page.getByTestId('play').click();
for (let i = 0; i < 20; i++) {
  const id = await page.locator('.story').getAttribute('data-slide');
  await sideways(`slide ${id}`);
  if (id === 'end') break;
  await page.locator('.tap.next').click();
}
await page.getByText('Create share card').click();
await page.getByTestId('card-preview').waitFor();
await sideways('share card (story)');
await page.getByRole('button', { name: 'Square 1:1' }).click();
for (const box of await page.locator('.reveal input').all()) await box.check();
await sideways('share card (square, names shown)');
check(wide.length === 0, `no screen scrolls sideways at 320 px wide${wide.length ? ': ' + wide.join(' | ') : ''}`);

console.log('Export reminder');
// Exports take days: the start page offers a calendar file to come back. It is built in the page and downloaded, nothing is sent.
await page.setViewportSize({ width: 400, height: 760 });
await page.goto(app);
const reminder = page.getByTestId('reminder');
await reminder.getByRole('button', { name: '3 days', exact: true }).click();
// Expected day, in the browser's own time zone: 3 calendar days from today, at 6 PM.
const due = await page.evaluate(() => {
  const n = new Date();
  const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 3, 18);
  const p = (x) => String(x).padStart(2, '0');
  return { ymd: `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`, dashed: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, label: `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at 6 PM` };
});
check((await page.getByTestId('reminder-note').innerText()).startsWith(due.label), `the reminder says when it will go off (${due.label})`);
const dlIcs = page.waitForEvent('download');
await page.getByTestId('add-reminder').click();
const icsDl = await dlIcs;
const icsText = readFileSync(await icsDl.path(), 'utf8');
const icsLines = icsText.replace(/\r\n /g, '').split('\r\n');
check(icsDl.suggestedFilename() === `rewindary-reminder-${due.dashed}.ics` && icsLines[0] === 'BEGIN:VCALENDAR' && icsLines.includes(`DTSTART:${due.ymd}T180000`) && icsLines.includes('ACTION:DISPLAY'), `Add to calendar downloads a reminder event for ${due.dashed} at 6 PM, with an alert (${icsDl.suggestedFilename()})`);
check(icsLines.includes(`URL:${app}`) && [...icsLines.join('\n').matchAll(/https?:\/\/[^\s\\]+/g)].every((m) => m[0] === app), `the reminder links back to this page (${app}) and nowhere else`);
check((await page.getByTestId('reminder-note').innerText()).startsWith(`Saved rewindary-reminder-${due.dashed}.ics`), 'the start page confirms the saved file');
check(external.length === 0, `still no request left ${app} after saving the reminder`);

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

console.log('Localized Takeout');
writeFileSync(join(dir, 'takeout-fr.zip'), zipSync({
  'Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json': fx('google/watch-history.json'),
  'Takeout/Mon activité/Recherche/MonActivité.json': fx('google/MyActivity-search.json'),
  'Takeout/Google Photos/Voyage/IMG_0001.jpg.json': new TextEncoder().encode('{"title":"IMG_0001.jpg"}'),
}));
await page.goto(app);
await page.getByTestId('file-input').setInputFiles(join(dir, 'takeout-fr.zip'));
await page.getByTestId('play').waitFor();
const frReports = await page.getByTestId('reports').innerText();
check(/Takeout activity \(JSON\)/.test(frReports) && (await page.getByTestId('ignored').count()) === 0, 'a Takeout with French file names is read by content, with no note about the photo sidecar');
check(external.length === 0, `still no request left ${app} after the French Takeout`);

console.log('Apple Music');
// Apple's privacy download is a zip holding Apple_Media_Services.zip, which holds the play activity CSV.
writeFileSync(join(dir, 'Apple Media Services information.zip'), zipSync({
  'Apple Media Services information/Apple_Media_Services.zip': zipSync({
    'Apple Music Activity/Apple Music Play Activity.csv': fx('apple/Apple Music Play Activity.csv'),
    'Apple Music Activity/Apple Music Library Tracks.json': new TextEncoder().encode('[]'),
  }),
}));
await page.goto(app);
await page.getByTestId('file-input').setInputFiles(join(dir, 'Apple Media Services information.zip'));
await page.getByTestId('play').waitFor();
const appleReports = await page.getByTestId('reports').innerText();
check(/Apple Music play activity — 6 entries, 3 skipped/.test(appleReports) && (await page.getByTestId('ignored').count()) === 0, `the nested Apple privacy zip is opened and its play activity read (${appleReports.split('\n')[0]})`);
await page.getByTestId('play').click();
await page.locator('.story').waitFor();
for (let i = 0; i < 15 && (await page.locator('.story').getAttribute('data-slide')) !== 'applemusic'; i++) await page.locator('.tap.next').click();
const appleSlide = await page.locator('.story .slide').innerText();
check((await page.locator('.story').getAttribute('data-slide')) === 'applemusic' && /Apple Music/i.test(appleSlide) && /Marrow Coast/.test(appleSlide), `Apple Music gets its own story slide with the top artist (${appleSlide.replace(/\s+/g, ' ').slice(0, 80)})`);
for (let i = 0; i < 15 && (await page.locator('.story').getAttribute('data-slide')) !== 'end'; i++) await page.locator('.tap.next').click();
await page.getByRole('button', { name: 'Create share card' }).click();
const appleReview = await page.locator('.review').innerText();
check(/#1 artist/.test(appleReview) && !/Marrow Coast/.test(appleReview), 'the share card lists the Apple Music #1 artist as hidden by default');
check(external.length === 0, `still no request left ${app} after the Apple Music upload`);

console.log('Unzipped folders');
// Safari on macOS unzips downloads by default, so exports often arrive as folders. These go through the real folder pickers.
const put = (path, data) => { mkdirSync(join(dir, path, '..'), { recursive: true }); writeFileSync(join(dir, path), data); };
put('folders/Takeout/archive_browser.html', '<html></html>');
put('folders/Takeout/YouTube and YouTube Music/history/watch-history.html', fx('google/watch-history.html'));
put('folders/Takeout/Google Photos/Trip/IMG_0001.jpg', new Uint8Array(50_000));
put('folders/Takeout/Google Photos/Trip/IMG_0001.jpg.json', '{"title":"IMG_0001.jpg"}');
put('folders/Spotify Extended Streaming History/Streaming_History_Audio_2024-2025_0.json', fx('spotify/Streaming_History_Audio_2024-2025_0.json'));
await page.goto(app);
check(await page.getByText('Already unzipped? Drop the folder').isVisible(), 'the start page offers unzipped folders');
await page.getByTestId('folder-input').setInputFiles(join(dir, 'folders/Takeout'));
await page.getByTestId('play').waitFor();
const folderReports = await page.getByTestId('reports').innerText();
check(/Takeout activity \(HTML\)/.test(folderReports) && /Takeout\/YouTube and YouTube Music\/history\/watch-history\.html/.test(folderReports) && (await page.getByTestId('ignored').count()) === 0, 'an unzipped Takeout folder is read, with its path and no note about photos');
await page.getByTestId('add-folder').setInputFiles(join(dir, 'folders/Spotify Extended Streaming History'));
await page.waitForFunction(() => /Spotify extended/.test(document.querySelector('[data-testid=reports]')?.textContent ?? ''));
check((await page.getByTestId('reports').locator('li').count()) === 2 && (await page.getByTestId('ignored').count()) === 0, 'a second folder can be added from the review screen');
// A real folder drop: Playwright cannot drop a directory, but Chromium's DevTools protocol drops real paths,
// so the page receives genuine directory entries (more than one readEntries batch with 150 photos).
for (let i = 0; i < 150; i++) put(`folders/Takeout/Google Photos/Trip/IMG_${i}.jpg`, 'x');
const dropFolder = async (path) => {
  const cdp = await ctx.newCDPSession(page);
  const box = await page.locator('.drop').boundingBox();
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2, data: { items: [], files: [path], dragOperationsMask: 1 } };
  for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', { type, ...at });
  await cdp.detach();
};
await page.goto(app);
await dropFolder(join(dir, 'folders/Takeout'));
await page.getByTestId('play').waitFor();
check(/Takeout\/YouTube and YouTube Music\/history\/watch-history\.html/.test(await page.getByTestId('reports').innerText()) && (await page.getByTestId('ignored').count()) === 0, 'a dropped Takeout folder is walked and read');
put('folders/Only photos/IMG_0001.jpg', 'x');
await page.goto(app);
await dropFolder(join(dir, 'folders/Only photos'));
await page.getByText('No .zip, .json, .csv or .html files in this folder').waitFor();
check(await page.getByTestId('demo').isVisible(), 'a dropped folder with nothing to read says so and stays on the start page');
check(external.length === 0, `still no request left ${app} after the folder uploads`);

console.log('Unrecognised exports');
writeFileSync(join(dir, 'takeout-20261110T101500Z-001.zip'), zipSync({
  'Takeout/archive_browser.html': new TextEncoder().encode('<html></html>'),
  'Takeout/YouTube and YouTube Music/subscriptions/subscriptions.csv': new TextEncoder().encode('Channel Id,Channel Url,Channel Title'),
}));
await page.goto(app);
await page.getByTestId('file-input').setInputFiles(join(dir, 'takeout-20261110T101500Z-001.zip'));
await page.getByTestId('ignored').waitFor();
const ignoredText = await page.getByTestId('ignored').innerText();
check(/takeout-20261110T101500Z-001\.zip/.test(ignoredText) && /YouTube data but no watch or search history/.test(ignoredText) && /split into several zips/.test(ignoredText), 'a Takeout part without history explains what to re-export');
check(await page.getByText('No supported history found').isVisible() && (await page.getByTestId('play').count()) === 0, 'nothing to play when no history was found');
await snap('review-ignored');
await page.getByTestId('add-files').setInputFiles(join(dir, 'ViewingActivity.csv'));
await page.getByTestId('play').waitFor();
check((await page.getByTestId('ignored').count()) === 1 && /Netflix viewing activity/.test(await page.getByTestId('reports').innerText()), 'the missing export can be added from the same screen, keeping the note');
check(external.length === 0, `still no request left ${app} after the unrecognised upload`);

await browser.close();
local?.server.close();
if (failures) {
  console.error(`\n${failures} e2e check(s) failed`);
  process.exit(1);
}
console.log('\nAll e2e checks passed.');
