/**
 * Explains why a dropped file produced no history, so the user knows which export to request
 * instead. It only looks at file and archive-entry *names* (never contents, never inflating
 * anything extra) and keeps nothing but a few service flags.
 */
export type Signal = 'spotify' | 'netflix' | 'takeout' | 'youtube' | 'meta';

export interface IgnoredFile {
  file: string;
  /** One sentence telling the user what this file is and what to drop instead. */
  hint: string;
}

const SPOTIFY_FILES = /^(userdata|identity|inferences|marquee|follow|payments|playlist\d*|yourlibrary|searchqueries|wrapped\d*|yoursoundcapsule|podcastinteractivity)\.json$/;

/** The service flags one archive entry (or one loose file) points to. */
export function entrySignals(path: string): Signal[] {
  const p = path.toLowerCase().replace(/\\/g, '/');
  const base = p.split('/').pop() ?? '';
  const out: Signal[] = [];
  if (/(^|\/)(my_spotify_data|spotify account data|spotify extended streaming history|spotify technical log information)\//.test(p) || SPOTIFY_FILES.test(base)) out.push('spotify');
  if (/(^|\/)(content_interaction|clickstream|customer_service|payment_and_billing)\/[^/]+\.(csv|txt)$/.test(p) || /(^|\/)netflix[^/]*\//.test(p)) out.push('netflix');
  if (/(^|\/)takeout\//.test(p) || base === 'archive_browser.html') out.push('takeout');
  if (/(^|\/)(youtube[^/]*|my activity\/youtube)\//.test(p)) out.push('youtube');
  if (/(^|\/)(your_instagram_activity|personal_information|logged_information|your_facebook_activity)\//.test(p)) out.push('meta');
  return out;
}

/** True for split Google Takeout parts such as takeout-20261110T101500Z-002.zip. */
const isSplitPart = (name: string) => /-\d{3}\.zip$/i.test(name);

const SPOTIFY = 'This Spotify export has no listening history. On Spotify’s privacy page, request “Extended streaming history” (or “Account data” for the last year); the technical log export has none.';
const NETFLIX = 'This Netflix export has no viewing activity. It should contain CONTENT_INTERACTION/ViewingActivity.csv; or download “Viewing activity” from your profile for a quick CSV.';
const META = 'Instagram and Facebook exports are not supported. Rewindary reads Spotify, YouTube, Google Search and Netflix history.';

function takeoutHint(name: string, signals: ReadonlySet<Signal>): string {
  const base = signals.has('youtube')
    ? 'This Takeout has YouTube data but no watch or search history. In Takeout, open “All YouTube data included” and make sure “history” is ticked.'
    : 'This Takeout has no YouTube or Search history. Select “YouTube and YouTube Music” with “history”, and optionally My Activity → Search.';
  return isSplitPart(name) ? `${base} Big Takeouts are split into several zips: if you have other parts, drop them too.` : base;
}

/** A zip in which no known history file was found. */
export function explainZip(name: string, signals: ReadonlySet<Signal>): string {
  if (signals.has('takeout')) return takeoutHint(name, signals);
  if (signals.has('spotify')) return SPOTIFY;
  if (signals.has('netflix')) return NETFLIX;
  if (signals.has('meta')) return META;
  if (isSplitPart(name)) return takeoutHint(name, signals);
  return 'No Spotify, YouTube, Google Search or Netflix history inside this zip.';
}

/** A loose file, or an archive entry with a known history name, that did not parse. */
export function explainFile(path: string, knownName: boolean): string {
  if (knownName) return 'The name looks like a history file, but its contents did not match a known format. It may be empty, cut short, or from a newer export layout.';
  const signals = new Set(entrySignals(path));
  if (signals.has('spotify')) return SPOTIFY;
  if (signals.has('netflix')) return NETFLIX;
  if (signals.has('meta')) return META;
  if (/\.(json|csv|html?)$/i.test(path)) return 'Not a Spotify, YouTube, Google Search or Netflix history file. See “Get your data” on the start page for the files to look for.';
  return 'Only .zip, .json, .csv and .html exports can be read.';
}
