import { compactSalary } from '@/lib/vacancy-presentation';
import { jobPosting, jsonLd, shareImage, vacancyUrl } from '@/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/server/auth';
import { getVacancyPage } from '@/lib/server/vacancy-page';
import { employerPages } from '@/lib/server/employers';
import { safeReturnPath } from '@/lib/vacancy-navigation';
import VacancyPage from '../../vacancy-page';
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function load({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const preview = query.preview === '1';
  if (preview && !(await isAdmin())) notFound();
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
  const description = [
    job.company,
    job.city,
    compactSalary(job.salary, job.salaryPeriod),
    job.employmentType,
  ]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 180);
  const canonical = vacancyUrl(job);
  return {
    title,
    description,
    alternates: { canonical },
    robots: preview ? { index: false, follow: false } : undefined,
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
export default async function Page(props: Props) {
  const { job, preview, from, companyPath } = await load(props);
  const structured = preview ? null : jobPosting(job);
  return (
    <>
      {structured && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(structured) }}
        />
      )}
      <VacancyPage
        job={job}
        preview={preview}
        returnTo={from}
        companyPath={companyPath}
      />
    </>
  );
}
