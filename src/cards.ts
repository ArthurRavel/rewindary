import type { Insights } from './insights';
import { MUSIC_SOURCES, SOURCE_LABEL } from './model';
import { dayClockArcs, splitSegments } from './charts';
import { dayLabel, escapeXml, hourLabel, hours, num, truncate, wrap } from './format';

/**
 * Share cards are built in two steps:
 *  1. `cardLines()` produces every line of text the card will contain, with a flag for
 *     anything personal (names, exact dates). The review panel shows exactly these lines.
 *  2. `renderCardSvg()` draws only those lines plus anonymous charts.
 * Personal values are hidden unless their id is in `reveal`. Search terms, URLs and raw
 * titles are never part of a card.
 */
export type CardFormat = 'story' | 'square';
export type CardTheme = 'dusk' | 'paper';
export type RevealId = 'topArtist' | 'topShow' | 'topChannel' | 'exactDay';

export interface CardOptions {
  format: CardFormat;
  theme: CardTheme;
  reveal: ReadonlySet<RevealId>;
}

export interface CardLine {
  id: string;
  label: string;
  value: string;
  /** Present when the value is personal and therefore hidden by default. */
  revealId?: RevealId;
  revealed?: boolean;
}

export const HIDDEN = '•••••';

export function cardLines(ins: Insights, reveal: ReadonlySet<RevealId>): CardLine[] {
  const lines: CardLine[] = [];
  const by = (s: string) => ins.sources.find((x) => x.source === s);
  // With both Spotify and Apple Music, the #1 artist comes from the one you listened to most.
  const music = ins.sources.filter((s) => MUSIC_SOURCES.has(s.source) && s.top.length).sort((a, b) => b.ms - a.ms)[0];
  const netflix = by('netflix');
  const youtube = by('youtube');
  const named = (id: RevealId, name: string) => (reveal.has(id) ? truncate(name, 26) : HIDDEN);

  lines.push({ id: 'peak', label: 'Peak hour', value: hourLabel(ins.peakHour) });
  if (ins.streak.days > 1) lines.push({ id: 'streak', label: 'Longest streak', value: `${num(ins.streak.days)} days in a row` });
  const artist = music?.top[0];
  if (artist) lines.push({ id: 'topArtist', label: '#1 artist', value: `${named('topArtist', artist.name)} · ${num(artist.count)} plays`, revealId: 'topArtist', revealed: reveal.has('topArtist') });
  const show = netflix?.top[0];
  if (show) lines.push({ id: 'topShow', label: '#1 on Netflix', value: `${named('topShow', show.name)} · ${hours(show.ms)} h`, revealId: 'topShow', revealed: reveal.has('topShow') });
  const channel = youtube?.top[0];
  if (channel) lines.push({ id: 'topChannel', label: '#1 channel', value: `${named('topChannel', channel.name)} · ${num(channel.count)} videos`, revealId: 'topChannel', revealed: reveal.has('topChannel') });
  if (ins.binge) lines.push({ id: 'binge', label: 'Biggest binge', value: `${ins.binge.count} episodes in a row` });
  if (ins.busiestDay) lines.push({ id: 'busiest', label: 'Busiest day', value: `${dayLabel(ins.busiestDay.day, reveal.has('exactDay'))} · ${hours(ins.busiestDay.ms)} h`, revealId: 'exactDay', revealed: reveal.has('exactDay') });
  if (ins.overlapMs >= 3_600_000) lines.push({ id: 'overlap', label: 'Second screen', value: `≈${hours(ins.overlapMs)} h of music during videos` });
  return lines;
}

interface Palette { bg0: string; bg1: string; fg: string; dim: string; track: string }
const PALETTES: Record<CardTheme, Palette> = {
  dusk: { bg0: '#120d24', bg1: '#2a1446', fg: '#fbf7ff', dim: '#b9add6', track: '#ffffff1f' },
  paper: { bg0: '#f8f3ea', bg1: '#efe5d3', fg: '#1c1630', dim: '#6b6180', track: '#1c16301a' },
};

const FONT = `system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;

export function mediaPhrase(ins: Insights): string {
  const words = ins.sources.filter((s) => s.ms > 0).map((s) => ({ spotify: 'music', applemusic: 'music', youtube: 'videos', netflix: 'shows', google: '' })[s.source]);
  const parts = [...new Set(words)].filter(Boolean);
  if (parts.length <= 1) return parts.length ? `of ${parts[0]}` : 'tracked';
  return `of ${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function cardTitle(ins: Insights): string {
  return ins.year === null ? 'ALL TIME' : String(ins.year);
}

/** The exact lines a card of this format renders (the review panel lists these and nothing else). */
export function shownLines(ins: Insights, reveal: ReadonlySet<RevealId>, format: CardFormat): CardLine[] {
  const lines = cardLines(ins, reveal);
  // The story card shows the peak hour inside the day clock, so it is listed but not repeated as a fact row.
  return format === 'story' ? lines.slice(0, 5) : lines.filter((l) => ['peak', 'streak', 'binge', 'topArtist'].includes(l.id)).slice(0, 3);
}

export function renderCardSvg(ins: Insights, opts: CardOptions): string {
  const p = PALETTES[opts.theme];
  const W = 1080;
  const H = opts.format === 'story' ? 1920 : 1080;
  const story = opts.format === 'story';
  const shown = shownLines(ins, opts.reveal, opts.format).filter((l) => !(story && l.id === 'peak'));
  const t = (x: number, y: number, size: number, text: string, extra = '') =>
    `<text x="${x}" y="${y}" font-size="${size}" ${extra}>${escapeXml(text)}</text>`;
  const [adj, ...noun] = ins.persona.name.split(' ');
  const seg = splitSegments(ins.sources.map((s) => ({ source: s.source, ms: s.ms })), W - 160);
  const top = seg.slice().sort((a, b) => b.share - a.share)[0];
  const glow = top?.color ?? '#9b8cff';
  const o: string[] = [];
  o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`);
  o.push(`<defs><linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${p.bg0}"/><stop offset="1" stop-color="${p.bg1}"/></linearGradient>`);
  o.push(`<radialGradient id="glow"><stop offset="0" stop-color="${glow}" stop-opacity="0.45"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>`);
  o.push(`<rect width="${W}" height="${H}" fill="url(#bg)"/>`);
  o.push(`<circle cx="${W - 120}" cy="${story ? 260 : 180}" r="${story ? 520 : 420}" fill="url(#glow)"/>`);
  o.push(`<g fill="${p.fg}">`);
  o.push(t(80, story ? 140 : 110, 30, 'REWINDARY', `font-weight="700" letter-spacing="8"`));
  o.push(t(W - 80, story ? 140 : 110, 30, cardTitle(ins), `font-weight="700" letter-spacing="4" text-anchor="end"`));
  let y = story ? 300 : 220;
  o.push(t(80, y, 34, 'MY YEAR, REWOUND', `fill="${p.dim}" letter-spacing="3"`));
  y += story ? 110 : 96;
  o.push(t(80, y, story ? 112 : 92, adj, `font-weight="800"`));
  y += story ? 110 : 92;
  o.push(t(80, y, story ? 112 : 92, noun.join(' '), `font-weight="800" fill="${glow}"`));
  if (story) {
    for (const l of wrap(ins.persona.blurb, 44, 2)) {
      y += 56;
      o.push(t(80, y, 36, l, `fill="${p.dim}"`));
    }
  }
  y += story ? 200 : 180;
  o.push(t(76, y, story ? 200 : 170, hours(ins.totalMs), `font-weight="800" letter-spacing="-6"`));
  y += story ? 64 : 58;
  o.push(t(80, y, story ? 44 : 38, `hours ${mediaPhrase(ins)}${ins.estShare > 0.2 ? ' (partly estimated)' : ''}`, `fill="${p.dim}"`));
  y += story ? 50 : 44;
  o.push(`<rect x="80" y="${y}" width="${W - 160}" height="30" rx="15" fill="${p.track}"/>`);
  for (const s of seg) o.push(`<rect x="${(80 + s.x).toFixed(1)}" y="${y}" width="${s.w.toFixed(1)}" height="30" rx="15" fill="${s.color}"/>`);
  y += 76;
  // Four media sources ("Apple Music 20%" is long) no longer fit one row at full size, so the legend scales down to fit.
  const legend = seg.map((s) => ({ s, label: `${SOURCE_LABEL[s.source]} ${Math.round(s.share * 100)}%` }));
  const k = Math.min(1, (W - 160) / legend.reduce((n, l) => n + 32 + l.label.length * 18 + 36, -36));
  let lx = 80;
  for (const { s, label } of legend) {
    o.push(`<circle cx="${(lx + 11 * k).toFixed(1)}" cy="${(y - 11 * k).toFixed(1)}" r="${(11 * k).toFixed(1)}" fill="${s.color}"/>`);
    o.push(t(Math.round(lx + 32 * k), y, Math.round(32 * k), label, `fill="${p.fg}"`));
    lx += (32 + label.length * 18 + 36) * k;
  }
  if (story) {
    const cx = W / 2;
    const cy = y + 250;
    o.push(`<circle cx="${cx}" cy="${cy}" r="72" fill="none" stroke="${p.track}" stroke-width="2"/>`);
    for (const a of dayClockArcs(ins.hourly, cx, cy, 80, 185)) o.push(`<path d="${a.d}" fill="${a.color}"/>`);
    o.push(t(cx, cy - 6, 20, 'PEAK HOUR', `text-anchor="middle" fill="${p.dim}" letter-spacing="2"`));
    o.push(t(cx, cy + 32, 36, hourLabel(ins.peakHour), `text-anchor="middle" font-weight="800"`));
    for (const [h, lab] of [[0, '12A'], [6, '6A'], [12, '12P'], [18, '6P']] as const) {
      const ang = (h / 24) * Math.PI * 2 - Math.PI / 2;
      o.push(t(cx + 218 * Math.cos(ang), cy + 218 * Math.sin(ang) + 9, 24, lab, `text-anchor="middle" fill="${p.dim}"`));
    }
    y = cy + 250;
  } else y += 40;
  for (const l of shown) {
    y += story ? 60 : 62;
    o.push(t(80, y, story ? 38 : 34, l.label, `fill="${p.dim}"`));
    o.push(t(W - 80, y, story ? 38 : 34, l.value, `text-anchor="end" font-weight="700"`));
  }
  o.push(t(W / 2, H - (story ? 70 : 44), 26, 'Made with Rewindary · computed offline, nothing uploaded', `text-anchor="middle" fill="${p.dim}"`));
  o.push('</g></svg>');
  return o.join('');
}
