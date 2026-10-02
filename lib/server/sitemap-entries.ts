import { siteUrl } from '../seo';
import { eligibleLandings, landingFor, landingPath } from '../seo-landing';
import { vacancyPath } from '../vacancy-navigation';
import { employerPages } from './employers';
import { readLandingSnapshot, publicVacancyDates } from './sitemap-data';

export function pagesEntries() {
  return ['/', '/companies', '/cv', '/map', '/business'].map((path) => ({
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
  return [...employers.bySlug.values()].slice(0, 4999).map((page) => ({
    url: `${siteUrl}/companies/${encodeURIComponent(page.slug)}`,
  }));
}
