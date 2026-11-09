import { describe, expect, it } from 'vitest';
import { availableYears, computeInsights, defaultYear, longestSession, overlap, persona } from '../src/insights';
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

describe('helpers', () => {
  it('overlap intersects interval lists', () => {
    expect(overlap([[0, 10], [20, 30]], [[5, 25]])).toBe(10);
  });
  it('longestSession respects the gap', () => {
    const s = [0, 1, 2, 10].map((i) => ev({ source: 'youtube', kind: 'video', t: i * 10 * 60_000, ms: 9 * 60_000 }));
    expect(longestSession(s, 5 * 60_000, false)!.count).toBe(3);
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
    expect(demo.reports.map((r) => r.source).sort()).toEqual(['netflix', 'spotify', 'youtube', 'youtube']);
    expect(ins.sources.map((s) => s.source)).toEqual(['spotify', 'youtube', 'netflix']);
    expect(ins.totalMs / H).toBeGreaterThan(300);
    expect(ins.longestBreak.days).toBeGreaterThanOrEqual(9);
    expect(ins.rabbitHole!.count).toBeGreaterThanOrEqual(20);
    expect(ins.binge!.count).toBeGreaterThanOrEqual(9);
    expect(demo.profiles).toEqual(['Guest', 'Sam']);
  });
  it('is deterministic', () => {
    expect(computeInsights(loadDemo(2025).events, 2025).totalMs).toBe(ins.totalMs);
  });
});
