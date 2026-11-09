import { useState } from 'preact/hooks';
import { GUIDES } from './guides';

export function Home({ onFiles, onDemo, status, error }: { onFiles: (f: File[]) => void; onDemo: () => void; status: string | null; error: string | null }) {
  const [drag, setDrag] = useState(false);
  const pick = (list: FileList | null) => list && list.length && onFiles([...list]);
  return (
    <main class="home">
      <header class="hero">
        <p class="kicker">Rewindary</p>
        <h1>Your year, rewound —<br /><span class="grad">Spotify, YouTube and Netflix</span> in one story.</h1>
        <p class="lead">Drop your official data exports and get an animated year-in-review plus a share card that hides names by default. Everything is computed on this device: no upload, no account, no tracking.</p>
      </header>
      <label
        class={`drop ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer?.files ?? null); }}
      >
        <input type="file" multiple accept=".zip,.json,.csv,.html,.htm" onChange={(e) => pick((e.target as HTMLInputElement).files)} data-testid="file-input" />
        <span class="drop-title">{status ?? 'Drop your export .zip files here'}</span>
        <span class="drop-sub">{status ? 'Working locally…' : 'or click to choose — Spotify, Google Takeout and Netflix zips, or the JSON/CSV/HTML files inside'}</span>
      </label>
      {error && <p class="error" role="alert">{error}</p>}
      <div class="actions center">
        <button class="primary" onClick={onDemo} data-testid="demo">Try it with synthetic demo data</button>
      </div>
      <ul class="promises">
        <li><b>Stays on your device.</b> Files are read by your browser; a strict Content-Security-Policy blocks every network request.</li>
        <li><b>Forgets on close.</b> Nothing is stored — no cookies, no local storage. Close the tab and it's gone.</li>
        <li><b>Private by default.</b> Search terms and URLs are discarded at parse time; cards hide names and dates until you choose.</li>
      </ul>
      <section class="guides">
        <h2>Get your data</h2>
        <p class="fine">Exports come straight from each service. Some take days, so request them now. Menu labels change over time; these steps describe late 2026.</p>
        {GUIDES.map((g) => (
          <details key={g.title}>
            <summary><i class={`dot ${g.source}`} />{g.title}<small>{g.wait}</small></summary>
            <ol>{g.steps.map((s) => <li key={s}>{s}</li>)}</ol>
            <p class="fine">Rewindary reads: <code>{g.file}</code>. {g.note}</p>
          </details>
        ))}
      </section>
      <footer class="foot">
        <p>Open source (MIT). No analytics, no cookies, no remote fonts. Open DevTools → Network and watch: nothing goes out.</p>
        <p class="fine">Not affiliated with Spotify, Google, YouTube or Netflix.</p>
      </footer>
    </main>
  );
}
