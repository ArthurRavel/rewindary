import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { cardLines, HIDDEN, mediaPhrase, renderCardSvg, type RevealId } from '../src/cards';
import { explainFile } from '../src/diagnose';
import { ingestFiles, inFolder, isInterestingPath, isNestedArchive, parseTextFile } from '../src/ingest';
import { computeInsights, persona } from '../src/insights';
import type { LifeEvent } from '../src/model';
import { parseAppleMusicActivity } from '../src/parsers/apple';
import { buildSlides } from '../src/ui/Story';
import { fixture, fixtureBytes } from './helpers';

const CSV = 'apple/Apple Music Play Activity.csv';
const file = (name: string, data: Uint8Array | string) => new File([data as BlobPart], name);
const csvOf = (header: string[], rows: string[][]) => [header, ...rows].map((r) => r.join(',')).join('\n');

describe('Apple Music play activity', () => {
  const r = parseTextFile(`Apple Music Activity/${CSV.split('/')[1]}`, fixture(CSV))!;

  it('is recognised by its header and counts only PLAY_END rows', () => {
    expect(r.report.format).toBe('Apple Music play activity');
    expect(r.events.map((e) => [e.title, e.group])).toEqual([
      ['Lanterns Over Water', 'Marrow Coast'],
      ['Paper Satellites, Pt. 2', 'Marrow Coast'],
      ['Glasshouse', 'Juniper Static'],
      ['Tidal Arithmetic', 'Juniper Static'],
      ['Lanterns Over Water', 'Marrow Coast'],
      ['Night Ferry ("Live")', 'Marrow Coast'],
    ]);
    expect(r.events.every((e) => e.source === 'applemusic' && e.kind === 'music' && !e.est)).toBe(true);
    // the 3 s skip, the radio row without a song and the 27-hour row; PLAY_START and lyrics rows are not plays at all
    expect(r.report.skipped).toBe(3);
    expect(r.report.warnings).toEqual([]);
  });

  it('reads the same plays from a CRLF copy of the file (as Apple may ship it)', () => {
    const crlf = parseTextFile('Apple Music Play Activity.csv', fixture(CSV).replace(/\n/g, '\r\n'))!;
    expect(crlf.events).toEqual(r.events);
    expect(crlf.report.skipped).toBe(r.report.skipped);
  });

  it('reads start times as UTC, and falls back to end minus duration', () => {
    expect(new Date(r.events[0].t).toISOString()).toBe('2025-03-14T21:02:11.000Z');
    expect(r.events[0].ms).toBe(210_000);
    expect(new Date(r.events[3].t).toISOString()).toBe('2025-07-02T08:18:20.000Z');
    expect(new Date(r.events[4].t).toISOString()).toBe('2024-12-31T23:30:00.000Z');
  });

  it('never keeps the Apple ID, IP address, device, storefront or client columns', () => {
    const json = JSON.stringify(r);
    for (const secret of ['1234567890', '192.0.2.44', 'SYNTHETIC-DEVICE-0001', 'synthetic-client-7', 'IPHONE', '3600']) expect(json).not.toContain(secret);
    expect(Object.keys(r.events[0]).sort()).toEqual(['est', 'group', 'kind', 'ms', 'source', 't', 'title']);
  });

  it('without any PLAY_END row, counts every row that has a duration', () => {
    const text = csvOf(['Song Name', 'Artist Name', 'Event Start Timestamp', 'Play Duration Milliseconds'], [
      ['A', 'X', '2025-01-02T10:00:00Z', '200000'],
      ['B', 'X', '2025-01-02 10:05:00', '180000'],
      ['C', 'X', '2025-01-02T10:10:00Z', ''],
      ['D', 'X', 'not a date', '180000'],
    ]);
    const p = parseAppleMusicActivity(text, 'x.csv');
    expect(p.events.map((e) => e.title)).toEqual(['A', 'B']);
    expect(new Date(p.events[1].t).toISOString()).toBe('2025-01-02T10:05:00.000Z');
    expect(p.report.skipped).toBe(1);
  });

  it('warns and ranks songs when the export has no artist names', () => {
    const text = csvOf(['Event Type', 'Song Name', 'Event Start Timestamp', 'Play Duration Milliseconds'], [
      ['PLAY_END', 'A', '2025-01-02T10:00:00Z', '200000'],
      ['PLAY_END', 'A', '2025-01-02T10:04:00Z', '200000'],
      ['PLAY_END', 'B', '2025-01-02T10:08:00Z', '200000'],
    ]);
    const p = parseAppleMusicActivity(text, 'x.csv');
    expect(p.events.every((e) => e.group === '')).toBe(true);
    expect(p.report.warnings.join()).toMatch(/no artist names/);
    const ins = computeInsights(p.events, 2025);
    const slide = buildSlides(ins).find((s) => s.id === 'applemusic')!;
    expect(JSON.stringify(slide.body)).toContain('"A"');
    expect(cardLines(ins, new Set()).some((l) => l.id === 'topArtist')).toBe(false);
  });

  it('is not mistaken for a Netflix or other CSV, and other CSVs are not mistaken for it', () => {
    expect(parseTextFile('Apple Music - Play History Daily Tracks.csv', 'Track Description,Play Count\n"X - A",3\n')).toBeNull();
    expect(parseTextFile('NetflixViewingHistory.csv', fixture('netflix/NetflixViewingHistory.csv'))!.report.source).toBe('netflix');
  });

  it('treats the play activity name as known history and Apple_Media_Services.zip as the only nested archive', () => {
    expect(isInterestingPath('Apple_Media_Services/Apple Music Activity/Apple Music Play Activity.csv')).toBe(true);
    expect(isInterestingPath('Apple Music Activity/Apple Music - Play History Daily Tracks.csv')).toBe(false);
    expect(isNestedArchive('Apple Media Services information/Apple_Media_Services.zip')).toBe(true);
    expect(isNestedArchive('Takeout/YouTube/archive.zip')).toBe(false);
  });
});

describe('Apple exports as they arrive', () => {
  const inner = () => zipSync({
    'Apple Music Activity/Apple Music Play Activity.csv': fixtureBytes(CSV),
    'Apple Music Activity/Apple Music - Play History Daily Tracks.csv': strToU8('Track Description,Play Count\n"Marrow Coast - Glasshouse",3\n'),
    'Apple Music Activity/Apple Music Library Tracks.json': strToU8('[{"Title":"Glasshouse"}]'),
  });

  it('opens Apple_Media_Services.zip inside the privacy download', async () => {
    const outer = zipSync({ 'Apple Media Services information/Apple_Media_Services.zip': inner(), 'Apple Media Services information/README.pdf': strToU8('%PDF') });
    const r = await ingestFiles([file('Apple Media Services information.zip', outer)]);
    expect(r.reports.map((x) => [x.format, x.events])).toEqual([['Apple Music play activity', 6]]);
    expect(r.reports[0].file).toBe('Apple Media Services information.zip/Apple Media Services information/Apple_Media_Services.zip/Apple Music Activity/Apple Music Play Activity.csv');
    expect(r.ignored).toEqual([]);
  });

  it('reads the inner zip dropped on its own, and an unzipped folder holding it', async () => {
    const a = await ingestFiles([file('Apple_Media_Services.zip', inner())]);
    expect(a.events).toHaveLength(6);
    const zipped = file('Apple_Media_Services.zip', inner());
    const b = await ingestFiles([inFolder(zipped, 'Apple Media Services information/Apple_Media_Services.zip')]);
    expect(b.events).toHaveLength(6);
    expect(b.ignored).toEqual([]);
  });

  it('only unpacks one level: a zip inside the inner zip is left alone', async () => {
    const deeper = zipSync({ 'x/Apple_Media_Services.zip': zipSync({ 'Apple Music Activity/Apple Music Play Activity.csv': fixtureBytes(CSV) }) });
    const r = await ingestFiles([file('outer.zip', zipSync({ 'Apple_Media_Services.zip': deeper }))]);
    expect(r.events).toHaveLength(0);
  });

  it('explains an Apple export without play activity', async () => {
    const noPlays = zipSync({ 'Apple Media Services information/Apple_Media_Services.zip': zipSync({ 'Apple Music Activity/Apple Music Library Tracks.json': strToU8('[]') }) });
    const r = await ingestFiles([file('Apple Media Services information.zip', noPlays)]);
    expect(r.events).toHaveLength(0);
    expect(r.ignored).toHaveLength(1);
    expect(r.ignored[0].hint).toMatch(/no Apple Music play activity.*Apple Media Services information.*Apple Music Play Activity\.csv/);
    expect(explainFile('Apple Music - Play History Daily Tracks.csv', false)).toMatch(/Apple Music Play Activity\.csv/);
  });
});

describe('Apple Music in the story and on cards', () => {
  const H = 3_600_000;
  const play = (source: LifeEvent['source'], t: string, group: string, title: string, ms = 200_000): LifeEvent =>
    ({ source, kind: 'music', t: Date.parse(t), ms, est: false, title, group });
  const events: LifeEvent[] = [
    ...Array.from({ length: 30 }, (_, i) => play('applemusic', `2025-06-${String((i % 28) + 1).padStart(2, '0')}T12:00:00Z`, 'Marrow Coast', 'Glasshouse', H)),
    play('applemusic', '2025-06-01T13:00:00Z', 'Short Skip Band', 'Tiny', 20_000),
    play('spotify', '2025-06-02T09:00:00Z', 'Velvet Static', 'Other', H),
  ];
  const ins = computeInsights(events, 2025);
  const am = ins.sources.find((s) => s.source === 'applemusic')!;

  it('ranks Apple Music like Spotify: plays under 30 s do not count', () => {
    expect(am.top.map((t) => t.name)).toEqual(['Marrow Coast']);
    expect(am.topTitles[0]).toMatchObject({ name: 'Glasshouse — Marrow Coast', count: 30 });
  });

  it('counts Apple Music in the music persona lane and in listening runs', () => {
    expect(ins.persona.id).toMatch(/-music$/);
    expect(persona({ spotify: 0.3, applemusic: 0.3, youtube: 0.4 }, 0, 0, 0).name).toBe('Everyday Soundtracker');
    expect(ins.marathon).not.toBeNull();
  });

  it('gets its own slide, and the listening run is told once', () => {
    const slides = buildSlides(ins);
    expect(slides.map((s) => s.id).filter((id) => id === 'spotify' || id === 'applemusic')).toEqual(['spotify', 'applemusic']);
    const runs = slides.filter((s) => JSON.stringify(s.body).includes('Longest listening run'));
    expect(runs.map((s) => s.id)).toEqual(['spotify']);
  });

  it('takes the #1 artist from the music service with the most hours, hidden by default', () => {
    const lines = cardLines(ins, new Set());
    expect(lines.find((l) => l.id === 'topArtist')!.value).toBe(`${HIDDEN} · 30 plays`);
    expect(cardLines(ins, new Set<RevealId>(['topArtist'])).find((l) => l.id === 'topArtist')!.value).toBe('Marrow Coast · 30 plays');
    expect(mediaPhrase(ins)).toBe('of music');
    for (const format of ['story', 'square'] as const) {
      const svg = renderCardSvg(ins, { format, theme: 'dusk', reveal: new Set() });
      for (const name of ['Marrow Coast', 'Glasshouse', 'Velvet Static']) expect(svg).not.toContain(name);
      expect(svg).toContain('Apple Music');
    }
  });

  it('keeps a four-source legend inside the card', () => {
    const four = computeInsights([
      ...events,
      { source: 'youtube', kind: 'video', t: Date.parse('2025-06-03T20:00:00Z'), ms: 5 * H, est: true, title: 'v', group: 'c' },
      { source: 'netflix', kind: 'film', t: Date.parse('2025-06-04T20:00:00Z'), ms: 5 * H, est: false, title: 'f', group: 'f' },
    ], 2025);
    for (const format of ['story', 'square'] as const) {
      const svg = renderCardSvg(four, { format, theme: 'paper', reveal: new Set() });
      const legend = [...svg.matchAll(/<text x="(\d+)" y="\d+" font-size="(\d+)" fill="[^"]+">((?:Spotify|Apple Music|YouTube|Netflix) \d+%)<\/text>/g)];
      expect(legend).toHaveLength(4);
      const [x, size, label] = legend[3].slice(1);
      // the same width estimate the renderer uses: 18 px per character at 32 px
      expect(Number(x) + label.length * 18 * (Number(size) / 32)).toBeLessThanOrEqual(1080 - 80 + 1);
    }
  });
});
