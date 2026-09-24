import type { Metadata } from 'next';
import { PublicHeader } from '../public-header';
import { JobMap } from './job-map';
import './map.css';

export const metadata: Metadata = {
  title: 'ვაკანსიები რუკაზე — JOBX',
  description:
    'იპოვე სამსახური სახლთან ახლოს: ვაკანსიები რუკაზე, ზუსტი მისამართით, თბილისში, ბათუმსა და ქუთაისში.',
  alternates: { canonical: 'https://jobx.ge/map' },
};

export default function MapPage() {
  return (
    <div className="board-shell job-map-shell">
      <PublicHeader />
      <JobMap />
    </div>
  );
}
