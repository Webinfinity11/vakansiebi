'use client';
import { useEffect, useRef, useState } from 'react';
import { defaultTemplates, render, templateKinds, templateLabels, templateLimits, templateVariables, validTemplate, type MessageTemplate, type MessageTemplates, type TemplateKey } from '@/lib/company-message-templates';
import { companyRequest as request } from './company-api';
import './message-templates.css';
import { SelectField } from '../select-field';

export function TemplateFields({ value, onChange, disabled = false }: { value: MessageTemplate; onChange: (v: MessageTemplate) => void; disabled?: boolean }) {
  const subject = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const active = useRef<'subject' | 'body'>('body');
  function insert(variable: string) {
    const key = active.current;
    const input = key === 'subject' ? subject.current : body.current;
    if (!input) return;
    const start = input.selectionStart ?? value[key].length;
    const end = input.selectionEnd ?? start;
    const next = value[key].slice(0, start) + variable + value[key].slice(end);
    if (next.length > templateLimits[key]) return;
    onChange({ ...value, [key]: next });
    requestAnimationFrame(() => { input.focus(); input.setSelectionRange(start + variable.length, start + variable.length); });
  }
  return <div className="cmt-fields">
    <label>წერილის სათაური<input ref={subject} className="cp-input" value={value.subject} maxLength={templateLimits.subject} disabled={disabled} onFocus={() => { active.current = 'subject'; }} onChange={(e) => onChange({ ...value, subject: e.target.value })} /></label>
    <label>ტექსტი<textarea aria-label="ტექსტი" ref={body} className="cp-input" rows={7} value={value.body} maxLength={templateLimits.body} disabled={disabled} onFocus={() => { active.current = 'body'; }} onChange={(e) => onChange({ ...value, body: e.target.value })} /></label>
    <div className="cmt-variables"><span>ცვლადები:</span>{[...templateVariables, '{თარიღი}'].map((v) => <button key={v} type="button" className="cp-btn cp-btn--ghost cp-btn--sm" disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={() => insert(v)}>{v}</button>)}</div>
    <p className="cp-subtle">სათაური: {value.subject.length}/200 · ტექსტი: {value.body.length}/5000</p>
  </div>;
}
export function TemplatePreview({ value }: { value: MessageTemplate }) {
  return <div className="cmt-preview"><strong>{value.subject}</strong><p>{value.body}</p></div>;
}
export function MessageTemplatesSettings({ canEdit, companyName }: { canEdit: boolean; companyName: string }) {
  const [templates, setTemplates] = useState<MessageTemplates>(defaultTemplates);
  const [kind, setKind] = useState<TemplateKey>('received');
  const [value, setValue] = useState(defaultTemplates.received);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  useEffect(() => { let live = true; request('message-templates').then((data: MessageTemplates) => { if (live) { setTemplates(data); setValue(data.received); setLoaded(true); } }).catch((e) => live && setError(e.message)); return () => { live = false; }; }, []);
  async function save(reset = false) {
    setBusy(true); setError(''); setStatus('');
    try { const data: MessageTemplates = await request('message-templates', { kind, ...value, reset }); setTemplates(data); setValue(data[kind]); setStatus(reset ? 'ნაგულისხმევი შაბლონი აღდგენილია.' : 'შაბლონი შენახულია.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'ვერ შეინახა'); }
    finally { setBusy(false); }
  }
  return <section className="cmt-settings" aria-label="წერილის შაბლონები">
    <h2>წერილის შაბლონები</h2><p className="cp-subtle">შაბლონებს კომპანიის მთელი გუნდი იყენებს.</p>
    {!canEdit && <p className="cp-subtle">შაბლონების შეცვლა მფლობელსა და რეკრუტერს შეუძლიათ.</p>}
    {error && <p role="alert" className="cp-alert">{error}</p>}
    <label>შაბლონი<SelectField label="შაბლონი" placeholder="აირჩიეთ" value={kind} disabled={!loaded || busy} onChange={(next) => { const k = next as TemplateKey; setKind(k); setValue(templates[k]); setStatus(''); }} options={templateKinds.map((k) => ({ value: k, label: templateLabels[k] }))} /></label>
    <div className="cmt-columns"><TemplateFields value={value} onChange={setValue} disabled={!loaded || !canEdit || busy} /><div><h3>გადახედვა</h3><p className="cp-subtle">ნიმუში: ნინო · ბუღალტერი</p><TemplatePreview value={render(value, { name: 'ნინო მაისურაძე', jobTitle: 'ბუღალტერი', companyName, date: 'თარიღსა და დროს თქვენთან შევათანხმებთ.' })} /></div></div>
    {canEdit && <div className="cmt-actions"><button type="button" className="cp-btn cp-btn--primary" disabled={!loaded || busy || !validTemplate(value)} onClick={() => void save()}>შენახვა</button><button type="button" className="cp-btn cp-btn--ghost" disabled={!loaded || busy} onClick={() => void save(true)}>ნაგულისხმევის დაბრუნება</button></div>}
    <p role="status">{status}</p>
  </section>;
}
