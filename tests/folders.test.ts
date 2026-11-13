import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { inFolder, ingestFiles, isCandidateName, type InputBlob } from '../src/ingest';
import { fromInput, walkEntries, type EntryLike } from '../src/ui/folders';
import { fixtureBytes } from './helpers';

const file = (name: string, data: Uint8Array | string) => new File([(typeof data === 'string' ? strToU8(data) : data) as BlobPart], name);
/** A file as it arrives from a dropped or chosen folder. */
const at = (path: string, data: Uint8Array | string) => inFolder(file(path.split('/').pop()!, data), path);

/** A file that fails the test if anything tries to read it, to prove skipped files are never opened. */
function untouchable(path: string): InputBlob {
  const no = () => { throw new Error(`${path} was read`); };
  return { name: path.split('/').pop()!, size: 1_000_000, path, stream: no, text: no, slice: no };
}

// Safari on macOS unzips downloads by default, so an export often arrives as a folder rather than a zip.
describe('unzipped export folders', () => {
  it('reads an unzipped Takeout folder exactly like the zip it came from', async () => {
    const entries = {
      'Takeout/archive_browser.html': strToU8('<html><body>Takeout</body></html>'),
      'Takeout/YouTube and YouTube Music/history/watch-history.json': fixtureBytes('google/watch-history.json'),
      'Takeout/My Activity/Search/MyActivity.json': fixtureBytes('google/MyActivity-search.json'),
    };
    const zipped = await ingestFiles([file('takeout.zip', zipSync(entries))]);
    const folder = await ingestFiles(Object.entries(entries).map(([p, d]) => at(p, d)));
    expect(folder.ignored).toEqual([]);
    expect(folder.events.length).toBeGreaterThan(0);
    expect(folder.events).toEqual(zipped.events);
    expect(folder.reports.map((r) => r.file)).toEqual(['Takeout/My Activity/Search/MyActivity.json', 'Takeout/YouTube and YouTube Music/history/watch-history.json']);
  });

  it('never opens photos, videos or other non-export files inside a folder', async () => {
    const r = await ingestFiles([
      untouchable('Takeout/Google Photos/Trip/IMG_0001.jpg'),
      untouchable('Takeout/YouTube and YouTube Music/videos/holiday.mp4'),
      untouchable('Takeout/YouTube and YouTube Music/subscriptions/notes.txt'),
      at('Takeout/YouTube and YouTube Music/history/watch-history.html', fixtureBytes('google/watch-history.html')),
    ]);
    expect(r.ignored).toEqual([]);
    expect(r.reports.map((x) => x.format)).toEqual(['Google Takeout activity (HTML)']);
  });

  it('finds localized history by its start and only peeks at other JSON and HTML', async () => {
    const reads: string[] = [];
    const spy = (path: string, data: string): InputBlob => {
      const f = at(path, data);
      return { ...f, path, name: f.name, size: f.size, text: () => { reads.push(`full ${path}`); return f.text(); }, slice: (a, b) => { reads.push(`peek ${path}`); return f.slice(a, b); } };
    };
    const r = await ingestFiles([
      at('Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json', fixtureBytes('google/watch-history.json')),
      spy('Takeout/Google Photos/Voyage/métadonnées.json', '{"title":"Voyage"}'),
      spy('Takeout/Chrome/Bookmarks.html', '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL></DL>'),
    ]);
    expect(r.ignored).toEqual([]);
    expect(r.events.length).toBeGreaterThan(0);
    // The unrelated files were peeked at and never read in full.
    expect(reads.sort()).toEqual(['peek Takeout/Chrome/Bookmarks.html', 'peek Takeout/Google Photos/Voyage/métadonnées.json']);
  });

  it('reads every part of an unzipped Spotify history and still prefers it over the account data', async () => {
    const r = await ingestFiles([
      at('Spotify Extended Streaming History/Streaming_History_Audio_2024-2025_0.json', fixtureBytes('spotify/Streaming_History_Audio_2024-2025_0.json')),
      at('Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf', 'pdf'),
      at('Spotify Account Data/StreamingHistory_music_0.json', fixtureBytes('spotify/StreamingHistory_music_0.json')),
      at('Spotify Account Data/Userdata.json', '{"username":"x"}'),
    ]);
    expect(r.ignored).toEqual([]);
    expect(r.reports.map((x) => [x.file, x.events > 0])).toEqual([
      ['Spotify Extended Streaming History/Streaming_History_Audio_2024-2025_0.json', true],
      ['Spotify Account Data/StreamingHistory_music_0.json', false],
    ]);
  });

  it('gives one note per folder without history, saying which export to request', async () => {
    const r = await ingestFiles([
      at('Takeout/archive_browser.html', '<html></html>'),
      at('Takeout/YouTube and YouTube Music/subscriptions/subscriptions.csv', 'Channel Id,Channel Url,Channel Title'),
      at('Spotify Account Data/Userdata.json', '{"username":"x"}'),
      at('Holiday/IMG_0001.jpg', 'jpg'),
    ]);
    expect(r.events).toEqual([]);
    expect(r.ignored.map((f) => f.file)).toEqual(['Takeout/', 'Spotify Account Data/', 'Holiday/']);
    expect(r.ignored[0].hint).toMatch(/YouTube data but no watch or search history/);
    expect(r.ignored[0].hint).not.toMatch(/split/); // a folder name says nothing about split parts
    expect(r.ignored[1].hint).toMatch(/Extended streaming history/);
    expect(r.ignored[2].hint).toBe('No Spotify, Apple Music, YouTube, Google Search or Netflix history inside this folder.');
  });

  it('reads zips inside a folder, and does not add a folder note on top of a zip note', async () => {
    const r = await ingestFiles([
      at('Downloads/netflix-report.zip', zipSync({ 'netflix-report/CONTENT_INTERACTION/ViewingActivity.csv': fixtureBytes('netflix/ViewingActivity.csv') })),
      at('Downloads/empty.zip', zipSync({ 'readme.txt': strToU8('hi') })),
    ]);
    expect(r.reports.map((x) => x.file)).toEqual(['Downloads/netflix-report.zip/netflix-report/CONTENT_INTERACTION/ViewingActivity.csv']);
    expect(r.ignored.map((f) => f.file)).toEqual(['Downloads/empty.zip']);
  });

  it('keeps loose files, and a history-named file that does not parse, exactly as before', async () => {
    const r = await ingestFiles([
      file('ViewingActivity.csv', fixtureBytes('netflix/ViewingActivity.csv')),
      at('Takeout/YouTube and YouTube Music/history/watch-history.json', '[{"oops"'),
      file('notes.txt', 'hello'),
    ]);
    expect(r.reports.map((x) => x.file)).toEqual(['ViewingActivity.csv']);
    expect(r.ignored.map((f) => f.file)).toEqual(['Takeout/YouTube and YouTube Music/history/watch-history.json', 'notes.txt']);
    expect(r.ignored[0].hint).toMatch(/looks like a history file/);
    expect(r.ignored[1].hint).toMatch(/Only \.zip, \.tgz, \.json, \.csv and \.html/);
  });

  it('never opens Google Photos sidecars, whatever the language', async () => {
    const r = await ingestFiles([
      untouchable('Takeout/Google Fotos/Reise/IMG_0001.jpg.json'),
      untouchable('Takeout/Google Photos/Trip/PXL_2025.mp4.supplemental-metadata.json'),
      untouchable('Takeout/Google Photos/Trip/IMG_0002.HEIC.supplemental-metad.json'),
      at('Takeout/YouTube und YouTube Music/Verlauf/Wiedergabeverlauf.json', fixtureBytes('google/watch-history.json')),
    ]);
    expect(r.ignored).toEqual([]);
    expect(r.events.length).toBeGreaterThan(0);
    expect(['watch-history.json', 'MyActivity.json', 'Wiedergabeverlauf.json', 'historique des vidéos regardées.html', 'ViewingActivity.csv', 'export.zip'].every(isCandidateName)).toBe(true);
    expect(['IMG_0001.jpg', 'IMG_0001.jpg.json', 'clip.MOV.json', 'notes.txt'].some(isCandidateName)).toBe(false);
  });

  it('skips a peeked file it cannot read, but fails loudly on an unreadable history file', async () => {
    const unreadable = (path: string): InputBlob => {
      const no = () => { throw new Error('NotReadableError'); };
      return { name: path.split('/').pop()!, size: 10, path, stream: no, text: () => Promise.reject(new Error('NotReadableError')), slice: () => ({ text: () => Promise.reject(new Error('NotReadableError')) }) };
    };
    const ok = await ingestFiles([
      unreadable('Takeout/Google Photos/Trip/metadata.json'),
      at('Takeout/YouTube and YouTube Music/history/watch-history.json', fixtureBytes('google/watch-history.json')),
    ]);
    expect(ok.ignored).toEqual([]);
    expect(ok.events.length).toBeGreaterThan(0);
    await expect(ingestFiles([unreadable('Takeout/YouTube and YouTube Music/history/watch-history.json')])).rejects.toThrow('NotReadableError');
  });

  it('keeps every history file found among hundreds of JSON files read in parallel', async () => {
    const files = Array.from({ length: 400 }, (_, i) => at(`Takeout/Google Photos/Trip/metadata-${i}.json`, `{"title":"Album ${i}"}`));
    files.splice(137, 0, at('Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json', fixtureBytes('google/watch-history.json')));
    files.splice(311, 0, at('Takeout/Mon activité/Recherche/MonActivité.json', fixtureBytes('google/MyActivity-search.json')));
    const r = await ingestFiles(files);
    expect(r.ignored).toEqual([]);
    expect(r.reports.map((x) => x.file)).toEqual(['Takeout/Mon activité/Recherche/MonActivité.json', 'Takeout/YouTube et YouTube Music/historique/historique des vidéos regardées.json']);
  });

  it('normalises Windows separators and leading slashes in folder paths', async () => {
    const r = await ingestFiles([at('/Takeout\\YouTube and YouTube Music\\history\\watch-history.json', fixtureBytes('google/watch-history.json'))]);
    expect(r.reports.map((x) => x.file)).toEqual(['Takeout/YouTube and YouTube Music/history/watch-history.json']);
  });
});

describe('collecting dropped and chosen folders', () => {
  type Node = { name: string; data?: string; children?: Node[] };
  const opened: string[] = [];
  /** A fake File and Directory Entries tree that hands out folder contents in batches, like Chromium. */
  function entry(node: Node, parent = ''): EntryLike {
    const fullPath = `${parent}/${node.name}`;
    if (!node.children) {
      return { isFile: true, isDirectory: false, name: node.name, fullPath, file: (ok: (f: File) => void) => { opened.push(fullPath); ok(file(node.name, node.data ?? '')); } } as EntryLike;
    }
    const kids = node.children.map((c) => entry(c, fullPath));
    return {
      isFile: false, isDirectory: true, name: node.name, fullPath,
      createReader: () => { let i = 0; return { readEntries: (ok: (b: EntryLike[]) => void) => { const b = kids.slice(i, i + 100); i += 100; ok(b); } }; },
    } as EntryLike;
  }

  it('walks nested folders across several batches, keeping relative paths', async () => {
    opened.length = 0;
    const photos: Node[] = Array.from({ length: 230 }, (_, i) => ({ name: `IMG_${i}.jpg` }));
    const tree: Node = { name: 'Takeout', children: [
      { name: 'Google Photos', children: photos },
      { name: 'YouTube and YouTube Music', children: [{ name: 'history', children: [{ name: 'watch-history.json', data: '[]' }] }] },
      { name: 'archive_browser.html', data: '<html></html>' },
    ] };
    const counts: number[] = [];
    const picked = await walkEntries([entry(tree), entry({ name: 'ViewingActivity.csv', data: 'x' })], (n) => counts.push(n));
    // Order inside a folder does not matter: ingest sorts each folder's files by path.
    expect(picked.map((p) => p.path ?? `(loose) ${p.file.name}`).sort()).toEqual([
      '(loose) ViewingActivity.csv',
      'Takeout/YouTube and YouTube Music/history/watch-history.json',
      'Takeout/archive_browser.html',
    ]);
    // The 230 photos were listed but never turned into File objects.
    expect(opened.some((p) => p.endsWith('.jpg'))).toBe(false);
    expect(counts).toEqual([]);
  });

  it('keeps a loose unsupported file so it still gets its note', async () => {
    const picked = await walkEntries([entry({ name: 'photo.jpg' }), entry({ name: 'Empty', children: [] })]);
    expect(picked.map((p) => [p.file.name, p.path])).toEqual([['photo.jpg', undefined]]);
  });

  it('fails clearly when a folder cannot be listed', async () => {
    const broken = { isFile: false, isDirectory: true, name: 'Locked', fullPath: '/Locked', createReader: () => ({ readEntries: (_ok: unknown, fail: (e: unknown) => void) => fail(new Error('permission denied')) }) } as EntryLike;
    await expect(walkEntries([broken])).rejects.toThrow('permission denied');
  });

  it('takes the folder path from a folder picker and leaves plain picks loose', () => {
    const inFolderPick = file('watch-history.json', '[]');
    Object.defineProperty(inFolderPick, 'webkitRelativePath', { value: 'Takeout/YouTube and YouTube Music/history/watch-history.json' });
    expect(fromInput([inFolderPick, file('a.zip', '')]).map((p) => p.path)).toEqual(['Takeout/YouTube and YouTube Music/history/watch-history.json', undefined]);
    expect(fromInput(null)).toEqual([]);
  });
});
