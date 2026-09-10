import 'dotenv/config';
import { db, transaction } from '../lib/server/db';
import { resolveCompanyLogos } from '../lib/server/company-logos';
import { logoCompanyKey } from '../lib/company-logo-identity';
import {
  linkedProvider,
  readLinkedText,
  sameLinkedTitle,
} from '../worker/linked-description';
import { hashVacancy, audit } from '../worker/importer';
import { vacancySchema } from '../lib/vacancy-schema';
const apply = process.argv.includes('--apply');
try {
  const rows = (
    await db()
      .query(`SELECT i.id item_id,i.raw,j.id job_id,j.version,j.published
    FROM jobs j JOIN source_items i ON i.job_id=j.id AND i.url=j.published->>'url'
    JOIN sources s ON s.id=i.source_id
    WHERE j.status='published' AND j.automation_managed AND NOT j.automation_paused
    AND s.enabled AND NOT s.retired AND i.error IS NULL AND i.quality_warning IS NULL
    AND i.last_verified_at>now()-interval '48 hours'
    AND COALESCE(j.published->>'logoUrl','')='' AND COALESCE(i.raw->>'logoUrl','')=''
    AND COALESCE(j.published->>'fullTextUrl','')<>''
    AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD'))
    ORDER BY i.last_verified_at DESC,j.id`)
  ).rows;
  const known = await resolveCompanyLogos(rows.map((r) => r.published.company));
  const selected = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = logoCompanyKey(row.published.company);
    const provider = linkedProvider(row.published.fullTextUrl);
    if (
      key &&
      !known.has(key) &&
      !selected.has(key) &&
      ['helio', 'smart', 'selfrecruit'].includes(provider || '')
    )
      selected.set(key, row);
  }
  console.log(
    JSON.stringify({ apply, eligible: rows.length, companies: selected.size }),
  );
  if (apply)
    for (const row of [...selected.values()].slice(0, 100)) {
      try {
        const linked = await readLinkedText(
          row.published.fullTextUrl,
          linkedProvider(row.published.fullTextUrl)!,
        );
        if (
          !linked.logoUrl ||
          !sameLinkedTitle(row.published.title, linked.title) ||
          !row.published.description.includes(linked.text)
        ) {
          console.log(
            JSON.stringify({
              job: row.job_id,
              skipped: 'No matching verified logo/text',
            }),
          );
          continue;
        }
        const updated = await transaction(async (c) => {
          // Match the primary-source snapshot before touching the publication. No crawl freshness or editorial settings change.
          const item = (
            await c.query('SELECT * FROM source_items WHERE id=$1 FOR UPDATE', [
              row.item_id,
            ])
          ).rows[0];
          const job = (
            await c.query('SELECT * FROM jobs WHERE id=$1 FOR UPDATE', [
              row.job_id,
            ])
          ).rows[0];
          if (
            !item ||
            !job ||
            job.version !== row.version ||
            job.status !== 'published' ||
            job.automation_paused ||
            item.error ||
            item.quality_warning ||
            item.raw.logoUrl ||
            job.published.logoUrl ||
            item.raw.description !== row.raw.description ||
            job.published.description !== row.published.description
          )
            return false;
          const raw = { ...item.raw, logoUrl: linked.logoUrl };
          vacancySchema.parse(raw);
          await c.query(
            'UPDATE source_items SET raw=$2,content_hash=$3 WHERE id=$1',
            [row.item_id, raw, hashVacancy(raw)],
          );
          await c.query(
            `UPDATE jobs SET published=jsonb_set(published,'{logoUrl}',to_jsonb($2::text)),draft=CASE WHEN COALESCE(draft->>'logoUrl','')='' THEN jsonb_set(draft,'{logoUrl}',to_jsonb($2::text)) ELSE draft END,version=version+1 WHERE id=$1`,
            [row.job_id, linked.logoUrl],
          );
          await audit(
            c,
            row.job_id,
            'source.logo_enriched',
            'parser:verified-employer-logo',
            {},
            { logoUrl: linked.logoUrl, origin: linked.url },
          );
          return true;
        });
        console.log(
          JSON.stringify({
            job: row.job_id,
            company: row.published.company,
            updated,
          }),
        );
      } catch (e) {
        console.log(
          JSON.stringify({ job: row.job_id, error: (e as Error).message }),
        );
      }
    }
} finally {
  await db().end();
}
