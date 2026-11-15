import { describe, expect, it } from 'vitest';
import { computeInsights } from '../src/insights';
import type { LifeEvent } from '../src/model';
import { buildSlides } from '../src/ui/Story';

const ev = (p: Partial<LifeEvent> & Pick<LifeEvent, 'source' | 't'>): LifeEvent => ({ kind: 'music', ms: 600_000, est: false, title: 'x', group: 'g', ...p });
const at = (d: string) => Date.parse(d + 'T12:00:00Z');
const ids = (events: LifeEvent[], year: number | null) => buildSlides(computeInsights(events, year)).map((s) => s.id);

// Only timestamps survive the parser for searches, so they carry no duration.
const searches = ['2025-03-01', '2025-03-02', '2025-03-08', '2025-06-14'].map((d) => ev({ source: 'google', kind: 'search', ms: 0, title: '', group: '', t: at(d) }));
const ytSearches = ['2025-04-01', '2025-04-05'].map((d) => ev({ source: 'youtube', kind: 'search', ms: 0, title: '', group: '', t: at(d) }));

describe('story slides', () => {
  it('ends a searches-only story after its search slides: no rhythm, made-up persona or 0-hour slides', () => {
    expect(ids(searches, 2025)).toEqual(['intro', 'google']);
    expect(ids([...searches, ...ytSearches], 2025)).toEqual(['intro', 'youtube', 'google']);
    expect(ids(searches, null)).toEqual(['intro', 'google']);
  });

  it('keeps rhythm and persona as soon as one play or watch is in the selection', () => {
    const one = ev({ source: 'spotify', t: at('2025-03-03') });
    expect(ids([...searches, one], 2025)).toEqual(expect.arrayContaining(['intro', 'total', 'spotify', 'google', 'rhythm', 'persona']));
    const watch = ev({ source: 'netflix', kind: 'episode', t: at('2025-03-04') });
    expect(ids([...searches, watch], 2025).slice(-2)).toEqual(['rhythm', 'persona']);
  });

  it('counts YouTube searches without a watch history as searches, never as "0 videos"', () => {
    const slide = buildSlides(computeInsights(ytSearches, 2025)).find((s) => s.id === 'youtube')!;
    const text = JSON.stringify(slide.body, (k, v) => (k === '__o' || k === '_parent' || k === '__' ? undefined : v));
    expect(text).toContain('2 searches');
    expect(text).not.toMatch(/0 videos|Plus 2 searches/);
  });
});
