/** Process 9 new records before each published-vacancy recheck.
 * A time-limited run must not spend its entire budget on the new-item backlog.
 * Preserve each input's ordering and drain the other input when one runs out. */
export function detailQueue<T>(
  pending: readonly T[],
  existing: readonly T[],
): T[] {
  const queue: T[] = [];
  let nextNew = 0;
  let nextExisting = 0;
  while (nextNew < pending.length || nextExisting < existing.length) {
    for (let n = 0; n < 9 && nextNew < pending.length; n++) {
      queue.push(pending[nextNew++]);
    }
    if (nextExisting < existing.length) queue.push(existing[nextExisting++]);
  }
  return queue;
}

/** Rechecks only reuse a previous snapshot when it contains verified employer text.
 * Ordinary descriptions and quality candidates are read under lock by the importer,
 * not preloaded for every queued item (many of which may exceed the time budget). */
export const detailQueueProjection = `id,job_id,url,listing_hints,failures,raw IS NOT NULL AS previously_imported,
  CASE WHEN COALESCE(raw->>'fullTextUrl','')<>'' THEN
    jsonb_build_object('fullTextUrl',raw->>'fullTextUrl','description',raw->>'description','logoUrl',raw->>'logoUrl')
  ELSE NULL END AS raw`;
