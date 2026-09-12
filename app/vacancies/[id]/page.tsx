import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/server/auth';
import { getVacancyPage } from '@/lib/server/vacancy-page';
import { salaryContext } from '@/lib/server/salary-context';
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
  // Salary context is an extra; a failure there must never take the page down.
  const context =
    job.category !== 'სხვა'
      ? await salaryContext(job.category).catch(() => null)
      : null;
  return {
    job,
    preview,
    salaryContext: context,
    from: safeReturnPath(
      typeof query.from === 'string' ? query.from : undefined,
    ),
  };
}
export async function generateMetadata(props: Props): Promise<Metadata> {
  const { job, preview } = await load(props);
  const title = `${job.title} — ${job.company} | ერთად`;
  const description = [job.company, job.city, job.salary, job.employmentType]
    .filter(Boolean)
    .join(' · ')
    .slice(0, 180);
  const canonical = `https://vakansiebi-gules.vercel.app/vacancies/${job.id}`;
  return {
    title,
    description,
    alternates: { canonical },
    robots: preview ? { index: false, follow: false } : undefined,
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'website',
      locale: 'ka_GE',
    },
  };
}
export default async function Page(props: Props) {
  const { job, preview, from, salaryContext } = await load(props);
  return (
    <VacancyPage
      job={job}
      preview={preview}
      returnTo={from}
      salaryContext={salaryContext}
    />
  );
}
