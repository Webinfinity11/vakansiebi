'use client';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { cvMissingForSending, readCv, type Cv } from '@/lib/cv';
import { CvDraftNote } from '../../vacancy-application-form';
import { useUi } from '@/app/ui-language';
import '@/app/vacancy-application-form.css';
export function CompanyCvBox({
  companyKey,
  name,
}: {
  companyKey: string;
  name: string;
}) {
  const { ui } = useUi();
  const [cv, setCv] = useState<Cv | null>(null);
  const [mode, setMode] = useState('upload');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setCv(readCv(localStorage));
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const missing = cv ? cvMissingForSending(cv) : [];
  const cvDraft = mode === 'jobx' && missing.length > 0;
  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending.current) return;
    const form = new FormData(e.currentTarget);
    form.set('company', companyKey);
    if (mode === 'jobx' && cv) {
      form.delete('file');
      form.set('cv', JSON.stringify(cv));
    }
    const file = form.get('file');
    if (file instanceof File && file.size > 5 * 1024 * 1024) {
      setError('რეზიუმე მაქსიმუმ 5 მბ უნდა იყოს.');
      return;
    }
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/companies/cv-box', {
        method: 'POST',
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'გაგზავნა ვერ მოხერხდა.');
      setMessage(
        data.duplicate
          ? 'ამ კომპანიას შენი რეზიუმე უკვე მიღებული აქვს.'
          : 'რეზიუმე კომპანიას გადაეცა.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'გაგზავნა ვერ მოხერხდა.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="quick-apply vacancy-application company-cv-box"
      aria-labelledby="company-cv-box-title"
    >
      <h2 id="company-cv-box-title">{ui('დაგვიტოვეთ რეზიუმე')}</h2>
      <p>{ui('რეზიუმე კომპანიას ვაკანსიის გარეშეც შეგიძლია გაუგზავნო.')}</p>
      {message ? (
        <output role="status">{ui(message)}</output>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <label>
              <span>{ui('სახელი და გვარი')}</span>
              <input name="name" autoComplete="name" required maxLength={120} />
            </label>
            <label>
              <span>{ui('ელფოსტა')}</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            <label>
              <span>{ui('ტელეფონი')}</span>
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={32}
              />
            </label>
            {cv && (
              <label>
                <span>{ui('რეზიუმე')}</span>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="upload">
                    {ui('PDF ან DOCX-ის ატვირთვა')}
                  </option>
                  <option value="jobx">{ui('ჩემი JOBX რეზიუმე')}</option>
                </select>
              </label>
            )}
            {mode === 'upload' ? (
              <label>
                <span>{ui('PDF ან DOCX, მაქსიმუმ 5 მბ')}</span>
                <input
                  name="file"
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  required
                />
              </label>
            ) : cvDraft ? (
              <CvDraftNote missing={missing} />
            ) : (
              <p>{ui('გაიგზავნება ამ მოწყობილობაზე შენახული JOBX რეზიუმე.')}</p>
            )}
            <label className="vacancy-application-consent">
              <input type="checkbox" name="consent" required />
              <span>
                {ui(
                  'ვეთანხმები, რომ ჩემი რეზიუმე გადაეცეს კომპანიას „{0}“ და შეინახოს JOBX-ზე ამ კომპანიის კერძო ბაზაში, მომავალი ვაკანსიებისთვის.',
                  [name],
                )}
              </span>
            </label>
            {error && <p role="alert">{ui(error)}</p>}
            <button className="primary" type="submit" disabled={cvDraft}>
              {ui(busy ? 'იგზავნება…' : 'რეზიუმეს გაგზავნა')}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}
