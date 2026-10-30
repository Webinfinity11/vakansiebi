import { ContentPage } from '../content-page';
import { contentMetadata } from '@/lib/content-seo';
import { salaryPages } from '@/lib/server/salary-pages';
import { SalaryExplorer } from './salary-explorer';

export const dynamic = 'force-dynamic';
export const metadata = contentMetadata(
  '/salaries',
  'ხელფასები',
  'შეადარე აქტიურ ვაკანსიებში მითითებული ანაზღაურება პროფესიების მიხედვით. თვიური და დღიური თანხები ცალ-ცალკე.',
);
export default async function SalariesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [roles, params] = await Promise.all([salaryPages(), searchParams]);
  const initialPeriod = params.period === 'day' ? 'day' : 'month';
  return (
    <ContentPage
      path="/salaries"
      title={{
        ka: 'ხელფასები',
        en: 'Salaries',
      }}
      intro={{
        ka: 'შეადარე აქტიურ ვაკანსიებში მითითებული ანაზღაურება. აირჩიე კატეგორია ან პროფესია და ნახე თვიური ან დღიური თანხები.',
        en: 'Compare pay stated in active listings. Choose a category or profession to see monthly or daily amounts.',
      }}
    >
      <SalaryExplorer
        key={initialPeriod}
        roles={roles}
        initialPeriod={initialPeriod}
      />
    </ContentPage>
  );
}
