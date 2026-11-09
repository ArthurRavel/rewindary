import { describe, expect, it } from 'vitest';
import { parseTextFile } from '../src/ingest';
import { classifyNetflixTitle, detectDateOrder } from '../src/parsers/netflix';
import { parseCsv, parseLooseDate } from '../src/parsers/text';
import { fixture } from './helpers';

const parse = (p: string) => {
  const r = parseTextFile(p, fixture(p));
  if (!r) throw new Error(`not recognised: ${p}`);
  return r;
};

describe('Spotify extended streaming history', () => {
  const r = parse('spotify/Streaming_History_Audio_2024-2025_0.json');
  it('keeps music, podcasts and audiobooks; drops skips, incognito and broken rows', () => {
    expect(r.events.map((e) => [e.kind, e.group])).toEqual([
      ['music', 'Velvet Static'], ['music', 'Velvet Static'], ['podcast', 'The Patient Engineer'], ['podcast', 'The Synthetic Atlas'],
    ]);
    expect(r.report.skipped).toBe(3);
  });
  it('uses ts as the end of playback', () => {
    expect(new Date(r.events[0].t).toISOString()).toBe('2025-03-01T08:00:00.000Z');
    expect(r.events[0].ms).toBe(240000);
  });
  it('never stores IP addresses or private-session tracks', () => {
    const json = JSON.stringify(r.events);
    expect(json).not.toContain('192.0.2.44');
    expect(json).not.toContain('Private Session Song');
    expect(json).not.toContain('ZZ');
  });
});

describe('Spotify account data', () => {
  it('parses music and podcast files', () => {
    const m = parse('spotify/StreamingHistory_music_0.json');
    expect(m.events).toHaveLength(2);
    expect(new Date(m.events[1].t).toISOString()).toBe('2025-03-05T18:26:30.000Z');
    const p = parse('spotify/StreamingHistory_podcast_0.json');
    expect(p.events[0]).toMatchObject({ kind: 'podcast', group: 'Notes from the Night Bus' });
  });
});

describe('Google Takeout JSON', () => {
  const w = parse('google/watch-history.json');
  it('classifies videos, music and removed videos; skips ads and visits', () => {
    expect(w.events.map((e) => [e.kind, e.group])).toEqual([
      ['video', 'Bench Lab Builds'], ['video', 'Atlas of Small Things'], ['video', ''], ['music', 'Velvet Static'],
    ]);
    expect(w.events[0].title).toBe('Restoring a vintage radio');
    expect(w.report.skipped).toBe(2);
  });
  it('turns searches into bare timestamps: query text and URLs are discarded', () => {
    const s = parse('google/search-history.json');
    const g = parse('google/MyActivity-search.json');
    expect(s.events).toEqual([{ source: 'youtube', kind: 'search', t: Date.parse('2025-03-01T20:57:00Z'), ms: 0, est: false, title: '', group: '' }]);
    expect(g.events).toHaveLength(1);
    expect(g.events[0]).toMatchObject({ source: 'google', kind: 'search', title: '' });
    const json = JSON.stringify([s.events, g.events]);
    expect(json).not.toMatch(/alpha|bravo|example\.com|http/);
  });
});

describe('Google Takeout HTML', () => {
  const h = parse('google/watch-history.html');
  it('parses English (US/UK) and French dates, entities and skips ads', () => {
    expect(h.events.filter((e) => e.kind === 'video').map((e) => [e.title, e.group, new Date(e.t).toISOString()])).toEqual([
      ['Building a pocket synth & more', 'Quiet Workshop', '2025-03-07T21:05:02.000Z'],
      ['Une visite de phare', 'Atlas of Small Things', '2025-03-08T20:15:00.000Z'],
      ['Night train tour', 'Orbital Notes', '2025-03-09T23:40:10.000Z'],
    ]);
    expect(h.events.filter((e) => e.kind === 'search')).toHaveLength(1);
    expect(JSON.stringify(h.events)).not.toContain('charlie');
    expect(h.report.skipped).toBe(1);
    expect(h.report.warnings).toEqual([]);
  });
  it('parseLooseDate handles common Takeout locales', () => {
    expect(new Date(parseLooseDate('Dec 31, 2024, 12:05:00 AM CET')!).toISOString()).toBe('2024-12-31T00:05:00.000Z');
    expect(new Date(parseLooseDate('1 févr. 2025, 07:00:00 UTC')!).toISOString()).toBe('2025-02-01T07:00:00.000Z');
    expect(new Date(parseLooseDate('3. Okt. 2025, 18:20:00 MESZ')!).toISOString()).toBe('2025-10-03T18:20:00.000Z');
    expect(parseLooseDate('garbage')).toBeNull();
  });
});

describe('Netflix', () => {
  it('parses full viewing activity, skipping trailers and previews', () => {
    const r = parse('netflix/ViewingActivity.csv');
    expect(r.events.map((e) => [e.kind, e.group, e.profile, e.ms / 60000])).toEqual([
      ['episode', 'The Lighthouse Accord', 'Sam', 45], ['episode', 'The Lighthouse Accord', 'Sam', 44], ['episode', 'The Lighthouse Accord', 'Sam', 41],
      ['film', 'A Map of Rain, Revisited', 'Sam', 112], ['episode', 'Ninth Garden', 'Guest', 30],
    ]);
    expect(r.profiles).toEqual(['Sam', 'Guest']);
    expect(r.report.skipped).toBe(2);
    expect(JSON.stringify(r.events)).not.toMatch(/Synthetic TV|ZZ/);
  });
  it('parses the simple titles+dates file with estimated durations and day-first dates', () => {
    const r = parse('netflix/NetflixViewingHistory.csv');
    expect(r.events).toHaveLength(3);
    expect(r.events.every((e) => e.est && e.noTime)).toBe(true);
    expect(new Date(r.events[0].t).getDate()).toBe(15);
    expect(r.events[2]).toMatchObject({ kind: 'film', group: 'Midnight Ferry' });
    expect(r.report.warnings[0]).toMatch(/estimates/);
  });
  it('detects date order and classifies titles', () => {
    expect(detectDateOrder(['1/13/25', '2/3/25'])).toBe('mdy');
    expect(detectDateOrder(['13/1/25'])).toBe('dmy');
    expect(detectDateOrder(['2025-01-13'])).toBe('ymd');
    expect(classifyNetflixTitle('Copper Valley: Season 2')).toMatchObject({ kind: 'episode', group: 'Copper Valley' });
    expect(classifyNetflixTitle('Paper Crowns')).toMatchObject({ kind: 'film' });
  });
});

describe('CSV', () => {
  it('handles quotes, escaped quotes, CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
});

it('ignores unrelated files', () => {
  expect(parseTextFile('notes.csv', 'foo,bar\n1,2')).toBeNull();
  expect(parseTextFile('data.json', '[{"a":1}]')).toBeNull();
  expect(parseTextFile('broken.json', '[{')).toBeNull();
});
