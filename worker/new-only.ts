/** Calendar dates from the source, never our discovery time or a guessed date. */
export function importDateReason(
  date: string | undefined,
  today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()),
): 'undated' | 'outside_window' | null {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'undated';
  const at = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(at) || new Date(at).toISOString().slice(0, 10) !== date)
    return 'undated';
  const age = (Date.parse(today + 'T00:00:00Z') - at) / 86400000;
  return age >= 0 && age <= 2 ? null : 'outside_window';
}

const newItemsStartSql =
  "((now() AT TIME ZONE 'Asia/Tbilisi')::date - 2) AT TIME ZONE 'Asia/Tbilisi'";

/** The worker and admin counters share the same actionable new-item queue. */
export function pendingNewItemsWhere(alias = '') {
  const column = (name: string) => (alias ? `${alias}.${name}` : name);
  return `${column('job_id')} IS NULL AND ${column('raw')} IS NULL
    AND ${column('failures')}<3 AND ${column('next_check_at')}<'infinity'::timestamptz
    AND ${column('discovered_at')} >= ${newItemsStartSql}`;
}

export function pendingNewItemsSql(projection: string) {
  return `SELECT ${projection} FROM source_items WHERE source_id=$1
    AND ${pendingNewItemsWhere()} AND next_check_at<=now()
    ORDER BY listing_hints->>'datePosted' DESC NULLS LAST,discovered_at DESC,id LIMIT $2`;
}

/** Keep source IDs as tombstones, so discovery cannot enqueue abandoned work again. */
export const retireStaleNewItemsSql = `UPDATE source_items
  SET next_check_at='infinity'::timestamptz, refresh_requested_at=NULL
  WHERE source_id=$1 AND job_id IS NULL AND raw IS NULL
    AND next_check_at<'infinity'::timestamptz
    AND (discovered_at < ${newItemsStartSql} OR failures>=3)`;

/** Old snapshot repairs are not work the new-only collector can complete. */
export const retireUnusedReviewsSql = `UPDATE source_items
  SET refresh_requested_at=NULL,quality_candidate=NULL,quality_signature=NULL,
    quality_warning=NULL,quality_first_seen=NULL,quality_last_seen=NULL,quality_observations=0
  WHERE source_id=$1 AND (refresh_requested_at IS NOT NULL OR quality_warning IS NOT NULL)
    AND NOT (${pendingNewItemsWhere()})`;
