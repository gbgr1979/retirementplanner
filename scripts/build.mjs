import {mkdir, copyFile, rm, lstat} from 'node:fs/promises';
import {dirname} from 'node:path';
import {staticFiles} from './static-files.mjs';
// Refuse linked inputs, including the src directory, before touching output.
for (const file of ['src', ...staticFiles]) {
  if ((await lstat(file)).isSymbolicLink()) throw Error(`Refusing linked build input: ${file}`);
}
await rm('dist', {recursive: true, force: true});
for (const file of staticFiles) {
  await mkdir(dirname(`dist/${file}`), {recursive: true});
  await copyFile(file, `dist/${file}`);
}
console.log('Static website prepared in dist/ (twelve public assets only).');
