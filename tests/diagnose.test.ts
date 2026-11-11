import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { entrySignals, explainFile, explainZip } from '../src/diagnose';
import { ingestFiles } from '../src/ingest';
import { fixture } from './helpers';

const file = (name: string, data: Uint8Array | string) => new File([data as BlobPart], name);
const hintFor = async (name: string, entries: Record<string, Uint8Array>) => {
  const r = await ingestFiles([file(name, zipSync(entries))]);
  expect(r.events).toEqual([]);
  expect(r.ignored.map((f) => f.file)).toEqual([name]);
  return r.ignored[0].hint;
};
const junk = strToU8('{}');

describe('explaining zips without history', () => {
  it('tells a Takeout with YouTube data but no history to tick “history”', async () => {
    const hint = await hintFor('takeout-20261110T101500Z-001.zip', {
      'Takeout/archive_browser.html': junk,
      'Takeout/YouTube and YouTube Music/subscriptions/subscriptions.csv': strToU8('Channel Id,Channel Url,Channel Title'),
      'Takeout/YouTube and YouTube Music/videos/holiday.mp4': new Uint8Array(1000),
    });
    expect(hint).toMatch(/YouTube data but no watch or search history/);
    expect(hint).toMatch(/“history” is ticked/);
    expect(hint).toMatch(/split into several zips/);
  });

  it('tells a Takeout of other Google products what to select', async () => {
    const hint = await hintFor('takeout.zip', { 'Takeout/Google Photos/album/IMG_0001.jpg': new Uint8Array(10) });
    expect(hint).toMatch(/no YouTube or Search history/);
    expect(hint).not.toMatch(/split/);
  });

  it('recognises a Spotify export without streaming history (technical log, account details)', async () => {
    expect(await hintFor('my_spotify_data.zip', { 'Spotify Technical Log Information/Ad_Interactions.json': junk })).toMatch(/Spotify export has no listening history.*Extended streaming history/);
    expect(await hintFor('data.zip', { 'MyData/Userdata.json': junk, 'MyData/Playlist1.json': junk })).toMatch(/Spotify export/);
  });

  it('recognises a Netflix export without ViewingActivity.csv', async () => {
    const hint = await hintFor('netflix-report.zip', { 'PAYMENT_AND_BILLING/BillingHistory.csv': strToU8('a,b'), 'CLICKSTREAM/Clickstream.csv': strToU8('a,b') });
    expect(hint).toMatch(/Netflix export has no viewing activity.*ViewingActivity\.csv/);
  });

  it('says plainly when an unrelated archive is not supported', async () => {
    expect(await hintFor('instagram-me-2026.zip', { 'your_instagram_activity/likes/liked_posts.json': junk })).toMatch(/Instagram and Facebook exports are not supported/);
    expect(await hintFor('photos.zip', { 'IMG_0001.jpg': new Uint8Array(10) })).toBe('No Spotify, Apple Music, YouTube, Google Search or Netflix history inside this zip.');
  });

  it('keeps parsing the history it does find and only explains the rest', async () => {
    const r = await ingestFiles([
      file('watch-history.json', fixture('google/watch-history.json')),
      file('extra.zip', zipSync({ 'Takeout/Google Photos/a.jpg': new Uint8Array(4) })),
    ]);
    expect(r.reports.map((x) => x.format)).toEqual(['Google Takeout activity (JSON)']);
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.ignored.map((f) => f.file)).toEqual(['extra.zip']);
  });
});

describe('explaining loose files', () => {
  it('flags a history-named file whose contents did not parse', async () => {
    const r = await ingestFiles([file('watch-history.json', '[]'), file('Streaming_History_Audio_2025.json', 'not json')]);
    expect(r.ignored).toHaveLength(2);
    for (const f of r.ignored) expect(f.hint).toMatch(/looks like a history file, but its contents did not match/);
  });

  it('names the service for known non-history files and rejects other types', () => {
    expect(explainFile('YourLibrary.json', false)).toMatch(/Spotify export has no listening history/);
    expect(explainFile('notes.json', false)).toMatch(/Not a Spotify, Apple Music, YouTube, Google Search or Netflix history file/);
    expect(explainFile('holiday.mp4', false)).toBe('Only .zip, .json, .csv and .html exports can be read.');
  });

  it('reads only names and returns plain hints with no file content, paths or URLs', () => {
    expect(entrySignals('Takeout\\YouTube and YouTube Music\\history\\x.txt')).toEqual(['takeout', 'youtube']);
    expect(entrySignals('netflix-report/PROFILES/Profiles.csv')).toEqual(['netflix']);
    expect(entrySignals('Family/messages/inbox.csv')).toEqual([]);
    const hints = [explainZip('a-002.zip', new Set()), explainZip('a.zip', new Set(['spotify'])), explainFile('a.csv', false)];
    for (const h of hints) expect(h).not.toMatch(/https?:|a-002|a\.zip|a\.csv/);
  });
});
