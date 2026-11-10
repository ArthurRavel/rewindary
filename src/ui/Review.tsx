import { num } from '../format';
import { availableYears } from '../insights';
import type { IngestResult, SourceId } from '../model';
import { SOURCE_LABEL, SOURCE_ORDER } from '../model';
import { PrivacyReceipt } from './Receipt';

export interface Filters { year: number | null; off: Set<SourceId>; profiles: Set<string> }

export function Review({ data, filters, setFilters, onPlay, onAddMore, onForget, demo }: {
  data: IngestResult; filters: Filters; setFilters: (f: Filters) => void; onPlay: () => void; onAddMore: (f: File[]) => void; onForget: () => void; demo: boolean;
}) {
  const years = availableYears(data.events);
  const counts = new Map<SourceId, number>();
  for (const e of data.events) counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
  const sources = SOURCE_ORDER.filter((s) => counts.has(s));
  const flip = <T,>(set: Set<T>, v: T) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); return n; };
  const usable = sources.some((s) => !filters.off.has(s));
  return (
    <main class="review-page">
      <h1 tabIndex={-1} data-stage-focus>{demo ? 'Synthetic demo data loaded' : 'Here is what we found'}</h1>
      <p class="lead">{demo ? 'Invented artists, channels and shows, generated in your browser in real export formats and parsed by the same code as your files.' : 'Parsed on this device. Check it, then press play.'}</p>
      <ul class="reports" data-testid="reports">
        {data.reports.map((r, i) => (
          <li key={i}>
            <i class={`dot ${r.source}`} />
            <div>
              <b>{r.format}</b> — {num(r.events)} entries{r.skipped ? `, ${num(r.skipped)} skipped` : ''}
              <small>{r.file}</small>
              {r.warnings.map((w) => <small class="warn" key={w}>{w}</small>)}
            </div>
          </li>
        ))}
        {data.ignored.map((f) => <li key={f} class="ignored"><i class="dot" /><div>Not recognised, ignored<small>{f}</small></div></li>)}
      </ul>
      {data.events.length === 0 ? (
        <p class="error">No supported history found. Check the export guides on the start page.</p>
      ) : (<>
        <div class="controls">
          <label>Period
            <select value={filters.year === null ? 'all' : String(filters.year)} onChange={(e) => { const v = (e.target as HTMLSelectElement).value; setFilters({ ...filters, year: v === 'all' ? null : Number(v) }); }} data-testid="year">
              {years.map((y) => <option key={y.year} value={y.year}>{y.year} ({num(y.count)})</option>)}
              <option value="all">All time</option>
            </select>
          </label>
          <fieldset>
            <legend>Sources</legend>
            {sources.map((s) => (
              <label key={s} class="check"><input type="checkbox" checked={!filters.off.has(s)} onChange={() => setFilters({ ...filters, off: flip(filters.off, s) })} />{SOURCE_LABEL[s]} <small>{num(counts.get(s)!)}</small></label>
            ))}
          </fieldset>
          {data.profiles.length > 1 && (
            <fieldset>
              <legend>Netflix profiles (shared account?)</legend>
              {data.profiles.map((p) => (
                <label key={p} class="check"><input type="checkbox" checked={filters.profiles.has(p)} onChange={() => setFilters({ ...filters, profiles: flip(filters.profiles, p) })} />{p}</label>
              ))}
            </fieldset>
          )}
        </div>
        <div class="actions">
          <button class="primary" onClick={onPlay} disabled={!usable} data-testid="play">Play my story</button>
          <label class="ghost button">Add more files<input type="file" multiple accept=".zip,.json,.csv,.html,.htm" class="sr-only" onChange={(e) => { const el = e.currentTarget; const l = el.files ? [...el.files] : []; el.value = ''; if (l.length) onAddMore(l); }} /></label>
          <button class="ghost" onClick={onForget}>Forget everything</button>
        </div>
      </>)}
      <PrivacyReceipt entries={data.events.length + data.reports.length} />
    </main>
  );
}
