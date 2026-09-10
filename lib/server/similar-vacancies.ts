import { db } from './db';
import { searchPlan } from './search-plan';
import { publicJobs } from './jobs';
import {
  roleTerms,
  similarity,
  type SimilarVacancy,
} from '../similar-vacancies';
import type { PublicJob } from '../types';

export async function similarVacancies(
  job: PublicJob,
  excluded = '',
): Promise<SimilarVacancy[]> {
  // Reuse publication, expiry and retired-source guards; hidden jobs affect every candidate.
  const plan = searchPlan(new URLSearchParams({ exclude: excluded }));
  const args = [...plan.args];
  const bind = (value: unknown) => {
    args.push(value);
    return `$${args.length}`;
  };
  const terms = bind(roleTerms(job.title));
  const city = bind(job.city);
  const category = bind(job.category);
  const id = bind(job.id);
  const overlap = `(SELECT count(*) FROM unnest(${terms}::text[]) term WHERE strpos(lower(normalize(j.published->>'title',NFKC)),term)>0)`;
  const sameCity = `lower(j.published->>'city')=lower(${city}) AND ${city} NOT IN ('','სხვა','საქართველო')`;
  const sameCategory = `j.published->>'category'=${category} AND ${category} NOT IN ('','სხვა')`;
  const rows = (
    await db().query(
      `${plan.cte} SELECT j.id,j.published FROM searchable j WHERE ${plan.where} AND j.id<>${id}::uuid AND (${overlap}>0 OR (${sameCity} AND ${sameCategory})) ORDER BY ${overlap} DESC,(${sameCity}) DESC,j.published_at DESC,j.id LIMIT 40`,
      args,
    )
  ).rows;
  const ranked = rows
    .map((row) => ({
      id: row.id as string,
      match: similarity(job, { ...row.published, id: row.id } as PublicJob),
    }))
    .filter((item) => item.match !== null)
    .sort((a, b) => b.match!.score - a.match!.score)
    .slice(0, 6);
  if (!ranked.length) return [];
  const result = await publicJobs(
    new URLSearchParams({
      ids: ranked.map((item) => item.id).join(','),
      summary: '1',
    }),
  );
  return ranked.flatMap((item) => {
    const candidate = result.jobs.find((j) => j.id === item.id);
    return candidate ? [{ job: candidate, reasons: item.match!.reasons }] : [];
  });
}
