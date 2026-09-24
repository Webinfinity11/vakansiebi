// MapLibre 6 finds its worker through a computed URL no bundler can follow, so the worker and
// the chunk it imports are served as static files, under the installed version so a cached
// copy never outlives an upgrade. Runs after every install, including Vercel's.
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const pkg = require.resolve('maplibre-gl/package.json');
const { version } = JSON.parse(readFileSync(pkg, 'utf8'));
const from = join(dirname(pkg), 'dist');
const to = join('public', 'vendor', 'maplibre', version);
mkdirSync(to, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'])
  copyFileSync(join(from, file), join(to, file));
console.log(`maplibre worker ${version} → ${to}`);
