import { cache } from 'react';
import { db } from './db';
import { searchPlan } from './search-plan';

export type SalaryContext = {
  category: string;
  count: number;
  p25: number;
  median: number;
  p75: number;
};

/* Quartiles of the starting salaries visible in one category, using the same
   visibility, GEL and period rules as the salary filter (the searchable CTE's
   salary_month / salary_day columns). Fewer than eight figures, or the catch-all
   category, is not a context worth showing. */
export const salaryContext = cache(
  async (
    category: string,
    period: 'month' | 'day' = 'month',
  ): Promise<SalaryContext | null> => {
    if (!category || category === 'სხვა') return null;
    const plan = searchPlan(new URLSearchParams(), false, {
      grouped: true,
      pricing: true,
    });
    const args = [...plan.args, category];
    const column = period === 'day' ? 'j.salary_day' : 'j.salary_month';
    const { rows } = await db().query(
      `${plan.cte}
       SELECT count(*)::int AS count,
         percentile_cont(0.25) WITHIN GROUP (ORDER BY ${column}) AS p25,
         percentile_cont(0.5) WITHIN GROUP (ORDER BY ${column}) AS median,
         percentile_cont(0.75) WITHIN GROUP (ORDER BY ${column}) AS p75
       FROM searchable j
       WHERE ${plan.where} AND j.published->>'category'=$${args.length} AND ${column} IS NOT NULL AND ${column}>0`,
      args,
    );
    const row = rows[0];
    if (!row || Number(row.count) < 8) return null;
    return {
      category,
      count: Number(row.count),
      p25: Math.round(Number(row.p25)),
      median: Math.round(Number(row.median)),
      p75: Math.round(Number(row.p75)),
    };
  },
);
