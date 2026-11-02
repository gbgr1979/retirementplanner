import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, mkdir, writeFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {staticFiles} from '../scripts/static-files.mjs';
import {verifyDist} from '../scripts/verify-dist.mjs';

test('deployment payload rejects private files, missing assets and symlinks', async () => {
 const root = await mkdtemp(join(tmpdir(), 'retirement-dist-test-'));
 try {
  for (const file of staticFiles) { await mkdir(dirname(join(root,file)), {recursive:true}); await writeFile(join(root,file),'fixture'); }
  await verifyDist(root);
  for (const name of ['plan.json', 'publish.local.ps1', '.env', 'src/private.json']) {
   await writeFile(join(root,name),'not-a-secret');
   await assert.rejects(verifyDist(root), /exactly/); await rm(join(root,name));
  }
  await rm(join(root,'index.html')); await assert.rejects(verifyDist(root), /exactly/);
  if (process.platform !== 'win32') { await symlink(join(root,'styles.css'),join(root,'index.html')); await assert.rejects(verifyDist(root), /Linked/); }
 } finally { await rm(root,{recursive:true,force:true}); }
});
test('Windows launcher and publishing security contracts remain explicit', async () => {
 const cmd = await readFile('publish.cmd','utf8');
 assert.match(cmd,/DisableDelayedExpansion/); assert.match(cmd,/call exit \/b %%ERRORLEVEL%%/);
 const update = await readFile('deployment/update-and-publish.ps1','utf8');
 assert.match(update,/--ff-only/); assert.match(update,/--is-ancestor HEAD FETCH_HEAD/);
 assert.match(update,/--untracked-files=all/); assert.doesNotMatch(update,/reset --hard|clean -fd/);
 const publish = await readFile('deployment/publish-static-web-app.ps1','utf8');
 assert.match(publish,/@azure\/static-web-apps-cli@2\.0\.10/);
 assert.match(publish,/--no-use-keychain/); assert.match(publish,/-AsSecureString/);
 assert.doesNotMatch(publish,/--deployment-token|--print-token/);
 assert.ok(publish.indexOf('if ($PrepareOnly)') < publish.indexOf('. $credentialFile'));
 const ignore = await readFile('.gitignore','utf8'); assert.match(ignore,/^publish\.local\.ps1$/m);
 assert.deepEqual(staticFiles.filter(p=>p.endsWith('.json')),['staticwebapp.config.json']);
});
