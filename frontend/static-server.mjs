import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const indexPath = path.join(root, 'index.html');
const host = process.env.HOST ?? '0.0.0.0';
const port = Number.parseInt(process.env.PORT ?? '20015', 10);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8']
]);

function isInsideRoot(filePath) {
  const relativePath = path.relative(root, filePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function resolvePath(url) {
  try {
    const pathname = new URL(url ?? '/', 'http://localhost').pathname;
    const filePath = path.resolve(root, `.${decodeURIComponent(pathname)}`);
    return isInsideRoot(filePath) ? filePath : indexPath;
  } catch {
    return indexPath;
  }
}

async function findStaticFile(url) {
  const filePath = resolvePath(url);
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isFile()) {
      return { filePath, fileStat };
    }
  } catch {
    return { filePath: indexPath, fileStat: await stat(indexPath) };
  }

  return { filePath: indexPath, fileStat: await stat(indexPath) };
}

createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    response.end();
    return;
  }

  const { filePath, fileStat } = await findStaticFile(request.url);
  const contentType = contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream';

  response.writeHead(200, {
    'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
    'Content-Length': fileStat.size,
    'Content-Type': contentType
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  createReadStream(filePath).pipe(response);
}).listen(port, host);
