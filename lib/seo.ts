import type { PublicJob } from './types';
import { privateListingLabel } from './types';
import { cities, cityStem } from './cities';
import { safeExternalUrl } from './vacancy-media';
import { genericCompanyKeys, logoCompanyKey } from './company-logo-identity';
import { vacancySegment } from './vacancy-navigation';
import { salaryFacts } from './salary-summary';

export const siteUrl = 'https://jobx.ge';
export const homeTitle = 'ვაკანსიები საქართველოში — სამსახურის ძებნა | JOBX';
export const homeDescription =
  'ვაკანსიები თბილისში, ბათუმში და საქართველოს სხვა ქალაქებში. მოძებნე სამსახური პროფესიის, მდებარეობის, ანაზღაურებისა და სამუშაო გრაფიკის მიხედვით.';
/* The picture a messenger shows for any page of the site, built by
   scripts/build-og-image.ts. Every page that writes its own openGraph block has
   to name it: a page-level block replaces the layout's, images and all, which is
   how vacancy and company links came to be shared with no picture at all. */
export const shareImage = {
  url: '/brand/og.png',
  width: 1200,
  height: 630,
  alt: 'JOBX',
} as const;
export const vacancyUrl = (
  job: Pick<PublicJob, 'id' | 'canonicalId'> & { title?: string },
) =>
  siteUrl +
  '/vacancies/' +
  encodeURIComponent(
    vacancySegment({ id: job.canonicalId || job.id, title: job.title }),
  );
export const jsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c');

/* The path a reader would have walked to reach this page. Google draws it in
   place of the bare URL, which on a vacancy is a uuid nobody can read. Only
   pages that exist are named: the employer step appears when the employer has a
   page of its own. */
export function breadcrumbs(trail: readonly { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: `${siteUrl}${step.path}`,
    })),
  };
}
function calendarDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '2000-01-01' &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
const htmlText = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* Only publish supported, visible facts. A private advertiser is not an invented
   hiring organization, and no vacancy is silently moved to Tbilisi.
   Where the city field names no city — a third of the catalogue: an empty field,
   a region, a village — the text is read for one, and exactly one: two different
   cities in the same posting is not a location, it is a guess, and the posting
   falls back to the country it was published in. Before this, those postings
   carried no structured data at all and could not appear in a job search. */
const namedCity = (job: PublicJob) =>
  cities.filter((c) => job.city.includes(c));
const remote = (job: PublicJob) =>
  /დისტანციურ|სამუშაო სახლიდან|remote/i.test(`${job.mode} ${job.title}`);
function citiesInText(job: PublicJob) {
  const text = `${job.title} ${job.description}`
    .normalize('NFKC')
    .toLowerCase();
  const found = cities.filter((city) =>
    new RegExp(`(^|[^ა-ჰa-z])${cityStem(city)}`).test(text),
  );
  return found.length === 1 ? found : [];
}
const place = (city: string) => ({
  '@type': 'Place',
  address: {
    '@type': 'PostalAddress',
    ...(city ? { addressLocality: city } : {}),
    addressCountry: 'GE',
  },
});
export function jobPosting(
  job: PublicJob,
  today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' }),
) {
  if (
    !job.title.trim() ||
    !job.description.trim() ||
    !calendarDate(job.datePosted) ||
    job.datePosted > today ||
    !job.company.trim() ||
    job.company === privateListingLabel ||
    genericCompanyKeys.has(logoCompanyKey(job.company)) ||
    (job.deadline && (!calendarDate(job.deadline) || job.deadline < today))
  )
    return null;
  const located = namedCity(job);
  const working = located.length ? located : citiesInText(job);
  /* A remote vacancy on a Georgian board is open to people in Georgia; that is
     the one requirement the source does support, and without it Google refuses
     a telecommute posting outright. An office city, where the posting names one,
     stays alongside it: those are the hybrid roles. */
  const telecommute = remote(job);
  const website = safeExternalUrl(job.companyProfile?.website || '');
  const logo = safeExternalUrl(job.logoUrl || '');
  const pay = salaryFacts(job.salary || '', job.salaryPeriod || '');
  const employment = (
    {
      'სრული განაკვეთი': 'FULL_TIME',
      'ნახევარი განაკვეთი': 'PART_TIME',
      სტაჟირება: 'INTERN',
    } as Record<string, string>
  )[job.employmentType || ''];
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description
      .split(/\n+/)
      .filter(Boolean)
      .map((line) => `<p>${htmlText(line)}</p>`)
      .join(''),
    datePosted: job.datePosted,
    ...(job.deadline ? { validThrough: `${job.deadline}T23:59:59+04:00` } : {}),
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      ...(website ? { sameAs: website } : {}),
      ...(logo ? { logo } : {}),
    },
    ...(telecommute
      ? {
          jobLocationType: 'TELECOMMUTE',
          applicantLocationRequirements: {
            '@type': 'Country',
            name: 'Georgia',
          },
          ...(located.length ? { jobLocation: located.map(place) } : {}),
        }
      : { jobLocation: (working.length ? working : ['']).map(place) }),
    ...(employment ? { employmentType: employment } : {}),
    /* Google prints the pay beside a job result when the posting publishes it,
       and thousands here do. Only what the board itself shows is published: one
       price, one period, read back from the label the reader sees, with
       estimates and implausible rates refused. */
    ...(pay
      ? {
          baseSalary: {
            '@type': 'MonetaryAmount',
            currency: pay.currency,
            value: {
              '@type': 'QuantitativeValue',
              ...(pay.value !== undefined ? { value: pay.value } : {}),
              ...(pay.min !== undefined ? { minValue: pay.min } : {}),
              ...(pay.max !== undefined ? { maxValue: pay.max } : {}),
              unitText: pay.unit,
            },
          },
        }
      : {}),
    url: vacancyUrl(job),
    directApply: false,
  };
}

/* What the site is, said once, on its front page. Without it a search engine
   has a list of pages and no name to attach them to; with it the brand and the
   site's own search are things it can show. */
export function siteIdentity() {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'JOBX',
      alternateName: 'jobx.ge',
      url: siteUrl + '/',
      inLanguage: 'ka-GE',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${siteUrl}/?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'JOBX',
      url: siteUrl + '/',
      logo: siteUrl + '/brand/jobx-mark.png',
      areaServed: { '@type': 'Country', name: 'Georgia' },
    },
  ];
}

/* An employer's page, as an employer and as the list of what it is hiring for.
   Three thousand of these pages carried no structured data at all: to a search
   engine they were text, and the vacancies on them belonged to nobody. */
export function employerPage(employer: {
  name: string;
  path: string;
  website?: string | null;
  logoUrl?: string | null;
  cities?: readonly string[];
  jobs: readonly { id: string; title: string; canonicalId?: string }[];
  total: number;
}) {
  const website = safeExternalUrl(employer.website || '');
  const logo = safeExternalUrl(employer.logoUrl || '');
  const url = siteUrl + employer.path;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: employer.name,
      url,
      ...(website ? { sameAs: [website] } : {}),
      ...(logo ? { logo } : {}),
      ...(employer.cities?.length
        ? {
            address: employer.cities.slice(0, 5).map((city) => ({
              '@type': 'PostalAddress',
              addressLocality: city,
              addressCountry: 'GE',
            })),
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${employer.name} — ვაკანსიები`,
      url,
      numberOfItems: employer.total,
      itemListElement: employer.jobs.slice(0, 30).map((job, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: job.title,
        url: vacancyUrl(job),
      })),
    },
  ];
}
