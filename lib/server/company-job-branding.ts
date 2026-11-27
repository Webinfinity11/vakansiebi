import { db } from './db';
import { companyKey } from '../company-key';

// Include the database revision in process-local cache keys: a profile may be
// saved by another server instance, where clearing this process is impossible.
export async function companyBrandingRevision(): Promise<string> {
  const { rows } = await db().query(
    "SELECT coalesce(max(updated_at)::text, '') || ':' || count(*)::text || ':' || coalesce(sum(version),0)::text AS revision FROM company_profiles",
  );
  return rows[0].revision;
}

export async function jobCompanyProfiles(
  jobs: readonly { id: string; company: string }[],
  summary = true,
) {
  if (!jobs.length) return new Map();
  const { rows } = await db().query(
    `SELECT input.id, p.company_key, p.logo_url${summary ? '' : ',p.website,p.description,p.benefits,p.why_us'}
     FROM unnest($1::uuid[], $2::text[]) AS input(id, company_key)
     LEFT JOIN company_job_ownership o ON o.job_id=input.id
     LEFT JOIN company_profiles p ON p.company_key=coalesce(o.company_key,input.company_key)`,
    [jobs.map((job) => job.id), jobs.map((job) => companyKey(job.company))],
  );
  return new Map(rows.map((row) => [row.id, row]));
}
