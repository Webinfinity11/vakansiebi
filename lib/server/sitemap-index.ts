import { newest, publicVacancyDates } from './sitemap-data';
import { sitemapIndexResponse } from '../sitemap';

// Both sections change whenever a vacancy does, so they share its newest date.
export async function datedSitemapIndex() {
  const latest = await publicVacancyDates()
    .then((vacancies) => newest(vacancies.map((v) => v.lastModified)))
    .catch(() => undefined);
  return sitemapIndexResponse(
    latest
      ? { '/vacancies/sitemap.xml': latest, '/companies/sitemap.xml': latest }
      : {},
  );
}
