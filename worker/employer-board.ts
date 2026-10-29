import type { SourceId, Vacancy } from '../lib/types';
import { db, transaction } from '../lib/server/db';
import { modules, externalId } from './adapters';
import { hashVacancy, audit } from './importer';
import { publishable, reconcileJob } from './automation';

/** Only complete, validated employer boards can update or withdraw existing roles.
 * Ordinary dated sources retain their immutable new-only collection behaviour. */
export async function refreshEmployerBoard(
  source: SourceId,
  vacancies: Vacancy[],
) {
  if (!modules[source]?.listingSnapshot || !vacancies.length)
    throw Error('A verified complete employer board is required');
  const current = new Map<string, Vacancy>();
  for (const vacancy of vacancies) {
    const id = externalId(source, vacancy.url);
    if (!id || !publishable(vacancy, source, vacancy.url) || current.has(id))
      throw Error('Invalid employer board snapshot');
    current.set(id, vacancy);
  }
  const items = (
    await db().query(
      'SELECT id FROM source_items WHERE source_id=$1 AND job_id IS NOT NULL ORDER BY id',
      [source],
    )
  ).rows;
  let changed = 0,
    removed = 0;
  for (const { id } of items) {
    const outcome = await transaction(async (c) => {
      const item = (
        await c.query(
          'SELECT id,external_id,job_id,raw,content_hash,error FROM source_items WHERE id=$1 AND source_id=$2 FOR UPDATE',
          [id, source],
        )
      ).rows[0];
      if (!item?.job_id) return 'unchanged';
      const next = current.get(item.external_id);
      if (next) {
        const hash = hashVacancy(next);
        await c.query(
          `UPDATE source_items SET raw=$2,content_hash=$3,last_checked_at=now(),last_verified_at=now(),
          last_seen_at=now(),error=NULL,failures=0,quality_warning=NULL WHERE id=$1`,
          [id, next, hash],
        );
        if (hash !== item.content_hash)
          await audit(
            c,
            item.job_id,
            'source.changed',
            'crawler:' + source,
            item.raw,
            next,
          );
        await reconcileJob(c, item.job_id);
        return hash !== item.content_hash ? 'changed' : 'unchanged';
      }
      if (item.error === 'Source vacancy unavailable') return 'unchanged';
      await c.query(
        "UPDATE source_items SET last_checked_at=now(),error='Source vacancy unavailable',next_check_at='infinity'::timestamptz WHERE id=$1",
        [id],
      );
      await reconcileJob(c, item.job_id);
      return 'removed';
    });
    if (outcome === 'changed') changed++;
    if (outcome === 'removed') removed++;
  }
  return { changed, removed };
}
