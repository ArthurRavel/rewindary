import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { ingestFiles, isInterestingPath, looksLikeActivityHead } from '../src/ingest';
import { fixtureBytes } from './helpers';

const file = (name: string, data: Uint8Array) => new File([data as BlobPart], name);
const json = (v: unknown) => strToU8(JSON.stringify(v));

// A Takeout in another language names its folders and files in that language, so the
// English file names the importer looks for never match. These tests pin the content-based fallback.
describe('Takeout with localized file names', () => {
  const english = async () => (await ingestFiles([file('en.zip', zipSync({
    'Takeout/YouTube and YouTube Music/history/watch-history.json': fixtureBytes('google/watch-history.json'),
    'Takeout/My Activity/Search/MyActivity.json': fixtureBytes('google/MyActivity-search.json'),
  }))])).events;

  it('reads the same history from French, German and Spanish file names', async () => {
    const reference = await english();
    expect(reference.length).toBeGreaterThan(0);
    const r = await ingestFiles([file('takeout-20261110T101500Z-001.zip', zipSync({
      'Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json': fixtureBytes('google/watch-history.json'),
      'Takeout/Mon activité/Recherche/MonActivité.json': fixtureBytes('google/MyActivity-search.json'),
      'Takeout/archive_browser.html': strToU8('<html><body>Takeout</body></html>'),
    })), file('de.zip', zipSync({
      'Takeout/YouTube und YouTube Music/Verlauf/Wiedergabeverlauf.json': fixtureBytes('google/watch-history.json'),
    })), file('es.zip', zipSync({
      'Takeout/YouTube y YouTube Music/historial/historial de reproducciones.html': fixtureBytes('google/watch-history.html'),
    }))]);
    expect(r.ignored).toEqual([]);
    expect(r.reports.map((x) => x.format)).toEqual(['Google Takeout activity (JSON)', 'Google Takeout activity (JSON)', 'Google Takeout activity (JSON)', 'Google Takeout activity (HTML)']);
    expect(r.events.filter((e) => e.kind !== 'search').length).toBeGreaterThan(0);
    // The French zip alone reproduces the English reference (the German zip repeats the watches, which merge away).
    const fr = await ingestFiles([file('fr.zip', zipSync({
      'Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json': fixtureBytes('google/watch-history.json'),
      'Takeout/Mon activité/Recherche/MonActivité.json': fixtureBytes('google/MyActivity-search.json'),
    }))]);
    expect(fr.events).toEqual(reference);
  });

  it('does not report, or keep, unrelated JSON and HTML found while looking', async () => {
    const r = await ingestFiles([file('takeout.zip', zipSync({
      'Takeout/Google Photos/Trip/IMG_0001.jpg.json': json({ title: 'IMG_0001.jpg', photoTakenTime: { timestamp: '1700000000' } }),
      'Takeout/Google Photos/Trip/métadonnées.json': json([{ foo: 1 }]),
      'Takeout/Chrome/Bookmarks.html': strToU8('<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://example.com">Example</A></DL>'),
    }))]);
    expect(r.events).toEqual([]);
    expect(r.reports).toEqual([]);
    // The zip still gets the explanation for a Takeout without history, not one note per probed file.
    expect(r.ignored.map((f) => f.file)).toEqual(['takeout.zip']);
    expect(r.ignored[0].hint).toMatch(/no YouTube or Search history/);
  });

  it('drops localized activity from products it does not read, such as Maps', async () => {
    const maps = [{ header: 'Maps', title: 'Vous avez recherché Boulangerie', titleUrl: 'https://www.google.com/maps/search/Boulangerie', time: '2025-03-01T10:00:00.000Z', products: ['Maps'] }];
    const r = await ingestFiles([file('takeout.zip', zipSync({ 'Takeout/Mon activité/Maps/MonActivité.json': json(maps) }))]);
    expect(r.reports).toEqual([]);
    expect(r.ignored.map((f) => f.file)).toEqual(['takeout.zip']);
  });

  it('finds localized history behind thousands of tiny photo sidecars without overflowing the stack', async () => {
    const entries: Record<string, Uint8Array> = {};
    for (let i = 0; i < 6000; i++) entries[`Takeout/Google Photos/Trip/IMG_${i}.jpg.json`] = json({ title: `IMG_${i}.jpg` });
    entries['Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json'] = fixtureBytes('google/watch-history.json');
    const r = await ingestFiles([file('takeout.zip', zipSync(entries))]);
    expect(r.ignored).toEqual([]);
    expect(r.events.length).toBeGreaterThan(0);
  });

  it('ignores a peeked entry it cannot decompress instead of failing the import', async () => {
    const zip = zipSync({
      'Takeout/Autre/inconnu.json': json([{ header: 'YouTube' }]),
      'Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json': fixtureBytes('google/watch-history.json'),
    });
    // Rewrite the first entry's local header to claim compression method 14 (LZMA), which fflate cannot read.
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    view.setUint16(8, 14, true);
    const r = await ingestFiles([file('takeout.zip', zip)]);
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.ignored).toEqual([]);
  });

  it('still reads English files when stored without compression', async () => {
    const stored = zipSync({ 'Takeout/YouTube and YouTube Music/history/watch-history.json': [fixtureBytes('google/watch-history.json'), { level: 0 }] });
    const r = await ingestFiles([file('stored.zip', stored)]);
    expect(r.ignored).toEqual([]);
    expect(r.events.length).toBeGreaterThan(0);
  });

  it('only keeps a probed file when its start looks like Takeout activity', () => {
    expect(looksLikeActivityHead('[\n  {\n    "header": "YouTube",\n    "title": "x"')).toBe(true);
    expect(looksLikeActivityHead('﻿ [{"header":"Search"')).toBe(true);
    expect(looksLikeActivityHead('<html><style>.a{}</style><div class="outer-cell mdl-cell"><div class="content-cell')).toBe(true);
    expect(looksLikeActivityHead('[{"foo":1}]')).toBe(false);
    expect(looksLikeActivityHead('{"header":"YouTube"}')).toBe(false);
    expect(looksLikeActivityHead('<html><body>Bookmarks</body></html>')).toBe(false);
    expect(looksLikeActivityHead('')).toBe(false);
  });

  it('isInterestingPath is unchanged: probing is a fallback, not a wider filter', () => {
    expect(isInterestingPath('Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json')).toBe(false);
    expect(isInterestingPath('Takeout/YouTube and YouTube Music/history/watch-history.json')).toBe(true);
  });
});
