// Re-runs the classifier over records already in the database. The catalogue taxonomy grew
// from 10 to 15 categories on 2026-09-12 and a source's own category is now preferred, but a
// stored snapshot keeps the category it was parsed with until its next recheck, which for a
// large board takes days. This applies the new classification in place: no source is fetched,
// no other field changes, and an editorially paused record is left alone.
//
//   npx tsx scripts/reclassify-categories.ts            what would change, by transition
//   npx tsx scripts/reclassify-categories.ts --apply    write it, in batches of 200
import 'dotenv/config';
import { db, transaction } from '../lib/server/db';
import { classify, sourceCategory } from '../worker/categories';
import { hashVacancy, auditChange } from '../worker/importer';
import type { Vacancy } from '../lib/types';
const apply = process.argv.includes('--apply');
const argument = (name: string) =>
  Number(
    process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] || '',
  );
const limit = Math.max(1, Math.min(200000, argument('limit') || 200000));
type Row = {
  item_id: string;
  raw: Vacancy;
  listing_hints: { categoryLabel?: string } | null;
  source_id: string;
  job_id: string;
  version: number;
};
try {
  const rows: Row[] = (
    await db().query(
      `SELECT i.id item_id,i.raw,i.listing_hints,i.source_id,j.id job_id,j.version
      FROM jobs j JOIN source_items i ON i.job_id=j.id AND i.url=j.draft->>'url'
      JOIN sources s ON s.id=i.source_id
      WHERE j.status IN ('pending','published') AND j.automation_managed AND NOT j.automation_paused
      AND s.enabled AND NOT s.retired AND i.raw IS NOT NULL
      ORDER BY j.id LIMIT $1`,
      [limit],
    )
  ).rows;
  const counts: Record<string, number> = {};
  const pending = rows.flatMap((row) => {
    const category = classify(
      String(row.raw.title || ''),
      row.source_id === 'jobs'
        ? sourceCategory('jobs', row.listing_hints?.categoryLabel || '')
        : '',
    );
    if (category === row.raw.category) return [];
    counts[row.raw.category + ' → ' + category] =
      (counts[row.raw.category + ' → ' + category] || 0) + 1;
    return [{ ...row, category }];
  });
  let updated = 0;
  if (apply)
    for (let start = 0; start < pending.length; start += 200) {
      const batch = pending.slice(start, start + 200);
      // One round trip per statement instead of per record; every row still carries the
      // version and title it was read with, so a record changed meanwhile is skipped.
      updated += await transaction(async (c) => {
        const raws = batch.map((b) => ({ ...b.raw, category: b.category }));
        const changed = await c.query(
          `UPDATE jobs j SET
           draft=jsonb_set(j.draft,'{category}',to_jsonb(v.category)),
           published=CASE WHEN j.published IS NOT NULL AND j.published->>'title'=v.title
             THEN jsonb_set(j.published,'{category}',to_jsonb(v.category)) ELSE j.published END,
           version=j.version+1,updated_at=now()
           FROM (SELECT * FROM unnest($1::uuid[],$2::text[],$3::int[],$4::text[])
             AS t(id,category,version,title)) v
           WHERE j.id=v.id AND j.version=v.version AND j.automation_managed AND NOT j.automation_paused
           AND j.draft->>'title'=v.title
           RETURNING j.id`,
          [
            batch.map((b) => b.job_id),
            batch.map((b) => b.category),
            batch.map((b) => b.version),
            batch.map((b) => String(b.raw.title || '')),
          ],
        );
        const done = new Set(changed.rows.map((r) => r.id));
        const written = batch
          .map((b, i) => ({ ...b, next: raws[i] }))
          .filter((b) => done.has(b.job_id));
        if (!written.length) return 0;
        await c.query(
          `UPDATE source_items i SET raw=v.raw,content_hash=v.hash
           FROM (SELECT * FROM unnest($1::uuid[],$2::jsonb[],$3::text[]) AS t(id,raw,hash)) v
           WHERE i.id=v.id`,
          [
            written.map((b) => b.item_id),
            written.map((b) => JSON.stringify(b.next)),
            written.map((b) => hashVacancy(b.next)),
          ],
        );
        await c.query(
          `INSERT INTO audit_log(job_id,action,actor,before_data,after_data)
           SELECT * FROM unnest($1::uuid[],$2::text[],$3::text[],$4::jsonb[],$5::jsonb[])`,
          [
            written.map((b) => b.job_id),
            written.map(() => 'source.category_reclassified'),
            written.map(() => 'parser:categories-2026-09-12'),
            written.map((b) =>
              JSON.stringify(
                auditChange(
                  { category: b.raw.category },
                  { category: b.category },
                )[0],
              ),
            ),
            written.map((b) =>
              JSON.stringify(
                auditChange(
                  { category: b.raw.category },
                  { category: b.category },
                )[1],
              ),
            ),
          ],
        );
        return written.length;
      });
      console.log(
        JSON.stringify({
          progress: start + batch.length,
          of: pending.length,
          updated,
        }),
      );
    }
  console.log(
    JSON.stringify(
      {
        apply,
        checked: rows.length,
        changing: pending.length,
        updated,
        counts,
      },
      null,
      1,
    ),
  );
} finally {
  await db().end();
}
