import { unstable_cache } from 'next/cache';
import { publicRead, searchPlan } from './search-plan';
import { summarizeSalaries } from '../salary-pages';

export const salaryPages = unstable_cache(
  async () => {
    const plan = searchPlan(new URLSearchParams(), false, {
      grouped: true,
      pricing: true,
    });
    const { rows } = await publicRead(
      `${plan.cte} SELECT j.p_title AS title, j.p_category AS category, j.salary_month AS month, j.salary_day AS day FROM searchable j WHERE ${plan.where}`,
      plan.args,
    );
    return summarizeSalaries(rows);
  },
  ['salary-pages-v4'],
  { revalidate: 3600 },
);
