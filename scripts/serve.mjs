// Minimal static server for dist/ (used by e2e and screenshots). No dependencies.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

export function serve(root, port = 0) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      try {
        const file = join(root, path.endsWith('/') ? path + 'index.html' : path);
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(port, '127.0.0.1', () => resolve({ server, origin: `http://127.0.0.1:${server.address().port}` }));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { origin } = await serve(new URL('../dist/', import.meta.url).pathname, Number(process.env.PORT ?? 4173));
  console.log(`Serving dist at ${origin}`);
}
