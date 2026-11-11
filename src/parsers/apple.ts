import type { LifeEvent, ParseReport } from '../model';
import { eachCsvRow, parseUtcStamp } from './text';

/** Plays shorter than this are treated as skips and ignored, as for Spotify. */
const MIN_MS = 5_000;
/** A single play longer than this is a broken row, not listening. */
const MAX_MS = 6 * 3_600_000;

/** Header cells are compared trimmed, lower-cased, with the typographic apostrophe Apple uses in some names folded. */
const norm = (h: string) => h.trim().toLowerCase().replace(/’/g, "'");

/**
 * Apple "Apple Media Services information" → Apple_Media_Services.zip →
 * Apple Music Activity/Apple Music Play Activity.csv.
 */
export function looksLikeAppleMusicCsv(header: string[]): boolean {
  const h = header.map(norm);
  return h.includes('song name') && h.includes('play duration milliseconds') && (h.includes('event start timestamp') || h.includes('event end timestamp'));
}

/** ISO 8601 with a zone ("2025-03-14T21:02:11.000Z") as given; a bare "YYYY-MM-DD HH:MM:SS" is read as UTC. */
function stamp(s: string): number | null {
  const v = s.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:?\d{2})$/i.test(v)) {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : null;
  }
  return parseUtcStamp(v);
}

/**
 * Apple Music play activity. One row is one playback event; the play itself is the row whose
 * "Event Type" is PLAY_END, which carries "Play Duration Milliseconds". When an export has no
 * PLAY_END rows at all, every row with a duration counts instead.
 * Only song, artist, timestamps, duration and event type are read: Apple ID, IP address, device
 * identifier, storefront, client and audio-quality columns are never looked at.
 */
export function parseAppleMusicActivity(text: string, file: string): { events: LifeEvent[]; report: ParseReport } {
  let iSong = -1, iArtist = -1, iStart = -1, iEnd = -1, iDur = -1, iType = -1;
  let header = true;
  // Plays from PLAY_END rows, and from any row with a duration (used only when there is no PLAY_END at all).
  const ended: LifeEvent[] = [];
  const timed: LifeEvent[] = [];
  let endedSkipped = 0;
  let timedSkipped = 0;
  eachCsvRow(text, (r) => {
    if (header) {
      header = false;
      const h = r.map(norm);
      const col = (name: string) => h.indexOf(name);
      iSong = col('song name');
      iArtist = col('artist name');
      iStart = col('event start timestamp');
      iEnd = col('event end timestamp');
      iDur = col('play duration milliseconds');
      iType = col('event type');
      return;
    }
    const isEnd = iType >= 0 && (r[iType] ?? '').trim().toUpperCase() === 'PLAY_END';
    const raw = (r[iDur] ?? '').trim();
    if (!isEnd && !raw) return; // PLAY_START, lyrics and other bookkeeping rows: not a play
    const ms = Math.round(Number(raw));
    const song = (r[iSong] ?? '').trim();
    const end = iEnd >= 0 ? stamp(r[iEnd] ?? '') : null;
    const start = iStart >= 0 ? stamp(r[iStart] ?? '') : null;
    const t = start ?? (end !== null && Number.isFinite(ms) ? end - ms : null);
    const ok = Number.isFinite(ms) && ms >= MIN_MS && ms <= MAX_MS && t !== null && song !== '';
    if (!ok) {
      if (isEnd) endedSkipped++;
      timedSkipped++;
      return;
    }
    const e: LifeEvent = { source: 'applemusic', kind: 'music', t: t!, ms, est: false, title: song, group: iArtist >= 0 ? (r[iArtist] ?? '').trim() : '' };
    if (isEnd) ended.push(e);
    timed.push(e);
  });
  const useEnded = ended.length > 0 || endedSkipped > 0;
  const events = useEnded ? ended : timed;
  const warnings: string[] = [];
  if (events.length && !events.some((e) => e.group)) warnings.push('This export has no artist names, so the story ranks songs instead of artists.');
  return {
    events,
    report: { source: 'applemusic', file, format: 'Apple Music play activity', events: events.length, skipped: useEnded ? endedSkipped : timedSkipped, warnings },
  };
}
