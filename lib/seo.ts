import type { PublicJob } from './types';
import { privateListingLabel } from './types';
import { cities, cityStem } from './cities';
import { tbilisiDistricts } from './street-address';
import { safeExternalUrl } from './vacancy-media';
import { isGenericCompanyName } from './company-logo-identity';
import { companyVacancyTitle } from './company-vacancy-title';
import { vacancySegment } from './vacancy-navigation';
import { salaryFacts } from './salary-summary';
import { vacancySummary } from './vacancy-summary';

export const siteUrl = 'https://jobx.ge';
export const homeTitle = 'ვაკანსიები საქართველოში — სამსახურის ძებნა | JOBX';
export const homeDescription =
  'ვაკანსიები თბილისში, ბათუმში, ქუთაისსა და სხვა ქალაქებში. მოძებნე სამსახური პროფესიის, ხელფასისა და გრაფიკის მიხედვით, დისტანციურადაც.';
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
/* A Tbilisi district with no town beside it ("ვაკე, ჭავჭავაძის 74გ") names Tbilisi. */
const districtOnly = (city: string) =>
  tbilisiDistricts.some((d) =>
    new RegExp(`(^|[^ა-ჰ])${d.endsWith('ი') ? d.slice(0, -1) : d}`).test(city),
  );
const namedCity = (job: PublicJob) => {
  const named = cities.filter((c) => job.city.includes(c));
  return named.length || !districtOnly(job.city) ? named : ['თბილისი'];
};
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
/* The region each offered city lies in: a fact of geography, not of the posting. */
const regions: Record<string, string> = {
  თბილისი: 'თბილისი',
  ბათუმი: 'აჭარა',
  ქუთაისი: 'იმერეთი',
  რუსთავი: 'ქვემო ქართლი',
  გორი: 'შიდა ქართლი',
  ზუგდიდი: 'სამეგრელო-ზემო სვანეთი',
  ფოთი: 'სამეგრელო-ზემო სვანეთი',
  თელავი: 'კახეთი',
  კასპი: 'შიდა ქართლი',
  მცხეთა: 'მცხეთა-მთიანეთი',
  ახალციხე: 'სამცხე-ჯავახეთი',
  ბორჯომი: 'სამცხე-ჯავახეთი',
  ოზურგეთი: 'გურია',
};
/* Towns and resorts outside the filter list, with their region. A posting's
   city field names them plainly ("ქობულეთი", "გურია >> ურეკი"), and before this
   they were dropped: a vacancy in Kobuleti told Google only "Georgia". */
const towns: Record<string, string> = {
  მარნეული: 'ქვემო ქართლი',
  ბოლნისი: 'ქვემო ქართლი',
  გარდაბანი: 'ქვემო ქართლი',
  თეთრიწყარო: 'ქვემო ქართლი',
  დმანისი: 'ქვემო ქართლი',
  წალკა: 'ქვემო ქართლი',
  ყვარელი: 'კახეთი',
  გურჯაანი: 'კახეთი',
  საგარეჯო: 'კახეთი',
  ახმეტა: 'კახეთი',
  დედოფლისწყარო: 'კახეთი',
  სიღნაღი: 'კახეთი',
  წნორი: 'კახეთი',
  ლაგოდეხი: 'კახეთი',
  ხაშური: 'შიდა ქართლი',
  ქარელი: 'შიდა ქართლი',
  დუშეთი: 'მცხეთა-მთიანეთი',
  გუდაური: 'მცხეთა-მთიანეთი',
  ყაზბეგი: 'მცხეთა-მთიანეთი',
  სტეფანწმინდა: 'მცხეთა-მთიანეთი',
  თიანეთი: 'მცხეთა-მთიანეთი',
  ჟინვალი: 'მცხეთა-მთიანეთი',
  ზესტაფონი: 'იმერეთი',
  სამტრედია: 'იმერეთი',
  წყალტუბო: 'იმერეთი',
  ხონი: 'იმერეთი',
  ვანი: 'იმერეთი',
  თერჯოლა: 'იმერეთი',
  საჩხერე: 'იმერეთი',
  ჭიათურა: 'იმერეთი',
  ტყიბული: 'იმერეთი',
  ბაღდათი: 'იმერეთი',
  ხარაგაული: 'იმერეთი',
  ქობულეთი: 'აჭარა',
  ხელვაჩაური: 'აჭარა',
  ხულო: 'აჭარა',
  ქედა: 'აჭარა',
  შუახევი: 'აჭარა',
  ჩაქვი: 'აჭარა',
  გონიო: 'აჭარა',
  სარფი: 'აჭარა',
  ციხისძირი: 'აჭარა',
  მახინჯაური: 'აჭარა',
  ლანჩხუთი: 'გურია',
  ურეკი: 'გურია',
  შეკვეთილი: 'გურია',
  სენაკი: 'სამეგრელო-ზემო სვანეთი',
  მარტვილი: 'სამეგრელო-ზემო სვანეთი',
  ხობი: 'სამეგრელო-ზემო სვანეთი',
  წალენჯიხა: 'სამეგრელო-ზემო სვანეთი',
  ჩხოროწყუ: 'სამეგრელო-ზემო სვანეთი',
  აბაშა: 'სამეგრელო-ზემო სვანეთი',
  ანაკლია: 'სამეგრელო-ზემო სვანეთი',
  მესტია: 'სამეგრელო-ზემო სვანეთი',
  ბაკურიანი: 'სამცხე-ჯავახეთი',
  ახალქალაქი: 'სამცხე-ჯავახეთი',
  ადიგენი: 'სამცხე-ჯავახეთი',
  ასპინძა: 'სამცხე-ჯავახეთი',
  ნინოწმინდა: 'სამცხე-ჯავახეთი',
  ამბროლაური: 'რაჭა-ლეჩხუმი და ქვემო სვანეთი',
  ონი: 'რაჭა-ლეჩხუმი და ქვემო სვანეთი',
  ცაგერი: 'რაჭა-ლეჩხუმი და ქვემო სვანეთი',
  ლენტეხი: 'რაჭა-ლეჩხუმი და ქვემო სვანეთი',
};
/* A city field that names only a region still says where the work is. */
const regionNames: Record<string, string> = {
  იმერეთი: 'იმერეთი',
  კახეთი: 'კახეთი',
  გურია: 'გურია',
  აჭარა: 'აჭარა',
  'აჭარის ავტონომიური რესპუბლიკა': 'აჭარა',
  'სამცხე-ჯავახეთი': 'სამცხე-ჯავახეთი',
  'სამეგრელო-ზემო სვანეთი': 'სამეგრელო-ზემო სვანეთი',
  სამეგრელო: 'სამეგრელო-ზემო სვანეთი',
  'ზემო სვანეთი': 'სამეგრელო-ზემო სვანეთი',
  'ქვემო ქართლი': 'ქვემო ქართლი',
  'შიდა ქართლი': 'შიდა ქართლი',
  'მცხეთა-მთიანეთი': 'მცხეთა-მთიანეთი',
  'რაჭა-ლეჩხუმი და ქვემო სვანეთი': 'რაჭა-ლეჩხუმი და ქვემო სვანეთი',
};
const wordIn = (text: string, word: string) =>
  new RegExp(`(^|[^ა-ჰ])${word}($|[^ა-ჰ])`).test(text);
// Exactly one town in the field; two is not a place, it is a guess.
const townsIn = (city: string) => {
  const found = Object.keys(towns).filter((town) => wordIn(city, town));
  return found.length === 1 ? found : [];
};
/* A street address is published only when the posting states one for a single workplace:
   something with a street word or a house number, never a bare city or a region. */
const streetAddress = (value: string) =>
  value.length <= 160 &&
  /(ქუჩ|გამზირ|ხეივან|შესახვევ|ჩიხ|მოედან|გზატკეცილ|დასახლებ|\d)/u.test(value)
    ? value
    : '';
const place = (city: string, street = '', region = '') => {
  const addressRegion = regions[city] || towns[city] || region;
  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      ...(street ? { streetAddress: street } : {}),
      ...(city ? { addressLocality: city } : {}),
      ...(addressRegion ? { addressRegion } : {}),
      addressCountry: 'GE',
    },
  };
};
/* Employment type as the posting states it, in any of the spellings sources use. Nothing is
   assumed: a posting that says nothing gets no type. */
function employmentOf(job: PublicJob): string {
  const text = `${job.employmentType || ''} ${job.title}`
    .normalize('NFKC')
    .toLowerCase();
  if (/სტაჟიორ|სტაჟირებ|\bintern(ship)?\b/u.test(text)) return 'INTERN';
  if (
    /(ნახევარი?|არასრული?|ნაწილობრივი?|½|1\/2)\s*განაკვეთ|part[ -]?time/u.test(
      text,
    )
  )
    return 'PART_TIME';
  if (
    /(დღიური|ერთდღიანი|ერთჯერადი)\s+(სამუშაო|მუშა|მშრომელ)|დროებით/u.test(text)
  )
    return 'TEMPORARY';
  if (/სრული\s+განაკვეთ|full[ -]?time/u.test(text)) return 'FULL_TIME';
  return '';
}
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
    isGenericCompanyName(job.company) ||
    (job.deadline && (!calendarDate(job.deadline) || job.deadline < today))
  )
    return null;
  const located = namedCity(job);
  // Explicit work-address facts can name several valid locations. Do not infer
  // multiple workplaces from incidental city mentions elsewhere in the text.
  const address =
    vacancySummary(job).find((item) => item.label === 'მისამართი')?.value || '';
  const addressCities = cities.filter((city) =>
    new RegExp(`(^|[^ა-ჰa-z])${cityStem(city)}`).test(
      address.normalize('NFKC').toLowerCase(),
    ),
  );
  const town = townsIn(job.city.normalize('NFKC').trim());
  const working = located.length
    ? located
    : town.length
      ? town
      : addressCities.length
        ? addressCities
        : citiesInText(job);
  /* A remote vacancy on a Georgian board is open to people in Georgia; that is
     the one requirement the source does support, and without it Google refuses
     a telecommute posting outright. An office city, where the posting names one,
     stays alongside it: those are the hybrid roles. */
  const telecommute = remote(job);
  const website = safeExternalUrl(job.companyProfile?.website || '');
  const logo = safeExternalUrl(job.logoUrl || '');
  const pay = salaryFacts(job.salary || '', job.salaryPeriod || '');
  const employment = employmentOf(job);
  const street = working.length === 1 ? streetAddress(address) : '';
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
          ...(located.length
            ? { jobLocation: located.map((city) => place(city)) }
            : {}),
        }
      : {
          jobLocation: (working.length ? working : ['']).map((city) =>
            place(
              city,
              street,
              city
                ? ''
                : (regionNames[job.city.normalize('NFKC').trim()] ?? ''),
            ),
          ),
        }),
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
  description?: string | null;
  path: string;
  website?: string | null;
  logoUrl?: string | null;
  cities?: readonly string[];
  jobs: readonly { id: string; title: string; canonicalId?: string }[];
  total: number;
  /** Vacancies on the pages before this one, so page two's list does not start again at 1. */
  offset?: number;
}) {
  const website = safeExternalUrl(employer.website || '');
  const logo = safeExternalUrl(employer.logoUrl || '');
  const url = siteUrl + employer.path;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: employer.name,
      ...(employer.description?.trim()
        ? { description: employer.description.trim() }
        : {}),
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
      name: companyVacancyTitle(employer.name),
      url,
      numberOfItems: employer.total,
      itemListElement: employer.jobs.slice(0, 30).map((job, index) => ({
        '@type': 'ListItem',
        position: (employer.offset || 0) + index + 1,
        name: job.title,
        url: vacancyUrl(job),
      })),
    },
  ];
}

/* The companies page: a collection of employer pages, each named with the page it links to. */
export function companiesCollection(
  employers: readonly { slug: string; name: string }[],
) {
  const url = `${siteUrl}/companies`;
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'კომპანიები',
    url,
    inLanguage: 'ka-GE',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: employers.length,
      itemListElement: employers.slice(0, 100).map((employer, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: companyVacancyTitle(employer.name),
        url: `${url}/${encodeURIComponent(employer.slug)}`,
      })),
    },
  };
}
