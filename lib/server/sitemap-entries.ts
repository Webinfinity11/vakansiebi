import { siteUrl } from '../seo';
import { eligibleLandings, landingFor, landingPath } from '../seo-landing';
import { vacancyPath } from '../vacancy-navigation';
import { employerPages } from './employers';
import {
  readLandingSnapshot,
  newest,
  publicVacancyDatesOrLast,
} from './sitemap-data';

export function pagesEntries() {
  return ['/', '/post-job', '/cv'].map((path) => ({
    url: `${siteUrl}${path}`,
  }));
}

export async function searchesEntries() {
  const { rows: counts, computedAt } = await readLandingSnapshot();
  const rows = eligibleLandings(counts);
  if (!rows.length) throw new Error('No eligible landing counts');
  const paths = rows
    .map(({ category, city, trait, role }) =>
      landingPath({ category, city, trait, role }),
    )
    // The same guard the page itself uses, so a listed address is an indexable one.
    .filter(
      (path) => !!landingFor(new URLSearchParams(path.split('?')[1] || '')),
    );
  const lastModified = computedAt;
  return [...new Set(paths)]
    .sort()
    .map((path) => ({ url: siteUrl + path, lastModified }));
}

export async function vacanciesEntries() {
  const vacancies = await publicVacancyDatesOrLast();
  return vacancies.map(({ id, title, lastModified }) => ({
    url: siteUrl + vacancyPath({ id, title }),
    lastModified,
  }));
}

export async function companiesEntries() {
  const [employers, vacancies] = await Promise.all([
    employerPages(),
    publicVacancyDatesOrLast(),
  ]);
  // A company page changes when one of its vacancies does.
  const changed = new Map(vacancies.map((v) => [v.id, v.lastModified]));
  return [...employers.bySlug.values()].slice(0, 4999).map((page) => ({
    url: `${siteUrl}/companies/${encodeURIComponent(page.slug)}`,
    lastModified: newest(page.jobIds.flatMap((id) => changed.get(id) || [])),
  }));
}
