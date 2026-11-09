/**
 * Deterministic synthetic exports for the demo and tests. Every artist, channel, show and
 * person here is invented. Output uses the real export formats, so the demo runs through
 * exactly the same parsers as user files.
 */
export interface DemoFile { name: string; text: string }

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARTISTS = ['Velvet Static', 'Mira Calloway', 'The Paper Lanterns', 'Northbound Echo', 'Juno & the Tides', 'Saffron Heights', 'Low Orbit Choir', 'Kite Theory', 'Ines Varga', 'Hollow Pines'];
const WORDS = ['Neon', 'Harbor', 'Glass', 'Summer', 'Paper', 'Static', 'Gold', 'Echo', 'Night', 'River', 'Satellite', 'Lanterns', 'Ferry', 'Window', 'Orbit', 'Velvet'];
const PODCASTS = ['Small Questions, Big Rooms', 'The Patient Engineer', 'Notes from the Night Bus'];
const CHANNELS = ['Bench Lab Builds', 'Slow Kitchen', 'Atlas of Small Things', 'Pixel Cartography', 'Quiet Workshop', 'Orbital Notes', 'Field Recordings Daily', 'The Tiny Garage'];
const TOPICS = ['restoring a', 'why every', 'I tried a', 'the hidden history of the', 'building a', 'one week with a', 'how to fix a', 'tour of a'];
const THINGS = ['vintage radio', 'tiny house', 'mechanical keyboard', 'sourdough starter', 'lighthouse', 'night train', 'pocket synth', 'paper map'];
const SHOWS: [string, number][] = [['The Lighthouse Accord', 2], ['Harbor Lights', 1], ['Copper Valley', 3], ['Ninth Garden', 1], ['Static Season', 2], ['The Long Ferry', 1]];
const FILMS = ['A Map of Rain', 'Midnight Ferry', 'The Quiet Orbit', 'Paper Crowns'];

const pad = (n: number) => String(n).padStart(2, '0');
const utc = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const hms = (ms: number) => { const s = Math.round(ms / 1000); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

export function demoFiles(year = 2025, seed = 7): DemoFile[] {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const zipf = <T,>(xs: T[]) => xs[Math.min(xs.length - 1, Math.floor(xs.length * Math.pow(r(), 2.2)))];
  const tracks = ARTISTS.map((a) => Array.from({ length: 8 }, () => `${pick(WORDS)} ${pick(WORDS)}`).map((t) => [a, t] as const));

  const spotify: object[] = [];
  const watch: object[] = [];
  const search: object[] = [];
  const netflix: string[][] = [['Profile Name', 'Start Time', 'Duration', 'Attributes', 'Title', 'Supplemental Video Type', 'Device Type', 'Bookmark', 'Latest Bookmark', 'Country']];
  const episodeCursor = new Map<string, number>();

  const listen = (start: Date, minutes: number) => {
    let t = start.getTime();
    const end = t + minutes * 60_000;
    while (t < end) {
      const [artist, track] = zipf(zipf(tracks));
      const full = (150 + Math.floor(r() * 110)) * 1000;
      const ms = r() < 0.14 ? 3000 + Math.floor(r() * 25000) : full;
      t += ms;
      spotify.push({ ts: new Date(t).toISOString().replace('.000Z', 'Z'), platform: 'synthetic', ms_played: ms, conn_country: 'ZZ', ip_addr: '192.0.2.1', master_metadata_track_name: track, master_metadata_album_artist_name: artist, master_metadata_album_album_name: `${artist} (Demo)`, spotify_track_uri: 'spotify:track:demo', episode_name: null, episode_show_name: null, reason_start: 'trackdone', reason_end: 'trackdone', shuffle: false, skipped: ms < full, offline: false, incognito_mode: false });
      t += 1000;
    }
  };
  const podcast = (start: Date) => {
    const ms = (22 + Math.floor(r() * 30)) * 60_000;
    const show = pick(PODCASTS);
    spotify.push({ ts: new Date(start.getTime() + ms).toISOString().replace('.000Z', 'Z'), ms_played: ms, master_metadata_track_name: null, master_metadata_album_artist_name: null, episode_name: `Episode ${1 + Math.floor(r() * 120)}`, episode_show_name: show, incognito_mode: false });
  };
  const youtube = (start: Date, videos: number) => {
    let t = start.getTime();
    for (let i = 0; i < videos; i++) {
      if (r() < 0.15) search.push({ header: 'YouTube', title: `Searched for ${pick(THINGS)}`, titleUrl: 'https://www.youtube.com/results?search_query=demo', time: new Date(t).toISOString(), products: ['YouTube'] });
      const ad = r() < 0.08;
      const ch = zipf(CHANNELS);
      watch.push({
        header: 'YouTube',
        title: `Watched ${ad ? 'Sponsored demo clip' : `${pick(TOPICS)} ${pick(THINGS)}`}`,
        titleUrl: `https://www.youtube.com/watch?v=demo${watch.length}`,
        subtitles: [{ name: ad ? 'Demo Advertiser' : ch, url: 'https://www.youtube.com/channel/demo' }],
        time: new Date(t).toISOString(),
        products: ['YouTube'],
        ...(ad ? { details: [{ name: 'From Google Ads' }] } : {}),
      });
      t += (3 + Math.floor(r() * 12)) * 60_000;
    }
  };
  const watchShow = (start: Date, episodes: number, profile = 'Sam') => {
    const idx = Math.min(SHOWS.length - 1, Math.floor((start.getMonth() / 12) * SHOWS.length));
    const [show, seasons] = SHOWS[idx];
    let t = start.getTime();
    for (let i = 0; i < episodes; i++) {
      const n = episodeCursor.get(show) ?? 0;
      episodeCursor.set(show, n + 1);
      const season = Math.min(seasons, 1 + Math.floor(n / 8));
      const ms = (38 + Math.floor(r() * 18)) * 60_000;
      if (r() < 0.1) netflix.push([profile, utc(new Date(t)), '00:00:42', 'Autoplayed: user action: None; ', `${show}: Season ${season} (Trailer)`, 'TRAILER', 'Synthetic TV', '00:00:42', '00:00:42', 'ZZ (Demo)']);
      netflix.push([profile, utc(new Date(t)), hms(ms), '', `${show}: Season ${season}: Chapter ${(n % 8) + 1}`, '', 'Synthetic TV', hms(ms), hms(ms), 'ZZ (Demo)']);
      t += ms + (1 + Math.floor(r() * 4)) * 60_000;
    }
  };

  for (let d = new Date(year, 0, 1); d.getFullYear() === year; d = new Date(year, d.getMonth(), d.getDate() + 1)) {
    const m = d.getMonth();
    const wd = (d.getDay() + 6) % 7;
    const weekend = wd >= 5;
    if (m === 7 && d.getDate() >= 9 && d.getDate() <= 17) continue; // an offline summer week
    const summer = m >= 5 && m <= 7 ? 1.5 : 1;
    const winter = m <= 1 || m >= 10 ? 1.6 : 1;
    const at = (h: number, min: number) => new Date(year, m, d.getDate(), h, min);
    if (!weekend && r() < 0.75) listen(at(8, Math.floor(r() * 20)), 25 + r() * 25 * summer);
    if (r() < 0.45 * summer) listen(at(weekend ? 14 : 18, Math.floor(r() * 50)), 30 + r() * 70 * summer);
    if (r() < 0.25) listen(at(21, Math.floor(r() * 50)), 30 + r() * 60);
    if (!weekend && r() < 0.3) podcast(at(12, 30));
    if (r() < 0.6) youtube(at(r() < 0.3 ? 23 : 21, Math.floor(r() * 50)), 2 + Math.floor(r() * 6));
    if (r() < 0.12) youtube(at(0, 30 + Math.floor(r() * 20)), 2 + Math.floor(r() * 4));
    if (weekend && r() < 0.55 * winter) watchShow(at(20, Math.floor(r() * 40)), 2 + Math.floor(r() * 4 * winter));
    else if (!weekend && r() < 0.28 * winter) watchShow(at(21, 30), 1 + Math.floor(r() * 2));
    if (wd === 4 && r() < 0.15) {
      const ms = (95 + Math.floor(r() * 40)) * 60_000;
      netflix.push(['Sam', utc(at(20, 45)), hms(ms), '', pick(FILMS), '', 'Synthetic TV', hms(ms), hms(ms), 'ZZ (Demo)']);
    }
    if (wd === 6 && r() < 0.2) watchShow(at(10, 0), 1, 'Guest');
  }
  // One legendary rabbit hole and one marathon binge.
  youtube(new Date(year, 2, 22, 22, 10), 31);
  watchShow(new Date(year, 10, 15, 13, 0), 9);

  const csv = netflix.map((row) => row.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
  return [
    { name: `Spotify Extended Streaming History/Streaming_History_Audio_${year}.json`, text: JSON.stringify(spotify) },
    { name: 'Takeout/YouTube and YouTube Music/history/watch-history.json', text: JSON.stringify(watch.reverse()) },
    { name: 'Takeout/YouTube and YouTube Music/history/search-history.json', text: JSON.stringify(search.reverse()) },
    { name: 'netflix-report/CONTENT_INTERACTION/ViewingActivity.csv', text: csv + '\n' },
  ];
}
