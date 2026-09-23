import { gzipSync, gunzipSync } from 'node:zlib';
import type { SitemapEntry } from '../sitemap';

// The Data Cache has a per-entry size limit. Compact public URL data rather
// than caching megabytes of repeated XML tags or uncompressed JSON.
export function encodeSitemapSnapshot(entries: SitemapEntry[]) {
  if (!entries.length) throw new Error('Sitemap generation returned no URLs');
  const value = gzipSync(JSON.stringify(entries)).toString('base64');
  if (Buffer.byteLength(value) > 1_900_000)
    throw new Error('Sitemap snapshot exceeds cache capacity; split this leaf');
  return value;
}

export function decodeSitemapSnapshot(value: string): SitemapEntry[] {
  const rows: { url: string; lastModified?: string }[] = JSON.parse(
    gunzipSync(Buffer.from(value, 'base64'), {
      maxOutputLength: 32 * 1024 * 1024,
    }).toString('utf8'),
  );
  return rows.map((row) => ({
    url: row.url,
    ...(row.lastModified ? { lastModified: new Date(row.lastModified) } : {}),
  }));
}
