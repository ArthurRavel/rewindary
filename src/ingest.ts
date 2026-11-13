import { Unzip, UnzipInflate } from 'fflate';
import type { IngestResult, LifeEvent, ParseReport } from './model';
import { isSpotifyAccount, isSpotifyExtended, parseSpotifyAccount, parseSpotifyExtended } from './parsers/spotify';
import { looksLikeNetflixCsv, parseNetflixActivity, parseNetflixSimple } from './parsers/netflix';
import { looksLikeAppleMusicCsv, parseAppleMusicActivity } from './parsers/apple';
import { estimateYouTubeDurations, isGoogleActivity, looksLikeGoogleActivityHtml, parseGoogleActivity } from './parsers/google';
import { parseCsv, stripBom } from './parsers/text';
import { entrySignals, explainFile, explainFolder, explainZip, type IgnoredFile, type Signal } from './diagnose';

/** Anything with a name and the Blob reading API (File in browsers, File/Blob in Node ≥ 20). */
export interface InputBlob {
  name: string;
  size: number;
  /**
   * Where the file sat inside a dropped or chosen folder, e.g. "Takeout/YouTube and YouTube Music/history/watch-history.json".
   * Absent for files dropped on their own. Safari on macOS unzips downloads by default, so a folder is a common way exports arrive.
   */
  path?: string;
  stream(): ReadableStream<Uint8Array>;
  text(): Promise<string>;
  slice(start?: number, end?: number): { text(): Promise<string> };
}

/** A File (or Blob) that came from inside a folder. Kept as a wrapper because a File's own name cannot hold a path. */
export function inFolder(file: InputBlob, path: string): InputBlob {
  return { name: file.name, size: file.size, path, stream: () => file.stream(), text: () => file.text(), slice: (a, b) => file.slice(a, b) };
}

/**
 * Inside a folder, only these are ever opened; photos, videos and everything else are skipped by name.
 * So are Google Photos sidecars ("IMG_0001.jpg.json", "IMG_0001.jpg.supplemental-metadata.json"): they are named
 * after the photo in every language, and a big Takeout holds tens of thousands of them.
 */
export const isCandidateName = (name: string) =>
  /\.(zip|json|csv|html?)$/i.test(name) && !/\.(jpe?g|png|gif|heic|heif|webp|tiff?|bmp|dng|mp4|mov|m4v|avi|3gp|mkv|webm)\.([^/]*\.)?json$/i.test(name);

/** Only these entries are decompressed from archives; photos, videos etc. are never inflated. */
export function isInterestingPath(path: string): boolean {
  const p = path.toLowerCase();
  if (!/\.(json|csv|html?)$/.test(p)) return false;
  const base = p.split('/').pop() ?? '';
  return /streaming_history|streaminghistory|endsong|viewingactivity|netflixviewinghistory|applemusicplayactivity|watch-history|search-history|myactivity/.test(
    base.replace(/\s/g, ''),
  );
}


/**
 * Google Takeout names its folders and files in the account's language ("historique des vidéos
 * regardées.json", "Wiedergabeverlauf.json", …), so the English names above miss them. As a
 * fallback, other .json/.html entries are peeked at: only their first 32 KB is looked at, and
 * the entry is kept in full only when it opens like Takeout activity. Its URLs, titles and
 * languages are still never interpreted at this step.
 */
const PROBE_BYTES = 32 * 1024;
const FEED_BYTES = 64 * 1024;
/** A Takeout can hold tens of thousands of small sidecar files and YouTube sorts after Photos, so this is only a runaway guard. */
const MAX_PROBES = 250_000;
/** Peeking at a huge entry cannot be cut short (the inflater has no early stop), so skip those. */
const MAX_PROBE_ENTRY_BYTES = 256 * 1024 * 1024;

/** True when the start of a file looks like Google My Activity / YouTube history (JSON or HTML). */
export function looksLikeActivityHead(head: string): boolean {
  const s = stripBom(head).trimStart();
  if (s.startsWith('[')) return /^\[\s*\{\s*"header"\s*:/.test(s);
  return s.startsWith('<') && s.includes('outer-cell') && s.includes('content-cell');
}

/**
 * Apple's privacy download wraps its data in a second zip ("Apple_Media_Services.zip" inside
 * "Apple Media Services information.zip"). That inner archive is the only one unpacked from inside
 * another, one level deep, and only up to this size; it is then read with the same rules as any zip.
 */
export const isNestedArchive = (path: string) => /(^|\/)apple_media_services[^/]*\.zip$/i.test(path);
const MAX_NESTED_BYTES = 1024 * 1024 * 1024;

type Progress = (msg: string) => void;
interface TextFile { path: string; text: string; /** Found by looking at its content, not its name. */ probed: boolean }

async function unzipInteresting(blob: InputBlob, onProgress: Progress, signals: Set<Signal>, nestedOk = true): Promise<TextFile[]> {
  const files: TextFile[] = [];
  const inner: InputBlob[] = [];
  let probes = 0;
  const pending: Promise<void>[] = [];
  const unzip = new Unzip((entry) => {
    // Names only: they say which service the archive came from if no history is found.
    for (const s of entrySignals(entry.name)) signals.add(s);
    if (nestedOk && isNestedArchive(entry.name) && !(entry.originalSize !== undefined && entry.originalSize > MAX_NESTED_BYTES)) {
      const parts: Uint8Array[] = [];
      pending.push(new Promise<void>((resolve, reject) => {
        entry.ondata = (err, data, final) => {
          if (err) return reject(err);
          parts.push(data);
          if (final) {
            inner.push(archiveBlob(entry.name.split('/').pop()!, `${blob.path ?? blob.name}/${entry.name}`, new Blob(parts as BlobPart[])));
            resolve();
          }
        };
      }));
      entry.start();
      return;
    }
    const named = isInterestingPath(entry.name);
    const probe = !named && probes < MAX_PROBES && /\.(json|html?)$/i.test(entry.name) && !(entry.originalSize !== undefined && entry.originalSize > MAX_PROBE_ENTRY_BYTES);
    if (!named && !probe) return;
    if (probe) probes++;
    let chunks: Uint8Array[] = [];
    let seen = 0;
    let undecided = probe;
    let rejected = false;
    pending.push(
      new Promise<void>((resolve, reject) => {
        entry.ondata = (err, data, final) => {
          // A peeked file that cannot be inflated is just not history; only named files may fail the import.
          if (err) return probe ? resolve() : reject(err);
          if (!rejected) {
            chunks.push(data);
            seen += data.length;
            if (undecided && (seen >= PROBE_BYTES || final)) {
              undecided = false;
              if (!looksLikeActivityHead(new TextDecoder().decode(concat(chunks).subarray(0, PROBE_BYTES)))) {
                rejected = true;
                chunks = []; // the rest of the entry is inflated and dropped without being kept
              }
            }
            if (final && !rejected) files.push({ path: `${blob.path ?? blob.name}/${entry.name}`, text: new TextDecoder().decode(concat(chunks)), probed: probe });
          }
          if (final) resolve();
        };
      }),
    );
    try {
      entry.start();
    } catch (e) {
      // start() throws for a compression method fflate lacks. That must not sink the import
      // for a file we were only peeking at; a known history file that cannot be read still fails loudly.
      if (!probe) throw e;
      pending.pop();
    }
  });
  unzip.register(UnzipInflate);
  const reader = blob.stream().getReader();
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      unzip.push(new Uint8Array(0), true);
      break;
    }
    read += value.length;
    // fflate recurses once per entry inside a chunk, so feed it small slices: a chunk holding
    // thousands of tiny entries (photo sidecars in a big Takeout) would overflow the stack.
    for (let o = 0; o < value.length; o += FEED_BYTES) unzip.push(value.subarray(o, o + FEED_BYTES));
    onProgress(`Unpacking ${blob.name} — ${Math.round((read / Math.max(blob.size, 1)) * 100)}%`);
  }
  await Promise.all(pending);
  for (const z of inner) files.push(...(await unzipInteresting(z, onProgress, signals, false)));
  return files;
}

/** An archive that was itself inside an archive, readable like a dropped file. */
function archiveBlob(name: string, path: string, b: Blob): InputBlob {
  return { name, size: b.size, path, stream: () => b.stream(), text: () => b.text(), slice: (s, e) => b.slice(s, e) };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  if (chunks.length === 0) return new Uint8Array(0);
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export interface Parsed { events: LifeEvent[]; report: ParseReport; profiles?: string[] }

/**
 * What one drop or file pick held, before merging. The app keeps every batch, so exports added later
 * (they often arrive days apart) are merged by the same rules as files dropped together.
 */
export interface IngestBatch { parsed: Parsed[]; ignored: IgnoredFile[] }

/** Detect a file's format from its content (names are only hints) and parse it. */
export function parseTextFile(path: string, rawText: string): Parsed | null {
  const text = stripBom(rawText);
  const lower = path.toLowerCase();
  const trimmed = text.trimStart();
  if (trimmed.startsWith('[')) {
    let rows: unknown;
    try {
      rows = JSON.parse(text);
    } catch {
      return null;
    }
    if (isSpotifyExtended(rows)) return parseSpotifyExtended(rows, path);
    if (isSpotifyAccount(rows)) return parseSpotifyAccount(rows, path);
    if (isGoogleActivity(rows)) return parseGoogleActivity(rows, path);
    return null;
  }
  if (lower.endsWith('.csv')) {
    // Apple Music's header has about 40 columns, so look further than one short line.
    const firstLine = parseCsv(text.slice(0, 8000).split(/\r?\n/)[0] ?? '')[0] ?? [];
    const kind = looksLikeNetflixCsv(firstLine);
    if (kind === 'activity') return parseNetflixActivity(text, path);
    if (kind === 'simple') return parseNetflixSimple(text, path);
    if (looksLikeAppleMusicCsv(firstLine)) return parseAppleMusicActivity(text, path);
    return null;
  }
  if (/\.html?$/.test(lower) && looksLikeGoogleActivityHtml(text)) return parseGoogleActivity(text, path);
  return null;
}

// An estimated duration is not part of the identity: YouTube estimates are rewritten each time batches are merged,
// so a Takeout added twice must still match itself.
const key = (e: LifeEvent) => `${e.source}|${e.kind}|${e.t}|${e.est ? '~' : e.ms}|${e.group}|${e.title}`;

/** Merge per-file results: de-duplicate, prefer Spotify extended history over the 1-year account data. */
export function mergeParsed(parsed: Parsed[]): Omit<IngestResult, 'ignored'> {
  const hasExtended = parsed.some((p) => p.report.format.startsWith('Spotify extended') && p.events.length > 0);
  const seen = new Set<string>();
  const events: LifeEvent[] = [];
  const reports: ParseReport[] = [];
  const profiles = new Set<string>();
  for (const p of parsed) {
    if (hasExtended && p.report.format.startsWith('Spotify account')) {
      reports.push({ ...p.report, events: 0, skipped: p.report.events + p.report.skipped, warnings: [...p.report.warnings, 'Ignored because the extended streaming history covers the same plays.'] });
      continue;
    }
    let dupes = 0;
    for (const e of p.events) {
      const k = key(e);
      if (seen.has(k)) {
        dupes++;
        continue;
      }
      seen.add(k);
      events.push(e);
    }
    p.profiles?.forEach((x) => profiles.add(x));
    reports.push(dupes ? { ...p.report, events: p.report.events - dupes, warnings: [...p.report.warnings, `${dupes} duplicate entries merged.`] } : p.report);
  }
  events.sort((a, b) => a.t - b.t);
  estimateYouTubeDurations(events);
  return { events, reports, profiles: [...profiles].filter(Boolean).sort() };
}

/** Files dropped on their own are read one by one; files from one folder are read together, like the entries of a zip. */
type Unit = { kind: 'file'; blob: InputBlob } | { kind: 'folder'; name: string; files: InputBlob[] };

function groupByFolder(blobs: InputBlob[]): Unit[] {
  const units: Unit[] = [];
  const folders = new Map<string, InputBlob[]>();
  for (const blob of blobs) {
    const path = blob.path?.replace(/\\/g, '/').replace(/^\/+/, '');
    const root = path?.includes('/') ? path.slice(0, path.indexOf('/')) : null;
    if (!root || !path) { units.push({ kind: 'file', blob }); continue; }
    let files = folders.get(root);
    if (!files) {
      files = [];
      folders.set(root, files);
      units.push({ kind: 'folder', name: root, files });
    }
    files.push(path === blob.path ? blob : inFolder(blob, path));
  }
  // Drop order depends on the browser and the file system; sort so reports and de-duplication are stable.
  for (const u of units) if (u.kind === 'folder') u.files.sort((a, b) => (a.path! < b.path! ? -1 : a.path! > b.path! ? 1 : 0));
  return units;
}

/** Folder files are read a few at a time: one by one, a Takeout with tens of thousands of photo sidecars took seconds longer. */
const FOLDER_READS = 32;

/** The same rules as for zip entries: known names are read in full, other .json/.html files are peeked at, the rest is never opened. */
async function readFolder(files: InputBlob[], onProgress: Progress): Promise<{ texts: TextFile[]; zips: InputBlob[] }> {
  const candidates = files.filter((f) => isCandidateName(f.path!));
  const zips = candidates.filter((f) => /\.zip$/i.test(f.path!));
  let probes = 0;
  const toRead = candidates.filter((f) => isInterestingPath(f.path!) || (/\.(json|html?)$/i.test(f.path!) && probes++ < MAX_PROBES));
  const results: (TextFile | null)[] = new Array(toRead.length).fill(null);
  const root = files[0]?.path!.split('/')[0] ?? '';
  let next = 0;
  let done = 0;
  const read = async (f: InputBlob): Promise<TextFile | null> => {
    const path = f.path!;
    // A known history file that cannot be read fails the import loudly, as before.
    if (isInterestingPath(path)) return { path, text: await f.text(), probed: false };
    // A file we only peek at must not: it is skipped, like an unreadable zip entry.
    try {
      return looksLikeActivityHead(await f.slice(0, PROBE_BYTES).text()) ? { path, text: await f.text(), probed: true } : null;
    } catch {
      return null;
    }
  };
  const lane = async () => {
    while (next < toRead.length) {
      const i = next++;
      results[i] = await read(toRead[i]);
      if (++done % 500 === 0) onProgress(`Looking through ${root} — ${Math.round((done / toRead.length) * 100)}%`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(FOLDER_READS, toRead.length) }, lane));
  return { texts: results.filter((t): t is TextFile => t !== null), zips };
}

/** Merge every batch read so far, in the order it was added, as if all the files had been dropped at once. */
export function combineBatches(batches: IngestBatch[]): IngestResult {
  return { ...mergeParsed(batches.flatMap((b) => b.parsed)), ignored: batches.flatMap((b) => b.ignored) };
}

export async function ingestFiles(blobs: InputBlob[], onProgress: Progress = () => {}): Promise<IngestResult> {
  return combineBatches([await readBatch(blobs, onProgress)]);
}

/** Read and parse dropped files, zips and folders without merging them, so later batches can join them. */
export async function readBatch(blobs: InputBlob[], onProgress: Progress = () => {}): Promise<IngestBatch> {
  const parsed: Parsed[] = [];
  const ignored: IgnoredFile[] = [];
  /** Parse what a file, zip or folder held; returns how many files were kept or explained. */
  const take = (texts: TextFile[]): number => {
    let kept = 0;
    for (const f of texts) {
      onProgress(`Reading ${f.path.split('/').pop()}`);
      const p = parseTextFile(f.path, f.text);
      if (f.probed) {
        // Found by content only: keep it if it holds history. Activity of other products (Maps, Chrome…)
        // is dropped without a note, like the files that were peeked at and rejected.
        if (p && p.events.length > 0) { parsed.push(p); kept++; }
      } else {
        kept++;
        if (p) parsed.push(p);
        else ignored.push({ file: f.path, hint: explainFile(f.path, isInterestingPath(f.path)) });
      }
    }
    return kept;
  };
  const takeZip = async (blob: InputBlob) => {
    const signals = new Set<Signal>();
    if (take(await unzipInteresting(blob, onProgress, signals)) === 0) ignored.push({ file: blob.path ?? blob.name, hint: explainZip(blob.name, signals) });
  };
  for (const unit of groupByFolder(blobs)) {
    if (unit.kind === 'file') {
      const blob = unit.blob;
      if (/\.zip$/i.test(blob.name)) await takeZip(blob);
      else take([{ path: blob.name, text: await blob.text(), probed: false }]);
      continue;
    }
    // Names only, as for zip entries: they say which service the folder came from if no history is found.
    const signals = new Set<Signal>();
    for (const f of unit.files) for (const s of entrySignals(f.path!)) signals.add(s);
    const { texts, zips } = await readFolder(unit.files, onProgress);
    // A zip inside the folder gets its own note when it holds nothing, so it counts as explained.
    for (const z of zips) await takeZip(z);
    if (take(texts) + zips.length === 0) ignored.push({ file: `${unit.name}/`, hint: explainFolder(signals) });
  }
  return { parsed, ignored };
}
