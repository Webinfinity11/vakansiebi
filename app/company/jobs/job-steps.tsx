'use client';
import { SelectField } from '../../select-field';
import { useRef, type ReactNode } from 'react';
import { cities } from '@/lib/cities';
import { workModes } from '@/lib/job-submission';
import { descriptionSections, type CompanyJobErrors } from '@/lib/company-job-steps';
import type { CompanyJobForm } from '@/lib/company-job-form';
import { type CompanyJob } from '../company-api';

type Props = { form: CompanyJobForm; errors: CompanyJobErrors; job?: CompanyJob; set: <K extends keyof CompanyJobForm>(key: K, value: CompanyJobForm[K]) => void; blur: (key: keyof CompanyJobForm) => void };
export function JobSteps({ form, errors, job, set, blur }: Props) {
  const description = useRef<HTMLTextAreaElement>(null);
  const imported = !!job?.imported;
  const attrs = (key: keyof CompanyJobForm) => ({ id: `job-${key}`, name: key, 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `error-${key}` : undefined, onBlur: () => blur(key) });
  const field = (key: keyof CompanyJobForm, title: string, content: ReactNode) => <div className="jw-field" key={key}><label htmlFor={`job-${key}`}>{title}</label>{content}{errors[key] && <p className="jw-error" id={`error-${key}`} role="alert">{errors[key]}</p>}</div>;
  const input = (key: keyof CompanyJobForm, title: string, options: { type?: string; maxLength?: number; list?: string; min?: string; max?: string } = {}) => field(key, title, <input className="cp-input" {...attrs(key)} {...options} value={String(form[key] ?? '')} onChange={e => set(key, e.target.value as never)} />);
  const select = (key: keyof CompanyJobForm, title: string, values: readonly string[], optional = false) => field(key, title, <div onBlur={() => blur(key)}><SelectField id={`job-${key}`} name={key} label={title} placeholder="აირჩიეთ" invalid={!!errors[key]} describedBy={errors[key] ? `error-${key}` : undefined} value={String(form[key] ?? '')} onChange={value => set(key, value as never)} options={optional ? [{ value: '', label: 'აირჩიეთ' }, ...values] : [...values]} /></div>);

  function insertHeading(heading: string) {
    const el = description.current;
    const start = el?.selectionStart ?? form.description.length;
    const end = el?.selectionEnd ?? start;
    const prefix = start > 0 && form.description[start - 1] !== '\n' ? '\n' : '';
    const text = prefix + heading + '\n';
    if (form.description.length - (end - start) + text.length > 20000) return;
    set('description', form.description.slice(0, start) + text + form.description.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + text.length, start + text.length); });
  }
  return <>
    {input('title', 'პოზიციის დასახელება', { maxLength: 120 })}
    <div className="jw-grid">
      {input('city', form.mode === 'დისტანციური' ? 'ქალაქი (არასავალდებულო)' : 'ქალაქი', { maxLength: 100, list: 'job-cities' })}
      {!imported && select('mode', 'მუშაობის ფორმა', workModes)}
    </div>
    <datalist id="job-cities">{cities.map(city => <option key={city} value={city} />)}</datalist>
    {!imported && <label className="jw-part-time"><input type="checkbox" checked={form.employmentType === 'ნახევარი განაკვეთი'} onChange={e => set('employmentType', e.target.checked ? 'ნახევარი განაკვეთი' : 'სრული განაკვეთი')} />ნახევარი განაკვეთი</label>}
    {!imported && <section><h3>ანაზღაურება — {form.salaryPeriod === 'დღე' ? 'დღეში' : 'თვეში'}, ₾ (არასავალდებულო)</h3><div className="jw-grid">{input('salaryFrom', 'დან', { type: 'number', min: '1', max: '1000000' })}{input('salaryTo', 'მდე', { type: 'number', min: '1', max: '1000000' })}</div></section>}
    <div>
      <div className="jw-chips">{descriptionSections.map(heading => <button type="button" className="cp-chip" key={heading} onClick={() => insertHeading(heading)}>{heading}</button>)}</div>
      {field('description', 'მოვალეობები, მოთხოვნები და პირობები', <textarea className="cp-input jw-description" {...attrs('description')} ref={description} rows={10} maxLength={20000} value={form.description} onChange={e => set('description', e.target.value)} />)}
    </div>
  </>;
}
