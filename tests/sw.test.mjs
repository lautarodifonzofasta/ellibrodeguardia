import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// sw.js's cache name is a hash of every precached file, so a stale sw.js means
// returning users would keep the old cached copy of whatever changed.
test('sw.js is up to date with the files it precaches', () => {
  execFileSync(process.execPath, ['tools/generate-sw.mjs', '--check'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'pipe',
  });
});
