import type { LifeEvent, SourceId } from './model';
import { SOURCE_ORDER } from './model';

/** What the review screen lets you narrow down: a year (null = all time), sources switched off, Netflix profiles kept. */
export interface Filters { year: number | null; off: Set<SourceId>; profiles: Set<string> }

/** Events left by the source and Netflix-profile filters (the period is applied by `inPeriod`). */
export function applyFilters(events: LifeEvent[], f: Filters): LifeEvent[] {
  return events.filter((e) => passes(e, f));
}

const profileKept = (e: LifeEvent, f: Filters) => e.source !== 'netflix' || !e.profile || f.profiles.has(e.profile);
const passes = (e: LifeEvent, f: Filters) => !f.off.has(e.source) && profileKept(e, f);

/** Events in `year`, by local calendar year, as `computeInsights` counts them; all of them for null. */
export function inPeriod(events: LifeEvent[], year: number | null): LifeEvent[] {
  return year === null ? events : events.filter((e) => new Date(e.t).getFullYear() === year);
}

/**
 * The counts shown next to the review controls, so each one says what it would add to the story.
 * A year counts the entries from the ticked sources and Netflix profiles. A source counts its entries
 * in the chosen period (and, for Netflix, the ticked profiles), whether it is ticked or not.
 * Every year and source in the history stays listed, at 0 if need be, so a choice never vanishes.
 */
export function reviewCounts(events: LifeEvent[], f: Filters): { years: { year: number; count: number }[]; sources: Map<SourceId, number> } {
  const years = new Map<number, number>();
  const bySource = new Map<SourceId, number>();
  for (const e of events) {
    const y = new Date(e.t).getFullYear();
    const profileOk = profileKept(e, f);
    years.set(y, (years.get(y) ?? 0) + (profileOk && !f.off.has(e.source) ? 1 : 0));
    bySource.set(e.source, (bySource.get(e.source) ?? 0) + (profileOk && (f.year === null || y === f.year) ? 1 : 0));
  }
  return {
    years: [...years.entries()].map(([year, count]) => ({ year, count })).sort((a, b) => b.year - a.year),
    sources: new Map(SOURCE_ORDER.filter((s) => bySource.has(s)).map((s) => [s, bySource.get(s)!])),
  };
}

/** Sources with at least one play or watch (searches aside) in the given events, in product order. */
export function sourcesWithMedia(events: LifeEvent[]): SourceId[] {
  const seen = new Set<SourceId>();
  for (const e of events) if (e.kind !== 'search') seen.add(e.source);
  return SOURCE_ORDER.filter((s) => seen.has(s));
}

/**
 * Why the current selection has nothing to play, or null when it has something.
 * An empty selection would otherwise play a story of 0 hours with a made-up persona.
 */
export function emptySelectionReason(events: LifeEvent[], f: Filters): string | null {
  // Stops at the first match: this runs on every render of the review screen, over the whole history.
  const kept = (e: LifeEvent) => passes(e, f) && (f.year === null || new Date(e.t).getFullYear() === f.year);
  if (events.some(kept)) return null;
  const present = new Set(events.map((e) => e.source));
  if ([...present].every((s) => f.off.has(s))) return 'Tick at least one source to play your story.';
  const period = f.year === null ? 'in this history' : `in ${f.year}`;
  const netflixOn = present.has('netflix') && !f.off.has('netflix');
  const profilesOff = netflixOn && events.some((e) => e.source === 'netflix' && e.profile && !f.profiles.has(e.profile));
  return `Nothing to play ${period} with the sources${profilesOff ? ' and Netflix profiles' : ''} ticked. Tick another one${f.year === null ? '' : ' or pick another period'}.`;
}
