import { describe, expect, it } from 'vitest';
import type { LifeEvent, SourceId } from '../src/model';
import { loadDemo } from '../src/pipeline';
import { applyFilters, emptySelectionReason, inPeriod, reviewCounts, sourcesWithMedia, type Filters } from '../src/selection';

const ev = (p: Partial<LifeEvent> & Pick<LifeEvent, 'source' | 't'>): LifeEvent => ({ kind: 'music', ms: 600_000, est: false, title: 'x', group: 'g', ...p });
const at = (d: string) => Date.parse(d + 'T12:00:00Z');
const filters = (p: Partial<Filters> = {}): Filters => ({ year: null, off: new Set<SourceId>(), profiles: new Set(['Sam', 'Guest']), ...p });

// Spotify in 2024 and 2025, Netflix (two profiles) in 2025 only, Google searches in 2023 only.
const events: LifeEvent[] = [
  ev({ source: 'spotify', t: at('2024-03-01') }),
  ev({ source: 'spotify', t: at('2025-03-01') }),
  ev({ source: 'netflix', kind: 'episode', t: at('2025-04-01'), profile: 'Sam' }),
  ev({ source: 'netflix', kind: 'film', t: at('2025-04-02'), profile: 'Guest' }),
  ev({ source: 'google', kind: 'search', ms: 0, t: at('2023-05-01') }),
];

describe('selection', () => {
  it('keeps the review filters behaviour: sources off, Netflix profiles, rows without a profile', () => {
    const noProfile = ev({ source: 'netflix', kind: 'film', t: at('2025-05-01') });
    const kept = applyFilters([...events, noProfile], filters({ off: new Set(['spotify']), profiles: new Set(['Sam']) }));
    expect(kept.map((e) => e.profile ?? e.source)).toEqual(['Sam', 'google', 'netflix']);
    expect(inPeriod(events, 2025)).toHaveLength(3);
    expect(inPeriod(events, null)).toHaveLength(5);
  });

  it('has something to play when the selection holds any entry in the period, searches included', () => {
    expect(emptySelectionReason(events, filters({ year: 2025 }))).toBeNull();
    expect(emptySelectionReason(events, filters({ year: 2023, off: new Set(['spotify', 'netflix']) }))).toBeNull();
  });

  it('says why a year with nothing from the ticked sources cannot play', () => {
    expect(emptySelectionReason(events, filters({ year: 2024, off: new Set(['spotify']) })))
      .toBe('Nothing to play in 2024 with the sources ticked. Tick another one or pick another period.');
  });

  it('names the Netflix profiles when they are what emptied the selection', () => {
    const f = filters({ year: 2025, off: new Set(['spotify', 'google']), profiles: new Set() });
    expect(emptySelectionReason(events, f)).toBe('Nothing to play in 2025 with the sources and Netflix profiles ticked. Tick another one or pick another period.');
    expect(emptySelectionReason(events, { ...f, year: null })).toBe('Nothing to play in this history with the sources and Netflix profiles ticked. Tick another one.');
  });

  it('asks for a source when every source is off', () => {
    expect(emptySelectionReason(events, filters({ off: new Set(['spotify', 'netflix', 'google']) }))).toBe('Tick at least one source to play your story.');
  });

  it('lists only sources with plays in the period for the card, in product order', () => {
    expect(sourcesWithMedia(inPeriod(events, 2024))).toEqual(['spotify']);
    expect(sourcesWithMedia(inPeriod(events, 2025))).toEqual(['spotify', 'netflix']);
    expect(sourcesWithMedia(inPeriod(events, 2023))).toEqual([]);
  });

  it('catches the empty demo selection reachable on the review screen (Netflix only, no profile ticked)', () => {
    const demo = loadDemo();
    const off = new Set<SourceId>(['spotify', 'applemusic', 'ytmusic', 'youtube', 'google']);
    expect(emptySelectionReason(demo.events, { year: 2025, off, profiles: new Set(demo.profiles) })).toBeNull();
    expect(emptySelectionReason(demo.events, { year: 2025, off, profiles: new Set() })).toMatch(/Netflix profiles ticked/);
  });

  it('counts each year over the ticked sources and profiles, and each source over the period', () => {
    const all = reviewCounts(events, filters());
    expect(all.years).toEqual([{ year: 2025, count: 3 }, { year: 2024, count: 1 }, { year: 2023, count: 1 }]);
    expect([...all.sources]).toEqual([['spotify', 2], ['netflix', 2], ['google', 1]]);
    // Spotify off, only Sam ticked, 2024 chosen: 2024 has nothing left to play, and every year and source stays listed.
    const some = reviewCounts(events, filters({ year: 2024, off: new Set(['spotify']), profiles: new Set(['Sam']) }));
    expect(some.years).toEqual([{ year: 2025, count: 1 }, { year: 2024, count: 0 }, { year: 2023, count: 1 }]);
    expect([...some.sources]).toEqual([['spotify', 1], ['netflix', 0], ['google', 0]]);
    expect(reviewCounts(events, filters({ year: 2025, profiles: new Set() })).sources.get('netflix')).toBe(0);
  });

  it('agrees with the empty-selection check on the demo: a year at 0 is a year with nothing to play', () => {
    const demo = loadDemo();
    for (const f of [
      { year: 2025, off: new Set<SourceId>(['spotify', 'applemusic', 'ytmusic', 'youtube', 'google']), profiles: new Set<string>() },
      { year: 2024, off: new Set<SourceId>(['netflix']), profiles: new Set(demo.profiles) },
      { year: null, off: new Set<SourceId>(), profiles: new Set(demo.profiles.slice(0, 1)) },
    ]) {
      const { years, sources } = reviewCounts(demo.events, f);
      for (const y of years) {
        expect(y.count).toBe(inPeriod(applyFilters(demo.events, f), y.year).length);
        expect(y.count === 0).toBe(emptySelectionReason(demo.events, { ...f, year: y.year }) !== null);
      }
      for (const [s, n] of sources) expect(n).toBe(inPeriod(applyFilters(demo.events, { ...f, off: new Set() }), f.year).filter((e) => e.source === s).length);
    }
  });
});
