import { describe, expect, it } from 'vitest';
import { buildReceipt } from '../src/receipt';

const origin = 'https://arthurravel.github.io';
const base = { origin, requests: [] as string[], blocked: [] as string[], storedKeys: 0, cookies: false };

describe('privacy receipt', () => {
  it('counts same-origin and on-device requests as local, never as external', () => {
    const r = buildReceipt({ ...base, requests: [`${origin}/rewindary/`, `${origin}/rewindary/assets/index.js`, 'blob:https://arthurravel.github.io/1234', 'data:image/png;base64,AAAA'] });
    expect(r).toEqual({ local: 2, external: [], blocked: 0, blockedTargets: [], stored: 0 });
  });

  it('reports external hosts only, de-duplicated, without paths or query strings', () => {
    const r = buildReceipt({ ...base, requests: [`${origin}/rewindary/`, 'https://cdn.example.net/lib.js?user=42', 'https://cdn.example.net/x.css', 'https://arthurravel.github.io.evil.test/a'] });
    expect(r.external).toEqual(['arthurravel.github.io.evil.test', 'cdn.example.net']);
    expect(r.external.join(' ')).not.toMatch(/user=42|lib\.js|\//);
    expect(r.local).toBe(1);
  });

  it('treats another port or scheme on the same host as a different site', () => {
    const r = buildReceipt({ ...base, origin: 'http://127.0.0.1:4173', requests: ['http://127.0.0.1:4173/rewindary/', 'http://127.0.0.1:9999/beacon'] });
    expect(r.external).toEqual(['127.0.0.1:9999']);
  });

  it('summarises CSP-blocked attempts by host or keyword', () => {
    const r = buildReceipt({ ...base, blocked: ['https://example.com/collect?q=secret', 'https://example.com/other', 'inline', ''] });
    expect(r.blocked).toBe(4);
    expect(r.blockedTargets).toEqual(['example.com', 'inline', 'unknown']);
    expect(r.blockedTargets.join(' ')).not.toContain('secret');
  });

  it('counts stored items, including cookies', () => {
    expect(buildReceipt({ ...base, storedKeys: 2, cookies: true }).stored).toBe(3);
  });
});
