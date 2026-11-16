import type { PoolClient } from 'pg';
import type { CompanyIdentity } from '../company-portal';
import { db } from './db';

export function trustedByHistory({ approved, rejected }: { approved: number; rejected: number }) {
  return approved >= 3 && rejected === 0;
}
export async function companyTrusted(client: Pick<PoolClient, 'query'>, companyKey: string): Promise<boolean> {
  const profile = (await client.query(`SELECT p.trusted_mode,p.approval_status,
    EXISTS(SELECT 1 FROM company_accounts a WHERE a.company_key=p.company_key AND a.role='owner' AND a.enabled AND a.email_verified) AS owner_ready
    FROM company_profiles p WHERE p.company_key=$1`, [companyKey])).rows[0];
  if (!profile || profile.approval_status !== 'approved' || !profile.owner_ready || profile.trusted_mode === 'off') return false;
  if (profile.trusted_mode === 'on') return true;
  const history = (await client.query(`SELECT
    (SELECT count(*)::int FROM company_job_ownership o JOIN jobs j ON j.id=o.job_id JOIN job_submissions s ON s.job_id=j.id
      WHERE o.company_key=$1 AND NOT s.is_test AND j.published_at>now()-interval '90 days') AS approved,
    (SELECT count(*)::int FROM audit_log a JOIN company_job_ownership o ON o.job_id=a.job_id
      WHERE o.company_key=$1 AND a.action='reject' AND a.created_at>now()-interval '90 days') AS rejected`, [companyKey])).rows[0];
  return trustedByHistory(history);
}

export async function autoPublishIfTrusted(company: Pick<CompanyIdentity, 'companyKey'>, jobId: string): Promise<boolean> {
  try {
    const job = (await db().query(`SELECT j.version FROM jobs j
      JOIN company_job_ownership o ON o.job_id=j.id JOIN job_submissions s ON s.job_id=j.id
      WHERE j.id=$1 AND o.company_key=$2 AND j.status='pending' AND NOT s.is_test
      AND s.requested_placement='standard' AND j.placement_tier='standard'
      AND NOT EXISTS(SELECT 1 FROM job_invoices i WHERE i.job_id=j.id)`, [jobId, company.companyKey])).rows[0];
    if (!job || !await companyTrusted(db(), company.companyKey)) return false;
    const { mutateJob } = await import('./jobs');
    await mutateJob({ id: jobId, version: job.version, action: 'publish' }, undefined, async c => {
      // Recheck inside publication's transaction; a concurrent moderation decision rolls it back.
      await c.query('SELECT company_key FROM company_profiles WHERE company_key=$1 FOR SHARE', [company.companyKey]);
      if (!await companyTrusted(c, company.companyKey)) throw new Error('Company trust changed');
      await c.query('UPDATE jobs SET auto_published_at=now(),auto_publish_reviewed_at=NULL WHERE id=$1', [jobId]);
      await c.query("INSERT INTO audit_log(job_id,action,actor) VALUES($1,'auto_publish','system')", [jobId]);
    });
    // Publication email delivery belongs to the existing cron.
    return true;
  } catch {
    console.warn('Trusted company publication deferred to moderation');
    return false;
  }
}
