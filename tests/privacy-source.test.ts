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

it('remote URLs only appear as synthetic export data in the demo generator', () => {
  const url = /https?:\/\/(?!www\.w3\.org\/2000\/svg)/;
  expect(files(SRC).filter((f) => url.test(code(f))).map((f) => relative(SRC, f))).toEqual(['demo.ts']);
});
