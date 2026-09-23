import { ServerSiteFooter } from '../server-site-footer';
import type { Metadata } from 'next';
import { shareImage } from '../../lib/seo';
import { PublicHeader } from '../public-header';
import { CvBuilder } from './cv-builder';
import '../cv.css';

export const metadata: Metadata = {
  title: 'CV | რეზიუმე | შექმენი რეზიუმე უფასოდ | JOBX',
  description:
    'შეადგინე რეზიუმე (CV) ონლაინ, უფასოდ. აირჩიე მზა შაბლონი, შეავსე გამოცდილება და შეინახე PDF-ად. რეზიუმე ქართულად ან ინგლისურად.',
  alternates: { canonical: 'https://jobx.ge/cv' },
  openGraph: { images: [shareImage] },
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
