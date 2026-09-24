import { db } from './db';

export type MapVacancy = {
  id: string;
  title: string;
  company: string;
  salary: string;
  salaryPeriod: string;
  logoUrl: string;
  category: string;
  city: string;
  premium: boolean;
  datePosted: string;
  /** One or more precise workplaces: [lat, lon, label]. */
  places: [number, number, string][];
};

/* Every published vacancy with at least one precisely placed workplace. Small enough to send
   whole — a few thousand rows — so the map clusters and filters in the browser without a
   request per pan. Merged duplicates are left out: the canonical record carries the pin. */
export async function mapVacancies(): Promise<MapVacancy[]> {
  const { rows } = await db().query<MapVacancy>(
    `SELECT j.id::text AS id,
       j.published->>'title' AS title,
       coalesce(j.published->>'company', '') AS company,
       coalesce(j.published->>'salary', '') AS salary,
       coalesce(j.published->>'salaryPeriod', '') AS "salaryPeriod",
       coalesce(j.published->>'logoUrl', '') AS "logoUrl",
       coalesce(j.published->>'category', '') AS category,
       coalesce(j.published->>'city', '') AS city,
       (j.placement_tier <> 'standard' AND j.placement_expires_at > now()) AS premium,
       coalesce(j.published->>'datePosted', j.published_at::date::text, '') AS "datePosted",
       json_agg(json_build_array(p.lat, p.lon, p.label) ORDER BY p.query) AS places
     FROM job_places p JOIN jobs j ON j.id = p.job_id
     WHERE j.status = 'published'
     GROUP BY j.id
     ORDER BY premium DESC, j.published_at DESC NULLS LAST
     LIMIT 5000`,
  );
  return rows;
}
