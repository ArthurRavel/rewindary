import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { SOURCE_COLOR } from '../charts';
import { change, dayLabel, duration, hourLabel, hours, monthName, num, pct, shortDate } from '../format';
import type { Insights } from '../insights';
import { dayNumber } from '../insights';
import type { SourceId } from '../model';
import { SOURCE_LABEL } from '../model';
import { DayClock, Legend, MonthBars, SplitBar } from './Charts';
import { Icon } from './Icon';
import { SourceLink } from './SourceLink';

interface Slide { id: string; tone: SourceId | 'mix'; body: ComponentChildren }

const SEASONS: [string, number[]][] = [['Winter', [11, 0, 1]], ['Spring', [2, 3, 4]], ['Summer', [5, 6, 7]], ['Autumn', [8, 9, 10]]];

function seasonsLine(ins: Insights): string {
  const parts: string[] = [];
  for (const [name, months] of SEASONS) {
    const tally = new Map<SourceId, number>();
    for (const m of months) for (const s of ins.sources) tally.set(s.source, (tally.get(s.source) ?? 0) + ins.monthly[s.source][m]);
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best && best[1] > 0) parts.push(`${name} belonged to ${SOURCE_LABEL[best[0]]}`);
  }
  const uniq = new Set(parts.map((p) => p.split(' to ')[1]));
  if (uniq.size === 1 && parts.length > 1) return `Every season belonged to ${[...uniq][0]}. Loyal.`;
  return parts.join('. ') + '.';
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts the big number up once when its slide opens. Frames write straight to the DOM node
 * (no re-render per frame); assistive tech only ever gets the final value.
 */
function CountUp({ ms, delay = 0 }: { ms: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const DURATION = 1100;
    let raf = 0;
    let start = 0;
    el.textContent = hours(0);
    const frame = (now: number) => {
      start ||= now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / DURATION));
      el.textContent = hours(ms * (1 - Math.pow(2, -10 * t))); // ease-out expo
      if (t < 1) raf = requestAnimationFrame(frame);
      else el.textContent = hours(ms);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [ms, delay]);
  return (<>
    <span ref={ref} aria-hidden="true">{hours(ms)}</span>
    <span class="sr-only">{hours(ms)}</span>
  </>);
}

function Top({ items, unit }: { items: { name: string; value: string }[]; unit?: string }) {
  return (
    <ol class="top">
      {items.map((it, i) => (
        <li key={it.name} class="rise" style={`animation-delay:${300 + i * 120}ms`}>
          <span class="rank">{i + 1}</span>
          <span class="name">{it.name || 'Unknown'}</span>
          <span class="val">{it.value}{unit}</span>
        </li>
      ))}
    </ol>
  );
}

export function buildSlides(ins: Insights): Slide[] {
  const by = (s: SourceId) => ins.sources.find((x) => x.source === s);
  const sp = by('spotify');
  const am = by('applemusic');
  const yt = by('youtube');
  const nf = by('netflix');
  const gs = by('google');
  const when = ins.year ?? 'All time';
  const slides: Slide[] = [];
  const media = ins.sources.filter((s) => s.ms > 0);
  slides.push({
    id: 'intro', tone: 'mix',
    body: (<>
      <p class="kicker rise">Rewindary</p>
      <h1 class="huge rise" style="animation-delay:150ms">{when},<br />rewound.</h1>
      <p class="lead rise" style="animation-delay:350ms">{num(ins.totalEvents)} moments from {ins.sources.length} {ins.sources.length === 1 ? 'source' : 'sources'}, stitched together on this device.</p>
      <Legend sources={ins.sources.map((s) => s.source)} />
    </>),
  });
  if (media.length) slides.push({
    id: 'total', tone: 'mix',
    body: (<>
      <p class="kicker rise">The big number</p>
      <p class="mega rise" style="animation-delay:150ms"><CountUp ms={ins.totalMs} delay={150} /></p>
      <p class="lead rise" style="animation-delay:300ms">hours of music, videos and shows{ins.estShare > 0.05 ? ` (${pct(ins.estShare)} estimated)` : ''} — about {num(ins.totalMs / 86_400_000)} full days.</p>
      <SplitBar items={media.map((s) => ({ source: s.source, ms: s.ms }))} />
      <ul class="rows rise" style="animation-delay:500ms">
        {media.map((s) => <li key={s.source}><i style={`background:${SOURCE_COLOR[s.source]}`} />{SOURCE_LABEL[s.source]}<b>{hours(s.ms)} h</b></li>)}
      </ul>
    </>),
  });
  const vs = ins.vsLastYear;
  if (vs) {
    const max = Math.max(...vs.sources.flatMap((s) => [s.ms, s.prevMs]), 1);
    const span = vs.through ? `from Jan 1 to ${shortDate(vs.through.month, vs.through.date)} in both years` : `across both full years`;
    slides.push({
      id: 'change', tone: 'mix',
      body: (<>
        <h2 class="big rise">Compared with {vs.prevYear}</h2>
        <p class="mega rise" style="animation-delay:150ms" data-testid="change-total">{change(vs.ms, vs.prevMs)}</p>
        <p class="lead rise" style="animation-delay:300ms">{hours(vs.ms)} hours against {hours(vs.prevMs)}, counted {span}.</p>
        {vs.sources.length > 1 && (
          <ul class="vs rise" style="animation-delay:450ms">
            {vs.sources.map((s, k) => (
              <li key={s.source}>
                <span class="vs-name"><i style={`background:${SOURCE_COLOR[s.source]}`} />{SOURCE_LABEL[s.source]}</span>
                <span class="vs-hours"><span aria-hidden="true">{hours(s.prevMs)} → {hours(s.ms)} h</span><span class="sr-only">{hours(s.prevMs)} hours in {vs.prevYear}, {hours(s.ms)} hours now</span></span>
                <b>{change(s.ms, s.prevMs)}</b>
                <span class="vs-bars" aria-hidden="true">
                  <span class="grow" style={`width:${(s.prevMs / max) * 100}%;animation-delay:${550 + k * 120}ms`} />
                  <span class="grow" style={`width:${(s.ms / max) * 100}%;background:${SOURCE_COLOR[s.source]};animation-delay:${610 + k * 120}ms`} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {vs.estimated && <p class="note rise" style="animation-delay:700ms">Some durations are estimated, with the same rules in both years.</p>}
      </>),
    });
  }
  if (media.some((s) => s.ms > 0)) slides.push({
    id: 'clock', tone: 'mix',
    body: (<>
      <p class="kicker rise">Your day, on a clock</p>
      <DayClock hourly={ins.hourly} label="PEAK HOUR" value={hourLabel(ins.peakHour)} />
      <p class="lead rise" style="animation-delay:400ms">
        {ins.nightShare >= 0.25 ? `${pct(ins.nightShare)} of it happened between 10 PM and 5 AM. The night is yours.` : `Most of it happened in daylight — only ${pct(ins.nightShare)} after 10 PM.`}
      </p>
    </>),
  });
  if (ins.year !== null && media.length) slides.push({
    id: 'seasons', tone: 'mix',
    body: (<>
      <p class="kicker rise">Twelve months</p>
      <MonthBars monthly={ins.monthly} />
      <p class="lead rise" style="animation-delay:500ms">{seasonsLine(ins)}</p>
    </>),
  });
  if (ins.busiestDay && ins.busiestDay.ms > 0) {
    const b = ins.busiestDay;
    slides.push({
      id: 'busiest', tone: 'mix',
      body: (<>
        <p class="kicker rise">Most plugged-in day</p>
        <h2 class="big rise" style="animation-delay:150ms">{dayLabel(b.day, true)}</h2>
        <p class="lead rise" style="animation-delay:300ms">{duration(b.ms)} across your apps.</p>
        <ul class="rows rise" style="animation-delay:450ms">
          {(Object.entries(b.bySource) as [SourceId, number][]).filter(([, ms]) => ms > 0).map(([s, ms]) => <li key={s}><i style={`background:${SOURCE_COLOR[s]}`} />{SOURCE_LABEL[s]}<b>{duration(ms)}</b></li>)}
        </ul>
      </>),
    });
  }
  // The listening run is computed across both music services, so it is told once, on the first music slide.
  let runTold = false;
  for (const m of [sp, am]) {
    if (!m || m.ms <= 0) continue;
    // Some Apple Music exports have no artist names: rank the songs instead. Podcasts are never
    // ranked with the music; they get their own line, or the list when nothing else was played.
    const byArtist = m.top.length > 0;
    const ranked = byArtist ? m.top : m.topTitles;
    const pod = m.podcasts[0];
    const showRun: boolean = !runTold && ins.marathon !== null;
    runTold ||= showRun;
    slides.push({
      id: m.source, tone: m.source,
      body: (<>
        <p class="kicker rise">{SOURCE_LABEL[m.source]}</p>
        <h2 class="big rise" style="animation-delay:150ms">{hours(m.ms)} hours of sound</h2>
        {ranked.length > 0
          ? <Top items={ranked.map((t) => ({ name: t.name, value: num(t.count) }))} unit=" plays" />
          : <Top items={m.podcasts.map((t) => ({ name: t.name, value: duration(t.ms) }))} />}
        {byArtist && m.topTitles[0] && <p class="note rise" style="animation-delay:900ms">On repeat: <b>{m.topTitles[0].name}</b> ({num(m.topTitles[0].count)}×)</p>}
        {ranked.length > 0 && pod && <p class="note rise" data-testid="top-podcast" style="animation-delay:950ms">Top podcast or audiobook: <b>{pod.name || 'Unknown'}</b>, {duration(pod.ms)}.</p>}
        {showRun && <p class="note rise" style="animation-delay:1000ms">Longest listening run: {duration(ins.marathon!.ms)} without a break.</p>}
      </>),
    });
  }
  if (yt && (yt.ms > 0 || yt.searches > 0)) slides.push({
    id: 'youtube', tone: 'youtube',
    body: (<>
      <p class="kicker rise">YouTube</p>
      <h2 class="big rise" style="animation-delay:150ms">{num(yt.events - yt.searches)} videos</h2>
      <Top items={yt.top.map((t) => ({ name: t.name, value: num(t.count) }))} unit=" videos" />
      {ins.rabbitHole && <p class="note rise" style="animation-delay:900ms">Deepest rabbit hole: <b>{ins.rabbitHole.count} videos</b> in one sitting, {dayLabel(dayNumber(ins.rabbitHole.start), true)}.</p>}
      {yt.searches > 0 && <p class="note rise" style="animation-delay:1000ms">Plus {num(yt.searches)} searches. We kept the count and forgot the words.</p>}
    </>),
  });
  if (nf && nf.ms > 0) slides.push({
    id: 'netflix', tone: 'netflix',
    body: (<>
      <p class="kicker rise">Netflix</p>
      <h2 class="big rise" style="animation-delay:150ms">{hours(nf.ms)} hours of stories</h2>
      <Top items={nf.top.map((t) => ({ name: t.name, value: hours(t.ms) }))} unit=" h" />
      {ins.binge && <p class="note rise" style="animation-delay:900ms">Biggest binge: <b>{ins.binge.count} episodes</b> of {ins.binge.group} in one go.</p>}
    </>),
  });
  if (gs && gs.searches > 0) slides.push({
    id: 'google', tone: 'google',
    body: (<>
      <p class="kicker rise">Google Search</p>
      <h2 class="big rise" style="animation-delay:150ms">{num(gs.searches)} questions asked</h2>
      <p class="lead rise" style="animation-delay:300ms">That's {num(gs.searches / Math.max(1, ins.activeDays))} a day on average. What you searched for never left the parser — Rewindary only kept the timestamps.</p>
    </>),
  });
  slides.push({
    id: 'rhythm', tone: 'mix',
    body: (<>
      <p class="kicker rise">Rhythms</p>
      <ul class="facts">
        <li class="rise" style="animation-delay:150ms"><b>{num(ins.streak.days)} days</b> in a row with something playing.</li>
        {ins.longestBreak.days > 1 && <li class="rise" style="animation-delay:300ms"><b>{num(ins.longestBreak.days)} days</b> fully offline — your longest break, in {monthName(new Date(ins.longestBreak.from * 86_400_000).getUTCMonth())}.</li>}
        <li class="rise" style="animation-delay:450ms"><b>{pct(ins.weekendShare)}</b> of your time fell on weekends.</li>
        {ins.overlapMs >= 3_600_000 && <li class="rise" style="animation-delay:600ms"><b>≈{hours(ins.overlapMs)} hours</b> of music playing while a video or show was on. Second screen, first class.</li>}
      </ul>
    </>),
  });
  slides.push({
    id: 'persona', tone: 'mix',
    body: (<>
      <p class="kicker rise">Which makes you a…</p>
      <h1 class="huge persona rise" style="animation-delay:200ms">{ins.persona.name}</h1>
      <p class="lead rise" style="animation-delay:500ms">{ins.persona.blurb}</p>
    </>),
  });
  return slides;
}

const SLIDE_MS = 7000;
/** A press on a tap zone held at least this long was a pause, not a tap: letting go does not move on. */
const HOLD_MS = 300;

const tabHidden = () => document.visibilityState === 'hidden';

export function Story({ ins, onShare, onExit }: { ins: Insights; onShare: () => void; onExit: () => void }) {
  const slides = useMemo(() => buildSlides(ins), [ins]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(reducedMotion);
  // Holding a tap zone and leaving the tab pause the story too, without touching the play/pause button.
  const [held, setHeld] = useState(false);
  const [hidden, setHidden] = useState(tabHidden);
  const storyRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLButtonElement>(null);
  const last = i === slides.length;
  const stopped = paused || held || hidden || last;
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(slides.length, x + d))), [slides.length]);
  // How long the current slide has already played, so a pause resumes where it stopped instead of
  // starting the full 7 s again. A new slide gets a new record; a run that ends only adds to its own.
  const clock = useRef({ slide: i, spent: 0 });
  if (clock.current.slide !== i) clock.current = { slide: i, spent: 0 };
  const spent = Math.round(clock.current.spent);
  // A layout effect, so the timer is cleared as soon as the story stops: a plain effect waits for the
  // next frame, which a hidden tab may not draw before the old timer fires.
  useLayoutEffect(() => {
    if (stopped) return;
    const run = clock.current;
    const from = performance.now();
    const id = setTimeout(() => go(1), Math.max(0, SLIDE_MS - run.spent));
    return () => { clearTimeout(id); run.spent += performance.now() - from; };
  }, [i, stopped, go]);
  useEffect(() => {
    const onVisibility = () => setHidden(tabHidden());
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  // Press and hold pauses (as story viewers do); a quick tap still moves. Keyboard activation
  // (Enter or Space on a focused tap zone) has no pointer press and always moves.
  const pressedAt = useRef<number | null>(null);
  const wasHold = useRef(false);
  const press = (e: PointerEvent) => {
    if (e.button !== 0) return;
    pressedAt.current = performance.now();
    wasHold.current = false;
    setHeld(true);
  };
  const release = (e: PointerEvent) => {
    // A touch also fires pointerleave right after pointerup: only the first event ends the press.
    if (pressedAt.current === null) return;
    wasHold.current = e.type === 'pointerup' && performance.now() - pressedAt.current >= HOLD_MS;
    pressedAt.current = null;
    setHeld(false);
  };
  const tap = (d: number) => (e: MouseEvent) => {
    const hold = e.detail > 0 && wasHold.current;
    wasHold.current = false;
    if (!hold) go(d);
  };
  const tapProps = (d: number) => ({ onPointerDown: press, onPointerUp: release, onPointerCancel: release, onPointerLeave: release, onClick: tap(d) });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Space pauses, unless a real control has focus and should get its own activation.
      const onControl = e.target instanceof Element && e.target.closest('button:not(.tap), a, input, select, textarea');
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' && !onControl) { e.preventDefault(); setPaused((p) => !p); }
      else if (e.key === 'Escape') onExit();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [go, onExit]);
  // Reaching the end removes the tap zones; keep focus in the story by moving it to the main action.
  useEffect(() => {
    if (!last) return;
    // The tap zones are gone, so a press still held there (the arrow key moved on) can never be released.
    pressedAt.current = null;
    setHeld(false);
    const active = document.activeElement;
    if (!active || active === document.body || storyRef.current?.contains(active)) shareRef.current?.focus({ preventScroll: true });
  }, [last]);
  const slide = slides[i];
  return (
    <div class="story-wrap">
      <div class={`story tone-${last ? 'mix' : slide.tone}`} data-slide={last ? 'end' : slide.id} ref={storyRef}
        tabIndex={-1} data-stage-focus role="region" aria-label="Your year in review">
        <div class="bars" aria-hidden="true">
          {/* The current bar is redrawn each time the slide resumes, starting from the time already
              played, so it fills up exactly when the slide moves on. */}
          {slides.map((s, k) => k === i ? (
            <span key={`${s.id}@${spent}`} class={stopped ? 'now paused' : 'now'} style={`animation-duration:${SLIDE_MS}ms;animation-delay:-${spent}ms`}><b /></span>
          ) : (
            <span key={s.id} class={k < i ? 'done' : ''}><b /></span>
          ))}
        </div>
        <div class="story-top">
          <button class="icon-button" onClick={onExit} aria-label="Close story"><Icon name="close" /></button>
          <button class="icon-button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play' : 'Pause'}><Icon name={paused ? 'play' : 'pause'} /></button>
        </div>
        {last ? (
          <div class="slide end" key="end">
            <p class="kicker rise">That was your {ins.year ?? 'story'}.</p>
            <h2 class="big rise" style="animation-delay:150ms">Make it shareable — safely.</h2>
            <p class="lead rise" style="animation-delay:300ms">Cards hide names and exact dates by default. You'll see every line before anything is saved.</p>
            <div class="actions rise" style="animation-delay:450ms">
              <button class="primary" onClick={onShare} ref={shareRef}>Create share card</button>
              <button class="ghost" onClick={() => setI(0)}>Replay</button>
            </div>
            <p class="fine source rise" style="animation-delay:600ms">Rewindary is open source. <SourceLink>See how it works on GitHub</SourceLink>.</p>
          </div>
        ) : (
          <div class="slide" key={slide.id} aria-live="polite">{slide.body}</div>
        )}
        {!last && <button class="tap prev" aria-label="Previous" {...tapProps(-1)} />}
        {!last && <button class="tap next" aria-label="Next" {...tapProps(1)} />}
      </div>
    </div>
  );
}
