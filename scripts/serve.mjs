import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {staticFiles} from './static-files.mjs';

/** Use the host's path rules, and serve only the public build payload. */
export function resolveAssetPath(root, pathname, paths = path) {
  const requested = paths.resolve(root, '.' + decodeURIComponent(pathname));
  const file = requested === root ? paths.join(root, 'index.html') : requested;
  const relative = paths.relative(root, file);
  if (paths.isAbsolute(relative) || relative === '..' || relative.startsWith('..' + paths.sep)) return null;
  return staticFiles.includes(relative.split(paths.sep).join('/')) ? file : null;
}

export function createAppServer(root = path.resolve('.')) {
  return createServer(async (req, res) => {
    try {
      const file = resolveAssetPath(root, new URL(req.url, 'http://localhost').pathname);
      if (!file) throw new Error('Not a public asset');
      const contents = await readFile(file);
      res.setHeader('Content-Type', {
        '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'
      }[path.extname(file)] || 'application/octet-stream');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.end(contents);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const root = path.resolve(process.argv.includes('--dist') ? 'dist' : '.');
  createAppServer(root).listen(4173, '127.0.0.1', () => {
    console.log('Retirement Path: http://127.0.0.1:4173');
  });
}
