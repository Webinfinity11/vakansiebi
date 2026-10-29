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
export default async function SalariesPage() {
  const roles = await salaryPages();
  return (
    <ContentPage
      path="/salaries"
      title={{
        ka: 'ხელფასები',
        en: 'Salaries',
      }}
      intro={{
        ka: 'შეადარე აქტიურ ვაკანსიებში მითითებული ანაზღაურება. აირჩიე კატეგორია ან პროფესია და ნახე თვიური ან დღიური თანხები.',
        en: 'Compare pay stated in active listings. Find your profession and explore monthly or daily amounts.',
      }}
    >
      <SalaryExplorer roles={roles} />
    </ContentPage>
  );
}
