import { unstable_cache } from 'next/cache';
import type { SitemapEntry } from '../sitemap';
import {
  encodeSitemapSnapshot,
  decodeSitemapSnapshot,
} from './sitemap-snapshot';

/** Vercel's Data Cache survives process restarts and deployments. Revalidation
 * runs behind a stale read; throwing preserves the previous successful entry.
 * Never catch a loader error inside this cache or persist a curated fallback. */
export function persistentSitemap(
  name: string,
  load: () => Promise<SitemapEntry[]>,
) {
  const read = unstable_cache(
    async () => {
      const started = Date.now();
      try {
        const entries = await load();
        const snapshot = encodeSitemapSnapshot(entries);
        console.info('Sitemap snapshot generated', {
          name,
          urls: entries.length,
          durationMs: Date.now() - started,
          compressedBytes: Buffer.byteLength(snapshot),
        });
        return snapshot;
      } catch (error) {
        console.error('Sitemap snapshot refresh failed', {
          name,
          durationMs: Date.now() - started,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    ['public-sitemap-snapshot-v1', name],
    { revalidate: 3600 },
  );
  return async () => decodeSitemapSnapshot(await read());
}
