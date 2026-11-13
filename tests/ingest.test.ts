import { describe, expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { combineBatches, ingestFiles, isInterestingPath, readBatch } from '../src/ingest';
import { fixture, fixtureBytes } from './helpers';

const file = (name: string, data: Uint8Array | string) => new File([data as BlobPart], name);

describe('ingestFiles', () => {
  it('streams zips, inflating only known export files', async () => {
    const zip = zipSync({
      'my_spotify_data/Spotify Extended Streaming History/Streaming_History_Audio_2024-2025_0.json': fixtureBytes('spotify/Streaming_History_Audio_2024-2025_0.json'),
      'my_spotify_data/Spotify Extended Streaming History/ReadMeFirst.pdf': strToU8('%PDF synthetic'),
      'Takeout/YouTube and YouTube Music/history/watch-history.json': fixtureBytes('google/watch-history.json'),
      'Takeout/YouTube and YouTube Music/videos/holiday.mp4': new Uint8Array(200_000).fill(7),
    });
    const progress: string[] = [];
    const r = await ingestFiles([file('takeout.zip', zip)], (m) => progress.push(m));
    expect(r.reports.map((x) => x.format)).toEqual(['Spotify extended streaming history', 'Google Takeout activity (JSON)']);
    expect(r.ignored).toEqual([]);
    expect(r.events).toHaveLength(8);
    expect(progress.some((p) => p.startsWith('Unpacking takeout.zip'))).toBe(true);
  });

  it('prefers extended history over account data and de-duplicates repeated uploads', async () => {
    const ext = fixture('spotify/Streaming_History_Audio_2024-2025_0.json');
    const r = await ingestFiles([
      file('Streaming_History_Audio_2024-2025_0.json', ext),
      file('copy/Streaming_History_Audio_2024-2025_0.json', ext),
      file('StreamingHistory_music_0.json', fixture('spotify/StreamingHistory_music_0.json')),
    ]);
    expect(r.events).toHaveLength(4);
    expect(r.reports[1].warnings.join()).toMatch(/duplicate/);
    expect(r.reports[2].events).toBe(0);
  });

  it('estimates YouTube durations from gaps (1–15 min)', async () => {
    const r = await ingestFiles([file('watch-history.json', fixture('google/watch-history.json'))]);
    const vids = r.events.filter((e) => e.source === 'youtube');
    expect(vids.every((e) => e.est && e.ms >= 60_000 && e.ms <= 15 * 60_000)).toBe(true);
    expect(vids.find((e) => e.group === 'Atlas of Small Things')!.ms).toBe(10 * 60_000);
  });

  it('collects Netflix profiles and lists unrecognised files', async () => {
    const r = await ingestFiles([file('ViewingActivity.csv', fixture('netflix/ViewingActivity.csv')), file('random.csv', 'a,b\n1,2')]);
    expect(r.profiles).toEqual(['Guest', 'Sam']);
    expect(r.ignored.map((f) => f.file)).toEqual(['random.csv']);
    expect(r.ignored[0].hint).toMatch(/Not a Spotify, Apple Music, YouTube, Google Search or Netflix history file/);
  });
});

it('isInterestingPath filters archive entries', () => {
  expect(isInterestingPath('Takeout/My Activity/YouTube/MyActivity.json')).toBe(true);
  expect(isInterestingPath('Takeout/My Activity/Search/My Activity.html')).toBe(true);
  expect(isInterestingPath('netflix-report/CONTENT_INTERACTION/ViewingActivity.csv')).toBe(true);
  expect(isInterestingPath('Takeout/YouTube/videos/clip.mp4')).toBe(false);
  expect(isInterestingPath('my_spotify_data/Userdata.json')).toBe(false);
});

describe('exports added later', () => {
  const extended = () => file('Streaming_History_Audio_2024-2025_0.json', fixture('spotify/Streaming_History_Audio_2024-2025_0.json'));
  const account = () => file('StreamingHistory_music_0.json', fixture('spotify/StreamingHistory_music_0.json'));
  /** Like the app: each drop is merged as soon as it is read, before the next one arrives. */
  const later = async (...drops: File[][]) => {
    const batches = [];
    let r = combineBatches([]);
    for (const d of drops) {
      batches.push(await readBatch(d));
      r = combineBatches(batches);
    }
    return r;
  };

  it('ignores the 1-year Spotify account data whichever export arrives first', async () => {
    const together = await ingestFiles([extended(), account()]);
    for (const r of [await later([account()], [extended()]), await later([extended()], [account()])]) {
      expect(r.events).toEqual(together.events);
      const acc = r.reports.find((x) => x.format.startsWith('Spotify account'));
      expect(acc?.events).toBe(0);
      expect(acc?.warnings).toContain('Ignored because the extended streaming history covers the same plays.');
    }
  });

  it('merges an export added twice and says so', async () => {
    const once = await ingestFiles([extended()]);
    const r = await later([extended()], [extended()]);
    expect(r.events).toEqual(once.events);
    expect(r.reports).toHaveLength(2);
    expect(r.reports[1].events).toBe(0);
    expect(r.reports[1].warnings).toContain(`${once.events.length} duplicate entries merged.`);
  });

  it('estimates YouTube durations across batches, and matches a Takeout added twice', async () => {
    const rows = JSON.parse(fixture('google/watch-history.json')) as unknown[];
    const half = Math.ceil(rows.length / 2);
    const part = (r: unknown[]) => file('watch-history.json', JSON.stringify(r));
    const whole = await ingestFiles([part(rows)]);
    const split = await later([part(rows.slice(0, half))], [part(rows.slice(half))]);
    expect(whole.events.filter((e) => e.source === 'youtube').length).toBeGreaterThan(2);
    expect(split.events).toEqual(whole.events);
    const twice = await later([part(rows)], [part(rows)]);
    expect(twice.events).toEqual(whole.events);
  });
});
