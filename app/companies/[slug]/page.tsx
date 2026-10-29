import { UiText } from '@/app/ui-language';
import { ServerSiteFooter } from '../../server-site-footer';
import type { Metadata } from 'next';
import { siteName } from '@/lib/site-brand';
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
import { employerPages, employerPageSuppressed } from '@/lib/server/employers';
import { similarVacancies } from '@/lib/server/similar-vacancies';
import type { PublicJob } from '@/lib/types';
import { verifiedCompanyInfo } from '@/lib/server/verified-company-info';
import { resolveCompanyLogos } from '@/lib/server/company-logos';
import { companyKey } from '@/lib/company-key';
import { companyVacancyTitle } from '@/lib/company-vacancy-title';
import { companyOverview } from '@/lib/company-overview';
import {
  companyFilters,
  companyResultsPath,
  companyFilterKeys,
} from '@/lib/company-filters';
import { CompanyFilters } from './company-filters';
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
  const filtered = !!(
    filters.query ||
    filters.city ||
    filters.category ||
    filters.paid ||
    filters.sort !== 'new'
  );
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
  if (!employer || (await employerPageSuppressed(employer))) notFound();
  const [result, profile] = await Promise.all([
    publicJobs(
      new URLSearchParams({
        summary: '1',
        page: String(page),
        q: filters.query,
        city: filters.city,
        category: filters.category,
        sort: filters.sort,
        paid: String(filters.paid),
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
  if (page > 1 && page > result.pages) notFound();
  // A filtered empty result is not evidence that the company stopped hiring.
  const activeTotal = filtered
    ? (
        await publicJobs(new URLSearchParams({ summary: '1' }), false, {
          jobIds: employer.jobIds,
        })
      ).total
    : result.total;
  const similar =
    activeTotal === 0
      ? await similarVacancies({
          ...employer.example,
          description: '',
          id: employer.jobIds[0],
        } as PublicJob)
      : [];
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
    activeTotal,
    similar,
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
  for (const key of companyFilterKeys) {
    const value = query[key];
    if (typeof value === 'string') params.set(key, value);
  }
  return load(slug, params.toString());
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { employer, result, page, filtered, activeTotal } = await read(props);
  const heading = companyVacancyTitle(employer.name);
  const title = `${heading}${page > 1 ? ` — გვერდი ${page}` : ''} | ${siteName}`;
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
    robots: { index: !filtered && activeTotal > 0, follow: true },
    openGraph: {
      images: [shareImage],
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'ka_GE',
      siteName,
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
  const {
    employer,
    result,
    page,
    filters,
    filtered,
    profile,
    logoUrl,
    today,
    activeTotal,
    similar,
  } = await read(props);
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
            <UiText>{'ვაკანსიები'}</UiText>
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/companies" prefetch={false}>
            <UiText>{'კომპანიები'}</UiText>
          </Link>
        </nav>
        <section className="company-page-head" aria-labelledby="company-title">
          <div className="detail-company">
            <CompanyLogo large company={employer.name} url={logoUrl} />
            <div>
              <span>
                <UiText>{'კომპანია'}</UiText>
              </span>
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
                  <h2>
                    <UiText>{'კომპანიის შესახებ'}</UiText>
                  </h2>
                  <p>{overview.summary}</p>
                  {profile.descriptionSource && (
                    <a
                      href={profile.descriptionSource}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <UiText>{'ოფიციალური წყარო'}</UiText>
                    </a>
                  )}
                  {overview.full && (
                    <details className="company-description">
                      <summary>
                        <ChevronDown aria-hidden="true" />
                        <UiText>{'სრულად წაკითხვა'}</UiText>
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
                  <UiText>{'ვებსაიტი'}</UiText>
                </a>
              )}
            </div>
          )}
        </section>
        <section className="similar-vacancies" aria-labelledby="company-jobs">
          {activeTotal > 0 && (
            <CompanyFilters
              key={here}
              path={path}
              filters={filters}
              cities={employer.cities.map((city) => city.name)}
              filtered={filtered}
            />
          )}
          <h2 id="company-jobs">
            {filtered ? (
              <UiText>ძიების შედეგები</UiText>
            ) : (
              <UiText>აქტიური ვაკანსიები</UiText>
            )}{' '}
            <span className="ds-badge ds-badge--accent company-count">
              {result.total}
            </span>
          </h2>
          {!result.total && (
            <output className="company-jobs-empty">
              <UiText>
                {activeTotal === 0
                  ? 'კომპანიას ახლა აქტიური ვაკანსია არ აქვს.'
                  : 'ამ ფილტრებით ვაკანსია ვერ მოიძებნა. შეცვალე ძიება ან გაასუფთავე ფილტრები.'}
              </UiText>
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
                            <UiText>{'ბოლო ვადა '}</UiText>
                            {formatDate(job.deadline)}
                          </time>
                        )}
                      </span>
                    </span>
                    <span className="company-job-side">
                      {salary && <b>{salary}</b>}
                      {left !== null && left >= 0 && left <= 3 ? (
                        <span className="ds-badge ds-badge--warning">
                          {left === 0 ? (
                            <UiText>ბოლო დღე</UiText>
                          ) : (
                            `${left} დღე დარჩა`
                          )}
                        </span>
                      ) : (
                        fresh !== null &&
                        fresh <= 2 && (
                          <span className="ds-badge ds-badge--accent">
                            <UiText>{'ახალი'}</UiText>
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
                  <UiText>{'წინა'}</UiText>
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
                  <UiText>{'შემდეგი'}</UiText>
                  <ChevronRight aria-hidden="true" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
        {activeTotal === 0 && (
          <section
            className="similar-vacancies"
            aria-labelledby="similar-title"
          >
            <h2 id="similar-title">
              <UiText>მსგავსი ვაკანსიები</UiText>
            </h2>
            {similar.length ? (
              <div className="similar-grid">
                {similar.map(({ job, reasons }) => (
                  <ListHopLink
                    key={job.id}
                    href={vacancyPath(job, { from: here })}
                    from={here}
                    event="open_similar"
                    className="similar-card"
                  >
                    <div className="similar-company">
                      <CompanyLogo company={job.company} url={job.logoUrl} />
                      <span>{job.company}</span>
                    </div>
                    <h3>{vacancyCardTitle(job.title, job.source)}</h3>
                    <p>{reasons.join(' · ')}</p>
                    <span className="similar-open">
                      <UiText>ვაკანსიის ნახვა</UiText>
                    </span>
                  </ListHopLink>
                ))}
              </div>
            ) : (
              <p>
                <UiText>
                  ამ ეტაპზე მსგავსი აქტიური ვაკანსია ვერ მოიძებნა.
                </UiText>
              </p>
            )}
            <Link href="/" prefetch={false}>
              <UiText>ვაკანსიების ნახვა</UiText>
            </Link>
          </section>
        )}
      </main>
      <ServerSiteFooter />
    </div>
  );
}
