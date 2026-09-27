import { db } from '../lib/server/db';
import { searchPlan } from '../lib/server/search-plan';
import { cities } from '../lib/cities';
import { traitKeys, traits, type LandingCount } from '../lib/seo-landing';
import { categories } from '../lib/types';
import { roleVocabulary } from '../lib/search-language';
import { subcategories, subcategoryForTitle } from '../lib/subcategories';

// Background work gets a bounded ten minutes, independent of crawler requests.
export const censusBudgetMs = 600_000;
// Count the same canonical records and filters as the public search.
export async function refreshLandingCounts({
  force = false,
}: { force?: boolean } = {}) {
  const deadline = Date.now() + censusBudgetMs;
  const client = await db().connect();
  let discard = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    // Transaction locks also work through the production transaction pooler.
    const locked = (
      await client.query('SELECT pg_try_advisory_xact_lock(917430) ok')
    ).rows[0].ok;
    if (!locked) {
      await client.query('COMMIT');
      return null;
    }
    const fresh = (
      await client.query(
        "SELECT 1 FROM landing_counts WHERE computed_at > now() - interval '1 hour' LIMIT 1",
      )
    ).rowCount;
    if (!force && fresh) {
      await client.query('COMMIT');
      return null;
    }
    await client.query("SET LOCAL work_mem = '32MB'");
    // Group ranking is independent of city/trait/role. Compute it once, then
    // apply the unchanged search filters only to those canonical identifiers.
    const matching = async (
      params: URLSearchParams,
      canonicalIds?: string[],
    ) => {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Landing census deadline exceeded');
      await client.query(`SET LOCAL statement_timeout = '${remaining}ms'`);
      const plan = searchPlan(params, false, {
        grouped: canonicalIds === undefined,
        jobIds: canonicalIds,
      });
      /* Only the base pass reads titles; the other passes reuse its ids. The
         subcategory is matched here, in the worker, with the same patterns the
         search sends to SQL: 87 regular expressions per title cost the database
         seconds of awake time on a real catalogue, and the worker ~60 ms. */
      const title = canonicalIds === undefined ? ',j.p_title AS title' : '';
      return (
        await client.query<{
          id: string;
          category: string;
          title?: string | null;
        }>(
          `${plan.cte} SELECT j.id,j.p_category AS category${title} FROM searchable j WHERE ${plan.where}`,
          plan.args,
        )
      ).rows;
    };
    const base = (await matching(new URLSearchParams())).map((job) => ({
      ...job,
      subcategory:
        subcategoryForTitle(job.category ?? '', job.title ?? '')?.id ?? null,
    }));
    const canonicalIds = base.map((row) => row.id);
    const byCity = new Map<string, Set<string>>();
    for (const city of cities)
      byCity.set(
        city,
        new Set(
          (await matching(new URLSearchParams({ city }), canonicalIds)).map(
            (r) => r.id,
          ),
        ),
      );
    const rows: LandingCount[] = [];
    const countPlaces = (
      jobs: readonly { id: string }[],
      category: string | null,
      trait: LandingCount['trait'],
      role: string | null = null,
      subcategory: string | null = null,
    ) => {
      if (category || trait || role)
        rows.push({
          category,
          city: null,
          trait,
          role,
          subcategory,
          count: jobs.length,
        });
      for (const city of cities)
        rows.push({
          category,
          city,
          trait,
          role,
          subcategory,
          count: jobs.filter((job) => byCity.get(city)!.has(job.id)).length,
        });
    };
    for (const trait of [null, ...traitKeys]) {
      const jobs = trait
        ? await matching(
            new URLSearchParams([[...traits[trait].param]]),
            canonicalIds,
          )
        : base;
      countPlaces(jobs, null, trait);
      for (const category of categories.filter((name) => name !== 'სხვა'))
        countPlaces(
          jobs.filter((job) => job.category === category),
          category,
          trait,
        );
    }
    for (const { label } of roleVocabulary)
      countPlaces(
        await matching(new URLSearchParams({ q: label }), canonicalIds),
        null,
        null,
        label,
      );
    for (const { id, category } of subcategories)
      countPlaces(
        base.filter((job) => job.subcategory === id),
        category,
        null,
        null,
        id,
      );
    // Publish the entire snapshot atomically; failed refreshes retain the old one.
    await client.query('DELETE FROM landing_counts');
    await client.query(
      `
      INSERT INTO landing_counts (category, city, trait, role, subcategory, count, computed_at)
      SELECT category, city, trait, role, subcategory, count, transaction_timestamp()
      FROM jsonb_to_recordset($1::jsonb)
        AS r(category text, city text, trait text, role text, subcategory text, count integer)
    `,
      [JSON.stringify(rows)],
    );
    await client.query('COMMIT');
    return rows.length;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}
