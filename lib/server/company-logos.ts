import { db } from './db';
import { logoCompanyKey, officialCompanyLogo } from '../company-logo-identity';
import { safeLogoUrl } from '../vacancy-media';
export type ResolvedLogo = { logoUrl: string; origin: string };
// Kept equivalent to the supported Georgian/English identity helper; values stay bound.
const keySql = (field: string) =>
  `regexp_replace(regexp_replace(regexp_replace(trim(lower(normalize(COALESCE(${field},''),NFKC))),'^(შპს|სსიპ|სს|llc|ltd|jsc)[[:space:]]+',''),'[[:space:],.]+(llc|ltd|jsc)[.]?$',''),'[^a-z0-9ა-ჰ]','','g')`;
export async function resolveCompanyLogos(names: string[]) {
  const resolved = new Map<string, ResolvedLogo>();
  const missing = new Set<string>();
  for (const name of names) {
    const key = logoCompanyKey(name);
    if (!key) continue;
    const official = officialCompanyLogo(name);
    if (official) resolved.set(key, official);
    else missing.add(key);
  }
  if (!missing.size) return resolved;
  const key = keySql("j.published->>'company'");
  const rows = (
    await db().query(
      `SELECT DISTINCT ON (${key}) ${key} company_key,j.published->>'company' company,i.raw->>'company' raw_company,j.published->>'logoUrl' logo_url,i.url origin
    FROM jobs j JOIN source_items i ON i.job_id=j.id JOIN sources s ON s.id=i.source_id
    WHERE j.status='published' AND j.published IS NOT NULL AND s.enabled AND NOT s.retired
    AND ${key}=ANY($1::text[]) AND COALESCE(j.published->>'logoUrl','')<>''
    AND i.error IS NULL AND i.quality_warning IS NULL AND i.last_verified_at>now()-interval '7 days'
    AND i.raw->>'logoUrl'=j.published->>'logoUrl' AND ${keySql("i.raw->>'company'")}=${key}
    AND (COALESCE(j.published->>'deadline','')='' OR j.published->>'deadline'>=to_char(now() AT TIME ZONE 'Asia/Tbilisi','YYYY-MM-DD'))
    ORDER BY ${key},CASE i.source_id WHEN 'hr' THEN 0 WHEN 'jobs' THEN 1 ELSE 2 END,i.last_verified_at DESC,j.id`,
      [[...missing]],
    )
  ).rows;
  for (const row of rows) {
    const logo = safeLogoUrl(row.logo_url);
    if (
      logo &&
      logoCompanyKey(row.company) === row.company_key &&
      logoCompanyKey(row.raw_company) === row.company_key
    )
      resolved.set(row.company_key, { logoUrl: logo, origin: row.origin });
  }
  return resolved;
}
