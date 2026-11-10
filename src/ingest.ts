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


type Progress = (msg: string) => void;
interface TextFile { path: string; text: string }

async function unzipInteresting(blob: InputBlob, onProgress: Progress, signals: Set<Signal>): Promise<TextFile[]> {
  const files: TextFile[] = [];
  const pending: Promise<void>[] = [];
  const unzip = new Unzip((entry) => {
    // Names only: they say which service the archive came from if no history is found.
    for (const s of entrySignals(entry.name)) signals.add(s);
    if (!isInterestingPath(entry.name)) return;
    const chunks: Uint8Array[] = [];
    pending.push(
      new Promise<void>((resolve, reject) => {
        entry.ondata = (err, data, final) => {
          if (err) return reject(err);
          chunks.push(data);
          if (final) {
            files.push({ path: `${blob.name}/${entry.name}`, text: new TextDecoder().decode(concat(chunks)) });
            resolve();
          }
        };
      }),
    );
    entry.start();
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
    unzip.push(value);
    onProgress(`Unpacking ${blob.name} — ${Math.round((read / Math.max(blob.size, 1)) * 100)}%`);
  }
  await Promise.all(pending);
  return files;
}

function concat(chunks: Uint8Array[]): Uint8Array {
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
      : [{ path: blob.name, text: await blob.text() }];
    if (zip && texts.length === 0) ignored.push({ file: blob.name, hint: explainZip(blob.name, signals) });
    for (const f of texts) {
      onProgress(`Reading ${f.path.split('/').pop()}`);
      const p = parseTextFile(f.path, f.text);
      if (p) parsed.push(p);
      else ignored.push({ file: f.path, hint: explainFile(f.path, isInterestingPath(f.path)) });
    }
  }
  return { ...mergeParsed(parsed), ignored };
}
