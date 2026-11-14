import type { LifeEvent, ParseReport } from '../model';
import { WATCH_HISTORY_SOURCES } from '../model';
import { decodeEntities, numericDateOrder, parseLooseDate, stripTags } from './text';

/**
 * Google Takeout adapter: YouTube watch/search history and My Activity (JSON or HTML).
 * Classification uses URLs (language-independent), then the URLs are discarded.
 * Search terms are never stored: a search becomes a timestamp only.
 * "Visited …" page entries and ads ("From Google Ads") are skipped.
 */

interface ActivityRow {
  header?: string;
  title?: string;
  titleUrl?: string;
  subtitles?: { name?: string; url?: string }[];
  time?: string;
  details?: { name?: string }[];
  products?: string[];
}

type Raw = { header: string; title: string; url: string; channel: string; t: number | null; ad: boolean };

export function isGoogleActivity(rows: unknown): rows is ActivityRow[] {
  return Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null &&
    'header' in rows[0] && 'time' in rows[0] && 'title' in rows[0];
}

export function looksLikeGoogleActivityHtml(text: string): boolean {
  return text.includes('outer-cell') && text.includes('content-cell');
}

const WATCH_PREFIX = /^(watched|vous avez regardé|a regardé|angesehen:?|has visto|hai guardato|assistiu a|visto)\s+/i;
const YT_MUSIC = /music\.youtube\.com/;

function classify(raw: Raw): LifeEvent | 'skip' {
  if (raw.t === null || raw.ad) return 'skip';
  const url = raw.url;
  const header = raw.header.toLowerCase();
  const isYouTube = header.includes('youtube') || /youtube\.com|youtu\.be/.test(url);
  if (/search_query=|\/results\?/.test(url) || (!isYouTube && /google\.[a-z.]+\/search\?/.test(url))) {
    return { source: isYouTube ? 'youtube' : 'google', kind: 'search', t: raw.t, ms: 0, est: false, title: '', group: '' };
  }
  if (isYouTube && (/\/watch\?|youtu\.be\/|\/shorts\//.test(url) || (!url && /removed|supprimée|entfernt|eliminado|private|privée/i.test(raw.title)))) {
    // Plays in the YouTube Music app are listening, so they become their own music source.
    const music = header.includes('music') || YT_MUSIC.test(url);
    const title = url ? raw.title.replace(WATCH_PREFIX, '') : '';
    const group = raw.channel.replace(/\s+-\s+Topic$/, '');
    return music
      ? { source: 'ytmusic', kind: 'music', t: raw.t, ms: 0, est: true, title, group }
      : { source: 'youtube', kind: 'video', t: raw.t, ms: 0, est: true, title, group };
  }
  return 'skip'; // visited pages, app usage, etc.
}

function fromRows(rows: ActivityRow[]): Raw[] {
  return rows.map((r) => {
    const t = r.time ? Date.parse(r.time) : NaN;
    return {
      header: r.header ?? (r.products ?? []).join(' '),
      title: r.title ?? '',
      url: r.titleUrl ?? '',
      channel: r.subtitles?.[0]?.name ?? '',
      t: Number.isFinite(t) ? t : null,
      ad: (r.details ?? []).some((d) => /google ads/i.test(d.name ?? '')),
    };
  });
}

/** Parse Takeout's HTML layout without a DOM so it also runs in Web Workers. */
export function htmlToRows(html: string): Raw[] {
  const out: (Raw & { dateText: string })[] = [];
  const blocks = html.split(/<div class="outer-cell/).slice(1);
  for (const block of blocks) {
    const header = stripTags(block.match(/<p class="mdl-typography--title">([\s\S]*?)<\/p>/)?.[1] ?? '');
    const content = block.match(/<div class="content-cell[^"]*mdl-typography--body-1">([\s\S]*?)<\/div>/)?.[1] ?? '';
    const links = [...content.matchAll(/<a href="([^"]*)">([\s\S]*?)<\/a>/g)];
    const segments = content.split(/<br\s*\/?>/i).map(stripTags).filter(Boolean);
    out.push({
      header,
      // "Watched <title>" for watches; for searches the text is dropped later anyway.
      title: links[0] ? 'Watched ' + stripTags(links[0][2]) : (segments[0] ?? ''),
      url: links[0] ? decodeEntities(links[0][1]) : '',
      channel: links[1] ? stripTags(links[1][2]) : '',
      t: null,
      ad: /From Google Ads|Google Ads/i.test(block),
      dateText: segments[segments.length - 1] ?? '',
    });
  }
  // Whether "07/03/2025" is 7 March or 3 July is decided once for the whole file, from every date in it.
  const order = numericDateOrder(out.map((r) => r.dateText));
  return out.map(({ dateText, ...r }) => ({ ...r, t: parseLooseDate(dateText, order) }));
}

/**
 * YouTube watch history has no durations. Estimate from the gap to the next watch (1–15 min, default 8).
 * Videos and YouTube Music plays share one timeline, as they do in the history file.
 */
export function estimateYouTubeDurations(events: LifeEvent[]): void {
  const vids = events.filter((e) => WATCH_HISTORY_SOURCES.has(e.source) && e.kind !== 'search').sort((a, b) => a.t - b.t);
  for (let i = 0; i < vids.length; i++) {
    const next = vids[i + 1];
    const gap = next ? next.t - vids[i].t : Infinity;
    const est = gap <= 15 * 60_000 ? gap : 8 * 60_000;
    vids[i].ms = Math.max(60_000, est);
  }
}

export function parseGoogleActivity(input: ActivityRow[] | string, file: string): { events: LifeEvent[]; report: ParseReport } {
  const html = typeof input === 'string';
  const raws = html ? htmlToRows(input) : fromRows(input);
  const events: LifeEvent[] = [];
  let skipped = 0;
  let undated = 0;
  for (const r of raws) {
    if (r.t === null) undated++;
    const e = classify(r);
    if (e === 'skip') skipped++;
    else events.push(e);
  }
  const warnings: string[] = [];
  if (html && undated > 0) warnings.push(`${undated} entries had a date format we could not read. Re-export as JSON for best results.`);
  const yt = events.some((e) => WATCH_HISTORY_SOURCES.has(e.source));
  return {
    events,
    report: {
      source: yt ? 'youtube' : 'google',
      file,
      format: `Google Takeout activity (${html ? 'HTML' : 'JSON'})`,
      events: events.length,
      skipped,
      warnings,
    },
  };
}
