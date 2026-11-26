'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { vacancyPath } from '@/lib/vacancy-navigation';
import { ArrowLeft, Eye, CheckCircle2, Check } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { CompanyJobForm } from '@/lib/company-job-form';
import { companyJobSteps, fieldSteps, firstInvalidStep, validateAll, validateStep, visibleJobErrors, type CompanyJobErrors } from '@/lib/company-job-steps';
import { formatDate, formatTime, type CompanyJob } from '../company-api';
import { JobSteps } from './job-steps';
import { JobPreview, type JobPreviewProfile } from './job-preview';
import { useJobDraft, type DraftInitial } from './use-job-draft';
import '../portal.css';
import './job-wizard.css';

type Props = { identity: { role: string; name: string; companyKey: string }; profile: JobPreviewProfile; job?: CompanyJob; initialForm: CompanyJobForm; baseForm: CompanyJobForm; initialDraft: DraftInitial; copy?: boolean; copySource?: string };
export function JobWizard({ identity, profile, job, initialForm, baseForm, initialDraft, copy, copySource }: Props) {
  const draft = useJobDraft(initialForm, initialDraft, job?.id, identity.companyKey, copySource);
  const { form, step } = draft;
  const [touched, setTouched] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setErrors] = useState<CompanyJobErrors>({});
  const errors = { ...visibleJobErrors(validateAll(form, { imported: job?.imported }), touched, submitted), ...serverErrors };
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [success, setSuccess] = useState<{ id: string; invoiceUrl?: string; autoPublished?: boolean } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const reopening = !!job && ['archived', 'rejected'].includes(job.status);
  const title = copy ? 'ვაკანსიის ასლი' : !job ? 'ახალი ვაკანსია' : reopening ? 'ვაკანსიის ხელახლა გაგზავნა' : 'ვაკანსიის რედაქტირება';
  // When the virtual keyboard shrinks the visual viewport, let the footer flow
  // with the document instead of pinning it across the field being edited.
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => root.current?.classList.toggle('jw-keyboard', !!viewport && window.innerHeight - viewport.height > 150);
    viewport?.addEventListener('resize', resize); resize();
    return () => viewport?.removeEventListener('resize', resize);
  }, []);
  function focusField(field: string) {
    requestAnimationFrame(() => {
      const el = document.getElementById(`job-${field}`);
      el?.closest('details')?.setAttribute('open', '');
      el?.focus(); el?.scrollIntoView({ block: 'center' });
    });
  }
  function showErrors(next: CompanyJobErrors) {
    setErrors(next);
    const first = firstInvalidStep(next);
    if (first) { draft.go(companyJobSteps.findIndex(s => s.id === first) + 1); focusField(Object.keys(next).find(key => fieldSteps[key as keyof CompanyJobForm] === first)!); }
  }
  function blur(key: keyof CompanyJobForm) {
    setTouched(previous => previous.includes(key) ? previous : [...previous, key]);
    setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
  }
  function changeStep(next: number) {
    draft.go(next); document.getElementById('wizard-step-title')?.focus();
  }
  function next() {
    setSubmitted(true);
    const found = validateStep(form, companyJobSteps[step - 1].id, { imported: job?.imported });
    if (Object.keys(found).length) { focusField(Object.keys(found)[0]); return; }
    changeStep(step + 1);
  }
  async function submit() {
    if (submitting.current) return;
    setSubmitted(true);
    const found = validateAll(form, { imported: job?.imported });
    if (Object.keys(found).length) { showErrors(found); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      await draft.save(); await draft.pause();
      const id = draft.ensureId();
      const response = await fetch('/api/company/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: !job ? 'create' : reopening ? 'restore' : 'save', id: job?.id, version: job?.version, requestId: id, draftId: id, form }) });
      const body = await response.json();
      if (!response.ok) {
        if (body.fields) showErrors(body.fields);
        throw Error(response.status === 409 ? 'ვაკანსია ამასობაში შეიცვალა. განაახლეთ გვერდი — თქვენი ტექსტი მონახაზში შენახულია.' : body.error || 'გაგზავნა ვერ მოხერხდა. სცადეთ ხელახლა.');
      }
      draft.clear(); setSuccess({ id: body.id ?? job?.id, invoiceUrl: body.invoiceUrl, autoPublished: body.autoPublished === true });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'გაგზავნა ვერ მოხერხდა. სცადეთ ხელახლა.'); draft.resume(); }
    finally { submitting.current = false; setBusy(false); }
  }
  const preview = <JobPreview form={form} profile={profile} importedSalary={job?.imported ? job.salary : undefined} />;
  if (success) return <div className="jw"><header className="jw-top"><Link href="/company" className="jw-back"><ArrowLeft size={18} />ვაკანსიებზე დაბრუნება</Link></header><div className="jw-success-wrap"><div className="jw-success"><CheckCircle2 size={40} /><h1>{success.autoPublished ? 'ვაკანსია გამოქვეყნდა' : job?.status === 'published' ? 'ცვლილებები გაგზავნილია შესამოწმებლად' : 'ვაკანსია გაგზავნილია შესამოწმებლად'}</h1><p>{success.autoPublished ? 'ვაკანსია უკვე ჩანს საიტზე. განაცხადებს „კანდიდატებში“ ნახავთ.' : job?.status === 'published' ? 'დადასტურებამდე საიტზე მიმდინარე ვერსია დარჩება.' : 'JOBX-ის გუნდი განცხადებას შეამოწმებს და გამოაქვეყნებს. შედეგს ელფოსტით შეგატყობინებთ, სტატუსს კი ვაკანსიების სიაში ნახავთ.'}</p>{success.invoiceUrl && <div className="jw-note"><a href={success.invoiceUrl} target="_blank" rel="noreferrer">ინვოისის ნახვა</a><p>ფასიანი განთავსება გააქტიურდება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ. ვადა გააქტიურებიდან აითვლება.</p></div>}<div className="jw-success-actions">{success.autoPublished && success.id && <a className="cp-btn cp-btn--primary" href={vacancyPath({ id: success.id, title: form.title })} target="_blank" rel="noreferrer">საიტზე ნახვა</a>}<Link className="cp-btn cp-btn--primary" href="/company">ვაკანსიების სია</Link><a className="cp-btn cp-btn--ghost" href="/company/jobs/new">კიდევ ერთი ვაკანსიის დამატება</a><a className="cp-btn cp-btn--ghost" href={`/company/jobs/new?copy=${success.id}`}>მსგავსი ვაკანსიის შექმნა</a></div></div></div></div>;
  const missing = step === 2 && submitted ? errors : {};
  return <div className="jw" ref={root}>
    <header className="jw-top"><Link href="/company" className="jw-back"><ArrowLeft size={18} />ვაკანსიებზე დაბრუნება</Link><h1>{title}</h1><div className="jw-save" role="status" aria-live="polite">{draft.status === 'saving' ? 'ინახება…' : draft.status === 'saved' ? `მონახაზი შენახულია ${formatTime(draft.savedAt)}-ზე` : draft.status === 'error' ? 'შენახვა ვერ მოხერხდა' : 'მონახაზი ავტომატურად შეინახება'}{draft.status === 'error' && <button type="button" className="cp-btn cp-btn--ghost" onClick={() => void draft.save()}>ხელახლა ცდა</button>}</div><button type="button" className="cp-btn cp-btn--ghost jw-preview-toggle" onClick={() => setPreviewOpen(true)}><Eye size={18} />გადახედვა</button></header>
    <div className="jw-wrap">
      <nav className="jw-steps" aria-label="ვაკანსიის ნაბიჯები">{companyJobSteps.map((item, index) => { const complete = index + 1 < step && Object.keys(validateStep(form, item.id, { imported: job?.imported })).length === 0; return <button data-complete={complete || undefined} aria-label={complete ? `${item.title} — დასრულებულია` : item.title} key={item.id} type="button" disabled={busy} aria-current={step === index + 1 ? 'step' : undefined} data-error={Object.keys(errors).some(key => fieldSteps[key as keyof CompanyJobForm] === item.id)} onClick={() => changeStep(index + 1)}><span>{complete ? <Check size={16} aria-hidden="true" /> : index + 1}</span><span className="jw-step-label">{item.title}</span>{Object.keys(errors).some(key => fieldSteps[key as keyof CompanyJobForm] === item.id) && <b aria-label="შეცდომაა">!</b>}</button>; })}</nav>
      <div className="jw-mobile-progress"><span>ნაბიჯი {step} / 2</span><progress value={step} max={2} aria-label="ნაბიჯი" /></div>
      {draft.restored && job && <div className="jw-note jw-restored">აღდგენილია შეუნახავი ცვლილებები <button className="cp-btn cp-btn--ghost" type="button" disabled={busy} onClick={async () => { try { await draft.discard(baseForm); setErrors({}); } catch (e) { setError(e instanceof Error ? e.message : 'მონახაზის წაშლა ვერ მოხერხდა'); } }}>გაუქმება</button></div>}
      {initialDraft && <p className="jw-author cp-subtle">ბოლო ცვლილება: {initialDraft.updatedBy} · {formatDate(initialDraft.updatedAt)}, {formatTime(initialDraft.updatedAt)}</p>}
      <div className="jw-layout"><main className="jw-main"><h2 id="wizard-step-title" tabIndex={-1}>{companyJobSteps[step - 1].title}</h2>{job?.status === 'published' && <p className="jw-note">ცვლილებები გამოჩნდება JOBX-ის გუნდის დადასტურების შემდეგ. მანამდე საიტზე მიმდინარე ვერსია დარჩება.</p>}
        <form id="job-wizard-form" noValidate onSubmit={e => { e.preventDefault(); if (step < 2) next(); else void submit(); }}><fieldset className="jw-form" disabled={busy || job?.status === 'merged'}><div className="jw-review-preview" hidden={step !== 2}>{preview}</div><JobSteps form={form} step={step} errors={errors} job={job} owner={identity.role === 'owner'} set={(key, value) => { setErrors(previous => { const next = { ...previous }; delete next[key]; return next; }); draft.update({ ...form, [key]: value }); }} blur={blur} /></fieldset>
        {Object.keys(missing).length > 0 && <section className="jw-missing"><h3>შეამოწმეთ ველები</h3><ul>{Object.entries(missing).map(([field, message]) => <li key={field}><button type="button" onClick={() => { const target = fieldSteps[field as keyof CompanyJobForm]; setErrors(previous => ({ ...previous, [field]: message })); draft.go(Math.max(1, companyJobSteps.findIndex(s => s.id === target) + 1)); focusField(field); }}>{message}</button></li>)}</ul></section>}
        {error && <p role="alert" className="jw-error jw-note">{error}</p>}
        <footer className="jw-footer"><button type="button" className="cp-btn cp-btn--ghost" disabled={step === 1 || busy} onClick={() => changeStep(step - 1)}>უკან</button><button type="submit" className="cp-btn cp-btn--primary" disabled={busy || job?.status === 'merged'}>{busy ? 'იგზავნება…' : step < 2 ? 'გაგრძელება' : 'შესამოწმებლად გაგზავნა'}</button></footer></form>
      </main><aside className="jw-desktop-preview"><p className="jw-preview-label">კანდიდატის ხედი</p>{preview}</aside></div>
    </div>
    <Sheet open={previewOpen} onOpenChange={setPreviewOpen}><SheetContent className="jw-preview-sheet" showCloseButton={false}><div className="jw-sheet-head"><SheetTitle>გადახედვა</SheetTitle><button className="cp-btn cp-btn--ghost" onClick={() => setPreviewOpen(false)}>დახურვა</button></div><SheetDescription>კანდიდატის ხედი</SheetDescription>{preview}</SheetContent></Sheet>
  </div>;
}
