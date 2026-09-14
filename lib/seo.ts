import type { PublicJob } from './types';
import { privateListingLabel } from './types';
import { cities } from './cities';
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
   hiring organization; a missing city is not silently assumed to be Tbilisi. */
export function jobPosting(
  job: PublicJob,
  today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tbilisi' }),
) {
  const locations = cities.filter((city) => job.city.includes(city));
  if (
    !job.title.trim() ||
    !job.description.trim() ||
    !calendarDate(job.datePosted) ||
    job.datePosted > today ||
    !job.company.trim() ||
    job.company === privateListingLabel ||
    genericCompanyKeys.has(logoCompanyKey(job.company)) ||
    locations.length === 0 ||
    (job.deadline && (!calendarDate(job.deadline) || job.deadline < today))
  )
    return null;
  // Country restrictions for fully remote roles are not available in our source model.
  if (/დისტანციურ|სამუშაო სახლიდან|remote/i.test(job.mode + ' ' + job.title))
    return null;
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
    jobLocation: locations.map((city) => ({
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        addressCountry: 'GE',
      },
    })),
    ...(employment ? { employmentType: employment } : {}),
    url: vacancyUrl(job),
    directApply: false,
  };
}
