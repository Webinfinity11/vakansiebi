import { cities, cityStem } from './cities';
import { categories } from './types';
import type { SearchFilters } from './personal-space';

/* A search this site is willing to be found by. Readers do not look for "a job
   board"; they look for "გაყიდვების ვაკანსიები თბილისში". Those pages exist
   already as filters of the list — they were simply closed to search engines,
   every one of them, to keep the endless combinations of salary, sort and free
   text out of the index. This is the short, reviewed list that is worth opening:
   a category, a city, remote work, and their combinations, and nothing else. */
export type Landing = {
  category: string | null;
  city: string | null;
  remote: boolean;
  path: string;
};

/* Genitive forms, written out rather than derived: Georgian noun endings do not
   follow one rule, and a heading is read by people. Two of the categories are
   already adjectives and stand unchanged. */
const genitive: Record<string, string> = {
  ტექნოლოგიები: 'ტექნოლოგიების',
  გაყიდვები: 'გაყიდვების',
  მარკეტინგი: 'მარკეტინგის',
  ადმინისტრაცია: 'ადმინისტრაციის',
  ფინანსები: 'ფინანსების',
  ლოჯისტიკა: 'ლოჯისტიკის',
  მომსახურება: 'მომსახურების',
  სამედიცინო: 'სამედიცინო',
  განათლება: 'განათლების',
  მშენებლობა: 'მშენებლობის',
  დაცვა: 'დაცვის',
  წარმოება: 'წარმოების',
  იურიდიული: 'იურიდიული',
  სილამაზე: 'სილამაზის',
};
/** თბილისი → თბილისში, მცხეთა → მცხეთაში: the stem the search already uses. */
export const cityIn = (city: string) => cityStem(city) + 'ში';

export function landingPath(landing: Omit<Landing, 'path'>) {
  const params = new URLSearchParams();
  // One spelling per page: the order is fixed, so the canonical never varies.
  if (landing.category) params.set('category', landing.category);
  if (landing.city) params.set('city', landing.city);
  if (landing.remote) params.set('remote', 'true');
  return '/' + (params.size ? '?' + params : '');
}

/* The address a crawler asked for, as a landing page — or null, which means the
   list stays out of the index as it always has. */
export function landingFor(params: URLSearchParams): Landing | null {
  const allowed = new Set(['category', 'city', 'remote']);
  for (const [key, value] of params)
    if (
      !allowed.has(key) &&
      !(key === 'page' && value === '1') &&
      !key.startsWith('utm_') &&
      !['gclid', 'fbclid'].includes(key)
    )
      return null;
  const category = params.get('category');
  const city = params.get('city');
  const remote = params.get('remote');
  if (
    category !== null &&
    !(categories as readonly string[]).includes(category)
  )
    return null;
  if (city !== null && !(cities as readonly string[]).includes(city))
    return null;
  if (remote !== null && remote !== 'true') return null;
  // "სხვა" names everything the categories could not place; it describes no search.
  if (category === 'სხვა') return null;
  const landing = {
    category,
    city,
    remote: remote === 'true',
  };
  if (!landing.category && !landing.city && !landing.remote) return null;
  return { ...landing, path: landingPath(landing) };
}

/** What such a page calls itself, on the page and in a result. */
export function landingHeading(landing: Omit<Landing, 'path'>) {
  const what = landing.remote ? 'დისტანციური ვაკანსიები' : 'ვაკანსიები';
  const field = landing.category ? genitive[landing.category] + ' ' : '';
  const where = landing.city
    ? ' ' + cityIn(landing.city)
    : landing.remote
      ? ''
      : ' საქართველოში';
  return `${field}${what}${where}`;
}
export function landingDescription(landing: Omit<Landing, 'path'>) {
  return `${landingHeading(landing)} — ყველა წყარო ერთ სივრცეში, ყოველდღიური განახლებით. შეადარე პირობები და ხელფასი, გადადი პირველწყაროზე.`;
}

/** The same filters, as the board reads them. */
export function landingFilters(landing: Omit<Landing, 'path'>) {
  return {
    category: landing.category ?? 'ყველა',
    city: landing.city ?? 'ყველა',
    remote: landing.remote,
  } satisfies Partial<SearchFilters>;
}
/** Whether the list on screen is exactly this landing page, and may name itself. */
export function landingOf(filters: SearchFilters): Landing | null {
  const params = new URLSearchParams();
  if (filters.category !== 'ყველა') params.set('category', filters.category);
  if (filters.city !== 'ყველა') params.set('city', filters.city);
  if (filters.remote) params.set('remote', 'true');
  if (
    filters.query ||
    filters.source !== 'ყველა' ||
    filters.paid ||
    filters.salaryFrom !== null ||
    filters.salaryTo !== null ||
    filters.employment !== 'all' ||
    filters.entryLevel ||
    filters.deep ||
    filters.postedWithin ||
    filters.subcategory
  )
    return null;
  return landingFor(params);
}

/* The lists worth linking to from every page: each category, the cities with a
   catalogue of their own, and remote work. A crawler that never reaches a page
   cannot index it, and a sitemap alone is a weaker signal than a link a reader
   can follow. Kept to combinations that are always populated; the narrower
   pairs are discovered through the sitemap, which counts them first. */
export const linkedCities = [
  'თბილისი',
  'ბათუმი',
  'ქუთაისი',
  'რუსთავი',
  'ზუგდიდი',
  'გორი',
] as const;
export function landingLinks() {
  const links = [
    ...categories
      .filter((category) => category !== 'სხვა')
      .map((category) => ({ category, city: null, remote: false })),
    ...linkedCities.map((city) => ({ category: null, city, remote: false })),
    { category: null, city: null, remote: true },
  ];
  return links.map((landing) => ({
    path: landingPath(landing),
    label: landingHeading(landing),
  }));
}
