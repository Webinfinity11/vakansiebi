import { SalaryExplorer } from '../salary-explorer';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ContentPage } from '@/app/content-page';
import { LocalText } from '@/app/local-text';
import { contentMetadata } from '@/lib/content-seo';
import { salaryPages } from '@/lib/server/salary-pages';
import { translateUi } from '@/lib/ui-language';

export const dynamic = 'force-dynamic';
async function findRole(slug: string) {
  const role = (await salaryPages()).find((r) => r.slug === slug);
  if (!role) notFound();
  return role;
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const role = await findRole((await params).slug);
  return {
    ...contentMetadata(
      `/salaries/${role.slug}`,
      role.kind === 'legacy'
        ? `${role.genitive} ხელფასი`
        : `${role.label} — ხელფასები`,
      'აქტიურ ვაკანსიებში მითითებული საწყისი ანაზღაურება, თანხების განაწილება და შესაბამისი ვაკანსიები.',
    ),
    robots: { index: !!(role.month || role.day), follow: true },
  };
}
export default async function SalaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [role, query] = await Promise.all([
    findRole((await params).slug),
    searchParams,
  ]);
  const initialPeriod = query.period === 'day' ? 'day' : 'month';
  return (
    <ContentPage
      path={`/salaries/${role.slug}`}
      title={{
        ka:
          role.kind === 'legacy'
            ? `${role.genitive} ხელფასი`
            : `${role.label} — ხელფასები`,
        en: `${translateUi(role.label, 'en')} salaries`,
      }}
      intro={{
        ka: `ამ პროფესიისთვის ${role.total} აქტიური განცხადებაა. ქვემოთ მოცემულია მხოლოდ განცხადებებში მითითებული საწყისი თანხები.`,
        en: `${role.total} active listings for this profession. The figures below use only starting amounts stated in listings.`,
      }}
    >
      <SalaryExplorer
        key={initialPeriod}
        roles={[role]}
        detail
        initialPeriod={initialPeriod}
      />
      <nav className="content-links">
        <Link
          href={initialPeriod === 'day' ? '/salaries?period=day' : '/salaries'}
        >
          <LocalText
            ka="ყველა პროფესია და გამოთვლის წესი"
            en="All professions and methodology"
          />
        </Link>
      </nav>
    </ContentPage>
  );
}
