import { homeDescription, homeTitle } from './seo';
import { siteName } from './site-brand';
import {
  landingDescription,
  landingFor,
  landingHeading,
  searchHeading,
} from './seo-landing';
import { readSearch, readSearchPage } from './search-state';
import { canonicalSearchParams } from './search-url';

/** A page of a public list has different jobs, so it needs its own canonical.
 * Free-form searches and private/filter variants still stay out of the index.
 * Pagination links, rather than the sitemap, expose subsequent list pages.
 */
export function searchSeo(params: URLSearchParams) {
  const page = readSearchPage(params);
  const base = new URLSearchParams(params);
  base.delete('page');
  for (const key of params.keys())
    if (key.startsWith('utm_') || key === 'gclid' || key === 'fbclid')
      base.delete(key);
  const landing = landingFor(base);
  const canonical = landing
    ? new URLSearchParams(landing.path.split('?')[1])
    : canonicalSearchParams(base);
  if (page > 1) canonical.set('page', String(page));
  // A list that is not a page of its own is still named in its tab and share.
  const named = landing
    ? landingHeading(landing)
    : searchHeading(readSearch(base));
  const pageLabel = page > 1 ? ` — გვერდი ${page}` : '';
  const full = named ? `${named}${pageLabel}` : '';
  // A long topic name already fills the visible title; the brand gives way.
  const title = !named
    ? `${homeTitle}${pageLabel}`
    : full.length + siteName.length + 3 <= 70
      ? `${full} | ${siteName}`
      : full;
  const description = landing
    ? landingDescription(landing)
    : named
      ? `${named} ჯობიქსზე: შეადარე ხელფასი, გრაფიკი, მოვალეობები და მოთხოვნები.`
      : homeDescription;
  return {
    path: '/' + (canonical.size ? '?' + canonical : ''),
    index: !base.size || !!landing,
    title,
    description: pagedDescription(description, page),
  };
}

/** Each page of a list has other vacancies, so its summary names the page. */
export function pagedDescription(description: string, page: number) {
  return page > 1 ? `${description} გვერდი ${page}.` : description;
}
