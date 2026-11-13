import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { computeInsights, defaultYear } from '../insights';
import { combineBatches, type IngestBatch } from '../ingest';
import type { IngestResult } from '../model';
import { num } from '../format';
import { loadDemo } from '../pipeline';
import { droppedEntries, fromInput, walkEntries, type Picked } from './folders';
import { Home } from './Home';
import { Icon } from './Icon';
import { Review, type Filters } from './Review';
import { Share } from './Share';
import { Story } from './Story';

type Stage = 'home' | 'review' | 'story' | 'share';

export function App() {
  const [stage, setStage] = useState<Stage>('home');
  const [data, setData] = useState<IngestResult | null>(null);
  const [demo, setDemo] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ year: null, off: new Set(), profiles: new Set() });
  const worker = useRef<Worker | null>(null);
  // Every batch of files read so far. Files added later are merged with them by the ingest rules (de-duplication,
  // extended Spotify history over the 1-year account data, YouTube durations across the whole history).
  const batches = useRef<IngestBatch[]>([]);
  const walk = useRef(0);
  const firstRender = useRef(true);

  // Each screen replaces the whole page, so move focus to its heading (or the story itself):
  // keyboard and screen-reader users would otherwise be left on a removed element.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    document.querySelector<HTMLElement>('[data-stage-focus]')?.focus({ preventScroll: true });
  }, [stage]);

  const show = (merged: IngestResult, isDemo: boolean) => {
    setData(merged);
    setDemo(isDemo);
    setFilters({ year: defaultYear(merged.events), off: new Set(), profiles: new Set(merged.profiles) });
    setStage('review');
    scrollTo(0, 0);
  };
  // The demo and "Forget everything" empty the list, so files read next replace the demo or start afresh.
  const showDemo = () => { batches.current = []; show(loadDemo(), true); };
  const addBatch = (b: IngestBatch) => {
    batches.current = [...batches.current, b];
    show(combineBatches(batches.current), false);
  };
  const forget = () => {
    // A read still running must not bring the forgotten files back when it finishes.
    walk.current++;
    worker.current?.terminate();
    worker.current = null;
    batches.current = [];
    setData(null); setDemo(false); setStatus(null); setError(null); setStage('home'); scrollTo(0, 0);
  };

  const onFiles = (files: Picked[]) => {
    walk.current++; // a folder still being listed must not replace these files when it finishes
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
        if (m.type === 'done') addBatch(m.batch);
        else setError(`Could not read these files: ${m.msg}`);
      }
    };
    w.onerror = (e) => { setStatus(null); setError(`Parser crashed: ${e.message}`); w.terminate(); };
    w.postMessage({ files });
  };

  // A dropped folder (Safari on macOS unzips downloads by default) is walked here, on the main
  // thread, because directory entries only exist inside the drop event; the files then go to the worker.
  const onDrop = (dt: DataTransfer) => {
    const entries = droppedEntries(dt);
    if (!entries) {
      if (dt.files.length) onFiles(fromInput(dt.files));
      return;
    }
    const id = ++walk.current;
    worker.current?.terminate();
    setError(null);
    setStatus('Listing folder…');
    walkEntries(entries, (n) => { if (id === walk.current) setStatus(`Listing folder… ${num(n)} files`); }).then(
      (files) => {
        if (id !== walk.current) return;
        if (files.length) return onFiles(files);
        setStatus(null);
        setError('No .zip, .tgz, .json, .csv or .html files in this folder, so there is nothing to read.');
      },
      (e) => {
        if (id !== walk.current) return;
        setStatus(null);
        setError(`Could not read this folder: ${e instanceof Error ? e.message : String(e)}`);
      },
    );
  };

  // Files are taken wherever they land on the start and review screens, not only on the drop zone.
  // A drop the page does not take makes the browser open that file in place of the app, which
  // throws away everything already read. The story and share screens refuse drops, so nothing is opened there either.
  const [dragging, setDragging] = useState(false);
  const dropTo = useRef({ stage, onDrop });
  dropTo.current = { stage, onDrop };
  useEffect(() => {
    let depth = 0; // dragenter and dragleave fire for every element crossed; the drag has left the page when they balance
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files');
    const takes = () => dropTo.current.stage === 'home' || dropTo.current.stage === 'review';
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      setDragging(takes());
    };
    const over = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = takes() ? 'copy' : 'none';
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (takes()) dropTo.current.onDrop(e.dataTransfer!);
    };
    // No mouse events fire during a drag, so one arriving means the drag is over even if a dragleave was missed.
    const moved = () => { if (depth) { depth = 0; setDragging(false); } };
    addEventListener('dragenter', enter);
    addEventListener('dragover', over);
    addEventListener('dragleave', leave);
    addEventListener('drop', drop);
    addEventListener('mousemove', moved);
    return () => {
      removeEventListener('dragenter', enter);
      removeEventListener('dragover', over);
      removeEventListener('dragleave', leave);
      removeEventListener('drop', drop);
      removeEventListener('mousemove', moved);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.events.filter((e) => !filters.off.has(e.source) && (e.source !== 'netflix' || !e.profile || filters.profiles.has(e.profile)));
  }, [data, filters]);
  const ins = useMemo(() => (stage === 'story' ? computeInsights(filtered, filters.year) : null), [filtered, filters.year, stage]);

  if (stage === 'home' || !data) {
    return <Home onFiles={onFiles} dragging={dragging} onDemo={showDemo} status={status} error={error} />;
  }
  if (stage === 'review') {
    return (<>
      {dragging && (
        <div class="drop-veil" aria-hidden="true" data-testid="drop-veil">
          <div class="drop-veil-box">
            <span class="drop-icon"><Icon name="upload" size={24} /></span>
            <span class="drop-title">{demo ? 'Drop to replace the demo with your files' : 'Drop to add these files'}</span>
            <span class="drop-sub">Read on this device. Nothing is uploaded.</span>
          </div>
        </div>
      )}
      {status && <p class="toast" role="status">{status}</p>}
      {error && <p class="toast error" role="alert">{error}</p>}
      <Review data={data} demo={demo} filters={filters} setFilters={setFilters} onPlay={() => setStage('story')} onAddMore={onFiles}
        onForget={forget} />
    </>);
  }
  if (stage === 'story' && ins) return <Story ins={ins} onShare={() => setStage('share')} onExit={() => setStage('review')} />;
  return <Share events={filtered} year={filters.year} onBack={() => setStage('story')} />;
}
