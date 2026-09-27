import { ServerSiteFooter } from '../server-site-footer';
import type { Metadata } from 'next';
import { shareImage } from '../../lib/seo';
import { PublicHeader } from '../public-header';
import { PostJobForm } from './post-job-form';
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
export default function PostJobPage() {
  return (
    <div className="board-shell post-job-shell">
      <PublicHeader />
      <PostJobForm />
      <ServerSiteFooter />
    </div>
  );
}
