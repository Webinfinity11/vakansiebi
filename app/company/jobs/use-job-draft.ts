'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { restoreJobStep } from '@/lib/company-job-steps';
import type { CompanyJobForm } from '@/lib/company-job-form';
export type DraftInitial = { id: string; step: number; updatedAt: string; updatedBy: string } | null;
type Snapshot = { wizardVersion?: number; id: string; form: CompanyJobForm; step: number; changedAt: string };

export function useJobDraft(initialForm: CompanyJobForm, initial: DraftInitial, jobId: string | undefined, storageScope: string, copySource?: string) {
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(initial?.step ?? 1);
  const [restored, setRestored] = useState(!!initial && !!jobId);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(initial ? 'saved' : 'idle');
  const [savedAt, setSavedAt] = useState(initial?.updatedAt ?? '');
  const id = useRef(initial?.id ?? '');
  const current = useRef({ form: initialForm, step: initial?.step ?? 1 });
  const saved = useRef(JSON.stringify(current.current));
  const persisted = useRef(!!initial);
  const active = useRef(true);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const storagePrefix = `jobx:job-draft:${storageScope}:`;
  const storageKey = storagePrefix + (jobId ?? initial?.id ?? (copySource ? `copy:${copySource}` : 'new'));
  const ensureId = useCallback(() => id.current ||= crypto.randomUUID(), []);
  const localCopy = useCallback(() => {
    const snapshot: Snapshot = { ...current.current, wizardVersion: 2, id: ensureId(), changedAt: new Date().toISOString() };
    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      if (!jobId) localStorage.setItem(storagePrefix + snapshot.id, JSON.stringify(snapshot));
    } catch { /* Network saving still works when storage is unavailable. */ }
  }, [ensureId, storageKey, storagePrefix, jobId]);
  const save = useCallback((keepalive = false) => {
    clearTimeout(timer.current); timer.current = undefined;
    queue.current = queue.current.catch(() => {}).then(async () => {
      if (!active.current && !keepalive) return;
      const snapshot = { ...current.current };
      const serialized = JSON.stringify(snapshot);
      if (serialized === saved.current) { setStatus(persisted.current ? 'saved' : 'idle'); return; }
      localCopy(); setStatus('saving');
      try {
        const response = await fetch('/api/company/job-drafts', { method: 'POST', keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', id: ensureId(), jobId, ...snapshot, form: { ...snapshot.form, wizardVersion: 2 } }) });
        const body = await response.json();
        if (!response.ok) throw Error(body.error);
        saved.current = serialized; persisted.current = true; setSavedAt(body.updatedAt);
        setStatus(JSON.stringify(current.current) === serialized ? 'saved' : 'saving');
        // Keep only the id-addressed copy once the new draft has a URL.
        if (!jobId && !initial) { try { localStorage.removeItem(storageKey); } catch {} }
        if (!jobId && active.current) {
          const url = new URL(window.location.href); url.searchParams.delete('copy'); url.searchParams.set('draft', id.current);
          window.history.replaceState(null, '', url);
        }
      } catch { setStatus('error'); }
    });
    return queue.current;
  }, [ensureId, jobId, localCopy, storageKey, initial]);
  useEffect(() => {
    active.current = true;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const cached = JSON.parse(raw) as Snapshot;
        if (cached.id && cached.form && cached.step >= 1 && cached.step <= 4 && (!initial || cached.changedAt > initial.updatedAt)) {
          id.current = cached.id; current.current = { form: { ...initialForm, ...cached.form }, step: restoreJobStep(cached.step, cached.wizardVersion) };
          setForm(current.current.form); setStep(current.current.step); setRestored(true); void save();
        }
      }
    } catch { /* Ignore malformed browser backups. */ }
    const online = () => { void save(); };
    const flush = () => {
      if (active.current && timer.current !== undefined) void save(true);
    };
    window.addEventListener('online', online);
    window.addEventListener('pagehide', flush);
    return () => { flush(); active.current = false; window.removeEventListener('online', online); window.removeEventListener('pagehide', flush); };
  }, [storageKey, initial, initialForm, save]);
  function update(next: CompanyJobForm) {
    current.current = { ...current.current, form: next }; setForm(next); localCopy(); setStatus('saving');
    clearTimeout(timer.current); timer.current = setTimeout(() => void save(), 1500);
  }
  function go(next: number) {
    current.current = { ...current.current, step: next }; setStep(next);
    // Moving between steps of an untouched blank form must not create an empty draft.
    // A copy or an edit is saved as before: opening one is already a deliberate start.
    if (!persisted.current && !copySource && !jobId && current.current.form === initialForm) return;
    localCopy(); void save();
  }
  async function pause() { clearTimeout(timer.current); timer.current = undefined; active.current = false; await queue.current; }
  function resume() { active.current = true; }
  function clear() { try {
    localStorage.removeItem(storageKey);
    if (!jobId && id.current) localStorage.removeItem(storagePrefix + id.current);
  } catch {} }
  async function discard(base: CompanyJobForm) {
    await pause();
    try {
      if (id.current) {
        const response = await fetch('/api/company/job-drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: id.current }) });
        if (!response.ok && response.status !== 404) throw Error('მონახაზის წაშლა ვერ მოხერხდა');
      }
      clear(); id.current = ''; persisted.current = false; current.current = { form: base, step: 1 }; saved.current = JSON.stringify(current.current);
      setForm(base); setStep(1); setRestored(false); setStatus('idle');
    } finally { resume(); }
  }
  return { form, step, update, go, restored, status, savedAt, save, ensureId, pause, resume, clear, discard };
}
