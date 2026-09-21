import type { Metadata } from 'next';
import { shareImage } from '../../lib/seo';
import { PublicHeader } from '../public-header';
import { CvBuilder } from './cv-builder';
import '../cv.css';

export const metadata: Metadata = {
  title: 'რეზიუმეს შედგენა — CV გენერატორი უფასოდ | JOBX',
  description:
    'შექმენი რეზიუმე ქართულად ან ინგლისურად. აირჩიე შაბლონი, შეავსე გამოცდილება და შეინახე CV PDF-ად უფასოდ.',
  alternates: { canonical: 'https://jobx.ge/cv' },
  openGraph: { images: [shareImage] },
};

export default function CvPage() {
  return (
    <div className="board-shell cv-shell">
      <PublicHeader />
      <CvBuilder />
    </div>
  );
}
