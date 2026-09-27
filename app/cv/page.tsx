import { ServerSiteFooter } from '../server-site-footer';
import type { Metadata } from 'next';
import { shareImage } from '../../lib/seo';
import { PublicHeader } from '../public-header';
import { CvBuilder } from './cv-builder';
import '../cv.css';

const title = 'CV | რეზიუმე | შექმენი რეზიუმე უფასოდ | JOBX';
const description =
  'შეადგინე რეზიუმე (CV) ონლაინ, უფასოდ. აირჩიე მზა შაბლონი, შეავსე გამოცდილება და შეინახე PDF-ად. რეზიუმე ქართულად ან ინგლისურად.';
// A page-level openGraph block replaces the layout's, so it names everything it needs.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://jobx.ge/cv' },
  openGraph: {
    title,
    description,
    url: 'https://jobx.ge/cv',
    siteName: 'JOBX',
    locale: 'ka_GE',
    type: 'website',
    images: [shareImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [shareImage.url],
  },
};

export default function CvPage() {
  return (
    <div className="board-shell cv-shell">
      <PublicHeader />
      <CvBuilder />
      <ServerSiteFooter />
    </div>
  );
}
