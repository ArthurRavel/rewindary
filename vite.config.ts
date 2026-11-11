import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { socialMeta } from './scripts/social-meta.ts';

/**
 * Production Content-Security-Policy. `connect-src 'none'` makes the browser refuse every
 * fetch/XHR/WebSocket/beacon, so even a bug or a compromised dependency cannot send data out.
 * Only applied to builds: the dev server needs a WebSocket for hot reload.
 */
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "worker-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const csp = (): Plugin => ({
  name: 'rewindary-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

const social = (): Plugin => ({ name: 'rewindary-social-meta', transformIndexHtml: socialMeta });

export default defineConfig({
  // Relative base so the static build works on GitHub Pages sub-paths and from any folder.
  base: './',
  plugins: [preact(), csp(), social()],
  build: { target: 'es2022', sourcemap: false, assetsInlineLimit: 0, modulePreload: { polyfill: false } },
  worker: { format: 'es' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
