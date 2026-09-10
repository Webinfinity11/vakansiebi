import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { db, transaction } from '../lib/server/db';
import { explicitWorkCity } from '../lib/work-location';
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
    AND COALESCE(j.published->>'city','')='' AND COALESCE(i.raw->>'city','')=''
    AND i.raw->>'description'=j.published->>'description'
    ORDER BY j.id`)
  ).rows;
  if (apply) {
    mkdirSync('.local/backups', { recursive: true });
    writeFileSync(
      '.local/backups/workplace-city-' + Date.now() + '.json',
      JSON.stringify(rows),
    );
  }
  let updated = 0;
  for (const row of rows) {
    const city = explicitWorkCity(row.raw);
    if (!city || city !== explicitWorkCity(row.published)) continue;
    console.log(
      JSON.stringify({
        id: row.job_id,
        city,
        evidence: [
          ...(row.raw.facts || []).map(
            (f: { label: string; value: string }) => f.label + ': ' + f.value,
          ),
          ...row.raw.description.split('\n'),
        ]
          .join('\n')
          .split('\n')
          .filter((l: string) =>
            /მისამართი|ადგილმდებარეობა|სამუშაო ადგილი/.test(l),
          )
          .slice(0, 4),
      }),
    );
    if (!apply) continue;
    const changed = await transaction(async (c) => {
      const item = (
        await c.query('SELECT * FROM source_items WHERE id=$1 FOR UPDATE', [
          row.item_id,
        ])
      ).rows[0];
      const job = (
        await c.query('SELECT * FROM jobs WHERE id=$1 FOR UPDATE', [row.job_id])
      ).rows[0];
      if (
        !item ||
        !job ||
        job.version !== row.version ||
        job.status !== 'published' ||
        !job.automation_managed ||
        job.automation_paused ||
        item.error ||
        item.quality_warning ||
        item.raw.city ||
        job.published.city ||
        item.raw.description !== row.raw.description ||
        job.published.description !== row.published.description
      )
        return false;
      const raw = { ...item.raw, city };
      vacancySchema.parse(raw);
      await c.query(
        'UPDATE source_items SET raw=$2,content_hash=$3 WHERE id=$1',
        [item.id, raw, hashVacancy(raw)],
      );
      await c.query(
        `UPDATE jobs SET published=jsonb_set(published,'{city}',to_jsonb($2::text)),draft=CASE WHEN COALESCE(draft->>'city','')='' AND draft->>'description'=published->>'description' THEN jsonb_set(draft,'{city}',to_jsonb($2::text)) ELSE draft END,version=version+1 WHERE id=$1`,
        [job.id, city],
      );
      await audit(
        c,
        job.id,
        'source.city_enriched',
        'parser:explicit-workplace',
        { city: '' },
        { city },
      );
      return true;
    });
    if (changed) updated++;
  }
  console.log(JSON.stringify({ apply, checked: rows.length, updated }));
} finally {
  await db().end();
}
