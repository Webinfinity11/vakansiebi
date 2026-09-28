import { ServerSiteFooter } from '../../server-site-footer';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Globe2,
  MapPin,
} from 'lucide-react';
import { PublicHeader } from '../../public-header';
import { CompanyLogo } from '../../company-logo';
import { ListHopLink } from '../../list-hop-link';
import { TrackOnce } from '../../track-once';
import { formatDate } from '../../vacancy-text';
import { db } from '@/lib/server/db';
import { publicJobs } from '@/lib/server/jobs';
import { employerPages } from '@/lib/server/employers';
import { verifiedCompanyInfo } from '@/lib/server/verified-company-info';
import { resolveCompanyLogos } from '@/lib/server/company-logos';
import { companyKey } from '@/lib/company-key';
import { companyVacancyTitle } from '@/lib/company-vacancy-title';
import { companyOverview } from '@/lib/company-overview';
import { companyFilters, companyResultsPath } from '@/lib/company-filters';
import { logoCompanyKey } from '@/lib/company-logo-identity';
import { vacancyCardTitle, vacancyCardSalary } from '@/lib/vacancy-card-labels';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { safeExternalUrl } from '@/lib/vacancy-media';
import { listPageSize } from '@/lib/search-state';
import './company.css';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
import {
  breadcrumbs,
  employerPage,
  jsonLd,
  shareImage,
  siteUrl as site,
} from '@/lib/seo';

const load = cache(async (rawSlug: string, rawQuery: string) => {
  const filters = companyFilters(new URLSearchParams(rawQuery));
  const { page } = filters;
  const filtered = !!(filters.query || filters.city);
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {}
  const directory = await employerPages();
  const canonicalSlug = directory.aliases.get(slug);
  if (canonicalSlug) {
    permanentRedirect(
      companyResultsPath(
        `/companies/${encodeURIComponent(canonicalSlug)}`,
        filters,
      ),
    );
  }
  const employer = directory.bySlug.get(slug);
  if (!employer) notFound();
  const [result, profile] = await Promise.all([
    publicJobs(
      new URLSearchParams({
        summary: '1',
        page: String(page),
        q: filters.query,
        city: filters.city,
      }),
      false,
      {
        jobIds: employer.jobIds,
      },
    ),
    /* Each field from the newest profile that has it: an employer spelt two ways can have its
       logo saved under one spelling and its website under the other, and the companies list
       already shows that logo. Taking one whole row lost the logo here. */
    db()
      .query(
        `SELECT logo_url, website, description FROM company_profiles
          WHERE company_key=ANY($1) AND (website<>'' OR description<>'' OR logo_url<>'') ORDER BY updated_at DESC`,
        [employer.names.map(companyKey)],
      )
      .then((r) => {
        const rows = r.rows as {
          logo_url: string;
          website: string;
          description: string;
        }[];
        if (!rows.length) return undefined;
        const pick = (field: keyof (typeof rows)[number]) =>
          rows.find((row) => row[field]?.trim())?.[field].trim() || '';
        return {
          logo_url: pick('logo_url'),
          website: pick('website'),
          description: pick('description'),
        };
      }),
  ]);
  // Vacancies can end between directory rebuilds; an employer with nothing left has no page.
  if ((!filtered && !result.total) || (page > 1 && page > result.pages))
    notFound();
  // Same priority as a vacancy card: an admin's own logo first, then one a source embedded on a
  // current vacancy, then one shared from another spelling of this employer. Only the last of
  // these needs its own query, and only when the first two found nothing.
  let logoUrl = profile?.logo_url || employer.logoUrl;
  if (!logoUrl) {
    const shared = await resolveCompanyLogos(employer.names);
    for (const name of employer.names) {
      const match = shared.get(logoCompanyKey(name));
      if (match) {
        logoUrl = match.logoUrl;
        break;
      }
    }
  }
  // Tbilisi's date, for the "new" and "ends soon" marks on the list.
  const today = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'Asia/Tbilisi',
  });
  const verified = verifiedCompanyInfo(employer.names);
  return {
    employer,
    result,
    page,
    filters,
    filtered,
    profile: {
      ...profile,
      website: profile?.website || verified?.website || '',
      description: profile?.description || verified?.description || '',
      descriptionSource: profile?.description ? null : verified?.source,
    },
    logoUrl: logoUrl || '',
    today,
  };
});

async function read(props: Props) {
  const [{ slug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const params = new URLSearchParams();
  for (const key of ['q', 'city', 'page']) {
    const value = query[key];
    if (typeof value === 'string') params.set(key, value);
  }
  return load(slug, params.toString());
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { employer, result, page, filtered } = await read(props);
  const heading = companyVacancyTitle(employer.name);
  const title = `${heading}${page > 1 ? ` — გვერდი ${page}` : ''} | JOBX`;
  const description = [
    `${heading}: ${result.total} აქტიური განცხადება`,
    employer.cities
      .slice(0, 3)
      .map((c) => c.name)
      .join(', '),
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 180);
  const path = `/companies/${encodeURIComponent(employer.slug)}`;
  const canonical = `${site}${path}${!filtered && page > 1 ? `?page=${page}` : ''}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: !filtered, follow: true },
    openGraph: {
      images: [shareImage],
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'ka_GE',
    },
  };
}

/** Whole days from one YYYY-MM-DD date to a later one; null when either is missing. */
function daysFrom(later: string, earlier: string) {
  const a = Date.parse(later);
  const b = Date.parse(earlier);
  return Number.isNaN(a) || Number.isNaN(b)
    ? null
    : Math.round((a - b) / 86_400_000);
}

export default async function CompanyPage(props: Props) {
  const { employer, result, page, filters, filtered, profile, logoUrl, today } =
    await read(props);
  const path = `/companies/${encodeURIComponent(employer.slug)}`;
  const here = companyResultsPath(path, filters);
  const website = profile?.website ? safeExternalUrl(profile.website) : '';
  const overview = companyOverview(profile?.description);
  return (
    <div className="board-shell vacancy-page company-page">
      {/* The employer, and what it is hiring for. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd([
            ...employerPage({
              name: employer.name,
              path: here,
              website,
              description: profile?.description,
              logoUrl,
              cities: employer.cities.map((c) => c.name),
              jobs: result.jobs,
              total: result.total,
              offset: (page - 1) * listPageSize,
            }),
            breadcrumbs([
              { name: 'ვაკანსიები', path: '/' },
              { name: 'კომპანიები', path: '/companies' },
              { name: companyVacancyTitle(employer.name), path: here },
            ]),
          ]),
        }}
      />
      <PublicHeader />
      <TrackOnce code="company_page" />
      <main className="vacancy-page-main">
        <nav className="vacancy-breadcrumb" aria-label="გვერდის მდებარეობა">
          <Link href="/" prefetch={false}>
            <ChevronLeft size={16} aria-hidden="true" />
            ყველა ვაკანსია
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/companies" prefetch={false}>
            კომპანიები
          </Link>
        </nav>
        <section className="company-page-head" aria-labelledby="company-title">
          <div className="detail-company">
            <CompanyLogo large company={employer.name} url={logoUrl} />
            <div>
              <span>კომპანია</span>
              <h1 id="company-title">{companyVacancyTitle(employer.name)}</h1>
            </div>
          </div>
          {employer.cities.length > 0 && (
            <p className="company-page-cities">
              <MapPin size={14} aria-hidden="true" />
              {employer.cities
                .slice(0, 8)
                .map((c) => c.name)
                .join(' · ')}
            </p>
          )}
          {(overview || website) && (
            <div className="company-about">
              {overview && (
                <div className="company-overview">
                  <h2>კომპანიის შესახებ</h2>
                  <p>{overview.summary}</p>
                  {profile.descriptionSource && (
                    <a
                      href={profile.descriptionSource}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ოფიციალური წყარო
                    </a>
                  )}
                  {overview.full && (
                    <details className="company-description">
                      <summary>
                        <ChevronDown aria-hidden="true" />
                        სრულად წაკითხვა
                      </summary>
                      <p>{overview.full}</p>
                    </details>
                  )}
                </div>
              )}
              {website && (
                <a
                  className="ds-btn ds-btn--secondary ds-btn--sm company-website"
                  href={website}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Globe2 aria-hidden="true" />
                  ვებსაიტი
                </a>
              )}
            </div>
          )}
        </section>
        <section className="similar-vacancies" aria-labelledby="company-jobs">
          <search aria-label="კომპანიის ვაკანსიების ძიება">
            <form action={path} method="get" className="company-filters">
              <label>
                <span>ვაკანსიის ძიება</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={filters.query}
                  maxLength={200}
                  placeholder="მაგ. მოლარე, მენეჯერი"
                />
              </label>
              <label>
                <span>ქალაქი</span>
                <select name="city" defaultValue={filters.city}>
                  <option value="">ყველა ქალაქი</option>
                  {[
                    ...new Set([
                      ...employer.cities.map((city) => city.name),
                      ...(filters.city ? [filters.city] : []),
                    ]),
                  ].map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="ds-btn ds-btn--primary">
                ძებნა
              </button>
              {filtered && (
                <Link
                  href={path}
                  prefetch={false}
                  className="ds-btn ds-btn--secondary"
                >
                  გასუფთავება
                </Link>
              )}
            </form>
          </search>
          <h2 id="company-jobs">
            {filtered ? 'ძიების შედეგები' : 'აქტიური ვაკანსიები'}{' '}
            <span className="ds-badge ds-badge--accent company-count">
              {result.total}
            </span>
          </h2>
          {!result.total && (
            <output>
              ამ ფილტრებით ვაკანსია ვერ მოიძებნა. შეცვალე ძიება ან გაასუფთავე
              ფილტრები.
            </output>
          )}
          <ul className="company-jobs">
            {result.jobs.map((job) => {
              const salary = vacancyCardSalary(
                job.salary,
                job.salaryPeriod,
                job.source,
              );
              const fresh = daysFrom(today, job.datePosted ?? '');
              const left = daysFrom(job.deadline ?? '', today);
              return (
                <li key={job.id}>
                  <ListHopLink
                    href={vacancyPath(job, { from: here })}
                    from={here}
                    event="open_company"
                    className="company-job"
                  >
                    <span className="company-job-main">
                      <h3 title={job.title}>
                        {vacancyCardTitle(job.title, job.source)}
                      </h3>
                      <span className="company-job-meta">
                        {job.city && (
                          <span>
                            <MapPin size={14} aria-hidden="true" />
                            {job.city}
                          </span>
                        )}
                        {job.deadline && (
                          <time dateTime={job.deadline}>
                            ბოლო ვადა {formatDate(job.deadline)}
                          </time>
                        )}
                      </span>
                    </span>
                    <span className="company-job-side">
                      {salary && <b>{salary}</b>}
                      {left !== null && left >= 0 && left <= 3 ? (
                        <span className="ds-badge ds-badge--warning">
                          {left === 0 ? 'ბოლო დღე' : `${left} დღე დარჩა`}
                        </span>
                      ) : (
                        fresh !== null &&
                        fresh <= 2 && (
                          <span className="ds-badge ds-badge--accent">
                            ახალი
                          </span>
                        )
                      )}
                    </span>
                  </ListHopLink>
                </li>
              );
            })}
          </ul>
          {result.pages > 1 && (
            <nav className="company-page-pages" aria-label="გვერდები">
              {page > 1 ? (
                <Link
                  className="secondary-button"
                  href={companyResultsPath(path, filters, page - 1)}
                  prefetch={false}
                >
                  <ChevronLeft aria-hidden="true" />
                  წინა
                </Link>
              ) : (
                <span />
              )}
              <span className="company-page-count">
                {page} / {result.pages}
              </span>
              {page < result.pages ? (
                <Link
                  className="secondary-button"
                  href={companyResultsPath(path, filters, page + 1)}
                  prefetch={false}
                >
                  შემდეგი
                  <ChevronRight aria-hidden="true" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </main>
      <ServerSiteFooter />
    </div>
  );
}
