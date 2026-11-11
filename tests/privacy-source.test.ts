import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..', 'src');
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
const code = (f: string) => readFileSync(f, 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '');

it('application source uses no network APIs', () => {
  const banned = /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new\s+WebSocket|EventSource|RTCPeerConnection|importScripts|navigator\.serviceWorker|@import\s+url|<link[^>]+href=["']https?:/;
  expect(files(SRC).filter((f) => banned.test(code(f))).map((f) => relative(SRC, f))).toEqual([]);
});

it('remote URLs only appear as synthetic export data in the demo generator, plus the source link', () => {
  const url = /https?:\/\/(?!www\.w3\.org\/2000\/svg)/;
  expect(files(SRC).filter((f) => url.test(code(f))).map((f) => relative(SRC, f))).toEqual(['demo.ts', 'site.ts']);
  // site.ts holds exactly one URL, the repository a visitor may choose to open; it is never fetched (see the test above).
  expect([...code(join(SRC, 'site.ts')).matchAll(/https?:\/\/[^\s'"`]+/g)].map((m) => m[0])).toEqual(['https://github.com/ArthurRavel/rewindary']);
});

it('the source link opens in a new tab without a referrer or opener', () => {
  const link = code(join(SRC, 'ui', 'SourceLink.tsx'));
  expect(link).toMatch(/href=\{SOURCE_URL\}/);
  expect(link).toMatch(/target="_blank"/);
  expect(link).toMatch(/rel="noopener noreferrer"/);
});
