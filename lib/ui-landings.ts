import { landingFor, type Landing } from './seo-landing';
import { subcategoryFor } from './subcategories';
import { translateUi } from './ui-language';
import type { SearchFilters } from './personal-space';

const en = (text: string) => translateUi(text, 'en');
const conditions: Record<string, string> = {
  remote: 'Remote',
  daily: 'Daily pay',
  entry: 'No experience required',
  paid: 'Salary listed',
  'part-time': 'Part-time',
  internship: 'Internship',
};

export function englishLandingHeading(
  landing: Pick<
    Landing,
    'category' | 'city' | 'trait' | 'role' | 'subcategory'
  >,
) {
  const sub =
    landing.subcategory && landing.category
      ? subcategoryFor(landing.category, landing.subcategory)
      : null;
  const subject = sub?.label || landing.role || landing.category;
  const title = subject ? `${en(subject)} jobs` : 'Jobs';
  return `${title}${landing.city ? ` in ${en(landing.city)}` : ' in Georgia'}${landing.trait ? ` · ${conditions[landing.trait]}` : ''}`;
}

export function englishLandingLink(path: string, fallback: string) {
  const landing = path.startsWith('/?')
    ? landingFor(new URLSearchParams(path.slice(2)))
    : null;
  return landing ? englishLandingHeading(landing) : en(fallback);
}

export function englishSearchHeading(filters: SearchFilters) {
  const subcategory = filters.subcategory
    ? subcategoryFor(filters.category, filters.subcategory)
    : null;
  const category = filters.category !== 'ყველა' ? filters.category : '';
  const subject = subcategory?.label || category;
  const query = filters.query.trim();
  const traits = [
    filters.remote && 'Remote',
    filters.salaryPeriod === 'day' && 'Daily pay',
    filters.paid && 'Salary listed',
    filters.entryLevel && 'No experience required',
    filters.employment !== 'all' &&
      {
        'part-time': 'Part-time',
        internship: 'Internship',
        daily: 'Daily / one-off work',
      }[filters.employment],
  ].filter(Boolean);
  if (
    !subject &&
    !query &&
    filters.city === 'ყველა' &&
    !traits.length &&
    filters.salaryFrom === null
  )
    return null;
  const title = query
    ? `Jobs matching “${en(query)}”`
    : subject
      ? `${en(subject)} jobs`
      : 'Jobs';
  return `${title} in ${filters.city === 'ყველა' ? 'Georgia' : en(filters.city)}${traits.length ? ` · ${traits.join(' · ')}` : ''}${filters.salaryFrom !== null ? ` · From ₾${filters.salaryFrom}` : ''}`;
}
