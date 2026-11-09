// Runs Vitest in UTC so date assertions are deterministic on every OS/shell (no `TZ=` shell syntax needed).
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const bin = createRequire(import.meta.url).resolve('vitest/vitest.mjs');
const r = spawnSync(process.execPath, [bin, 'run', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, TZ: 'UTC' } });
process.exit(r.status ?? 1);
