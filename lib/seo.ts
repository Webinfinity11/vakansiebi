import type { PublicJob } from './types';
import { privateListingLabel } from './types';
import { cities, cityStem } from './cities';
import { safeExternalUrl } from './vacancy-media';
import { genericCompanyKeys, logoCompanyKey } from './company-logo-identity';

export const siteUrl = 'https://jobx.ge';
export const vacancyUrl = (job: Pick<PublicJob, 'id' | 'canonicalId'>) =>
  `${siteUrl}/vacancies/${job.canonicalId || job.id}`;
export const jsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c');

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
    url: vacancyUrl(job),
    directApply: false,
  };
}
