import { db } from './db';

/* Who wrote an entry decides which view shows it: what people did is a few hundred rows,
   what the importers did is tens of thousands, so they are never mixed by default. */
export const auditScopes = {
  people: "a.actor IN ('admin','employer')",
  automation: "(a.actor='automation' OR a.actor LIKE 'requested:%')",
  sources:
    "(a.actor LIKE 'crawler:%' OR a.actor LIKE 'parser:%' OR a.actor='importer')",
  all: 'true',
} as const;
export type AuditScope = keyof typeof auditScopes;

export type AuditEntry = {
  id: string;
  jobId: string | null;
  action: string;
  actor: string;
  createdAt: string;
  title: string | null;
  company: string | null;
  beforeStatus: string | null;
  afterStatus: string | null;
  reason: string | null;
  tier: string | null;
  days: string | null;
  amount: string | null;
  fields: string[];
};

const pageSize = 50;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* Field names are listed only for an edit, where a before exists; a first publication would
   otherwise list every field of the vacancy as "changed". Only the parts a person reads are pulled out of the stored before/after documents: those
   hold whole vacancies, and a page of them would be megabytes for one line of text each. */
export async function auditHistory({
  scope = 'people',
  job,
  before,
}: {
  scope?: string;
  job?: string | null;
  before?: string | null;
}) {
  const where: string[] = [
    auditScopes[scope as AuditScope] ?? auditScopes.people,
  ];
  const args: unknown[] = [];
  if (job) {
    if (!uuid.test(job)) return { entries: [], more: false };
    args.push(job);
    where.push(`a.job_id=$${args.length}`);
  }
  if (before && /^\d{1,18}$/.test(before)) {
    args.push(before);
    where.push(`a.id<$${args.length}`);
  }
  const { rows } = await db().query(
    `SELECT a.id::text id, a.job_id "jobId", a.action, a.actor, a.created_at "createdAt",
       coalesce(j.published->>'title', j.draft->>'title') title,
       coalesce(j.published->>'company', j.draft->>'company') company,
       a.before_data->>'status' "beforeStatus", a.after_data->>'status' "afterStatus",
       a.after_data->>'reason' reason, a.after_data->>'tier' tier, a.after_data->>'days' days,
       coalesce(a.after_data->>'price', a.after_data->>'amount') amount,
       ARRAY(SELECT k FROM jsonb_object_keys(CASE
         WHEN jsonb_typeof(a.before_data->'published')='object' AND jsonb_typeof(a.after_data->'published')='object' THEN a.after_data->'published'
         WHEN jsonb_typeof(a.before_data->'draft')='object' AND jsonb_typeof(a.after_data->'draft')='object' THEN a.after_data->'draft'
         WHEN jsonb_typeof(a.before_data)='object' AND jsonb_typeof(a.after_data)='object' THEN a.after_data
         ELSE '{}'::jsonb END) k
         WHERE k NOT IN ('status','published','draft','reason','tier','days','price','amount','invoiceId')
         ORDER BY k) fields
     FROM audit_log a LEFT JOIN jobs j ON j.id=a.job_id
     WHERE ${where.join(' AND ')}
     ORDER BY a.id DESC LIMIT ${pageSize + 1}`,
    args,
  );
  return {
    entries: rows.slice(0, pageSize) as AuditEntry[],
    more: rows.length > pageSize,
  };
}
