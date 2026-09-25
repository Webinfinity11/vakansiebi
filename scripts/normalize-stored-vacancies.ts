import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { db, transaction } from '../lib/server/db';
import { fingerprint, jobsPlace } from '../worker/adapters';
import { hashVacancy, audit } from '../worker/importer';
import { vacancySchema } from '../lib/vacancy-schema';
import type { Vacancy } from '../lib/types';

/* Brings stored vacancies up to two parser changes that otherwise reach only new imports:

   1. jobs.ge wrote a Tbilisi district, metro station or street where the city goes, so those
      vacancies fell out of the Tbilisi filter. The city becomes თბილისი and the text is kept
      as the address — on the source copy always, and on the public copy only while automation
      owns it and nobody edited the city.
   2. The duplicate fingerprint no longer counts a legal form (შპს X is X), so every stored
      fingerprint is recomputed from its draft.

   Dry run by default; --apply writes, after saving every row it changes to .local/backups. */
const apply = process.argv.includes('--apply');

type Row = {
  item_id: string;
  item_url: string;
  raw: Vacancy;
  job_id: string;
  version: number;
  draft: Vacancy;
  published: Vacancy | null;
  managed: boolean;
};

const placed = (v: Vacancy): Vacancy => ({ ...v, ...jobsPlace(v) });
const same = (a: Vacancy, b: Vacancy) =>
  a.city === b.city &&
  a.mode === b.mode &&
  JSON.stringify(a.facts) === JSON.stringify(b.facts);

try {
  const rows = (
    await db().query<Row>(
      `SELECT i.id item_id, i.url item_url, i.raw, j.id job_id, j.version, j.draft, j.published,
              (j.automation_managed AND NOT j.automation_paused
               AND NOT EXISTS (SELECT 1 FROM job_submissions sub WHERE sub.job_id=j.id)) managed
         FROM source_items i JOIN sources s ON s.id=i.source_id JOIN jobs j ON j.id=i.job_id
        WHERE s.name='jobs.ge' AND i.raw IS NOT NULL AND j.status IN ('published','pending')
        ORDER BY j.id`,
    )
  ).rows.filter((r) => !same(r.raw, placed(r.raw)));

  const prints = (
    await db().query<{ id: string; draft: Vacancy; fingerprint: string }>(
      `SELECT id, draft, fingerprint FROM jobs WHERE draft IS NOT NULL
        AND status NOT IN ('merged','rejected','archived')`,
    )
  ).rows.filter((r) => fingerprint(r.draft) !== r.fingerprint);

  for (const r of rows.slice(0, 15))
    console.log(
      JSON.stringify({ id: r.job_id, from: r.raw.city, to: placed(r.raw).city }),
    );
  if (apply) {
    mkdirSync('.local/backups', { recursive: true });
    writeFileSync(
      `.local/backups/normalize-stored-${Date.now()}.json`,
      JSON.stringify({ rows, prints }),
    );
  }

  let items = 0;
  let jobs = 0;
  for (const row of apply ? rows : []) {
    const changed = await transaction(async (c) => {
      const item = (
        await c.query('SELECT raw FROM source_items WHERE id=$1 FOR UPDATE', [
          row.item_id,
        ])
      ).rows[0];
      const job = (
        await c.query(
          'SELECT version, draft, published FROM jobs WHERE id=$1 FOR UPDATE',
          [row.job_id],
        )
      ).rows[0];
      if (!item || !job || job.version !== row.version) return 0;
      const raw = vacancySchema.parse(placed(item.raw)) as Vacancy;
      await c.query(
        'UPDATE source_items SET raw=$2, content_hash=$3 WHERE id=$1',
        [row.item_id, raw, hashVacancy(raw)],
      );
      // An editor's city, or another source's copy, is not this item's to change.
      const owns = (v: Vacancy | null) =>
        !!v && row.managed && v.url === row.item_url && v.city === row.raw.city;
      if (!owns(job.draft) && !owns(job.published)) return 1;
      const draft = owns(job.draft) ? placed(job.draft) : job.draft;
      const published = owns(job.published)
        ? placed(job.published)
        : job.published;
      await c.query(
        'UPDATE jobs SET draft=$2, published=$3, fingerprint=$4, version=version+1, updated_at=now() WHERE id=$1',
        [row.job_id, draft, published, fingerprint(draft)],
      );
      await audit(
        c,
        row.job_id,
        'source.city_normalized',
        'parser:jobs-location',
        { city: row.raw.city },
        { city: draft.city, mode: draft.mode },
      );
      return 2;
    });
    if (changed) items++;
    if (changed === 2) jobs++;
  }

  let fingerprints = 0;
  for (const r of apply ? prints : []) {
    const { rowCount } = await db().query(
      'UPDATE jobs SET fingerprint=$2 WHERE id=$1 AND draft=$3::jsonb',
      [r.id, fingerprint(r.draft), r.draft],
    );
    fingerprints += rowCount || 0;
  }

  console.log(
    JSON.stringify({
      apply,
      jobsGeLocations: rows.length,
      itemsUpdated: items,
      publicCopiesUpdated: jobs,
      staleFingerprints: prints.length,
      fingerprintsUpdated: fingerprints,
    }),
  );
} finally {
  await db().end();
}
