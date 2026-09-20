import { homeDescription, homeTitle } from './seo';
import { landingDescription, landingFor, landingHeading } from './seo-landing';
import { readSearchPage } from './search-state';
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
  const title = landing ? `${landingHeading(landing)} | JOBX` : homeTitle;
  return {
    path: '/' + (canonical.size ? '?' + canonical : ''),
    index: !base.size || !!landing,
    title:
      page > 1 ? title.replace(' | JOBX', ` — გვერდი ${page} | JOBX`) : title,
    description: landing ? landingDescription(landing) : homeDescription,
  };
}
