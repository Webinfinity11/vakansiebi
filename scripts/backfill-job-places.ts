/* Reads the town out of location fields that hold an address or a district, for vacancies
   imported before every source went through jobsLocation (2026-09-27). The address text is
   kept as a "მისამართი" fact when the vacancy has none. Dry run by default:

     npx tsx --env-file=.env scripts/backfill-job-places.ts           # show what would change
     npx tsx --env-file=.env scripts/backfill-job-places.ts --apply   # write it

   Only the city and the facts change; the vacancy's version moves so an open editor notices. */
import { db } from '../lib/server/db';
import { jobsLocation } from '../worker/adapters/jobs-location';
import type { Vacancy } from '../lib/types';

const apply = process.argv.includes('--apply');
type Row = {
  id: string;
  source: string | null;
  published: Vacancy | null;
  draft: Vacancy | null;
};

function relocate(v: Vacancy | null, tbilisiBoard: boolean) {
  if (!v?.city) return null;
  const place = jobsLocation(v.city, tbilisiBoard);
  if (!place.city || place.city === v.city.trim()) return null;
  const facts = v.facts || [];
  return {
    ...v,
    city: place.city,
    facts:
      place.address && !facts.some((f) => f.label === 'მისამართი')
        ? [...facts, { label: 'მისამართი', value: place.address.slice(0, 260) }]
        : facts,
  };
}

async function main() {
  const { rows } = await db().query<Row>(
    `SELECT j.id, (SELECT si.source_id FROM source_items si WHERE si.job_id=j.id ORDER BY si.id LIMIT 1) source,
            j.published, j.draft
     FROM jobs j WHERE j.status='published' AND j.published IS NOT NULL`,
  );
  const changes = rows
    .map((row) => {
      const board = row.source === 'jobs';
      return {
        id: row.id,
        source: row.source,
        from: row.published?.city || '',
        published: relocate(row.published, board),
        draft: relocate(row.draft, board),
      };
    })
    .filter((change) => change.published);
  const bySource: Record<string, number> = {};
  for (const change of changes)
    bySource[change.source || '?'] = (bySource[change.source || '?'] || 0) + 1;
  console.log(
    `${changes.length} of ${rows.length} published vacancies would move:`,
    bySource,
  );
  for (const change of changes.slice(0, 15))
    console.log(`  ${change.from}  →  ${change.published!.city}`);
  if (!apply) {
    console.log('\nDry run. Add --apply to write.');
    return;
  }
  const client = await db().connect();
  try {
    for (let i = 0; i < changes.length; i += 200) {
      await client.query('BEGIN');
      for (const change of changes.slice(i, i + 200))
        await client.query(
          `UPDATE jobs SET published=$2, draft=COALESCE($3, draft), version=version+1, updated_at=now()
           WHERE id=$1 AND status='published'`,
          [change.id, change.published, change.draft],
        );
      await client.query('COMMIT');
      console.log(
        `written ${Math.min(i + 200, changes.length)} / ${changes.length}`,
      );
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => db().end())
  .catch(async (error) => {
    console.error(error);
    await db().end();
    process.exit(1);
  });
