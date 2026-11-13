// Tiny static server for dist/ (local use only; binds to localhost).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'dist');
const port = Number(process.env.PORT ?? 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.csv': 'text/csv' };
http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent((req.url ?? '/').split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(`Gluca running at http://localhost:${port}`));
