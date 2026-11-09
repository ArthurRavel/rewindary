// Minimal static server for dist/ (used by e2e and screenshots). No dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

/**
 * Serves `root` under `base` (e.g. '/rewindary/', like a GitHub Pages project site).
 * Anything requested outside `base` is a 404, so an absolute asset path in the build fails loudly.
 */
export function serve(root, port = 0, base = '/') {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const pathname = new URL(req.url, 'http://x').pathname;
      if (pathname === base.replace(/\/$/, '') && base !== '/') return res.writeHead(301, { location: base }).end();
      try {
        if (!pathname.startsWith(base)) throw new Error('outside base');
        const path = normalize('/' + decodeURIComponent(pathname.slice(base.length))).replace(/^(\.\.[/\\])+/, '');
        const file = join(root, path.endsWith('/') ? path + 'index.html' : path);
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(port, '127.0.0.1', () => {
      const origin = `http://127.0.0.1:${server.address().port}`;
      resolve({ server, origin, url: origin + base });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { url } = await serve(new URL('../dist/', import.meta.url).pathname, Number(process.env.PORT ?? 4173), process.env.BASE ?? '/');
  console.log(`Serving dist at ${url}`);
}
