import type { Metadata } from 'next';
import { PublicHeader } from '../public-header';
import { PostJobForm } from './post-job-form';
export const metadata: Metadata = {
  title: 'განცხადების დამატება — JOBX',
  description: 'დაამატე ვაკანსია JOBX-ზე და იპოვე შენი გუნდის ახალი წევრი.',
  alternates: { canonical: 'https://jobx.ge/post-job' },
  robots: { index: false, follow: true },
};
export default function PostJobPage() {
  return (
    <div className="board-shell post-job-shell">
      <PublicHeader />
      <PostJobForm />
    </div>
  );
}
