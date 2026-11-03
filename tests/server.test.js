import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {once} from 'node:events';
import {resolveAssetPath, createAppServer} from '../scripts/serve.mjs';
import {staticFiles} from '../scripts/static-files.mjs';

test('public paths resolve on Windows and POSIX without exposing neighbouring files', () => {
  for (const [paths, root] of [[path.win32, 'C:\\Projects-Retirement'], [path.posix, '/retirement']]) {
    assert.equal(resolveAssetPath(root, '/', paths), paths.join(root, 'index.html'));
    for (const file of staticFiles) assert.equal(resolveAssetPath(root, '/' + file, paths), paths.join(root, file));
    for (const file of ['/../secret.json', '/%2e%2e%5csecret.json', '/publish.ps1', '/.git/config', '/sample-plan.json', '/README.md']) {
      assert.equal(resolveAssetPath(root, file, paths), null, file);
    }
  }
});

test('HTTP server returns homepage, stylesheet and every module with correct MIME types', async t => {
  const server = createAppServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const file of ['/', ...staticFiles]) {
    const response = await fetch(base + (file === '/' ? file : '/' + file));
    assert.equal(response.status, 200, file);
    const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.json') ? 'application/json' : 'text/html';
    assert.equal(response.headers.get('content-type'), type);
    assert.ok((await response.text()).length > 0);
  }
  for (const file of ['/publish.ps1', '/.git/config', '/sample-plan.json', '/missing.js', '/%ZZ']) {
    assert.equal((await fetch(base + file)).status, 404, file);
  }
});
