/**
 * Unified local event model. Every adapter converts its export into LifeEvents.
 * Adapters deliberately keep the minimum needed for the story: no IP addresses,
 * device names, countries, URLs or search terms are ever stored.
 */
import type { IgnoredFile } from './diagnose';

export type SourceId = 'spotify' | 'applemusic' | 'youtube' | 'netflix' | 'google';

export type EventKind =
  | 'music' // a song (Spotify, Apple Music, YouTube Music)
  | 'podcast' // podcast episode or audiobook chapter
  | 'video' // a YouTube video
  | 'episode' // an episode of a series (Netflix)
  | 'film' // a film or special (Netflix)
  | 'search'; // a search (text is discarded at parse time)

export interface LifeEvent {
  source: SourceId;
  kind: EventKind;
  /** Start time, epoch milliseconds. */
  t: number;
  /** Duration in milliseconds (0 for searches). */
  ms: number;
  /** True when the export has no duration and we estimated it. */
  est: boolean;
  /** Track / video / episode title. Empty for searches and removed videos. */
  title: string;
  /** Artist / channel / show. Empty when unknown. */
  group: string;
  /** True when the export only has a date (no time of day). Excluded from hour-of-day stats. */
  noTime?: boolean;
  /** Netflix profile name, used only for the local profile filter. */
  profile?: string;
}

export interface ParseReport {
  source: SourceId;
  file: string;
  format: string;
  events: number;
  /** Rows deliberately skipped (ads, trailers, incognito sessions, sub-5s skips…). */
  skipped: number;
  warnings: string[];
}

export interface IngestResult {
  events: LifeEvent[];
  reports: ParseReport[];
  /** Files we looked at but did not recognise, each with a hint about what to drop instead. */
  ignored: IgnoredFile[];
  profiles: string[];
}

export const SOURCE_LABEL: Record<SourceId, string> = {
  spotify: 'Spotify',
  applemusic: 'Apple Music',
  youtube: 'YouTube',
  netflix: 'Netflix',
  google: 'Google Search',
};

export const SOURCE_ORDER: SourceId[] = ['spotify', 'applemusic', 'youtube', 'netflix', 'google'];

/** Sources whose events are songs and podcasts: plays count after 30 s, and they feed the listening run and second-screen time. */
export const MUSIC_SOURCES: ReadonlySet<SourceId> = new Set(['spotify', 'applemusic']);
