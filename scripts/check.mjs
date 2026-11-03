import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';

function run(args) {
  const result = spawnSync(process.execPath, args, {stdio:'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

for (const directory of ['src', 'scripts']) {
  for (const file of await readdir(directory)) {
    if (/\.m?js$/.test(file)) run(['--check', `${directory}/${file}`]);
  }
}
run(['--test']);
run(['scripts/build.mjs']);
run(['scripts/verify-dist.mjs']);
