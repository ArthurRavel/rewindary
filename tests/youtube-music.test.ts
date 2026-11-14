import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { cardLines, HIDDEN, mediaPhrase, renderCardSvg, type RevealId } from '../src/cards';
import { demoFiles } from '../src/demo';
import { ingestFiles } from '../src/ingest';
import { computeInsights, persona } from '../src/insights';
import type { LifeEvent } from '../src/model';
import { parseGoogleActivity } from '../src/parsers/google';
import { buildSlides } from '../src/ui/Story';

const H = 3_600_000;
const MIN = 60_000;

/** One Takeout watch-history row, in the real JSON shape. */
const row = (time: string, title: string, channel: string, music: boolean) => ({
  header: music ? 'YouTube Music' : 'YouTube',
  title: `Watched ${title}`,
  titleUrl: `https://${music ? 'music' : 'www'}.youtube.com/watch?v=${title.replace(/\W/g, '')}`,
  subtitles: [{ name: music ? `${channel} - Topic` : channel, url: 'https://www.youtube.com/channel/x' }],
  time,
  products: ['YouTube'],
});

/** One Takeout watch-history block, in the real HTML shape. */
const block = (header: string, url: string, title: string, channel: string, date: string) =>
  `<div class="outer-cell mdl-cell mdl-cell--12-col mdl-shadow--2dp"><div class="mdl-grid"><div class="header-cell mdl-cell mdl-cell--12-col"><p class="mdl-typography--title">${header}<br></p></div>` +
  `<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">Watched&nbsp;<a href="${url}">${title}</a><br><a href="https://www.youtube.com/channel/UC1">${channel}</a><br>${date}<br></div></div></div>`;

describe('YouTube Music in a Takeout watch history', () => {
  it('becomes its own music source, apart from videos (JSON)', () => {
    const r = parseGoogleActivity([
      row('2025-03-01T20:35:00Z', 'Restoring a radio', 'Bench Lab Builds', false),
      row('2025-03-01T20:30:00Z', 'Neon River', 'Velvet Static', true),
    ], 'watch-history.json');
    expect(r.events.map((e) => [e.source, e.kind, e.title, e.group])).toEqual([
      ['youtube', 'video', 'Restoring a radio', 'Bench Lab Builds'],
      ['ytmusic', 'music', 'Neon River', 'Velvet Static'],
    ]);
    expect(r.report.source).toBe('youtube'); // the file is still the Takeout YouTube history
  });

  it('becomes its own music source in an HTML history too, and alone still reports the YouTube file', () => {
    const html = block('YouTube Music', 'https://music.youtube.com/watch?v=abc', 'Glass Harbor', 'Mona Driftwood - Topic', 'Mar 7, 2025, 9:05:02 PM UTC');
    const r = parseGoogleActivity(html, 'watch-history.html');
    expect(r.events.map((e) => [e.source, e.kind, e.title, e.group])).toEqual([['ytmusic', 'music', 'Glass Harbor', 'Mona Driftwood']]);
    expect(r.report.source).toBe('youtube');
  });

  it('estimates durations on one timeline shared with the videos', async () => {
    const watch = [
      row('2025-03-01T20:10:00Z', 'Last video', 'Bench Lab Builds', false),
      row('2025-03-01T20:04:00Z', 'Song two', 'Velvet Static', true),
      row('2025-03-01T20:00:00Z', 'Song one', 'Velvet Static', true),
    ];
    const zip = zipSync({ 'Takeout/YouTube and YouTube Music/history/watch-history.json': strToU8(JSON.stringify(watch)) });
    const r = await ingestFiles([new File([zip as BlobPart], 'takeout.zip')]);
    expect(r.events.map((e) => [e.source, e.title, e.ms / MIN])).toEqual([
      ['ytmusic', 'Song one', 4],
      ['ytmusic', 'Song two', 6], // up to the next video, not the next song
      ['youtube', 'Last video', 8], // nothing after it: the default
    ]);
  });
});

describe('YouTube Music in the story and on the card', () => {
  const ev = (p: Partial<LifeEvent> & Pick<LifeEvent, 'source' | 't'>): LifeEvent => ({ kind: 'music', ms: 4 * MIN, est: true, title: 'Song', group: 'Artist', ...p });
  const days = Array.from({ length: 30 }, (_, d) => Date.parse('2025-04-01T15:00:00Z') + d * 86_400_000);
  const events: LifeEvent[] = [
    // 30 days × 10 songs of YouTube Music, mostly one artist.
    ...days.flatMap((t) => Array.from({ length: 10 }, (_, k) => ev({ source: 'ytmusic', t: t + k * 4 * MIN, title: k < 7 ? 'Glass Harbor' : 'Ferry', group: k < 7 ? 'Mona Driftwood' : 'Okra & Ash' }))),
    // A few videos, one channel.
    ...days.slice(0, 5).map((t) => ev({ source: 'youtube', kind: 'video', t: t + 5 * H, ms: 10 * MIN, title: 'Video', group: 'Bench Lab Builds' })),
  ];
  const ins = computeInsights(events, 2025);
  const ym = ins.sources.find((s) => s.source === 'ytmusic')!;
  const yt = ins.sources.find((s) => s.source === 'youtube')!;

  it('ranks artists and songs as music, by plays, and never as YouTube channels or videos', () => {
    expect(ym.top.map((t) => [t.name, t.count])).toEqual([['Mona Driftwood', 210], ['Okra & Ash', 90]]);
    expect(ym.topTitles[0]).toMatchObject({ name: 'Glass Harbor — Mona Driftwood', count: 210 });
    expect(yt.events).toBe(5);
    expect(yt.top.map((t) => t.name)).toEqual(['Bench Lab Builds']);
  });

  it('counts as music for the persona', () => {
    expect(ins.persona.id).toMatch(/-music$/);
    expect(persona({ ytmusic: 0.6, youtube: 0.4 }, 0, 0, 0).name).toBe('Everyday Soundtracker');
  });

  it('gets its own approximate music slide, and the YouTube slide counts only videos', () => {
    const slides = buildSlides(ins);
    const ids = slides.map((s) => s.id);
    expect(ids).toContain('ytmusic');
    expect(ids.indexOf('ytmusic')).toBeLessThan(ids.indexOf('youtube'));
    const music = JSON.stringify(slides.find((s) => s.id === 'ytmusic')!.body);
    expect(music).toContain('≈');
    expect(music).toContain('Mona Driftwood');
    const video = JSON.stringify(slides.find((s) => s.id === 'youtube')!.body);
    expect(video).not.toContain('Mona Driftwood');
  });

  it('never claims a listening run "without a break" from estimated durations', () => {
    expect(ins.marathon).toBeNull();
    expect(buildSlides(ins).some((s) => JSON.stringify(s.body).includes('Longest listening run'))).toBe(false);
  });

  it('can give the card its #1 artist, hidden by default', () => {
    expect(cardLines(ins, new Set()).find((l) => l.id === 'topArtist')!.value).toBe(`${HIDDEN} · 210 plays`);
    expect(cardLines(ins, new Set<RevealId>(['topArtist'])).find((l) => l.id === 'topArtist')!.value).toBe('Mona Driftwood · 210 plays');
    expect(mediaPhrase(ins)).toBe('of music and videos');
    for (const format of ['story', 'square'] as const) {
      const svg = renderCardSvg(ins, { format, theme: 'dusk', reveal: new Set() });
      for (const name of ['Mona Driftwood', 'Glass Harbor', 'Okra', 'Bench Lab Builds']) expect(svg).not.toContain(name);
      expect(svg).toContain('YouTube Music');
    }
  });

  it('keeps a five-source legend inside the card', () => {
    const five = computeInsights([
      ...events,
      ev({ source: 'spotify', t: Date.parse('2025-06-02T09:00:00Z'), ms: 5 * H, est: false }),
      ev({ source: 'applemusic', t: Date.parse('2025-06-02T19:00:00Z'), ms: 5 * H, est: false }),
      ev({ source: 'netflix', kind: 'film', t: Date.parse('2025-06-04T20:00:00Z'), ms: 5 * H, est: false }),
    ], 2025);
    for (const format of ['story', 'square'] as const) {
      const svg = renderCardSvg(five, { format, theme: 'paper', reveal: new Set() });
      const legend = [...svg.matchAll(/<text x="(\d+)" y="\d+" font-size="(\d+)" fill="[^"]+">((?:Spotify|Apple Music|YouTube Music|YouTube|Netflix) \d+%)<\/text>/g)];
      expect(legend).toHaveLength(5);
      const [x, size, label] = legend[4].slice(1);
      // the same width estimate the renderer uses: 18 px per character at 32 px
      expect(Number(x) + label.length * 18 * (Number(size) / 32)).toBeLessThanOrEqual(1080 - 80 + 1);
    }
  });
});

describe('the synthetic demo', () => {
  it('holds YouTube Music in the same watch history, with invented artists', async () => {
    const watch = JSON.parse(demoFiles(2025).find((f) => f.name.endsWith('watch-history.json'))!.text) as { header: string }[];
    expect(watch.some((r) => r.header === 'YouTube Music')).toBe(true);
    const r = await ingestFiles(demoFiles(2025).map((f) => new File([f.text], f.name)));
    const ym = computeInsights(r.events, 2025).sources.find((s) => s.source === 'ytmusic')!;
    expect(['Sunday Cartographers', 'Mona Driftwood', 'Tin Lantern Club', 'Okra & Ash', 'Pale Harbour Radio']).toContain(ym.top[0].name);
    expect(r.events.filter((e) => e.source === 'youtube' && e.kind === 'music')).toEqual([]);
  });
});
