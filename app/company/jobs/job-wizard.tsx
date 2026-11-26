'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { prepareCompanyJob, suggestJobCategory, visibleJobDeadline } from '@/lib/company-job-form';
import { ArrowLeft, Eye } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import type { CompanyJobForm } from '@/lib/company-job-form';
import { validateAll, visibleJobErrors, type CompanyJobErrors } from '@/lib/company-job-steps';
import { formatTime, type CompanyJob } from '../company-api';
import { JobSteps } from './job-steps';
import { JobImport } from './job-import';
import { JobPreview, type JobPreviewProfile } from './job-preview';
import { useJobDraft, type DraftInitial } from './use-job-draft';
import '../portal.css';
import './job-wizard.css';

type Props = { identity: { role: string; name: string; companyKey: string; accountId: string }; profile: JobPreviewProfile; job?: CompanyJob; initialForm: CompanyJobForm; baseForm: CompanyJobForm; initialDraft: DraftInitial; copy?: boolean; copySource?: string; resumeLatest?: boolean };
export function JobWizard({ identity, profile, job, initialForm, baseForm, initialDraft, copy, copySource, resumeLatest }: Props) {
  const router = useRouter();
  const draft = useJobDraft(initialForm, initialDraft, job?.id, `${identity.companyKey}:${identity.accountId}`, copySource, resumeLatest, baseForm);
  const { form } = draft;
  const [touched, setTouched] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setErrors] = useState<CompanyJobErrors>({});
  const errors = { ...visibleJobErrors(validateAll(form, { imported: job?.imported, editing: !!job }), touched, submitted), ...serverErrors };
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const completed = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importRevision, setImportRevision] = useState(0);
  const importNoteKey = `jobx:job-import:${identity.companyKey}:${job?.id ?? draft.ensureId()}`;
  function clearImportNote() {
    try { sessionStorage.removeItem(importNoteKey); } catch {}
    setImportRevision(value => value + 1);
  }
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
    const first = ['title', 'city', 'mode', 'salaryFrom', 'salaryTo', 'description'].find(key => next[key]);
    if (first) focusField(first);
    else if (Object.keys(next).length) setError('ვაკანსიის გაგზავნა ვერ მოხერხდა. დაგვიკავშირდით.');
  }

  function blur(key: keyof CompanyJobForm) {
    if (key === 'title' && !form.category && form.title.trim()) draft.update({ ...form, category: suggestJobCategory(form.title) });
    setTouched(previous => previous.includes(key) ? previous : [...previous, key]);
    setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
  }
  async function submit() {
    if (submitting.current || completed.current) return;
    setSubmitted(true);
    const prepared = prepareCompanyJob(job ? { ...form, placement: job.form.placement } : { ...form, contact: form.contact.trim() || baseForm.contact }, { editing: !!job, reopening });
    draft.update(prepared);
    const found = validateAll(prepared, { imported: job?.imported, editing: !!job });
    if (Object.keys(found).length) { showErrors(found); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      await draft.save(); await draft.pause();
      const id = draft.ensureId();
      const response = await fetch('/api/company/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: !job ? 'create' : reopening ? 'restore' : 'save', id: job?.id, version: job?.version, requestId: id, draftId: id, form: prepared }) });
      const body = await response.json();
      if (!response.ok) {
        if (body.fields) {
          showErrors(body.fields);
          const visible = ['title', 'city', 'mode', 'salaryFrom', 'salaryTo', 'description'];
          if (!Object.keys(body.fields).some(key => visible.includes(key))) throw Error('ვაკანსიის გაგზავნა ვერ მოხერხდა. დაგვიკავშირდით.');
        }
        throw Error(response.status === 409 ? 'ვაკანსია ამასობაში შეიცვალა. განაახლეთ გვერდი — თქვენი ტექსტი მონახაზში შენახულია.' : body.error || 'გაგზავნა ვერ მოხერხდა. სცადეთ ხელახლა.');
      }
      completed.current = true;
      const sentPath = `/company/jobs/${encodeURIComponent(body.id ?? job?.id)}/sent${job?.status === 'published' ? '?edit=1' : ''}`;
      clearImportNote();
      draft.clear(sentPath);
      router.replace(sentPath);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'გაგზავნა ვერ მოხერხდა. სცადეთ ხელახლა.'); draft.resume(); }
    finally { if (!completed.current) { submitting.current = false; setBusy(false); } }
  }
  const deadlineLabel = visibleJobDeadline(prepareCompanyJob(form, { editing: !!job, reopening }).deadline);
  const preview = <JobPreview form={prepareCompanyJob(form, { editing: !!job, reopening })} profile={profile} importedSalary={job?.imported ? job.salary : undefined} />;
  return <div className="jw" ref={root}>
    <header className="jw-top"><Link href="/company" className="jw-back"><ArrowLeft size={18} />ვაკანსიების სია</Link><h1>{title}</h1><div className="jw-save" role="status" aria-live="polite">{draft.status === 'saving' ? 'ინახება…' : draft.status === 'saved' ? `მონახაზი შენახულია ${formatTime(draft.savedAt)}-ზე` : draft.status === 'error' ? (draft.message || 'შენახვა ვერ მოხერხდა') : 'მონახაზი ავტომატურად შეინახება'}{draft.status === 'error' && <button type="button" className="cp-btn cp-btn--ghost" onClick={() => void draft.save()}>ხელახლა ცდა</button>}</div><button type="button" className="cp-btn cp-btn--ghost jw-preview-toggle" onClick={() => setPreviewOpen(true)}><Eye size={18} />გადახედვა</button></header>
    <div className="jw-wrap">
      {draft.restored && <div className="jw-note jw-restored">{job ? 'აღდგენილია თქვენი ცვლილებები' : 'აღდგენილია თქვენი მონახაზი'} <button className="cp-btn cp-btn--ghost" type="button" disabled={busy} onClick={async () => { if (!window.confirm(job ? 'გავაუქმოთ შენახული ცვლილებები?' : 'წავშალოთ მონახაზი და დავიწყოთ თავიდან?')) return; try { await draft.discard(baseForm); clearImportNote(); setErrors({}); setTouched([]); setSubmitted(false); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'მონახაზის წაშლა ვერ მოხერხდა'); } }}>{job ? 'ცვლილებების გაუქმება' : 'ახლიდან დაწყება'}</button></div>}
      <div className="jw-layout"><main className="jw-main">{job?.status === 'published' && <p className="jw-note">ცვლილებები გამოჩნდება JOBX-ის გუნდის დადასტურების შემდეგ. მანამდე საიტზე მიმდინარე ვერსია დარჩება.</p>}
        <form id="job-wizard-form" noValidate onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset className="jw-form" disabled={busy || job?.status === 'merged'}>
        <JobImport key={job?.id ?? copySource ?? 'new'} resetKey={importRevision} form={form} defaults={baseForm} noteKey={importNoteKey} disabled={busy || !!job?.imported || job?.status === 'merged'} onApply={next => { if (!submitting.current && !completed.current) draft.update(next); }} />
        <JobSteps form={form} errors={errors} job={job} set={(key, value) => { setErrors(previous => { const next = { ...previous }; delete next[key]; return next; }); draft.update({ ...form, [key]: value }); }} blur={blur} />
        {deadlineLabel && <p className="cp-subtle">ვაკანსია საიტზე იქნება {deadlineLabel}</p>}
        </fieldset>
        {error && <p role="alert" className="jw-error jw-note">{error}</p>}
        <footer className="jw-footer"><button type="submit" className="cp-btn cp-btn--primary" disabled={busy || job?.status === 'merged'}>{busy ? 'იგზავნება…' : job ? 'ცვლილებების გაგზავნა' : 'გამოქვეყნება'}</button></footer></form>
      </main><aside className="jw-desktop-preview"><p className="jw-preview-label">კანდიდატის ხედი</p>{preview}</aside></div>
    </div>
    <Sheet open={previewOpen} onOpenChange={setPreviewOpen}><SheetContent className="jw-preview-sheet" showCloseButton={false}><div className="jw-sheet-head"><SheetTitle>გადახედვა</SheetTitle><button className="cp-btn cp-btn--ghost" onClick={() => setPreviewOpen(false)}>დახურვა</button></div><SheetDescription>კანდიდატის ხედი</SheetDescription>{preview}</SheetContent></Sheet>
  </div>;
}
