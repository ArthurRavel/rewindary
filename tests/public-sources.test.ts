import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { SOURCE_COLOR } from '../src/charts';
import { SOURCE_LABEL, SOURCE_ORDER } from '../src/model';

// The services a visitor brings exports from. Google Search rides along in the Takeout and is never
// listed as a headline source, so it is left out on purpose.
const LISTED = SOURCE_ORDER.filter((s) => s !== 'google');
const ROOT = join(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const sentence = (names: string[]) => `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
const expected = sentence(LISTED.map((s) => SOURCE_LABEL[s]));

it('names every source, in product order, wherever the start page, README and metadata list them', () => {
  expect(expected).toBe('Spotify, Apple Music, YouTube Music, YouTube and Netflix');
  const surfaces: Record<string, string> = {
    // The heading keeps two-word names on one line with &nbsp;, so a phone never splits "Apple / Music".
    'start page heading': read('src/ui/Home.tsx').match(/<h1[^>]*>([\s\S]*?)<\/h1>/)![1].replace(/&nbsp;/g, ' '),
    'meta description': read('index.html').match(/<meta name="description" content="([^"]*)"/)![1],
    'package description': JSON.parse(read('package.json')).description,
    'README tagline': read('README.md').match(/^\*\*Your .*\*\*$/m)![0],
  };
  for (const [where, text] of Object.entries(surfaces)) expect(text, where).toContain(expected);
});

it('draws the link-preview legend with the app’s own names and colours', () => {
  const legend = read('scripts/og-image.mjs').match(/const sources = (\[.*\]);/)![1];
  expect(JSON.parse(legend.replace(/'/g, '"'))).toEqual(LISTED.map((s) => [SOURCE_LABEL[s], SOURCE_COLOR[s]]));
});
