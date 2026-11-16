'use client';

import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { ApplicationQuestions } from './application-questions';
import { useUi } from './ui-language';
import { readCv, type Cv } from '@/lib/cv';
import { savedResumeIdentity } from '@/lib/resume-client';
import { readSwipeApplicant } from '@/lib/swipe-history';
import { track } from '@/lib/analytics-client';
import { emailDraft } from '@/lib/application-contact';
import { defaultApplicationBody, vacancyContacts } from '@/lib/vacancy-details';
import type { PublicJob } from '@/lib/types';
import './vacancy-application-form.css';

export function VacancyApplicationForm({ job }: { job: PublicJob }) {
  const { ui } = useUi();
  const [cv, setCv] = useState<Cv | null>(null);
  const [mode, setMode] = useState('upload');
  const [applicant, setApplicant] = useState({
    name: '',
    phone: '',
    email: '',
  });
  const [questionsReady, setQuestionsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const result = useRef<HTMLOutputElement>(null);
  const contacts = vacancyContacts(job);
  const email =
    contacts.emails.find((contact) => contact.application)?.email ||
    contacts.emails[0]?.email;

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = readCv(window.localStorage);
        setCv(saved);
        if (saved) setMode('jobx');
        setApplicant(
          readSwipeApplicant(window.localStorage) ??
            (saved
              ? { name: saved.fullName, email: saved.email, phone: saved.phone }
              : { name: '', phone: '', email: '' }),
        );
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (sent) result.current?.focus();
  }, [sent]);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || sent) return;
    const body = new FormData(event.currentTarget);
    body.set('job', job.id);
    body.set(
      'answers',
      JSON.stringify(
        Object.fromEntries(
          [...body.entries()]
            .filter(([key]) => key.startsWith('question:'))
            .map(([key, value]) => [key.slice(9), value]),
        ),
      ),
    );
    if (mode === 'jobx' && cv) {
      body.set('cv', JSON.stringify(cv));
      try {
        const identity = savedResumeIdentity(window.localStorage);
        if (identity) body.set('resume', identity.id);
      } catch {}
    } else {
      const file = body.get('file');
      if (file instanceof File && file.size > 4_000_000) {
        setError('PDF 4 მბ-ზე დიდია — უფრო პატარა ფაილი ატვირთე');
        return;
      }
    }
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/swipe/apply', {
        method: 'POST',
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setSent('ამ ვაკანსიაზე შენი რეზიუმე უკვე გაგზავნილია.');
        return;
      }
      if (!response.ok)
        throw Error(data.error || 'გაგზავნა ვერ მოხერხდა. სცადე ხელახლა.');
      setSent(
        'რეზიუმე გაგზავნილია. განაცხადი დამსაქმებლის სივრცეში შენახულია.',
      );
      track('apply', job.id);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'გაგზავნა ვერ მოხერხდა. სცადე ხელახლა.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className="quick-apply vacancy-application"
      id="vacancy-application"
      tabIndex={-1}
    >
      <h3>{ui('CV-ის გაგზავნა')}</h3>
      {sent ? (
        <output
          ref={result}
          tabIndex={-1}
          className="vacancy-application-success"
        >
          {ui(sent)}
        </output>
      ) : (
        <form
          onSubmit={submit}
          aria-label={ui('ვაკანსიაზე განაცხადის გაგზავნა')}
        >
          <fieldset disabled={busy}>
            {(
              [
                ['name', 'სახელი და გვარი', 'text', 'name', 120],
                ['phone', 'ტელეფონი', 'tel', 'tel', 32],
                ['email', 'ელფოსტა', 'email', 'email', 254],
              ] as const
            ).map(([name, label, type, autoComplete, maxLength]) => (
              <label key={name}>
                <span>{ui(label)}</span>
                <input
                  name={name}
                  type={type}
                  autoComplete={autoComplete}
                  maxLength={maxLength}
                  required
                  value={applicant[name]}
                  onChange={(event) =>
                    setApplicant({ ...applicant, [name]: event.target.value })
                  }
                />
              </label>
            ))}
            {cv && (
              <label>
                <span>{ui('რეზიუმე')}</span>
                <select
                  aria-label={ui('რეზიუმეს არჩევა')}
                  value={mode}
                  onChange={(event) => {
                    setMode(event.target.value);
                    setError('');
                  }}
                >
                  <option value="jobx">{ui('ჩემი JOBX რეზიუმე')}</option>
                  <option value="upload">{ui('PDF-ის ატვირთვა')}</option>
                </select>
              </label>
            )}
            {mode === 'upload' ? (
              <label>
                <span>{ui('რეზიუმე — PDF, მაქსიმუმ 4 მბ')}</span>
                <input
                  type="file"
                  name="file"
                  accept="application/pdf,.pdf"
                  required
                />
              </label>
            ) : (
              <p className="quick-apply-note">
                {ui('გაიგზავნება ამ მოწყობილობაზე შენახული JOBX რეზიუმე.')}
              </p>
            )}
            <ApplicationQuestions jobId={job.id} onReady={setQuestionsReady} />
            <label className="vacancy-application-consent">
              <input type="checkbox" name="consent" required />
              <span>
                {ui(
                  'ვეთანხმები, რომ ჩემი რეზიუმე მიიღოს კომპანიამ „{0}“ და შეინახოს JOBX-ზე ამ დამსაქმებლისთვის.',
                  [job.company],
                )}
              </span>
            </label>
            {error && <p role="alert">{ui(error)}</p>}
            <button
              className="primary"
              type="submit"
              disabled={!questionsReady}
            >
              {ui(busy ? 'იგზავნება…' : 'CV-ის გაგზავნა')}
            </button>
          </fieldset>
        </form>
      )}
      {email && (
        <a
          className="vacancy-application-email"
          href={emailDraft(email, job.title, defaultApplicationBody)}
        >
          {ui('ან გაგზავნე ელფოსტით')}
        </a>
      )}
      {contacts.phones.map((phone) => (
        <a
          key={phone.number}
          className="vacancy-application-email"
          href={`tel:${phone.number}`}
        >
          {ui('დარეკვა')}: {phone.display}
        </a>
      ))}
    </section>
  );
}
