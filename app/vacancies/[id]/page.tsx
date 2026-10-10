import { ServerSiteFooter } from '../../server-site-footer';
import { compactSalary } from '@/lib/vacancy-presentation';
import { breadcrumbs, jobPosting, jsonLd, vacancyUrl } from '@/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/server/auth';
import { getVacancyPage } from '@/lib/server/vacancy-page';
import { employerPages } from '@/lib/server/employers';
import {
  safeReturnPath,
  vacancyIdFrom,
  vacancySegment,
} from '@/lib/vacancy-navigation';
import VacancyPage from '../../vacancy-page';
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function load({ params, searchParams }: Props) {
  const [{ id: segment }, query] = await Promise.all([params, searchParams]);
  const preview = query.preview === '1';
  if (preview && !(await isAdmin())) notFound();
  const id = vacancyIdFrom(decodeURIComponent(segment));
  if (!id) notFound();
  const job = await getVacancyPage(id, preview);
  if (!job) notFound();
  // Resolve the cached directory so the employer link is present on a first visit.
  const employers = preview ? null : await employerPages().catch(() => null);
  const slug = employers?.byJob.get(job.id);
  return {
    job,
    preview,
    companyPath: slug ? `/companies/${encodeURIComponent(slug)}` : null,
    from: safeReturnPath(
      typeof query.from === 'string' ? query.from : undefined,
    ),
  };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { job, preview } = await load(props);
  const title = `${job.title} — ${job.company} | JOBX`;
  /* The snippet names the position, then its facts, then the posting's own
     opening words up to ~160 characters. Facts alone ("company · city · pay")
     were the same for every opening one employer had in one city. */
  const facts = [
    job.company,
    job.city,
    compactSalary(job.salary, job.salaryPeriod),
    job.employmentType,
  ]
    .filter(Boolean)
    .join(' · ');
  const lead = `${job.title}: ${facts}.`;
  const room = 160 - lead.length - 1;
  const opening = job.description.replace(/\s+/g, ' ').trim();
  const excerpt =
    room < 40 || !opening
      ? ''
      : opening.length <= room
        ? opening
        : opening.slice(0, opening.lastIndexOf(' ', room - 1)) + '…';
  const description = (excerpt ? `${lead} ${excerpt}` : lead).slice(0, 200);
  const canonical = vacancyUrl(job);
  return {
    title,
    description,
    alternates: { canonical },
    robots: preview ? { index: false, follow: false } : undefined,
    // The picture is this vacancy's own card (opengraph-image.tsx beside this page).
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'ka_GE',
      siteName: 'JOBX',
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}
export default async function Page(props: Props) {
  const { job, preview, from, companyPath } = await load(props);
  const structured = preview ? null : jobPosting(job);
  const trail = preview
    ? null
    : breadcrumbs([
        { name: 'ვაკანსიები', path: '/' },
        ...(companyPath && job.company
          ? [{ name: job.company, path: companyPath }]
          : []),
        {
          name: job.title,
          path: `/vacancies/${encodeURIComponent(vacancySegment({ id: job.canonicalId || job.id, title: job.title }))}`,
        },
      ]);
  return (
    <>
      {structured && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
        />
      )}
      {trail && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(trail) }}
        />
      )}
      <VacancyPage
        job={job}
        preview={preview}
        returnTo={from}
        companyPath={companyPath}
        footer={<ServerSiteFooter />}
      />
    </>
  );
}
