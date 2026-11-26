import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { currentCompany } from '@/lib/server/company-auth';
import { companyJobs } from '@/lib/server/company-jobs';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { submissionDate } from '@/lib/job-submission';
import { SentPlacement } from './sent-placement';
import '../../../portal.css';
import '../../job-wizard.css';
import './sent.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'ვაკანსია | ჯობიქსი', robots: { index: false, follow: false } };
export default async function SentJobPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  if (process.env.COMPANY_PORTAL_ENABLED !== 'true') redirect('/company');
  const identity = await currentCompany();
  if (!identity || identity.mustChangePassword || identity.role === 'viewer') redirect('/company');
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const job = (await companyJobs(identity)).find(item => item.id === id);
  if (!job) notFound();
  const visible = job.status === 'published' && !!job.publicPath && job.form.deadline >= submissionDate();
  const edited = (await searchParams).edit === '1';
  const reviewing = job.status === 'pending' || (edited && job.needsReview && job.status === 'published');
  const heading = job.status === 'rejected' ? 'ვაკანსია უარყოფილია' : job.status === 'archived' ? 'ვაკანსია დახურულია' : reviewing ? (job.status === 'published' ? 'ცვლილებები გაგზავნილია შესამოწმებლად' : 'ვაკანსია გაიგზავნა') : visible ? 'ვაკანსია გამოქვეყნდა' : 'ვაკანსია';
  const message = job.status === 'rejected' ? 'გაასწორეთ და ხელახლა გაგზავნეთ.' : reviewing ? (job.status === 'published' ? 'დადასტურებამდე საიტზე მიმდინარე ვერსია დარჩება.' : 'დადასტურების შემდეგ გამოჩნდება საიტზე.') : visible ? 'ვაკანსია უკვე ჩანს საიტზე.' : 'ვაკანსიის მიმდინარე სტატუსი იხილეთ ვაკანსიების სიაში.';
  return <div className="jw">
    <header className="jw-top"><Link className="jw-back" href="/company">ვაკანსიების სია</Link></header>
    <main className="jw-success-wrap"><section className="jw-success">
      <h1>{heading}</h1><p>{message}</p>
      <div className="jw-success-actions">
        <Link className="cp-btn cp-btn--primary" href="/company">ვაკანსიების სია</Link>
        {job.status === 'rejected' && <Link className="cp-btn cp-btn--secondary" href={`/company/jobs/${id}/edit`}>რედაქტირება</Link>}
        {visible && <Link className="cp-btn cp-btn--secondary" href={job.publicPath || vacancyPath({ id, title: job.title })}>საიტზე ნახვა</Link>}
        <a className="cp-btn cp-btn--ghost" href="/company/jobs/new">კიდევ ერთი ვაკანსია</a>
      </div>
    </section>
      <SentPlacement key={job.id} job={job} reviewing={reviewing} owner={identity.role === 'owner'} approved={identity.approvalStatus === 'approved' && identity.emailVerified} />
    </main>
  </div>;
}
