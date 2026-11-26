import type { Metadata } from 'next';
import { JobWizard } from '../../job-wizard';
import { loadWizard } from '../../load-wizard';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ვაკანსიის რედაქტირება | ჯობიქსი', robots: { index: false, follow: false } };
export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const props = await loadWizard({ edit: (await params).id });
  return <JobWizard key={props.job?.id} {...props} />;
}
