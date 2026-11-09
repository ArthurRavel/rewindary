import type { SourceId } from '../model';

export interface Guide { source: SourceId | 'google'; title: string; wait: string; steps: string[]; file: string; note?: string }

/** Menu labels change over time; these describe the flows as of late 2026. */
export const GUIDES: Guide[] = [
  {
    source: 'spotify',
    title: 'Spotify — Extended streaming history',
    wait: 'Spotify says it can take up to 30 days; it is often faster.',
    steps: [
      'Sign in at spotify.com, open Account → Privacy settings (“Download your data”).',
      'Tick “Extended streaming history” and request it. Confirm the email Spotify sends you.',
      'When the “ready” email arrives, download my_spotify_data.zip.',
      'Drop the .zip here as-is — no need to unzip.',
    ],
    file: 'Streaming_History_Audio_*.json (inside the zip)',
    note: 'The quicker “Account data” export also works (StreamingHistory_music_*.json) but only covers about one year and has no podcasts detail.',
  },
  {
    source: 'youtube',
    title: 'YouTube & Google Search — Google Takeout',
    wait: 'Usually minutes to a few hours.',
    steps: [
      'Open takeout.google.com and click “Deselect all”.',
      'Tick “YouTube and YouTube Music”, open “All YouTube data included” and keep only “history”.',
      'Optional: tick “My Activity” and keep only “Search” to add your search rhythm (only timestamps are used).',
      'Under “Multiple formats”, choose JSON for history if offered (HTML works too).',
      'Create the export, download the .zip and drop it here.',
    ],
    file: 'watch-history.json / .html, search-history, My Activity',
    note: 'Search terms and URLs are discarded while parsing — Rewindary only keeps the time of each search. Watch history has no durations, so YouTube time is estimated from the gaps between videos.',
  },
  {
    source: 'netflix',
    title: 'Netflix — Viewing activity',
    wait: 'Full request: up to 30 days. Quick CSV: instant.',
    steps: [
      'Best: in your Netflix account, open “Download your personal information” and request it. Drop the resulting .zip (it contains CONTENT_INTERACTION/ViewingActivity.csv with exact durations and times).',
      'Quick alternative: Account → Profile → Viewing activity → “Download all”. Drop NetflixViewingHistory.csv.',
    ],
    file: 'ViewingActivity.csv or NetflixViewingHistory.csv',
    note: 'The quick CSV only has titles and dates, so durations are estimated (40 min per episode, 100 min per film) and it is left out of hour-of-day charts. Shared accounts: pick your profile on the next screen.',
  },
];
