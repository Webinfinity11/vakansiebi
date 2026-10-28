import { siteUrl } from '../seo';
import { blogPosts } from '../blog';
import { eligibleLandings, landingFor, landingPath } from '../seo-landing';
import { vacancyPath } from '../vacancy-navigation';
import { employerPages } from './employers';
import { publicRead, searchPlan } from './search-plan';
import { readLandingSnapshot, publicVacancyDates } from './sitemap-data';

export function pagesEntries() {
  return [
    '/',
    '/companies',
    '/cv',
    '/map',
    '/business',
    '/blog',
    ...blogPosts.map((post) => `/blog/${post.slug}`),
  ].map((path) => ({
    url: `${siteUrl}${path}`,
  }));
}

export async function searchesEntries() {
  const { rows: counts } = await readLandingSnapshot();
  const rows = eligibleLandings(counts);
  if (!rows.length) throw new Error('No eligible landing counts');
  const paths = rows
    .map(({ category, city, trait, role, subcategory }) =>
      landingPath({ category, city, trait, role, subcategory }),
    )
    // The same guard the page itself uses, so a listed address is an indexable one.
    .filter(
      (path) => !!landingFor(new URLSearchParams(path.split('?')[1] || '')),
    );
  // A census refresh time does not tell us when this page's content changed.
  return [...new Set(paths)].sort().map((path) => ({ url: siteUrl + path }));
}

export async function vacanciesEntries() {
  const vacancies = await publicVacancyDates();
  return vacancies.map(({ id, title, lastModified }) => ({
    url: siteUrl + vacancyPath({ id, title }),
    lastModified,
  }));
}

export async function companiesEntries() {
  const employers = await employerPages();
  // The newest remaining job misses removals and company profile edits. Omit lastmod
  // until a timestamp tracks all meaningful changes to the company page.
  const plan = searchPlan(new URLSearchParams());
  const active = await publicRead(
    `${plan.cte} SELECT j.id::text AS id FROM searchable j WHERE ${plan.where}`,
    plan.args,
  );
  const ids = new Set(active.rows.map((row) => row.id));
  return [...employers.bySlug.values()]
    .filter((page) => page.jobIds.some((id) => ids.has(id)))
    .slice(0, 4999)
    .map((page) => ({
      url: `${siteUrl}/companies/${encodeURIComponent(page.slug)}`,
    }));
}
