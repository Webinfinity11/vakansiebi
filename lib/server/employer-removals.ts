import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import {
  removalCompanyKeys,
  type RemovalPreview,
} from '../employer-removal-input';
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

// Match the target rule first; avoid evaluating every active suppression for every job.
// CASE skips the costly email regexp entirely for name-only blocks.
const matchesRemoval = (value: 'draft' | 'published') => `(
  employer_removal_key(${value}->>'company')=ANY($1::text[])
  OR ${value}->>'url'=ANY($3::text[])
  OR CASE WHEN $2::text IS NOT NULL THEN $2 IN (
    SELECT lower(m[1]) FROM regexp_matches(${value}::text,
      '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}', 'g') m
  ) ELSE false END
)`;
const matchingJobs = `(${matchesRemoval('draft')} OR ${matchesRemoval('published')})`;

export async function previewEmployerRemoval(
  input: unknown,
): Promise<RemovalPreview> {
  const data = removalInput.omit({ reason: true, evidence: true }).parse(input);
  const keys = removalCompanyKeys(data.companyNames);
  // An email block merges into the existing rule, including when reactivating it.
  const prior = data.email
    ? (
        await db().query(
          'SELECT company_keys,source_urls FROM employer_suppressions WHERE email=$1',
          [data.email],
        )
      ).rows[0]
    : undefined;
  const rows = (
    await db().query(
      `
    SELECT coalesce(published->>'company',draft->>'company','') name,
      count(*)::int total,
      count(*) FILTER (WHERE status='published' AND published IS NOT NULL)::int published
    FROM jobs WHERE ${matchingJobs}
    GROUP BY 1 ORDER BY 1`,
      [
        [...keys, ...(prior?.company_keys || [])],
        data.email || null,
        [...data.sourceUrls, ...(prior?.source_urls || [])],
      ],
    )
  ).rows as RemovalPreview['companies'];
  return {
    companies: rows,
    total: rows.reduce((n, r) => n + r.total, 0),
    published: rows.reduce((n, r) => n + r.published, 0),
  };
}

export async function suppressEmployer(
  input: unknown,
  actor = 'admin',
  connection?: PoolClient,
) {
  const data = removalInput.parse(input);
  const companyKeys = removalCompanyKeys(data.companyNames);
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
       RETURNING id,email,company_keys,source_urls`,
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
        `WITH candidates AS MATERIALIZED (
          SELECT id,draft,published,employer_suppression_id FROM jobs
          WHERE employer_suppression_id=$4 OR ${matchingJobs}
        ), matched AS MATERIALIZED (
          SELECT id FROM candidates
          WHERE employer_suppression_id=$4 OR employer_suppression_for(draft)=$4 OR employer_suppression_for(published)=$4
        )
        SELECT j.id,j.draft,j.status,j.published FROM jobs j JOIN matched m ON m.id=j.id
        ORDER BY j.id FOR UPDATE OF j`,
        [rule.company_keys, rule.email, rule.source_urls, rule.id],
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
