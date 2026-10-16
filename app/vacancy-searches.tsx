import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { landingCounts } from '@/lib/server/sitemap-data';
import { vacancySearches } from '@/lib/vacancy-searches';
import type { Vacancy } from '@/lib/types';

export async function VacancySearches({
  job,
}: {
  job: Pick<Vacancy, 'title' | 'category' | 'city'>;
}) {
  const rows = await landingCounts().catch(() => null);
  const links = rows ? vacancySearches(job, rows) : [];
  if (!links.length) return null;
  return (
    <nav
      id="vacancy-searches"
      className="vacancy-searches"
      aria-label="განაგრძე ძებნა"
    >
      <h2>განაგრძე ძებნა</h2>
      <ul>
        {links.map(({ path, label }) => (
          <li key={path}>
            <Link href={path} prefetch={false}>
              <span>{label}</span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
