import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

void test('a sitemap survives a new cache instance and a failed stale refresh', async () => {
  // Next normally installs this before loading its request context modules.
  const globals = globalThis as unknown as {
    AsyncLocalStorage: typeof AsyncLocalStorage;
  };
  const previous = globals.AsyncLocalStorage;
  globals.AsyncLocalStorage = AsyncLocalStorage;
  const { IncrementalCache } =
    await import('next/dist/server/lib/incremental-cache/index.js');
  const { workAsyncStorage } =
    await import('next/dist/server/app-render/work-async-storage.external.js');
  const { persistentSitemap } = await import('../lib/server/sitemap-cache');
  const root = await fs.mkdtemp(join(tmpdir(), 'jobx-sitemap-cache-'));
  const makeCache = () =>
    new IncrementalCache({
      fs: {
        ...fs,
        existsSync,
        readFileSync,
        mkdir: async (path) => {
          await fs.mkdir(path, { recursive: true });
        },
      },
      dev: false,
      flushToDisk: true,
      serverDistDir: join(root, 'server'),
      maxMemoryCacheSize: 0,
      requestHeaders: {},
      getPrerenderManifest: () => ({
        version: 4,
        routes: {},
        dynamicRoutes: {},
        notFoundRoutes: [],
        preview: {
          previewModeId: 'test',
          previewModeSigningKey: 'test',
          previewModeEncryptionKey: 'test',
        },
      }),
    });
  let failing = false;
  let loads = 0;
  const load = async () => {
    loads++;
    if (failing) throw new Error('database unavailable');
    return [
      {
        url: 'https://jobx.ge/vacancies/cache-test',
        lastModified: new Date('2026-09-23T00:00:00Z'),
      },
    ];
  };
  async function request() {
    const store = {
      incrementalCache: makeCache(),
      isStaticGeneration: false,
      forceDynamic: true,
      route: '/sitemap-jobs.xml',
      page: '/sitemap-jobs.xml/route',
      pendingRevalidates: {},
    } as Parameters<typeof workAsyncStorage.run>[0];
    const result = await workAsyncStorage.run(store, () =>
      persistentSitemap('integration', load)(),
    );
    await Promise.all(Object.values(store.pendingRevalidates ?? {}));
    return result;
  }
  try {
    const first = await request();
    failing = true;
    assert.deepEqual(await request(), first);
    assert.equal(
      loads,
      1,
      'the fresh disk snapshot is read without the database',
    );
    const cacheDir = join(root, 'cache', 'fetch-cache');
    for (const file of await fs.readdir(cacheDir)) {
      const old = new Date(Date.now() - 7_200_000);
      await fs.utimes(join(cacheDir, file), old, old);
    }
    assert.deepEqual(await request(), first);
    assert.equal(loads, 2, 'stale data triggered revalidation');
    assert.deepEqual(
      await request(),
      first,
      'failed revalidation did not erase the disk snapshot',
    );
  } finally {
    globals.AsyncLocalStorage = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
});
