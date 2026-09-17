import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowUpRight, ChevronLeft, MapPin, ExternalLink } from 'lucide-react';
import { PublicHeader } from '../../public-header';
import { CompanyLogo } from '../../company-logo';
import { ListHopLink } from '../../list-hop-link';
import { formatDate } from '../../vacancy-text';
import { db } from '@/lib/server/db';
import { publicJobs } from '@/lib/server/jobs';
import { employerPages } from '@/lib/server/employers';
import { resolveCompanyLogos } from '@/lib/server/company-logos';
import { companyKey } from '@/lib/company-key';
import { logoCompanyKey } from '@/lib/company-logo-identity';
import { vacancyCardTitle, vacancyCardSalary } from '@/lib/vacancy-card-labels';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { safeExternalUrl } from '@/lib/vacancy-media';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
import { shareImage, siteUrl as site } from '@/lib/seo';

const load = cache(async (rawSlug: string, rawPage: string) => {
  let slug = rawSlug;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {}
  const employer = (await employerPages()).bySlug.get(slug);
  if (!employer) notFound();
  const page = Math.max(1, Math.min(10000, Math.floor(Number(rawPage)) || 1));
  const [result, profile] = await Promise.all([
    publicJobs(
      new URLSearchParams({ summary: '1', page: String(page) }),
      false,
      {
        jobIds: employer.jobIds,
      },
    ),
    db()
      .query(
        `SELECT logo_url, website, description FROM company_profiles
          WHERE company_key=ANY($1) AND (website<>'' OR description<>'' OR logo_url<>'') ORDER BY updated_at DESC LIMIT 1`,
        [employer.names.map(companyKey)],
      )
      .then(
        (r) =>
          r.rows[0] as
            | { logo_url: string; website: string; description: string }
            | undefined,
      ),
  ]);
  // Vacancies can end between directory rebuilds; an employer with nothing left has no page.
  if (!result.total || page > result.pages) notFound();
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
  return { employer, result, page, profile, logoUrl: logoUrl || '' };
});

async function read(props: Props) {
  const [{ slug }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  return load(slug, typeof query.page === 'string' ? query.page : '1');
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { employer, result, page } = await read(props);
  const title = `${employer.name} — ${result.total} ვაკანსია | JOBX`;
  const description = [
    `${employer.name}-ის აქტიური ვაკანსიები`,
    employer.cities
      .slice(0, 3)
      .map((c) => c.name)
      .join(', '),
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 180);
  const path = `/companies/${encodeURIComponent(employer.slug)}`;
  const canonical = `${site}${path}${page > 1 ? `?page=${page}` : ''}`;
  return {
    title,
    description,
    alternates: { canonical },
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

export default async function CompanyPage(props: Props) {
  const { employer, result, page, profile, logoUrl } = await read(props);
  const path = `/companies/${encodeURIComponent(employer.slug)}`;
  const here = page > 1 ? `${path}?page=${page}` : path;
  const website = profile?.website ? safeExternalUrl(profile.website) : '';
  return (
    <div className="board-shell vacancy-page company-page">
      <PublicHeader />
      <main className="vacancy-page-main">
        <nav className="vacancy-breadcrumb" aria-label="გვერდის მდებარეობა">
          <Link href="/" prefetch={false}>
            <ChevronLeft size={15} aria-hidden="true" />
            ყველა ვაკანსია
          </Link>
          <span aria-hidden="true">/</span>
          <span>დამსაქმებელი</span>
        </nav>
        <section className="company-page-head" aria-labelledby="company-title">
          <div className="detail-company">
            <CompanyLogo large company={employer.name} url={logoUrl} />
            <div>
              <span>კომპანია</span>
              <h1 id="company-title">{employer.name}</h1>
            </div>
          </div>
          {employer.cities.length > 0 && (
            <p className="company-page-cities">
              <MapPin size={15} aria-hidden="true" />{' '}
              {employer.cities.map((c) => c.name).join(' · ')}
            </p>
          )}
          {(profile?.description || website) && (
            <div className="company-about">
              {profile?.description && (
                <details className="company-description">
                  <summary>კომპანიის შესახებ</summary>
                  <p>{profile.description}</p>
                </details>
              )}
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer">
                  ვებსაიტი <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}
        </section>
        <section className="similar-vacancies" aria-labelledby="company-jobs">
          <h2 id="company-jobs">
            აქტიური ვაკანსიები{' '}
            <span className="company-job-count">{result.total}</span>
          </h2>
          <div className="similar-grid">
            {result.jobs.map((job) => (
              <ListHopLink
                key={job.id}
                href={vacancyPath(job.id, { from: here })}
                from={here}
                className="similar-card"
              >
                <h3 title={job.title}>
                  {vacancyCardTitle(job.title, job.source)}
                </h3>
                {vacancyCardSalary(
                  job.salary,
                  job.salaryPeriod,
                  job.source,
                ) && (
                  <span className="similar-salary">
                    {vacancyCardSalary(
                      job.salary,
                      job.salaryPeriod,
                      job.source,
                    )}
                  </span>
                )}
                <div className="company-job-meta">
                  {job.city && (
                    <span>
                      <MapPin size={14} aria-hidden="true" />
                      {job.city}
                    </span>
                  )}
                  {job.deadline && (
                    <time dateTime={job.deadline}>
                      ვადა: {formatDate(job.deadline)}
                    </time>
                  )}
                </div>
                <ArrowUpRight
                  className="company-job-arrow"
                  size={18}
                  aria-hidden="true"
                />
              </ListHopLink>
            ))}
          </div>
          {result.pages > 1 && (
            <nav className="company-page-pages" aria-label="გვერდები">
              {page > 1 ? (
                <Link
                  className="secondary-button"
                  href={page === 2 ? path : `${path}?page=${page - 1}`}
                  prefetch={false}
                >
                  წინა
                </Link>
              ) : (
                <span />
              )}
              <span>
                {page} / {result.pages}
              </span>
              {page < result.pages ? (
                <Link
                  className="secondary-button"
                  href={`${path}?page=${page + 1}`}
                  prefetch={false}
                >
                  შემდეგი
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </main>
    </div>
  );
}
