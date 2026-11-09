import { useMemo, useRef, useState } from 'preact/hooks';
import { computeInsights, defaultYear } from '../insights';
import type { IngestResult } from '../model';
import { loadDemo } from '../pipeline';
import { Home } from './Home';
import { Review, type Filters } from './Review';
import { Share } from './Share';
import { Story } from './Story';

type Stage = 'home' | 'review' | 'story' | 'share';

function merge(a: IngestResult | null, b: IngestResult): IngestResult {
  if (!a) return b;
  const seen = new Set(a.events.map((e) => `${e.source}|${e.kind}|${e.t}|${e.group}|${e.title}`));
  const events = [...a.events, ...b.events.filter((e) => !seen.has(`${e.source}|${e.kind}|${e.t}|${e.group}|${e.title}`))].sort((x, y) => x.t - y.t);
  return { events, reports: [...a.reports, ...b.reports], ignored: [...a.ignored, ...b.ignored], profiles: [...new Set([...a.profiles, ...b.profiles])].sort() };
}

export function App() {
  const [stage, setStage] = useState<Stage>('home');
  const [data, setData] = useState<IngestResult | null>(null);
  const [demo, setDemo] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ year: null, off: new Set(), profiles: new Set() });
  const worker = useRef<Worker | null>(null);

  const accept = (r: IngestResult, isDemo: boolean) => {
    const merged = isDemo ? r : merge(demo ? null : data, r);
    setData(merged);
    setDemo(isDemo);
    setFilters({ year: defaultYear(merged.events), off: new Set(), profiles: new Set(merged.profiles) });
    setStage('review');
    scrollTo(0, 0);
  };

  const onFiles = (files: File[]) => {
    setError(null);
    setStatus('Reading files…');
    worker.current?.terminate();
    const w = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (ev: MessageEvent) => {
      const m = ev.data;
      if (m.type === 'progress') setStatus(m.msg);
      else {
        w.terminate();
        setStatus(null);
        if (m.type === 'done') accept(m.result, false);
        else setError(`Could not read these files: ${m.msg}`);
      }
    };
    w.onerror = (e) => { setStatus(null); setError(`Parser crashed: ${e.message}`); w.terminate(); };
    w.postMessage({ files });
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.events.filter((e) => !filters.off.has(e.source) && (e.source !== 'netflix' || !e.profile || filters.profiles.has(e.profile)));
  }, [data, filters]);
  const ins = useMemo(() => (stage === 'story' ? computeInsights(filtered, filters.year) : null), [filtered, filters.year, stage]);

  if (stage === 'home' || !data) {
    return <Home onFiles={onFiles} onDemo={() => accept(loadDemo(), true)} status={status} error={error} />;
  }
  if (stage === 'review') {
    return (<>
      {status && <p class="toast" role="status">{status}</p>}
      {error && <p class="toast error" role="alert">{error}</p>}
      <Review data={data} demo={demo} filters={filters} setFilters={setFilters} onPlay={() => setStage('story')} onAddMore={onFiles}
        onForget={() => { setData(null); setDemo(false); setError(null); setStage('home'); }} />
    </>);
  }
  if (stage === 'story' && ins) return <Story ins={ins} onShare={() => setStage('share')} onExit={() => setStage('review')} />;
  return <Share events={filtered} year={filters.year} onBack={() => setStage('story')} />;
}
