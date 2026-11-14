import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { SITE_ADDRESS } from '../src/site';
import { socialMeta } from '../scripts/social-meta';

const ROOT = join(import.meta.dirname, '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
const tags = (out: string) => Object.fromEntries([...out.matchAll(/<meta (?:property|name)="((?:og|twitter):[^"]+)" content="([^"]*)" \/>/g)].map((m) => [m[1], m[2]]));

it('adds link-preview tags that point only at the app itself', () => {
  const out = socialMeta(html);
  const t = tags(out);
  const app = `https://${SITE_ADDRESS}/`;
  expect(t['og:url']).toBe(app);
  expect(t['og:image']).toBe(`${app}og.jpg`);
  expect(t['twitter:card']).toBe('summary_large_image');
  expect([t['og:image:width'], t['og:image:height'], t['og:image:type']]).toEqual(['1200', '630', 'image/jpeg']);
  // Copy comes from index.html, so the preview never drifts from the page's own title and description.
  expect(t['og:title']).toBe(html.match(/<title>([^<]*)<\/title>/)![1]);
  expect(t['og:description']).toBe(html.match(/<meta name="description" content="([^"]*)"/)![1]);
  expect(t['og:description']).toMatch(/Spotify, Apple Music, YouTube Music, YouTube and Netflix/);
  // The only absolute URLs added are the two above; everything else in the page stays relative.
  expect([...out.matchAll(/https?:\/\/[^\s"]+/g)].map((m) => m[0]).sort()).toEqual([app, `${app}og.jpg`]);
  // Each tag is a well-formed attribute (no stray quote cutting a value short) and they sit before <title>.
  expect(Object.keys(t)).toHaveLength(11);
  expect(out.indexOf('og:type')).toBeLessThan(out.indexOf('<title>'));
  expect(out.replace(/\s*<meta (?:property|name)="(?:og|twitter):[^"]+" content="[^"]*" \/>/g, '')).toBe(html);
});

it('keeps a quote in the page title from breaking the tags', () => {
  const t = tags(socialMeta(html.replace(/<title>[^<]*<\/title>/, '<title>My "year"</title>')));
  expect(t['og:title']).toBe('My &quot;year&quot;');
  expect(Object.keys(t)).toHaveLength(11);
});

it('refuses to build previews without a title and description', () => {
  expect(() => socialMeta('<html><head><title>x</title></head></html>')).toThrow(/description/);
});

it('ships the preview image as a 1200×630 JPEG small enough for messengers', () => {
  const jpg = readFileSync(join(ROOT, 'public', 'og.jpg'));
  expect([jpg[0], jpg[1]]).toEqual([0xff, 0xd8]);
  expect(jpg.length).toBeLessThan(300_000);
  let i = 2;
  while (!(jpg[i + 1] >= 0xc0 && jpg[i + 1] <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(jpg[i + 1]))) i += 2 + jpg.readUInt16BE(i + 2);
  expect([jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)]).toEqual([1200, 630]);
});
