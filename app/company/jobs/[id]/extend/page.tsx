import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { currentCompany } from '@/lib/server/company-auth';
import { companyJobDeadline } from '@/lib/server/job-deadline';
import { ApiError } from '@/lib/server/auth';
import { ExtendDeadline } from './extend-deadline';
import '../../../portal.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ვადის გაგრძელება | ჯობიქსი', robots: { index: false, follow: false } };
export default async function ExtendPage({ params }: { params: Promise<{ id: string }> }) {
  if (process.env.COMPANY_PORTAL_ENABLED !== 'true') redirect('/company');
  const company = await currentCompany();
  if (!company || company.mustChangePassword || company.role === 'viewer' || company.approvalStatus !== 'approved' || !company.emailVerified) redirect('/company');
  let job;
  try { job = await companyJobDeadline(company, (await params).id); }
  catch (e) { if (e instanceof ApiError && e.status === 404) notFound(); throw e; }
  return <ExtendDeadline job={job} />;
}
