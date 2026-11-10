import { Unzip, UnzipInflate } from 'fflate';
import type { IngestResult, LifeEvent, ParseReport } from './model';
import { isSpotifyAccount, isSpotifyExtended, parseSpotifyAccount, parseSpotifyExtended } from './parsers/spotify';
import { looksLikeNetflixCsv, parseNetflixActivity, parseNetflixSimple } from './parsers/netflix';
import { estimateYouTubeDurations, isGoogleActivity, looksLikeGoogleActivityHtml, parseGoogleActivity } from './parsers/google';
import { parseCsv, stripBom } from './parsers/text';
import { entrySignals, explainFile, explainZip, type IgnoredFile, type Signal } from './diagnose';

/** Anything with a name and the Blob reading API (File in browsers, File/Blob in Node ≥ 20). */
export interface InputBlob {
  name: string;
  size: number;
  stream(): ReadableStream<Uint8Array>;
  text(): Promise<string>;
}

/** Only these entries are decompressed from archives; photos, videos etc. are never inflated. */
export function isInterestingPath(path: string): boolean {
  const p = path.toLowerCase();
  if (!/\.(json|csv|html?)$/.test(p)) return false;
  const base = p.split('/').pop() ?? '';
  return /streaming_history|streaminghistory|endsong|viewingactivity|netflixviewinghistory|watch-history|search-history|myactivity/.test(
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

type Progress = (msg: string) => void;
interface TextFile { path: string; text: string; /** Found by looking at its content, not its name. */ probed: boolean }

async function unzipInteresting(blob: InputBlob, onProgress: Progress, signals: Set<Signal>): Promise<TextFile[]> {
  const files: TextFile[] = [];
  let probes = 0;
  const pending: Promise<void>[] = [];
  const unzip = new Unzip((entry) => {
    // Names only: they say which service the archive came from if no history is found.
    for (const s of entrySignals(entry.name)) signals.add(s);
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
            if (final && !rejected) files.push({ path: `${blob.name}/${entry.name}`, text: new TextDecoder().decode(concat(chunks)), probed: probe });
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
  return files;
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

interface Parsed { events: LifeEvent[]; report: ParseReport; profiles?: string[] }

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
    const firstLine = parseCsv(text.slice(0, 2000).split(/\r?\n/)[0] ?? '')[0] ?? [];
    const kind = looksLikeNetflixCsv(firstLine);
    if (kind === 'activity') return parseNetflixActivity(text, path);
    if (kind === 'simple') return parseNetflixSimple(text, path);
    return null;
  }
  if (/\.html?$/.test(lower) && looksLikeGoogleActivityHtml(text)) return parseGoogleActivity(text, path);
  return null;
}

const key = (e: LifeEvent) => `${e.source}|${e.kind}|${e.t}|${e.ms}|${e.group}|${e.title}`;

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

export async function ingestFiles(blobs: InputBlob[], onProgress: Progress = () => {}): Promise<IngestResult> {
  const parsed: Parsed[] = [];
  const ignored: IgnoredFile[] = [];
  for (const blob of blobs) {
    const zip = /\.zip$/i.test(blob.name);
    const signals = new Set<Signal>();
    const texts: TextFile[] = zip
      ? await unzipInteresting(blob, onProgress, signals)
      : [{ path: blob.name, text: await blob.text(), probed: false }];
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
    if (zip && kept === 0) ignored.push({ file: blob.name, hint: explainZip(blob.name, signals) });
  }
  return { ...mergeParsed(parsed), ignored };
}
