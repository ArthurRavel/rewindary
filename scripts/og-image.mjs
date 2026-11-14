// Builds public/og.jpg, the 1200×630 link-preview image, from the production build in dist/.
// The card in it is the real default square card of the synthetic demo (names hidden), downloaded
// through the same review gate a visitor uses. Run it with `pnpm og-image`, which builds before and after so dist/ ships the new image.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launch } from './browser.mjs';
import { serve } from './serve.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const site = readFileSync(join(ROOT, 'src/site.ts'), 'utf8');
const SITE_ADDRESS = site.match(/SITE_ADDRESS = '([^']+)'/)[1];
const dataUrl = (type, text) => `data:${type};base64,${Buffer.from(text).toString('base64')}`;

const { server, url } = await serve(join(ROOT, 'dist'), 0, '/rewindary/');
const browser = await launch();
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true })).newPage();
  await page.goto(url);
  await page.getByTestId('demo').click();
  await page.getByTestId('play').click();
  for (let i = 0; i < 20 && (await page.locator('.story').getAttribute('data-slide')) !== 'end'; i++) await page.locator('.tap.next').click();
  await page.getByText('Create share card').click();
  await page.getByRole('button', { name: 'Square 1:1' }).click();
  await page.getByTestId('confirm-review').check();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SVG' }).click();
  const card = readFileSync(await (await download).path(), 'utf8');
  if (!card.includes('•••••')) throw new Error('expected the default card, with names hidden');

  const favicon = readFileSync(join(ROOT, 'public/favicon.svg'), 'utf8');
  // Same names, colours and order as SOURCE_LABEL / SOURCE_COLOR (Google Search aside); tests/public-sources.test.ts keeps them in step.
  const sources = [['Spotify', '#3ddc97'], ['Apple Music', '#5cc8ff'], ['YouTube Music', '#ff8ad8'], ['YouTube', '#ff6b6b'], ['Netflix', '#ffb547']];
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(`<!doctype html><html><head><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 1200px; height: 630px; overflow: hidden; color: #f7f3ff; -webkit-font-smoothing: antialiased;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: radial-gradient(900px 500px at 85% -10%, #3a1f6666, transparent), #0d0a1a;
      display: grid; grid-template-columns: 1fr 510px; gap: 56px; align-items: center; padding: 0 60px 0 72px; }
    .brand { display: flex; align-items: center; gap: 14px; font-size: 30px; font-weight: 800; letter-spacing: -0.01em; }
    .brand img { width: 44px; height: 44px; border-radius: 10px; }
    h1 { font-size: 62px; line-height: 1.04; letter-spacing: -0.03em; margin: 30px 0 22px; }
    ul { list-style: none; padding: 0; display: grid; grid-template-columns: auto auto; justify-content: start; gap: 12px 36px; font-size: 26px; font-weight: 600; }
    li { display: flex; align-items: center; gap: 10px; }
    li i { width: 16px; height: 16px; border-radius: 50%; }
    p { margin-top: 30px; font-size: 26px; line-height: 1.35; color: #b3a9cc; }
    p b { color: #f7f3ff; font-weight: 600; }
    p span { color: #c89bff; }
    .card { width: 510px; height: 510px; border-radius: 28px; box-shadow: 0 24px 60px -16px #000c, 0 0 0 1px #ffffff1a; }
  </style></head><body>
    <div>
      <div class="brand"><img src="${dataUrl('image/svg+xml', favicon)}" alt="">Rewindary</div>
      <h1>Your year,<br>rewound into one story.</h1>
      <ul>${sources.map(([n, c]) => `<li><i style="background:${c}"></i>${n}</li>`).join('')}</ul>
      <p><b>Runs entirely in your browser.</b><br>No upload, no account.<br><span>${SITE_ADDRESS}</span></p>
    </div>
    <img class="card" src="${dataUrl('image/svg+xml', card)}" alt="">
  </body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  const jpg = await page.screenshot({ type: 'jpeg', quality: 90 });
  writeFileSync(join(ROOT, 'public/og.jpg'), jpg);
  console.log(`public/og.jpg: 1200x630, ${(jpg.length / 1024).toFixed(0)} KB`);
} finally {
  await browser.close();
  server.close();
}
