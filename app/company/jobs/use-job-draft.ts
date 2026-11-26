'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { restoreJobStep } from '@/lib/company-job-steps';
import type { CompanyJobForm } from '@/lib/company-job-form';
export type DraftInitial = { id: string; step: number; updatedAt: string; updatedBy: string } | null;
type Snapshot = { wizardVersion?: number; id: string; form: CompanyJobForm; step: number; changedAt: string };

export function useJobDraft(initialForm: CompanyJobForm, initial: DraftInitial, jobId: string | undefined, storageScope: string, copySource?: string, resumeLatest = false, baseForm = initialForm) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [restored, setRestored] = useState(!!initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(initial ? 'saved' : 'idle');
  const [message, setMessage] = useState('');
  const handledDiscard = useRef('');
  const [savedAt, setSavedAt] = useState(initial?.updatedAt ?? '');
  const id = useRef(initial?.id ?? '');
  const current = useRef({ form: initialForm, step: 1 });
  const saved = useRef(JSON.stringify(current.current));
  const persisted = useRef(!!initial);
  const active = useRef(true);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const storagePrefix = `jobx:job-draft:${storageScope}:`;
  const storageKey = storagePrefix + (jobId ?? initial?.id ?? (copySource ? `copy:${copySource}` : 'new'));
  const finished = useRef(false);
  const restoredKey = useRef<string | null>(null);
  const ensureId = useCallback(() => id.current ||= crypto.randomUUID(), []);
  const localCopy = useCallback(() => {
    const snapshot: Snapshot = { ...current.current, wizardVersion: 2, id: ensureId(), changedAt: new Date().toISOString() };
    try {
      if (jobId || !initial?.id || initial.id === snapshot.id) localStorage.setItem(storageKey, JSON.stringify(snapshot));
      if (!jobId) {
        localStorage.setItem(storagePrefix + snapshot.id, JSON.stringify(snapshot));
        localStorage.setItem(storagePrefix + 'new', JSON.stringify(snapshot));
        if (copySource) localStorage.setItem(storagePrefix + `copy:${copySource}`, JSON.stringify(snapshot));
      }
    } catch { /* Network saving still works when storage is unavailable. */ }
  }, [ensureId, storageKey, storagePrefix, jobId, copySource, initial?.id]);
  const save = useCallback((keepalive = false) => {
    clearTimeout(timer.current); timer.current = undefined;
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (finished.current || (!active.current && !keepalive)) return;
      const snapshot = { ...current.current };
      const serialized = JSON.stringify(snapshot);
      if (serialized === saved.current) { setStatus(persisted.current ? 'saved' : 'idle'); return; }
      localCopy(); setStatus('saving'); setMessage('');
      try {
        const response = await fetch('/api/company/job-drafts', { method: 'POST', keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', id: ensureId(), jobId, ...snapshot, form: { ...snapshot.form, wizardVersion: 2 } }) });
        const body = await response.json();
        if (!response.ok) { setMessage(typeof body.error === 'string' ? body.error : 'შენახვა ვერ მოხერხდა'); setStatus('error'); return; }
        saved.current = serialized; persisted.current = true; setSavedAt(body.updatedAt);
        setStatus(JSON.stringify(current.current) === serialized ? 'saved' : 'saving');
      } catch { setMessage(''); setStatus('error'); }
    });
    return queue.current;
  }, [ensureId, jobId, localCopy]);
  useEffect(() => {
    active.current = true;
    // A rerender must never restore the backup written during this visit.
    if (restoredKey.current !== storageKey) {
      restoredKey.current = storageKey;
      try {
        // Router cache can still contain a deleted server draft after Back.
        const discardedAt = sessionStorage.getItem(storagePrefix + 'discarded:' + (initial?.id ?? id.current));
        const ignoreInitial = !!discardedAt && (!initial || discardedAt >= initial.updatedAt);
        if (ignoreInitial && handledDiscard.current !== discardedAt) {
          handledDiscard.current = discardedAt;
          id.current = ''; persisted.current = false;
          current.current = { form: baseForm, step: 1 }; saved.current = JSON.stringify(current.current);
          setForm(baseForm); setStep(1); setRestored(false); setStatus('idle'); setMessage('');
        }
        let raw = localStorage.getItem(storageKey);
        if (resumeLatest) {
          const latest = localStorage.getItem(storagePrefix + 'new');
          if (latest && (!raw || JSON.parse(latest).changedAt > JSON.parse(raw).changedAt)) raw = latest;
        }
        const completedPath = id.current && localStorage.getItem(storagePrefix + 'sent:' + id.current);
        if (completedPath?.startsWith('/company/jobs/')) { finished.current = true; router.replace(completedPath); return; }
        if (raw) {
          const cached = JSON.parse(raw) as Snapshot;
          const gone = sessionStorage.getItem(storagePrefix + 'discarded:' + cached.id);
          if ((!gone || cached.changedAt > gone) && cached.id && cached.form && cached.step >= 1 && cached.step <= 4 && (!initial || ignoreInitial || cached.changedAt > initial.updatedAt)) {
            id.current = cached.id; current.current = { form: { ...initialForm, ...cached.form, placement: jobId ? initialForm.placement : 'standard' }, step: restoreJobStep(cached.step, cached.wizardVersion) };
            setForm(current.current.form); setStep(current.current.step); setRestored(true); void save();
          }
        }
      } catch { /* Ignore malformed browser backups. */ }
    }
    const online = () => { void save(); };
    const flush = () => {
      if (!finished.current && active.current && JSON.stringify(current.current) !== saved.current) { localCopy(); void save(true); }
    };
    const visibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('online', online);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', visibility);
    return () => { flush(); active.current = false; window.removeEventListener('online', online); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', visibility); };
  }, [storageKey, storagePrefix, initial, initialForm, save, localCopy, resumeLatest, jobId, router, baseForm]);
  function update(next: CompanyJobForm) {
    if (finished.current) return;
    current.current = { ...current.current, form: next }; setForm(next); localCopy(); setStatus('saving');
    clearTimeout(timer.current); timer.current = setTimeout(() => void save(), 1500);
  }
  async function pause() { clearTimeout(timer.current); timer.current = undefined; active.current = false; await queue.current; }
  function resume() { active.current = true; }
  function clear(sentPath?: string) {
    if (sentPath) finished.current = true;
    try {
      // Delete every alias of this snapshot, including the original /new or ?copy URL.
      for (const key of Object.keys(localStorage)) {
        if (!key.startsWith(storagePrefix) || key.includes(':sent:')) continue;
        try { if (JSON.parse(localStorage.getItem(key) || '{}').id === id.current) localStorage.removeItem(key); } catch {}
      }
      if (sentPath) localStorage.setItem(storagePrefix + 'sent:' + id.current, sentPath);
    } catch {}
  }
  async function discard(base: CompanyJobForm) {
    await pause();
    try {
      if (id.current) {
        const response = await fetch('/api/company/job-drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: id.current }) });
        if (!response.ok && response.status !== 404) throw Error('მონახაზის წაშლა ვერ მოხერხდა');
      }
      try {
        const discardedAt = new Date().toISOString();
        sessionStorage.setItem(storagePrefix + 'discarded:' + id.current, discardedAt);
        handledDiscard.current = discardedAt;
      } catch {}
      clear(); id.current = ''; persisted.current = false; current.current = { form: base, step: 1 }; saved.current = JSON.stringify(current.current);
      setForm(base); setStep(1); setRestored(false); setStatus('idle'); setMessage('');
      if (!jobId) window.history.replaceState(null, '', copySource ? `/company/jobs/new?copy=${encodeURIComponent(copySource)}` : '/company/jobs/new');
    } finally { resume(); }
  }
  return { form, step, update, restored, status, message, savedAt, save, ensureId, pause, resume, clear, discard };
}
