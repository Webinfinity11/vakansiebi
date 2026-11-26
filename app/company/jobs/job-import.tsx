'use client';
import { useEffect, useRef, useState } from 'react';
import type { CompanyJobForm } from '@/lib/company-job-form';
import { mergeJobImport, type JobImportFields } from '@/lib/company-job-import';
import './job-import.css';

const labels: Partial<Record<keyof CompanyJobForm, string>> = {
  title: 'დასახელება',
  city: 'ქალაქი',
  mode: 'მუშაობის ფორმატი',
  employmentType: 'ნახევარი განაკვეთი',
  salaryFrom: 'ხელფასი (დან)',
  salaryTo: 'ხელფასი (მდე)',
  description: 'აღწერა',
};
type Note = { name: string; filled: (keyof CompanyJobForm)[] };
export function JobImport({
  form,
  defaults,
  noteKey,
  resetKey = 0,
  disabled,
  onApply,
}: {
  form: CompanyJobForm;
  defaults: CompanyJobForm;
  noteKey: string;
  resetKey?: number;
  disabled?: boolean;
  onApply: (next: CompanyJobForm) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef({ form, defaults, onApply, noteKey });
  useEffect(() => {
    latest.current = { form, defaults, onApply, noteKey };
  });
  const active = useRef(true);
  const busyRef = useRef(false);
  const requestVersion = useRef(0);
  const previousReset = useRef(resetKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState<Note | null>(null);
  const [undo, setUndo] = useState<CompanyJobForm | null>(null);
  const [replacement, setReplacement] = useState('');
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setUndo(null);
      setReplacement('');
      setNote(null);
      try {
        const saved = JSON.parse(sessionStorage.getItem(noteKey) ?? 'null');
        if (
          saved &&
          typeof saved.name === 'string' &&
          Array.isArray(saved.filled)
        )
          setNote({
            name: saved.name,
            filled: saved.filled.filter((key: string) => key in labels),
          });
      } catch {
        /* Storage is optional. */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [noteKey]);
  useEffect(() => {
    if (previousReset.current === resetKey) return;
    previousReset.current = resetKey;
    if (input.current) input.current.value = '';
    requestVersion.current += 1;
    if (busyRef.current) setError('ფორმა შეიცვალა. ატვირთეთ ფაილი ხელახლა.');
    busyRef.current = false;
    setBusy(false); setUndo(null); setReplacement(''); setNote(null);
  }, [resetKey]);
  function saveNote(next: Note | null) {
    setNote(next);
    try {
      if (next) sessionStorage.setItem(latest.current.noteKey, JSON.stringify(next));
      else sessionStorage.removeItem(latest.current.noteKey);
    } catch {
      /* Storage is optional. */
    }
  }
  async function upload(file?: File) {
    if (input.current) input.current.value = '';
    if (!file || disabled || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    const version = requestVersion.current;
    try {
      const data = new FormData();
      data.set('file', file);
      const response = await fetch('/api/company/job-import', {
        method: 'POST',
        body: data,
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error || 'ფაილის ატვირთვა ვერ მოხერხდა.');
      if (!active.current || version !== requestVersion.current) return;
      const before = latest.current.form;
      const imported = result.fields as JobImportFields;
      const merged = mergeJobImport(before, latest.current.defaults, imported);
      setUndo(before);
      setReplacement(
        merged.kept.includes('description') ? (imported.description ?? '') : '',
      );
      latest.current.onApply(merged.form);
      saveNote({ name: file.name, filled: merged.filled });
    } catch (e) {
      if (active.current && version === requestVersion.current)
        setError(
          e instanceof Error ? e.message : 'ფაილის ატვირთვა ვერ მოხერხდა.',
        );
    } finally {
      if (version === requestVersion.current) {
        busyRef.current = false;
        if (active.current) setBusy(false);
        if (input.current) input.current.value = '';
      }
    }
  }
  return (
    <section className="ji" aria-label="ფაილიდან შევსება" aria-busy={busy}>
      <div className="ji-upload">
        <button
          type="button"
          className="cp-btn cp-btn--secondary"
          disabled={disabled || busy}
          onClick={() => input.current?.click()}
        >
          {busy ? 'ფაილის წაკითხვა…' : 'ფაილის ატვირთვა'}
        </button>
        <input
          ref={input}
          type="file"
          accept=".pdf,.docx,.odt,.txt"
          hidden
          disabled={disabled || busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <span className="cp-subtle">PDF, DOCX, ODT ან TXT</span>
      </div>
      {error && (
        <p role="alert" className="jw-error">
          {error}
        </p>
      )}
      {note && (
        <div className="ji-note" aria-live="polite">
          <p className="cp-subtle">{note.name}</p>
          <p>
            {note.filled.length
              ? `ფაილიდან შეივსო: ${note.filled.map((key) => labels[key]).join(', ')}. გადახედეთ გაგზავნამდე.`
              : 'შევსებული ველები უცვლელად დარჩა.'}
          </p>
        </div>
      )}
      {(replacement || undo) && (
        <div className="ji-actions">
          {replacement && (
            <button
              type="button"
              className="cp-btn cp-btn--secondary"
              disabled={disabled || busy}
              onClick={() => {
                onApply({ ...form, description: replacement });
                setReplacement('');
                if (note)
                  saveNote({
                    ...note,
                    filled: [
                      ...note.filled.filter((key) => key !== 'description'),
                      'description',
                    ],
                  });
              }}
            >
              აღწერის ჩანაცვლება ფაილის ტექსტით
            </button>
          )}
          {undo && (
            <button
              type="button"
              className="cp-btn cp-btn--secondary"
              disabled={disabled || busy}
              onClick={() => {
                onApply(undo);
                setUndo(null);
                setReplacement('');
                saveNote(null);
              }}
            >
              დაბრუნება
            </button>
          )}
        </div>
      )}
    </section>
  );
}
