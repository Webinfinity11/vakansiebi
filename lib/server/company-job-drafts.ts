import { z } from 'zod';
import type { PoolClient } from 'pg';
import type { CompanyIdentity } from '../company-portal';
import { db, transaction } from './db';
import { ApiError } from './auth';

const draftFormSchema = z
  .object({
    wizardVersion: z.literal(2).optional(),
    title: z.string().max(120),
    city: z.string().max(100),
    category: z.string().max(100),
    mode: z.string().max(100),
    employmentType: z.string().max(100),
    salaryFrom: z.string().max(7),
    salaryTo: z.string().max(7),
    salaryPeriod: z.string().max(20),
    salaryBasis: z.string().max(20),
    experience: z.string().max(100),
    languages: z
      .array(
        z
          .object({ name: z.string().max(100), level: z.string().max(2) })
          .strict(),
      )
      .max(5),
    deadline: z.string().max(10),
    description: z.string().max(20000),
    contact: z.string().max(2000),
    placement: z.string().max(20),
    questions: z
      .array(
        z
          .object({
            id: z.string().max(36),
            text: z.string().max(300),
            kind: z.string().max(20),
            options: z.array(z.string().max(150)).max(8),
            preferred: z.string().max(500),
          })
          .partial()
          .strict(),
      )
      .max(5),
  })
  .partial()
  .strict();
export type CompanyJobDraftForm = z.infer<typeof draftFormSchema>;
export type CompanyJobDraft = {
  id: string;
  jobId: string | null;
  form: CompanyJobDraftForm;
  step: number;
  updatedAt: string;
  updatedBy: string;
};
export type CompanyJobDraftSummary = Omit<CompanyJobDraft, 'form'> & {
  title: string;
};
const select = `SELECT d.id,d.job_id AS "jobId",d.form,d.step,d.updated_at AS "updatedAt",COALESCE(NULLIF(a.representative_name,''),a.username,'') AS "updatedBy" FROM company_job_drafts d LEFT JOIN company_accounts a ON a.id=d.updated_by`;
const missing = () => new ApiError('მონახაზი ვერ მოიძებნა.', 404);
function writable(company: CompanyIdentity) {
  if (!['owner', 'recruiter'].includes(company.role))
    throw new ApiError('ამ მოქმედებისთვის საკმარისი უფლება არ გაქვთ.', 403);
}
function present(
  row: Omit<CompanyJobDraft, 'updatedAt'> & { updatedAt: Date },
): CompanyJobDraft {
  return { ...row, updatedAt: row.updatedAt.toISOString() };
}
export async function list(
  company: CompanyIdentity,
): Promise<CompanyJobDraftSummary[]> {
  const { rows } = await db().query(
    select + ' WHERE d.company_key=$1 ORDER BY d.updated_at DESC',
    [company.companyKey],
  );
  return rows.map((row) => {
    const { form, ...rest } = present(row);
    return { ...rest, title: form.title ?? '' };
  });
}
export async function get(
  company: CompanyIdentity,
  id: string,
): Promise<CompanyJobDraft> {
  const { rows } = await db().query(
    select + ' WHERE d.company_key=$1 AND d.id=$2',
    [company.companyKey, z.uuid().parse(id)],
  );
  if (!rows[0]) throw missing();
  return present(rows[0]);
}
export async function getForJob(
  company: CompanyIdentity,
  jobId: string,
): Promise<CompanyJobDraft | null> {
  const { rows } = await db().query(
    select + ' WHERE d.company_key=$1 AND d.job_id=$2',
    [company.companyKey, z.uuid().parse(jobId)],
  );
  return rows[0] ? present(rows[0]) : null;
}
export async function save(
  company: CompanyIdentity,
  input: unknown,
): Promise<CompanyJobDraft> {
  writable(company);
  const data = z
    .object({
      id: z.uuid(),
      jobId: z.uuid().nullable().optional(),
      form: z.unknown(),
      step: z.number().int().min(1).max(4),
    })
    .parse(input);
  if (Buffer.byteLength(JSON.stringify(data.form) ?? '', 'utf8') > 65536)
    throw new ApiError('მონახაზი ძალიან დიდია. შეამცირეთ ტექსტის მოცულობა.');
  const form = draftFormSchema.parse(data.form);
  await transaction(async (c) => {
    // Serialize all writes for one company so simultaneous autosaves cannot exceed the quota.
    await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      'job-drafts:' + company.companyKey,
    ]);
    const existing = (
      await c.query(
        'SELECT company_key,job_id FROM company_job_drafts WHERE id=$1 FOR UPDATE',
        [data.id],
      )
    ).rows[0];
    if (existing && existing.company_key !== company.companyKey)
      throw missing();
    const jobId =
      data.jobId === undefined ? (existing?.job_id ?? null) : data.jobId;
    if (existing && existing.job_id !== jobId)
      throw new ApiError('მონახაზის ვაკანსიის შეცვლა დაუშვებელია.');
    if (jobId) {
      const owned = await c.query(
        'SELECT job_id FROM company_job_ownership WHERE job_id=$1 AND company_key=$2',
        [jobId, company.companyKey],
      );
      if (!owned.rowCount) throw new ApiError('ვაკანსია ვერ მოიძებნა.', 404);
      const other = await c.query(
        'SELECT id FROM company_job_drafts WHERE job_id=$1 AND id<>$2',
        [jobId, data.id],
      );
      if (other.rowCount)
        throw new ApiError(
          'ამ ვაკანსიის მონახაზი უკვე არსებობს. განაახლეთ გვერდი.',
          409,
        );
    } else if (!existing) {
      const count = await c.query(
        'SELECT count(*)::int AS n FROM company_job_drafts WHERE company_key=$1 AND job_id IS NULL',
        [company.companyKey],
      );
      if (count.rows[0].n >= 20)
        throw new ApiError(
          'შეგიძლიათ შეინახოთ მაქსიმუმ 20 მონახაზი. ახალი მონახაზისთვის წაშალეთ ან გაგზავნეთ არსებული.',
          409,
        );
    }
    const result = await c.query(
      `INSERT INTO company_job_drafts(id,company_key,job_id,form,step,updated_by) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET form=excluded.form,step=excluded.step,updated_by=excluded.updated_by,updated_at=now() WHERE company_job_drafts.company_key=excluded.company_key RETURNING id`,
      [data.id, company.companyKey, jobId, form, data.step, company.id],
    );
    if (!result.rowCount) throw missing();
  });
  return get(company, data.id);
}
export async function remove(
  company: CompanyIdentity,
  id: string,
  client?: PoolClient,
): Promise<void> {
  writable(company);
  const result = await (client ?? db()).query(
    'DELETE FROM company_job_drafts WHERE id=$1 AND company_key=$2 RETURNING id',
    [z.uuid().parse(id), company.companyKey],
  );
  if (!result.rowCount) throw missing();
}
// Submission retries must succeed even after the first attempt removed the draft.
export async function removeSubmittedDraft(
  company: CompanyIdentity,
  id: string,
  client?: PoolClient,
): Promise<void> {
  await (client ?? db()).query(
    'DELETE FROM company_job_drafts WHERE id=$1 AND company_key=$2',
    [id, company.companyKey],
  );
}
