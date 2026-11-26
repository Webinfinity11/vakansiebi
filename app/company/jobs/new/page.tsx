import type { Metadata } from 'next';
import { JobWizard } from '../job-wizard';
import { loadWizard } from '../load-wizard';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ახალი ვაკანსია | ჯობიქსი', robots: { index: false, follow: false } };
export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ draft?: string; copy?: string }> }) {
  const query = await searchParams;
  const props = await loadWizard({ draft: query.draft, copy: query.copy });
  return <JobWizard key={props.initialDraft?.id ?? query.copy ?? 'new'} {...props} />;
}
