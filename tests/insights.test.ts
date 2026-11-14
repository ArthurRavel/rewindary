import { describe, expect, it } from 'vitest';
import { cardLines } from '../src/cards';
import { change } from '../src/format';
import { availableYears, compareYears, computeInsights, defaultYear, longestSession, overlap, persona } from '../src/insights';
import type { LifeEvent } from '../src/model';
import { loadDemo } from '../src/pipeline';

const H = 3_600_000;
const ev = (p: Partial<LifeEvent> & Pick<LifeEvent, 'source' | 't'>): LifeEvent => ({ kind: 'music', ms: 600_000, est: false, title: 'x', group: 'g', ...p });
const at = (d: string) => Date.parse(d + 'Z');

describe('computeInsights', () => {
  const events: LifeEvent[] = [
    ev({ source: 'spotify', t: at('2025-01-01T08:00:00'), ms: H, group: 'A' }),
    ev({ source: 'spotify', t: at('2025-01-02T08:00:00'), ms: H, group: 'A' }),
    ev({ source: 'spotify', t: at('2025-01-03T23:00:00'), ms: H, group: 'B' }),
    ev({ source: 'netflix', kind: 'episode', t: at('2025-01-03T22:30:00'), ms: 2 * H, group: 'Show' }),
    ev({ source: 'netflix', kind: 'episode', t: at('2025-01-04T00:40:00'), ms: H, group: 'Show' }),
    ev({ source: 'youtube', kind: 'search', t: at('2025-01-10T12:00:00'), ms: 0, title: '', group: '' }),
    ev({ source: 'spotify', t: at('2024-06-01T10:00:00'), ms: H }),
  ];
  const ins = computeInsights(events, 2025);

  it('filters by year and sums time per source (searches count, but add no time)', () => {
    expect(ins.totalMs).toBe(6 * H);
    expect(ins.sources.map((s) => [s.source, s.ms / H, s.searches])).toEqual([['spotify', 3, 0], ['youtube', 0, 1], ['netflix', 3, 0]]);
    expect(ins.sources[0].top[0]).toMatchObject({ name: 'A', count: 2 });
  });
  it('finds streaks, breaks and the busiest day', () => {
    expect(ins.streak.days).toBe(4);
    expect(ins.longestBreak.days).toBe(5);
    expect(ins.busiestDay!.ms).toBe(3 * H);
    expect(ins.activeDays).toBe(5);
  });
  it('detects binges, overlap and night share', () => {
    expect(ins.binge).toMatchObject({ count: 2, group: 'Show' });
    expect(ins.overlapMs).toBe(H);
    expect(ins.nightShare).toBeCloseTo(4 / 6);
    expect(ins.persona.name).toBe('Midnight Omnivore');
  });
  it('picks a sensible default year', () => {
    expect(availableYears(events).map((y) => y.year)).toEqual([2025, 2024]);
    expect(defaultYear(events)).toBe(2025);
    expect(defaultYear([])).toBeNull();
  });
});

describe('compareYears', () => {
  const daily = (source: LifeEvent['source'], from: string, to: string, ms: number) => {
    const out: LifeEvent[] = [];
    for (let t = at(from + 'T20:00:00'); t <= at(to + 'T20:00:00'); t += 86_400_000) out.push(ev({ source, t, ms }));
    return out;
  };
  it('compares an unfinished year with the same dates of the year before', () => {
    const evs = [...daily('spotify', '2025-01-01', '2025-12-31', H), ...daily('spotify', '2026-01-01', '2026-03-31', 2 * H)];
    const c = compareYears(evs, 2026)!;
    expect(c).toMatchObject({ prevYear: 2025, through: { month: 2, date: 31 } });
    expect(c.ms / H).toBe(2 * 90);
    expect(c.prevMs / H).toBe(90); // January 1 to March 31 only, not all of 2025
    expect(change(c.ms, c.prevMs)).toBe('+100%');
    expect(c.estimated).toBe(false);
  });
  it('compares full years when the history continues past the selected year', () => {
    const evs = [...daily('netflix', '2024-01-01', '2026-02-10', H)];
    const c = compareYears(evs, 2025)!;
    expect(c.through).toBeNull();
    expect([c.prevMs / H, c.ms / H]).toEqual([366, 365]);
    // A source whose history happens to end on December 31 also covers the full year.
    expect(compareYears(daily('netflix', '2024-01-01', '2025-12-31', H), 2025)!.through).toBeNull();
  });
  it('leaves out a source whose history does not reach back to January of the year before', () => {
    const evs = [...daily('spotify', '2025-01-05', '2026-06-30', H), ...daily('netflix', '2025-06-01', '2026-06-30', 3 * H)];
    const c = compareYears(evs, 2026)!;
    expect(c.sources.map((s) => s.source)).toEqual(['spotify']);
    expect(compareYears(evs.filter((e) => e.source === 'netflix'), 2026)).toBeNull();
  });
  it('stops both years where the stalest source ends', () => {
    const evs = [...daily('spotify', '2025-01-01', '2026-11-09', H), ...daily('youtube', '2025-01-01', '2026-05-15', H)];
    const c = compareYears(evs, 2026)!;
    expect(c.through).toEqual({ month: 4, date: 15 });
    expect(c.sources.map((s) => [s.source, s.prevMs / H, s.ms / H])).toEqual([['spotify', 135, 135], ['youtube', 135, 135]]);
  });
  it('keeps February 29 from spilling into March of a common year', () => {
    const evs = [...daily('spotify', '2027-01-01', '2028-02-29', H), ev({ source: 'spotify', t: at('2027-03-01T20:00:00'), ms: 50 * H })];
    expect(compareYears(evs, 2028)!.prevMs / H).toBe(59);
  });
  it('declines when there is too little to compare', () => {
    expect(compareYears(daily('spotify', '2026-01-01', '2026-06-01', H), 2026)).toBeNull(); // no previous year
    expect(compareYears([...daily('spotify', '2025-01-01', '2025-12-31', H), ...daily('spotify', '2026-01-01', '2026-01-20', H)], 2026)).toBeNull(); // under a month
    expect(compareYears([ev({ source: 'spotify', t: at('2025-01-02T10:00:00'), ms: 600_000 }), ...daily('spotify', '2026-01-01', '2026-06-01', H)], 2026)).toBeNull(); // under an hour last year
    expect(compareYears(daily('spotify', '2024-01-01', '2025-12-31', H), 2026)).toBeNull(); // nothing in the selected year
    expect(computeInsights(daily('spotify', '2024-01-01', '2025-12-31', H), null).vsLastYear).toBeNull(); // all time
  });
  it('ignores searches', () => {
    const evs = [...daily('spotify', '2025-01-01', '2026-03-31', H), ev({ source: 'google', kind: 'search', t: at('2024-01-01T10:00:00'), ms: 0 })];
    expect(compareYears(evs, 2026)!.sources.map((s) => s.source)).toEqual(['spotify']);
  });
});

describe('helpers', () => {
  it('overlap intersects interval lists', () => {
    expect(overlap([[0, 10], [20, 30]], [[5, 25]])).toBe(10);
  });
  it('longestSession respects the gap', () => {
    const s = [0, 1, 2, 10].map((i) => ev({ source: 'youtube', kind: 'video', t: i * 10 * 60_000, ms: 9 * 60_000 }));
    expect(longestSession(s, 5 * 60_000, false)!.count).toBe(3);
  });
  it('change formats signed percentages and big multiples', () => {
    expect([change(123, 100), change(88, 100), change(100.2, 100), change(340, 100), change(300, 100), change(5, 0), change(0, 0)]).toEqual(['+23%', '−12%', '±0%', '3.4×', '3×', 'new', '±0%']);
  });
  it('persona reflects the dominant source and timing', () => {
    expect(persona({ spotify: 0.7, youtube: 0.3 }, 0.1, 0.2, 0.4).name).toBe('Sunrise Soundtracker');
    expect(persona({ netflix: 0.6, spotify: 0.4 }, 0.1, 0.5, 0).name).toBe('Weekend Binge Scholar');
    expect(persona({ youtube: 0.6, spotify: 0.4 }, 0.1, 0.2, 0).name).toBe('Everyday Rabbit-Holer');
  });
});

describe('synthetic demo dataset (through the real parsers)', () => {
  const demo = loadDemo(2025);
  const ins = computeInsights(demo.events, 2025);
  it('produces a full, varied year', () => {
    expect(demo.reports.map((r) => r.source).sort()).toEqual(['applemusic', 'netflix', 'spotify', 'youtube', 'youtube']);
    expect(ins.sources.map((s) => s.source)).toEqual(['spotify', 'applemusic', 'ytmusic', 'youtube', 'netflix']);
    // Apple Music is a smaller second music service with its own invented artists.
    const am = ins.sources.find((s) => s.source === 'applemusic')!;
    expect(am.ms).toBeGreaterThan(50 * H);
    expect(am.ms).toBeLessThan(ins.sources.find((s) => s.source === 'spotify')!.ms);
    expect(am.top[0].name).toBe('Marrow Coast');
    expect(ins.totalMs / H).toBeGreaterThan(300);
    expect(ins.longestBreak.days).toBeGreaterThanOrEqual(9);
    expect(ins.rabbitHole!.count).toBeGreaterThanOrEqual(20);
    expect(ins.binge!.count).toBeGreaterThanOrEqual(9);
    expect(demo.profiles).toEqual(['Guest', 'Sam']);
  });
  it('includes a quieter previous year to compare against', () => {
    expect(availableYears(demo.events).map((y) => y.year)).toEqual([2025, 2024]);
    expect(defaultYear(demo.events)).toBe(2025);
    const vs = ins.vsLastYear!;
    expect(vs.prevYear).toBe(2024);
    expect(vs.sources.map((s) => s.source)).toEqual(['spotify', 'applemusic', 'ytmusic', 'youtube', 'netflix']);
    // Both years stop where the stalest source does (a late-December day, not Dec 31).
    expect(vs.through?.month).toBe(11);
    expect(vs.ms).toBeLessThanOrEqual(ins.totalMs);
    expect(vs.ms).toBeGreaterThan(ins.totalMs * 0.95);
    expect(vs.ms / vs.prevMs).toBeGreaterThan(1.1);
    expect(vs.estimated).toBe(true); // YouTube and YouTube Music durations
    expect(computeInsights(demo.events, 2024).vsLastYear).toBeNull();
  });
  it('runs its Apple Music export through the real play-activity parser', () => {
    const report = demo.reports.find((r) => r.source === 'applemusic')!;
    expect(report.file).toMatch(/Apple Music Play Activity\.csv$/);
    expect(report.skipped).toBeGreaterThan(0); // short plays are dropped, as in a real export
    // The synthetic Apple ID, IP address and device never reach the events' text fields.
    const text = demo.events.flatMap((e) => Object.values(e).filter((v): v is string => typeof v === 'string'));
    expect(text.filter((v) => /1234567890|192\.0\.2\.44|SYNTHETIC-DEVICE/.test(v))).toEqual([]);
  });
  it('is deterministic', () => {
    expect(computeInsights(loadDemo(2025).events, 2025).totalMs).toBe(ins.totalMs);
  });
});

describe('podcasts are ranked apart from music', () => {
  // A daily hour-long show outweighs an artist played far more often, by time.
  const days = Array.from({ length: 20 }, (_, d) => at('2025-03-01T07:00:00') + d * 86_400_000);
  const events: LifeEvent[] = [
    ...days.map((t) => ev({ source: 'spotify', kind: 'podcast', t, ms: H, title: 'Episode', group: 'Long Show' })),
    ...days.flatMap((t) => [0, 1, 2].map((k) => ev({ source: 'spotify', t: t + 2 * H + k * 200_000, ms: 180_000, title: 'Song', group: 'Real Artist' }))),
    ev({ source: 'spotify', kind: 'podcast', t: at('2025-04-01T07:00:00'), ms: 10_000, title: 'Trailer', group: 'Short Show' }),
  ];
  const sp = computeInsights(events, 2025).sources[0];

  it('keeps shows and episodes out of the artist and song rankings', () => {
    expect(sp.top.map((t) => t.name)).toEqual(['Real Artist']);
    expect(sp.topTitles.map((t) => t.name)).toEqual(['Song — Real Artist']);
    expect(sp.podcasts).toEqual([{ name: 'Long Show', ms: 20 * H, count: 20 }]); // the 10 s trailer is not a listen
    expect(sp.ms).toBe(20 * H + 60 * 180_000 + 10_000); // podcast time still counts as Spotify time
  });
  it('puts the real artist on the card, and no card line for a podcast-only year', () => {
    const line = (evs: LifeEvent[]) => cardLines(computeInsights(evs, 2025), new Set(['topArtist'])).find((l) => l.id === 'topArtist');
    expect(line(events)?.value).toBe('Real Artist · 60 plays');
    expect(line(events.filter((e) => e.kind === 'podcast'))).toBeUndefined();
  });
});
