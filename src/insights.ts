import type { LifeEvent, SourceId } from './model';
import { SOURCE_ORDER } from './model';

export interface Ranked { name: string; ms: number; count: number }

export interface SourceSummary {
  source: SourceId;
  events: number;
  ms: number;
  /** Share of this source's time that is estimated (0–1). */
  estShare: number;
  searches: number;
  top: Ranked[]; // artists / channels / shows
  topTitles: Ranked[]; // tracks / videos / films
}

export interface Session { count: number; ms: number; start: number; group: string }

export interface Persona { id: string; name: string; blurb: string }

export interface Insights {
  /** Selected year, or null for all time. */
  year: number | null;
  from: number;
  to: number;
  sources: SourceSummary[];
  totalMs: number;
  totalEvents: number;
  estShare: number;
  activeDays: number;
  spanDays: number;
  /** ms per local hour of day, per source. */
  hourly: Record<SourceId, number[]>;
  /** ms per weekday (0 = Monday), per source. */
  weekday: Record<SourceId, number[]>;
  /** ms per month (0 = Jan) for year views, per source. */
  monthly: Record<SourceId, number[]>;
  /** Source with the most time each month (null when nothing that month). */
  monthOwner: (SourceId | null)[];
  peakHour: number;
  nightShare: number;
  weekendShare: number;
  busiestDay: { day: number; ms: number; bySource: Partial<Record<SourceId, number>> } | null;
  streak: { days: number; from: number; to: number };
  longestBreak: { days: number; from: number; to: number };
  binge: Session | null;
  rabbitHole: Session | null;
  marathon: Session | null;
  /** Time music/podcasts played while a video or show was also playing. */
  overlapMs: number;
  persona: Persona;
}

const DAY = 86_400_000;
const empty = (n: number) => () => new Array<number>(n).fill(0);
const perSource = (n: number) => Object.fromEntries(SOURCE_ORDER.map((s) => [s, empty(n)()])) as Record<SourceId, number[]>;

/** Local calendar day number (days since epoch for the local date). */
export function dayNumber(t: number): number {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}
export const dayToDate = (day: number) => new Date(day * DAY + DAY / 2); // noon UTC, safe for formatting the local date

export function availableYears(events: LifeEvent[]): { year: number; count: number }[] {
  const m = new Map<number, number>();
  for (const e of events) {
    const y = new Date(e.t).getFullYear();
    m.set(y, (m.get(y) ?? 0) + 1);
  }
  return [...m.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => b.year - a.year);
}

/** Most recent year that holds a meaningful share of the data (≥ 25 % of the biggest year). */
export function defaultYear(events: LifeEvent[]): number | null {
  const ys = availableYears(events);
  if (!ys.length) return null;
  const max = Math.max(...ys.map((y) => y.count));
  return ys.find((y) => y.count >= max * 0.25)!.year;
}

function rank(map: Map<string, Ranked>, n: number, by: 'ms' | 'count'): Ranked[] {
  return [...map.values()].sort((a, b) => b[by] - a[by] || a.name.localeCompare(b.name)).slice(0, n);
}
function bump(map: Map<string, Ranked>, name: string, ms: number) {
  if (!name) return;
  const r = map.get(name);
  if (r) {
    r.ms += ms;
    r.count++;
  } else map.set(name, { name, ms, count: 1 });
}

/** Longest run of consecutive events where each starts within `gap` ms of the previous end. */
export function longestSession(evs: LifeEvent[], gap: number, sameGroup: boolean): Session | null {
  let best: Session | null = null;
  let cur: Session | null = null;
  let curEnd = 0;
  for (const e of evs) {
    if (cur && e.t - curEnd <= gap && (!sameGroup || e.group === cur.group)) {
      cur.count++;
      cur.ms = e.t + e.ms - cur.start;
    } else cur = { count: 1, ms: e.ms, start: e.t, group: e.group };
    curEnd = Math.max(curEnd, e.t + e.ms);
    if (!best || cur.count > best.count || (cur.count === best.count && cur.ms > best.ms)) best = { ...cur };
  }
  return best && best.count > 1 ? best : null;
}

function union(evs: LifeEvent[]): [number, number][] {
  const out: [number, number][] = [];
  for (const e of evs) {
    const a = e.t;
    const b = e.t + e.ms;
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function overlap(a: [number, number][], b: [number, number][]): number {
  let i = 0;
  let j = 0;
  let total = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]);
    const hi = Math.min(a[i][1], b[j][1]);
    if (hi > lo) total += hi - lo;
    if (a[i][1] < b[j][1]) i++;
    else j++;
  }
  return total;
}

export function persona(shares: Partial<Record<SourceId, number>>, nightShare: number, weekendShare: number, morningShare: number): Persona {
  const s = (k: SourceId) => shares[k] ?? 0;
  const top = (['spotify', 'youtube', 'netflix'] as SourceId[]).sort((a, b) => s(b) - s(a))[0];
  const nouns: Record<string, [string, string]> = {
    spotify: ['Soundtracker', 'Your year had a soundtrack — and you were always pressing play.'],
    youtube: ['Rabbit-Holer', 'One video always led to another. Curiosity is your operating system.'],
    netflix: ['Binge Scholar', 'You commit to stories. Season finales fear you.'],
    mixed: ['Omnivore', 'Music, videos, shows — you refuse to pick a lane.'],
  };
  const noun = s(top) >= 0.55 ? top : 'mixed';
  const adj = nightShare >= 0.3 ? 'Midnight' : morningShare >= 0.3 ? 'Sunrise' : weekendShare >= 0.45 ? 'Weekend' : 'Everyday';
  return { id: `${adj.toLowerCase()}-${noun}`, name: `${adj} ${nouns[noun][0]}`, blurb: nouns[noun][1] };
}

export function computeInsights(all: LifeEvent[], year: number | null): Insights {
  const events = (year === null ? all : all.filter((e) => new Date(e.t).getFullYear() === year)).slice().sort((a, b) => a.t - b.t);
  const hourly = perSource(24);
  const weekday = perSource(7);
  const monthly = perSource(12);
  const tops = new Map<SourceId, { groups: Map<string, Ranked>; titles: Map<string, Ranked>; ms: number; est: number; n: number; searches: number }>();
  const days = new Map<number, { ms: number; bySource: Partial<Record<SourceId, number>> }>();
  let totalMs = 0;
  let estMs = 0;
  let timedMs = 0;
  let nightMs = 0;
  let morningMs = 0;
  let weekendMs = 0;

  for (const e of events) {
    let s = tops.get(e.source);
    if (!s) tops.set(e.source, (s = { groups: new Map(), titles: new Map(), ms: 0, est: 0, n: 0, searches: 0 }));
    s.n++;
    const d = new Date(e.t);
    const dn = dayNumber(e.t);
    const day = days.get(dn) ?? { ms: 0, bySource: {} };
    day.bySource[e.source] = (day.bySource[e.source] ?? 0) + e.ms;
    day.ms += e.ms;
    days.set(dn, day);
    if (e.kind === 'search') {
      s.searches++;
      continue;
    }
    s.ms += e.ms;
    totalMs += e.ms;
    if (e.est) {
      s.est += e.ms;
      estMs += e.ms;
    }
    // Spotify convention: a play counts as a "stream" after 30 s.
    if (e.source !== 'spotify' || e.ms >= 30_000) {
      bump(s.groups, e.group, e.ms);
      if (e.kind !== 'episode') bump(s.titles, e.title && e.group && e.kind !== 'film' ? `${e.title} — ${e.group}` : e.title, e.ms);
    }
    const wd = (d.getDay() + 6) % 7;
    weekday[e.source][wd] += e.ms;
    if (wd >= 5) weekendMs += e.ms;
    monthly[e.source][d.getMonth()] += e.ms;
    if (!e.noTime) {
      const h = d.getHours();
      hourly[e.source][h] += e.ms;
      timedMs += e.ms;
      if (h >= 22 || h < 5) nightMs += e.ms;
      if (h >= 5 && h < 9) morningMs += e.ms;
    }
  }

  const sources: SourceSummary[] = SOURCE_ORDER.filter((k) => tops.has(k)).map((k) => {
    const s = tops.get(k)!;
    const by = k === 'youtube' ? 'count' : 'ms';
    return { source: k, events: s.n, ms: s.ms, estShare: s.ms ? s.est / s.ms : 0, searches: s.searches, top: rank(s.groups, 5, by), topTitles: rank(s.titles, 5, k === 'spotify' ? 'count' : by) };
  });

  const hourTotals = new Array(24).fill(0).map((_, h) => SOURCE_ORDER.reduce((n, k) => n + hourly[k][h], 0));
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  const monthOwner = new Array(12).fill(0).map((_, m) => {
    let best: SourceId | null = null;
    for (const k of SOURCE_ORDER) if (monthly[k][m] > 0 && (best === null || monthly[k][m] > monthly[best][m])) best = k;
    return best;
  });

  // Busiest day, streaks and breaks (on local calendar days).
  const dayList = [...days.keys()].sort((a, b) => a - b);
  let busiestDay: Insights['busiestDay'] = null;
  for (const [dn, v] of days) if (!busiestDay || v.ms > busiestDay.ms) busiestDay = { day: dn, ...v };
  const streak = { days: 0, from: 0, to: 0 };
  const longestBreak = { days: 0, from: 0, to: 0 };
  let runStart = dayList[0];
  for (let i = 0; i < dayList.length; i++) {
    if (i > 0 && dayList[i] !== dayList[i - 1] + 1) {
      const gap = dayList[i] - dayList[i - 1] - 1;
      if (gap > longestBreak.days) Object.assign(longestBreak, { days: gap, from: dayList[i - 1] + 1, to: dayList[i] - 1 });
      runStart = dayList[i];
    }
    const len = dayList[i] - runStart + 1;
    if (len > streak.days) Object.assign(streak, { days: len, from: runStart, to: dayList[i] });
  }

  const isVideo = (e: LifeEvent) => (e.source === 'youtube' && e.kind === 'video') || e.source === 'netflix';
  const audio = events.filter((e) => e.source === 'spotify' || (e.source === 'youtube' && e.kind === 'music'));
  const video = events.filter((e) => isVideo(e) && !e.noTime);

  const shares: Partial<Record<SourceId, number>> = {};
  for (const s of sources) shares[s.source] = totalMs ? s.ms / totalMs : 0;
  const nightShare = timedMs ? nightMs / timedMs : 0;
  const weekendShare = totalMs ? weekendMs / totalMs : 0;

  return {
    year,
    from: events[0]?.t ?? 0,
    to: events[events.length - 1]?.t ?? 0,
    sources,
    totalMs,
    totalEvents: events.length,
    estShare: totalMs ? estMs / totalMs : 0,
    activeDays: days.size,
    spanDays: dayList.length ? dayList[dayList.length - 1] - dayList[0] + 1 : 0,
    hourly,
    weekday,
    monthly,
    monthOwner,
    peakHour,
    nightShare,
    weekendShare,
    busiestDay,
    streak,
    longestBreak,
    binge: longestSession(events.filter((e) => e.source === 'netflix' && e.kind === 'episode' && !e.noTime), 20 * 60_000, true),
    rabbitHole: longestSession(events.filter((e) => e.source === 'youtube' && e.kind === 'video'), 5 * 60_000, false),
    marathon: longestSession(events.filter((e) => e.source === 'spotify' && e.kind === 'music'), 10 * 60_000, false),
    overlapMs: overlap(union(audio), union(video)),
    persona: persona(shares, nightShare, weekendShare, timedMs ? morningMs / timedMs : 0),
  };
}
