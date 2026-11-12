import { useEffect, useMemo, useState } from 'preact/hooks';
import { CARD_FOOTER, renderCardSvg, shownLines, type CardFormat, type CardTheme, type RevealId } from '../cards';
import { computeInsights } from '../insights';
import type { LifeEvent, SourceId } from '../model';
import { SOURCE_LABEL } from '../model';
import { slashBreaks } from './breaks';
import { Icon } from './Icon';

async function svgToPng(svg: string, w: number, h: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('PNG encoding failed'))), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Share({ events, year, onBack }: { events: LifeEvent[]; year: number | null; onBack: () => void }) {
  const present = useMemo(() => [...new Set(events.filter((e) => e.kind !== 'search').map((e) => e.source))], [events]);
  const [format, setFormat] = useState<CardFormat>('story');
  const [theme, setTheme] = useState<CardTheme>('dusk');
  const [hidden, setHidden] = useState<Set<SourceId>>(new Set());
  const [reveal, setReveal] = useState<Set<RevealId>>(new Set());
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const ins = useMemo(() => computeInsights(events.filter((e) => !hidden.has(e.source) && e.kind !== 'search'), year), [events, hidden, year]);
  const svg = useMemo(() => renderCardSvg(ins, { format, theme, reveal }), [ins, format, theme, reveal]);
  const lines = useMemo(() => shownLines(ins, reveal, format), [ins, reveal, format]);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [svg]);
  const toggle = <T,>(set: Set<T>, v: T) => {
    const n = new Set(set);
    if (n.has(v)) n.delete(v);
    else n.add(v);
    return n;
  };
  const W = 1080;
  const H = format === 'story' ? 1920 : 1080;
  const base = `rewindary-${ins.year ?? 'all-time'}-${format}`;
  const savePng = async () => {
    setBusy(true);
    try {
      download(await svgToPng(svg, W, H), `${base}.png`);
    } finally {
      setBusy(false);
    }
  };
  const canShareFiles = useMemo(() => typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }), []);
  const share = async () => {
    const file = new File([await svgToPng(svg, W, H)], `${base}.png`, { type: 'image/png' });
    await navigator.share({ files: [file], title: 'My year, rewound' }).catch(() => {});
  };

  return (
    <section class="share">
      <div class="share-preview">
        {preview && <img src={preview} alt="Share card preview" width={W} height={H} data-testid="card-preview" />}
      </div>
      <div class="share-panel">
        <button class="ghost small" onClick={onBack}><Icon name="back" size={16} />Back to story</button>
        <h2 tabIndex={-1} data-stage-focus>Your share card</h2>
        <div class="seg" role="group" aria-label="Format">
          <button aria-pressed={format === 'story'} onClick={() => setFormat('story')}>Story 9:16</button>
          <button aria-pressed={format === 'square'} onClick={() => setFormat('square')}>Square 1:1</button>
        </div>
        <div class="seg" role="group" aria-label="Theme">
          <button aria-pressed={theme === 'dusk'} onClick={() => setTheme('dusk')}>Dusk</button>
          <button aria-pressed={theme === 'paper'} onClick={() => setTheme('paper')}>Paper</button>
        </div>
        {present.length > 1 && (
          <fieldset>
            <legend>Sources on the card</legend>
            {present.map((s) => (
              <label key={s} class="check">
                <input type="checkbox" checked={!hidden.has(s)} disabled={!hidden.has(s) && present.length - hidden.size <= 1} onChange={() => setHidden(toggle(hidden, s))} />
                {SOURCE_LABEL[s]}
              </label>
            ))}
          </fieldset>
        )}
        <fieldset class="review" data-testid="review">
          <legend>Everything this card says</legend>
          <ul>
            <li><span>Persona</span><b>{ins.persona.name}</b></li>
            <li><span>Total</span><b>total hours, % per source{format === 'story' ? ', hour-of-day chart' : ''}</b></li>
            {lines.map((l) => (
              <li key={l.id} class={l.revealId ? 'personal' : ''}>
                <span>{l.label}</span>
                <b>{l.value}</b>
                {l.revealId && (
                  <label class="reveal">
                    <input type="checkbox" checked={reveal.has(l.revealId)} onChange={() => setReveal(toggle(reveal, l.revealId!))} aria-label={`Show ${l.label} on the card`} />
                    show
                  </label>
                )}
              </li>
            ))}
            <li data-testid="review-footer"><span>Footer</span><b>{slashBreaks(CARD_FOOTER.replace(' · ', ' · '))}</b></li>
          </ul>
          <p class="fine">Names and exact dates stay hidden (•••••) unless you tick “show”. Search terms, links from your history, video titles and profile names are never put on a card. The footer's address is Rewindary's own, so people who see your card can find it.</p>
        </fieldset>
        <label class="check confirm">
          <input type="checkbox" checked={reviewed} onChange={() => setReviewed(!reviewed)} data-testid="confirm-review" />
          I've reviewed what this card reveals.
        </label>
        {!reviewed && <p class="fine hint" id="export-hint">Tick the box above to enable downloads.</p>}
        <div class="actions">
          <button class="primary" disabled={!reviewed || busy} onClick={savePng} aria-describedby={reviewed ? undefined : 'export-hint'}><Icon name="download" size={18} />Download PNG</button>
          <button class="ghost" disabled={!reviewed} onClick={() => download(new Blob([svg], { type: 'image/svg+xml' }), `${base}.svg`)} aria-describedby={reviewed ? undefined : 'export-hint'}>SVG</button>
          {canShareFiles && <button class="ghost" disabled={!reviewed} onClick={share} aria-describedby={reviewed ? undefined : 'export-hint'}>Share…</button>}
        </div>
      </div>
    </section>
  );
}
