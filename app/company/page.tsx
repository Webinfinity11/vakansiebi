import Link from 'next/link';
import type { Metadata } from 'next';
import { currentCompany } from '@/lib/server/company-auth';
import { CompanyPortal } from './portal';
import { ContentPage } from '../content-page';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'კომპანიის სივრცე | ჯობიქსი',
  robots: { index: false, follow: false },
};
export default async function CompanyPage() {
  if (process.env.COMPANY_PORTAL_ENABLED !== 'true')
    return (
      <ContentPage
        path="/company"
        title={{ ka: 'კომპანიის სივრცე', en: 'Company workspace' }}
        intro={{
          ka: 'კომპანიის ანგარიშზე წვდომის მისაღებად დაგვიკავშირდი.',
          en: 'Contact us to arrange access to your company account.',
        }}
      >
        <Link href="/contact">კონტაქტი</Link>
      </ContentPage>
    );
  return <CompanyPortal identity={await currentCompany()} />;
}
