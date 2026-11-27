'use client';
import { SelectField } from '../../select-field';
import { useRef, type ReactNode, type ClipboardEventHandler } from 'react';
import { cities } from '@/lib/cities';
import { workModes } from '@/lib/job-submission';
import { type CompanyJobErrors } from '@/lib/company-job-steps';
import type { CompanyJobForm } from '@/lib/company-job-form';
import type { JobTranslator } from './job-import';
import { type CompanyJob } from '../company-api';

type Props = { t?: JobTranslator; skin?: 'company' | 'public'; filled?: (keyof CompanyJobForm)[]; disabled?: boolean; onDescriptionPaste?: ClipboardEventHandler<HTMLTextAreaElement>; onDescriptionBlur?: () => void; afterDescription?: ReactNode; form: CompanyJobForm; errors: CompanyJobErrors; job?: CompanyJob; set: <K extends keyof CompanyJobForm>(key: K, value: CompanyJobForm[K]) => void; blur: (key: keyof CompanyJobForm) => void };
export function JobSteps({ form, errors, job, set, blur, t = text => text, skin = 'company', filled = [], disabled, onDescriptionPaste, onDescriptionBlur, afterDescription }: Props) {
  const description = useRef<HTMLTextAreaElement>(null);
  const imported = !!job?.imported;
  const publicSkin = skin === 'public';
  const prefix = publicSkin ? 'post' : 'job';
  const grid = publicSkin ? 'post-grid' : 'jw-grid';
  // The text itself is what the person pasted; only the fields read from it are marked.
  const auto = (key: keyof CompanyJobForm) => key !== 'description' && filled.includes(key);
  const mark = (key: keyof CompanyJobForm) => auto(key) && <small className={publicSkin ? 'post-auto-mark' : 'jw-auto-mark'}>{t('ავტომატურად')}</small>;
  const attrs = (key: keyof CompanyJobForm) => ({ id: `${prefix}-${key}`, name: key, disabled, 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${prefix}-error-${key}` : undefined, onBlur: () => { blur(key); if (key === 'description') onDescriptionBlur?.(); } });
  const field = (key: keyof CompanyJobForm, title: string, content: ReactNode) => <div className={publicSkin ? 'post-field' : 'jw-field'} data-autofilled={auto(key) || undefined} key={key}><label htmlFor={`${prefix}-${key}`}>{t(title)} {mark(key)}</label>{content}{errors[key] && <p className={publicSkin ? 'post-field-error' : 'jw-error'} id={`${prefix}-error-${key}`} role="alert">{t(errors[key]!)}</p>}</div>;
  const input = (key: keyof CompanyJobForm, title: string, options: { type?: string; maxLength?: number; list?: string; min?: string; max?: string } = {}) => field(key, title, <input className={publicSkin ? undefined : 'cp-input'} {...attrs(key)} {...options} value={String(form[key] ?? '')} onChange={e => set(key, e.target.value as never)} />);
  const select = (key: keyof CompanyJobForm, title: string, values: readonly string[]) => field(key, title, <div onBlur={() => blur(key)}><SelectField id={`${prefix}-${key}`} disabled={disabled} name={key} label={t(title)} placeholder={t('აირჩიეთ')} invalid={!!errors[key]} describedBy={errors[key] ? `${prefix}-error-${key}` : undefined} value={String(form[key] ?? '')} onChange={value => set(key, value as never)} options={values.map(value => ({ value, label: t(value) }))} /></div>);

  return <>
    {field('description', 'ვაკანსიის ტექსტი', <textarea className={publicSkin ? 'post-description' : 'cp-input jw-description'} onPaste={onDescriptionPaste} {...attrs('description')} ref={description} rows={10} maxLength={20000} placeholder={t('ჩასვით ვაკანსიის სრული ტექსტი — დანარჩენი ველები თავად შეივსება.')} value={form.description} onChange={e => set('description', e.target.value)} />)}
    {afterDescription}
    {input('title', 'პოზიციის დასახელება', { maxLength: 120 })}
    <div className={grid}>
      {input('city', form.mode === 'დისტანციური' ? 'ქალაქი (არასავალდებულო)' : 'ქალაქი', { maxLength: 100, list: `${prefix}-cities` })}
      {!imported && select('mode', 'მუშაობის ფორმა', workModes)}
    </div>
    <datalist id={`${prefix}-cities`}>{cities.map(city => <option key={city} value={city} />)}</datalist>
    {!imported && <label className={publicSkin ? 'post-part-time' : 'jw-part-time'}><input id={`${prefix}-employmentType`} disabled={disabled} type="checkbox" checked={form.employmentType === 'ნახევარი განაკვეთი'} onChange={e => set('employmentType', e.target.checked ? 'ნახევარი განაკვეთი' : 'სრული განაკვეთი')} />{t('ნახევარი განაკვეთი')} {mark('employmentType')}</label>}
    {!imported && <section><h3>{t(form.salaryPeriod === 'დღე' ? 'ანაზღაურება — დღეში, ₾ (არასავალდებულო)' : 'ანაზღაურება — თვეში, ₾ (არასავალდებულო)')}</h3><div className={grid}>{input('salaryFrom', 'დან', { type: 'number', min: '1', max: '1000000' })}{input('salaryTo', 'მდე', { type: 'number', min: '1', max: '1000000' })}</div></section>}
  </>;
}
