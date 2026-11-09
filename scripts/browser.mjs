import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Use CHROME_PATH, or the newest Chromium already present in the Playwright cache (no downloads). */
export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  const dirs = existsSync(cache) ? readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const d of dirs) for (const rel of ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
    const p = join(cache, d, rel);
    if (existsSync(p)) return p;
  }
  throw new Error('No Chromium found. Set CHROME_PATH to a Chrome/Chromium binary.');
}

export const launch = () => chromium.launch({ executablePath: findChrome(), headless: true });
