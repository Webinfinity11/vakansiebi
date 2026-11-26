import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { currentCompany } from '@/lib/server/company-auth';
import { companyJobs } from '@/lib/server/company-jobs';
import { Promote } from './promote';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'წინ წამოწევა | ჯობიქსი', robots: { index: false, follow: false } };

export default async function PromotePage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.COMPANY_PORTAL_ENABLED !== 'true') redirect('/company');
  const identity = await currentCompany();
  if (!identity || identity.mustChangePassword || identity.role === 'viewer') redirect('/company');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const job = (await companyJobs(identity)).find(item => item.id === id);
  if (!job) notFound();
  return <Promote key={job.id} job={job} owner={identity.role === 'owner'} approved={identity.approvalStatus === 'approved' && identity.emailVerified} />;
}
