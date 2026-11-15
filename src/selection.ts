import type { LifeEvent, SourceId } from './model';
import { SOURCE_ORDER } from './model';

/** What the review screen lets you narrow down: a year (null = all time), sources switched off, Netflix profiles kept. */
export interface Filters { year: number | null; off: Set<SourceId>; profiles: Set<string> }

/** Events left by the source and Netflix-profile filters (the period is applied by `inPeriod`). */
export function applyFilters(events: LifeEvent[], f: Filters): LifeEvent[] {
  return events.filter((e) => passes(e, f));
}

const passes = (e: LifeEvent, f: Filters) => !f.off.has(e.source) && (e.source !== 'netflix' || !e.profile || f.profiles.has(e.profile));

/** Events in `year`, by local calendar year, as `computeInsights` counts them; all of them for null. */
export function inPeriod(events: LifeEvent[], year: number | null): LifeEvent[] {
  return year === null ? events : events.filter((e) => new Date(e.t).getFullYear() === year);
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
