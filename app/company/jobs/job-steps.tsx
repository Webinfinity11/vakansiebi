'use client';
import { SelectField } from '../../select-field';
import { useRef, type ReactNode } from 'react';
import { categories } from '@/lib/types';
import { cities } from '@/lib/cities';
import { workModes, employmentOptions, experienceOptions, languageOptions, languageLevels } from '@/lib/job-submission';
import { descriptionSections, type CompanyJobErrors } from '@/lib/company-job-steps';
import { suggestJobCategory } from '@/lib/company-job-form';
import type { CompanyJobForm } from '@/lib/company-job-form';
import { dateInDays, type CompanyJob } from '../company-api';
import { JobQuestions } from '../job-questions';
import { PlacementChoice } from '../placement-choice';

type Props = { form: CompanyJobForm; step: number; errors: CompanyJobErrors; job?: CompanyJob; owner: boolean; set: <K extends keyof CompanyJobForm>(key: K, value: CompanyJobForm[K]) => void; blur: (key: keyof CompanyJobForm) => void };
export function JobSteps({ form, step, errors, job, owner, set, blur }: Props) {
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
  const position = <>
    <div className="jw-grid">
      {input('title', 'პოზიციის დასახელება', { maxLength: 120 })}
      {input('city', form.mode === 'დისტანციური' ? 'ქალაქი (არასავალდებულო)' : 'ქალაქი', { maxLength: 100, list: 'job-cities' })}
      {!imported && select('mode', 'მუშაობის ფორმა', workModes)}
      {!imported && select('employmentType', 'განაკვეთი', employmentOptions)}
    </div>
    <datalist id="job-cities">{cities.map(city => <option key={city} value={city} />)}</datalist>
    {imported && <p className="jw-note">წყაროდან მიღებული კატეგორია, გრაფიკი და ანაზღაურება ({job.salary || 'მითითებული არ არის'}) უცვლელი დარჩება. მათ შესაცვლელად დაგვიკავშირდით.</p>}
  </>;
  const descriptionField = <>
    <p className="cp-subtle">დაწერეთ თანამშრომლის მოვალეობები და მოთხოვნები. კომპანიის შესახებ ინფორმაცია, შეღავათები და „რატომ ჩვენ“ თქვენი პროფილიდან ავტომატურად ერთვის.</p>
    <div className="jw-chips">{descriptionSections.map(heading => <button type="button" className="cp-chip" key={heading} onClick={() => insertHeading(heading)}>{heading}</button>)}</div>
    {field('description', 'მოვალეობები, მოთხოვნები და პირობები', <textarea className="cp-input jw-description" {...attrs('description')} ref={description} rows={10} maxLength={20000} value={form.description} onChange={e => set('description', e.target.value)} />)}
    <p className="cp-subtle">{form.description.trim().length}  / 20 000 · მინიმუმ 30 სიმბოლო</p>
  </>;
  const applications = <>
    <div className="jw-grid">{input('contact', 'ელფოსტა, ტელეფონი ან ბმული', { maxLength: 2000 })}
    {input('deadline', 'განაცხადების ბოლო ვადა', { type: 'date', min: dateInDays(0), max: dateInDays(90) })}</div>
    <div className="jw-chips">{[{ label: '2 კვირა', days: 14 }, { label: '1 თვე', days: 30 }, { label: '2 თვე', days: 60 }].map(p => <button key={p.days} type="button" className="cp-chip" aria-pressed={form.deadline === dateInDays(p.days)} onClick={() => set('deadline', dateInDays(p.days))}>{p.label}</button>)}</div>
    <div id="job-questions" tabIndex={-1} aria-invalid={!!errors.questions} aria-describedby={errors.questions ? 'error-questions' : undefined} onBlur={() => blur('questions')}><JobQuestions value={form.questions} onChange={value => set('questions', value)} />{errors.questions && <p id="error-questions" className="jw-error" role="alert">{errors.questions}</p>}</div>
  </>;
  if (step === 1) return <>
    {position}
    {descriptionField}
    {!imported && <section className="jw-section"><h3>ანაზღაურება</h3><p className="cp-subtle">ანაზღაურების მითითება სავალდებულო არ არის.</p><div className="jw-grid">{input('salaryFrom', 'დან (₾)', { type: 'number', min: '1', max: '1000000' })}{input('salaryTo', 'მდე (₾)', { type: 'number', min: '1', max: '1000000' })}{select('salaryPeriod', 'პერიოდი', ['თვე', 'დღე'])}{select('salaryBasis', 'თანხის ტიპი', ['ხელზე', 'დარიცხული'])}</div></section>}
    <details className="jw-additional" open={Object.keys(errors).some(key => ['category', 'experience', 'languages', 'contact', 'deadline', 'questions'].includes(key)) || undefined}>
      <summary>დამატებითი პარამეტრები (არასავალდებულო)<span className="cp-subtle">ვადა: {form.deadline === dateInDays(30) ? '30 დღე' : form.deadline || 'არ არის მითითებული'} · საკონტაქტო: {form.contact || 'არ არის მითითებული'}</span></summary>
      <div className="jw-additional-fields">
        {!imported && <>
          <div className="jw-grid">{select('category', 'კატეგორია', categories, true)}{select('experience', 'გამოცდილება (არასავალდებულო)', experienceOptions, true)}</div>
          {!form.category && suggestJobCategory(form.title) && <button type="button" className="cp-btn cp-btn--ghost" onClick={() => set('category', suggestJobCategory(form.title))}>კატეგორიის არჩევა: {suggestJobCategory(form.title)}</button>}
      <fieldset className="jw-languages" id="job-languages" tabIndex={-1} aria-invalid={!!errors.languages} aria-describedby={errors.languages ? 'error-languages' : undefined} onBlur={() => blur('languages')}>
        <legend>ენები (არასავალდებულო)</legend>
        {(form.languages ?? []).map((language, index) => <div className="jw-language" key={index}>
          <div className="jw-field"><label htmlFor={`job-language-${index}`}>ენა</label><SelectField id={`job-language-${index}`} label="ენა" placeholder="აირჩიეთ" value={language.name} onChange={value => set('languages', form.languages.map((l, i) => i === index ? { ...l, name: value as typeof l.name } : l))} options={languageOptions.filter(name => name === language.name || !form.languages.some(l => l.name === name))} /></div>
          <div className="jw-field"><label htmlFor={`job-level-${index}`}>დონე</label><SelectField id={`job-level-${index}`} label="დონე" placeholder="აირჩიეთ" value={language.level} onChange={value => set('languages', form.languages.map((l, i) => i === index ? { ...l, level: value as typeof l.level } : l))} options={[{ value: '', label: 'აირჩიეთ' }, ...languageLevels]} /></div>
          <button type="button" className="cp-icon-btn" aria-label="ენის წაშლა" title="ენის წაშლა" onClick={() => set('languages', form.languages.filter((_, i) => i !== index))}>×</button>
        </div>)}
        {(form.languages ?? []).length < 5 && <button className="cp-btn cp-btn--ghost" type="button" onClick={() => { const name = languageOptions.find(name => !form.languages.some(l => l.name === name)); if (name) set('languages', [...form.languages, { name, level: '' }]); }}>ენის დამატება</button>}
        {errors.languages && <p id="error-languages" className="jw-error" role="alert">{errors.languages}</p>}
      </fieldset>
        </>}
        {applications}
      </div>
    </details>
  </>;
  return <div id="job-placement" tabIndex={-1} aria-invalid={!!errors.placement} aria-describedby={errors.placement ? 'error-placement' : undefined}>
    <PlacementChoice value={form.placement ?? 'standard'} onChange={value => set('placement', value)} disabled={!owner || !!job?.invoice || imported || (!!job && !job.canOrderPlacement)} />
    {errors.placement && <p id="error-placement" className="jw-error">{errors.placement}</p>}
    {!owner && <p className="jw-note">ფასიან განთავსებას ანგარიშის მფლობელი ირჩევს.</p>}
    {imported && <p className="jw-note">ფასიანი განთავსება მხოლოდ JOBX-ზე დამატებული ვაკანსიისთვისაა ხელმისაწვდომი.</p>}
    {job?.invoice && <p className="jw-note">ამ ვაკანსიაზე ინვოისი უკვე გაცემულია. პირობის შესაცვლელად დაგვიკავშირდით. <a href={`/invoices/${job.invoice.token}`} target="_blank" rel="noreferrer">ინვოისის ნახვა</a></p>}
  </div>;
}
