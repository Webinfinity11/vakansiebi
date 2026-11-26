'use client';
import { shortCompanyDescription, visibleJobDeadline } from '@/lib/company-job-form';
import { StatusMark } from '../status-mark';
import type { CompanyJobForm } from '@/lib/company-job-form';
import { submissionVacancy } from '@/lib/job-submission';
import { qualityHints } from '@/lib/company-job-steps';
export type JobPreviewProfile = { name: string; logoUrl: string; description: string; benefits: string[]; whyUs: string };
export function JobPreview({ form, profile, importedSalary }: { form: CompanyJobForm; profile: JobPreviewProfile; importedSalary?: string }) {
  const vacancy = submissionVacancy({ ...form, placement: form.placement ?? 'standard', requestId: '00000000-0000-4000-8000-000000000001', billingEmail: '', company: profile.name, notificationEmail: '', logo: '', consent: true, fax: '' }, 'preview', profile.logoUrl);
  const deadlineLabel = visibleJobDeadline(vacancy.deadline);
  const location = [vacancy.city, vacancy.mode, vacancy.employmentType].filter(Boolean).join(' · ');
  const hasContent = !!(form.title.trim() || form.description.trim() || form.salaryFrom || importedSalary);
  return <div className="jw-preview">
    <article className="jw-preview-card">
      <div className="jw-brand">{profile.logoUrl ? <img src={profile.logoUrl} alt="" width={48} height={48} /> : <span className="jw-logo">{profile.name.slice(0, 1)}</span>}<strong>{profile.name}</strong></div>
      {(!profile.logoUrl || !profile.description) && <p className="jw-profile-hint"><a href="/company?tab=profile" target="_blank" rel="noreferrer">{!profile.logoUrl ? 'დაამატეთ ლოგო — ყველა ვაკანსიაზე გამოჩნდება' : 'დაამატეთ კომპანიის აღწერა — ყველა ვაკანსიაზე გამოჩნდება'}</a><span className="cp-subtle">კომპანიის გვერდი ახალ ჩანართში გაიხსნება.</span></p>}
      {!hasContent ? <p className="cp-subtle">აქ გამოჩნდება შევსებული ვაკანსია.</p> : <>
        {vacancy.title && <h2>{vacancy.title}</h2>}
        {location && <p className="cp-subtle">{location}</p>}
        {(importedSalary || vacancy.salary) && <p className="jw-salary">{importedSalary || vacancy.salary}</p>}
        {deadlineLabel && <p className="cp-subtle">საიტზე იქნება {deadlineLabel}</p>}
        {!!vacancy.facts?.length && <dl>{vacancy.facts.map(f => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>}
        {vacancy.description && <div className="jw-preview-description">{vacancy.description}</div>}
      </>}
      {(profile.description || profile.benefits.length > 0 || profile.whyUs) && <section className="jw-company-about">
        {profile.description && <><h3>კომპანიის შესახებ</h3><p>{shortCompanyDescription(profile.description)}</p></>}
        {profile.benefits.length > 0 && <><h3>შეღავათები</h3><div className="jw-benefits">{profile.benefits.map(benefit => <StatusMark key={benefit} kind="hired">{benefit}</StatusMark>)}</div></>}
        {profile.whyUs && <><h3>რატომ ჩვენ</h3><p>{shortCompanyDescription(profile.whyUs)}</p></>}
        <p className="cp-subtle">ეს ინფორმაცია თქვენი კომპანიის გვერდიდან ავტომატურად ერთვის.</p>
      </section>}
      <button type="button" className="cp-btn cp-btn--secondary" disabled>CV-ის გაგზავნა</button>
      {!!form.questions?.length && <section><h3>მოკლე კითხვარი</h3><ol>{form.questions.map(q => <li key={q.id}>{q.text || 'კითხვა'}{q.kind === 'choice' && <p className="cp-subtle">{q.options.filter(Boolean).join(' · ')}</p>}{q.kind === 'yes_no' && <p className="cp-subtle">კი / არა</p>}</li>)}</ol></section>}
    </article>
    <section className="jw-quality"><h3>რა გააუმჯობესებს ვაკანსიას</h3><ul>{qualityHints(form).map(hint => <li key={hint.id} data-done={hint.done}><span aria-label={hint.done ? 'შესრულებულია' : 'რეკომენდაცია'}>{hint.done ? '✓' : '○'}</span>{hint.text}</li>)}</ul></section>
  </div>;
}
