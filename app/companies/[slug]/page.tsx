import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowLeft, ArrowUpRight, ExternalLink } from 'lucide-react';
import { Brand } from '../../brand';
import { ThemeToggle } from '../../theme-toggle';
import { CompanyLogo } from '../../company-logo';
import { db } from '@/lib/server/db';
import { publicJobs } from '@/lib/server/jobs';
import { employerPages } from '@/lib/server/employers';
import { companyKey } from '@/lib/company-key';
import { compactSalary } from '@/lib/vacancy-presentation';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { safeExternalUrl } from '@/lib/vacancy-media';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const site = 'https://vakansiebi-gules.vercel.app';

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
        `SELECT website, description FROM company_profiles
          WHERE company_key=ANY($1) AND (website<>'' OR description<>'') ORDER BY updated_at DESC LIMIT 1`,
        [employer.names.map(companyKey)],
      )
      .then(
        (r) =>
          r.rows[0] as { website: string; description: string } | undefined,
      ),
  ]);
  // Vacancies can end between directory rebuilds; an employer with nothing left has no page.
  if (!result.total || page > result.pages) notFound();
  return { employer, result, page, profile };
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
  const title = `${employer.name} — ${result.total} ვაკანსია | ერთად`;
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
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'ka_GE',
    },
  };
}

export default async function CompanyPage(props: Props) {
  const { employer, result, page, profile } = await read(props);
  const path = `/companies/${encodeURIComponent(employer.slug)}`;
  const here = page > 1 ? `${path}?page=${page}` : path;
  const website = profile?.website ? safeExternalUrl(profile.website) : '';
  return (
    <div className="board-shell vacancy-page company-page">
      <header className="topbar">
        <div className="header-inner">
          <Brand />
          <ThemeToggle />
          <Link className="vacancy-header-link" href="/" prefetch={false}>
            <ArrowLeft size={16} />
            <span className="back-label-full">ყველა ვაკანსია</span>
            <span className="back-label-short">ყველა</span>
          </Link>
        </div>
      </header>
      <main className="vacancy-page-main">
        <nav className="vacancy-breadcrumb" aria-label="გვერდის მდებარეობა">
          <Link href="/" prefetch={false}>
            ვაკანსიები
          </Link>
          <span aria-hidden="true">/</span>
          <span>დამსაქმებელი</span>
        </nav>
        <section className="company-page-head" aria-labelledby="company-title">
          <div className="detail-company">
            <CompanyLogo large company={employer.name} url={employer.logoUrl} />
            <div>
              <span>{result.total} აქტიური ვაკანსია</span>
              <h1 id="company-title">{employer.name}</h1>
            </div>
          </div>
          {employer.cities.length > 0 && (
            <p className="company-page-cities">
              {employer.cities.map((c) => c.name).join(' · ')}
            </p>
          )}
          {(profile?.description || website) && (
            <div className="company-about">
              {profile?.description && <p>{profile.description}</p>}
              {website && (
                <a href={website} target="_blank" rel="noopener noreferrer">
                  ვებსაიტი <ExternalLink size={14} />
                </a>
              )}
            </div>
          )}
        </section>
        <section className="similar-vacancies" aria-labelledby="company-jobs">
          <h2 id="company-jobs">ვაკანსიები</h2>
          <div className="similar-grid">
            {result.jobs.map((job) => (
              <Link
                key={job.id}
                href={vacancyPath(job.id, { from: here })}
                prefetch={false}
                className="similar-card"
              >
                <h3>{job.title}</h3>
                {job.salary && (
                  <span className="similar-salary">
                    {compactSalary(job.salary)}
                  </span>
                )}
                <p>
                  {[job.city, job.deadline && `ვადა ${job.deadline}`]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <span className="similar-open">
                  ვაკანსიის ნახვა <ArrowUpRight size={15} />
                </span>
              </Link>
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
