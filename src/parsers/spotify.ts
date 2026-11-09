import type { LifeEvent, ParseReport } from '../model';

/** Plays shorter than this are treated as skips and ignored. */
const MIN_MS = 5_000;

interface ExtendedRow {
  ts?: string;
  ms_played?: number;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  audiobook_title?: string | null;
  audiobook_chapter_title?: string | null;
  incognito_mode?: boolean | null;
}

interface AccountRow {
  endTime?: string;
  msPlayed?: number;
  artistName?: string;
  trackName?: string;
  podcastName?: string;
  episodeName?: string;
}

export function isSpotifyExtended(rows: unknown): rows is ExtendedRow[] {
  return Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null &&
    'ts' in rows[0] && 'ms_played' in rows[0];
}

export function isSpotifyAccount(rows: unknown): rows is AccountRow[] {
  return Array.isArray(rows) && rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null &&
    'endTime' in rows[0] && 'msPlayed' in rows[0];
}

/**
 * Spotify "Extended streaming history" (Streaming_History_Audio_*.json / endsong_*.json).
 * IP address, country, platform and device fields are never read.
 * Plays made in a private (incognito) session are excluded.
 */
export function parseSpotifyExtended(rows: ExtendedRow[], file: string): { events: LifeEvent[]; report: ParseReport } {
  const events: LifeEvent[] = [];
  let skipped = 0;
  for (const r of rows) {
    const ms = Number(r.ms_played) || 0;
    const end = r.ts ? Date.parse(r.ts) : NaN;
    if (!Number.isFinite(end) || ms < MIN_MS || r.incognito_mode) {
      skipped++;
      continue;
    }
    const t = end - ms; // Spotify `ts` is when playback stopped
    if (r.master_metadata_track_name) {
      events.push({ source: 'spotify', kind: 'music', t, ms, est: false, title: r.master_metadata_track_name, group: r.master_metadata_album_artist_name ?? '' });
    } else if (r.episode_name || r.episode_show_name) {
      events.push({ source: 'spotify', kind: 'podcast', t, ms, est: false, title: r.episode_name ?? '', group: r.episode_show_name ?? '' });
    } else if (r.audiobook_title) {
      events.push({ source: 'spotify', kind: 'podcast', t, ms, est: false, title: r.audiobook_chapter_title ?? '', group: r.audiobook_title });
    } else skipped++;
  }
  return { events, report: { source: 'spotify', file, format: 'Spotify extended streaming history', events: events.length, skipped, warnings: [] } };
}

/** Spotify "Account data" StreamingHistory_music_N.json / StreamingHistory_podcast_N.json (last ~12 months). */
export function parseSpotifyAccount(rows: AccountRow[], file: string): { events: LifeEvent[]; report: ParseReport } {
  const events: LifeEvent[] = [];
  let skipped = 0;
  for (const r of rows) {
    const ms = Number(r.msPlayed) || 0;
    const m = r.endTime?.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
    if (!m || ms < MIN_MS) {
      skipped++;
      continue;
    }
    const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - ms;
    if (r.trackName) events.push({ source: 'spotify', kind: 'music', t, ms, est: false, title: r.trackName, group: r.artistName ?? '' });
    else if (r.episodeName || r.podcastName) events.push({ source: 'spotify', kind: 'podcast', t, ms, est: false, title: r.episodeName ?? '', group: r.podcastName ?? '' });
    else skipped++;
  }
  return { events, report: { source: 'spotify', file, format: 'Spotify account data (1 year)', events: events.length, skipped, warnings: [] } };
}
