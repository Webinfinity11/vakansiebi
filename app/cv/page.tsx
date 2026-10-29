import { ServerSiteFooter } from '../server-site-footer';
import type { Metadata } from 'next';
import { shareImage } from '../../lib/seo';
import { siteName } from '@/lib/site-brand';
import { PublicHeader } from '../public-header';
import { CvBuilder } from './cv-builder';
import '../cv.css';

const title = `CV-ის შექმნა უფასოდ — რეზიუმე ონლაინ | ${siteName}`;
const description =
  'სივის შექმნა ონლაინ, უფასოდ: აირჩიე რეზიუმეს შაბლონი, შეავსე გამოცდილება და ჩამოტვირთე PDF ქართულად ან ინგლისურად.';
// A page-level openGraph block replaces the layout's, so it names everything it needs.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://jobx.ge/cv' },
  openGraph: {
    title,
    description,
    url: 'https://jobx.ge/cv',
    siteName,
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
