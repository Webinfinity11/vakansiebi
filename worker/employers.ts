import { db } from '../lib/server/db';
import { candidatePairs, employerIdentity } from '../lib/employer-identity';
import {
  automaticEmployerDecision,
  employerDomain,
  type EmployerEvidence,
} from '../lib/employer-automation';
import { safeLogoUrl } from '../lib/vacancy-media';

/** Never changes vacancies, CVs or a manual editor's identity decision. */
export async function reconcileEmployers(force = false) {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    if (
      !(
        await client.query(
          "SELECT pg_try_advisory_xact_lock(hashtext('employer-automation')) locked",
        )
      ).rows[0].locked
    ) {
      await client.query('ROLLBACK');
      return { skipped: true };
    }
    if (
      !force &&
      (
        await client.query(
          "SELECT 1 FROM audit_log WHERE action='employer.automation' AND created_at>now()-interval '1 hour' LIMIT 1",
        )
      ).rowCount
    ) {
      await client.query('ROLLBACK');
      return { skipped: true };
    }
    const rows = (
      await client.query(`SELECT btrim(j.published->>'company') name,COALESCE(j.published->>'logoUrl','') logo,
    COALESCE(p.website,'') website,array_agg(DISTINCT si.source_id) sources
    FROM jobs j JOIN source_items si ON si.job_id=j.id JOIN sources s ON s.id=si.source_id AND NOT s.retired
    LEFT JOIN company_profiles p ON p.company_key=regexp_replace(lower(normalize(j.published->>'company',NFKC)),'[^a-z0-9ა-ჰ]','','g')
    WHERE j.status='published' AND COALESCE(j.published->>'company','')<>''
      AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD'))
    GROUP BY 1,2,3`)
    ).rows;
    const evidence = new Map<string, EmployerEvidence>();
    for (const row of rows) {
      const id = employerIdentity(row.name, row.sources, Boolean(row.logo));
      if (!id) continue;
      const info = evidence.get(id) || {
        logos: new Set<string>(),
        domains: new Set<string>(),
      };
      const logo = safeLogoUrl(row.logo);
      if (logo) info.logos.add(logo);
      const domain = employerDomain(row.website);
      if (domain) info.domains.add(domain);
      evidence.set(id, info);
    }
    let merged = 0,
      separate = 0;
    for (const [a, b] of candidatePairs([...evidence.keys()])) {
      const result = automaticEmployerDecision(
        evidence.get(a)!,
        evidence.get(b)!,
      );
      const written = await client.query(
        `INSERT INTO employer_decisions(a,b,decision,automatic,evidence) VALUES($1,$2,$3,true,$4)
     ON CONFLICT(a,b) DO UPDATE SET decision=excluded.decision,evidence=excluded.evidence,decided_at=now()
       WHERE employer_decisions.automatic AND (employer_decisions.decision,employer_decisions.evidence) IS DISTINCT FROM (excluded.decision,excluded.evidence)
     RETURNING decision`,
        [a, b, result.decision, result],
      );
      if (written.rowCount) {
        if (result.decision === 'merge') merged++;
        else separate++;
      }
    }
    await client.query(
      "INSERT INTO audit_log(action,actor,after_data) VALUES('employer.automation','worker',$1)",
      [{ merged, separate }],
    );
    await client.query('COMMIT');
    return { merged, separate };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
