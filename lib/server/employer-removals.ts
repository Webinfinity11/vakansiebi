import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { employerKey } from '../employer-identity';
import { genericCompanyKeys } from '../company-logo-identity';
import { db, transaction } from './db';
import { ApiError } from './auth';
import { clearPublicJobsCache } from './jobs';
import { enqueueIndexingNotifications } from './indexing-queue';
import { vacancyUrl } from '../seo';

export const removalInput = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase())
    .optional(),
  companyNames: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  sourceUrls: z.array(z.url().max(2000)).max(30).default([]),
  reason: z.string().trim().min(3).max(1000),
  evidence: z.string().max(4000).default(''),
});

export async function suppressEmployer(
  input: unknown,
  actor = 'admin',
  connection?: PoolClient,
) {
  const data = removalInput.parse(input);
  const baseKeys = [...new Set(data.companyNames.map(employerKey))].filter(
    (key) => key.length >= 3 && !genericCompanyKeys.has(key),
  );
  const legalForms = [
    'შპს',
    'სს',
    'სსიპ',
    'ააიპ',
    'იმ',
    'llc',
    'ltd',
    'jsc',
    'inc',
  ];
  const companyKeys = [
    ...new Set(
      baseKeys.flatMap((key) => [
        key,
        ...legalForms.flatMap((form) => [
          (form + key).slice(0, 300),
          (key + form).slice(0, 300),
        ]),
      ]),
    ),
  ];
  if (!data.email && !companyKeys.length && !data.sourceUrls.length)
    throw new ApiError(
      'მიუთითე კომპანიის მეილი, ზუსტი სახელი ან ვაკანსიის წყაროს ბმული',
    );
  const apply = async (c: PoolClient) => {
    // Serialise repeat requests from the same contact; reactivating a rule is explicit consent withdrawal.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `employer-removal:${data.email || companyKeys.join(',') || data.sourceUrls.join(',')}`,
    ]);
    const rule = (
      await c.query(
        `INSERT INTO employer_suppressions(id,email,company_names,company_keys,source_urls,reason,evidence,actor)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT(email) DO UPDATE SET active=true,reason=excluded.reason,evidence=excluded.evidence,
         company_names=ARRAY(SELECT DISTINCT unnest(employer_suppressions.company_names||excluded.company_names)),
         company_keys=ARRAY(SELECT DISTINCT unnest(employer_suppressions.company_keys||excluded.company_keys)),
         source_urls=ARRAY(SELECT DISTINCT unnest(employer_suppressions.source_urls||excluded.source_urls)),updated_at=now()
       RETURNING id`,
        [
          randomUUID(),
          data.email || null,
          data.companyNames,
          companyKeys,
          data.sourceUrls,
          data.reason,
          data.evidence,
          actor,
        ],
      )
    ).rows[0];
    const jobs = (
      await c.query(
        `SELECT id,draft,status,published FROM jobs
       WHERE employer_suppression_id=$1 OR employer_suppression_for(draft)=$1 OR employer_suppression_for(published)=$1
       ORDER BY id FOR UPDATE`,
        [rule.id],
      )
    ).rows;
    if (jobs.length)
      await c.query(
        `UPDATE jobs SET employer_suppression_id=$1,version=version+1,updated_at=now()
       WHERE id=ANY($2::uuid[])`,
        [rule.id, jobs.map((j) => j.id)],
      );
    await enqueueIndexingNotifications(
      jobs.map((j) => ({
        url: vacancyUrl(
          j.published ? { ...j.published, id: j.id } : { ...j.draft, id: j.id },
        ),
        type: 'URL_DELETED' as const,
      })),
      c,
    );
    await c.query(
      `INSERT INTO audit_log(action,actor,after_data) VALUES('employer.suppressed',$1,$2)`,
      [
        actor,
        {
          id: rule.id,
          email: data.email,
          companyNames: data.companyNames,
          removed: jobs.length,
          reason: data.reason,
        },
      ],
    );
    return { id: rule.id as string, removed: jobs.length };
  };
  const result = connection
    ? await apply(connection)
    : await transaction(apply);
  if (!connection) clearPublicJobsCache();
  return result;
}

export async function releaseEmployer(id: string) {
  await transaction(async (c) => {
    const result = await c.query(
      'UPDATE employer_suppressions SET active=false,updated_at=now() WHERE id=$1 RETURNING id',
      [z.uuid().parse(id)],
    );
    if (!result.rowCount)
      throw new ApiError('ბლოკირების წესი ვერ მოიძებნა', 404);
    await c.query(
      'UPDATE jobs SET employer_suppression_id=NULL,version=version+1,updated_at=now() WHERE employer_suppression_id=$1',
      [id],
    );
    await c.query(
      "INSERT INTO audit_log(action,actor,after_data) VALUES('employer.unsuppressed','admin',$1)",
      [{ id }],
    );
  });
  // Existing removed records deliberately remain rejected until a person reviews them.
  return { ok: true };
}

export async function removedVacancies(page = 0) {
  const offset = Math.min(100000, Math.max(0, Math.floor(page) || 0)) * 25;
  const [rows, rules, count, requests] = await Promise.all([
    db().query(
      `SELECT r.id,r.job_id "jobId",r.removed_at "removedAt",r.snapshot->>'title' title,
      r.snapshot->>'company' company,r.snapshot->>'url' url,s.reason,s.email,s.active,s.id "suppressionId"
      FROM removed_vacancies r JOIN employer_suppressions s ON s.id=r.suppression_id
      ORDER BY r.removed_at DESC,r.id DESC LIMIT 26 OFFSET $1`,
      [offset],
    ),
    db()
      .query(`SELECT id,email,company_names "companyNames",source_urls "sourceUrls",reason,created_at "createdAt"
      FROM employer_suppressions WHERE active ORDER BY created_at DESC LIMIT 100`),
    db().query('SELECT count(*)::int total FROM removed_vacancies'),
    db().query(
      `SELECT id,sender,excerpt,company_names "companyNames",status,note,confirmation_status "confirmationStatus",created_at "createdAt" FROM employer_removal_requests WHERE status<>'ignored' ORDER BY created_at DESC LIMIT 50`,
    ),
  ]);
  return {
    vacancies: rows.rows.slice(0, 25),
    more: rows.rows.length > 25,
    rules: rules.rows,
    total: count.rows[0].total,
    requests: requests.rows,
  };
}
