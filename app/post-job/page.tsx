import { ServerSiteFooter } from '../server-site-footer';
import type { Metadata } from 'next';
import { shareImage } from '../../lib/seo';
import { PublicHeader } from '../public-header';
import { PostJobForm } from './post-job-form';
import { placementTiers, type PlacementTier } from '@/lib/placement';
const title = 'განცხადების დამატება — JOBX';
const description =
  'დაამატე ვაკანსია JOBX-ზე და იპოვე შენი გუნდის ახალი წევრი.';
// Not indexed, but employers share this link, so a messenger should name the page.
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://jobx.ge/post-job' },
  robots: { index: false, follow: true },
  openGraph: {
    title,
    description,
    url: 'https://jobx.ge/post-job',
    siteName: 'JOBX',
    locale: 'ka_GE',
    type: 'website',
    images: [shareImage],
  },
};
export default async function PostJobPage({
  searchParams,
}: {
  searchParams: Promise<{ placement?: string | string[] }>;
}) {
  const { placement } = await searchParams;
  const initialPlacement = placementTiers.find((tier) => tier === placement) as
    | PlacementTier
    | undefined;
  return (
    <div className="board-shell post-job-shell">
      <PublicHeader />
      <PostJobForm
        key={initialPlacement ?? 'default'}
        initialPlacement={initialPlacement}
      />
      <ServerSiteFooter />
    </div>
  );
}
