import type { Metadata } from 'next';
import { shareImage } from '@/lib/seo';
import { PublicHeader } from '../public-header';
import { JobMap } from './job-map';
import './map.css';

const title = 'ვაკანსიები რუკაზე — JOBX';
const description =
  'იპოვე სამსახური სახლთან ახლოს: ვაკანსიები რუკაზე, ზუსტი მისამართით, თბილისში, ბათუმსა და ქუთაისში.';
// A page-level openGraph block replaces the layout's, so it names everything it needs.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://jobx.ge/map' },
  openGraph: {
    title,
    description,
    url: 'https://jobx.ge/map',
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

export default function MapPage() {
  return (
    <div className="board-shell job-map-shell">
      <PublicHeader />
      <JobMap />
    </div>
  );
}
