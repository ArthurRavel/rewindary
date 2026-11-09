import type { LifeEvent, ParseReport } from '../model';
import { parseCsv, parseDuration, parseUtcStamp } from './text';

/** Netflix rows shorter than this are previews / autoplay teasers. */
const MIN_MS = 60_000;
/** Durations used when the export only has titles and dates. */
export const EST_EPISODE_MS = 40 * 60_000;
export const EST_FILM_MS = 100 * 60_000;

const SERIES_MARKERS = /:\s*(season|series|saison|staffel|temporada|stagione|part|partie|teil|parte|volume|chapter|chapitre|limited series|miniseries|minisérie|episode|épisode|book|collection)\b/i;

/** Split "Show: Season 1: Episode" into show + episode, otherwise treat as a film. */
export function classifyNetflixTitle(title: string): { kind: 'episode' | 'film'; group: string; title: string } {
  const parts = title.split(': ');
  if (parts.length >= 3 || (parts.length === 2 && SERIES_MARKERS.test(title))) {
    return { kind: 'episode', group: parts[0].trim(), title: parts.slice(1).join(': ').trim() };
  }
  return { kind: 'film', group: title.trim(), title: title.trim() };
}

export function looksLikeNetflixCsv(header: string[]): 'activity' | 'simple' | null {
  const h = header.map((x) => x.trim().toLowerCase());
  if (h.includes('profile name') && h.includes('start time') && h.includes('duration') && h.includes('title')) return 'activity';
  if (h.length === 2 && h[0] === 'title' && h[1] === 'date') return 'simple';
  return null;
}

/**
 * Netflix "Download your personal information" → CONTENT_INTERACTION/ViewingActivity.csv.
 * Device type, country and bookmark columns are never read. Trailers/hooks and <1 min previews are skipped.
 */
export function parseNetflixActivity(text: string, file: string): { events: LifeEvent[]; report: ParseReport; profiles: string[] } {
  const rows = parseCsv(text);
  const head = rows[0].map((x) => x.trim().toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const iProfile = col('profile name');
  const iStart = col('start time');
  const iDur = col('duration');
  const iTitle = col('title');
  const iSupp = col('supplemental video type');
  const events: LifeEvent[] = [];
  const profiles = new Set<string>();
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const t = parseUtcStamp(r[iStart] ?? '');
    const ms = parseDuration(r[iDur] ?? '');
    const supp = iSupp >= 0 ? (r[iSupp] ?? '').trim() : '';
    if (t === null || ms < MIN_MS || supp) {
      skipped++;
      continue;
    }
    const profile = (r[iProfile] ?? '').trim();
    profiles.add(profile);
    const c = classifyNetflixTitle(r[iTitle] ?? '');
    events.push({ source: 'netflix', kind: c.kind, t, ms, est: false, title: c.title, group: c.group, profile });
  }
  return {
    events,
    profiles: [...profiles],
    report: { source: 'netflix', file, format: 'Netflix viewing activity (full data request)', events: events.length, skipped, warnings: [] },
  };
}

/** Decide the field order of numeric dates (M/D/Y vs D/M/Y vs Y-M-D) from all rows. */
export function detectDateOrder(dates: string[]): 'mdy' | 'dmy' | 'ymd' {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const d of dates) {
    const p = d.trim().split(/[^\d]+/).map(Number);
    if (p.length < 3) continue;
    if (String(d.trim().split(/[^\d]+/)[0]).length === 4) return 'ymd';
    if (p[0] > 12) firstOver12 = true;
    if (p[1] > 12) secondOver12 = true;
  }
  if (firstOver12 && !secondOver12) return 'dmy';
  return 'mdy';
}

function numericDate(s: string, order: 'mdy' | 'dmy' | 'ymd'): number | null {
  const p = s.trim().split(/[^\d]+/).filter(Boolean).map(Number);
  if (p.length < 3) return null;
  let [y, m, d] = order === 'ymd' ? [p[0], p[1], p[2]] : order === 'dmy' ? [p[2], p[1], p[0]] : [p[2], p[0], p[1]];
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Simple export has no time of day; anchor at 20:00 local so day-level stats stay on the right date.
  return new Date(y, m - 1, d, 20, 0, 0).getTime();
}

/** Netflix "Viewing activity → Download all" (NetflixViewingHistory.csv: Title, Date). Durations are estimated. */
export function parseNetflixSimple(text: string, file: string): { events: LifeEvent[]; report: ParseReport } {
  const rows = parseCsv(text).slice(1);
  const order = detectDateOrder(rows.map((r) => r[1] ?? ''));
  const events: LifeEvent[] = [];
  let skipped = 0;
  for (const r of rows) {
    const t = numericDate(r[1] ?? '', order);
    if (t === null || !r[0]) {
      skipped++;
      continue;
    }
    const c = classifyNetflixTitle(r[0]);
    events.push({ source: 'netflix', kind: c.kind, t, ms: c.kind === 'episode' ? EST_EPISODE_MS : EST_FILM_MS, est: true, noTime: true, title: c.title, group: c.group });
  }
  return {
    events,
    report: {
      source: 'netflix', file, format: 'Netflix viewing history (titles + dates)', events: events.length, skipped,
      warnings: ['This file has no watch durations or times of day; Rewindary estimates 40 min per episode and 100 min per film. Use the full data request for exact numbers.'],
    },
  };
}
