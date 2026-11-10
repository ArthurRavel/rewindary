/**
 * Privacy receipt: a self-check shown on the review screen.
 * It only reads what the browser already records for this tab (Resource Timing entries and
 * Content-Security-Policy violation reports). It never sends anything, and it reports hosts,
 * never full URLs, so paths and query strings are not displayed.
 */
export interface ReceiptInput {
  /** The app's own origin, e.g. `location.origin`. */
  origin: string;
  /** URLs of every request this tab recorded (navigation + resources). */
  requests: readonly string[];
  /** `blockedURI` values from CSP violation reports (a URL, or a keyword such as `inline`). */
  blocked: readonly string[];
  /** Number of localStorage + sessionStorage keys. */
  storedKeys: number;
  /** Whether `document.cookie` is non-empty. */
  cookies: boolean;
}

export interface Receipt {
  /** Requests served by the app's own origin. */
  local: number;
  /** Hosts of any request that left the app's origin (expected to stay empty). */
  external: string[];
  /** Attempts the CSP blocked, and the hosts or keywords they targeted. */
  blocked: number;
  blockedTargets: string[];
  /** Items kept by this browser for the page: storage keys, plus one if cookies exist. */
  stored: number;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** `null` for the app's own origin or on-device URLs (blob:, data:), otherwise the remote host. */
function remoteHost(url: string, origin: string): string | null {
  let u: URL;
  try { u = new URL(url, origin); } catch { return null; }
  if (u.protocol === 'blob:' || u.protocol === 'data:') return null;
  if (u.origin === origin) return null;
  return u.host || u.protocol.slice(0, -1);
}

const target = (b: string) => {
  if (!SCHEME.test(b)) return b || 'unknown';
  try { return new URL(b).host || b.split(':')[0]; } catch { return b.split(':')[0]; }
};

export function buildReceipt(i: ReceiptInput): Receipt {
  const external = new Set<string>();
  let local = 0;
  for (const r of i.requests) {
    if (/^(blob|data):/i.test(r)) continue;
    const h = remoteHost(r, i.origin);
    if (h === null) local++;
    else external.add(h);
  }
  return {
    local,
    external: [...external].sort(),
    blocked: i.blocked.length,
    blockedTargets: [...new Set(i.blocked.map(target))].sort(),
    stored: i.storedKeys + (i.cookies ? 1 : 0),
  };
}

const violations: string[] = [];
let watching = false;

/**
 * Start recording CSP violations. Call once, before the app renders: it is the first module to run,
 * and index.html has no other script, so no violation can happen before the listener exists.
 */
export function watchPrivacy() {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  document.addEventListener('securitypolicyviolation', (e) => violations.push(e.blockedURI || e.violatedDirective));
  // The default buffer keeps 250 entries; keep more so a long session cannot hide a late request.
  performance.setResourceTimingBufferSize?.(5000);
}

/** Read the current state of this tab. */
export function checkReceipt(): Receipt {
  const requests = [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map((e) => e.name);
  let storedKeys = 0;
  try { storedKeys = localStorage.length + sessionStorage.length; } catch { /* storage disabled: nothing can be stored */ }
  return buildReceipt({ origin: location.origin, requests, blocked: violations, storedKeys, cookies: document.cookie !== '' });
}
