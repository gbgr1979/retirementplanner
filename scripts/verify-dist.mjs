import {readdir, lstat} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {staticFiles} from './static-files.mjs';
export async function verifyDist(root = 'dist') {
  const found = [];
  async function walk(relative = '') {
    const path = join(root, relative);
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) throw Error('Linked deployment assets are forbidden.');
    if (stat.isDirectory()) {
      if (relative && relative !== 'src') throw Error(`Unexpected deployment directory: ${relative}`);
      for (const name of await readdir(path)) await walk(relative ? `${relative}/${name}` : name);
    } else if (stat.isFile()) found.push(relative);
    else throw Error('Unsupported deployment asset.');
  }
  await walk();
  if (JSON.stringify(found.sort()) !== JSON.stringify([...staticFiles].sort())) throw Error('dist must contain exactly the approved public assets.');
  console.log('Verified static-only deployment payload.');
}
if (process.argv[1] && resolve(process.argv[1]) === resolve('scripts/verify-dist.mjs')) await verifyDist();
