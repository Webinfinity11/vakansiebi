'use client';
import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import type { CompanyJobForm } from '@/lib/company-job-form';
import { looksLikeVacancyText, mergeJobImport, parseJobText, type JobImportFields } from '@/lib/company-job-import';
import './job-import.css';

export type JobTranslator = (text: string, vars?: (string | number)[]) => string;
const identity: JobTranslator = (text, vars) => text.replace(/\{(\d+)\}/g, (_, index) => String(vars?.[Number(index)] ?? ''));
type Key = keyof CompanyJobForm;
const labels: Partial<Record<Key, string>> = {
  title: 'დასახელება', city: 'ქალაქი', mode: 'მუშაობის ფორმა',
  employmentType: 'ნახევარი განაკვეთი', salaryFrom: 'ხელფასი (დან)',
  salaryTo: 'ხელფასი (მდე)', salaryBasis: 'ანაზღაურების ტიპი', description: 'აღწერა',
};
type ImportState = { filled: Key[]; edited: Key[]; note: boolean; undo: CompanyJobForm | null; replacement: string; extra: string[] };
const emptyState = (): ImportState => ({ filled: [], edited: [], note: false, undo: null, replacement: '', extra: [] });
/** Fields outside the job form (the public form's company and email). Returns the labels it filled. */
type ContactFill = { fill: (found: Pick<JobImportFields, 'company' | 'email'>) => string[]; undo: () => void };

/** Shared by the file picker and description; browser-only parsing never sends text away. */
export function useJobImport({ form, defaults, noteKey, disabled = false, onApply, preserveHidden = false, contacts }: {
  form: CompanyJobForm; defaults: CompanyJobForm; noteKey: string; disabled?: boolean;
  onApply: (next: CompanyJobForm) => void; preserveHidden?: boolean; contacts?: ContactFill;
}) {
  const [state, setState] = useState<ImportState>(emptyState);
  const current = useRef({ form, defaults, disabled, onApply, preserveHidden, contacts });
  useEffect(() => { current.current = { form, defaults, disabled, onApply, preserveHidden, contacts }; });
  const stateRef = useRef(state);
  const version = useRef(0);
  const lastText = useRef('');
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      let restored = emptyState();
      try {
        const saved = JSON.parse(sessionStorage.getItem(noteKey) || 'null');
        if (saved && Array.isArray(saved.filled)) restored = {
          ...restored, filled: saved.filled.filter((key: Key) => key in labels),
          edited: Array.isArray(saved.edited) ? saved.edited.filter((key: Key) => key in labels) : [],
          note: saved.note === true || typeof saved.name === 'string',
          extra: Array.isArray(saved.extra) ? saved.extra.filter((label: unknown) => typeof label === 'string') : [],
        };
      } catch { /* Storage is optional. */ }
      stateRef.current = restored; setState(restored);
    });
    return () => { cancelled = true; version.current += 1; };
  }, [noteKey]);
  function save(next: ImportState) {
    stateRef.current = next; setState(next);
    try { sessionStorage.setItem(noteKey, JSON.stringify({ filled: next.filled, edited: next.edited, note: next.note, extra: next.extra })); } catch {}
  }
  function clear() {
    version.current += 1; lastText.current = '';
    stateRef.current = emptyState(); setState(stateRef.current);
    try { sessionStorage.removeItem(noteKey); } catch {}
  }
  function edit(key: Key) {
    const previous = stateRef.current;
    save({ ...previous, filled: previous.filled.filter(k => k !== key), edited: [...new Set([...previous.edited, key])] });
  }
  function apply(fields: JobImportFields, before = current.current.form, description?: string, undo = before) {
    const c = current.current;
    if (c.disabled) return;
    const candidates = { ...fields };
    for (const key of stateRef.current.edited) delete candidates[key as keyof JobImportFields];
    if (c.preserveHidden) delete (candidates as Partial<CompanyJobForm>).salaryBasis;
    const merged = mergeJobImport(before, c.defaults, candidates);
    if (description !== undefined) {
      merged.form.description = description;
      if (description !== undo.description && !merged.filled.includes('description')) merged.filled.push('description');
    }
    c.onApply(merged.form);
    const extra = c.contacts ? c.contacts.fill({ company: fields.company, email: fields.email }) : [];
    save({ ...stateRef.current, note: true, undo,
      extra: [...new Set([...stateRef.current.extra, ...extra])],
      replacement: description === undefined && fields.description && merged.form.description !== fields.description ? fields.description : '',
      filled: [...new Set([...stateRef.current.filled, ...merged.filled])],
    });
  }
  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const c = current.current;
    const text = event.clipboardData.getData('text/plain');
    if (c.disabled || !looksLikeVacancyText(text)) return;
    const el = event.currentTarget;
    const plain = (c.form.description.slice(0, el.selectionStart) + text + c.form.description.slice(el.selectionEnd)).slice(0, 20000);
    const replaces = !c.form.description || (el.selectionStart === 0 && el.selectionEnd === c.form.description.length);
    const fields = parseJobText(text);
    lastText.current = plain;
    if (replaces) {
      event.preventDefault();
      const cleaned = fields.description || text.slice(0, 20000);
      lastText.current = cleaned;
      apply(fields, c.form, cleaned, { ...c.form, description: plain });
    } else {
      // Let the native paste update the textarea, then merge against its latest form.
      delete fields.description;
      const pasteVersion = version.current;
      setTimeout(() => {
        if (pasteVersion !== version.current) return;
        lastText.current = current.current.form.description;
        apply(fields);
      }, 0);
    }
  }
  function blurDescription() {
    const c = current.current;
    if (c.disabled || c.form.title.trim() || c.form.description === lastText.current || !looksLikeVacancyText(c.form.description)) return;
    lastText.current = c.form.description;
    const fields = parseJobText(c.form.description);
    delete fields.description;
    apply(fields);
  }
  return { ...state, version, apply, edit, clear, paste, blurDescription,
    undoImport() { if (!current.current.disabled && stateRef.current.undo) { current.current.onApply(stateRef.current.undo); current.current.contacts?.undo(); save({ ...emptyState(), edited: stateRef.current.edited }); } },
    replaceDescription() {
      if (current.current.disabled || !stateRef.current.replacement) return;
      current.current.onApply({ ...current.current.form, description: stateRef.current.replacement });
      save({ ...stateRef.current, replacement: '', filled: [...new Set([...stateRef.current.filled, 'description' as const])] });
    },
  };
}
export function JobImport({ controller, endpoint = '/api/company/job-import', disabled, t = identity, skin = 'company' }: {
  controller: ReturnType<typeof useJobImport>; endpoint?: string; disabled?: boolean; t?: JobTranslator; skin?: 'company' | 'public';
}) {
  const input = useRef<HTMLInputElement>(null);
  const active = useRef(true);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef({ controller, disabled });
  useEffect(() => { latest.current = { controller, disabled }; });
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function upload(file?: File) {
    if (input.current) input.current.value = '';
    if (!file || disabled || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    const version = controller.version.current;
    try {
      const data = new FormData(); data.set('file', file);
      const response = await fetch(endpoint, { method: 'POST', body: data });
      const result = await response.json();
      if (!active.current || version !== latest.current.controller.version.current || latest.current.disabled) return;
      if (!response.ok) throw new Error(result.error || 'ფაილის ატვირთვა ვერ მოხერხდა.');
      latest.current.controller.apply(result.fields as JobImportFields);
    } catch (reason) {
      if (active.current && version === latest.current.controller.version.current)
        setError(reason instanceof Error ? reason.message : 'ფაილის ატვირთვა ვერ მოხერხდა.');
    } finally { busyRef.current = false; if (active.current) setBusy(false); }
  }
  const publicSkin = skin === 'public';
  const button = publicSkin ? 'post-secondary' : 'cp-btn cp-btn--secondary';
  const subtle = publicSkin ? 'post-import-subtle' : 'cp-subtle';
  return <section className={publicSkin ? 'post-import' : 'ji'} aria-label={t('ფაილიდან შევსება')} aria-busy={busy}>
    <div className={publicSkin ? 'post-import-actions' : 'ji-upload'}>
      <button type="button" className={button} disabled={disabled || busy} onClick={() => input.current?.click()}>{t(busy ? 'ფაილის წაკითხვა…' : 'ფაილის ატვირთვა')}</button>
      <input ref={input} type="file" accept=".pdf,.docx,.odt,.txt" hidden disabled={disabled || busy} onChange={e => void upload(e.target.files?.[0])} />
      <span className={subtle}>{t('PDF, DOCX, ODT ან TXT')}</span>
    </div>
    {error && <p role="alert" className={publicSkin ? 'post-field-error' : 'jw-error'}>{t(error)}</p>}
    {controller.note && <p className={subtle} aria-live="polite">{controller.filled.length || controller.extra.length ? t('შეივსო ავტომატურად: {0}. გადახედეთ გაგზავნამდე.', [[...controller.extra.map(label => t(label)), ...controller.filled.map(key => t(labels[key] || key))].join(', ')]) : t('შევსებული ველები უცვლელად დარჩა.')}</p>}
    {(controller.replacement || controller.undo) && <div className={publicSkin ? 'post-import-actions' : 'ji-actions'}>
      {controller.replacement && <button type="button" className={button} disabled={disabled || busy} onClick={controller.replaceDescription}>{t('აღწერის ჩანაცვლება ფაილის ტექსტით')}</button>}
      {controller.undo && <button type="button" className={button} disabled={disabled || busy} onClick={controller.undoImport}>{t('დაბრუნება')}</button>}
    </div>}
  </section>;
}
