import { transaction } from '../lib/server/db';
import { vacancySchema } from '../lib/vacancy-schema';
import { enrichVacancy } from './enrich';
import { hashVacancy } from './importer';
import { sourceLockIds } from './adapters';
import type { Vacancy } from '../lib/types';

const fields = (v: Vacancy) => ({
  salary: v.salary,
  salaryMin: v.salaryMin,
  currency: v.currency,
  salaryPeriod: v.salaryPeriod,
  facts: v.facts,
});
export async function enrichExistingBatch(
  ids: string[],
  apply = false,
  includeEditorial = false,
) {
  if (ids.length > 100) throw Error('Enrichment batch exceeds 100 jobs');
  return transaction(async (c) => {
    if (apply)
      for (const source of ['hr', 'jobs', 'ss', 'hrgov'] as const) {
        if (
          !(
            await c.query('SELECT pg_try_advisory_xact_lock($1) AS locked', [
              sourceLockIds[source],
            ])
          ).rows[0].locked
        )
          throw Error(
            'A source worker is active; retry enrichment after it finishes',
          );
      }
    const jobs = (
      await c.query(
        `SELECT id,draft,published FROM jobs WHERE id=ANY($1::uuid[]) AND status='published' AND ((automation_managed AND NOT automation_paused) OR $2::boolean) ${apply ? 'FOR UPDATE' : ''}`,
        [ids, includeEditorial],
      )
    ).rows;
    const eligible = jobs.map((job) => job.id);
    const items = (
      await c.query(
        `SELECT i.id,i.raw FROM source_items i JOIN sources s ON s.id=i.source_id WHERE i.job_id=ANY($1::uuid[]) AND i.raw IS NOT NULL AND i.quality_warning IS NULL AND NOT s.retired ${apply ? 'FOR UPDATE OF i' : ''}`,
        [eligible],
      )
    ).rows;
    const sourceChanges = items.flatMap((item) => {
      const next = enrichVacancy(item.raw);
      return next !== item.raw && vacancySchema.safeParse(next).success
        ? [{ id: item.id, raw: next, hash: hashVacancy(next) }]
        : [];
    });
    let filled = 0;
    let amounts = 0;
    const changes = jobs.flatMap((job) => {
      const published = enrichVacancy(job.published);
      const draft = enrichVacancy(job.draft);
      if (
        (published === job.published && draft === job.draft) ||
        !vacancySchema.safeParse(published).success ||
        !vacancySchema.safeParse(draft).success
      )
        return [];
      if (!job.published.salary && published.salary) {
        filled++;
        if (/\d/.test(published.salary)) amounts++;
      }
      return [
        {
          id: job.id,
          draft,
          published,
          before: fields(job.published),
          after: fields(published),
        },
      ];
    });
    if (apply && sourceChanges.length)
      await c.query(
        `UPDATE source_items i SET raw=v.raw,content_hash=v.hash FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,raw jsonb,hash text) WHERE i.id=v.id`,
        [JSON.stringify(sourceChanges)],
      );
    if (apply && changes.length) {
      await c.query(
        `UPDATE jobs j SET draft=v.draft,published=v.published,version=j.version+1,updated_at=now() FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,draft jsonb,published jsonb) WHERE j.id=v.id`,
        [JSON.stringify(changes)],
      );
      await c.query(
        `INSERT INTO audit_log(job_id,action,actor,before_data,after_data) SELECT v.id,'source.enriched','parser:pay-excerpts-v1',v.before,v.after FROM jsonb_to_recordset($1::jsonb) AS v(id uuid,before jsonb,after jsonb)`,
        [JSON.stringify(changes)],
      );
    }
    // Local reinterpretation must never pretend the source was fetched again.
    return {
      jobs: changes.length,
      sources: sourceChanges.length,
      salaryFilled: filled,
      amountsRecovered: amounts,
    };
  });
}
