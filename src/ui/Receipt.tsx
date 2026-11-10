import { useEffect, useState } from 'preact/hooks';
import { num } from '../format';
import { checkReceipt } from '../receipt';

const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

/** Local, read-only proof of what this tab did with the network and storage. */
export function PrivacyReceipt({ entries }: { entries: number }) {
  const [state, setState] = useState(() => ({ r: checkReceipt(), at: new Date() }));
  const recheck = () => setState({ r: checkReceipt(), at: new Date() });
  // Re-read after files are added, since parsing just happened.
  useEffect(recheck, [entries]);
  const { r, at } = state;
  const leaked = r.external.length > 0;
  return (
    <section class={`receipt${leaked ? ' leaked' : ''}`} data-testid="receipt" aria-labelledby="receipt-title">
      <div class="receipt-head">
        <h2 id="receipt-title"><i class="receipt-dot" aria-hidden="true" />Privacy receipt</h2>
        <button class="ghost small" onClick={recheck} data-testid="receipt-recheck">Check again</button>
      </div>
      <p class="receipt-verdict" aria-live="polite">
        {leaked ? `Requests to other sites recorded: ${r.external.join(', ')}` : 'No requests to other sites recorded.'}
        <small> Checked at {at.toLocaleTimeString()}</small>
      </p>
      <dl>
        <dt>Requests to other sites</dt>
        <dd data-testid="receipt-external">{leaked ? r.external.join(', ') : 'none'}</dd>
        <dt>Blocked by the browser</dt>
        <dd data-testid="receipt-blocked">{r.blocked ? `${plural(r.blocked, 'attempt')} (${r.blockedTargets.join(', ')})` : 'none'}</dd>
        <dt>Page files loaded</dt>
        <dd>{plural(r.local, 'file')}{leaked ? '' : ', all from this site'}</dd>
        <dt>Saved in this browser</dt>
        <dd data-testid="receipt-stored">{r.stored ? plural(r.stored, 'item') : 'nothing'}</dd>
      </dl>
      <p class="fine">Read from your browser's own request log and Content-Security-Policy reports for this tab. It is not sent anywhere. For an independent check, open DevTools → Network.</p>
    </section>
  );
}
