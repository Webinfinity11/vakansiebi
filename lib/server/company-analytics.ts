import { db } from './db';
import { vacancyAnalytics, vacancyDailySeries } from './vacancy-analytics';
import type { CompanyIdentity } from '../company-portal';
import type { CompanyJobStats } from '../company-analytics';

/* Anonymous reader counts for the company's own vacancies only. The ownership join is the
   gate: another company's vacancy id never reaches the counting queries. A vacancy that was
   never on the site has nothing to count and is left out. */
export async function companyAnalytics(
  company: CompanyIdentity,
): Promise<CompanyJobStats[]> {
  const { rows } = await db().query<{ id: string; publishedAt: string }>(
    `SELECT j.id::text id, j.published_at "publishedAt"
     FROM jobs j JOIN company_job_ownership o ON o.job_id=j.id
     WHERE o.company_key=$1 AND j.published_at IS NOT NULL
     ORDER BY j.published_at DESC LIMIT 500`,
    [company.companyKey],
  );
  const ids = rows.map((r) => r.id);
  const [counts, series] = await Promise.all([
    vacancyAnalytics(ids),
    vacancyDailySeries(ids),
  ]);
  return rows.map((r) => ({
    id: r.id,
    publishedAt: new Date(r.publishedAt).toISOString(),
    ...counts[r.id],
    series: series[r.id],
  }));
}
